/**
 * ⚠️  DETERMINISM-CHANGE (T8 — 2026-07-02)
 * ---------------------------------------------------------------------------
 * 新增 computeWarDesire 公式 + 8 个 sub-score 函数，让 AI 决策从"兵力对比"
 * 升级为"可持续作战可行性"。AI 自动宣战需 warDesire > 15。
 *
 * 同时新增 P5 随机消费点：runFactionPhase 末尾对每条 AI 决策加 ±3 随机扰动
 * （让 warDesire ∈ [-5, +5] 时不完全决定论）。所有 seed 命运重新分配；
 * hash:state 与 v0.9.6 不再一致。
 *
 * 来源：研究文档《MING-WAR 军事系统优化改造深度研究报告》§4 末"AI 行为
 * 必须同步升级"；SPEC §4.5 + §6 P5。
 * ===========================================================================
 */

import type { FactionId, FactionState, GameState, PlayerDecision, RegionId, RegionState } from "./types";
import { hasTruce, isAlly } from "./diplomacy";

export function getFactionRegionIds(state: GameState, factionId: string): RegionId[] {
  return Object.values(state.regions)
    .filter((region) => region.controllerFactionId === factionId)
    .map((region) => region.id);
}

export function getValidMilitaryTargets(state: GameState, factionId: string): RegionId[] {
  const controlled = new Set(getFactionRegionIds(state, factionId));
  const targets = new Set<RegionId>();
  for (const regionId of controlled) {
    const region = state.regions[regionId];
    for (const connectionId of region.connections) {
      const connection = state.regions[connectionId];
      if (connection.controllerFactionId !== factionId) {
        const ownerFaction = connection.controllerFactionId;
        // S5d: 外交约束开战 —— 停战期或盟友控制的地区不可攻击（玩家与 AI
        // 同规则，复用 getValidMilitaryTargets 通道）。停战制造备战窗口、
        // 同盟阻止互攻，让外交环真正约束战争。
        if (
          !hasTruce(state, factionId, ownerFaction) &&
          !isAlly(state, factionId, ownerFaction)
        ) {
          targets.add(connectionId);
        }
      }
    }
  }
  return [...targets];
}

export function normalizePlayerDecision(state: GameState, decision: PlayerDecision): PlayerDecision {
  const validTargets = getValidMilitaryTargets(state, state.playerFactionId);
  const targetRegionId =
    decision.targetRegionId && validTargets.includes(decision.targetRegionId)
      ? decision.targetRegionId
      : validTargets[0] ?? null;
  return {
    targetRegionId,
    posture: decision.posture,
    domesticFocus: decision.domesticFocus
  };
}

/* ===========================================================================
 * T8 WarDesire 公式：7 风险项 + 个性修正
 * =========================================================================== */

const WINTER_MONTHS: ReadonlySet<number> = new Set([11, 12, 1, 2]);

/** T8: 战略目标价值（直接取 region.military.strategicValue，0-100）。 */
export function computeWarGoalValue(target: RegionState): number {
  return target.military?.strategicValue ?? 0;
}

/** T8: 边境安全值（距离越近越紧迫）。distance=1 → 20；distance=2 → 6.7；... 远端 → 趋近 0。 */
export function computeBorderSecurityValue(distance: number): number {
  if (distance >= 999) return 0;
  return 20 / (1 + distance);
}

/** T8: 同盟支持加值（盟友 aggression 加权）。[0, +20]。 */
export function computeAllySupport(state: GameState, factionId: FactionId): number {
  let sum = 0;
  for (const allyId of Object.keys(state.factions)) {
    if (allyId === factionId) continue;
    const ally = state.factions[allyId];
    if (ally.status !== "active") continue;
    if (!isAlly(state, factionId, allyId)) continue;
    sum += ally.aiProfile?.aggression ?? 50;
  }
  // 归一化到 [0, 20]：1 个 aggr=100 盟友 → 10；2 个 aggr=100 盟友 → 20
  return Math.min(20, sum * 0.1);
}

/** T8: 补给压力（supplyRatio < 0.5 时严扣）。[0, -40]。 */
export function computeSupplyOverstretch(supplyRatio: number): number {
  return Math.max(0, (0.5 - supplyRatio) * 80);
}

/** T8: 冬季惩罚。月份 ∈ {11, 12, 1, 2} → -30；其余 0。 */
export function computeWinterPenalty(month: number): number {
  return WINTER_MONTHS.has(month) ? 30 : 0;
}

/** T8: 战疲风险。fatigue > 70 时开始扣；> 100 → -15；> 130 → -30。 */
export function computeExhaustionRisk(faction: FactionState): number {
  const fatigue = (faction as FactionState & { warFatigue?: number }).warFatigue ?? 0;
  if (fatigue < 70) return 0;
  if (fatigue < 100) return (fatigue - 70) * 0.5; // 70→100 区间 0→-15
  if (fatigue < 130) return 15 + (fatigue - 100) * 0.5; // 100→130 区间 -15→-30
  return 30;
}

