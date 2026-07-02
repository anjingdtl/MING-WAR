/**
 * diagnoseExhaustion.ts — v0.9.4 战争疲劳 / 厌战诊断
 *
 * 跑一局并打印每月：
 *   - 各 active faction 的 warFatigue（0..130+）
 *   - 越过 deescalate 阈值（70）的 faction 数
 *   - 越过 warWear 阈值（100）的 faction 数 — 触发 stability -2/月 + treasury × 5%
 *   - 累计 warWear 财政流失（'expense-court' 走账本）
 *   - 累计战疲减员 / 兵力衰减
 *
 * 用于验证 v0.9.4 SPEC §4.5：长期战争反噬政权。
 *
 * 用法：npx tsx src/scripts/diagnoseExhaustion.ts [months] [interval] [seed]
 *      （默认 120 月 / 间隔 6 月 / seed 157301）
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { deescalateWeightBonus } from "../core/exhaustion";
import type { FactionState, GameState } from "../core/types";
import type { LedgerEntry } from "../core/ledger";

function main(months = 120, interval = 6, seed = 157301): void {
  let state = createMvpScenario("ming", seed);

  console.log(`=== v0.9.4 Exhaustion 诊断（${months} 月 / 间隔 ${interval} 月 / seed ${seed}）===\n`);
  console.log(
    "日期       | ming fatigue | chahar fatigue | korchin fatigue | deescalate | warWear | 累计流失"
  );
  console.log("-".repeat(110));

  let totalWarWearActivations = 0;
  let totalTreasuryLoss = 0;
  const fatigueHistory: Array<{
    month: number;
    factionId: string;
    prev: number;
    curr: number;
    crossedWarWear: boolean;
  }> = [];

  for (let m = 0; m < months; m += 1) {
    // 记录前值（用以检测跨越）
    const prevFatigue: Record<string, number> = {};
    for (const f of Object.values(state.factions)) {
      if (f.status === "active") {
        prevFatigue[f.id] = (f as FactionState & { warFatigue?: number }).warFatigue ?? 0;
      }
    }

    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed + m,
    });
    state = result.nextState;

    // 越过 warWear (100) 的累计次数
    let deescalate = 0;
    let warWear = 0;
    let monthLoss = 0;
    for (const f of Object.values(state.factions)) {
      if (f.status !== "active") continue;
      const curr = (f as FactionState & { warFatigue?: number }).warFatigue ?? 0;
      const prev = prevFatigue[f.id] ?? 0;
      if (curr >= 70) deescalate += 1;
      const crossedWarWear = prev < 100 && curr >= 100;
      if (crossedWarWear) totalWarWearActivations += 1;
      if (curr >= 100) warWear += 1;
      if (crossedWarWear) {
        fatigueHistory.push({ month: m, factionId: f.id, prev, curr, crossedWarWear: true });
      }
    }

    // 累计 treasury 流失（'expense-court' 走账本）
    const monthLedger = state.ledgerHistory?.[state.ledgerHistory.length - 1]?.entries ?? [];
    for (const e of monthLedger as LedgerEntry[]) {
      if (e.category === "expense-court" && e.source?.includes("厌战消耗")) {
        monthLoss += Math.abs(e.amount);
      }
    }
    totalTreasuryLoss += monthLoss;

    if ((m + 1) % interval === 0 || m === 0) {
      const fids = ["ming", "chahar", "korchin"];
      const fatRow = fids.map((fid) => {
        const f = state.factions[fid];
        const fat = f ? ((f as FactionState & { warFatigue?: number }).warFatigue ?? 0) : 0;
        return fat.toFixed(1).padStart(11);
      });
      console.log(
        `${state.currentDate} | ${fatRow[0]} | ${fatRow[1]} | ${fatRow[2]} | ${deescalate.toString().padStart(7)} | ${warWear.toString().padStart(6)} | ${Math.round(totalTreasuryLoss).toLocaleString().padStart(10)}`
      );
    }
  }

  console.log(`\n=== 终点 (${state.currentDate}) ===`);
  console.log(`累计 warWear 激活次数: ${totalWarWearActivations}`);
  console.log(`累计战疲财政流失: ${Math.round(totalTreasuryLoss).toLocaleString()}`);

  // 终态各 faction warFatigue
  console.log("\n=== 终态各 faction warFatigue ===");
  const sortedFatigue = Object.values(state.factions)
    .filter((f) => f.status === "active")
    .map((f) => ({
      faction: f,
      fatigue: (f as FactionState & { warFatigue?: number }).warFatigue ?? 0,
    }))
    .sort((a, b) => b.fatigue - a.fatigue);
  for (const { faction, fatigue } of sortedFatigue) {
    const bonus = deescalateWeightBonus(faction);
    const tag = fatigue >= 100 ? "warWear" : fatigue >= 70 ? "deescalate" : "常态";
    console.log(
      `  ${faction.name.padEnd(20)} fatigue=${fatigue.toFixed(1).padStart(6)} deescalate_w=${bonus.toString().padStart(4)} [${tag}]`
    );
  }

  // 越过阈值时间线
  console.log("\n=== warWear 首次触发时间线 ===");
  for (const h of fatigueHistory.slice(0, 10)) {
    const fname = state.factions[h.factionId]?.name ?? h.factionId;
    console.log(`  月 ${h.month}: ${fname} ${h.prev.toFixed(1)} → ${h.curr.toFixed(1)} (跨越 100)`);
  }
  if (fatigueHistory.length > 10) {
    console.log(`  ... (+${fatigueHistory.length - 10} more)`);
  }

  // 健康度
  console.log("\n=== 健康度诊断 ===");
  if (totalWarWearActivations === 0 && months >= 48) {
    console.log(`⚠️  ${months} 月内无 faction 触发 warWear — 检查 FATIGUE_BASE / DEESCALATE 阈值是否过严`);
  } else {
    console.log(`✅ warWear 触发 ${totalWarWearActivations} 次，疲劳机制有效`);
  }
  const avgFatigue =
    sortedFatigue.reduce((s, x) => s + x.fatigue, 0) / Math.max(1, sortedFatigue.length);
  console.log(`ℹ️  终态平均 fatigue: ${avgFatigue.toFixed(1)}（期望：长期 1+ 势力超过 100）`);
}

if (process.argv[1]?.includes("diagnoseExhaustion")) {
  const months = Number(process.argv[2] ?? 120);
  const interval = Number(process.argv[3] ?? 6);
  const seed = Number(process.argv[4] ?? 157301);
  main(months, interval, seed);
}
