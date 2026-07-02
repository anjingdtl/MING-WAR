import type { FactionState, FrontState, GameState, MilitaryPosture, Modifier, RegionState, WarState } from "./types";
import type { RandomSource } from "./random";
import { queryModifier } from "./modifiers";
import { hasTruce, isAlly } from "./diplomacy";
import { getValidMilitaryTargets } from "./decisions";

/* ===========================================================================
 * ⚠️  DETERMINISM-CHANGE (v0.8 — 2026-07-02)
 * DETERMINISM-CHANGE (v0.9.1 — 2026-07-02)
 * ---------------------------------------------------------------------------
 * v0.8 已重写持久战公式与战斗结算语义。v0.9.1 新增 committedForce 第三钳位
 * （兵员上限池 mobilizationPool），使 committedForce = min(growth, maxCommit,
 * poolCap) 三取小。所有 seed 命运重新分配；hash:state 与 v0.8.2 不再一致。
 *
 * 历史变更摘要（v0.8）：
 *  1. createInitialFront(distance) 引入 mobilizationMonths（相邻=0，distance≥4=3）。
 *  2. 新增 M1 committedForce 持久化（faction.warCommitments[regionId]）。
 *  3. 新增 M2 距离衰减（distanceMult + supplyDecay）+ 补给崩溃（<50 → ×2）。
 *  4. 新增 M3 驻军参与防御（garrison × 0.5）。
 *  5. 新增 M4 主场凝聚力（faction.homeTurfMult：建州 1.40 / 察哈尔 1.30 / 大明 1.05）。
 *  6. M5 重写 advanceWar 持久战公式（基线 1.5 + (ratio-1)×2.5 - 0.6 - 0.3(d-1) - 0.5g/30k）。
 *  7. resolveBattle 不再 mutate faction.armyTotal（attackerLoss/defenderLoss
 *     通过返回 BattleResult 暴露，由 runWarPhase 在新遭遇战时扣 armyTotal）。
 *  8. attackerLosses 改为基于 committedForce（不再 armyTotal×0.25），
 *     warCost/warGrain 同理。
 *
 * v0.9.1 增量：
 *  9. committedForce 三取小钳位 = min(maxCommit, poolCap, growth)。
 *     反映"长期养兵"成本：大明开局 pool 11.6万，从首月就钳住 committedForce。
 * 10. mobilizationPool 在 runFactionPhase 月度自然增长 5%（封顶 1.5× armyTotal）。
 *
 * 验收：549 tests 全过；hash:state 必漂移（v0.9.1 起所有存档不兼容）。
 * =========================================================================== */

/**
 * v0.8: 距离衰减系数 —— 劳师远征的真正代价。
 * distance = 1（相邻）：×1.0；distance = 2：×0.85；distance = 3：×0.70；
 * distance ≥ 4：×0.55。让"距离"成为战斗的核心约束。
 */
function getDistanceMult(distance: number): number {
  if (distance <= 1) return 1.0;
  if (distance === 2) return 0.85;
  if (distance === 3) return 0.70;
  return 0.55;
}

/**
 * v0.8: 战线初始状态 —— 双方支持度与补给均充足，随战争消耗演变。
 *
 * mobilizationMonths = max(0, distance - 1)：相邻地区无动员期；
 * distance=2 → 1 月；distance=3 → 2 月；distance≥4 → 3 月。
 * 动员期内 progress 不推进，committedForce 从 0 增长到 maxCommitRatio。
 * 让"开战即决战"变成"下旨—集结—开打"。
 */
function createInitialFront(distance: number = 1): FrontState {
  return {
    attackerWarSupport: 70,
    defenderWarSupport: 70,
    attackerSupply: 100,
    defenderSupply: 100,
    mobilizationMonths: Math.max(0, distance - 1),
    attackerCommitted: 0,
  };
}

/**
 * Create an initial war state from the first engagement between two factions.
 * v0.8: 传入 attacker→region 的 BFS 距离，用于初始化动员期。
 */
