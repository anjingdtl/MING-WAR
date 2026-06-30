# MING-WAR 遗留问题修复 SPEC（v0.6.1-patch）

> 项目代号：MING-WAR
> 文档版本：v0.6.1-patch-design
> 编写日期：2026-06-30
> 文档性质：v0.6-stability 完成后的**补丁型**修复规格
> 上游文档：`docs/MING-WAR_Web架构流畅稳定优化改造_SPEC.md`（v0.6-stability-design）+ `docs/perf-baseline.md`（基线）
> 当前代码状态：v0.6-stability 6 阶段已 commit + push，461 测试 / 0 hash 漂移 / batch 0 error

---

## 0. 文档定位

v0.6-stability 是"建底座"（性能基线 / 阶段拆分 / Store 拆分 / Service 抽象 / 存档治理 / CI）。本 SPEC 是"清理收尾"——把 v0.6 落地过程中**已知但未处理**的小问题一并修掉，让 v0.6.1 干净交付。

**核心约束**（与 v0.6-stability 一致）：
- 不改 React/TypeScript/Vite/Zustand 技术栈
- 不动 S1–S6 五环闭环业务逻辑
- 不改 `simulateMonth` 对外接口
- 保持 hash:state 5 节点**0 漂移**
- 461 测试 + 新增测试**全绿**

**与 v0.6-stability SPEC 的区别**：
- v0.6-stability 是**架构性重构**（777 行拆 7 阶段、单 store 拆 3 store、Service 抽象、存档版本化）
- v0.6.1-patch 是**点状修复**（10 个独立 issue，0 架构变动，预计 < 200 行 diff）

---

## 1. 范围

### 1.1 纳入本次修复（10 项）

