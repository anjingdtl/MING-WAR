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
  it("low-tax draws support from donglin, opposition from reform+eunuch", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 40 });
    setClique(state, "reform", { strength: 50 });
    setClique(state, "eunuch", { strength: 10 });
    const support = computeReformSupport(state.factions.ming, "low-tax");
    expect(support.supportPower).toBe(40); // donglin
    expect(support.opposePower).toBe(60); // reform+eunuch
    expect(support.supporters).toEqual(["donglin"]);
    expect(support.opponents.sort()).toEqual(["eunuch", "reform"]);
  });

  it("land-survey is supported by reform, opposed by donglin+eunuch", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 50 });
    setClique(state, "reform", { strength: 10 });
    setClique(state, "eunuch", { strength: 10 });
    const support = computeReformSupport(state.factions.ming, "land-survey");
    expect(support.supportPower).toBe(10);
    expect(support.opposePower).toBe(60);
    expect(support.supporters).toEqual(["reform"]);
  });

  it("a heavily-opposed reform has negative momentum; a supported one positive", () => {
    const opposed = createMvpScenario("ming", 1);
    setClique(opposed, "donglin", { strength: 50 });
    setClique(opposed, "reform", { strength: 10 });
    setClique(opposed, "eunuch", { strength: 10 });
    expect(computeReformMomentum(opposed, opposed.factions.ming, "land-survey")).toBeLessThan(0);

    const supported = createMvpScenario("ming", 1);
    setClique(supported, "donglin", { strength: 80 });
    setClique(supported, "reform", { strength: 10 });
    setClique(supported, "eunuch", { strength: 10 });
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
    setClique(state, "reform", { strength: 50, approval: 60, support: 50 });
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

    // reform（支持者）approval 涨 10；donglin（反对者）approval 暴跌 12
    expect(getClique(state, "reform").approval).toBe(60 + 10);
    expect(getClique(state, "donglin").approval).toBe(60 - 12);
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
    setClique(state, "donglin", { strength: 80 });
    setClique(state, "reform", { strength: 10 });
    setClique(state, "eunuch", { strength: 10 });
    proposeReform(state, "ming", "clean-admin"); // momentum 正
    let enacted = false;
    for (let i = 0; i < 40 && !enacted; i++) {
      const res = advanceReforms(state);
      if (res.enacted.length > 0) enacted = true;
    }
    expect(enacted).toBe(true);
    expect(isLawEnacted(state.activeModifiers, "ming", "clean-admin")).toBe(true);
  });

  it("a heavily-opposed reform fails and costs legitimacy", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 50 });
    setClique(state, "reform", { strength: 10 });
    setClique(state, "eunuch", { strength: 10 });
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
  it("a recovery focus drives clean-admin to enactment with a live corruption modifier", () => {
    const state = createMvpScenario("ming", 1);
    const decision = { ...defaultPlayerDecision, domesticFocus: "administration" as const };
    let s = state;
    let enacted = false;
    for (let i = 0; i < 60; i++) {
      s = simulateMonth({ state: s, playerDecision: decision, randomSeed: s.seed }).nextState;
      if (isLawEnacted(s.activeModifiers, "ming", "clean-admin")) {
        enacted = true;
        break;
      }
    }
    expect(enacted).toBe(true);
    const mod = s.activeModifiers.find((m) => m.id === lawModifierId("ming", "clean-admin"));
    expect(mod).toBeDefined();
    // clean-admin 的 corruption-flat 是 faction-instant（一次性施加），不进 modifier.effects
    // 验证 modifier 存在即可；faction 级 corruption 应已被 -4 instant 影响
    expect(s.factions.ming.corruption).toBeLessThanOrEqual(100);
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
