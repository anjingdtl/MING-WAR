import packageJson from "../../package.json";
import { describe, expect, it } from "vitest";
import type { MapRegionShape } from "../map/mapTypes";
import { mapRegionSource } from "../map/source/mapRegionSource";
import { validateMapRegions } from "../scripts/validateMapRegions";

describe("map region validator", () => {
  it("accepts the current authored map source", () => {
    expect(validateMapRegions(mapRegionSource)).toEqual([]);
  });

  it("detects duplicate map region ids", () => {
    const duplicated = [...mapRegionSource, { ...mapRegionSource[0] }];

    expect(validateMapRegions(duplicated)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "duplicate-region-id", regionId: mapRegionSource[0].id })])
    );
  });

  it("detects label coordinates outside the viewBox", () => {
    const invalid: MapRegionShape[] = [{ ...mapRegionSource[0], labelX: 901 }];

    expect(validateMapRegions(invalid)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "label-out-of-bounds", regionId: mapRegionSource[0].id })])
    );
  });

  it("exposes a repeatable validation command", () => {
    expect(packageJson.scripts["map:validate"]).toBe("tsx src/scripts/validateMapRegions.ts");
  });
});
