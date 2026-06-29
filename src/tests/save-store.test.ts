import { describe, expect, it } from "vitest";
import { createSaveGame, migrateGameState } from "../save/saveManager";
import { useGameStore } from "../store/gameStore";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("save manager", () => {
  it("creates versioned save objects", () => {
    const state = createMvpScenario("ming", 1);
    const save = createSaveGame("测试存档", state, defaultPlayerDecision);
    expect(save.version).toBe("0.3.0");
    expect(save.state.currentDate).toBe("1573-01");
  });

  it("migrates old save state to v0.3.0", () => {
    const state = createMvpScenario("ming", 2);
    // Simulate old state by stripping clique fields
    const oldState = structuredClone(state);
    oldState.version = "0.1.0";
    for (const faction of Object.values(oldState.factions)) {
      (faction as Record<string, unknown>).cliques = undefined;
      (faction as Record<string, unknown>).administrationBase = undefined;
    }

    const migrated = migrateGameState(oldState as typeof state);

    expect(migrated.version).toBe("0.3.0");
    for (const faction of Object.values(migrated.factions)) {
      expect(faction.cliques).toBeDefined();
      expect(faction.cliques.length).toBe(4);
      expect(faction.administrationBase).toBeGreaterThan(0);
    }
  });
});

describe("game store", () => {
  it("starts and advances a game", () => {
    useGameStore.getState().startGame("ming", 77);
    useGameStore.getState().advanceOneMonth();
    expect(useGameStore.getState().state.currentDate).toBe("1573-02");
  });
});
