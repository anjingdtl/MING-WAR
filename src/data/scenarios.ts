import type { FactionState, GameState, PlayerDecision } from "../core/types";
import { initializePopGroups } from "../core/populationGroups";
import { initializeIndustries, initializeMarket } from "../core/market";
import { factionTemplates } from "./factions";
import { regionTemplates } from "./regions";

export const defaultPlayerDecision: PlayerDecision = {
  targetRegionId: "liaodong",
  posture: "balanced",
  domesticFocus: "administration"
};

const rebelFaction: FactionState = {
  id: "rebels",
  name: "义军",
  type: "rebel",
  treasury: 0,
  grainReserve: 0,
  armyTotal: 0,
  administration: 20,
  militaryOrganization: 35,
  legitimacy: 15,
  corruption: 20,
  centralization: 10,
  warExhaustion: 0,
  capitalRegionId: "shaanxi",
  primaryColor: "#3A4A3A",
  traits: ["流民武装", "无固定补给"],
  aiProfile: {
    aggression: 55,
    riskTolerance: 60,
    economicFocus: 25,
    centralizationPreference: 10,
    historicalGoalWeight: 20,
    defensePriority: 40,
    warEndurance: 30
  },
  status: "active",
  cliques: [
    { cliqueId: "donglin", support: 30, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "eunuchs", support: 30, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "gentry", support: 30, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "generals", support: 30, strength: 0, activeModifier: 0, approval: 50 },
  ],
  administrationBase: 20,
};

export function createMvpScenario(playerFactionId = "ming", seed = 157301): GameState {
  // P2: initialize pop groups for each region
  // P3: initialize industries and markets for each region
  const regionsWithPops = structuredClone(regionTemplates);
  for (const region of Object.values(regionsWithPops)) {
    region.popGroups = initializePopGroups(region.id, region.population);
    region.industries = initializeIndustries(region.id, region.terrain, region.agriculture, region.commerce);
    region.market = initializeMarket(region.id);
  }

  return {
    version: "0.3.0",
    currentDate: "1573-01",
    endDate: "1621-12",
    seed,
    playerFactionId,
    factions: { ...structuredClone(factionTemplates), rebels: structuredClone(rebelFaction) },
    regions: regionsWithPops,
    wars: [],
    activeModifiers: [],
    eventFlags: {},
    history: [],
    reports: [],
    alerts: [],
    gameStatus: "playing"
  };
}
