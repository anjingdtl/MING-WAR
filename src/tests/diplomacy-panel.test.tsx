import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiplomacyPanel } from "../ui/panels/DiplomacyPanel";
import { createMvpScenario } from "../data/scenarios";

describe("DiplomacyPanel (S6 遗留#3 外交信息)", () => {
  it("渲染其他势力名", () => {
    const state = createMvpScenario("ming", 1);
    render(<DiplomacyPanel state={state} />);
    // 朝鲜（朝贡大明）应出现在外交列表
    expect(screen.getByText("朝鲜")).toBeTruthy();
  });

  it("显示玩家进行中的战争（角色 + 对手 + 进度）", () => {
    const state = createMvpScenario("ming", 1);
    state.wars = [
      {
        id: "jianzhou-ming-liaodong",
        attackerFactionId: "jianzhou",
        defenderFactionId: "ming",
        targetRegionId: "liaodong",
        progress: 55,
        monthsActive: 3,
        front: {
          attackerWarSupport: 60,
          defenderWarSupport: 50,
          attackerSupply: 90,
          defenderSupply: 100,
        },
      },
    ];
    render(<DiplomacyPanel state={state} />);
    // 大明为防守方 → "守战 · 建州女真"
    expect(screen.getByText(/守战.*建州女真/)).toBeTruthy();
    expect(screen.getByText(/进度 55%/)).toBeTruthy();
  });

  it("无战争时不渲染战争区块", () => {
    const state = createMvpScenario("ming", 1);
    render(<DiplomacyPanel state={state} />);
    expect(screen.queryByText("进行中的战争")).toBeNull();
  });
});
