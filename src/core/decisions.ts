import type { GameState, PlayerDecision, RegionId } from "./types";
import { hasTruce, isAlly } from "./diplomacy";

export function getFactionRegionIds(state: GameState, factionId: string): RegionId[] {
  return Object.values(state.regions)
    .filter((region) => region.controllerFactionId === factionId)
    .map((region) => region.id);
}

export function getValidMilitaryTargets(state: GameState, factionId: string): RegionId[] {
  const controlled = new Set(getFactionRegionIds(state, factionId));
  const targets = new Set<RegionId>();
  for (const regionId of controlled) {
    const region = state.regions[regionId];
    for (const connectionId of region.connections) {
      const connection = state.regions[connectionId];
      if (connection.controllerFactionId !== factionId) {
        const ownerFaction = connection.controllerFactionId;
        // S5d: 外交约束开战 —— 停战期或盟友控制的地区不可攻击（玩家与 AI
        // 同规则，复用 getValidMilitaryTargets 通道）。停战制造备战窗口、
        // 同盟阻止互攻，让外交环真正约束战争。
        if (
          !hasTruce(state, factionId, ownerFaction) &&
          !isAlly(state, factionId, ownerFaction)
        ) {
          targets.add(connectionId);
        }
      }
    }
  }
  return [...targets];
}

export function normalizePlayerDecision(state: GameState, decision: PlayerDecision): PlayerDecision {
  const validTargets = getValidMilitaryTargets(state, state.playerFactionId);
  const targetRegionId =
    decision.targetRegionId && validTargets.includes(decision.targetRegionId)
      ? decision.targetRegionId
      : validTargets[0] ?? null;
  return {
    targetRegionId,
    posture: decision.posture,
    domesticFocus: decision.domesticFocus
  };
}

/**
 * v0.8: 为每个 region 预计算到各 faction 首都的 BFS 最短距离。
 * 写入 region.distanceFromCapital[factionId] = 跳数。
 *
 * 调用时机：
 *   1. createMvpScenario() 末尾（开局时）
 *   2. simulateMonth() 入口（防御性：任何地区拓扑变更后保持距离表最新）
 *
 * 设计意图：让"劳师远征"可感。距离 = 1（相邻）：×1.0 投送；距离 = 2：×0.85；
 * 距离 = 3：×0.70；距离 ≥ 4：×0.55。补给按 1.5 × distance 衰减。周边小势力
 * 不再被大明 1-2 月推平；大明要真调兵 3-5 月才能集结完毕。
 *
 * 注意：不消耗 random，纯拓扑计算。runWarPhase 不调用（已经在
 * simulateMonth 入口预计算，避免每条 war 重复 BFS）。
 */
export function computeDistanceMap(state: GameState): void {
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active" || !faction.capitalRegionId) continue;
    const capitalId = faction.capitalRegionId;
    const capital = state.regions[capitalId];
    if (!capital) continue;
    // BFS from capital
    const distances: Record<string, number> = { [capitalId]: 0 };
    const queue: string[] = [capitalId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = distances[current];
      const currentRegion = state.regions[current];
      if (!currentRegion) continue;
      for (const neighborId of currentRegion.connections) {
        if (!(neighborId in distances)) {
          distances[neighborId] = currentDist + 1;
          queue.push(neighborId);
        }
      }
    }
    // 写入每个 region 的 distanceFromCapital（未到达的设 Infinity → getDistanceMult 走 ≥ 4 分支）
    for (const region of Object.values(state.regions)) {
      if (!region.distanceFromCapital) region.distanceFromCapital = {};
      region.distanceFromCapital[faction.id] = distances[region.id] ?? 999;
    }
  }
}
