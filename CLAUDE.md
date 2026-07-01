# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目是什么

《万历：山河崩塌》(MING-WAR) —— 晚明大战略游戏，目标是模拟 **Victoria 3（维多利亚3）的社会经济闭环**。技术栈：React 19 + TypeScript（strict）+ Vite 6 + Zustand + Vitest 3。游戏从 1573 年推演至 1662 年，玩家扮演大明，AI 扮演建州/土默特/朝鲜/日本等势力，月度结算。

接手前先读 **`PROGRESS.md`** ——它是项目的活路标（走到哪、怎么验证、哪里有坑、下一步）。详细设计在 `docs/`（SPEC + PLAN），最新方向是 v0.7 地图重构 + 四层艺术系统（见 `docs/MING-WAR_MapRefactor_v0.7_*.md`）。

## 常用命令

```bash
npm run dev            # Vite 开发服务器
npm run build          # tsc -b && vite build（typecheck 集成在 build 内）
npm run typecheck      # tsc --noEmit，独立类型检查（CI 红线之一）
npm test               # vitest run（全量单测）
npm run test:watch     # vitest watch
npm test -- src/tests/reform.test.ts   # 跑单个测试文件（参数透传给 vitest）
```

### 模拟 / 地图 / 性能脚本（项目特有，都在 `src/scripts/`）

```bash
npm run map:validate       # 校验地图地区（playable 图块数量与 GameState.regions 一致）
npm run map:rebuild-geo    # 从 Natural Earth GeoJSON 重建底图（需联网，见下「地图流水线」）
npm run map:generate       # 重新生成地图地区
npm run batch              # 100×240 批量模拟，errorRuns 必须为 0
npm run diagnose           # 单局 seed7 月度轨迹 + popGroups 守恒审计
npm run hash:state         # 确定性哈希回归（跨版本对照，5 节点必须 0 漂移）
npm run perf:smoke         # 单月 ×20，性能烟雾测试
npm run perf:fullgame      # 1080 月 ×3 种子全局长跑
npm run test:save          # 存档迁移 / 校验 / 自动存档测试
npm run test:determinism   # 确定性专项测试
```

## 验收红线（每次改动必须全绿）

CI（`.github/workflows/ci.yml`）在 PR 上强制这些通过才能合并：

1. `npm run typecheck` 零错误
2. `npm test` 全绿（当前 ~470 测试）
3. `npm run build` 成功
4. `npm run map:validate` 通过
5. `npm run hash:state` —— **确定性哈希不能漂移**。若改动有意改变了确定性轨迹，必须在提交里加 `DETERMINISM-CHANGE` 注释并同步 `PROGRESS.md`。
6. `npm run perf:smoke` 退化不超过 20%

长跑红线（`perf-regression.yml`，周更 + main push）：`npm run batch`（errorRuns=0）、`perf:fullgame`（1080 月 < 90s）、`test:save`、`hash:state`、`test:determinism`。

## 高层架构

### 1. 确定性月度模拟是核心范式

`simulateMonth`（`src/core/simulation.ts`）是一个**纯函数**：`structuredClone` 输入 state、用固定种子 `createRandom(seed)` 重建随机源、同一输入永远产出同一输出。确定性是整个工程的基石，所有纪律都围绕它展开。

它本身只是**编排器**（~145 行），业务逻辑下沉到 `src/core/simulationPhases/` 的 7 个阶段：

```
S1 clone → S2 runRegionPhase → S3 runFactionPhase → S4 runDiplomacyPhase
→ S5 runPoliticsPhase → S6 runSituationPhase → S7 runWarPhase
→ S8a runMarketPhase → S8b finalizeMonth
```

**⚠️ 阶段顺序锁定**：它决定了 `random.next()` 的消费点（S2/S4/S7 各一处）。**任何阶段顺序、random 调用次数的修改都会扰动整个随机序列**，让所有 seed 的命运重新分配。S5（外交/战线/和谈）和 S6（局势）刻意被设计成**不消费 random**，只有 `resolveBattle` 首月遭遇战消费——改动时务必保持。

### 2. 单一驱动闭环（不是孤岛系统）

游戏逻辑是 Victoria 3 式的闭环，不是功能堆叠：

```
pop 劳动 → 产业生产 → 市场供需/价格 → pop 购买力/生活水平
→ 财富分化 → 政治力量(clique strength) → 政治运动/法律改革
→ modifier → 反作用于生产（闭环）
```

5 环（后果 / 经济 / 社会政治 / 制度 / 外交战争）+ 内容收口（历史局势）已全部接通（S1–S6）。新增机制时要想清楚它咬合闭环的哪一环，而不是加孤岛。

### 3. 财政走账本（ledger 是唯一真相源）

所有收支（税收/维护费/关税/朝贡/赔款/战地军费）一律 `push` 到 `LedgerEntry`，月末 `applyLedgerToState` 统一结算。散点加减必须清零。**铁律不变量：`Δtreasury === 账本净额`**。任何直接修改 `state.factions[x].treasury` 的财政逻辑都是错的——要走账本。验证逻辑在 `src/core/invariants.ts`。

### 4. 状态三层 store（v0.6-stability 分层）

不要往单一 store 里塞所有东西。三个 Zustand store 各司其职（`src/store/`）：

