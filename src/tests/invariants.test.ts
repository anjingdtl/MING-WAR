import { describe, expect, it } from "vitest";
import { validateInvariants, summarizeViolations } from "../core/invariants";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("validateInvariants", () => {
  it("returns no violations for a valid initial game state", () => {
    const state = createMvpScenario("ming", 1);
    const violations = validateInvariants(state);
    expect(violations).toEqual([]);
  });

  it("detects extremely negative treasury", () => {
    const state = createMvpScenario("ming", 1);
    state.factions.ming.treasury = -2_000_000;
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "treasury-extreme-negative")).toBe(true);
  });

  it("detects NaN treasury", () => {
    const state = createMvpScenario("ming", 1);
    state.factions.ming.treasury = NaN;
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "nan-treasury")).toBe(true);
  });

  it("detects population exceeding capacity by 5x", () => {
    const state = createMvpScenario("ming", 1);
    state.regions.beizhili.population = state.regions.beizhili.populationCapacity * 10;
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "population-explosion")).toBe(true);
  });

  it("detects negative population", () => {
    const state = createMvpScenario("ming", 1);
    state.regions.beizhili.population = -100;
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "population-negative")).toBe(true);
  });

  it("detects dead faction still has army", () => {
    const state = createMvpScenario("ming", 1);
    state.factions.ming.status = "collapsed";
    state.factions.ming.armyTotal = 50000;
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "dead-faction-army")).toBe(true);
  });

  it("detects modifier with negative remaining months", () => {
    const state = createMvpScenario("ming", 1);
    state.activeModifiers = [
      { id: "bad", label: "Bad", scope: "global", remainingMonths: -1, effects: {} }
    ];
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "modifier-negative-months")).toBe(true);
  });

  it("detects war referencing missing faction", () => {
    const state = createMvpScenario("ming", 1);
    state.wars = [{
      id: "broken",
      attackerFactionId: "nonexistent",
      defenderFactionId: "ming",
      targetRegionId: "beizhili",
      progress: 30,
      monthsActive: 1
    }];
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "war-attacker-missing")).toBe(true);
  });

  it("does not flag small treasury deficits (within reason)", () => {
    const state = createMvpScenario("ming", 1);
    state.factions.ming.treasury = -500_000; // Within floor of -1M
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "treasury-extreme-negative")).toBe(false);
  });
});

describe("summarizeViolations", () => {
  it("counts errors and warnings separately", () => {
    const violations = [
      { id: "a", message: "x", severity: "error" as const },
      { id: "b", message: "y", severity: "warning" as const },
      { id: "c", message: "z", severity: "error" as const },
    ];
    const summary = summarizeViolations(violations);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
  });

  it("returns zeros for empty list", () => {
    const summary = summarizeViolations([]);
    expect(summary.errors).toBe(0);
    expect(summary.warnings).toBe(0);
  });
});

describe("P0-5: simulation validates invariants and reports violations", () => {
  it("reports invariant violations as system reports", () => {
    const state = createMvpScenario("ming", 99);
    state.factions.ming.treasury = -2_000_000; // Triggers extreme negative

    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: 1
    });

    const invariantReport = result.reports.find(
      (r) => r.type === "system" && r.title.includes("treasury-extreme-negative")
    );
    expect(invariantReport).toBeDefined();
    expect(invariantReport?.severity).toBe("danger");
  });

  it("does not produce invariant reports for valid state", () => {
    const state = createMvpScenario("ming", 100);
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: 1
    });

    const invariantReports = result.reports.filter((r) => r.type === "system");
    expect(invariantReports.length).toBe(0);
  });
});