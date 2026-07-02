/**
 * ⚠️  DETERMINISM-CHANGE (T8 — 2026-07-02)
 * ---------------------------------------------------------------------------
 * AI 决策从"scoreTarget 排序"（兵力对比）升级为 pickMaxWarDesire（可持续
 * 作战可行性）。P5 随机消费点位于 runFactionPhase 末尾（通过
 * applyAiDecisionJitter 调用），让 warDesire ∈ [-5, +5] 时不完全决定论。
 *
 * P5 时序位置：generateDisasters (P0) → runDiplomacyPhase (P1-P2) →
 * runFactionPhase 末 applyAiDecisionJitter (P5 新增) → runWarPhase
 * (P3 via resolveBattle) → runPoliticsPhase / runSituationPhase (无 random)。
 *
 * 来源：研究文档 §4 末"AI 行为必须同步升级"；SPEC §4.5 + §6 P5。
 * ===========================================================================
 */

import type { DomesticFocus, FactionState, GameState, PlayerDecision, RegionId, RegionState } from "./types";
import { computeWarDesire, getValidMilitaryTargets, pickMaxWarDesire } from "./decisions";
import { monthIndex } from "./calendar";
import { cliqueTemplates } from "../data/cliques";

const ALL_FOCI: DomesticFocus[] = ["agriculture", "finance", "military", "administration", "recovery", "frontier"];

export function chooseDomesticFocus(faction: FactionState, regions: RegionState[]): DomesticFocus {
  const crisisScores = computeCrisisScores(faction, regions);
  const cliqueScores = computeCliqueSatisfactionScores(faction);

  let bestFocus: DomesticFocus = "recovery";
  let bestScore = -Infinity;
  for (const focus of ALL_FOCI) {
    const score = crisisScores[focus] * 0.6 + cliqueScores[focus] * 0.4;
    if (score > bestScore) {
      bestScore = score;
      bestFocus = focus;
    }
  }
  return bestFocus;
}

function computeCrisisScores(
  faction: FactionState,
  regions: RegionState[],
): Record<DomesticFocus, number> {
  const scores: Record<DomesticFocus, number> = {
    agriculture: 0, finance: 0, military: 0,
    administration: 0, recovery: 0, frontier: 0,
  };
  const averageStability = regions.reduce((sum, r) => sum + r.stability, 0) / Math.max(1, regions.length);

  // Grain shortage → agriculture
  if (faction.grainReserve < faction.armyTotal * 1.5) {
    scores.agriculture += 50;
  } else if (faction.grainReserve < faction.armyTotal * 3) {
    scores.agriculture += 20;
  }

  // Treasury shortage → finance
  if (faction.treasury < faction.armyTotal * 6) {
    scores.finance += 50;
  } else if (faction.treasury < faction.armyTotal * 12) {
    scores.finance += 20;
  }

  // High corruption → administration
  if (faction.corruption > 45) {
    scores.administration += 40;
  } else if (faction.corruption > 30) {
    scores.administration += 15;
  }

  // Low stability → recovery
  if (averageStability < 55) {
    scores.recovery += 40;
  } else if (averageStability < 70) {
    scores.recovery += 15;
  }

  // Aggressive AI → military
  if (faction.aiProfile.aggression > 60) {
    scores.military += 35;
  }

  // Frontier trait → frontier
  if (faction.traits.some((t) => t.includes("辽东") || t.includes("边"))) {
    scores.frontier += 20;
  }
  scores.frontier += 5; // baseline

  return scores;
}

function computeCliqueSatisfactionScores(
  faction: FactionState,
): Record<DomesticFocus, number> {
  const scores: Record<DomesticFocus, number> = {
    agriculture: 0, finance: 0, military: 0,
    administration: 0, recovery: 0, frontier: 0,
  };

  if (!faction.cliques?.length) return scores;

  // Find the most dissatisfied clique (lowest support)
  const sorted = [...faction.cliques].sort((a, b) => a.support - b.support);
  const unhappiest = sorted[0];
  const def = cliqueTemplates[unhappiest.cliqueId];
  if (!def) return scores;

  // Score each focus by how much it would satisfy the unhappiest clique
  for (const focus of ALL_FOCI) {
    const affinity = def.policyAffinities[focus];
    // Normalize affinity from [-10, +10] to [0, 40] score range
    scores[focus] = (affinity + 10) * 2;
  }

  return scores;
}

