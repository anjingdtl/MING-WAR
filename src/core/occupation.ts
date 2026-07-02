/**
 * ⚠️  DETERMINISM-CHANGE (T12 — 2026-07-02)
 * ---------------------------------------------------------------------------
 * 占地治理 —— "占下 != 守稳"。
 *
 * 设计来源：研究报告 §3 民心与占领管理；
 * SPEC：docs/superpowers/specs/2026-07-02-military-refactor-executable-spec.md §4 T12
 *
 * 核心规则（每月结算）：
 *   occupationResistance += baseResistance × garrisonDrag × stabilityMod × supplyMod
 *     - baseResistance: 同文化 0.5 / 异文化 2.0
 *     - garrisonDrag: 驻军不足 5k 时降为 0，充足时接近 1
 *     - stabilityMod: (100 - stability) / 50（控制不稳加速）
 *     - supplyMod: supplyRatio < 0.5 → 1.5
 *   occupationResistance > 80 → rebelPressure += 1
 *   localSupport：受 garrisonEffect / taxRelief / supplyShortage / foreignCulture 调制
 *
 * 接入点：runRegionPhase 末尾（depositMonthlySupply 之后），对每个 region
 * 调用 tickOccupation。返回 nextRegion 与可能的 ledgerEntry。
 *
 * R3 缓解：异族控制 < 6 月时 occupationResistance 增长曲线平缓（指数
 * 而非线性，前 6 月 ×0.5 衰减）；大明控制区 localSupport 每月小幅回升。
 *
 * 必须跑：npm run hash:state + npm run batch + npm run diagnose
 * ===========================================================================
 */

import type { FactionId, GameState, RegionState } from "./types";
import type { LedgerEntry } from "./ledger";
import { computeSupplyRatio } from "./supply";

/* ===========================================================================
 * 常量
 * =========================================================================== */
const BASE_RESISTANCE_SAME_CULTURE = 0.5;
const BASE_RESISTANCE_FOREIGN = 2.0;
const GARRISON_DRAG_REFERENCE = 5000;
const STABILITY_DIVISOR = 50;
const SUPPLY_PENALTY_THRESHOLD = 0.5;
const SUPPLY_PENALTY_MULT = 1.5;
const REBELLION_TRIGGER_THRESHOLD = 80;
const REBELLION_PRESSURE_PER_MONTH = 1;

/** 异族新控制期衰减：前 6 月 ×0.5（避免大明 1585 之前就丢西北）。 */
const FRESH_CONTROL_MONTHS = 6;
const FRESH_CONTROL_FACTOR = 0.5;

/* ===========================================================================
 * 月度结算
 * =========================================================================== */

/**
 * 单 region 的占地治理月度结算。
 * @returns nextRegion 与可选 ledgerEntry（赈济扣国库）
 *
 * 纯函数：无 random 调用；state 写入：region.military.occupationResistance /
 * region.military.localSupport / region.rebelPressure；ledger 仅在赈济时
 * 扣 faction.grainReserve（不入国库）。
 */
