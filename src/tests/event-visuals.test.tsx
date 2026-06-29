import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mvpEvents } from "../data/events";
import { resolveEventVisual, visualFamilies } from "../data/eventVisuals";
import { EventDialog } from "../ui/dialogs/EventDialog";

describe("event visuals", () => {
  it("resolves a visual for every historical event", () => {
    for (const event of mvpEvents) {
      expect(resolveEventVisual(event).type, event.id).toBeTruthy();
    }
  });

  it("covers the required event illustration families", () => {
    const visualTypes = [...new Set(mvpEvents.map((event) => resolveEventVisual(event).type))];

    expect(visualTypes).toEqual(expect.arrayContaining(["political", "popular", "military", "disaster"]));
    expect(Object.keys(visualFamilies)).toHaveLength(8);
  });

  it("classifies representative events by theme", () => {
    const byId = Object.fromEntries(mvpEvents.map((event) => [event.id, resolveEventVisual(event).type]));

    expect(byId.zhang_reform_pressure).toBe("political");
    expect(byId.mineral_tax_disaster).toBe("popular");
    expect(byId.korean_war).toBe("military");
    expect(byId.shaanxi_drought).toBe("disaster");
  });

  it("renders the resolved visual family in the event dialog", () => {
    const event = mvpEvents.find((item) => item.id === "korean_war");
    if (!event) throw new Error("Missing korean_war event");

    const { container } = render(<EventDialog event={event} onResolve={() => undefined} />);

    expect(container.querySelector(".event-art--military")).not.toBeNull();
    const image = screen.getByRole("img", { name: /军事事件/ });
    expect(image).not.toBeNull();
    expect(image.getAttribute("src")).toContain("event-military");
  });
});
