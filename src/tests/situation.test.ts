import { describe, expect, it } from "vitest";
import { advanceSituations, ensureSituations } from "../core/situation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { situationLibrary } from "../data/situations";
import { simulateMonth } from "../core/simulation";
import type { SituationDef } from "../core/types";

function makeDef(overrides: Partial<SituationDef> = {}): SituationDef {
  return {
    id: "test-sit",
    name: "测试局势",
    description: "测试用",
    factionId: "ming",
    trigger: () => true,
    advance: (sit) => ({ progress: Math.min(100, sit.progress + 50) }),
    outcomes: [{ id: "done", label: "完成", test: (sit) => sit.progress >= 100 }],
    ...overrides,
  };
}

describe("S6a: 局势引擎", () => {
  it("trigger 满足时激活局势并产出 triggered 事件", () => {
    const s = createMvpScenario("ming", 1);
    const events = advanceSituations(s, [makeDef()]);
    expect(events.some((e) => e.type === "triggered")).toBe(true);
    expect(s.activeSituations?.some((x) => x.id === "test-sit")).toBe(true);
    const sit = s.activeSituations!.find((x) => x.id === "test-sit")!;
    expect(sit.stage).toBe(1);
    expect(sit.active).toBe(true);
  });

  it("trigger 不满足时不激活", () => {
    const s = createMvpScenario("ming", 1);
    advanceSituations(s, [makeDef({ trigger: () => false })]);
    expect(s.activeSituations?.some((x) => x.id === "test-sit")).toBe(false);
  });

  it("advance 推进进度，达到阈值触发结局（active=false）", () => {
    const s = createMvpScenario("ming", 1);
    const def = makeDef({ advance: (sit) => ({ progress: Math.min(100, sit.progress + 60) }) });
    advanceSituations(s, [def]); // 触发 + 推进到 60
    const sit1 = s.activeSituations!.find((x) => x.id === "test-sit")!;
    expect(sit1.progress).toBe(60);
    expect(sit1.active).toBe(true);
    advanceSituations(s, [def]); // 推进到 100 → 结局
    const sit2 = s.activeSituations!.find((x) => x.id === "test-sit")!;
    expect(sit2.progress).toBe(100);
    expect(sit2.active).toBe(false);
    expect(sit2.outcome).toBe("done");
  });

  it("advance 接收系统状态（大明腐败推动局势变量）", () => {
    const s = createMvpScenario("ming", 1);
    s.factions.ming.corruption = 60;
    const def = makeDef({
      trigger: (st) => st.factions.ming.corruption > 50,
      advance: (sit, st) => ({
        variables: { corruption: st.factions.ming.corruption },
        progress: Math.min(100, sit.progress + st.factions.ming.corruption),
      }),
    });
    advanceSituations(s, [def]);
    const sit = s.activeSituations!.find((x) => x.id === "test-sit")!;
    expect(sit.variables.corruption).toBe(60);
  });

  it("已结束局势不再推进", () => {
    const s = createMvpScenario("ming", 1);
    const def = makeDef();
    // 先推到结局
    advanceSituations(s, [def]);
    advanceSituations(s, [def]);
    const sit = s.activeSituations!.find((x) => x.id === "test-sit")!;
    expect(sit.active).toBe(false);
    const progressBefore = sit.progress;
    advanceSituations(s, [def]); // 不应推进
    expect(sit.progress).toBe(progressBefore);
  });

  it("ensureSituations 幂等初始化", () => {
    const s = createMvpScenario("ming", 1);
    expect(s.activeSituations).toBeUndefined();
    const a = ensureSituations(s);
    const b = ensureSituations(s);
    expect(a).toBe(b);
    expect(s.activeSituations).toEqual([]);
  });
});

describe("S6b: 真实主线局势（situationLibrary）", () => {
  it("张居正改革：高腐败触发，推进至巩固后降腐败并写 modifier", () => {
    const s = createMvpScenario("ming", 1);
    const reformDef = situationLibrary.find((d) => d.id === "zhangjuzheng-reform")!;
    expect(reformDef.trigger(s)).toBe(true); // 初始腐败 34 ≥ 30
    for (let i = 0; i < 60; i++) advanceSituations(s, [reformDef]);
    const sit = s.activeSituations!.find((x) => x.id === "zhangjuzheng-reform")!;
    expect(sit.active).toBe(false);
    if (sit.outcome === "consolidated") {
      expect(s.factions.ming.corruption).toBeLessThan(34);
      expect(s.activeModifiers.some((m) => m.id === "zhangjuzheng-reform-consolidated")).toBe(true);
    }
  });

  it("建州统一：军力达标触发，统一后军事组织提升", () => {
    const s = createMvpScenario("ming", 1);
    s.factions.jianzhou.armyTotal = 60000;
    const def = situationLibrary.find((d) => d.id === "jianzhou-unification")!;
    expect(def.trigger(s)).toBe(true);
    const moBefore = s.factions.jianzhou.militaryOrganization;
    for (let i = 0; i < 60; i++) advanceSituations(s, [def]);
    const sit = s.activeSituations!.find((x) => x.id === "jianzhou-unification")!;
    if (sit.outcome === "unified") {
      expect(s.factions.jianzhou.militaryOrganization).toBeGreaterThan(moBefore);
    }
  });

  it("局势在 simulation 月度推进中触发（集成）", () => {
    let current = createMvpScenario("ming", 7);
    let triggered = false;
    for (let i = 0; i < 3; i++) {
      const res = simulateMonth({
        state: current,
        playerDecision: defaultPlayerDecision,
        randomSeed: current.seed,
      });
      if (res.reports.some((r) => r.title.includes("张居正改革"))) triggered = true;
      current = res.nextState;
    }
    expect(triggered).toBe(true);
  });
});
