import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DiplomacyPanel } from "../ui/panels/DiplomacyPanel";
import { useGameStore } from "../store/gameStore";
import { isAlly } from "../core/diplomacy";
import { createMvpScenario } from "../data/scenarios";

beforeEach(() => {
  useGameStore.getState().startGame("ming", 1);
});

describe("DiplomacyPanel (S6 遗留#2 外交交互)", () => {
  it("渲染其他势力名", () => {
    render(<DiplomacyPanel state={useGameStore.getState().state} />);
    // 朝鲜（朝贡大明）应出现在外交列表
    expect(screen.getByText("朝鲜")).toBeTruthy();
  });

  it("可结盟势力显示「缔结同盟」，点击后建立同盟", () => {
    render(<DiplomacyPanel state={useGameStore.getState().state} />);
    const btn = screen.getByText("缔结同盟");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    // 全局 store 已更新：朝鲜成为大明盟友
    expect(isAlly(useGameStore.getState().state, "ming", "joseon")).toBe(true);
  });

  it("敌对且有邻接地区的势力显示「宣战」，点击后设为军略目标", () => {
    render(<DiplomacyPanel state={useGameStore.getState().state} />);
    const btns = screen.getAllByText("宣战");
    expect(btns.length).toBeGreaterThan(0);
    fireEvent.click(btns[0]);
    // setDecision 已更新玩家军略目标
    expect(useGameStore.getState().decision.targetRegionId).not.toBeNull();
  });

  it("战争显示进度与「求和」按钮，点击后战争结束", () => {
    // 给全局 store 注入一场大明参与的战争
    const cur = useGameStore.getState().state;
    useGameStore.setState({
      state: {
        ...cur,
        wars: [
          {
            id: "w1",
            attackerFactionId: "jianzhou",
            defenderFactionId: "ming",
            targetRegionId: "liaodong",
            progress: 55,
            monthsActive: 3,
            front: { attackerWarSupport: 60, defenderWarSupport: 50, attackerSupply: 100, defenderSupply: 100 },
          },
        ],
      },
    });
    render(<DiplomacyPanel state={useGameStore.getState().state} />);
    expect(screen.getByText(/守战.*建州女真/)).toBeTruthy();
    fireEvent.click(screen.getByText("求和"));
    expect(useGameStore.getState().state.wars.some((w) => w.id === "w1")).toBe(false);
  });

  it("无战争时不渲染战争区块", () => {
    const state = createMvpScenario("ming", 1);
    render(<DiplomacyPanel state={state} />);
    expect(screen.queryByText("进行中的战争")).toBeNull();
  });
});
