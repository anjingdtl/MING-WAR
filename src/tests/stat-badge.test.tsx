import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatBadge } from "../ui/common/StatBadge";

describe("StatBadge v2", () => {
  it("renders label and value", () => {
    render(<StatBadge label="国库" value={123000} />);
    expect(screen.getByText("国库")).toBeTruthy();
    expect(screen.getByText("123000")).toBeTruthy();
  });

  it("formats with wan when format='wan'", () => {
    render(<StatBadge label="人口" value={2800000} format="wan" />);
    expect(screen.getByText("280.0万")).toBeTruthy();
  });

  it("formats with auto for large numbers", () => {
    const { rerender } = render(<StatBadge label="X" value={8500} format="auto" />);
    expect(screen.getByText("8.5千")).toBeTruthy();
    rerender(<StatBadge label="X" value={150000} format="auto" />);
    expect(screen.getByText("15.0万")).toBeTruthy();
    rerender(<StatBadge label="X" value={500} format="auto" />);
    expect(screen.getByText("500")).toBeTruthy();
  });

  it("uses custom string format suffix", () => {
    render(<StatBadge label="税" value={1200} format="两" />);
    expect(screen.getByText("1200两")).toBeTruthy();
  });

  it("shows trend up arrow for positive trend", () => {
    render(<StatBadge label="国库" value={1000} trend={15} />);
    const strong = screen.getByText(/1000/);
    expect(strong.textContent).toContain("↑");
    expect(strong.textContent).toContain("15");
  });

  it("shows trend down arrow for negative trend", () => {
    render(<StatBadge label="粮" value={500} trend={-30} />);
    const strong = screen.getByText(/500/);
    expect(strong.textContent).toContain("↓");
    expect(strong.textContent).toContain("30");
  });

  it("does not show trend for zero or undefined", () => {
    const { rerender } = render(<StatBadge label="X" value={100} trend={0} />);
    expect(screen.getByText(/100/).textContent).not.toContain("↑");
    rerender(<StatBadge label="X" value={100} />);
    expect(screen.getByText(/100/).textContent).not.toContain("↑");
  });

  it("auto-applies danger tone when value crosses threshold", () => {
    render(<StatBadge label="粮" value={500} thresholds={{ danger: 1000 }} />);
    const badge = document.querySelector(".stat-badge--danger");
    expect(badge).toBeTruthy();
  });

  it("auto-applies warning tone when value crosses warning threshold", () => {
    render(<StatBadge label="粮" value={3000} thresholds={{ warning: 5000, danger: 1000 }} />);
    const badge = document.querySelector(".stat-badge--warning");
    expect(badge).toBeTruthy();
  });

  it("explicit tone overrides thresholds", () => {
    render(
      <StatBadge
        label="粮"
        value={500}
        tone="positive"
        thresholds={{ danger: 1000 }}
      />
    );
    const badge = document.querySelector(".stat-badge--positive");
    expect(badge).toBeTruthy();
  });

  it("respects size variants", () => {
    const { rerender } = render(<StatBadge label="X" value={1} size="sm" />);
    expect(document.querySelector(".stat-badge--sm")).toBeTruthy();
    rerender(<StatBadge label="X" value={1} size="lg" />);
    expect(document.querySelector(".stat-badge--lg")).toBeTruthy();
  });

  it("uses renderValue when provided", () => {
    render(
      <StatBadge
        label="X"
        value={42}
        renderValue={(v) => <span data-testid="custom">{String(v)}★</span>}
      />
    );
    expect(screen.getByTestId("custom").textContent).toBe("42★");
  });
});
