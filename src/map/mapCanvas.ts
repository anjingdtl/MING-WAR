export const mapCanvas = {
  width: 1000,
  height: 700,
  viewBox: "0 0 1000 700",
  minZoom: 0.5,
  maxZoom: 4,
  zoomStep: 1.12,
  dragThresholdPx: 5
} as const;

export const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 } as const;

/** zoom 阈值：低缩放显示势力大字，中高缩放显示省区名 */
export const LABEL_ZOOM_THRESHOLDS = {
  factionLabelMaxZoom: 0.85,
  provinceDetailMinZoom: 0.85,
  minorLabelMinZoom: 1.8
} as const;
