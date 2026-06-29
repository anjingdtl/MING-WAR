import type { Modifier } from "./types";

/**
 * Decrement remaining months and remove expired modifiers.
 * - Modifiers with remainingMonths <= 0 after decrement are removed.
 * - Modifiers with remainingMonths > 0 are decremented by 1.
 * - Modifiers with remainingMonths === undefined (permanent) are kept as-is.
 */
export function expireModifiers(modifiers: Modifier[]): Modifier[] {
  return modifiers
    .map((m) => {
      if (m.remainingMonths === undefined) return m;
      const nextRemaining = m.remainingMonths - 1;
      return { ...m, remainingMonths: nextRemaining };
    })
    .filter((m) => m.remainingMonths === undefined || m.remainingMonths > 0);
}

/**
 * Add a new modifier to the list. Use for events, laws, disasters etc.
 */
export function addModifier(
  modifiers: Modifier[],
  modifier: Modifier | (Omit<Modifier, "remainingMonths"> & { remainingMonths?: number })
): Modifier[] {
  return [...modifiers, modifier as Modifier];
}

/**
 * Remove modifiers matching the predicate (e.g., by sourceId).
 */
export function removeModifiers(
  modifiers: Modifier[],
  predicate: (m: Modifier) => boolean
): Modifier[] {
  return modifiers.filter((m) => !predicate(m));
}

/**
 * Compute aggregate effect of all matching modifiers on a numeric key.
 * - add: sum all values
 * - multiply: 1 + sum(1 - 1) * value (additive on multiplier basis)
 * - replace: highest value wins
 */
export function aggregateModifierEffect(
  modifiers: Modifier[],
  effectKey: string
): number {
  let total = 0;
  let maxReplace = -Infinity;
  for (const m of modifiers) {
    const value = m.effects[effectKey];
    if (value === undefined) continue;
    if (m.stacking === "replace") {
      if (value > maxReplace) maxReplace = value;
    } else {
      total += value;
    }
  }
  if (maxReplace !== -Infinity && maxReplace > total) {
    return maxReplace;
  }
  return total;
}

/**
 * Effect-key vocabulary used by the live modifier system. Effects are applied
 * at the computation sites that own each value (see S1 in docs/v2-optimization-spec.md).
 *
 * Multiplicative keys are additive on the multiplier basis: a value of 0.2
 * means "+20%". Flat keys add directly to the 0–100 stat.
 *   - tax-mult            : region tax collection (economy.ts)
 *   - grain-output-mult   : region grain production (economy.ts)
 *   - maintenance-mult    : faction army/bureaucracy upkeep (economy.ts)
 *   - stability-flat      : region stability (control.ts)
 *   - control-flat        : region control (control.ts)
 *   - corruption-flat     : faction corruption (control.ts)
 *   - army-org-mult       : faction military organization (warfare.ts)
 */

/**
 * Collect every modifier relevant to a given scope, honouring the cascade
 * global → faction → region. For a region query, supply the region's current
 * controller as `controllerFactionId` so faction-scoped modifiers on the
 * controller also apply.
 */
export function collectModifiers(
  modifiers: Modifier[],
  scope: "global" | "faction" | "region",
  targetId: string | undefined,
  controllerFactionId?: string
): Modifier[] {
  return modifiers.filter((m) => {
    if (m.scope === "global") return true;
    if (m.scope === "faction") {
      if (scope === "faction" && m.targetId === targetId) return true;
      // A faction-scoped modifier also applies inside that faction's regions.
      if (scope === "region" && m.targetId === controllerFactionId) return true;
      return false;
    }
    if (m.scope === "region") {
      return scope === "region" && m.targetId === targetId;
    }
    return false;
  });
}

/**
 * Query the aggregate effect of all relevant modifiers on a numeric key.
 * Returns 0 when nothing applies — safe to use as `1 + queryModifier(...)`.
 */
export function queryModifier(
  modifiers: Modifier[],
  scope: "global" | "faction" | "region",
  targetId: string | undefined,
  effectKey: string,
  controllerFactionId?: string
): number {
  const relevant = collectModifiers(modifiers, scope, targetId, controllerFactionId);
  return aggregateModifierEffect(relevant, effectKey);
}