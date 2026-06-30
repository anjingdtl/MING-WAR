import { describe, expect, it } from "vitest";
import {
  addTreaty,
  advanceDiplomacy,
  areNeighbors,
  computeThreat,
  ensureRelation,
  getRelation,
  hasTruce,
  isAlly,
  relationKey,
  removeTreaty,
} from "../core/diplomacy";
import { applyLedgerToState } from "../core/ledger";
import { getValidMilitaryTargets } from "../core/decisions";
import { createMvpScenario } from "../data/scenarios";
import type { GameState } from "../core/types";

function makeState(): GameState {
  return createMvpScenario("ming", 1);
}

describe("relationKey", () => {
  it("规范化双向：A↔B 同一 key，字典序小者在前", () => {
    expect(relationKey("a", "b")).toBe(relationKey("b", "a"));
    expect(relationKey("joseon", "ming")).toBe("joseon|ming");
  });
});

describe("ensureRelation / getRelation", () => {
  it("创建中性默认关系并幂等", () => {
    const s = makeState();
    const rel = ensureRelation(s, "chahar", "haixi");
    expect(rel.relation).toBe(0);
    expect(rel.trust).toBe(40);
    expect(rel.treaties).toEqual([]);
    expect(rel.truceMonths).toBe(0);
    expect(getRelation(s, "chahar", "haixi")).toBe(rel);
    // 幂等：反向再 ensure 返回同一对象
    expect(ensureRelation(s, "haixi", "chahar")).toBe(rel);
  });

  it("同一势力抛错", () => {
    const s = makeState();
    expect(() => ensureRelation(s, "ming", "ming")).toThrow();
  });
});

describe("条约与状态查询", () => {
  it("hasTruce / isAlly / addTreaty / removeTreaty", () => {
    const s = makeState();
    // 土默特-大明初始 60 月停战（俺答封贡）
    expect(hasTruce(s, "tumed", "ming")).toBe(true);
    expect(isAlly(s, "joseon", "ming")).toBe(false);

    addTreaty(s, "joseon", "ming", "alliance");
    expect(isAlly(s, "joseon", "ming")).toBe(true);
    expect(isAlly(s, "ming", "joseon")).toBe(true); // 双向

    removeTreaty(s, "joseon", "ming", "alliance");
    expect(isAlly(s, "joseon", "ming")).toBe(false);
  });
});

describe("computeThreat", () => {
  it("威胁度有界，邻接不劣于非邻", () => {
    const s = makeState();
    const tNeighbor = computeThreat(s, "ming", "jianzhou");
    const tDistant = computeThreat(s, "ming", "japan");
    expect(tNeighbor).toBeGreaterThanOrEqual(0);
    expect(tNeighbor).toBeLessThanOrEqual(100);
    // 非邻国威胁恒为 5（跨境干预成本高）
    expect(tDistant).toBeLessThanOrEqual(5);
    expect(tNeighbor).toBeGreaterThanOrEqual(tDistant);
  });

  it("威胁随对方军力上升", () => {
    const s = makeState();
    const before = computeThreat(s, "ming", "jianzhou");
    // 建州军力翻倍后，大明感知的威胁应不降
    s.factions.jianzhou.armyTotal *= 3;
    const after = computeThreat(s, "ming", "jianzhou");
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe("advanceDiplomacy", () => {
  it("停战倒计时到期移除 truce 条约", () => {
    const s = makeState();
    expect(hasTruce(s, "tumed", "ming")).toBe(true);
    for (let i = 0; i < 61; i++) advanceDiplomacy(s);
    expect(hasTruce(s, "tumed", "ming")).toBe(false);
  });

  it("互市为双方产生正关税（走账本）", () => {
    const s = makeState();
    const mingBefore = s.factions.ming.treasury;
    const entries = advanceDiplomacy(s);
    applyLedgerToState(s, entries);
    const tariffs = entries.filter((e) => e.category === "income-tariff");
    expect(tariffs.length).toBeGreaterThan(0);
    expect(tariffs.every((e) => e.amount > 0)).toBe(true);
    // 大明至少从一个互市伙伴收到关税
    const mingTariff = tariffs
      .filter((e) => e.factionId === "ming")
      .reduce((a, e) => a + e.amount, 0);
    expect(mingTariff).toBeGreaterThan(0);
    expect(s.factions.ming.treasury).toBe(mingBefore + mingTariff + 8000 /* 朝鲜朝贡 */);
  });

  it("朝贡白银守恒（支出 === 收入）", () => {
    const s = makeState();
    const entries = advanceDiplomacy(s);
    const out = entries
      .filter((e) => e.category === "expense-tribute")
      .reduce((a, e) => a + e.amount, 0);
    const inc = entries
      .filter((e) => e.category === "income-tribute")
      .reduce((a, e) => a + e.amount, 0);
    expect(out).toBe(-8000);
    expect(inc).toBe(8000);
    expect(out + inc).toBe(0);
  });

  it("朝贡后朝贡国白银减少、宗主增加", () => {
    const s = makeState();
    const joseonBefore = s.factions.joseon.treasury;
    const mingBefore = s.factions.ming.treasury;
    const entries = advanceDiplomacy(s);
    applyLedgerToState(s, entries);
    // 朝鲜朝贡（8000）超过其互市关税（1500），净减少
    expect(s.factions.joseon.treasury).toBeLessThan(joseonBefore);
    // 大明同时收朝贡与互市关税，净增加
    expect(s.factions.ming.treasury).toBeGreaterThan(mingBefore);
  });

  it("确定性：相同输入产生相同演变", () => {
    const s1 = makeState();
    const s2 = makeState();
    for (let i = 0; i < 12; i++) {
      advanceDiplomacy(s1);
      advanceDiplomacy(s2);
    }
    expect(getRelation(s1, "jianzhou", "ming")?.relation).toBe(
      getRelation(s2, "jianzhou", "ming")?.relation,
    );
    expect(getRelation(s1, "japan", "joseon")?.threat).toBe(
      getRelation(s2, "japan", "joseon")?.threat,
    );
  });
});

describe("S5d: 外交约束开战（getValidMilitaryTargets）", () => {
  // 找一个大明控制且有邻接的地区，把其邻居设为指定势力，验证外交过滤。
  function mingBorderNeighbor(state: GameState): { neighborId: string } {
    const mingRegion = Object.values(state.regions).find(
      (r) => r.controllerFactionId === "ming" && r.connections.length > 0,
    )!;
    return { neighborId: mingRegion.connections[0] };
  }

  it("停战期的邻接势力地区被过滤", () => {
    const s = makeState();
    const { neighborId } = mingBorderNeighbor(s);
    s.regions[neighborId].controllerFactionId = "rebels";
    ensureRelation(s, "ming", "rebels").truceMonths = 30;
    addTreaty(s, "ming", "rebels", "truce");
    expect(getValidMilitaryTargets(s, "ming")).not.toContain(neighborId);
  });

  it("盟友的邻接势力地区被过滤", () => {
    const s = makeState();
    const { neighborId } = mingBorderNeighbor(s);
    s.regions[neighborId].controllerFactionId = "joseon";
    addTreaty(s, "ming", "joseon", "alliance");
    expect(getValidMilitaryTargets(s, "ming")).not.toContain(neighborId);
  });

  it("无条约的邻接势力地区仍是有效目标", () => {
    const s = makeState();
    const { neighborId } = mingBorderNeighbor(s);
    s.regions[neighborId].controllerFactionId = "rebels";
    // 无停战、非盟友 → 可攻击
    expect(getValidMilitaryTargets(s, "ming")).toContain(neighborId);
  });
});
