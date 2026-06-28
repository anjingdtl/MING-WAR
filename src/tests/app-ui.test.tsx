import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";

describe("App UI", () => {
  it("renders the core decision surface", () => {
    render(<App />);
    expect(screen.getByText("万历：山河崩塌")).toBeTruthy();
    expect(screen.getByText("战略决策")).toBeTruthy();
    expect(screen.getByText("区域详情")).toBeTruthy();
    expect(screen.getByText("月度日志")).toBeTruthy();
  });
});
