/**
 * saveValidation.test.ts — v0.6-stability §5.20
 *
 * 9 步校验逐项覆盖。
 */

import { describe, expect, it } from "vitest";
import { validateSaveFile, CURRENT_SAVE_VERSION } from "../save/saveValidation";
import { LocalSimulationService } from "../runtime/localSimulationService";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { GAME_VERSION } from "../core/version";

async function buildValidSave() {
  const svc = new LocalSimulationService();
  await svc.startGame({ factionId: "ming", seed: 7 });
  await svc.advanceMonth(defaultPlayerDecision);
  return svc.saveGame("test");
}

describe("validateSaveFile", () => {
  it("accepts a valid SerializedSave", async () => {
    const save = await buildValidSave();
    const result = validateSaveFile(save);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects non-object", () => {
    const r1 = validateSaveFile(null);
    expect(r1.ok).toBe(false);
    expect(r1.errors[0]).toMatch(/对象/);
    const r2 = validateSaveFile(42);
    expect(r2.ok).toBe(false);
  });

  it("rejects wrong format", async () => {
    const save = await buildValidSave();
    const r = validateSaveFile({ ...save, format: "other-save" });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/格式标识/);
  });

  it("rejects unknown saveVersion", async () => {
    const save = await buildValidSave();
    const r = validateSaveFile({ ...save, saveVersion: 999 });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/saveVersion/);
  });

  it("rejects missing required fields", () => {
    const r = validateSaveFile({ format: "ming-war-save", saveVersion: 1 });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("rejects checksum mismatch", async () => {
    const save = await buildValidSave();
    const r = validateSaveFile({ ...save, checksum: "0".repeat(40) });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/checksum/);
  });

  it("rejects dangling region faction reference", async () => {
    const save = await buildValidSave();
    const mutated = structuredClone(save);
    const firstRegion = Object.values(mutated.state.regions)[0];
    firstRegion.controllerFactionId = "nonexistent-faction";
    const r = validateSaveFile(mutated);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /引用不存在/.test(e))).toBe(true);
  });

  it("rejects NaN in numeric fields", async () => {
    const save = await buildValidSave();
    const mutated = structuredClone(save);
    mutated.state.factions.ming.treasury = Number.NaN;
    const r = validateSaveFile(mutated);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /NaN/.test(e))).toBe(true);
  });

  it("rejects invalid date format", async () => {
    const save = await buildValidSave();
    const mutated = structuredClone(save);
    mutated.state.currentDate = "not-a-date";
    const r = validateSaveFile(mutated);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /currentDate/.test(e))).toBe(true);
  });

  it("warns on date out of expected range", async () => {
    const save = await buildValidSave();
    const mutated = structuredClone(save);
    mutated.state.currentDate = "1500-01";
    const r = validateSaveFile(mutated);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("CURRENT_SAVE_VERSION is 1", () => {
    expect(CURRENT_SAVE_VERSION).toBe(1);
  });

  it("accepts a state with no player faction set (boundary)", () => {
    const state = createMvpScenario("ming", 1);
    const minimal = {
      format: "ming-war-save" as const,
      saveVersion: 1,
      gameVersion: GAME_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      checksum: "x".repeat(40),
      metadata: { currentDate: "1573-01" },
      state,
      decision: defaultPlayerDecision
    };
    // 不强制 metadata 完整
    const r = validateSaveFile(minimal);
    // checksum 错误会失败（因为是 fake），但不应有结构性错误
    expect(r.errors.some((e) => /checksum/.test(e))).toBe(true);
    expect(r.errors.filter((e) => !/checksum/.test(e))).toHaveLength(0);
  });
});
