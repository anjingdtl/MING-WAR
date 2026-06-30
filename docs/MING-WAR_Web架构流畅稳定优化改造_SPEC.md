# 《万历：山河崩塌》Web 架构流畅稳定优化改造 SPEC

> 项目代号：MING-WAR
> 文档版本：v0.6-stability-design
> 编写日期：2026-06-30
> 文档性质：架构稳定性 / 流畅性 / 可维护性 改造规格 + 分阶段实施路线
> 上游文档：`docs/MING-WAR《万历：山河崩塌》Web 架构流畅稳定优化建设方案.docx`（方案原稿）+ `docs/MING-WAR_优化改进方案_SPEC.md`（v0.4-design，P0–P6 路线）+ `docs/v2-optimization-spec.md`（v0.5-design，S1–S6 五环闭环战报）
> 当前代码状态：v0.3.0 / 维多利亚3 五环闭环 S1–S6 全部接通 / 377 测试全绿 / batch `errorRuns=0` / 6 种主线局势在长跑中全部可触发

---

## 0. 文档定位

本 SPEC 不是另起炉灶的"新一轮内容设计"，而是在**已有的 S1–S6 五环闭环地基**上，**承接方案原稿十八章的"运行底座"目标**，把"性能基线 → 状态分层 → Worker 隔离 → 存档治理 → 自动化守门"五条建设路线，**翻译成当前代码可执行的改造任务**。

方案原稿十八章的目标是："让 31 地区 90 年的游戏能够长期、稳定、流畅地运行"。本 SPEC 的任务是把"长期、稳定、流畅"逐条落到 `src/core/` / `src/store/` / `src/save/` / `src/runtime/` / `.github/workflows/` 五个改动域。

**本轮三条核心约束**（与方案原稿第二章一致，并按当前代码收紧）：

1. **不改变游戏产品形态**：不更换 React/TypeScript/Vite/Zustand；不重写 S1–S6 已接通的五环闭环。
2. **保留确定性模拟逻辑**：`simulateMonth` 的随机序列、`structuredClone` 时机、月度流水线顺序对外保持一致；任何阶段拆分都不能让固定种子回归哈希漂移。
3. **玩家与 AI 同规则**：所有 Worker 抽象、存档协议、状态分层对玩家和 AI 一视同仁，不写 player-only 分支。

---

## 1. 项目现状真实盘点（决定本轮做什么 / 不做什么）

### 1.1 与方案原稿"现有架构主要风险"对照

| 方案原稿风险（第四章 §3） | 当前代码事实 | 本轮是否处理 |
|---|---|---|
| §3.1 每月 `structuredClone` 全量复制 | `simulation.ts:45` 仍调用 `structuredClone(input.state)`，地区/人口/市场全部复制 | **P1 监控 + 局部优化**（不直接取消；先建立基线再决定） |
| §3.2 模拟运行在浏览器主线程 | `gameStore.ts:71-79` `advanceOneMonth` 由 Zustand 同步调用 `simulateMonth` | **P0 必须处理**（Performance API 计时先行，Worker 视基线再上） |
| §3.3 Zustand 持有完整模拟状态 | `gameStore.ts:13-28` 单一 store 同时持有 `state` / `decision` / `selectedRegionId` / `mapLayer` / `pendingEventId` | **P1 处理**（拆分 UI Store / Game View Store） |
| §3.4 月度流水线逐渐集中 | `simulation.ts` 单文件 36KB / 777 行，承担 14 个系统编排 | **P1 处理**（`runRegionPhase` / `runFactionPhase` / `runDiplomacyPhase` 等阶段函数） |
| §3.5 长周期数据增长 | 报告 100 条、账本 60 月已限；其他历史字段（`activeModifiers` 等）仍随月增长 | **P1 处理**（按方案 §8.2 压缩策略收紧） |

### 1.2 性能与可观测性现状（缺什么就建什么）

| 项 | 现状 | 缺口 |
|---|---|---|
| 性能基线 | 无 | 需新增 `perf:month` / `perf:year` / `perf:fullgame` / `perf:clone` / `perf:save` / `perf:report` |
| 阶段计时 | 无 | 需新增 `SimulationTiming`（total/clone/regions/market/diplomacy/warfare/validation） |
| 状态哈希 | 无 | 需新增 `computeStateHash`，排除 UI 字段与时间戳 |
| Worker 一致性 | 无 | 需新增 `LocalSimulationService` 与 `WorkerSimulationService` 同输入同哈希 |
| 存档版本 | `saveManager.ts:67` 硬编码 `0.3.0` 字符串比对 | 缺迁移链 `migrations: Record<number, SaveMigration>` |
| 存档校验 | `loadGame` 只检查版本字符串 | 缺 checksum / NaN / 引用关系校验 |
| 自动存档槽 | 无 | 缺三个自动存档槽（最近一月 / 最近一年 / 最近重大事件前） |
| CI | `.github/` 目录有但未配置 workflow | 缺 `ci.yml`（typecheck + test + build + map:validate） |

### 1.3 工程地基的"已就位"（避免重复造轮子）

下列能力 S1–S6 已落地，本轮可作为底座直接复用：

- `simulateMonth` 纯函数契约（`SimulationInput` / `SimulationResult`）—— Worker 化的天然 API 边界。
- `state.version: "0.3.0"` 已写入 `GameState`——存档迁移链的起点。
- `expireModifiers` 已在 `simulation.ts:53` 月初调用——修正生命周期已闭环。
- `validateInvariants` 已在月末调用——状态不变量已有挂载点。
- `createRandom` 固定种子——`computeStateHash` 不需要包含随机序列，只需包含会被随机影响的字段。
- `applyLedgerToState` 已统一财政——避免拆分账本时破坏"唯一真相源"。
- `cliqueTemplates` / `lawLibrary` / `situationLibrary` 数据驱动——新增 CI 校验时直接挂 `data:validate` 钩子。

---

## 2. 目标架构（与方案原稿第四章 §4 对齐，并落到代码结构）

