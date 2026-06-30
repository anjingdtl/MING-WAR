import type { ClimateType, DisasterState, DisasterType, RegionState } from "./types";
import type { RandomSource } from "./random";

/**
 * Disaster definitions with climate affinity and effect parameters.
 */
export interface DisasterDef {
  type: DisasterType;
  /** Climate zones where this disaster type is more likely. */
  preferredClimates: ClimateType[];
  /** Grain yield penalty (0-1). */
  grainPenalty: number;
  /** Grain price spike multiplier (additive, e.g. 0.15 = +15%). */
  priceSpike: number;
  /** Stability loss per month. */
  stabilityLoss: number;
  /** Population death rate per month. */
  deathRate: number;
  /** Garrison loss rate per month. */
  garrisonLossRate: number;
}

export const DISASTER_DEFS: Record<DisasterType, DisasterDef> = {
  drought: {
    type: "drought",
    preferredClimates: ["dry"],
    grainPenalty: 0.40,
    priceSpike: 0.15,
    stabilityLoss: 3,
    deathRate: 0,
    garrisonLossRate: 0,
  },
  flood: {
    type: "flood",
    preferredClimates: ["humid"],
    grainPenalty: 0.25,
    priceSpike: 0.10,
    stabilityLoss: 2,
    deathRate: 0,
    garrisonLossRate: 0,
  },
  famine: {
    type: "famine",
    preferredClimates: ["dry", "temperate"],
    grainPenalty: 0.30,
    priceSpike: 0.20,
    stabilityLoss: 4,
    deathRate: 0.003,
    garrisonLossRate: 0.01,
  },
  plague: {
    type: "plague",
    preferredClimates: ["temperate", "humid", "dry", "cold"],
    grainPenalty: 0,
    priceSpike: 0.05,
    stabilityLoss: 4,
    deathRate: 0.005,
    garrisonLossRate: 0.02,
  },
  locust: {
    type: "locust",
    preferredClimates: ["dry", "temperate"],
    grainPenalty: 0.50,
    priceSpike: 0.12,
    stabilityLoss: 2,
    deathRate: 0,
    garrisonLossRate: 0,
  },
};

/**
 * Monthly disaster probability by region condition.
 */
function getDisasterProbability(region: RegionState): number {
  if (region.climate === "dry" && region.stability < 60) return 0.03;
  if (region.climate === "temperate" && region.stability < 50) return 0.015;
  if (region.climate === "humid" && region.stability < 40) return 0.01;
  if (region.climate === "cold") return 0.008;
  return 0.005; // baseline
}

/**
 * Pick a disaster type weighted by climate affinity.
 */
function pickDisasterType(climate: ClimateType, random: RandomSource): DisasterType {
  const types: DisasterType[] = ["drought", "flood", "famine", "plague", "locust"];
  // Weight preferred disasters higher for this climate
  const weights = types.map((t) => {
    const def = DISASTER_DEFS[t];
    return def.preferredClimates.includes(climate) ? 3 : 1;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = random.next() * totalWeight;
  for (let i = 0; i < types.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return types[i];
  }
  return types[types.length - 1];
}

/**
 * Generate new disasters for all regions this month.
 * Called before the economy step in the simulation pipeline.
 */
export function generateDisasters(
  regions: Record<string, RegionState>,
  random: RandomSource,
  currentDate: string
): void {
  for (const region of Object.values(regions)) {
    // Tick down existing disasters and remove expired ones
    region.activeDisasters = region.activeDisasters
      .map((d) => ({ ...d, remainingMonths: d.remainingMonths - 1 }))
      .filter((d) => d.remainingMonths > 0);

    // Check for new disaster
    const prob = getDisasterProbability(region);
    // Plague has a separate flat 0.3% chance in any region
    const plagueRoll = random.next();
    const generalRoll = random.next();

    if (plagueRoll < 0.003) {
      // Plague can strike anywhere
      region.activeDisasters.push({
        id: `${region.id}-plague-${currentDate}`,
        type: "plague",
        severity: 0.3 + random.next() * 0.5,
        remainingMonths: 2 + random.int(0, 4),
      });
    } else if (generalRoll < prob) {
      const disasterType = pickDisasterType(region.climate, random);
      region.activeDisasters.push({
        id: `${region.id}-${disasterType}-${currentDate}`,
        type: disasterType,
        severity: 0.3 + random.next() * 0.5,
        remainingMonths: 2 + random.int(0, 4),
      });
    }
  }
}

/**
 * Apply disaster effects to a region: stability loss, garrison loss.
 * Grain yield and price effects are handled in economy.ts and market.ts respectively.
 * Returns the modified region.
 */
export function applyDisasterEffects(region: RegionState): RegionState {
  if (region.activeDisasters.length === 0) return region;

  let stabilityLoss = 0;
  let deathRate = 0;
  let garrisonLossRate = 0;

  for (const d of region.activeDisasters) {
    const def = DISASTER_DEFS[d.type];
    if (!def) continue;
    const severityMult = d.severity;
    stabilityLoss += def.stabilityLoss * severityMult;
    deathRate += def.deathRate * severityMult;
    garrisonLossRate += def.garrisonLossRate * severityMult;
  }

  return {
    ...region,
    stability: Math.max(0, region.stability - stabilityLoss),
    population: deathRate > 0
      ? Math.max(1000, Math.round(region.population * (1 - deathRate)))
      : region.population,
    garrison: garrisonLossRate > 0
      ? Math.max(1000, Math.round(region.garrison * (1 - garrisonLossRate)))
      : region.garrison,
  };
}

/**
 * Compute the grain yield penalty from active disasters (0-1 multiplier).
 * Used by the economy module to reduce grain production.
 */
export function computeGrainYieldPenalty(activeDisasters: DisasterState[]): number {
  let penalty = 1;
  for (const d of activeDisasters) {
    const def = DISASTER_DEFS[d.type];
    if (!def) continue;
    penalty *= 1 - def.grainPenalty * d.severity;
  }
  return Math.max(0.1, penalty); // floor at 10% production
}

/**
 * Compute the grain price spike from active disasters (additive multiplier).
 * Used by the market module to spike grain prices.
 */
export function computeGrainPriceSpike(activeDisasters: DisasterState[]): number {
  let spike = 0;
  for (const d of activeDisasters) {
    const def = DISASTER_DEFS[d.type];
    if (!def) continue;
    spike += def.priceSpike * d.severity;
  }
  return spike;
}
