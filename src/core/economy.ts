import type { DomesticFocus, FactionState, RegionState } from "./types";

export interface EconomyResult {
  region: RegionState;
  grainProduced: number;
  grainConsumed: number;
  taxCollected: number;
  treasuryDelta: number;
  grainDelta: number;
}

export function calculateRegionEconomy(
  region: RegionState,
  faction: FactionState,
  focus: DomesticFocus
): EconomyResult {
  const stabilityFactor = region.stability / 100;
  const controlFactor = region.control / 100;
  const administrationFactor = faction.administration / 100;
  const corruptionLoss = faction.corruption / 140;
  const agricultureBoost = focus === "agriculture" ? 1.12 : 1;
  const financeBoost = focus === "finance" ? 1.14 : 1;
  const administrationBoost = focus === "administration" ? 0.94 : 1;
  const grainProduced = Math.round(
    region.population * (region.agriculture / 100) * 0.09 * stabilityFactor * agricultureBoost
  );
  const grainConsumed = Math.round(region.population * 0.075 + region.garrison * 0.16);
  const taxCollected = Math.max(
    0,
    Math.round(
      region.population *
        (region.taxCapacity / 100) *
        controlFactor *
        administrationFactor *
        financeBoost *
        administrationBoost *
        (1 - corruptionLoss) *
        0.018
    )
  );
  return {
    region: {
      ...region,
      grainStock: Math.max(0, region.grainStock + grainProduced - grainConsumed)
    },
    grainProduced,
    grainConsumed,
    taxCollected,
    treasuryDelta: taxCollected,
    grainDelta: grainProduced - grainConsumed
  };
}

export function calculateFactionMaintenance(faction: FactionState): { treasuryCost: number; grainCost: number } {
  return {
    treasuryCost: Math.round(faction.armyTotal * 1.8 + faction.administration * 1200),
    grainCost: Math.round(faction.armyTotal * 0.11)
  };
}