```text
src/
  core/                      # 纯函数模拟层（不依赖 React / DOM / Zustand）
    simulation.ts            # 编排器（拆分为阶段函数）
    simulationPhases/        # 【新增】月度阶段函数
      runRegionPhase.ts
      runFactionPhase.ts
      runDiplomacyPhase.ts
      runPoliticsPhase.ts
      runWarPhase.ts
      runSituationPhase.ts
      finalizeMonth.ts
    timing.ts                # 【新增】SimulationTiming + recordPhase()
    stateHash.ts             # 【新增】computeStateHash()（确定性 SHA-1）
  runtime/                   # 【新增】Simulation Service 抽象层
    simulationService.ts     # interface SimulationService
    localSimulationService.ts    # 主线程实现（短期默认）
    workerSimulationService.ts   # Worker 实现（P0b 视基线上）
    simulation.worker.ts     # Worker 入口
    simulationMessages.ts    # WorkerRequest / WorkerResponse 类型
    viewSnapshot.ts          # GameViewSnapshot / MonthResult / AdvanceProgress
  store/                     # Zustand 拆分后的两个 store
    uiStore.ts               # 【新增】UiState：selectedRegionId / mapLayer / activePanel / simulationStatus
    gameViewStore.ts         # 【新增】GameViewState：currentDate / playerFaction / regions / reports / pendingEvent
    gameStore.ts             # 【瘦身】只保留 startGame / saveGame / loadGame 等基础设施
  save/
    saveManager.ts           # 改造：版本化 SaveFile + checksum + 三自动存档槽
    saveMigrations.ts        # 【新增】migrations: Record<number, SaveMigration>
    saveValidation.ts        # 【新增】validateSaveFile()
  scripts/
    perfMonth.ts             # 【新增】npm run perf:month
    perfYear.ts              # 【新增】npm run perf:year
    perfFullGame.ts          # 【新增】npm run perf:fullgame
    perfClone.ts             # 【新增】npm run perf:clone
    perfSave.ts              # 【新增】npm run perf:save
    perfReport.ts            # 【新增】npm run perf:report
    stateHash.ts             # 【新增】npm run hash:state
.github/workflows/
  ci.yml                     # 【新增】每次 PR：typecheck + test + build + map:validate + batch + perf:smoke
  perf-regression.yml        # 【新增】每周：perf:fullgame + hash 回归
```

---

## 3. 目标架构的四个关键设计决策

### 3.1 阶段函数拆分：编排器变薄，阶段可测可计

**原则（承接方案原稿 §6.4）**：保留 `simulateMonth` 对外接口，**内部按月度流水线顺序**拆为 7 个阶段函数；每个阶段接收统一的 `SimulationContext`（state + random + decisions + reports + ledgerEntries + timings），返回阶段结果。

```ts
// src/core/timing.ts
export interface SimulationTiming {
  total: number;          // ms
  clone: number;          // ms
  regions: number;        // ms（runRegionPhase）
  market: number;         // ms（市场供需 / 价格）
  diplomacy: number;      // ms（advanceDiplomacy）
  warfare: number;        // ms（resolveBattle / advanceWar / checkPeace / resolvePeace）
  politics: number;       // ms（advanceReforms / advancePoliticalMovements）
  situation: number;      // ms（advanceSituations）
  validation: number;     // ms（validateInvariants）
}

// src/core/simulationContext.ts
export interface SimulationContext {
  state: GameState;
  random: RandomGenerator;
  playerDecision: PlayerDecision;
  aiDecisions: Record<FactionId, PlayerDecision>;
  reports: MonthlyReport[];
  ledgerEntries: LedgerEntry[];
  timings?: SimulationTiming;
  phaseStart: number;     // performance.now() at phase entry
}

// src/core/simulationPhases/runRegionPhase.ts
export function runRegionPhase(ctx: SimulationContext): void { /* ... */ }
```

**约束**：阶段拆分**不改变结算顺序**。原 `simulation.ts:44-?` 的流水线顺序锁定为 7 阶段流水线（见 §3.2）。

### 3.2 月度流水线 7 阶段顺序（v0.6 锁定版）

```text
S1. 月初：expireModifiers + generateDisasters + chooseAllAiDecisions
S2. runRegionPhase：地区循环（pop / 经济 / 控制 / 叛乱 / 市场 / 人口 / 账本）
S3. runFactionPhase：势力循环（维护费 / 征募 S5b 分级）
S4. runDiplomacyPhase：advanceDiplomacy（外交演变 + 条约财政）
S5. runPoliticsPhase：autoProposeReforms + advanceReforms + advancePoliticalMovements
S6. runWarPhase：resolveBattle + advanceWar + checkPeace + resolvePeace
S7. finalizeMonth：账本归档 + 事件检测 + 局势推进 + 不变量校验
```

**与当前 `simulation.ts` 流水线对照**（参考 `PROGRESS.md §5.4`）：

| 当前顺序（PROGRESS 文档） | v0.6 阶段名 | 是否改动 |
|---|---|---|
| expire modifiers | S1 月初 | 不变 |
| region 循环 | S2 runRegionPhase | 抽取为函数 |
| faction 循环 | S3 runFactionPhase | 抽取为函数 |
| advanceDiplomacy | S4 runDiplomacyPhase | 抽取为函数 |
| applyResourceCrises / eliminateDefeatedFactions / updateFactionCliques | S2 末尾（保留在 region 阶段后） | 不变 |
| autoProposeReforms + advanceReforms + advancePoliticalMovements | S5 runPoliticsPhase | 抽取为函数 |
| 战斗 + 事件 | S6 runWarPhase + S7 finalizeMonth | 拆分 |
| advanceWar + checkPeace / resolvePeace | S6 runWarPhase | 抽取为函数 |
| 账本归档 + 贸易/价格 | S7 finalizeMonth | 抽取为函数 |

**约束**：阶段名改了，**对外可见的随机序列、月度结果、固定种子回归哈希全部不变**。阶段计时是新增字段，不影响随机消费点。

### 3.3 Simulation Service 抽象：UI 不再直接调 simulateMonth

**原则（承接方案原稿 §4.2 / §7.1）**：

```ts
// src/runtime/simulationService.ts
export interface SimulationService {
  startGame(options: StartGameOptions): Promise<GameViewSnapshot>;
  advanceMonth(decision: PlayerDecision): Promise<MonthResult>;
  advanceMonths(
    count: number,
    decisionProvider: DecisionProvider
  ): Promise<AdvanceResult>;
  saveGame(slot?: string): Promise<SerializedSave>;
  loadGame(save: SerializedSave): Promise<GameViewSnapshot>;
  pause(): void;
  resume(): void;
  getFullStateForDebug(): Promise<GameState>;
}
```

**两阶段交付**：

- **第一阶段（v0.6-a）**：`LocalSimulationService`——主线程实现，签名已对齐 Worker 版本。UI 调用 `useSimulationService()`，与现有 `simulateMonth` 通过 `simulationPhases/` 中的纯函数实现，业务逻辑零变化。
- **第二阶段（v0.6-b）**：`WorkerSimulationService`——按方案原稿 §7.1 引入 `simulation.worker.ts`，主线程只发命令、Worker 返回 `MonthResult` / `GameViewSnapshot`。**前提**：第一阶段 `perf:month` 证明单月在主线程上不可接受时才上。

### 3.4 状态分层：权威 / 展示 / 历史摘要三分

**原则（承接方案原稿 §8.1）**：

