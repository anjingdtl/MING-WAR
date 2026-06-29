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