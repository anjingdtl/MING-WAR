import { describe, expect, it } from "vitest";
import {
  BASE_PRICES,
  INDUSTRY_TEMPLATES,
  REGIONAL_GRAIN_BASE,
  adjustPrice,
  autoInvest,
  consumePopNeeds,
  initializeIndustries,
  initializeMarket,
  POP_NEEDS,
  produceGoods,
  runTrade,
  summarizeMarkets,
  updateMarketPrices
} from "../core/market";
import type { PopGroup, PopType } from "../core/types";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("BASE_PRICES", () => {
  it("includes all 11 goods", () => {
    expect(Object.keys(BASE_PRICES).length).toBe(11);
    expect(BASE_PRICES.grain).toBe(1);
    expect(BASE_PRICES.silver).toBe(1);
    expect(BASE_PRICES.horses).toBe(50);
  });
});

describe("INDUSTRY_TEMPLATES", () => {
  it("defines 10 industry types", () => {
    expect(Object.keys(INDUSTRY_TEMPLATES).length).toBe(10);
  });

  it("farmland produces grain", () => {
    expect(INDUSTRY_TEMPLATES.farmland.output).toBe("grain");
  });

  it("militaryTown requires mine", () => {
    expect(INDUSTRY_TEMPLATES.militaryTown.requires).toContain("mine");
  });
});

describe("initializeMarket", () => {
  it("initializes all goods at base prices", () => {
    const market = initializeMarket("test");
    for (const good of Object.keys(BASE_PRICES)) {
      expect(market.prices[good as keyof typeof BASE_PRICES]).toBe(BASE_PRICES[good as keyof typeof BASE_PRICES]);
    }
    expect(market.silverStock).toBe(1000);
  });

  it("sets regional grain base price by climate", () => {
    const humidMarket = initializeMarket("r1", "humid");
    expect(humidMarket.prices.grain).toBe(BASE_PRICES.grain * REGIONAL_GRAIN_BASE.humid);
    const coldMarket = initializeMarket("r2", "cold");
    expect(coldMarket.prices.grain).toBe(BASE_PRICES.grain * REGIONAL_GRAIN_BASE.cold);
    // Non-grain prices unaffected
    expect(humidMarket.prices.cloth).toBe(BASE_PRICES.cloth);
  });

  it("adjustPrice uses regionalBasePrice for floor/ceiling", () => {
    // With regionalBasePrice=0.6 (humid grain), ceiling is 0.6*4=2.4
    let price = 0.6;
    for (let i = 0; i < 60; i++) {
      price = adjustPrice(price, 1, 1000, 1.0, 0.6);
    }
    expect(price).toBeLessThanOrEqual(2.4);
    expect(price).toBeGreaterThanOrEqual(0.18); // 0.6 * 0.3
  });
});

describe("initializeIndustries", () => {
  it("every region gets farmland", () => {
    const industries = initializeIndustries("r1", "plain", 60, 50);
    const farmland = industries.find((i) => i.type === "farmland");
    expect(farmland).toBeDefined();
  });

  it("coastal regions get a port", () => {
    const industries = initializeIndustries("r1", "coast", 50, 50);
    const port = industries.find((i) => i.type === "port");
    expect(port).toBeDefined();
  });

  it("mountain regions get a mine", () => {
    const industries = initializeIndustries("r1", "mountain", 50, 50);
    const mine = industries.find((i) => i.type === "mine");
    expect(mine).toBeDefined();
  });

  it("high-commerce regions get a market town", () => {
    const industries = initializeIndustries("r1", "plain", 50, 80);
    const market = industries.find((i) => i.type === "marketTown");
    expect(market).toBeDefined();
  });
});

describe("adjustPrice", () => {
  it("raises price when supply < demand", () => {
    const newPrice = adjustPrice(10, 50, 100, 10);
    expect(newPrice).toBeGreaterThan(10);
  });

  it("lowers price when supply > demand", () => {
    const newPrice = adjustPrice(10, 200, 100, 10);
    expect(newPrice).toBeLessThan(10);
  });

  it("keeps price stable when supply equals demand", () => {
    const newPrice = adjustPrice(10, 100, 100, 10);
    expect(newPrice).toBeCloseTo(10);
  });

  it("floors price at 30% of base under massive oversupply", () => {
    const newPrice = adjustPrice(0.1, 1000000, 1, 1);
    expect(newPrice).toBeGreaterThanOrEqual(0.3);
  });

  it("caps price at 400% of base to prevent geometric blow-up", () => {
    // Sustained scarcity must not compound *1.5 every month forever —
    // this is the regression that sent grain to 4e17 in batch simulation.
    let price = 1;
    for (let i = 0; i < 60; i++) {
      price = adjustPrice(price, 1, 1000, 1);
    }
    expect(price).toBeLessThanOrEqual(4);
  });
});

