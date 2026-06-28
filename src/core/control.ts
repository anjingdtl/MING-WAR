import type { FactionState, RegionState } from "./types";

export function updateControl(region: RegionState, controller: FactionState): RegionState {
  const legitimacyBoost = controller.legitimacy / 60;
  const adminBoost = controller.administration / 80;
  const corePenalty = region.coreFactionIds.includes(controller.id) ? 0 : 1.8;
  const garrisonBoost = Math.min(2.5, region.garrison / Math.max(1, region.population) * 35);
  const nextControl = Math.max(
    0,
    Math.min(100, region.control + legitimacyBoost + adminBoost + garrisonBoost - corePenalty - region.rebelPressure / 40)
  );
  return {
    ...region,
    control: Math.round(nextControl)
  };
}