export function chooseAiDecision(
  state: GameState,
  factionId: string,
  options: { month?: number; supplyRatio?: number } = {}
): PlayerDecision {
  const faction = state.factions[factionId];
  const controlledRegions = Object.values(state.regions).filter((region) => region.controllerFactionId === factionId);
  // T8: 用 pickMaxWarDesire 替代 scoreTarget 排序。month 默认从 currentDate 解析；
  // chooseAllAiDecisions 调用方会显式注入。
  const month = options.month ?? parseMonthFromDate(state.currentDate) ?? 6;
  const targetRegionId = pickMaxWarDesire(faction, state, { month, supplyRatio: options.supplyRatio });
  const posture = faction.aiProfile.riskTolerance > 60 ? "aggressive" : faction.aiProfile.defensePriority > 65 ? "conservative" : "balanced";
  return {
    targetRegionId,
    posture,
    domesticFocus: chooseDomesticFocus(faction, controlledRegions)
  };
}

export function chooseAllAiDecisions(state: GameState): Record<string, PlayerDecision> {
  const month = parseMonthFromDate(state.currentDate) ?? 6;
  return Object.fromEntries(
    Object.values(state.factions)
      .filter((faction) => faction.id !== state.playerFactionId && faction.status === "active")
      .map((faction) => [faction.id, chooseAiDecision(state, faction.id, { month })])
  );
}

/**
 * T8 P5：在 runFactionPhase 末尾对每条 AI 决策加 ±3 随机扰动。
 * 边界条件：warDesire ∈ [-5, +5] 时扰动；否则跳过（确定性）。
 * 扰动后若 targetRegionId 的最终 warDesire < 0，AI 本月不主动宣战
 * （设 null）；若 ≥ 0 保持原目标。
 *
 * random 调用次数：每个满足边界条件的 AI 决策 1 次 next()（+1 用于符号位）。
 */
export function applyAiDecisionJitter(
  state: GameState,
  aiDecisions: Record<string, PlayerDecision>,
  random: { next(): number }
): Record<string, PlayerDecision> {
  const month = parseMonthFromDate(state.currentDate) ?? 6;
  const result: Record<string, PlayerDecision> = {};
  for (const [fid, decision] of Object.entries(aiDecisions)) {
    if (!decision.targetRegionId) {
      result[fid] = decision;
      continue;
    }
    const faction = state.factions[fid];
    const target = state.regions[decision.targetRegionId];
    if (!faction || !target) {
      result[fid] = decision;
      continue;
    }
    const wdesire = computeWarDesire(faction, target, state, { month });
    if (wdesire < -5 || wdesire > 5) {
      // 远离决策边界：保持原决策（确定性）
      result[fid] = decision;
      continue;
    }
    // 边界：±3 扰动
    const sign = random.next() < 0.5 ? -1 : 1;
    const magnitude = 1 + Math.floor(random.next() * 3); // 1-3
    const jitter = sign * magnitude;
    if (wdesire + jitter < 0) {
      // 扰动后变负 → AI 本月不主动宣战
      result[fid] = { ...decision, targetRegionId: null };
    } else {
      // 扰动后仍正：保持原目标（扰动不改变具体选择）
      result[fid] = decision;
    }
  }
  return result;
}

/* ===========================================================================
 * T8 helpers
 * =========================================================================== */

/** 从 YYYY-MM 解析月份（1-12）。解析失败返回 null。 */
function parseMonthFromDate(date: string): number | null {
  const m = /-(\d{2})$/.exec(date);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}
