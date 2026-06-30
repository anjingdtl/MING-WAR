import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { regionTemplates } from "../data/regions";
import type { RegionId } from "../core/types";
import { mapCanvas } from "../map/mapCanvas";
import type { MapTileShape } from "../map/mapTypes";
import { baseMapTiles } from "../map/source/baseMapTiles";

export type MapValidationIssueCode =
  | "duplicate-region-id"
  | "missing-map-region"
  | "orphan-map-region"
  | "label-out-of-bounds"
  | "empty-paths"
  | "path-has-no-coordinates"
  | "missing-default-controller-for-context";

export interface MapValidationIssue {
  code: MapValidationIssueCode;
  message: string;
  regionId?: RegionId;
}

function numericValues(paths: string[]): number[] {
  return paths.flatMap((path) => [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])));
}

/**
 * 校验底层图块数据。
 * - playable 图块必须与 GameState.regions（regionTemplates）双向同步。
 * - context 图块（isPlayableRegion=false）不参与 orphan 检查，但必须有 defaultControllerFactionId。
 */
export function validateMapRegions(
  regions: MapTileShape[] = baseMapTiles,
  expectedRegionIds: RegionId[] = Object.keys(regionTemplates)
): MapValidationIssue[] {
  const issues: MapValidationIssue[] = [];
  const seen = new Set<RegionId>();
  const duplicateIds = new Set<RegionId>();

  for (const region of regions) {
    if (seen.has(region.id)) {
      duplicateIds.add(region.id);
    }
    seen.add(region.id);

    if (
      region.labelX < 0 ||
      region.labelX > mapCanvas.width ||
      region.labelY < 0 ||
      region.labelY > mapCanvas.height
    ) {
      issues.push({
        code: "label-out-of-bounds",
        regionId: region.id,
        message: `${region.id} label is outside the ${mapCanvas.width}x${mapCanvas.height} viewBox`
      });
    }

    if (region.paths.length === 0) {
      issues.push({
        code: "empty-paths",
        regionId: region.id,
        message: `${region.id} has no SVG paths`
      });
      continue;
    }

    if (numericValues(region.paths).length < 4) {
      issues.push({
        code: "path-has-no-coordinates",
        regionId: region.id,
        message: `${region.id} does not contain enough path coordinates`
      });
    }

    if (!region.isPlayableRegion && !region.defaultControllerFactionId) {
      issues.push({
        code: "missing-default-controller-for-context",
        regionId: region.id,
        message: `${region.id} is a context tile but has no defaultControllerFactionId`
      });
    }
  }

  for (const regionId of duplicateIds) {
    issues.push({
      code: "duplicate-region-id",
      regionId,
      message: `${regionId} appears more than once in the map source`
    });
  }

  const playableTileIds = new Set(regions.filter((region) => region.isPlayableRegion).map((region) => region.id));

  for (const regionId of expectedRegionIds) {
    if (!playableTileIds.has(regionId)) {
      issues.push({
        code: "missing-map-region",
        regionId,
        message: `${regionId} exists in simulation data but not playable map tiles`
      });
    }
  }

  const expectedIds = new Set(expectedRegionIds);
  for (const region of regions) {
    if (region.isPlayableRegion && !expectedIds.has(region.id)) {
      issues.push({
        code: "orphan-map-region",
        regionId: region.id,
        message: `${region.id} is a playable tile but not in simulation data`
      });
    }
  }

  return issues;
}

function isCliEntry(): boolean {
  return Boolean(process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]));
}

if (isCliEntry()) {
  const issues = validateMapRegions();

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`[${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
  } else {
    const playable = baseMapTiles.filter((t) => t.isPlayableRegion).length;
    const context = baseMapTiles.length - playable;
    console.log(`Validated ${baseMapTiles.length} map tiles (${playable} playable, ${context} context)`);
  }
}
