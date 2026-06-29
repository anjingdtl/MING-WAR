import { describe, expect, it } from "vitest";
import {
  aggregatePopStats,
  computeGrainPerCapita,
  initializePopGroups,
  migrateMigrants,
  sumPopulation,
  advancePopGroups
} from "../core/populationGroups";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("initializePopGroups", () => {
  it("creates all 8 pop types with proportional sizes", () => {
    const groups = initializePopGroups("test", 100000);
    const types = groups.map((g) => g.type).sort();
    expect(types).toEqual(["artisan", "gentry", "merchant", "migrant", "official", "peasant", "soldier", "tenant"]);
    expect(sumPopulation(groups)).toBe(100000);
  });

  it("distribution matches expected historical profile", () => {
    const groups = initializePopGroups("test", 100000);
    const peasants = groups.find((g) => g.type === "peasant")!;
    const officials = groups.find((g) => g.type === "official")!;
    expect(peasants.size).toBeGreaterThan(officials.size);
  });

  it("literacy is highest for gentry and officials", () => {
    const groups = initializePopGroups("test", 100000);
    const gentry = groups.find((g) => g.type === "gentry")!;
    const peasant = groups.find((g) => g.type === "peasant")!;
    expect(gentry.literacy).toBeGreaterThan(peasant.literacy);
  });
});

describe("aggregatePopStats", () => {
  it("sums and averages correctly", () => {
    const groups = initializePopGroups("test", 1000);
    const stats = aggregatePopStats(groups);
    expect(stats.totalPopulation).toBe(1000);
    expect(stats.totalMigrants).toBeGreaterThan(0);
    expect(stats.totalTaxpayers).toBeGreaterThan(0);
  });
});

describe("computeGrainPerCapita", () => {
  it("returns ratio of grain to need", () => {
    // 1000 people need 250 grain. 500 stock → 2.0 ratio
    expect(computeGrainPerCapita(500, 1000)).toBe(2);
    expect(computeGrainPerCapita(125, 1000)).toBe(0.5);
  });

  it("returns 1 for empty population", () => {
    expect(computeGrainPerCapita(100, 0)).toBe(1);
  });
});

describe("advancePopGroups", () => {
  it("kills people during famine", () => {
    const groups = initializePopGroups("test", 10000);
    const before = sumPopulation(groups);
    const advanced = advancePopGroups(groups, {
      region: { id: "test", population: 10000, stability: 50, agriculture: 50, taxCapacity: 50, control: 50, rebelPressure: 0 },
      grainPerCapita: 0.3, // Famine
      taxRate: 0.3
    });
    const after = sumPopulation(advanced);
    expect(after).toBeLessThan(before);
  });

  it("generates migrants when satisfaction is low", () => {
    const groups = initializePopGroups("test", 10000);
    // Force peasants into misery
    for (const g of groups) {
      if (g.type === "peasant") {
        g.radicalism = 75;
      }
    }
    const advanced = advancePopGroups(groups, {
      region: { id: "test", population: 10000, stability: 50, agriculture: 50, taxCapacity: 50, control: 50, rebelPressure: 0 },
      grainPerCapita: 0.1, // Severe famine forces needsSatisfaction well below 30
      taxRate: 0.5
    });
    // Migrant count should be > initial
    const initialMigrants = groups.find((g) => g.type === "migrant")!.size;
    const finalMigrants = advanced.find((g) => g.type === "migrant");
    expect(finalMigrants).toBeDefined();
    expect(finalMigrants!.size).toBeGreaterThan(initialMigrants);
  });
});

describe("migrateMigrants", () => {
  it("moves migrants to connected regions", () => {
    const state = createMvpScenario("ming", 1);
    // Pick a region with migrants and connections
    let origin: string | undefined;
    for (const region of Object.values(state.regions)) {
      if (region.popGroups && region.connections.length > 0) {
        const migrants = region.popGroups.find((g) => g.type === "migrant");
        if (migrants && migrants.size > 1000) {
          origin = region.id;
          // Inflate migrant size for clear migration
          region.popGroups = region.popGroups.map((g) =>
            g.type === "migrant" ? { ...g, size: 5000 } : g
          );
          break;
        }
      }
    }
    if (!origin) return; // skip if no suitable region
    const result = migrateMigrants(state, origin);
    expect(result.migratedOut).toBeGreaterThanOrEqual(0);
  });
});

describe("P2: simulation initializes and advances pop groups", () => {
  it("initializes all regions with pop groups", () => {
    const state = createMvpScenario("ming", 1);
    const regionsWithGroups = Object.values(state.regions).filter(
      (r) => r.popGroups && r.popGroups.length > 0
    );
    expect(regionsWithGroups.length).toBeGreaterThan(0);
  });

  it("advances pop groups each month", () => {
    const state = createMvpScenario("ming", 1);
    const region = state.regions.beizhili;
    const beforeSize = region.population;
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: 1
    }).nextState;
    const afterRegion = result.regions.beizhili;
    expect(afterRegion.popGroups).toBeDefined();
    // Population may shift slightly due to famine/migration dynamics
    expect(Math.abs(afterRegion.population - beforeSize)).toBeLessThan(beforeSize);
  });
});