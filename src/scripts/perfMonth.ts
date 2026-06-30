/**
 * perf:month — v0.6-stability-design §4.1
 *
 * 测量单月模拟耗时。对同一 seed 运行 N 次 simulateMonth，输出 mean/p50/p95/max。
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

const SEED = 7;
const RUNS = Number(process.env.PERF_RUNS ?? 20);

function pct(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function main(): void {
  const state0 = createMvpScenario("ming", SEED);
  const samples: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    // 每次从同一初始 state 跑（不累积），保证可比性。
    const t0 = performance.now();
    simulateMonth({
      state: state0,
      playerDecision: defaultPlayerDecision,
      randomSeed: SEED + i
    });
    const t1 = performance.now();
    samples.push(t1 - t0);
  }

  const sum = samples.reduce((a, b) => a + b, 0);
  const mean = sum / samples.length;
  const result = {
    script: "perf:month",
    seed: SEED,
    runs: RUNS,
    meanMs: Number(mean.toFixed(3)),
    p50Ms: Number(pct(samples, 50).toFixed(3)),
    p95Ms: Number(pct(samples, 95).toFixed(3)),
    maxMs: Number(Math.max(...samples).toFixed(3)),
    minMs: Number(Math.min(...samples).toFixed(3))
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