export function tickOccupation(
  state: GameState,
  region: RegionState,
  factionId: FactionId
): { region: RegionState; entries: LedgerEntry[] } {
  // 边界：无 military 字段的旧 region 视为非占领（防御性返回）
  if (!region.military) {
    return { region, entries: [] };
  }
  const faction = state.factions[factionId];
  if (!faction) {
    return { region, entries: [] };
  }
  // 文化差判定：faction 在 region.coreFactionIds 中为同文化
  const isSameCulture = region.coreFactionIds?.includes(factionId) ?? false;
  const baseResistance = isSameCulture
    ? BASE_RESISTANCE_SAME_CULTURE
    : BASE_RESISTANCE_FOREIGN;

  // 新控制期衰减（异族 < 6 月 × 0.5）
  const monthsControlled = countMonthsUnderControl(state, region.id, factionId);
  const freshControlFactor =
    !isSameCulture && monthsControlled < FRESH_CONTROL_MONTHS
      ? FRESH_CONTROL_FACTOR
      : 1.0;

  // garrison 拖拽：garrison 5000 时接近 1，0 时为 0
  const garrisonDrag = Math.max(0, Math.min(1, region.garrison / GARRISON_DRAG_REFERENCE));

  // stability 调制：低 stability 加速抵抗
  const stabilityMod = Math.max(0, (100 - region.stability) / STABILITY_DIVISOR);

  // supply 调制：低 supply 加速抵抗
  const supplyRatio = computeSupplyRatio(state, factionId, region.id, 4);
  const supplyMod = supplyRatio < SUPPLY_PENALTY_THRESHOLD ? SUPPLY_PENALTY_MULT : 1.0;

  // occupationResistance 月增（异族控制：< 6 月 × 0.5 衰减）
  let resistanceDelta = baseResistance * garrisonDrag * stabilityMod * supplyMod;
  if (!isSameCulture) resistanceDelta *= freshControlFactor;
  // 同文化 / 大明核心控制区：occupationResistance 自然衰减
  if (isSameCulture) resistanceDelta = -region.military.occupationResistance * 0.1;

  const nextResistance = Math.max(
    0,
    Math.min(100, region.military.occupationResistance + resistanceDelta)
  );

  // localSupport 月度变化
  const garrisonEffect = region.garrison / GARRISON_DRAG_REFERENCE * 0.5; // 驻军维稳
  const taxReliefEffect = isSameCulture ? 0.2 : 0;                         // 同文化减税
  const supplyShortagePenalty = supplyRatio < 0.5 ? -2 : 0;                 // 补给差
  const foreignCulturePenalty = isSameCulture ? 0 : -3;                     // 异文化

  // 大明控制区（同文化 + 高控制）每月小幅回升
  const supportRecovery = isSameCulture && region.control > 70 ? 0.5 : 0;

  const supportDelta = garrisonEffect + taxReliefEffect + supplyShortagePenalty + foreignCulturePenalty + supportRecovery;
  const nextSupport = Math.max(0, Math.min(100, region.military.localSupport + supportDelta));

  // rebelPressure 累加：当 resistance > 80 时
  let nextRebelPressure = region.rebelPressure;
  if (nextResistance > REBELLION_TRIGGER_THRESHOLD) {
    nextRebelPressure = Math.min(100, nextRebelPressure + REBELLION_PRESSURE_PER_MONTH);
  }

  // 赈济：localSupport < 30 且 faction 有 grainReserve，消耗 grain 提升 support
  const entries: LedgerEntry[] = [];
  let finalSupport = nextSupport;
  if (finalSupport < 30 && faction.grainReserve > 1000) {
    const reliefAmount = Math.min(2000, faction.grainReserve * 0.05);
    finalSupport = Math.min(100, finalSupport + 5);
    entries.push({
      category: "grain-relief",
      source: `${region.name} 赈济稳治`,
      amount: -reliefAmount,
      factionId,
      goodId: "grain"
    });
  }

  return {
    region: {
      ...region,
      military: {
        ...region.military,
        occupationResistance: Math.round(nextResistance * 10) / 10,
        localSupport: Math.round(finalSupport * 10) / 10,
      },
      rebelPressure: nextRebelPressure,
    },
    entries,
  };
}

/* ===========================================================================
 * 工具：计算 region 在某 faction 控制下已多少月
 * =========================================================================== */

/**
 * 简化估算：检查 wars 列表是否有针对该 region 的 active war。
 * 更精确的做法是维护 controllerHistory，这里采用 O(1) 启发式：
 * 若 region 当前 controllerFactionId === factionId 且不在 wars 目标中，
 * 视为长期控制（monthsControlled = 0 但同文化判定仍生效）。
 * 若 region 在某 war 目标中且被占领，monthsControlled 用 war.monthsActive 替代。
 */
function countMonthsUnderControl(
  state: GameState,
  regionId: string,
  factionId: FactionId
): number {
  // 检查是否是新占领区域：在 wars 中作为目标且 attackerFactionId === factionId
  const recentWar = state.wars.find(
    (w) => w.targetRegionId === regionId && w.attackerFactionId === factionId
  );
  if (recentWar) {
    return recentWar.monthsActive;
  }
  // 非新控制（长期控制）→ 视为 6+ 月（无 fresh 衰减）
  return FRESH_CONTROL_MONTHS + 1;
}
