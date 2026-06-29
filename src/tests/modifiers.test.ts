import { describe, expect, it } from "vitest";
import type { Modifier } from "../core/types";
import { expireModifiers, addModifier, removeModifiers, aggregateModifierEffect, queryModifier } from "../core/modifiers";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("expireModifiers", () => {
  it("removes modifiers with remainingMonths that reach 0", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", remainingMonths: 1, effects: {} },
      { id: "m2", label: "test2", scope: "global", remainingMonths: 3, effects: {} }
    ];
    const result = expireModifiers(modifiers);
    // After decrement: m1 has 0 → removed; m2 has 2 → kept
    expect(result.map((m) => m.id)).toEqual(["m2"]);
    expect(result[0].remainingMonths).toBe(2);
  });

  it("decrements remainingMonths by 1 for non-expired modifiers", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", remainingMonths: 5, effects: {} }
    ];
    const result = expireModifiers(modifiers);
    expect(result[0].remainingMonths).toBe(4);
  });

  it("handles modifiers with no remainingMonths (permanent)", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", effects: {} }
    ];
    const result = expireModifiers(modifiers);
    expect(result[0].remainingMonths).toBeUndefined();
    expect(result.length).toBe(1);
  });

  it("removes all modifiers if all expire", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", remainingMonths: 1, effects: {} },
      { id: "m2", label: "test2", scope: "global", remainingMonths: 1, effects: {} }
    ];
    const result = expireModifiers(modifiers);
    expect(result).toEqual([]);
  });
});

describe("addModifier", () => {
  it("appends a new modifier to the list", () => {
    const initial: Modifier[] = [];
    const newMod: Modifier = { id: "m1", label: "test", scope: "global", remainingMonths: 3, effects: {} };
    const result = addModifier(initial, newMod);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("m1");
  });

  it("preserves existing modifiers when adding new ones", () => {
    const initial: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", remainingMonths: 3, effects: {} }
    ];
    const newMod: Modifier = { id: "m2", label: "test2", scope: "global", remainingMonths: 5, effects: {} };
    const result = addModifier(initial, newMod);
    expect(result.length).toBe(2);
  });
});

describe("removeModifiers", () => {
  it("removes modifiers matching predicate", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", remainingMonths: 3, effects: {} },
      { id: "m2", label: "test2", scope: "global", remainingMonths: 5, effects: {} }
    ];
    const result = removeModifiers(modifiers, (m) => m.id === "m1");
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("m2");
  });
});

describe("aggregateModifierEffect", () => {
  it("sums additive modifiers", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", effects: { taxBoost: 0.1 }, stacking: "add" },
      { id: "m2", label: "test2", scope: "global", effects: { taxBoost: 0.2 }, stacking: "add" }
    ];
    expect(aggregateModifierEffect(modifiers, "taxBoost")).toBeCloseTo(0.3);
  });

  it("multiplies multiplicative modifiers", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", effects: { efficiency: 0.1 }, stacking: "multiply" },
      { id: "m2", label: "test2", scope: "global", effects: { efficiency: 0.2 }, stacking: "multiply" }
    ];
    const result = aggregateModifierEffect(modifiers, "efficiency");
    expect(result).toBeCloseTo(0.3);
  });

  it("uses highest value for replace modifiers", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", effects: { cap: 0.1 }, stacking: "replace" },
      { id: "m2", label: "test2", scope: "global", effects: { cap: 0.5 }, stacking: "replace" }
    ];
    expect(aggregateModifierEffect(modifiers, "cap")).toBe(0.5);
  });

  it("returns 0 when no modifiers match", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", effects: { other: 0.5 } }
    ];
    expect(aggregateModifierEffect(modifiers, "taxBoost")).toBe(0);
  });
});

describe("P0-3: simulation automatically expires modifiers", () => {
  it("removes modifiers with remainingMonths=1 after one month", () => {
    const state = createMvpScenario("ming", 7);
    state.activeModifiers = [
      { id: "test-mod", label: "Test", scope: "global", remainingMonths: 1, effects: { taxBoost: 0.1 } }
    ];

    const afterOneMonth = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: 1
    }).nextState;

    expect(afterOneMonth.activeModifiers.find((m) => m.id === "test-mod")).toBeUndefined();
  });

  it("keeps modifiers with remainingMonths=5 after one month", () => {
    const state = createMvpScenario("ming", 8);
    state.activeModifiers = [
      { id: "long-mod", label: "Long", scope: "global", remainingMonths: 5, effects: {} }
    ];

    const afterOneMonth = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: 1
    }).nextState;

    const mod = afterOneMonth.activeModifiers.find((m) => m.id === "long-mod");
    expect(mod).toBeDefined();
    expect(mod?.remainingMonths).toBe(4);
  });

  it("keeps permanent modifiers (no remainingMonths) forever", () => {
    const state = createMvpScenario("ming", 9);
    state.activeModifiers = [
      { id: "permanent", label: "Permanent", scope: "global", effects: {} }
    ];

    let current = state;
    for (let i = 0; i < 24; i++) {
      current = simulateMonth({
        state: current,
        playerDecision: defaultPlayerDecision,
        randomSeed: current.seed
      }).nextState;
    }

    expect(current.activeModifiers.find((m) => m.id === "permanent")).toBeDefined();
  });
});

