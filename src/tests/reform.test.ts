import { describe, expect, it } from "vitest";
import type { FactionCliqueState, GameState } from "../core/types";
import {
  advanceReforms,
  autoProposeReforms,
  computeReformMomentum,
  computeReformSupport,
  enactLaw,
  proposeReform,
} from "../core/reform";
import { isLawEnacted, lawLibrary, lawModifierId } from "../data/laws";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

function setClique(
  state: GameState,
  cliqueId: string,
  over: Partial<FactionCliqueState>,
): FactionCliqueState {
  const cs = state.factions.ming.cliques.find((c) => c.cliqueId === cliqueId)!;
  Object.assign(cs, over);
  return cs;
}

function getClique(state: GameState, cliqueId: string): FactionCliqueState {
  return state.factions.ming.cliques.find((c) => c.cliqueId === cliqueId)!;
}

describe("S4b: reform support & momentum", () => {
  it("low-tax draws support from donglin+gentry, opposition from eunuchs", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 40 });
    setClique(state, "gentry", { strength: 50 });
    setClique(state, "eunuchs", { strength: 10 });
    const support = computeReformSupport(state.factions.ming, "low-tax");
    expect(support.supportPower).toBe(90); // donglin+gentry
    expect(support.opposePower).toBe(10); // eunuchs
    expect(support.supporters.sort()).toEqual(["donglin", "gentry"]);
    expect(support.opponents).toEqual(["eunuchs"]);
  });

  it("land-survey is opposed by donglin+gentry with no supporters", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 40 });
    setClique(state, "gentry", { strength: 50 });
    const support = computeReformSupport(state.factions.ming, "land-survey");
    expect(support.supportPower).toBe(0);
    expect(support.opposePower).toBe(90);
    expect(support.supporters).toEqual([]);
  });

  it("a heavily-opposed reform has negative momentum; a supported one positive", () => {
    const opposed = createMvpScenario("ming", 1);
    setClique(opposed, "donglin", { strength: 40 });
    setClique(opposed, "gentry", { strength: 50 });
    expect(computeReformMomentum(opposed, opposed.factions.ming, "land-survey")).toBeLessThan(0);

    const supported = createMvpScenario("ming", 1);
    setClique(supported, "donglin", { strength: 40 });
    setClique(supported, "gentry", { strength: 50 });
    setClique(supported, "eunuchs", { strength: 10 });
    expect(computeReformMomentum(supported, supported.factions.ming, "low-tax")).toBeGreaterThan(0);
  });

  it("proposeReform respects enacted / in-progress / concurrency limits", () => {
    const state = createMvpScenario("ming", 1);
    expect(proposeReform(state, "ming", "low-tax")).not.toBeNull();
    expect(proposeReform(state, "ming", "clean-admin")).not.toBeNull();
    expect(proposeReform(state, "ming", "mining-tax")).toBeNull(); // 已达 2 条上限
    expect(proposeReform(state, "ming", "low-tax")).toBeNull(); // 已在推进
    enactLaw(state, "ming", "military-funding");
    expect(proposeReform(state, "ming", "military-funding")).toBeNull(); // 已落实
  });
});

describe("S4c: enactment applies effects & clique reactions", () => {
  it("land-survey enactment writes permanent modifier + instant effects + hurts opponents", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 40, approval: 60, support: 50 });
    setClique(state, "gentry", { strength: 50, approval: 60, support: 50 });
    const corruptionBefore = state.factions.ming.corruption;
    const centralizationBefore = state.factions.ming.centralization;

    enactLaw(state, "ming", "land-survey");

    // 永久 modifier（tax-mult）写入，可被 isLawEnacted 判定
    expect(isLawEnacted(state.activeModifiers, "ming", "land-survey")).toBe(true);
    const mod = state.activeModifiers.find((m) => m.id === lawModifierId("ming", "land-survey"));
    expect(mod).toBeDefined();
    expect(mod!.scope).toBe("faction");
    expect(mod!.remainingMonths).toBeUndefined(); // 永久
    expect(mod!.effects["tax-mult"]).toBe(0.15);

    // faction-instant：centralization +8, corruption -2
    expect(state.factions.ming.centralization).toBe(centralizationBefore + 8);
    expect(state.factions.ming.corruption).toBe(corruptionBefore - 2);

    // 反对集团（donglin+gentry）approval 暴跌 12
    expect(getClique(state, "donglin").approval).toBe(60 - 12);
    expect(getClique(state, "gentry").approval).toBe(60 - 12);
  });

  it("enactLaw is idempotent (no duplicate modifier / double instant)", () => {
    const state = createMvpScenario("ming", 1);
    enactLaw(state, "ming", "treasury-centralization");
    const centralizationAfter1 = state.factions.ming.centralization;
    enactLaw(state, "ming", "treasury-centralization"); // 重复
    expect(state.factions.ming.centralization).toBe(centralizationAfter1); // 不再叠加
    const lawMods = state.activeModifiers.filter((m) => m.id === lawModifierId("ming", "treasury-centralization"));
    expect(lawMods.length).toBe(1);
  });
});

