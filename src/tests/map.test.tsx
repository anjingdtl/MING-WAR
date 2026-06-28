import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameMap } from "../ui/map/GameMap";
import { createMvpScenario } from "../data/scenarios";

describe("GameMap", () => {
  it("renders region labels and handles selection", () => {
    const onSelect = vi.fn();
    render(<GameMap state={createMvpScenario()} layer="control" selectedRegionId="beijing" onSelect={onSelect} />);
    expect(screen.getByText("北京")).toBeTruthy();
    fireEvent.click(screen.getByTestId("region-beijing"));
    expect(onSelect).toHaveBeenCalledWith("beijing");
  });
});
