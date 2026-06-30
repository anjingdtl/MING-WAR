import type { FactionId, GameState, RegionId, WarState } from "./types";
import type { LedgerEntry } from "./ledger";
import { addTreaty, ensureRelation } from "./diplomacy";

/**
 * S5c: 和平谈判与战争结束。
 *
 * 战争不再由单月攻击决定胜负 —— 每月按战争支持度（战疲/财政/占领/合法性）
 * 判断是否进入和谈：一方支持度崩塌求和、进攻方完胜、或长期双方疲惫媾和。
 * 和谈结算为割地 / 赔款 / 朝贡 / 停战，写回 diplomacy（接通 S5a 外交环），
 * 财政部分走账本。确定性，不消费 random。
 */

export interface PeaceResult {
  warId: string;
  winnerId: FactionId;
  loserId: FactionId;
  reason: "war-support" | "total-victory" | "exhaustion";
  cedeRegions: RegionId[];
  indemnity: number;
  tribute: boolean;
  truceMonths: number;
}

const SUPPORT_THRESHOLD = 25; // 战争支持度崩塌 → 求和
const EXHAUSTION_MONTHS = 48; // 长期战争双方疲惫 → 媾和

/**
 * 战争支持度（0..100）。战疲侵蚀、财政破产、军队崩溃压低支持度；战场领先、
 * 合法性支撑抬高。这是"军费/补给/国内政治能迫使停战"的数值化身。
 */
export function computeWarSupport(
  state: GameState,
  war: WarState,
  factionId: FactionId,
): number {
  const f = state.factions[factionId];
  if (!f) return 0;
  const isAttacker = factionId === war.attackerFactionId;
  // progress 高 = 进攻方占优；防守方反向
  const advantage = isAttacker ? war.progress - 50 : 50 - war.progress;
  const support =
    60 +
    advantage * 0.3 -
    f.warExhaustion * 0.5 +
    (f.legitimacy - 50) * 0.2 -
    (f.treasury < 0 ? 25 : 0) -
    (f.armyTotal < 5000 ? 20 : 0);
  return Math.max(0, Math.min(100, Math.round(support)));
}

/**
 * 选割让地区：败方控制且与胜方相邻的地区，优先胜方核心故土。
 * exhaustion（疲惫平局）不割地；total-victory 割最多 3 地，war-support 割 1 地。
 */
function selectCedeRegions(
  state: GameState,
  winnerId: FactionId,
  loserId: FactionId,
  reason: PeaceResult["reason"],
): RegionId[] {
  if (reason === "exhaustion") return [];
  const candidates = Object.values(state.regions).filter(
    (r) =>
      r.controllerFactionId === loserId &&
      Object.values(state.regions).some(
        (mine) => mine.controllerFactionId === winnerId && mine.connections.includes(r.id),
      ),
  );
  const count =
    reason === "total-victory" ? Math.min(3, candidates.length) : Math.min(1, candidates.length);
  const sorted = [...candidates].sort((a, b) => {
    const ac = a.coreFactionIds.includes(winnerId) ? 1 : 0;
    const bc = b.coreFactionIds.includes(winnerId) ? 1 : 0;
    return bc - ac;
  });
  return sorted.slice(0, count).map((r) => r.id);
}

function makePeace(
  state: GameState,
  war: WarState,
  winnerId: FactionId,
  loserId: FactionId,
  reason: PeaceResult["reason"],
): PeaceResult {
  const loser = state.factions[loserId];
  const indemnity =
    reason === "total-victory"
      ? Math.min(Math.max(0, loser.treasury), 50000)
      : Math.min(Math.max(0, loser.treasury), 15000);
  // 朝贡：完胜且败方是定居政权（dynasty/local/maritime），游牧/义军不纳贡
  const tribute =
    reason === "total-victory" && loser.type !== "rebel" && loser.type !== "tribal";
  const truceMonths = reason === "total-victory" ? 120 : 60;
  return {
    warId: war.id,
    winnerId,
    loserId,
    reason,
    cedeRegions: selectCedeRegions(state, winnerId, loserId, reason),
    indemnity,
    tribute,
    truceMonths,
  };
}

