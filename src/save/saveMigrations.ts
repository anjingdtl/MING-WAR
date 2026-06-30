/**
 * saveMigrations.ts — v0.6-stability-design §5.21
 *
 * 存档版本迁移链。
 *
 * 每次修改 `GameState` 结构时**必须**：
 * 1. CURRENT_SAVE_VERSION + 1
 * 2. 在 migrations 加一条 `migrateV<n>ToV<n+1>`
 * 3. 写测试覆盖新迁移
 *
 * 当前为 v0.6-stability：saveVersion 1（首个版本化存档）。
 * 旧 `v0.3.0` 字符串版本号的存档（无 format / saveVersion）由 migrateLegacyV030ToV1 处理。
 */

import type { GameState, PlayerDecision } from "../core/types";
import type { SerializedSave, SaveMetadata } from "../runtime/viewSnapshot";
import { CURRENT_SAVE_VERSION } from "./saveValidation";
import { computeStateHash } from "../core/stateHash";
import { GAME_VERSION } from "../core/version";

export type SaveMigration = (save: SerializedSave) => SerializedSave;

/** migrations：key = 目标版本，value = 迁移到该版本的函数。 */
export const migrations: Record<number, SaveMigration> = {
  // 当前没有 v0 → v1 的内联迁移；migrateLegacyV030ToV1 在 loadGame 入口处调用
};

/**
 * 把存档向前迁移到 CURRENT_SAVE_VERSION。
 * 不可降级（老存档只能向前升）。
 */
export function migrateSave(save: SerializedSave): SerializedSave {
  let current = save;
  while (current.saveVersion < CURRENT_SAVE_VERSION) {
    const next = current.saveVersion + 1;
    const mig = migrations[next];
    if (!mig) {
      throw new Error(`No migration registered for saveVersion ${next}`);
    }
    current = mig(current);
  }
  return current;
}

/* —— 老版本（字符串 version）兼容迁移 —— */

/** 老 SaveGame 格式（saveManager.ts v0.3.0）：{ id, name, savedAt, state, decision, version }。 */
export interface LegacyV030Save {
  id: string;
  name: string;
  savedAt: string;
  state: GameState;
  decision: PlayerDecision;
  version: string;
}

export function isLegacyV030Save(value: unknown): value is LegacyV030Save {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.savedAt === "string" &&
    typeof v.state === "object" &&
    typeof v.decision === "object" &&
    typeof v.version === "string"
  );
}

/**
 * 把老 v0.3.0 SaveGame 转换为新 v1 SerializedSave。
 * - state 走 migrateGameState（保留原有逻辑）
 * - metadata 用 savedAt + name + state 派生
 * - checksum 用新 state hash
 */
export function migrateLegacyV030ToV1(legacy: LegacyV030Save): SerializedSave {
  // state 内部数据迁移（clique 字段、administrationBase 等）
  const migratedState = migrateGameState(legacy.state);
  // metadata 派生
  const faction = migratedState.factions[migratedState.playerFactionId];
  const controlledRegions = Object.values(migratedState.regions).filter(
    (r) => r.controllerFactionId === migratedState.playerFactionId
  ).length;
  const metadata: SaveMetadata = {
    currentDate: migratedState.currentDate,
    playerFaction: migratedState.playerFactionId,
    gameVersion: GAME_VERSION,
    saveVersion: CURRENT_SAVE_VERSION,
    seed: migratedState.seed,
    status: faction?.status === "collapsed" ? "collapsed" : "active",
    controlledRegions,
    playTimeMinutes: 0,
    saveName: legacy.name
  };
  return {
    format: "ming-war-save",
    saveVersion: CURRENT_SAVE_VERSION,
    gameVersion: GAME_VERSION,
    createdAt: legacy.savedAt,
    updatedAt: legacy.savedAt,
    checksum: computeStateHash(migratedState),
    metadata,
    state: migratedState,
    decision: legacy.decision
  };
}

/**
 * 老 migrateGameState 逻辑（v0.3.0 → v0.3.0 内部兼容）。
 * 保留原行为：补 cliques + administrationBase。
 */
function migrateGameState(state: GameState): GameState {
  if (state.version === "0.3.0") return state;
  const migrated = structuredClone(state);
  for (const faction of Object.values(migrated.factions)) {
    if (!faction.cliques || faction.cliques.length === 0) {
      faction.cliques = [
        { cliqueId: "imperial", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "reform", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "donglin", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "eunuch", support: 50, strength: 0, activeModifier: 0, approval: 50 },
        { cliqueId: "frontier", support: 50, strength: 0, activeModifier: 0, approval: 50 }
      ];
    }
    faction.cliques = faction.cliques.map((cs) => ({
      cliqueId: cs.cliqueId,
      support: cs.support,
      strength: cs.strength,
      activeModifier: cs.activeModifier,
      approval: cs.approval ?? 50
    }));
    if (faction.administrationBase === undefined) {
      faction.administrationBase = faction.administration;
    }
  }
  migrated.version = "0.3.0";
  return migrated;
}
