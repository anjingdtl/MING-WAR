import type { DomesticFocus, FactionState, Modifier, RegionState } from "./types";
import { computeGrainYieldPenalty } from "./disaster";
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
  const corruptionLoss = faction.corruption / 140;
  const agricultureBoost = focus === "agriculture" ? 1.12 : 1;
  const financeBoost = focus === "finance" ? 1.14 : 1;
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
    * computeGrainYieldPenalty(region.activeDisasters)
  );
  const grainConsumed = Math.round(region.population * 0.065 + region.garrison * 0.1);
  // Phase 2 calibration: tax coefficient 0.022 → 0.004, collectionEfficiency
  // factor 0.45-0.80 (based on administration). Aligns Ming annual tax to ~396万两.
  const collectionEfficiency = 0.45 + (faction.administration / 100) * 0.35;
  const taxCollected = Math.max(
    0,
    Math.round(
      region.population *
        (region.taxCapacity / 100) *
        controlFactor *
        collectionEfficiency *
        financeBoost *
        (1 - corruptionLoss) *
        0.004 *
        taxMult
    )
  );
  // S1c: region.grainStock is NO LONGER mutated here. The grain delta is
  // returned as separate production/consumption figures and applied to state
  // exclusively via ledger entries + applyLedgerToState, making the ledger
  // the single source of truth for grain balances. (Previously economy
  // mutated grainStock directly AND the ledger recorded the same delta, so
  // activating applyLedgerToState would have applied it twice.)
  return {
    region,
    grainProduced,
    grainConsumed,
    taxCollected,
    treasuryDelta: taxCollected,
    grainDelta: grainProduced - grainConsumed
  };
}

export function calculateFactionMaintenance(
  faction: FactionState,
  modifiers: Modifier[] = []
): { treasuryCost: number; grainCost: number; bureaucratCost: number; armyPayCost: number } {
  // Per-soldier pay scales with regime type: tribal levies are cheap
  // (部族动员), rebel bands barely paid (流民武装), while dynasties carry
  // professional garrisons. Phase 2 calibration: aligned so Ming's peacetime
  // military spending ≈ 58% of monthly tax revenue (~19万两/mo).
  const costPerSoldier =
    faction.type === "tribal" ? 0.15
    : faction.type === "rebel" ? 0.08
    : faction.type === "local" ? 0.30
    : 0.28;
  const adminCost =
    faction.type === "tribal" ? 300
    : faction.type === "rebel" ? 150
    : faction.type === "local" ? 400
    : 500;
  const grainPerSoldier = faction.type === "tribal" ? 0.05 : 0.08;
  // S1b: maintenance-mult modifier (e.g. 募兵改革/欠饷) scales both silver and grain upkeep.
  const maintMult = 1 + queryModifier(modifiers, "faction", faction.id, "maintenance-mult");
  // S1c: split silver upkeep into army pay + bureaucracy so the ledger can
  // book them under distinct categories (expense-army-pay / expense-bureaucrat).
  // treasuryCost === armyPayCost + bureaucratCost exactly, keeping the
  // Δtreasury === ledger silver-net invariant tight.
  const armyPayCost = Math.round(faction.armyTotal * costPerSoldier * maintMult);
  const bureaucratCost = Math.round(faction.administration * adminCost * maintMult);
  return {
    treasuryCost: armyPayCost + bureaucratCost,
    armyPayCost,
    bureaucratCost,
    grainCost: Math.round(faction.armyTotal * grainPerSoldier * maintMult)
  };
}
