import type { GameState, PlayerDecision } from "../core/types";
import { factionTemplates } from "./factions";
import { regionTemplates } from "./regions";

export const defaultPlayerDecision: PlayerDecision = {
  targetRegionId: "liaodong",
  posture: "balanced",
  domesticFocus: "administration"
};

export function createMvpScenario(playerFactionId = "ming", seed = 157301): GameState {
  return {
    version: "0.1.0",
    currentDate: "1573-01",
    endDate: "1621-12",
    seed,
    playerFactionId,
    factions: structuredClone(factionTemplates),
    regions: structuredClone(regionTemplates),
    wars: [],
    activeModifiers: [],
    eventFlags: {},
    history: [],
    reports: [],
    alerts: [],
    gameStatus: "playing"
  };
}
