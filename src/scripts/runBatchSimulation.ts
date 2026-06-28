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
}

export function runBatchSimulation(runs = 100, months = 240): BatchSummary {
  let totalMingRegions = 0;
  let totalTopScore = 0;
  let totalReports = 0;
  let finishedRuns = 0;

  for (let index = 0; index < runs; index += 1) {
    let state = createMvpScenario("ming", 157301 + index);
    for (let month = 0; month < months && state.gameStatus !== "finished"; month += 1) {
      const result = simulateMonth({
        state,
        playerDecision: defaultPlayerDecision,
        randomSeed: state.seed
      });
      state = result.nextState;
    }
    totalMingRegions += Object.values(state.regions).filter((region) => region.controllerFactionId === "ming").length;
    totalTopScore += scoreAllFactions(state)[0]?.score ?? 0;
    totalReports += state.reports.length;
    if (state.gameStatus === "finished") {
      finishedRuns += 1;
    }
  }

  return {
    runs,
    months,
    averageMingRegions: Number((totalMingRegions / runs).toFixed(2)),
    averageTopScore: Number((totalTopScore / runs).toFixed(2)),
    averageReports: Number((totalReports / runs).toFixed(2)),
    finishedRuns
  };
}

if (process.argv[1]?.includes("runBatchSimulation")) {
  const runs = Number(process.argv[2] ?? 100);
  const months = Number(process.argv[3] ?? 240);
  console.log(JSON.stringify(runBatchSimulation(runs, months), null, 2));
}
