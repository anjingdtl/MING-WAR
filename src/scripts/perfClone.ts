/**
 * perf:clone — v0.6-stability-design §4.1
 *
 * 测量 structuredClone 不同体积 GameState 的耗时。
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

const SEED = 7;
const SAMPLE_MONTHS = [0, 240, 1080];
const ITERATIONS = 1000;

function buildAt(month: number) {
  let state = createMvpScenario("ming", SEED);
  for (let m = 0; m < month; m++) {
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed
    });
    state = result.nextState;
  }
  return state;
}

function measure(state: ReturnType<typeof buildAt>): { mean: number; p95: number; max: number; min: number } {
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = performance.now();
    structuredClone(state);
    const t1 = performance.now();
    samples.push(t1 - t0);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    mean: Number((sum / samples.length).toFixed(4)),
    p95: Number(sorted[Math.floor(samples.length * 0.95)].toFixed(4)),
    max: Number(Math.max(...samples).toFixed(4)),
    min: Number(Math.min(...samples).toFixed(4))
  };
}

function main(): void {
  const out = SAMPLE_MONTHS.map((m) => ({ atMonth: m, iterations: ITERATIONS, ...measure(buildAt(m)) }));
  console.log(JSON.stringify({ script: "perf:clone", seed: SEED, samples: out }, null, 2));
}

main();
