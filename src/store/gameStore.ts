import { create } from "zustand";
import { applyEventOption } from "../core/eventEngine";
import { simulateMonth } from "../core/simulation";
import { applyCliqueReactions, computeCliqueReactions } from "../core/clique";
import { cliqueTemplates } from "../data/cliques";
import type { GameEvent } from "../core/eventEngine";
import type { GameState, PlayerDecision } from "../core/types";
import { mvpEvents } from "../data/events";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { proposeAlliance as doProposeAlliance } from "../core/diplomacy";
import { requestPeace as doRequestPeace } from "../core/peace";
import { loadGame as loadSaveGame } from "../save/saveManager";
import { useUiStore } from "./uiStore";
import { useGameViewStore, derivePlayerFactionSummary } from "./gameViewStore";

/**
 * v0.6-stability-design §3.4: 兼容层 gameStore。
 *
 * 新版架构推荐：
 * - useUiStore 持有 UI 状态（selectedRegionId / mapLayer / pendingEventId）
 * - useGameViewStore 持有 view 派生（playerFaction / reports / alerts）
 * - useGameStore 保留完整 state + 玩家决策 + 模拟动作（向后兼容）
 *
 * UI 状态已迁出本 store；为兼容老代码，selectRegion / setMapLayer
 * 在 setState 的同时转发到 useUiStore。
 */

interface GameStore {
  state: GameState;
  decision: PlayerDecision;
  startGame: (factionId: string, seed: number) => void;
  setDecision: (decision: Partial<PlayerDecision>) => void;
  advanceOneMonth: () => void;
  resolveEvent: (optionId: string) => void;
  loadGameFromSave: (saveId: string) => Promise<boolean>;
  /** S6 遗留#2：主动外交动作 */
  proposeAlliance: (targetFactionId: string) => void;
  requestPeace: (warId: string) => void;
}

/** 把权威 state 同步到 view store。 */
function syncViewStore(state: GameState): void {
  const view = useGameViewStore.getState();
  view.setView({
    currentDate: state.currentDate,
    gameStatus: state.gameStatus,
    playerFaction: derivePlayerFactionSummary(state),
    reports: state.reports ?? []
  });
  view.setAlerts(state.alerts ?? []);
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createMvpScenario(),
  decision: defaultPlayerDecision,
  startGame: (factionId, seed) => {
    const newState = createMvpScenario(factionId, seed);
    // 重置 UI 状态
    useUiStore.getState().selectRegion("beizhili");
    useUiStore.getState().setPendingEventId(null);
    useUiStore.getState().setMapLayer("control");
    set({ state: newState, decision: defaultPlayerDecision });
    syncViewStore(newState);
  },
  setDecision: (decision) => {
    const current = get();
    const newDecision = { ...current.decision, ...decision };
    useGameViewStore.getState().setDecision(newDecision);

    // Apply clique reactions if domestic focus changed
    if (decision.domesticFocus && decision.domesticFocus !== current.decision.domesticFocus) {
      const playerFaction = current.state.factions[current.state.playerFactionId];
      if (playerFaction?.cliques?.length) {
        const reactions = computeCliqueReactions(
          decision.domesticFocus,
          current.decision.domesticFocus,
          playerFaction.cliques,
          cliqueTemplates,
        );
        const updatedCliques = applyCliqueReactions(playerFaction.cliques, reactions);
        const newState = structuredClone(current.state);
        newState.factions[current.state.playerFactionId].cliques = updatedCliques;
        set({ decision: newDecision, state: newState });
        syncViewStore(newState);
        return;
      }
    }

    set({ decision: newDecision });
  },
  advanceOneMonth: () => {
    const current = get();
    const result = simulateMonth({
      state: current.state,
      playerDecision: current.decision,
      randomSeed: current.state.seed
    });
    // 同步到 view store
    const triggeredId = result.triggeredEvents[0]?.eventId ?? null;
    useUiStore.getState().setPendingEventId(triggeredId);
    useUiStore.getState().setSimulationStatus("running");
    set({ state: result.nextState });
    syncViewStore(result.nextState);
    if (result.nextState.gameStatus === "finished") {
      useUiStore.getState().setSimulationStatus("idle");
    } else {
      useUiStore.getState().setSimulationStatus("idle");
    }
  },
  resolveEvent: (optionId) => {
    const current = get();
    const event = mvpEvents.find((item): item is GameEvent => item.id === useUiStore.getState().pendingEventId);
    if (!event) return;
    const newState = applyEventOption(current.state, event, optionId);
    useUiStore.getState().setPendingEventId(null);
    set({ state: newState });
    syncViewStore(newState);
  },
  loadGameFromSave: async (saveId) => {
    const save = await loadSaveGame(saveId);
    if (!save) return false;
    useUiStore.getState().setPendingEventId(null);
    useUiStore.getState().setSimulationStatus("idle");
    set({ state: save.state, decision: save.decision });
    useGameViewStore.getState().setDecision(save.decision);
    syncViewStore(save.state);
    return true;
  },
  proposeAlliance: (targetFactionId) => {
    const current = get();
    const newState = structuredClone(current.state);
    if (doProposeAlliance(newState, current.state.playerFactionId, targetFactionId)) {
      set({ state: newState });
      syncViewStore(newState);
    }
  },
  requestPeace: (warId) => {
    const current = get();
    const newState = structuredClone(current.state);
    if (doRequestPeace(newState, current.state.playerFactionId, warId)) {
      set({ state: newState });
      syncViewStore(newState);
    }
  }
}));
