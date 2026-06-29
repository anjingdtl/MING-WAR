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
  | "grain-tribute"      // 漕粮上缴（民间→中央转移）
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
 * Apply ledger entries to faction/region state — the SOLE driver of treasury
 * and grain balances (SPEC v2 S1c). Simulation pushes every fiscal/grain
 * change as a ledger entry and calls this to settle; no scattered
 * `treasury +=` / `grainReserve -=` exists elsewhere.
 *
 * Routing — each entry lands in exactly ONE balance, never two:
 * - Silver (income-* / expense-*): faction.treasury += amount (by factionId).
 * - Grain (grain-*): routed by target id —
 *     • regionId present → region.grainStock (folk / local granary)
 *     • else factionId   → faction.grainReserve (central strategic reserve)
 *   A pool-to-pool transfer (relief, tribute) is recorded as TWO entries,
 *   one per pool, so total grain is conserved. This fixes the latent
 *   double-count where a grain entry carrying BOTH factionId and regionId
 *   was added to reserve AND stock.
 * - military-* / other: recorded for history & trend only, not applied
 *   here (army headcount changes are handled directly in simulation).
 */
export function applyLedgerToState(state: GameState, entries: LedgerEntry[]): void {
  for (const e of entries) {
    const isSilver = e.category.startsWith("income-") || e.category.startsWith("expense-");
    if (isSilver) {
      if (!e.factionId) continue;
      const faction = state.factions[e.factionId];
      if (faction) faction.treasury += e.amount;
      continue;
    }
    if (!e.category.startsWith("grain-")) continue; // military-*, other → record-only
    // Grain: single-pool routing. regionId wins (folk/local event); a
    // reserve entry carries factionId only — so one entry never hits both.
    // Grain pools are FLOORED at 0: grain is a physical stock, and a deficit
    // must surface as famine through pop dynamics — NOT as a negative counter
    // that makes computeGrainPerCapita negative and explodes death rates
    // (the regression seen when unclamped grain ran to -millions). Silver
    // (treasury) is intentionally NOT floored: negative = debt, allowed so
    // Δtreasury stays exactly equal to the ledger silver net (SPEC v2 S1c).
    if (e.regionId) {
      const region = state.regions[e.regionId];
      if (region) region.grainStock = Math.max(0, region.grainStock + e.amount);
    } else if (e.factionId) {
      const faction = state.factions[e.factionId];
      if (faction) faction.grainReserve = Math.max(0, faction.grainReserve + e.amount);
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