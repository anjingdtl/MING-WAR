import { describe, expect, it } from "vitest";
import { factionMapLabels } from "../map/generated/factionMapLabels";
import { mapCanvas } from "../map/mapCanvas";
import { factionTemplates } from "../data/factions";

describe("faction map labels", () => {
  it("provides at least one label for every major faction", () => {
    const labelledFactions = new Set(factionMapLabels.map((l) => l.factionId));
    for (const factionId of Object.keys(factionTemplates)) {
      expect(labelledFactions.has(factionId), `${factionId} should have a map label`).toBe(true);
    }
  });

  it("keeps every label inside the map viewBox", () => {
    for (const label of factionMapLabels) {
      expect(label.x, `${label.factionId} x`).toBeGreaterThanOrEqual(0);
      expect(label.x, `${label.factionId} x`).toBeLessThanOrEqual(mapCanvas.width);
      expect(label.y, `${label.factionId} y`).toBeGreaterThanOrEqual(0);
      expect(label.y, `${label.factionId} y`).toBeLessThanOrEqual(mapCanvas.height);
    }
  });

  it("uses valid importance levels", () => {
    for (const label of factionMapLabels) {
      expect([1, 2, 3]).toContain(label.importance);
    }
  });

  it("shows faction labels at low zoom and hides at high zoom", () => {
    for (const label of factionMapLabels) {
      expect(label.minZoom).toBeLessThanOrEqual(label.maxZoom);
      expect(label.maxZoom, `${label.factionId} should hide at high zoom`).toBeLessThan(1);
    }
  });

  it("marks Ming as the highest importance label", () => {
    const ming = factionMapLabels.find((l) => l.factionId === "ming");
    expect(ming).toBeDefined();
    expect(ming?.importance).toBe(1);
    expect(ming?.label).toBe("大明");
  });

  it("includes background faction labels for context regions", () => {
    const backgroundFactions = ["tibet", "mobei", "southeast-asia", "liuqiu"];
    for (const fid of backgroundFactions) {
      const label = factionMapLabels.find((l) => l.factionId === fid);
      expect(label, `${fid} should have a context label`).toBeDefined();
      expect(label?.importance).toBe(3);
    }
  });
});
