# 军事系统改造 PLAN-MIL-2：后勤/行军/占领三模块

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PLAN-MIL-1 已落地的"战斗公式 + 质量参数 + 动员公式"之上，**新增 3 个独立模块**——`logistics.ts`（后勤）、`movement.ts`（行军）、`occupation.ts`（占领治理）——把"前线 `attackerSupply` 状态值"升级为"库存—路径—前线三级供给"，把"distance 单调衰减"升级为"边权 BFS + 季节 + 地形 + 基础设施"，把"攻下即永久稳定"升级为"localSupport + occupationResistance 双向博弈"。

**Architecture:** 3 个**纯函数新模块**，与现有 `warfare.ts` 解耦：
- `logistics.ts`：接收 `state / faction / target` → 返回 `{ supplyRatio, sourceUsed, pathDelayDays, forwardStockDays }`
- `movement.ts`：接收 `state / from / to / season` → 返回 `{ edgeDays, edgeBreakdown, bottleneck }`
- `occupation.ts`：接收 `state / region / faction` → 返回 `{ localSupport, resistanceGain, stabilityDelta }`

3 个模块各被 `runWarPhase.ts` / `runEconomyPhase.ts` 调用，**不动** `warfare.ts` 内部公式——只消费 `PLAN-MIL-1` 引入的 `frontWidth / qualityMultiplier / mobilizationMonths` 输出。

**Tech Stack:** 沿用 v0.6 阶段纯函数核心 + 预计算图范式。3 模块不引入随机性、不引入浮点累加器（用整数 + Math.round）。

**Spec / 报告引用:**
- 主报告：`docs/MING-WAR 军事系统优化改造深度研究报告.md` §3「补给与粮草模型应成为整套方案的中轴」+ §3「部队部署与行军时间」+ §3「民心与占领管理」
- §4 参数表：`supplyRangeLandHops` 2-4 / `depotBufferDays` 20-45 / `grainNeedPer1000` 25-45 / `unsuppliedAttrition` 1.5%-6% / `unsuppliedMoraleLoss` 5-20 / `occupationResistanceGain` 2-8 / `winterPenalty` 10%-40%

**前置依赖:** PLAN-MIL-1 的 T1-T3 必须已合并到 main（`frontWidth` / `qualityMultiplier` / `mobilizationMonths` 三输出可供本 PLAN 消费）。

---

## Task 4: logistics.ts 库存-路径-前线三级供给

**报告引用:**
- §3「补给...拆成三层：来源端库存、路径吞吐、前线存量」+ 公式 `Demand / PathCapacity / TravelDelayDays / Delivered(t) / SupplyRatio`
- §4 参数表：`grainNeedPer1000` 25-45 / `supplyRangeLandHops` 2-4 / `depotBufferDays` 20-45

**目的:** v0.8 `attackerSupply` 是单一递减数字，**没有来源、没有路径、没有时滞**。本 Task 建立显式三级模型，使"粮道被断"成为可观测、可反馈的失败模式。

**Files:**
- Create: `src/core/logistics.ts`
- Modify: `src/core/types.ts`（`RegionState` 加 3 字段；`FactionState` 加 `grainReserve`）
- Modify: `src/core/economy.ts`（每月产粮入 `grainReserve`）
- Modify: `src/core/simulationPhases/runWarPhase.ts`（消费 `supplyRatio`）
- Create: `src/tests/logistics.test.ts`

- [ ] **Step 1: 加类型字段**

  ```ts
  // types.ts RegionState
  depotLevel: number;         // 0..3（默认 1）仓储/转运等级
  forageCapacity: number;     // 就地筹粮能力 [0,1]（默认 0.3）
  supplyNeighborIds: string[];// 现有 connections 派生即可，先放空数组

  // types.ts FactionState
  grainReserve: number;       // 国家粮储
  landTransportCapacity: number;  // 车马/脚夫容量（默认 100）
  ```

  全部 `[PLACEHOLDER]`。

