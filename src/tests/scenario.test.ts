import { describe, expect, it } from "vitest";
import { createMvpScenario } from "../data/scenarios";

describe("MVP scenario", () => {
  it("creates a playable Ming core and Northeast Asia scenario", () => {
    const state = createMvpScenario("ming", 42);
    const historicalMingRegions = [
      "beizhili",
      "nanzhili",
      "shandong",
      "shanxi",
      "henan",
      "shaanxi",
      "zhejiang",
      "jiangxi",
      "huguang",
      "sichuan",
      "fujian",
      "guangdong",
      "guangxi",
      "yunnan",
      "guizhou"
    ];
    expect(Object.keys(state.regions)).toHaveLength(31);
    for (const regionId of historicalMingRegions) {
      expect(state.regions[regionId]?.controllerFactionId, regionId).toBe("ming");
    }
    expect(state.factions.ming.status).toBe("active");
    expect(state.factions.ming.capitalRegionId).toBe("beizhili");
    expect(state.currentDate).toBe("1573-01");
    expect(state.endDate).toBe("1662-12"); // S6：延伸至康熙元年，覆盖完整主线
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

  it("initializes cliques for all factions including rebels", () => {
    const state = createMvpScenario();
    for (const faction of Object.values(state.factions)) {
      expect(faction.cliques, `${faction.id} cliques`).toBeDefined();
      expect(faction.cliques.length, `${faction.id} clique count`).toBe(5);
      expect(faction.administrationBase, `${faction.id} adminBase`).toBeGreaterThan(0);
    }
    expect(state.version).toBe("0.3.0");
  });
});
