# MING-WAR v0.6.1-patch 执行计划 PLAN

> 项目代号：MING-WAR
> 文档版本：v0.6.1-patch-plan
> 编写日期：2026-06-30
> 上游 SPEC：`docs/MING-WAR_遗留问题修复_SPEC_v0.6.1-patch.md`
> 执行模式：**5 阶段顺序 + 阶段内子代理并行**
> 总预算：~6 h
> 子代理数：4 个（Group A 3 个 + Group C 1 个）

---

## 0. 执行原则

1. **顺序 5 阶段**：Group A → B → C → D → E，阶段间有依赖
2. **Group 内并行**：每阶段拆成独立任务，dispatch 子代理并发
3. **零 hash 漂移**：5 节点 hash:state 与 v0.6-stability baseline 完全一致
4. **测试数 ≥ 470**：v0.6-stability 461 + B7（3）+ B2（≥4）+ B1/B9 各 1
5. **每个子代理负责一个 commit**：减少主代理 review 负担
6. **冲突规避**：共享文件（package.json / localSimulationService.ts）由单子代理独占修改

---

## 1. 任务依赖图

```text
┌─────────────────────┐
│ Group A: 并行清理     │
│  A1: B1 (清理 army)   │
│  A2: B4 (删死代码)    │
│  A3: B6 (改 mod 注释) │
│  A4: B8 (PROGRESS)    │
│  A5: B10 (gitignore)  │  5 个子代理并发
│  A6: B3 (runMarket)   │
│  A7: B9 (invariant)   │
└──────────┬──────────┘
           │  无依赖
           ▼
┌─────────────────────┐
│ Group B: 串行协调      │
│  B1: B5 (GAME_VER)   │  1 个子代理
│  B2: B7 (fake-idb)   │  1 个子代理
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Group C: autoSave    │
│  C1: B2 (触发 + 测试) │  1 个子代理
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 全量回归 + push       │  主代理
└─────────────────────┘
```

**关键约束**：
- Group A 内 5 个子代理**互不冲突**（不同文件）
- Group B 必须串行（B5 改 `package.json`，B7 装 `fake-indexeddb` 到 devDeps）——若并行可能冲突
- Group C 在 B7 之后才有真实 IDB 测试基础设施

---

## 2. Group A：7 项并行清理（7 子代理并发）

### A1：B1 `eliminateDefeatedFactions` 清 army/grain【P0】

**子代理任务**：

1. 改 `src/core/simulationPhases/runDiplomacyPhase.ts:96-97`：

```ts
if (!hasRegion) {
  faction.status = "collapsed";
  // B1: 覆灭时清零数值字段，避免死势力残留 armyTotal / grainReserve
  faction.armyTotal = 0;
  faction.grainReserve = 0;
  reports.push({
    id: `${state.currentDate}-${faction.id}-eliminated`,
    ...
  });
}
```

2. 加测试 `src/tests/simulationPhases.test.ts` 末尾（**注意：现有 phases.test.ts 没写 keep 测试，验证一下**）：

```ts
it("eliminateDefeatedFactions zeros armyTotal and grainReserve", () => {
  const ctx = setupContext(7);
  // 模拟一个覆灭势力
  const ming = ctx.state.factions.ming;
  // 先跑几月让 ming 控制全部地区
  // 然后手动把所有 region controller 改为非 ming
  for (const r of Object.values(ctx.state.regions)) {
    r.controllerFactionId = "rebels";
  }
  ming.armyTotal = 12345;
  ming.grainReserve = 67890;
  // 跑一次 phase
  runDiplomacyPhase(ctx);
  expect(ming.status).toBe("collapsed");
  expect(ming.armyTotal).toBe(0);
  expect(ming.grainReserve).toBe(0);
});
```

3. 验证：
   - `npm run typecheck`
   - `npm test`（只跑 warfare.test.ts + simulationPhases.test.ts）
   - `npm run hash:state`（5 节点不变）

**Commit**：`fix(cleanup): B1 - eliminateDefeatedFactions zeros armyTotal/grainReserve`

---

### A2：B4 删 `useGameStoreCompat` 死代码【P1】

**子代理任务**：

