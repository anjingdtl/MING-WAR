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
 * 用简化多边形近似地理轮廓（spec 允许远景区域使用粗略 path）。
 * 坐标贴在 1000×700 画布边缘，避开 playable 核心区域。
 */
export const contextMapTileSource: MapTileShape[] = [
  {
    id: "tibet",
    displayName: "乌斯藏",
    paths: ["M180 340 L370 335 L388 415 L340 488 L228 480 L180 420 Z"],
    labelX: 285,
    labelY: 405,
    labelWidth: 80,
    source: "generated-source",
    kind: "context-region",
    isPlayableRegion: false,
    defaultControllerFactionId: "tibet",
    importance: 3
  },
  {
    id: "hami",
    displayName: "哈密",
    paths: ["M200 195 L372 190 L382 275 L335 322 L224 312 L200 255 Z"],
    labelX: 296,
    labelY: 250,
    labelWidth: 72,
    source: "generated-source",
    kind: "context-region",
    isPlayableRegion: false,
    defaultControllerFactionId: "mobei",
    importance: 3
  },
  {
    id: "mobei",
    displayName: "漠北诸部",
    paths: ["M385 62 L678 58 L692 150 L595 186 L454 180 L385 138 Z"],
    labelX: 528,
    labelY: 118,
    labelWidth: 84,
    source: "generated-source",
    kind: "context-region",
    isPlayableRegion: false,
    defaultControllerFactionId: "mobei",
    importance: 3
  },
  {
    id: "southeast-asia",
    displayName: "东南亚边缘",
    paths: ["M445 562 L738 556 L748 626 L624 662 L498 646 L445 606 Z"],
    labelX: 588,
    labelY: 608,
    labelWidth: 96,
    source: "generated-source",
    kind: "context-region",
    isPlayableRegion: false,
    defaultControllerFactionId: "southeast-asia",
    importance: 3
  },
  {
    id: "liuqiu",
    displayName: "琉球",
    paths: ["M774 434 L888 430 L902 492 L854 526 L788 506 Z"],
    labelX: 836,
    labelY: 476,
    labelWidth: 64,
    source: "generated-source",
    kind: "sea-zone",
    isPlayableRegion: false,
    defaultControllerFactionId: "liuqiu",
    importance: 3
  },
  {
    id: "western-pacific",
    displayName: "西太平洋",
    paths: ["M894 264 L998 258 L998 542 L906 530 L892 398 Z"],
    labelX: 946,
    labelY: 396,
    labelWidth: 84,
    source: "generated-source",
    kind: "sea-zone",
    isPlayableRegion: false,
    defaultControllerFactionId: "western-sea",
    importance: 3
  },
  {
    id: "northern-sea",
    displayName: "北海",
    paths: ["M692 52 L998 48 L998 144 L854 166 L716 144 Z"],
    labelX: 852,
    labelY: 104,
    labelWidth: 64,
    source: "generated-source",
    kind: "sea-zone",
    isPlayableRegion: false,
    defaultControllerFactionId: "western-sea",
    importance: 3
  }
];

/** 全量底层图块 = playable + context */
export const baseMapTiles: MapTileShape[] = [...buildPlayableTiles(), ...contextMapTileSource];
