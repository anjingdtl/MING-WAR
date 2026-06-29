import { describe, expect, it } from "vitest";
import { updateControl } from "../core/control";
import { calculateRebellionRisk, updateRebellion } from "../core/rebellion";
import { createRandom } from "../core/random";
import { resolveBattle } from "../core/warfare";
import { createMvpScenario } from "../data/scenarios";

describe("warfare", () => {
  it("resolves a battle without negative armies", () => {
    const state = createMvpScenario();
    const result = resolveBattle(
      state.regions.liaodong,
      state.factions.jianzhou,
      state.factions.ming,
      "aggressive",
      createRandom(9)
    );
    expect(result.attacker.armyTotal).toBeGreaterThanOrEqual(0);
    expect(result.defender.armyTotal).toBeGreaterThanOrEqual(0);
    expect(result.report).toContain("辽东");
  });
});

describe("control", () => {
  it("raises control for legitimate core holders", () => {
    const state = createMvpScenario();
    const before = state.regions.beizhili.control;
    const after = updateControl(state.regions.beizhili, state.factions.ming);
    expect(after.control).toBeGreaterThanOrEqual(before);
  });
});

describe("rebellion", () => {
  it("increases rebellion risk under hunger and low stability", () => {
    const state = createMvpScenario();
    const region = { ...state.regions.shaanxi, grainStock: 1, stability: 30, control: 40 };
    expect(calculateRebellionRisk(region, state.factions.ming)).toBeGreaterThan(50);
    expect(updateRebellion({ ...region, rebelPressure: 74 }, state.factions.ming).erupted).toBe(true);
  });
});