1. 先 `grep -r "useGameStoreCompat" src/ --include="*.ts" --include="*.tsx"` 确认无引用（除定义外）
2. 删除 `src/store/gameStore.ts` 末尾 `useGameStoreCompat` 对象（约 20 行）
3. 验证：`npm test`（storeSplit.test.ts / save-store.test.ts / diplomacy-panel.test.tsx 不破）

**Commit**：`chore(cleanup): B4 - remove dead useGameStoreCompat shim`

---

### A3：B6 修 `modifiers.ts` 文档注释【P1】

**子代理任务**：

1. 改 `src/core/modifiers.ts:70-79` 注释（详 SPEC §2.6）
2. 验证：`npm run typecheck`（纯文档，无影响）

**Commit**：`docs(cleanup): B6 - fix modifiers.ts effectKey documentation`

---

### A4：B8 升 `PROGRESS.md` §1 到 v0.6.0【P1】

**子代理任务**：

1. 改 `PROGRESS.md:18` "## 1. 当前状态（v0.3.0）" → "## 1. 当前状态（v0.6.0-stability）"
2. 在 §1 顶部加 v0.6 战报表（简版，参考 §0.1）
3. 验证：N/A（纯文档）

**Commit**：`docs(cleanup): B8 - update PROGRESS.md §1 to v0.6.0-stability`

---

### A5：B10 清理工作区未追踪目录（gitignore）【P2】

**子代理任务**：

1. 读当前 `.gitignore`
2. 追加：
   ```
   example/
   output/
   .overview/
   .playwright-cli/
   .superpowers/
   .workbuddy/
   dev.err
   dev.log
   ```
