/**
 * perf:year — v0.6-stability-design §4.1
 *
 * 测量 12 月连续推进耗时（10 轮）。
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

const SEED = 7;
const ROUNDS = Number(process.env.PERF_YEAR_ROUNDS ?? 10);
const MONTHS = 12;

function main(): void {
  const totals: number[] = [];
  const perMonth: number[] = [];

  for (let r = 0; r < ROUNDS; r++) {
    let state = createMvpScenario("ming", SEED + r);
    const t0 = performance.now();
    for (let m = 0; m < MONTHS; m++) {
      const tm0 = performance.now();
      const result = simulateMonth({
        state,
        playerDecision: defaultPlayerDecision,
        randomSeed: state.seed
      });
      const tm1 = performance.now();
      perMonth.push(tm1 - tm0);
      state = result.nextState;
    }
    const t1 = performance.now();
    totals.push(t1 - t0);
  }

  const sum = totals.reduce((a, b) => a + b, 0);
  const mean = sum / totals.length;
  const pSum = perMonth.reduce((a, b) => a + b, 0);
  const result = {
    script: "perf:year",
    seed: SEED,
    rounds: ROUNDS,
    monthsPerRound: MONTHS,
    totalMs: {
      mean: Number(mean.toFixed(3)),
      min: Number(Math.min(...totals).toFixed(3)),
      max: Number(Math.max(...totals).toFixed(3))
    },
    perMonthMs: {
      mean: Number((pSum / perMonth.length).toFixed(3)),
      min: Number(Math.min(...perMonth).toFixed(3)),
      max: Number(Math.max(...perMonth).toFixed(3))
    }
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
