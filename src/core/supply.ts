/**
 * v0.9.2 — 粮秣生产 / 仓储 / 运输系统
 *
 * 来源：研究文档《MING-WAR 军事系统优化改造深度研究报告》§3.1（后勤）
 * SPEC：`docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md` §4.2
 *
 * 设计目标：让"打得起"和"补给到"成为真实约束。
 * - 每个 region 的 logisticsNode.depotStock 每月由经济产出注水
 *   （production × 0.4 = 折算为军用粮秣）。
 * - faction 每月为每条活跃 war 调度 SupplyConvoy：来源 region（controlling
 *   region with depot）→ 目标 region，ETA 按 distanceFromCapital 决定。
 * - runWarPhase 在 advanceWar 前调 `assertSupplyAdequate`：若 depotStock
 *   + 在途到达量 < siegeWeeks × 500，committedForce 临时降为 0.5x。
 *
 * 最小侵入：所有新字段是 logisticsNode.depotStock（已存在）、inTransitSupplies
 * （已存在）、depotLevel/portLevel（已存在）。本模块不修改任何已有战斗代码；
 * 仅在 runWarPhase 头部插入 1 行 `tickSupplyConvoys + applySupplyPressure`。
 */

import type { FactionId, GameState, RegionId, RegionState } from "./types";

/* ===========================================================================
 * 常量（[PLACEHOLDER] 调参准则见 SPEC §7.3 / tuning-military.xlsx）
 * =========================================================================== */
const DEPOT_PRODUCTION_SHARE = 0.4; // 经济产出 → 仓储转化率
const SIEGE_WEEKLY_GRAIN = 500;     // 千人周粮秣折算（围城补给基线）
const MAX_CONVOY_PAYLOAD = 30000;   // 单次运补上限（千人×月粮）
const CONVOY_DECAY_PER_HOP = 0.05;  // 沿路损耗率
const SUPPLY_SHORTAGE_PENALTY = 0.5; // supplyRatio < 0.5 → committedForce × 0.5

/* ===========================================================================
 * 类型
 * =========================================================================== */

export interface SupplyConvoy {
  id: string;
  factionId: FactionId;
  fromRegionId: RegionId;
  toRegionId: RegionId;
  payload: number;        // 剩余 payload（路途中会扣减）
  initialPayload: number;
  etaMonths: number;      // 剩余月数；归 0 时注入目标 depotStock
  startedAt: string;      // 调度时月份（YYYY-MM）
}

/* ===========================================================================
 * 生产：把 region 经济产出的 X% 注入 logisticsNode.depotStock
 * =========================================================================== */

/**
 * 把当月经济产出按 DEPOT_PRODUCTION_SHARE 注入仓储。
 * 在 runRegionPhase 末尾调用（econEntries 已推 ledger 之后）。
 *
 * 若 region 没有 logisticsNode（context tile、海面），不注水。
 */
export function depositMonthlySupply(
  region: RegionState,
  grainProduced: number
): RegionState {
  if (!region.logisticsNode) return region;
  const deposit = Math.round(grainProduced * DEPOT_PRODUCTION_SHARE);
  if (deposit <= 0) return region;
  return {
    ...region,
    logisticsNode: {
      ...region.logisticsNode,
      depotStock: region.logisticsNode.depotStock + deposit,
    },
  };
}

/* ===========================================================================
 * 调度：每月 AI/玩家派一队补给到目标 region
 * =========================================================================== */

/**
 * 派出一支补给车队。
 * @returns 新 state 与 createdConvoy；若 region 没有 logisticsNode 或 payload
 *          ≤ 0 则返回原 state 与 null。
 */
export function dispatchSupplyConvoy(
  state: GameState,
  factionId: FactionId,
  fromRegionId: RegionId,
  toRegionId: RegionId,
  payload: number,
  currentDate: string
): { state: GameState; convoy: SupplyConvoy | null } {
  if (payload <= 0) return { state, convoy: null };
  const fromRegion = state.regions[fromRegionId];
  const toRegion = state.regions[toRegionId];
  if (!fromRegion?.logisticsNode || !toRegion?.logisticsNode) return { state, convoy: null };
  // 距离 ETA：按 BFS 距离 + 0.5 路上损耗
  const distance = toRegion.distanceFromCapital?.[factionId] ?? 1;
  const etaMonths = Math.max(1, distance);
  // 实际可派 = min(来源 depot, 请求 payload, MAX_CONVOY_PAYLOAD)
  const effectivePayload = Math.min(
    fromRegion.logisticsNode.depotStock,
    payload,
    MAX_CONVOY_PAYLOAD
  );
  if (effectivePayload <= 0) return { state, convoy: null };
  const convoy: SupplyConvoy = {
    id: `convoy-${factionId}-${currentDate}-${toRegionId}-${Math.random().toString(36).slice(2, 6)}`,
    factionId,
    fromRegionId,
    toRegionId,
    payload: effectivePayload,
    initialPayload: effectivePayload,
    etaMonths,
    startedAt: currentDate,
  };
  // 立刻从来源扣（避免重复消费）
  const nextState: GameState = {
    ...state,
    regions: {
      ...state.regions,
      [fromRegionId]: {
        ...fromRegion,
        logisticsNode: {
          ...fromRegion.logisticsNode!,
          depotStock: fromRegion.logisticsNode!.depotStock - effectivePayload,
        },
      },
    },
  };
  return { state: nextState, convoy };
}

