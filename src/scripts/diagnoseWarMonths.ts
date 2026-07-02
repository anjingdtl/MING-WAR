/**
 * diagnoseWarMonths.ts — T14-4 战争月份 / 持续时间诊断
 *
 * 跑一局并打印每月：
 *   - active war 数
 *   - 本月新建 war 数
 *   - at-war faction 数（attacker + defender 唯一集合）
 *   - 所有 war 的 progress 中位数
 *   - 当前最长 war 持续月数
 *
 * 终态：
 *   - 总战争数（240 月内）
 *   - 平均 war 持续月数
 *   - 和谈触发数（peace.ts 路径）
 *   - capture 触发数（resolveBattle 路径）
 *   - 完整周期比例（按 SPEC §9 DoD：战争月份中位 12–24 月）
 *
 * 用于验证 SPEC §4 + DoD：战争真实持续 / 不被一月推平。
 *
 * 用法：npx tsx src/scripts/diagnoseWarMonths.ts [months] [interval] [seed]
 *      （默认 120 月 / 间隔 6 月 / seed 157301）
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import type { GameState, WarState } from "../core/types";
import type { LedgerEntry } from "../core/ledger";

interface ClosedWarRecord {
  war: WarState;
  startedMonth: number;
  endedMonth: number;
  reason: "peace" | "capture" | "cutoff" | "ongoing";
}

function main(months = 120, interval = 6, seed = 157301): void {
  let state = createMvpScenario("ming", seed);

  console.log(`=== T14-4 War Months 诊断（${months} 月 / 间隔 ${interval} 月 / seed ${seed}）===\n`);
  console.log("日期       | active wars | new war | at-war factions | 中位 progress | 最长 war 月");
  console.log("-".repeat(105));

  const allWars: Map<string, { startedMonth: number; endedMonth: number | null; reason: string; war: WarState }> = new Map();
  let peaceCount = 0;
  let captureCount = 0;

  for (let m = 0; m < months; m += 1) {
    const warIdsBefore = new Set(state.wars.map((w) => w.id));

    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed + m,
    });
    state = result.nextState;

    // 检测本月新增的 war
    let newWar = 0;
    for (const war of state.wars) {
      if (!warIdsBefore.has(war.id) && !allWars.has(war.id)) {
        allWars.set(war.id, {
          startedMonth: m,
          endedMonth: null,
          reason: "ongoing",
          war,
        });
        newWar += 1;
      }
    }

    // 检测本月结束的 war（state.wars 比 warIdsBefore 少）
    for (const id of warIdsBefore) {
      if (!state.wars.some((w) => w.id === id)) {
        const rec = allWars.get(id);
        if (rec && rec.endedMonth === null) {
          rec.endedMonth = m;
          // 用 ledger 推断结束原因：capture 触发 income-tariff 战利品；peace 触发 truce 条约
          const monthLedger = state.ledgerHistory?.[state.ledgerHistory.length - 1]?.entries ?? [];
          const hasCapture = monthLedger.some(
            (e: LedgerEntry) => e.category === "income-tariff" && e.source?.includes("战利品")
          );
          if (hasCapture) {
            captureCount += 1;
            rec.reason = "capture";
          } else {
            // 默认算 peace
            peaceCount += 1;
            rec.reason = "peace";
          }
        }
      }
    }

    // 计算统计
    const activeCount = state.wars.length;
    const atWarFactions = new Set<string>();
    for (const war of state.wars) {
      atWarFactions.add(war.attackerFactionId);
      atWarFactions.add(war.defenderFactionId);
    }
    const medianProgress =
      state.wars.length > 0
        ? median(state.wars.map((w) => w.progress))
        : 0;
    let longestWar = 0;
    for (const w of state.wars) {
      const rec = allWars.get(w.id);
      if (rec) {
        longestWar = Math.max(longestWar, m - rec.startedMonth);
      }
    }

    if ((m + 1) % interval === 0 || m === 0) {
      console.log(
        `${state.currentDate} | ${activeCount.toString().padStart(10)} | ${newWar.toString().padStart(6)} | ${atWarFactions.size.toString().padStart(13)} | ${medianProgress.toFixed(0).padStart(13)} | ${longestWar.toString().padStart(10)}`
      );
    }
  }

  // 标记未结束
  for (const rec of allWars.values()) {
    if (rec.endedMonth === null) {
      rec.endedMonth = months;
      rec.reason = "cutoff";
    }
  }

  // 终结统计
  console.log(`\n=== 终点 (${state.currentDate}) ===`);
  const totalWars = allWars.size;
  const finishedWars = [...allWars.values()].filter((w) => w.reason !== "cutoff" && w.reason !== "ongoing");
  const ongoingWars = [...allWars.values()].filter((w) => w.endedMonth === months);
  const closedWars = [...allWars.values()].filter((w) => w.endedMonth !== null);

  const durations = closedWars.map((w) => (w.endedMonth ?? months) - w.startedMonth);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const medianDuration = median(durations);

  console.log(`总战争场次: ${totalWars}`);
  console.log(`已结束 war 数: ${finishedWars.length} | ongoing: ${ongoingWars.length}`);
  console.log(`平均 war 持续: ${avgDuration.toFixed(1)} 月 | 中位: ${medianDuration.toFixed(1)} 月`);
  console.log(`和谈触发次数: ${peaceCount}`);
  console.log(`Capture 触发次数: ${captureCount}`);
  console.log(`\n=== DoD 对照（SPEC §4 DoD） ===`);
  console.log(`期望战争月份中位 12-24 月 | 实测: ${medianDuration.toFixed(1)}`);
  console.log(`期望 war 真实持续 | 实测平均: ${avgDuration.toFixed(1)} 月`);
  if (medianDuration < 4) {
    console.log(`⚠️  中位 war 月份过短 (<4)，可能 v0.8 M1-M5 钳位失效`);
  } else if (medianDuration > 48) {
    console.log(`⚠️  中位 war 月份过长 (>48)，可能 peace 阈值过严`);
  } else {
    console.log(`✅ 中位 war 月份在 4-48 健康区间`);
  }

  console.log("\n=== 每场 war 清单（前 20）===");
  const sorted = [...allWars.values()].sort((a, b) => a.startedMonth - b.startedMonth).slice(0, 20);
  for (const rec of sorted) {
    const w = rec.war;
    const attackerName = state.factions[w.attackerFactionId]?.name ?? w.attackerFactionId;
    const defenderName = state.factions[w.defenderFactionId]?.name ?? w.defenderFactionId;
    const targetName = state.regions[w.targetRegionId]?.name ?? w.targetRegionId;
    const dur = (rec.endedMonth ?? months) - rec.startedMonth;
    console.log(
      `  月${rec.startedMonth.toString().padStart(3)}-${(rec.endedMonth ?? months).toString().padStart(3)} (${dur.toString().padStart(3)}月) ${attackerName} → ${defenderName} @ ${targetName} [${rec.reason}]`
    );
  }
  if (allWars.size > 20) {
    console.log(`  ... (+${allWars.size - 20} more)`);
  }
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

if (process.argv[1]?.includes("diagnoseWarMonths")) {
  const months = Number(process.argv[2] ?? 120);
  const interval = Number(process.argv[3] ?? 6);
  const seed = Number(process.argv[4] ?? 157301);
  main(months, interval, seed);
}
