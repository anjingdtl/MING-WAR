import type { DomesticFocus, FactionState, GameState, PlayerDecision, RegionState } from "./types";
import { getValidMilitaryTargets } from "./decisions";
import { cliqueTemplates } from "../data/cliques";

const ALL_FOCI: DomesticFocus[] = ["agriculture", "finance", "military", "administration", "recovery", "frontier"];

function scoreTarget(region: RegionState, faction: FactionState): number {
  const coreBonus = region.coreFactionIds.includes(faction.id) ? 30 : 0;
  const value = region.population / 100000 + region.taxCapacity + region.agriculture;
  const weakness = 100 - region.control + Math.max(0, 50000 - region.garrison) / 2000;
  const frontierBonus = faction.traits.some((trait) => trait.includes("辽东")) && region.id.includes("liao") ? 25 : 0;
  return value + weakness + coreBonus + frontierBonus;
}

export function chooseDomesticFocus(faction: FactionState, regions: RegionState[]): DomesticFocus {
  const crisisScores = computeCrisisScores(faction, regions);
  const cliqueScores = computeCliqueSatisfactionScores(faction);

  let bestFocus: DomesticFocus = "recovery";
  let bestScore = -Infinity;
  for (const focus of ALL_FOCI) {
    const score = crisisScores[focus] * 0.6 + cliqueScores[focus] * 0.4;
    if (score > bestScore) {
      bestScore = score;
      bestFocus = focus;
    }
  }
  return bestFocus;
}

function computeCrisisScores(
  faction: FactionState,
  regions: RegionState[],
): Record<DomesticFocus, number> {
  const scores: Record<DomesticFocus, number> = {
    agriculture: 0, finance: 0, military: 0,
    administration: 0, recovery: 0, frontier: 0,
  };
  const averageStability = regions.reduce((sum, r) => sum + r.stability, 0) / Math.max(1, regions.length);

  // Grain shortage → agriculture
  if (faction.grainReserve < faction.armyTotal * 1.5) {
    scores.agriculture += 50;
  } else if (faction.grainReserve < faction.armyTotal * 3) {
    scores.agriculture += 20;
  }

  // Treasury shortage → finance
  if (faction.treasury < faction.armyTotal * 6) {
    scores.finance += 50;
  } else if (faction.treasury < faction.armyTotal * 12) {
    scores.finance += 20;
  }

  // High corruption → administration
  if (faction.corruption > 45) {
    scores.administration += 40;
  } else if (faction.corruption > 30) {
    scores.administration += 15;
  }

  // Low stability → recovery
  if (averageStability < 55) {
    scores.recovery += 40;
  } else if (averageStability < 70) {
    scores.recovery += 15;
  }

  // Aggressive AI → military
  if (faction.aiProfile.aggression > 60) {
    scores.military += 35;
  }

  // Frontier trait → frontier
  if (faction.traits.some((t) => t.includes("辽东") || t.includes("边"))) {
    scores.frontier += 20;
  }
  scores.frontier += 5; // baseline

  return scores;
}

function computeCliqueSatisfactionScores(
  faction: FactionState,
): Record<DomesticFocus, number> {
  const scores: Record<DomesticFocus, number> = {
    agriculture: 0, finance: 0, military: 0,
    administration: 0, recovery: 0, frontier: 0,
  };

  if (!faction.cliques?.length) return scores;

  // Find the most dissatisfied clique (lowest support)
  const sorted = [...faction.cliques].sort((a, b) => a.support - b.support);
  const unhappiest = sorted[0];
  const def = cliqueTemplates[unhappiest.cliqueId];
  if (!def) return scores;

  // Score each focus by how much it would satisfy the unhappiest clique
  for (const focus of ALL_FOCI) {
    const affinity = def.policyAffinities[focus];
    // Normalize affinity from [-10, +10] to [0, 40] score range
    scores[focus] = (affinity + 10) * 2;
  }

  return scores;
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
