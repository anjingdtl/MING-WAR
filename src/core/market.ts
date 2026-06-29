import type { GameState, GoodId, IndustryState, IndustryType, RegionId } from "./types";

/**
 * Default base prices for goods (silver units per unit).
 * Reflects late-Ming relative prices.
 */
export const BASE_PRICES: Record<GoodId, number> = {
  grain: 1.0,
  silver: 1.0,
  cloth: 3.0,
  iron: 4.0,
  timber: 2.0,
  salt: 5.0,
  horses: 50.0,
  weapons: 20.0,
  tea: 8.0,
  porcelain: 30.0,
  shipMaterial: 15.0
};

/**
 * Industry production templates: input/output ratios, base output.
 */
export const INDUSTRY_TEMPLATES: Record<
  IndustryType,
  {
    name: string;
    output: GoodId;
    baseOutputPerLevel: number;
    inputs: Partial<Record<GoodId, number>>;
    workforcePerLevel: number;
    requires: IndustryType[];
  }
> = {
  farmland: {
    name: "农田",
    output: "grain",
    baseOutputPerLevel: 100,
    inputs: {},
    workforcePerLevel: 50,
    requires: []
  },
  irrigation: {
    name: "水利",
    output: "grain",
    baseOutputPerLevel: 30, // Boosts existing farmland
    inputs: { grain: 10 },
    workforcePerLevel: 20,
    requires: ["farmland"]
  },
  workshop: {
    name: "工坊",
    output: "cloth",
    baseOutputPerLevel: 20,
    inputs: { grain: 5 },
    workforcePerLevel: 30,
    requires: []
  },
  mine: {
    name: "矿场",
    output: "iron",
    baseOutputPerLevel: 15,
    inputs: { grain: 10 },
    workforcePerLevel: 40,
    requires: []
  },
  saltField: {
    name: "盐场",
    output: "salt",
    baseOutputPerLevel: 25,
    inputs: {},
    workforcePerLevel: 25,
    requires: []
  },
  marketTown: {
    name: "市镇",
    output: "cloth", // Commerce output
    baseOutputPerLevel: 10,
    inputs: { grain: 5 },
    workforcePerLevel: 15,
    requires: []
  },
  port: {
    name: "港口",
    output: "silver", // Tariffs
    baseOutputPerLevel: 20,
    inputs: {},
    workforcePerLevel: 30,
    requires: []
  },
  postRoad: {
    name: "驿道",
    output: "grain", // Trade throughput
    baseOutputPerLevel: 5,
    inputs: { grain: 20 },
    workforcePerLevel: 10,
    requires: []
  },
  granary: {
    name: "官仓",
    output: "grain",
    baseOutputPerLevel: 0, // Storage only
    inputs: { grain: 50 },
    workforcePerLevel: 5,
    requires: []
  },
  militaryTown: {
    name: "军镇",
    output: "weapons",
    baseOutputPerLevel: 8,
    inputs: { iron: 5, grain: 10 },
    workforcePerLevel: 35,
    requires: ["mine"]
  }
};

/**
 * State for a region's market: prices and supply/demand per good.
 */
export interface MarketState {
  regionId: RegionId;
  prices: Record<GoodId, number>;
  supply: Record<GoodId, number>;
  demand: Record<GoodId, number>;
  imports: Record<GoodId, number>;
  exports: Record<GoodId, number>;
  silverStock: number;
}

/**
 * Initialize market state for a region with default prices.
 */
export function initializeMarket(regionId: RegionId): MarketState {
  const prices: Record<string, number> = {};
  const supply: Record<string, number> = {};
  const demand: Record<string, number> = {};
  const imports: Record<string, number> = {};
  const exports: Record<string, number> = {};
  for (const good of Object.keys(BASE_PRICES) as GoodId[]) {
    prices[good] = BASE_PRICES[good];
    supply[good] = 0;
    demand[good] = 0;
    imports[good] = 0;
    exports[good] = 0;
  }
  return {
    regionId,
    prices: prices as Record<GoodId, number>,
    supply: supply as Record<GoodId, number>,
    demand: demand as Record<GoodId, number>,
    imports: imports as Record<GoodId, number>,
    exports: exports as Record<GoodId, number>,
    silverStock: 1000
  };
}

/**
 * Compute new price based on supply/demand ratio.
 * - If supply > demand: price drops (excess supply)
 * - If supply < demand: price rises (scarcity)
 */
