/**
 * perf:save — v0.6-stability-design §4.1
 *
 * 测量存档 save/load 循环耗时与体积（用现有 IndexedDB 路径，Node 环境下跳过）。
 * 在 Node 环境下仅测量 JSON 序列化体积与 JSON parse/stringify 时间。
 */

import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { createSaveGame } from "../save/saveManager";

const SEED = 7;
const SAMPLE_MONTHS = [0, 240, 1080];
const ITERATIONS = 100;

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

function main(): void {
  const out = SAMPLE_MONTHS.map((m) => {
    const state = buildAt(m);
    const save = createSaveGame("perf-save", state, defaultPlayerDecision);
    const json = JSON.stringify(save);
    const bytes = json.length;

    const stringifySamples: number[] = [];
    const parseSamples: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const t0 = performance.now();
      const s = JSON.stringify(save);
      const t1 = performance.now();
      JSON.parse(s);
      const t2 = performance.now();
      stringifySamples.push(t1 - t0);
      parseSamples.push(t2 - t1);
    }
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      atMonth: m,
      iterations: ITERATIONS,
      jsonBytes: bytes,
      jsonKB: Number((bytes / 1024).toFixed(2)),
      stringifyMeanMs: Number(mean(stringifySamples).toFixed(4)),
      parseMeanMs: Number(mean(parseSamples).toFixed(4))
    };
  });
  console.log(JSON.stringify({ script: "perf:save", seed: SEED, samples: out }, null, 2));
}

main();
