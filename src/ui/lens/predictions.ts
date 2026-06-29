/**
 * 决策预测 — Phase 4
 *
 * 借鉴 V3 "切换政策前显示后果"的设计,以及已有的 FocusTooltip 派系反应预测。
 * 这里做的是宏观收支预估和军略胜率简化版。
 *
 * 注意:不动 core/ 下的模拟逻辑,所有计算都是基于当前 state 的"趋势外推"。
 */

import type { FactionState, GameState, PlayerDecision } from "../../core/types";
import { cliqueTemplates } from "../../data/cliques";
import { computeAdministrationModifier, computeCliqueReactions } from "../../core/clique";

/* --- 内政重点的下月财政预估 --- */
export interface FinancialProjection {
  taxIncome: number;
  militaryCost: number;
  netFlow: number;
  focus: PlayerDecision["domesticFocus"];
}

const FOCUS_TAX_BONUS: Record<PlayerDecision["domesticFocus"], number> = {
  agriculture: -50,
  finance: 100,
  military: -30,
  administration: -20,
  recovery: -10,
  frontier: 0
};

const FOCUS_GRAIN_BONUS: Record<PlayerDecision["domesticFocus"], number> = {
  agriculture: 200,
  finance: 0,
  military: -50,
  administration: 0,
  recovery: 100,
  frontier: -100
};

export function projectFinancials(
  state: GameState,
  decision: PlayerDecision
): FinancialProjection {
  const faction = state.factions[state.playerFactionId];
  if (!faction) {
    return { taxIncome: 0, militaryCost: 0, netFlow: 0, focus: decision.domesticFocus };
  }
  const baseTax = state.regions
    ? Object.values(state.regions)
        .filter((r) => state.factions[r.controllerFactionId]?.id === state.playerFactionId)
        .reduce((sum, r) => sum + r.taxCapacity, 0)
    : 0;
  const focusBonus = FOCUS_TAX_BONUS[decision.domesticFocus] ?? 0;
  const taxIncome = Math.max(0, Math.round(baseTax * 10 + focusBonus));

  const militaryCost = Math.round(faction.armyTotal * 0.5);

  return {
    taxIncome,
    militaryCost,
    netFlow: taxIncome - militaryCost,
    focus: decision.domesticFocus
  };
}

export function projectGrainChange(
  state: GameState,
  decision: PlayerDecision
): number {
  const faction = state.factions[state.playerFactionId];
  if (!faction) return 0;
  const baseGrain = state.regions
    ? Object.values(state.regions)
        .filter((r) => state.factions[r.controllerFactionId]?.id === state.playerFactionId)
        .reduce((sum, r) => sum + r.agriculture * 10, 0)
    : 0;
  return Math.round(baseGrain + (FOCUS_GRAIN_BONUS[decision.domesticFocus] ?? 0) - faction.armyTotal * 0.3);
}

/* --- 军略目标胜率简化版 --- */
export interface CampaignProjection {
  targetRegionId: string;
  targetName: string;
  winChance: number; // 0-1
  estimatedMonths: number;
  reasoning: string;
}

export function projectCampaign(
  state: GameState,
  decision: PlayerDecision
): CampaignProjection | null {
  if (!decision.targetRegionId) return null;
  const target = state.regions[decision.targetRegionId];
  if (!target) return null;
  const player = state.factions[state.playerFactionId];
  const defender = state.factions[target.controllerFactionId];
  if (!player || !defender) return null;

  // 简化: 胜率 = 玩家军力 / (玩家军力 + 守军 × 防御系数)
  const fortBonus = 1 + target.fortification * 0.03;
  const defenderStrength = target.garrison * fortBonus;
  const total = player.armyTotal + defenderStrength;
  const winChance = total > 0 ? player.armyTotal / total : 0.5;
  const postureMod =
    decision.posture === "aggressive" ? 1.15 : decision.posture === "conservative" ? 0.85 : 1;
  const adjustedChance = Math.min(0.95, Math.max(0.05, winChance * postureMod));

  const months = Math.max(2, Math.round((defenderStrength / Math.max(1, player.armyTotal)) * 6));

  return {
    targetRegionId: target.id,
    targetName: target.name,
    winChance: adjustedChance,
    estimatedMonths: months,
    reasoning:
      `攻方 ${Math.round(player.armyTotal / 1000)}千 vs 守方 ${Math.round(target.garrison / 1000)}千` +
      ` 防御系数 ${fortBonus.toFixed(2)}`
  };
}

/* --- 派系反应预测(从 FocusTooltip 提取出来,这里复算) --- */
export interface CliquePrediction {
  cliques: { id: string; delta: number; newSupport: number }[];
  adminModifierDelta: number;
  focus: PlayerDecision["domesticFocus"];
}

export function projectCliqueReactions(
  faction: FactionState,
  decision: PlayerDecision
): CliquePrediction {
  const currentFocus = decision.domesticFocus;
  if (!faction.cliques?.length) {
    return { cliques: [], adminModifierDelta: 0, focus: currentFocus };
  }
  const reactions = computeCliqueReactions(
    currentFocus,
    currentFocus,
    faction.cliques,
    cliqueTemplates
  );
  const projectedCliques = faction.cliques.map((cs) => {
    const reaction = reactions.find((r) => r.cliqueId === cs.cliqueId);
    const newSupport = Math.max(0, Math.min(100, cs.support + (reaction?.delta ?? 0)));
    return {
      id: cs.cliqueId,
      delta: reaction?.delta ?? 0,
      newSupport
    };
  });
  const projectedModifier = computeAdministrationModifier(
    projectedCliques.map((pc) => ({
      cliqueId: pc.id,
      support: pc.newSupport,
      strength: 1,
      activeModifier: 0,
      approval: 50
    }))
  );
  const currentModifier = computeAdministrationModifier(faction.cliques);
  return {
    cliques: projectedCliques,
    adminModifierDelta: projectedModifier - currentModifier,
    focus: currentFocus
  };
}
