import { describe, expect, it } from "vitest";
import type { FactionState, PlayerDecision, RegionState } from "../core/types";

describe("domain types", () => {
  it("supports the MVP faction, region, and decision shapes", () => {
    const faction: FactionState = {
      id: "ming",
      name: "大明",
      type: "dynasty",
      treasury: 8200000,
      grainReserve: 12500000,
      armyTotal: 680000,
      administration: 72,
      militaryOrganization: 58,
      legitimacy: 92,
      corruption: 34,
      centralization: 68,
      warExhaustion: 5,
      capitalRegionId: "beijing",
      primaryColor: "#C63D32",
      traits: ["bureaucracy"],
      aiProfile: {
        aggression: 35,
        riskTolerance: 30,
        economicFocus: 65,
        centralizationPreference: 70,
        historicalGoalWeight: 80,
        defensePriority: 70,
        warEndurance: 45
      },
      status: "active"
    };

    const region: RegionState = {
      id: "beijing",
      name: "北京",
      terrain: "plain",
      climate: "temperate",
      ownerFactionId: "ming",
      controllerFactionId: "ming",
      population: 1200000,
      populationCapacity: 1800000,
      agriculture: 45,
      commerce: 70,
      taxCapacity: 82,
      stability: 78,
      control: 90,
      fortification: 85,
      grainStock: 650000,
      garrison: 80000,
      coreFactionIds: ["ming"],
      connections: ["liaoxi"],
      activeDisasters: [],
      rebelPressure: 0
    };

    const decision: PlayerDecision = {
      targetRegionId: "liaoxi",
      posture: "balanced",
      domesticFocus: "administration"
    };

    expect(faction.capitalRegionId).toBe(region.id);
    expect(decision.targetRegionId).toBe("liaoxi");
  });
});
