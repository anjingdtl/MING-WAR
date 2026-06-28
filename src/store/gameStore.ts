import { create } from "zustand";
import { applyEventOption } from "../core/eventEngine";
import { simulateMonth } from "../core/simulation";
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
  selectedRegionId: "beijing",
  mapLayer: "control",
  pendingEventId: null,
  startGame: (factionId, seed) =>
    set({
      state: createMvpScenario(factionId, seed),
      decision: defaultPlayerDecision,
      selectedRegionId: "beijing",
      pendingEventId: null
    }),
  setDecision: (decision) => set({ decision: { ...get().decision, ...decision } }),
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
