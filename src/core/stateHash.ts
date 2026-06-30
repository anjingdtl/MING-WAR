/**
 * 状态哈希：v0.6-stability-design §4.3
 *
 * 计算权威 GameState 的稳定 SHA-1 哈希。
 * - 排除 UI 字段（reports / alerts / gameStatus / lastDomesticFocus）
 * - 排除性能计时（timings）
 * - 排除时间戳（createdAt / updatedAt / savedAt）
 * - 排除浏览器环境信息
 *
 * 用途：
 * - 确定性测试（同 seed + 同决策 + 两次执行 → 哈希一致）
 * - 读档验证（savedHash === loadedHash）
 * - Worker 一致性验证（localHash === workerHash）
 * - 版本回归比较（hash(vN, seed=7, m=1080) 对比 vN+1）
 *
 * 自带 SHA-1 实现，不引 npm 依赖。
 */

import type { GameState } from "./types";

/** 权威字段子集——这些是模拟结果的一部分，纳入哈希。 */
const AUTHORITATIVE_KEYS = [
  "version",
  "currentDate",
  "endDate",
  "seed",
  "playerFactionId",
  "factions",
  "regions",
  "wars",
  "diplomacy",
  "reforms",
  "activeReforms",
  "activeModifiers",
  "activeMovements",
  "activeSituations",
  "eventFlags",
  "ledgerHistory",
  "history"
] as const;

/** 显式排除的字段（演示用 / 时间戳 / UI 历史）。 */
const EXCLUDED_KEYS = [
  "reports",
  "alerts",
  "gameStatus",
  "lastDomesticFocus"
] as const;

export function computeStateHash(state: GameState): string {
  const canonical: Record<string, unknown> = {};
  for (const key of AUTHORITATIVE_KEYS) {
    const v = (state as unknown as Record<string, unknown>)[key];
    if (v !== undefined) canonical[key] = v;
  }
  const json = JSON.stringify(canonical, sortReplacer);
  return sha1Hex(json);
}

/** 排序 replacer：保证对象 key 序列化顺序稳定。 */
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

/* ===================== SHA-1 (RFC 3174, no deps) ===================== */

const SHA1_BLOCK_SIZE = 64;
const SHA1_DIGEST_SIZE = 20;

function rotateLeft(n: number, s: number): number {
  return ((n << s) | (n >>> (32 - s))) >>> 0;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += ((b >>> 4) & 0x0f).toString(16);
    out += (b & 0x0f).toString(16);
  }
  return out;
}

function utf8Encode(str: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str);
  }
  // Fallback: manual UTF-8 encode (tested against Node 18+ which always has TextEncoder,
  // this branch is just for safety)
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6));
      out.push(0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = str.charCodeAt(i + 1);
      c = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
      i++;
      out.push(0xf0 | (c >> 18));
      out.push(0x80 | ((c >> 12) & 0x3f));
      out.push(0x80 | ((c >> 6) & 0x3f));
      out.push(0x80 | (c & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12));
      out.push(0x80 | ((c >> 6) & 0x3f));
      out.push(0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

export function sha1Hex(input: string): string {
  const bytes = utf8Encode(input);
  const len = bytes.length;
  // Pre-processing: padding
  const bitLen = len * 8;
  // 1 bit followed by zeros, then 8-byte length. We need 1 extra byte for 0x80,
  // then (63 - (len + 1) % 64) zero bytes, then 8 bytes for length.
  const padLen = (SHA1_BLOCK_SIZE - ((len + 9) % SHA1_BLOCK_SIZE)) % SHA1_BLOCK_SIZE;
  const totalLen = len + 1 + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[len] = 0x80;
  // length in bits, big-endian, 64-bit
  // bitLen is always < 2^53 for any reasonable string; we zero the high 32 bits.
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  buf[totalLen - 8] = (hi >>> 24) & 0xff;
  buf[totalLen - 7] = (hi >>> 16) & 0xff;
  buf[totalLen - 6] = (hi >>> 8) & 0xff;
  buf[totalLen - 5] = hi & 0xff;
  buf[totalLen - 4] = (lo >>> 24) & 0xff;
  buf[totalLen - 3] = (lo >>> 16) & 0xff;
  buf[totalLen - 2] = (lo >>> 8) & 0xff;
  buf[totalLen - 1] = lo & 0xff;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);

  for (let chunk = 0; chunk < totalLen; chunk += SHA1_BLOCK_SIZE) {
    for (let i = 0; i < 16; i++) {
      const off = chunk + i * 4;
      w[i] = ((buf[off] & 0xff) << 24)
        | ((buf[off + 1] & 0xff) << 16)
        | ((buf[off + 2] & 0xff) << 8)
        | (buf[off + 3] & 0xff);
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotateLeft(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotateLeft(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(SHA1_DIGEST_SIZE);
  out[0] = (h0 >>> 24) & 0xff;
  out[1] = (h0 >>> 16) & 0xff;
  out[2] = (h0 >>> 8) & 0xff;
  out[3] = h0 & 0xff;
  out[4] = (h1 >>> 24) & 0xff;
  out[5] = (h1 >>> 16) & 0xff;
  out[6] = (h1 >>> 8) & 0xff;
  out[7] = h1 & 0xff;
  out[8] = (h2 >>> 24) & 0xff;
  out[9] = (h2 >>> 16) & 0xff;
  out[10] = (h2 >>> 8) & 0xff;
  out[11] = h2 & 0xff;
  out[12] = (h3 >>> 24) & 0xff;
  out[13] = (h3 >>> 16) & 0xff;
  out[14] = (h3 >>> 8) & 0xff;
  out[15] = h3 & 0xff;
  out[16] = (h4 >>> 24) & 0xff;
  out[17] = (h4 >>> 16) & 0xff;
  out[18] = (h4 >>> 8) & 0xff;
  out[19] = h4 & 0xff;
  return toHex(out);
}

export const __excluded = EXCLUDED_KEYS;
