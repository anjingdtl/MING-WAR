import { describe, expect, it } from "vitest";
import { checkPeace, computeWarSupport, requestPeace, resolvePeace } from "../core/peace";
import { applyLedgerToState } from "../core/ledger";
import { getRelation, hasTruce } from "../core/diplomacy";
import { createMvpScenario } from "../data/scenarios";
import type { GameState, WarState } from "../core/types";

function makeWar(overrides: Partial<WarState> = {}): WarState {
  return {
    id: "test-war",
    attackerFactionId: "jianzhou",
    defenderFactionId: "ming",
    targetRegionId: "liaodong",
    progress: 50,
    monthsActive: 1,
    front: {
      attackerWarSupport: 60,
      defenderWarSupport: 60,
      attackerSupply: 100,
      defenderSupply: 100,
    },
    ...overrides,
  };
}

function makeState(): GameState {
  return createMvpScenario("ming", 1);
}

describe("computeWarSupport", () => {
  it("战疲越高，支持度越低", () => {
    const s = makeState();
    const war = makeWar({ attackerFactionId: "ming" });
    const fresh = computeWarSupport(s, war, "ming");
    s.factions.ming.warExhaustion = 80;
    const exhausted = computeWarSupport(s, war, "ming");
    expect(exhausted).toBeLessThan(fresh);
  });

  it("战场领先方支持度高于落后方", () => {
    const s = makeState();
    const winning = makeWar({ attackerFactionId: "ming", progress: 90 });
    const losing = makeWar({ attackerFactionId: "ming", progress: 10 });
    expect(computeWarSupport(s, winning, "ming")).toBeGreaterThan(
      computeWarSupport(s, losing, "ming"),
    );
  });

  it("支持度有界 [0, 100]", () => {
    const s = makeState();
    const war = makeWar({ attackerFactionId: "ming", progress: 100 });
    s.factions.ming.warExhaustion = 0;
    s.factions.ming.legitimacy = 100;
    expect(computeWarSupport(s, war, "ming")).toBeLessThanOrEqual(100);
    s.factions.ming.warExhaustion = 100;
    s.factions.ming.treasury = -100000;
    s.factions.ming.armyTotal = 0;
    expect(computeWarSupport(s, war, "ming")).toBeGreaterThanOrEqual(0);
  });
});

describe("checkPeace", () => {
  it("progress≥95 → 进攻方完胜", () => {
    const s = makeState();
    const war = makeWar({ progress: 96 });
    const peace = checkPeace(s, war);
    expect(peace?.winnerId).toBe("jianzhou");
    expect(peace?.reason).toBe("total-victory");
  });

  it("防守方支持度崩塌 → 进攻方胜（war-support）", () => {
    const s = makeState();
    const war = makeWar({
      progress: 50,
      front: { attackerWarSupport: 70, defenderWarSupport: 10, attackerSupply: 100, defenderSupply: 100 },
    });
    const peace = checkPeace(s, war);
    expect(peace?.winnerId).toBe("jianzhou");
    expect(peace?.reason).toBe("war-support");
  });

  it("进攻方支持度崩塌 → 防守方胜", () => {
    const s = makeState();
    const war = makeWar({
      progress: 50,
      front: { attackerWarSupport: 10, defenderWarSupport: 70, attackerSupply: 100, defenderSupply: 100 },
    });
    const peace = checkPeace(s, war);
    expect(peace?.winnerId).toBe("ming");
  });

  it("无触发条件 → null（战争继续）", () => {
    const s = makeState();
    const war = makeWar({
      progress: 50,
      monthsActive: 5,
      front: { attackerWarSupport: 60, defenderWarSupport: 60, attackerSupply: 100, defenderSupply: 100 },
    });
    expect(checkPeace(s, war)).toBeNull();
  });

  it("长期双方疲惫 → 媾和（exhaustion，不割地）", () => {
    const s = makeState();
    const war = makeWar({
      progress: 50,
      monthsActive: 50,
      front: { attackerWarSupport: 40, defenderWarSupport: 38, attackerSupply: 100, defenderSupply: 100 },
    });
    const peace = checkPeace(s, war);
    expect(peace?.reason).toBe("exhaustion");
    expect(peace?.cedeRegions).toEqual([]);
  });
});

describe("resolvePeace", () => {
  it("割地易主 + 停战 + 战后关系恶化", () => {
    const s = makeState();
    const war = makeWar({ progress: 96 }); // jianzhou 完胜 ming
    const peace = checkPeace(s, war)!;
    expect(peace).toBeDefined();
    const relBefore = getRelation(s, "jianzhou", "ming")?.relation ?? 0;
    resolvePeace(s, peace);
    // 割让地区全部易主给胜方
    for (const rid of peace.cedeRegions) {
      expect(s.regions[rid].controllerFactionId).toBe("jianzhou");
    }
    // 停战生效
    expect(hasTruce(s, "jianzhou", "ming")).toBe(true);
    // 关系恶化
    const relAfter = getRelation(s, "jianzhou", "ming")?.relation ?? 0;
    expect(relAfter).toBeLessThanOrEqual(relBefore);
  });

  it("赔款守恒（败方支出 === 胜方收入）", () => {
    const s = makeState();
    s.factions.ming.treasury = 200000;
    const war = makeWar({ progress: 96 });
    const peace = checkPeace(s, war)!;
    const entries = resolvePeace(s, peace);
    applyLedgerToState(s, entries);
    const out = entries.filter((e) => e.category === "expense-tribute").reduce((a, e) => a + e.amount, 0);
    const inc = entries.filter((e) => e.category === "income-tribute").reduce((a, e) => a + e.amount, 0);
    if (peace.indemnity > 0) {
      expect(out + inc).toBe(0);
    }
    // 胜方战疲缓和
    expect(s.factions.jianzhou.warExhaustion).toBeGreaterThanOrEqual(0);
  });
});

describe("S6 遗留#2：玩家主动求和（requestPeace）", () => {
  it("参与方可求和 → 战争结束 + 停战（白和，不割地）", () => {
    const s = makeState();
    s.wars = [
      {
        id: "w1",
        attackerFactionId: "jianzhou",
        defenderFactionId: "ming",
        targetRegionId: "liaodong",
        progress: 50,
        monthsActive: 5,
        front: { attackerWarSupport: 60, defenderWarSupport: 50, attackerSupply: 100, defenderSupply: 100 },
      },
    ];
    const mingRegionsBefore = Object.values(s.regions).filter((r) => r.controllerFactionId === "ming").length;
    const peace = requestPeace(s, "ming", "w1");
    expect(peace).not.toBeNull();
    expect(s.wars.some((w) => w.id === "w1")).toBe(false); // 战争移除
    expect(hasTruce(s, "ming", "jianzhou")).toBe(true); // 停战
    // 白和不割地
    const mingRegionsAfter = Object.values(s.regions).filter((r) => r.controllerFactionId === "ming").length;
    expect(mingRegionsAfter).toBe(mingRegionsBefore);
  });

  it("非参与方不能求和", () => {
    const s = makeState();
    s.wars = [
      {
        id: "w1",
        attackerFactionId: "jianzhou",
        defenderFactionId: "ming",
        targetRegionId: "liaodong",
        progress: 50,
        monthsActive: 5,
      },
    ];
    expect(requestPeace(s, "tumed", "w1")).toBeNull();
  });
});
