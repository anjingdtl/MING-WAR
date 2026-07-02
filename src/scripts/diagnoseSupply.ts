/**
 * diagnoseSupply.ts — v0.9.2 粮秣 / 仓储 / 运输诊断
 *
 * 跑一局并打印每月：
 *   - 活跃 SupplyConvoy 数量与在途 payload 总和
 *   - 各 faction 控制区 depotStock 合计
 *   - 各 war 战线的 supplyRatio（< 0.5 → 严重缺粮）
 *   - 缺粮月份计数 + 围城报酬（plunder）次数
 *
 * 用于验证 v0.9.2 SPEC §4.2：补给约束真实生效，远征不会因"调兵"任意开打。
 *
 * 用法：npx tsx src/scripts/diagnoseSupply.ts [months] [interval] [seed]
 *      （默认 120 月 / 间隔 6 月 / seed 157301）
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { computeSupplyRatio } from "../core/supply";
import { applySupplyPressureMultiplier } from "../core/supply";
import type { GameState } from "../core/types";
import type { LedgerEntry } from "../core/ledger";

function main(months = 120, interval = 6, seed = 157301): void {
  let state = createMvpScenario("ming", seed);

  console.log(`=== v0.9.2 Supply 诊断（${months} 月 / 间隔 ${interval} 月 / seed ${seed}）===\n`);
  console.log("日期       | 在途车队 | 在途载荷 | ming depot | chahar depot | korchin depot | 平均 supplyRatio | 缺粮月");
  console.log("-".repeat(120));

  let shortageMonths = 0;
  let plunderCount = 0;
  let totalConvoysDispatched = 0;

  for (let m = 0; m < months; m += 1) {
    const convoysBefore = state.activeConvoys?.length ?? 0;
    const payloadBefore = (state.activeConvoys ?? []).reduce((s, c) => s + c.payload, 0);
    const beforeFactions = Object.fromEntries(
      Object.values(state.factions)
        .filter((f) => f.status === "active")
        .map((f) => [f.id, f] as const)
    );

    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed + m,
    });
    state = result.nextState;

    // 检视是否有新 convoy 被派出
    const convoysAfter = state.activeConvoys?.length ?? 0;
    if (convoysAfter > convoysBefore) {
      totalConvoysDispatched += convoysAfter - convoysBefore;
    }

    // 计算每月 war 的 supplyRatio 平均
    let ratioSum = 0;
    let ratioCount = 0;
    let monthShortage = 0;
    for (const war of state.wars) {
      const ratio = computeSupplyRatio(state, war.attackerFactionId, war.targetRegionId, 4);
      ratioSum += ratio;
      ratioCount += 1;
      const mult = applySupplyPressureMultiplier(ratio);
      if (mult < 1) monthShortage += 1;
    }
    if (monthShortage > 0) shortageMonths += 1;
    const avgRatio = ratioCount > 0 ? ratioSum / ratioCount : 1.0;

    // 检视本月 ledger 看是否有 capture plunder（income-tariff from siege）
    const monthLedger = state.ledgerHistory?.[state.ledgerHistory.length - 1]?.entries ?? [];
    const plunderEntries = monthLedger.filter(
      (e: LedgerEntry) => e.category === "income-tariff" && e.source?.includes("战利品")
    );
    if (plunderEntries.length > 0) plunderCount += 1;

    if ((m + 1) % interval === 0 || m === 0) {
      const mingDepot = sumFactionDepot(state, "ming");
      const chaharDepot = sumFactionDepot(state, "chahar");
      const korchinDepot = sumFactionDepot(state, "korchin_steppe_faction");
      console.log(
        `${state.currentDate} | ${convoysAfter.toString().padStart(7)} | ${Math.round(payloadBefore).toLocaleString().padStart(8)} | ${Math.round(mingDepot).toLocaleString().padStart(11)} | ${Math.round(chaharDepot).toLocaleString().padStart(12)} | ${Math.round(korchinDepot).toLocaleString().padStart(13)} | ${avgRatio.toFixed(2).padStart(17)} | ${monthShortage > 0 ? "⚠ " + monthShortage : "  0"}`
      );
    }
  }

  // 终态
  console.log(`\n=== 终点 (${state.currentDate}) ===`);
  console.log(`派出 Convoy 总数: ${totalConvoysDispatched} 支`);
  console.log(`在途车队: ${state.activeConvoys?.length ?? 0} 支`);
  console.log(`累计缺粮月份（任何 war supplyRatio < 0.5）: ${shortageMonths} / ${months}`);
  console.log(`发生 plunder（capture 战利品）月份数: ${plunderCount}`);

  console.log("\n=== 各势力仓储合计 ===");
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    const total = sumFactionDepot(state, faction.id);
    const factionConvoys = (state.activeConvoys ?? []).filter((c) => c.factionId === faction.id);
    const inFlight = factionConvoys.reduce((s, c) => s + c.payload, 0);
    console.log(`  ${faction.name.padEnd(20)} depot=${Math.round(total).toLocaleString().padStart(10)} 在途=${Math.round(inFlight).toLocaleString().padStart(8)} (${factionConvoys.length} 队)`);
  }

  // 异常检测
  console.log("\n=== 健康度诊断 ===");
  const totalDepot = Object.values(state.factions)
    .filter((f) => f.status === "active")
    .reduce((s, f) => s + sumFactionDepot(state, f.id), 0);
  console.log(`全势力 depot 合计: ${Math.round(totalDepot).toLocaleString()}`);
  if (shortageMonths / months > 0.5) {
    console.log(`⚠️  缺粮月份比例 ${((shortageMonths / months) * 100).toFixed(1)}% 偏高 — 检查 DEPOT_PRODUCTION_SHARE / SIEGE_WEEKLY_GRAIN`);
  } else {
    console.log(`✅ 缺粮月份比例 ${((shortageMonths / months) * 100).toFixed(1)}% 健康`);
  }
  if (totalConvoysDispatched === 0) {
    console.log("⚠️  全局 0 Convoy 派出 — 检查 dispatchSupplyConvoy 是否被 runWarPhase 调用");
  } else {
    console.log(`✅ 共派出 ${totalConvoysDispatched} 支 Convoy`);
  }
}

/**
 * 计算某 faction 控制的所有 region 的 depotStock 合计。
 */
function sumFactionDepot(state: GameState, factionId: string): number {
  let total = 0;
  for (const region of Object.values(state.regions)) {
    if (region.controllerFactionId === factionId && region.logisticsNode) {
      total += region.logisticsNode.depotStock;
    }
  }
  return total;
}

if (process.argv[1]?.includes("diagnoseSupply")) {
  const months = Number(process.argv[2] ?? 120);
  const interval = Number(process.argv[3] ?? 6);
  const seed = Number(process.argv[4] ?? 157301);
  main(months, interval, seed);
}
