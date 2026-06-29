import { describe, expect, it } from "vitest";
import {
  aggregateLedger,
  buildFiscalTrend,
  buildGrainTrend,
  explainValue,
  sumLedger
} from "../core/ledger";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("aggregateLedger", () => {
  it("groups entries by category and sums them", () => {
    const result = aggregateLedger([
      { category: "income-tax", source: "a", amount: 100 },
      { category: "income-tax", source: "b", amount: 50 },
      { category: "expense-army-pay", source: "c", amount: -80 }
    ]);
    expect(result["income-tax"]).toBe(150);
    expect(result["expense-army-pay"]).toBe(-80);
  });
});

describe("sumLedger", () => {
  it("filters and sums entries", () => {
    const total = sumLedger(
      [
        { category: "income-tax", source: "a", amount: 100 },
        { category: "grain-production", source: "b", amount: 50 }
      ],
      (e) => e.category.startsWith("income-")
    );
    expect(total).toBe(100);
  });
});

describe("buildFiscalTrend", () => {
  it("computes monthly income, expense, net flow", () => {
    const trend = buildFiscalTrend([
      { date: "1573-01", entries: [
        { category: "income-tax", source: "x", amount: 500 },
        { category: "expense-army-pay", source: "y", amount: -300 }
      ]},
      { date: "1573-02", entries: [
        { category: "income-tax", source: "x", amount: 600 },
        { category: "expense-army-pay", source: "y", amount: -400 }
      ]}
    ]);
    expect(trend.length).toBe(2);
    expect(trend[0].income).toBe(500);
    expect(trend[0].netFlow).toBe(200);
    expect(trend[1].netFlow).toBe(200);
  });

  it("respects window size", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({
      date: `1574-${String(i + 1).padStart(2, "0")}`,
      entries: [{ category: "income-tax" as const, source: "x", amount: 100 }]
    }));
    expect(buildFiscalTrend(history, 12).length).toBe(12);
    expect(buildFiscalTrend(history, 60).length).toBe(20);
  });
});

describe("buildGrainTrend", () => {
  it("separates grain production/consumption", () => {
    const trend = buildGrainTrend([
      { date: "1573-01", entries: [
        { category: "grain-production", source: "a", amount: 1000 },
        { category: "grain-consumption", source: "b", amount: -600 },
        { category: "grain-transport-loss", source: "c", amount: -100 }
      ]}
    ]);
    expect(trend[0].income).toBe(1000);
    expect(trend[0].expense).toBe(-700);
  });
});

describe("explainValue", () => {
  it("computes share of each source", () => {
    const exp = explainValue(100, 80, [
      { name: "田赋", amount: 60 },
      { name: "商税", amount: 40 }
    ]);
    expect(exp.sources.length).toBe(2);
    expect(exp.sources[0].share).toBe(0.6);
    expect(exp.recentDelta).toBe(20);
    expect(exp.trend).toBe("rising");
  });

  it("marks stable when delta is small", () => {
    const exp = explainValue(100, 99, [{ name: "x", amount: 50 }]);
    expect(exp.trend).toBe("stable");
  });
});

describe("P1: simulation records monthly ledger", () => {
  it("appends entries to ledgerHistory each month", () => {
    const state = createMvpScenario("ming", 1);
    expect(state.ledgerHistory).toBeUndefined();

    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: 1
    }).nextState;

    expect(result.ledgerHistory).toBeDefined();
    expect(result.ledgerHistory!.length).toBe(1);
    expect(result.ledgerHistory![0].entries.length).toBeGreaterThan(0);
  });

  it("tracks fiscal income and expense separately", () => {
    const state = createMvpScenario("ming", 1);
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: 1
    }).nextState;
    const monthly = result.ledgerHistory![0];
    const income = monthly.entries.filter((e) => e.category.startsWith("income-"));
    const expense = monthly.entries.filter((e) => e.category.startsWith("expense-"));
    expect(income.length + expense.length).toBeGreaterThan(0);
  });

  it("12-month trend is available after 12 simulations", () => {
    const state = createMvpScenario("ming", 1);
    let current = state;
    for (let i = 0; i < 12; i++) {
      current = simulateMonth({
        state: current,
        playerDecision: defaultPlayerDecision,
        randomSeed: current.seed
      }).nextState;
    }
    expect(current.ledgerHistory!.length).toBe(12);
    const trend = buildFiscalTrend(current.ledgerHistory!);
    expect(trend.length).toBe(12);
  });
});