| 分层 | 数据 | 写入路径 | 存档是否带 |
|---|---|---|---|
| 权威状态 | 地区 / 势力 / 人口组 / 市场 / 产业 / 战争 / 外交 / 改革 / 修正 / 随机种子 | 仅 `simulateMonth` 内部 / SimulationService 写 | ✅ |
| 展示状态 | 选中地区 / 面板开关 / 地图图层 / 排序 / 折叠 / 临时筛选 | 仅 `useUiStore` 写 | ❌（不写存档） |
| 历史摘要 | 年度人口 / 国库 / 军队 / 控制区 / 价格 / 重要事件节点 | 月末由 `finalizeMonth` 追加 | ✅（单独 summary 字段） |

**落地**：

- `useUiStore`（P1 落地）：`selectedRegionId` / `mapLayer` / `activePanel` / `simulationStatus` / `simulationProgress`。
- `useGameViewStore`（P1 落地）：从 `simulateMonth` 返回的 `GameViewSnapshot` 喂入，**不直接持有 GameState**。
- 完整 `GameState` 仅 `SimulationService` 内部持有（短期 `LocalSimulationService` 用模块级变量；Worker 版在 Worker 线程）。

---

## 4. 分阶段建设内容（6 阶段 + 5 里程碑）

### 阶段 1：性能基线 + 阶段计时 + 状态哈希（P0 / 里程碑 A）

**目标**：在**不改任何业务逻辑**的前提下，建立"项目变慢吗？慢在哪一环？同一输入是否得到同一哈希？"的可测量底座。

#### 4.1 性能脚本（`npm run perf:*`）

```bash
# package.json 新增 scripts
"perf:month":     "tsx src/scripts/perfMonth.ts"
"perf:year":      "tsx src/scripts/perfYear.ts"
"perf:fullgame":  "tsx src/scripts/perfFullGame.ts"
"perf:clone":     "tsx src/scripts/perfClone.ts"
"perf:save":      "tsx src/scripts/perfSave.ts"
"perf:report":    "tsx src/scripts/perfReport.ts"
"hash:state":     "tsx src/scripts/stateHash.ts"
```

**测量项**（与方案原稿 §5.1 对齐）：

| 脚本 | 输入 | 输出 |
|---|---|---|
| `perf:month` | seed7 单月 × 100 次 | 平均 / P50 / P95 / 最大耗时 |
| `perf:year` | seed7 12 月 × 10 轮 | 总耗时 / 月均 |
| `perf:fullgame` | seed7 1080 月 × 3 种子 | 总耗时 / 末日不变量 |
| `perf:clone` | 0/240/1080 月状态各克隆 1000 次 | 平均 / P95 / 最大耗时 |
| `perf:save` | 0/240/1080 月各 save→load 100 次 | 平均 / P95 + save 文件体积 |
| `perf:report` | 1080 月跑完统计 | 报告条数 / 账本月数 / 哈希 |

#### 4.2 阶段计时（`SimulationTiming`）

在 `simulateMonth` 内**对每个阶段起止 `performance.now()`**（开发模式默认开，生产模式默认关，可由环境变量 `MINGWAR_TIMING=1` 开启）：

```ts
// src/core/timing.ts
export const ZERO_TIMING: SimulationTiming = {
  total: 0, clone: 0, regions: 0, market: 0,
  diplomacy: 0, warfare: 0, politics: 0,
  situation: 0, validation: 0
};

export function recordPhase(
  timings: SimulationTiming,
  phase: keyof Omit<SimulationTiming, "total">,
  startMs: number
): void {
  if (import.meta.env?.PROD && !import.meta.env?.MINGWAR_TIMING) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  timings[phase] += now - startMs;
}
```

**约束**：阶段计时**不消费 `random`**，不修改 state，**不影响固定种子回归哈希**。计时点放在阶段入口和出口，**不放进阶段内部**（避免和业务逻辑耦合）。

#### 4.3 状态哈希（`computeStateHash`）

```ts
// src/core/stateHash.ts
import type { GameState } from "./types";

/**
 * 计算权威状态的稳定哈希。
 * 排除 UI 字段、创建时间、性能计时、浏览器环境信息。
 * 用于：确定性测试、读档验证、Worker 一致性、版本回归。
 */
export function computeStateHash(state: GameState): string {
  const canonical = {
    version: state.version,
    seed: state.seed,
    currentDate: state.currentDate,
    playerFactionId: state.playerFactionId,
    factions: state.factions,
    regions: state.regions,
    wars: state.wars,
    diplomacy: state.diplomacy,
    reforms: state.reforms,
    situations: state.situations,
    activeModifiers: state.activeModifiers
  };
  return sha1Hex(JSON.stringify(canonical));
}
```

**关键点**：
- `activeModifiers` 包含**所有 effect 与剩余月份**，是模拟结果的一部分 → 必须纳入。
- `state.reports` 是 UI 历史（仅显示）→ 排除。
- `timings` 是新增的运行时字段 → 排除。
- `createdAt` / `updatedAt` → 排除。
- 哈希算法固定 SHA-1（足够快 + 浏览器原生 + 跨平台稳定），不引入 npm 依赖。

#### 4.4 阶段 1 验收

- [ ] `npm run perf:month` 可重复运行，输出 JSON 报告。
- [ ] `npm run perf:year` / `perf:fullgame` / `perf:clone` / `perf:save` / `perf:report` 全部生成。
- [ ] `npm run hash:state` 对同一 seed7 第 0 月输出确定值 `hash(seed=7, month=0)`，与记录基线一致。
- [ ] 性能脚本**不修改正式游戏结果**：跑完 100 次后 `state` 哈希与单次跑一致。
- [ ] 阶段计时在 `MINGWAR_TIMING=1` 时输出"前 3 慢阶段"，默认关时不输出（不影响单月耗时）。
- [ ] 现有 377 测试仍全绿（**阶段 1 不动任何业务代码**）。

#### 4.5 阶段 1 初始基线目标（参考，最终值以实测为准）

| 指标 | 基线目标 | 备注 |
|---|---|---|
| 单月 P95（主线程） | < 80 ms | 若超过 200 ms 强制上 Worker |
| 12 月推演 | < 1.5 s | |
| 1080 月推演 | < 60 s | |
| 开局 `structuredClone` | < 5 ms | |
| 240 月 `structuredClone` | < 25 ms | |
| 存档文件体积（1080 月） | < 2 MB | 软上限，到达后强制历史压缩 |
| 状态哈希耗时 | < 2 ms | 跑 hash 不应是瓶颈 |

---

### 阶段 2：低风险结构优化（P0 + P1 / 里程碑 B）

**目标**：在不改变游戏结果的前提下，**降低重渲染、降低代码耦合、为 Worker 化铺路**。

#### 4.6 Zustand Store 拆分

