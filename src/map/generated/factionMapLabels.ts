import type { FactionMapLabel } from "../mapTypes";

/**
 * 势力大字标签 — 低缩放时显示势力名（类似维多利亚3的战略阅读）。
 * 坐标对应该势力核心区域的大致中心。
 * minZoom/maxZoom 控制可见缩放区间；importance 决定优先级。
 */
export const factionMapLabels: FactionMapLabel[] = [
  { factionId: "ming", label: "大明", x: 560, y: 340, minZoom: 0, maxZoom: 0.9, importance: 1 },
  { factionId: "jianzhou", label: "建州女真", x: 763, y: 180, minZoom: 0, maxZoom: 0.9, importance: 2 },
  { factionId: "haixi", label: "海西女真", x: 783, y: 125, minZoom: 0, maxZoom: 0.85, importance: 2 },
  { factionId: "chahar", label: "察哈尔", x: 610, y: 176, minZoom: 0, maxZoom: 0.9, importance: 2 },
  { factionId: "tumed", label: "土默特", x: 535, y: 203, minZoom: 0, maxZoom: 0.9, importance: 2 },
  { factionId: "korchin", label: "科尔沁", x: 704, y: 185, minZoom: 0, maxZoom: 0.85, importance: 2 },
  { factionId: "nurgan", label: "奴儿干", x: 865, y: 148, minZoom: 0, maxZoom: 0.85, importance: 2 },
  { factionId: "joseon", label: "朝鲜", x: 824, y: 357, minZoom: 0, maxZoom: 0.9, importance: 2 },
  { factionId: "japan", label: "日本诸藩", x: 786, y: 448, minZoom: 0, maxZoom: 0.9, importance: 2 },
  { factionId: "ainu", label: "虾夷", x: 862, y: 341, minZoom: 0, maxZoom: 0.8, importance: 3 },
  { factionId: "bozhou", label: "播州", x: 486, y: 426, minZoom: 0, maxZoom: 0.8, importance: 3 },
  { factionId: "tibet", label: "乌斯藏", x: 285, y: 405, minZoom: 0, maxZoom: 0.85, importance: 3 },
  { factionId: "mobei", label: "漠北诸部", x: 528, y: 118, minZoom: 0, maxZoom: 0.85, importance: 3 },
  { factionId: "southeast-asia", label: "东南亚", x: 588, y: 608, minZoom: 0, maxZoom: 0.8, importance: 3 },
  { factionId: "liuqiu", label: "琉球", x: 836, y: 476, minZoom: 0, maxZoom: 0.8, importance: 3 }
];
