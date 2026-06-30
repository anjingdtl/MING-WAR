/**
 * finalizeMonth — v0.6-stability §3.2 S7
 *
 * 月末收口：推进日期、报告裁剪、ledger 历史、迁移、贸易/价格/投资、不变量、
 * history、alerts、gameStatus、lastDomesticFocus。
 * 业务逻辑从原 simulation.ts L536-612 完整迁移。
 */

import { advanceMonth, isAfter } from "../calendar";
import { migrateMigrants } from "../populationGroups";
import {
  autoInvest,
  runTrade,
  updateMarketPrices
} from "../market";
import { validateInvariants } from "../invariants";
import { mvpEvents } from "../../data/events";
import { isTimingEnabled, recordPhase } from "../timing";
import type { MonthlyReport } from "../types";
import { countControlledRegions } from "./helpers";
import type { PhaseFn } from "../simulationContext";

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export const finalizeMonth: PhaseFn = (ctx) => {
  // 推进日期
  const nextDate = advanceMonth(ctx.state.currentDate);
  ctx.state.currentDate = nextDate;
  ctx.state.seed = ctx.random.seed;

  // 报告裁剪（最多 300 条）
  ctx.state.reports = [...ctx.reports, ...ctx.state.reports].slice(0, 300);

  // ledger 历史（最多 60 月）
  if (!ctx.state.ledgerHistory) ctx.state.ledgerHistory = [];
  ctx.state.ledgerHistory.push({ date: ctx.state.currentDate, entries: ctx.ledgerEntries });
  if (ctx.state.ledgerHistory.length > 60) {
    ctx.state.ledgerHistory = ctx.state.ledgerHistory.slice(-60);
  }

  // 流民迁移
  for (const region of Object.values(ctx.state.regions)) {
    if (region.popGroups?.some((g) => g.type === "migrant")) {
      migrateMigrants(ctx.state, region.id);
    }
  }

  // 跨地区贸易 / 价格更新 / 自动投资（market 阶段计时）
  const marketStart = isTimingEnabled() ? nowMs() : 0;
  const marketsByRegion: Record<string, import("../market").MarketState> = {};
  const industriesByRegion: Record<string, import("../types").IndustryState[]> = {};
  for (const region of Object.values(ctx.state.regions)) {
    if (!region.market) continue;
    marketsByRegion[region.id] = region.market;
    industriesByRegion[region.id] = region.industries ?? [];
  }
  runTrade(ctx.state, marketsByRegion);
  updateMarketPrices(marketsByRegion, ctx.state.regions);
  autoInvest(marketsByRegion, industriesByRegion);
  recordPhase(ctx.timings, "market", marketStart);

  // 不变量校验
  const validationStart = isTimingEnabled() ? nowMs() : 0;
  const violations = validateInvariants(ctx.state);
  for (const v of violations) {
    if (v.severity === "error") {
      ctx.reports.push({
        id: `${ctx.state.currentDate}-invariant-${v.id}`,
        date: ctx.state.currentDate,
        type: "system",
        title: `状态不变量违反：${v.id}`,
        body: v.message,
        severity: "danger"
      });
    }
  }
  recordPhase(ctx.timings, "validation", validationStart);

  // history 推一条
  ctx.state.history.push({
    date: nextDate,
    summary: `${nextDate} 月度结算完成。`,
    factionCount: Object.values(ctx.state.factions).filter((faction) => faction.status === "active").length,
    controlledRegions: countControlledRegions(ctx.state)
  });

  // alerts 由触发的待选项事件派生
  const triggeredEvents: MonthlyReport[] = ctx.triggeredEventIds
    .map((id) => mvpEvents.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((event) => ({
      id: `alert-${event.id}`,
      date: ctx.state.currentDate,
      type: "event" as const,
      title: event.name,
      body: event.description,
      severity: "warning" as const
    }));
  ctx.state.alerts = triggeredEvents;

  // gameStatus
  const playerEliminated = ctx.state.factions[ctx.state.playerFactionId]?.status === "collapsed";
  ctx.state.gameStatus =
    isAfter(nextDate, ctx.state.endDate) || playerEliminated
      ? "finished"
      : triggeredEvents.length > 0
        ? "paused"
        : "playing";
  ctx.state.lastDomesticFocus = ctx.playerDecision.domesticFocus;
};
