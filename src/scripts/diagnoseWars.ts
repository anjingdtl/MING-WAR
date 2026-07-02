/**
 * diagnoseWars.ts — v0.8 战争节奏诊断
 *
 * 跑一局并打印每场 war 的生命周期（progress 时间线、动员期、committedForce），
 * 用于验证"大明不再 1-2 月推平周边"这个 v0.8 核心目标。
 *
 * 用法：npm run diagnose:wars 或 tsx src/scripts/diagnoseWars.ts
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import type { GameState, WarState } from "../core/types";

interface WarHistory {
  id: string;
  attackerId: string;
  defenderId: string;
  targetRegionId: string;
  startedMonth: number;
  endedMonth: number | null;
  endReason: "peace" | "ongoing" | "cutoff";
  progressTimeline: Array<{ month: number; progress: number; supply: number; committed: number; mobilization: number }>;
  finalProgress: number;
  distance: number;
}

function main(months = 120, seed = 157301): void {
  let state = createMvpScenario("ming", seed);
  const warLog: Map<string, WarHistory> = new Map();

  console.log(`=== v0.8 战争节奏诊断（${months} 月 / seed ${seed}）===\n`);

  for (let m = 0; m < months; m += 1) {
    const beforeWars = new Set(state.wars.map((w) => w.id));
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed + m,
    });
    state = result.nextState;

    // 检查新建的 war
    for (const war of state.wars) {
      if (!beforeWars.has(war.id) && !warLog.has(war.id)) {
        warLog.set(war.id, {
          id: war.id,
          attackerId: war.attackerFactionId,
          defenderId: war.defenderFactionId,
          targetRegionId: war.targetRegionId,
          startedMonth: m,
          endedMonth: null,
          endReason: "ongoing",
          progressTimeline: [{ month: m, progress: war.progress, supply: war.front?.attackerSupply ?? 0, committed: war.front?.attackerCommitted ?? 0, mobilization: war.front?.mobilizationMonths ?? 0 }],
          finalProgress: war.progress,
          distance: state.regions[war.targetRegionId]?.distanceFromCapital?.[war.attackerFactionId] ?? 999,
        });
      }
    }

    // 更新进行中的 war 时间线（每月一个采样）
    for (const war of state.wars) {
      const log = warLog.get(war.id);
      if (log && log.endedMonth === null) {
        log.progressTimeline.push({
          month: m,
          progress: war.progress,
          supply: war.front?.attackerSupply ?? 0,
          committed: war.front?.attackerCommitted ?? 0,
          mobilization: war.front?.mobilizationMonths ?? 0,
        });
        log.finalProgress = war.progress;
      }
    }
  }

  // 标记仍未结束的 war
  for (const log of warLog.values()) {
    if (log.endedMonth === null) {
      log.endedMonth = months;
      log.endReason = "cutoff";
    }
  }

  // 按开始时间排序输出
  const sorted = [...warLog.values()].sort((a, b) => a.startedMonth - b.startedMonth);
  console.log(`共记录 ${sorted.length} 场战争。\n`);

  for (const w of sorted) {
    const attackerName = state.factions[w.attackerId]?.name ?? w.attackerId;
    const defenderName = state.factions[w.defenderId]?.name ?? w.defenderId;
    const targetName = state.regions[w.targetRegionId]?.name ?? w.targetRegionId;
    const duration = (w.endedMonth ?? months) - w.startedMonth;
    console.log(`─── ${attackerName} → ${defenderName}（目标：${targetName}，distance=${w.distance}）───`);
    console.log(`  开战月: ${w.startedMonth} | 持续: ${duration} 月 | 终 progress: ${w.finalProgress} | 状态: ${w.endReason}`);
    // 打印关键节点（动员、50%、90%）
    const reached50 = w.progressTimeline.find((p) => p.progress >= 50);
    const reached80 = w.progressTimeline.find((p) => p.progress >= 80);
    const reached95 = w.progressTimeline.find((p) => p.progress >= 95);
    const reached100 = w.progressTimeline.find((p) => p.progress >= 100);
    const endedMobilization = w.progressTimeline.find((p) => p.mobilization === 0 && p.month > w.startedMonth);
    const maxCommitted = Math.max(...w.progressTimeline.map((p) => p.committed));
    const finalSupply = w.progressTimeline[w.progressTimeline.length - 1]?.supply ?? 0;
    console.log(`  动员结束: ${endedMobilization?.month ?? "未结束"} | 投送峰值: ${maxCommitted.toLocaleString()} | 最终补给: ${finalSupply.toFixed(1)}`);
    console.log(`  progress: 50% @ ${reached50?.month ?? "未到"} | 80% @ ${reached80?.month ?? "未到"} | 95% @ ${reached95?.month ?? "未到"} | 100% @ ${reached100?.month ?? "未到"}`);
    console.log();
  }

  // 统计：大明作为攻方的战争持续时间
  const mingAttacks = sorted.filter((w) => w.attackerId === "ming" && w.distance <= 4);
  if (mingAttacks.length > 0) {
    console.log(`\n=== 大明作为攻方的近距离战争（distance≤4）汇总 ===`);
    for (const w of mingAttacks) {
      const targetName = state.regions[w.targetRegionId]?.name ?? w.targetRegionId;
      const defenderName = state.factions[w.defenderId]?.name ?? w.defenderId;
      const duration = (w.endedMonth ?? months) - w.startedMonth;
      const reached80 = w.progressTimeline.find((p) => p.progress >= 80);
      const reached95 = w.progressTimeline.find((p) => p.progress >= 95);
      console.log(`  vs ${defenderName}（${targetName}, dist=${w.distance}）: 持续 ${duration} 月, 80%@${reached80?.month ?? "未到"}, 95%@${reached95?.month ?? "未到"}`);
    }
  }
}

if (process.argv[1]?.includes("diagnoseWars")) {
  const months = Number(process.argv[2] ?? 120);
  const seed = Number(process.argv[3] ?? 157301);
  main(months, seed);
}