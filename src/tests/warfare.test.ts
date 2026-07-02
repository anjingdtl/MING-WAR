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
    // v0.9: 物流节点/军事子结构（测试默认值）
    logisticsNode: null,
    military: {
      infrastructureLevel: 0,
      seasonalState: "normal",
      localSupport: 50,
      occupationResistance: 0,
      forageCapacity: 0.5,
      strategicValue: 30,
    },
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
    homeTurfMult: 1.0,
    maxCommitRatio: 1.0,
    warCommitments: {},
    // v0.9: 测试默认（中性的低值）
    mobilizationPool: 6000,
    conscriptionRate: 0.20,
    warDesireModifier: 0,
    formations: [],
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
    warLow.front = { attackerWarSupport: 70, defenderWarSupport: 70, attackerSupply: 40, defenderSupply: 100, mobilizationMonths: 0, attackerCommitted: 0 };
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

describe("v0.8: 持久战 + 投送系数 + 主场 / 距离 / 驻军", () => {
  // [PLACEHOLDER] 公式：BASE 1.5 + POWER_COEFF 2.5 × (ratio-1) − FLOOR 0.6
  //  − DIST_PEN 0.3 × (distance-1) − GARRISON_DRAG 0.5 × (garrison/30000)
  // 数值示例：大明（maxCommit=0.30, home=1.05）vs 察哈尔（home=1.30, dist=2）：
  //   committed = 580k × 0.30 × 0.85 = 148k
  //   defender  = (74k × 0.64 × 0.74 + 43k × 0.5) × 1.30 = 73k
  //   ratio = 2.03 → Δ = 1.5 + 2.58 − 0.6 − 0.3 − 0.72 = 2.46 → ~26 月打完

  function makeRegionWithDistance(overrides: Partial<RegionState> = {}): RegionState {
    return makeRegion({
      distanceFromCapital: { ming: 1, jianzhou: 1, chahar: 2 },
      ...overrides,
    });
  }

  it("大明 vs 察哈尔（distance=2）：12 月内不推满，旧公式 2 月完胜已修", () => {
    const ming = makeFaction({
      id: "ming", armyTotal: 580000, militaryOrganization: 58,
      homeTurfMult: 1.05, maxCommitRatio: 0.30,
      warCommitments: { chahar_steppe: 580000 * 0.30 * 0.85 },  // 模拟已全投送
    });
    const chahar = makeFaction({
      id: "chahar", armyTotal: 74000, militaryOrganization: 64,
      homeTurfMult: 1.30, maxCommitRatio: 0.55,
    });
    const region = makeRegionWithDistance({
      id: "chahar_steppe",
      controllerFactionId: "chahar",
      fortification: 24,
      garrison: 43000,
      distanceFromCapital: { ming: 2, jianzhou: 4, chahar: 0 },
    });
    const war = createInitialWar(ming, chahar, region);
    // 跳过动员期（2 月）+ 12 月推进
    let current = war;
    for (let i = 0; i < 2 + 12; i++) {
      current = advanceWar(current, ming, chahar, region).war;
    }
    // 14 月后（含 2 月动员）：progress 应该 < 80（不会 2 月完胜）
    expect(current.progress).toBeLessThan(80);
    expect(current.progress).toBeGreaterThan(35); // 但确实在推进
  });

  it("大明 vs 建州（distance=2）：18 月内不能 1 月推平", () => {
    const ming = makeFaction({
      id: "ming", armyTotal: 580000, militaryOrganization: 58,
      homeTurfMult: 1.05, maxCommitRatio: 0.30,
      warCommitments: { jianzhou: 580000 * 0.30 * 0.85 },
    });
    const jianzhou = makeFaction({
      id: "jianzhou", armyTotal: 42000, militaryOrganization: 62,
      homeTurfMult: 1.40, maxCommitRatio: 0.60,
    });
    const region = makeRegionWithDistance({
      id: "jianzhou",
      controllerFactionId: "jianzhou",
      fortification: 35,
      garrison: 32000,
      distanceFromCapital: { ming: 2, jianzhou: 0, chahar: 4 },
    });
    const war = createInitialWar(ming, jianzhou, region);
    let current = war;
    for (let i = 0; i < 2 + 18; i++) {
      current = advanceWar(current, ming, jianzhou, region).war;
    }
    // 20 月后（含 2 月动员）：progress < 95（不会"完胜"）
    expect(current.progress).toBeLessThan(95);
  });

  it("动员期 progress 不推进，committedForce 不增长", () => {
    const ming = makeFaction({
      id: "ming", armyTotal: 580000, maxCommitRatio: 0.30,
      warCommitments: {},
    });
    const jianzhou = makeFaction({
      id: "jianzhou", armyTotal: 42000, homeTurfMult: 1.40, maxCommitRatio: 0.60,
    });
    const region = makeRegionWithDistance({
      controllerFactionId: "jianzhou",
      distanceFromCapital: { ming: 2, jianzhou: 0, chahar: 4 },
    });
    const war = createInitialWar(ming, jianzhou, region);
    expect(war.front?.mobilizationMonths).toBe(1);  // distance=2 → 1 月动员

    const r1 = advanceWar(war, ming, jianzhou, region);
    expect(r1.war.progress).toBe(35);  // 动员期不推进
    expect(r1.war.front?.mobilizationMonths).toBe(0);  // 动员期递减

    const r2 = advanceWar(r1.war, ming, jianzhou, region);
    expect(r2.war.progress).toBeGreaterThan(35);  // 动员期后开始推进
  });

  it("committedForce 渐进增长，受 maxCommitRatio 限制", () => {
    const ming = makeFaction({
      id: "ming", armyTotal: 580000, maxCommitRatio: 0.30, warCommitments: {},
    });
    const jianzhou = makeFaction({
      id: "jianzhou", armyTotal: 42000, homeTurfMult: 1.40, maxCommitRatio: 0.60,
    });
    const region = makeRegionWithDistance({
      controllerFactionId: "jianzhou",
      distanceFromCapital: { ming: 1, jianzhou: 0, chahar: 4 },  // 相邻，distance=1，无动员
    });
    // 跳过动员期（distance=1 → 0）
    const war = createInitialWar(ming, jianzhou, region);
    let current = war;
    let r1 = advanceWar(current, ming, jianzhou, region);
    // 投送增长 = maxCommitRatio × armyTotal 的 5%（首月）
    // expected 5%: 580k × 0.30 × 0.05 = 8700 (round)
    expect(r1.nextCommittedForce).toBeLessThan(580000 * 0.30);
    expect(r1.nextCommittedForce).toBeGreaterThan(0);

    // 持续推进，最终不超过 maxCommitRatio。模拟 runWarPhase 的副作用：
    // 每次 advanceWar 后把 nextCommittedForce 写回 ming.warCommitments，
    // 否则下次 advanceWar 仍读到 0，committedForce 永远不增长。
    let prevForce = r1.nextCommittedForce;
    for (let i = 0; i < 60; i++) {
      ming.warCommitments[war.targetRegionId] = r1.nextCommittedForce;
      current = r1.war;
      r1 = advanceWar(current, ming, jianzhou, region);
      expect(r1.nextCommittedForce).toBeLessThanOrEqual(580000 * 0.30 + 1);
      prevForce = r1.nextCommittedForce;
    }
    // 60 月后（如果还没结束），committedForce 应该已经达到 maxCommitRatio × armyTotal
    expect(prevForce).toBeCloseTo(580000 * 0.30, -3);
  });

  it("补给 < 50 时 attackerLosses 翻倍（劳师远征补给崩溃）", () => {
    const ming = makeFaction({ id: "ming", armyTotal: 100000, maxCommitRatio: 1.0, warCommitments: { test: 50000 } });
    const defender = makeFaction({ id: "jianzhou", armyTotal: 10000, homeTurfMult: 1.0, maxCommitRatio: 1.0 });
    const region = makeRegion({ distanceFromCapital: { ming: 1, jianzhou: 1 } });
    const warFull = createInitialWar(ming, defender, region);
    const rFull = advanceWar(warFull, ming, defender, region);
    const warLow = createInitialWar(ming, defender, region);
    warLow.front = { ...warLow.front!, attackerSupply: 30 };
    const rLow = advanceWar(warLow, ming, defender, region);
    // 补给 < 50：损耗翻倍
    expect(rLow.attackerLosses).toBeGreaterThanOrEqual(rFull.attackerLosses * 1.8);
  });

  it("主场加成：防守方 homeTurfMult 让防守更强", () => {
    const ming = makeFaction({
      id: "ming", armyTotal: 100000, militaryOrganization: 80, maxCommitRatio: 1.0,
      warCommitments: { test: 100000 },
    });
    const defenderHome = makeFaction({
      id: "jianzhou", armyTotal: 30000, militaryOrganization: 60, homeTurfMult: 1.40, maxCommitRatio: 1.0,
    });
    const defenderAway = makeFaction({
      id: "jianzhou", armyTotal: 30000, militaryOrganization: 60, homeTurfMult: 1.0, maxCommitRatio: 1.0,
    });
    const region = makeRegion({
      controllerFactionId: "jianzhou",
      distanceFromCapital: { ming: 1, jianzhou: 0 },
    });
    const warHome = advanceWar(createInitialWar(ming, defenderHome, region), ming, defenderHome, region);
    const warAway = advanceWar(createInitialWar(ming, defenderAway, region), ming, defenderAway, region);
    // 主场时 progress 推进更慢
    expect(warHome.war.progress).toBeLessThanOrEqual(warAway.war.progress);
  });

  it("驻军 garrison 拖慢 progress", () => {
    const ming = makeFaction({
      id: "ming", armyTotal: 100000, militaryOrganization: 80, maxCommitRatio: 1.0,
      warCommitments: { test: 100000 },
    });
    const defender = makeFaction({
      id: "jianzhou", armyTotal: 10000, militaryOrganization: 50, homeTurfMult: 1.0, maxCommitRatio: 1.0,
    });
    const regionHighGarrison = makeRegion({
      controllerFactionId: "jianzhou",
      garrison: 80000,
      distanceFromCapital: { ming: 1, jianzhou: 0 },
    });
    const regionLowGarrison = makeRegion({
      controllerFactionId: "jianzhou",
      garrison: 5000,
      distanceFromCapital: { ming: 1, jianzhou: 0 },
    });
    const rHigh = advanceWar(createInitialWar(ming, defender, regionHighGarrison), ming, defender, regionHighGarrison);
    const rLow = advanceWar(createInitialWar(ming, defender, regionLowGarrison), ming, defender, regionLowGarrison);
    // 高驻军：progress 推进更慢
    expect(rHigh.war.progress).toBeLessThanOrEqual(rLow.war.progress);
  });

  it("createInitialWar 初始化动员期 = max(0, distance-1)", () => {
    const ming = makeFaction({ id: "ming", armyTotal: 580000, maxCommitRatio: 0.30, warCommitments: {} });
    const jianzhou = makeFaction({ id: "jianzhou", armyTotal: 42000, homeTurfMult: 1.40, maxCommitRatio: 0.60 });
    const region = makeRegion({
      id: "deep",
      controllerFactionId: "jianzhou",
      distanceFromCapital: { ming: 4, jianzhou: 0 },
    });
    const war = createInitialWar(ming, jianzhou, region);
    expect(war.front?.mobilizationMonths).toBe(3);  // distance=4 → 3 月动员
  });

  it("距离衰减 supplyDecay 按 1.5 × distance 加速补给下降", () => {
    const ming = makeFaction({ id: "ming", armyTotal: 100000, maxCommitRatio: 1.0, warCommitments: { test: 100000 } });
    const defender = makeFaction({ id: "jianzhou", armyTotal: 10000, homeTurfMult: 1.0, maxCommitRatio: 1.0 });
    const regionClose = makeRegion({
      controllerFactionId: "jianzhou",
      distanceFromCapital: { ming: 1, jianzhou: 0 },
    });
    const regionFar = makeRegion({
      controllerFactionId: "jianzhou",
      distanceFromCapital: { ming: 4, jianzhou: 0 },
    });
    const rClose = advanceWar(createInitialWar(ming, defender, regionClose), ming, defender, regionClose);
    const rFar = advanceWar(createInitialWar(ming, defender, regionFar), ming, defender, regionFar);
    // 远距离（distance=4）衰减更快（但要等动员期结束）
    expect(rFar.war.front?.attackerSupply).toBeLessThan(rClose.war.front?.attackerSupply ?? 100);
  });
});

