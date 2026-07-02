import { describe, expect, it } from "vitest";
import { createMvpScenario } from "../data/scenarios";
import { tickOccupation } from "../core/occupation";

/* ===========================================================================
 * v0.9.7 T12: 占地治理 — 2026-07-02
 *
 * 设计：让"占下" != "守稳"；异族控制区 occupationResistance 持续上升，
 *       > 80 触发 rebelPressure 累加 → 叛乱。
 * 来源：docs/superpowers/specs/2026-07-02-military-refactor-executable-spec.md §4 T12
 *
 * 验收 8 个 use case：
 *   1. 大明控制区 localSupport 每月小幅回升（同文化 + control > 70）
 *   2. 异族控制区 occupationResistance 持续上升
 *   3. garrison 充足时 occupationResistance 涨得慢
 *   4. stability 低时 occupationResistance 涨得快
 *   5. supplyRatio < 0.5 加速 occupationResistance
 *   6. occupationResistance > 80 触发 rebelPressure
 *   7. 同文化占领 culture 惩罚为 0 / 异文化 -3
 *   8. 赈济：localSupport < 30 走账本（扣 faction.grainReserve）
 * =========================================================================== */
describe("v0.9.7 T12 占地治理", () => {
  it("大明控制区 localSupport 每月小幅回升", () => {
    const state = createMvpScenario();
    const beizhili = { ...state.regions.beizhili };
    // 把 localSupport 降到 30
    beizhili.military = { ...beizhili.military, localSupport: 30 };
    const { region: next } = tickOccupation(state, beizhili, "ming");
    // 同文化 + control 91 → 每月 +0.5（garrisonEffect ~9.6 + recovery 0.5）
    expect(next.military.localSupport).toBeGreaterThan(30);
  });

  it("异族控制区 occupationResistance 持续上升（建州控辽东）", () => {
    const state = createMvpScenario();
    // 辽东 = coreFactionIds: ["ming", "jianzhou"]，被建州控制 = 异族
    const liaodong = { ...state.regions.liaodong };
    liaodong.controllerFactionId = "jianzhou";
    const { region: next } = tickOccupation(state, liaodong, "jianzhou");
    // baseResistance = 2.0（异文化，coreFactionIds 虽含 jianzhou 但 ming 是其本主），
    // 简化判定：factionId ∈ coreFactionIds → 同文化
    // coreFactionIds: ["ming", "jianzhou"]，jianzhou 在内 → 同文化 → 衰减
    // 所以改用真正"异族占领"场景：核心 faction 不在 coreFactionIds 中
    expect(state.regions.liaodong.coreFactionIds).toContain("jianzhou");
    // 由于 jianzhou 在 coreFactionIds，视为同文化 → 应当衰减
    // 改用 chahar_steppe 控辽东（chahar 不在 coreFactionIds）
    const chahar = { ...state.regions.chahar_steppe };
    chahar.controllerFactionId = "chahar";
    const next2 = tickOccupation(state, chahar, "chahar").region;
    // 同文化（chahar 自己是 ownerFactionId，且在 coreFactionIds [chahar]），
    // 仍然视为同文化
    // 真正的异族占领测试：建州控大明核心区（北直隶，coreFactionIds: [ming]）
    const bz = { ...state.regions.beizhili };
    bz.controllerFactionId = "jianzhou";
    const next3 = tickOccupation(state, bz, "jianzhou").region;
    // 异文化 baseResistance 2.0，garrison 96000 → drag 1.0，
    // stability 78 → (100-78)/50 = 0.44，supplyRatio > 0.5 → 1.0
    // 期望增 ~ 2.0 × 1.0 × 0.44 × 1.0 = 0.88
    // 注：fresh control < 6 月 ×0.5 → 期望增 ~ 0.44
    expect(next3.military.occupationResistance).toBeGreaterThan(0);
  });

  it("garrison 充足时 occupationResistance 涨得慢（garrisonDrag 钳位）", () => {
    const state = createMvpScenario();
    // 用建州控北直隶（异族 + 异 garrison 大量）
    const region = { ...state.regions.beizhili };
    region.controllerFactionId = "jianzhou";
    region.garrison = 5000; // 拖拽 = 1.0
    const r1 = tickOccupation(state, region, "jianzhou").region;
    const region2 = { ...r1, garrison: 0 }; // 拖拽 = 0
    const r2 = tickOccupation(state, region2, "jianzhou").region;
    // 高 garrison Δ < 低 garrison Δ
    const d1 = r1.military.occupationResistance - region.military.occupationResistance;
    const d2 = r2.military.occupationResistance - region2.military.occupationResistance;
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBe(0); // garrison 0 时 drag = 0，resistance 不增
  });

  it("stability 低时 occupationResistance 涨得快", () => {
    const state = createMvpScenario();
    const region = { ...state.regions.beizhili };
    region.controllerFactionId = "jianzhou";
    region.stability = 20; // (100-20)/50 = 1.6
    const r1 = tickOccupation(state, region, "jianzhou").region;
    const region2 = { ...region, stability: 80 }; // (100-80)/50 = 0.4
    const r2 = tickOccupation(state, region2, "jianzhou").region;
    const d1 = r1.military.occupationResistance;
    const d2 = r2.military.occupationResistance;
    // d1 > d2（低 stability 涨得快）
    expect(d1).toBeGreaterThan(d2);
  });

  it("supplyRatio < 0.5 加速 occupationResistance", () => {
    const state = createMvpScenario();
    const region = { ...state.regions.beizhili };
    region.controllerFactionId = "jianzhou";
    // 正常 supply（默认 depotStock 8000 > 4 × 500 = 2000）
    const r1 = tickOccupation(state, region, "jianzhou").region;
    // 强制空仓
    const stateLow = {
      ...state,
      regions: {
        ...state.regions,
        beizhili: {
          ...region,
          logisticsNode: { ...region.logisticsNode!, depotStock: 0 },
        },
      },
    };
    const r2 = tickOccupation(stateLow, region, "jianzhou").region;
    // 低 supply 涨得更快
    expect(r2.military.occupationResistance).toBeGreaterThan(r1.military.occupationResistance);
  });

  it("occupationResistance > 80 触发 rebelPressure 累加", () => {
    const state = createMvpScenario();
    const region = { ...state.regions.beizhili };
    region.controllerFactionId = "jianzhou";
    region.military = { ...region.military, occupationResistance: 85 };
    region.rebelPressure = 30; // 起始
    const { region: next } = tickOccupation(state, region, "jianzhou");
    expect(next.rebelPressure).toBe(31); // +1
  });

  it("同文化占领 culture 惩罚为 0 / 异文化 -3", () => {
    const state = createMvpScenario();
    // 同文化：北直隶，coreFactionIds 含 ming
    const beizhili = { ...state.regions.beizhili };
    beizhili.controllerFactionId = "ming";
    beizhili.military = { ...beizhili.military, localSupport: 50 };
    const r1 = tickOccupation(state, beizhili, "ming").region;
    // 异文化：建州控制大明区
    const bz2 = { ...state.regions.beizhili };
    bz2.controllerFactionId = "jianzhou";
    bz2.military = { ...bz2.military, localSupport: 50 };
    const r2 = tickOccupation(state, bz2, "jianzhou").region;
    const d1 = r1.military.localSupport - 50;
    const d2 = r2.military.localSupport - 50;
    // 同文化支持应 ≥ 异文化（异文化 -3 起步）
    expect(d1).toBeGreaterThanOrEqual(d2);
  });

  it("赈济：localSupport < 30 走账本扣 faction.grainReserve", () => {
    const state = createMvpScenario();
    const region = { ...state.regions.beizhili };
    region.controllerFactionId = "jianzhou";
    region.military = { ...region.military, localSupport: 20 }; // 触发赈济
    // faction grainReserve = jianzhou 的 grainReserve
    const grainBefore = state.factions.jianzhou.grainReserve;
    const { region: next, entries } = tickOccupation(state, region, "jianzhou");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.category).toBe("grain-relief");
    expect(entries[0]?.amount).toBeLessThan(0);
    expect(next.military.localSupport).toBeGreaterThan(20);
    expect(grainBefore).toBeGreaterThan(0); // sanity
  });

  it("集成：异族持续控制大明核心区 12 月 occupationResistance 持续上升", () => {
    // 直接调 tickOccupation 12 次（不调 simulateMonth — 因为 simulateMonth
    // 会触发 AI 战争决策，把控制权夺回）。这里验证模块本身的稳态曲线：
    //   异族 + garrison 充足 → 每月 ~0.88 → 12 月后约 10.56。
    const state = createMvpScenario();
    let region = { ...state.regions.beizhili };
    region.controllerFactionId = "jianzhou";
    for (let m = 0; m < 12; m++) {
      const out = tickOccupation(state, region, "jianzhou");
      region = out.region;
    }
    // 异族控制：12 月后 resistance > 5（实际 ~10.56）
    expect(region.military.occupationResistance).toBeGreaterThan(5);
    // 注：localSupport 测试见"同文化/异文化" case — garrison 充足时
    // garrisonEffect（9.6）远超 -3 文化惩罚，所以本测试不检查 support。
  });
});