/** 判断战争是否进入和谈。 */
export function checkPeace(state: GameState, war: WarState): PeaceResult | null {
  const atk = state.factions[war.attackerFactionId];
  const def = state.factions[war.defenderFactionId];
  if (!atk || !def) return null;
  if (atk.status !== "active" || def.status !== "active") return null;
  const atkSupport =
    war.front?.attackerWarSupport ?? computeWarSupport(state, war, war.attackerFactionId);
  const defSupport =
    war.front?.defenderWarSupport ?? computeWarSupport(state, war, war.defenderFactionId);

  // 进攻方推进到底 → 完胜
  if (war.progress >= 95) {
    return makePeace(state, war, war.attackerFactionId, war.defenderFactionId, "total-victory");
  }
  // 任一方支持度崩塌 → 对方胜
  if (atkSupport <= SUPPORT_THRESHOLD) {
    return makePeace(state, war, war.defenderFactionId, war.attackerFactionId, "war-support");
  }
  if (defSupport <= SUPPORT_THRESHOLD) {
    return makePeace(state, war, war.attackerFactionId, war.defenderFactionId, "war-support");
  }
  // 长期双方疲惫 → 媾和（支持度略高者占优，但不割地）
  if (war.monthsActive >= EXHAUSTION_MONTHS && atkSupport < 45 && defSupport < 45) {
    const winner =
      atkSupport >= defSupport ? war.attackerFactionId : war.defenderFactionId;
    const loser = winner === war.attackerFactionId ? war.defenderFactionId : war.attackerFactionId;
    return makePeace(state, war, winner, loser, "exhaustion");
  }
  return null;
}

/**
 * 应用和谈结算：割地易主、赔款（守恒转移）、朝贡条约、停战。返回财政条目，
 * 由 simulation applyLedgerToState 结算，保持 Δtreasury===账本净额。
 */
export function resolvePeace(state: GameState, peace: PeaceResult): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const winner = state.factions[peace.winnerId];
  const loser = state.factions[peace.loserId];
  if (!winner || !loser) return entries;

  // 割地：地区易主，胜方接管（控制度提升、留驻防军）
  for (const rid of peace.cedeRegions) {
    const r = state.regions[rid];
    if (r) {
      r.controllerFactionId = peace.winnerId;
      r.control = Math.max(50, r.control);
      r.garrison = Math.max(r.garrison, 2000);
    }
  }

  // 赔款：守恒白银转移
  if (peace.indemnity > 0) {
    const paid = Math.min(Math.max(0, loser.treasury), peace.indemnity);
    if (paid > 0) {
      entries.push({
        category: "expense-tribute",
        source: `${loser.name} 战败赔款`,
        amount: -paid,
        factionId: loser.id,
      });
      entries.push({
        category: "income-tribute",
        source: `${winner.name} 受赔`,
        amount: paid,
        factionId: winner.id,
      });
    }
  }

  // 朝贡：败方成为胜方朝贡国（obligations>0 = 败方朝贡胜方）
  if (peace.tribute) {
    addTreaty(state, peace.loserId, peace.winnerId, "tribute");
    const rel = ensureRelation(state, peace.loserId, peace.winnerId);
    rel.obligations = 25;
  }

  // 停战 + 战后关系恶化
  addTreaty(state, peace.winnerId, peace.loserId, "truce");
  const truceRel = ensureRelation(state, peace.winnerId, peace.loserId);
  truceRel.truceMonths = peace.truceMonths;
  truceRel.relation = Math.max(-100, truceRel.relation - 20);
  truceRel.rivalry = Math.min(100, truceRel.rivalry + 20);

  // 战后战疲缓和（胜方缓 15、败方缓 10），让停战有意义
  winner.warExhaustion = Math.max(0, winner.warExhaustion - 15);
  loser.warExhaustion = Math.max(0, loser.warExhaustion - 10);

  return entries;
}

/**
 * S6 遗留#2：玩家主动求和（白和）。
 *
 * 玩家参与的战争可主动结束：不割地/不赔款/不纳贡，仅停战 60 月 + 战后关系
 * 恶化 + 双方战疲缓和。让玩家能脱身无法取胜或不愿持续的长期战争。占领/
 * 赔款仍由 S5c 自动和谈（checkPeace）按战场态势决定，此函数只提供"体面退出"。
 */
export function requestPeace(
  state: GameState,
  factionId: FactionId,
  warId: string,
): PeaceResult | null {
  const war = state.wars.find((w) => w.id === warId);
  if (!war) return null;
  if (war.attackerFactionId !== factionId && war.defenderFactionId !== factionId) return null;
  const opponentId =
    war.attackerFactionId === factionId ? war.defenderFactionId : war.attackerFactionId;
  const peace: PeaceResult = {
    warId: war.id,
    winnerId: factionId,
    loserId: opponentId,
    reason: "exhaustion",
    cedeRegions: [],
    indemnity: 0,
    tribute: false,
    truceMonths: 60,
  };
  resolvePeace(state, peace);
  state.wars = state.wars.filter((w) => w.id !== warId);
  return peace;
}