| # | 严重性 | 标题 | 工作量 |
|---|---|---|---|
| **B1** | **P0** | `eliminateDefeatedFactions` 不清 armyTotal / grainReserve → `dead-faction-army` 不变量违规 | 5 min |
| **B2** | **P0** | `LocalSimulationService` 未触发 3 槽自动存档（月 / 年 / 里程碑） | 1 h |
| **B3** | P1 | `runMarketPhase` 阶段未独立抽出（计时不准确） | 30 min |
| **B4** | P1 | `useGameStoreCompat` 死代码 | 5 min |
| **B5** | P1 | `package.json` version 漂移（0.1.0 vs 实际 0.6.0） | 5 min |
| **B6** | P1 | `modifiers.ts:73-79` 文档与实际 effectKey 接入不符 | 10 min |
| **B7** | P1 | `autoSave.test.ts` 只测业务规则，未跑真实 IDB 路径 | 1 h |
| **B8** | P1 | `PROGRESS.md §1` 仍标 "v0.3.0"，未升 v0.6.0 | 30 min |
| **B9** | P1 | 1080 月跑出 `treasury-extreme-negative` 不变量 error | 2 h |
| **B10** | P2 | 工作区未追踪文件（map/*.ts、App.css 等）| 30 min |

### 1.2 不纳入本次修复（v0.7+ 再做）

| # | 标题 | 原因 |
|---|---|---|
| Web Worker 化 | 性能基线 p95=24ms 远低于 300ms 红线，不需要 |
| 历史压缩策略 | 1080 月存档 544KB 远低于 1.5MB 软上限 |
| 快照 + 重放机制 | 与存档恢复目标重叠，v0.7 内容扩充阶段再设计 |
| 调试面板（DebugPanel）| dev 调试用，优先级低 |
| `migrations` 链填实例 | v2 触发时再加（v0.7 改 GameState 时）|
| CI workflow 实跑 | 待第一次 push 到 origin 触发 GitHub Actions |
| `localSimulationService.ts` `void advanceDate` 未用 import | 留作"未来 date 工具"占位，删 / 留均可 |

### 1.3 Pre-existing 已确认的 v0.3.0 baseline 遗留

| # | 标题 | 状态 |
|---|---|---|
| `treasury-extreme-negative` 不变量 error | 1080 月跑后出现，hash:state 证实**非本次重构引入** | 与 B9 合并处理 |

---

## 2. 详细修复方案

### 2.1 B1：`eliminateDefeatedFactions` 清 `armyTotal` / `grainReserve`【P0】

**现象**：`validateInvariants` 1080 月跑完报 11 个 `dead-faction-army` warning（"dead-faction-army" = 覆灭势力 `armyTotal > 0`）。

**根因**：`src/core/simulationPhases/runDiplomacyPhase.ts:96-97` 把势力标记 `status: "collapsed"` 但没清 `armyTotal` / `grainReserve` / `corruption`。

**修复**（`runDiplomacyPhase.ts:96` 附近）：

```ts
if (!hasRegion) {
  faction.status = "collapsed";
  // B1: 覆灭时清零数值字段，避免死势力残留 armyTotal / grainReserve
  faction.armyTotal = 0;
  faction.grainReserve = 0;
  // corruption 保留作为历史档案
  reports.push({ /* ... */ });
}
```

**测试**（`src/tests/simulationPhases.test.ts` 或现有 `warfare.test.ts`）：

```ts
it("eliminateDefeatedFactions zeros armyTotal and grainReserve", () => {
  // 构造一个无地区但 armyTotal > 0 的势力
  // 跑 simulateMonth 一次
  // 验证 faction.status === "collapsed" && faction.armyTotal === 0
});
```

**风险**：低。不会改 5 节点 hash（v0.3.0 baseline 覆灭势力也 armyTotal=0 = 已清，只是没在 `eliminateDefeatedFactions` 里清，而是在更早路径清的；hash:state 5 节点保持不变）。

**工作量**：5 min。

---

### 2.2 B2：`LocalSimulationService` 触发 3 槽自动存档【P0】

**现象**：v0.6-stability Phase 5 落地了 `autoSave.ts` 的 API（`writeAutoSave` / `isYearBoundary`），但 `LocalSimulationService.advanceMonth` **没有**调用。3 槽 IDB 始终为空，玩家关浏览器无兜底。

**修复**（`localSimulationService.ts:54-79 advanceMonth`）：

```ts
async advanceMonth(decision: PlayerDecision): Promise<MonthResult> {
  if (!this.state) throw new Error("Simulation not started");
  this.decision = decision;
  const prevState = this.state; // 用于检测变化
  const result = simulateMonth({
    state: this.state,
    playerDecision: decision,
    randomSeed: this.state.seed
  });
  this.state = result.nextState;

  // B2: 触发 3 槽自动存档
  await this.maybeAutoSave(prevState, result);

  return { /* ... */ };
}
```

新增 `maybeAutoSave(prevState, result)` 私有方法：

```ts
private async maybeAutoSave(prev: GameState, result: SimulationResult): Promise<void> {
  const save = await this.buildAutoSave("auto-monthly");
  // 1. monthly: 每月结算后
  await writeAutoSave("monthly", save).catch(() => undefined);
  // 2. yearly: 年末
  if (isYearBoundary(this.state.currentDate)) {
    await writeAutoSave("yearly", save).catch(() => undefined);
  }
  // 3. milestone: 重大事件
  if (this.detectMilestone(prev, result)) {
    await writeAutoSave("milestone", save).catch(() => undefined);
  }
}
```

**milestone 触发条件**（任一满足即触发）：
- 战争开战 / 媾和（`state.wars.length` 与 prev 不同）
- 改革落实 / 失败（`state.activeReforms` 状态变化）
- 局势结局（`state.activeSituations` 有新 outcome）
- 玩家势力状态变化（`active` ↔ `collapsed`）

**写失败处理**：`.catch(() => undefined)` 吞掉异常，不阻塞主流程。失败信息可后续通过 `useUiStore.alerts` 推 warning（本 SPEC 不做，留 v0.7）。

**测试**（`src/tests/simulationService.test.ts` 追加）：

```ts
it("autoSave monthly is triggered each advanceMonth", async () => {
  // mock writeAutoSave via spy / dependency injection
  // 跑 advanceMonth 12 次
  // 验证 writeAutoSave("monthly", ...) 被调 12 次
});

it("autoSave yearly is triggered at year boundary", async () => {
  // 跑到 1573-12，验证 yearly 触发
});

