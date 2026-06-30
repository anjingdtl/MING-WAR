# MING-WAR 流畅稳定优化改造 — 执行计划 PLAN

> 项目代号：MING-WAR
> 文档版本：v0.6-stability-plan
> 编写日期：2026-06-30
> 上游文档：`docs/MING-WAR_Web架构流畅稳定优化改造_SPEC.md`（v0.6-stability-design）
> 执行模式：6 阶段顺序执行，每阶段结束做 review + commit
> 范围：纯运行底座改造，不重做 S1–S6 业务逻辑

---

## 0. 执行原则

1. **顺序执行**：6 阶段有强依赖（基线→拆分→服务化→存档→CI），不允许跳阶段。
2. **零回归硬要求**：每阶段结束必须 `npm test` 全绿；阶段 2 起的"对外行为不变"用 `hash:state` 跨节点验证。
3. **小步提交**：每阶段可拆为多个 commit（feat: / refactor: / test: / chore:），但**阶段边界必须有一次 review**。
4. **TDD 优先**：所有新功能先写测试再实现；纯重构（拆函数、改名）不需新测试。
5. **不引入新依赖**：不装 WASM / 新状态库 / Web Worker 库（Worker 阶段视基线决定，本 PLAN 不上）。
6. **最后做全量回归**：6 阶段全部 commit 后跑 typecheck + test + build + map:validate + batch + diagnose + perf:smoke + hash:state，fix 后再 push。

---

## 1. Phase 划分与依赖

```text
┌────────────────────────┐
│ Phase 1: 可测量底座     │  perf:month/year/fullgame/clone/save
│   性能脚本 + 阶段计时    │  SimulationTiming（dev-only）
│   + 状态哈希            │  computeStateHash
└──────────┬─────────────┘
           │  阶段 1 是后续所有阶段验证的底座
           ▼
┌────────────────────────┐
│ Phase 2: 月度流水线拆分  │  src/core/simulationPhases/run*Phase.ts
│   simulateMonth 拆 7 阶段 │  simulation.ts 变薄
└──────────┬─────────────┘
           │  hash:state 不漂 = 拆分成功
           ▼
┌────────────────────────┐
│ Phase 3: Zustand 拆分    │  src/store/uiStore.ts
│   UI Store / Game View  │  src/store/gameViewStore.ts
│   Store / 精确选择器     │  gameStore.ts 瘦身
└──────────┬─────────────┘
           │  UI 不再订阅全 state
           ▼
┌────────────────────────┐
│ Phase 4: Simulation     │  src/runtime/simulationService.ts
│   Service 抽象层         │  src/runtime/localSimulationService.ts
│   (LocalSimulationService)│  UI 通过 service 调 simulateMonth
└──────────┬─────────────┘
           │  service 内部调用阶段函数（继承 Phase 2）
           ▼
┌────────────────────────┐
│ Phase 5: 存档稳定性      │  SaveFile 升级（format/saveVersion/checksum）
│   版本化 / 校验 / 迁移   │  saveMigrations.ts / saveValidation.ts
│   / 自动存档            │  autoSave.ts (monthly/yearly/milestone)
└──────────┬─────────────┘
           │  存档可恢复、可迁移
           ▼
┌────────────────────────┐
│ Phase 6: CI 自动化       │  .github/workflows/ci.yml
│   PR 红线 + 周回归      │  .github/workflows/perf-regression.yml
└──────────┬─────────────┘
           │  任何回归在 PR 阶段被拦下
           ▼
┌────────────────────────┐
│ 全量回归 + Fix + Push   │  typecheck + test + build + map:validate
│                         │  + batch + diagnose + perf:smoke + hash:state
└────────────────────────┘
```

---

## 2. Phase 1：可测量底座（性能脚本 + 阶段计时 + 状态哈希）

### 2.1 目标

在不改变业务逻辑的前提下，建立"项目变慢吗？慢在哪一环？同输入同结果吗？"的可测底座。

