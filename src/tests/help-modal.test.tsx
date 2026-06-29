import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HelpModal } from "../ui/dialogs/HelpModal";

describe("HelpModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<HelpModal open={false} onClose={vi.fn()} />);
    expect(container.querySelector(".help-modal")).toBeFalsy();
  });

  it("renders hotkeys when open", () => {
    render(<HelpModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText("快捷键")).toBeTruthy();
    expect(screen.getByText("切换到势力 Lens")).toBeTruthy();
    expect(screen.getByText("切换到朝堂 Lens")).toBeTruthy();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<HelpModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("关闭帮助"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders kbd elements for each hotkey", () => {
    const { container } = render(<HelpModal open={true} onClose={vi.fn()} />);
    const kbds = container.querySelectorAll("kbd");
    expect(kbds.length).toBeGreaterThan(5);
  });
});
