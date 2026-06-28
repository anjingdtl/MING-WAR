import type { GameState, PlayerDecision, RegionId } from "./types";

export function getFactionRegionIds(state: GameState, factionId: string): RegionId[] {
  return Object.values(state.regions)
    .filter((region) => region.controllerFactionId === factionId)
    .map((region) => region.id);
}

export function getValidMilitaryTargets(state: GameState, factionId: string): RegionId[] {
  const controlled = new Set(getFactionRegionIds(state, factionId));
  const targets = new Set<RegionId>();
  for (const regionId of controlled) {
    const region = state.regions[regionId];
    for (const connectionId of region.connections) {
      const connection = state.regions[connectionId];
      if (connection.controllerFactionId !== factionId) {
        targets.add(connectionId);
      }
    }
  }
  return [...targets];
}

export function normalizePlayerDecision(state: GameState, decision: PlayerDecision): PlayerDecision {
  const validTargets = getValidMilitaryTargets(state, state.playerFactionId);
  const targetRegionId =
    decision.targetRegionId && validTargets.includes(decision.targetRegionId)
      ? decision.targetRegionId
      : validTargets[0] ?? null;
  return {
    targetRegionId,
    posture: decision.posture,
    domesticFocus: decision.domesticFocus
  };
}
