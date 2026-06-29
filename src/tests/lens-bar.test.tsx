import { fireEvent, render, screen } from "@testing-library/react";
import { Crown, Users } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { LensBar } from "../ui/lens/LensBar";
import type { LensDefinition } from "../ui/lens/lensDefinitions";

const makeLens = (id: string, name: string): LensDefinition =>
  ({
    id: id as LensDefinition["id"],
    name,
    description: "",
    Icon: id === "x" ? Users : Crown,
    mapLayer: "control",
    defaultTab: "region",
    visible: true,
    hoverFields: () => []
  } as LensDefinition);

describe("LensBar", () => {
  it("renders 5 default lens tabs", () => {
    render(<LensBar current="control" onChange={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
  });

  it("marks the current lens as selected", () => {
    render(<LensBar current="economy" onChange={vi.fn()} />);
    const economyTab = screen.getByRole("tab", { name: /经济/ });
    expect(economyTab.getAttribute("aria-selected")).toBe("true");
  });

  it("calls onChange when a tab is clicked", () => {
    const onChange = vi.fn();
    render(<LensBar current="control" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /军事/ }));
    expect(onChange).toHaveBeenCalledWith("military");
  });

  it("shows lens name and numeric key hint", () => {
    render(<LensBar current="control" onChange={vi.fn()} />);
    const peopleTab = screen.getByRole("tab", { name: /民生/ });
    expect(peopleTab.textContent).toContain("民生");
    expect(peopleTab.textContent).toContain("4");
  });

  it("respects custom lenses array", () => {
    const customLenses = [makeLens("control", "Custom A"), makeLens("economy", "Custom B")];
    render(<LensBar current="control" onChange={vi.fn()} lenses={customLenses} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
  });

  it("has tablist role with vertical orientation", () => {
    render(<LensBar current="control" onChange={vi.fn()} />);
    const list = screen.getByRole("tablist");
    expect(list.getAttribute("aria-orientation")).toBe("vertical");
  });
});
