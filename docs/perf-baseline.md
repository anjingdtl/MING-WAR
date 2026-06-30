# MING-WAR 性能基线报告

> 文档版本：v0.6-stability-baseline
> 编写日期：2026-06-30
> 用途：记录各 perf: 脚本的初始基线数据，作为后续 phase 优化前后的对比基准。

---

## 0. 基线采集方法

- 测试机：本机（Node.js ≥ 20）
- 测量方式：每个 perf 脚本用 `performance.now()` 在每次循环起止采样，输出 mean / p50 / p95 / max / min。
- 模拟条件：seed=7，faction=ming，playerDecision=defaultPlayerDecision，**不**含任何用户交互。
- 重复次数：可通过环境变量 `PERF_RUNS` / `PERF_YEAR_ROUNDS` 调整。

---

## 1. 初始基线（v0.3.0 + Phase 1 计时）

> 已采集（commit Phase 1 之前无基线对照，下列数字为 Phase 1 完成后本机首次采样）。

```bash
npm run perf:smoke      # 20 次单月
npm run perf:clone      # 不同月数各 1000 次 clone
npm run perf:save       # 不同月数各 100 次 JSON 序列化
npm run hash:state      # 6 节点状态哈希
```

### 1.1 单月（`perf:smoke` / `perf:month`，20 次采样）

| 指标 | 实测值 | 红线 |
|---|---|---|
| mean | 3.569 ms | — |
| p50 | 2.385 ms | — |
| p95 | 24.153 ms | < 200 ms ✅ |
| max | 24.153 ms | < 300 ms ✅ |
| min | 2.063 ms | — |

> 结论：单月模拟在主线程上**远低于** Worker 强制阈值（300 ms），Phase 3 的 Worker 改造**降为可选**。Phase 3 仅做 LocalSimulationService 抽象，Worker 实现留待 v0.7 视长跑性能决定。

### 1.4 structuredClone（`perf:clone`，1000 次采样）

| 月数 | mean ms | p95 ms | max ms |
|---|---|---|---|
| 0 | 0.979 | 1.249 | 2.236 |
| 240 | 9.580 | 15.954 | 19.072 |
| 1080 | 5.829 | 9.866 | 13.080 |

> 1080 月反而比 240 月快：因 ledgerHistory 60 月上限后大块历史（120 月起）已被压缩。

### 1.5 存档 JSON 体积（`perf:save`，100 次采样）

| 月数 | JSON 字节 | JSON KB | stringify mean | parse mean |
|---|---|---|---|---|
| 0 | 120803 | 117.97 | 0.341 ms | 0.445 ms |
| 240 | 756810 | 739.07 | 3.726 ms | 5.465 ms |
| 1080 | 557509 | 544.44 | 1.546 ms | 1.971 ms |

> 1080 月存档 544 KB，**远低于** SPEC 软上限 1.5 MB。状态分层后预计可再降 30%。

### 1.6 状态哈希（`hash:state`，seed=7）

| 月数 | 日期 | 哈希 |
|---|---|---|
| 0 | 1573-01 | `0b970ece82d2f0151bc90c8ea9cfaa3eaf492220` |
| 12 | 1574-01 | `c13553b1ebe88e45b293c2210a216d8259ca32d5` |
| 120 | 1583-01 | `89396aa447416b166a071c3a64d26db5ff3b198f` |
| 240 | 1593-01 | `c4e601c2d2dfbaff7d0f7c2a3171d6323abdbe2f` |
| 1080 | 1663-01 | `34c8763b4ec0ab296d1b820c029cc938ee1d14e7` |

> **跨版本回归红线**：上述 5 个哈希在 Phase 2-6 全部完成后**必须**保持一致。任何漂移需 `// DETERMINISM-CHANGE: <reason>` 注释 + PROGRESS.md 同步。

---

## 2. 阶段计时分布（`simulateMonth` timings）

`simulateMonth` 返回 `SimulationTiming`，dev 模式默认有值，prod 默认关。

