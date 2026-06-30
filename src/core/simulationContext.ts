/**
 * SimulationContext — v0.6-stability-design §3.1
 *
 * 月度阶段函数的统一入参。所有阶段函数接收 ctx，mutate ctx.state / ctx.reports
 * / ctx.ledgerEntries / ctx.timings。
 *
 * 关键约束：阶段函数**不**消费 random（除 war 阶段通过 ctx.random 调
 * resolveBattle），**不**改 random 序列顺序。
 */

import type { RandomSource } from "./random";
import type {
  FactionState,
  GameState,
  MonthlyReport,
  PlayerDecision,
  RegionState,
  WarState
} from "./types";
import type { LedgerEntry } from "./ledger";
import type { SimulationTiming } from "./timing";

export interface SimulationContext {
  /** 模拟状态（已 clone，月份初） */
  state: GameState;
  /** 固定种子的随机源（阶段内不消费顺序必须保留） */
  random: RandomSource;
  /** 玩家当月决策 */
  playerDecision: PlayerDecision;
  /** AI 各势力当月决策（factionId → decision） */
  aiDecisions: Record<string, PlayerDecision>;
  /** 当月产出报告（与历史 reports 合并在 finalize 阶段） */
  reports: MonthlyReport[];
  /** 当月产出账本条目（用于 ledgerHistory 滚动） */
  ledgerEntries: LedgerEntry[];
  /** 阶段计时（dev 模式 / MINGWAR_TIMING=1 时填充） */
  timings: SimulationTiming;
  /** 触发的待选项事件（war 阶段可能产生，由 finalize 阶段转 alerts） */
  triggeredEventIds: string[];
  /** 月初构建的 per-faction decision 查找表（由 runRegionPhase 共享） */
  decisionsLookup: Record<string, PlayerDecision>;
}

/** 构造一个完整的 SimulationContext（simulateMonth 入口调用）。 */
export function createSimulationContext(
  state: GameState,
  random: RandomSource,
  playerDecision: PlayerDecision,
  aiDecisions: Record<string, PlayerDecision>,
  reports: MonthlyReport[],
  ledgerEntries: LedgerEntry[],
  timings: SimulationTiming
): SimulationContext {
  return {
    state,
    random,
    playerDecision,
    aiDecisions,
    reports,
    ledgerEntries,
    timings,
    triggeredEventIds: [],
    decisionsLookup: {
      [state.playerFactionId]: playerDecision,
      ...aiDecisions
    }
  };
}

/* —— 类型辅助：供阶段函数复用 —— */

/** 从 ctx 派生当前是否玩家势力（用于事件 / 报告归属）。 */
export function playerFactionId(ctx: SimulationContext): string {
  return ctx.state.playerFactionId;
}

/** 阶段函数通用签名。 */
export type PhaseFn = (ctx: SimulationContext) => void;

/* —— 重导出常用类型 —— */
export type { FactionState, GameState, MonthlyReport, PlayerDecision, RegionState, WarState, LedgerEntry, SimulationTiming };
