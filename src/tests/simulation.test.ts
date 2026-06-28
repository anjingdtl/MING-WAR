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
});
