import type { DomesticFocus, FactionState, Modifier, RegionState } from "./types";
import { queryModifier } from "./modifiers";

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
  focus: DomesticFocus,
  modifiers: Modifier[] = []
): EconomyResult {
  const stabilityFactor = region.stability / 100;
  const controlFactor = region.control / 100;
  const administrationFactor = faction.administration / 100;
  const corruptionLoss = faction.corruption / 140;
  const agricultureBoost = focus === "agriculture" ? 1.12 : 1;
  const financeBoost = focus === "finance" ? 1.14 : 1;
  const administrationBoost = focus === "administration" ? 0.94 : 1;
  // Live modifier hooks (S1): event/law/disaster modifiers now actually move
  // these numbers instead of sitting inert in activeModifiers.
  const grainMult = 1 + queryModifier(modifiers, "region", region.id, "grain-output-mult", faction.id);
  const taxMult = 1 + queryModifier(modifiers, "region", region.id, "tax-mult", faction.id);
  // Production coefficient 0.17: a region breaks even on food when
  // agriculture*stability > ~3824, so southern heartlands (江南/湖广) net
  // produce while northern garrisons rely on southern grain — matches
  // late-Ming "南粮北调" and keeps the empire-wide grain balance slightly positive.
  const grainProduced = Math.round(
    region.population * (region.agriculture / 100) * 0.17 * stabilityFactor * agricultureBoost * grainMult
  );
  const grainConsumed = Math.round(region.population * 0.065 + region.garrison * 0.1);
  // Tax coefficient 0.022: tuned so Ming's peacetime land tax (~730k silver/mo)
  // covers bureaucracy+military pay (~440k), leaving a modest surplus that
  // crises (war, disaster) can erode — instead of guaranteed bankruptcy.
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
        0.022 *
        taxMult
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

export function calculateFactionMaintenance(faction: FactionState, modifiers: Modifier[] = []): { treasuryCost: number; grainCost: number } {
  // Per-soldier pay scales with regime type: tribal levies are cheap
  // (部族动员), rebel bands barely paid (流民武装), while dynasties carry
  // professional garrisons. Previous flat rate (armyTotal*1.8) made Ming's
  // 680k army cost 1.31M silver/mo — 2x its tax base — forcing guaranteed
  // bankruptcy within a year.
  const costPerSoldier =
    faction.type === "tribal" ? 0.22
    : faction.type === "rebel" ? 0.1
    : faction.type === "local" ? 0.45
    : 0.55;
  const adminCost =
    faction.type === "tribal" ? 500
    : faction.type === "rebel" ? 200
    : faction.type === "local" ? 700
    : 900;
  const grainPerSoldier = faction.type === "tribal" ? 0.05 : 0.08;
  // S1b: maintenance-mult modifier (e.g. 募兵改革/欠饷) scales both silver and grain upkeep.
  const maintMult = 1 + queryModifier(modifiers, "faction", faction.id, "maintenance-mult");
  return {
    treasuryCost: Math.round((faction.armyTotal * costPerSoldier + faction.administration * adminCost) * maintMult),
    grainCost: Math.round(faction.armyTotal * grainPerSoldier * maintMult)
  };
}
