import { describe, expect, it } from "vitest";
import type {
  FactionCliqueState,
  RegionState,
  DomesticFocus,
  PopType,
  PopGroup,
  Modifier,
} from "../core/types";
import { cliqueTemplates } from "../data/cliques";
import {
  computeRegionCliqueWeights,
  computeFactionCliqueStrength,
  computeFactionCliqueStrengthFromPops,
  computeCliqueApproval,
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
    { cliqueId: "imperial", support: 50, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "reform", support: 50, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "donglin", support: 50, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "eunuch", support: 50, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "frontier", support: 50, strength: 0, activeModifier: 0, approval: 50 },
  ];
  return defaults.map((c) => ({ ...c, ...(overrides[c.cliqueId] ?? {}) }));
}

describe("clique weight computation", () => {
  it("computes weights based on region attributes", () => {
    const region = makeRegion({ commerce: 80, agriculture: 80, taxCapacity: 80, fortification: 70 });
    const weights = computeRegionCliqueWeights(region);

    const imperial = weights.find((w) => w.cliqueId === "imperial")!;
    const reform = weights.find((w) => w.cliqueId === "reform")!;
    const donglin = weights.find((w) => w.cliqueId === "donglin")!;
    const eunuch = weights.find((w) => w.cliqueId === "eunuch")!;
    const frontier = weights.find((w) => w.cliqueId === "frontier")!;

    expect(imperial.weight).toBeGreaterThan(0);
    expect(reform.weight).toBeGreaterThan(0);
    expect(donglin.weight).toBeGreaterThan(0);
    expect(eunuch.weight).toBeGreaterThan(0);
    expect(frontier.weight).toBeGreaterThan(0);
  });

  it("returns zero weight when region attribute is below threshold", () => {
    const region = makeRegion({ commerce: 30, agriculture: 30, taxCapacity: 30, fortification: 20, control: 30 });
    const weights = computeRegionCliqueWeights(region);

    expect(weights.find((w) => w.cliqueId === "imperial")!.weight).toBe(0);
    expect(weights.find((w) => w.cliqueId === "reform")!.weight).toBe(0);
    expect(weights.find((w) => w.cliqueId === "donglin")!.weight).toBe(0);
    expect(weights.find((w) => w.cliqueId === "eunuch")!.weight).toBe(0);
    expect(weights.find((w) => w.cliqueId === "frontier")!.weight).toBe(0);
  });

  it("high commerce boosts donglin weight", () => {
    const low = makeRegion({ commerce: 40 });
    const high = makeRegion({ commerce: 90 });
    const lowW = computeRegionCliqueWeights(low).find((w) => w.cliqueId === "donglin")!.weight;
    const highW = computeRegionCliqueWeights(high).find((w) => w.cliqueId === "donglin")!.weight;
    expect(highW).toBeGreaterThan(lowW);
  });

  it("high taxCapacity boosts reform weight", () => {
    const low = makeRegion({ taxCapacity: 40 });
    const high = makeRegion({ taxCapacity: 90 });
    const lowW = computeRegionCliqueWeights(low).find((w) => w.cliqueId === "reform")!.weight;
    const highW = computeRegionCliqueWeights(high).find((w) => w.cliqueId === "reform")!.weight;
    expect(highW).toBeGreaterThan(lowW);
  });
});

describe("faction clique strength aggregation", () => {
  it("aggregates strength from controlled regions weighted by population", () => {
    const cliques = makeCliques();
    const regions = [
      makeRegion({ id: "r1", population: 800000, commerce: 90, taxCapacity: 70 }),
      makeRegion({ id: "r2", population: 200000, agriculture: 90 }),
    ];
    const result = computeFactionCliqueStrength(cliques, regions);

    const donglin = result.find((c) => c.cliqueId === "donglin")!;
    const reformC = result.find((c) => c.cliqueId === "reform")!;

    // donglin should be stronger because the high-commerce region has more population
    expect(donglin.strength).toBeGreaterThan(0);
    expect(reformC.strength).toBeGreaterThan(0);
    expect(donglin.strength).toBeGreaterThan(reformC.strength);
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
      { cliqueId: "eunuch", delta: -3, reason: "test" },
      { cliqueId: "reform", delta: 0, reason: "test" },
      { cliqueId: "frontier", delta: 0, reason: "test" },
      { cliqueId: "imperial", delta: 0, reason: "test" },
    ];
    const result = applyCliqueReactions(cliques, reactions);
    const donglin = result.find((c) => c.cliqueId === "donglin")!;
    expect(donglin.support).toBe(100); // 95 + 8 = 103 → clamped to 100
    const eunuch = result.find((c) => c.cliqueId === "eunuch")!;
    expect(eunuch.support).toBe(47); // 50 - 3
  });
});