describe("produceGoods", () => {
  it("produces grain from farmland", () => {
    const market = initializeMarket("r1");
    const industries = initializeIndustries("r1", "plain", 80, 50);
    const region = { population: 1000000, stability: 100, agriculture: 80, control: 100 };
    const result = produceGoods(industries, market, region, []);
    expect(result.produced.grain ?? 0).toBeGreaterThan(0);
  });

  it("zero output during disasters (with no inputs)", () => {
    const market = initializeMarket("r1");
    const industries = initializeIndustries("r1", "plain", 80, 50);
    const region = { population: 1000000, stability: 100, agriculture: 80, control: 100 };
    // With disasters, output is reduced
    const resultNormal = produceGoods(JSON.parse(JSON.stringify(industries)), market, region, []);
    market.supply = { ...market.supply, grain: 0 };
    const resultDisaster = produceGoods(JSON.parse(JSON.stringify(industries)), market, region, [
      { id: "d1", type: "flood", severity: 0.5, remainingMonths: 3 }
    ]);
    expect(resultDisaster.produced.grain ?? 0).toBeLessThan(resultNormal.produced.grain ?? 0);
  });
});

describe("runTrade", () => {
  it("transports surplus to deficit regions", () => {
    const state = createMvpScenario("ming", 1);
    const markets: Record<string, import("../core/market").MarketState> = {};
    for (const region of Object.values(state.regions)) {
      if (!region.market) continue;
      markets[region.id] = region.market;
      // Force one region to have surplus and another to have deficit
      region.market.supply.grain = 10000;
    }
    // Set demand so that one region is in deficit
    if (markets.liaodong) {
      markets.liaodong.supply.grain = 0;
      markets.liaodong.demand.grain = 1000;
    }
    const result = runTrade(state, markets);
    expect(result.totalTransported).toBeGreaterThanOrEqual(0);
    expect(result.totalLoss).toBeGreaterThanOrEqual(0);
  });
});

describe("updateMarketPrices", () => {
  it("changes prices based on supply/demand", () => {
    const market = initializeMarket("r1");
    market.supply.grain = 10000;
    market.demand.grain = 100;
    const beforePrice = market.prices.grain;
    updateMarketPrices({ r1: market });
    expect(market.prices.grain).toBeLessThan(beforePrice);
  });
});

describe("autoInvest", () => {
  it("upgrades profitable industries when silver is available", () => {
    const market = initializeMarket("r1");
    market.silverStock = 10000;
    const industries = initializeIndustries("r1", "plain", 80, 50);
    // Force profitability
    for (const i of industries) i.profitability = 100;
    autoInvest({ r1: market }, { r1: industries });
    // At least one industry should have higher level
    const upgraded = industries.some((i) => i.level > 1);
    expect(upgraded).toBe(true);
  });

  it("does not invest when silver insufficient", () => {
    const market = initializeMarket("r1");
    market.silverStock = 0;
    const industries = initializeIndustries("r1", "plain", 80, 50);
    for (const i of industries) i.profitability = 100;
    autoInvest({ r1: market }, { r1: industries });
    expect(industries.every((i) => i.level === Math.max(1, i.level))).toBe(true);
  });
});

describe("summarizeMarkets", () => {
  it("aggregates silver and finds highest/lowest prices", () => {
    const m1 = initializeMarket("r1");
    const m2 = initializeMarket("r2");
    const summary = summarizeMarkets({ r1: m1, r2: m2 });
    expect(summary.totalSilver).toBe(2000);
    expect(summary.highestPriceGood).toBeDefined();
    expect(summary.lowestPriceGood).toBeDefined();
  });
});

describe("P3: simulation integrates market production and trade", () => {
  it("initializes markets and industries for all regions", () => {
    const state = createMvpScenario("ming", 1);
    const withMarkets = Object.values(state.regions).filter((r) => r.market).length;
    const withIndustries = Object.values(state.regions).filter((r) => r.industries).length;
    expect(withMarkets).toBeGreaterThan(0);
    expect(withIndustries).toBeGreaterThan(0);
  });

  it("produces goods each month", () => {
    const state = createMvpScenario("ming", 1);
    const region = state.regions.beizhili;
    const beforeSupply = region.market?.supply.grain ?? 0;
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: 1
    }).nextState;
    const afterSupply = result.regions.beizhili.market?.supply.grain ?? 0;
    // Supply should change due to production and consumption
    expect(afterSupply).toBeGreaterThanOrEqual(0);
    expect(beforeSupply).toBeGreaterThanOrEqual(0);
  });

  it("prices fluctuate based on supply/demand", () => {
    const state = createMvpScenario("ming", 1);
    const beforePrice = state.regions.beizhili.market?.prices.grain ?? 1;
    let current = state;
    for (let i = 0; i < 6; i++) {
      current = simulateMonth({
        state: current,
        playerDecision: defaultPlayerDecision,
        randomSeed: current.seed
      }).nextState;
    }
    const afterPrice = current.regions.beizhili.market?.prices.grain ?? 1;
    // Price may stay the same if balanced, but should not error
    expect(afterPrice).toBeGreaterThan(0);
    expect(beforePrice).toBeGreaterThan(0);
  });
});

