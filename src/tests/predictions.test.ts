import { describe, expect, it } from "vitest";
import {
  projectFinancials,
  projectGrainChange,
  projectCampaign,
  projectCliqueReactions
} from "../ui/lens/predictions";
import { createMvpScenario } from "../data/scenarios";
import type { PlayerDecision } from "../core/types";

const baseDecision: PlayerDecision = {
  targetRegionId: "shanxi",
  posture: "balanced",
  domesticFocus: "finance"
};

describe("predictions / projectFinancials", () => {
  it("returns projection with required fields", () => {
    const state = createMvpScenario();
    const result = projectFinancials(state, baseDecision);
    expect(result.focus).toBe("finance");
    expect(typeof result.taxIncome).toBe("number");
    expect(typeof result.militaryCost).toBe("number");
    expect(typeof result.netFlow).toBe("number");
  });

  it("finance focus yields higher tax than agriculture", () => {
    const state = createMvpScenario();
    const fin = projectFinancials(state, { ...baseDecision, domesticFocus: "finance" });
    const agr = projectFinancials(state, { ...baseDecision, domesticFocus: "agriculture" });
    expect(fin.taxIncome).toBeGreaterThan(agr.taxIncome);
  });

  it("net flow equals tax minus military cost", () => {
    const state = createMvpScenario();
    const result = projectFinancials(state, baseDecision);
    expect(result.netFlow).toBe(result.taxIncome - result.militaryCost);
  });
});

describe("predictions / projectGrainChange", () => {
  it("agriculture focus increases grain", () => {
    const state = createMvpScenario();
    const agr = projectGrainChange(state, { ...baseDecision, domesticFocus: "agriculture" });
    const mil = projectGrainChange(state, { ...baseDecision, domesticFocus: "military" });
    expect(agr).toBeGreaterThan(mil);
  });
});

describe("predictions / projectCampaign", () => {
  it("returns null when no target", () => {
    const state = createMvpScenario();
    const result = projectCampaign(state, { ...baseDecision, targetRegionId: null });
    expect(result).toBeNull();
  });

  it("returns projection for valid target", () => {
    const state = createMvpScenario();
    const result = projectCampaign(state, baseDecision);
    expect(result).not.toBeNull();
    expect(result!.targetRegionId).toBe("shanxi");
    expect(result!.winChance).toBeGreaterThan(0);
    expect(result!.winChance).toBeLessThanOrEqual(1);
    expect(result!.estimatedMonths).toBeGreaterThan(0);
  });

  it("aggressive posture increases win chance vs conservative", () => {
    const state = createMvpScenario();
    const aggressive = projectCampaign(state, { ...baseDecision, posture: "aggressive" });
    const conservative = projectCampaign(state, { ...baseDecision, posture: "conservative" });
    expect(aggressive!.winChance).toBeGreaterThan(conservative!.winChance);
  });
});

describe("predictions / projectCliqueReactions", () => {
  it("returns empty cliques for faction with no cliques", () => {
    const state = createMvpScenario();
    const player = state.factions[state.playerFactionId];
    const factionNoCliques = { ...player, cliques: [] };
    const result = projectCliqueReactions(factionNoCliques, baseDecision);
    expect(result.cliques).toHaveLength(0);
    expect(result.adminModifierDelta).toBe(0);
  });

  it("returns cliques for faction with cliques", () => {
    const state = createMvpScenario();
    const player = state.factions[state.playerFactionId];
    const result = projectCliqueReactions(player, baseDecision);
    expect(result.cliques.length).toBeGreaterThan(0);
  });
});
