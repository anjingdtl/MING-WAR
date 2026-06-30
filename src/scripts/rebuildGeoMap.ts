import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { FactionMapLabel, MapRegionShape, MapTileShape } from "../map/mapTypes";

type Point = [number, number];
type Ring = Point[];

interface GeoFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
}

interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

interface PathOptions {
  close: boolean;
  minDistance: number;
  minArea?: number;
}

const urls = {
  land: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson",
  admin0: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
  admin1: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson",
  rivers:
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson"
} as const;

const bounds = {
  lonMin: 68,
  lonMax: 148,
  latMin: 7,
  latMax: 58,
  width: 1000,
  height: 700
} as const;

const outputPaths = {
  physical: resolve(process.cwd(), "src/map/physicalMap.ts"),
  regionSource: resolve(process.cwd(), "src/map/source/mapRegionSource.ts"),
  factionLabels: resolve(process.cwd(), "src/map/generated/factionMapLabels.ts")
} as const;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function project([lon, lat]: Point): Point {
  const clampedLon = Math.max(bounds.lonMin, Math.min(bounds.lonMax, lon));
  const clampedLat = Math.max(bounds.latMin, Math.min(bounds.latMax, lat));
  return [
    round(((clampedLon - bounds.lonMin) / (bounds.lonMax - bounds.lonMin)) * bounds.width),
    round(((bounds.latMax - clampedLat) / (bounds.latMax - bounds.latMin)) * bounds.height)
  ];
}

function projectedLabel(lon: number, lat: number): Pick<MapRegionShape, "labelX" | "labelY"> {
  const [labelX, labelY] = project([lon, lat]);
  return { labelX, labelY };
}

function factionLabelPoint(lon: number, lat: number): Pick<FactionMapLabel, "x" | "y"> {
  const [x, y] = project([lon, lat]);
  return { x, y };
}

function distance(a: Point, b: Point): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function ringBBox(ring: Ring) {
  const lons = ring.map((point) => point[0]);
  const lats = ring.map((point) => point[1]);
  return {
    lonMin: Math.min(...lons),
    lonMax: Math.max(...lons),
    latMin: Math.min(...lats),
    latMax: Math.max(...lats)
  };
}

function intersectsCanvas(ring: Ring): boolean {
  const box = ringBBox(ring);
  return (
    box.lonMax >= bounds.lonMin &&
    box.lonMin <= bounds.lonMax &&
    box.latMax >= bounds.latMin &&
    box.latMin <= bounds.latMax
  );
}

function area(points: Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(sum / 2);
}

function simplifyProjected(points: Point[], minDistance: number): Point[] {
  const simplified: Point[] = [];
  for (const point of points) {
    if (simplified.length === 0 || distance(point, simplified[simplified.length - 1]) >= minDistance) {
      simplified.push(point);
    }
  }
  if (simplified.length > 2 && distance(simplified[0], simplified[simplified.length - 1]) < minDistance) {
    simplified.pop();
  }
  return simplified;
}

function ringToPath(ring: Ring, options: PathOptions): string | null {
  if (ring.length < (options.close ? 3 : 2) || !intersectsCanvas(ring)) return null;
  const projected = simplifyProjected(ring.map(project), options.minDistance);
  if (projected.length < (options.close ? 3 : 2)) return null;
  if (options.minArea && options.close && area(projected) < options.minArea) return null;

  const [start, ...rest] = projected;
  const segments = [`M${start[0]} ${start[1]}`, ...rest.map((point) => `L${point[0]} ${point[1]}`)];
  if (options.close) segments.push("Z");
  return segments.join(" ");
}

function manualPath(points: Ring): string {
  const path = ringToPath(points, { close: true, minDistance: 0 });
  if (!path) throw new Error("Manual polygon did not produce a path");
  return path;
}

function manualLine(points: Ring): string {
  const path = ringToPath(points, { close: false, minDistance: 0 });
  if (!path) throw new Error("Manual line did not produce a path");
  return path;
}

function oval(center: Point, lonRadius: number, latRadius: number): string {
  const steps = 18;
  const points = Array.from({ length: steps }, (_, index): Point => {
    const angle = (index / steps) * Math.PI * 2;
    return [center[0] + Math.cos(angle) * lonRadius, center[1] + Math.sin(angle) * latRadius];
  });
  return manualPath(points);
}