- [ ] **Step 2: 实现 `computeSupplyRatio`**

  ```ts
  // logistics.ts
  export interface SupplyResult {
    supplyRatio: number;      // 0..1.2
    sourceUsed: number;
    pathDelayMonths: number;
    forwardStockDays: number;
  }

  const GRAIN_PER_TROOP_PER_MONTH = 35;   // [PLACEHOLDER] 千人月粮
  const DEPOT_BUFFER_DAYS = 30;            // [PLACEHOLDER]
  const SUPPLY_RANGE_HOPS = 3;             // [PLACEHOLDER]

  export function computeSupplyRatio(
    state: GameState,
    factionId: FactionId,
    targetRegionId: RegionId,
    committedForce: number
  ): SupplyResult {
    const faction = state.factions[factionId];
    const target = state.regions[targetRegionId];
    const demand = committedForce * GRAIN_PER_TROOP_PER_MONTH;

    // 1. 路径：找己方控制下、距 target 最多 SUPPLY_RANGE_HOPS 跳的最近地区
    const supplyHops = bfsToControlledNeighbor(state, factionId, targetRegionId, SUPPLY_RANGE_HOPS);
    const sourceRegion = supplyHops.source;
    const pathDelayMonths = supplyHops.hops * 0.5;   // [PLACEHOLDER] 每跳半月
    const pathCapacity = supplyHops.pathCapacity
                       * target.depotLevel
                       * (faction.landTransportCapacity / 100);

    // 2. 来源：sourceRegion.grainStock + faction.grainReserve
    const sourceAvailable = (sourceRegion?.grainStock ?? 0) + faction.grainReserve;
    const delivered = Math.min(demand, sourceAvailable, pathCapacity);

    // 3. 前线存量：target.grainStock 折算天数
    const forwardStockDays = target.grainStock / Math.max(1, demand) * 30;

    // 4. 补：就地筹粮
    const localForage = demand * target.forageCapacity;

    const supplyRatio = clamp01((delivered + localForage) / demand);
    return { supplyRatio, sourceUsed: delivered, pathDelayMonths, forwardStockDays };
  }
  ```

  `bfsToControlledNeighbor` 走现有 `connections` 图，找 `controllerFactionId === factionId` 且**未沦陷**的中转节点；如不存在（远程作战无中转），返回 `pathCapacity = faction.landTransportCapacity * 0.3`（远投折扣）。

- [ ] **Step 3: 战时粮道消耗（`runWarPhase.ts`）**

  每月 `WarState`：
  - `faction.grainReserve -= result.sourceUsed * 0.7`（国家粮储补 70%）
  - `sourceRegion.grainStock -= result.sourceUsed * 0.3`（产地补 30%）
  - 若 `faction.grainReserve < 0`：触发"国库粮荒"事件，warSupport -2/月
  - 记账走 `LedgerEntry`（"war-grain-consumed"），**不直接改数值不记账**——走 v0.6 既有 `ledger.ts`

- [ ] **Step 4: 经济系统每月入粮（`economy.ts`）**

  ```ts
  // economy.ts 收税/产粮后
  faction.grainReserve += region.grainStock * 0.05;   // 5% 入国家储备 [PLACEHOLDER]
  ```

- [ ] **Step 5: 单元测试（`logistics.test.ts`，5 用例）**

  - 同势力邻接战区：supplyRatio ≈ 1.0
  - 2 跳中转：pathDelayMonths ≈ 1.0
  - 无中转（远投）：pathCapacity 打 0.3 折
  - `grainReserve = 0` 且 sourceRegion 无粮：supplyRatio < 0.5，触发 attrition
  - `grainReserve` 负：assert `warSupport` 当月 -2

- [ ] **Step 6: 跑 typecheck + test + batch**

  ```bash
  npm run typecheck
  npm test
  npm run batch
  ```

  期望：typecheck 0；test 数 +5 通过；batch `errorRuns=0`；`mingSurvivalRate` 持平或微涨（v0.8.2 财政修复未被破坏）。

- [ ] **Step 7: 新增诊断脚本 `diagnoseSupply.ts`**

  ```bash
  npx tsx src/scripts/diagnoseSupply.ts
  ```

  打印 seed 7 在 1585 年的所有 war 的 supplyRatio / pathDelayMonths / forwardStockDays。**不 commit 这个脚本**——只做开发期观测（gitignored 路径或单独分支）。