```ts
// src/store/uiStore.ts
export interface UiState {
  selectedRegionId: RegionId | null;
  mapLayer: MapLayer;
  activePanel: string | null;
  simulationStatus: "idle" | "running" | "paused";
  simulationProgress: number;       // 连续推进进度 0-1
  pendingEventId: string | null;
}
export const useUiStore = create<UiState>((set) => ({ /* ... */ }));

// src/store/gameViewStore.ts
export interface GameViewState {
  currentDate: string;
  playerFaction: PlayerFactionView;
  regions: Record<RegionId, RegionView>;
  reports: MonthlyReport[];
  alerts: Alert[];
  pendingEvent: PendingEventView | null;
}
export const useGameViewStore = create<GameViewState>((set) => ({ /* ... */ }));
```

**落地规则（硬性）**：
- 所有 React 组件**必须**通过精确选择器读取：`useUiStore((s) => s.selectedRegionId)`，**禁止** `const store = useUiStore()`。
- 列表（`regions` / `reports` / `alerts`）使用 `useShallow` 或自定义浅比较 selector。
- `gameStore.ts` 退化为"基础设施层"：只留 `startGame` / `saveGame` / `loadGame` / `useSimulationService` 等**调用 SimulationService 的薄包装**。

#### 4.7 地图渲染隔离

`GameMap.tsx` 只订阅地图必要字段：

```ts
// 反例（禁止）
const state = useGameStore((s) => s.state);
const region = state.regions[state.selectedRegionId];

// 正例（要求）
const layer = useUiStore((s) => s.mapLayer);
const regions = useGameViewStore((s) => s.regions);
const isSelected = useUiStore((s) => s.selectedRegionId);
const warFlags = useGameViewStore(
  (s) => s.warMarkers,  // 派生：{ regionId -> 是否有活跃战争 }
  shallow
);
```

**目标**：账本月结、外交关系变化、报告新增**不应触发全部 SVG 地区重渲染**。在 React DevTools Profiler 下，账本更新后 `GameMap` 的 commit 次数应下降 ≥ 80%。

#### 4.8 月度流水线分阶段

按 §3.1 / §3.2 把 `simulateMonth` 拆为 7 阶段函数，**不改变对外行为**。新增 `src/core/simulationPhases/` 目录。

**约束**：
- 每个 `run*Phase(ctx)` 是**纯函数**（除了 `ctx.state` 内部 mutate，因为当前 `simulateMonth` 也是这种风格——后续阶段 3 改 immutable 时一并调整）。
- `simulateMonth` 主体变为"按顺序调用 7 个阶段 + 写 timings" 的薄编排。
- 阶段内部**不调用 `recordPhase`**——由编排器统一计时。
- 现有 377 测试应**全部不需修改**通过。

#### 4.9 阶段 2 验收

- [ ] 现有 377 测试全绿，**无任何测试代码改动**（证明对外行为不变）。
- [ ] `npm run hash:state` 对 seed7 第 0/12/120/240/1080 月哈希与阶段 1 基线完全一致。
- [ ] `npm run batch`（100×240）`errorRuns=0`，大明存活率/控制区/粮价等指标与 v0.3.0 基线 ±5% 以内。
- [ ] React DevTools Profiler：账本更新后 `GameMap` commit 次数下降 ≥ 80%。
- [ ] `simulation.ts` 行数 < 200（拆阶段后），单阶段函数行数 < 250。

---

### 阶段 3：Simulation Service 抽象 + 主线程隔离（P0 / 里程碑 C）

**目标**：把"UI 调 `simulateMonth`"改为"UI 调 `SimulationService.advanceMonth`"，并为 Worker 化准备好接口。

#### 4.10 SimulationService 接口与两个实现

```ts
// src/runtime/simulationService.ts
export interface StartGameOptions {
  factionId: FactionId;
  seed: number;
  scenario?: string;
}
export interface DecisionProvider {
  (monthIndex: number, date: string): PlayerDecision;
}
export interface MonthResult {
  date: string;
  newReports: MonthlyReport[];
  newAlerts: Alert[];
  pendingEvent: PendingEventView | null;
  stateHash: string;
  timings: SimulationTiming;
}
export interface AdvanceResult {
  months: MonthResult[];
  aborted: boolean;     // true = 玩家覆灭 / 事件中断 / 到达 endDate
  reason: "ended" | "collapsed" | "event" | "user-pause" | "error";
}
export interface SerializedSave {
  format: "ming-war-save";
  saveVersion: number;
  gameVersion: string;
  createdAt: string;
  updatedAt: string;
  checksum: string;
  metadata: SaveMetadata;
  state: GameState;
}
export interface GameViewSnapshot {
  currentDate: string;
  playerFaction: PlayerFactionView;
  regions: Record<RegionId, RegionView>;
  reports: MonthlyReport[];
  alerts: Alert[];
  pendingEvent: PendingEventView | null;
  stateHash: string;
}
```

#### 4.11 `LocalSimulationService`（第一阶段默认实现）

```ts
// src/runtime/localSimulationService.ts
export class LocalSimulationService implements SimulationService {
  private state: GameState;
  private running = false;
  private paused = false;
  // ...

  async advanceMonth(decision: PlayerDecision): Promise<MonthResult> {
    if (this.running) throw new Error("Simulation already running");
    this.running = true;
    try {
      const result = simulateMonth({
        state: this.state,
        playerDecision: decision,
        randomSeed: this.state.seed
      });
      this.state = result.nextState;
      return toMonthResult(result);
    } finally {
      this.running = false;
    }
  }

  async advanceMonths(count: number, provider: DecisionProvider): Promise<AdvanceResult> {
    const out: MonthResult[] = [];
    for (let i = 0; i < count; i++) {
      if (this.paused) return { months: out, aborted: true, reason: "user-pause" };
      if (this.state.currentDate >= "1662-12") return { months: out, aborted: true, reason: "ended" };
      const decision = provider(i, this.state.currentDate);
      const month = await this.advanceMonth(decision);
      out.push(month);
      // 玩家覆灭 / 事件中断 / 异常 → 立即返回
      if (month.pendingEvent) return { months: out, aborted: true, reason: "event" };
      if (!isPlayerAlive(this.state)) return { months: out, aborted: true, reason: "collapsed" };
    }
    return { months: out, aborted: false, reason: "ended" };
  }
}
```

**落地路径**：
1. 抽出 `gameViewStore` 的 `GameViewSnapshot` 构造（从 `simulateMonth` 的 `SimulationResult` 派生）。
2. `gameStore.advanceOneMonth` 改为 `await useSimulationService().advanceMonth(decision)`。
3. `App.tsx` 改为 `await onAdvance()`，按钮 disable 状态从 `useUiStore.simulationStatus === "running"` 读取。

#### 4.12 连续推进机制（对应方案原稿 §7.3）

- 连续推进必须可暂停（`pause()` 立即生效，**不阻塞当前已开始的月份**）。
- 事件触发时自动暂停（`pendingEvent !== null`）。
- 玩家势力 `collapsed` 时自动结束。
- 到达 `1662-12` 自动结束。
- 进度展示：`useUiStore.simulationProgress = (i + 1) / count`。

