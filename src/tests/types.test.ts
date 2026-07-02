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
      capitalRegionId: "beizhili",
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
      status: "active",
      cliques: [
        { cliqueId: "imperial", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "reform", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "donglin", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "eunuch", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "frontier", support: 50, strength: 0, activeModifier: 0, approval: 50 },
      ],
      administrationBase: 72,
      homeTurfMult: 1.05,
      maxCommitRatio: 0.30,
      warCommitments: {},
      // v0.9: 兵员池/征兵率/AI 倾向/编队清单
      mobilizationPool: 136000,
      conscriptionRate: 0.15,
      warDesireModifier: -5,
      formations: [],
    };

    const region: RegionState = {
      id: "beizhili",
      name: "北直隶",
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
      connections: ["liaodong"],
      activeDisasters: [],
      rebelPressure: 0,
      // v0.9: 物流节点/军事子结构
      logisticsNode: null,
      military: {
        infrastructureLevel: 0,
        seasonalState: "normal",
        localSupport: 50,
        occupationResistance: 0,
        forageCapacity: 0.5,
        strategicValue: 30,
      }
    };

    const decision: PlayerDecision = {
      targetRegionId: "liaodong",
      posture: "balanced",
      domesticFocus: "administration"
    };

    expect(faction.capitalRegionId).toBe(region.id);
    expect(decision.targetRegionId).toBe("liaodong");
  });
});
