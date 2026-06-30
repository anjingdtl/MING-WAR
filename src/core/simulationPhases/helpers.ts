/**
 * helpers.ts — runRegionPhase / runWarPhase 共用辅助函数。
 *
 * 原 simulation.ts 内部函数，保持原行为不变。
 */

import type { GameState, MonthlyReport, RegionState, FactionState } from "../types";

export function applyRebellionConsequences(
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

export function countControlledRegions(state: GameState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const region of Object.values(state.regions)) {
    counts[region.controllerFactionId] = (counts[region.controllerFactionId] ?? 0) + 1;
  }
  return counts;
}