describe("S4c: advanceReforms settles or fails", () => {
  it("a strongly-supported reform progresses to enactment", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 40 });
    setClique(state, "gentry", { strength: 50 });
    setClique(state, "eunuchs", { strength: 10 });
    proposeReform(state, "ming", "low-tax"); // momentum 正
    let enacted = false;
    for (let i = 0; i < 40 && !enacted; i++) {
      const res = advanceReforms(state);
      if (res.enacted.length > 0) enacted = true;
    }
    expect(enacted).toBe(true);
    expect(isLawEnacted(state.activeModifiers, "ming", "low-tax")).toBe(true);
  });

  it("a heavily-opposed reform fails and costs legitimacy", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 40 });
    setClique(state, "gentry", { strength: 50 });
    const legitBefore = state.factions.ming.legitimacy;
    proposeReform(state, "ming", "land-survey"); // momentum 负，强推
    let failed = false;
    for (let i = 0; i < 10 && !failed; i++) {
      const res = advanceReforms(state);
      if (res.failed.length > 0) failed = true;
    }
    expect(failed).toBe(true);
    expect(state.factions.ming.legitimacy).toBeLessThan(legitBefore);
    expect(isLawEnacted(state.activeModifiers, "ming", "land-survey")).toBe(false);
  });
});

describe("S4d: end-to-end reform via simulateMonth", () => {
  it("a recovery focus drives low-tax to enactment with a live tax-cut modifier", () => {
    const state = createMvpScenario("ming", 1);
    const decision = { ...defaultPlayerDecision, domesticFocus: "recovery" as const };
    let s = state;
    let enacted = false;
    for (let i = 0; i < 60; i++) {
      s = simulateMonth({ state: s, playerDecision: decision, randomSeed: s.seed }).nextState;
      if (isLawEnacted(s.activeModifiers, "ming", "low-tax")) {
        enacted = true;
        break;
      }
    }
    expect(enacted).toBe(true);
    const mod = s.activeModifiers.find((m) => m.id === lawModifierId("ming", "low-tax"));
    expect(mod).toBeDefined();
    expect(mod!.effects["tax-mult"]).toBe(-0.15);
    // 落实后 ming 不应崩溃
    expect(s.factions.ming.status).toBe("active");
  });

  it("the law library covers all six SPEC §11 categories", () => {
    const cats = new Set(Object.values(lawLibrary).map((l) => l.category));
    expect(cats.has("tax")).toBe(true);
    expect(cats.has("land")).toBe(true);
    expect(cats.has("military")).toBe(true);
    expect(cats.has("maritime")).toBe(true);
    expect(cats.has("governance")).toBe(true);
    expect(cats.has("fiscal")).toBe(true);
  });
});

describe("S6 遗留#3：玩家手选改革法律", () => {
  it("reformLawId 覆盖 domesticFocus 自动倾向", () => {
    const state = createMvpScenario("ming", 1);
    const decisions = {
      ming: {
        targetRegionId: null,
        posture: "balanced" as const,
        domesticFocus: "military" as const,
        reformLawId: "low-tax",
      },
    };
    // focus=military 倾向 military-funding，但手选 low-tax 应覆盖
    const proposed = autoProposeReforms(state, decisions);
    expect(proposed.some((r) => r.factionId === "ming" && r.lawId === "low-tax")).toBe(true);
  });

  it("手选强推阻力大的改革（不经 momentum 预检）", () => {
    const state = createMvpScenario("ming", 1);
    // land-survey 遭 donglin+gentry 双反对，momentum 常为负自动不提；手选应强推
    const decisions = {
      ming: {
        targetRegionId: null,
        posture: "balanced" as const,
        domesticFocus: "recovery" as const,
        reformLawId: "land-survey",
      },
    };
    const proposed = autoProposeReforms(state, decisions);
    expect(proposed.some((r) => r.lawId === "land-survey")).toBe(true);
  });
});
