import packageJson from "../../package.json";
import { describe, expect, it } from "vitest";
import type { MapTileShape } from "../map/mapTypes";
import { baseMapTiles } from "../map/source/baseMapTiles";
import { validateMapRegions } from "../scripts/validateMapRegions";

describe("map tile validator", () => {
  it("accepts the current authored map tile source", () => {
    expect(validateMapRegions(baseMapTiles)).toEqual([]);
  });

  it("detects duplicate map tile ids", () => {
    const duplicated: MapTileShape[] = [...baseMapTiles, { ...baseMapTiles[0] }];

    expect(validateMapRegions(duplicated)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "duplicate-region-id", regionId: baseMapTiles[0].id })])
    );
  });

  it("detects label coordinates outside the viewBox", () => {
    const invalid: MapTileShape[] = [{ ...baseMapTiles[0], labelX: 1001 }];

    expect(validateMapRegions(invalid)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "label-out-of-bounds", regionId: baseMapTiles[0].id })])
    );
  });

  it("does not report context tiles as orphans", () => {
    const contextTile: MapTileShape = {
      id: "test-context",
      displayName: "测试远景",
      paths: ["M10 10 L20 10 L20 20 L10 20 Z"],
      labelX: 15,
      labelY: 15,
      source: "generated-source",
      kind: "context-region",
      isPlayableRegion: false,
      defaultControllerFactionId: "tibet",
      importance: 3
    };
    const issues = validateMapRegions([...baseMapTiles, contextTile]);
    expect(issues.find((i) => i.code === "orphan-map-region" && i.regionId === "test-context")).toBeUndefined();
  });

  it("flags context tiles without a default controller", () => {
    const contextTile: MapTileShape = {
      id: "test-context-no-controller",
      displayName: "无主远景",
      paths: ["M10 10 L20 10 L20 20 L10 20 Z"],
      labelX: 15,
      labelY: 15,
      source: "generated-source",
      kind: "context-region",
      isPlayableRegion: false,
      importance: 3
    };
    const issues = validateMapRegions([contextTile]);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-default-controller-for-context", regionId: "test-context-no-controller" })
      ])
    );
  });

  it("exposes a repeatable validation command", () => {
    expect(packageJson.scripts["map:validate"]).toBe("tsx src/scripts/validateMapRegions.ts");
  });
});