- [ ] **Step 8: Commit**

  ```bash
  git add src/core/logistics.ts src/core/types.ts src/core/economy.ts src/core/simulationPhases/runWarPhase.ts src/tests/logistics.test.ts
  git commit -m "feat(war): T4 logistics.ts 库存-路径-前线三级供给模型"
  ```

---

## Task 5: movement.ts 边权 BFS + 季节因子

**报告引用:**
- §3「使用地区图边权，显式计算道路、山地、河运、冬季、泥泞对集结和增援的影响」+ 公式 `edgeDays = baseDistance × terrainFactor × seasonFactor × infraFactor × baggageFactor`
- §4 参数表：`winterPenalty` 10%-40%

**目的:** 把"距离可感"从单一 distance 衰减升级为"边权可感"。让"沿河运快、翻山慢、冬季路断"在游戏里成为可被玩家学到的空间知识。

**Files:**
- Create: `src/core/movement.ts`
- Modify: `src/core/types.ts`（`RegionState` 加 `infraLevel`）
- Modify: `src/core/warfare.ts`（消费 `edgeDays` 替代部分 `distanceFromCapital` 衰减）
- Create: `src/tests/movement.test.ts`

- [ ] **Step 1: 加类型字段**

  ```ts
  // types.ts RegionState
  infraLevel: number;         // 0..3 基础设施（默认 1）
  riverPortLevel?: number;    // 0..2 河运（缺省 0）
  ```

- [ ] **Step 2: 实现 `computeEdgeDays`**

  ```ts
  // movement.ts
  const TERRAIN_FACTOR: Record<Terrain, number> = {
    plain: 1.0, coast: 0.95, river: 0.7, steppe: 1.1, mountain: 1.8,
  };
  const SEASON_FACTOR: Record<string, number> = {
    normal: 1.0, mud: 1.3, winter: 1.5, drought: 1.1, flood: 1.4,
  };

  export interface EdgeResult {
    edgeDays: number;          // 该边行军月数
    breakdown: { terrain: number; season: number; infra: number; baggage: number };
  }

  export function computeEdgeDays(
    from: RegionState, to: RegionState,
    season: string, baggageDays: number = 5
  ): EdgeResult {
    const terrain = TERRAIN_FACTOR[to.terrain] ?? 1.0;
    const seasonMult = SEASON_FACTOR[season] ?? 1.0;
    const infraMult = 1.4 - 0.2 * to.infraLevel;        // 基建好快 20%-40%
    const baggageMult = 1 + baggageDays / 30;
    const baseDays = 5;                                 // [PLACEHOLDER]
    const edgeDays = baseDays * terrain * seasonMult * infraMult * baggageMult;
    return { edgeDays: Math.ceil(edgeDays), breakdown: { terrain, season: seasonMult, infra: infraMult, baggage: baggageMult } };
  }
  ```

- [ ] **Step 3: 季节判定升级（接 PLAN-MIL-1 T3 的 `seasonalState`）**

  ```ts
  // movement.ts 顶部
  export function inferSeason(region: RegionState, month: number): string {
    if (region.seasonalState) return region.seasonalState;
    const m = month % 12;
    if (m >= 9 || m <= 2) return "winter";
    if (m === 3 || m === 4) return "mud";
    if (m === 6 && region.climate === "humid") return "flood";
    if (m === 7 && region.climate === "dry") return "drought";
    return "normal";
  }
  ```

  本 Task 替换 PLAN-MIL-1 T3 的简化推断——加入 `climate` 影响。

- [ ] **Step 4: `runWarPhase.ts` 边权应用到集结期**

  ```ts
  // 替代 max(0, distance-1) 中的 distance
  const pathEdgeDays = bfsPathEdges(state, sourceRegionId, targetRegionId, (from, to) =>
    computeEdgeDays(from, to, inferSeason(to, currentMonth)));
  const distanceInMonths = pathEdgeDays / 30;
  ```

  保留 `PLAN-MIL-1 T3` 的 `computeMobilizationMonths`，**只换其内部 `baseMonths = max(0, distance - 1)` 为 `distanceInMonths`**。