export function adjustPrice(
  currentPrice: number,
  supply: number,
  demand: number
): number {
  if (demand === 0) return currentPrice;
  const ratio = supply / demand; // 1.0 = balanced
  // Cap adjustments to ±50% per month for stability
  const adjustment = Math.max(0.5, Math.min(1.5, ratio));
  const newPrice = currentPrice * (2 - adjustment); // inverted: oversupply → lower price
  return Math.max(BASE_PRICES.grain * 0.1, newPrice); // floor at 10% of base
}

/**
 * Run a month's production for all industries in a region.
 */
export interface ProductionResult {
  industryId: string;
  actualOutput: number;
  workforceGap: number;
  inputShortage: Partial<Record<GoodId, number>>;
}

export function produceGoods(
  industries: IndustryState[],
  market: MarketState,
  region: { population: number; stability: number; agriculture: number; control: number },
  activeDisasters: string[]
): { produced: Record<GoodId, number>; consumed: Record<GoodId, number>; results: ProductionResult[] } {
  const produced: Record<string, number> = {};
  const consumed: Record<string, number> = {};
  const results: ProductionResult[] = [];

  for (const ind of industries) {
    const template = INDUSTRY_TEMPLATES[ind.type];
    if (!template) continue;

    // Workforce satisfaction
    const workforceAvailable = Math.min(ind.workforceRequired, region.population / 50);
    const workforceRatio = ind.workforceRequired === 0 ? 1 : workforceAvailable / ind.workforceRequired;

    // Input satisfaction
    const inputShortage: Record<string, number> = {};
    let inputRatio = 1;
    for (const [good, amount] of Object.entries(template.inputs)) {
      const available = market.supply[good as GoodId] ?? 0;
      if (available < amount * ind.level) {
        inputShortage[good] = amount * ind.level - available;
        inputRatio *= available / (amount * ind.level);
      } else {
        consumed[good] = (consumed[good] ?? 0) + (amount * ind.level);
        market.supply[good as GoodId] = available - amount * ind.level;
      }
    }

    // Disaster penalty
    const disasterPenalty = activeDisasters.length > 0 ? 0.5 : 1;
    // Stability & control modifiers
    const stabilityFactor = region.stability / 100;
    const controlFactor = region.control / 100;
    // Efficiency (level multiplier)
    const levelFactor = ind.level / 5;
    // Damage reduces output
    const damageFactor = 1 - ind.damage / 100;

    const actualOutput = Math.round(
      template.baseOutputPerLevel *
      ind.level *
      workforceRatio *
      inputRatio *
      disasterPenalty *
      stabilityFactor *
      controlFactor *
      levelFactor *
      damageFactor
    );

    produced[template.output] = (produced[template.output] ?? 0) + actualOutput;
    market.supply[template.output] = (market.supply[template.output] ?? 0) + actualOutput;

    // Profitability
    const revenue = actualOutput * (market.prices[template.output] ?? BASE_PRICES[template.output]);
    const inputCost = Object.entries(template.inputs).reduce(
      (sum, [good, amt]) => sum + amt * ind.level * (market.prices[good as GoodId] ?? BASE_PRICES[good as GoodId]),
      0
    );
    ind.profitability = Math.round((revenue - inputCost) / 100); // normalized

    results.push({
      industryId: ind.id,
      actualOutput,
      workforceGap: ind.workforceRequired - workforceAvailable,
      inputShortage
    });
  }

  return { produced, consumed, results };
}

/**
 * Run inter-regional trade: send goods from high-supply to low-supply regions.
 * Returns aggregate transport loss.
 */
export function runTrade(
  state: GameState,
  markets: Record<RegionId, MarketState>
): { totalTransported: number; totalLoss: number } {
  let totalTransported = 0;
  let totalLoss = 0;

  for (const region of Object.values(state.regions)) {
    const market = markets[region.id];
    if (!market) continue;

    for (const neighborId of region.connections ?? []) {
      const neighborMarket = markets[neighborId];
      if (!neighborMarket) continue;

      for (const good of Object.keys(BASE_PRICES) as GoodId[]) {
        const surplus = market.supply[good] - market.demand[good];
        const deficit = neighborMarket.demand[good] - neighborMarket.supply[good];
        if (surplus > 100 && deficit > 100) {
          const moved = Math.min(surplus * 0.1, deficit * 0.1);
          const loss = Math.round(moved * 0.1); // 10% transport loss per hop
          const movedAfterLoss = moved - loss;
          market.supply[good] -= moved;
          market.exports[good] += moved;
          neighborMarket.supply[good] += movedAfterLoss;
          neighborMarket.imports[good] += movedAfterLoss;
          totalTransported += movedAfterLoss;
          totalLoss += loss;
        }
      }
    }
  }

  return { totalTransported, totalLoss };
}

