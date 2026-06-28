import { describe, expect, it } from "vitest";
import { createMvpScenario } from "../data/scenarios";

describe("MVP scenario", () => {
  it("creates a playable 13-region scenario", () => {
    const state = createMvpScenario("ming", 42);
    expect(Object.keys(state.regions)).toHaveLength(13);
    expect(state.factions.ming.status).toBe("active");
    expect(state.regions.beijing.controllerFactionId).toBe("ming");
    expect(state.currentDate).toBe("1573-01");
    expect(state.endDate).toBe("1621-12");
  });

  it("keeps every connection pointed at an existing region", () => {
    const state = createMvpScenario();
    const ids = new Set(Object.keys(state.regions));
    for (const region of Object.values(state.regions)) {
      for (const connection of region.connections) {
        expect(ids.has(connection), `${region.id} -> ${connection}`).toBe(true);
      }
    }
  });
});