### 2.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 1.1 | 新增 `SimulationTiming` 类型 | `src/core/timing.ts`（新） | 类型可被 `simulateMonth` 返回值引用 |
| 1.2 | 在 `simulateMonth` 起止与各阶段内插入 `performance.now()` 计时 | `src/core/simulation.ts` | dev mode 输出前 3 慢阶段；prod 默认关 |
| 1.3 | 新增 `computeStateHash(state)` | `src/core/stateHash.ts`（新） | 排除 UI 字段 / timings / 时间戳；SHA-1；跨平台稳定 |
| 1.4 | 新增 `src/scripts/perfMonth.ts` | `src/scripts/` | seed7 单月 × 100 次 → mean/p50/p95/max |
| 1.5 | 新增 `src/scripts/perfYear.ts` | `src/scripts/` | seed7 12 月 × 10 轮 → 总耗时 + 月均 |
| 1.6 | 新增 `src/scripts/perfFullGame.ts` | `src/scripts/` | seed7 1080 月 × 3 种子 → 总耗时 + 末日不变量 |
| 1.7 | 新增 `src/scripts/perfClone.ts` | `src/scripts/` | 0/240/1080 月状态各 clone 1000 次 → mean/p95 |
| 1.8 | 新增 `src/scripts/perfSave.ts` | `src/scripts/` | 0/240/1080 月各 save→load 100 次 → 体积 + 耗时 |
| 1.9 | 新增 `src/scripts/stateHash.ts` | `src/scripts/` | 输出 seed=7 第 0/12/120/240/1080 月哈希 |
| 1.10 | package.json 新增 scripts | `package.json` | `perf:month` / `perf:year` / `perf:fullgame` / `perf:clone` / `perf:save` / `perf:report` / `hash:state` |
| 1.11 | 新增 `docs/perf-baseline.md` | `docs/` | 初始基线数据（无则写"待测"） |
| 1.12 | 新增 `src/tests/stateHash.test.ts` | `src/tests/` | 排除字段正确 / 同输入同哈希 / 排除 timestamps |

### 2.3 风险与约束

- **计时不应进入 `random.next()` 之前**——避免改变随机消费点。
- **计时本身在 prod 应为 0 开销**——用 `if (import.meta.env?.DEV)` 包裹。
- **`computeStateHash` 必须用同步 SHA-1**——不引 npm 依赖，写一个 30 行的稳定实现。
- **基线脚本不得修改正式 gameState**——`structuredClone` 后跑，跑完丢弃。

### 2.4 Review 检查表

- [ ] `npm run typecheck` 0 错误
- [ ] `npm test` 全绿（377+ 测试）
- [ ] `npm run hash:state` 6 个节点哈希打印成功
- [ ] `npm run perf:smoke`（如果新增）单月 < 200ms
- [ ] `simulation.ts` 仍 777 行（**未拆分**）
- [ ] 没有业务逻辑变化

### 2.5 Commit 计划

```bash
git add src/core/timing.ts src/core/stateHash.ts src/scripts/perf*.ts src/scripts/stateHash.ts package.json src/tests/stateHash.test.ts docs/perf-baseline.md
git commit -m "feat(perf): phase 1 — timing, state hash, perf scripts (baseline)"
```

---

## 3. Phase 2：月度流水线分阶段

### 3.1 目标

把 777 行 `simulateMonth` 拆为 7 个阶段函数 + 1 个编排器，**对外行为不变**（hash:state 跨节点回归一致）。

