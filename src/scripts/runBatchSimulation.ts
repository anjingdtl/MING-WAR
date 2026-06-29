import { simulateMonth } from "../core/simulation";
import { scoreAllFactions } from "../core/scoring";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

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
        const result = simulateMonth({
          state,
          playerDecision: defaultPlayerDecision,
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
      // Compute end date as YYYYMM number for averaging
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
  }

  // Compute average end date as YYYY-MM string
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
    averageEndDate
  };
}

if (process.argv[1]?.includes("runBatchSimulation")) {
  const runs = Number(process.argv[2] ?? 100);
  const months = Number(process.argv[3] ?? 240);
  console.log(JSON.stringify(runBatchSimulation(runs, months), null, 2));
}