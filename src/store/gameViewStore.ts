/**
 * useGameViewStore — v0.6-stability-design §3.4
 *
 * Game View 层：从权威 GameState 派生的视图数据。
 * - currentDate：当前日期
 * - gameStatus：游戏状态
 * - reports：月度报告（前 100 条）
 * - alerts：待处理告警
 * - playerFactionSummary：玩家势力摘要（仅必要字段，避免全 state 订阅）
 * - pendingEvent：待选项事件
 *
 * 权威 GameState 仍在 useGameStore 内（兼容层 + 旧代码）。完整迁移到
 * SimulationService 在 Phase 4 完成。
 */

import { create } from "zustand";
import type { GameAlert, MonthlyReport, PlayerDecision } from "../core/types";

export interface PlayerFactionSummary {
  id: string;
  name: string;
  treasury: number;
  grainReserve: number;
  armyTotal: number;
  legitimacy: number;
  centralization: number;
  warExhaustion: number;
  status: string;
  controlledRegions: number;
}

export interface PendingEventView {
  id: string;
  name: string;
  description: string;
}

export interface GameViewState {
  currentDate: string;
  gameStatus: "playing" | "paused" | "finished";
  playerFaction: PlayerFactionSummary | null;
  reports: MonthlyReport[];
  alerts: GameAlert[];
  pendingEvent: PendingEventView | null;
  decision: PlayerDecision;
}

export interface GameViewActions {
  setView: (view: Partial<GameViewState>) => void;
  appendReports: (reports: MonthlyReport[]) => void;
  setPendingEvent: (event: PendingEventView | null) => void;
  setAlerts: (alerts: GameAlert[]) => void;
  setDecision: (decision: PlayerDecision) => void;
}

const initialDecision: PlayerDecision = {
  domesticFocus: "agriculture",
  posture: "balanced",
  targetRegionId: null
};

export const useGameViewStore = create<GameViewState & GameViewActions>((set) => ({
  currentDate: "1573-01",
  gameStatus: "playing",
  playerFaction: null,
  reports: [],
  alerts: [],
  pendingEvent: null,
  decision: initialDecision,

  setView: (view) => set((s) => ({ ...s, ...view })),
  appendReports: (reports) => set((s) => ({ reports: [...reports, ...s.reports].slice(0, 300) })),
  setPendingEvent: (event) => set({ pendingEvent: event }),
  setAlerts: (alerts) => set({ alerts }),
  setDecision: (decision) => set({ decision })
}));

/** 工具：从 GameState 派生 playerFaction 摘要。 */
export function derivePlayerFactionSummary(state: {
  factions: Record<string, {
    id: string;
    name: string;
    treasury: number;
    grainReserve: number;
    armyTotal: number;
    legitimacy: number;
    centralization: number;
    warExhaustion: number;
    status: string;
  }>;
  regions: Record<string, { controllerFactionId: string }>;
  playerFactionId: string;
}): PlayerFactionSummary | null {
  const faction = state.factions[state.playerFactionId];
  if (!faction) return null;
  let controlledRegions = 0;
  for (const r of Object.values(state.regions)) {
    if (r.controllerFactionId === state.playerFactionId) controlledRegions++;
  }
  return {
    id: faction.id,
    name: faction.name,
    treasury: faction.treasury,
    grainReserve: faction.grainReserve,
    armyTotal: faction.armyTotal,
    legitimacy: faction.legitimacy,
    centralization: faction.centralization,
    warExhaustion: faction.warExhaustion,
    status: faction.status,
    controlledRegions
  };
}