### 3.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 2.1 | 新增 `SimulationContext` 类型 | `src/core/simulationContext.ts`（新） | 包含 state/random/decisions/reports/ledgerEntries/timings/phaseStart |
| 2.2 | 抽取 `runRegionPhase` | `src/core/simulationPhases/runRegionPhase.ts`（新） | L64-258 地区循环 + S1c 账本 |
| 2.3 | 抽取 `runFactionPhase` | `src/core/simulationPhases/runFactionPhase.ts`（新） | L260-331 势力循环 + 征募 |
| 2.4 | 抽取 `runDiplomacyPhase` | `src/core/simulationPhases/runDiplomacyPhase.ts`（新） | L336-338 + L340-347 (applyResourceCrises/eliminate/updateCliques) |
| 2.5 | 抽取 `runPoliticsPhase` | `src/core/simulationPhases/runPoliticsPhase.ts`（新） | L353-394 改革 + 政治运动 |
| 2.6 | 抽取 `runWarPhase` | `src/core/simulationPhases/runWarPhase.ts`（新） | L415-475 战斗 + 战线 + 和谈 |
| 2.7 | 抽取 `runSituationPhase` | `src/core/simulationPhases/runSituationPhase.ts`（新） | L398-408 局势推进 |
| 2.8 | 抽取 `finalizeMonth` | `src/core/simulationPhases/finalizeMonth.ts`（新） | L509-577 推进日期 + ledger + trade + 不变量 + history + alerts |
| 2.9 | `simulateMonth` 改写为编排器 | `src/core/simulation.ts` | 行数 < 200，只调用 7 阶段 + 写 timings |
| 2.10 | 新增 `src/tests/phases/*.test.ts` | `src/tests/phases/`（新） | 至少 4 个 phase 独立测试（region/faction/war/finalize） |

### 3.3 关键约束

- **不改变随机消费点**：`random.next()` 调用次数与顺序严格保留。
- **不改变 `state` 写入顺序**：`state.regions[id] = ...` 等 mutate 路径不变。
- **不改变 `applyLedgerToState` 调用顺序**——账本是财政唯一真相源。
- **不引入新的可变性**——`SimulationContext` 是 mutable ref（与现有风格一致），不在阶段内部新建 state。
- **`recordPhase` 统一在编排器调用**——阶段内部不计时。

### 3.4 Review 检查表

- [ ] `npm run typecheck` 0 错误
- [ ] `npm test` 全绿（**无任何测试代码改动**——证明对外行为不变）
- [ ] `npm run hash:state` 6 节点哈希与 Phase 1 基线**完全一致**
- [ ] `npm run batch`（100×240）`errorRuns=0`，大明存活率/控制区/粮价 ±5% 以内
- [ ] `simulation.ts` 行数 < 200
- [ ] 7 阶段函数 + 1 context + 1 timing 文件全部存在
- [ ] 没有阶段函数内部调用 `recordPhase`

### 3.5 Commit 计划

```bash
git add src/core/simulationContext.ts src/core/simulationPhases/ src/core/simulation.ts src/tests/phases/
git commit -m "refactor(sim): phase 2 — split simulateMonth into 7 phases (no behavior change)"
```

---

## 4. Phase 3：Zustand Store 拆分

### 4.1 目标

把单一 `useGameStore` 拆为 3 个：UI / Game View / 基础设施。降低无关重渲染。

### 4.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 3.1 | 新增 `useUiStore` | `src/store/uiStore.ts`（新） | selectedRegionId / mapLayer / activePanel / simulationStatus / simulationProgress / pendingEventId |
| 3.2 | 新增 `useGameViewStore` | `src/store/gameViewStore.ts`（新） | currentDate / playerFaction / regions（derived view）/ reports / alerts / pendingEvent |
| 3.3 | 瘦身 `useGameStore` | `src/store/gameStore.ts` | 只保留 startGame / saveGame / loadGame 基础设施 |
| 3.4 | 改造 `App.tsx` 精确选择器 | `src/app/App.tsx` | 全部用 `useUiStore((s) => s.x)` / `useGameViewStore((s) => s.x)` 模式 |
| 3.5 | 改造 `GameMap.tsx` 不订阅全 state | `src/ui/map/GameMap.tsx` | 不再 `useGameStore` 全 state，只订阅 layer/regions/selected/war flags |
| 3.6 | 改造 `TopBar.tsx` 选 view state | `src/ui/layout/TopBar.tsx` | 不再 `useGameStore().state`，改 `useGameViewStore` |
| 3.7 | 改造 `SidePanel.tsx` 选 view state | `src/ui/layout/SidePanel.tsx` | 同上 |
| 3.8 | 改造 `LogPanel.tsx` 选 view state | `src/ui/panels/LogPanel.tsx` | reports 走 view store |
| 3.9 | 改造 `EventDialog.tsx` 选 UI 状态 | `src/ui/dialogs/EventDialog.tsx` | pendingEvent 走 view store |
| 3.10 | 新增 `src/tests/storeSplit.test.ts` | `src/tests/` | 三个 store 互不重叠；UI 改动不触发 view state |

