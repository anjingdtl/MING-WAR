import { describe, expect, it } from "vitest";
import { calculateRegionEconomy, calculateFactionMaintenance } from "../core/economy";
import { calculatePopulation } from "../core/population";
import { createMvpScenario } from "../data/scenarios";

describe("population", () => {
  it("grows stable regions and harms starving regions", () => {
    const state = createMvpScenario();
    const nanzhili = state.regions.nanzhili;
    expect(calculatePopulation(nanzhili, "recovery").nextPopulation).toBeGreaterThan(nanzhili.population);

    const starving = { ...nanzhili, grainStock: 1, stability: 35 };
    expect(calculatePopulation(starving, "finance").nextPopulation).toBeLessThan(starving.population);
  });
});

describe("economy", () => {
  it("collects taxes and computes a grain delta without mutating stock", () => {
    const state = createMvpScenario();
    const result = calculateRegionEconomy(state.regions.nanzhili, state.factions.ming, "finance");
    expect(result.taxCollected).toBeGreaterThan(0);
    expect(result.grainProduced).toBeGreaterThan(0);
    // S1c: economy no longer mutates grainStock — the ledger applies it.
    expect(result.region.grainStock).toBe(state.regions.nanzhili.grainStock);
  });

  it("charges military and bureaucracy maintenance", () => {
    const state = createMvpScenario();
    const maintenance = calculateFactionMaintenance(state.factions.ming);
    expect(maintenance.treasuryCost).toBeGreaterThan(0);
    expect(maintenance.grainCost).toBeGreaterThan(0);
  });
});
