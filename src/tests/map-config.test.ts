import { describe, expect, it } from "vitest";
import { mapCanvas } from "../map/mapCanvas";
import { mapRegions, mapTiles } from "../map/mapConfig";

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsFor(regionId: string): Bounds {
  const region = mapTiles.find((item) => item.id === regionId);
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

function regionFor(regionId: string) {
  const region = mapRegions.find((item) => item.id === regionId);
  if (!region) throw new Error(`Missing map region ${regionId}`);
  return region;
}

function widthOf(regionId: string): number {
  const bounds = boundsFor(regionId);
  return bounds.maxX - bounds.minX;
}

function heightOf(regionId: string): number {
  const bounds = boundsFor(regionId);
  return bounds.maxY - bounds.minY;
}

describe("map region boundaries", () => {
  it("uses an expanded Northeast Asia canvas", () => {
    expect(mapCanvas.width).toBeGreaterThanOrEqual(1000);
    expect(mapCanvas.height).toBeGreaterThanOrEqual(700);
    expect(boundsFor("sakhalin").maxX).toBeGreaterThan(boundsFor("japan_east").maxX);
    expect(boundsFor("japan_west").maxY).toBeGreaterThan(boundsFor("japan_east").maxY);
    expect(boundsFor("ezo").minY).toBeLessThan(boundsFor("japan_east").minY);
    expect(boundsFor("hulunbuir").minY).toBeLessThan(boundsFor("korchin_steppe").minY);
  });

  it("builds island factions independently from the physical coastline layer", () => {
    for (const regionId of ["sakhalin", "ezo", "japan_east", "japan_west"]) {
      expect(regionFor(regionId).paths.length, regionId).toBeGreaterThan(0);
      expect(regionFor(regionId).source, regionId).toMatch(/natural-earth-admin1|historical-frontier-manual/);
    }
  });

  it("keeps coastal frontier and peninsula labels on land", () => {
    expect(regionFor("nurgan_coast").labelX).toBeGreaterThan(regionFor("jianzhou").labelX);
    expect(regionFor("nurgan_coast").labelY).toBeLessThan(regionFor("joseon_north").labelY);
    expect(regionFor("joseon_north").labelX).toBeGreaterThan(regionFor("liaodong").labelX);
    expect(regionFor("joseon_south").labelX).toBeGreaterThan(regionFor("liaodong").labelX);
    expect(regionFor("joseon_north").labelY).toBeLessThan(regionFor("joseon_south").labelY);
    expect(regionFor("joseon_north").labelWidth).toBeLessThanOrEqual(96);
    expect(regionFor("joseon_south").labelWidth).toBeLessThanOrEqual(96);
  });

  it("places frontier regions on the proper side of adjacent Ming provinces", () => {
    const northOfPairs: Array<[string, string]> = [
      ["tumed_steppe", "shanxi"],
      ["chahar_steppe", "beizhili"],
      ["korchin_steppe", "liaodong"],
      ["haixi", "liaodong"],
      ["jianzhou", "liaodong"]
    ];

    for (const [frontierId, mingId] of northOfPairs) {
      expect(regionFor(frontierId).labelY, `${frontierId} should be north of ${mingId}`).toBeLessThan(regionFor(mingId).labelY);
    }
  });

  it("marks Bozhou as a bounded tusi enclave", () => {
    expect(mapRegions.find((item) => item.id === "bozhou")?.isEnclave).toBe(true);
  });

  it("uses real admin boundaries where modern province geometry is authoritative", () => {
    for (const regionId of ["liaodong", "sakhalin", "amur_basin", "nurgan_coast"]) {
      expect(mapRegions.find((item) => item.id === regionId)?.source, regionId).toBe("natural-earth-admin1");
    }
  });

  it("keeps Wanli-era northwest frontier context close to the historical atlas layout", () => {
    const hami = boundsFor("hami");
    const mobei = boundsFor("mobei");
    const tibet = boundsFor("tibet");
    const tumed = boundsFor("tumed_steppe");

    expect(widthOf("hami"), "Hami should be a compact corridor, not the whole western region").toBeLessThan(115);
    expect(heightOf("hami"), "Hami should be a compact corridor").toBeLessThan(85);
    expect(hami.minX, "Hami sits west of Tumed").toBeLessThan(tumed.minX);
    expect(hami.maxX, "Hami should not reach the far western map edge").toBeGreaterThan(330);
    expect(hami.minY, "Hami is north of U-Tsang").toBeLessThan(tibet.minY);
    expect(hami.maxY, "Hami is south of Mobei").toBeGreaterThan(mobei.maxY - 8);
  });

  it("keeps Wanli-era Mongol divisions as east-west frontier bands rather than vertical strips", () => {
    expect(widthOf("tumed_steppe"), "Tumed should read as a Hetao/Great-Wall band").toBeGreaterThan(heightOf("tumed_steppe") * 2.1);
    expect(widthOf("chahar_steppe"), "Chahar should be wider than it is tall").toBeGreaterThan(heightOf("chahar_steppe") * 1.3);
    expect(widthOf("korchin_steppe"), "Korchin should not collapse into a narrow vertical strip").toBeGreaterThan(heightOf("korchin_steppe") * 0.85);
    expect(boundsFor("korchin_steppe").minX, "Korchin remains east of Chahar").toBeGreaterThan(boundsFor("chahar_steppe").minX);
    expect(boundsFor("hulunbuir").minY, "Hulunbuir remains north of Korchin").toBeLessThan(boundsFor("korchin_steppe").minY);
  });
});