function featureRings(feature: GeoFeature): Ring[] {
  if (!feature.geometry) return [];
  const { type, coordinates } = feature.geometry;
  if (type === "Polygon") {
    return (coordinates as Ring[]).slice(0, 1);
  }
  if (type === "MultiPolygon") {
    return (coordinates as Ring[][]).map((polygon) => polygon[0]).filter(Boolean);
  }
  return [];
}

function featureLines(feature: GeoFeature): Ring[] {
  if (!feature.geometry) return [];
  const { type, coordinates } = feature.geometry;
  if (type === "LineString") return [coordinates as Ring];
  if (type === "MultiLineString") return coordinates as Ring[];
  return [];
}

async function fetchJson(url: string): Promise<GeoFeatureCollection> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return (await response.json()) as GeoFeatureCollection;
}

function property(feature: GeoFeature, key: string): string {
  return String(feature.properties[key] ?? "");
}

function pathsFromFeatures(features: GeoFeature[], options: PathOptions): string[] {
  return features
    .flatMap(featureRings)
    .map((ring) => ringToPath(ring, options))
    .filter((path): path is string => Boolean(path));
}

function linePathsFromFeatures(features: GeoFeature[], options: PathOptions): string[] {
  return features
    .flatMap(featureLines)
    .map((line) => ringToPath(line, options))
    .filter((path): path is string => Boolean(path));
}

function pathsForAdmin1(admin1: GeoFeatureCollection, names: string[]): string[] {
  const nameSet = new Set(names);
  return pathsFromFeatures(
    admin1.features.filter((feature) => property(feature, "admin") === "China" && nameSet.has(property(feature, "name"))),
    { close: true, minDistance: 1.8, minArea: 4 }
  );
}

function pathsForRussianAdmin1(admin1: GeoFeatureCollection, names: string[]): string[] {
  const nameSet = new Set(names);
  return pathsFromFeatures(
    admin1.features.filter((feature) => property(feature, "admin") === "Russia" && nameSet.has(property(feature, "name"))),
    { close: true, minDistance: 1.8, minArea: 4 }
  );
}

function countryFeatures(admin0: GeoFeatureCollection, name: string): GeoFeature[] {
  return admin0.features.filter((feature) => {
    const admin = property(feature, "ADMIN");
    const nameLong = property(feature, "NAME_LONG");
    const nameValue = property(feature, "NAME");
    return admin === name || nameLong === name || nameValue === name;
  });
}

function countryRingPaths(admin0: GeoFeatureCollection, name: string, predicate: (ring: Ring) => boolean): string[] {
  return countryFeatures(admin0, name)
    .flatMap(featureRings)
    .filter(predicate)
    .map((ring) => ringToPath(ring, { close: true, minDistance: 1.4, minArea: 3 }))
    .filter((path): path is string => Boolean(path));
}

function centroid(ring: Ring): Point {
  const total = ring.reduce<Point>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
  return [total[0] / ring.length, total[1] / ring.length];
}

function requirePaths(id: string, paths: string[]): string[] {
  if (paths.length === 0) throw new Error(`No map paths generated for ${id}`);
  return paths;
}

function region(
  id: string,
  paths: string[],
  label: Point,
  labelWidth: number,
  source: MapRegionShape["source"],
  extra: Partial<MapRegionShape> = {}
): MapRegionShape {
  return {
    id,
    paths: requirePaths(id, paths),
    ...projectedLabel(label[0], label[1]),
    labelWidth,
    source,
    ...extra
  };
}

function contextTile(
  id: string,
  displayName: string,
  paths: string[],
  label: Point,
  labelWidth: number,
  defaultControllerFactionId: string,
  kind: MapTileShape["kind"] = "context-region"
): MapTileShape {
  return {
    ...region(id, paths, label, labelWidth, "generated-source"),
    displayName,
    kind,
    isPlayableRegion: false,
    defaultControllerFactionId,
    importance: 3
  };
}

