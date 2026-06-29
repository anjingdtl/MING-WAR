import { isInDateWindow } from "./calendar";
import type { EventId, FactionId, GameState, Modifier, RegionId } from "./types";

export type EventCondition =
  | { type: "faction_exists"; factionId: FactionId }
  | { type: "date_window"; start: string; end: string }
  | { type: "flag_absent"; flag: string }
  | { type: "flag_present"; flag: string }
  | { type: "region_controller"; regionId: RegionId; factionId: FactionId }
  | { type: "region_owner"; regionId: RegionId; factionId: FactionId }
  | { type: "faction_treasury_below"; factionId: FactionId; value: number }
  | { type: "faction_grain_below"; factionId: FactionId; value: number }
  | { type: "faction_legitimacy_below"; factionId: FactionId; value: number }
  | { type: "faction_stability_below"; factionId: FactionId; value: number }
  | { type: "faction_war_exhaustion_above"; factionId: FactionId; value: number }
  | { type: "region_stability_below"; regionId: RegionId; value: number }
  | { type: "region_control_below"; regionId: RegionId; value: number }
  | { type: "faction_controls_any"; factionId: FactionId; regionIds: RegionId[] };

export interface EventEffect {
  factionId?: FactionId;
  regionId?: RegionId;
  treasury?: number;
  grain?: number;
  administration?: number;
  corruption?: number;
  legitimacy?: number;
  warExhaustion?: number;
  militaryOrganization?: number;
  centralization?: number;
  armyTotal?: number;
  stability?: number;
  control?: number;
  population?: number;
  grainStock?: number;
  garrison?: number;
  rebelPressure?: number;
  setFlag?: string;
  modifier?: Modifier;
}

export interface EventOption {
  id: string;
  name: string;
  shortEffect: string;
  effects: EventEffect[];
}

export interface GameEvent {
  id: EventId;
  name: string;
  category: "fixed" | "conditional" | "faction" | "region" | "chain" | "global";
  description: string;
  priority: number;
  conditions: EventCondition[];
  options: EventOption[];
}

export function eventConditionMet(state: GameState, condition: EventCondition): boolean {
  switch (condition.type) {
    case "faction_exists":
      return state.factions[condition.factionId]?.status === "active";
    case "date_window":
      return isInDateWindow(state.currentDate, condition.start, condition.end);
    case "flag_absent":
      return !state.eventFlags[condition.flag];
    case "flag_present":
      return !!state.eventFlags[condition.flag];
    case "region_controller":
      return state.regions[condition.regionId]?.controllerFactionId === condition.factionId;
    case "region_owner":
      return state.regions[condition.regionId]?.ownerFactionId === condition.factionId;
    case "faction_treasury_below":
      return (state.factions[condition.factionId]?.treasury ?? Number.POSITIVE_INFINITY) < condition.value;
    case "faction_grain_below":
      return (state.factions[condition.factionId]?.grainReserve ?? Number.POSITIVE_INFINITY) < condition.value;
    case "faction_legitimacy_below":
      return (state.factions[condition.factionId]?.legitimacy ?? 0) < condition.value;
    case "faction_stability_below":
      return averageFactionStability(state, condition.factionId) < condition.value;
    case "faction_war_exhaustion_above":
      return (state.factions[condition.factionId]?.warExhaustion ?? 0) > condition.value;
    case "region_stability_below":
      return (state.regions[condition.regionId]?.stability ?? 0) < condition.value;
    case "region_control_below":
      return (state.regions[condition.regionId]?.control ?? 0) < condition.value;
    case "faction_controls_any":
      return condition.regionIds.some((id) => state.regions[id]?.controllerFactionId === condition.factionId);
  }
}

function averageFactionStability(state: GameState, factionId: FactionId): number {
  const regions = Object.values(state.regions).filter((region) => region.controllerFactionId === factionId);
  if (regions.length === 0) return 0;
  return regions.reduce((sum, region) => sum + region.stability, 0) / regions.length;
}

export function findTriggeredEvents(state: GameState, events: GameEvent[]): GameEvent[] {
  return events
    .filter((event) => !state.eventFlags[`event:${event.id}`])
    .filter((event) => event.conditions.every((condition) => eventConditionMet(state, condition)))
    .sort((a, b) => b.priority - a.priority);
}

export function applyEventOption(state: GameState, event: GameEvent, optionId: string): GameState {
  const option = event.options.find((item) => item.id === optionId);
  if (!option) {
    throw new Error(`Unknown option ${optionId} for event ${event.id}`);
  }

  const next: GameState = structuredClone(state);
  next.eventFlags[`event:${event.id}`] = true;

  for (const effect of option.effects) {
    if (effect.factionId) {
      const faction = next.factions[effect.factionId];
      faction.treasury += effect.treasury ?? 0;
      faction.grainReserve = Math.max(0, faction.grainReserve + (effect.grain ?? 0));
      faction.administration = clamp(faction.administration + (effect.administration ?? 0));
      faction.corruption = clamp(faction.corruption + (effect.corruption ?? 0));
      faction.legitimacy = clamp(faction.legitimacy + (effect.legitimacy ?? 0));
      faction.warExhaustion = clamp(faction.warExhaustion + (effect.warExhaustion ?? 0));
      faction.militaryOrganization = clamp(faction.militaryOrganization + (effect.militaryOrganization ?? 0));
      faction.centralization = clamp(faction.centralization + (effect.centralization ?? 0));
      faction.armyTotal = Math.max(0, faction.armyTotal + (effect.armyTotal ?? 0));
    }
    if (effect.regionId) {
      const region = next.regions[effect.regionId];
      region.stability = clamp(region.stability + (effect.stability ?? 0));
      region.control = clamp(region.control + (effect.control ?? 0));
      region.population = Math.max(0, region.population + (effect.population ?? 0));
      region.grainStock = Math.max(0, region.grainStock + (effect.grainStock ?? 0));
      region.garrison = Math.max(0, region.garrison + (effect.garrison ?? 0));
      region.rebelPressure = clamp(region.rebelPressure + (effect.rebelPressure ?? 0));
    }
    if (effect.setFlag) {
      next.eventFlags[effect.setFlag] = true;
    }
    if (effect.modifier) {
      next.activeModifiers.push(effect.modifier);
    }
  }

  next.reports.unshift({
    id: `${state.currentDate}-${event.id}`,
    date: state.currentDate,
    type: "event",
    title: event.name,
    body: `${option.name}：${option.shortEffect}`,
    severity: "warning"
  });

  return next;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
