import type { FactionState } from "../core/types";

/**
 * 地图层势力色板。
 * - 真实势力兜底色与 factions.ts 的 primaryColor 保持一致，供 context 图块或测试场景使用。
 * - 背景势力（tibet/mobei 等）只存在于地图层，不进入 GameState.factions，故需要此兜底。
 * - 低饱和度色用于远景 context 区域，避免抢 playable 势力色。
 */
export const mapFactionFallbackColors: Record<string, string> = {
  // 真实势力（与 src/data/factions.ts primaryColor 一致）
  ming: "#C63D32",
  tumed: "#387CA3",
  jianzhou: "#B88928",
  chahar: "#5B6C9D",
  haixi: "#96713B",
  korchin: "#6B8B7A",
  nurgan: "#4E7F8C",
  joseon: "#5E8FB2",
  japan: "#7C5D9E",
  ainu: "#8D7461",
  bozhou: "#7A8A3A",

  // 背景势力（仅地图层，低饱和）
  tibet: "#7A6B8A",
  mobei: "#6E7A8C",
  "southeast-asia": "#6F8A6A",
  liuqiu: "#6B8AA0",
  "western-sea": "#5F7A82"
};

/** 中性远景色（无势力归属的纯地理区） */
export const NEUTRAL_CONTEXT_COLOR = "#8A8276";

/**
 * 解析势力颜色：优先用运行时 factions（playable 图块当前控制者），
 * 其次用兜底色板（context 图块静态控制者或背景势力），最后降级为中性色。
 */
export function resolveMapFactionColor(
  factionId: string | undefined,
  factions?: Record<string, FactionState>
): string {
  if (!factionId) return NEUTRAL_CONTEXT_COLOR;
  return factions?.[factionId]?.primaryColor ?? mapFactionFallbackColors[factionId] ?? NEUTRAL_CONTEXT_COLOR;
}
