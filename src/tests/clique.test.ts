import { describe, expect, it } from "vitest";
import type {
  FactionCliqueState,
  RegionState,
  DomesticFocus,
} from "../core/types";
import { cliqueTemplates } from "../data/cliques";
import {
  computeRegionCliqueWeights,
  computeFactionCliqueStrength,
  computeCliqueReactions,
  applyCliqueReactions,
  computeAdministrationModifier,
  applyNaturalDecay,
} from "../core/clique";

function makeRegion(overrides: Partial<RegionState> = {}): RegionState {
  return {
    id: "test",
    name: "测试",
    terrain: "plain",
    climate: "temperate",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 500000,
    populationCapacity: 1000000,
    agriculture: 50,
    commerce: 50,
    taxCapacity: 50,
    stability: 60,
    control: 80,
    fortification: 40,
    grainStock: 300000,
    garrison: 20000,
    coreFactionIds: ["ming"],
    connections: [],
    activeDisasters: [],
    rebelPressure: 0,
    ...overrides,
  };
}

function makeCliques(
  overrides: Partial<Record<string, Partial<FactionCliqueState>>> = {},
): FactionCliqueState[] {
  const defaults: FactionCliqueState[] = [
    { cliqueId: "donglin", support: 50, strength: 0, activeModifier: 0 },
    { cliqueId: "eunuchs", support: 50, strength: 0, activeModifier: 0 },
    { cliqueId: "gentry", support: 50, strength: 0, activeModifier: 0 },
    { cliqueId: "generals", support: 50, strength: 0, activeModifier: 0 },
  ];
  return defaults.map((c) => ({ ...c, ...(overrides[c.cliqueId] ?? {}) }));
}

describe("clique weight computation", () => {
  it("computes weights based on region attributes", () => {
    const region = makeRegion({ commerce: 80, agriculture: 80, taxCapacity: 80, fortification: 70 });
    const weights = computeRegionCliqueWeights(region);

    const donglin = weights.find((w) => w.cliqueId === "donglin")!;
    const eunuchs = weights.find((w) => w.cliqueId === "eunuchs")!;
    const gentry = weights.find((w) => w.cliqueId === "gentry")!;
    const generals = weights.find((w) => w.cliqueId === "generals")!;

    expect(donglin.weight).toBeGreaterThan(0);
    expect(eunuchs.weight).toBeGreaterThan(0);
    expect(gentry.weight).toBeGreaterThan(0);
    expect(generals.weight).toBeGreaterThan(0);
  });

  it("returns zero weight when region attribute is below threshold", () => {
    const region = makeRegion({ commerce: 30, agriculture: 30, taxCapacity: 30, fortification: 20 });
    const weights = computeRegionCliqueWeights(region);

    expect(weights.find((w) => w.cliqueId === "donglin")!.weight).toBe(0);
    expect(weights.find((w) => w.cliqueId === "eunuchs")!.weight).toBe(0);
    expect(weights.find((w) => w.cliqueId === "gentry")!.weight).toBe(0);
    expect(weights.find((w) => w.cliqueId === "generals")!.weight).toBe(0);
  });

  it("high commerce boosts donglin weight", () => {
    const low = makeRegion({ commerce: 40 });
    const high = makeRegion({ commerce: 90 });
    const lowW = computeRegionCliqueWeights(low).find((w) => w.cliqueId === "donglin")!.weight;
    const highW = computeRegionCliqueWeights(high).find((w) => w.cliqueId === "donglin")!.weight;
    expect(highW).toBeGreaterThan(lowW);
  });

  it("high agriculture boosts gentry weight", () => {
    const low = makeRegion({ agriculture: 40 });
    const high = makeRegion({ agriculture: 90 });
    const lowW = computeRegionCliqueWeights(low).find((w) => w.cliqueId === "gentry")!.weight;
    const highW = computeRegionCliqueWeights(high).find((w) => w.cliqueId === "gentry")!.weight;
    expect(highW).toBeGreaterThan(lowW);
  });
});