describe("queryModifier", () => {
  it("cascades global → faction → region for a region query", () => {
    const mods: Modifier[] = [
      { id: "g", label: "g", scope: "global", effects: { "tax-mult": 0.1 } },
      { id: "f", label: "f", scope: "faction", targetId: "ming", effects: { "tax-mult": 0.2 } },
      { id: "r", label: "r", scope: "region", targetId: "beizhili", effects: { "tax-mult": 0.05 } },
      { id: "other", label: "o", scope: "faction", targetId: "jianzhou", effects: { "tax-mult": 0.9 } }
    ];
    // beizhili controlled by ming: global(0.1) + ming faction(0.2) + beizhili region(0.05)
    expect(queryModifier(mods, "region", "beizhili", "tax-mult", "ming")).toBeCloseTo(0.35);
  });

  it("faction query includes global + that faction only", () => {
    const mods: Modifier[] = [
      { id: "g", label: "g", scope: "global", effects: { "tax-mult": 0.1 } },
      { id: "f", label: "f", scope: "faction", targetId: "ming", effects: { "tax-mult": 0.2 } },
      { id: "other", label: "o", scope: "faction", targetId: "jianzhou", effects: { "tax-mult": 0.9 } }
    ];
    expect(queryModifier(mods, "faction", "ming", "tax-mult")).toBeCloseTo(0.3);
  });

  it("returns 0 when no modifiers match the key", () => {
    const mods: Modifier[] = [
      { id: "g", label: "g", scope: "global", effects: { other: 0.1 } }
    ];
    expect(queryModifier(mods, "region", "beizhili", "tax-mult", "ming")).toBe(0);
  });
});

describe("S1a: live modifiers actually move economy numbers", () => {
  it("a faction tax-mult modifier raises Ming's treasury vs baseline", () => {
    const base = createMvpScenario("ming", 1);
    const boosted = createMvpScenario("ming", 1);
    boosted.activeModifiers = [
      { id: "tax-reform", label: "税制改革", scope: "faction", targetId: "ming", effects: { "tax-mult": 0.3 }, remainingMonths: 12 }
    ];
    const baseResult = simulateMonth({ state: base, playerDecision: defaultPlayerDecision, randomSeed: 1 }).nextState;
    const boostedResult = simulateMonth({ state: boosted, playerDecision: defaultPlayerDecision, randomSeed: 1 }).nextState;
    // 税制改革 +30% 税收应让大明国库明显高于基线
    expect(boostedResult.factions.ming.treasury).toBeGreaterThan(baseResult.factions.ming.treasury);
  });

  it("an irrelevant modifier key does not change treasury", () => {
    const base = createMvpScenario("ming", 1);
    const noisy = createMvpScenario("ming", 1);
    noisy.activeModifiers = [
      { id: "noise", label: "无关修正", scope: "faction", targetId: "ming", effects: { "army-org-mult": 0.5 }, remainingMonths: 12 }
    ];
    const baseResult = simulateMonth({ state: base, playerDecision: defaultPlayerDecision, randomSeed: 1 }).nextState;
    const noisyResult = simulateMonth({ state: noisy, playerDecision: defaultPlayerDecision, randomSeed: 1 }).nextState;
    // army-org-mult 尚未在 economy 接入，不应影响国库
    expect(noisyResult.factions.ming.treasury).toBe(baseResult.factions.ming.treasury);
  });
});

describe("S1b: extended modifier hooks", () => {
  it("maintenance-mult raises upkeep and lowers Ming treasury", () => {
    const base = createMvpScenario("ming", 1);
    const costly = createMvpScenario("ming", 1);
    costly.activeModifiers = [
      { id: "war-tax", label: "军费膨胀", scope: "faction", targetId: "ming", effects: { "maintenance-mult": 0.5 }, remainingMonths: 12 }
    ];
    const baseResult = simulateMonth({ state: base, playerDecision: defaultPlayerDecision, randomSeed: 1 }).nextState;
    const costlyResult = simulateMonth({ state: costly, playerDecision: defaultPlayerDecision, randomSeed: 1 }).nextState;
    expect(costlyResult.factions.ming.treasury).toBeLessThan(baseResult.factions.ming.treasury);
  });

  it("control-flat lifts a region's control vs baseline", () => {
    const baseline = createMvpScenario("ming", 1);
    baseline.regions.beizhili.control = 50;
    const boosted = createMvpScenario("ming", 1);
    boosted.regions.beizhili.control = 50;
    boosted.activeModifiers = [
      { id: "garrison-reform", label: "驻军改革", scope: "region", targetId: "beizhili", effects: { "control-flat": 5 }, remainingMonths: 12 }
    ];
    const baselineResult = simulateMonth({ state: baseline, playerDecision: defaultPlayerDecision, randomSeed: 1 }).nextState;
    const boostedResult = simulateMonth({ state: boosted, playerDecision: defaultPlayerDecision, randomSeed: 1 }).nextState;
    expect(boostedResult.regions.beizhili.control).toBeGreaterThan(baselineResult.regions.beizhili.control);
  });
});