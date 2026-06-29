import type { GameState, FactionId, RegionId, GoodId } from "./types";

/**
 * A single line item in any ledger.
 * positive = source (income, production, etc.)
 * negative = sink (expense, consumption, etc.)
 */
export interface LedgerEntry {
  category: LedgerCategory;
  source: string;
  amount: number;
  factionId?: FactionId;
  regionId?: RegionId;
  goodId?: GoodId;
}

export type LedgerCategory =
  | "income-tax"        // 收入-田赋
  | "income-commercial" // 收入-商税
  | "income-salt"       // 收入-盐课
  | "income-tariff"     // 收入-关税
  | "income-tribute"    // 收入-朝贡
  | "income-industry"   // 收入-产业
  | "income-loan"       // 收入-借款
  | "expense-bureaucrat" // 支出-俸禄
  | "expense-army-pay"   // 支出-军饷
  | "expense-supply"     // 支出-补给
  | "expense-relief"     // 支出-赈灾
  | "expense-construction" // 支出-建设
  | "expense-debt-interest" // 支出-债务利息
  | "expense-court"      // 支出-宫廷
  | "expense-event"      // 支出-事件
  | "grain-production"   // 粮食产出
  | "grain-consumption"  // 粮食消费
  | "grain-transport-loss" // 运输损耗
  | "grain-trade"        // 粮食贸易
  | "grain-relief"       // 赈灾发放
  | "military-casualties" // 军事损耗
  | "military-recruitment" // 募兵
  | "military-disbandment" // 复员
  | "other";

export interface MonthlyLedger {
  date: string;
  entries: LedgerEntry[];
}

/**
 * Aggregate entries by category. Useful for UI display.
 */
export function aggregateLedger(entries: LedgerEntry[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const e of entries) {
    result[e.category] = (result[e.category] ?? 0) + e.amount;
  }
  return result;
}

/**
 * Sum entries of a given category (with optional filter).
 */
export function sumLedger(
  entries: LedgerEntry[],
  predicate: (e: LedgerEntry) => boolean
): number {
  let sum = 0;
  for (const e of entries) {
    if (predicate(e)) sum += e.amount;
  }
  return sum;
}

/**
 * Apply ledger entries to faction/region state.
 * Treasury entries go to faction treasury, grain entries go to region stock or faction reserve.
 */
export function applyLedgerToState(state: GameState, entries: LedgerEntry[]): void {
  for (const e of entries) {
    if (e.factionId) {
      const faction = state.factions[e.factionId];
      if (!faction) continue;
      // Income goes to treasury
      if (e.category.startsWith("income-")) {
        faction.treasury += e.amount;
      }
      // Expenses come out of treasury
      else if (e.category.startsWith("expense-")) {
        faction.treasury += e.amount; // e.amount is already negative
      }
      // Grain entries go to faction reserve if factionId specified
      else if (e.category.startsWith("grain-") && e.goodId === "grain") {
        faction.grainReserve += e.amount;
      }
    }
    if (e.regionId) {
      const region = state.regions[e.regionId];
      if (!region) continue;
      if (e.category.startsWith("grain-") && e.goodId === "grain") {
        region.grainStock += e.amount;
      }
    }
  }
}

/**
 * 12-month rolling trend from history of ledgers.
 * Returns a series of (date, totalIncome, totalExpense) tuples.
 */
export interface TrendPoint {
  date: string;
  income: number;
  expense: number;
  netFlow: number;
}

export function buildFiscalTrend(
  ledgerHistory: MonthlyLedger[],
  windowSize = 12
): TrendPoint[] {
  const recent = ledgerHistory.slice(-windowSize);
  return recent.map((m) => {
    const income = m.entries
      .filter((e) => e.category.startsWith("income-"))
      .reduce((s, e) => s + e.amount, 0);
    const expense = m.entries
      .filter((e) => e.category.startsWith("expense-"))
      .reduce((s, e) => s + e.amount, 0);
    return { date: m.date, income, expense, netFlow: income + expense };
  });
}

/**
 * Build a 12-month trend from history of grain ledgers only.
 */
export function buildGrainTrend(
  ledgerHistory: MonthlyLedger[],
  windowSize = 12
): TrendPoint[] {
  const recent = ledgerHistory.slice(-windowSize);
  return recent.map((m) => {
    const income = m.entries
      .filter((e) => e.category === "grain-production" || e.category === "grain-trade")
      .reduce((s, e) => s + e.amount, 0);
    const expense = m.entries
      .filter((e) => e.category !== "grain-production" && e.category !== "grain-trade" && e.category.startsWith("grain-"))
      .reduce((s, e) => s + e.amount, 0);
    return { date: m.date, income, expense, netFlow: income + expense };
  });
}

/**
 * Generate explanation strings for a value: source, breakdown, recent trend.
 * Used for UI hover tooltips.
 */
export interface ValueExplanation {
  value: number;
  sources: Array<{ name: string; amount: number; share: number }>;
  recentDelta: number;
  trend: "rising" | "falling" | "stable";
}

export function explainValue(
  current: number,
  prior: number | undefined,
  sources: Array<{ name: string; amount: number }>
): ValueExplanation {
  const total = sources.reduce((s, x) => s + Math.abs(x.amount), 0);
  const recentDelta = prior === undefined ? 0 : current - prior;
  let trend: "rising" | "falling" | "stable" = "stable";
  if (Math.abs(recentDelta) > total * 0.1) {
    trend = recentDelta > 0 ? "rising" : "falling";
  }
  return {
    value: current,
    sources: sources.map((s) => ({
      name: s.name,
      amount: s.amount,
      share: total === 0 ? 0 : Math.abs(s.amount) / total
    })),
    recentDelta,
    trend
  };
}