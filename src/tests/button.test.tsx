import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../ui/common/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>推进一月</Button>);
    expect(screen.getByText("推进一月")).toBeTruthy();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>点击</Button>);
    fireEvent.click(screen.getByText("点击"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>X</Button>);
    fireEvent.click(screen.getByText("X"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies variant class", () => {
    const { rerender } = render(<Button variant="primary">P</Button>);
    expect(document.querySelector(".ming-btn--primary")).toBeTruthy();
    rerender(<Button variant="danger">D</Button>);
    expect(document.querySelector(".ming-btn--danger")).toBeTruthy();
    rerender(<Button variant="gold">G</Button>);
    expect(document.querySelector(".ming-btn--gold")).toBeTruthy();
  });

  it("applies size class", () => {
    const { rerender } = render(<Button size="sm">S</Button>);
    expect(document.querySelector(".ming-btn--sm")).toBeTruthy();
    rerender(<Button size="lg">L</Button>);
    expect(document.querySelector(".ming-btn--lg")).toBeTruthy();
  });

  it("applies block class when block prop is true", () => {
    render(<Button block>FULL</Button>);
    expect(document.querySelector(".ming-btn--block")).toBeTruthy();
  });

  it("renders icons when provided", () => {
    render(
      <Button
        iconLeft={<span data-testid="left">L</span>}
        iconRight={<span data-testid="right">R</span>}
      >
        X
      </Button>
    );
    expect(screen.getByTestId("left")).toBeTruthy();
    expect(screen.getByTestId("right")).toBeTruthy();
  });

  it("shows loading state", () => {
    render(<Button loading>X</Button>);
    expect(document.querySelector(".ming-btn__spinner")).toBeTruthy();
  });

  it("is disabled when loading", () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>X</Button>);
    fireEvent.click(screen.getByText("X"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