### 4.3 关键约束

- **`useGameStore` 必须在 `gameStore.ts` 中保留兼容导出**（`export { useGameStore as useGameStoreCompat }`）— 旧测试和未改完组件不立即崩。
- **派生 `regions` view 字段必须保持稳定引用**——`useGameViewStore` 内部用 `subscribeWithSelector` 或派生 memo，避免每次 simulateMonth 后整个列表对象引用变化引起大面积重渲染。
- **`pendingEventId` 走 UI store**（影响弹窗），`pendingEvent`（resolved view）走 view store。

### 4.4 Review 检查表

- [ ] `npm run typecheck` 0 错误
- [ ] `npm test` 全绿
- [ ] `npm run hash:state` 6 节点哈希与 Phase 2 一致
- [ ] React DevTools Profiler：账本更新后 `GameMap` commit 次数下降（手测）
- [ ] `App.tsx` / `TopBar.tsx` / `GameMap.tsx` / `SidePanel.tsx` / `LogPanel.tsx` / `EventDialog.tsx` 全部用精确选择器
- [ ] `useGameStore` 仍能 work（兼容层）

### 4.5 Commit 计划

```bash
git add src/store/ src/app/App.tsx src/ui/map/GameMap.tsx src/ui/layout/TopBar.tsx src/ui/layout/SidePanel.tsx src/ui/panels/LogPanel.tsx src/ui/dialogs/EventDialog.tsx src/tests/storeSplit.test.ts
git commit -m "refactor(store): phase 3 — split gameStore into UI/View/infra stores"
```

---

## 5. Phase 4：Simulation Service 抽象

### 5.1 目标

把"UI 直接调 `simulateMonth`"改为"UI 调 `SimulationService.advanceMonth`"，为未来 Worker 化铺路。

### 5.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 4.1 | 定义 `SimulationService` 接口 | `src/runtime/simulationService.ts`（新） | startGame/advanceMonth/advanceMonths/saveGame/loadGame/pause/resume/getFullStateForDebug |
| 4.2 | 定义 `MonthResult` / `AdvanceResult` / `GameViewSnapshot` / `SerializedSave` / `DecisionProvider` | `src/runtime/viewSnapshot.ts`（新） | 类型完整 |
| 4.3 | 实现 `LocalSimulationService` | `src/runtime/localSimulationService.ts`（新） | 主线程实现，调用 Phase 2 的阶段函数 + Phase 3 的 view store |
| 4.4 | 新增 `useSimulationService()` hook | `src/runtime/useSimulationService.ts`（新） | 全局单例（默认 Local） |
| 4.5 | 改造 `gameStore.advanceOneMonth` → `useSimulationService().advanceMonth` | `src/store/gameStore.ts` | UI 不再直接 `import { simulateMonth }` |
| 4.6 | 改造 `App.tsx` async onAdvance | `src/app/App.tsx` | 按钮 disable 状态从 ui store 读 |
| 4.7 | 连续推进机制 | `src/runtime/localSimulationService.ts` | pause / resume / event-abort / collapse-abort / endDate-abort |
| 4.8 | `simulationStatus` 写入 ui store | `src/store/uiStore.ts` | idle/running/paused 实时更新 |
| 4.9 | `simulationProgress` 写入 ui store | `src/store/uiStore.ts` | 连续推进进度 0-1 |
| 4.10 | 新增 `src/tests/simulationService.test.ts` | `src/tests/` | startGame / advanceMonth / advanceMonths 正确，pause 立即生效 |

