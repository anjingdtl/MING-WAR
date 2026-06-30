/**
 * runPoliticsPhase — v0.6-stability §3.2 S5
 *
 * 法律改革 + 政治运动。
 * 业务逻辑从原 simulation.ts L370-411 完整迁移。
 */

import { autoProposeReforms, advanceReforms } from "../reform";
import { advancePoliticalMovements, DEMAND_LABEL } from "../politics";
import { lawLibrary } from "../../data/laws";
import type { PhaseFn } from "../simulationContext";

export const runPoliticsPhase: PhaseFn = (ctx) => {
  // S4: 法律改革
  autoProposeReforms(ctx.state, ctx.decisionsLookup);
  const reformResult = advanceReforms(ctx.state);
  for (const r of reformResult.enacted) {
    const law = lawLibrary[r.lawId];
    const fname = ctx.state.factions[r.factionId]?.name ?? r.factionId;
    ctx.reports.push({
      id: `${r.id}-enacted`,
      date: ctx.state.currentDate,
      type: "event",
      title: `${fname}颁行《${law?.name ?? r.lawId}》`,
      body: `历经博弈，《${law?.name ?? r.lawId}》正式落实，相关制度随之长效调整。`,
      severity: "info",
    });
  }
  for (const r of reformResult.failed) {
    const law = lawLibrary[r.lawId];
    const fname = ctx.state.factions[r.factionId]?.name ?? r.factionId;
    ctx.reports.push({
      id: `${r.id}-failed`,
      date: ctx.state.currentDate,
      type: "event",
      title: `${fname}《${law?.name ?? r.lawId}》改革受挫`,
      body: `《${law?.name ?? r.lawId}》遭既得利益集团强力阻击，无果而终，朝廷威信受损。`,
      severity: "warning",
    });
  }

  // S3c: 政治运动
  const settledMovements = advancePoliticalMovements(ctx.state);
  for (const m of settledMovements) {
    const factionName = ctx.state.factions[m.factionId]?.name ?? m.factionId;
    ctx.reports.push({
      id: `${m.id}-report`,
      date: ctx.state.currentDate,
      type: "event",
      title: `${factionName}·${DEMAND_LABEL[m.demand]}运动取得让步`,
      body: `利益集团持续施压的${DEMAND_LABEL[m.demand]}诉求迫使朝廷让步，相关政令随之调整。`,
      severity: "warning",
    });
  }
};
