import { describe, expect, it } from "vitest";
import { mapTiles } from "../map/generated/mapTiles";
import { factionMapLabels } from "../map/generated/factionMapLabels";

/**
 * v0.7.7 回归保护：关键 tile 的 path 位置必须对齐到真实地理省区边界。
 *
 * 本次用 Natural Earth 10m admin1 数据重新生成了蒙古诸部、女真、朝鲜、
 * 漠北、西藏、新疆等地区的边界。这些 expected 中心点是根据当前真实边界
 * 的质心反推得到的经纬度，用于防止后续有人把 path 改回手工矩形或漂移。
 *
 * 投影公式（与 rebuildGeoMap.ts / generateMapRegions.ts 一致）:
 *   x = ((lng - 68) / 80) * 1000
 *   y = ((58 - lat) / 51) * 700
 *
 * 失败 = 有人把 path/label 改离真实地理边界，需要重新对齐。
 */

interface PathPoint {
  x: number;
  y: number;
}

function pointsFor(paths: string[]): PathPoint[] {
  const values = paths.flatMap((path) =>
    [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]))
  );
  const pts: PathPoint[] = [];
  for (let i = 0; i < values.length; i += 2) {
    if (i + 1 < values.length) pts.push({ x: values[i], y: values[i + 1] });
  }
  return pts;
}

function polygonCentroid(paths: string[]): PathPoint {
  const pts = pointsFor(paths);
  const n = pts.length;
  let cx = 0;
  let cy = 0;
  let a2 = 0;
  for (let i = 0; i < n; i += 1) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const cross = p1.x * p2.y - p2.x * p1.y;
    a2 += cross;
    cx += (p1.x + p2.x) * cross;
    cy += (p1.y + p2.y) * cross;
  }
  if (a2 === 0) {
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / n,
      y: pts.reduce((s, p) => s + p.y, 0) / n
    };
  }
  return { x: cx / (3 * a2), y: cy / (3 * a2) };
}

function labelFor(factionId: string, label: string): { x: number; y: number } {
  const entry = factionMapLabels.find((l) => l.factionId === factionId && l.label === label);
  if (!entry) throw new Error(`label ${factionId}/${label} not found`);
  return { x: entry.x, y: entry.y };
}

interface TileLocation {
  id: string;
  expectedCenterLng: number;
  expectedCenterLat: number;
  /** path 质心到投影中心允许的偏移 (px) */
  tolerance: number;
}

const TILES: TileLocation[] = [
  // 6 个 mongol/jurchen tile — 真实省区边界
  { id: "hulunbuir",       expectedCenterLng: 122.00, expectedCenterLat: 48.00, tolerance: 10 },
  { id: "korchin_steppe",  expectedCenterLng: 118.18, expectedCenterLat: 45.74, tolerance: 10 },
  { id: "chahar_steppe",   expectedCenterLng: 111.93, expectedCenterLat: 42.01, tolerance: 10 },
  { id: "tumed_steppe",    expectedCenterLng: 103.48, expectedCenterLat: 40.49, tolerance: 10 },
  { id: "haixi",           expectedCenterLng: 127.74, expectedCenterLat: 47.88, tolerance: 10 },
  { id: "jianzhou",        expectedCenterLng: 125.06, expectedCenterLat: 42.66, tolerance: 10 },
  // context tile — 真实边界
  { id: "hami",            expectedCenterLng: 85.06,  expectedCenterLat: 41.08, tolerance: 15 },
  { id: "liuqiu",          expectedCenterLng: 127.70, expectedCenterLat: 27.45, tolerance: 10 },
  { id: "southeast-asia",  expectedCenterLng: 102.07, expectedCenterLat: 17.61, tolerance: 15 },
  { id: "northeast-asia-edge", expectedCenterLng: 140.02, expectedCenterLat: 45.73, tolerance: 10 }
];

function projLngLat(lng: number, lat: number): { x: number; y: number } {
  return {
    x: ((lng - 68) / 80) * 1000,
    y: ((58 - lat) / 51) * 700
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("v0.7.7 map tile path geographic location", () => {
  for (const tile of TILES) {
    it(`${tile.id} path center matches expected (${tile.expectedCenterLng}E, ${tile.expectedCenterLat}N) within ${tile.tolerance}px`, () => {
      const t = mapTiles.find((mt) => mt.id === tile.id);
      expect(t, `${tile.id} should exist in mapTiles`).toBeDefined();
      const center = polygonCentroid(t!.paths);
      const expected = projLngLat(tile.expectedCenterLng, tile.expectedCenterLat);
      const d = distance(center, expected);
      expect(
        d,
        `${tile.id} centroid (${center.x.toFixed(1)}, ${center.y.toFixed(1)}) ` +
          `should be within ${tile.tolerance}px of (${expected.x.toFixed(1)}, ${expected.y.toFixed(1)}) — actual distance ${d.toFixed(1)}px`
      ).toBeLessThanOrEqual(tile.tolerance);
    });
  }
});

describe("v0.7.7 faction labels align with tile bbox centers", () => {
  const LABEL_CHECK: Array<{ faction: string; label: string; tileId: string }> = [
    { faction: "korchin", label: "呼伦贝尔", tileId: "hulunbuir" },
    { faction: "korchin", label: "科尔沁",   tileId: "korchin_steppe" },
    { faction: "chahar",  label: "察哈尔",   tileId: "chahar_steppe" },
    { faction: "tumed",   label: "土默特",   tileId: "tumed_steppe" },
    { faction: "haixi",   label: "海西女真", tileId: "haixi" },
    { faction: "jianzhou",label: "建州女真", tileId: "jianzhou" },
    { faction: "liuqiu",  label: "琉球",     tileId: "liuqiu" },
    { faction: "southeast-asia", label: "东南亚", tileId: "southeast-asia" },
    { faction: "northeast-asia-edge", label: "东北亚边缘", tileId: "northeast-asia-edge" }
  ];

  for (const { faction, label, tileId } of LABEL_CHECK) {
    it(`${label} label sits inside ${tileId} bbox`, () => {
      const t = mapTiles.find((mt) => mt.id === tileId);
      const pts = pointsFor(t!.paths);
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const lab = labelFor(faction, label);
      expect(lab.x, `${label} labelX in ${tileId} bbox`).toBeGreaterThanOrEqual(minX);
      expect(lab.x, `${label} labelX in ${tileId} bbox`).toBeLessThanOrEqual(maxX);
      expect(lab.y, `${label} labelY in ${tileId} bbox`).toBeGreaterThanOrEqual(minY);
      expect(lab.y, `${label} labelY in ${tileId} bbox`).toBeLessThanOrEqual(maxY);
    });
  }
});

describe("v0.7.7 no frontier tile drifts west of real province boundary", () => {
  // 回归保护：防止后续把真实边界改回偏西的手工多边形。
  // 阈值取当前真实 bbox 西边界再向西留 10px 缓冲。
  const WEST_BOUND: Record<string, number> = {
    hulunbuir: 640,
    korchin_steppe: 590,
    chahar_steppe: 490,
    tumed_steppe: 355,
    haixi: 655,
    jianzhou: 625
  };
  for (const [id, minX] of Object.entries(WEST_BOUND)) {
    it(`${id} bbox minX >= ${minX} (regression guard for west drift)`, () => {
      const t = mapTiles.find((mt) => mt.id === id);
      const pts = pointsFor(t!.paths);
      const actualMinX = Math.min(...pts.map((p) => p.x));
      expect(actualMinX, `${id} drifted west`).toBeGreaterThanOrEqual(minX);
    });
  }
});
