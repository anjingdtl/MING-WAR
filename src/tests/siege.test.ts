import { describe, expect, it } from "vitest";
import type { RegionState } from "../core/types";
import {
  applyCapturePlunder,
  applySiegeMaintenance,
  isUnderSiege,
  tickSiegeDamage,
} from "../core/siege";

/* ===========================================================================
 * v0.9.3 围城 / 工事 / 战利品 — 2026-07-02
 *
 * 设计：让"打不动"和"打得动"都是真实状态。
 * 验收 5 个 use case：
 *   1. tickSiegeDamage 大 army 扣 garrison 多
 *   2. tickSiegeDamage 高 fortification 减伤
 *   3. applyCapturePlunder 给 treasury + stability-15 + rebelPressure+5
 *   4. applySiegeMaintenance 200 金走账本
 *   5. isUnderSiege 判定
 * =========================================================================== */

function makeRegion(overrides: Partial<RegionState> = {}): RegionState {
  return {
    id: "test-region",
    name: "TestRegion",
    terrain: "plain",
    climate: "temperate",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 1000000,
    populationCapacity: 2000000,
    agriculture: 50,
    commerce: 50,
    taxCapacity: 50,
    stability: 80,
    control: 50,
    fortification: 50,
    grainStock: 100000,
    garrison: 30000,
    coreFactionIds: ["ming"],
    connections: [],
    activeDisasters: [],
    rebelPressure: 0,
    logisticsNode: null,
    military: {
      infrastructureLevel: 0,
      seasonalState: "normal",
      localSupport: 50,
      occupationResistance: 0,
      forageCapacity: 0.5,
      strategicValue: 30,
    },
    ...overrides,
  };
}

describe("v0.9.3 围城 / 工事 / 战利品", () => {
  it("tickSiegeDamage：大 committedForce 扣更多 garrison", () => {
    const region = makeRegion({ garrison: 30000, fortification: 20 });
    const small = tickSiegeDamage(region, 8000);
    const large = tickSiegeDamage(region, 80000);
    expect(region.garrison - small.garrison).toBeLessThan(region.garrison - large.garrison);
    expect(large.garrison).toBeGreaterThanOrEqual(1000);
  });

  it("tickSiegeDamage：高 fortification 减伤（伤害更小）", () => {
    const region = makeRegion({ garrison: 30000, fortification: 100 });
    const highFort = tickSiegeDamage(region, 80000);
    const lowFort = tickSiegeDamage({ ...region, fortification: 0 }, 80000);
    // 0 fortification 走 SIEGE_FORT_MIN=1；100 fortification 走 5
    // dmgLow = 80000/8/1 = 10000，dmgHigh = 80000/8/5 = 2000
    expect(highFort.garrison).toBeGreaterThan(lowFort.garrison);
  });

  it("applyCapturePlunder：population × 0.10 × 5 + stability-15 + rebelPressure+5", () => {
    const region = makeRegion({ population: 1000000, stability: 80, rebelPressure: 10 });
    const { region: next, entries } = applyCapturePlunder(region, "ming", "大明");
    const expectedPlunder = 1000000 * 0.10 * 5;
    expect(entries[0]?.amount).toBe(expectedPlunder);
    expect(next.stability).toBe(80 - 15);
    expect(next.rebelPressure).toBe(10 + 5);
    expect(entries[0]?.factionId).toBe("ming");
    expect(entries[0]?.category).toBe("income-tariff");
  });

  it("applySiegeMaintenance：200 金走账本 'expense-construction'", () => {
    const region = makeRegion();
    const entries = applySiegeMaintenance(region, "ming", "大明");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.amount).toBe(-200);
    expect(entries[0]?.category).toBe("expense-construction");
    expect(entries[0]?.factionId).toBe("ming");
  });

  it("isUnderSiege：state.wars 含 targetRegionId 时 true", () => {
    const state = {
      wars: [{ targetRegionId: "liaodong" }],
    } as never;
    expect(isUnderSiege(state, "liaodong")).toBe(true);
    expect(isUnderSiege(state, "beizhili")).toBe(false);
  });
});
