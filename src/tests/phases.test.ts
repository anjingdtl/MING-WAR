/**
 * phases.test.ts — v0.6-stability §2.8
 *
 * 阶段独立测试：每个 phase 函数能独立运行（构造最小 ctx）且不破坏
 * 权威状态基本不变量（不变量 error 数 = 0）。
 */

import { describe, expect, it } from "vitest";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { validateInvariants } from "../core/invariants";
import { createSimulationContext } from "../core/simulationContext";
import { freshTiming } from "../core/timing";
import { runRegionPhase } from "../core/simulationPhases/runRegionPhase";
import { runFactionPhase } from "../core/simulationPhases/runFactionPhase";
import { runDiplomacyPhase } from "../core/simulationPhases/runDiplomacyPhase";
import { runPoliticsPhase } from "../core/simulationPhases/runPoliticsPhase";
import { runSituationPhase } from "../core/simulationPhases/runSituationPhase";
import { runWarPhase } from "../core/simulationPhases/runWarPhase";
import { finalizeMonth } from "../core/simulationPhases/finalizeMonth";
import { createRandom } from "../core/random";
import { chooseAllAiDecisions } from "../core/ai";
import { normalizePlayerDecision } from "../core/decisions";

function setupContext(seed: number) {
  const state = createMvpScenario("ming", seed);
  const random = createRandom(seed);
  const playerDecision = normalizePlayerDecision(state, defaultPlayerDecision);
  const aiDecisions = chooseAllAiDecisions(state);
  return createSimulationContext(
    state,
    random,
    playerDecision,
    aiDecisions,
    [],
    [],
    freshTiming()
  );
}

describe("runRegionPhase (S2)", () => {
  it("advances one month without error and stays invariant-clean", () => {
    const ctx = setupContext(7);
    runRegionPhase(ctx);
    const violations = validateInvariants(ctx.state);
    const errors = violations.filter((v) => v.severity === "error");
    expect(errors).toHaveLength(0);
  });
});

describe("runFactionPhase (S3)", () => {
  it("settles maintenance without error and stays invariant-clean", () => {
    const ctx = setupContext(7);
    runFactionPhase(ctx);
    const violations = validateInvariants(ctx.state);
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });
});

describe("runDiplomacyPhase (S4)", () => {
  it("advances diplomacy and stays invariant-clean", () => {
    const ctx = setupContext(7);
    runDiplomacyPhase(ctx);
    const violations = validateInvariants(ctx.state);
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });
});

describe("runPoliticsPhase (S5)", () => {
  it("advances reforms + movements without error", () => {
    const ctx = setupContext(7);
    runPoliticsPhase(ctx);
    const violations = validateInvariants(ctx.state);
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });
});

describe("runSituationPhase (S6)", () => {
  it("advances situations without error", () => {
    const ctx = setupContext(7);
    runSituationPhase(ctx);
    const violations = validateInvariants(ctx.state);
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });
});

describe("runWarPhase (S7)", () => {
  it("runs battle + wars without error", () => {
    const ctx = setupContext(7);
    runWarPhase(ctx);
    const violations = validateInvariants(ctx.state);
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });
});

describe("finalizeMonth (S8)", () => {
  it("settles ledger + invariants + history without error", () => {
    const ctx = setupContext(7);
    finalizeMonth(ctx);
    const violations = validateInvariants(ctx.state);
    expect(violations.filter((v) => v.severity === "error")).toHaveLength(0);
    // history 应推一条
    expect(ctx.state.history.length).toBeGreaterThan(0);
  });
});

describe("eliminateDefeatedFactions (B1 v0.6.1-patch)", () => {
  it("zeros armyTotal and grainReserve when faction is eliminated", () => {
    const ctx = setupContext(7);
    // 模拟一个覆灭势力：所有地区都被 rebels 控制
    for (const r of Object.values(ctx.state.regions)) {
      r.controllerFactionId = "rebels";
    }
    const ming = ctx.state.factions.ming;
    ming.armyTotal = 12345;
    ming.grainReserve = 67890;
    runDiplomacyPhase(ctx);
    expect(ming.status).toBe("collapsed");
    expect(ming.armyTotal).toBe(0);
    expect(ming.grainReserve).toBe(0);
  });
});
