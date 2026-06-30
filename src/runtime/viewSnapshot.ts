/**
 * viewSnapshot.ts — v0.6-stability-design §5.11
 *
 * SimulationService 通信用的 view 数据结构。
 * UI 拿到的是这些**派生摘要**，不直接持有完整 GameState。
 */

import type {
  FactionId,
  GameAlert,
  GameState,
  MonthlyReport,
  PlayerDecision,
  RegionId
} from "../core/types";
import type { SimulationTiming } from "../core/timing";

/** 玩家势力摘要（避免 UI 订阅全 state）。 */
export interface PlayerFactionView {
  id: FactionId;
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

/** 地区 view（仅地图必要字段）。 */
export interface RegionView {
  id: RegionId;
  name: string;
  controllerFactionId: FactionId;
  population: number;
  control: number;
  stability: number;
  hasWar: boolean;
  hasDisaster: boolean;
}

/** 待选项事件 view。 */
export interface PendingEventView {
  id: string;
  name: string;
  description: string;
}

/** UI 订阅的 game 视图（不是权威状态）。 */
export interface GameViewSnapshot {
  currentDate: string;
  gameStatus: "playing" | "paused" | "finished";
  playerFaction: PlayerFactionView | null;
  regions: Record<RegionId, RegionView>;
  reports: MonthlyReport[];
  alerts: GameAlert[];
  pendingEvent: PendingEventView | null;
  decision: PlayerDecision;
  stateHash: string;
}

/** 单月推进结果（service → UI 同步通道）。 */
export interface MonthResult {
  date: string;
  newReports: MonthlyReport[];
  newAlerts: GameAlert[];
  pendingEvent: PendingEventView | null;
  stateHash: string;
  timings: SimulationTiming | undefined;
}

/** 连续推进结果。 */
export interface AdvanceResult {
  months: MonthResult[];
  aborted: boolean;
  reason: "ended" | "collapsed" | "event" | "user-pause" | "error" | "completed";
}

/** 存档序列化（Phase 5 用，service 必须实现 saveGame / loadGame 接口）。 */
export interface SerializedSave {
  format: "ming-war-save";
  saveVersion: number;
  gameVersion: string;
  createdAt: string;
  updatedAt: string;
  checksum: string;
  metadata: SaveMetadata;
  state: GameState;
  decision: PlayerDecision;
}

export interface SaveMetadata {
  currentDate: string;
  playerFaction: FactionId;
  gameVersion: string;
  saveVersion: number;
  seed: number;
  status: "active" | "ended" | "collapsed";
  controlledRegions: number;
  playTimeMinutes: number;
  saveName: string;
  scenario?: string;
}

/** 决策提供者（连续推进用，玩家可借此一次性给 12 月决策）。 */
export type DecisionProvider = (monthIndex: number, date: string) => PlayerDecision;

/** 进度回报（连续推进时用）。 */
export interface SimulationProgress {
  completed: number;
  total: number;
  date: string;
}

/** 启动参数。 */
export interface StartGameOptions {
  factionId: FactionId;
  seed: number;
  scenario?: string;
}
