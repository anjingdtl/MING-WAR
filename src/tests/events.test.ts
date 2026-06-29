import { describe, expect, it } from "vitest";
import { applyEventOption, eventConditionMet, findTriggeredEvents } from "../core/eventEngine";
import { mvpEvents } from "../data/events";
import { createMvpScenario } from "../data/scenarios";

describe("event engine", () => {
  it("finds date-window events", () => {
    const state = createMvpScenario("ming");
    const events = findTriggeredEvents(state, mvpEvents);
    expect(events.map((event) => event.id)).toContain("zhang_reform_pressure");
  });

  it("applies selected option effects and sets event flag", () => {
    const state = createMvpScenario("ming");
    const event = findTriggeredEvents(state, mvpEvents)[0];
    const next = applyEventOption(state, event, event.options[0].id);
    expect(next.eventFlags[`event:${event.id}`]).toBe(true);
    expect(next.reports[0].type).toBe("event");
  });

  it("evaluates extended conditions", () => {
    const state = createMvpScenario("ming");
    state.factions.ming.grainReserve = 500;
    state.factions.ming.legitimacy = 40;
    state.regions.shaanxi.stability = 30;
    state.regions.shaanxi.control = 20;

    expect(eventConditionMet(state, { type: "faction_grain_below", factionId: "ming", value: 1000 })).toBe(true);
    expect(eventConditionMet(state, { type: "faction_grain_below", factionId: "ming", value: 100 })).toBe(false);
    expect(eventConditionMet(state, { type: "faction_legitimacy_below", factionId: "ming", value: 50 })).toBe(true);
    expect(eventConditionMet(state, { type: "region_stability_below", regionId: "shaanxi", value: 40 })).toBe(true);
    expect(eventConditionMet(state, { type: "region_control_below", regionId: "shaanxi", value: 25 })).toBe(true);
    expect(eventConditionMet(state, { type: "faction_controls_any", factionId: "ming", regionIds: ["beizhili", "liaodong"] })).toBe(true);
  });

  it("includes expanded historical event library", () => {
    expect(mvpEvents.length).toBeGreaterThanOrEqual(20);
    const eventIds = mvpEvents.map((event) => event.id);
    expect(eventIds).toContain("korean_war");
    expect(eventIds).toContain("later_jin_founded");
    expect(eventIds).toContain("saarhu_campaign");
  });
});
