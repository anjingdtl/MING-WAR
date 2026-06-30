/**
 * runRegionPhase — v0.6-stability §3.2 S2
 *
 * 地区循环：pop/经济/控制/叛乱/市场/人口/账本/漕粮。
 * 这是单月最重的阶段，预期占总耗时 > 50%。
 *
 * 业务逻辑从原 simulation.ts L64-258 完整迁移，**不改** random 消费顺序、
 * **不改** state 写入顺序、**不改** applyLedgerToState 调用顺序。
 */

import { applyDisasterEffects, generateDisasters } from "../disaster";
import { calculateRegionEconomy } from "../economy";
import { updateControl } from "../control";
import { updateRebellion } from "../rebellion";
import { applyLedgerToState, type LedgerEntry } from "../ledger";
import { calculatePopulation } from "../population";
import { expireModifiers } from "../modifiers";
import {
  advancePopGroups,
  computeGrainPerCapita,
  sumPopulation
} from "../populationGroups";
import {
  BASE_PRICES,
  consumePopNeeds,
  INDUSTRY_OWNERSHIP_TO_POP,
  INDUSTRY_TEMPLATES,
  produceGoods
} from "../market";
import type { GoodId, MonthlyReport, RegionState } from "../types";
import { applyRebellionConsequences } from "./helpers";
import type { PhaseFn, SimulationContext } from "../simulationContext";

