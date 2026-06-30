import { describe, expect, it } from "vitest";
import {
  DISASTER_DEFS,
  applyDisasterEffects,
  computeGrainPriceSpike,
  computeGrainYieldPenalty,
  generateDisasters,
} from "../core/disaster";
import { createRandom } from "../core/random";
import type { DisasterState, RegionState } from "../core/types";
import { regionTemplates } from "../data/regions";

function makeRegion(overrides: Partial<RegionState> = {}): RegionState {
  return {
    ...regionTemplates.shaanxi,
    ...overrides,
  };
}

describe("disaster system", () => {
  describe("generateDisasters", () => {
    it("does not crash on empty regions", () => {
      const random = createRandom(42);
      generateDisasters({}, random, "1573-01");
    });

    it("ticks down existing disaster remaining months", () => {
      const random = createRandom(42);
      const region = makeRegion({
        activeDisasters: [
          { id: "d1", type: "drought", severity: 0.5, remainingMonths: 3 },
          { id: "d2", type: "flood", severity: 0.3, remainingMonths: 1 },
        ],
      });
      generateDisasters({ test: region }, random, "1573-02");
      // d1 should have 2 months left, d2 should be removed (was at 1, decremented to 0)
      const d1 = region.activeDisasters.find((d) => d.id === "d1");
      expect(d1?.remainingMonths).toBe(2);
      const d2 = region.activeDisasters.find((d) => d.id === "d2");
      expect(d2).toBeUndefined();
    });

    it("can generate new disasters based on probability", () => {
      // Run many iterations to confirm disasters are generated
      let totalDisasters = 0;
      for (let seed = 0; seed < 200; seed++) {
        const random = createRandom(seed);
        const region = makeRegion({
          climate: "dry",
          stability: 30,
          activeDisasters: [],
        });
        generateDisasters({ test: region }, random, "1573-01");
        totalDisasters += region.activeDisasters.length;
      }
      // With dry climate and stability < 60, 3% probability per month
      // Plus 0.3% plague chance. Over 200 runs, expect at least some disasters.
      expect(totalDisasters).toBeGreaterThan(0);
    });

    it("generates disasters deterministically for the same seed", () => {
      const run = (seed: number) => {
        const random = createRandom(seed);
        const regions: Record<string, RegionState> = {};
        for (const [id, tmpl] of Object.entries(regionTemplates)) {
          regions[id] = { ...tmpl, activeDisasters: [] };
        }
        generateDisasters(regions, random, "1573-01");
        return Object.values(regions)
          .flatMap((r) => r.activeDisasters)
          .map((d) => d.id)
          .sort();
      };
      expect(run(123)).toEqual(run(123));
    });
  });

  describe("applyDisasterEffects", () => {
    it("reduces stability when disasters are active", () => {
      const region = makeRegion({
        stability: 70,
        activeDisasters: [
          { id: "d1", type: "drought", severity: 0.5, remainingMonths: 3 },
        ],
      });
      const result = applyDisasterEffects(region);
      // drought stability loss = 3 * 0.5 = 1.5
      expect(result.stability).toBeLessThan(70);
    });

    it("reduces population for plague", () => {
      const region = makeRegion({
        population: 1000000,
        activeDisasters: [
          { id: "d1", type: "plague", severity: 0.8, remainingMonths: 3 },
        ],
      });
      const result = applyDisasterEffects(region);
      // plague death rate = 0.005 * 0.8 = 0.004
      expect(result.population).toBeLessThan(1000000);
    });

    it("reduces garrison for plague", () => {
      const region = makeRegion({
        garrison: 50000,
        activeDisasters: [
          { id: "d1", type: "plague", severity: 1.0, remainingMonths: 2 },
        ],
      });
      const result = applyDisasterEffects(region);
      // plague garrison loss = 0.02 * 1.0 = 0.02
      expect(result.garrison).toBeLessThan(50000);
    });

    it("returns region unchanged when no disasters", () => {
      const region = makeRegion({ activeDisasters: [] });
      const result = applyDisasterEffects(region);
      expect(result.stability).toBe(region.stability);
      expect(result.population).toBe(region.population);
      expect(result.garrison).toBe(region.garrison);
    });
  });

  describe("computeGrainYieldPenalty", () => {
    it("returns 1.0 with no disasters", () => {
      expect(computeGrainYieldPenalty([])).toBe(1);
    });

    it("reduces yield for drought", () => {
      const disasters: DisasterState[] = [
        { id: "d1", type: "drought", severity: 1.0, remainingMonths: 3 },
      ];
      const penalty = computeGrainYieldPenalty(disasters);
      // drought grain penalty = 0.40, severity 1.0 → 1 - 0.4 = 0.6
      expect(penalty).toBeCloseTo(0.6, 2);
    });

    it("compounds multiple disasters", () => {
      const disasters: DisasterState[] = [
        { id: "d1", type: "drought", severity: 0.5, remainingMonths: 3 },
        { id: "d2", type: "locust", severity: 0.5, remainingMonths: 2 },
      ];
      const penalty = computeGrainYieldPenalty(disasters);
      // (1 - 0.4*0.5) * (1 - 0.5*0.5) = 0.8 * 0.75 = 0.6
      expect(penalty).toBeCloseTo(0.6, 2);
    });

    it("floors at 10% production", () => {
      const disasters: DisasterState[] = [
        { id: "d1", type: "drought", severity: 1.0, remainingMonths: 3 },
        { id: "d2", type: "locust", severity: 1.0, remainingMonths: 2 },
        { id: "d3", type: "famine", severity: 1.0, remainingMonths: 1 },
      ];
      const penalty = computeGrainYieldPenalty(disasters);
      expect(penalty).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe("computeGrainPriceSpike", () => {
    it("returns 0 with no disasters", () => {
      expect(computeGrainPriceSpike([])).toBe(0);
    });

    it("adds price spike for drought", () => {
      const disasters: DisasterState[] = [
        { id: "d1", type: "drought", severity: 0.8, remainingMonths: 3 },
      ];
      const spike = computeGrainPriceSpike(disasters);
      // drought price spike = 0.15 * 0.8 = 0.12
      expect(spike).toBeCloseTo(0.12, 2);
    });
  });

  describe("DISASTER_DEFS", () => {
    it("defines all 5 disaster types", () => {
      expect(Object.keys(DISASTER_DEFS)).toHaveLength(5);
      expect(DISASTER_DEFS.drought).toBeDefined();
      expect(DISASTER_DEFS.flood).toBeDefined();
      expect(DISASTER_DEFS.famine).toBeDefined();
      expect(DISASTER_DEFS.plague).toBeDefined();
      expect(DISASTER_DEFS.locust).toBeDefined();
    });
  });
});