export function createInitialWar(
  attacker: FactionState,
  defender: FactionState,
  region: RegionState
): WarState {
  const distance = region.distanceFromCapital?.[attacker.id] ?? 1;
  return {
    id: `${attacker.id}-${defender.id}-${region.id}`,
    attackerFactionId: attacker.id,
    defenderFactionId: defender.id,
    targetRegionId: region.id,
    progress: 35,
    monthsActive: 1,
    front: createInitialFront(distance),
  };
}

/**
 * S5b: advanceWar 的战线消耗结果。战争每月推进 progress（M5 重写后的
 * 持久战公式），同时产生持续的军队损耗、战地军费/军粮消耗、战疲累积。
 * v0.8 新增 nextCommittedForce：让 runWarPhase 应用到
 * attacker.warCommitments[war.targetRegionId]，避免 advanceWar 内部
 * 修改 faction 状态（保持纯函数语义）。
 */
export interface WarAdvanceResult {
  war: WarState;
  attackerLosses: number;
  defenderLosses: number;
  attackerSilverCost: number;
  defenderSilverCost: number;
  attackerGrainCost: number;
  defenderGrainCost: number;
  attackerExhaustionDelta: number;
  defenderExhaustionDelta: number;
  /** v0.8: 进攻方下一月投送到本战线的兵力（含动员期递增）。 */
  nextCommittedForce: number;
}

/**
 * v0.8: 进度公式 [PLACEHOLDER] —— 持久战 + 实力加成 - 防御底线 - 距离惩罚 - 驻军拖慢。
 *
 * 设计意图（旧 (strengthRatio-1)*6 → 1-2 月平推 → 修后 18-30 月持久战）：
 *   BASE_ADVANCE 1.5    持久战基线（即使弱方也要 1.5 点/月）
 *   POWER_COEFF 2.5     实力加成（强度比每超 1，加 2.5 点；旧 6.0 → v0.8 砍到 2.5）
 *   DEFENSE_FLOOR 0.6   防御底线减项（即使强攻也至少扣 0.6）
 *   DISTANCE_PEN 0.3    每跳距离减 0.3（劳师远征代价）
 *   GARRISON_DRAG 0.5   驻军拖慢（每 3 万驻军扣 0.5，上限 2.0）
 *   PROGRESS_MIN -1.5   攻方崩盘时后退
 *   PROGRESS_MAX 5.0    强攻上限（即使 ratio=10 也不会 1 月打完）
 *
 * 数值实例（大明 vs 察哈尔，distance=2）：
 *   committed = 580k × 0.30 × 0.85 = 148k
 *   defender = (74k × 0.64 × 0.74 + 43k × 0.5) × 1.30 = (35k + 21.5k) × 1.30 ≈ 73k
 *   ratio = 148 / 73 = 2.03
 *   Δ = 1.5 + (2.03-1)*2.5 - 0.6 - 0.3 - 0.72 ≈ 1.5 + 2.58 - 1.62 = 2.46 → ~26 月打完 ✓
 */
const BASE_ADVANCE = 1.5;
const POWER_COEFF = 2.5;
const DEFENSE_FLOOR = 0.6;
const DISTANCE_PEN = 0.3;
const GARRISON_DRAG = 0.5;
const GARRISON_DRAG_MAX = 2.0;
const PROGRESS_MIN = -1.5;
const PROGRESS_MAX = 5.0;

/**
 * Advance an ongoing war by one month.
 * - v0.8 M1: attackerStrength 用 committedForce（不超过 maxCommitRatio × armyTotal × distanceMult）
 * - v0.8 M2: attackerSupply 衰减按 distance（distance=1 → -1.5/月，distance≥3 → -4.5/月）
 * - v0.8 M3: defenderStrength 加 garrison × 0.5
 * - v0.8 M4: defenderStrength × homeTurfMult（仅当防守方 control 本地区时）
 * - v0.8 M5: 持久战进度公式（基线 1.5 + 实力加成 − 防御底线 − 距离 − 驻军）
 * - 动员期内 progressDelta = 0
 * - 补给 < 50 时 attackerLosses 翻倍（劳师远征补给崩溃）
 */
