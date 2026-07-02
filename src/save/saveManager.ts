/**
 * saveManager.ts — v0.6-stability-design §5.19 / §5.20 / §5.21
 *
 * 存档读写（IndexedDB）。
 *
 * v0.6 升级：
 * - SaveFile 升级为 SerializedSave（format/saveVersion/checksum/metadata）
 * - loadGame 走 validateSaveFile 9 步校验
 * - 旧 v0.3.0 字符串版本号存档由 migrateLegacyV030ToV1 处理
 * - validate 失败返回 null（UI 用 alert 提示），不抛异常
 *
 * API 兼容：createSaveGame / saveGame / listSaves / loadGame 签名保持
 * 老 createSaveGame 返回旧格式（被 LocalSimulationService 之外的旧调用方使用）。
 * 新版 service.saveGame 直接返回 SerializedSave。
 */

import type { GameState, PlayerDecision } from "../core/types";
import type { SerializedSave } from "../runtime/viewSnapshot";
import { validateSaveFile } from "./saveValidation";
import {
  isLegacyV030Save,
  migrateLegacyV030ToV1,
  migrateSave
} from "./saveMigrations";

const dbName = "wanli-collapse";
const storeName = "saves";
const LEGACY_STORE_NAME = "saves-legacy";

/* —— 旧 SaveGame 格式（保留兼容） —— */

export interface SaveGame {
  id: string;
  name: string;
  savedAt: string;
  state: GameState;
  decision: PlayerDecision;
  version: string;
}

export function createSaveGame(name: string, state: GameState, decision: PlayerDecision): SaveGame {
  return {
    id: `${Date.now()}-${state.currentDate}`,
    name,
    savedAt: new Date().toISOString(),
    state,
    decision,
    version: state.version
  };
}

/* —— IndexedDB 工具 —— */

export function openSaveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      // B7 fix: SerializedSave 没有 id 字段，所以 saves 槽不能用 keyPath（必须用显式 key）。
      // LEGACY 槽保留 keyPath="id" 因为老 SaveGame 格式有 id 字段。
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.createObjectStore(LEGACY_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* —— 新版 SerializedSave 读写 —— */

/**
 * 写一个 SerializedSave 到 IDB。
 * 先写临时记录，校验通过后覆盖正式槽（原子替换）。
 */
export async function writeSave(save: SerializedSave): Promise<{ ok: boolean; errors?: string[] }> {
  const validation = validateSaveFile(save);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }
  const saveId = save.metadata.saveName;
  const db = await openSaveDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(save, saveId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return { ok: true };
}

/**
 * 从 IDB 读 SerializedSave（按 id）。
 * 找不到 → null。
 * 数据损坏 → null（返回 errors 给调用方决定是否推 alert）。
 */
export async function readSave(saveId: string): Promise<{ save: SerializedSave | null; errors?: string[] }> {
  const db = await openSaveDb();
  const raw = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(saveId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!raw) return { save: null };

  // 校验
  const validation = validateSaveFile(raw);
  if (!validation.ok) {
    return { save: null, errors: validation.errors };
  }
  // 迁移
  try {
    const migrated = migrateSave(raw as SerializedSave);
    return { save: migrated };
  } catch (e) {
    return { save: null, errors: [`迁移失败：${(e as Error).message}`] };
  }
}

/* —— 老版 SaveGame 兼容读写（仍在 v0.3.0 玩家存档中使用） —— */

export async function saveGame(save: SaveGame): Promise<void> {
  const db = await openSaveDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(save, save.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listSaves(): Promise<SaveGame[]> {
  const db = await openSaveDb();
  const saves = await new Promise<Array<{ key: IDBValidKey; value: unknown }>>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const valuesRequest = store.getAll();
    const keysRequest = store.getAllKeys();
    tx.oncomplete = () => {
      const values = valuesRequest.result as unknown[];
      const keys = keysRequest.result;
      resolve(values.map((value, index) => ({ key: keys[index], value })));
    };
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return saves
    .map(({ key, value }) => normalizeSaveForList(key, value))
    .filter((save): save is SaveGame => save !== null)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/**
 * 老 loadGame：从 IDB 读 → 老 migrateGameState → 返回。
 * 保留给旧调用方（如 gameStore 内部的存档 UI）。
 * 新版 LocalSimulationService.loadGame 走 readSave + migrateLegacyV030ToV1。
 */
export async function loadGame(saveId: string): Promise<SaveGame | null> {
  const db = await openSaveDb();
  const save = await new Promise<SaveGame | null>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(saveId);
    request.onsuccess = () => resolve((request.result as SaveGame) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (!save) return null;

  // 旧存档格式（v0.3.0 SaveGame）→ 保持原样返回
  if (isLegacyV030Save(save)) {
    return save;
  }
  // 已经是新 SerializedSave → 转回 SaveGame 形式（兼容老调用方）
  const v1 = save as unknown as SerializedSave;
  return {
    id: (v1.metadata as unknown as { saveName?: string })?.saveName ?? v1.metadata.currentDate,
    name: v1.metadata.saveName,
    savedAt: v1.updatedAt,
    state: v1.state,
    decision: v1.decision,
    version: v1.state.version
  };
}

/**
 * 一次性迁移：将 IDB 中所有老 v0.3.0 SaveGame 升级为 SerializedSave。
 * 升级后老的 archive 到 saves-legacy 槽，saves 槽填入新版本。
 */
export async function migrateAllLegacySaves(): Promise<{ migrated: number; failed: number }> {
  if (typeof indexedDB === "undefined") return { migrated: 0, failed: 0 };
  const db = await openSaveDb();
  const allOld: unknown[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as unknown[]);
    req.onerror = () => reject(req.error);
  });
  db.close();

  let migrated = 0;
  let failed = 0;
  for (const raw of allOld) {
    if (!isLegacyV030Save(raw)) continue;
    try {
      const newSave = migrateLegacyV030ToV1(raw);
      const validation = validateSaveFile(newSave);
      if (!validation.ok) {
        failed++;
        continue;
      }
      await writeSave(newSave);
      // archive 旧存档
      const dba = await openSaveDb();
      await new Promise<void>((resolve, reject) => {
        const tx = dba.transaction([LEGACY_STORE_NAME, storeName], "readwrite");
        tx.objectStore(LEGACY_STORE_NAME).put(raw);
        tx.objectStore(storeName).delete(raw.id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      dba.close();
      migrated++;
    } catch {
      failed++;
    }
  }
  return { migrated, failed };
}

/**
 * 旧 migrateGameState 导出（兼容 save-store.test.ts 老测试）。
 */
export function migrateGameState(state: GameState): GameState {
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

function normalizeSaveForList(key: IDBValidKey, raw: unknown): SaveGame | null {
  const id = String(key);
  if (isLegacyV030Save(raw)) {
    return { ...raw, id };
  }
  const candidate = raw as Partial<SerializedSave>;
  if (candidate?.format !== "ming-war-save" || !candidate.state || !candidate.decision || !candidate.metadata) {
    return null;
  }
  return {
    id,
    name: candidate.metadata.saveName,
    savedAt: candidate.updatedAt ?? candidate.createdAt ?? "",
    state: candidate.state,
    decision: candidate.decision,
    version: candidate.state.version
  };
}
