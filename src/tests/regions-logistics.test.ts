import { describe, expect, it } from "vitest";
import { createMvpScenario } from "../data/scenarios";
import { regionTemplates } from "../data/regions";

/* ===========================================================================
 * v0.9.7 T11: 运输节点数据录入 — 2026-07-02
 *
 * 设计：让"距离衰减"和"补给到"成为真实约束。
 * 设计文件：docs/superpowers/specs/2026-07-02-military-refactor-executable-spec.md §4 T11
 *
 * 验收 5 个 use case：
 *   1. 中原核心 6 region 的 infrastructureLevel ≥ 2
 *   2. 沿海 4 个 region 的 portLevel ≥ 2
 *   3. 河流/运河 4 个 region 的 riverPortLevel ≥ 2
 *   4. 31 个 region 的 depotStock 全部非零且符合地区类型启发式
 *   5. 大同/北京/济南/扬州的运输节点数据完整（"四枢纽"）
 *
 * DETERMINISM-CHANGE（与 v0.9.7-T10 末态对照）：
 *   - 31 region 的 military.infrastructureLevel / portLevel / riverPortLevel 写入 state
 *   - 31 region 的 logisticsNode.depotStock 启发式分化（核心 8000 / 其它 6000 / 边地 5000）
 * =========================================================================== */
describe("v0.9.7 T11 运输节点数据录入", () => {
  it("中原核心 6 region 的 infrastructureLevel ≥ 2（驰道/官道）", () => {
    const state = createMvpScenario();
    const CORE_REGIONS = ["beizhili", "nanzhili", "shandong", "shanxi", "henan", "shaanxi"];
    for (const rid of CORE_REGIONS) {
      const lvl = state.regions[rid]?.military.infrastructureLevel ?? -1;
      expect(lvl, `${rid} infrastructureLevel`).toBeGreaterThanOrEqual(2);
    }
  });

  it("重要海港 5+ region 的 portLevel ≥ 2（泉州/广州/宁波/天津/登州）", () => {
    const state = createMvpScenario();
    const MAJOR_PORTS = [
      { id: "beizhili", min: 2, name: "天津" },
      { id: "shandong", min: 2, name: "登州" },
      { id: "nanzhili", min: 2, name: "上海/松江" },
      { id: "zhejiang", min: 3, name: "宁波" },
      { id: "fujian", min: 3, name: "泉州" },
      { id: "guangdong", min: 3, name: "广州" },
    ];
    for (const p of MAJOR_PORTS) {
      const lvl = state.regions[p.id]?.logisticsNode?.portLevel ?? -1;
      expect(lvl, `${p.id} (${p.name}) portLevel`).toBeGreaterThanOrEqual(p.min);
    }
  });

  it("运河/长江 5+ region 的 riverPortLevel ≥ 1", () => {
    const state = createMvpScenario();
    const RIVER_PORTS = [
      { id: "beizhili", min: 3, name: "京杭运河北端" },
      { id: "nanzhili", min: 3, name: "京杭运河南端" },
      { id: "shandong", min: 2, name: "运河中段" },
      { id: "jiangxi", min: 2, name: "赣江" },
      { id: "huguang", min: 2, name: "长江中游" },
      { id: "sichuan", min: 2, name: "长江上游" },
    ];
    for (const p of RIVER_PORTS) {
      const lvl = state.regions[p.id]?.logisticsNode?.riverPortLevel ?? -1;
      expect(lvl, `${p.id} (${p.name}) riverPortLevel`).toBeGreaterThanOrEqual(p.min);
    }
  });

  it("31 region 的 depotStock 全部非零且符合地区类型启发式", () => {
    const state = createMvpScenario();
    const CORE = new Set(["beizhili", "nanzhili", "shandong", "shanxi", "henan", "shaanxi"]);
    const PERIPHERY = new Set([
      "liaodong", "gansu", "ningxia", "haixi", "jianzhou", "chahar_steppe",
      "tumed_steppe", "korchin_steppe", "hulunbuir", "amur_basin",
      "nurgan_coast", "sakhalin", "ezo"
    ]);
    let coreCount = 0, peripheryCount = 0, otherCount = 0;
    for (const region of Object.values(state.regions)) {
      const depot = region.logisticsNode?.depotStock;
      expect(depot, `${region.id} depotStock 应当为 > 0`).toBeGreaterThan(0);
      if (CORE.has(region.id)) {
        expect(depot, `${region.id} 中原核心应 = 8000`).toBe(8000);
        coreCount++;
      } else if (PERIPHERY.has(region.id)) {
        expect(depot, `${region.id} 边地应 = 5000`).toBe(5000);
        peripheryCount++;
      } else {
        expect(depot, `${region.id} 其它应 = 6000`).toBe(6000);
        otherCount++;
      }
    }
    // 数据完整性 sanity
    expect(coreCount).toBe(6);
    expect(peripheryCount).toBeGreaterThanOrEqual(10);
    expect(coreCount + peripheryCount + otherCount).toBe(31);
  });

  it("北京/南京/济南/扬州枢纽数据完整（infrastructure / port / river 至少 2 项 ≥ 2）", () => {
    const state = createMvpScenario();
    // 北直隶（北平/北京）— 京畿+运河+天津
    const bz = state.regions.beizhili!;
    expect(bz.military.infrastructureLevel).toBe(3);
    expect(bz.logisticsNode?.portLevel).toBeGreaterThanOrEqual(2);
    expect(bz.logisticsNode?.riverPortLevel).toBeGreaterThanOrEqual(3);
    // 南直隶（南京/扬州）— 江南+运河+长江
    const nz = state.regions.nanzhili!;
    expect(nz.military.infrastructureLevel).toBe(3);
    expect(nz.logisticsNode?.riverPortLevel).toBeGreaterThanOrEqual(3);
    // 山东（济南）— 齐鲁+运河
    const sd = state.regions.shandong!;
    expect(sd.military.infrastructureLevel).toBeGreaterThanOrEqual(2);
    expect(sd.logisticsNode?.riverPortLevel).toBeGreaterThanOrEqual(2);
  });

  it("31 个 regionTemplate 与 31 个 state region 数量一致（占位 region 不算）", () => {
    // 全部可玩 region 数量 sanity（防止添加/删除 region 时忘了更新启发式）
    const playableCount = Object.values(regionTemplates).filter(
      (r) => r.logisticsNode !== null
    ).length;
    expect(playableCount).toBe(31);
  });
});
