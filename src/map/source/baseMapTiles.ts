import type { MapTileShape } from "../mapTypes";
import { mapRegionSource } from "./mapRegionSource";
import { mapTileMetadata } from "./mapTileMetadata";

/**
 * 把几何数据（mapRegionSource）与层级元数据（mapTileMetadata）合并为统一图块模型。
 * 每个 playable 图块必须同时存在于两者；缺失元数据会在此报错（早于生成产物）。
 */
function buildPlayableTiles(): MapTileShape[] {
  return mapRegionSource.map((shape) => {
    const meta = mapTileMetadata[shape.id];
    if (!meta) {
      throw new Error(`mapTileMetadata missing entry for playable region "${shape.id}"`);
    }
    return {
      ...shape,
      displayName: meta.displayName,
      kind: meta.kind,
      isPlayableRegion: meta.isPlayableRegion,
      defaultControllerFactionId: meta.defaultControllerFactionId,
      importance: meta.importance
    };
  });
}

/**
 * context 图块（远景区域，不参与模拟）。
 * Phase 1 为空数组；Phase 3 扩展东亚周边时填充。
 */
export const contextMapTileSource: MapTileShape[] = [];

/** 全量底层图块 = playable + context */
export const baseMapTiles: MapTileShape[] = [...buildPlayableTiles(), ...contextMapTileSource];