describe("faction clique strength aggregation", () => {
  it("aggregates strength from controlled regions weighted by population", () => {
    const cliques = makeCliques();
    const regions = [
      makeRegion({ id: "r1", population: 800000, commerce: 90 }),
      makeRegion({ id: "r2", population: 200000, agriculture: 90 }),
    ];
    const result = computeFactionCliqueStrength(cliques, regions);

    const donglin = result.find((c) => c.cliqueId === "donglin")!;
    const gentry = result.find((c) => c.cliqueId === "gentry")!;

    // donglin should be stronger because the high-commerce region has more population
    expect(donglin.strength).toBeGreaterThan(0);
    expect(gentry.strength).toBeGreaterThan(0);
    expect(donglin.strength).toBeGreaterThan(gentry.strength);
  });

  it("returns zero strength when faction has no regions", () => {
    const cliques = makeCliques();
    const result = computeFactionCliqueStrength(cliques, []);
    for (const c of result) {
      expect(c.strength).toBe(0);
    }
  });
});

describe("clique reactions on focus change", () => {
  it("produces positive delta when new focus aligns with clique affinity", () => {
    const cliques = makeCliques({ donglin: { strength: 60 } });
    const reactions = computeCliqueReactions(
      "administration", // donglin affinity: 8
      "military",       // donglin affinity: -3
      cliques,
      cliqueTemplates,
    );
    const donglin = reactions.find((r) => r.cliqueId === "donglin")!;
    expect(donglin.delta).toBeGreaterThan(0);
  });

  it("produces negative delta when new focus conflicts with clique affinity", () => {
    const cliques = makeCliques({ donglin: { strength: 60 } });
    const reactions = computeCliqueReactions(
      "finance",         // donglin affinity: -4
      "administration",  // donglin affinity: 8
      cliques,
      cliqueTemplates,
    );
    const donglin = reactions.find((r) => r.cliqueId === "donglin")!;
    expect(donglin.delta).toBeLessThan(0);
  });

  it("clamps delta to [-8, +8] range", () => {
    const cliques = makeCliques({ donglin: { strength: 100 } });
    const reactions = computeCliqueReactions(
      "administration", // affinity 8
      "finance",        // affinity -4, diff = 12
      cliques,
      cliqueTemplates,
    );
    const donglin = reactions.find((r) => r.cliqueId === "donglin")!;
    expect(donglin.delta).toBeLessThanOrEqual(8);
    expect(donglin.delta).toBeGreaterThanOrEqual(-8);
  });

  it("scales delta by clique strength", () => {
    const strong = makeCliques({ donglin: { strength: 80 } });
    const weak = makeCliques({ donglin: { strength: 20 } });
    const focus: DomesticFocus = "administration";
    const old: DomesticFocus = "military";

    const rStrong = computeCliqueReactions(focus, old, strong, cliqueTemplates);
    const rWeak = computeCliqueReactions(focus, old, weak, cliqueTemplates);

    const dStrong = rStrong.find((r) => r.cliqueId === "donglin")!.delta;
    const dWeak = rWeak.find((r) => r.cliqueId === "donglin")!.delta;
    expect(dStrong).toBeGreaterThan(dWeak);
  });

  it("returns zero delta when focus does not change", () => {
    const cliques = makeCliques({ donglin: { strength: 60 } });
    const reactions = computeCliqueReactions("agriculture", "agriculture", cliques, cliqueTemplates);
    for (const r of reactions) {
      expect(r.delta).toBe(0);
    }
  });
});

describe("apply clique reactions", () => {
  it("updates support values and clamps to [0, 100]", () => {
    const cliques = makeCliques({ donglin: { support: 95 } });
    const reactions = [
      { cliqueId: "donglin", delta: 8, reason: "test" },
      { cliqueId: "eunuchs", delta: -3, reason: "test" },
      { cliqueId: "gentry", delta: 0, reason: "test" },
      { cliqueId: "generals", delta: 0, reason: "test" },
    ];
    const result = applyCliqueReactions(cliques, reactions);
    const donglin = result.find((c) => c.cliqueId === "donglin")!;
    expect(donglin.support).toBe(100); // 95 + 8 = 103 → clamped to 100
    const eunuchs = result.find((c) => c.cliqueId === "eunuchs")!;
    expect(eunuchs.support).toBe(47); // 50 - 3
  });
});