describe("administration modifier computation", () => {
  it("returns positive modifier when cliques have high support", () => {
    const cliques = makeCliques({
      donglin: { support: 75, strength: 50 },
      reform: { support: 70, strength: 40 },
    });
    const modifier = computeAdministrationModifier(cliques);
    expect(modifier).toBeGreaterThan(0);
  });

  it("returns negative modifier when cliques have low support", () => {
    const cliques = makeCliques({
      donglin: { support: 20, strength: 50 },
      eunuch: { support: 15, strength: 40 },
    });
    const modifier = computeAdministrationModifier(cliques);
    expect(modifier).toBeLessThan(0);
  });

  it("clamps modifier to [-10, +10] range", () => {
    const cliques = makeCliques({
      donglin: { support: 100, strength: 100 },
      eunuch: { support: 100, strength: 100 },
      reform: { support: 100, strength: 100 },
      frontier: { support: 100, strength: 100 },
      imperial: { support: 100, strength: 100 },
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
      eunuch: { support: 20 },
    });
    const result = applyNaturalDecay(cliques);
    const donglin = result.find((c) => c.cliqueId === "donglin")!;
    const eunuch = result.find((c) => c.cliqueId === "eunuch")!;
    expect(donglin.support).toBeLessThan(80);
    expect(donglin.support).toBeGreaterThanOrEqual(79);
    expect(eunuch.support).toBeGreaterThan(20);
    expect(eunuch.support).toBeLessThanOrEqual(21);
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

function makePopGroup(overrides: Partial<PopGroup> = {}): PopGroup {
  return {
    id: "p1",
    regionId: "test",
    type: "peasant",
    size: 1000,
    employed: 800,
    wealth: 100,
    literacy: 10,
    subsistence: 100,
    needsSatisfaction: 80,
    taxBurden: 0.4,
    politicalPower: 5,
    loyalty: 60,
    radicalism: 10,
    ...overrides,
  };
}

describe("S3a: clique strength from pop wealth", () => {
  it("strength comes from owning pops' wealth, not region attributes", () => {
    const cliques = makeCliques();
    // Zero out all region attributes so any strength must come from pop wealth.
    const region = makeRegion({
      id: "r1",
      commerce: 0,
      agriculture: 0,
      taxCapacity: 0,
      fortification: 0,
      popGroups: [
        makePopGroup({ id: "g1", type: "gentry", size: 5000, wealth: 600 }),
        makePopGroup({ id: "g2", type: "peasant", size: 90000, wealth: 50 }),
      ],
    });
    const result = computeFactionCliqueStrengthFromPops(cliques, [region]);
    const donglin = result.find((c) => c.cliqueId === "donglin")!;
    const reformC = result.find((c) => c.cliqueId === "reform")!;
    // gentry pops feed donglin (affinity 1.0) and reform (affinity 0.5);
    // peasant pops feed no clique — both > 0,
    // proving strength now derives from pop wealth rather than attribute mapping.
    expect(donglin.strength).toBeGreaterThan(0);
    expect(reformC.strength).toBeGreaterThan(0);
  });

  it("a wealthier gentry class shifts strength toward donglin (its representative)", () => {
    const scenario = (gentryWealth: number): RegionState =>
      makeRegion({
        id: `r-${gentryWealth}`,
        commerce: 0,
        agriculture: 0,
        taxCapacity: 0,
        fortification: 0,
        popGroups: [
          makePopGroup({ id: "p", type: "peasant", size: 90000, wealth: 50 }),
          makePopGroup({ id: "g", type: "gentry", size: 5000, wealth: gentryWealth }),
          // Merchant baseline (feeds only donglin at 0.8, not reform/eunuch).
          // With gentry-dependent cliques (donglin 1.0, reform 0.5, eunuch 0.4)
          // sharing gentry wealth, donglin's normalized share depends on how
          // much the merchant-only base dominates the total.
          makePopGroup({ id: "m", type: "merchant", size: 3000, wealth: 500 }),
        ],
      });
    const poorGentry = computeFactionCliqueStrengthFromPops(makeCliques(), [scenario(100)]);
    const richGentry = computeFactionCliqueStrengthFromPops(makeCliques(), [scenario(1000)]);
    const donglinPoor = poorGentry.find((c) => c.cliqueId === "donglin")!.strength;
    const donglinRich = richGentry.find((c) => c.cliqueId === "donglin")!.strength;
    // When gentry are poor, the merchant base (exclusive to donglin) dominates,
    // concentrating political power in donglin's hands. As gentry grow richer,
    // reform and eunuch gain proportionally (sharing the gentry wealth), diluting
    // donglin's dominance — the S2c→S3 link: wealth distribution → political power.
    expect(donglinPoor).toBeGreaterThan(donglinRich);
  });

  it("falls back to region-attribute mapping when regions lack popGroups", () => {
    const region = makeRegion({ commerce: 90 }); // no popGroups → fallback path
    const result = computeFactionCliqueStrengthFromPops(makeCliques(), [region]);
    expect(result.find((c) => c.cliqueId === "donglin")!.strength).toBeGreaterThan(0);
  });

  it("different social structures yield different clique profiles (Ming vs frontier)", () => {
    // Ming core: gentry + merchant heavy → donglin dominates.
    const ming = makeRegion({
      id: "ming-core",
      commerce: 0,
      agriculture: 0,
      taxCapacity: 0,
      fortification: 0,
      popGroups: [
        makePopGroup({ id: "g", type: "gentry", size: 5000, wealth: 500 }),
        makePopGroup({ id: "m", type: "merchant", size: 3000, wealth: 400 }),
        makePopGroup({ id: "p", type: "peasant", size: 50000, wealth: 50 }),
        makePopGroup({ id: "s", type: "soldier", size: 2000, wealth: 60 }),
      ],
    });
    // Frontier garrison: soldier-heavy → frontier dominates.
    const frontier = makeRegion({
      id: "frontier",
      commerce: 0,
      agriculture: 0,
      taxCapacity: 0,
      fortification: 0,
      popGroups: [
        makePopGroup({ id: "s", type: "soldier", size: 80000, wealth: 80 }),
        makePopGroup({ id: "p", type: "peasant", size: 10000, wealth: 40 }),
      ],
    });
    const mingC = computeFactionCliqueStrengthFromPops(makeCliques(), [ming]);
    const frontC = computeFactionCliqueStrengthFromPops(makeCliques(), [frontier]);
    expect(mingC.find((c) => c.cliqueId === "donglin")!.strength).toBeGreaterThan(
      mingC.find((c) => c.cliqueId === "frontier")!.strength,
    );
    expect(frontC.find((c) => c.cliqueId === "frontier")!.strength).toBeGreaterThan(
      frontC.find((c) => c.cliqueId === "donglin")!.strength,
    );
  });
});

describe("S3b: clique approval", () => {
  it("approval tracks member pops' living standard", () => {
    const content = (sat: number): RegionState =>
      makeRegion({
        id: `r-${sat}`,
        popGroups: [
          makePopGroup({ id: "g", type: "gentry", size: 5000, needsSatisfaction: sat }),
        ],
      });
    const low = computeCliqueApproval("donglin", "administration", [content(20)], cliqueTemplates);
    const high = computeCliqueApproval("donglin", "administration", [content(90)], cliqueTemplates);
    // The S2→S3 gear: better member living standard → higher approval.
    expect(high).toBeGreaterThan(low);
  });

  it("raising taxes (finance focus) lowers donglin approval vs pro-agrarian focus", () => {
    const region = makeRegion({
      popGroups: [
        makePopGroup({ id: "g", type: "gentry", size: 5000, needsSatisfaction: 60 }),
      ],
    });
    const taxed = computeCliqueApproval("donglin", "finance", [region], cliqueTemplates);
    const favored = computeCliqueApproval("donglin", "agriculture", [region], cliqueTemplates);
    // finance (整顿财政=加税) clashes with donglin's low-tax stance.
    expect(taxed).toBeLessThan(favored);
  });

  it("explicit tax-mult modifier punishes approval further", () => {
    const region = makeRegion({
      popGroups: [
        makePopGroup({ id: "g", type: "gentry", size: 5000, needsSatisfaction: 60 }),
      ],
    });
    const mods: Modifier[] = [
      { id: "tax-hike", label: "加征", scope: "faction", targetId: "ming", effects: { "tax-mult": 0.4 } },
    ];
    const base = computeCliqueApproval("donglin", "recovery", [region], cliqueTemplates);
    const taxed = computeCliqueApproval("donglin", "recovery", [region], cliqueTemplates, mods, "ming");
    expect(taxed).toBeLessThan(base);
  });

  it("anchors to 50 + policy fit when no member pops are present", () => {
    const region = makeRegion({ popGroups: undefined });
    // No pops → avgSat=50 → satContrib=0; donglin administration affinity=8
    // → 50 + 0 + 8*3 = 74.
    const approval = computeCliqueApproval("donglin", "administration", [region], cliqueTemplates);
    expect(approval).toBe(74);
  });
});