export function advanceWar(
  war: WarState,
  attacker: FactionState,
  defender: FactionState,
  region: RegionState,
  modifiers: Modifier[] = []
): WarAdvanceResult {
  const attackerOrgMult = 1 + queryModifier(modifiers, "faction", attacker.id, "army-org-mult");
  const defenderOrgMult = 1 + queryModifier(modifiers, "faction", defender.id, "army-org-mult");
  const front = war.front ?? createInitialFront();

  // M2: 距离与衰减系数
  const targetDistance = region.distanceFromCapital?.[attacker.id] ?? 1;
  const distanceMult = getDistanceMult(targetDistance);

  // M1: committedForce（持久化在 attacker.warCommitments） + 动员期
  const currentCommitted = attacker.warCommitments?.[war.targetRegionId] ?? 0;
  const maxCommit = attacker.armyTotal * attacker.maxCommitRatio * distanceMult;
  // v0.9.1: 第三个钳位 = 兵员上限池（长期养兵的成果）。三取小：
  // min(累计增长, 投送比例上限, 现役动员池)
  // 语义：即使你 armyTotal 580k、maxCommitRatio 0.30、distanceMult 1.0
  // 也只能投送 max(mobilizationPool) —— 大明开局 pool 11.6 万，钳位生效
  // 从首月就让 committedForce 不超 pool。
  const poolCap = Math.max(0, attacker.mobilizationPool);
  const inMobilization = front.mobilizationMonths > 0;
  const committedGrowth = inMobilization ? 0 : Math.max(1000, Math.round(attacker.armyTotal * 0.05));
  // 月度累加，三取小封顶。动员期 committedForce 仍记 0（防止首月即决战）
  const nextCommitted = inMobilization
    ? 0
    : Math.min(maxCommit, Math.min(poolCap, currentCommitted + committedGrowth));
  const activeForce = inMobilization ? 0 : nextCommitted;

  // M3 + M4: 防守方 = (正规军 × fortMult + garrison × 0.5) × homeTurfMult
  const defenderCore =
    defender.armyTotal *
    (defender.militaryOrganization / 100) *
    defenderOrgMult *
    (1 - defender.warExhaustion / 200) *
    ((region.fortification / 100) + 0.5);
  const defenderGarrison = region.garrison * 0.5;
  const defenderIsHome = region.controllerFactionId === defender.id;
  const homeMult = defenderIsHome ? defender.homeTurfMult : 1.0;
  const defenderStrength = (defenderCore + defenderGarrison) * homeMult;

  // M1: 攻方力量
  const attackerStrength =
    activeForce *
    (attacker.militaryOrganization / 100) *
    attackerOrgMult *
    (1 - attacker.warExhaustion / 200);

  const strengthRatio = attackerStrength / Math.max(1, defenderStrength);

  // M5: 持久战进度公式
  const powerAdv = Math.max(0, (strengthRatio - 1) * POWER_COEFF);
  const distancePen = Math.max(0, targetDistance - 1) * DISTANCE_PEN;
  const garrisonDrag = Math.min(GARRISON_DRAG_MAX, (region.garrison / 30000) * GARRISON_DRAG);
  let progressDelta = BASE_ADVANCE + powerAdv - DEFENSE_FLOOR - distancePen - garrisonDrag;
  progressDelta = Math.max(PROGRESS_MIN, Math.min(PROGRESS_MAX, progressDelta));
  // 动员期不推进 progress
  if (inMobilization) progressDelta = 0;

  const nextProgress = Math.max(0, Math.min(100, war.progress + progressDelta));

  // M2: 持续消耗（确定性）
  const supplyA = Math.max(0.3, front.attackerSupply / 100);
  const supplyD = Math.max(0.3, front.defenderSupply / 100);
  // 动员期攻击方不派兵，无损耗
  const committedAttacker = inMobilization ? 0 : activeForce;
  const committedDefender = Math.max(region.garrison, Math.round(defender.armyTotal * 0.15));
  const baseAttrition = 0.022;
  // M2 补给崩溃：< 50 时损耗翻倍（劳师远征代价）
  const supplyShortageMult = front.attackerSupply < 50 ? 2.0 : 1.0;
  const attackerLosses = Math.round((committedAttacker * baseAttrition * supplyShortageMult) / supplyA);
  const defenderLosses = Math.round((committedDefender * baseAttrition) / supplyD);
  // 战地军费/军粮：在常规维护（calculateFactionMaintenance）之上的额外消耗
  const warCostPerSoldier = 0.05;
  const warGrainPerSoldier = 0.05;
  const attackerSilverCost = Math.round(committedAttacker * warCostPerSoldier);
  const defenderSilverCost = Math.round(defender.armyTotal * warCostPerSoldier);
  const attackerGrainCost = Math.round(committedAttacker * warGrainPerSoldier);
  const defenderGrainCost = Math.round(defender.armyTotal * warGrainPerSoldier);

  // M2 补给按距离衰减
  const supplyDecay = 1.5 * targetDistance;
  // 动员期递减 mobilizationMonths
  const nextMobilization = Math.max(0, front.mobilizationMonths - 1);

  const nextFront: FrontState = {
    attackerWarSupport: front.attackerWarSupport,
    defenderWarSupport: front.defenderWarSupport,
    attackerSupply: Math.max(0, front.attackerSupply - supplyDecay),
    defenderSupply: front.defenderSupply,
    mobilizationMonths: nextMobilization,
    attackerCommitted: committedAttacker,
  };

  return {
    war: { ...war, monthsActive: war.monthsActive + 1, progress: nextProgress, front: nextFront },
    attackerLosses,
    defenderLosses,
    attackerSilverCost,
    defenderSilverCost,
    attackerGrainCost,
    defenderGrainCost,
    attackerExhaustionDelta: 1.5,
    defenderExhaustionDelta: 1.0,
    nextCommittedForce: nextCommitted,
  };
}

