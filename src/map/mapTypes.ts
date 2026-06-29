import type { RegionId } from "../core/types";

export type MapRegionSource =
  | "natural-earth-admin1"
  | "historical-frontier-manual"
  | "tusi-enclave"
  | "generated-source";

export type MapRegionGroup = "ming" | "korea" | "japan" | "jurchen" | "mongolia" | "southwest";

export interface MapRegionShape {
  id: RegionId;
  paths: string[];
  labelX: number;
  labelY: number;
  labelWidth?: number;
  source: MapRegionSource;
  group?: MapRegionGroup;
  isEnclave?: boolean;
}
