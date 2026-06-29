import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidePanel } from "../ui/layout/SidePanel";
import { createMvpScenario } from "../data/scenarios";
import { defaultPlayerDecision } from "../data/scenarios";
import type { PlayerDecision } from "../core/types";

const mockDecision: PlayerDecision = { ...defaultPlayerDecision };

describe("SidePanel", () => {
  const baseProps = () => ({
    state: createMvpScenario(),
    decision: mockDecision,
    onDecisionChange: vi.fn(),
    selectedRegionId: "beizhili" as const,
    onSelectRegion: vi.fn(),
    open: true,
    onClose: vi.fn(),
    initialTab: "region" as const
  });

  it("renders nothing when closed", () => {
    const { container } = render(<SidePanel {...baseProps()} open={false} />);
    expect(container.querySelector(".side-panel-container")).toBeFalsy();
  });

  it("renders 5 tab buttons", () => {
    render(<SidePanel {...baseProps()} />);
    expect(screen.getByRole("tab", { name: /区域/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /决策/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /朝堂/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /邸报/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /大事记/ })).toBeTruthy();
  });

  it("starts on region tab by default", () => {
    render(<SidePanel {...baseProps()} />);
    const tab = screen.getByRole("tab", { name: /区域/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("switches to 决策 tab on click", () => {
    render(<SidePanel {...baseProps()} />);
    fireEvent.click(screen.getByRole("tab", { name: /决策/ }));
    const tab = screen.getByRole("tab", { name: /决策/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("switches to 朝堂 tab and shows cliques", () => {
    render(<SidePanel {...baseProps()} />);
    fireEvent.click(screen.getByRole("tab", { name: /朝堂/ }));
    expect(screen.getByRole("heading", { name: "朝堂派系" })).toBeTruthy();
  });

  it("switches to 邸报 tab", () => {
    render(<SidePanel {...baseProps()} />);
    fireEvent.click(screen.getByRole("tab", { name: /邸报/ }));
    expect(screen.getByRole("heading", { name: "邸报" })).toBeTruthy();
  });

  it("switches to 大事记 tab", () => {
    render(<SidePanel {...baseProps()} />);
    fireEvent.click(screen.getByRole("tab", { name: /大事记/ }));
    expect(screen.getByRole("heading", { name: "大事记" })).toBeTruthy();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<SidePanel {...baseProps()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("关闭详情面板"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onTabChange when tab clicked", () => {
    const onTabChange = vi.fn();
    render(<SidePanel {...baseProps()} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /决策/ }));
    expect(onTabChange).toHaveBeenCalledWith("decision");
  });

  it("opens to specified initialTab", () => {
    render(<SidePanel {...baseProps()} initialTab="court" />);
    const tab = screen.getByRole("tab", { name: /朝堂/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });
});