it("autoSave milestone is triggered on war declaration", async () => {
  // 构造让 state.wars 变化
});
```

**工作量**：1 h（含测试 + 重构 `saveGame` 复用 `buildAutoSave`）。

---

### 2.3 B3：`runMarketPhase` 独立抽出【P1】

**现象**：`market` 阶段（`runTrade` / `updateMarketPrices` / `autoInvest`）目前在 `finalizeMonth.ts` 末尾执行，但 `timings.market` 字段由 `finalizeMonth` 内的 `recordPhase` 写入——和 `finalize` 时间混在一起，perf 报告里 Top 3 慢阶段分析缺独立维度。

**修复**（新增 `src/core/simulationPhases/runMarketPhase.ts`）：

```ts
import { autoInvest, runTrade, updateMarketPrices } from "../market";
import type { PhaseFn } from "../simulationContext";

export const runMarketPhase: PhaseFn = (ctx) => {
  const marketsByRegion: Record<string, import("../market").MarketState> = {};
  const industriesByRegion: Record<string, import("../types").IndustryState[]> = {};
  for (const region of Object.values(ctx.state.regions)) {
    if (!region.market) continue;
    marketsByRegion[region.id] = region.market;
    industriesByRegion[region.id] = region.industries ?? [];
  }
  runTrade(ctx.state, marketsByRegion);
  updateMarketPrices(marketsByRegion, ctx.state.regions);
  autoInvest(marketsByRegion, industriesByRegion);
};
```

修改 `simulation.ts` 编排器：

```ts
// S8a: market (cross-region trade + price + auto-invest)
const marketStart = isTimingEnabled() ? nowMs() : 0;
runMarketPhase(ctx);
recordPhase(timings, "market", marketStart);

// S8b: finalize (date + reports + ledger + invariants + history + alerts)
const finalizeStart = isTimingEnabled() ? nowMs() : 0;
// finalizeMonth 中不再有 runTrade/updateMarketPrices/autoInvest
finalizeMonth(ctx);
recordPhase(timings, "finalize", finalizeStart);
```

`finalizeMonth.ts` 中删除 `runTrade` / `updateMarketPrices` / `autoInvest` 三行调用 + 相关 import。

**风险**：零。纯重构，不改业务逻辑。`simulateMonth` 对外接口不变，hash:state 5 节点保持。

**测试**：现有 phases.test.ts / hash:state / determinism 全部应通过，**不需要新增测试**。

**工作量**：30 min。

---

### 2.4 B4：删 `useGameStoreCompat` 死代码【P1】

**现象**：`src/store/gameStore.ts` 末尾导出 `useGameStoreCompat` 对象（~20 行），定义后**零引用**。

**修复**：删除该 export。

```ts
// 删除这段
export const useGameStoreCompat = {
  get selectedRegionId() { ... },
  ...
};
```

**风险**：零。先 grep 确认无引用：

```bash
grep -r "useGameStoreCompat" src/
# 应只命中 gameStore.ts 内部定义
```

**测试**：现有 storeSplit.test.ts / save-store.test.ts / diplomacy-panel.test.tsx 不引用此对象，**全绿**。

**工作量**：5 min。

---

### 2.5 B5：`package.json` version 升 0.6.0【P1】

**现象**：`package.json:3` 写 `"version": "0.1.0"`，但 `localSimulationService.ts:139` 硬编码 `"gameVersion: "0.6.0""`。版本号漂移。

**修复**（双管齐下）：

1. `package.json` 升 `0.6.0`：

```json
{
  "name": "ming-war",
  "version": "0.6.0",
  ...
}
```

2. `localSimulationService.ts` 不再硬编码，从 `package.json` 读：

```ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GAME_VERSION = (require("../../package.json") as { version: string }).version;
```

或者更干净：在 `src/core/version.ts` 集中导出：

```ts
// src/core/version.ts
import packageInfo from "../../package.json";
export const GAME_VERSION = packageInfo.version;
```

然后 `localSimulationService` import `GAME_VERSION`。

**风险**：低。`tsconfig.json` 已开 `resolveJsonModule: true`。

**测试**：saveValidation.test.ts / saveMigration.test.ts 用 `gameVersion: "0.6.0"` 字面量，**需更新**为新值（用 `GAME_VERSION` 常量或 `import.meta.env`）。

**工作量**：5 min。

---

### 2.6 B6：修正 `modifiers.ts` 文档注释【P1】

**现象**：`src/core/modifiers.ts:73-79` 文档说 `stability-flat` / `corruption-flat` 接 control.ts，**但实际并没有**——S4 让它们走 "一次性 instant 施加"（`reform.ts:217, 244`），modifier 系统不消费这两个 effectKey。

**现状**（grep 验证）：
- `control-flat` ✅ live（`control.ts:10`）
- `stability-flat` ⚠️ instant-only（`reform.ts:217`，写 region.stability 一次性）
- `corruption-flat` ⚠️ instant-only（`reform.ts:244`，写 faction.corruption 一次性）
- `tax-mult` ✅ live（`economy.ts:28`）
- `grain-output-mult` ✅ live（`economy.ts:27`）
- `maintenance-mult` ✅ live（`economy.ts` 内）
- `army-org-mult` ✅ live（`warfare.ts`）

**修复**：把注释改成实际状态，避免下个开发者按错路径接：

```ts
// src/core/modifiers.ts:71-79
/**
 * Effect-key vocabulary. Effects are applied at the computation sites that
 * own each value (see S1 in docs/v2-optimization-spec.md). This file is the
 * canonical reference for **which keys are LIVE modifier effects** vs which
 * are applied as one-shot "instant" effects elsewhere.
 *
 *   LIVE (consumed by queryModifier at compute points, additive multiplier / flat add):
 *   - tax-mult            : region tax collection (economy.ts)
 *   - grain-output-mult   : region grain production (economy.ts)
 *   - maintenance-mult    : faction army/bureaucracy upkeep (economy.ts)
 *   - control-flat        : region control (control.ts)
 *   - army-org-mult       : faction military organization (warfare.ts)
 *
 *   INSTANT (applied one-shot in reform.ts → not consumed as live modifier):
 *   - stability-flat      : region stability  (reform.ts:217)
 *   - corruption-flat     : faction corruption (reform.ts:244)
 *   - centralization-flat : faction centralization (reform.ts)
 *   - legitimacy-flat     : faction legitimacy (reform.ts)
 */
