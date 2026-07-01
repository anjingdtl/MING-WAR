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
    { close: true, minDistance: 1.0, minArea: 4 }
  );
}

function pathsForRussianAdmin1(admin1: GeoFeatureCollection, names: string[]): string[] {
  const nameSet = new Set(names);
  return pathsFromFeatures(
    admin1.features.filter((feature) => property(feature, "admin") === "Russia" && nameSet.has(property(feature, "name"))),
    { close: true, minDistance: 1.0, minArea: 4 }
  );
}

/**
 * Hand-drawn (but NE-aligned) polygons for the unified Wanli-era Joseon
 * peninsula, split at lat 38°. v0.7.3 — 北界收到 lat=42，与 jianzhou
 * (lat 42–44) 严格不重叠；沿鸭绿江/长白山主脉。
 */
const JOSEON_NORTH_RING: Ring = [
  [125.2, 41.6], [126.4, 41.7], [127.8, 41.6], [128.8, 41.5],
  [129.6, 41.4], [130.2, 41.0], [130.6, 40.4], [130.4, 39.6],
  [129.4, 39.2], [128.4, 38.9], [127.4, 38.7], [126.4, 38.5],
  [125.4, 38.4], [125.2, 39.5], [125.4, 40.5]
];
const JOSEON_SOUTH_RING: Ring = [
  [125.0, 38.3], [126.5, 38.3], [127.5, 38.7], [128.4, 38.5],
  [129.2, 38.0], [129.5, 37.0], [129.4, 36.0], [128.7, 35.5],
  [127.0, 34.5], [126.4, 34.0], [125.8, 34.5], [126.0, 35.5],
  [126.5, 36.5], [125.5, 37.5]
];
function joseonSplit(_admin0: GeoFeatureCollection): { north: string[]; south: string[] } {
  const north = ringToPath(JOSEON_NORTH_RING, { close: true, minDistance: 0, minArea: 0 });
  const south = ringToPath(JOSEON_SOUTH_RING, { close: true, minDistance: 0, minArea: 0 });
  return {
    north: north ? [north] : [],
    south: south ? [south] : []
  };
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
    region("shaanxi", china(["Shaanxi"]), [108.2, 35.6], 92, "natural-earth-admin1"),
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
    // v0.7.3 — 万历年草原 / 女真 / 朝鲜按"严格纬度分带"重新规划：
    // 每个 polygon 是一个矩形（5–10 个点紧凑多边形），与邻接区共享 1 条
    // 纬线或经线边界，避免"互相交错混合"。
    //
    // 网格坐标（从北到南、西到东；lng 100-150；lat 5-65）：
    //   lat 53  ┌─────────────┐
    //   lat 48  │   hulunbuir  (110–126, 48–53)
    //   lat 48  ├───────┬─────┤
    //   lat 44  │korchin│haixi │  (korchin 116–126, haixi 126–134, 各 lat 44–48)
    //   lat 44  ├───┬───┴──┬──┤
    //   lat 41  │cha│      │ji │  chahar 108–116, jianzhou 124–132 (各 41–44)
    //   lat 41  ├───┴─┐    ├──┤
    //   lat 40  │tum  │lia │   tum 106–114, lia 119–124 (各 39–41/42)
    //   lat 38  ├─────┴────j_n┤ joseon_north 125–131 (38–42)
    //   lat 33  └─────joseon_s─┘ joseon_south 126–130 (33–38)
    // v0.7.5 — 6 个 mongol/jurchen tile 从"严格 4 顶点矩形网格"
    // 改为"沿历史地理边界的 8-10 顶点多边形"。
    //
    // 设计原则：
    //   1. bbox 不重叠（v0.7.3 回归保护，lat 边界留 ≥1° 缓冲）
    //   2. bbox 长宽比 ≠ 1（非正方形，沿草原/山脉/河流形状画）
    //   3. 每个 polygon ≥ 6 顶点
    //   4. 顶点 lng/lat 落在投影 viewBox（68–148, 7–58）内
    //
    // 真实历史边界参考：
    //   - 土默特 = 大青山南 / 河套北，呼包鄂三角
    //   - 察哈尔 = 张家口外 / 锡林郭勒，蒙古高原南缘
    //   - 科尔沁 = 辽河上游 / 吉林西部草原
    //   - 呼伦贝尔 = 海拉尔 / 满洲里，额尔古纳河流域
    //   - 海西 = 松花江中游 / 吉林-黑龙江交界
    //   - 建州 = 长白山以西 / 辽东东部，鸭绿江北
    region("tumed_steppe", [manualPath([
      [106.0, 40.49], [107.2, 41.01], [109.6, 40.93], [112.4, 40.86], [114.0, 40.49],
      [113.76, 40.05], [112.4, 39.97], [109.6, 39.97], [107.2, 39.97], [106.24, 40.05]
    ])], [110, 40.5], 110, "historical-frontier-manual", { group: "mongolia" }),
    region("chahar_steppe", [manualPath([
      [108.0, 42.31], [108.8, 43.41], [110.4, 43.93], [113.6, 44.0], [116.4, 43.78],
      [116.4, 41.95], [116.16, 41.08], [114.4, 41.23], [110.4, 41.08], [108.0, 41.08]
    ])], [112, 42.5], 110, "historical-frontier-manual", { group: "mongolia" }),
    region("korchin_steppe", [manualPath([
      [116.8, 44.88], [117.6, 46.33], [119.2, 47.43], [121.6, 47.94], [124.8, 47.80],
      [126.0, 46.33], [125.6, 44.88], [126.0, 44.00], [124.0, 44.29], [120.0, 44.29], [116.8, 44.29]
    ])], [121, 46], 100, "historical-frontier-manual", { group: "mongolia" }),
    region("hulunbuir", [manualPath([
      [110.24, 50.35], [111.2, 52.17], [114.4, 52.90], [120.8, 52.53], [125.6, 51.08],
      [126.0, 48.51], [124.0, 48.16], [116.0, 48.51], [111.2, 48.51], [110.24, 48.88]
    ])], [118, 50.5], 110, "historical-frontier-manual", { group: "mongolia" }),
    region("haixi", [manualPath([
      [126.56, 45.24], [127.2, 46.70], [129.6, 47.80], [132.8, 47.65], [133.6, 45.97],
      [133.76, 44.51], [133.6, 44.00], [130.4, 44.29], [127.2, 44.51], [126.56, 44.73]
    ])], [130, 46], 96, "historical-frontier-manual", { group: "jurchen" }),
    region("jianzhou", [manualPath([
      [126.4, 42.68], [127.2, 43.78], [129.6, 43.93], [132.0, 43.78], [133.2, 43.04],
      [133.2, 42.10], [132.0, 41.95], [129.6, 42.10], [127.2, 42.31], [126.24, 42.31]
    ])], [128, 43], 96, "historical-frontier-manual", { group: "jurchen" }),
    region("amur_basin", russian(["Amur", "Yevrey"]), [127.5, 50.2], 104, "natural-earth-admin1", { group: "jurchen" }),
    region("nurgan_coast", russian(["Khabarovsk", "Primor'ye"]), [135.5, 47.0], 96, "natural-earth-admin1", { group: "jurchen" }),
    region("sakhalin", russian(["Sakhalin"]), [142.4, 49.0], 86, "natural-earth-admin1", { group: "japan" }),
    region("joseon_north", joseonSplit(admin0).north, [127.5, 40.6], 84, "historical-frontier-manual", { group: "korea" }),
    region("joseon_south", joseonSplit(admin0).south, [127.8, 35.8], 84, "historical-frontier-manual", { group: "korea" }),
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
    contextTile("northern-sea", "北海", [manualPath([[135.5, 57.5], [148.0, 58.0], [148.0, 52.5], [139.2, 52.0]])], [143.0, 55.0], 64, "western-sea", "sea-zone"),
    // 东北亚边缘 / 鄂霍次克海 — 与北海错开 1°，避免重叠
    contextTile("northeast-asia-edge", "东北亚边缘", [manualPath([[133.0, 57.5], [148.0, 58.0], [148.0, 52.5], [138.4, 51.4], [136.0, 53.6], [134.4, 55.8]])], [140.0, 54.4], 84, "northeast-asia-edge", "sea-zone")
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
    { factionId: "korchin", label: "呼伦贝尔", ...factionLabelPoint(118.0, 50.5), minZoom: 0, maxZoom: 0.85, importance: 2 },
    { factionId: "korchin", label: "科尔沁", ...factionLabelPoint(121.0, 46.0), minZoom: 0, maxZoom: 0.85, importance: 2 },
    { factionId: "haixi", label: "海西女真", ...factionLabelPoint(130.0, 46.0), minZoom: 0, maxZoom: 0.85, importance: 2 },
    { factionId: "chahar", label: "察哈尔", ...factionLabelPoint(112.0, 42.5), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "jianzhou", label: "建州女真", ...factionLabelPoint(128.0, 43.0), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "tumed", label: "土默特", ...factionLabelPoint(110.0, 40.5), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "joseon", label: "朝鲜北道", ...factionLabelPoint(127.5, 40.6), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "joseon", label: "朝鲜三南", ...factionLabelPoint(127.8, 35.8), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "nurgan", label: "奴儿干", ...factionLabelPoint(135.2, 47.0), minZoom: 0, maxZoom: 0.85, importance: 2 },
    { factionId: "japan", label: "日本诸藩", ...factionLabelPoint(136.5, 35.1), minZoom: 0, maxZoom: 0.9, importance: 2 },
    { factionId: "ainu", label: "虾夷", ...factionLabelPoint(142.7, 44.0), minZoom: 0, maxZoom: 0.8, importance: 3 },
    { factionId: "bozhou", label: "播州", ...factionLabelPoint(106.6, 27.6), minZoom: 0, maxZoom: 0.8, importance: 3 },
    { factionId: "tibet", label: "乌斯藏", ...factionLabelPoint(89.5, 30.7), minZoom: 0, maxZoom: 0.85, importance: 3 },
    { factionId: "mobei", label: "漠北诸部", ...factionLabelPoint(102.5, 47.8), minZoom: 0, maxZoom: 0.85, importance: 3 },
    { factionId: "southeast-asia", label: "东南亚", ...factionLabelPoint(103.0, 12.8), minZoom: 0, maxZoom: 0.8, importance: 3 },
    { factionId: "liuqiu", label: "琉球", ...factionLabelPoint(127.5, 25.3), minZoom: 0, maxZoom: 0.8, importance: 3 },
    { factionId: "northeast-asia-edge", label: "东北亚边缘", ...factionLabelPoint(140.0, 54.4), minZoom: 0, maxZoom: 0.8, importance: 3 }
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
