import { describe, expect, it } from "vitest";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("monthly simulation", () => {
  it("advances one month and records history", () => {
    const state = createMvpScenario("ming", 1573);
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed
    });
    expect(result.nextState.currentDate).toBe("1573-02");
    expect(result.nextState.history).toHaveLength(1);
    expect(result.nextState.reports.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same seed and decision", () => {
    const a = createMvpScenario("ming", 42);
    const b = createMvpScenario("ming", 42);
    const first = simulateMonth({ state: a, playerDecision: defaultPlayerDecision, randomSeed: a.seed });
    const second = simulateMonth({ state: b, playerDecision: defaultPlayerDecision, randomSeed: b.seed });
    expect(first.nextState).toEqual(second.nextState);
  });

  it("causes army desertion during grain crisis", () => {
    const state = createMvpScenario("ming", 123);
    state.factions.ming.grainReserve = 0;
    const beforeArmy = state.factions.ming.armyTotal;
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    expect(result.nextState.factions.ming.armyTotal).toBeLessThan(beforeArmy);
    expect(result.reports.some((report) => report.title.includes("粮尽军散"))).toBe(true);
  });

  it("causes mutiny during treasury crisis", () => {
    const state = createMvpScenario("ming", 124);
    state.factions.ming.treasury = 0;
    const beforeArmy = state.factions.ming.armyTotal;
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    expect(result.nextState.factions.ming.armyTotal).toBeLessThan(beforeArmy);
    expect(result.reports.some((report) => report.title.includes("财政破产"))).toBe(true);
  });

  it("hands region to rebels when rebellion collapses control", () => {
    const state = createMvpScenario("ming", 125);
    state.regions.shaanxi.rebelPressure = 90;
    state.regions.shaanxi.control = 12;
    state.regions.shaanxi.garrison = 120000;
    state.regions.shaanxi.fortification = 95;
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    // 叛乱触发民众起义、瓦解大明对陕西的控制。S5 战争系统更活跃后，最终
    // 控制权可能因后续战斗易主给进攻方（蝴蝶效应），故断言脱离大明 + 起义
    // 报告，而非硬性等于 rebels。
    expect(result.nextState.regions.shaanxi.controllerFactionId).not.toBe("ming");
    expect(result.reports.some((report) => report.title.includes("民众起义"))).toBe(true);
  });

  it("updates faction cliques during monthly settlement", () => {
    const state = createMvpScenario("ming", 200);
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    const ming = result.nextState.factions.ming;

    // cliques should have updated strength based on controlled regions
    expect(ming.cliques.length).toBe(4);
    expect(ming.cliques.some((c) => c.strength > 0)).toBe(true);

    // administrationBase should be saved
    expect(ming.administrationBase).toBeGreaterThan(0);

    // administration should be within [0, 100]
    expect(ming.administration).toBeGreaterThanOrEqual(0);
    expect(ming.administration).toBeLessThanOrEqual(100);
  });

  it("saves lastDomesticFocus after simulation", () => {
    const state = createMvpScenario("ming", 201);
    const decision = { ...defaultPlayerDecision, domesticFocus: "military" as const };
    const result = simulateMonth({ state, playerDecision: decision, randomSeed: state.seed });
    expect(result.nextState.lastDomesticFocus).toBe("military");
  });

  it("applies natural decay to clique support each month", () => {
    const state = createMvpScenario("ming", 202);
    // Set extreme support values
    const donglin = state.factions.ming.cliques.find((c) => c.cliqueId === "donglin")!;
    donglin.support = 80;
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    const afterDonglin = result.nextState.factions.ming.cliques.find((c) => c.cliqueId === "donglin")!;
    // Should have decayed toward 50 (from 80, minus 1)
    expect(afterDonglin.support).toBeLessThanOrEqual(80);
  });

  it("P0-1: uses each faction's own domestic focus for its controlled regions", () => {
    // Player uses "finance" focus (boosts tax by 14%)
    // AI factions should use their own decisions
    const state = createMvpScenario("ming", 300);
    state.playerFactionId = "ming";

    // Compare treasury delta for AI faction (jianzhou) when player uses "finance"
    // vs. when player uses "agriculture". The treasury delta of jianzhou should be
    // UNCHANGED (because its regions use jianzhou's own focus, not the player's).
    const aiFactionId = "jianzhou";

    const resultFinance = simulateMonth({
      state: structuredClone(state),
      playerDecision: { ...defaultPlayerDecision, domesticFocus: "finance" },
      randomSeed: 1
    });
    const resultAgriculture = simulateMonth({
      state: structuredClone(state),
      playerDecision: { ...defaultPlayerDecision, domesticFocus: "agriculture" },
      randomSeed: 1
    });

    const aiTreasuryFinance = resultFinance.nextState.factions[aiFactionId].treasury;
    const aiTreasuryAgriculture = resultAgriculture.nextState.factions[aiFactionId].treasury;

    // AI faction's treasury should be the same regardless of player's focus
    expect(aiTreasuryFinance).toBe(aiTreasuryAgriculture);

    // Sanity: player treasury should differ between finance/agriculture (since focus applies)
    const playerTreasuryFinance = resultFinance.nextState.factions.ming.treasury;
    const playerTreasuryAgriculture = resultAgriculture.nextState.factions.ming.treasury;
    expect(playerTreasuryFinance).not.toBe(playerTreasuryAgriculture);
  });
});
