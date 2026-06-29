import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TutorialDialog } from "../ui/dialogs/TutorialDialog";

describe("TutorialDialog", () => {
  it("renders the first step by default", () => {
    render(<TutorialDialog onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText("圣旨:万历朝推演")).toBeTruthy();
    expect(screen.getByText("第 1 折")).toBeTruthy();
  });

  it("advances to next step on 下一页", () => {
    render(<TutorialDialog onComplete={vi.fn()} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByText("下一页"));
    expect(screen.getByText("帝国概览:TopBar")).toBeTruthy();
  });

  it("goes back to previous step on 上一页", () => {
    render(<TutorialDialog onComplete={vi.fn()} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByText("下一页"));
    expect(screen.getByText("帝国概览:TopBar")).toBeTruthy();
    fireEvent.click(screen.getByText("上一页"));
    expect(screen.getByText("圣旨:万历朝推演")).toBeTruthy();
  });

  it("hides 上一页 on first step", () => {
    render(<TutorialDialog onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.queryByText("上一页")).toBeFalsy();
  });

  it("changes 下一页 to 开始推演 on last step", () => {
    render(<TutorialDialog onComplete={vi.fn()} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByText("下一页")); // 1 -> 2
    fireEvent.click(screen.getByText("下一页")); // 2 -> 3
    fireEvent.click(screen.getByText("下一页")); // 3 -> 4
    fireEvent.click(screen.getByText("下一页")); // 4 -> 5
    expect(screen.getByText("开始推演")).toBeTruthy();
  });

  it("calls onComplete on final step's 开始推演", () => {
    const onComplete = vi.fn();
    render(<TutorialDialog onComplete={onComplete} onSkip={vi.fn()} />);
    // skip to end
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByText("下一页"));
    }
    fireEvent.click(screen.getByText("开始推演"));
    expect(onComplete).toHaveBeenCalled();
  });

  it("calls onSkip when 跳过引导 is clicked", () => {
    const onSkip = vi.fn();
    render(<TutorialDialog onComplete={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByText("跳过引导"));
    expect(onSkip).toHaveBeenCalled();
  });

  it("renders 5 progress dots", () => {
    const { container } = render(<TutorialDialog onComplete={vi.fn()} onSkip={vi.fn()} />);
    const dots = container.querySelectorAll(".tutorial-dialog__dot");
    expect(dots).toHaveLength(5);
  });

  it("marks current step dot as active", () => {
    const { container } = render(<TutorialDialog onComplete={vi.fn()} onSkip={vi.fn()} />);
    const activeDots = container.querySelectorAll(".tutorial-dialog__dot.is-active");
    expect(activeDots).toHaveLength(1);
  });

  it("starts at initialStep if provided", () => {
    render(<TutorialDialog initialStep={2} onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText("战略地图")).toBeTruthy();
  });
});
