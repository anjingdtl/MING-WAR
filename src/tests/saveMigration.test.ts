/**
 * saveMigration.test.ts — v0.6-stability §5.21
 *
 * 迁移链测试：
 * - 老 v0.3.0 SaveGame 字符串版本号 → 新 v1 SerializedSave
 * - 新 v1 直接通过
 * - 旧 v0.3.0 状态内部字段补全（cliques + administrationBase）
 */

import { describe, expect, it } from "vitest";
import { isLegacyV030Save, migrateLegacyV030ToV1, migrateSave } from "../save/saveMigrations";
import { validateSaveFile, CURRENT_SAVE_VERSION } from "../save/saveValidation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { LocalSimulationService } from "../runtime/localSimulationService";

describe("isLegacyV030Save", () => {
  it("detects old SaveGame format", () => {
    const state = createMvpScenario("ming", 1);
    const old = {
      id: "1",
      name: "old",
      savedAt: "2026-01-01",
      state,
      decision: defaultPlayerDecision,
      version: "0.3.0"
    };
    expect(isLegacyV030Save(old)).toBe(true);
  });

  it("rejects new SerializedSave format", async () => {
    const svc = new LocalSimulationService();
    await svc.startGame({ factionId: "ming", seed: 1 });
    const newSave = await svc.saveGame("test");
    expect(isLegacyV030Save(newSave)).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isLegacyV030Save(null)).toBe(false);
    expect(isLegacyV030Save(42)).toBe(false);
    expect(isLegacyV030Save("string")).toBe(false);
  });
});

describe("migrateLegacyV030ToV1", () => {
  it("converts old SaveGame to new SerializedSave with valid checksum", () => {
    const state = createMvpScenario("ming", 7);
    const old = {
      id: "1",
      name: "测试存档",
      savedAt: "2026-01-01T00:00:00Z",
      state,
      decision: defaultPlayerDecision,
      version: "0.3.0"
    };
    const newSave = migrateLegacyV030ToV1(old);
    expect(newSave.format).toBe("ming-war-save");
    expect(newSave.saveVersion).toBe(1);
    expect(newSave.metadata.saveName).toBe("测试存档");
    expect(newSave.metadata.playerFaction).toBe("ming");
    expect(validateSaveFile(newSave).ok).toBe(true);
  });

  it("backfills cliques on old faction state", () => {
    const state = createMvpScenario("ming", 1);
    // 模拟更老的存档（无 cliques 字段，version = 0.1.0）
    const oldState = structuredClone(state);
    oldState.version = "0.1.0";
    for (const f of Object.values(oldState.factions)) {
      delete (f as unknown as Record<string, unknown>).cliques;
      delete (f as unknown as Record<string, unknown>).administrationBase;
    }
    const old = {
      id: "1",
      name: "very old",
      savedAt: "2025-01-01",
      state: oldState,
      decision: defaultPlayerDecision,
      version: "0.3.0"
    };
    const migrated = migrateLegacyV030ToV1(old);
    for (const f of Object.values(migrated.state.factions)) {
      expect(f.cliques).toBeDefined();
      expect(f.cliques?.length).toBe(5);
      expect(f.administrationBase).toBeGreaterThan(0);
    }
  });
});

describe("migrateSave chain", () => {
  it("returns v1 unchanged", async () => {
    const svc = new LocalSimulationService();
    await svc.startGame({ factionId: "ming", seed: 1 });
    const save = await svc.saveGame("test");
    const migrated = migrateSave(save);
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
  });

  it("throws if migration is missing for next version", () => {
    expect(() => migrateSave({
      format: "ming-war-save",
      saveVersion: 0,
      gameVersion: "0.6.0",
      createdAt: "x",
      updatedAt: "x",
      checksum: "x".repeat(40),
      metadata: {
        currentDate: "1573-01",
        playerFaction: "ming",
        gameVersion: "0.6.0",
        saveVersion: 0,
        seed: 1,
        status: "active",
        controlledRegions: 0,
        playTimeMinutes: 0,
        saveName: "x"
      },
      state: createMvpScenario("ming", 1),
      decision: defaultPlayerDecision
    })).toThrow();
  });
});
