import { isInDateWindow } from "./calendar";
import type { EventId, FactionId, GameState, Modifier, RegionId } from "./types";

export type EventCondition =
  | { type: "faction_exists"; factionId: FactionId }
  | { type: "date_window"; start: string; end: string }
  | { type: "flag_absent"; flag: string }
  | { type: "region_controller"; regionId: RegionId; factionId: FactionId }
  | { type: "faction_treasury_below"; factionId: FactionId; value: number };

export interface EventEffect {
  factionId?: FactionId;
  regionId?: RegionId;
  treasury?: number;
  grain?: number;
  administration?: number;
  corruption?: number;
  legitimacy?: number;
  stability?: number;
  control?: number;
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
    case "region_controller":
      return state.regions[condition.regionId]?.controllerFactionId === condition.factionId;
    case "faction_treasury_below":
      return (state.factions[condition.factionId]?.treasury ?? Number.POSITIVE_INFINITY) < condition.value;
  }
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
      faction.grainReserve += effect.grain ?? 0;
      faction.administration = clamp(faction.administration + (effect.administration ?? 0));
      faction.corruption = clamp(faction.corruption + (effect.corruption ?? 0));
      faction.legitimacy = clamp(faction.legitimacy + (effect.legitimacy ?? 0));
    }
    if (effect.regionId) {
      const region = next.regions[effect.regionId];
      region.stability = clamp(region.stability + (effect.stability ?? 0));
      region.control = clamp(region.control + (effect.control ?? 0));
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