/** T8: 财政风险。treasury < 6×月支出 → -40；< 12×月支出 → -20。 */
export function computeTreasuryRisk(faction: FactionState, monthlyCost: number): number {
  if (monthlyCost <= 0) return 0;
  const ratio = faction.treasury / monthlyCost;
  if (ratio < 6) return 40;
  if (ratio < 12) return 20;
  return 0;
}

/** T8: 占领治理成本。occupationResistance > 50 时开始扣。[0, -25]。 */
export function computeOccupationRisk(target: RegionState): number {
  const resistance = target.military?.occupationResistance ?? 0;
  if (resistance <= 50) return 0;
  return Math.min(25, (resistance - 50) * 0.5);
}

/**
 * T8: AI 决策的"战争欲望"分数。正值 = 想打；负值 = 避免开新战。
 *
 * 设计：让 AI 决策从"兵力对比"升级为"可持续作战可行性"。
 *  - WarGoal + Border + Ally = "想打"的理由
 *  - Supply / Winter / Exhaustion / Treasury / Occupation = "别打"的理由
 *  - 个性化 ±10 修正在 faction.warDesireModifier（玩家/历史可调）
 *
 * AI 自动宣战需 warDesire > 15；玩家手选仍是手动覆盖（不变）。
 */
export function computeWarDesire(
  faction: FactionState,
  target: RegionState,
  state: GameState,
  options: { supplyRatio?: number; month?: number; monthlyCost?: number } = {}
): number {
  const distance = target.distanceFromCapital?.[faction.id] ?? 999;
  const supplyRatio = options.supplyRatio ?? 1.0;
  const month = options.month ?? 12; // 默认严冬，逼迫 AI 冬季不战
  // 月支出保守估算：armyTotal × 0.27（与 economy.ts costPerSoldier 对齐）
  const monthlyCost = options.monthlyCost ?? faction.armyTotal * 0.27;

  const warDesire =
    + computeWarGoalValue(target)
    + computeBorderSecurityValue(distance)
    + computeAllySupport(state, faction.id)
    - computeSupplyOverstretch(supplyRatio)
    - computeWinterPenalty(month)
    - computeExhaustionRisk(faction)
    - computeTreasuryRisk(faction, monthlyCost)
    - computeOccupationRisk(target)
    + (faction.warDesireModifier ?? 0);

  return warDesire;
}

/**
 * T8: 在所有有效军事目标中选出 warDesire 最大的 regionId。
 * 仅返回 warDesire > 0 的目标（避免负值目标被 AI 错选）。
 * 全部为负返回 null（AI 本月不主动宣战）。
 */
export function pickMaxWarDesire(
  faction: FactionState,
  state: GameState,
  options: { month?: number; supplyRatio?: number } = {}
): RegionId | null {
  const targets = getValidMilitaryTargets(state, faction.id);
  if (targets.length === 0) return null;
  let bestId: RegionId | null = null;
  let bestScore = -Infinity;
  for (const tid of targets) {
    const target = state.regions[tid];
    if (!target) continue;
    const score = computeWarDesire(faction, target, state, options);
    if (score > bestScore) {
      bestScore = score;
      bestId = tid;
    }
  }
  return bestScore > 0 ? bestId : null;
}

/**
 * v0.8: 为每个 region 预计算到各 faction 首都的 BFS 最短距离。
 * 写入 region.distanceFromCapital[factionId] = 跳数。
 *
 * 调用时机：
 *   1. createMvpScenario() 末尾（开局时）
 *   2. simulateMonth() 入口（防御性：任何地区拓扑变更后保持距离表最新）
 *
 * 设计意图：让"劳师远征"可感。距离 = 1（相邻）：×1.0 投送；距离 = 2：×0.85；
 * 距离 = 3：×0.70；距离 ≥ 4：×0.55。补给按 1.5 × distance 衰减。周边小势力
 * 不再被大明 1-2 月推平；大明要真调兵 3-5 月才能集结完毕。
 *
 * 注意：不消耗 random，纯拓扑计算。runWarPhase 不调用（已经在
 * simulateMonth 入口预计算，避免每条 war 重复 BFS）。
 */
export function computeDistanceMap(state: GameState): void {
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active" || !faction.capitalRegionId) continue;
    const capitalId = faction.capitalRegionId;
    const capital = state.regions[capitalId];
    if (!capital) continue;
    // BFS from capital
    const distances: Record<string, number> = { [capitalId]: 0 };
    const queue: string[] = [capitalId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = distances[current];
      const currentRegion = state.regions[current];
      if (!currentRegion) continue;
      for (const neighborId of currentRegion.connections) {
        if (!(neighborId in distances)) {
          distances[neighborId] = currentDist + 1;
          queue.push(neighborId);
        }
      }
    }
    // 写入每个 region 的 distanceFromCapital（未到达的设 Infinity → getDistanceMult 走 ≥ 4 分支）
    for (const region of Object.values(state.regions)) {
      if (!region.distanceFromCapital) region.distanceFromCapital = {};
      region.distanceFromCapital[faction.id] = distances[region.id] ?? 999;
    }
  }
}
