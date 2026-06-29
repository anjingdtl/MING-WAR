import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import type { GameState } from "../core/types";

/**
 * 数值健康诊断脚本：跑一局并按固定间隔打印关键指标快照，
 * 用于定位人口/财政/粮食/市场系统的数值崩溃源。
 *
 * 用法：npm run diagnose -- [months] [interval] [seed]
 */
function diagnose(months = 120, interval = 12, seed = 157301): void {
  let state = createMvpScenario("ming", seed);
  const initialPop = totalPopulation(state);

  console.log("=== 诊断起点 ===");
  const startMing = state.factions.ming;
  console.log(`大明: 国库 ${startMing.treasury.toLocaleString()} 粮储 ${startMing.grainReserve.toLocaleString()} 军队 ${startMing.armyTotal.toLocaleString()}`);
  console.log(`初始总人口: ${initialPop.toLocaleString()}  地区数: ${Object.keys(state.regions).length}`);
  const probe = state.regions.beizhili;
  if (probe) {
    const gpc = probe.grainStock / (probe.population * 0.25);
    console.log(`北直隶: 人口 ${probe.population.toLocaleString()} 粮储 ${probe.grainStock.toLocaleString()} 人均粮(grainPerCapita) ${gpc.toFixed(3)}`);
  }
  console.log("\n=== 月度轨迹 ===");
  console.log("日期      | 大明国库      | 大明粮储      | 军队     | 控制区 | 状态    | 总人口           | 总流民       | 均需满足 | 均激进 | 均粮价 | 均白银");

  let stepsTaken = 0;
  let prevGroups = totalGroupsSize(state);
  for (let m = 0; m < months && state.gameStatus !== "finished"; m += 1) {
    if (m % interval === 0) printRow(state);
    const result = simulateMonth({ state, playerDecision: defaultPlayerDecision, randomSeed: state.seed });
    state = result.nextState;
    stepsTaken = m + 1;
    // 守恒审计：popGroups size 总量若跳变，说明某子系统凭空增减人口
    const curGroups = totalGroupsSize(state);
    if (m < 60 && Math.abs(curGroups - prevGroups) > 1000) {
      const migrantTotal = totalMigrantSize(state);
      console.log(`  [审计 月${m + 1}] popGroups总量: ${prevGroups.toLocaleString()} → ${curGroups.toLocaleString()} (Δ${(curGroups - prevGroups).toLocaleString()}) | 流民总量 ${migrantTotal.toLocaleString()}`);
    }
    prevGroups = curGroups;
  }
  printRow(state);

  const finalMing = state.factions.ming;
  console.log(`\n=== 诊断终点 (第 ${stepsTaken} 月) ===`);
  console.log(`大明: 国库 ${finalMing.treasury.toLocaleString()} 粮储 ${finalMing.grainReserve.toLocaleString()} 军队 ${finalMing.armyTotal.toLocaleString()} 状态 ${finalMing.status}`);
  const finalPop = totalPopulation(state);
  console.log(`总人口变化: ${initialPop.toLocaleString()} → ${finalPop.toLocaleString()}  (${(((finalPop - initialPop) / initialPop) * 100).toFixed(1)}%)`);

  // 人口构成审计：定位 popGroups 守恒破坏
  const breakdown = Object.values(state.regions)
    .map((r) => ({
      name: r.name,
      controller: r.controllerFactionId,
      pop: r.population,
      groupSum: (r.popGroups ?? []).reduce((s, g) => s + g.size, 0),
      migrants: (r.popGroups ?? []).find((g) => g.type === "migrant")?.size ?? 0
    }))
    .sort((a, b) => b.pop - a.pop)
    .slice(0, 6);
  console.log("\n人口前6地区: 名称 | 控制者 | population | popGroups总和 | 流民");
  for (const b of breakdown) {
    console.log(`  ${b.name} | ${b.controller} | ${b.pop.toLocaleString()} | ${b.groupSum.toLocaleString()} | ${b.migrants.toLocaleString()}`);
  }
}

function printRow(state: GameState): void {
  const ming = state.factions.ming;
  const controlledRegions = Object.values(state.regions).filter((r) => r.controllerFactionId === "ming").length;
  const pop = totalPopulation(state);
  let migrants = 0;
  let needsSum = 0;
  let radSum = 0;
  let groupCount = 0;
  for (const r of Object.values(state.regions)) {
    if (!r.popGroups) continue;
    for (const g of r.popGroups) {
      if (g.type === "migrant") migrants += g.size;
      needsSum += g.needsSatisfaction;
      radSum += g.radicalism;
      groupCount += 1;
    }
  }
  let grainPriceSum = 0;
  let silverSum = 0;
  let marketCount = 0;
  for (const r of Object.values(state.regions)) {
    if (!r.market) continue;
    grainPriceSum += r.market.prices.grain;
    silverSum += r.market.silverStock;
    marketCount += 1;
  }
  const avgNeeds = groupCount > 0 ? Math.round(needsSum / groupCount) : 0;
  const avgRad = groupCount > 0 ? Math.round(radSum / groupCount) : 0;
  const avgGrain = marketCount > 0 ? (grainPriceSum / marketCount).toFixed(2) : "n/a";
  const avgSilver = marketCount > 0 ? Math.round(silverSum / marketCount) : 0;
  console.log(
    `${state.currentDate} | ${pad(ming.treasury)} | ${pad(ming.grainReserve)} | ${pad(ming.armyTotal)} | ${String(controlledRegions).padStart(6)} | ${ming.status.padEnd(7)} | ${pad(pop)} | ${pad(migrants)} | ${String(avgNeeds).padStart(7)} | ${String(avgRad).padStart(6)} | ${String(avgGrain).padStart(6)} | ${String(avgSilver).padStart(6)}`
  );
}

function totalPopulation(state: GameState): number {
  return Object.values(state.regions).reduce((sum, r) => sum + r.population, 0);
}

function totalGroupsSize(state: GameState): number {
  return Object.values(state.regions).reduce(
    (sum, r) => sum + (r.popGroups ?? []).reduce((s, g) => s + g.size, 0),
    0
  );
}

function totalMigrantSize(state: GameState): number {
  return Object.values(state.regions).reduce(
    (sum, r) => sum + (r.popGroups ?? []).filter((g) => g.type === "migrant").reduce((s, g) => s + g.size, 0),
    0
  );
}

function pad(n: number): string {
  return Math.round(n).toLocaleString().padStart(13);
}

if (process.argv[1]?.includes("diagnoseSimulation")) {
  const months = Number(process.argv[2] ?? 120);
  const interval = Number(process.argv[3] ?? 12);
  const seed = Number(process.argv[4] ?? 157301);
  diagnose(months, interval, seed);
}
