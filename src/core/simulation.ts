/**
 * simulation.ts — v0.6-stability-design §3.1 / §3.2
 *
 * 月度结算编排器（v0.6-stability）：把业务逻辑下沉到 simulationPhases/，
 * 本文件只负责 7 阶段调用 + 阶段计时 + 构造 SimulationResult。
 *
 * 流水线（顺序锁定，决定 random 消费点）：
 *   S1. clone（structuredClone）
 *   S2. runRegionPhase（生成灾害 + 地区循环）—— 第一个 random 消费点
 *   S3. runFactionPhase（势力循环 + 维护费/征募/腐败）
 *   S4. runDiplomacyPhase（外交演变 + 资源危机 + 集团更新）—— 第二个 random 消费点
 *   S5. runPoliticsPhase（改革 + 政治运动）
 *   S6. runSituationPhase（历史局势）
 *   S7. runWarPhase（战斗 + 战线 + 和谈）—— 第三个 random 消费点
 *   S8. finalizeMonth（日期 + ledger + trade + 不变量 + history + alerts）
 *
 * 任何阶段顺序的修改都会扰动 random 序列——禁止调整。
 */

import { chooseAllAiDecisions } from "./ai";
import { normalizePlayerDecision } from "./decisions";
import { createRandom } from "./random";
import {
  freshTiming,
  isTimingEnabled,
  recordPhase,
  recordTotal
} from "./timing";
import { createSimulationContext } from "./simulationContext";
import { runRegionPhase } from "./simulationPhases/runRegionPhase";
import { runFactionPhase } from "./simulationPhases/runFactionPhase";
import { runDiplomacyPhase } from "./simulationPhases/runDiplomacyPhase";
import { runPoliticsPhase } from "./simulationPhases/runPoliticsPhase";
import { runSituationPhase } from "./simulationPhases/runSituationPhase";
import { runWarPhase } from "./simulationPhases/runWarPhase";
import { finalizeMonth } from "./simulationPhases/finalizeMonth";
import type { GameState, MonthlyReport, SimulationInput, SimulationResult } from "./types";

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export function simulateMonth(input: SimulationInput): SimulationResult {
  const totalStart = isTimingEnabled() ? nowMs() : 0;
  const timings = freshTiming();

  // S1: clone
  const cloneStart = isTimingEnabled() ? nowMs() : 0;
  const state: GameState = structuredClone(input.state);
  recordPhase(timings, "clone", cloneStart);

  const random = createRandom(input.randomSeed);
  const reports: MonthlyReport[] = [];
  const ledgerEntries: import("./ledger").LedgerEntry[] = [];
  const playerDecision = normalizePlayerDecision(state, input.playerDecision);
  const aiDecisions = chooseAllAiDecisions(state);

  // 构造阶段共享 context
  const ctx = createSimulationContext(
    state,
    random,
    playerDecision,
    aiDecisions,
    reports,
    ledgerEntries,
    timings
  );

  // S2: 地区循环（含月初 expireModifiers + generateDisasters + 第一个 random 消费点）
  const regionStart = isTimingEnabled() ? nowMs() : 0;
  runRegionPhase(ctx);
  recordPhase(timings, "regions", regionStart);

  // S3: 势力循环
  const factionStart = isTimingEnabled() ? nowMs() : 0;
  runFactionPhase(ctx);
  recordPhase(timings, "faction", factionStart);

  // S4: 外交演变 + 资源危机 + 集团更新（含第二个 random 消费点）
  const diplomacyStart = isTimingEnabled() ? nowMs() : 0;
  runDiplomacyPhase(ctx);
  recordPhase(timings, "diplomacy", diplomacyStart);

  // S5: 改革 + 政治运动
  const politicsStart = isTimingEnabled() ? nowMs() : 0;
  runPoliticsPhase(ctx);
  recordPhase(timings, "politics", politicsStart);

  // S6: 历史局势
  const situationStart = isTimingEnabled() ? nowMs() : 0;
  runSituationPhase(ctx);
  recordPhase(timings, "situation", situationStart);

  // S7: 战斗 + 战线 + 和谈（含第三个 random 消费点）
  const warStart = isTimingEnabled() ? nowMs() : 0;
  runWarPhase(ctx);
  recordPhase(timings, "warfare", warStart);

  // S8: 月末收口（内部已记录 timings.market 和 timings.validation）
  const finalizeStart = isTimingEnabled() ? nowMs() : 0;
  finalizeMonth(ctx);
  recordPhase(timings, "finalize", finalizeStart);
  recordTotal(timings, totalStart);

  return {
    nextState: ctx.state,
    reports: ctx.reports,
    triggeredEvents: ctx.triggeredEventIds.map((id) => ({ eventId: id, optionRequired: true })),
    alerts: ctx.state.alerts,
    timings: isTimingEnabled() ? timings : undefined
  };
}
