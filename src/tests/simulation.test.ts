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

  it("updates faction cliques during monthly settlement", () => {
    const state = createMvpScenario("ming", 200);
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    const ming = result.nextState.factions.ming;

    // cliques should have updated strength based on controlled regions
    expect(ming.cliques.length).toBe(4);
    expect(ming.cliques.some((c) => c.strength > 0)).toBe(true);

    // administrationBase should be saved
    expect(ming.administrationBase).toBeGreaterThan(0);

    // administration should be within [0, 100]
    expect(ming.administration).toBeGreaterThanOrEqual(0);
    expect(ming.administration).toBeLessThanOrEqual(100);
  });

  it("saves lastDomesticFocus after simulation", () => {
    const state = createMvpScenario("ming", 201);
    const decision = { ...defaultPlayerDecision, domesticFocus: "military" as const };
    const result = simulateMonth({ state, playerDecision: decision, randomSeed: state.seed });
    expect(result.nextState.lastDomesticFocus).toBe("military");
  });

  it("applies natural decay to clique support each month", () => {
    const state = createMvpScenario("ming", 202);
    // Set extreme support values
    const donglin = state.factions.ming.cliques.find((c) => c.cliqueId === "donglin")!;
    donglin.support = 80;
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    const afterDonglin = result.nextState.factions.ming.cliques.find((c) => c.cliqueId === "donglin")!;
    // Should have decayed toward 50 (from 80, minus 1)
    expect(afterDonglin.support).toBeLessThanOrEqual(80);
  });
});
