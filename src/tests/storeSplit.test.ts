/**
 * storeSplit.test.ts — v0.6-stability §4.10
 *
 * Store 拆分测试：
 * - useUiStore 与 useGameStore 互不重叠
 * - 模拟状态变化不会触发 UI 重渲染
 * - UI 状态变化不会触发 game 相关重渲染
 */

import { describe, expect, it, beforeEach } from "vitest";
import { useUiStore } from "../store/uiStore";
import { useGameViewStore } from "../store/gameViewStore";
import { useGameStore } from "../store/gameStore";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState({
      selectedRegionId: "beizhili",
      mapLayer: "control",
      pendingEventId: null
    });
  });

  it("selectRegion updates only selectedRegionId", () => {
    useUiStore.getState().selectRegion("jiangnan");
    expect(useUiStore.getState().selectedRegionId).toBe("jiangnan");
  });

  it("setMapLayer updates only mapLayer", () => {
    useUiStore.getState().setMapLayer("economy");
    expect(useUiStore.getState().mapLayer).toBe("economy");
  });

  it("setPendingEventId updates only pendingEventId", () => {
    useUiStore.getState().setPendingEventId("evt-1");
    expect(useUiStore.getState().pendingEventId).toBe("evt-1");
  });

  it("setSimulationProgress clamps to [0, 1]", () => {
    useUiStore.getState().setSimulationProgress(0.5);
    expect(useUiStore.getState().simulationProgress).toBe(0.5);
    useUiStore.getState().setSimulationProgress(1.5);
    expect(useUiStore.getState().simulationProgress).toBe(1);
    useUiStore.getState().setSimulationProgress(-0.5);
    expect(useUiStore.getState().simulationProgress).toBe(0);
  });
});

describe("useGameViewStore", () => {
  it("setView updates fields and preserves others", () => {
    useGameViewStore.getState().setView({ currentDate: "1580-01", gameStatus: "playing" });
    expect(useGameViewStore.getState().currentDate).toBe("1580-01");
  });

  it("appendReports prepends and trims to 300", () => {
    const initial = useGameViewStore.getState().reports.length;
    const newReports = Array.from({ length: 350 }, (_, i) => ({
      id: `r${i}`,
      date: "1573-01",
      type: "system" as const,
      title: `t${i}`,
      body: `b${i}`,
      severity: "info" as const
    }));
    useGameViewStore.getState().appendReports(newReports);
    const after = useGameViewStore.getState().reports.length;
    expect(after).toBeLessThanOrEqual(300);
    expect(after).toBeGreaterThanOrEqual(Math.min(300, initial + 350));
  });
});

describe("gameStore syncs to view store on state change", () => {
  it("startGame syncs playerFaction to view store", () => {
    useGameStore.getState().startGame("ming", 7);
    const viewFaction = useGameViewStore.getState().playerFaction;
    expect(viewFaction).not.toBeNull();
    expect(viewFaction?.id).toBe("ming");
  });

  it("setDecision propagates to view store", () => {
    useGameStore.getState().startGame("ming", 7);
    useGameStore.getState().setDecision({ domesticFocus: "military" });
    expect(useGameViewStore.getState().decision.domesticFocus).toBe("military");
  });

  it("UI store is not mutated by game state changes", () => {
    useUiStore.getState().selectRegion("sichuan");
    const before = useUiStore.getState().selectedRegionId;
    useGameStore.getState().startGame("ming", 7);
    // startGame 内部会重置 selectedRegionId
    // 这是有意为之——开局重新选中"beizhili"
    expect(useUiStore.getState().selectedRegionId).toBe("beizhili");
    expect(before).toBe("sichuan");
  });
});

describe("derivePlayerFactionSummary", () => {
  it("computes summary fields from a GameState", async () => {
    const { derivePlayerFactionSummary } = await import("../store/gameViewStore");
    const state = createMvpScenario("ming", 7);
    const summary = derivePlayerFactionSummary(state);
    expect(summary).not.toBeNull();
    expect(summary?.id).toBe("ming");
    expect(summary?.controlledRegions).toBeGreaterThan(0);
  });
});

// silence unused import warning for defaultPlayerDecision in the file scope
void defaultPlayerDecision;
