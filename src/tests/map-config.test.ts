import { describe, expect, it } from "vitest";
import { mapRegions } from "../map/mapConfig";

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

function overlapArea(a: Bounds, b: Bounds): number {
  const width = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const height = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  return width * height;
}

describe("map region boundaries", () => {
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
