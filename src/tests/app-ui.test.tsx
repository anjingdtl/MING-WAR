import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";

describe("App UI", () => {
  it("renders the core decision surface", () => {
    render(<App />);
    expect(screen.getByText("万历：山河崩塌")).toBeTruthy();
    expect(screen.getByText("区域详情")).toBeTruthy();
  });

  it("renders the side panel tabs", () => {
    render(<App />);
    // SidePanel tabs and LensBar tabs share role="tab", use getAllByRole
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(10); // 5 LensBar + 5 SidePanel
    // Verify expected tab labels exist
    const labels = tabs.map((t) => t.textContent ?? "");
    expect(labels.some((l) => l.includes("区域"))).toBe(true);
    expect(labels.some((l) => l.includes("决策"))).toBe(true);
    expect(labels.some((l) => l.includes("朝堂"))).toBe(true);
    expect(labels.some((l) => l.includes("邸报"))).toBe(true);
    expect(labels.some((l) => l.includes("大事记"))).toBe(true);
    expect(labels.some((l) => l.includes("经济"))).toBe(true);
    expect(labels.some((l) => l.includes("军事"))).toBe(true);
    expect(labels.some((l) => l.includes("民生"))).toBe(true);
  });
});
