import type { FactionState, FrontState, MilitaryPosture, Modifier, RegionState, WarState } from "./types";
import type { RandomSource } from "./random";
import { queryModifier } from "./modifiers";

/** S5: 战线初始状态 —— 双方支持度与补给均充足，随战争消耗演变。 */
function createInitialFront(): FrontState {
  return {
    attackerWarSupport: 70,
    defenderWarSupport: 70,
    attackerSupply: 100,
    defenderSupply: 100,
  };
}

/**
 * Create an initial war state from the first engagement between two factions.
 */
export function createInitialWar(
  attacker: FactionState,
  defender: FactionState,
  region: RegionState
): WarState {
  return {
    id: `${attacker.id}-${defender.id}-${region.id}`,
    attackerFactionId: attacker.id,
    defenderFactionId: defender.id,
    targetRegionId: region.id,
    progress: 35,
    monthsActive: 1,
    front: createInitialFront(),
  };
}

/**
 * S5b: advanceWar 的战线消耗结果。战争每月推进 progress（兵力×组织×地形），
 * 同时产生持续的军队损耗、战地军费/军粮消耗、战疲累积——由 simulation 应用
 * 到 faction 与 ledger，使战争真正咬合财政/补给/动员，而非由单月战斗决定
 * 胜负。消耗计算确定性（不消费 random），避免扰动确定性模拟的随机序列。
 */
export interface WarAdvanceResult {
  war: WarState;
  attackerLosses: number;
  defenderLosses: number;
  attackerSilverCost: number;
  defenderSilverCost: number;
  attackerGrainCost: number;
  defenderGrainCost: number;
  attackerExhaustionDelta: number;
  defenderExhaustionDelta: number;
}

/**
 * Advance an ongoing war by one month.
 * - progress:兵力×组织×地形 的兵力比推进（确定性）
 * - 持续消耗：双方军队损耗（补给低则损耗高）、战地军费/军粮、战疲累积
 * - 进攻方补给逐月衰减（劳师远征），防守方本土补给稳定
 */
export function advanceWar(
  war: WarState,
  attacker: FactionState,
  defender: FactionState,
  region: RegionState,
  modifiers: Modifier[] = []
): WarAdvanceResult {
  const attackerOrgMult = 1 + queryModifier(modifiers, "faction", attacker.id, "army-org-mult");
  const defenderOrgMult = 1 + queryModifier(modifiers, "faction", defender.id, "army-org-mult");
  const attackerStrength =
    attacker.armyTotal *
    (attacker.militaryOrganization / 100) *
    attackerOrgMult *
    (1 - attacker.warExhaustion / 200);
  const defenderStrength =
    defender.armyTotal *
    (defender.militaryOrganization / 100) *
    defenderOrgMult *
    ((region.fortification / 100) + 0.5);

  const strengthRatio = attackerStrength / Math.max(1, defenderStrength);
  const progressDelta = Math.round((strengthRatio - 1) * 6);
  const nextProgress = Math.max(0, Math.min(100, war.progress + progressDelta));

  // S5b: 战线持续消耗（确定性）。
  const front = war.front ?? createInitialFront();
  const supplyA = Math.max(0.3, front.attackerSupply / 100);
  const supplyD = Math.max(0.3, front.defenderSupply / 100);
  const committedAttacker = Math.max(500, Math.round(attacker.armyTotal * 0.25));
  const committedDefender = Math.max(region.garrison, Math.round(defender.armyTotal * 0.15));
  const baseAttrition = 0.015;
  const attackerLosses = Math.round((committedAttacker * baseAttrition) / supplyA);
  const defenderLosses = Math.round((committedDefender * baseAttrition) / supplyD);
  // 战地军费/军粮：在常规维护（calculateFactionMaintenance）之上的额外消耗，
  // 让战争可感地侵蚀财政与粮储（大明 68 万军 ×0.05 ≈ 3.4 万银/月/战线）。
  const warCostPerSoldier = 0.05;
  const warGrainPerSoldier = 0.05;
  const attackerSilverCost = Math.round(attacker.armyTotal * warCostPerSoldier);
  const defenderSilverCost = Math.round(defender.armyTotal * warCostPerSoldier);
  const attackerGrainCost = Math.round(attacker.armyTotal * warGrainPerSoldier);
  const defenderGrainCost = Math.round(defender.armyTotal * warGrainPerSoldier);

  const nextFront: FrontState = {
    attackerWarSupport: front.attackerWarSupport,
    defenderWarSupport: front.defenderWarSupport,
    attackerSupply: Math.max(30, front.attackerSupply - 0.5),
    defenderSupply: front.defenderSupply,
  };

  return {
    war: { ...war, monthsActive: war.monthsActive + 1, progress: nextProgress, front: nextFront },
    attackerLosses,
    defenderLosses,
    attackerSilverCost,
    defenderSilverCost,
    attackerGrainCost,
    defenderGrainCost,
    attackerExhaustionDelta: 1.5,
    defenderExhaustionDelta: 1.0,
  };
}

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
  random: RandomSource,
  modifiers: Modifier[] = []
): BattleResult {
  const attackerCommitted = Math.min(attacker.armyTotal, Math.round(attacker.armyTotal * 0.18 * postureMultiplier[posture]));
  const defenderCommitted = Math.min(defender.armyTotal, region.garrison);
  const terrainDefense = region.terrain === "mountain" ? 1.25 : region.terrain === "river" ? 1.12 : 1;
  // S1b: army-org-mult modifier (e.g. 军制改革/八旗组织) scales effective military organization.
  const attackerOrgMult = 1 + queryModifier(modifiers, "faction", attacker.id, "army-org-mult");
  const defenderOrgMult = 1 + queryModifier(modifiers, "faction", defender.id, "army-org-mult");
  const attackerPower =
    attackerCommitted * (attacker.militaryOrganization / 100) * attackerOrgMult * (1 - attacker.warExhaustion / 200) * (0.9 + random.next() * 0.25);
  const defenderPower =
    defenderCommitted * (defender.militaryOrganization / 100) * defenderOrgMult * terrainDefense * (region.fortification / 120 + 0.5) * (0.9 + random.next() * 0.25);
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
          monthsActive: 1,
          front: createInitialFront(),
        }
  };
}