### 5.3 关键约束

- **本阶段不实现 Web Worker**——只有 LocalSimulationService。Worker 是 v0.7 的事。
- **determinism 保证**：`LocalSimulationService` 内部必须用与当前 `simulateMonth` **相同**的阶段函数调用顺序。
- **pause 语义**：`pause()` 立即生效（不阻塞当前月），下一月开始前检查 paused 标志。
- **player faction collapsed 检查**：advanceMonths 每步后调用 `isPlayerAlive(state)`。

### 5.4 Review 检查表

- [ ] `npm run typecheck` 0 错误
- [ ] `npm test` 全绿
- [ ] `npm run hash:state` 6 节点哈希与 Phase 3 一致
- [ ] `npm run batch` `errorRuns=0` 不变
- [ ] 连续推进 120 月**主线程不冻结**（手测：在推进期间点击地图、切换面板、暂停）
- [ ] UI 不再直接 import `simulateMonth`（grep 验证）
- [ ] pause/resume 工作

### 5.5 Commit 计划

```bash
git add src/runtime/ src/store/ src/app/App.tsx src/tests/simulationService.test.ts
git commit -m "feat(runtime): phase 4 — SimulationService abstraction (LocalSimulationService)"
```

---

## 6. Phase 5：存档稳定性

### 6.1 目标

存档结构升级、版本化迁移、结构化校验、3 槽自动存档。

### 6.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 5.1 | 新 `SaveFile` 接口 | `src/save/saveManager.ts` | format/saveVersion/gameVersion/createdAt/updatedAt/checksum/metadata/state/decision |
| 5.2 | 新 `SaveMetadata` 接口 | `src/save/saveManager.ts` | currentDate/playerFaction/gameVersion/saveVersion/seed/status/controlledRegions/playTimeMinutes/saveName |
| 5.3 | 实现 `validateSaveFile` | `src/save/saveValidation.ts`（新） | 9 步校验（结构/format/saveVersion/必需字段/类型/checksum/引用/NaN/日期） |
| 5.4 | 实现 `migrations: Record<number, SaveMigration>` | `src/save/saveMigrations.ts`（新） | v1=v0.3.0→v0.4.0 placeholder；`migrateSave` 函数 |
| 5.5 | 改写 `saveManager.ts` 读写路径 | `src/save/saveManager.ts` | 用新 SaveFile + validateSaveFile + migrateSave |
| 5.6 | 实现 3 槽自动存档 | `src/save/autoSave.ts`（新） | monthly / yearly / milestone；临时记录 + 原子替换 |
| 5.7 | 在 `LocalSimulationService` 触发自动存档 | `src/runtime/localSimulationService.ts` | 月末 / 年末 / 重大事件 |
| 5.8 | 失败不覆盖上一个有效存档 | `src/save/autoSave.ts` | 校验失败保留旧值 |
| 5.9 | 校验失败时 UI 推 alert | `src/runtime/localSimulationService.ts` | 不抛、不崩 |
| 5.10 | 新增 `src/tests/saveMigration.test.ts` | `src/tests/` | 旧 v0.3.0 存档可读 + 迁移正确 + 100 次读写一致 |
| 5.11 | 新增 `src/tests/saveValidation.test.ts` | `src/tests/` | 9 步校验逐项通过 |
| 5.12 | 新增 `src/tests/autoSave.test.ts` | `src/tests/` | 3 槽独立 / 失败保留旧值 / 原子替换 |
| 5.13 | `src/tests/fixtures/saves/v0.3.0.json` | `src/tests/fixtures/`（新目录） | 旧版本存档样本（手写 or 抓诊断生成） |

