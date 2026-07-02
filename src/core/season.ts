/**
 * ⚠️  DETERMINISM-CHANGE (T9 — 2026-07-02)
 * ---------------------------------------------------------------------------
 * 季节状态机：让季节真正进入战斗 / 行军。
 *
 * 6 种状态 + 月度规则：
 *   - winter (11, 12, 1, 2 月 + 寒冷地区)：战斗 ×0.75、行军 ×1.8
 *   - mud (3, 4 月 + 平原 + 非干旱)：战斗 ×0.85、行军 ×1.5
 *   - flood (7, 8 月 + 湿润)：战斗 ×0.80、行军 ×1.7
 *   - drought (6, 7, 8 月 + 干旱)：战斗 ×0.95、行军 ×1.2
 *   - harvest (9, 10 月)：战斗 ×0.95、行军 ×1.1
 *   - normal：默认
 *
 * 调用点：
 *   - runRegionPhase 每月 1 号重算所有 region.military.seasonalState
 *   - warfare.ts:advanceWar 用 SEASONAL_COMBAT_MOD 缩放战斗力
 *   - movement.ts:computeEdgeDays 用 SEASONAL_TRAVEL_MOD 缩放行军日数（T10）
 *
 * 来源：研究文档 §3"季节必须可感"；SPEC §3 + §4.2。
 * ===========================================================================
 */

import type { ClimateType, RegionState, TerrainType } from "./types";

export type SeasonalState = "normal" | "mud" | "winter" | "drought" | "flood" | "harvest";

/** 战斗公式乘数：让季节直接降低/抬高有效战斗力。 */
export const SEASONAL_COMBAT_MOD: Record<SeasonalState, number> = {
  normal: 1.0,
  mud: 0.85,
  winter: 0.75,
  drought: 0.95,
  flood: 0.80,
  harvest: 0.95,
};

/** 行军乘数：让季节拖慢行军（T10 接入 movement.ts）。 */
export const SEASONAL_TRAVEL_MOD: Record<SeasonalState, number> = {
  normal: 1.0,
  mud: 1.5,
  winter: 1.8,
  drought: 1.2,
  flood: 1.7,
  harvest: 1.1,
};

/** 从 YYYY-MM 解析月份（1-12）。解析失败返回 6（夏季默认）。 */
export function parseMonth(date: string): number {
  const m = /-(\d{2})$/.exec(date);
  if (!m) return 6;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : 6;
}

/**
 * 计算 region 在指定月份的 seasonalState。规则：
 * 1. 寒冷地区 11/12/1/2 月 → winter（北方草原+辽东+朝鲜北道）
 * 2. 平原 3-4 月且非干旱 → mud（春汛泥泞）
 * 3. 湿润地区 7-8 月 → flood（长江流域梅雨）
 * 4. 干旱地区 6-8 月 → drought（西北/蒙古）
 * 5. 9-10 月 → harvest（秋收）
 * 6. 其余 → normal
 *
 * 优先级：winter > flood > drought > mud > harvest > normal。
 */
export function computeSeasonalState(month: number, region: RegionState): SeasonalState {
  const climate: ClimateType = region.climate;
  const terrain: TerrainType = region.terrain;
  // 1. 冬季（寒冷地区 + 11/12/1/2 月）
  if (climate === "cold" && (month === 11 || month === 12 || month === 1 || month === 2)) {
    return "winter";
  }
  // 2. 洪水（湿润 + 7/8 月）
  if (climate === "humid" && (month === 7 || month === 8)) {
    return "flood";
  }
  // 3. 旱季（干旱 + 6/7/8 月）
  if (climate === "dry" && (month === 6 || month === 7 || month === 8)) {
    return "drought";
  }
  // 4. 春汛泥泞（平原 + 3/4 月且非干旱气候）
  if (terrain === "plain" && (month === 3 || month === 4) && climate !== "dry") {
    return "mud";
  }
  // 5. 秋收（9/10 月）
  if (month === 9 || month === 10) {
    return "harvest";
  }
  // 6. 默认
  return "normal";
}

/**
 * T9: 月初对所有 region 重新计算 seasonalState。纯函数，return 新 state。
 * 调用时机：runRegionPhase 入口（生成灾害之后、各 region 计算之前）。
 */
export function tickSeasonalStates(state: { regions: Record<string, RegionState>; currentDate: string }): void {
  const month = parseMonth(state.currentDate);
  for (const region of Object.values(state.regions)) {
    const next = computeSeasonalState(month, region);
    if (region.military && region.military.seasonalState !== next) {
      region.military = { ...region.military, seasonalState: next };
    } else if (!region.military) {
      // 防御性：测试 fixture 没填 military 时不崩
      // （生产数据必定有 military）
    }
  }
}
