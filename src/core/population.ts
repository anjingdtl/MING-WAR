import type { ClimateType, DomesticFocus, RegionState } from "./types";

export interface PopulationResult {
  nextPopulation: number;
  deaths: number;
  migrants: number;
  growth: number;
}

/**
 * Monthly population growth base rate by climate zone.
 * temperate ~0.18%/yr, humid ~0.36%/yr, cold ~0.12%/yr, dry ~0.14%/yr.
 */
export const REGIONAL_GROWTH_BASE: Record<ClimateType, number> = {
  temperate: 0.00015,
  humid: 0.00030,
  cold: 0.00010,
  dry: 0.00012,
};

/**
 * Per-disaster death rate by climate zone (replaces fixed 0.012).
 */
export const DISASTER_DEATH_RATE: Record<ClimateType, number> = {
  dry: 0.018,
  temperate: 0.012,
  humid: 0.010,
  cold: 0.014,
};

export function calculatePopulation(region: RegionState, focus: DomesticFocus): PopulationResult {
  const capacityPressure = Math.max(0, region.population / region.populationCapacity - 0.85);
  const stabilityFactor = region.stability / 100;
  const foodStress = region.grainStock < region.population * 0.12 ? 0.018 : 0;
  const disasterDeathRate = DISASTER_DEATH_RATE[region.climate] ?? 0.012;
  const disasterStress = region.activeDisasters.length * disasterDeathRate;
  const focusBoost = focus === "recovery" ? 0.0003 : focus === "agriculture" ? 0.00015 : 0;
  const growthBase = REGIONAL_GROWTH_BASE[region.climate] ?? 0.00015;
  const naturalGrowthRate = Math.max(0, growthBase + focusBoost - capacityPressure * 0.01);
  const growth = Math.round(region.population * naturalGrowthRate * stabilityFactor);
  const deaths = Math.round(region.population * (foodStress + disasterStress));
  const migrants = Math.round(region.population * Math.max(0, (55 - region.stability) / 10000));
  const nextPopulation = Math.max(1000, region.population + growth - deaths - migrants);
  return { nextPopulation, deaths, migrants, growth };
}
