import { describe, expect, it } from "vitest";
import { advanceWar, alliesJoinWar, createInitialWar } from "../core/warfare";
import { addTreaty, ensureRelation } from "../core/diplomacy";
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
  it("creates a war with monthsActive = 1 and an initial front", () => {
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
    expect(war.front).toBeDefined();
    expect(war.front?.attackerSupply).toBe(100);
    expect(war.front?.defenderWarSupport).toBe(70);
  });
});

describe("advanceWar", () => {
  it("increments monthsActive on each advance", () => {
    const attacker = makeFaction();
    const defender = makeFaction({ id: "ming" });
    const region = makeRegion();
    const war = createInitialWar(attacker, defender, region);
    const advanced = advanceWar(war, attacker, defender, region);
    expect(advanced.war.monthsActive).toBe(2);
  });

  it("progress increases when attacker is significantly stronger", () => {
    const attacker = makeFaction({ militaryOrganization: 90, armyTotal: 50000, warExhaustion: 0 });
    const defender = makeFaction({ id: "ming", militaryOrganization: 30, armyTotal: 10000, warExhaustion: 50 });
    const region = makeRegion({ fortification: 20 });
    const war = createInitialWar(attacker, defender, region);
    let current = war;
    for (let i = 0; i < 6; i++) {
      current = advanceWar(current, attacker, defender, region).war;
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
      current = advanceWar(current, attacker, defender, region).war;
    }
    expect(current.progress).toBeLessThanOrEqual(100);
    expect(current.progress).toBeGreaterThanOrEqual(0);
  });
});

describe("S5b: 战线持续消耗", () => {
  it("返回军队损耗、战地军费/军粮与战疲（进攻方战疲更高）", () => {
    const attacker = makeFaction({ armyTotal: 100000 });
    const defender = makeFaction({ id: "ming", armyTotal: 80000 });
    const region = makeRegion({ garrison: 5000 });
    const war = createInitialWar(attacker, defender, region);
    const r = advanceWar(war, attacker, defender, region);
    expect(r.attackerLosses).toBeGreaterThan(0);
    expect(r.defenderLosses).toBeGreaterThan(0);
    expect(r.attackerSilverCost).toBeGreaterThan(0);
    expect(r.defenderGrainCost).toBeGreaterThan(0);
    expect(r.attackerExhaustionDelta).toBeGreaterThan(r.defenderExhaustionDelta);
  });

  it("进攻方补给逐月衰减，防守方本土补给稳定", () => {
    const attacker = makeFaction();
    const defender = makeFaction({ id: "ming" });
    const region = makeRegion();
    const war = createInitialWar(attacker, defender, region);
    const r = advanceWar(war, attacker, defender, region);
    expect(r.war.front?.attackerSupply).toBeLessThan(100);
    expect(r.war.front?.defenderSupply).toBe(100);
  });

  it("补给越低，损耗越高（劳师远征代价）", () => {
    const attacker = makeFaction({ armyTotal: 100000 });
    const defender = makeFaction({ id: "ming" });
    const region = makeRegion();
    const rHigh = advanceWar(createInitialWar(attacker, defender, region), attacker, defender, region);
    const warLow = createInitialWar(attacker, defender, region);
    warLow.front = { attackerWarSupport: 70, defenderWarSupport: 70, attackerSupply: 40, defenderSupply: 100 };
    const rLow = advanceWar(warLow, attacker, defender, region);
    expect(rLow.attackerLosses).toBeGreaterThan(rHigh.attackerLosses);
  });

  it("战地军费与军队规模成正比（战争咬合财政）", () => {
    const defender = makeFaction({ id: "ming", armyTotal: 80000 });
    const region = makeRegion();
    const small = advanceWar(createInitialWar(makeFaction({ armyTotal: 20000 }), defender, region), makeFaction({ armyTotal: 20000 }), defender, region);
    const large = advanceWar(createInitialWar(makeFaction({ armyTotal: 200000 }), defender, region), makeFaction({ armyTotal: 200000 }), defender, region);
    expect(large.attackerSilverCost).toBeGreaterThan(small.attackerSilverCost);
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

  it("war either advances or concludes via peace (S5c) over multiple months", () => {
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
    let peaceHappened = false;
    for (let i = 0; i < 6; i++) {
      const res = simulateMonth({
        state: current,
        playerDecision: defaultPlayerDecision,
        randomSeed: current.seed
      });
      if (res.reports.some((r) => r.title.includes("议和"))) peaceHappened = true;
      current = res.nextState;
    }

    const war = current.wars.find((w) => w.id === "test-war");
    // S5c：弱方（建州）攻强方（大明）会因支持度崩塌而和谈结束；战争要么仍
    // 在推进（monthsActive 增长），要么已通过议和结束 —— 两者皆合法。
    expect(war === undefined || war.monthsActive === 7 || peaceHappened).toBe(true);
  });
});

describe("S5 遗留#2：同盟参战（alliesJoinWar）", () => {
  function setupNeighborPair(state: ReturnType<typeof createMvpScenario>) {
    const x = Object.values(state.regions).find((r) => r.connections.length > 0)!;
    const y = state.regions[x.connections[0]];
    state.regions[x.id].controllerFactionId = "joseon";
    state.regions[y.id].controllerFactionId = "jianzhou";
    return { x, y };
  }

  it("进攻方盟友（与防守方相邻）同步参战", () => {
    const s = createMvpScenario("ming", 1);
    setupNeighborPair(s);
    addTreaty(s, "ming", "joseon", "alliance");
    const newWars = alliesJoinWar(s, "ming", "jianzhou");
    expect(newWars.some((w) => w.attackerFactionId === "joseon" && w.defenderFactionId === "jianzhou")).toBe(true);
  });

  it("盟友若与防守方也是盟友，不参战", () => {
    const s = createMvpScenario("ming", 1);
    setupNeighborPair(s);
    addTreaty(s, "ming", "joseon", "alliance");
    addTreaty(s, "joseon", "jianzhou", "alliance");
    const newWars = alliesJoinWar(s, "ming", "jianzhou");
    expect(newWars.some((w) => w.attackerFactionId === "joseon")).toBe(false);
  });

  it("盟友与防守方停战时不参战", () => {
    const s = createMvpScenario("ming", 1);
    setupNeighborPair(s);
    addTreaty(s, "ming", "joseon", "alliance");
    const rel = ensureRelation(s, "joseon", "jianzhou");
    rel.truceMonths = 30;
    addTreaty(s, "joseon", "jianzhou", "truce");
    const newWars = alliesJoinWar(s, "ming", "jianzhou");
    expect(newWars.some((w) => w.attackerFactionId === "joseon")).toBe(false);
  });

  it("无盟友时不产生参战 war", () => {
    const s = createMvpScenario("ming", 1);
    expect(alliesJoinWar(s, "ming", "jianzhou")).toEqual([]);
  });
});
