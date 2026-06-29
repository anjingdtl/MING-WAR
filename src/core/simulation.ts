import { chooseAllAiDecisions } from "./ai";
import { advanceMonth, isAfter } from "./calendar";
import { updateControl } from "./control";
import { normalizePlayerDecision } from "./decisions";
import { calculateFactionMaintenance, calculateRegionEconomy } from "./economy";
import { findTriggeredEvents } from "./eventEngine";
import { calculatePopulation } from "./population";
import { createRandom } from "./random";
import { updateRebellion } from "./rebellion";
import { resolveBattle, advanceWar } from "./warfare";
import { applyNaturalDecay, computeAdministrationModifier, computeFactionCliqueStrength } from "./clique";
import { expireModifiers } from "./modifiers";
import { validateInvariants } from "./invariants";
import type { LedgerEntry } from "./ledger";
import {
  advancePopGroups,
  computeGrainPerCapita,
  migrateMigrants,
  sumPopulation
} from "./populationGroups";
import {
  autoInvest,
  produceGoods,
  runTrade,
  summarizeMarkets,
  updateMarketPrices
} from "./market";
import { mvpEvents } from "../data/events";
import type { FactionState, GameState, GoodId, MonthlyReport, PlayerDecision, RegionState, SimulationInput, SimulationResult } from "./types";

