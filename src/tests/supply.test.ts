import { describe, expect, it } from "vitest";
import { createMvpScenario } from "../data/scenarios";
import {
  applySupplyPressureMultiplier,
  computeSupplyRatio,
  depositMonthlySupply,
  dispatchSupplyConvoy,
  tickSupplyConvoys,
  type SupplyConvoy,
} from "../core/supply";

/* ===========================================================================
 * v0.9.2 粮秣生产 / 仓储 / 运输 — 2026-07-02
 *
 * 设计：让"打得起"和"补给到"成为真实约束。
 * 验收 6 个 use case：
 *   1. depositMonthlySupply 注入 logisticsNode
 *   2. dispatchSupplyConvoy 派出一支 convoy
 *   3. tickSupplyConvoys ETA 递减
 *   4. tickSupplyConvoys 到达注入目标
 *   5. computeSupplyRatio 钳位到 [0, 1.2]
 *   6. applySupplyPressureMultiplier 三档（1.0 / 0.7 / 0.5）
 * =========================================================================== */
describe("v0.9.2 粮秣 / 仓储 / 运输", () => {
  it("depositMonthlySupply：grainProduced × 0.4 注入 depotStock", () => {
    const state = createMvpScenario();
    const beizhili = state.regions.beizhili;
    const before = beizhili.logisticsNode?.depotStock ?? 0;
    const produced = 100000;
    const after = depositMonthlySupply(beizhili, produced);
    const delta = (after.logisticsNode?.depotStock ?? 0) - before;
    expect(delta).toBe(Math.round(produced * 0.4));
  });

  it("dispatchSupplyConvoy：派出一支 convoy，来源 depot 扣减", () => {
    const state = createMvpScenario();
    // 给 beizhili 满仓
    state.regions.beizhili.logisticsNode = {
      ...state.regions.beizhili.logisticsNode!,
      depotStock: 50000,
    };
    const before = state.regions.beizhili.logisticsNode!.depotStock;
    const { state: next, convoy } = dispatchSupplyConvoy(
      state,
      "ming",
      "beizhili",
      "liaodong",
      20000,
      "1573-01"
    );
    expect(convoy).not.toBeNull();
    expect(next.regions.beizhili.logisticsNode!.depotStock).toBeLessThan(before);
    expect(next.activeConvoys?.length ?? 0).toBe(0); // 本函数不挂载到 state
  });

  it("tickSupplyConvoys：ETA 递减 1 月", () => {
    const state = createMvpScenario();
    const convoy: SupplyConvoy = {
      id: "c1",
      factionId: "ming",
      fromRegionId: "beizhili",
      toRegionId: "liaodong",
      payload: 10000,
      initialPayload: 10000,
      etaMonths: 3,
      startedAt: "1573-01",
    };
    state.activeConvoys = [convoy];
    const next = tickSupplyConvoys(state);
    expect(next.activeConvoys?.length).toBe(1);
    expect(next.activeConvoys![0]?.etaMonths).toBe(2);
  });

  it("tickSupplyConvoys：到达时 ETA 0/1 注入目标 depotStock", () => {
    const state = createMvpScenario();
    const before = state.regions.liaodong.logisticsNode?.depotStock ?? 0;
    state.activeConvoys = [{
      id: "c2",
      factionId: "ming",
      fromRegionId: "beizhili",
      toRegionId: "liaodong",
      payload: 10000,
      initialPayload: 10000,
      etaMonths: 1,
      startedAt: "1573-01",
    }];
    const next = tickSupplyConvoys(state);
    const after = next.regions.liaodong.logisticsNode?.depotStock ?? 0;
    expect(after).toBeGreaterThan(before);
    expect(next.activeConvoys?.length).toBe(0);
  });

  it("computeSupplyRatio：钳位 [0, 1.2]", () => {
    const state = createMvpScenario();
    state.regions.liaodong.logisticsNode = {
      ...state.regions.liaodong.logisticsNode!,
      depotStock: 100000,
    };
    const ratio = computeSupplyRatio(state, "ming", "liaodong", 4);
    expect(ratio).toBeGreaterThanOrEqual(0);
    expect(ratio).toBeLessThanOrEqual(1.2);
  });

  it("applySupplyPressureMultiplier：三档（1.0 / 0.7 / 0.5）", () => {
    expect(applySupplyPressureMultiplier(1.0)).toBe(1.0);
    expect(applySupplyPressureMultiplier(0.9)).toBe(1.0);
    expect(applySupplyPressureMultiplier(0.75)).toBe(1.0);  // 边界 ≥ 0.75 → 1.0
    expect(applySupplyPressureMultiplier(0.6)).toBe(0.7);   // 0.5-0.75 → 0.7
    expect(applySupplyPressureMultiplier(0.5)).toBe(0.7);    // 边界 0.5 → 0.7
    expect(applySupplyPressureMultiplier(0.3)).toBe(0.5);    // < 0.5 → 0.5
    expect(applySupplyPressureMultiplier(0.0)).toBe(0.5);    // 0 → 0.5
  });
});
