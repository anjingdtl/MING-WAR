import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel } from "../ui/common/Panel";

describe("Panel", () => {
  it("renders title and children", () => {
    render(
      <Panel title="奏折摘要">
        <p>本月初三,边关急报</p>
      </Panel>
    );
    expect(screen.getByText("奏折摘要")).toBeTruthy();
    expect(screen.getByText("本月初三,边关急报")).toBeTruthy();
  });

  it("renders eyebrow when provided", () => {
    render(
      <Panel title="标题" eyebrow="朝局">
        <p>正文</p>
      </Panel>
    );
    expect(screen.getByText("朝局")).toBeTruthy();
  });

  it("renders actions slot when provided", () => {
    render(
      <Panel title="X" actions={<button data-testid="act">关闭</button>}>
        <p>内容</p>
      </Panel>
    );
    expect(screen.getByTestId("act")).toBeTruthy();
  });

  it("applies variant class", () => {
    const { rerender } = render(<Panel variant="glass">G</Panel>);
    expect(document.querySelector(".ming-panel--glass")).toBeTruthy();
    rerender(<Panel variant="modal">M</Panel>);
    expect(document.querySelector(".ming-panel--modal")).toBeTruthy();
  });

  it("renders 4 corner ornaments by default", () => {
    const { container } = render(<Panel>X</Panel>);
    const corners = container.querySelectorAll("svg[aria-hidden='true']");
    expect(corners.length).toBeGreaterThanOrEqual(4);
  });

  it("skips corners when showCorners=false", () => {
    const { container } = render(<Panel showCorners={false}>X</Panel>);
    const corners = container.querySelectorAll("svg[aria-hidden='true']");
    expect(corners.length).toBe(0);
  });

  it("renders gold divider after title by default", () => {
    const { container } = render(<Panel title="T">C</Panel>);
    const divider = container.querySelector(".ming-panel__divider");
    expect(divider).toBeTruthy();
  });

  it("skips divider when showDivider=false", () => {
    const { container } = render(<Panel title="T" showDivider={false}>C</Panel>);
    expect(container.querySelector(".ming-panel__divider")).toBeFalsy();
  });

  it("uses section as default element", () => {
    const { container } = render(<Panel>X</Panel>);
    expect(container.querySelector("section.ming-panel")).toBeTruthy();
  });

  it("respects 'as' prop", () => {
    const { container } = render(<Panel as="aside">X</Panel>);
    expect(container.querySelector("aside.ming-panel")).toBeTruthy();
  });
});
