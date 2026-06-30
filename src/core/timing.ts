/**
 * 阶段计时：v0.6-stability-design §4.1 / §4.2
 *
 * 每月结算的各阶段耗时。仅在 dev 模式（import.meta.env?.DEV）或
 * 显式开启（import.meta.env?.MINGWAR_TIMING=1）时累计；prod 默认零开销。
 *
 * 计时点**不**进入 random.next() 之前，**不**修改 state，确保：
 * - 固定种子回归哈希不漂移
 * - 阶段计时本身不扰动模拟
 */

export interface SimulationTiming {
  /** 单月总耗时（ms） */
  total: number;
  /** 月初 structuredClone 耗时 */
  clone: number;
  /** runRegionPhase 耗时 */
  regions: number;
  /** 地区内市场供需/价格阶段（嵌在 region phase 内，单独计时） */
  market: number;
  /** runFactionPhase 耗时 */
  faction: number;
  /** runDiplomacyPhase 耗时 */
  diplomacy: number;
  /** runPoliticsPhase 耗时（改革 + 政治运动） */
  politics: number;
  /** runWarPhase 耗时（战斗 + 战线 + 和谈） */
  warfare: number;
  /** runSituationPhase 耗时 */
  situation: number;
  /** finalizeMonth 耗时（账本 + trade + 不变量 + history + alerts） */
  finalize: number;
  /** validateInvariants 耗时 */
  validation: number;
}

export const ZERO_TIMING: SimulationTiming = {
  total: 0,
  clone: 0,
  regions: 0,
  market: 0,
  faction: 0,
  diplomacy: 0,
  politics: 0,
  warfare: 0,
  situation: 0,
  finalize: 0,
  validation: 0
};

export type TimingPhase = keyof Omit<SimulationTiming, "total">;

let timingEnabled: boolean | null = null;

/**
 * 探测当前是否启用计时。dev 模式默认开启；prod 必须显式设置
 * `import.meta.env.MINGWAR_TIMING = "1"` 才开启。
 */
export function isTimingEnabled(): boolean {
  if (timingEnabled !== null) return timingEnabled;
  if (typeof import.meta === "undefined" || !import.meta.env) {
    // Node / 测试环境：默认开启以便 perf 脚本拿到数据
    timingEnabled = true;
    return timingEnabled;
  }
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
  const isDev = env.DEV === true || env.MODE === "development";
  const forced = env.MINGWAR_TIMING === "1" || env.MINGWAR_TIMING === "true";
  timingEnabled = isDev || forced;
  return timingEnabled;
}

function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * 累计一次阶段耗时。若计时未启用则零开销。
 */
export function recordPhase(
  timings: SimulationTiming,
  phase: TimingPhase,
  startMs: number
): void {
  if (!isTimingEnabled()) return;
  timings[phase] += now() - startMs;
}

/**
 * 记录 total（从 simulateMonth 入口开始，到 finalizeMonth 结束）。
 */
export function recordTotal(timings: SimulationTiming, startMs: number): void {
  if (!isTimingEnabled()) return;
  timings.total = now() - startMs;
}

/**
 * 重置单次性能采样（用于 perf 脚本多次循环之间）。
 */
export function freshTiming(): SimulationTiming {
  return { ...ZERO_TIMING };
}

/**
 * 打印前 N 慢阶段（dev 调试用）。
 */
export function topPhases(timings: SimulationTiming, n = 3): Array<{ phase: string; ms: number }> {
  const entries = Object.entries(timings)
    .filter(([k]) => k !== "total")
    .map(([phase, ms]) => ({ phase, ms }))
    .sort((a, b) => b.ms - a.ms);
  return entries.slice(0, n);
}
