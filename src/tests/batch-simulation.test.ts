import { describe, expect, it } from "vitest";
import { scoreAllFactions } from "../core/scoring";
import { runBatchSimulation } from "../scripts/runBatchSimulation";
import { createMvpScenario } from "../data/scenarios";

describe("scoring", () => {
  it("ranks factions with numeric scores", () => {
    const scores = scoreAllFactions(createMvpScenario());
    expect(scores[0].score).toBeGreaterThan(0);
    expect(scores[0].controlledRegions).toBeGreaterThan(0);
  });
});

describe("batch simulation", () => {
  it("returns stable aggregate metrics", () => {
    const summary = runBatchSimulation(3, 12);
    expect(summary.runs).toBe(3);
    expect(summary.months).toBe(12);
    expect(summary.averageMingRegions).toBeGreaterThan(0);
    expect(summary.averageTopScore).toBeGreaterThan(0);
    expect(summary.averageReports).toBeGreaterThan(0);
  });
});