**约束**：单月内**不让出主线程**（主线程仍需"完成当月"才返回），但**月与月之间让出 `await Promise.resolve()`**——避免连续推进冻结 UI（连续 1000 月是常见批量推演场景）。

#### 4.13 Worker 一致性测试

```ts
// src/tests/workerConsistency.test.ts
it("Worker and Local simulation produce identical state hash", async () => {
  const local = new LocalSimulationService();
  const worker = new WorkerSimulationService();  // 真实启 Worker

  await local.startGame({ factionId: "ming", seed: 7 });
  await worker.startGame({ factionId: "ming", seed: 7 });

  for (let m = 0; m < 240; m++) {
    const l = await local.advanceMonth(defaultPlayerDecision);
    const w = await worker.advanceMonth(defaultPlayerDecision);
    expect(w.stateHash).toBe(l.stateHash);
  }
});
```

**该测试必须有 Worker 实际运行**（不是 mock），且**不消费 random** 的阶段在两端保持一致。`resolveBattle` 首月遭遇战是当前唯一消费 random 的地方，Worker 和主线程必须共享 `RandomGenerator` 实现的种子序列——为此本 SPEC 规定 `createRandom` 是**纯 JS 模块**，Worker 直接 import。

#### 4.14 阶段 3 验收

- [ ] `useSimulationService()` 全局单例，UI 不再直接 `import { simulateMonth }`。
- [ ] 连续推进 12 月 / 120 月 / 240 月**主线程不冻结**（连续推进期间可切换面板、点击地图、暂停）。
- [ ] `npm run hash:state` 在 LocalSimulationService 下与阶段 1/2 完全一致。
- [ ] Worker 一致性测试 240 月全等（哈希、报告、事件）。
- [ ] 阶段 1 性能基线**不退化**：单月 P95、1080 月总耗时 ±10% 以内。
- [ ] Worker 模式下 `npm run batch`（100×240）`errorRuns=0` 不变。

---

### 阶段 4：状态和历史数据治理（P1 / 里程碑 D 之一）

**目标**：把方案原稿 §8 的"权威 / 展示 / 历史摘要"三分落地，**控制 GameState 体积**。

#### 4.15 状态分层落地

- `useUiStore` 接管所有展示状态（见 §4.6）。
- `SimulationService` 内部持权威 `GameState`（Local 模式：模块级 WeakMap 引用；Worker 模式：Worker 内存）。
- `useGameViewStore` 持**派生的 GameViewSnapshot**（浅计算，存的是 `Map<RegionId, RegionView>` 而不是完整 `RegionState`）。

#### 4.16 历史压缩策略

按方案原稿 §8.2 锁定以下规则（在 `simulateMonth` 月末 `finalizeMonth` 阶段）：

| 字段 | 保留规则 | 实现位置 |
|---|---|---|
| `reports` | 最近 100 条 | `simulateMonth` 末尾切片（当前已实现） |
| `ledgerEntries` | 最近 60 个月 | `simulateMonth` 末尾切片（当前已实现） |
| `state.reforms[*].history` | 仅保留 `enactedDate` + `outcome` | 数据结构调整 |
| `state.wars[*].fronts[*].monthlyProgress` | 仅保留最近 12 月 | 数组环形缓冲 |
| `state.diplomacy[*].relationHistory` | 移除或降为季度采样 | 删除字段 |
| 新增 `state.annualSummary` | 年度聚合：人口 / 国库 / 军队 / 控制区数 / 粮价 | 每年 12 月追加 |
| 新增 `state.milestones` | 重要事件永久记录（开战 / 媾和 / 改革落实 / 局势结局） | 状态变化时 push |

**约束**：所有压缩**不破坏月度连续模拟**——压缩的是"展示用历史"，**不**是"模拟用状态"。

#### 4.17 快照机制（为阶段 5 存档恢复铺路）

```ts
// src/runtime/localSimulationService.ts
interface RuntimeSnapshot {
  date: string;
  state: GameState;     // 完整 GameState
  decision: PlayerDecision;
}
class LocalSimulationService {
  private snapshots: RuntimeSnapshot[] = [];  // 玩家决策点序列
  // 每 N 月或事件触发时存一个 full snapshot
}
```

- 开局完整快照（强制）。
- 每 12 月一个完整快照（可调）。
- 玩家决策点（外交动作 / 改革手选 / 求和）= 完整快照。
- 事件选项 = 完整快照。

**不上线 UI**——快照是 SimulationService 内部细节，只暴露 `getFullStateForDebug()` 给开发面板。

#### 4.18 阶段 4 验收

- [ ] 1080 月跑完后，`JSON.stringify(state).length` 下降 ≥ 30%（vs v0.3.0）。
- [ ] 1080 月存档文件体积 ≤ 1.5 MB。
- [ ] 历史压缩**不破坏固定种子回归**（`hash(seed=7, month=1080)` 与压缩前一致）。
- [ ] 现有 377 测试 + 阶段 2/3 新增测试全绿。
- [ ] `npm run batch`（100×240）指标不退化。

---

### 阶段 5：存档稳定性建设（P0 / 里程碑 D 之二）

**目标**：把方案原稿 §9 的存档结构 / 校验 / 迁移 / 自动存档四件事**全部落地**。

#### 4.19 存档结构（取代当前 `SaveGame`）

```ts
// src/save/saveManager.ts
export interface SaveFile {
  format: "ming-war-save";      // 标识这是 MING-WAR 存档
  saveVersion: number;           // 存档 schema 版本（整数，自增）
  gameVersion: string;           // 应用版本号 "0.4.0"
  createdAt: string;             // ISO 时间
  updatedAt: string;             // ISO 时间
  checksum: string;              // SHA-1(state JSON)
  metadata: SaveMetadata;
  state: GameState;
  decision: PlayerDecision;      // 玩家最后决策，存读档后立即应用
}
export interface SaveMetadata {
  currentDate: string;
  playerFaction: FactionId;
  gameVersion: string;
  saveVersion: number;
  seed: number;
  status: "active" | "ended" | "collapsed";
  controlledRegions: number;
  playTimeMinutes: number;       // 从开局累计
  saveName: string;              // 用户可命名
  scenario?: string;
}
```

#### 4.20 存档校验

```ts
// src/save/saveValidation.ts
export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}
export function validateSaveFile(save: unknown): ValidationResult {
  // 1. JSON 结构（type guard）
  // 2. format === "ming-war-save"
  // 3. saveVersion 已知
  // 4. 必需字段：state, decision, metadata, checksum
  // 5. 数据类型校验
  // 6. checksum 一致（重新计算 SHA-1 与 save.checksum 对比）
  // 7. 地区和势力引用关系（factions[*].id === regions[*].controllerFactionId）
  // 8. 无 NaN / Infinity（递归遍历数值字段）
  // 9. 当前日期合法（YYYY-MM 格式 + 1573 ≤ year ≤ 1662）
}
```

