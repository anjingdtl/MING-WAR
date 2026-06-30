/**
 * hash:state — v0.6-stability-design §4.3
 *
 * 打印 seed=7 在第 0/12/120/240/1080 月的状态哈希。
 * 用于：
 * - 跨版本回归对比
 * - 读档验证
 * - Worker 一致性验证
 */

import { simulateMonth } from "../core/simulation";
import { computeStateHash } from "../core/stateHash";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

const SEED = 7;
const NODES = [0, 12, 120, 240, 1080];

function main(): void {
  const out: Array<{ month: number; date: string; hash: string }> = [];
  let state = createMvpScenario("ming", SEED);
  out.push({ month: 0, date: state.currentDate, hash: computeStateHash(state) });

  for (let m = 1; m <= Math.max(...NODES); m++) {
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed
    });
    state = result.nextState;
    if (NODES.includes(m)) {
      out.push({ month: m, date: state.currentDate, hash: computeStateHash(state) });
    }
  }
  console.log(JSON.stringify({ script: "hash:state", seed: SEED, nodes: out }, null, 2));
}

main();
