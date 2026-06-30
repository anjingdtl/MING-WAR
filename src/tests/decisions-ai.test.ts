import { describe, expect, it } from "vitest";
import { chooseAiDecision, chooseDomesticFocus } from "../core/ai";
import { getValidMilitaryTargets, normalizePlayerDecision } from "../core/decisions";
import { createMvpScenario } from "../data/scenarios";

describe("decision validation", () => {
  it("returns adjacent enemy targets", () => {
    const state = createMvpScenario("ming");
    // 建州与大明敌对且无停战 → 有效目标
    expect(getValidMilitaryTargets(state, "ming")).toContain("jianzhou");
    // 土默特与大明 1571 俺答封贡后处于 60 月停战期 → 被 S5d 外交约束过滤
    expect(getValidMilitaryTargets(state, "ming")).not.toContain("tumed_steppe");
  });

  it("replaces invalid player targets with a valid target", () => {
    const state = createMvpScenario("ming");
    const decision = normalizePlayerDecision(state, {
      targetRegionId: "guangdong",
      posture: "balanced",
      domesticFocus: "administration"
    });
    expect(decision.targetRegionId).not.toBe("guangdong");
  });
});

describe("AI choices", () => {
  it("chooses a military target for Jianzhou", () => {
    const state = createMvpScenario("ming");
    const decision = chooseAiDecision(state, "jianzhou");
    expect(decision.targetRegionId).toBeTruthy();
  });

  it("responds to treasury crisis with finance focus", () => {
    const state = createMvpScenario();
    const faction = { ...state.factions.ming, treasury: 1 };
    const regions = Object.values(state.regions).filter((region) => region.controllerFactionId === "ming");
    expect(chooseDomesticFocus(faction, regions)).toBe("finance");
  });
});