- [ ] **Step 5: 单元测试（`movement.test.ts`，4 用例）**

  - 平原 vs 山地同方向：山地 edgeDays ≥ 1.5× 平原
  - 冬季 vs 正常：冬季 edgeDays = 1.5× 正常
  - 基建 3 vs 0：基建 3 减 40% edgeDays
  - 沿河 `riverPortLevel=2`：edgeDays 减约 30%

- [ ] **Step 6: 跑 typecheck + test + batch + diagnose**

  ```bash
  npm run typecheck
  npm test
  npm run batch
  npx tsx src/scripts/diagnoseWars.ts
  ```

  期望：建州→大明 50% control 数字**略变**（冬季月推进变慢），但**仍可达成**。batch `errorRuns=0`。

- [ ] **Step 7: Commit**

  ```bash
  git add src/core/movement.ts src/core/types.ts src/core/warfare.ts src/core/simulationPhases/runWarPhase.ts src/tests/movement.test.ts
  git commit -m "feat(war): T5 movement.ts 边权 BFS + 季节/地形/基础设施因子"
  ```

---

## Task 6: occupation.ts localSupport + occupationResistance

**报告引用:**
- §3「民心与占领管理...新增 localSupport 与 occupationResistance...被占区在粮秣被抽走、税赋上升、补给线受压和文化/合法性不匹配时，抵抗逐月上升」
- §4 参数表：`occupationResistanceGain` 2-8

**目的:** "攻下即永久稳定"是当前最大隐藏失真。本 Task 让"守"和"攻"变成两个不同问题——攻下后要么驻军镇压、要么减税怀柔、要么就地撤退，**没有白吃的领土**。

**Files:**
- Create: `src/core/occupation.ts`
- Modify: `src/core/types.ts`（`RegionState` 加 2 字段）
- Modify: `src/core/simulationPhases/runWarPhase.ts`（占领变更时初始化）
- Modify: `src/core/economy.ts`（被占区税赋效应）
- Create: `src/tests/occupation.test.ts`

- [ ] **Step 1: 加类型字段**

  ```ts
  // types.ts RegionState
  localSupport: number;           // 0..100（默认 50）
  occupationResistance: number;   // 0..100（默认 0）
  ```

- [ ] **Step 2: 实现 `computeOccupationEffects`**

  ```ts
  // occupation.ts
  const RESISTANCE_GAIN = 4;          // [PLACEHOLDER] 月增
  const SUPPORT_DECAY = 0.8;          // [PLACEHOLDER] 月降
  const STABILITY_DROP_PER_RESIST = 0.02;  // [PLACEHOLDER]

  export interface OccupationResult {
    localSupport: number;
    occupationResistance: number;
    stabilityDelta: number;
    grainExtraction: number;     // 占领方可从被占区抽粮
  }

  export function computeOccupationEffects(
    state: GameState,
    regionId: RegionId
  ): OccupationResult {
    const region = state.regions[regionId];
    const controller = state.factions[region.controllerFactionId];
    const isOccupied = region.controllerFactionId !== region.historicalFactionId
                     && region.historicalFactionId !== undefined;

    if (!isOccupied) {
      // 己方治下：自然恢复
      region.localSupport = Math.min(100, region.localSupport + 1);
      region.occupationResistance = Math.max(0, region.occupationResistance - 2);
      return { localSupport: region.localSupport, occupationResistance: region.occupationResistance, stabilityDelta: 0.05, grainExtraction: 0 };
    }

    // 被占：抵抗上升，民心下降
    const extraction = Math.min(region.grainStock * 0.3, 50000);   // [PLACEHOLDER] 月抽粮上限
    region.grainStock -= extraction;
    region.localSupport = Math.max(0, region.localSupport - SUPPORT_DECAY);
    region.occupationResistance = Math.min(100, region.occupationResistance + RESISTANCE_GAIN);

    // 高抵抗 → 稳定度下降 → 可能触发叛乱
    const stabilityDelta = -STABILITY_DROP_PER_RESIST * (region.occupationResistance / 20);

    return {
      localSupport: region.localSupport,
      occupationResistance: region.occupationResistance,
      stabilityDelta,
      grainExtraction: extraction,
    };
  }
  ```

