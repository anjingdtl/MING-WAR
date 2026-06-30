/**
 * autoSave.ts — v0.6-stability-design §5.22
 *
 * 三槽自动存档：monthly / yearly / milestone。
 *
 * 写入策略：
 * 1. 临时记录（.tmp slot）写入并校验
 * 2. 校验通过后原子替换正式槽
 * 3. 校验失败 → 保留上一个有效存档，**不**覆盖
 * 4. UI 不感知失败（调用方决定是否推 alert）
 */

import type { SerializedSave } from "../runtime/viewSnapshot";
import { validateSaveFile } from "./saveValidation";
import { openSaveDb } from "./saveManager";

export type AutoSaveSlot = "monthly" | "yearly" | "milestone";

export interface AutoSaveResult {
  ok: boolean;
  slot: AutoSaveSlot;
  error?: string;
}

const SLOT_KEY_PREFIX = "mingwar:autosave:";
const TMP_SUFFIX = ".tmp";

function keyFor(slot: AutoSaveSlot): string {
  return `${SLOT_KEY_PREFIX}${slot}`;
}

/**
 * 写入自动存档（原子替换）。
 */
export async function writeAutoSave(
  slot: AutoSaveSlot,
  save: SerializedSave
): Promise<AutoSaveResult> {
  if (typeof indexedDB === "undefined") {
    return { ok: false, slot, error: "IndexedDB 不可用" };
  }
  const validation = validateSaveFile(save);
  if (!validation.ok) {
    return { ok: false, slot, error: validation.errors.join("; ") };
  }
  const key = keyFor(slot);
  const tmpKey = key + TMP_SUFFIX;
  const db = await openSaveDb();
  try {
    // 1. 写临时记录
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("saves", "readwrite");
      tx.objectStore("saves").put(save, tmpKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // 2. 读回校验
    const verified = await new Promise<SerializedSave | null>((resolve, reject) => {
      const tx = db.transaction("saves", "readonly");
      const req = tx.objectStore("saves").get(tmpKey);
      req.onsuccess = () => resolve((req.result as SerializedSave) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (!verified) {
      return { ok: false, slot, error: "临时记录读回失败" };
    }
    const recheck = validateSaveFile(verified);
    if (!recheck.ok) {
      // 清理临时记录
      await new Promise<void>((resolve) => {
        const tx = db.transaction("saves", "readwrite");
        tx.objectStore("saves").delete(tmpKey);
        tx.oncomplete = () => resolve();
      });
      return { ok: false, slot, error: "临时记录校验失败：" + recheck.errors.join("; ") };
    }
    // 3. 原子替换：先读旧值（可能 null）→ 写新值 → 删临时
    // 用 put 覆盖正式槽，删 tmp
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("saves", "readwrite");
      tx.objectStore("saves").put(verified, key);
      tx.objectStore("saves").delete(tmpKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return { ok: true, slot };
  } catch (e) {
    return { ok: false, slot, error: (e as Error).message };
  } finally {
    db.close();
  }
}

/**
 * 读取自动存档。
 */
export async function readAutoSave(slot: AutoSaveSlot): Promise<SerializedSave | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openSaveDb();
  const result = await new Promise<SerializedSave | null>((resolve, reject) => {
    const tx = db.transaction("saves", "readonly");
    const req = tx.objectStore("saves").get(keyFor(slot));
    req.onsuccess = () => resolve((req.result as SerializedSave) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!result) return null;
  const validation = validateSaveFile(result);
  if (!validation.ok) return null;
  return result;
}

/**
 * 判断给定日期是否应该触发 yearly autosave（12 月）。
 */
export function isYearBoundary(date: string): boolean {
  // date format: "YYYY-MM"
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(date)) return false;
  return date.endsWith("-12");
}
