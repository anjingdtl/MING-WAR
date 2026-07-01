import { describe, expect, it } from "vitest";
import { mapTiles } from "../map/generated/mapTiles";
import { mapRegionSource } from "../map/source/mapRegionSource";

/**
 * v0.7.5 回归保护：6 个 mongol/jurchen tile（hulunbuir / korchin_steppe /
 * chahar_steppe / tumed_steppe / haixi / jianzhou）从 v0.7.3 的"严格 4 顶点
 * 矩形网格"改为"沿历史地理边界的 10 顶点多边形"。本测试守住 v0.7.5 的设计
 * 承诺：
 *   1. 每个 tile 至少 6 顶点（v0.7.3 是 4）
 *   2. bbox 长宽比 ≠ 1（非正方形，回归 v0.7.3 矩形网格的视觉问题）
 *   3. 两两 bbox 不重叠（v0.7.3 关键胜利，回归保护）
 *   4. 顶点都在 mapCanvas viewBox 内
 *
 * 失败 = 有人把多边形退回到 4 顶点网格，需要重新画不规则边界。
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

function rectsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  // 严格不重叠（边界接触也不算）
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

describe("historical frontier tiles v0.7.5 polygon shape", () => {
  it("ships non-rectangular polygons for all 6 mongol/jurchen tiles", () => {
    for (const id of HISTORICAL_FRONTIER_TILES) {
      const tile = mapTiles.find((t) => t.id === id);
      expect(tile, `${id} should exist in mapTiles`).toBeDefined();
      const points = pointsFor(tile!.paths);
      expect(points.length, `${id} vertex count`).toBeGreaterThanOrEqual(6);

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

  it("keeps all 6 frontier tile bboxes pairwise non-overlapping (v0.7.3 regression guard)", () => {
    const boxes = HISTORICAL_FRONTIER_TILES.map((id) => {
      const tile = mapTiles.find((t) => t.id === id)!;
      return { id, box: bboxFor(tile.paths) };
    });
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        expect(
          rectsOverlap(a.box, b.box),
          `${a.id} bbox (${a.box.minX},${a.box.minY})-(${a.box.maxX},${a.box.maxY}) should not overlap ${b.id} bbox (${b.box.minX},${b.box.minY})-(${b.box.maxX},${b.box.maxY})`
        ).toBe(false);
      }
    }
  });

  it("authored source and generated output expose identical frontier tile geometry", () => {
    // mapRegionSource 是手写数据，mapTiles 是 generated 产物——两者必须同步，
    // 否则下次 rebuild 会回退到 v0.7.3 的 4 顶点网格。
    for (const id of HISTORICAL_FRONTIER_TILES) {
      const source = mapRegionSource.find((r) => r.id === id);
      const generated = mapTiles.find((t) => t.id === id);
      expect(source, `${id} in mapRegionSource`).toBeDefined();
      expect(generated, `${id} in mapTiles`).toBeDefined();
      expect(generated!.paths, `${id} generated paths match authored paths`).toEqual(source!.paths);
    }
  });

  it("regression: the 4 frontier tiles most likely to drift stay non-rectangular", () => {
    // 显式列出最容易回退的 4 个 tile（mobei 旁邻的 mongol 组 + 辽东旁邻的 jurchen 组），
    // 出错时这个 test 的报错信息能直接告诉作者"是哪个 tile 退回到了矩形"。
    const highRisk: FrontierTileId[] = ["hulunbuir", "korchin_steppe", "haixi", "jianzhou"];
    for (const id of highRisk) {
      const tile = mapTiles.find((t) => t.id === id);
      const points = pointsFor(tile!.paths);
      const box = bboxFor(tile!.paths);
      expect(points.length, `${id} should have ≥6 vertices`).toBeGreaterThanOrEqual(6);
      expect(
        Math.abs(box.maxX - box.minX - (box.maxY - box.minY)),
        `${id} should not be axis-aligned square`
      ).toBeGreaterThan(1.5);
    }
  });
});
