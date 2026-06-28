import type { FactionId, GameState } from "./types";

export interface FactionScore {
  factionId: FactionId;
  factionName: string;
  controlledRegions: number;
  controlledPopulation: number;
  treasury: number;
  grainReserve: number;
  averageStability: number;
  legitimacy: number;
  score: number;
}

export function scoreFaction(state: GameState, factionId: FactionId): FactionScore {
  const faction = state.factions[factionId];
  const regions = Object.values(state.regions).filter((region) => region.controllerFactionId === factionId);
  const controlledPopulation = regions.reduce((sum, region) => sum + region.population, 0);
  const averageStability =
    regions.length === 0 ? 0 : regions.reduce((sum, region) => sum + region.stability, 0) / regions.length;
  const score = Math.round(
    controlledPopulation / 10000 +
      regions.length * 120 +
      Math.max(0, faction.treasury) / 50000 +
      Math.max(0, faction.grainReserve) / 75000 +
      averageStability * 4 +
      faction.legitimacy * 3 -
      faction.warExhaustion * 5
  );
  return {
    factionId,
    factionName: faction.name,
    controlledRegions: regions.length,
    controlledPopulation,
    treasury: faction.treasury,
    grainReserve: faction.grainReserve,
    averageStability: Number(averageStability.toFixed(1)),
    legitimacy: faction.legitimacy,
    score
  };
}

export function scoreAllFactions(state: GameState): FactionScore[] {
  return Object.keys(state.factions)
    .map((factionId) => scoreFaction(state, factionId))
    .sort((a, b) => b.score - a.score);
}
