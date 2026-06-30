/**
 * simulationPhases.test.ts — v0.6.1-patch B1
 *
 * 单元覆盖 runDiplomacyPhase 内 eliminateDefeatedFactions 对 dead faction 数值清理。
 */

import { describe, expect, it } from "vitest";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { createSimulationContext } from "../core/simulationContext";
import { freshTiming } from "../core/timing";
import { runDiplomacyPhase } from "../core/simulationPhases/runDiplomacyPhase";
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

describe("eliminateDefeatedFactions (v0.6.1-patch B1)", () => {
  it("zeros armyTotal and grainReserve", () => {
    const ctx = setupContext(7);
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
