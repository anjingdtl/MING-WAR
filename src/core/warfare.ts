import type { FactionState, MilitaryPosture, RegionState, WarState } from "./types";
import type { RandomSource } from "./random";

export interface BattleResult {
  region: RegionState;
  attacker: FactionState;
  defender: FactionState;
  report: string;
  war: WarState | null;
}

const postureMultiplier: Record<MilitaryPosture, number> = {
  conservative: 0.72,
  balanced: 1,
  aggressive: 1.28
};

export function resolveBattle(
  region: RegionState,
  attacker: FactionState,
  defender: FactionState,
  posture: MilitaryPosture,
  random: RandomSource
): BattleResult {
  const attackerCommitted = Math.min(attacker.armyTotal, Math.round(attacker.armyTotal * 0.18 * postureMultiplier[posture]));
  const defenderCommitted = Math.min(defender.armyTotal, region.garrison);
  const terrainDefense = region.terrain === "mountain" ? 1.25 : region.terrain === "river" ? 1.12 : 1;
  const attackerPower =
    attackerCommitted * (attacker.militaryOrganization / 100) * (1 - attacker.warExhaustion / 200) * (0.9 + random.next() * 0.25);
  const defenderPower =
    defenderCommitted * (defender.militaryOrganization / 100) * terrainDefense * (region.fortification / 120 + 0.5) * (0.9 + random.next() * 0.25);
  const attackerWins = attackerPower > defenderPower;
  const attackerLoss = Math.round(attackerCommitted * (attackerWins ? 0.08 : 0.18));
  const defenderLoss = Math.round(defenderCommitted * (attackerWins ? 0.18 : 0.08));
  const nextControl = attackerWins ? Math.max(20, region.control - 18) : Math.max(25, region.control - 6);
  const captured = attackerWins && nextControl <= 35;

  return {
    region: {
      ...region,
      controllerFactionId: captured ? attacker.id : region.controllerFactionId,
      control: captured ? 38 : nextControl,
      garrison: Math.max(1000, region.garrison - defenderLoss)
    },
    attacker: {
      ...attacker,
      armyTotal: Math.max(0, attacker.armyTotal - attackerLoss),
      warExhaustion: Math.min(100, attacker.warExhaustion + (posture === "aggressive" ? 3 : 2))
    },
    defender: {
      ...defender,
      armyTotal: Math.max(0, defender.armyTotal - defenderLoss),
      warExhaustion: Math.min(100, defender.warExhaustion + 2)
    },
    report: captured
      ? `${attacker.name}攻占${region.name}，当地控制度骤降。`
      : `${attacker.name}进攻${region.name}，双方均有损失。`,
    war: captured
      ? null
      : {
          id: `${attacker.id}-${defender.id}-${region.id}`,
          attackerFactionId: attacker.id,
          defenderFactionId: defender.id,
          targetRegionId: region.id,
          progress: attackerWins ? 60 : 35,
          monthsActive: 1
        }
  };
}
