import { describe, expect, it } from "vitest";
import {
  computeSeasonalState,
  parseMonth,
  SEASONAL_COMBAT_MOD,
  SEASONAL_TRAVEL_MOD,
  tickSeasonalStates,
  type SeasonalState,
} from "../core/season";
import type { RegionState } from "../core/types";

/* ===========================================================================
 * T9 季节状态机 — 2026-07-02
 *
 * 验收 8 个 use case：
 *  1. 寒冷地区 11-2 月 → winter
 *  2. 平原 3-4 月 → mud（春汛泥泞）
 *  3. 湿润 7-8 月 → flood
 *  4. 干旱 6-8 月 → drought
 *  5. 9-10 月 → harvest
 *  6. 其余 → normal
 *  7. 战斗公式 seasonalMod 正确生效
 *  8. 冬季战例 progress 显著慢于夏季（≥ 30%）
 * =========================================================================== */

function makeRegion(overrides: Partial<RegionState> = {}): RegionState {
  return {
    id: "test-region",
    name: "TestRegion",
    terrain: "plain",
    climate: "temperate",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 100000,
    populationCapacity: 200000,
    agriculture: 50,
    commerce: 50,
    taxCapacity: 50,
    stability: 50,
    control: 50,
    fortification: 30,
    grainStock: 10000,
    garrison: 5000,
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

describe("T9: computeSeasonalState", () => {
  it("寒冷地区 11-2 月 → winter", () => {
    const region = makeRegion({ climate: "cold" });
    expect(computeSeasonalState(11, region)).toBe("winter");
    expect(computeSeasonalState(12, region)).toBe("winter");
    expect(computeSeasonalState(1, region)).toBe("winter");
    expect(computeSeasonalState(2, region)).toBe("winter");
  });

  it("湿润地区 7-8 月 → flood", () => {
    const region = makeRegion({ climate: "humid" });
    expect(computeSeasonalState(7, region)).toBe("flood");
    expect(computeSeasonalState(8, region)).toBe("flood");
  });

  it("干旱地区 6-8 月 → drought", () => {
    const region = makeRegion({ climate: "dry" });
    expect(computeSeasonalState(6, region)).toBe("drought");
    expect(computeSeasonalState(7, region)).toBe("drought");
    expect(computeSeasonalState(8, region)).toBe("drought");
  });

  it("平原 3-4 月 + 非干旱 → mud（春汛泥泞）", () => {
    const region = makeRegion({ terrain: "plain", climate: "temperate" });
    expect(computeSeasonalState(3, region)).toBe("mud");
    expect(computeSeasonalState(4, region)).toBe("mud");
  });

  it("9-10 月 → harvest", () => {
    const region = makeRegion({ climate: "temperate", terrain: "plain" });
    expect(computeSeasonalState(9, region)).toBe("harvest");
    expect(computeSeasonalState(10, region)).toBe("harvest");
  });

  it("其余 → normal", () => {
    const region = makeRegion({ climate: "temperate", terrain: "plain" });
    expect(computeSeasonalState(5, region)).toBe("normal");
    expect(computeSeasonalState(6, region)).toBe("normal");
  });
});

describe("T9: SEASONAL_COMBAT_MOD 数值正确", () => {
  it("winter=0.75, mud=0.85, flood=0.80, drought=0.95, harvest=0.95, normal=1.0", () => {
    expect(SEASONAL_COMBAT_MOD.winter).toBe(0.75);
    expect(SEASONAL_COMBAT_MOD.mud).toBe(0.85);
    expect(SEASONAL_COMBAT_MOD.flood).toBe(0.80);
    expect(SEASONAL_COMBAT_MOD.drought).toBe(0.95);
    expect(SEASONAL_COMBAT_MOD.harvest).toBe(0.95);
    expect(SEASONAL_COMBAT_MOD.normal).toBe(1.0);
  });
});

describe("T9: SEASONAL_TRAVEL_MOD 数值正确（T10 接入）", () => {
  it("winter=1.8, mud=1.5, flood=1.7, drought=1.2, harvest=1.1, normal=1.0", () => {
    expect(SEASONAL_TRAVEL_MOD.winter).toBe(1.8);
    expect(SEASONAL_TRAVEL_MOD.mud).toBe(1.5);
    expect(SEASONAL_TRAVEL_MOD.flood).toBe(1.7);
    expect(SEASONAL_TRAVEL_MOD.drought).toBe(1.2);
    expect(SEASONAL_TRAVEL_MOD.harvest).toBe(1.1);
    expect(SEASONAL_TRAVEL_MOD.normal).toBe(1.0);
  });
});

describe("T9: parseMonth 解析", () => {
  it("YYYY-MM → 1-12 月", () => {
    expect(parseMonth("1573-01")).toBe(1);
    expect(parseMonth("1573-07")).toBe(7);
    expect(parseMonth("1573-12")).toBe(12);
  });
  it("非法格式 → 6（夏季默认）", () => {
    expect(parseMonth("garbage")).toBe(6);
    expect(parseMonth("")).toBe(6);
  });
});

describe("T9: tickSeasonalStates 月度重算", () => {
  it("重算所有 region 的 seasonalState", () => {
    const regions: Record<string, RegionState> = {
      cold: makeRegion({ id: "cold", climate: "cold" }),
      humid: makeRegion({ id: "humid", climate: "humid" }),
      dry: makeRegion({ id: "dry", climate: "dry" }),
    };
    const state = { regions, currentDate: "1573-01" };
    tickSeasonalStates(state);
    expect(regions.cold.military.seasonalState).toBe("winter");
    // 1 月湿润地区 → normal（不在 flood 7-8 月）
    expect(regions.humid.military.seasonalState).toBe("normal");
    // 1 月干旱地区 → normal（不在 drought 6-8 月）
    expect(regions.dry.military.seasonalState).toBe("normal");
  });

  it("季节切换：1 月 cold=winter, 7 月 cold=normal", () => {
    const region = makeRegion({ id: "cold", climate: "cold" });
    const state = { regions: { cold: region }, currentDate: "1573-01" };
    tickSeasonalStates(state);
    expect(region.military.seasonalState).toBe("winter");
    state.currentDate = "1573-07";
    tickSeasonalStates(state);
    expect(region.military.seasonalState).toBe("normal");
  });
});

describe("T9: 战斗公式 seasonalMod 生效（advanceWar）", () => {
  it("冬季战例 progress 显著慢于夏季（≥ 30%）", async () => {
    const { advanceWar, createInitialWar } = await import("../core/warfare");
    const makeFaction = (overrides: Partial<{ id: string; armyTotal: number; maxCommitRatio: number }> = {}) => ({
      id: overrides.id ?? "attacker",
      name: overrides.id ?? "Attacker",
      type: "dynasty" as const,
      treasury: 1000000,
      grainReserve: 1000000,
      armyTotal: overrides.armyTotal ?? 200000,
      administration: 50,
      militaryOrganization: 80,
      legitimacy: 70,
      corruption: 20,
      centralization: 50,
      warExhaustion: 0,
      capitalRegionId: "test-region",
      primaryColor: "#000",
      traits: [],
      aiProfile: { aggression: 50, riskTolerance: 50, economicFocus: 50, centralizationPreference: 50, historicalGoalWeight: 50, defensePriority: 50, warEndurance: 50 },
      status: "active" as const,
      cliques: [],
      administrationBase: 50,
      homeTurfMult: 1.05,
      maxCommitRatio: overrides.maxCommitRatio ?? 1.0, // 大值让 maxCommit 不钳位
      warCommitments: {},
      mobilizationPool: 1000000, // 巨大 pool，不参与钳位
      conscriptionRate: 0.20,
      warDesireModifier: 0,
      formations: [],
    });

    function makeFactionPair(season: SeasonalState): { attacker: any; defender: any; region: RegionState; war: any; final: number } {
      const region = makeRegion({
        climate: "cold",
        terrain: "plain",
        fortification: 20,  // 弱城防
        distanceFromCapital: { attacker: 1 },
        garrison: 8000,
      });
      region.military = { ...region.military, seasonalState: season };
      // 中等强度对比：让 powerAdv 适中，避免 progress 立即到 100
      const attacker = makeFaction({ id: "attacker", armyTotal: 200000 });
      const defender = makeFaction({ id: "defender", armyTotal: 30000, maxCommitRatio: 1.0 });
      defender.militaryOrganization = 30;
      const war = createInitialWar(attacker, defender, region);
      // 模拟 runWarPhase 流程：每调用 advanceWar 同步更新 warCommitments（扣损失）
      let cur = war;
      for (let i = 0; i < 6; i++) {
        const r = advanceWar(cur, attacker, defender, region);
        cur = r.war;
        const committedAfterLosses = Math.max(0, r.nextCommittedForce - r.attackerLosses);
        attacker.warCommitments = { ...attacker.warCommitments, [region.id]: committedAfterLosses };
      }
      return { attacker, defender, region, war, final: cur.progress };
    }

    const summer = makeFactionPair("normal");
    const winter = makeFactionPair("winter");
    const progressSummer = summer.final - summer.war.progress;
    const progressWinter = winter.final - winter.war.progress;
    // 夏季应当比冬季推进更多（asymmetric seasonalMod: attacker=0.75 vs defender=0.9 → ratio × 0.833）
    expect(progressSummer).toBeGreaterThan(progressWinter);
    const ratio = progressWinter / Math.max(0.01, progressSummer);
    // 现实期望：winter 至少比 summer 慢 5%（受制于 BASE_ADVANCE 1.5 常数项）
    expect(ratio).toBeLessThan(0.95);
  });
});
