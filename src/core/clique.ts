import type {
  FactionCliqueId,
  FactionCliqueState,
  CliqueDef,
  CliqueReaction,
  RegionState,
  DomesticFocus,
} from "./types";

interface CliqueWeight {
  cliqueId: FactionCliqueId;
  weight: number;
}

/**
 * Compute clique weights for a single region based on its economic/social attributes.
 * Rules:
 *   commerce > 70 → donglin weight
 *   taxCapacity > 70 → eunuchs weight
 *   agriculture > 70 → gentry weight
 *   fortification > 60 → generals weight
 */
export function computeRegionCliqueWeights(region: RegionState): CliqueWeight[] {
  const donglinWeight = region.commerce > 70 ? Math.min((region.commerce - 70) * 2 + 8, 20) : 0;
  const eunuchsWeight = region.taxCapacity > 70 ? Math.min((region.taxCapacity - 70) * 1.5 + 5, 15) : 0;
  const gentryWeight = region.agriculture > 70 ? Math.min((region.agriculture - 70) * 2 + 6, 18) : 0;
  const generalsWeight = region.fortification > 60 ? Math.min((region.fortification - 60) * 1 + 4, 12) : 0;

  return [
    { cliqueId: "donglin", weight: Math.round(donglinWeight) },
    { cliqueId: "eunuchs", weight: Math.round(eunuchsWeight) },
    { cliqueId: "gentry", weight: Math.round(gentryWeight) },
    { cliqueId: "generals", weight: Math.round(generalsWeight) },
  ];
}

/**
 * Aggregate clique strength for a faction from all controlled regions.
 * strength = Σ(region.population × cliqueWeight) / totalPopulation
 */
export function computeFactionCliqueStrength(
  cliques: FactionCliqueState[],
  regions: RegionState[],
): FactionCliqueState[] {
  if (regions.length === 0) {
    return cliques.map((c) => ({ ...c, strength: 0 }));
  }

  const totalPopulation = regions.reduce((sum, r) => sum + r.population, 0);
  if (totalPopulation === 0) {
    return cliques.map((c) => ({ ...c, strength: 0 }));
  }

  const strengthAccum: Record<string, number> = {};
  for (const c of cliques) {
    strengthAccum[c.cliqueId] = 0;
  }

  for (const region of regions) {
    const weights = computeRegionCliqueWeights(region);
    for (const w of weights) {
      strengthAccum[w.cliqueId] = (strengthAccum[w.cliqueId] ?? 0) + region.population * w.weight;
    }
  }

  return cliques.map((c) => ({
    ...c,
    strength: Math.round(strengthAccum[c.cliqueId] / totalPopulation),
  }));
}

/**
 * Compute support deltas when domestic focus changes.
 * delta = (newAffinity - oldAffinity) × strength / 100, clamped to [-8, +8]
 */
export function computeCliqueReactions(
  newFocus: DomesticFocus,
  oldFocus: DomesticFocus,
  cliques: FactionCliqueState[],
  defs: Record<FactionCliqueId, CliqueDef>,
): CliqueReaction[] {
  return cliques.map((cs) => {
    const def = defs[cs.cliqueId];
    if (!def) {
      return { cliqueId: cs.cliqueId, delta: 0, reason: "未知派系" };
    }

    const newAffinity = def.policyAffinities[newFocus];
    const oldAffinity = def.policyAffinities[oldFocus];
    const rawDelta = (newAffinity - oldAffinity) * (cs.strength / 100);
    const delta = Math.max(-8, Math.min(8, Math.round(rawDelta)));

    let reason = "";
    if (delta > 0) reason = `偏好「${focusLabel(newFocus)}」`;
    else if (delta < 0) reason = `反对「${focusLabel(newFocus)}」`;
    else reason = "态度中立";

    return { cliqueId: cs.cliqueId, delta, reason };
  });
}

/**
 * Apply clique reactions to update support values, clamped to [0, 100].
 */
export function applyCliqueReactions(
  cliques: FactionCliqueState[],
  reactions: CliqueReaction[],
): FactionCliqueState[] {
  const reactionMap = new Map(reactions.map((r) => [r.cliqueId, r.delta]));
  return cliques.map((c) => ({
    ...c,
    support: Math.max(0, Math.min(100, c.support + (reactionMap.get(c.cliqueId) ?? 0))),
  }));
}

/**
 * Compute the administration modifier from clique states.
 * High support (>60) → positive contribution
 * Low support (<40) → negative contribution (×0.8 penalty factor)
 * Final result clamped to [-10, +10]
 */
export function computeAdministrationModifier(cliques: FactionCliqueState[]): number {
  let total = 0;

  for (const cs of cliques) {
    if (cs.support > 60) {
      // Positive: scaled by how far above 60 and by strength
      const contribution = ((cs.support - 60) / 40) * (cs.strength / 100) * 5;
      total += contribution;
    } else if (cs.support < 40) {
      // Negative: penalty factor 0.8, dissatisfaction is more impactful
      const penalty = ((40 - cs.support) / 40) * (cs.strength / 100) * 5 * 0.8;
      total -= penalty;
    }
  }

  return Math.max(-10, Math.min(10, Math.round(total)));
}

/**
 * Apply natural decay: each clique's support moves 1 point toward 50 per month.
 */
export function applyNaturalDecay(cliques: FactionCliqueState[]): FactionCliqueState[] {
  return cliques.map((c) => {
    if (c.support === 50) return c;
    const delta = c.support > 50 ? -1 : 1;
    return { ...c, support: c.support + delta };
  });
}

function focusLabel(focus: DomesticFocus): string {
  const labels: Record<DomesticFocus, string> = {
    agriculture: "劝课农桑",
    finance: "整顿财政",
    military: "整军备战",
    administration: "澄清吏治",
    recovery: "休养生息",
    frontier: "经略边疆",
  };
  return labels[focus];
}
