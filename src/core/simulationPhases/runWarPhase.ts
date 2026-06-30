/**
 * runWarPhase — v0.6-stability §3.2 S6
 *
 * 战斗 + 战线推进 + 和平谈判。
 * 业务逻辑从原 simulation.ts L437-535 完整迁移。
 * resolveBattle 消费 random（首月遭遇战），保持原顺序不变。
 */

import { advanceWar, alliesJoinWar, resolveBattle } from "../warfare";
import { checkPeace, computeWarSupport, resolvePeace } from "../peace";
import { applyLedgerToState, type LedgerEntry } from "../ledger";
import { findTriggeredEvents } from "../eventEngine";
import { mvpEvents } from "../../data/events";
import type { WarState } from "../types";
import type { PhaseFn } from "../simulationContext";

export const runWarPhase: PhaseFn = (ctx) => {
  // 玩家与 AI 当月决策
  const decisions: Record<string, import("../types").PlayerDecision> = {
    [ctx.state.playerFactionId]: ctx.playerDecision,
    ...ctx.aiDecisions
  };

  // 战斗（resolveBattle 消费 random）
  for (const [factionId, decision] of Object.entries(decisions)) {
    if (!decision.targetRegionId) continue;
    const attacker = ctx.state.factions[factionId];
    const target = ctx.state.regions[decision.targetRegionId];
    const defender = ctx.state.factions[target.controllerFactionId];
    if (!attacker || !defender || attacker.id === defender.id) continue;
    const battle = resolveBattle(target, attacker, defender, decision.posture, ctx.random, ctx.state.activeModifiers);
    ctx.state.regions[target.id] = battle.region;
    ctx.state.factions[attacker.id] = battle.attacker;
    ctx.state.factions[defender.id] = battle.defender;
    ctx.reports.push({
      id: `${ctx.state.currentDate}-${attacker.id}-${target.id}-battle`,
      date: ctx.state.currentDate,
      type: "war",
      title: `${attacker.name}进攻${target.name}`,
      body: battle.report,
      severity: battle.region.controllerFactionId === attacker.id ? "danger" : "info"
    });
    if (battle.war) {
      ctx.state.wars = ctx.state.wars.filter((war) => war.id !== battle.war?.id).concat(battle.war);
      // S5 遗留#2：同盟参战
      ctx.state.wars.push(...alliesJoinWar(ctx.state, attacker.id, defender.id));
    }
  }

  // 事件检测（不消费 random）
  const triggered = findTriggeredEvents(ctx.state, mvpEvents).slice(0, 1);
  for (const e of triggered) ctx.triggeredEventIds.push(e.id);

  // 战线推进 + 持续消耗
  const survivingWars: WarState[] = [];
  for (const war of ctx.state.wars) {
    const attacker = ctx.state.factions[war.attackerFactionId];
    const defender = ctx.state.factions[war.defenderFactionId];
    const region = ctx.state.regions[war.targetRegionId];
    if (!attacker || !defender || !region || attacker.status !== "active" || defender.status !== "active") {
      survivingWars.push(war);
      continue;
    }
    const r = advanceWar(war, attacker, defender, region, ctx.state.activeModifiers);
    attacker.armyTotal = Math.max(0, attacker.armyTotal - r.attackerLosses);
    defender.armyTotal = Math.max(0, defender.armyTotal - r.defenderLosses);
    attacker.warExhaustion = Math.min(100, attacker.warExhaustion + r.attackerExhaustionDelta);
    defender.warExhaustion = Math.min(100, defender.warExhaustion + r.defenderExhaustionDelta);
    const warEntries: LedgerEntry[] = [
      { category: "expense-army-pay", source: `${attacker.name} 战地军费`, amount: -r.attackerSilverCost, factionId: attacker.id },
      { category: "expense-army-pay", source: `${defender.name} 战地军费`, amount: -r.defenderSilverCost, factionId: defender.id },
      { category: "grain-consumption", source: `${attacker.name} 战地军粮`, amount: -r.attackerGrainCost, factionId: attacker.id, goodId: "grain" },
      { category: "grain-consumption", source: `${defender.name} 战地军粮`, amount: -r.defenderGrainCost, factionId: defender.id, goodId: "grain" }
    ];
    applyLedgerToState(ctx.state, warEntries);
    ctx.ledgerEntries.push(...warEntries);
    if (r.war.front) {
      r.war.front.attackerWarSupport = computeWarSupport(ctx.state, r.war, attacker.id);
      r.war.front.defenderWarSupport = computeWarSupport(ctx.state, r.war, defender.id);
    }
    survivingWars.push(r.war);
  }
  ctx.state.wars = survivingWars;

  // 和平谈判
  const warsAfterAdvance = ctx.state.wars;
  ctx.state.wars = [];
  for (const war of warsAfterAdvance) {
    const peace = checkPeace(ctx.state, war);
    if (!peace) {
      ctx.state.wars.push(war);
      continue;
    }
    const peaceEntries = resolvePeace(ctx.state, peace);
    applyLedgerToState(ctx.state, peaceEntries);
    ctx.ledgerEntries.push(...peaceEntries);
    const winner = ctx.state.factions[peace.winnerId];
    const loser = ctx.state.factions[peace.loserId];
    const reasonText =
      peace.reason === "total-victory" ? "完胜"
      : peace.reason === "exhaustion" ? "双方疲惫媾和" : "战败求和";
    const terms: string[] = [];
    if (peace.cedeRegions.length > 0) terms.push(`割让${peace.cedeRegions.length}地`);
    if (peace.indemnity > 0) terms.push("赔款");
    if (peace.tribute) terms.push("纳贡");
    terms.push(`停战${peace.truceMonths}月`);
    ctx.reports.push({
      id: `${ctx.state.currentDate}-${peace.warId}-peace`,
      date: ctx.state.currentDate,
      type: "war",
      title: `${winner.name}与${loser.name}议和`,
      body: `${reasonText}：${terms.join("、")}。`,
      severity: "info",
    });
  }
};
