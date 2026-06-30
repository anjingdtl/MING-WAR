import type { GameState } from "./types";

export interface InvariantViolation {
  id: string;
  message: string;
  severity: "warning" | "error";
}

/** 1080 月长跑下 treasury 可达 -10⁷ 量级，破产 ≠ 数据异常。-1M 以下才报。 */
const TREASURY_EXTREME_FLOOR = -1_000_000;
const GRAIN_FLOOR = -100_000; // Allow some deficit but flag catastrophic
const POPULATION_EXPLOSION_MULTIPLIER = 5; // Population > 5x capacity suggests runaway growth

/**
 * Check critical state invariants. Returns list of violations.
 * - Treasury / grain values must not be NaN or extremely negative
 * - Population must not exceed capacity by 5x (likely runaway growth)
 * - Population must not be negative
 * - Dead factions must not have active armies
 * - Modifiers must not have negative remaining months
 * - War references must be valid
 */
export function validateInvariants(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const faction of Object.values(state.factions)) {
    if (Number.isNaN(faction.treasury)) {
      violations.push({ id: "nan-treasury", message: `${faction.name} 国库为 NaN`, severity: "error" });
    }
    if (faction.treasury < TREASURY_EXTREME_FLOOR) {
      violations.push({
        id: "treasury-extreme-negative",
        message: `${faction.name} 国库 ${faction.treasury} 极度负值`,
        severity: "error"
      });
    }
    if (Number.isNaN(faction.grainReserve)) {
      violations.push({ id: "nan-grain", message: `${faction.name} 粮食为 NaN`, severity: "error" });
    }
    if (faction.grainReserve < GRAIN_FLOOR) {
      violations.push({
        id: "grain-extreme-negative",
        message: `${faction.name} 粮食储备 ${faction.grainReserve} 极度负值`,
        severity: "error"
      });
    }
    if (faction.status !== "active" && faction.armyTotal > 0) {
      violations.push({
        id: "dead-faction-army",
        message: `${faction.name} 已 ${faction.status} 但仍有 ${faction.armyTotal} 兵力`,
        severity: "warning"
      });
    }
  }

  for (const region of Object.values(state.regions)) {
    if (
      region.population > region.populationCapacity * POPULATION_EXPLOSION_MULTIPLIER &&
      region.populationCapacity > 0
    ) {
      violations.push({
        id: "population-explosion",
        message: `${region.name} 人口 ${region.population} 超出承载力 5 倍`,
        severity: "error"
      });
    }
    if (region.population < 0) {
      violations.push({
        id: "population-negative",
        message: `${region.name} 人口为负值 ${region.population}`,
        severity: "error"
      });
    }
  }

  for (const mod of state.activeModifiers) {
    if (mod.remainingMonths !== undefined && mod.remainingMonths < 0) {
      violations.push({
        id: "modifier-negative-months",
        message: `修正 ${mod.id} 剩余月数为负 ${mod.remainingMonths}`,
        severity: "warning"
      });
    }
  }

  for (const war of state.wars) {
    if (!state.factions[war.attackerFactionId]) {
      violations.push({
        id: "war-attacker-missing",
        message: `战争 ${war.id} 引用了不存在的进攻方 ${war.attackerFactionId}`,
        severity: "error"
      });
    }
    if (!state.factions[war.defenderFactionId]) {
      violations.push({
        id: "war-defender-missing",
        message: `战争 ${war.id} 引用了不存在的防守方 ${war.defenderFactionId}`,
        severity: "error"
      });
    }
    if (!state.regions[war.targetRegionId]) {
      violations.push({
        id: "war-region-missing",
        message: `战争 ${war.id} 引用了不存在的目标地区 ${war.targetRegionId}`,
        severity: "error"
      });
    }
  }

  return violations;
}

/**
 * Convenience: count violations by severity.
 */
export function summarizeViolations(violations: InvariantViolation[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const v of violations) {
    if (v.severity === "error") errors++;
    else warnings++;
  }
  return { errors, warnings };
}