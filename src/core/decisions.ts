import type { GameState, PlayerDecision, RegionId } from "./types";
import { hasTruce, isAlly } from "./diplomacy";

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
        const ownerFaction = connection.controllerFactionId;
        // S5d: 外交约束开战 —— 停战期或盟友控制的地区不可攻击（玩家与 AI
        // 同规则，复用 getValidMilitaryTargets 通道）。停战制造备战窗口、
        // 同盟阻止互攻，让外交环真正约束战争。
        if (
          !hasTruce(state, factionId, ownerFaction) &&
          !isAlly(state, factionId, ownerFaction)
        ) {
          targets.add(connectionId);
        }
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
