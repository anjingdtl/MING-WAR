/**
 * Lens 色板 — 根据区域数据返回该 Lens 下的填充色。
 *
 * 借鉴 V3 的"每个 Lens 独立色板"。控制 Lens 用势力原色(透明叠加),
 * 其他 Lens 用渐变色映射关键字段。
 */

import type { GameState, RegionState } from "../../core/types";
import type { MapTileShape } from "../../map/mapTypes";
import { resolveMapFactionColor } from "../../map/mapFactionColors";
import type { LensId } from "./lensDefinitions";

/** context 图块的固定覆盖透明度：需要压住底层地理色，与 playable 视觉接近以避免"两层地图"错觉。 */
export const CONTEXT_TILE_OPACITY = 0.84;

/* 通用工具:把一个数值映射到 [0, 1] */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/* 线性插值 hex 颜色 */
function mix(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/* --- Lens 色板 -------------------------------------------------- */

/** 经济:税收高=御黄亮,低=黛色暗 */
function economyColor(region: RegionState): string {
  const t = clamp01(region.taxCapacity / 200);
  return mix("#3F3A33", "#D9A441", t);
}

/** 军事:驻军多=帝王朱亮,少=米色 */
function militaryColor(region: RegionState): string {
  const t = clamp01(region.garrison / 50000);
  return mix("#E8DDC4", "#B23A2C", t);
}

/** 民生:综合人口+粮储,过载/饥荒=警示 */
function peopleColor(region: RegionState): string {
  const popScore = clamp01(region.population / region.populationCapacity);
  const grainScore = clamp01(region.grainStock / 50000);
  const combined = popScore * 0.4 + grainScore * 0.6;
  // 0..0.4 暗→中,0.4..1 中→绿
  if (combined < 0.4) return mix("#B23A2C", "#E8DDC4", combined / 0.4);
  return mix("#E8DDC4", "#4A7C59", (combined - 0.4) / 0.6);
}

/** 朝堂:玩家控制=缥色,其他=茄皮紫 */
function courtColor(region: RegionState, state: GameState): string {
  const faction = state.factions[region.controllerFactionId];
  if (faction?.id === state.playerFactionId) return "#4A7B9D";
  return "#6E4F6B";
}

/* --- 公共 API --------------------------------------------------- */

export function getRegionColor(
  region: RegionState,
  state: GameState,
  lens: LensId
): string {
  const faction = state.factions[region.controllerFactionId];
  switch (lens) {
    case "control":
      return faction?.primaryColor ?? "#888";
    case "economy":
      return economyColor(region);
    case "military":
      return militaryColor(region);
    case "people":
      return peopleColor(region);
    case "court":
      return courtColor(region, state);
  }
}

/** 区域填充透明度(根据该 Lens 的数据"显著度") */
export function getRegionOpacity(region: RegionState, lens: LensId): number {
  if (lens === "control") {
    return Math.max(0.72, region.control / 100);
  }
  // 其他 Lens 给一个固定透明度,避免色板被 0.7 稀释
  return 0.72;
}

/* --- 三层地图：统一图块着色（playable + context） ---------------- */

export interface TileFill {
  color: string;
  opacity: number;
}

/**
 * 统一图块着色：playable 图块走 Lens 色板逻辑，context 图块用静态势力色 + 低透明度。
 * 这是 PoliticalOverlayLayer 的唯一着色入口，避免 context 图块查询不存在的 RegionState。
 */
export function getTileFillColor(
  tile: MapTileShape,
  state: GameState,
  lens: LensId
): TileFill {
  if (tile.isPlayableRegion) {
    const region = state.regions[tile.id];
    if (region) {
      return { color: getRegionColor(region, state, lens), opacity: getRegionOpacity(region, lens) };
    }
  }
  return {
    color: resolveMapFactionColor(tile.defaultControllerFactionId, state.factions),
    opacity: CONTEXT_TILE_OPACITY
  };
}
