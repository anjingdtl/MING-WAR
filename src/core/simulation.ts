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
import { applyNaturalDecay, computeAdministrationModifier, computeFactionCliqueStrength } from "./clique";
import { mvpEvents } from "../data/events";
import type { FactionState, GameState, MonthlyReport, PlayerDecision, RegionState, SimulationInput, SimulationResult } from "./types";

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
    nextRegion = applyRebellionConsequences(nextRegion, controller, reports, state.currentDate, state);
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

  applyResourceCrises(state, reports, random);

  updateFactionCliques(state);

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
  state.lastDomesticFocus = playerDecision.domesticFocus;

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

function applyRebellionConsequences(
  region: RegionState,
  controller: FactionState,
  reports: MonthlyReport[],
  currentDate: string,
  state: GameState
): RegionState {
  if (region.rebelPressure < 75) return region;

  let next = { ...region };
  if (next.control > 30) {
    next.control = Math.max(15, next.control - 18);
    next.stability = Math.max(0, next.stability - 8);
    next.garrison = Math.max(1000, Math.round(next.garrison * 0.88));
  } else if (next.control <= 20 && controller.id !== "rebels") {
    next = handRegionToRebels(next, controller, reports, currentDate, state);
  }

  return next;
}

function handRegionToRebels(
  region: RegionState,
  controller: FactionState,
  reports: MonthlyReport[],
  currentDate: string,
  state: GameState
): RegionState {
  reports.push({
    id: `${currentDate}-${region.id}-rebel-takeover`,
    date: currentDate,
    type: "rebellion",
    title: `${region.name}民众起义`,
    body: `${region.name}控制瓦解，当地民众武装驱逐官府，宣布自立。`,
    severity: "danger"
  });
  const rebelGarrison = Math.max(2000, Math.round(region.garrison * 0.35));
  state.factions.rebels.armyTotal += rebelGarrison;
  controller.armyTotal = Math.max(0, controller.armyTotal - rebelGarrison);
  return {
    ...region,
    controllerFactionId: "rebels",
    control: Math.min(40, region.control + 12),
    stability: Math.min(50, region.stability + 6),
    garrison: rebelGarrison,
    rebelPressure: Math.max(0, region.rebelPressure - 35)
  };
}

function applyResourceCrises(state: GameState, reports: MonthlyReport[], random: { next: () => number }) {
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;

    const grainCrisis = faction.grainReserve <= 0;
    const treasuryCrisis = faction.treasury <= 0;
    if (!grainCrisis && !treasuryCrisis) continue;

    const controlledRegions = Object.values(state.regions).filter((region) => region.controllerFactionId === faction.id);

    if (grainCrisis) {
      const desertionRate = 0.025 + random.next() * 0.015;
      const deserters = Math.round(faction.armyTotal * desertionRate);
      faction.armyTotal = Math.max(0, faction.armyTotal - deserters);
      faction.warExhaustion = Math.min(100, faction.warExhaustion + 3);
      faction.legitimacy = Math.max(0, faction.legitimacy - 1);

      for (const region of controlledRegions) {
        region.garrison = Math.max(1000, Math.round(region.garrison * 0.97));
        region.stability = Math.max(0, region.stability - 1);
        if (region.grainStock < region.population * 0.06) {
          region.rebelPressure = Math.min(100, region.rebelPressure + 6);
          region.population = Math.max(1000, Math.round(region.population * 0.992));
        }
      }

      reports.push({
        id: `${state.currentDate}-${faction.id}-grain-crisis`,
        date: state.currentDate,
        type: "economy",
        title: `${faction.name}粮尽军散`,
        body: `粮食储备枯竭，${deserters.toLocaleString()}名士兵逃亡，民间叛乱风险急剧上升。`,
        severity: "danger"
      });
    }

    if (treasuryCrisis) {
      const mutinyRate = 0.012 + random.next() * 0.01;
      const mutineers = Math.round(faction.armyTotal * mutinyRate);
      faction.armyTotal = Math.max(0, faction.armyTotal - mutineers);
      faction.centralization = Math.max(0, faction.centralization - 1);
      faction.legitimacy = Math.max(0, faction.legitimacy - 1);

      for (const region of controlledRegions) {
        region.garrison = Math.max(1000, Math.round(region.garrison * 0.985));
        region.stability = Math.max(0, region.stability - 1);
      }

      reports.push({
        id: `${state.currentDate}-${faction.id}-treasury-crisis`,
        date: state.currentDate,
        type: "economy",
        title: `${faction.name}财政破产`,
        body: `国库空虚，军饷无着，${mutineers.toLocaleString()}名士兵哗变或溃散。`,
        severity: "danger"
      });
    }
  }
}

function updateFactionCliques(state: GameState): void {
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    if (!faction.cliques || faction.cliques.length === 0) continue;

    // 1. Save original administration value
    faction.administrationBase = faction.administration;

    // 2. Recompute clique strength from controlled regions
    const regions = Object.values(state.regions).filter(
      (r) => r.controllerFactionId === faction.id,
    );
    faction.cliques = computeFactionCliqueStrength(faction.cliques, regions);

    // 3. Apply natural decay toward 50
    faction.cliques = applyNaturalDecay(faction.cliques);

    // 4. Recompute activeModifier for each clique
    for (const cs of faction.cliques) {
      if (cs.support > 60) {
        cs.activeModifier = Math.round(((cs.support - 60) / 40) * (cs.strength / 100) * 5);
      } else if (cs.support < 40) {
        cs.activeModifier = -Math.round(((40 - cs.support) / 40) * (cs.strength / 100) * 5 * 0.8);
      } else {
        cs.activeModifier = 0;
      }
    }

    // 5. Sum modifiers and apply to administration
    const totalModifier = computeAdministrationModifier(faction.cliques);
    faction.administration = Math.max(0, Math.min(100, faction.administrationBase + totalModifier));
  }
}