import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { regionTemplates } from "../data/regions";
import type { RegionId } from "../core/types";
import type { MapRegionShape } from "../map/mapTypes";
import { mapRegionSource } from "../map/source/mapRegionSource";

export type MapValidationIssueCode =
  | "duplicate-region-id"
  | "missing-map-region"
  | "orphan-map-region"
  | "label-out-of-bounds"
  | "empty-paths"
  | "path-has-no-coordinates";

export interface MapValidationIssue {
  code: MapValidationIssueCode;
  message: string;
  regionId?: RegionId;
}

const viewBox = {
  width: 900,
  height: 620
};

function numericValues(paths: string[]): number[] {
  return paths.flatMap((path) => [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])));
}

export function validateMapRegions(
  regions: MapRegionShape[] = mapRegionSource,
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

    if (region.labelX < 0 || region.labelX > viewBox.width || region.labelY < 0 || region.labelY > viewBox.height) {
      issues.push({
        code: "label-out-of-bounds",
        regionId: region.id,
        message: `${region.id} label is outside the ${viewBox.width}x${viewBox.height} viewBox`
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
  }

  for (const regionId of duplicateIds) {
    issues.push({
      code: "duplicate-region-id",
      regionId,
      message: `${regionId} appears more than once in the map source`
    });
  }

  const mapIds = new Set(regions.map((region) => region.id));
  for (const regionId of expectedRegionIds) {
    if (!mapIds.has(regionId)) {
      issues.push({
        code: "missing-map-region",
        regionId,
        message: `${regionId} exists in simulation data but not map source`
      });
    }
  }

  const expectedIds = new Set(expectedRegionIds);
  for (const region of regions) {
    if (!expectedIds.has(region.id)) {
      issues.push({
        code: "orphan-map-region",
        regionId: region.id,
        message: `${region.id} exists in map source but not simulation data`
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
    console.log(`Validated ${mapRegionSource.length} map regions`);
  }
}