- [ ] **Step 3: 叛乱触发条件**

  当 `occupationResistance >= 60 && localSupport < 30` → 当月以 `0.3 * occupationResistance / 100` 概率在 `regionId` 生成 1 个 rebel 部队。**复用现有 `rebelFaction` 机制**——本 Task 不新建派系。

- [ ] **Step 4: 战时占领变更时初始化**

  `runWarPhase.ts` capture 后：
  ```ts
  region.localSupport = 30;        // [PLACEHOLDER] 新占初始民心
  region.occupationResistance = 20; // [PLACEHOLDER] 新占初始抵抗
  ```

- [ ] **Step 5: 经济系统联动（`economy.ts`）**

  被占区税基按 `localSupport / 100` 折算：
  ```ts
  const effectiveTaxBase = region.taxBase * (region.localSupport / 100);
  ```

  **注意**：v0.8.2 修复大明财政时已增加税收系数 0.004 → 0.007，**本 Task 不动** 那个数，只加一个乘子。

- [ ] **Step 6: 单元测试（`occupation.test.ts`，5 用例）**

  - 己方治下：localSupport 月 +1，resistance 月 -2
  - 被占：localSupport 月 -0.8，resistance 月 +4
  - 占领者抽粮 = `min(grainStock * 0.3, 50000)`
  - resistance ≥ 60 && support < 30：rebel 出现概率 > 0
  - 被占区税基 = `taxBase * (localSupport/100)`

- [ ] **Step 7: 跑 typecheck + test + batch**

  ```bash
  npm run typecheck
  npm test
  npm run batch
  ```

  期望：test 数 +5；`errorRuns=0`；`mingSurvivalRate` **可能下降**（被占区经济折损是真实的），但**不应跌破 0.5**（v0.8.2 财政修复的 buffer 还在）。

- [ ] **Step 8: 跑 diagnoseMingFinances 看国库轨迹**

  ```bash
  npx tsx src/scripts/diagnoseMingFinances.ts
  ```

  期望：国库轨迹与 v0.8.2 持平 ± 100w（被占区税损是局部，不会击穿国库）。

- [ ] **Step 9: Commit**

  ```bash
  git add src/core/occupation.ts src/core/types.ts src/core/simulationPhases/runWarPhase.ts src/core/economy.ts src/tests/occupation.test.ts
  git commit -m "feat(war): T6 occupation.ts 民心/抵抗/叛乱/抽粮"
  ```

---

## 验收红线

- [ ] typecheck 0 errors
- [ ] test 全部通过（期望 560+14=574）
- [ ] batch errorRuns=0
- [ ] hash:state m=12 节点不变
- [ ] diagnoseWars 显示新机制介入：边权月数变化、supplyRatio 跨势力差异
- [ ] diagnoseMingFinances 显示国库轨迹未击穿 v0.8.2 基线

## 已知副作用与处置

| 副作用 | 监测方法 | 处置 |
|---|---|---|
| `mingSurvivalRate` 跌至 0.5-0.7（被占区税损） | diagnoseMingFinances | 不修复——历史相符 |
| 大量 `rebel` 在被占区涌现 | batch 末段统计 | 不修复——历史相符 |
| `grainReserve` 持续负（远征战区） | 新增 `diagnoseSupply.ts` | 调 `GRAIN_PER_TROOP_PER_MONTH` [PLACEHOLDER] 35 → 40 |
| `frontWidth` 与新 `infraLevel` 不对齐 | diagnoseWars | PLAN-MIL-3 T7 Formation 模型化时再调 |

## 后续（PLAN-MIL-3 衔接）

- T4 引入的 `grainReserve` 仍是聚合字段，PLAN-MIL-3 T7 会随 `FormationState` 一起下沉到运输队
- T5 引入的 `riverPortLevel` 暂未在 batch 反映，PLAN-MIL-3 T9 历史对照会测"江南漕运断 → 北京补给断裂"剧本
- T6 引入的 rebel 概率仍是简化版，PLAN-MIL-3 T9 5 类回归会加"满洲入关后辽东民心崩溃 → rebel + 大明死锁"剧本
