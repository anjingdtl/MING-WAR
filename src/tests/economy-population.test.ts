import { describe, expect, it } from "vitest";
import { calculateRegionEconomy, calculateFactionMaintenance } from "../core/economy";
import { calculatePopulation } from "../core/population";
import { createMvpScenario } from "../data/scenarios";

describe("population", () => {
  it("grows stable regions and harms starving regions", () => {
    const state = createMvpScenario();
    const nanzhili = state.regions.nanzhili;
    expect(calculatePopulation(nanzhili, "recovery").nextPopulation).toBeGreaterThan(nanzhili.population);

    const starving = { ...nanzhili, grainStock: 1, stability: 35 };
    expect(calculatePopulation(starving, "finance").nextPopulation).toBeLessThan(starving.population);
  });
});

describe("economy", () => {
  it("collects taxes and computes a grain delta without mutating stock", () => {
    const state = createMvpScenario();
    const result = calculateRegionEconomy(state.regions.nanzhili, state.factions.ming, "finance");
    expect(result.taxCollected).toBeGreaterThan(0);
    expect(result.grainProduced).toBeGreaterThan(0);
    // S1c: economy no longer mutates grainStock — the ledger applies it.
    expect(result.region.grainStock).toBe(state.regions.nanzhili.grainStock);
  });

  it("charges military and bureaucracy maintenance", () => {
    const state = createMvpScenario();
    const maintenance = calculateFactionMaintenance(state.factions.ming);
    expect(maintenance.treasuryCost).toBeGreaterThan(0);
    expect(maintenance.grainCost).toBeGreaterThan(0);
  });
});

/* ===========================================================================
 * v0.8.2 大明财政韧性
 * ---------------------------------------------------------------------------
 * v0.6/v0.7/v0.8 下大明月田赋 ~140k vs 月军费 ~290k，持续赤字 150k/月，
 * 500万 国库 ~33 月即归零、随后崩溃。本组测试确保 v0.8.2 后：
 *  - 月田赋 ≥ 200k（tax 0.007）
 *  - dynasty 月军费 ≤ 150k（costPerSoldier 0.20）
 *  - 月度净流 ≥ +50k（大明能撑 5+ 年不崩盘）
 * =========================================================================== */
describe("v0.8.2 大明财政韧性", () => {
  it("大明月田赋 ≥ 200k（tax 0.007）", () => {
    const state = createMvpScenario();
    const ming = state.factions.ming;
    let taxTotal = 0;
    for (const r of Object.values(state.regions)) {
      if (r.controllerFactionId !== "ming") continue;
      const e = calculateRegionEconomy(r, ming, "finance");
      taxTotal += e.taxCollected;
    }
    expect(taxTotal).toBeGreaterThanOrEqual(200000);
  });

  it("dynasty 月军费 ≤ 150k（costPerSoldier 0.20）", () => {
    const state = createMvpScenario();
    const ming = state.factions.ming;
    const maint = calculateFactionMaintenance(ming);
    // armyPayCost = armyTotal * 0.20 * maintMult(≈1.0) ≈ 116k
    expect(maint.armyPayCost).toBeLessThanOrEqual(150000);
  });

  it("大明月度净流 = 田赋 - 军费 - 俸禄 ≥ +50k", () => {
    const state = createMvpScenario();
    const ming = state.factions.ming;
    let taxTotal = 0;
    for (const r of Object.values(state.regions)) {
      if (r.controllerFactionId !== "ming") continue;
      const e = calculateRegionEconomy(r, ming, "finance");
      taxTotal += e.taxCollected;
    }
    const maint = calculateFactionMaintenance(ming);
    const net = taxTotal - maint.treasuryCost;
    expect(net).toBeGreaterThanOrEqual(50000);
  });

  it("tribal / rebel / local 军费系数不变（保持势力差异化）", () => {
    const state = createMvpScenario();
    // tribal: 建州女真 armyTotal=42000, costPerSoldier=0.15 → 6300
    const jianzhou = { ...state.factions.jianzhou, type: "tribal" as const, armyTotal: 42000, administration: 30 };
    const jianzhouMaint = calculateFactionMaintenance(jianzhou);
    expect(jianzhouMaint.armyPayCost).toBe(Math.round(42000 * 0.15)); // 6300

    // rebel: rebels armyTotal 任意, costPerSoldier=0.08
    const rebels = { ...state.factions.rebels, type: "rebel" as const, armyTotal: 50000, administration: 10 };
    const rebelsMaint = calculateFactionMaintenance(rebels);
    expect(rebelsMaint.armyPayCost).toBe(Math.round(50000 * 0.08)); // 4000
  });
});
