import { describe, expect, it } from "vitest";
import { regionTemplates } from "../data/regions";
import { mapRegions as generatedMapRegions } from "../map/generated/mapRegions";
import { mapCanvas } from "../map/mapCanvas";
import { mapRegions } from "../map/mapConfig";

function numericValues(paths: string[]): number[] {
  return paths.flatMap((path) => [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])));
}

describe("generated map facade", () => {
  it("re-exports generated map regions through mapConfig", () => {
    expect(mapRegions).toBe(generatedMapRegions);
  });

  it("keeps map regions and simulation regions in sync", () => {
    const mapIds = mapRegions.map((region) => region.id).sort();
    const dataIds = Object.keys(regionTemplates).sort();
    expect(mapIds).toEqual(dataIds);
  });

  it("keeps every label inside the map viewBox", () => {
    for (const region of mapRegions) {
      expect(region.labelX, `${region.id} labelX`).toBeGreaterThanOrEqual(0);
      expect(region.labelX, `${region.id} labelX`).toBeLessThanOrEqual(mapCanvas.width);
      expect(region.labelY, `${region.id} labelY`).toBeGreaterThanOrEqual(0);
      expect(region.labelY, `${region.id} labelY`).toBeLessThanOrEqual(mapCanvas.height);
    }
  });

  it("keeps every generated path numerically bounded", () => {
    for (const region of mapRegions) {
      const values = numericValues(region.paths);
      expect(values.length, `${region.id} numeric path values`).toBeGreaterThanOrEqual(4);
      expect(values.every(Number.isFinite), `${region.id} finite path values`).toBe(true);
    }
  });
});