export interface BattleResult {
  region: RegionState;
  attacker: FactionState;
  defender: FactionState;
  /** v0.8: 首战 attacker 损耗（runWarPhase 在新遭遇战时一次性扣 armyTotal）。 */
  attackerLoss: number;
  /** v0.8: 首战 defender 损耗（runWarPhase 在新遭遇战时一次性扣 armyTotal）。 */
  defenderLoss: number;
  report: string;
  war: WarState | null;
}

const postureMultiplier: Record<MilitaryPosture, number> = {
  conservative: 0.72,
  balanced: 1,
  aggressive: 1.28
};

export function resolveBattle(
  region: RegionState,
  attacker: FactionState,
  defender: FactionState,
  posture: MilitaryPosture,
  random: RandomSource,
  modifiers: Modifier[] = []
): BattleResult {
  const attackerCommitted = Math.min(attacker.armyTotal, Math.round(attacker.armyTotal * 0.18 * postureMultiplier[posture]));
  const defenderCommitted = Math.min(defender.armyTotal, region.garrison);
  const terrainDefense = region.terrain === "mountain" ? 1.25 : region.terrain === "river" ? 1.12 : 1;
  // S1b: army-org-mult modifier (e.g. 军制改革/八旗组织) scales effective military organization.
  const attackerOrgMult = 1 + queryModifier(modifiers, "faction", attacker.id, "army-org-mult");
  const defenderOrgMult = 1 + queryModifier(modifiers, "faction", defender.id, "army-org-mult");
  const attackerPower =
    attackerCommitted * (attacker.militaryOrganization / 100) * attackerOrgMult * (1 - attacker.warExhaustion / 200) * (0.9 + random.next() * 0.25);
  const defenderPower =
    defenderCommitted * (defender.militaryOrganization / 100) * defenderOrgMult * terrainDefense * (region.fortification / 120 + 0.5) * (0.9 + random.next() * 0.25);
  const attackerWins = attackerPower > defenderPower;
  const attackerLoss = Math.round(attackerCommitted * (attackerWins ? 0.08 : 0.18));
  const defenderLoss = Math.round(defenderCommitted * (attackerWins ? 0.18 : 0.08));
  const nextControl = attackerWins ? Math.max(20, region.control - 18) : Math.max(25, region.control - 6);
  // v0.8.1: capture 触发条件从 nextControl <= 35 调严为 garrison < 5000，
  // 避免 resolveBattle 首战 attackerWins 直接 capture 周边势力。理由：
  // 历史上一座县城/卫所被攻占，前提是守军被击溃或投降，而非"控制度跌破
  // 阈值"这种行政概念。MAX(20, control-18) 的下界恒为 20，纯靠 control
  // 永远触发不了 ≤15 阈值——所以新规则本质是「首战必须把 garrison 打到
  // 5000 以下才允许 capture」。让 advanceWar 持久战有机会跑起来。
  // 历史对照：萨尔浒之战大明 11 万 vs 建州 6 万，首战覆灭但辽东未失，
  // 因为沈阳/辽阳 garrison 未被清空。
  const captured = attackerWins && region.garrison < 5000;

  // v0.8: resolveBattle 不再 mutate attacker/defender.armyTotal（保持纯函数
  // 语义）。原因：大明 AI 每月换 targetRegionId 时，resolveBattle 每次都是
  // "新遭遇战"，每月从 armyTotal 扣 18.7k，多线同时开战几月内让 armyTotal
  // 跌到 0。改为：
  //   - attackerLoss / defenderLoss 通过返回 BattleResult 暴露
  //   - runWarPhase 显式处理：已有 war（advanceWar 已扣）则不应用；
  //     新战（resolveBattle 创建）则扣首月 armyTotal 损耗。
  // region 的 garrison / control 变化仍由 resolveBattle 应用（capture 时
  // 直接易主，garrison 损耗是首战核心机制）。
  return {
    region: {
      ...region,
      controllerFactionId: captured ? attacker.id : region.controllerFactionId,
      control: captured ? 38 : nextControl,
      garrison: Math.max(1000, region.garrison - defenderLoss)
    },
    attacker,
    defender,
    attackerLoss,
    defenderLoss,
    report: captured
      ? `${attacker.name}攻占${region.name}，当地控制度骤降。`
      : `${attacker.name}进攻${region.name}，双方均有损失。`,
    war: captured
      ? null
      : createInitialWar(attacker, defender, region)
  };
}