- **`gameStore`** —— 权威 `GameState` + 玩家决策 + 模拟动作（`startGame` / `advanceOneMonth` / `resolveEvent` / 外交动作）。每次改动后 `syncViewStore()` 把权威同步给 view store。
- **`gameViewStore`** —— UI 订阅的 view 派生（`playerFaction` 摘要 / reports / alerts / decision），隔离频繁的全 state 重渲染。
- **`uiStore`** —— 纯界面状态（`selectedRegionId` / `mapLayer` / `pendingEventId` / 模拟运行状态），不参与游戏模拟。

`gameStore` 注释里仍保留了"兼容层"定位，UI 状态已迁出；`selectRegion`/`setMapLayer` 会转发到 uiStore。

### 5. SimulationService 抽象

UI 不直接 import `simulateMonth`，而是通过 `SimulationService` 接口（`src/runtime/simulationService.ts`：`startGame` / `advanceMonth` / `advanceMonths` / `saveGame` / `loadGame` / `pause`）。当前实现是 `LocalSimulationService`（主线程）。这层是为将来换 Web Worker（`WorkerSimulationService`）预留的——改模拟调度时走 service，别在组件里直调核心函数。

### 6. 地图离线流水线（v0.7 重构）

地图几何是**离线生成产物**，不是手写数据：

- `npm run map:rebuild-geo`（`src/scripts/rebuildGeoMap.ts`）从 Natural Earth GeoJSON（raw.githubusercontent 上的 `ne_50m_*`）投影、抽稀，生成 `src/map/physicalMap.ts`、`src/map/source/mapRegionSource.ts`、`src/map/generated/factionMapLabels.ts`。**需联网**。
- `src/map/generated/mapTiles.ts` 是最终的图块形状数据（`MapTileShape[]`，SVG path + label）。
- 图块分两类：`playableMapRegions`（与 `GameState.regions` **1:1**，参与模拟）和 `contextMapTiles`（仅视觉表达，不参与模拟）。`mapConfig.ts` 的 `mapRegions` 是 playable 的向后兼容别名。
- 地图渲染拆成 `src/ui/map/layers/`：`BaseGeoLayer` / `ProvinceTileLayer` / `PoliticalOverlayLayer` / `MapLabelsLayer` / `MapRoutesLayer`。新增视觉层加到 layers/，别往 `GameMap.tsx` 里堆。

改地图数据后必须 `npm run map:validate`。

### 7. 数据驱动的内容库（`src/data/`）

引擎与内容分离。引擎在 `src/core/`，可编辑的"库"在 `src/data/`：`regions`（31 地区）、`factions`（势力模板）、`events`（历史事件）、`situations`（6 条主线局势）、`laws`（10 条明末法律）、`cliques`（4 利益集团）、`scenarios`（开局入口）、`artCatalog` / `eventVisuals`（四层艺术系统）。**新增内容优先改 `data/` 下的定义文件，不要改引擎**——局势/事件/法律/集团都是数据驱动的函数字段。

### 8. modifier 系统与 effectKey 词表

`src/core/modifiers.ts` 提供 `queryModifier` / `collectModifiers`，按 global→faction→region 级联聚合 modifier。modifier 通过 **effectKey**（如 `tax-mult` / `grain-output-mult` / `maintenance-mult` / `control-flat` / `army-org-mult`）接入各计算点。

**⚠️ 已知坑**：`corruption-flat` / `stability-flat` 在 `modifiers.ts` 注释里标注了"接 control.ts"，但**实际未接入**月度 modifier 计算。新增 modifier 效果前，先 grep 确认对应的 effectKey 在某个计算点被消费，否则是死数据。

## 关键约束（接手必读，详见 PROGRESS.md §5）

1. **确定性蝴蝶效应**：持久状态改变（如改革落实改 corruption → 税收 → treasury → crisis 判定）会扰动后续整个 random 序列。**这是特性不是 bug**——评估改动时看 `npm run batch` 的整体指标，别被单个 seed 的剧烈变化误导。对照实验：临时注释新功能跑 batch 对比。
2. **月度流水线顺序锁定**（见上 §1），禁止调整阶段顺序或增删 random 调用点。
3. **玩家与 AI 同规则**：所有系统对玩家 faction 和 AI faction 一视同仁。新增机制**不要写 player-only 分支**——玩家手选（改革法律/结盟/求和/宣战）是 AI 决策的手动覆盖，不是独立系统。
4. **财政一律走账本**（见上 §3），禁止直接改 treasury。
5. **改删 import 前确认所有引用已迁出**（防 NameError，重构高发）。

## 文档路标

- `PROGRESS.md` —— 接手 agent 的活路标（当前状态 / 已完成阶段 S1–S6 / 验收红线 / 已知坑 / 核心文件地图 / 提交历史）。每次阶段完成同步更新。
- `docs/v2-optimization-spec.md` + `v2-implementation-plan.md` —— S1–S6 详细设计。
- `docs/MING-WAR_MapRefactor_v0.7_SPEC.md` + `PLAN.md` —— v0.7 地图重构。
- `docs/perf-baseline.md` —— 性能基线（回归对比用）。
- `docs/superpowers/` —— 跨子任务的设计（`specs/`）与实施计划（`plans/`）。
