import type { DomesticFocus, FactionState, GameState, PlayerDecision, RegionState } from "./types";
import { getValidMilitaryTargets } from "./decisions";

function scoreTarget(region: RegionState, faction: FactionState): number {
  const coreBonus = region.coreFactionIds.includes(faction.id) ? 30 : 0;
  const value = region.population / 100000 + region.taxCapacity + region.agriculture;
  const weakness = 100 - region.control + Math.max(0, 50000 - region.garrison) / 2000;
  const frontierBonus = faction.traits.some((trait) => trait.includes("辽东")) && region.id.includes("liao") ? 25 : 0;
  return value + weakness + coreBonus + frontierBonus;
}

export function chooseDomesticFocus(faction: FactionState, regions: RegionState[]): DomesticFocus {
  const averageStability = regions.reduce((sum, region) => sum + region.stability, 0) / Math.max(1, regions.length);
  const grainLow = faction.grainReserve < faction.armyTotal * 1.5;
  if (grainLow) return "agriculture";
  if (faction.treasury < faction.armyTotal * 6) return "finance";
  if (faction.corruption > 45) return "administration";
  if (averageStability < 55) return "recovery";
  if (faction.aiProfile.aggression > 60) return "military";
  return "frontier";
}

export function chooseAiDecision(state: GameState, factionId: string): PlayerDecision {
  const faction = state.factions[factionId];
  const controlledRegions = Object.values(state.regions).filter((region) => region.controllerFactionId === factionId);
  const targets = getValidMilitaryTargets(state, factionId);
  const targetRegionId =
    targets
      .map((targetId) => state.regions[targetId])
      .sort((a, b) => scoreTarget(b, faction) - scoreTarget(a, faction))[0]?.id ?? null;
  const posture = faction.aiProfile.riskTolerance > 60 ? "aggressive" : faction.aiProfile.defensePriority > 65 ? "conservative" : "balanced";
  return {
    targetRegionId,
    posture,
    domesticFocus: chooseDomesticFocus(faction, controlledRegions)
  };
}

export function chooseAllAiDecisions(state: GameState): Record<string, PlayerDecision> {
  return Object.fromEntries(
    Object.values(state.factions)
      .filter((faction) => faction.id !== state.playerFactionId && faction.status === "active")
      .map((faction) => [faction.id, chooseAiDecision(state, faction.id)])
  );
}
