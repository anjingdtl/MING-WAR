import { describe, expect, it } from "vitest";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("monthly simulation", () => {
  it("advances one month and records history", () => {
    const state = createMvpScenario("ming", 1573);
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed
    });
    expect(result.nextState.currentDate).toBe("1573-02");
    expect(result.nextState.history).toHaveLength(1);
    expect(result.nextState.reports.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same seed and decision", () => {
    const a = createMvpScenario("ming", 42);
    const b = createMvpScenario("ming", 42);
    const first = simulateMonth({ state: a, playerDecision: defaultPlayerDecision, randomSeed: a.seed });
    const second = simulateMonth({ state: b, playerDecision: defaultPlayerDecision, randomSeed: b.seed });
    expect(first.nextState).toEqual(second.nextState);
  });

  it("causes army desertion during grain crisis", () => {
    const state = createMvpScenario("ming", 123);
    state.factions.ming.grainReserve = 0;
    const beforeArmy = state.factions.ming.armyTotal;
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    expect(result.nextState.factions.ming.armyTotal).toBeLessThan(beforeArmy);
    expect(result.reports.some((report) => report.title.includes("粮尽军散"))).toBe(true);
  });

  it("causes mutiny during treasury crisis", () => {
    const state = createMvpScenario("ming", 124);
    state.factions.ming.treasury = 0;
    const beforeArmy = state.factions.ming.armyTotal;
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    expect(result.nextState.factions.ming.armyTotal).toBeLessThan(beforeArmy);
    expect(result.reports.some((report) => report.title.includes("财政破产"))).toBe(true);
  });

  it("hands region to rebels when rebellion collapses control", () => {
    const state = createMvpScenario("ming", 125);
    state.regions.shaanxi.rebelPressure = 90;
    state.regions.shaanxi.control = 12;
    state.regions.shaanxi.garrison = 120000;
    state.regions.shaanxi.fortification = 95;
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    expect(result.nextState.regions.shaanxi.controllerFactionId).toBe("rebels");
    expect(result.reports.some((report) => report.title.includes("民众起义"))).toBe(true);
  });
});