function buildRegions(admin1: GeoFeatureCollection, admin0: GeoFeatureCollection): MapRegionShape[] {
  const china = (names: string[]) => pathsForAdmin1(admin1, names);
  const russian = (names: string[]) => pathsForRussianAdmin1(admin1, names);
  const japanRing = (predicate: (center: Point) => boolean) =>
    countryRingPaths(admin0, "Japan", (ring) => predicate(centroid(ring)));

  return [
    region("beizhili", china(["Hebei", "Beijing", "Tianjin"]), [116.6, 39.4], 92, "natural-earth-admin1"),
    region("nanzhili", china(["Jiangsu", "Anhui", "Shanghai"]), [118.5, 32.1], 96, "natural-earth-admin1"),
    region("shandong", china(["Shandong"]), [118.3, 36.2], 90, "natural-earth-admin1"),
    region("shanxi", china(["Shanxi"]), [112.3, 37.8], 90, "natural-earth-admin1"),
    region("henan", china(["Henan"]), [113.7, 34.2], 90, "natural-earth-admin1"),
    region("shaanxi", china(["Shaanxi", "Gansu", "Ningxia"]), [108.2, 35.6], 92, "natural-earth-admin1"),
    region("zhejiang", china(["Zhejiang"]), [120.1, 29.2], 90, "natural-earth-admin1"),
    region("jiangxi", china(["Jiangxi"]), [115.8, 27.8], 90, "natural-earth-admin1"),
    region("huguang", china(["Hubei", "Hunan"]), [112.7, 29.3], 92, "natural-earth-admin1"),
    region("sichuan", china(["Sichuan", "Chongqing"]), [104.2, 30.6], 90, "natural-earth-admin1"),
    region("fujian", china(["Fujian"]), [118.7, 26.0], 90, "natural-earth-admin1"),
    region("guangdong", china(["Guangdong", "Hainan"]), [113.7, 22.8], 92, "natural-earth-admin1"),
    region("guangxi", china(["Guangxi"]), [108.7, 23.7], 90, "natural-earth-admin1"),
    region("yunnan", china(["Yunnan"]), [101.6, 24.8], 90, "natural-earth-admin1"),
    region("guizhou", china(["Guizhou"]), [106.7, 26.8], 90, "natural-earth-admin1"),
    region("liaodong", china(["Liaoning"]), [122.9, 41.2], 92, "natural-earth-admin1"),
    region("tumed_steppe", [manualPath([[106.6, 40.5], [113.3, 41.1], [116.2, 42.3], [114.2, 43.4], [108.3, 43.1], [105.6, 41.9]])], [110.9, 42.0], 116, "historical-frontier-manual", { group: "mongolia" }),
    region("chahar_steppe", [manualPath([[112.8, 41.2], [119.2, 41.7], [123.8, 43.6], [121.6, 45.0], [115.2, 44.2], [111.0, 42.7]])], [117.8, 43.0], 112, "historical-frontier-manual", { group: "mongolia" }),
    region("korchin_steppe", [manualPath([[119.2, 42.4], [125.5, 43.2], [129.2, 46.2], [125.2, 48.1], [119.4, 47.0], [116.0, 44.5]])], [123.6, 45.5], 104, "historical-frontier-manual", { group: "mongolia" }),
    region("hulunbuir", [manualPath([[112.2, 47.2], [119.0, 47.7], [123.8, 50.4], [120.2, 53.2], [113.5, 51.6], [111.0, 48.7]])], [117.0, 50.0], 116, "historical-frontier-manual", { group: "mongolia" }),
    region("haixi", [manualPath([[122.0, 43.0], [127.8, 43.4], [130.1, 46.1], [126.2, 47.5], [121.4, 45.8]])], [126.0, 45.4], 90, "historical-frontier-manual", { group: "jurchen" }),
    region("jianzhou", [manualPath([[123.0, 40.3], [128.7, 41.0], [131.0, 43.5], [127.2, 44.7], [122.0, 42.8]])], [126.8, 42.5], 96, "historical-frontier-manual", { group: "jurchen" }),
    region("amur_basin", russian(["Amur", "Yevrey"]), [127.5, 50.2], 104, "natural-earth-admin1", { group: "jurchen" }),
    region("nurgan_coast", russian(["Khabarovsk", "Primor'ye"]), [135.5, 47.0], 96, "natural-earth-admin1", { group: "jurchen" }),
    region("sakhalin", russian(["Sakhalin"]), [142.4, 49.0], 86, "natural-earth-admin1", { group: "japan" }),
    region("joseon_north", countryRingPaths(admin0, "North Korea", () => true), [127.3, 40.3], 84, "historical-frontier-manual", { group: "korea" }),
    region("joseon_south", countryRingPaths(admin0, "South Korea", () => true), [127.8, 36.1], 84, "historical-frontier-manual", { group: "korea" }),
    region("japan_west", japanRing(([lon, lat]) => lat < 41 && lon < 136.5), [132.2, 33.8], 104, "historical-frontier-manual", { group: "japan" }),
    region("japan_east", japanRing(([lon, lat]) => lat < 41 && lon >= 136.5), [139.5, 37.4], 104, "historical-frontier-manual", { group: "japan" }),
    region("ezo", japanRing(([, lat]) => lat >= 41), [142.5, 43.4], 86, "historical-frontier-manual", { group: "japan" }),
    region("bozhou", [manualPath([[106.0, 28.4], [107.4, 28.2], [107.7, 27.2], [106.4, 26.9], [105.5, 27.5]])], [106.6, 27.6], 90, "tusi-enclave", { isEnclave: true, group: "southwest" })
  ];
}

