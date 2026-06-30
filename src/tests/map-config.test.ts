import { describe, expect, it } from "vitest";
import { mapCanvas } from "../map/mapCanvas";
import { mapRegions } from "../map/mapConfig";
import { eastAsiaLandPaths } from "../map/physicalMap";

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsFor(regionId: string): Bounds {
  const region = mapRegions.find((item) => item.id === regionId);
  if (!region) throw new Error(`Missing map region ${regionId}`);
  const values = region.paths.flatMap((path) => [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])));
  const xs = values.filter((_, index) => index % 2 === 0);
  const ys = values.filter((_, index) => index % 2 === 1);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  };
}

function pathsFor(regionId: string): string[] {
  const region = mapRegions.find((item) => item.id === regionId);
  if (!region) throw new Error(`Missing map region ${regionId}`);
  return region.paths;
}

function regionFor(regionId: string) {
  const region = mapRegions.find((item) => item.id === regionId);
  if (!region) throw new Error(`Missing map region ${regionId}`);
  return region;
}

function overlapArea(a: Bounds, b: Bounds): number {
  const width = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const height = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  return width * height;
}

describe("map region boundaries", () => {
  it("uses an expanded Northeast Asia canvas", () => {
    expect(mapCanvas.width).toBeGreaterThanOrEqual(1000);
    expect(mapCanvas.height).toBeGreaterThanOrEqual(700);
    expect(boundsFor("sakhalin").maxX).toBeGreaterThan(980);
    expect(boundsFor("japan_west").maxY).toBeGreaterThan(480);
    expect(boundsFor("japan_east").minY).toBeLessThan(340);
    expect(boundsFor("sakhalin").maxY).toBeLessThanOrEqual(360);
    expect(boundsFor("hulunbuir").minY).toBeLessThanOrEqual(80);
  });

  it("anchors island factions to the physical coastline paths", () => {
    expect(pathsFor("sakhalin")).toContain(eastAsiaLandPaths[2]);
    expect(pathsFor("ezo")).toContain(eastAsiaLandPaths[3]);
    expect(pathsFor("japan_east")).toContain(eastAsiaLandPaths[4]);
    expect(pathsFor("japan_west")).toEqual(expect.arrayContaining([
      eastAsiaLandPaths[23],
      eastAsiaLandPaths[26],
      eastAsiaLandPaths[28]
    ]));
  });

  it("keeps coastal frontier and peninsula labels on land", () => {
    expect(regionFor("nurgan_coast").labelX).toBeLessThanOrEqual(865);
    expect(regionFor("nurgan_coast").labelY).toBeGreaterThanOrEqual(230);
    expect(regionFor("joseon_north").labelX).toBeGreaterThanOrEqual(780);
    expect(regionFor("joseon_south").labelX).toBeGreaterThanOrEqual(790);
    expect(regionFor("joseon_north").labelY).toBeLessThanOrEqual(305);
    expect(regionFor("joseon_south").labelX).toBeGreaterThanOrEqual(815);
    expect(regionFor("joseon_south").labelY).toBeLessThanOrEqual(365);
    expect(regionFor("joseon_north").labelWidth).toBeLessThanOrEqual(96);
    expect(regionFor("joseon_south").labelWidth).toBeLessThanOrEqual(96);
  });

  it("keeps frontier region bounds outside adjacent Ming province bounds", () => {
    const forbiddenPairs: Array<[string, string]> = [
      ["tumed_steppe", "beizhili"],
      ["tumed_steppe", "shanxi"],
      ["chahar_steppe", "beizhili"],
      ["chahar_steppe", "shanxi"],
      ["chahar_steppe", "liaodong"]
    ];

    for (const [frontierId, mingId] of forbiddenPairs) {
      expect(overlapArea(boundsFor(frontierId), boundsFor(mingId)), `${frontierId} overlaps ${mingId}`).toBe(0);
    }
  });

  it("marks Bozhou as a bounded tusi enclave", () => {
    expect(mapRegions.find((item) => item.id === "bozhou")?.isEnclave).toBe(true);
  });

  it("uses real admin boundaries for Liaodong and Jurchen regions", () => {
    for (const regionId of ["liaodong", "jianzhou", "haixi"]) {
      expect(mapRegions.find((item) => item.id === regionId)?.source, regionId).toBe("natural-earth-admin1");
    }
  });
});
