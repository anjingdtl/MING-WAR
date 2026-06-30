/**
 * simulationService.ts — v0.6-stability-design §5.10
 *
 * SimulationService 接口定义。所有 UI 操作通过 service：
 * - startGame：初始化游戏
 * - advanceMonth：单月推进
 * - advanceMonths：连续推进（含 pause / event / collapse / endDate 终止）
 * - saveGame / loadGame：存档读写（Phase 5 完善）
 * - pause / resume：连续推进暂停
 * - getFullStateForDebug：调试面板取完整状态
 *
 * 本轮实现 LocalSimulationService（v0.6-a）。
 * WorkerSimulationService（v0.6-b）视性能基线决定，本轮不实现。
 */

import type { GameState, PlayerDecision } from "../core/types";
import type {
  AdvanceResult,
  DecisionProvider,
  GameViewSnapshot,
  MonthResult,
  SerializedSave,
  SimulationProgress,
  StartGameOptions
} from "./viewSnapshot";

export interface SimulationService {
  /** 启动新游戏。 */
  startGame(options: StartGameOptions): Promise<GameViewSnapshot>;

  /** 单月推进。 */
  advanceMonth(decision: PlayerDecision): Promise<MonthResult>;

  /** 连续推进。 */
  advanceMonths(count: number, provider: DecisionProvider): Promise<AdvanceResult>;

  /** 暂停（不阻塞当前月；下一月开始前生效）。 */
  pause(): void;

  /** 恢复。 */
  resume(): void;

  /** 存档。 */
  saveGame(name: string): Promise<SerializedSave>;

  /** 读档。 */
  loadGame(save: SerializedSave): Promise<GameViewSnapshot>;

  /** 当前游戏状态（调试用，UI 勿订阅）。 */
  getFullStateForDebug(): GameState | null;

  /** 订阅 progress（连续推进用）。 */
  onProgress(handler: (p: SimulationProgress) => void): () => void;

  /** 当前是否是 paused。 */
  isPaused(): boolean;
}
