/**
 * determinism.test.ts — v0.6-stability §6 + §8.4
 *
 * 确定性测试：同 seed + 同决策 → 两次执行得到完全相同的 state hash。
 * 这是 CI 红线之一：确定性哈希变化必须有 `// DETERMINISM-CHANGE: <reason>`
 * 注释 + PROGRESS.md 同步。
 */

import { describe, expect, it } from "vitest";
import { simulateMonth } from "../core/simulation";
import { computeStateHash } from "../core/stateHash";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

function runMonths(seed: number, count: number): string {
  let state = createMvpScenario("ming", seed);
  for (let m = 0; m < count; m++) {
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed
    });
    state = result.nextState;
  }
  return computeStateHash(state);
}

// Long simulations need a higher timeout (120 months × 2 runs ~ 10s in CI)
const LONG_TIMEOUT = 30_000;
const SHORT_TIMEOUT = 5_000;

describe("determinism (hash stability)", () => {
  it("seed=7, 12 months: two independent runs yield same hash", () => {
    const a = runMonths(7, 12);
    const b = runMonths(7, 12);
    expect(a).toBe(b);
  }, SHORT_TIMEOUT);

  it("seed=7, 120 months: two independent runs yield same hash", () => {
    const a = runMonths(7, 120);
    const b = runMonths(7, 120);
    expect(a).toBe(b);
  }, LONG_TIMEOUT);

  it("seed=42, 12 months: different seed yields different hash from seed=7", () => {
    const a = runMonths(7, 12);
    const b = runMonths(42, 12);
    expect(a).not.toBe(b);
  }, SHORT_TIMEOUT);

  it("hash format is stable 40-char hex", () => {
    const h = runMonths(7, 12);
    expect(h).toMatch(/^[0-9a-f]{40}$/);
  }, SHORT_TIMEOUT);
});
