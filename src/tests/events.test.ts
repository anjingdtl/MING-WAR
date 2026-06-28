import { describe, expect, it } from "vitest";
import { applyEventOption, findTriggeredEvents } from "../core/eventEngine";
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
});
