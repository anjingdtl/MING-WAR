import type { FactionState, RegionState } from "./types";

export interface RebellionResult {
  region: RegionState;
  erupted: boolean;
  report: string | null;
}

export function calculateRebellionRisk(region: RegionState, faction: FactionState): number {
  const lowStability = Math.max(0, 65 - region.stability);
  const lowControl = Math.max(0, 70 - region.control);
  const hunger = region.grainStock < region.population * 0.1 ? 18 : 0;
  const taxPressure = faction.corruption / 3;
  // S6 遗留#1：腐败>50 时吏治败坏直接加剧民怨（不只通过税负），让晚期大明
  // （腐败累积）的北方叛乱能压过驻军压制、触发陕西流民局势。
  const corruptionPressure = faction.corruption > 50 ? (faction.corruption - 50) * 0.8 : 0;
  const garrisonSuppression = Math.min(25, region.garrison / Math.max(1, region.population) * 1000);
  return Math.max(0, lowStability + lowControl + hunger + taxPressure + corruptionPressure + region.rebelPressure - garrisonSuppression);
}

export function updateRebellion(region: RegionState, faction: FactionState): RebellionResult {
  const risk = calculateRebellionRisk(region, faction);
  const nextPressure = Math.min(100, region.rebelPressure + risk / 25);
  const erupted = nextPressure >= 75;
  return {
    region: {
      ...region,
      rebelPressure: erupted ? 80 : Math.round(nextPressure),
      stability: erupted ? Math.max(0, region.stability - 12) : region.stability
    },
    erupted,
    report: erupted ? `${region.name}民变扩大，当地叛乱压力转化为武装冲突。` : null
  };
}