3. **不动**其他工作区改动（map/*、App.css）
4. 验证：`git status` 中上述目录从 untracked 消失

**Commit**：`chore(cleanup): B10 - gitignore local tool/output directories`

---

### A6：B3 抽 `runMarketPhase`【P1】

**子代理任务**：

1. 新增 `src/core/simulationPhases/runMarketPhase.ts`：

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

2. 改 `src/core/simulation.ts` 编排器加 S8a：

```ts
// S8a: market
const marketStart = isTimingEnabled() ? nowMs() : 0;
runMarketPhase(ctx);
recordPhase(timings, "market", marketStart);

// S8b: finalize
const finalizeStart = isTimingEnabled() ? nowMs() : 0;
finalizeMonth(ctx);
recordPhase(timings, "finalize", finalizeStart);
```

3. 改 `src/core/simulationPhases/finalizeMonth.ts`：
   - 删 `runTrade` / `updateMarketPrices` / `autoInvest` 3 个 import + 调用
   - 删 `recordPhase(ctx.timings, "market", marketStart)` 调用（market 阶段已独立）

4. 验证：
   - `npm run typecheck`
   - `npm test`（**全跑**）
   - `npm run hash:state`（**5 节点必须不变**）

**Commit**：`refactor(sim): B3 - extract runMarketPhase as independent pipeline stage`

---

### A7：B9 修不变量阈值【P1】

**子代理任务**：

1. 改 `src/core/invariants.ts`：
   - 顶部加常量 `const TREASURY_EXTREME_FLOOR = -1_000_000;`
   - 把 treasury 检查的 `faction.treasury < 0` 改为 `faction.treasury < TREASURY_EXTREME_FLOOR`

2. 改 `src/tests/invariants.test.ts`（追加测试）：

```ts
it("treasury at -500K is OK (above extreme floor)", () => {
  const state = createMvpScenario("ming", 1);
  state.factions.ming.treasury = -500_000;
  const v = validateInvariants(state);
  expect(v.some((x) => x.id === "treasury-extreme-negative")).toBe(false);
});

it("treasury at -2M triggers extreme-negative violation", () => {
  const state = createMvpScenario("ming", 1);
  state.factions.ming.treasury = -2_000_000;
  const v = validateInvariants(state);
  expect(v.some((x) => x.id === "treasury-extreme-negative")).toBe(true);
});
```

3. 验证：
   - `npm test src/tests/invariants.test.ts`
   - `npm run perf:fullgame`（应得 0 error）
   - `npm run hash:state`（5 节点不变）

**Commit**：`fix(cleanup): B9 - raise treasury-extreme-negative floor to -1M`

---

## 3. Group B：串行协调（2 子代理顺序）

### B1：GAME_VERSION 集中常量 + package.json 升 0.6.0【P1】

**子代理任务**：

1. 新增 `src/core/version.ts`：

```ts
import packageInfo from "../../package.json";
export const GAME_VERSION = packageInfo.version;
```

2. 改 `src/runtime/localSimulationService.ts`：
   - 删 `"0.6.0"` 硬编码 2 处（`gameVersion: GAME_VERSION`）
   - 加 `import { GAME_VERSION } from "../core/version";`
   - 删 `void advanceDate;` 死 import

3. 改 `package.json:3`：`"version": "0.1.0"` → `"0.6.0"`

4. grep `"0.6.0"` 字面量：
   - `src/tests/saveValidation.test.ts`（最小 save 测试）→ 用 `GAME_VERSION`
   - `src/tests/saveMigration.test.ts` → 用 `GAME_VERSION`
   - `src/runtime/localSimulationService.ts` 已用 `GAME_VERSION`
   - `src/save/saveMigrations.ts` → 用 `GAME_VERSION`

5. 验证：
   - `npm run typecheck`
   - `npm test src/tests/save*.test.ts src/tests/simulationService.test.ts`
   - `npm run hash:state`（5 节点不变）

**Commit**：`chore(version): B5 - centralize GAME_VERSION constant, bump to 0.6.0`

---

### B2：装 `fake-indexeddb` + 重写 autoSave 真实 IDB 测试【P1】

**子代理任务**：

1. 装包：

```bash
npm install --save-dev fake-indexeddb
```

2. 验证装包后 `package.json` 新增 `"fake-indexeddb": "^X.Y.Z"` 到 devDependencies

3. 改 `src/tests/autoSave.test.ts`：
   - 删自写 shim
   - 顶部加 `import "fake-indexeddb/auto";`
   - 4 个 IDB roundtrip 测试用真 IDB 路径

4. 验证：
   - `npm test src/tests/autoSave.test.ts`（4 个测试全绿）
   - `npm test`（**全跑**，确认其他测试不破）
   - `npm run hash:state`（5 节点不变）

**Commit**：`test(save): B7 - use fake-indexeddb for real IDB roundtrip tests`

---

## 4. Group C：autoSave 触发（1 子代理）

### C1：B2 `LocalSimulationService` 接 3 槽自动存档【P0】

**前置**：B7 已 commit（fake-indexeddb 装好）。

**子代理任务**：

1. 改 `src/runtime/localSimulationService.ts`：
   - 在 `advanceMonth` 末尾调 `maybeAutoSave(prevState, result)`
   - 新增私有方法 `maybeAutoSave(prev, result)` 触发 3 槽
   - 新增 `detectMilestone(prev, result)` 工具

```ts
async advanceMonth(decision: PlayerDecision): Promise<MonthResult> {
  if (!this.state) throw new Error("Simulation not started");
  this.decision = decision;
  const prevState = this.state;
  const result = simulateMonth({
    state: this.state,
    playerDecision: decision,
    randomSeed: this.state.seed
  });
  this.state = result.nextState;
  // B2: 触发 3 槽自动存档（失败不阻塞）
  await this.maybeAutoSave(prevState, result).catch(() => undefined);
  return { /* ... */ };
}

private async maybeAutoSave(prev: GameState, result: SimulationResult): Promise<void> {
  const save = await this.buildAutoSave();
  await writeAutoSave("monthly", save).catch(() => undefined);
  if (isYearBoundary(this.state.currentDate)) {
    await writeAutoSave("yearly", save).catch(() => undefined);
  }
  if (this.detectMilestone(prev, result)) {
    await writeAutoSave("milestone", save).catch(() => undefined);
  }
}

private detectMilestone(prev: GameState, result: SimulationResult): boolean {
  // 1. 战争开战 / 媾和
  if (prev.wars.length !== this.state.wars.length) return true;
  // 2. 改革落实 / 失败（看 reports 中 enacted / failed 标志）
  // 3. 局势结局
  // 4. 玩家势力状态变化
  const prevPlayer = prev.factions[prev.playerFactionId];
  const curPlayer = this.state.factions[this.state.playerFactionId];
  if (prevPlayer?.status !== curPlayer?.status) return true;
  return false;
}