### 6.3 关键约束

- **迁移链只向前**（不降级）。
- **checksum 用 SHA-1**（与 stateHash 同一实现）。
- **校验失败不抛**——返回 `ValidationResult`。
- **自动存档失败不阻塞**——只在 `useUiStore.alerts` 推 warning。
- **不破坏现有存档 API**——`createSaveGame` / `loadGame` / `saveGame` / `listSaves` 签名保持兼容。

### 6.4 Review 检查表

- [ ] `npm run typecheck` 0 错误
- [ ] `npm test` 全绿（377+ 新存档测试）
- [ ] `npm run hash:state` 6 节点哈希与 Phase 4 一致
- [ ] 现有 IDB 存档可读（迁移正确）
- [ ] 100 次 save→load 一致
- [ ] 损坏存档不崩（手测：手动改 IDB 一条）
- [ ] 自动存档 3 槽正常写入

### 6.5 Commit 计划

```bash
git add src/save/ src/runtime/localSimulationService.ts src/tests/save*.test.ts src/tests/autoSave.test.ts src/tests/fixtures/
git commit -m "feat(save): phase 5 — versioned save + validation + migration + 3-slot autosave"
```

---

## 7. Phase 6：CI 自动化

### 7.1 目标

把"性能退化、确定性漂移、存档迁移失败"在 PR 阶段被拦下。

### 7.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 6.1 | 新增 `.github/workflows/ci.yml` | `.github/workflows/ci.yml`（新） | typecheck + test + build + map:validate + hash:state + perf:smoke |
| 6.2 | 新增 `.github/workflows/perf-regression.yml` | `.github/workflows/perf-regression.yml`（新） | batch + perf:fullgame + test:save（周跑） |
| 6.3 | `package.json` 新增 `perf:smoke` / `test:save` | `package.json` | 命令可执行 |
| 6.4 | 新增 `src/tests/determinism.test.ts` | `src/tests/` | 同 seed + 同决策 + 两次执行 → 状态哈希一致 |
| 6.5 | 强化 `src/tests/saveStore.test.ts` | `src/tests/` | 增补 100 次读写、迁移、校验失败 |
| 6.6 | `README.md` 增补 CI 红线 | `README.md` | "贡献前必读"段落 |
| 6.7 | `PROGRESS.md` 增补 Phase 6 战报 | `PROGRESS.md` | 同步 |

### 7.3 CI 关键命令

```yaml
# ci.yml
- run: npm ci
- run: npm run typecheck
- run: npm test
- run: npm run build
- run: npm run map:validate
- run: npm run hash:state
- run: npm run perf:smoke

# perf-regression.yml
- run: npm run batch
- run: npm run perf:fullgame
- run: npm run test:save
```

### 7.4 关键约束

- **CI 必须能在 5 分钟内出 PR 结果**。
- **perf:smoke 只测单月 + 12 月**（< 30s）。
- **不下载大型依赖**——`actions/setup-node@v4` + 缓存。
- **不强制推送**——只在 PR 阶段 check。

### 7.5 Review 检查表

- [ ] `.github/workflows/ci.yml` 语法正确（手测用 `act` 或 workflow lint）
- [ ] `npm run typecheck` / `test` / `build` / `map:validate` / `hash:state` / `perf:smoke` 全部本地通过
- [ ] `npm test` 全绿
- [ ] README 增补
- [ ] PROGRESS.md 增补

### 7.6 Commit 计划

```bash
git add .github/workflows/ package.json src/tests/determinism.test.ts src/tests/saveStore.test.ts README.md PROGRESS.md
git commit -m "ci: phase 6 — GitHub Actions CI + perf-regression workflow"
```

---

## 8. 全量回归（Phase 7）

### 8.1 目标

所有 Phase commit 完成后，跑完整回归套件，fix 发现的问题，再做最终 commit + push。

