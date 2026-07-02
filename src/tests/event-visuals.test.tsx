import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { factionTemplates } from "../data/factions";
import { mvpEvents } from "../data/events";
import { resolveEventVisual, visualFamilies } from "../data/eventVisuals";
import {
  resolveEventCharacters,
  resolveEventScene,
  resolveFactionLeaderPortrait
} from "../data/artCatalog";
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
    const image = screen.getByRole("img", { name: /援朝战争/ });
    expect(image).not.toBeNull();
    expect(image.getAttribute("src")).toContain("korean-war");
  });

  it("resolves a scene image for every event", () => {
    for (const event of mvpEvents) {
      expect(resolveEventScene(event).src, event.id).toBeTruthy();
    }
  });

  it("uses bespoke scenes for expanded historical events", () => {
    const byId = Object.fromEntries(mvpEvents.map((event) => [event.id, event]));

    const plannedSceneKeys = {
      jisi_incident: "event-jisi-incident",
      liaoxiang_surcharge: "event-liaoxiang-surcharge",
      jiashen_catastrophe: "event-jiashen-catastrophe",
      tiaoobian_controversy: "event-tiaoobian-controversy",
      wei_zhongxian_purge: "event-wei-zhongxian-purge",
      yuan_chonghuan_execution: "event-yuan-chonghuan-execution",
      shaanxi_chain_drought: "event-shaanxi-chain-drought",
      korean_war: "event-korean-war",
      later_jin_founded: "event-later-jin-founded",
      saarhu_campaign: "event-saarhu-campaign"
    };

    for (const [eventId, expectedKey] of Object.entries(plannedSceneKeys)) {
      const scene = resolveEventScene(byId[eventId]);
      expect(scene.key, eventId).toBe(expectedKey);
      expect(scene.src, eventId).toContain("/assets/art/events/");
    }
  });

  it("maps named historical figures to event portrait metadata", () => {
    const byId = Object.fromEntries(mvpEvents.map((event) => [event.id, event]));
    const mappedCharacterIds = new Set(
      mvpEvents.flatMap((event) => resolveEventCharacters(event).map((item) => item.id))
    );

    expect(resolveEventCharacters(byId.zhang_reform_pressure).map((item) => item.id)).toContain("zhang_juzheng");
    expect(resolveEventCharacters(byId.later_jin_founded).map((item) => item.id)).toContain("nurhaci");
    expect(resolveEventCharacters(byId.wei_zhongxian_purge).map((item) => item.id)).toContain("wei_zhongxian");
    expect(resolveEventCharacters(byId.yuan_chonghuan_execution).map((item) => item.id)).toContain("yuan_chonghuan");
    expect([...mappedCharacterIds]).toEqual(expect.arrayContaining([
      "zhang_juzheng",
      "wanli_emperor",
      "nurhaci",
      "xiong_tingbi",
      "wei_zhongxian",
      "yuan_chonghuan",
      "chongzhen_emperor",
      "li_chengliang",
      "toyotomi_hideyoshi",
      "joseon_seonjo"
    ]));
    for (const event of mvpEvents) {
      for (const character of resolveEventCharacters(event)) {
        expect(character.src, character.id).toContain("/assets/art/portraits/characters/");
      }
    }
  });

  it("covers every faction with a leader portrait", () => {
    for (const factionId of Object.keys(factionTemplates)) {
      const portrait = resolveFactionLeaderPortrait(factionId);
      expect(portrait.src, factionId).toBeTruthy();
      expect(portrait.src, factionId).toMatch(/\/assets\/art\/portraits\/(characters|factions)\//);
      expect(portrait.src, factionId).not.toContain("ming-character-portraits");
    }
  });

  it("renders mapped historical characters in the event dialog", () => {
    const event = mvpEvents.find((item) => item.id === "yuan_chonghuan_execution");
    if (!event) throw new Error("Missing yuan_chonghuan_execution event");

    render(<EventDialog event={event} onResolve={() => undefined} />);

    expect(screen.getByRole("img", { name: /^袁崇焕$/ })).not.toBeNull();
  });
});
