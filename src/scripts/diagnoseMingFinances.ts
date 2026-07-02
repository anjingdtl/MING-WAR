/**
 * diagnoseMingFinances.ts — v0.8.2 大明财政诊断
 *
 * 跑一局并按月打印大明的：
 *   - income-tax（田赋）月度合计
 *   - expense-army-pay（军饷，含战地）月度合计
 *   - expense-bureaucrat（俸禄）月度合计
 *   - treasury / grainReserve 余额
 *
 * 用于定位 v0.8.2 待修复的"大明财政崩盘"主因。
 *
 * 用法：npx tsx src/scripts/diagnoseMingFinances.ts [months] [interval] [seed]
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import type { LedgerEntry } from "../core/ledger";

function main(months = 36, interval = 3, seed = 157301): void {
  let state = createMvpScenario("ming", seed);

  console.log("=== v0.8.2 大明财政诊断 ===\n");
  console.log("日期       | 月田赋      | 月军饷     | 月俸禄     | 月净流    | 国库余额    | 粮储余额    | 控制区");
  console.log("-".repeat(105));

  for (let m = 0; m < months; m += 1) {
    const beforeTreasury = state.factions.ming.treasury;
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed + m,
    });
    state = result.nextState;

    if ((m + 1) % interval === 0 || m === 0) {
      // 取本月 ledger（state.ledgerHistory 最后一项）
      const monthLedger = state.ledgerHistory?.[state.ledgerHistory.length - 1]?.entries ?? [];
      const mingEntries = monthLedger.filter(
        (e: LedgerEntry) => e.factionId === "ming"
      );
      const tax = sumCategory(mingEntries, "income-tax");
      const armyPay = sumCategory(mingEntries, "expense-army-pay");
      const bureaucrat = sumCategory(mingEntries, "expense-bureaucrat");
      const net = tax + armyPay + bureaucrat;
      const ming = state.factions.ming;
      const controlRegions = Object.values(state.regions).filter(
        (r) => r.controllerFactionId === "ming"
      ).length;
      console.log(
        `${state.currentDate} | ${fmt(tax)} | ${fmt(armyPay)} | ${fmt(bureaucrat)} | ${fmt(net)} | ${fmt(ming.treasury)} | ${fmt(ming.grainReserve)} | ${controlRegions}`
      );
    }
  }

  console.log(`\n=== 终点 (${state.currentDate}) ===`);
  const ming = state.factions.ming;
  console.log(`大明: 国库 ${ming.treasury.toLocaleString()} 粮储 ${ming.grainReserve.toLocaleString()} 军队 ${ming.armyTotal.toLocaleString()} 状态 ${ming.status}`);
  console.log(`总变动: ${(ming.treasury - 5000000).toLocaleString()} (从 500万 初始)`);

  // 最后 1 月分类聚合
  const monthLedger = state.ledgerHistory?.[state.ledgerHistory.length - 1]?.entries ?? [];
  console.log("\n=== 最后 1 月分类聚合（ming） ===");
  const mingLast = monthLedger.filter((e: LedgerEntry) => e.factionId === "ming");
  const aggregated: Record<string, number> = {};
  for (const e of mingLast) {
    aggregated[e.category] = (aggregated[e.category] ?? 0) + e.amount;
  }
  for (const [cat, amt] of Object.entries(aggregated).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
    console.log(`  ${cat.padEnd(25)} ${fmt(amt)}`);
  }
}

function sumCategory(entries: LedgerEntry[], cat: string): number {
  return entries.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
}

function fmt(n: number): string {
  const sign = n < 0 ? "-" : " ";
  return `${sign}${Math.abs(Math.round(n)).toLocaleString().padStart(10)}`;
}

main();