import packageJson from "../../package.json";
import { describe, expect, it } from "vitest";
import { mapTiles } from "../map/generated/mapTiles";
import { baseMapTiles } from "../map/source/baseMapTiles";

describe("map generation pipeline", () => {
  it("keeps generated map tile output in sync with authored source data", () => {
    expect(mapTiles).toEqual(baseMapTiles);
  });

  it("exposes a repeatable generation command", () => {
    expect(packageJson.scripts["map:generate"]).toBe("tsx src/scripts/generateMapRegions.ts");
  });
});
