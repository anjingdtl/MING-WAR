import type { GoodId, PopType, PopGroup, RegionId, GameState } from "./types";
import { POP_NEEDS, BASE_PRICES } from "./market";

/**
 * Distribution profiles for initial population seeding by terrain.
 * Reflects historical late-Ming demographic structure.
 */
const DEFAULT_DISTRIBUTION: Record<PopType, number> = {
  peasant: 0.65,   // 自耕农
  tenant: 0.18,    // 佃户
  artisan: 0.06,   // 工匠
  merchant: 0.02,  // 商人
  gentry: 0.015,   // 士绅
  official: 0.005, // 官吏
  soldier: 0.03,   // 军户
  migrant: 0.04    // 流民
};

/**
 * Monthly per-capita income by pop type (silver). Combined with the need
 * basket cost at market prices, this drives wealth accumulation and the
 * purchasing-power living standard (SPEC v2 S2b).
 */
export const POP_INCOME: Record<PopType, number> = {
  peasant: 0.5,
  tenant: 0.45,
  artisan: 0.9,
  merchant: 2.0,
  gentry: 4.0,
  official: 6.0,
  soldier: 0.6,
  migrant: 0.15
};

export interface PopDynamicsInput {
  region: { id: RegionId; population: number; stability: number; agriculture: number; taxCapacity: number; control: number; rebelPressure: number };
  grainPerCapita: number; // grain / population ratio
  taxRate: number;
  /** Current market prices, used to price each pop's need basket (S2b). */
  marketPrices?: Partial<Record<GoodId, number>>;
}

/**
 * Initialize pop groups for a region based on total population.
 */
export function initializePopGroups(regionId: RegionId, totalPopulation: number): PopGroup[] {
  return Object.entries(DEFAULT_DISTRIBUTION).map(([type, share]) => ({
    id: `${regionId}-${type}`,
    regionId,
    type: type as PopType,
    size: Math.round(totalPopulation * share),
    employed: 0,
    wealth: 100,
    literacy: type === "gentry" || type === "official" ? 60 : 10,
    subsistence: 100,
    needsSatisfaction: 100,
    taxBurden: type === "peasant" || type === "tenant" ? 0.4 : 0.1,
    politicalPower: type === "official" ? 60 : type === "gentry" ? 50 : type === "merchant" ? 30 : 5,
    loyalty: 60,
    radicalism: type === "migrant" ? 50 : 10
  }));
}

/**
 * Compute total population from sum of pop groups.
 */
export function sumPopulation(groups: PopGroup[]): number {
  return groups.reduce((sum, g) => sum + g.size, 0);
}

/**
 * Aggregate stats by category from pop groups.
 */
export interface PopAggregates {
  totalPopulation: number;
  totalEmployed: number;
  totalWealth: number;
  averageNeedsSatisfaction: number;
  averageRadicalism: number;
  totalMigrants: number;
  totalTaxpayers: number;
}

export function aggregatePopStats(groups: PopGroup[]): PopAggregates {
  const total = sumPopulation(groups);
  if (total === 0) {
    return {
      totalPopulation: 0,
      totalEmployed: 0,
      totalWealth: 0,
      averageNeedsSatisfaction: 0,
      averageRadicalism: 0,
      totalMigrants: 0,
      totalTaxpayers: 0
    };
  }
  let employed = 0;
  let wealth = 0;
  let satisfaction = 0;
  let radicalism = 0;
  let migrants = 0;
  let taxpayers = 0;
  for (const g of groups) {
    employed += g.employed;
    wealth += g.wealth * g.size;
    satisfaction += g.needsSatisfaction * g.size;
    radicalism += g.radicalism * g.size;
    if (g.type === "migrant") migrants += g.size;
    if (g.taxBurden > 0) taxpayers += g.size;
  }
  return {
    totalPopulation: total,
    totalEmployed: employed,
    totalWealth: Math.round(wealth / total),
    averageNeedsSatisfaction: Math.round(satisfaction / total),
    averageRadicalism: Math.round(radicalism / total),
    totalMigrants: migrants,
    totalTaxpayers: taxpayers
  };
}

/**
 * Apply monthly pop group dynamics: employment, needs satisfaction,
 * famine deaths, radicalism changes, identity transitions.
 */