private async buildAutoSave(): Promise<SerializedSave> {
  // 复用 saveGame 内部逻辑（提取公共）
  // ...
}
```

2. 提取 `buildAutoSave` 公共方法（`saveGame` 复用）

3. 加测试 `src/tests/simulationService.test.ts` 追加：

```ts
import { writeAutoSave as _writeAutoSave } from "../save/autoSave";

// 用 spyOn / vi.mock 验证 writeAutoSave 被调
// 由于 fake-indexeddb 已装，可用真实 IDB 验证副作用

it("autoSave monthly is triggered each advanceMonth", async () => {
  const svc = new LocalSimulationService();
  await svc.startGame({ factionId: "ming", seed: 7 });
  // 跑 12 月
  for (let i = 0; i < 12; i++) {
    await svc.advanceMonth(defaultPlayerDecision);
  }
  // 验证 IDB 中 monthly 槽已写入
  const monthly = await readAutoSave("monthly");
  expect(monthly).not.toBeNull();
  expect(monthly?.metadata.currentDate).toBe("1574-01");
});

it("autoSave yearly is triggered at year boundary", async () => {
  // 跑 12 月后，yearly 槽应有 1573-12
  const yearly = await readAutoSave("yearly");
  expect(yearly?.metadata.currentDate).toBe("1573-12");
});

it("autoSave milestone is triggered on war start", async () => {
  // 跑几月后主动宣战（修改 state.wars 模拟）
  // 验证 milestone 槽写入
});
```

4. 验证：
   - `npm test src/tests/simulationService.test.ts`
   - `npm test`（**全跑**）
   - `npm run hash:state`（5 节点不变）

**Commit**：`feat(save): B2 - wire 3-slot autosave triggers into LocalSimulationService`

---

## 5. Group D：全量回归（主代理亲自）

### D1：完整回归 + fix

**主代理任务**：

```bash
# 1. 静态
npm run typecheck

# 2. 测试
npm test

# 3. 构建
npm run build

# 4. 地图
npm run map:validate

# 5. hash:state
npm run hash:state

# 6. 性能
npm run perf:smoke
npm run perf:fullgame

# 7. 批量
npm run batch

# 8. 诊断
npm run diagnose

# 9. 存档
npm run test:save

