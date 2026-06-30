import { simulateMonth } from "../core/simulation";
import { scoreAllFactions } from "../core/scoring";
import { createMvpScenario } from "../data/scenarios";
import { chooseAiDecision } from "../core/ai";
import { BASE_PRICES } from "../core/market";

export interface BatchSummary {
  runs: number;
  months: number;
  averageMingRegions: number;
  averageTopScore: number;
  averageReports: number;
  finishedRuns: number;
  errorRuns: number;
  errorMessages: string[];
  mingSurvivalRate: number;
  totalTreasuryDelta: number;
  totalPopulationDelta: number;
  averageEndDate: string;
  // P2 metrics
  averageMigrantPopulation: number;
  averagePeasantRadicalism: number;
  // P3 metrics
  averageGrainPrice: number;
  averageSilverStock: number;
  averageIndustryLevel: number;
  // P1 metrics
  totalLedgerEntries: number;
}

/**
 * Run batch simulation with error tracking and survival statistics.
 * Each run starts from a fresh scenario with a unique seed.
 */
export function runBatchSimulation(runs = 100, months = 240): BatchSummary {
  let totalMingRegions = 0;
  let totalTopScore = 0;
  let totalReports = 0;
  let finishedRuns = 0;
  let errorRuns = 0;
  let mingSurvived = 0;
  let totalTreasuryDelta = 0;
  let totalPopulationDelta = 0;
  let totalMigrantPopulation = 0;
  let totalPeasantRadicalism = 0;
  let totalGrainPrice = 0;
  let totalSilverStock = 0;
  let totalIndustryLevel = 0;
  let totalLedgerEntries = 0;
  let endDateSum = 0;
  let endDateCount = 0;
  const errorMessages: string[] = [];

  for (let index = 0; index < runs; index += 1) {
    let state = createMvpScenario("ming", 157301 + index);
    const initialTreasury = state.factions.ming.treasury;
    const initialPopulation = Object.values(state.regions).reduce(
      (sum, r) => sum + r.population,
      0
    );

    try {
      for (let month = 0; month < months && state.gameStatus !== "finished"; month += 1) {
        // S6: 批量为"无玩家干预的自动历史推演"——player faction 也由 AI 决策，
        // 让不同 seed 的 AI 选择产生多样结局（中兴 / 偏安 / 衰亡），满足 SPEC
        // S6"多种结局在批量模拟中出现"。手动游戏时玩家自行决策。
        const result = simulateMonth({
          state,
          playerDecision: chooseAiDecision(state, state.playerFactionId),
          randomSeed: state.seed
        });
        state = result.nextState;
      }
    } catch (err) {
      errorRuns += 1;
      const msg = err instanceof Error ? err.message : String(err);
      errorMessages.push(`Run ${index}: ${msg}`);
    }

    // Survival tracking
    if (state.factions.ming?.status === "active") {
      mingSurvived += 1;
    }

    // Aggregates
    totalMingRegions += Object.values(state.regions).filter(
      (region) => region.controllerFactionId === "ming"
    ).length;
    totalTopScore += scoreAllFactions(state)[0]?.score ?? 0;
    totalReports += state.reports.length;
    if (state.gameStatus === "finished") {
      finishedRuns += 1;
      const [year, m] = state.currentDate.split("-").map(Number);
      endDateSum += year * 12 + m;
      endDateCount += 1;
    }
    totalTreasuryDelta += state.factions.ming.treasury - initialTreasury;
    const finalPopulation = Object.values(state.regions).reduce(
      (sum, r) => sum + r.population,
      0
    );
    totalPopulationDelta += finalPopulation - initialPopulation;

    // P2: pop group aggregates
    let runMigrants = 0;
    let runPeasantRadicalism = 0;
    let runPeasantCount = 0;
    for (const region of Object.values(state.regions)) {
      if (!region.popGroups) continue;
      for (const g of region.popGroups) {
        if (g.type === "migrant") runMigrants += g.size;
        if (g.type === "peasant") {
          runPeasantRadicalism += g.radicalism * g.size;
          runPeasantCount += g.size;
        }
      }
    }
    totalMigrantPopulation += runMigrants;
    totalPeasantRadicalism += runPeasantCount > 0 ? runPeasantRadicalism / runPeasantCount : 0;

    // P3: market aggregates
    let runGrainPrice = 0;
    let runSilverStock = 0;
    let runIndustryLevel = 0;
    let regionCount = 0;
    for (const region of Object.values(state.regions)) {
      if (region.market) {
        runGrainPrice += region.market.prices.grain;
        runSilverStock += region.market.silverStock;
      }
      if (region.industries) {
        for (const i of region.industries) runIndustryLevel += i.level;
      }
      regionCount += 1;
    }
    if (regionCount > 0) {
      totalGrainPrice += runGrainPrice / regionCount;
      totalSilverStock += runSilverStock / regionCount;
      totalIndustryLevel += runIndustryLevel / regionCount;
    }

    // P1: ledger entries
    totalLedgerEntries += state.ledgerHistory?.reduce((s, l) => s + l.entries.length, 0) ?? 0;
  }

  let averageEndDate = "n/a";
  if (endDateCount > 0) {
    const avg = Math.round(endDateSum / endDateCount);
    const year = Math.floor(avg / 12);
    const month = avg - year * 12;
    averageEndDate = `${year}-${String(month).padStart(2, "0")}`;
  }

  return {
    runs,
    months,
    averageMingRegions: Number((totalMingRegions / runs).toFixed(2)),
    averageTopScore: Number((totalTopScore / runs).toFixed(2)),
    averageReports: Number((totalReports / runs).toFixed(2)),
    finishedRuns,
    errorRuns,
    errorMessages: errorMessages.slice(0, 10),
    mingSurvivalRate: Number((mingSurvived / runs).toFixed(2)),
    totalTreasuryDelta: Math.round(totalTreasuryDelta / runs),
    totalPopulationDelta: Math.round(totalPopulationDelta / runs),
    averageEndDate,
    averageMigrantPopulation: Math.round(totalMigrantPopulation / runs),
    averagePeasantRadicalism: Math.round(totalPeasantRadicalism / runs),
    averageGrainPrice: Number((totalGrainPrice / runs).toFixed(2)),
    averageSilverStock: Math.round(totalSilverStock / runs),
    averageIndustryLevel: Number((totalIndustryLevel / runs).toFixed(2)),
    totalLedgerEntries: Math.round(totalLedgerEntries / runs)
  };
}

if (process.argv[1]?.includes("runBatchSimulation")) {
  const runs = Number(process.argv[2] ?? 100);
  const months = Number(process.argv[3] ?? 240);
  console.log(JSON.stringify(runBatchSimulation(runs, months), null, 2));
}