**约束**：校验失败时**不抛异常**，**返回结构化错误**，UI 用 `Alert` 提示玩家"该存档已损坏"。

#### 4.21 存档迁移链

```ts
// src/save/saveMigrations.ts
export type SaveMigration = (state: GameState) => GameState;
export const migrations: Record<number, SaveMigration> = {
  // 1: migrateV1ToV2,   // 老 v0.3.0 → v0.4.0
  // 2: migrateV2ToV3,   // v0.4.0 → v0.5.0
};
export function migrateSave(save: SaveFile): SaveFile {
  let current = save;
  for (let v = current.saveVersion; v < CURRENT_SAVE_VERSION; v++) {
    const mig = migrations[v + 1];
    if (!mig) throw new Error(`No migration for saveVersion ${v + 1}`);
    current = { ...current, state: mig(current.state), saveVersion: v + 1, updatedAt: new Date().toISOString() };
  }
  return current;
}
```

**当前现状**：`saveManager.ts:67-97` 的 `migrateGameState` 是**硬编码单步迁移**（只认 `"0.3.0"`）。本 SPEC 要求**重写为版本链 + 校验**，不写散在 if/else 的临时兼容。

#### 4.22 三自动存档槽

```ts
// src/save/autoSave.ts
export type AutoSaveSlot = "monthly" | "yearly" | "milestone";

export async function writeAutoSave(
  slot: AutoSaveSlot,
  save: SaveFile
): Promise<void> {
  const key = `mingwar:autosave:${slot}`;
  // 临时记录 + 原子替换：先写 .tmp，校验通过后覆盖正式槽
  const tmp = `${key}.tmp`;
  await idbPut(tmp, save);
  const valid = validateSaveFile(save).ok;
  if (!valid) {
    await idbDelete(tmp);
    return;  // 失败不覆盖上一个有效存档
  }
  await idbPut(key, save);
  await idbDelete(tmp);
}
```

**触发时机**（在 `LocalSimulationService` / `WorkerSimulationService` 内）：
- `monthly`：每月结算后。
- `yearly`：每年 12 月。
- `milestone`：战争开战 / 媾和 / 改革落实 / 局势结局 / 玩家势力覆灭时。

**约束**：自动存档失败**不抛**、不弹 modal、**不阻塞**当前游戏。失败时只在 `useUiStore.alerts` 推一条 `level: "warning"`。

#### 4.23 阶段 5 验收

- [ ] 同一存档连续读写 100 次后结果一致。
- [ ] 旧版本（v0.3.0）存档可通过迁移链读取。
- [ ] 损坏存档（手动改 checksum）不会导致页面崩溃，UI 显示"存档已损坏"。
- [ ] 存档读取后固定种子结果不改变（`hash(state)` 与存档前一致）。
- [ ] 自动存档失败不覆盖上一个有效存档。
- [ ] 完整 1080 月存档体积 ≤ 1.5 MB。
- [ ] 现有 377 测试全绿 + 阶段 1-4 新增测试全绿。

---

### 阶段 6：测试与 CI 建设（P0 / 里程碑 E）

**目标**：把方案原稿 §10 的测试层级 + CI 分层**全部落地**，让"性能退化、确定性漂移、存档迁移失败"在 PR 阶段就被拦下。

#### 4.24 测试层级

| 层级 | 内容 | 文件 |
|---|---|---|
| 单元测试 | 经济 / 人口 / 市场 / 财政 / 政治 / 改革 / 外交 / 战争 / 局势 / 不变量（**已有 377 个**） | `src/tests/*` |
| 阶段测试 | runRegionPhase / runFactionPhase / runDiplomacyPhase / runPoliticsPhase / runWarPhase / finalizeMonth **独立**测试 | `src/tests/phases/*.test.ts` |
| 确定性测试 | 同 seed + 同决策 + 两次执行 → 状态哈希一致 | `src/tests/determinism.test.ts`（增强） |
| Worker 一致性 | LocalSimulationService vs WorkerSimulationService 240 月哈希一致 | `src/tests/workerConsistency.test.ts` |
| 存档测试 | 新建 / 覆盖 / 删除 / 读档 / 版本迁移 / 校验失败 / 中断写入恢复 | `src/tests/saveStore.test.ts`（增强）+ `src/tests/saveMigration.test.ts` |
| 性能基线 | `perf:smoke` 单月耗时 < 200 ms / `perf:fullgame` 1080 月 < 120 s | `src/scripts/perf*.ts` + CI |

#### 4.25 CI 分层

```yaml
# .github/workflows/ci.yml（每次 PR / push to main）
name: CI
on: [push, pull_request]
jobs:
  quick:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npm run map:validate
      - run: npm run hash:state  # seed7 第 0/120/1080 月哈希应与基线一致
      - run: npm run perf:smoke  # 强制单月 < 200ms
```

```yaml
# .github/workflows/perf-regression.yml（每周 / 手动触发）
name: Perf Regression
on:
  schedule: [{ cron: "0 2 * * 0" }]  # 每周日 02:00 UTC
  workflow_dispatch:
jobs:
  perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm run batch        # 100×240 errorRuns=0
      - run: npm run perf:fullgame # 1080 月 × 3 种子
      - run: npm run hash:state    # 跨版本哈希回归
      - run: npm run test:save     # 存档迁移 / 校验 / 中断恢复
```

#### 4.26 CI 失败策略（与方案原稿 §10.3 对齐）

以下任一失败都视为 PR 不能合并：

- [ ] `tsc --noEmit` 错误
- [ ] 单元测试失败
- [ ] `state.invariants` 出现 error
- [ ] 确定性哈希变化且无 `// DETERMINISM-CHANGE: <reason>` 注释说明
- [ ] 地图引用校验失败
- [ ] 存档迁移失败
- [ ] 批量模拟出现 `errorRuns > 0`
- [ ] `perf:smoke` 单月耗时退化 > 20%
- [ ] 1080 月跑完出现 NaN / Infinity / 非法负值 / 悬空引用

#### 4.27 阶段 6 验收

- [ ] CI 在 PR 上 5 分钟内出结果（typecheck + test + build + map:validate + hash:state + perf:smoke）。
- [ ] perf-regression workflow 周跑成功（不超时、不退化）。
- [ ] 阶段 1-5 所有测试 + 阶段 6 新增测试**全绿**。
- [ ] README 增补"贡献前必读 CI 红线"。

---

## 5. 性能验收指标（与方案原稿第十一章对齐，并按当前数据调整）

### 5.1 月度模拟（与方案原稿 §11.1 表对应）

| 场景 | 目标 P95 | 备注 |
|---|---|---|
| 开局第一个月 | < 30 ms | |
| 运行 10 年后单月 | < 80 ms | |
| 运行 50 年后单月 | < 120 ms | |
| 战争高峰期单月 | < 200 ms | |
| 多势力多叛乱单月 | < 250 ms | |

