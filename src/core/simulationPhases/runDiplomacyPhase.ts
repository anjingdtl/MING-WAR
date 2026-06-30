/**
 * runDiplomacyPhase — v0.6-stability §3.2 S4
 *
 * 外交月度演变 + 资源危机 + 势力淘汰 + 集团更新。
 * 确定性，不消费 random（仅 applyResourceCrises 调 random，但随机消费点在
 * Phase 5 才会引发新的 S1–S5 资源状态变化，本阶段保持原顺序）。
 *
 * 业务逻辑从原 simulation.ts L353-364 完整迁移。
 */

import { advanceDiplomacy } from "../diplomacy";
import { applyLedgerToState } from "../ledger";
import {
  applyNaturalDecay,
  computeAdministrationModifier,
  computeCliqueApproval,
  computeFactionCliqueStrengthFromPops
} from "../clique";
import { cliqueTemplates } from "../../data/cliques";
import type { PhaseFn } from "../simulationContext";

/**
 * applyResourceCrises — 资源枯竭时军队逃亡/哗变（消费 random）。
 */
function applyResourceCrises(
  state: import("../types").GameState,
  reports: import("../types").MonthlyReport[],
  random: { next: () => number }
): void {
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

function eliminateDefeatedFactions(state: import("../types").GameState, reports: import("../types").MonthlyReport[]): void {
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    if (faction.type === "rebel") continue;
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

function updateFactionCliques(
  state: import("../types").GameState,
  decisionsLookup: Record<string, import("../types").PlayerDecision>
): void {
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    if (!faction.cliques || faction.cliques.length === 0) continue;

    if (faction.administrationBase === undefined || faction.administrationBase === 0) {
      faction.administrationBase = faction.administration;
    }

    const regions = Object.values(state.regions).filter(
      (r) => r.controllerFactionId === faction.id,
    );
    faction.cliques = computeFactionCliqueStrengthFromPops(faction.cliques, regions);
    faction.cliques = applyNaturalDecay(faction.cliques);

    const focus = decisionsLookup[faction.id]?.domesticFocus ?? "recovery";

    for (const cs of faction.cliques) {
      if (cs.support > 60) {
        cs.activeModifier = Math.round(((cs.support - 60) / 40) * (cs.strength / 100) * 5);
      } else if (cs.support < 40) {
        cs.activeModifier = -Math.round(((40 - cs.support) / 40) * (cs.strength / 100) * 5 * 0.8);
      } else {
        cs.activeModifier = 0;
      }
      cs.approval = computeCliqueApproval(
        cs.cliqueId,
        focus,
        regions,
        cliqueTemplates,
        state.activeModifiers,
        faction.id,
      );
    }

    const totalModifier = computeAdministrationModifier(faction.cliques);
    faction.administration = Math.max(0, Math.min(100, faction.administrationBase + totalModifier));
  }
}

export const runDiplomacyPhase: PhaseFn = (ctx) => {
  // S5: 外交月度演变 + 条约财政后果
  const diploEntries = advanceDiplomacy(ctx.state);
  applyLedgerToState(ctx.state, diploEntries);
  ctx.ledgerEntries.push(...diploEntries);

  // 资源危机（消费 random）
  applyResourceCrises(ctx.state, ctx.reports, ctx.random);
  // 势力淘汰
  eliminateDefeatedFactions(ctx.state, ctx.reports);
  // 集团更新
  updateFactionCliques(ctx.state, ctx.decisionsLookup);
};
