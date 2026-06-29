import { describe, expect, it } from "vitest";
import type { FactionCliqueState, GameState } from "../core/types";
import { advancePoliticalMovements, CLIQUE_DEMAND } from "../core/politics";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

function setClique(
  state: GameState,
  cliqueId: string,
  over: Partial<FactionCliqueState>,
): FactionCliqueState {
  const cs = state.factions.ming.cliques.find((c) => c.cliqueId === cliqueId)!;
  Object.assign(cs, over);
  return cs;
}

describe("S3c: political movements", () => {
  it("a strong & displeased clique triggers a movement", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 60, approval: 20 });
    advancePoliticalMovements(state);
    expect(state.activeMovements?.length).toBe(1);
    expect(state.activeMovements![0].cliqueId).toBe("donglin");
    expect(state.activeMovements![0].demand).toBe(CLIQUE_DEMAND.donglin); // reduce-tax
    expect(state.activeMovements![0].progress).toBeGreaterThan(0);
  });

  it("a weak or content clique does not trigger", () => {
    const weak = createMvpScenario("ming", 1);
    setClique(weak, "donglin", { strength: 10, approval: 20 }); // strong enough? no
    advancePoliticalMovements(weak);
    expect(weak.activeMovements?.length ?? 0).toBe(0);

    const content = createMvpScenario("ming", 1);
    setClique(content, "donglin", { strength: 60, approval: 80 }); // not displeased
    advancePoliticalMovements(content);
    expect(content.activeMovements?.length ?? 0).toBe(0);
  });

  it("a successful reduce-tax movement applies a tax-cut modifier and raises support", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 80, approval: 10, support: 40 });
    let settled: ReturnType<typeof advancePoliticalMovements> = [];
    for (let i = 0; i < 30 && settled.length === 0; i++) {
      settled = advancePoliticalMovements(state);
    }
    // The movement should have settled within a few months (progress ~+27/mo).
    expect(settled.length).toBeGreaterThan(0);
    // S1 consequence loop: a reduce-tax modifier is now live on the faction.
    const mod = state.activeModifiers.find((m) => (m.effects["tax-mult"] ?? 0) !== 0);
    expect(mod).toBeDefined();
    expect(mod!.effects["tax-mult"]).toBeLessThan(0);
    // Support recovered (demand conceded) and the movement is cleared.
    const cs = state.factions.ming.cliques.find((c) => c.cliqueId === "donglin")!;
    expect(cs.support).toBeGreaterThan(40);
    expect(state.activeMovements?.length ?? 0).toBe(0);
  });

  it("improving approval stalls an ongoing movement (progress decays)", () => {
    const state = createMvpScenario("ming", 1);
    setClique(state, "donglin", { strength: 60, approval: 20 });
    advancePoliticalMovements(state); // trigger
    const prog1 = state.activeMovements![0].progress;
    setClique(state, "donglin", { approval: 70 }); // conditions improve
    advancePoliticalMovements(state);
    const prog2 = state.activeMovements![0].progress;
    expect(prog2).toBeLessThan(prog1);
  });
});

describe("S3d: end-to-end tax-hike → approval → movement chain", () => {
  it("a sustained tax hike sparks a political movement via simulateMonth", () => {
    const state = createMvpScenario("ming", 1);
    // Player imposes a heavy tax (faction tax-mult) and pivots to finance focus.
    state.activeModifiers.push({
      id: "tax-hike",
      label: "加征三饷",
      scope: "faction",
      targetId: "ming",
      remainingMonths: 999,
      effects: { "tax-mult": 0.6 },
    });
    const taxed = { ...defaultPlayerDecision, domesticFocus: "finance" as const };
    let s = state;
    let sparked = false;
    for (let i = 0; i < 36; i++) {
      s = simulateMonth({ state: s, playerDecision: taxed, randomSeed: s.seed }).nextState;
      const hasMovement =
        (s.activeMovements?.length ?? 0) > 0 ||
        s.activeModifiers.some((m) => m.id.startsWith("movement-"));
      if (hasMovement) {
        sparked = true;
        break;
      }
    }
    // The full S3 chain: tax hike → approval drop → a strong & displeased clique
    // pushes its demand. (Gentry, ~86 strength from peasant wealth, leads here.)
    expect(sparked).toBe(true);
  });
});
