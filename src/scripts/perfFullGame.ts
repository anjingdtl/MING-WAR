/**
 * perf:fullgame — v0.6-stability-design §4.1
 *
 * 测量完整游戏周期（1080 月）耗时。3 种子并行（实际串行，避免内存压力）。
 * 跑完后跑不变量校验，输出报告。
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { validateInvariants } from "../core/invariants";

const SEEDS = [7, 13, 42];
const FULL_GAME_MONTHS = 1080;

function runOne(seed: number): { months: number; totalMs: number; errors: number; date: string } {
  let state = createMvpScenario("ming", seed);
  const t0 = performance.now();
  for (let m = 0; m < FULL_GAME_MONTHS; m++) {
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed
    });
    state = result.nextState;
  }
  const t1 = performance.now();
  const violations = validateInvariants(state);
  const errors = violations.filter((v) => v.severity === "error").length;
  return { months: FULL_GAME_MONTHS, totalMs: t1 - t0, errors, date: state.currentDate };
}

function main(): void {
  const out = SEEDS.map((s) => ({ seed: s, ...runOne(s) }));
  const totalMs = out.reduce((a, b) => a + b.totalMs, 0);
  const result = {
    script: "perf:fullgame",
    seeds: SEEDS,
    monthsPerSeed: FULL_GAME_MONTHS,
    totalMs: Number(totalMs.toFixed(3)),
    perSeed: out
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