/**
 * Update market prices based on supply/demand after production and trade.
 */
export function updateMarketPrices(markets: Record<RegionId, MarketState>): void {
  for (const market of Object.values(markets)) {
    for (const good of Object.keys(BASE_PRICES) as GoodId[]) {
      const oldPrice = market.prices[good];
      const newPrice = adjustPrice(oldPrice, market.supply[good], market.demand[good]);
      market.prices[good] = newPrice;
    }
  }
}

/**
 * Initialize industries for a region based on terrain.
 */
export function initializeIndustries(regionId: RegionId, terrain: string, agriculture: number, commerce: number): IndustryState[] {
  const industries: IndustryState[] = [];
  // Every region has some farmland
  industries.push({
    id: `${regionId}-farmland-1`,
    regionId,
    type: "farmland",
    level: Math.max(1, Math.round(agriculture / 20)),
    ownership: "gentry",
    workforceRequired: 50 * Math.max(1, Math.round(agriculture / 20)),
    workforceEmployed: 0,
    inputs: {},
    outputs: { grain: 100 },
    efficiency: 50,
    damage: 0,
    profitability: 0
  });
  // Coastal/coast → port
  if (terrain === "coast" || terrain === "river") {
    industries.push({
      id: `${regionId}-port-1`,
      regionId,
      type: "port",
      level: Math.max(1, Math.round(commerce / 20)),
      ownership: "state",
      workforceRequired: 30,
      workforceEmployed: 0,
      inputs: {},
      outputs: { silver: 20 },
      efficiency: 50,
      damage: 0,
      profitability: 0
    });
  }
  // High-commerce → market town
  if (commerce > 50) {
    industries.push({
      id: `${regionId}-market-1`,
      regionId,
      type: "marketTown",
      level: 1,
      ownership: "merchant",
      workforceRequired: 15,
      workforceEmployed: 0,
      inputs: { grain: 5 },
      outputs: { cloth: 10 },
      efficiency: 50,
      damage: 0,
      profitability: 0
    });
  }
  // Mountain → mine
  if (terrain === "mountain") {
    industries.push({
      id: `${regionId}-mine-1`,
      regionId,
      type: "mine",
      level: 1,
      ownership: "state",
      workforceRequired: 40,
      workforceEmployed: 0,
      inputs: {},
      outputs: { iron: 15 },
      efficiency: 50,
      damage: 0,
      profitability: 0
    });
  }
  return industries;
}

/**
 * Auto-investment: if industry has high profitability and region has silver,
 * upgrade industry level.
 */
export function autoInvest(markets: Record<RegionId, MarketState>, industries: Record<RegionId, IndustryState[]>): void {
  for (const [regionId, market] of Object.entries(markets)) {
    const regionIndustries = industries[regionId];
    if (!regionIndustries) continue;
    // Find most profitable industry
    const sorted = [...regionIndustries].sort((a, b) => b.profitability - a.profitability);
    const top = sorted[0];
    if (!top || top.profitability < 50) continue;
    // Check silver availability
    const upgradeCost = 100 * (top.level + 1);
    if (market.silverStock >= upgradeCost) {
      top.level += 1;
      market.silverStock -= upgradeCost;
    }
  }
}

/**
 * Aggregate total goods produced/consumed across all regions for batch summary.
 */
export function summarizeMarkets(markets: Record<RegionId, MarketState>): {
  totalSilver: number;
  totalSupply: number;
  highestPriceGood: { good: GoodId; price: number } | null;
  lowestPriceGood: { good: GoodId; price: number } | null;
} {
  let totalSilver = 0;
  let totalSupply = 0;
  let highestPrice = 0;
  let lowestPrice = Infinity;
  let highestGood: GoodId | null = null;
  let lowestGood: GoodId | null = null;

  for (const market of Object.values(markets)) {
    totalSilver += market.silverStock;
    for (const good of Object.keys(BASE_PRICES) as GoodId[]) {
      totalSupply += market.supply[good];
      const price = market.prices[good];
      if (price > highestPrice) {
        highestPrice = price;
        highestGood = good;
      }
      if (price < lowestPrice) {
        lowestPrice = price;
        lowestGood = good;
      }
    }
  }

  return {
    totalSilver,
    totalSupply,
    highestPriceGood: highestGood ? { good: highestGood, price: highestPrice } : null,
    lowestPriceGood: lowestGood ? { good: lowestGood, price: lowestPrice } : null
  };
}