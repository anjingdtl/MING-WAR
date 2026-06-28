import { describe, expect, it } from "vitest";
import { calculateRegionEconomy, calculateFactionMaintenance } from "../core/economy";
import { calculatePopulation } from "../core/population";
import { createMvpScenario } from "../data/scenarios";

describe("population", () => {
  it("grows stable regions and harms starving regions", () => {
    const state = createMvpScenario();
    const jiangnan = state.regions.jiangnan;
    expect(calculatePopulation(jiangnan, "recovery").nextPopulation).toBeGreaterThan(jiangnan.population);

    const starving = { ...jiangnan, grainStock: 1, stability: 35 };
    expect(calculatePopulation(starving, "finance").nextPopulation).toBeLessThan(starving.population);
  });
});

describe("economy", () => {
  it("collects taxes and updates grain stock", () => {
    const state = createMvpScenario();
    const result = calculateRegionEconomy(state.regions.jiangnan, state.factions.ming, "finance");
    expect(result.taxCollected).toBeGreaterThan(0);
    expect(result.region.grainStock).not.toBe(state.regions.jiangnan.grainStock);
  });

  it("charges military and bureaucracy maintenance", () => {
    const state = createMvpScenario();
    const maintenance = calculateFactionMaintenance(state.factions.ming);
    expect(maintenance.treasuryCost).toBeGreaterThan(0);
    expect(maintenance.grainCost).toBeGreaterThan(0);
  });
});