describe("administration modifier computation", () => {
  it("returns positive modifier when cliques have high support", () => {
    const cliques = makeCliques({
      donglin: { support: 75, strength: 50 },
      gentry: { support: 70, strength: 40 },
    });
    const modifier = computeAdministrationModifier(cliques);
    expect(modifier).toBeGreaterThan(0);
  });

  it("returns negative modifier when cliques have low support", () => {
    const cliques = makeCliques({
      donglin: { support: 20, strength: 50 },
      eunuchs: { support: 15, strength: 40 },
    });
    const modifier = computeAdministrationModifier(cliques);
    expect(modifier).toBeLessThan(0);
  });

  it("clamps modifier to [-10, +10] range", () => {
    const cliques = makeCliques({
      donglin: { support: 100, strength: 100 },
      eunuchs: { support: 100, strength: 100 },
      gentry: { support: 100, strength: 100 },
      generals: { support: 100, strength: 100 },
    });
    const modifier = computeAdministrationModifier(cliques);
    expect(modifier).toBeLessThanOrEqual(10);
    expect(modifier).toBeGreaterThanOrEqual(-10);
  });

  it("returns near-zero modifier when all supports are around 50", () => {
    const cliques = makeCliques(); // all at 50
    const modifier = computeAdministrationModifier(cliques);
    expect(Math.abs(modifier)).toBeLessThanOrEqual(2);
  });
});

describe("natural support decay", () => {
  it("decays support toward 50 each month", () => {
    const cliques = makeCliques({
      donglin: { support: 80 },
      eunuchs: { support: 20 },
    });
    const result = applyNaturalDecay(cliques);
    const donglin = result.find((c) => c.cliqueId === "donglin")!;
    const eunuchs = result.find((c) => c.cliqueId === "eunuchs")!;
    expect(donglin.support).toBeLessThan(80);
    expect(donglin.support).toBeGreaterThanOrEqual(79);
    expect(eunuchs.support).toBeGreaterThan(20);
    expect(eunuchs.support).toBeLessThanOrEqual(21);
  });

  it("does not change support that is exactly 50", () => {
    const cliques = makeCliques();
    const result = applyNaturalDecay(cliques);
    for (const c of result) {
      expect(c.support).toBe(50);
    }
  });
});

describe("P0-2: administration compound growth prevention", () => {
  it("does not compound administration modifier across months", async () => {
    const { simulateMonth } = await import("../core/simulation");
    const { createMvpScenario, defaultPlayerDecision } = await import("../data/scenarios");
    const state = createMvpScenario("ming", 100);
    const initialBase = state.factions.ming.administrationBase;
    expect(initialBase).toBeGreaterThan(0);

    // Force high support so modifier is active
    for (const c of state.factions.ming.cliques) {
      c.support = 90;
    }

    let current = state;
    for (let i = 0; i < 12; i++) {
      current = simulateMonth({
        state: current,
        playerDecision: defaultPlayerDecision,
        randomSeed: current.seed
      }).nextState;
    }

    // P0-2 core fix: administrationBase must remain stable across months
    // (previously was overwritten with current administration, causing compound growth)
    expect(current.factions.ming.administrationBase).toBe(initialBase);

    // administration should be bounded [0, 100]
    expect(current.factions.ming.administration).toBeGreaterThanOrEqual(0);
    expect(current.factions.ming.administration).toBeLessThanOrEqual(100);

    // Admin can vary by at most ±10 from base (modifier clamp range)
    const drift = Math.abs(current.factions.ming.administration - initialBase);
    expect(drift).toBeLessThanOrEqual(15);
  });

  it("initializes administrationBase from administration on first simulation", async () => {
    const { simulateMonth } = await import("../core/simulation");
    const { createMvpScenario, defaultPlayerDecision } = await import("../data/scenarios");
    const state = createMvpScenario("ming", 200);
    expect(state.factions.ming.administrationBase).toBeGreaterThan(0);

    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed
    });

    // After first simulation, administrationBase should still equal initial value
    expect(result.nextState.factions.ming.administrationBase).toBe(state.factions.ming.administrationBase);
  });
});