/* ===========================================================================
 * 推进：每月 ETA 递减，到期注入目的地；超期 / 不可达则损耗
 * =========================================================================== */

/**
 * 让所有活跃 SupplyConvoy 推进一月。到达的注入目的地 depotStock。
 * 沿路损耗 = initialPayload × CONVOY_DECAY_PER_HOP × 已走路程。
 *
 * state 顶层持有 `activeConvoys?: SupplyConvoy[]`（v0.9.2 新增，可选）。
 */
export function tickSupplyConvoys(state: GameState): GameState {
  const convoys = (state.activeConvoys ?? []) as SupplyConvoy[];
  if (convoys.length === 0) return state;
  const nextConvoys: SupplyConvoy[] = [];
  const regionUpdates: Record<RegionId, RegionState> = {};
  for (const c of convoys) {
    if (c.etaMonths <= 1) {
      // 到达：剩余 payload 注入目标（再扣一次沿路总损耗）
      const totalHops = c.initialPayload > 0
        ? Math.max(1, state.regions[c.toRegionId]?.distanceFromCapital?.[c.factionId] ?? 1)
        : 1;
      const delivered = Math.max(0, Math.round(c.payload * (1 - CONVOY_DECAY_PER_HOP * totalHops)));
      const target = regionUpdates[c.toRegionId] ?? state.regions[c.toRegionId];
      if (target?.logisticsNode && delivered > 0) {
        regionUpdates[c.toRegionId] = {
          ...target,
          logisticsNode: {
            ...target.logisticsNode,
            depotStock: target.logisticsNode.depotStock + delivered,
          },
        };
      }
      // 不入 nextConvoys（已结束）
    } else {
      // 在途：按 1 / etaMonths 折损
      const monthlyLoss = Math.round(c.payload * 0.02);
      nextConvoys.push({ ...c, etaMonths: c.etaMonths - 1, payload: Math.max(0, c.payload - monthlyLoss) });
    }
  }
  // 总是返回新 state（即使 convoys length 不变，eta 也会变）。
  // 短路守卫：eta/payload 完全未变且无 region 更新时复用 state。
  const convoysUnchanged = nextConvoys.length === convoys.length &&
    nextConvoys.every((nc, i) => nc.etaMonths === convoys[i].etaMonths && nc.payload === convoys[i].payload);
  if (convoysUnchanged && Object.keys(regionUpdates).length === 0) return state;
  const nextRegions: Record<RegionId, RegionState> = { ...state.regions };
  for (const [rid, r] of Object.entries(regionUpdates)) nextRegions[rid] = r;
  return { ...state, regions: nextRegions, activeConvoys: nextConvoys };
}

/* ===========================================================================
 * 战斗侧压力：supplyRatio < 0.5 时 committedForce × 0.5
 * =========================================================================== */

/**
 * 计算某条战线的 supplyRatio ∈ [0, 1.2]。
 * supply = 目的地 depotStock + 即将到达的 in-flight convoys
 * demand = 持久战长度（sieveWeeks）× SIEGE_WEEKLY_GRAIN
 *
 * 钳位到 [0, 1.2]，与 SPEC §4.2 一致。
 */
export function computeSupplyRatio(
  state: GameState,
  factionId: FactionId,
  targetRegionId: RegionId,
  siegeWeeks: number
): number {
  const target = state.regions[targetRegionId];
  if (!target?.logisticsNode) return 1.0; // 非物流节点不限制
  const stock = target.logisticsNode.depotStock;
  // 即将到达的同 faction 同 target convoys
  const inFlight = (state.activeConvoys ?? [])
    .filter((c) => c.factionId === factionId && c.toRegionId === targetRegionId)
    .reduce((sum, c) => sum + c.payload, 0);
  const supply = stock + inFlight;
  const demand = Math.max(1, siegeWeeks * SIEGE_WEEKLY_GRAIN);
  return Math.max(0, Math.min(1.2, supply / demand));
}

/**
 * 把 supplyRatio 应用于 committedForce：
 *   supplyRatio < 0.5 → × 0.5（严重缺粮）
 *   supplyRatio < 0.75 → × 0.7（饥饿）
 *   supplyRatio ≥ 0.75 → × 1.0
 */
export function applySupplyPressureMultiplier(supplyRatio: number): number {
  if (supplyRatio < 0.5) return SUPPLY_SHORTAGE_PENALTY;
  if (supplyRatio < 0.75) return 0.7;
  return 1.0;
}
