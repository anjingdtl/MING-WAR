import packageJson from "../../package.json";
import { describe, expect, it } from "vitest";
import { mapRegions } from "../map/generated/mapRegions";
import { mapRegionSource } from "../map/source/mapRegionSource";

describe("map generation pipeline", () => {
  it("keeps generated map output in sync with authored source data", () => {
    expect(mapRegions).toEqual(mapRegionSource);
  });

  it("exposes a repeatable generation command", () => {
    expect(packageJson.scripts["map:generate"]).toBe("tsx src/scripts/generateMapRegions.ts");
  });
});
