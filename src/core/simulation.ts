import { chooseAllAiDecisions } from "./ai";
import { advanceMonth, isAfter } from "./calendar";
import { updateControl } from "./control";
import { normalizePlayerDecision } from "./decisions";
import { calculateFactionMaintenance, calculateRegionEconomy } from "./economy";
import { findTriggeredEvents } from "./eventEngine";
import { calculatePopulation } from "./population";
import { createRandom } from "./random";
import { updateRebellion } from "./rebellion";
import { resolveBattle } from "./warfare";
import { mvpEvents } from "../data/events";
import type { FactionState, GameState, MonthlyReport, PlayerDecision, SimulationInput, SimulationResult } from "./types";

export function simulateMonth(input: SimulationInput): SimulationResult {
  const state = structuredClone(input.state);
  const random = createRandom(input.randomSeed);
  const reports: MonthlyReport[] = [];
  const playerDecision = normalizePlayerDecision(state, input.playerDecision);
  const aiDecisions = chooseAllAiDecisions(state);

  for (const region of Object.values(state.regions)) {
    const controller = state.factions[region.controllerFactionId];
    const population = calculatePopulation(region, playerDecision.domesticFocus);
    let nextRegion = { ...region, population: population.nextPopulation };
    const economy = calculateRegionEconomy(nextRegion, controller, focusForFaction(controller, state, playerDecision, aiDecisions));
    nextRegion = economy.region;
    nextRegion = updateControl(nextRegion, controller);
    const rebellion = updateRebellion(nextRegion, controller);
    nextRegion = rebellion.region;
    state.regions[region.id] = nextRegion;
    controller.treasury += economy.treasuryDelta;
    controller.grainReserve += economy.grainDelta;

    if (population.deaths > 0 || population.migrants > 0) {
      reports.push({
        id: `${state.currentDate}-${region.id}-population`,
        date: state.currentDate,
        type: "economy",
        title: `${region.name}人口波动`,
        body: `增长${population.growth}，死亡${population.deaths}，外迁${population.migrants}。`,
        severity: population.deaths > population.growth ? "warning" : "info"
      });
    }

    if (rebellion.report) {
      reports.push({
        id: `${state.currentDate}-${region.id}-rebellion`,
        date: state.currentDate,
        type: "rebellion",
        title: `${region.name}叛乱扩大`,
        body: rebellion.report,
        severity: "danger"
      });
    }
  }

  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    const maintenance = calculateFactionMaintenance(faction);
    faction.treasury -= maintenance.treasuryCost;
    faction.grainReserve -= maintenance.grainCost;
    if (faction.treasury < 0) {
      faction.warExhaustion = Math.min(100, faction.warExhaustion + 4);
      reports.push({
        id: `${state.currentDate}-${faction.id}-deficit`,
        date: state.currentDate,
        type: "economy",
        title: `${faction.name}财政赤字`,
        body: "军费与官僚维护超过收入，战争疲劳上升。",
        severity: "warning"
      });
    }
  }

  const decisions: Record<string, PlayerDecision> = {
    [state.playerFactionId]: playerDecision,
    ...aiDecisions
  };

  for (const [factionId, decision] of Object.entries(decisions)) {
    if (!decision.targetRegionId) continue;
    const attacker = state.factions[factionId];
    const target = state.regions[decision.targetRegionId];
    const defender = state.factions[target.controllerFactionId];
    if (!attacker || !defender || attacker.id === defender.id) continue;
    const battle = resolveBattle(target, attacker, defender, decision.posture, random);
    state.regions[target.id] = battle.region;
    state.factions[attacker.id] = battle.attacker;
    state.factions[defender.id] = battle.defender;
    reports.push({
      id: `${state.currentDate}-${attacker.id}-${target.id}-battle`,
      date: state.currentDate,
      type: "war",
      title: `${attacker.name}进攻${target.name}`,
      body: battle.report,
      severity: battle.region.controllerFactionId === attacker.id ? "danger" : "info"
    });
    if (battle.war) {
      state.wars = state.wars.filter((war) => war.id !== battle.war?.id).concat(battle.war);
    }
  }

  const triggered = findTriggeredEvents(state, mvpEvents).slice(0, 1);
  const nextDate = advanceMonth(state.currentDate);
  state.currentDate = nextDate;
  state.seed = random.seed;
  state.reports = [...reports, ...state.reports].slice(0, 300);
  state.history.push({
    date: nextDate,
    summary: `${nextDate} 月度结算完成。`,
    factionCount: Object.values(state.factions).filter((faction) => faction.status === "active").length,
    controlledRegions: countControlledRegions(state)
  });
  state.alerts = triggered.map((event) => ({
    id: `alert-${event.id}`,
    title: event.name,
    body: event.description,
    severity: "warning"
  }));
  state.gameStatus = isAfter(nextDate, state.endDate) ? "finished" : triggered.length > 0 ? "paused" : "playing";

  return {
    nextState: state,
    reports,
    triggeredEvents: triggered.map((event) => ({ eventId: event.id, optionRequired: true })),
    alerts: state.alerts
  };
}

function focusForFaction(
  faction: FactionState,
  state: GameState,
  playerDecision: PlayerDecision,
  aiDecisions: Record<string, PlayerDecision>
) {
  return faction.id === state.playerFactionId
    ? playerDecision.domesticFocus
    : aiDecisions[faction.id]?.domesticFocus ?? "recovery";
}

function countControlledRegions(state: GameState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const region of Object.values(state.regions)) {
    counts[region.controllerFactionId] = (counts[region.controllerFactionId] ?? 0) + 1;
  }
  return counts;
}