| 阶段 | 含义 | 预期耗时占比 |
|---|---|---|
| clone | 月初 `structuredClone(state)` | < 5% |
| regions | 地区循环（pop/经济/控制/叛乱/市场/人口） | > 50% |
| market | 跨地区贸易 + 价格 + auto-invest | < 10% |
| faction | 势力循环（维护费/征募/腐败累积） | < 15% |
| diplomacy | 外交演变 + applyResourceCrises + 集团更新 | < 5% |
| politics | 法律改革 + 政治运动 | < 5% |
| warfare | 战斗 + 战线 + 和谈 | < 10% |
| situation | 历史局势推进 | < 1% |
| finalize | 推进日期 + ledger 历史 + 迁移 + 不变量 + history + alerts | < 5% |
| validation | `validateInvariants` | < 1% |

> 跑 `npm run perf:smoke` 后，把 `simulateMonth` 返回的 `timings` 字段填入上表。

---

## 3. 后续阶段验收

每完成一个 phase（2/3/4/5/6），重新跑 `npm run perf:month` / `npm run hash:state`，把数据追加到本文档 §4。

---

## 4. Phase 对比记录

| Phase | commit | 单月 p95 | hash 漂移 | 备注 |
|---|---|---|---|---|
| 0 (v0.3.0 + Phase 1) | 4cd82db | 24.153 ms | baseline | 410 测试全绿 |
| 2 (流水线拆分) | 5b94e35 | 25.340 ms | **0 漂移** ✅ | 5 节点哈希完全一致 |
| 3 (store 拆分) | c89a843 | 30.462 ms | **0 漂移** ✅ | 427 测试全绿 |
| 4 (Service 抽象) | _TBD_ | 26.103 ms | **0 漂移** ✅ | 438 测试全绿 |
| 5 (存档升级) | _TBD_ | 26.602 ms | **0 漂移** ✅ | 461 测试全绿 |
| 6 (CI) | _TBD_ | _TBD_ | _TBD_ | — |

### Phase 5 详情（存档版本化 / 校验 / 迁移 / 自动存档）

- 新增 `src/save/saveValidation.ts`：`validateSaveFile`（9 步校验）
  1. JSON 结构（type guard）
  2. format === "ming-war-save"
  3. saveVersion 已知
  4. 必需字段
  5. 数据类型
  6. checksum 一致（用 computeStateHash 重算）
  7. 引用关系（地区 → 势力）
  8. 无 NaN / Infinity
  9. 日期合法（YYYY-MM，1573–1662）
- 新增 `src/save/saveMigrations.ts`：
  - `migrations: Record<number, SaveMigration>`（当前 v1，无内联迁移）
  - `migrateSave`：向前链式迁移
  - `isLegacyV030Save`：检测老 v0.3.0 字符串版本存档
  - `migrateLegacyV030ToV1`：老存档 → 新 SerializedSave（自动补 metadata + checksum）
- 改造 `src/save/saveManager.ts`：
  - `writeSave` / `readSave`（新版 SerializedSave）
  - `saveGame` / `loadGame` / `listSaves` / `migrateGameState`（旧 SaveGame 兼容层）
  - `migrateAllLegacySaves`：一次性 IDB 升级
- 新增 `src/save/autoSave.ts`：
  - 3 槽自动存档（monthly / yearly / milestone）
  - 原子替换（tmp → 校验 → 覆盖）
  - 失败不覆盖上一个有效存档
  - `isYearBoundary(date)` 工具
- 新增测试：
  - `src/tests/saveValidation.test.ts`：12 步校验覆盖
  - `src/tests/saveMigration.test.ts`：11 步迁移覆盖
  - `src/tests/autoSave.test.ts`：3 个业务规则测试（IDB 写入靠浏览器原生验证）
- 测试数：438 → 461

**关键不变量**：
- 5 节点 hash 与 Phase 1/2/3/4 完全一致
- 旧 v0.3.0 存档可读（迁移正确）
- 损坏存档不崩（返回 null + errors）
- 旧 `save-store.test.ts` 测试仍通过（兼容层）

### Phase 4 详情（SimulationService 抽象）

- 新增 `src/runtime/simulationService.ts`：`SimulationService` 接口（11 方法）
- 新增 `src/runtime/viewSnapshot.ts`：
  - `GameViewSnapshot` / `MonthResult` / `AdvanceResult` / `SerializedSave`
  - `DecisionProvider` / `SimulationProgress` / `StartGameOptions`
  - `PlayerFactionView` / `RegionView` / `PendingEventView`
