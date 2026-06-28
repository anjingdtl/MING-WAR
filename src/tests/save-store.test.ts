import { describe, expect, it } from "vitest";
import { createSaveGame } from "../save/saveManager";
import { useGameStore } from "../store/gameStore";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("save manager", () => {
  it("creates versioned save objects", () => {
    const state = createMvpScenario("ming", 1);
    const save = createSaveGame("测试存档", state, defaultPlayerDecision);
    expect(save.version).toBe("0.1.0");
    expect(save.state.currentDate).toBe("1573-01");
  });
});

describe("game store", () => {
  it("starts and advances a game", () => {
    useGameStore.getState().startGame("ming", 77);
    useGameStore.getState().advanceOneMonth();
    expect(useGameStore.getState().state.currentDate).toBe("1573-02");
  });
});