function buildContextTiles(admin1: GeoFeatureCollection, admin0: GeoFeatureCollection): MapTileShape[] {
  return [
    contextTile("tibet", "乌斯藏", pathsForAdmin1(admin1, ["Xizang"]), [89.5, 30.7], 80, "tibet"),
    contextTile("hami", "哈密", [manualPath([[88.0, 41.0], [96.0, 43.0], [97.6, 41.3], [94.0, 39.0], [88.5, 39.5]])], [93.0, 41.1], 72, "mobei"),
    contextTile("mobei", "漠北诸部", countryRingPaths(admin0, "Mongolia", () => true), [102.5, 47.8], 84, "mobei"),
    contextTile("southeast-asia", "东南亚边缘", [manualPath([[92.0, 18.0], [107.0, 18.0], [113.0, 9.0], [98.0, 7.2], [92.0, 11.0]])], [103.0, 12.8], 96, "southeast-asia"),
    contextTile("liuqiu", "琉球", [manualPath([[123.5, 27.2], [129.8, 28.2], [132.5, 25.0], [127.4, 23.0], [123.0, 24.4]])], [127.5, 25.3], 64, "liuqiu", "sea-zone"),
    contextTile("western-pacific", "西太平洋", [manualPath([[136.2, 31.0], [148.0, 35.0], [148.0, 7.0], [139.0, 9.0], [136.0, 22.0]])], [143.0, 21.0], 84, "western-sea", "sea-zone"),
    contextTile("northern-sea", "北海", [manualPath([[135.5, 57.5], [148.0, 58.0], [148.0, 52.5], [139.2, 52.0]])], [143.0, 55.0], 64, "western-sea", "sea-zone")
  ];
}

function buildPhysicalMap(land: GeoFeatureCollection, rivers: GeoFeatureCollection): string {
  const eastAsiaLandPaths = pathsFromFeatures(land.features, { close: true, minDistance: 2.5, minArea: 8 });
  const majorRiverPaths = linePathsFromFeatures(rivers.features, { close: false, minDistance: 2.0 });
  const majorLakePaths = [
    oval([107.0, 53.5], 3.0, 0.7),
    oval([100.2, 36.9], 1.2, 0.5),
    oval([113.0, 29.1], 1.0, 0.4),
    oval([116.3, 29.1], 0.9, 0.4)
  ];
  const majorMountainPaths = [
    manualLine([[78, 31.5], [88, 30.4], [98, 29.8], [106, 31.0]]),
    manualLine([[74, 41.5], [84, 42.8], [96, 43.8]]),
    manualLine([[86, 47.5], [98, 49.0], [111, 49.0]]),
    manualLine([[111, 48.0], [118, 51.0], [123, 53.0]]),
    manualLine([[118, 47.0], [123, 43.0], [128, 40.0]]),
    manualLine([[126, 42.0], [130, 40.0], [132, 38.0]]),
    manualLine([[131, 34.5], [136, 36.5], [141, 39.5], [145, 43.0]])
  ];
  const terrainRidgePaths = [
    manualLine([[80, 33.2], [84, 31.7], [88, 32.5], [92, 31.3], [96, 32.1]]),
    manualLine([[90, 44.0], [95, 42.6], [100, 43.5], [105, 42.6]]),
    manualLine([[113, 50.0], [117, 48.5], [121, 50.2], [124, 48.6]]),
    manualLine([[120, 45.2], [124, 43.7], [128, 45.0], [131, 43.0]]),
    manualLine([[133, 35.2], [136, 36.6], [139, 38.0], [142, 40.5]]),
    manualLine([[103, 25.5], [107, 24.2], [111, 25.0], [114, 23.7]])
  ];

  return `export const eastAsiaLandPaths: string[] = ${JSON.stringify(eastAsiaLandPaths, null, 2)};

export const majorMountainPaths: string[] = ${JSON.stringify(majorMountainPaths, null, 2)};

export const terrainRidgePaths: string[] = ${JSON.stringify(terrainRidgePaths, null, 2)};

export const majorLakePaths: string[] = ${JSON.stringify(majorLakePaths, null, 2)};

export const majorRiverPaths: string[] = ${JSON.stringify(majorRiverPaths, null, 2)};
`;
}