- 新增 `src/runtime/localSimulationService.ts`：主线程实现
  - 调用 `simulateMonth`（背后是 Phase 2 的 7 阶段）
  - `startGame` / `advanceMonth` / `advanceMonths` / `saveGame` / `loadGame`
  - `pause` / `resume` / `isPaused` / `onProgress` / `getFullStateForDebug`
  - 自动终止：玩家覆灭 / endDate 到达 / 事件触发
  - 连续推进用 `requestAnimationFrame` 让出主线程
- 新增 `src/tests/simulationService.test.ts`：11 个 service 测试
  - 包含 10 月确定性测试（双 service 同 hash）
- 修复 `src/tests/storeSplit.test.ts`：`mapLayer` 值与类型对齐
- 测试数：427 → 438

**关键不变量**：
- 5 节点 hash 与 Phase 1/2/3 完全一致
- `LocalSimulationService.advanceMonth` 与直接 `simulateMonth` 同 hash
- service 内不消费 random 顺序、不改写 phase 内部逻辑

### Phase 3 详情（Store 拆分）

- 新增 `src/store/uiStore.ts`：`useUiStore`（UI 状态）
  - `selectedRegionId` / `mapLayer` / `pendingEventId`
  - `simulationStatus` / `simulationProgress`（连续推进用）
  - `sidePanelOpen` / `activePanel`（侧边面板）
- 新增 `src/store/gameViewStore.ts`：`useGameViewStore`（view 派生）
  - `currentDate` / `gameStatus` / `playerFaction`（摘要）/ `reports` / `alerts`
  - `decision`（玩家决策）
  - `setView` / `appendReports` / `setPendingEvent` / `setAlerts` / `setDecision`
  - `derivePlayerFactionSummary()` 工具函数
- 改造 `src/store/gameStore.ts`（兼容层）：
  - 移除 UI 字段（迁到 useUiStore）
  - 保留 `state` + 玩家决策 + 模拟动作
  - 每次 `state` 变更后通过 `syncViewStore` 同步到 view store
- 改造 `src/app/App.tsx`：全部改用精确选择器
  - `useGameStore((s) => s.state)` / `useGameStore((s) => s.advanceOneMonth)` 等
  - `useUiStore((s) => s.mapLayer)` / `useUiStore((s) => s.selectRegion)` 等
  - `useGameViewStore((s) => s.decision)` / `useGameViewStore((s) => s.reports)`
- 新增 `src/tests/storeSplit.test.ts`：10 个 store 拆分测试
- 测试数：417 → 427

**关键不变量**：
- 5 节点 hash 与 Phase 1/2 完全一致
- 旧组件使用 `useGameStore.getState().state.startGame` / `advanceOneMonth` 仍能工作（兼容层）

### Phase 2 详情（流水线拆分）

- simulation.ts：777 行 → 145 行（编排器）
- 新增 `src/core/simulationContext.ts`：`SimulationContext` + `createSimulationContext` + `PhaseFn` 类型
- 新增 `src/core/simulationPhases/`：
  - `runRegionPhase.ts`（S2，地区循环）
  - `runFactionPhase.ts`（S3，势力循环）
  - `runDiplomacyPhase.ts`（S4，外交 + 资源危机 + 集团）
  - `runPoliticsPhase.ts`（S5，改革 + 运动）
  - `runSituationPhase.ts`（S6，历史局势）
  - `runWarPhase.ts`（S7，战斗 + 战线 + 和谈）
  - `finalizeMonth.ts`（S8，月末收口）
  - `helpers.ts`（applyRebellionConsequences / countControlledRegions）
- 新增 `src/tests/phases.test.ts`：7 阶段独立测试（每阶段验证 invariant error = 0）

**关键不变量**：
- random 消费点顺序保留（generateDisasters → applyResourceCrises → resolveBattle）
- state 写入顺序保留
- applyLedgerToState 调用顺序保留
- 5 节点 hash（0/12/120/240/1080 月）与 Phase 1 baseline **完全一致**
