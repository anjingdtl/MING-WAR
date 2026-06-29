import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip } from "../ui/common/Tooltip";

describe("Tooltip", () => {
  it("does not show content initially", () => {
    render(
      <Tooltip content="我是提示">
        <button>触发</button>
      </Tooltip>
    );
    expect(screen.queryByRole("tooltip")).toBeFalsy();
  });

  it("shows content on mouseEnter after delay", async () => {
    render(
      <Tooltip content="我是提示" delay={50}>
        <button>触发</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText("触发"));
    // After delay
    await new Promise((r) => setTimeout(r, 80));
    expect(screen.queryByRole("tooltip")).toBeTruthy();
  });

  it("hides on mouseLeave", async () => {
    render(
      <Tooltip content="X" delay={30}>
        <button>T</button>
      </Tooltip>
    );
    const btn = screen.getByText("T");
    fireEvent.mouseEnter(btn);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("tooltip")).toBeTruthy();
    fireEvent.mouseLeave(btn);
    expect(screen.queryByRole("tooltip")).toBeFalsy();
  });

  it("renders title when provided", async () => {
    render(
      <Tooltip title="标题" content="内容" delay={20}>
        <button>T</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText("T"));
    await new Promise((r) => setTimeout(r, 40));
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain("标题");
    expect(tip.textContent).toContain("内容");
  });

  it("respects variant class", async () => {
    render(
      <Tooltip variant="predict" content="预测" delay={20}>
        <button>T</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText("T"));
    await new Promise((r) => setTimeout(r, 80));
    const tooltip = document.querySelector(".ming-tooltip--predict");
    expect(tooltip).toBeTruthy();
  });

  it("does not show when disabled", async () => {
    render(
      <Tooltip content="X" disabled delay={10}>
        <button>T</button>
      </Tooltip>
    );
    fireEvent.mouseEnter(screen.getByText("T"));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("tooltip")).toBeFalsy();
  });

  it("preserves child onClick handler", () => {
    let clicked = false;
    render(
      <Tooltip content="X" delay={0}>
        <button onClick={() => (clicked = true)}>T</button>
      </Tooltip>
    );
    fireEvent.click(screen.getByText("T"));
    expect(clicked).toBe(true);
  });
});
