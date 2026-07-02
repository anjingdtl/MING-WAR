import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DecisionPanel } from "../ui/panels/DecisionPanel";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

/* ===========================================================================
 * v0.9.5 玩家决策面板升级 — 2026-07-02
 *
 * 设计：5 个 KPI 卡（动员池/仓储/在途/战伤/围城）让玩家看到 v0.9 机制。
 * 验收 4 个 use case：
 *   1. 渲染 5 个 KPI 卡
 *   2. 动员池百分比 = mobilizationPool / (armyTotal × 1.5)
 *   3. 仓储 = 玩家控制区 depotStock 之和
 *   4. 战伤显示 faction.warFatigue
 * =========================================================================== */

describe("v0.9.5 决策面板 KPI 卡", () => {
  it("渲染 5 个 KPI 卡（动员池/仓储/在途/战伤/围城）", () => {
    const state = createMvpScenario();
    render(
      <DecisionPanel
        state={state}
        decision={defaultPlayerDecision}
        onChange={() => {}}
      />,
    );
    const kpis = screen.getByTestId("military-kpis");
    expect(within(kpis).getByTestId("kpi-动员池")).toBeTruthy();
    expect(within(kpis).getByTestId("kpi-仓储")).toBeTruthy();
    expect(within(kpis).getByTestId("kpi-在途")).toBeTruthy();
    expect(within(kpis).getByTestId("kpi-战伤")).toBeTruthy();
    expect(within(kpis).getByTestId("kpi-围城")).toBeTruthy();
  });

  it("动员池百分比 = mobilizationPool / (armyTotal × 1.5)", () => {
    const state = createMvpScenario();
    const faction = state.factions[state.playerFactionId];
    const expected = Math.round((faction.mobilizationPool / (faction.armyTotal * 1.5)) * 100);
    render(
      <DecisionPanel
        state={state}
        decision={defaultPlayerDecision}
        onChange={() => {}}
      />,
    );
    const card = screen.getByTestId("kpi-动员池");
    expect(within(card).getByText(`${expected}%`)).toBeTruthy();
  });

  it("仓储 = 玩家控制区 depotStock 之和", () => {
    const state = createMvpScenario();
    const expected = Object.values(state.regions)
      .filter((r) => r.controllerFactionId === state.playerFactionId)
      .reduce((sum, r) => sum + (r.logisticsNode?.depotStock ?? 0), 0);
    render(
      <DecisionPanel
        state={state}
        decision={defaultPlayerDecision}
        onChange={() => {}}
      />,
    );
    const card = screen.getByTestId("kpi-仓储");
    expect(within(card).getByText(expected.toLocaleString())).toBeTruthy();
  });

  it("战伤显示 faction.warFatigue（v0.9.4 字段）", () => {
    const state = createMvpScenario();
    state.factions[state.playerFactionId].warFatigue = 42;
    render(
      <DecisionPanel
        state={state}
        decision={defaultPlayerDecision}
        onChange={() => {}}
      />,
    );
    const card = screen.getByTestId("kpi-战伤");
    expect(within(card).getByText("42")).toBeTruthy();
    expect(within(card).getByText("未起")).toBeTruthy();
  });
});