**红线**：单月 P95 超过 300 ms 必须上 Worker。

### 5.2 连续推进

| 场景 | 目标 | 备注 |
|---|---|---|
| 12 月连续推进 | < 1.5 s | |
| 120 月连续推进 | < 15 s | |
| 240 月连续推进 | < 30 s | |
| 完整 1080 月 | < 90 s | |
| 连续推进期间 UI 响应 | 推进期间可点击地图 / 切面板 / 暂停 | **P0 硬要求** |

### 5.3 内存

| 场景 | 目标 |
|---|---|
| 开局 heap | < 30 MB |
| 240 月 heap | < 80 MB |
| 1080 月 heap | < 150 MB |
| 重新开始游戏后 | heap 回落 ≥ 70% |
| 重复读档 | 不持续增长（无引用泄漏） |

### 5.4 稳定性

- [ ] 完整 1080 月至少 20 个种子无 error
- [ ] 不变量 error 数量恒为 0
- [ ] 无 NaN / Infinity / 非法负值
- [ ] 无悬空地区 / 势力 / 战争 / 外交引用
- [ ] 同一版本同一输入哈希一致
- [ ] Worker 模式与本地模式结果一致
- [ ] 存档 100 次读写结果一致
- [ ] 自动存档失败不破坏上一个有效存档

---

## 6. 调试与可观测性建设（与方案原稿第十二章对齐）

### 6.1 开发调试面板（仅 dev 模式）

`DebugPanel` 组件（`/debug?panel=1` 启用）显示：

- 当前随机种子
- 当前状态哈希
- 单月总耗时
- 各阶段耗时
- 当前内存估算（`performance.memory.usedJSHeapSize`）
- 地区数量 / 人口组数量 / 活跃战争数量 / 活跃修正数量
- 报告数量 / 账本月份数
- 最近一次不变量检查结果

### 6.2 状态哈希工具

`computeStateHash(state)` 见 §4.3，用途：

- 确定性测试（`hash(simulate(seed, decisions)) === hash(simulate(seed, decisions))`）
- 读档验证（`hash(savedState) === hash(loadedState)`）
- Worker 一致性验证
- 版本回归比较（`hash(v0.4.0, seed=7, m=1080)` vs `hash(v0.5.0, ...)`）

### 6.3 错误报告

```ts
export interface SimulationError {
  code: string;             // "INVARIANT-001" / "WORKER-CRASH" / "SAVE-CORRUPT"
  phase: SimulationPhase;   // "region" | "faction" | "diplomacy" | "war" | "finalize"
  date: string;
  seed: number;
  message: string;
  stack?: string;
  stateHash?: string;
  recoveryHint?: string;    // "请尝试重新读档到上 12 月快照"
}
```

**约束**：错误报告**不**把完整存档和所有内部数据写入浏览器控制台。生产环境只打印 `code + message`，开发环境可展开 `stack + stateHash`。

---

## 7. 实施优先级（与方案原稿第十三章对齐）

### P0：必须完成

1. 性能基线（`perf:*`）
2. 阶段计时（`SimulationTiming`）
3. 确定性哈希（`computeStateHash`）
4. 存档校验（`validateSaveFile`）
5. Zustand 精确选择器（`useUiStore` / `useGameViewStore` 拆分）
6. CI 自动执行（`ci.yml`）
7. 完整 1080 月稳定性测试

### P1：建议完成

1. SimulationService 抽象
2. UI 状态和模拟状态分离
3. 月度流水线分阶段（`run*Phase`）
4. Web Worker（**仅在 P0 性能基线超标时**）
5. 连续推进暂停和进度
6. 自动存档与恢复

### P2：后续增强

1. 年度快照和重放
2. 性能调试面板
3. 状态差量同步
4. 历史摘要压缩
5. 浏览器崩溃恢复
6. 存档导入导出

---

## 8. 阶段性验收顺序（5 里程碑）

| 里程碑 | 内容 | 验收 |
|---|---|---|
| **A：可测量** | 性能脚本、阶段计时、状态哈希、基线报告 | 已能客观判断项目是否变慢，慢在哪一环 |
| **B：低风险稳定性** | Store 拆分、选择器治理、流水线分阶段、历史容量控制 | 玩法结果不变，重渲染下降 ≥ 80% |
| **C：主线程无阻塞** | SimulationService + Web Worker（视基线决定） | 月度模拟和连续推进不再冻结界面 |
| **D：存档可靠** | 版本化、校验、迁移、自动存档、异常恢复 | 长周期运行和版本升级不导致存档损坏 |
| **E：自动化守门** | CI、确定性、Worker 一致性、完整周期、性能退化检查 | 后续增加内容时自动发现性能/稳定性回退 |

---

## 9. 风险与控制措施（与方案原稿第十五章对齐）

### 9.1 Worker 迁移引入结果差异

- **措施 1**：先建立 `LocalSimulationService`，Worker 只替换执行位置，不动业务。
- **措施 2**：阶段 3 必须跑 Worker 一致性测试 240 月全等。
- **措施 3**：Worker 一致性测试失败时自动回退 `useLocalSimulationService()`，UI 不感知。
- **措施 4**：`createRandom` 必须是纯 JS 模块，Worker 和主线程 import 同一份实现。

### 9.2 状态拆分造成数据不同步

- **措施 1**：Worker 内部状态为唯一权威状态。
- **措施 2**：UI 不得直接修改模拟状态。
- **措施 3**：所有操作通过 `SimulationService` 命令。
- **措施 4**：`MonthResult` 携带 `stateHash`，UI 端校验。

### 9.3 性能优化破坏确定性

- **措施 1**：阶段计时**不**放在 `random.next()` 之后。
- **措施 2**：阶段拆分**不**改 `random` 调用次数与顺序。
- **措施 3**：每次合并 PR 跑 `hash:state` 跨节点回归（0/12/120/240/1080 月）。
- **措施 4**：哈希变化必须有 `// DETERMINISM-CHANGE: <reason>` 注释 + 同步更新 `docs/PROGRESS.md`。

### 9.4 过度优化增加复杂度

- **措施 1**：没有性能数据证明的问题不提前重写。
- **措施 2**：不引入 WASM。
- **措施 3**：不把所有数据改成二进制结构。
- **措施 4**：核心类型（`GameState` / `FactionState` / `RegionState`）保持可读。

### 9.5 存档迁移破坏旧存档

- **措施 1**：迁移链**不可降级**（老存档只能向前迁到新版本）。
- **措施 2**：每次改 `GameState` 结构必须**先**加 migration **再**合 PR。
- **措施 3**：`saveMigration.test.ts` 必须覆盖**所有**已有版本对。
- **措施 4**：归档测试存档到 `src/tests/fixtures/saves/`。