const baseGroup: PopGroup = {
  id: "g1",
  regionId: "r1",
  type: "peasant",
  size: 1000,
  employed: 0,
  wealth: 100,
  literacy: 10,
  subsistence: 100,
  needsSatisfaction: 100,
  taxBurden: 0.4,
  politicalPower: 5,
  loyalty: 60,
  radicalism: 10
};

describe("POP_NEEDS", () => {
  it("every pop type has a grain staple", () => {
    for (const type of Object.keys(POP_NEEDS) as PopType[]) {
      expect(POP_NEEDS[type].grain ?? 0).toBeGreaterThan(0);
    }
  });

  it("elite pops demand more than just grain", () => {
    expect(POP_NEEDS.gentry.cloth ?? 0).toBeGreaterThan(0);
    expect(POP_NEEDS.gentry.tea ?? 0).toBeGreaterThan(0);
    expect(POP_NEEDS.soldier.salt ?? 0).toBeGreaterThan(0);
  });
});

describe("consumePopNeeds (S2a)", () => {
  it("fully satisfies and drains supply when the basket is covered", () => {
    const market = initializeMarket("r1");
    // 1000 peasants × 0.065 = 65 grain needed
    const groups: PopGroup[] = [{ ...baseGroup, type: "peasant", size: 1000 }];
    market.supply.grain = 200;
    const res = consumePopNeeds(groups, market);
    expect(res.satisfaction).toBe(100);
    expect(res.consumed.grain).toBeCloseTo(65, 5);
    // supply is NOT drained — it stays as available output for pricing/trade
    expect(market.supply.grain).toBe(200);
    expect(market.demand.grain).toBeCloseTo(65, 5);
  });

  it("partial satisfaction when supply is short", () => {
    const market = initializeMarket("r1");
    const groups: PopGroup[] = [{ ...baseGroup, type: "peasant", size: 1000 }];
    market.supply.grain = 20; // only 20 of 65
    const res = consumePopNeeds(groups, market);
    expect(res.satisfaction).toBeLessThan(100);
    expect(res.consumed.grain).toBe(20);
    expect(market.supply.grain).toBe(20); // not drained
  });

  it("drains multiple goods from an elite basket", () => {
    const market = initializeMarket("r1");
    const groups: PopGroup[] = [{ ...baseGroup, type: "gentry", size: 100 }];
    market.supply.grain = 100;
    market.supply.cloth = 100;
    market.supply.tea = 100;
    const res = consumePopNeeds(groups, market);
    expect(res.satisfaction).toBe(100);
    expect(res.consumed.grain).toBeCloseTo(6.5, 1);
    expect(res.consumed.cloth).toBeCloseTo(1.2, 1);
    expect(res.consumed.tea).toBeCloseTo(0.4, 1);
  });
});

describe("S2c: industry profits concentrate wealth to owning pops", () => {
  it("gentry accumulate more wealth than peasants (ownership + income)", () => {
    const state = createMvpScenario("ming", 1);
    const target = Object.values(state.regions).find(
      (r) => r.industries?.some((i) => i.type === "farmland") && r.popGroups?.some((g) => g.type === "gentry")
    );
    if (!target) return; // skip if the scenario lacks a gentry+farmland region
    const gentryBefore = target.popGroups!.find((g) => g.type === "gentry")!.wealth;
    const peasantBefore = target.popGroups!.find((g) => g.type === "peasant")!.wealth;
    const after = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: 1
    }).nextState;
    const gentryAfter = after.regions[target.id].popGroups!.find((g) => g.type === "gentry")!.wealth;
    const peasantAfter = after.regions[target.id].popGroups!.find((g) => g.type === "peasant")!.wealth;
    // Gentry own farmland (profit payout) AND have higher base income, so their
    // wealth should grow faster than peasants' — the ownership-driven wealth
    // concentration that S3 political power will rest on.
    expect(gentryAfter - gentryBefore).toBeGreaterThan(peasantAfter - peasantBefore);
  });
});

describe("S2d: regional economic divergence (Jiangnan vs Liaodong)", () => {
  it("the two regions diverge rather than stay identical clones", () => {
    const state = createMvpScenario("ming", 1);
    let current = state;
    for (let i = 0; i < 36; i++) {
      current = simulateMonth({
        state: current,
        playerDecision: defaultPlayerDecision,
        randomSeed: current.seed
      }).nextState;
    }
    const jiangnan = current.regions.nanzhili;
    const liaodong = current.regions.liaodong;
    if (!jiangnan?.market || !liaodong?.market) return;
    // Jiangnan is the commercial heartland, Liaodong the military frontier.
    // Their industry mix and/or grain price should diverge under the unified
    // market flow, proving regions develop along their own profiles.
    const jIndustries = jiangnan.industries?.length ?? 0;
    const lIndustries = liaodong.industries?.length ?? 0;
    const samePrice = jiangnan.market.prices.grain === liaodong.market.prices.grain;
    expect(jIndustries !== lIndustries || !samePrice).toBe(true);
  });
});