/**
 * ⚠️  DETERMINISM-CHANGE (T10 — 2026-07-02)
 * ---------------------------------------------------------------------------
 * 地形/基建/季节行军边权 + Dijkstra 路径预计算。
 *
 * 边权公式：edgeDays = max(1, ceil(BASE_DAYS × terrainFactor × seasonFactor × infraFactor))
 *   - terrainFactor: plain=1.0, coast=0.9, river=0.8, steppe=1.3, mountain=2.0
 *   - seasonFactor: SEASONAL_TRAVEL_MOD 来自 season.ts（winter=1.8, mud=1.5, ...）
 *   - infraFactor: 0→1.4, 1→1.0, 2→0.8, 3→0.6
 *
 * 路径表缓存：(factionId, seasonMonth) → Map<targetRegionId, edgeDays>。
 * 缓存失效：控制权变更 / 基建变化 / 季节切换。
 *
 * 来源：研究文档 §3 边权公式 + §3 行军时间；SPEC §4.2 movementPhase。
 * ===========================================================================
 */

import type { FactionId, GameState, RegionId, RegionState, TerrainType } from "./types";
import { SEASONAL_TRAVEL_MOD, type SeasonalState } from "./season";

/** 地形因子：越大越难走。 */
export const TERRAIN_FACTOR: Record<TerrainType, number> = {
  plain: 1.0,
  coast: 0.9,
  river: 0.8,
  steppe: 1.3,
  mountain: 2.0,
};

/** 基建因子：越大越好走（道路/桥梁/转运）。0..3 → 1.4..0.6。 */
export const INFRA_FACTOR: Record<0 | 1 | 2 | 3, number> = {
  0: 1.4,
  1: 1.0,
  2: 0.8,
  3: 0.6,
};

const BASE_DAYS = 1; // 每跳基础日数

/**
 * 计算两个相邻 region 之间的行军日数（edge days）。
 * 取终点 region 的地形 / 基建 / 季节。
 */
export function computeEdgeDays(
  fromRegion: RegionState,
  toRegion: RegionState,
  seasonalState: SeasonalState
): number {
  const terrain = TERRAIN_FACTOR[toRegion.terrain] ?? 1.0;
  const season = SEASONAL_TRAVEL_MOD[seasonalState] ?? 1.0;
  const infraLevel = (toRegion.military?.infrastructureLevel ?? 0) as 0 | 1 | 2 | 3;
  const infra = INFRA_FACTOR[infraLevel] ?? 1.0;
  return Math.max(1, Math.ceil(BASE_DAYS * terrain * season * infra));
}

/**
 * 缓存路径表：(factionId, seasonMonth) → Map<targetRegionId, edgeDays>。
 * 单 faction 视角：从其首都出发到所有 region 的最短路径日数。
 */
type PathTable = Map<RegionId, number>;

interface CacheKey {
  factionId: FactionId;
  /** YYYY-MM 形式（季节粗粒度到月） */
  seasonMonth: string;
}

const pathCache: Map<string, { key: CacheKey; table: PathTable }> = new Map();

/** 缓存键。 */
function makeKey(factionId: FactionId, seasonMonth: string): string {
  return `${factionId}@${seasonMonth}`;
}

/**
 * 检查缓存是否有效（控制权 / 基建 / 季节变化时失效）。
 * 简化：只比较 seasonMonth（粗粒度月份）；月内不会重算。
 */
function isCacheValid(cached: { key: CacheKey; table: PathTable } | undefined, key: CacheKey): boolean {
  if (!cached) return false;
  return cached.key.factionId === key.factionId && cached.key.seasonMonth === key.seasonMonth;
}

/**
 * 用 Dijkstra 算单源最短路径。节点数 31，边权 ≥ 1 整数，开销 < 1ms。
 * 仅遍历 controlled + connections 区域。
 */
function dijkstra(
  state: GameState,
  startId: RegionId,
  seasonalStateFor: (regionId: RegionId) => SeasonalState
): PathTable {
  const dist: PathTable = new Map();
  dist.set(startId, 0);
  // 简单优先队列（O(V²) 但 V=31 够用；不用实现二叉堆）
  const visited = new Set<RegionId>();
  while (visited.size < Object.keys(state.regions).length) {
    let current: RegionId | null = null;
    let currentDist = Infinity;
    for (const [rid, d] of dist.entries()) {
      if (visited.has(rid)) continue;
      if (d < currentDist) {
        currentDist = d;
        current = rid;
      }
    }
    if (current === null) break;
    visited.add(current);
    const region = state.regions[current];
    if (!region) continue;
    for (const neighborId of region.connections) {
      if (visited.has(neighborId)) continue;
      const neighbor = state.regions[neighborId];
      if (!neighbor) continue;
      const edgeDays = computeEdgeDays(region, neighbor, seasonalStateFor(neighborId));
      const newDist = currentDist + edgeDays;
      if (newDist < (dist.get(neighborId) ?? Infinity)) {
        dist.set(neighborId, newDist);
      }
    }
  }
  return dist;
}

/**
 * 预计算某 faction 在指定月份的路径表。命中缓存直接返回。
 * 注意：缓存 key = (factionId, seasonMonth) 粗粒度。控制权 / 基建变化
 * 需调用 invalidateMovementCache 清空。
 */
export function precomputeAllPaths(
  state: GameState,
  factionId: FactionId,
  seasonMonth: string
): PathTable {
  const key: CacheKey = { factionId, seasonMonth };
  const cacheKey = makeKey(factionId, seasonMonth);
  const cached = pathCache.get(cacheKey);
  if (isCacheValid(cached, key)) {
    return cached!.table;
  }
  const faction = state.factions[factionId];
  if (!faction?.capitalRegionId) return new Map();
  const seasonalStateFor = (regionId: RegionId): SeasonalState => {
    return state.regions[regionId]?.military?.seasonalState ?? "normal";
  };
  const table = dijkstra(state, faction.capitalRegionId, seasonalStateFor);
  pathCache.set(cacheKey, { key, table });
  return table;
}

/** 清空路径缓存（控制权 / 基建 / 季节切换时调用）。 */
export function invalidateMovementCache(): void {
  pathCache.clear();
}

/**
 * 取某 faction 到 targetRegion 的路径日数（行军 ETA）。未计算时返回
 * distanceFromCapital 旧值（兼容性 fallback，避免下游崩）。
 */
export function getMovementDays(
  state: GameState,
  factionId: FactionId,
  targetRegionId: RegionId,
  seasonMonth?: string
): number {
  const month = seasonMonth ?? state.currentDate;
  const table = precomputeAllPaths(state, factionId, month);
  if (table.has(targetRegionId)) {
    return table.get(targetRegionId)!;
  }
  // Fallback：旧 distanceFromCapital（跳数 × 1）
  const dist = state.regions[targetRegionId]?.distanceFromCapital?.[factionId];
  if (typeof dist === "number" && dist < 999) {
    return dist;
  }
  return 1;
}
