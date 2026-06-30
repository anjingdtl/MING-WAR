import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameMap } from "../ui/map/GameMap";
import { createMvpScenario } from "../data/scenarios";

describe("GameMap", () => {
  it("renders region labels and handles selection", () => {
    const onSelect = vi.fn();
    render(<GameMap state={createMvpScenario()} layer="control" lens="control" selectedRegionId="beizhili" onSelect={onSelect} />);
    expect(screen.getAllByText("北直隶").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("region-beizhili"));
    expect(onSelect).toHaveBeenCalledWith("beizhili");
  });

  it("colors political regions from their current controller", () => {
    const state = createMvpScenario();
    state.regions.beizhili.controllerFactionId = "jianzhou";
    render(<GameMap state={state} layer="control" lens="control" selectedRegionId="beizhili" onSelect={vi.fn()} />);
    const factionColor = state.factions.jianzhou?.primaryColor;
    expect(factionColor).toBeDefined();
    expect(screen.getByTestId("region-area-beizhili").getAttribute("fill")).toBe(factionColor);
  });

  it("clips political regions to the physical land mask", () => {
    render(<GameMap state={createMvpScenario()} layer="control" lens="control" selectedRegionId="beizhili" onSelect={vi.fn()} />);
    expect(document.querySelector("#map-land-clip")).toBeTruthy();
    expect(screen.getByTestId("region-area-beizhili").getAttribute("clip-path")).toBe("url(#map-land-clip)");
    expect(screen.getByTestId("region-area-joseon_north").getAttribute("clip-path")).toBe("url(#map-land-clip)");
    expect(screen.getByTestId("region-area-nurgan_coast").getAttribute("clip-path")).toBe("url(#map-land-clip)");
  });

  it("zooms in and out and resets view", () => {
    render(<GameMap state={createMvpScenario()} layer="control" lens="control" selectedRegionId="beizhili" onSelect={vi.fn()} />);
    expect(screen.getByText("100%")).toBeTruthy();
    fireEvent.click(screen.getByTitle("放大"));
    expect(screen.getByText("112%")).toBeTruthy();
    fireEvent.click(screen.getByTitle("缩小"));
    expect(screen.getByText("100%")).toBeTruthy();
    fireEvent.click(screen.getByTitle("放大"));
    fireEvent.click(screen.getByTitle("重置视图"));
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("renders the three-layer map structure", () => {
    render(<GameMap state={createMvpScenario()} layer="control" lens="control" selectedRegionId={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId("base-geo-layer")).toBeTruthy();
    expect(screen.getByTestId("political-overlay-layer")).toBeTruthy();
    expect(screen.getByTestId("province-tile-layer")).toBeTruthy();
    expect(screen.getByTestId("map-labels-layer")).toBeTruthy();
    expect(screen.getByTestId("map-routes-layer")).toBeTruthy();
  });

  it("separates political overlay fill from interaction hit area", () => {
    render(<GameMap state={createMvpScenario()} layer="control" lens="control" selectedRegionId={null} onSelect={vi.fn()} />);
    const overlayArea = screen.getByTestId("region-area-beizhili");
    const tileHit = screen.getByTestId("region-beizhili");
    expect(overlayArea.getAttribute("fill")).toBeTruthy();
    expect(overlayArea.getAttribute("fill-opacity")).toBeTruthy();
    expect(tileHit.getAttribute("role")).toBe("button");
  });
});
