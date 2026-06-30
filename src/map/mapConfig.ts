export type {
  FactionMapLabel,
  MapRegionGroup,
  MapRegionShape,
  MapRegionSource,
  MapTileKind,
  MapTileShape,
  PoliticalOverlayShape
} from "./mapTypes";
export { mapFactionFallbackColors, NEUTRAL_CONTEXT_COLOR, resolveMapFactionColor } from "./mapFactionColors";

import type { MapTileShape } from "./mapTypes";
import { mapTiles } from "./generated/mapTiles";
import { factionMapLabels } from "./generated/factionMapLabels";

export { mapTiles, factionMapLabels };

/** 可交互的 playable 图块（与 GameState.regions 1:1 对应） */
export const playableMapRegions: MapTileShape[] = mapTiles.filter((tile) => tile.isPlayableRegion);

/** 远景 context 图块（不参与模拟，仅视觉表达） */
export const contextMapTiles: MapTileShape[] = mapTiles.filter((tile) => !tile.isPlayableRegion);

/**
 * 向后兼容别名：现有 GameMap.tsx 仍 import { mapRegions }。
 * 等同于 playableMapRegions，仅含 playable 图块，视觉零变化。
 */
export const mapRegions = playableMapRegions;
