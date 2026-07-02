/**
 * v0.9.4 — 战争疲劳 / 厌战
 *
 * 来源：研究文档《MING-WAR 军事系统优化改造深度研究报告》§3.5（厌战）
 * SPEC：`docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md` §4.5
 *
 * 设计目标：让"打得久"反噬政权。
 * - faction.warFatigue 月度累加 = casualties × 0.4 + duration × 0.2 - 0.5 * 胜利奖励
 * - > 70 时 AI deescalate 权重 +30%
 * - > 100 时：触发 'warWear' 政治运动（stability -2/月 + treasury × 0.10 消耗）
 *
 * 最小侵入：所有逻辑在 runWarPhase 中转调。exhaustion.ts 自身为纯函数。
 */

import type { FactionState, FactionId, GameState } from "./types";
import type { LedgerEntry } from "./ledger";

/* ===========================================================================
 * 常量 [PLACEHOLDER]
 * =========================================================================== */
const FATIGUE_BASE = 0.5;          // 基础每月
const FATIGUE_CASUALTIES_COEFF = 0.4; // casualties weight
const FATIGUE_DURATION_COEFF = 0.2;   // duration weight
const FATIGUE_WIN_BONUS = 0.5;       // 胜利月奖励
const FATIGUE_DEESCALATE_THRESHOLD = 70;
const FATIGUE_WARWEAR_THRESHOLD = 100;
const WARWEAR_STABILITY_HIT = 2;
const WARWEAR_TREASURY_RATE = 0.05;  // 5% 国库流失

/* ===========================================================================
 * 累加：每月 + base + casualties × 0.4 + duration × 0.2 - 胜利奖励
 * =========================================================================== */

export interface FatigueUpdate {
  factionId: FactionId;
  prevFatigue: number;
  newFatigue: number;
  casualtiesLastMonth: number;
  battlesWonLastMonth: number;
  activeWarMonths: number;
}

/**
 * 计算某 faction 当月 warFatigue 增量并返回新值。
 * 纯函数；调用方负责把 newFatigue 写回 faction.warFatigue。
 */
export function computeFatigueDelta(
  faction: FactionState,
  casualtiesLastMonth: number,
  battlesWonLastMonth: number,
  activeWarMonths: number
): FatigueUpdate {
  const prev = (faction as FactionState & { warFatigue?: number }).warFatigue ?? 0;
  const delta =
    FATIGUE_BASE +
    FATIGUE_CASUALTIES_COEFF * (casualtiesLastMonth / 10000) +
    FATIGUE_DURATION_COEFF * activeWarMonths -
    FATIGUE_WIN_BONUS * Math.min(1, battlesWonLastMonth);
  return {
    factionId: faction.id,
    prevFatigue: prev,
    newFatigue: Math.max(0, prev + delta),
    casualtiesLastMonth,
    battlesWonLastMonth,
    activeWarMonths,
  };
}

/* ===========================================================================
 * warWear 政治运动：当 fatigue > 100 时施加
 * =========================================================================== */

export interface WarWearEffect {
  stabilityHit: number;
  treasuryLoss: number;
  entries: LedgerEntry[];
}

/**
 * 当 warFatigue 越过 100 阈值时施加 warWear 效果：
 * - stability -2/月
 * - treasury × 0.05 月消耗（走 'expense-court'）
 */
export function applyWarWearEffect(faction: FactionState, currentDate: string): WarWearEffect {
  const treasuryLoss = Math.round(faction.treasury * WARWEAR_TREASURY_RATE);
  return {
    stabilityHit: WARWEAR_STABILITY_HIT,
    treasuryLoss,
    entries: [{
      category: "expense-court",
      source: `${faction.name} 厌战消耗 (${currentDate})`,
      amount: -treasuryLoss,
      factionId: faction.id,
    }],
  };
}

/* ===========================================================================
 * AI 决策辅助：是否 deescalate（求和 / 撤军）
 * =========================================================================== */

/**
 * 给出本 faction 的 deescalate 倾向加成（用于 AI 决策 weight）。
 * fatigue > 70 → +30；> 100 → +60；> 130 → +100（封顶）。
 */
export function deescalateWeightBonus(faction: FactionState): number {
  const fatigue = (faction as FactionState & { warFatigue?: number }).warFatigue ?? 0;
  if (fatigue < FATIGUE_DEESCALATE_THRESHOLD) return 0;
  if (fatigue < FATIGUE_WARWEAR_THRESHOLD) return 30;
  if (fatigue < 130) return 60;
  return 100;
}

/* ===========================================================================
 * 批量 tick：在 runFactionPhase 末调用一次
 * =========================================================================== */

/**
 * 推进所有 active faction 的 warFatigue 一月。
 * - casualtiesLastMonth：取自本轮 warfare 累计
 * - activeWarMonths：faction 参与的所有 war 的 monthsActive 平均
 * 返回 update 列表（含已写回 state 的新值）。
 */
export function tickAllWarFatigue(
  state: GameState,
  casualtiesByFaction: Record<FactionId, number>,
  winsByFaction: Record<FactionId, number>,
  warMonthsByFaction: Record<FactionId, number>,
  currentDate: string,
  ledgerEntries: LedgerEntry[]
): GameState {
  const nextFactions: Record<FactionId, FactionState> = { ...state.factions };
  const warWearEntries: LedgerEntry[] = [];
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    const casualties = casualtiesByFaction[faction.id] ?? 0;
    const wins = winsByFaction[faction.id] ?? 0;
    const warMonths = warMonthsByFaction[faction.id] ?? 0;
    const update = computeFatigueDelta(faction, casualties, wins, warMonths);
    const crossed = update.prevFatigue < FATIGUE_WARWEAR_THRESHOLD &&
      update.newFatigue >= FATIGUE_WARWEAR_THRESHOLD;
    (nextFactions[faction.id] as FactionState & { warFatigue?: number }).warFatigue = update.newFatigue;
    if (crossed) {
      // 越过 100 阈值时立即施加一次 warWear（之后每月也施加；下次 tick 会再算）
      const effect = applyWarWearEffect(faction, currentDate);
      warWearEntries.push(...effect.entries);
    } else if (update.newFatigue >= FATIGUE_WARWEAR_THRESHOLD) {
      // 已越过：每月持续施加
      const effect = applyWarWearEffect(faction, currentDate);
      warWearEntries.push(...effect.entries);
    }
  }
  if (warWearEntries.length > 0) {
    // treasury loss 应用：直接改 faction.treasury（避免 ledger 双计）
    // 注：warWear 已在 entry 里记录，从 treasury 扣回
    for (const entry of warWearEntries) {
      if (entry.factionId) {
        const f = nextFactions[entry.factionId];
        if (f) f.treasury = Math.max(0, f.treasury + entry.amount);
      }
      ledgerEntries.push(entry);
    }
  }
  return { ...state, factions: nextFactions };
}
