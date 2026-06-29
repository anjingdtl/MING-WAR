import { describe, expect, it } from "vitest";
import { createMvpScenario } from "../data/scenarios";
import { mapRegionSource } from "../map/source/mapRegionSource";

const northeastAsiaRegionIds = [
  "korchin_steppe",
  "hulunbuir",
  "amur_basin",
  "nurgan_coast",
  "sakhalin",
  "joseon_north",
  "joseon_south",
  "japan_west",
  "japan_east",
  "ezo"
];

describe("Northeast Asia expansion", () => {
  it("adds playable simulation regions across Northeast Asia", () => {
    const state = createMvpScenario();

    expect(Object.keys(state.regions).length).toBeGreaterThanOrEqual(31);
    for (const regionId of northeastAsiaRegionIds) {
      expect(state.regions[regionId], regionId).toBeDefined();
    }
  });

  it("adds matching map shapes for every Northeast Asia region", () => {
    const mapIds = new Set(mapRegionSource.map((region) => region.id));

    for (const regionId of northeastAsiaRegionIds) {
      expect(mapIds.has(regionId), regionId).toBe(true);
    }
  });

  it("connects the expanded frontier into the existing strategic graph", () => {
    const state = createMvpScenario();

    expect(state.regions.liaodong.connections).toEqual(expect.arrayContaining(["korchin_steppe", "joseon_north"]));
    expect(state.regions.joseon_north.connections).toContain("joseon_south");
    expect(state.regions.joseon_south.connections).toContain("japan_west");
    expect(state.regions.haixi.connections).toEqual(expect.arrayContaining(["korchin_steppe", "hulunbuir"]));
    expect(state.regions.jianzhou.connections).toEqual(expect.arrayContaining(["amur_basin", "nurgan_coast"]));
  });

  it("creates active regional factions for the new non-Ming powers", () => {
    const state = createMvpScenario();

    for (const factionId of ["joseon", "japan", "korchin", "nurgan", "ainu"]) {
      expect(state.factions[factionId]?.status, factionId).toBe("active");
      expect(state.regions[state.factions[factionId].capitalRegionId], `${factionId} capital`).toBeDefined();
    }
  });
});
