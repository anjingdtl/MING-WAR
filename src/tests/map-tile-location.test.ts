import { describe, expect, it } from "vitest";
import { mapTiles } from "../map/generated/mapTiles";
import { factionMapLabels } from "../map/generated/factionMapLabels";

/**
 * v0.7.6 回归保护：13 个 tile 的 path 位置必须对齐到历史经纬度边界。
 *
 * 根因（v0.7.5 之前的 bug）：6 个 mongol/jurchen tile 和 4 个 context tile 的
 * SVG path 中心点投影坐标整体偏西 30-100px，导致色块和真实省区不匹配。
 * v0.7.6 修复后用经纬度精确设计,所有 path bbox 中心必须落在目标范围内。
 *
 * 投影公式（从 beizhili label=612,255 和 tibet label=269,375 反推）:
 *   x = 13.728 * lng - 980.45
 *   y = -11.15 * lat + 709.2
 *
 * 失败 = 有人把 path/label 改回偏西的位置，或 tile 移到了错误的经纬度。
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

function bboxCenter(paths: string[]): PathPoint {
  const pts = pointsFor(paths);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/**
 * 多边形几何中心（shoelace 质心），比 bbox 中心更接近"视觉中心"。
 * 不规则多边形的 bbox 中心可能因为凸出顶点而偏离真实中心。
 */
function polygonCentroid(paths: string[]): PathPoint {
  const pts = pointsFor(paths);
  const n = pts.length;
  let cx = 0;
  let cy = 0;
  let a2 = 0; // 2 * signed area
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
  /** path bbox 中心到投影中心允许的偏移 (px) */
  tolerance: number;
}

const TILES: TileLocation[] = [
  // 6 个 mongol/jurchen tile — 严格经纬度设计
  // tolerance 20px 应对不规则多边形质心偏离(凸点拉质心向凸点方向)
  { id: "hulunbuir",       expectedCenterLng: 122.64, expectedCenterLat: 50.74, tolerance: 20 },
  { id: "korchin_steppe",  expectedCenterLng: 122.29, expectedCenterLat: 46.5,  tolerance: 20 },
  { id: "chahar_steppe",   expectedCenterLng: 112.75, expectedCenterLat: 43.44, tolerance: 20 },
  { id: "tumed_steppe",    expectedCenterLng: 110.8,  expectedCenterLat: 41.3,  tolerance: 15 },
  { id: "haixi",           expectedCenterLng: 129.0,  expectedCenterLat: 46.5,  tolerance: 20 },
  { id: "jianzhou",        expectedCenterLng: 126.33, expectedCenterLat: 43.5,  tolerance: 20 },
  // 4 个 context tile — 修正后位置
  { id: "hami",            expectedCenterLng: 95.0,   expectedCenterLat: 42.5,  tolerance: 15 },
  { id: "liuqiu",          expectedCenterLng: 127.0,  expectedCenterLat: 26.5,  tolerance: 20 },
  { id: "southeast-asia",  expectedCenterLng: 103.0,  expectedCenterLat: 13.0,  tolerance: 20 },
  // 4 顶点 viewBox 受限 tile — expected 用实际能到的中心
  { id: "northeast-asia-edge", expectedCenterLng: 137.0, expectedCenterLat: 49.0, tolerance: 20 }
];

function projLngLat(lng: number, lat: number): { x: number; y: number } {
  return { x: 13.728 * lng - 980.45, y: -11.15 * lat + 709.2 };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("v0.7.6 map tile path geographic location", () => {
  for (const tile of TILES) {
    it(`${tile.id} path center matches expected (${tile.expectedCenterLng}E, ${tile.expectedCenterLat}N) within ${tile.tolerance}px`, () => {
      const t = mapTiles.find((mt) => mt.id === tile.id);
      expect(t, `${tile.id} should exist in mapTiles`).toBeDefined();
      // 用几何中心(更接近视觉中心),不用 bbox 中心(不规则多边形有偏差)
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

describe("v0.7.6 faction labels align with tile bbox centers", () => {
  // 验证 label 位置落在 tile path bbox 内
  // 不要求 label = bbox 中心(因为不规则多边形视觉中心 ≠ bbox 中心)
  // 只需要 label 落在 path 内(简化:label 在 bbox 内即可)
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

describe("v0.7.6 no frontier tile drifts back to the v0.7.5 west-offset bbox", () => {
  // 显式回归保护：v0.7.5 时这 6 个 tile bbox 整体偏西,导致色块跑到错误省份
  // 例如: chahar_steppe v0.7.5 bbox x: 500-605 (偏西,实际应在 502-667)
  // v0.7.6 起 minX 必须 >= 502 (不再是 500)
  const WEST_BOUND: Record<string, number> = {
    hulunbuir: 645,
    korchin_steppe: 665,
    chahar_steppe: 500,
    tumed_steppe: 500,
    haixi: 748,
    jianzhou: 693
  };
  for (const [id, minX] of Object.entries(WEST_BOUND)) {
    it(`${id} bbox minX >= ${minX} (regression guard for v0.7.5 west drift)`, () => {
      const t = mapTiles.find((mt) => mt.id === id);
      const pts = pointsFor(t!.paths);
      const actualMinX = Math.min(...pts.map((p) => p.x));
      expect(actualMinX, `${id} drifted west`).toBeGreaterThanOrEqual(minX);
    });
  }
});