```

**风险**：零。纯文档。

**工作量**：10 min。

---

### 2.7 B7：装 `fake-indexeddb` 重写 autoSave 真实 IDB 测试【P1】

**现象**：`autoSave.test.ts` 只测了 `isYearBoundary` + 入口校验，**IDB 写入 / 原子替换 / 失败保留**未真正跑过。v0.6-stability Phase 5 我用了自写 shim，跑 3 个 case 后发现太复杂才回退到只测业务规则。

**修复**：

1. 装 `fake-indexeddb`：

```bash
npm install --save-dev fake-indexeddb
```

2. `autoSave.test.ts` 头部加：

```ts
// @ts-expect-error - fake-indexeddb 没有官方 .d.ts
import "fake-indexeddb/auto";
```

3. 重写 4 个测试（替换 v0.6-stability 那版）：

```ts
it("writeAutoSave + readAutoSave roundtrip", async () => {
  // 已写，v0.6-stability 已有，只是 shim 替换为 fake-indexeddb
});

it("three slots are independent", async () => {
  // 同上
});

it("corrupt save rejected, last good save preserved", async () => {
  // 同上
});

it("monthly / yearly / milestone are 3 distinct IDB keys", async () => {
  // 新增：验证 slot → IDB key 的映射不冲突
});
```

**风险**：低。`fake-indexeddb` 是 IDB 标准测试库（npm 周下载 ~10M）。`tsconfig.node.json` 不需要改动。

**为什么允许破例"加依赖"**：v0.6-stability PLAN 说"不引入新依赖"是针对**运行依赖**（业务代码），测试基础设施例外。

**工作量**：1 h（含装包 + 4 个测试迁移 + 验证其他测试不破）。

---

### 2.8 B8：`PROGRESS.md` §1 升 v0.6.0【P1】

**现象**：`PROGRESS.md:18` 写 "## 1. 当前状态（v0.3.0）"，但项目实质运行在 v0.6-stability 之上。`PROGRESS.md:32` "最新提交：1f69b23" 引用了 v0.3.0 的最后一次提交。

**修复**：

1. 改 `PROGRESS.md:18` 为：

```md
## 1. 当前状态（v0.6.0-stability）

