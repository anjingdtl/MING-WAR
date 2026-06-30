import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mapCanvas } from "../map/mapCanvas";
import { mapTiles } from "../map/mapConfig";
import {
  eastAsiaLandPaths,
  majorLakePaths,
  majorMountainPaths,
  majorRiverPaths,
  terrainRidgePaths
} from "../map/physicalMap";

function numericValues(paths: string[]): number[] {
  return paths.flatMap((path) => [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])));
}

function expectPathsInsideCanvas(paths: string[], label: string) {
  const values = numericValues(paths);
  expect(values.length, `${label} numeric values`).toBeGreaterThan(0);
  for (let index = 0; index < values.length - 1; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    expect(x, `${label} x`).toBeGreaterThanOrEqual(0);
    expect(x, `${label} x`).toBeLessThanOrEqual(mapCanvas.width);
    expect(y, `${label} y`).toBeGreaterThanOrEqual(0);
    expect(y, `${label} y`).toBeLessThanOrEqual(mapCanvas.height);
  }
}

describe("rebuilt geographic map frame", () => {
  it("keeps every physical geography path inside the shared map canvas", () => {
    expectPathsInsideCanvas(eastAsiaLandPaths, "land");
    expectPathsInsideCanvas(majorRiverPaths, "rivers");
    expectPathsInsideCanvas(majorLakePaths, "lakes");
    expectPathsInsideCanvas(majorMountainPaths, "mountains");
    expectPathsInsideCanvas(terrainRidgePaths, "ridges");
  });

  it("keeps every political tile inside the same geographic canvas", () => {
    for (const tile of mapTiles) {
      expectPathsInsideCanvas(tile.paths, tile.id);
      expect(tile.labelX, `${tile.id} labelX`).toBeGreaterThanOrEqual(0);
      expect(tile.labelX, `${tile.id} labelX`).toBeLessThanOrEqual(mapCanvas.width);
      expect(tile.labelY, `${tile.id} labelY`).toBeGreaterThanOrEqual(0);
      expect(tile.labelY, `${tile.id} labelY`).toBeLessThanOrEqual(mapCanvas.height);
    }
  });

  it("does not build political region source by reusing physicalMap path indices", () => {
    const sourceText = readFileSync(resolve(process.cwd(), "src/map/source/mapRegionSource.ts"), "utf8");
    expect(sourceText).not.toContain("../physicalMap");
    expect(sourceText).not.toContain("eastAsiaLandPaths[");
  });
});
