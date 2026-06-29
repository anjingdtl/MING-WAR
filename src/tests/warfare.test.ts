import { describe, expect, it } from "vitest";
import { advanceWar, createInitialWar } from "../core/warfare";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import type { FactionState, RegionState } from "../core/types";

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
    ...overrides
  };
}

function makeFaction(overrides: Partial<FactionState> = {}): FactionState {
  return {
    id: "jurchen",
    name: "Jurchen",
    type: "tribal",
    treasury: 1000,
    grainReserve: 1000,
    armyTotal: 30000,
    administration: 30,
    militaryOrganization: 60,
    legitimacy: 50,
    corruption: 10,
    centralization: 30,
    warExhaustion: 0,
    capitalRegionId: "test-region",
    primaryColor: "#000",
    traits: [],
    aiProfile: {
      aggression: 50, riskTolerance: 50, economicFocus: 50,
      centralizationPreference: 50, historicalGoalWeight: 50,
      defensePriority: 50, warEndurance: 50
    } as FactionState["aiProfile"],
    status: "active",
    cliques: [],
    administrationBase: 30,
    ...overrides
  };
}

describe("createInitialWar", () => {
  it("creates a war with monthsActive = 1", () => {
    const attacker = makeFaction({ id: "jurchen" });
    const defender = makeFaction({ id: "ming" });
    const region = makeRegion();
    const war = createInitialWar(attacker, defender, region);
    expect(war.monthsActive).toBe(1);
    expect(war.attackerFactionId).toBe("jurchen");
    expect(war.defenderFactionId).toBe("ming");
    expect(war.targetRegionId).toBe("test-region");
    expect(war.progress).toBeGreaterThanOrEqual(0);
    expect(war.progress).toBeLessThanOrEqual(100);
  });
});

describe("advanceWar", () => {
  it("increments monthsActive on each advance", () => {
    const attacker = makeFaction();
    const defender = makeFaction({ id: "ming" });
    const region = makeRegion();
    const war = createInitialWar(attacker, defender, region);
    const advanced = advanceWar(war, attacker, defender, region);
    expect(advanced.monthsActive).toBe(2);
  });

  it("progress increases when attacker is significantly stronger", () => {
    const attacker = makeFaction({ militaryOrganization: 90, armyTotal: 50000, warExhaustion: 0 });
    const defender = makeFaction({ id: "ming", militaryOrganization: 30, armyTotal: 10000, warExhaustion: 50 });
    const region = makeRegion({ fortification: 20 });
    const war = createInitialWar(attacker, defender, region);
    let current = war;
    for (let i = 0; i < 6; i++) {
      current = advanceWar(current, attacker, defender, region);
    }
    expect(current.progress).toBeGreaterThan(war.progress);
  });

  it("progress stays bounded [0, 100]", () => {
    const attacker = makeFaction({ militaryOrganization: 100, armyTotal: 100000 });
    const defender = makeFaction({ id: "ming", militaryOrganization: 10, armyTotal: 1000, warExhaustion: 0 });
    const region = makeRegion({ fortification: 0 });
    const war = createInitialWar(attacker, defender, region);
    let current = war;
    for (let i = 0; i < 24; i++) {
      current = advanceWar(current, attacker, defender, region);
    }
    expect(current.progress).toBeLessThanOrEqual(100);
    expect(current.progress).toBeGreaterThanOrEqual(0);
  });
});

describe("P0-4: simulation advances war over time", () => {
  it("increments monthsActive for ongoing wars each month", () => {
    const state = createMvpScenario("ming", 50);
    state.wars = [{
      id: "ming-jianzhou-liaodong",
      attackerFactionId: "jianzhou",
      defenderFactionId: "ming",
      targetRegionId: "liaodong",
      progress: 40,
      monthsActive: 1
    }];

    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: 1
    }).nextState;

    const war = result.wars.find((w) => w.id === "ming-jianzhou-liaodong");
    expect(war?.monthsActive).toBe(2);
  });

  it("accumulates war progress over multiple months", () => {
    const state = createMvpScenario("ming", 51);
    state.wars = [{
      id: "test-war",
      attackerFactionId: "jianzhou",
      defenderFactionId: "ming",
      targetRegionId: "liaodong",
      progress: 40,
      monthsActive: 1
    }];

    let current = state;
    for (let i = 0; i < 6; i++) {
      current = simulateMonth({
        state: current,
        playerDecision: defaultPlayerDecision,
        randomSeed: current.seed
      }).nextState;
    }

    const war = current.wars.find((w) => w.id === "test-war");
    expect(war?.monthsActive).toBe(7);
  });
});