export const runRegionPhase: PhaseFn = (ctx) => {
  // 月初：先 expire modifiers（这里属于月初准备，按 S1 顺序放最前）
  ctx.state.activeModifiers = expireModifiers(ctx.state.activeModifiers);
  // 生成当月灾害（会消费 random）
  generateDisasters(ctx.state.regions, ctx.random, ctx.state.currentDate);

  for (const region of Object.values(ctx.state.regions)) {
    const controller = ctx.state.factions[region.controllerFactionId];
    const factionDecision = ctx.decisionsLookup[region.controllerFactionId] ?? ctx.playerDecision;
    const focus = factionDecision.domesticFocus;
    const population = calculatePopulation(region, focus);
    let nextRegion: RegionState = { ...region, population: population.nextPopulation };
    // 应用灾害效果（稳定度/驻军/人口损失）
    nextRegion = applyDisasterEffects(nextRegion);
    const economy = calculateRegionEconomy(nextRegion, controller, focus, ctx.state.activeModifiers);
    nextRegion = economy.region;
    nextRegion = updateControl(nextRegion, controller, ctx.state.activeModifiers);
    const rebellion = updateRebellion(nextRegion, controller);
    nextRegion = rebellion.region;
    nextRegion = applyRebellionConsequences(nextRegion, controller, ctx.reports, ctx.state.currentDate, ctx.state);
    ctx.state.regions[region.id] = nextRegion;

    // S1c: 地区经济走账本
    const econEntries: LedgerEntry[] = [];
    if (economy.grainProduced > 0) {
      econEntries.push({
        category: "grain-production",
        source: `${region.name} 农业产出`,
        amount: economy.grainProduced,
        regionId: region.id,
        goodId: "grain"
      });
    }
    if (economy.grainConsumed > 0) {
      econEntries.push({
        category: "grain-consumption",
        source: `${region.name} 口粮消费`,
        amount: -economy.grainConsumed,
        regionId: region.id,
        goodId: "grain"
      });
    }
    if (economy.treasuryDelta !== 0) {
      econEntries.push({
        category: economy.treasuryDelta > 0 ? "income-tax" : "expense-bureaucrat",
        source: `${region.name} 田赋`,
        amount: economy.treasuryDelta,
        factionId: controller.id,
        regionId: region.id
      });
    }
    applyLedgerToState(ctx.state, econEntries);
    ctx.ledgerEntries.push(...econEntries);

    // S2a: 统一商品流（产业 + 农业 → 市场供给，pop → 需求）
    if (nextRegion.market) {
      for (const good of Object.keys(nextRegion.market.supply) as GoodId[]) {
        nextRegion.market.supply[good] = 0;
        nextRegion.market.demand[good] = 0;
        nextRegion.market.imports[good] = 0;
        nextRegion.market.exports[good] = 0;
      }
      const prodResult = nextRegion.industries
        ? produceGoods(nextRegion.industries, nextRegion.market, nextRegion, nextRegion.activeDisasters ?? [])
        : null;
      if (economy.grainProduced > 0) {
        nextRegion.market.supply.grain += economy.grainProduced;
      }
      if (nextRegion.popGroups && nextRegion.popGroups.length > 0) {
        consumePopNeeds(nextRegion.popGroups, nextRegion.market);
      }
      const garrisonGrain = nextRegion.garrison * 0.1;
      if (garrisonGrain > 0) {
        nextRegion.market.demand.grain += garrisonGrain;
      }
      // S2c: 产业利润按 ownership 流向 pop
      if (prodResult && nextRegion.popGroups) {
        for (const r of prodResult.results) {
          const ind = nextRegion.industries?.find((i) => i.id === r.industryId);
          if (!ind) continue;
          const tpl = INDUSTRY_TEMPLATES[ind.type];
          if (!tpl) continue;
          const prices = nextRegion.market.prices;
          const outPrice = prices[tpl.output] ?? BASE_PRICES[tpl.output];
          const revenue = r.actualOutput * outPrice;
          const inputCost = Object.entries(tpl.inputs).reduce(
            (s, [g, q]) => s + (q as number) * ind.level * (prices[g as GoodId] ?? BASE_PRICES[g as GoodId]),
            0
          );
          const profit = revenue - inputCost;
          if (profit <= 0) continue;
          const ownerType = INDUSTRY_OWNERSHIP_TO_POP[ind.ownership];
          if (!ownerType) continue;
          const owners = nextRegion.popGroups.find((g) => g.type === ownerType);
          if (owners && owners.size > 0) {
            owners.wealth = Math.round((owners.wealth + profit / owners.size) * 100) / 100;
          }
        }
      }
    }

    // P2: advance pop groups
    if (nextRegion.popGroups && nextRegion.popGroups.length > 0) {
      const reliefThreshold = nextRegion.population * 0.12;
      if (nextRegion.grainStock < reliefThreshold && controller.grainReserve > 0) {
        const target = nextRegion.population * 0.25;
        const needed = Math.max(0, target - nextRegion.grainStock);
        const transfer = Math.min(needed, controller.grainReserve * 0.05);
        if (transfer > 0) {
          const reliefEntries: LedgerEntry[] = [
            { category: "grain-relief", source: `${region.name} 赈灾支取`, amount: -transfer, factionId: controller.id, goodId: "grain" },
            { category: "grain-relief", source: `${region.name} 赈灾到户`, amount: transfer, regionId: region.id, goodId: "grain" }
          ];
          applyLedgerToState(ctx.state, reliefEntries);
          ctx.ledgerEntries.push(...reliefEntries);
        }
      }
      const grainPerCapita = computeGrainPerCapita(
        nextRegion.grainStock,
        nextRegion.population
      );
      nextRegion.popGroups = advancePopGroups(nextRegion.popGroups, {
        region: nextRegion,
        grainPerCapita,
        taxRate: 0.3,
        marketPrices: nextRegion.market?.prices
      });
      const totalFromGroups = sumPopulation(nextRegion.popGroups);
      nextRegion.population = totalFromGroups;
      // 漕粮上缴
      const grainSurplus = nextRegion.grainStock - nextRegion.population * 0.3;
      if (grainSurplus > 0 && controller.id !== "rebels") {
        const tribute = Math.round(grainSurplus * 0.12);
        if (tribute > 0) {
          const tributeEntries: LedgerEntry[] = [
            { category: "grain-tribute", source: `${region.name} 漕粮上缴`, amount: -tribute, regionId: region.id, goodId: "grain" },
            { category: "grain-tribute", source: `${controller.name} 漕粮入储`, amount: tribute, factionId: controller.id, goodId: "grain" }
          ];
          applyLedgerToState(ctx.state, tributeEntries);
          ctx.ledgerEntries.push(...tributeEntries);
        }
      }
      ctx.state.regions[region.id] = nextRegion;
    }

    if (population.deaths > 0 || population.migrants > 0) {
      ctx.reports.push({
        id: `${ctx.state.currentDate}-${region.id}-population`,
        date: ctx.state.currentDate,
        type: "economy",
        title: `${region.name}人口波动`,
        body: `增长${population.growth}，死亡${population.deaths}，外迁${population.migrants}。`,
        severity: population.deaths > population.growth ? "warning" : "info"
      });
    }

    if (rebellion.report) {
      ctx.reports.push({
        id: `${ctx.state.currentDate}-${region.id}-rebellion`,
        date: ctx.state.currentDate,
        type: "rebellion",
        title: `${region.name}叛乱扩大`,
        body: rebellion.report,
        severity: "danger"
      });
    }
  }
};

// MonthlyReport re-exported for callers; keep types referenced.
export type { MonthlyReport };
