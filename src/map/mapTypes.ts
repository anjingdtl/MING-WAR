import type { RegionId } from "../core/types";

export type MapRegionSource =
  | "natural-earth-admin1"
  | "historical-frontier-manual"
  | "tusi-enclave"
  | "generated-source";

export type MapRegionGroup = "ming" | "korea" | "japan" | "jurchen" | "mongolia" | "southwest";

/**
 * 底层图块类型，决定渲染层级与交互语义：
 * - core-province: 明朝两京十三省核心省区
 * - frontier-province: 辽东、播州、哈密等边疆/土司/羁縻区域
 * - neighbor-region: 周边势力区域（建州、海西、察哈尔、朝鲜、日本等）
 * - context-region: 远景背景区域（漠北、西藏深处、东南亚边缘等），不参与模拟
 * - sea-zone: 海上远景/航线区
 */
export type MapTileKind =
  | "core-province"
  | "frontier-province"
  | "neighbor-region"
  | "context-region"
  | "sea-zone";

export interface MapRegionShape {
  id: RegionId;
  paths: string[];
  labelX: number;
  labelY: number;
  labelWidth?: number;
  source: MapRegionSource;
  group?: MapRegionGroup;
  isEnclave?: boolean;
}

/**
 * 统一图块模型：在 MapRegionShape 基础上增加层级语义字段。
 * isPlayableRegion=true 的图块必须能在 GameState.regions 找到对应 RegionState；
 * isPlayableRegion=false 的 context 图块只用于视觉表达，不进入模拟。
 */
export interface MapTileShape extends MapRegionShape {
  /** 中文显示名（独立于 RegionState.name，供 context 图块使用） */
  displayName: string;
  kind: MapTileKind;
  isPlayableRegion: boolean;
  /** context 图块的静态控制势力；playable 图块运行时从 state.regions 取 controllerFactionId */
  defaultControllerFactionId?: string;
  /** 标签/可见性重要度：1=核心，2=次要，3=远景 */
  importance: 1 | 2 | 3;
}

/** 政治势力覆盖形状：贴合省区图块，按控制者着色 */
export interface PoliticalOverlayShape {
  tileId: string;
  regionId?: string;
  factionId: string;
  paths: string[];
  opacity: number;
}

/** 势力大字地图标签（低缩放显示势力名） */
export interface FactionMapLabel {
  factionId: string;
  label: string;
  x: number;
  y: number;
  minZoom: number;
  maxZoom: number;
  importance: 1 | 2 | 3;
}