export function advancePopGroups(groups: PopGroup[], input: PopDynamicsInput): PopGroup[] {
  const result: PopGroup[] = [];

  for (const group of groups) {
    let next: PopGroup = { ...group };

    // Employment: stability & agriculture determine available jobs
    const employmentCapacity = input.region.agriculture * input.region.stability / 100;
    next.employed = Math.min(next.size, Math.round(next.size * (employmentCapacity / 100)));
    next.employment = next.employed; // alias for legacy fields

    // S2b: needsSatisfaction is a purchasing-power ratio — after-tax monthly
    // income vs the cost of the need basket at current market prices. A dear
    // harvest raises the basket cost and erodes living standards even before
    // folk literally starve (grainPerCapita still drives famine death below).
    // This is the Victoria-3 link: market price → purchasing power → SoL.
    const needs = POP_NEEDS[next.type] ?? {};
    const basketCost = Object.entries(needs).reduce(
      (sum, [good, qty]) => sum + (qty as number) * (input.marketPrices?.[good as GoodId] ?? BASE_PRICES[good as GoodId]),
      0
    );
    const income = (POP_INCOME[next.type] ?? 0.2) * (1 - next.taxBurden);
    next.wealth = Math.max(0, Math.round((next.wealth + income - basketCost) * 100) / 100);
    const purchasingPower = basketCost > 0 ? income / basketCost : 1;
    next.needsSatisfaction = Math.max(0, Math.min(100, Math.round(purchasingPower * 50)));

    // Subsistence still tracks physical grain per capita (famine proxy).
    next.subsistence = Math.min(100, Math.round(input.grainPerCapita * 100));

    // Radicalism rises with famine, falls with stability
    if (next.needsSatisfaction < 40) {
      next.radicalism = Math.min(100, next.radicalism + 4);
    } else if (next.needsSatisfaction > 70) {
      next.radicalism = Math.max(0, next.radicalism - 1);
    }

    // Famine deaths: very harsh on low-subsistence groups
    if (input.grainPerCapita < 0.4) {
      const deathRate = (0.4 - input.grainPerCapita) * 0.05; // up to 2% per month
      next.size = Math.max(0, Math.round(next.size * (1 - deathRate)));
    }

    // Migration: high radicalism + low satisfaction → become migrants
    if (next.radicalism > 70 && next.needsSatisfaction < 30 && next.type !== "migrant") {
      const migrateOut = Math.round(next.size * 0.1);
      next.size -= migrateOut;
      result.push({
        ...next,
        type: "migrant",
        size: migrateOut,
        radicalism: 80,
        needsSatisfaction: 20,
        id: `${group.regionId}-migrant-from-${group.type}`,
        loyalty: 20
      });
      // Skip original group; if size>0, it stays
      if (next.size > 0) result.push(next);
      continue;
    }

    result.push(next);
  }

  // Combine any duplicates created by migration
  return combinePopGroups(result);
}

function combinePopGroups(groups: PopGroup[]): PopGroup[] {
  const map = new Map<string, PopGroup>();
  for (const g of groups) {
    const key = `${g.regionId}-${g.type}`;
    const existing = map.get(key);
    if (existing) {
      const totalSize = existing.size + g.size;
      const weightAvg = (a: number, b: number, ta: number, tb: number) =>
        totalSize === 0 ? 0 : Math.round((a * ta + b * tb) / totalSize);
      map.set(key, {
        ...existing,
        size: totalSize,
        employed: existing.employed + g.employed,
        wealth: weightAvg(existing.wealth, g.wealth, existing.size, g.size),
        needsSatisfaction: weightAvg(existing.needsSatisfaction, g.needsSatisfaction, existing.size, g.size),
        radicalism: weightAvg(existing.radicalism, g.radicalism, existing.size, g.size),
        loyalty: weightAvg(existing.loyalty, g.loyalty, existing.size, g.size)
      });
    } else {
      map.set(key, g);
    }
  }
  return Array.from(map.values());
}

/**
 * Compute aggregate grain per capita for a region.
 */
export function computeGrainPerCapita(grainStock: number, totalPopulation: number): number {
  if (totalPopulation === 0) return 1;
  // 1 person needs roughly 0.25 grain per month.
  // Floor the stock at 0: a negative grainStock is a bookkeeping deficit,
  // not "anti-food" — clamp it so the famine death-rate formula
  // (0.4 - grainPerCapita) * 0.05 can't run away to catastrophic values.
  return Math.max(0, grainStock) / (totalPopulation * 0.25);
}

/**
 * Migrants attempt to migrate to neighboring regions.
 * Returns: { migratedOut, migratedIn }
 */
export function migrateMigrants(
  state: GameState,
  regionId: RegionId
): { migratedOut: number; migratedIn: number } {
  const region = state.regions[regionId];
  if (!region) return { migratedOut: 0, migratedIn: 0 };
  const groups = region.popGroups ?? [];
  const migrants = groups.find((g) => g.type === "migrant");
  if (!migrants || migrants.size < 100) return { migratedOut: 0, migratedIn: 0 };

  let migratedOut = 0;
  const connections = region.connections ?? [];
  for (const targetRegionId of connections) {
    const target = state.regions[targetRegionId];
    if (!target) continue;
    // Migrants prefer regions with higher stability/control
    if (target.stability < 30) continue;
    const moving = Math.round(migrants.size * 0.1);
    if (moving === 0) continue;

    // Remove from origin
    region.popGroups = region.popGroups?.map((g) =>
      g.id === migrants.id ? { ...g, size: g.size - moving } : g
    );

    // Add to destination
    if (!target.popGroups) {
      target.popGroups = initializePopGroups(target.id, target.population);
    }
    const existingMigrant = target.popGroups.find((g) => g.type === "migrant");
    if (existingMigrant) {
      target.popGroups = target.popGroups.map((g) =>
        g.type === "migrant" ? { ...g, size: g.size + moving, radicalism: 60 } : g
      );
    } else {
      target.popGroups.push({
        id: `${target.id}-migrant`,
        regionId: target.id,
        type: "migrant",
        size: moving,
        employed: 0,
        wealth: 50,
        literacy: 5,
        subsistence: 50,
        needsSatisfaction: 50,
        taxBurden: 0,
        politicalPower: 0,
        loyalty: 30,
        radicalism: 60
      });
    }
    migratedOut += moving;
  }
  return { migratedOut, migratedIn: 0 };
}

/**
 * Migrants become rebels when they accumulate in a region with low control.
 */
export function checkMigrantToRebels(region: { popGroups?: PopGroup[]; control: number; rebelPressure: number }): number {
  if (!region.popGroups) return 0;
  const migrants = region.popGroups.find((g) => g.type === "migrant");
  if (!migrants) return 0;
  if (region.control < 40 && migrants.size > 500 && migrants.radicalism > 60) {
    return Math.round(migrants.size * 0.1);
  }
  return 0;
}