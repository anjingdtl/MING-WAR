import { create } from "zustand";
import { applyEventOption } from "../core/eventEngine";
import { simulateMonth } from "../core/simulation";
import { applyCliqueReactions, computeCliqueReactions } from "../core/clique";
import { cliqueTemplates } from "../data/cliques";
import type { GameEvent } from "../core/eventEngine";
import type { GameState, MapLayer, PlayerDecision, RegionId } from "../core/types";
import { mvpEvents } from "../data/events";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

interface GameStore {
  state: GameState;
  decision: PlayerDecision;
  selectedRegionId: RegionId | null;
  mapLayer: MapLayer;
  pendingEventId: string | null;
  startGame: (factionId: string, seed: number) => void;
  setDecision: (decision: Partial<PlayerDecision>) => void;
  selectRegion: (regionId: RegionId | null) => void;
  setMapLayer: (layer: MapLayer) => void;
  advanceOneMonth: () => void;
  resolveEvent: (optionId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createMvpScenario(),
  decision: defaultPlayerDecision,
  selectedRegionId: "beizhili",
  mapLayer: "control",
  pendingEventId: null,
  startGame: (factionId, seed) =>
    set({
      state: createMvpScenario(factionId, seed),
      decision: defaultPlayerDecision,
      selectedRegionId: "beizhili",
      pendingEventId: null
    }),
  setDecision: (decision) => {
    const current = get();
    const newDecision = { ...current.decision, ...decision };

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
        return;
      }
    }

    set({ decision: newDecision });
  },
  selectRegion: (regionId) => set({ selectedRegionId: regionId }),
  setMapLayer: (layer) => set({ mapLayer: layer }),
  advanceOneMonth: () => {
    const current = get();
    const result = simulateMonth({
      state: current.state,
      playerDecision: current.decision,
      randomSeed: current.state.seed
    });
    set({
      state: result.nextState,
      pendingEventId: result.triggeredEvents[0]?.eventId ?? null
    });
  },
  resolveEvent: (optionId) => {
    const current = get();
    const event = mvpEvents.find((item): item is GameEvent => item.id === current.pendingEventId);
    if (!event) return;
    set({
      state: applyEventOption(current.state, event, optionId),
      pendingEventId: null
    });
  }
}));
