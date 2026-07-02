/**
 * runWarPhase — v0.6-stability §3.2 S6
 *
 * 战斗 + 战线推进 + 和平谈判。
 * 业务逻辑从原 simulation.ts L437-535 完整迁移。
 * resolveBattle 消费 random（首月遭遇战），保持原顺序不变。
 * v0.8: 应用 advanceWar 返回的 nextCommittedForce 到
 * attacker.warCommitments[war.targetRegionId]，战争结束后清理。
 *
 * ⚠️ DETERMINISM-CHANGE (v0.8):
 *  1. 不再每月 filter+concat 替换 ongoing war（会重置 committedForce），
 *     改为基于 endedWarRegionIds 标记删除。
 *  2. 新遭遇战创建时，把 battle.attackerLoss / defenderLoss 一次性扣到
 *     faction.armyTotal（旧版由 resolveBattle 内部 mutate，已修复）。
 *  3. eliminateDefeatedFactions 后，遍历 endedWarRegionIds 清理残留的
 *     activeWar（防止 faction 被消灭但 war 仍推进）。
 *  4. capture 时把已有 war 移除（已被 createInitialWar 新建对象替代，
 *     避免重复条目）。
 * 与 v0.7.x 存档不兼容。详见 warfare.ts 顶部 DETERMINISM-CHANGE banner。
 *
 * ⚠️ DETERMINISM-CHANGE (T10 — 2026-07-02)
 *  5. siegeWeeks 计算从 distanceFromCapital 跳数改为 getMovementDays 边权
 *     （Dijkstra 缓存）。冬季 / 山地行军日数显著延长，siegeWeeks 也对应
 *     拉长，supplyRatio 变低、supplyMult 下降。导致 committedForce 进一步
 *     萎缩，持久战更艰苦。hash:state m=0 起漂移。
 */

import { advanceWar, alliesJoinWar, resolveBattle } from "../warfare";
import { checkPeace, computeWarSupport, resolvePeace } from "../peace";
import { applyLedgerToState, type LedgerEntry } from "../ledger";
import { findTriggeredEvents } from "../eventEngine";
import { mvpEvents } from "../../data/events";
import {
  applySupplyPressureMultiplier,
  computeSupplyRatio,
  tickSupplyConvoys,
} from "../supply";
import {
  applyCapturePlunder,
  applySiegeMaintenance,
  tickSiegeDamage,
} from "../siege";
import { getMovementDays, invalidateMovementCache } from "../movement";
import type { WarState } from "../types";
import type { PhaseFn } from "../simulationContext";

