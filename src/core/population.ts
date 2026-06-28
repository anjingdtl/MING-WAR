import type { DomesticFocus, RegionState } from "./types";

export interface PopulationResult {
  nextPopulation: number;
  deaths: number;
  migrants: number;
  growth: number;
}

export function calculatePopulation(region: RegionState, focus: DomesticFocus): PopulationResult {
  const capacityPressure = Math.max(0, region.population / region.populationCapacity - 0.85);
  const stabilityFactor = region.stability / 100;
  const foodStress = region.grainStock < region.population * 0.12 ? 0.018 : 0;
  const disasterStress = region.activeDisasters.length * 0.012;
  const focusBoost = focus === "recovery" ? 0.004 : focus === "agriculture" ? 0.002 : 0;
  const naturalGrowthRate = Math.max(0, 0.003 + focusBoost - capacityPressure * 0.01);
  const growth = Math.round(region.population * naturalGrowthRate * stabilityFactor);
  const deaths = Math.round(region.population * (foodStress + disasterStress));
  const migrants = Math.round(region.population * Math.max(0, (55 - region.stability) / 10000));
  const nextPopulation = Math.max(1000, region.population + growth - deaths - migrants);
  return { nextPopulation, deaths, migrants, growth };
}
