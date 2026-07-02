import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MainMenu } from "../ui/dialogs/MainMenu";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { createSaveGame, saveGame, writeSave } from "../save/saveManager";
import { useGameStore } from "../store/gameStore";
import type { SerializedSave } from "../runtime/viewSnapshot";
import { GAME_VERSION } from "../core/version";
import { computeStateHash } from "../core/stateHash";

async function resetDb() {
  const idb = globalThis.indexedDB;
  if (!idb) return;
  await new Promise<void>((resolve) => {
    const req = idb.deleteDatabase("wanli-collapse");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function makeSerializedSave(id: string, name: string, currentDate: string): SerializedSave {
  const state = createMvpScenario("ming", 157301);
  state.currentDate = currentDate;
  return {
    format: "ming-war-save",
    saveVersion: 1,
    gameVersion: GAME_VERSION,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    checksum: computeStateHash(state),
    metadata: {
      currentDate,
      playerFaction: "ming",
      gameVersion: GAME_VERSION,
      saveVersion: 1,
      seed: state.seed,
      status: "active",
      controlledRegions: 18,
      playTimeMinutes: 12,
      saveName: name
    },
    state,
    decision: defaultPlayerDecision
  };
}

describe("MainMenu", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("shows the three requested main menu actions", () => {
    render(<MainMenu onStart={vi.fn()} onLoad={vi.fn()} />);

    expect(screen.getByRole("button", { name: "开始游戏" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "载入进度" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "退出游戏" })).toBeTruthy();
  });

  it("opens a save list and loads the selected save", async () => {
    const oldState = createMvpScenario("ming", 77);
    oldState.currentDate = "1580-03";
    await saveGame(createSaveGame("旧档案", oldState, defaultPlayerDecision));
    await writeSave(makeSerializedSave("new", "新档案", "1590-08"));
    const onLoad = vi.fn();

    render(<MainMenu onStart={vi.fn()} onLoad={onLoad} />);
    fireEvent.click(screen.getByRole("button", { name: "载入进度" }));

    expect(await screen.findByText("新档案")).toBeTruthy();
    expect(screen.getByText("旧档案")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /载入 新档案/ }));

    await waitFor(() => expect(onLoad).toHaveBeenCalledWith("新档案"));
  });
});

describe("game store save loading", () => {
  beforeEach(async () => {
    await resetDb();
    useGameStore.getState().startGame("ming", 1);
  });

  it("loads a selected save into the authoritative game state", async () => {
    const state = createMvpScenario("ming", 91);
    state.currentDate = "1601-11";
    const save = createSaveGame("辽东战局", state, defaultPlayerDecision);
    await saveGame(save);

    await useGameStore.getState().loadGameFromSave(save.id);

    expect(useGameStore.getState().state.currentDate).toBe("1601-11");
    expect(useGameStore.getState().state.seed).toBe(91);
  });
});