export const runWarPhase: PhaseFn = (ctx) => {
  // T10: 月初清空路径缓存（控制权 / 基建 / 季节变化时强制重算）
  invalidateMovementCache();

  // 玩家与 AI 当月决策
  const decisions: Record<string, import("../types").PlayerDecision> = {
    [ctx.state.playerFactionId]: ctx.playerDecision,
    ...ctx.aiDecisions
  };
  const endedWarRegionIds: string[] = []; // v0.8: 战争结束后清理 warCommitments

  // v0.9.2: 推进活跃补给车队（ETA-1，到期注入 depotStock；不消费 random）
  ctx.state = tickSupplyConvoys(ctx.state);

  // T10 + v0.9.2: 预算本月的 supplyMult 映射（faction × targetRegion → mult）
  // 持久战调用 advanceWar 之前用此值缩放 committedAfterLosses。
  // T10: siegeWeeks 改用 getMovementDays（地形/季节边权）替代 distanceFromCapital 跳数。
  const supplyMultMap = new Map<string, number>();
  for (const war of ctx.state.wars) {
    const key = `${war.attackerFactionId}|${war.targetRegionId}`;
    if (supplyMultMap.has(key)) continue;
    const movementDays = getMovementDays(ctx.state, war.attackerFactionId, war.targetRegionId, ctx.state.currentDate);
    const siegeWeeks = Math.max(8, movementDays * 5);
    const supplyRatio = computeSupplyRatio(ctx.state, war.attackerFactionId, war.targetRegionId, siegeWeeks);
    supplyMultMap.set(key, applySupplyPressureMultiplier(supplyRatio));
  }

  // 战斗（resolveBattle 消费 random）
  for (const [factionId, decision] of Object.entries(decisions)) {
    if (!decision.targetRegionId) continue;
    const attacker = ctx.state.factions[factionId];
    const target = ctx.state.regions[decision.targetRegionId];
    const defender = ctx.state.factions[target.controllerFactionId];
    if (!attacker || !defender || attacker.id === defender.id) continue;
    const battle = resolveBattle(target, attacker, defender, decision.posture, ctx.random, ctx.state.activeModifiers);
    ctx.state.regions[target.id] = battle.region;
    // v0.9.3: 围城成功 → 战利品 + stability-15 + rebelPressure+5
    if (battle.war === null && battle.region.controllerFactionId === attacker.id) {
      const capture = applyCapturePlunder(battle.region, attacker.id, attacker.name);
      ctx.state.regions[battle.region.id] = capture.region;
      applyLedgerToState(ctx.state, capture.entries);
      ctx.ledgerEntries.push(...capture.entries);
    }
    ctx.reports.push({
      id: `${ctx.state.currentDate}-${attacker.id}-${target.id}-battle`,
      date: ctx.state.currentDate,
      type: "war",
      title: `${attacker.name}进攻${target.name}`,
      body: battle.report,
      severity: battle.region.controllerFactionId === attacker.id ? "danger" : "info"
    });
    if (battle.war) {
      // v0.8 关键修复：resolveBattle 不再 mutate attacker/defender.armyTotal
      // （保持 pure function）。本块显式控制：
      //   - 新遭遇战（无已有 war）：扣首月 armyTotal 损耗 + 创建 war + 同盟参战
      //   - 已有 war：不再扣 attackerLoss（advanceWar 接管 committedForce 自损）
      //   - capture（battle.war === null）+ 已有 war：移除旧 war + 清理 committedForce
      // 这样大明 AI 即使每月换目标，armyTotal 也只在"首次打新目标"扣一次，
      // 不会每场战争每月扣 18.7k。
      const alreadyOngoing = ctx.state.wars.some(
        (w) => w.attackerFactionId === attacker.id && w.targetRegionId === target.id
      );
      const capturedWarId = `${attacker.id}-${defender.id}-${target.id}`;
      if (!alreadyOngoing) {
        // 首月遭遇战：扣 armyTotal（一次性首战损耗）
        ctx.state.factions[attacker.id] = {
          ...ctx.state.factions[attacker.id],
          armyTotal: Math.max(0, ctx.state.factions[attacker.id].armyTotal - battle.attackerLoss),
          warExhaustion: Math.min(100, ctx.state.factions[attacker.id].warExhaustion + (decision.posture === "aggressive" ? 3 : 2)),
        };
        ctx.state.factions[defender.id] = {
          ...ctx.state.factions[defender.id],
          armyTotal: Math.max(0, ctx.state.factions[defender.id].armyTotal - battle.defenderLoss),
          warExhaustion: Math.min(100, ctx.state.factions[defender.id].warExhaustion + 2),
        };
        ctx.state.wars = ctx.state.wars.filter((war) => war.id !== battle.war?.id).concat(battle.war);
        // S5 遗留#2：同盟参战
        ctx.state.wars.push(...alliesJoinWar(ctx.state, attacker.id, defender.id));
      } else {
        // 已有 war + 本月 resolveBattle 占领（battle.war === null）：移除旧 war。
        if (battle.war === null) {
          ctx.state.wars = ctx.state.wars.filter((w) => w.id !== capturedWarId);
          endedWarRegionIds.push(target.id);
        }
        // 否则已有 war：不再扣 armyTotal（advanceWar 接管）。
      }
    }
  }

  // 事件检测（不消费 random）
  const triggered = findTriggeredEvents(ctx.state, mvpEvents).slice(0, 1);
  for (const e of triggered) ctx.triggeredEventIds.push(e.id);

  // 战线推进 + 持续消耗
  const survivingWars: WarState[] = [];
  for (const war of ctx.state.wars) {
    const attacker = ctx.state.factions[war.attackerFactionId];
    const defender = ctx.state.factions[war.defenderFactionId];
    const region = ctx.state.regions[war.targetRegionId];
    if (!attacker || !defender || !region || attacker.status !== "active" || defender.status !== "active") {
      // v0.8: defender 被 eliminateDefeatedFactions 清除 → 战争自动结束（不应
      // 继续推进）。attacker 完胜：区域应已被 capture。把 war 从 ctx.state.wars
      // 中移除，并清理双方 warCommitments。
      // 但：attacker/defender/region 不存在（broken war ref）→ 保留 war 让
      // finalizeMonth 的 invariants 检测（"war-attacker-missing"）。
      if (attacker && defender && region && (defender.status !== "active" || attacker.status !== "active")) {
        endedWarRegionIds.push(war.targetRegionId);
        continue;
      }
      survivingWars.push(war);
      continue;
    }
    const r = advanceWar(war, attacker, defender, region, ctx.state.activeModifiers);
    // v0.8: attackerLosses 从 committedForce 扣（不是 armyTotal）。原因：大明同
    // 时多线开战时，armyTotal 是全国总兵力，按 committedForce 全额扣会让
    // armyTotal 50 月内跌到 0、committedForce 跌到 0、战争永远卡在 35%。让
    // committedForce 自损、armyTotal 保持全国基数，才是"调度 vs 损耗"分离的
    // 正确模型。defenderLosses 仍从 armyTotal 扣（守方在自己领土，总兵力即前线）。
    defender.armyTotal = Math.max(0, defender.armyTotal - r.defenderLosses);
    attacker.warExhaustion = Math.min(100, attacker.warExhaustion + r.attackerExhaustionDelta);
    defender.warExhaustion = Math.min(100, defender.warExhaustion + r.defenderExhaustionDelta);
    // v0.8: 应用 committedForce（先扣损失，再写入）
    if (!attacker.warCommitments) attacker.warCommitments = {};
    // v0.9.2: 补给压力乘数（supplyRatio < 0.5 → × 0.5，< 0.75 → × 0.7）
    const supplyMult = supplyMultMap.get(`${war.attackerFactionId}|${war.targetRegionId}`) ?? 1.0;
    const committedAfterLosses = Math.max(0, Math.round((r.nextCommittedForce - r.attackerLosses) * supplyMult));
    attacker.warCommitments[war.targetRegionId] = committedAfterLosses;
    const warEntries: LedgerEntry[] = [
      { category: "expense-army-pay", source: `${attacker.name} 战地军费`, amount: -r.attackerSilverCost, factionId: attacker.id },
      { category: "expense-army-pay", source: `${defender.name} 战地军费`, amount: -r.defenderSilverCost, factionId: defender.id },
      { category: "grain-consumption", source: `${attacker.name} 战地军粮`, amount: -r.attackerGrainCost, factionId: attacker.id, goodId: "grain" },
      { category: "grain-consumption", source: `${defender.name} 战地军粮`, amount: -r.defenderGrainCost, factionId: defender.id, goodId: "grain" }
    ];
    applyLedgerToState(ctx.state, warEntries);
    ctx.ledgerEntries.push(...warEntries);
    if (r.war.front) {
      r.war.front.attackerWarSupport = computeWarSupport(ctx.state, r.war, attacker.id);
      r.war.front.defenderWarSupport = computeWarSupport(ctx.state, r.war, defender.id);
    }
    // v0.9.3: 围城伤害 + 维护费。tickSiegeDamage 收 committedForce/8/fortLevel
    // 扣 region.garrison；维护费 200/月走账本 'expense-construction'。
    // 注：使用 pre-supplyMult 的 committedForce（r.nextCommittedForce），更反映"投入"。
    const nextRegion = tickSiegeDamage(region, r.nextCommittedForce);
    ctx.state.regions[region.id] = nextRegion;
    const siegeEntries = applySiegeMaintenance(nextRegion, defender.id, defender.name);
    applyLedgerToState(ctx.state, siegeEntries);
    ctx.ledgerEntries.push(...siegeEntries);
    survivingWars.push(r.war);
  }
  ctx.state.wars = survivingWars;

  // 和平谈判
  const warsAfterAdvance = ctx.state.wars;
  ctx.state.wars = [];
  for (const war of warsAfterAdvance) {
    const peace = checkPeace(ctx.state, war);
    if (!peace) {
      ctx.state.wars.push(war);
      continue;
    }
    // v0.8: 战争结束，清理双方 warCommitments（避免下一场战争时被污染）
    endedWarRegionIds.push(war.targetRegionId);
    const peaceEntries = resolvePeace(ctx.state, peace);
    applyLedgerToState(ctx.state, peaceEntries);
    ctx.ledgerEntries.push(...peaceEntries);
    const winner = ctx.state.factions[peace.winnerId];
    const loser = ctx.state.factions[peace.loserId];
    const reasonText =
      peace.reason === "total-victory" ? "完胜"
      : peace.reason === "exhaustion" ? "双方疲惫媾和" : "战败求和";
    const terms: string[] = [];
    if (peace.cedeRegions.length > 0) terms.push(`割让${peace.cedeRegions.length}地`);
    if (peace.indemnity > 0) terms.push("赔款");
    if (peace.tribute) terms.push("纳贡");
    terms.push(`停战${peace.truceMonths}月`);
    ctx.reports.push({
      id: `${ctx.state.currentDate}-${peace.warId}-peace`,
      date: ctx.state.currentDate,
      type: "war",
      title: `${winner.name}与${loser.name}议和`,
      body: `${reasonText}：${terms.join("、")}。`,
      severity: "info",
    });
  }

  // v0.8: 清理已结束战争的 committedForce
  if (endedWarRegionIds.length > 0) {
    for (const faction of Object.values(ctx.state.factions)) {
      if (!faction.warCommitments) continue;
      for (const rid of endedWarRegionIds) {
        if (rid in faction.warCommitments) {
          delete faction.warCommitments[rid];
        }
      }
    }
  }
};
