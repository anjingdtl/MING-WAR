import type { RegionId } from "../core/types";

export interface MapRegionShape {
  id: RegionId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const mapRegions: MapRegionShape[] = [
  { id: "chahar_steppe", x: 160, y: 40, width: 130, height: 70 },
  { id: "tumed_steppe", x: 80, y: 120, width: 130, height: 70 },
  { id: "datong", x: 220, y: 130, width: 110, height: 70 },
  { id: "beijing", x: 350, y: 140, width: 100, height: 70 },
  { id: "liaoxi", x: 480, y: 120, width: 110, height: 70 },
  { id: "liaodong", x: 610, y: 110, width: 110, height: 70 },
  { id: "haixi", x: 700, y: 40, width: 105, height: 65 },
  { id: "jianzhou", x: 720, y: 145, width: 110, height: 70 },
  { id: "shaanxi", x: 190, y: 250, width: 130, height: 80 },
  { id: "shandong", x: 420, y: 260, width: 120, height: 75 },
  { id: "henan", x: 300, y: 350, width: 130, height: 80 },
  { id: "jiangnan", x: 440, y: 430, width: 150, height: 90 },
  { id: "bozhou", x: 190, y: 470, width: 140, height: 90 }
];