function buildRegionSource(regions: MapRegionShape[], contextTiles: MapTileShape[]): string {
  return `import type { MapRegionShape, MapTileShape } from "../mapTypes";

export const mapRegionSource: MapRegionShape[] = ${JSON.stringify(regions, null, 2)};

export const contextMapTileSource: MapTileShape[] = ${JSON.stringify(contextTiles, null, 2)};
`;
}

function buildFactionLabels(): string {
  const labels: FactionMapLabel[] = [
    { factionId: "ming", label: "大明", ...factionLabelPoint(113.8, 30.8), minZoom: 0, maxZoom: 0.9, importance: 1 },
    { factionId: "jianzhou", label: "建州女真", ...factionLabelPoint(126.8, 42.5), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "haixi", label: "海西女真", ...factionLabelPoint(126.0, 45.5), minZoom: 0, maxZoom: 0.85, importance: 2 },
    { factionId: "chahar", label: "察哈尔", ...factionLabelPoint(117.8, 43.0), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "tumed", label: "土默特", ...factionLabelPoint(110.9, 42.0), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "korchin", label: "科尔沁", ...factionLabelPoint(123.6, 45.5), minZoom: 0, maxZoom: 0.85, importance: 2 },
    { factionId: "nurgan", label: "奴儿干", ...factionLabelPoint(135.2, 47.0), minZoom: 0, maxZoom: 0.85, importance: 2 },
    { factionId: "joseon", label: "朝鲜", ...factionLabelPoint(127.8, 37.2), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "japan", label: "日本诸藩", ...factionLabelPoint(136.5, 35.1), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "ainu", label: "虾夷", ...factionLabelPoint(142.7, 44.0), minZoom: 0, maxZoom: 0.8, importance: 3 },
    { factionId: "bozhou", label: "播州", ...factionLabelPoint(106.6, 27.6), minZoom: 0, maxZoom: 0.8, importance: 3 },
    { factionId: "tibet", label: "乌斯藏", ...factionLabelPoint(89.5, 30.7), minZoom: 0, maxZoom: 0.85, importance: 3 },
    { factionId: "mobei", label: "漠北诸部", ...factionLabelPoint(102.5, 47.8), minZoom: 0, maxZoom: 0.85, importance: 3 },
    { factionId: "southeast-asia", label: "东南亚", ...factionLabelPoint(103.0, 12.8), minZoom: 0, maxZoom: 0.8, importance: 3 },
    { factionId: "liuqiu", label: "琉球", ...factionLabelPoint(127.5, 25.3), minZoom: 0, maxZoom: 0.8, importance: 3 }
  ];

  return `import type { FactionMapLabel } from "../mapTypes";

export const factionMapLabels: FactionMapLabel[] = ${JSON.stringify(labels, null, 2)};
`;
}

async function main() {
  const [land, admin0, admin1, rivers] = await Promise.all([
    fetchJson(urls.land),
    fetchJson(urls.admin0),
    fetchJson(urls.admin1),
    fetchJson(urls.rivers)
  ]);

  const regions = buildRegions(admin1, admin0);
  const contextTiles = buildContextTiles(admin1, admin0);

  const outputs = [
    [outputPaths.physical, buildPhysicalMap(land, rivers)],
    [outputPaths.regionSource, buildRegionSource(regions, contextTiles)],
    [outputPaths.factionLabels, buildFactionLabels()]
  ] as const;

  for (const [path, content] of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  }

  console.log(`Rebuilt geo map: ${regions.length} playable regions, ${contextTiles.length} context tiles`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