### 9.6 Worker 在某些浏览器 / 隐私模式下不可用

- **措施 1**：`WorkerSimulationService` 构造时检测 `typeof Worker !== "undefined"`，不可用则抛 `WorkerUnavailableError`。
- **措施 2**：`useSimulationService()` 工厂自动回退 `LocalSimulationService`。
- **措施 3**：UI 在回退时推一条 `info` Alert："当前浏览器不支持 Web Worker，已自动切换主线程模式"。

---

## 10. 最终交付物（与方案原稿第十六章对齐，按本 SPEC 落地）

1. 性能基线报告（`docs/perf-baseline.md`）
2. 月度模拟阶段计时系统（`src/core/timing.ts`）
3. 确定性状态哈希工具（`src/core/stateHash.ts`）
4. 拆分后的模拟流水线（`src/core/simulationPhases/`）
5. SimulationService 统一接口（`src/runtime/simulationService.ts`）
6. Web Worker 模拟运行环境（`src/runtime/workerSimulationService.ts` + `src/runtime/simulation.worker.ts`，**仅在基线超标时**）
7. UI Store 与 Game View Store（`src/store/uiStore.ts` + `src/store/gameViewStore.ts`）
8. 连续推进、暂停和进度机制
9. 版本化存档和迁移系统（`src/save/saveMigrations.ts`）
10. 自动存档和异常恢复机制（`src/save/autoSave.ts`）
11. 完整周期稳定性测试（`src/tests/stabilityFullGame.test.ts`）
12. Worker 与本地模式一致性测试（`src/tests/workerConsistency.test.ts`）
13. GitHub Actions 持续集成（`.github/workflows/ci.yml` + `perf-regression.yml`）
14. 开发调试和性能诊断面板（`src/ui/dialogs/DebugPanel.tsx`）
15. 项目优化开发文档（本文档 + `PROGRESS.md` 同步更新）

---

## 11. 建设完成判定（与方案原稿第十七章对齐）

满足以下**全部**条件时，认定本轮优化建设完成：

- [ ] 31 地区完整游戏周期（1080 月）稳定运行，20 种子全绿。
- [ ] 单月推进不会造成明显界面卡顿（P95 < 200 ms）。
- [ ] 连续推演支持暂停、事件中断、玩家覆灭中断、到达 1662-12 自动结束。
- [ ] 模拟逻辑与 UI 线程完成隔离（Worker 模式）**或**性能基线已证明主线程足够（需在 `docs/perf-baseline.md` 留档）。
- [ ] 固定种子结果保持确定性（`hash:state` 跨版本一致）。
- [ ] Worker 模式与本地模式结果一致。
- [ ] 存档可以校验、迁移和恢复（100 次读写结果一致）。
- [ ] 状态历史增长得到控制（1080 月存档 ≤ 1.5 MB，heap ≤ 150 MB）。
- [ ] CI 自动完成 typecheck / test / build / map:validate / hash:state / perf:smoke。
- [ ] 批量模拟继续保持 `errorRuns=0`（100×240）。
- [ ] 项目后续增加事件、法律、局势时，不需要再次改造基础运行架构。

---

## 12. 接手指引（继承 PROGRESS.md 风格）

### 12.1 新增性能阶段

如果阶段 1-6 之外需要新增**性能相关**优化：

1. 先在 `docs/perf-baseline.md` 写明"假设"。
2. 跑 `npm run perf:month` / `perf:year` / `perf:fullgame` 拿数据。
3. 写实现（必须是阶段 7 中已存在的阶段或新增阶段）。
4. 跑同套 perf 脚本拿数据。
5. 在 `PROGRESS.md` 写战报（基线 → 优化后数据对比）。

### 12.2 调阶段函数

阶段 1-6 把 `simulation.ts` 拆为 `src/core/simulationPhases/run*Phase.ts` 后：

- 修改任何阶段前先看 `src/core/simulationContext.ts` 与 `src/core/timing.ts`。
- 不要在阶段函数内调用 `recordPhase`——由 `simulateMonth` 编排器统一计时。
- 不要改 `random` 调用次数与顺序。

### 12.3 新增存档版本

1. 在 `src/save/saveMigrations.ts` 加 `migrateVnToVnPlus1`。
2. 在 `src/tests/fixtures/saves/` 放旧版本存档。
3. 在 `src/tests/saveMigration.test.ts` 加 `it("migrates v<n> to v<n+1>", ...)`。
4. `npm run hash:state` 验证迁移后状态哈希与最新基线一致。

### 12.4 验证命令总览

```bash
# 必跑（PR 红线）
npm run typecheck
npm test
npm run build
npm run map:validate
npm run hash:state
npm run perf:smoke

# 阶段合并后跑（里程碑验收）
npm run batch                # 100×240 errorRuns=0
npm run diagnose             # seed7 单局 10 年
npm run perf:fullgame        # 1080 月 × 3 种子
npm run test:save            # 存档迁移 / 校验 / 中断恢复
npm run test:worker          # Worker 一致性
```

---

## 13. 与已有 SPEC 的关系

| 文档 | 内容 | 关系 |
|---|---|---|
| `MING-WAR_优化改进方案_SPEC.md`（v0.4-design） | P0–P6 内容建设路线：人口 / 产业 / 政治 / 外交 / 战争 / 局势 | **内容层**——本 SPEC 不重做 |
| `v2-optimization-spec.md`（v0.5-design） | S1–S6 五环闭环战报 | **业务层**——本 SPEC 是其稳定性延续 |
| `MING-WAR《万历：山河崩塌》Web 架构流畅稳定优化建设方案.docx`（原稿） | 十八章运行底座建设 | **方法层**——本 SPEC 把十八章翻译成可执行任务 |
| **本文档**（v0.6-stability-design） | 性能 / 状态 / Worker / 存档 / CI 改造 | **架构层**——直接接 S1–S6 的工程化延伸 |

---

## 14. 总结

本 SPEC 的最终目标**与方案原稿一致**：

> 保留现有 React 19、TypeScript 5.7、Vite 6、Zustand 5、Vitest 3、纯函数模拟体系，通过性能基线、状态分层、Worker 隔离、存档治理和自动化测试，使当前 31 地区 90 年（1080 月）历史周期的游戏能够**长期、稳定、流畅**地运行。

本轮**不做**：
- 不增加事件 / 局势 / 法律内容。
- 不重写经济 / 人口 / 战争公式。
- 不引入 WASM / 3D 地图 / 联机。

本轮**只做**：
- 让已有的 377 测试 + 6 种局势结局**跑得动、跑得稳、跑得可恢复**。
- 把"什么时候变慢、慢在哪一环、能不能恢复"变成可测量的工程指标。
- 为下一轮（v0.7 / v0.8 内容扩充）留下**不需要再改造基础架构**的运行底座。
