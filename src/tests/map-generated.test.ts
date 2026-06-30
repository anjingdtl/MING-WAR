import { describe, expect, it } from "vitest";
import { regionTemplates } from "../data/regions";
import { mapTiles as generatedMapTiles } from "../map/generated/mapTiles";
import { mapCanvas } from "../map/mapCanvas";
import { playableMapRegions, contextMapTiles, mapTiles } from "../map/mapConfig";

function numericValues(paths: string[]): number[] {
  return paths.flatMap((path) => [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])));
}

describe("generated map tile facade", () => {
  it("re-exports generated map tiles through mapConfig", () => {
    expect(mapTiles).toBe(generatedMapTiles);
  });

  it("keeps playable map regions and simulation regions in sync", () => {
    const playableIds = playableMapRegions.map((tile) => tile.id).sort();
    const dataIds = Object.keys(regionTemplates).sort();
    expect(playableIds).toEqual(dataIds);
  });

  it("ensures context tiles never leak into simulation data", () => {
    const dataIds = new Set(Object.keys(regionTemplates));
    for (const tile of contextMapTiles) {
      expect(dataIds.has(tile.id), `${tile.id} should not be in regionTemplates`).toBe(false);
      expect(tile.isPlayableRegion, `${tile.id} should be context`).toBe(false);
    }
  });

  it("keeps every label inside the map viewBox", () => {
    for (const tile of mapTiles) {
      expect(tile.labelX, `${tile.id} labelX`).toBeGreaterThanOrEqual(0);
      expect(tile.labelX, `${tile.id} labelX`).toBeLessThanOrEqual(mapCanvas.width);
      expect(tile.labelY, `${tile.id} labelY`).toBeGreaterThanOrEqual(0);
      expect(tile.labelY, `${tile.id} labelY`).toBeLessThanOrEqual(mapCanvas.height);
    }
  });

  it("keeps every generated path numerically bounded", () => {
    for (const tile of mapTiles) {
      const values = numericValues(tile.paths);
      expect(values.length, `${tile.id} numeric path values`).toBeGreaterThanOrEqual(4);
      expect(values.every(Number.isFinite), `${tile.id} finite path values`).toBe(true);
    }
  });

  it("marks all two-capital thirteen provinces as playable core tiles", () => {
    const mingCore = [
      "beizhili", "nanzhili", "shandong", "shanxi", "henan", "shaanxi",
      "zhejiang", "jiangxi", "huguang", "sichuan", "fujian",
      "guangdong", "guangxi", "yunnan", "guizhou"
    ];
    for (const id of mingCore) {
      const tile = mapTiles.find((t) => t.id === id);
      expect(tile, `${id} should exist`).toBeDefined();
      expect(tile?.isPlayableRegion, `${id} playable`).toBe(true);
      expect(tile?.kind, `${id} kind`).toBe("core-province");
    }
  });

  it("marks frontier and neighbor regions as playable", () => {
    const playable = ["liaodong", "bozhou", "jianzhou", "haixi", "chahar_steppe", "joseon_north", "japan_west"];
    for (const id of playable) {
      const tile = mapTiles.find((t) => t.id === id);
      expect(tile?.isPlayableRegion, `${id} playable`).toBe(true);
    }
  });
});