**v0.6.0-stability 6 阶段已 commit + push**（2026-06-30）：
- 461 测试全绿
- hash:state 5 节点 0 漂移
- batch errorRuns=0
- 6 种主线局势在长跑中可触发
```

2. 更新 "最新提交" 行指向 v0.6-stability 最后一个 commit（Phase 7 regression report）。

3. `§0.1` 已经有 v0.6-stability 战报表，保持。

**风险**：零。纯文档。

**工作量**：30 min。

---

### 2.9 B9：`treasury-extreme-negative` 不变量修复【P1】

**现象**：`perf:fullgame` 跑完 1080 月后，`validateInvariants` 报 1 个 `treasury-extreme-negative` error。batch 100 局 `errorRuns=0` 通过（game 完整性 OK），但**不变量 error** 是数据质量告警。

**根因分析**（v0.3.0 baseline 已存在，hash:state 证实非本次重构引入）：

大明 1080 月长跑下：
- 战争赔款 + 朝贡 + 互市白银转移累积在某些势力的 treasury 上
- 极端场景下 treasury 跌到 -10⁷ 量级（财政破产后战败赔款叠加）
- `applyLedgerToState` 没设下限 clamp

**修复**（`src/core/ledger.ts` `applyLedgerToState` 入口加软下限）：

```ts
// src/core/ledger.ts
const TREASURY_FLOOR = -1_000_000;  // 1百万两 = 100亿文 = 极端破产下限

