import { describe, expect, it } from "vitest";
import { mapTiles } from "../map/generated/mapTiles";
import { mapRegionSource } from "../map/source/mapRegionSource";

/**
 * v0.7.7 回归保护：用 Natural Earth 10m admin1 数据重新生成的边疆 tile
 * （hulunbuir / korchin_steppe / chahar_steppe / tumed_steppe / haixi / jianzhou）
 * 必须保持真实省区边界的复杂形状，不能被改回简单的 4 顶点矩形。
 *
 * 本测试守住以下承诺：
 *   1. 每个 tile 的数据来源必须是 natural-earth-admin1。
 *   2. 每个 tile 至少 10 个顶点（真实省区边界不可能只有 4-6 个顶点）。
 *   3. bbox 长宽比 ≠ 1（非正方形，防止回退到矩形网格）。
 *   4. 顶点都在 mapCanvas viewBox 内。
 *
 * 真实省区边界可能出现 bbox 重叠（如 hulunbuir 与 haixi 在纬度方向有 bbox 交叠），
 * 因此不再用 bbox 两两不重叠作为断言，改由视觉上确认相邻关系。
 */

const HISTORICAL_FRONTIER_TILES = [
  "hulunbuir",
  "korchin_steppe",
  "chahar_steppe",
  "tumed_steppe",
  "haixi",
  "jianzhou"
] as const;

type FrontierTileId = (typeof HISTORICAL_FRONTIER_TILES)[number];

function numericValues(paths: string[]): number[] {
  return paths.flatMap((path) => [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])));
}

function pointsFor(paths: string[]): Array<[number, number]> {
  const values = numericValues(paths);
  return values.reduce<Array<[number, number]>>((acc, _v, index, arr) => {
    if (index % 2 === 1) acc.push([arr[index - 1], arr[index]]);
    return acc;
  }, []);
}

function bboxFor(paths: string[]) {
  const pts = pointsFor(paths);
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  };
}

describe("historical frontier tiles v0.7.7 real province boundaries", () => {
  it("ships natural-earth-admin1 source for all 6 mongol/jurchen tiles", () => {
    for (const id of HISTORICAL_FRONTIER_TILES) {
      const tile = mapTiles.find((t) => t.id === id);
      expect(tile, `${id} should exist in mapTiles`).toBeDefined();
      expect(tile!.source, `${id} should come from real NE admin1 data`).toBe("natural-earth-admin1");
    }
  });

  it("ships non-rectangular polygons for all 6 mongol/jurchen tiles", () => {
    for (const id of HISTORICAL_FRONTIER_TILES) {
      const tile = mapTiles.find((t) => t.id === id);
      expect(tile, `${id} should exist in mapTiles`).toBeDefined();
      const points = pointsFor(tile!.paths);
      expect(points.length, `${id} vertex count`).toBeGreaterThanOrEqual(10);

      const box = bboxFor(tile!.paths);
      const width = box.maxX - box.minX;
      const height = box.maxY - box.minY;
      // 允许 1px 浮点误差，但任何 ≥1.5 比例都视为非正方形
      expect(
        Math.abs(width - height),
        `${id} should not be a near-square (w=${width} h=${height})`
      ).toBeGreaterThan(1.5);
    }
  });

  it("keeps all 6 frontier tile bboxes inside the map viewBox", () => {
    const MAX_X = 1000;
    const MAX_Y = 700;
    for (const id of HISTORICAL_FRONTIER_TILES) {
      const tile = mapTiles.find((t) => t.id === id);
      const box = bboxFor(tile!.paths);
      expect(box.minX, `${id} minX`).toBeGreaterThanOrEqual(0);
      expect(box.minY, `${id} minY`).toBeGreaterThanOrEqual(0);
      expect(box.maxX, `${id} maxX`).toBeLessThanOrEqual(MAX_X);
      expect(box.maxY, `${id} maxY`).toBeLessThanOrEqual(MAX_Y);
    }
  });

  it("authored source and generated output expose identical frontier tile geometry", () => {
    for (const id of HISTORICAL_FRONTIER_TILES) {
      const source = mapRegionSource.find((r) => r.id === id);
      const generated = mapTiles.find((t) => t.id === id);
      expect(source, `${id} in mapRegionSource`).toBeDefined();
      expect(generated, `${id} in mapTiles`).toBeDefined();
      expect(generated!.paths, `${id} generated paths match authored paths`).toEqual(source!.paths);
    }
  });

  it("regression: the 4 frontier tiles most likely to drift stay non-rectangular", () => {
    const highRisk: FrontierTileId[] = ["hulunbuir", "korchin_steppe", "haixi", "jianzhou"];
    for (const id of highRisk) {
      const tile = mapTiles.find((t) => t.id === id);
      const points = pointsFor(tile!.paths);
      const box = bboxFor(tile!.paths);
      expect(points.length, `${id} should have ≥10 vertices`).toBeGreaterThanOrEqual(10);
      expect(
        Math.abs(box.maxX - box.minX - (box.maxY - box.minY)),
        `${id} should not be axis-aligned square`
      ).toBeGreaterThan(1.5);
    }
  });
});
