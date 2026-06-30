/**
 * saveValidation.ts — v0.6-stability-design §5.20
 *
 * 存档结构化校验（9 步）：
 * 1. JSON 结构（type guard）
 * 2. format === "ming-war-save"
 * 3. saveVersion 已知
 * 4. 必需字段（state / decision / metadata / checksum）
 * 5. 数据类型校验
 * 6. checksum 一致（重新计算 SHA-1 与 save.checksum 对比）
 * 7. 地区和势力引用关系
 * 8. 无 NaN / Infinity
 * 9. 当前日期合法
 *
 * 校验失败**不抛异常**，返回 ValidationResult；UI 用 alert 提示玩家。
 */

import { computeStateHash } from "../core/stateHash";
import type { SerializedSave } from "../runtime/viewSnapshot";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** 已知 saveVersion（新增 migration 时同步追加）。 */
export const KNOWN_SAVE_VERSIONS = [1] as const;
export const CURRENT_SAVE_VERSION = 1;
const SAVE_FORMAT = "ming-war-save";
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MIN_YEAR = 1573;
const MAX_YEAR = 1662;

export function validateSaveFile(save: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!save || typeof save !== "object") {
    return { ok: false, errors: ["存档不是有效对象"], warnings: [] };
  }
  const s = save as Record<string, unknown>;

  // 1+2. format
  if (s.format !== SAVE_FORMAT) {
    errors.push(`存档格式标识不匹配：期望 "${SAVE_FORMAT}"，收到 "${String(s.format)}"`);
  }
  // 3. saveVersion
  if (typeof s.saveVersion !== "number" || !KNOWN_SAVE_VERSIONS.includes(s.saveVersion as 1)) {
    errors.push(`存档 saveVersion 未知或非数字：${String(s.saveVersion)}`);
  }
  // 4. 必需字段
  for (const k of ["state", "decision", "metadata", "checksum"]) {
    if (!(k in s)) {
      errors.push(`缺少必需字段：${k}`);
    }
  }
  // 5. 数据类型粗检
  if (s.state && typeof s.state !== "object") errors.push("state 不是对象");
  if (s.decision && typeof s.decision !== "object") errors.push("decision 不是对象");
  if (s.metadata && typeof s.metadata !== "object") errors.push("metadata 不是对象");
  if (typeof s.checksum !== "string") errors.push("checksum 不是字符串");

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const state = s.state as Record<string, unknown>;
  const metadata = s.metadata as Record<string, unknown>;

  // 6. checksum 一致（用 computeStateHash 重新计算权威字段子集）
  try {
    const actual = computeStateHash(state as unknown as Parameters<typeof computeStateHash>[0]);
    if (actual !== s.checksum) {
      errors.push(`checksum 不一致：期望 ${s.checksum}，实际 ${actual}`);
    }
  } catch (e) {
    errors.push(`checksum 计算失败：${(e as Error).message}`);
  }

  // 7. 引用关系
  const factions = state.factions as Record<string, { id: string; status: string }> | undefined;
  const regions = state.regions as Record<string, { controllerFactionId: string }> | undefined;
  if (regions && factions) {
    for (const [regionId, region] of Object.entries(regions)) {
      if (!factions[region.controllerFactionId]) {
        errors.push(`地区 ${regionId} 引用不存在的势力 ${region.controllerFactionId}`);
      }
    }
  }
  if (state.playerFactionId && factions && !factions[state.playerFactionId as string]) {
    errors.push(`playerFactionId 引用不存在的势力 ${String(state.playerFactionId)}`);
  }

  // 8. 无 NaN / Infinity
  const nanCount = countNaNInf(state);
  if (nanCount > 0) {
    errors.push(`存档含 ${nanCount} 个 NaN / Infinity 字段`);
  }

  // 9. 日期合法
  if (typeof state.currentDate === "string" && !DATE_RE.test(state.currentDate)) {
    errors.push(`currentDate 格式不合法：${String(state.currentDate)}`);
  } else if (typeof state.currentDate === "string") {
    const year = Number(state.currentDate.slice(0, 4));
    if (year < MIN_YEAR || year > MAX_YEAR) {
      warnings.push(`currentDate 超出预期范围（${MIN_YEAR}–${MAX_YEAR}）：${state.currentDate}`);
    }
  }

  // 警告：metadata 不一致
  if (typeof metadata.currentDate === "string" && metadata.currentDate !== state.currentDate) {
    warnings.push(`metadata.currentDate 与 state.currentDate 不一致`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/* —— 工具 —— */

function sortReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      sorted[k] = obj[k];
    }
    return sorted;
  }
  return value;
}

function sortObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, sortReplacer)) as T;
}

function countNaNInf(value: unknown, seen = new WeakSet<object>()): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? 0 : 1;
  }
  if (typeof value !== "object") return 0;
  if (seen.has(value as object)) return 0;
  seen.add(value as object);
  if (Array.isArray(value)) {
    let n = 0;
    for (const v of value) n += countNaNInf(v, seen);
    return n;
  }
  let n = 0;
  for (const v of Object.values(value as Record<string, unknown>)) {
    n += countNaNInf(v, seen);
  }
  return n;
}

export function isSerializedSave(value: unknown): value is SerializedSave {
  const v = validateSaveFile(value);
  return v.ok;
}