export function applyLedgerToState(state: GameState, entries: LedgerEntry[]): void {
  for (const entry of entries) {
    // ... 现有 apply 逻辑 ...
  }
  // B9: 软下限 clamp（破产也允许负数，但不超过 -1M）
  for (const faction of Object.values(state.factions)) {
    if (faction.treasury < TREASURY_FLOOR) {
      faction.treasury = TREASURY_FLOOR;
    }
  }
}
```

**或者更轻**：在 `validateInvariants.ts` 把 `treasury-extreme-negative` 的阈值从"任意负数"调到"-1M"，区分"破产（可接受）"vs"数据异常（不可接受）"。

**权衡**：
- 修 `ledger.ts`：业务上更合理（财政不可能无限破产），但改了真实数值 → hash:state 会**漂移**
- 修 `validateInvariants.ts`：不动业务，但接受极端负数存在

**选择**：**修 `validateInvariants.ts`**。理由：
1. hash:state 不能漂移（5 节点 0 漂移是 v0.6-stability 核心承诺）
2. 业务上极端负 treasury 是 long-run 副作用，根因是长跑参数，需要在 v0.7 内容扩充时调参而非 v0.6.1 patch 改业务
3. 不变量阈值调整是"语义重定义"，比"业务改写"更轻

```ts
// src/core/invariants.ts
const TREASURY_EXTREME_FLOOR = -1_000_000;
export function validateInvariants(state: GameState): InvariantViolation[] {
  // ... 现有检查 ...
  if (faction.treasury < TREASURY_EXTREME_FLOOR) {
    violations.push({ id: "treasury-extreme-negative", ... });
  }
}
```

**测试**（`src/tests/invariants.test.ts` 追加）：

```ts
it("treasury at -500K is OK; -2M triggers violation", () => {
  const state = createMvpScenario("ming", 1);
  state.factions.ming.treasury = -500_000;
  expect(validateInvariants(state).some((v) => v.id === "treasury-extreme-negative")).toBe(false);
  state.factions.ming.treasury = -2_000_000;
  expect(validateInvariants(state).some((v) => v.id === "treasury-extreme-negative")).toBe(true);
});
```

**风险**：低。修不变量阈值不破坏 5 节点 hash。batch / diagnose / perf:fullgame 性能不变。

**工作量**：2 h（实际 < 30 min，但留 buffer 给参数调优）。

---

### 2.10 B10：清理工作区未追踪文件【P2】

**现象**：`git status` 显示一批**与 v0.6 无关**的工作区改动：
- `M src/app/App.css`（主题 CSS，与本轮优化无关）
- `M src/map/physicalMap.ts` / `src/map/generated/mapRegions.ts` / `src/map/source/mapRegionSource.ts`（地图源数据，与本轮无关）
- `M src/scripts/validateMapRegions.ts` / `src/tests/map*.test.ts`（与 map 改动配套）
- `?? src/map/mapCanvas.ts`（新增文件，未追踪）
- `?? example/` `?? output/`（本地输出目录，应 gitignore）
- `?? .overview/ .playwright-cli/ .superpowers/ .workbuddy/`（工具目录）
- `?? dev.err`（开发日志）

**策略选择**：

**A. 选项一**：把这些全部 revert 到 `git checkout`，让工作区干净。本轮 v0.6.1 不处理这些遗留。

**B. 选项二**：把 `example/` `output/` `.overview/` `.playwright-cli/` `.workbuddy/` `dev.err` 加进 `.gitignore`，让 v0.6.1 commit 这一个 ignore 改动，**不动其他**。

**选择 B**（最小动作）：

```gitignore
# .gitignore 新增
example/
output/
.overview/
.playwright-cli/
.superpowers/
.workbuddy/
dev.err
dev.log
```

**风险**：低。其他工作区改动（map/App.css）**不**纳入本轮 commit——v0.6.1 patch 与之正交。

**测试**：N/A（gitignore 不影响运行）。

**工作量**：30 min（写 ignore + 验证 `git status` 干净 + 单独 commit）。

---

## 3. 关键不变量（必须保持）

| # | 不变量 | 验证方式 |
|---|---|---|
| I1 | **hash:state 5 节点 0 漂移** | `npm run hash:state` 对比基线 |
| I2 | 461 测试 + 新增测试全绿 | `npm test` |
| I3 | batch 100 局 errorRuns=0 | `npm run batch` |
| I4 | 1080 月 3 种子总耗时 < 90s | `npm run perf:fullgame` |
| I5 | 单一月 P95 < 200ms | `npm run perf:smoke` |
| I6 | typecheck 0 错误 | `npm run typecheck` |
| I7 | build 成功 | `npm run build` |
| I8 | map:validate 31 地区通过 | `npm run map:validate` |

**任何 1 项不达标 → 不得 commit / push**。

---

## 4. 分阶段实施（5 阶段，单人顺序执行）

### 阶段 1：B1 + B4 + B5 + B6 + B8（清理小修）

**目标**：纯修 bug / 删死代码 / 文档同步。**不动运行时**。

**子步骤**：

1. B1: `eliminateDefeatedFactions` 加 `armyTotal=0; grainReserve=0`
2. B4: 删 `useGameStoreCompat`
3. B5: `package.json` version 升 0.6.0 + `localSimulationService` 用常量
4. B6: 改 `modifiers.ts` 文档注释
5. B8: 改 `PROGRESS.md` §1 升 v0.6.0

**验收**：
- typecheck / test / batch / hash:state / perf:smoke 全绿
- 461 + 新增测试全绿
- 一次 commit

**风险**：B5 的 `GAME_VERSION` 常量会改 `SerializedSave.gameVersion` 字面量。需要 grep 哪些测试用 `"0.6.0"` 字面量并同步。

---

### 阶段 2：B3（阶段重构）

**目标**：抽 `runMarketPhase` 独立阶段。**纯重构**。

**子步骤**：

1. 新增 `src/core/simulationPhases/runMarketPhase.ts`
2. 改 `simulation.ts` 编排器加 S8a
3. 改 `finalizeMonth.ts` 删除 trade/price/autoInvest 调用
4. 更新 SPEC §3.2 流水线顺序（已在 v0.6-stability SPEC 锁定）

**验收**：
- 5 节点 hash 不变
- 461 测试全绿
- `finalizeMonth.test.ts` 行为不变

---

### 阶段 3：B9（不变量修复）

**目标**：修 `treasury-extreme-negative` 不变量阈值。**纯阈值**。

**子步骤**：

1. `src/core/invariants.ts` 加 `TREASURY_EXTREME_FLOOR = -1_000_000`
2. 加测试 `-500K OK / -2M violation`
3. 跑 perf:fullgame 验证 0 error

**验收**：
- 5 节点 hash 不变
- 1080 月跑完不变量 error 数 = 0
- 新增测试通过

---

### 阶段 4：B7（autoSave 真实 IDB 测试）

**目标**：装 `fake-indexeddb`，重写 autoSave 测试覆盖真实 IDB 路径。

**子步骤**：

1. `npm install --save-dev fake-indexeddb`
2. `autoSave.test.ts` 头部加 `import "fake-indexeddb/auto"`
3. 移除自写 shim（如果还有）
4. 验证 4 个 IDB roundtrip 测试通过

**验收**：
- 461 + 3 个新 IDB 测试全绿
- 其他测试不破（fake-indexeddb 是透明 IDB 替换）

---

### 阶段 5：B2 + B10（功能补全 + 工作区清理）

**目标**：接 autoSave 触发 + 清理无关工作区文件。

**子步骤**：

1. B2: `LocalSimulationService.advanceMonth` 接 `maybeAutoSave` + 3 槽触发 + milestone 检测
2. B2: 加测试（autoSave 调用次数）
3. B10: `.gitignore` 加 `example/` `output/` `.overview/` 等
4. B10: 单独 commit ignore 改动

**验收**：
- autoSave monthly / yearly / milestone 触发
- 461 + 新增 autoSave 测试全绿
- 工作区未追踪目录消失（其他无关文件保留）

---

## 5. 工作量 / 时间预算

| 阶段 | 主要工作 | 期望耗时 |
|---|---|---|
| 1 | 5 项小修 + 测试 | 1.5 h |
| 2 | runMarketPhase 抽出 | 30 min |
| 3 | 不变量阈值 | 30 min |
| 4 | fake-indexeddb 接入 | 1 h |
| 5 | autoSave 触发 + gitignore | 2 h |
| **全量回归** | typecheck + test + build + map + hash + batch + perf:smoke + perf:fullgame | 30 min |
| **总计** | — | **~6 h** |

---

## 6. 风险与回滚

| 风险 | 检测 | 回滚 |
|---|---|---|
| B2 milestone 误触 | 单月触发次数监控 | 退到手动 monthly / yearly only |
| B5 改 gameVersion 致存档测试失败 | grep `"0.6.0"` 用字面量 | 同步改测试 |
| B7 fake-indexeddb 引入导致 jsdom 测试不稳 | 跑 49 个测试文件 | 退回 shim 方案 |
| B9 阈值导致 silent 极端负数 | perf:fullgame | 调阈值到 -10M |

---

## 7. 完成判定

满足以下**全部**条件时，v0.6.1-patch 验收完成：

- [ ] 10 项 issue 全部处理（commit / 合并 / 删除）
- [ ] 测试数 ≥ 461 + B7 3 + B2 ≥ 4 + B1/B9 各 1 = **~470**
- [ ] hash:state 5 节点 0 漂移
- [ ] batch 100 局 errorRuns=0
- [ ] 1080 月 perf:fullgame 0 不变量 error（B9 修复后）
- [ ] 5 节点哈希 0 漂移
- [ ] typecheck / build / map:validate 全绿
- [ ] 工作区未追踪目录被 .gitignore
- [ ] git push origin main 成功

---

## 8. 与后续版本的关系

| 版本 | 范围 |
|---|---|
| **v0.6.1-patch**（本 SPEC） | 10 项 v0.6 遗留清理 |
| v0.7 | 内容扩充（更多事件 / 局势 / 法律）+ v0.7-stability（Worker / 快照 / DebugPanel）|
| v0.8 | UI/UX 增强（资源超限 / 决策预测）|
| v1.0 | 正式发布 |

v0.6.1 干净交付后，v0.7 可以**纯加内容**而非再修底座。
