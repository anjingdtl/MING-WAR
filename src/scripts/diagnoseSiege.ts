/**
 * diagnoseSiege.ts — v0.9.3 围城 / 工事 / 战利品诊断
 *
 * 跑一局并打印每月：
 *   - 围城中的 region 数（state.wars.targetRegionId 计数）
 *   - 围城目标 garrison（capture 触发阈值 5000）
 *   - 围城目标 fortification 平均值
 *   - 围城维护费（'expense-construction' 走账本）累计
 *   - 成功 capture 次数 + 累计 plunder 金
 *   - capture 后 stability -15 / rebelPressure +5 受影响 region 数
 *
 * 用于验证 v0.9.3 SPEC §4.4：围城代价真实，让"打不动"和"打得动"是显式状态。
 *
 * 用法：npx tsx src/scripts/diagnoseSiege.ts [months] [interval] [seed]
 *      （默认 120 月 / 间隔 6 月 / seed 157301）
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import type { GameState } from "../core/types";
import type { LedgerEntry } from "../core/ledger";

function main(months = 120, interval = 6, seed = 157301): void {
  let state = createMvpScenario("ming", seed);

  console.log(`=== v0.9.3 Siege 诊断（${months} 月 / 间隔 ${interval} 月 / seed ${seed}）===\n`);
  console.log("日期       | 围城中region | garrison<5k | avg fort | 月费累计     | 本月capture | 累计 plunder");
  console.log("-".repeat(110));

  let totalCaptureCount = 0;
  let totalPlunder = 0;
  let totalSiegeMaintenance = 0;
  let totalSiegeMonths = 0;

  for (let m = 0; m < months; m += 1) {
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed + m,
    });
    state = result.nextState;

    // 计算围城指标
    const siegeTargetIds = new Set<string>();
    for (const war of state.wars) {
      siegeTargetIds.add(war.targetRegionId);
    }
    totalSiegeMonths += siegeTargetIds.size;

    let lowGarrisonCount = 0;
    let fortSum = 0;
    let fortCount = 0;
    for (const rid of siegeTargetIds) {
      const r = state.regions[rid];
      if (!r) continue;
      if (r.garrison < 5000) lowGarrisonCount += 1;
      fortSum += r.fortification;
      fortCount += 1;
    }
    const avgFort = fortCount > 0 ? fortSum / fortCount : 0;

    // 本月 ledger
    const monthLedger = state.ledgerHistory?.[state.ledgerHistory.length - 1]?.entries ?? [];
    let monthMaintenance = 0;
    let monthCapture = 0;
    let monthPlunder = 0;
    for (const e of monthLedger as LedgerEntry[]) {
      if (e.category === "expense-construction" && e.source?.includes("围城工事维护")) {
        monthMaintenance += Math.abs(e.amount);
        totalSiegeMaintenance += Math.abs(e.amount);
      }
      if (e.category === "income-tariff" && e.source?.includes("战利品")) {
        monthCapture += 1;
        totalCaptureCount += 1;
        monthPlunder += e.amount;
        totalPlunder += e.amount;
      }
    }

    if ((m + 1) % interval === 0 || m === 0) {
      console.log(
        `${state.currentDate} | ${siegeTargetIds.size.toString().padStart(10)} | ${lowGarrisonCount.toString().padStart(11)} | ${avgFort.toFixed(1).padStart(8)} | ${totalSiegeMaintenance.toLocaleString().padStart(12)} | ${monthCapture.toString().padStart(11)} | ${totalPlunder.toLocaleString().padStart(13)}`
      );
    }
  }

  console.log(`\n=== 终点 (${state.currentDate}) ===`);
  console.log(`累计 capture（plunder 触发）次数: ${totalCaptureCount}`);
  console.log(`累计 plunder 金: ${Math.round(totalPlunder).toLocaleString()}`);
  console.log(`累计围城维护费: ${Math.round(totalSiegeMaintenance).toLocaleString()}`);
  console.log(`围城地区月数（sum of siegeTargetIds over time）: ${totalSiegeMonths}`);

  // 围城稳定度分析
  console.log("\n=== 围城后 stability 受影响 region（前 10）===");
  const lowStabilityRegions = Object.values(state.regions)
    .filter((r) => r.stability < 50 && r.controllerFactionId !== null)
    .sort((a, b) => a.stability - b.stability)
    .slice(0, 10);
  for (const r of lowStabilityRegions) {
    console.log(`  ${r.name.padEnd(15)} stability=${r.stability.toFixed(0).padStart(3)} rebel=${r.rebelPressure.toFixed(0).padStart(3)} 控制=${r.controllerFactionId}`);
  }

  // 健康度
  console.log("\n=== 健康度诊断 ===");
  const totalSiegeAverage = totalSiegeMonths / months;
  if (totalCaptureCount === 0 && months >= 60) {
    console.log(`⚠️  ${months} 月内 0 次 capture — 检查 capture 阈值 garrison < 5000 是否过严，或战斗过弱`);
  } else {
    console.log(`✅ ${totalCaptureCount} 次 capture，平均围城 ${(totalSiegeAverage).toFixed(1)} region/月`);
  }
  const plunderPerCapture = totalCaptureCount > 0 ? Math.round(totalPlunder / totalCaptureCount) : 0;
  console.log(`ℹ️  平均每次 capture 掠夺: ${plunderPerCapture.toLocaleString()} 金`);
}

if (process.argv[1]?.includes("diagnoseSiege")) {
  const months = Number(process.argv[2] ?? 120);
  const interval = Number(process.argv[3] ?? 6);
  const seed = Number(process.argv[4] ?? 157301);
  main(months, interval, seed);
}
