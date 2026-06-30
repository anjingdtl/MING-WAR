import type { DiplomaticRelation, FactionId, GameState, TreatyType } from "./types";
import type { LedgerEntry } from "./ledger";

/**
 * S5 外交环：双边关系 + 条约。
 *
 * 战争不再是"单月战斗"——开战前先过外交判断：停战（truce）阻止开战、
 * 同盟（alliance）触发参战、朝贡/互市作为条约月度反作用于财政。关系的
 * 财政后果（关税/朝贡白银）一律走 ledger（S1c 唯一真相源），保持
 * Δtreasury === 账本净额；本模块确定性，不消费 random（避免扰动确定性
 * 模拟的随机序列，见 PROGRESS §5.1）。
 */

/** 规范化双边 key：字典序小的在前，保证 A↔B 只存一份。 */
export function relationKey(a: FactionId, b: FactionId): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function getRelation(
  state: GameState,
  a: FactionId,
  b: FactionId,
): DiplomaticRelation | undefined {
  if (a === b) return undefined;
  return state.diplomacy?.[relationKey(a, b)];
}

/** 读取或创建（中性默认）双边关系。 */
export function ensureRelation(
  state: GameState,
  a: FactionId,
  b: FactionId,
): DiplomaticRelation {
  if (a === b) throw new Error(`ensureRelation: 同一势力 ${a}`);
  if (!state.diplomacy) state.diplomacy = {};
  const key = relationKey(a, b);
  const existing = state.diplomacy[key];
  if (existing) return existing;
  const rel: DiplomaticRelation = {
    factionA: a <= b ? a : b,
    factionB: a <= b ? b : a,
    relation: 0,
    trust: 40,
    threat: 0,
    rivalry: 0,
    truceMonths: 0,
    treaties: [],
    obligations: 0,
  };
  state.diplomacy[key] = rel;
  return rel;
}

export function hasTruce(state: GameState, a: FactionId, b: FactionId): boolean {
  return (getRelation(state, a, b)?.truceMonths ?? 0) > 0;
}

export function isAlly(state: GameState, a: FactionId, b: FactionId): boolean {
  return (getRelation(state, a, b)?.treaties ?? []).includes("alliance");
}

export function addTreaty(
  state: GameState,
  a: FactionId,
  b: FactionId,
  treaty: TreatyType,
): void {
  const rel = ensureRelation(state, a, b);
  if (!rel.treaties.includes(treaty)) rel.treaties.push(treaty);
}

export function removeTreaty(
  state: GameState,
  a: FactionId,
  b: FactionId,
  treaty: TreatyType,
): void {
  const rel = getRelation(state, a, b);
  if (rel) rel.treaties = rel.treaties.filter((t) => t !== treaty);
}

/** 两势力是否领土相邻（一方控制区与另一方控制区接壤）。 */
export function areNeighbors(state: GameState, a: FactionId, b: FactionId): boolean {
  for (const region of Object.values(state.regions)) {
    if (region.controllerFactionId !== a) continue;
    for (const connId of region.connections) {
      if (state.regions[connId]?.controllerFactionId === b) return true;
    }
  }
  return false;
}

/**
 * b 对 a 的威胁度（0..100）：邻近 + b 军力占比。非邻国威胁极低
 * （跨境干预成本高昂，符合"远交近攻"）。
 */
export function computeThreat(state: GameState, a: FactionId, b: FactionId): number {
  const fa = state.factions[a];
  const fb = state.factions[b];
  if (!fa || !fb) return 0;
  if (!areNeighbors(state, a, b)) return 5;
  const total = fa.armyTotal + fb.armyTotal;
  if (total <= 0) return 0;
  const bShare = fb.armyTotal / total;
  return Math.round(Math.min(100, 20 + bShare * 80));
}

const TRADE_TARIFF = 1500; // 互市月度关税（每方）—— 边缘势力白银来源
const TRIBUTE_SILVER = 8000; // 朝贡月度白银

/**
 * 月度外交演变（确定性）。返回财政条目（互市关税 / 朝贡白银），由
 * simulation 调用方 applyLedgerToState 结算——条约的财政后果走账本，
 * 保持 Δtreasury === 账本净额（SPEC §21.2）。
 *
 * - 停战倒计时；到期移除 truce 条约
 * - 威胁重算（双向取较大值，反映互视威胁）
 * - relation / trust 缓慢趋近目标（同盟 +、威胁/rivalry −）
 * - 互市 trade → 双方月度关税收入（income-tariff）
 * - 朝贡 tribute（obligations>0：factionA 朝贡 factionB）→ 守恒白银转移
 */
export function advanceDiplomacy(state: GameState): LedgerEntry[] {
  if (!state.diplomacy) return [];
  const entries: LedgerEntry[] = [];
  for (const rel of Object.values(state.diplomacy)) {
    const fa = state.factions[rel.factionA];
    const fb = state.factions[rel.factionB];
    if (!fa || !fb) continue;
    const aName = fa.name;
    const bName = fb.name;

    // 停战倒计时
    if (rel.truceMonths > 0) {
      rel.truceMonths -= 1;
      if (rel.truceMonths <= 0) {
        rel.truceMonths = 0;
        rel.treaties = rel.treaties.filter((t) => t !== "truce");
      }
    }

    // 威胁重算
    const threatAB = computeThreat(state, rel.factionA, rel.factionB);
    const threatBA = computeThreat(state, rel.factionB, rel.factionA);
    rel.threat = Math.max(threatAB, threatBA);

    // 关系 / 信任趋近
    const allied = rel.treaties.includes("alliance");
    const targetRelation = clamp(
      50 - rel.threat - rel.rivalry * 0.4 + rel.obligations * 0.2 + (allied ? 25 : 0),
      -100,
      100,
    );
    rel.relation = clamp(rel.relation + (targetRelation - rel.relation) * 0.1, -100, 100);
    const targetTrust = clamp(30 + rel.relation * 0.3 + (allied ? 15 : 0), 0, 100);
    rel.trust = clamp(rel.trust + (targetTrust - rel.trust) * 0.05, 0, 100);

    // 宿敌缓慢衰减（结构性对立也会随世代更替淡化）
    rel.rivalry = Math.max(0, rel.rivalry - 0.2);

    // 互市：双方月度关税
    if (rel.treaties.includes("trade")) {
      entries.push({
        category: "income-tariff",
        source: `${aName} 互市关税`,
        amount: TRADE_TARIFF,
        factionId: rel.factionA,
      });
      entries.push({
        category: "income-tariff",
        source: `${bName} 互市关税`,
        amount: TRADE_TARIFF,
        factionId: rel.factionB,
      });
    }

    // 朝贡：obligations>0 表示 factionA 朝贡 factionB，月度白银转移（守恒）
    if (rel.treaties.includes("tribute") && rel.obligations > 0) {
      const silver = Math.min(fa.treasury, TRIBUTE_SILVER);
      if (silver > 0) {
        entries.push({
          category: "expense-tribute",
          source: `${aName} 朝贡 ${bName}`,
          amount: -silver,
          factionId: rel.factionA,
        });
        entries.push({
          category: "income-tribute",
          source: `${aName}→${bName} 朝贡`,
          amount: silver,
          factionId: rel.factionB,
        });
      }
    }
  }
  return entries;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