export function simulateMonth(input: SimulationInput): SimulationResult {
  const state = structuredClone(input.state);
  const random = createRandom(input.randomSeed);
  const reports: MonthlyReport[] = [];
  const ledgerEntries: LedgerEntry[] = [];
  const playerDecision = normalizePlayerDecision(state, input.playerDecision);
  const aiDecisions = chooseAllAiDecisions(state);

  // P0-3: expire modifiers at month start (decrement remaining, drop expired)
  state.activeModifiers = expireModifiers(state.activeModifiers);

  // Build per-faction decisions lookup so each faction's regions use that faction's own focus
  const decisionsLookup: Record<string, PlayerDecision> = {
    [state.playerFactionId]: playerDecision,
    ...aiDecisions
  };

  for (const region of Object.values(state.regions)) {
    const controller = state.factions[region.controllerFactionId];
    const factionDecision = decisionsLookup[region.controllerFactionId] ?? playerDecision;
    const focus = factionDecision.domesticFocus;
    const population = calculatePopulation(region, focus);
    let nextRegion = { ...region, population: population.nextPopulation };
    const economy = calculateRegionEconomy(nextRegion, controller, focus, state.activeModifiers);
    nextRegion = economy.region;
    nextRegion = updateControl(nextRegion, controller, state.activeModifiers);
    const rebellion = updateRebellion(nextRegion, controller);
    nextRegion = rebellion.region;
    nextRegion = applyRebellionConsequences(nextRegion, controller, reports, state.currentDate, state);
    state.regions[region.id] = nextRegion;
    controller.treasury += economy.treasuryDelta;
    // NOTE: the regional grain delta already updates region.grainStock inside
    // calculateRegionEconomy. We deliberately do NOT also add it to the
    // controller's grainReserve — that double-counted the same grain (grain
    // was effectively spent twice) and violated SPEC §5.2. The central
    // reserve now only shrinks via army maintenance and relief transfers.

    // P2: advance pop groups (employment, needs satisfaction, famine deaths, identity transitions)
    if (nextRegion.popGroups && nextRegion.popGroups.length > 0) {
      // Central granary relief: when folk grain runs low, the controller
      // disburses from its strategic reserve to avert mass famine. This is
      // what makes grainReserve meaningful (SPEC §9.1 中央可调度储备) and
      // prevents every region from collapsing into famine the moment its own
      // stock dips.
      const reliefThreshold = nextRegion.population * 0.12;
      if (nextRegion.grainStock < reliefThreshold && controller.grainReserve > 0) {
        const target = nextRegion.population * 0.25; // ~one month of folk consumption
        const needed = Math.max(0, target - nextRegion.grainStock);
        // Cap each region's monthly draw at 8% of the reserve so a single
        // starving province can't drain the whole empire in one tick.
        const transfer = Math.min(needed, controller.grainReserve * 0.05);
        if (transfer > 0) {
          nextRegion.grainStock += transfer;
          controller.grainReserve = Math.max(0, controller.grainReserve - transfer);
        }
      }
      const grainPerCapita = computeGrainPerCapita(
        nextRegion.grainStock,
        nextRegion.population
      );
      nextRegion.popGroups = advancePopGroups(nextRegion.popGroups, {
        region: nextRegion,
        grainPerCapita,
        taxRate: 0.3
      });
      // Sync total population from groups
      const totalFromGroups = sumPopulation(nextRegion.popGroups);
      nextRegion.population = totalFromGroups;
      // 漕粮上缴：民间粮食充裕时，盈余的一部分上缴中央储备，给中央粮储
      // 一个持续来源（否则赈灾只出不进，储备必然枯竭）。粮食在地区与中央
      // 之间转移，总量守恒，符合 SPEC §9.1 征收流程。
      const grainSurplus = nextRegion.grainStock - nextRegion.population * 0.3;
      if (grainSurplus > 0 && controller.id !== "rebels") {
        const tribute = Math.round(grainSurplus * 0.12);
        if (tribute > 0) {
          nextRegion.grainStock -= tribute;
          controller.grainReserve += tribute;
        }
      }
      state.regions[region.id] = nextRegion;
    }

    // P1: record ledger entries (income from grain & tax, grain consumption)
    if (economy.treasuryDelta !== 0) {
      ledgerEntries.push({
        category: economy.treasuryDelta > 0 ? "income-tax" : "expense-bureaucrat",
        source: `${region.name} 收支`,
        amount: economy.treasuryDelta,
        factionId: controller.id,
        regionId: region.id
      });
    }
    if (economy.grainDelta !== 0) {
      ledgerEntries.push({
        category: economy.grainDelta > 0 ? "grain-production" : "grain-consumption",
        source: `${region.name} 粮食`,
        amount: economy.grainDelta,
        factionId: controller.id,
        regionId: region.id,
        goodId: "grain"
      });
    }

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
    const maintenance = calculateFactionMaintenance(faction, state.activeModifiers);
    // Detect deficit against pre-deduction balance; clamp at 0 after
    // deducting so treasury/grainReserve can never go negative (previously
    // Ming's grain reserve ran to -109M and treasury to -11M).
    const inDeficit = faction.treasury - maintenance.treasuryCost < 0;
    faction.treasury = Math.max(0, faction.treasury - maintenance.treasuryCost);
    faction.grainReserve = Math.max(0, faction.grainReserve - maintenance.grainCost);

    // 和平期征募：财政宽裕且战疲较低时，按控制区人口比例缓慢补充兵员，
    // 避免军队在长期边境消耗中归零（此前 armyTotal 只减不增，30 年模拟
    // 里大明军队从 68 万耗到个位数，国库则因军饷骤降而无限累积）。
    const controlledPop = Object.values(state.regions)
      .filter((r) => r.controllerFactionId === faction.id)
      .reduce((sum, r) => sum + r.population, 0);
    const armyTarget = controlledPop * (faction.type === "tribal" ? 0.02 : 0.01);
    if (
      faction.armyTotal < armyTarget &&
      faction.treasury > maintenance.treasuryCost * 2 &&
      faction.warExhaustion < 40
    ) {
      const recruit = Math.min(Math.round(armyTarget - faction.armyTotal), Math.round(armyTarget * 0.005));
      const recruitCost = Math.round(recruit * 0.5);
      if (recruit > 0 && faction.treasury >= recruitCost) {
        faction.armyTotal += recruit;
        faction.treasury -= recruitCost;
      }
    }
    // P1: record faction maintenance as ledger entries
    if (maintenance.treasuryCost !== 0) {
      ledgerEntries.push({
        category: "expense-bureaucrat",
        source: `${faction.name} 官僚俸禄`,
        amount: -maintenance.treasuryCost,
        factionId: faction.id
      });
    }
    if (maintenance.grainCost !== 0) {
      ledgerEntries.push({
        category: "grain-consumption",
        source: `${faction.name} 粮食储备消耗`,
        amount: -maintenance.grainCost,
        factionId: faction.id,
        goodId: "grain"
      });
    }
    if (inDeficit) {
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

  // A faction that has lost every region is eliminated (rebels excepted — they
  // stand ready to receive new uprisings). Previously Ming could "survive"
  // indefinitely at 0 controlled regions.
  eliminateDefeatedFactions(state, reports);

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
    const battle = resolveBattle(target, attacker, defender, decision.posture, random, state.activeModifiers);
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

  // P0-4: advance ongoing wars (monthsActive++, progress update based on relative strength)
  state.wars = state.wars.map((war) => {
    const attacker = state.factions[war.attackerFactionId];
    const defender = state.factions[war.defenderFactionId];
    const region = state.regions[war.targetRegionId];
    if (!attacker || !defender || !region) return war;
    if (attacker.status !== "active" || defender.status !== "active") return war;
    return advanceWar(war, attacker, defender, region, state.activeModifiers);
  });
  const nextDate = advanceMonth(state.currentDate);
  state.currentDate = nextDate;
  state.seed = random.seed;
  state.reports = [...reports, ...state.reports].slice(0, 300);

  // P1: append monthly ledger to history (keep last 60 months for 12/60 month trends)
  if (!state.ledgerHistory) state.ledgerHistory = [];
  state.ledgerHistory.push({ date: state.currentDate, entries: ledgerEntries });
  if (state.ledgerHistory.length > 60) {
    state.ledgerHistory = state.ledgerHistory.slice(-60);
  }

  // P2: migrants migrate to connected regions
  for (const region of Object.values(state.regions)) {
    if (region.popGroups?.some((g) => g.type === "migrant")) {
      migrateMigrants(state, region.id);
    }
  }

  // P3: produce goods, run inter-regional trade, update market prices, auto-invest
  const marketsByRegion: Record<string, import("./market").MarketState> = {};
  const industriesByRegion: Record<string, import("./types").IndustryState[]> = {};
  for (const region of Object.values(state.regions)) {
    if (!region.market) continue;
    // Reset this month's supply/demand snapshot. Previously supply only ever
    // accumulated (never reset) and demand stayed at 0, so adjustPrice() hit
    // its `demand === 0` early-return every tick and prices stayed frozen at
    // base — the entire P3 market was inert (batch showed grainPrice=1.00 and
    // silverStock=1000 forever).
    for (const good of Object.keys(region.market.supply) as GoodId[]) {
      region.market.supply[good] = 0;
      region.market.demand[good] = 0;
      region.market.imports[good] = 0;
      region.market.exports[good] = 0;
    }
    marketsByRegion[region.id] = region.market;
    industriesByRegion[region.id] = region.industries ?? [];
    if (region.industries) {
      produceGoods(region.industries, region.market, region, region.activeDisasters ?? []);
    }
    // Inject market consumption demand so prices respond to scarcity. The
    // coefficient is small because folk food is already settled by the
    // economy module against region.grainStock — this demand represents the
    // *market-traded* share, scaled to match industry output magnitude so
    // supply/demand ratios stay near 1.0 (and prices stay bounded).
    region.market.demand.grain = region.population * 0.00003;
    region.market.demand.cloth = region.population * 0.00002;
    region.market.demand.salt = region.population * 0.00001;
  }
  runTrade(state, marketsByRegion);
  updateMarketPrices(marketsByRegion);
  autoInvest(marketsByRegion, industriesByRegion);

  // P0-5: validate state invariants and append violations as system reports
  const violations = validateInvariants(state);
  for (const v of violations) {
    if (v.severity === "error") {
      reports.push({
        id: `${state.currentDate}-invariant-${v.id}`,
        date: state.currentDate,
        type: "system",
        title: `状态不变量违反：${v.id}`,
        body: v.message,
        severity: "danger"
      });
    }
  }

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
  const playerEliminated = state.factions[state.playerFactionId]?.status === "collapsed";
  state.gameStatus =
    isAfter(nextDate, state.endDate) || playerEliminated
      ? "finished"
      : triggered.length > 0
        ? "paused"
        : "playing";
  state.lastDomesticFocus = playerDecision.domesticFocus;

  return {
    nextState: state,
    reports,
    triggeredEvents: triggered.map((event) => ({ eventId: event.id, optionRequired: true })),
    alerts: state.alerts
  };
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

function eliminateDefeatedFactions(state: GameState, reports: MonthlyReport[]): void {
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    if (faction.type === "rebel") continue; // 义军始终可接收新起义地区
    const hasRegion = Object.values(state.regions).some(
      (r) => r.controllerFactionId === faction.id
    );
    if (!hasRegion) {
      faction.status = "collapsed";
      reports.push({
        id: `${state.currentDate}-${faction.id}-eliminated`,
        date: state.currentDate,
        type: "system",
        title: `${faction.name}覆灭`,
        body: `${faction.name}已丧失全部领土，政权宣告终结。`,
        severity: "danger"
      });
    }
  }
}

function updateFactionCliques(state: GameState): void {
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    if (!faction.cliques || faction.cliques.length === 0) continue;

    // 1. Initialize administrationBase from current administration if not set
    //    (avoids compound growth by keeping base stable after first run)
    if (faction.administrationBase === undefined || faction.administrationBase === 0) {
      faction.administrationBase = faction.administration;
    }

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

    // 5. Apply total modifier to administration based on stable base
    const totalModifier = computeAdministrationModifier(faction.cliques);
    faction.administration = Math.max(0, Math.min(100, faction.administrationBase + totalModifier));
  }
}