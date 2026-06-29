import { describe, expect, it } from "vitest";
import { LENSES, LENS_BY_ID } from "../ui/lens/lensDefinitions";
import {
  getRegionColor,
  getRegionOpacity
} from "../ui/lens/lensColorScales";
import { createMvpScenario } from "../data/scenarios";

describe("Lens / definitions", () => {
  it("exposes 5 lenses", () => {
    expect(LENSES).toHaveLength(5);
    expect(LENSES.map((l) => l.id)).toEqual([
      "control",
      "economy",
      "military",
      "people",
      "court"
    ]);
  });

  it("has LENS_BY_ID map matching LENSES", () => {
    for (const lens of LENSES) {
      expect(LENS_BY_ID[lens.id]).toBe(lens);
    }
  });

  it("every lens has hoverFields function that returns array of fields", () => {
    const state = createMvpScenario();
    const region = state.regions.beizhili;
    for (const lens of LENSES) {
      const fields = lens.hoverFields(region, state);
      expect(fields.length).toBeGreaterThan(0);
      for (const f of fields) {
        expect(f.label).toBeTruthy();
        expect(f.value).toBeTruthy();
      }
    }
  });

  it("every lens declares a mapLayer", () => {
    for (const lens of LENSES) {
      expect(lens.mapLayer).toBeTruthy();
      expect(lens.defaultTab).toBeTruthy();
    }
  });
});

describe("Lens / colorScales", () => {
  const state = createMvpScenario();
  const region = state.regions.beizhili;

  it("control lens returns faction primaryColor", () => {
    const faction = state.factions[region.controllerFactionId];
    expect(getRegionColor(region, state, "control")).toBe(faction?.primaryColor);
  });

  it("economy lens returns color in yellow-brown range", () => {
    const c = getRegionColor(region, state, "economy");
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
    // The mix between #3F3A33 and #D9A441 should produce something yellowish
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    // Should be warmer than pure grey
    expect(r + g).toBeGreaterThan(b);
  });

  it("military lens returns reddish color when garrison is high", () => {
    state.regions.beizhili.garrison = 50000;
    const c = getRegionColor(state.regions.beizhili, state, "military");
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
    const r = parseInt(c.slice(1, 3), 16);
    expect(r).toBeGreaterThan(150);
  });

  it("people lens produces valid color", () => {
    const c = getRegionColor(region, state, "people");
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("court lens returns player color for player region, other for non-player", () => {
    const playerColor = getRegionColor(region, state, "court");
    expect(playerColor).toBe("#4A7B9D");
    // Switch controller
    state.regions.beizhili.controllerFactionId = "jianzhou";
    const otherColor = getRegionColor(state.regions.beizhili, state, "court");
    expect(otherColor).toBe("#6E4F6B");
  });

  it("control opacity tracks region.control", () => {
    state.regions.beizhili.control = 100;
    expect(getRegionOpacity(state.regions.beizhili, "control")).toBeCloseTo(1, 5);
    state.regions.beizhili.control = 0;
    expect(getRegionOpacity(state.regions.beizhili, "control")).toBeGreaterThanOrEqual(0.34);
  });

  it("other lenses use fixed opacity", () => {
    const regionCopy = { ...region, control: 0 };
    expect(getRegionOpacity(regionCopy, "economy")).toBe(0.72);
    expect(getRegionOpacity(regionCopy, "military")).toBe(0.72);
    expect(getRegionOpacity(regionCopy, "people")).toBe(0.72);
  });
});