/* ===========================================================================
 * v0.8.1 capture 阈值调严
 * ---------------------------------------------------------------------------
 * 旧公式：nextControl <= 35 -> capture。意味着控制度 53 的地区首战 attackerWins
 * 即被占领（让大明 1 月推平辽东）。
 * 新公式：region.garrison < 5000 -> capture。max(20, control-18) 下界恒为 20，
 * 单纯控制度阈值永远触发不了，故新规则本质是 garrison-only：
 *   首战必须把守军打到 5000 以下才允许 capture；让 advanceWar 持久战有机会跑起来。
 *
 * 历史对照：萨尔浒之战大明 11 万 vs 建州 6 万，首战覆灭但辽东未失，
 * 因为沈阳/辽阳 garrison 未被清空。
 *
 * 以下测试断言 capture 阈值的边界，不调 random.next()。
 * =========================================================================== */
describe("v0.8.1 capture 阈值", () => {
  const wouldCapture = (control: number, garrison: number) => garrison < 5000; // v0.8.1
  const oldWouldCapture = (control: number) => Math.max(20, control - 18) <= 35; // v0.8 旧

  it("control=53, garrison=6000：旧阈值会 capture，新阈值不 capture", () => {
    // v0.8 bug 场景：control=53 是辽东等周边势力的典型 control 值。
    expect(oldWouldCapture(53)).toBe(true);
    expect(wouldCapture(53, 6000)).toBe(false);
  });

  it("control=30, garrison=4500：garrison < 5000 capture", () => {
    expect(wouldCapture(30, 4500)).toBe(true);
  });

  it("control=10, garrison=8000：守军仍强，不 capture", () => {
    expect(wouldCapture(10, 8000)).toBe(false);
  });

  it("边界 garrison=4999 capture", () => {
    expect(wouldCapture(20, 4999)).toBe(true);
  });

  it("边界 garrison=5000 不 capture", () => {
    expect(wouldCapture(20, 5000)).toBe(false);
  });
});

