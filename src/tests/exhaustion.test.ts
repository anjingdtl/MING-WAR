import { describe, expect, it } from "vitest";
import type { FactionState } from "../core/types";
import {
  applyWarWearEffect,
  computeFatigueDelta,
  deescalateWeightBonus,
} from "../core/exhaustion";

/* ===========================================================================
 * v0.9.4 战争疲劳 / 厌战 — 2026-07-02
 *
 * 设计：让"打得久"反噬政权。
 * 验收 3 个 use case：
 *   1. computeFatigueDelta 累加（base 0.5 + duration × 0.2 - win）
 *   2. deescalateWeightBonus 三档（0/30/60/100）
 *   3. applyWarWearEffect 出账本 expense-court
 * =========================================================================== */

function makeFaction(overrides: Partial<FactionState> = {}): FactionState {
  return {
    id: "test-faction",
    name: "TestFaction",
    type: "dynasty",
    treasury: 1000000,
    grainReserve: 1000000,
    armyTotal: 50000,
    administration: 50,
    militaryOrganization: 60,
    legitimacy: 70,
    corruption: 20,
    centralization: 50,
    warExhaustion: 0,
    capitalRegionId: "test-region",
    primaryColor: "#000",
    traits: [],
    aiProfile: {
      aggression: 50, riskTolerance: 50, economicFocus: 50,
      centralizationPreference: 50, historicalGoalWeight: 50,
      defensePriority: 50, warEndurance: 50,
    },
    status: "active",
    cliques: [],
    administrationBase: 50,
    homeTurfMult: 1.0,
    maxCommitRatio: 0.30,
    warCommitments: {},
    mobilizationPool: 10000,
    conscriptionRate: 0.15,
    warDesireModifier: 0,
    formations: [],
    ...overrides,
  };
}

describe("v0.9.4 战争疲劳 / 厌战", () => {
  it("computeFatigueDelta：base 0.5 + duration × 0.2 - 胜奖励 0.5", () => {
    const faction = makeFaction();
    const u = computeFatigueDelta(faction, 0, 0, 5);
    // delta = 0.5 + 0 + 0.2*5 - 0.5*0 = 1.5；新值 = 1.5
    expect(u.newFatigue).toBe(1.5);

    const u2 = computeFatigueDelta({ ...faction, warFatigue: 50 }, 10000, 1, 10);
    // delta = 0.5 + 0.4 + 0.2*10 - 0.5*1 = 2.4；新值 = 52.4
    expect(u2.newFatigue).toBeCloseTo(52.4, 1);
  });

  it("deescalateWeightBonus：四档（0/30/60/100）", () => {
    expect(deescalateWeightBonus(makeFaction({ warFatigue: 0 }))).toBe(0);
    expect(deescalateWeightBonus(makeFaction({ warFatigue: 50 }))).toBe(0);
    expect(deescalateWeightBonus(makeFaction({ warFatigue: 70 }))).toBe(30);
    expect(deescalateWeightBonus(makeFaction({ warFatigue: 99 }))).toBe(30);
    expect(deescalateWeightBonus(makeFaction({ warFatigue: 100 }))).toBe(60);
    expect(deescalateWeightBonus(makeFaction({ warFatigue: 130 }))).toBe(100);
    expect(deescalateWeightBonus(makeFaction({ warFatigue: 200 }))).toBe(100);
  });

  it("applyWarWearEffect：treasury × 0.05 走 expense-court", () => {
    const faction = makeFaction({ treasury: 1000000 });
    const effect = applyWarWearEffect(faction, "1573-01");
    expect(effect.stabilityHit).toBe(2);
    expect(effect.treasuryLoss).toBe(50000); // 1000000 * 0.05
    expect(effect.entries[0]?.category).toBe("expense-court");
    expect(effect.entries[0]?.amount).toBe(-50000);
    expect(effect.entries[0]?.factionId).toBe("test-faction");
  });
});
