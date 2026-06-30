/**
 * runSituationPhase — v0.6-stability §3.2 S6
 *
 * 历史局势推进（系统驱动的长期叙事）。
 * 业务逻辑从原 simulation.ts L412-433 完整迁移。
 */

import { advanceSituations } from "../situation";
import { situationLibrary } from "../../data/situations";
import type { PhaseFn } from "../simulationContext";

export const runSituationPhase: PhaseFn = (ctx) => {
  // S6: 历史局势推进
  const sitEvents = advanceSituations(ctx.state, situationLibrary);
  for (const ev of sitEvents) {
    ctx.reports.push({
      id: `${ctx.state.currentDate}-sit-${ev.situationId}-${ev.type}`,
      date: ctx.state.currentDate,
      type: "event",
      title: ev.title,
      body: ev.body,
      severity: ev.type === "outcome" ? "warning" : "info",
    });
  }
};