### 8.2 回归清单

```bash
# 1. 静态检查
npm run typecheck

# 2. 单元测试
npm test

# 3. 构建
npm run build

# 4. 地图校验
npm run map:validate

# 5. 状态哈希
npm run hash:state

# 6. 性能冒烟
npm run perf:smoke

# 7. 批量模拟（验收红线）
npm run batch

# 8. 单局诊断
npm run diagnose

# 9. 存档测试
npm run test:save
```

### 8.3 不变量验证

- [ ] 大明存活率 > 0.8
- [ ] 大明平均控制区 ~ 20-28
- [ ] 平均粮价 < 10
- [ ] `errorRuns=0`
- [ ] 6 种局势结局可在长跑中触发

### 8.4 Fix 策略

发现的任何回归问题必须按以下顺序处理：

1. **CI 红线失败**（typecheck / test / build / map:validate）：立即修复，禁止 commit。
2. **性能退化 > 20%**：评估是否回滚相关 phase，或追加优化 commit。
3. **确定性哈希变化**：必须有 `// DETERMINISM-CHANGE: <reason>` 注释 + PROGRESS.md 同步。
4. **batch 指标退化 > 10%**：评估是否影响玩法，不影响则记录在 PROGRESS.md。
5. **存档不兼容**：回滚 phase 5 改用兼容双轨。

### 8.5 最终 commit + push

```bash
git add .
git commit -m "fix: full regression fixes from v0.6 stability refactor"
git push origin main
```

---

## 9. 风险与回滚预案

| 风险 | 检测 | 回滚 |
|---|---|---|
| Phase 2 拆分引入哈希漂移 | `hash:state` 6 节点对比 | `git revert` 整个 phase 2 commit |
| Phase 3 store 拆分引入 UI 渲染异常 | Profiler / 视觉回归 | 保留 `useGameStore` 兼容层 → 切换到旧 store |
| Phase 4 service 抽象阻塞 UI | 手测连续推进 | 还原 `gameStore.advanceOneMonth` 直接调 `simulateMonth` |
| Phase 5 存档迁移破坏旧存档 | 旧 v0.3.0 fixture 测试 | 保留旧 `loadGame` 路径作为回退 |
| Phase 6 CI 配置错误 | workflow lint / `act` 本地测 | 删除 workflow |

---

## 10. 时间预算

每 phase 约 1 段工作块（实际执行 = review + 测试 + fix + commit）：

| Phase | 主要工作 | 期望耗时 |
|---|---|---|
| 1 | 新建 6 脚本 + 1 timing + 1 hash + 1 test | 中 |
| 2 | 拆 7 阶段 + 写编排器 | 大 |
| 3 | 拆 store + 改 6 个组件 | 中 |
| 4 | 新建 service + 改 UI 接入 | 中 |
| 5 | 存档结构升级 + 迁移 + 校验 + 3 槽 | 大 |
| 6 | CI workflow + 测试增强 | 小 |
| 7 | 全量回归 + fix + push | 中 |

---

## 11. 验证命令总览（最终）

```bash
# PR 红线（5 分钟内）
npm run typecheck
npm test
npm run build
npm run map:validate
npm run hash:state
npm run perf:smoke

# 阶段验收
npm run batch           # 100×240 errorRuns=0
npm run diagnose        # seed7 单局
npm run perf:fullgame   # 1080 月 × 3 种子
npm run test:save       # 存档测试
```

---

## 12. 完结

满足以下条件时，本轮优化改造 PLAN 执行完成：

- [ ] 6 phase 全部 commit
- [ ] 377+ 测试全绿（实际目标 410+）
- [ ] `hash:state` 6 节点哈希与 Phase 1 基线一致
- [ ] `npm run batch` `errorRuns=0`、大明可 collapse
- [ ] 6 种局势结局在长跑中可触发
- [ ] 全量回归 fix 完毕
- [ ] git push origin main 成功
