/**
 * v0.9.3 — 围城 / 工事 / 战利品
 *
 * 来源：研究文档《MING-WAR 军事系统优化改造深度研究报告》§3.3（围城）
 * SPEC：`docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md` §4.4
 *
 * 设计目标：让"打不动"和"打得动"都是真实状态。
 * - siegeDmg = attackerPower / fortLevel 累积扣 garrison
 * - fort_level 维护费 200 金/region/月（持久的成本）走账本 'expense-construction'
 * - 围城成功 capturePlunder = population × 0.10 × 5 给 treasury（走 'income-event'）
 * - region.stability -15（+ rebelPressure 5%）
 *
 * 最小侵入：所有逻辑在 runWarPhase 中转调。siege.ts 自身为纯函数。
 */

import type { FactionId, GameState, RegionId, RegionState } from "./types";
import type { LedgerEntry } from "./ledger";

/* ===========================================================================
 * 常量 [PLACEHOLDER] 调参准则见 SPEC §7.3
 * =========================================================================== */
const SIEGE_DMG_DIVISOR = 8;       // 每周围城伤害 = attackerCommitted / SIEGE_DMG_DIVISOR / fortLevel
const SIEGE_FORT_MIN = 1;          // fortLevel 下限 1（无工事时也有基础难度）
const SIEGE_GARRISON_FLOOR = 1000; // 围城后 garrison 不可低于此（守军可投降但不至 0）
const SIEGE_MAINTENANCE_PER_REGION = 200; // 围城期工事维护费（月/region）
const PLUNDER_POP_RATE = 0.10;     // 战利品 = population × PLUNDER_POP_RATE × 5
const PLUNDER_BASE_MULT = 5;       // 战利品基础乘数
const CAPTURE_STABILITY_HIT = 15;  // 围城成功 stability -15
const CAPTURE_REBEL_PRESSURE_HIT = 5; // 围城成功 rebelPressure +5

/* ===========================================================================
 * 围城伤害：每周期 (1 月) 把 committedForce 转成 garrison 损耗
 * =========================================================================== */

/**
 * 计算 1 月围城对 region 的伤害。
 * @returns 新的 region（garrison 减少；若被围住，fortification 减 0 维持）
 */
export function tickSiegeDamage(
  region: RegionState,
  attackerCommitted: number
): RegionState {
  if (attackerCommitted <= 0) return region;
  const fortLevel = Math.max(SIEGE_FORT_MIN, region.fortification / 20); // 0..100 → 0..5，min 1
  const dmg = Math.max(0, Math.round(attackerCommitted / SIEGE_DMG_DIVISOR / fortLevel));
  const nextGarrison = Math.max(SIEGE_GARRISON_FLOOR, region.garrison - dmg);
  return { ...region, garrison: nextGarrison };
}

/* ===========================================================================
 * 战利品：围城成功后一次性掠夺金
 * =========================================================================== */

/**
 * 围城成功时计算战利品与稳定性影响。返回新 region + ledger entries。
 * 战利品 = population × 0.10 × 5（按 v0.9 PLACEHOLDER 调参）。
 * Stability -15；rebelPressure +5。
 */
export function applyCapturePlunder(
  region: RegionState,
  attackerId: FactionId,
  attackerFactionName: string
): { region: RegionState; entries: LedgerEntry[] } {
  const plunder = Math.round(region.population * PLUNDER_POP_RATE * PLUNDER_BASE_MULT);
  const nextStability = Math.max(0, region.stability - CAPTURE_STABILITY_HIT);
  const nextRebelPressure = region.rebelPressure + CAPTURE_REBEL_PRESSURE_HIT;
  const entries: LedgerEntry[] = [
    {
      category: "income-tariff", // 战利品性质更近一次性收入，用 income-tariff 占位
      source: `${region.name} 战利品 (${attackerFactionName})`,
      amount: plunder,
      factionId: attackerId,
      regionId: region.id,
    },
  ];
  return {
    region: {
      ...region,
      stability: nextStability,
      rebelPressure: nextRebelPressure,
    },
    entries,
  };
}

/* ===========================================================================
 * 工事维护费：每月对正在被围 region 收 200 金
 * =========================================================================== */

/**
 * 围城持续期间，对目标 region 收取工事维护费 200/月。
 * 走账本 'expense-construction'。由 runWarPhase 在 advanceWar 后调用。
 */
export function applySiegeMaintenance(
  region: RegionState,
  defenderId: FactionId,
  defenderFactionName: string
): LedgerEntry[] {
  return [{
    category: "expense-construction",
    source: `${region.name} 围城工事维护`,
    amount: -SIEGE_MAINTENANCE_PER_REGION,
    factionId: defenderId,
    regionId: region.id,
  }];
}

/* ===========================================================================
 * 工具：判定某 region 是否处于围城
 * =========================================================================== */

/**
 * 当前 war.targetRegionId == regionId 时返回 true。
 * 用于 runWarPhase 决定是否收维护费/扣围城伤害。
 */
export function isUnderSiege(
  state: GameState,
  regionId: RegionId
): boolean {
  return state.wars.some((w) => w.targetRegionId === regionId);
}