# 10. 确定性
npm run test:determinism
```

**全绿** → 进入 push；任一红 → 修，再跑。

### D2：更新 PROGRESS.md + perf-baseline.md

**主代理任务**：

1. `PROGRESS.md` §0.1 末尾追加 v0.6.1-patch 战报
2. `docs/perf-baseline.md` §5 追加 v0.6.1 行
3. `docs/perf-baseline.md` §5.1 追加最终 perf 数据

### D3：git push origin main

**主代理任务**：

```bash
git add docs/perf-baseline.md PROGRESS.md
git commit -m "docs: v0.6.1-patch final regression report"
git push origin main
```

---

## 6. 子代理调度策略

### 6.1 Group A 调度模板

```python
# 概念示意（实际用 Task 工具 dispatch）
subagent_general(
  description="B1 fix armyTotal in eliminateDefeatedFactions",
  prompt="""在 MING-WAR 项目 D:/ClaudeCodeWorkSpace/projects/MING-WAR/ 执行 v0.6.1-patch 子任务 B1。

任务：修 src/core/simulationPhases/runDiplomacyPhase.ts:96-97，让 eliminateDefeatedFactions 在标记 collapsed 时清零 armyTotal 和 grainReserve。

具体步骤：
1. 读 src/core/simulationPhases/runDiplomacyPhase.ts 找到 eliminateDefeatedFactions 函数
2. 在 faction.status = "collapsed" 之后加 2 行：faction.armyTotal = 0; faction.grainReserve = 0;
3. 加测试 src/tests/simulationPhases.test.ts：构造一个覆灭势力，验证 armyTotal 和 grainReserve 被清零
4. 跑 npm run typecheck
5. 跑 npm test（只跑 src/tests/ 全部）
6. 跑 npm run hash:state（5 节点必须与基线一致）
7. 全部绿后，git add 改动的文件 + git commit -m "fix(cleanup): B1 - eliminateDefeatedFactions zeros armyTotal/grainReserve"
8. 不需要 push（主代理最后统一 push）

约束：
- 不要改其他文件
- hash:state 5 节点必须保持：m=0 0b970ece82d2f0151bc90c8ea9cfaa3eaf492220, m=12 c13553b1ebe88e45b293c2210a216d8259ca32d5, m=120 89396aa447416b166a071c3a64d26db5ff3b198f, m=240 c4e601c2d2dfbaff7d0f7c2a3171d6323abdbe2f, m=1080 34c8763b4ec0ab296d1b820c029cc938ee1d14e7
- 不要 push 到 origin
- 报告：改动文件列表 + 测试结果 + commit hash

失败时停止并报告，不要自行 fix 其他 issue。"""
)
```

### 6.2 并行度

- Group A 一次 dispatch 7 个子代理并发（model: sonnet）
- 等全部返回后，主代理 verify + dispatch Group B
- Group B 串行 2 个子代理（依赖 package.json）
- Group C 1 个子代理
- Group D 主代理

### 6.3 失败回退

- 任一子代理报告失败 → 不 commit，让该子代理 fix
- 5 节点 hash 漂移 → 该 phase commit revert
- 461 测试失败 → 该 phase commit revert
- Group 间冲突 → 串行化

---

## 7. 总 commit 序列

预计 9 个 commit（Group A 7 + Group B 2 + Group C 1）+ 主代理 1 个回归 report = 10 个 commit。

```
B1:  fix(cleanup): eliminateDefeatedFactions zeros armyTotal/grainReserve
B4:  chore(cleanup): remove dead useGameStoreCompat shim
B6:  docs(cleanup): fix modifiers.ts effectKey documentation
B8:  docs(cleanup): update PROGRESS.md §1 to v0.6.0-stability
B10: chore(cleanup): gitignore local tool/output directories
B3:  refactor(sim): extract runMarketPhase as independent pipeline stage
B9:  fix(cleanup): raise treasury-extreme-negative floor to -1M
B5:  chore(version): centralize GAME_VERSION constant, bump to 0.6.0
B7:  test(save): use fake-indexeddb for real IDB roundtrip tests
B2:  feat(save): wire 3-slot autosave triggers into LocalSimulationService
FINAL: docs: v0.6.1-patch final regression report
```

10 个 commit → 1 个 PR → git push origin main。

---

## 8. 验证命令总览（每阶段结束 + 终末）

```bash
# 阶段结束（任意子代理后）
npm run typecheck        # 0 错误
npm test                  # 全绿
npm run hash:state        # 5 节点不变
npm run perf:smoke        # p95 < 200ms

# 终末回归（Group D）
npm run typecheck
npm test
npm run build
npm run map:validate
npm run hash:state
npm run perf:smoke
npm run perf:fullgame
npm run batch             # errorRuns=0
npm run diagnose
npm run test:save
npm run test:determinism
```

**任何一项不达标 → 修，再跑，再 commit，再 push。**

---

## 9. 工作量 / 时间预算

| Group | 子代理数 | 主要工作 | 期望耗时 |
|---|---|---|---|
| A | 7 并发 | 5 小修 + 1 重构 + 1 不变量 | 30-40 min（并发） |
| B | 2 串行 | version + fake-indexeddb | 30 min |
| C | 1 | autoSave 触发 | 1.5 h |
| D | 0（主代理）| 全量回归 + push | 30 min |
| **总计** | — | — | **~3-3.5 h** |

主代理实际工作量：**~1 h**（dispatch + 协调 + 终末回归），其余由子代理并行。

---

## 10. 风险与控制

| 风险 | 检测 | 回退 |
|---|---|---|
| 子代理冲突改同一文件 | dispatch 前明确文件列表 | 串行化 |
| hash 漂移 | 阶段结束必跑 hash:state | revert commit |
| 测试破 | 阶段结束必跑 npm test | revert commit |
| fake-indexeddb 引入不稳 | Group A 末跑全 test | B7 revert |
| autoSave 触发循环 | 单月 writeAutoSave 次数 ≤ 3 | 加 cooldown |
| 子代理越界改其他文件 | 任务 prompt 明确"只改 X / Y / Z" | revert + 重新 dispatch |