/**
 * S5 遗留#2：同盟参战（简化双边累加，非多边战争模型）。
 *
 * 进攻方的盟友（有 alliance 条约）若与防守方相邻、非防守方盟友、无停战、且
 * 未已在交战，则同步对防守方开战。让"拉盟友"真实改变战局——同盟不再只是
 * "不互攻"的消极约束，而是会主动加入战争。确定性，不消费 random。
 */
export function alliesJoinWar(
  state: GameState,
  attackerId: string,
  defenderId: string,
): WarState[] {
  const defender = state.factions[defenderId];
  if (!defender) return [];
  const newWars: WarState[] = [];
  for (const allyId of Object.keys(state.factions)) {
    if (allyId === attackerId || allyId === defenderId) continue;
    const ally = state.factions[allyId];
    if (ally.status !== "active") continue;
    if (!isAlly(state, attackerId, allyId)) continue;
    if (isAlly(state, allyId, defenderId) || hasTruce(state, allyId, defenderId)) continue;
    if (state.wars.some((w) => w.attackerFactionId === allyId && w.defenderFactionId === defenderId)) continue;
    const targets = getValidMilitaryTargets(state, allyId);
    const target = targets.find((rid) => state.regions[rid]?.controllerFactionId === defenderId);
    if (!target) continue;
    newWars.push(createInitialWar(ally, defender, state.regions[target]));
  }
  return newWars;
}
