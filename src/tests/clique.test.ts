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
    { cliqueId: "donglin", support: 50, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "eunuchs", support: 50, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "gentry", support: 50, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "generals", support: 50, strength: 0, activeModifier: 0, approval: 50 },
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
    const gentry = result.find((c) => c.cliqueId === "gentry")!;
    // gentry pops feed donglin; peasant pops feed the gentry clique — both > 0,
    // proving strength now derives from pop wealth rather than attribute mapping.
    expect(donglin.strength).toBeGreaterThan(0);
    expect(gentry.strength).toBeGreaterThan(0);
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
        ],
      });
    const poorGentry = computeFactionCliqueStrengthFromPops(makeCliques(), [scenario(100)]);
    const richGentry = computeFactionCliqueStrengthFromPops(makeCliques(), [scenario(2000)]);
    const donglinPoor = poorGentry.find((c) => c.cliqueId === "donglin")!.strength;
    const donglinRich = richGentry.find((c) => c.cliqueId === "donglin")!.strength;
    // As gentry grow richer, they capture a larger share of social-political
    // wealth, so donglin (which represents gentry) gains strength. This is the
    // S2c→S3 link: wealth concentration → political power.
    expect(donglinRich).toBeGreaterThan(donglinPoor);
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
    // Frontier garrison: soldier-heavy → generals dominate.
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
      mingC.find((c) => c.cliqueId === "generals")!.strength,
    );
    expect(frontC.find((c) => c.cliqueId === "generals")!.strength).toBeGreaterThan(
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
