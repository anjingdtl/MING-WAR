import type { FactionState, Modifier, RegionState } from "./types";
import { queryModifier } from "./modifiers";

export function updateControl(region: RegionState, controller: FactionState, modifiers: Modifier[] = []): RegionState {
  const legitimacyBoost = controller.legitimacy / 60;
  const adminBoost = controller.administration / 80;
  const corePenalty = region.coreFactionIds.includes(controller.id) ? 0 : 1.8;
  const garrisonBoost = Math.min(2.5, region.garrison / Math.max(1, region.population) * 35);
  // S1b: region/faction control-flat modifiers now feed into the monthly control update.
  const controlFlat = queryModifier(modifiers, "region", region.id, "control-flat", controller.id);
  const nextControl = Math.max(
    0,
    Math.min(100, region.control + legitimacyBoost + adminBoost + garrisonBoost - corePenalty - region.rebelPressure / 40 + controlFlat)
  );
  return {
    ...region,
    control: Math.round(nextControl)
  };
}
