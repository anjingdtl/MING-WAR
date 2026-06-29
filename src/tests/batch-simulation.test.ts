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
    expect(summary.averageMingRegions).toBeGreaterThanOrEqual(0);
    expect(summary.averageTopScore).toBeGreaterThan(0);
    expect(summary.averageReports).toBeGreaterThan(0);
  });

  it("returns detailed error statistics", () => {
    const summary = runBatchSimulation(3, 30);
    expect(summary.errorRuns).toBeDefined();
    expect(summary.errorRuns).toBeGreaterThanOrEqual(0);
    expect(summary.errorMessages).toBeDefined();
    expect(Array.isArray(summary.errorMessages)).toBe(true);
  });

  it("tracks Ming faction survival rate", () => {
    const summary = runBatchSimulation(3, 30);
    expect(summary.mingSurvivalRate).toBeDefined();
    expect(summary.mingSurvivalRate).toBeGreaterThanOrEqual(0);
    expect(summary.mingSurvivalRate).toBeLessThanOrEqual(1);
  });

  it("reports aggregate treasury delta for Ming", () => {
    const summary = runBatchSimulation(3, 30);
    expect(summary.totalTreasuryDelta).toBeDefined();
    expect(Number.isFinite(summary.totalTreasuryDelta)).toBe(true);
  });

  it("reports aggregate population delta", () => {
    const summary = runBatchSimulation(3, 30);
    expect(summary.totalPopulationDelta).toBeDefined();
    expect(Number.isFinite(summary.totalPopulationDelta)).toBe(true);
  });

  it("completes without crashing for short runs", () => {
    const summary = runBatchSimulation(2, 6);
    expect(summary.errorRuns).toBe(0);
  });
});