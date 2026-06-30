/**
 * localSimulationService.ts — v0.6-stability-design §5.11
 *
 * 主线程 SimulationService 实现。Phase 4 唯一实现的 service。
 *
 * 关键约束：
 * - 调用 Phase 2 的 7 阶段函数，**完全保留 random 消费顺序**（hash:state 跨版本一致）
 * - pause() 立即生效，但不阻塞当前月
 * - advanceMonths 在事件触发 / 玩家覆灭 / endDate / 错误时自动终止
 * - state hash 用 computeStateHash 验证
 *
 * 本类**不**直接写 Zustand store。store 同步由调用方（hook / gameStore）
 * 负责——service 是 pure logic，UI 是 reactive。
 */

import { simulateMonth } from "../core/simulation";
import { computeStateHash } from "../core/stateHash";
import { isAfter } from "../core/calendar";
import { GAME_VERSION } from "../core/version";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import type { GameState, PlayerDecision } from "../core/types";
import type {
  AdvanceResult,
  DecisionProvider,
  GameViewSnapshot,
  MonthResult,
  RegionView,
  SerializedSave,
  SimulationProgress,
  StartGameOptions
} from "./viewSnapshot";
import type { SimulationService } from "./simulationService";

const SAVE_FORMAT = "ming-war-save" as const;
const CURRENT_SAVE_VERSION = 1;

export class LocalSimulationService implements SimulationService {
  private state: GameState | null = null;
  private decision: PlayerDecision = defaultPlayerDecision;
  private paused = false;
  private progressHandlers = new Set<(p: SimulationProgress) => void>();
  private startMs = 0;
  private scenario = "mvp";

  async startGame(options: StartGameOptions): Promise<GameViewSnapshot> {
    this.state = createMvpScenario(options.factionId, options.seed);
    this.decision = defaultPlayerDecision;
    this.paused = false;
    this.startMs = Date.now();
    if (options.scenario) this.scenario = options.scenario;
    return this.snapshot();
  }

  async advanceMonth(decision: PlayerDecision): Promise<MonthResult> {
    if (!this.state) {
      throw new Error("Simulation not started; call startGame() first");
    }
    this.decision = decision;
    const result = simulateMonth({
      state: this.state,
      playerDecision: decision,
      randomSeed: this.state.seed
    });
    this.state = result.nextState;
    return {
      date: this.state.currentDate,
      newReports: result.reports,
      newAlerts: result.alerts,
      pendingEvent: result.triggeredEvents.length > 0
        ? {
            id: result.triggeredEvents[0].eventId,
            name: result.triggeredEvents[0].eventId,
            description: ""
          }
        : null,
      stateHash: computeStateHash(this.state),
      timings: result.timings
    };
  }

  async advanceMonths(count: number, provider: DecisionProvider): Promise<AdvanceResult> {
    if (!this.state) {
      throw new Error("Simulation not started; call startGame() first");
    }
    const out: MonthResult[] = [];
    for (let i = 0; i < count; i++) {
      if (this.paused) {
        return { months: out, aborted: true, reason: "user-pause" };
      }
      // 检查结束条件
      if (isAfter(this.state.currentDate, this.state.endDate)) {
        return { months: out, aborted: true, reason: "ended" };
      }
      // 玩家覆灭
      if (this.state.factions[this.state.playerFactionId]?.status === "collapsed") {
        return { months: out, aborted: true, reason: "collapsed" };
      }
      const decision = provider(i, this.state.currentDate);
      const month = await this.advanceMonth(decision);
      out.push(month);
      // 进度通知
      this.emitProgress(i + 1, count, month.date);
      // 事件中断
      if (month.pendingEvent) {
        return { months: out, aborted: true, reason: "event" };
      }
      // 让出主线程
      if (typeof requestAnimationFrame !== "undefined") {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      } else {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
    return { months: out, aborted: false, reason: "completed" };
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  async saveGame(name: string): Promise<SerializedSave> {
    if (!this.state) {
      throw new Error("Simulation not started; call startGame() first");
    }
    const controlledRegions = countControlledRegions(this.state, this.state.playerFactionId);
    const now = new Date();
    const updatedAt = now.toISOString();
    const playTimeMinutes = Math.max(0, Math.round((now.getTime() - this.startMs) / 60000));
    return {
      format: SAVE_FORMAT,
      saveVersion: CURRENT_SAVE_VERSION,
      gameVersion: GAME_VERSION,
      createdAt: updatedAt,
      updatedAt,
      checksum: computeStateHash(this.state),
      metadata: {
        currentDate: this.state.currentDate,
        playerFaction: this.state.playerFactionId,
        gameVersion: GAME_VERSION,
        saveVersion: CURRENT_SAVE_VERSION,
        seed: this.state.seed,
        status: this.state.factions[this.state.playerFactionId]?.status === "collapsed" ? "collapsed" : "active",
        controlledRegions,
        playTimeMinutes,
        saveName: name
      },
      state: this.state,
      decision: this.decision
    };
  }

  async loadGame(save: SerializedSave): Promise<GameViewSnapshot> {
    // 验证 save 格式
    if (save.format !== SAVE_FORMAT) {
      throw new Error(`Unsupported save format: ${save.format}`);
    }
    this.state = save.state;
    this.decision = save.decision;
    this.paused = false;
    this.startMs = Date.now();
    return this.snapshot();
  }

  getFullStateForDebug(): GameState | null {
    return this.state;
  }

  onProgress(handler: (p: SimulationProgress) => void): () => void {
    this.progressHandlers.add(handler);
    return () => {
      this.progressHandlers.delete(handler);
    };
  }

  /** 内部：派生 GameViewSnapshot。 */
  private snapshot(): GameViewSnapshot {
    if (!this.state) {
      throw new Error("No active state");
    }
    const state = this.state;
    const faction = state.factions[state.playerFactionId];
    const regions: Record<string, RegionView> = {};
    for (const r of Object.values(state.regions)) {
      regions[r.id] = {
        id: r.id,
        name: r.name,
        controllerFactionId: r.controllerFactionId,
        population: r.population,
        control: r.control,
        stability: r.stability,
        hasWar: state.wars.some((w) => w.targetRegionId === r.id),
        hasDisaster: (r.activeDisasters ?? []).length > 0
      };
    }
    return {
      currentDate: state.currentDate,
      gameStatus: state.gameStatus,
      playerFaction: faction
        ? {
            id: faction.id,
            name: faction.name,
            treasury: faction.treasury,
            grainReserve: faction.grainReserve,
            armyTotal: faction.armyTotal,
            legitimacy: faction.legitimacy,
            centralization: faction.centralization,
            warExhaustion: faction.warExhaustion,
            status: faction.status,
            controlledRegions: countControlledRegions(state, state.playerFactionId)
          }
        : null,
      regions,
      reports: state.reports ?? [],
      alerts: state.alerts ?? [],
      pendingEvent: null,
      decision: this.decision,
      stateHash: computeStateHash(state)
    };
  }

  private emitProgress(completed: number, total: number, date: string): void {
    const p: SimulationProgress = { completed, total, date };
    for (const h of this.progressHandlers) {
      try { h(p); } catch { /* ignore handler errors */ }
    }
  }
}

function countControlledRegions(state: GameState, factionId: string): number {
  let n = 0;
  for (const r of Object.values(state.regions)) {
    if (r.controllerFactionId === factionId) n++;
  }
  return n;
}
