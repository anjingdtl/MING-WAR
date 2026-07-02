# 军事系统改造 PLAN-MIL-1：战斗公式与持久战升级

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 `docs/MING-WAR 军事系统优化改造深度研究报告.md` 的短期里程碑（报告 §4 里程碑表"短期"行），在现有 `warfare.ts` 之上**叠加 3 个新约束**（前线宽度 + 训练/装备/士气 + 动员-集结-季节公式），把"兵力多即胜"压成"兵力多能持久但单月推进仍受限"。

**Architecture:** 纯增量。**不替换** `warfare.ts` 现有 `resolveBattle` / `advanceWar` / `createInitialWar`；通过**新增聚合层字段 + 公式改造**让现有机制继续工作。
- T1 改 `advanceWar` 内部公式（engagedTroops + ln 进度）
- T2 改 `FrontState` + `FactionState` 加 3 个质量字段
- T3 改 `createInitialWar` 与 `runWarPhase` 的 `mobilizationMonths` 计算路径

**Tech Stack:** React 19 + TypeScript 5.7 + Zustand 5 + Vitest 3。延续 v0.6 阶段确立的"月度 phase + 预计算图 + 纯函数核心"工程哲学。

**Spec / 报告引用:**
- 主报告：`docs/MING-WAR 军事系统优化改造深度研究报告.md` §3「面向 MING-WAR 的系统设计」+ §4「参数建议、测试方案与实现里程碑」
- 已有 v0.8 基线（已 commit）：`docs/superpowers/specs/2026-07-02-war-pace-and-faction-strength.md` — 本 PLAN 是其**上一层**改造

**任务来源声明：** 本 PLAN 9 个任务（T1-T9）由**当前会话**根据研究报告 §3 + §4 反推落地分解，原文无此编号。报告原文 13 个参数（`draftableShare / baseAssemblyDays / frontWidthBase / mountainWidthMod / ...`）映射到本 PLAN 与 PLAN-MIL-2、PLAN-MIL-3 的方式见各 Task "参数引用" 段。

---

## 前置：环境与回归基线

### Task 0: 基线锁定

- [ ] **Step 1: 跑当前 typecheck + test + batch，记录数字**

  ```bash
  npm run typecheck
  npm test
  npm run batch
  ```

- [ ] **Step 2: 把数字写到本 PLAN 末尾"基线表"**

  - 期望：typecheck 0 / test 549（v0.8.2 终值）/ batch errorRuns=0 / mingSurvivalRate~0.84

- [ ] **Step 3: 锁定 warfare.ts 当前 hash 状态（5 节点）**

  ```bash
  npm run hash:state
  ```

  - 写到末尾"基线表"。v0.8.x 终态下 m=0 必然漂移（DETERMINISM-CHANGE 标记），但 m≥12 应稳定。
  - **本 PLAN 实施后必须重跑并对比**。

---

## Task 1: 战斗公式升级——engagedTroops + ln 进度

**报告引用:**
- §3「战斗力公式...前线宽度上限与质量/状态权重」+ 公式 `CombatPower = engagedTroops^0.90 × ...` + `ProgressDelta = k1 × ln(attack/defense) + ...`
- §4 参数表：`frontWidthBase` 25k-40k，`mountainWidthMod` 0.45-0.65

**目的:** 抑制"兵力简单倍增带来指数级优势"。把"投送兵力"与"可交战兵力"分离，让兵力优势主要体现在**轮换、损耗承受与持久战**上，而非当月把对面淹没。

**Files:**
- Modify: `src/core/warfare.ts`
- Modify: `src/data/regions.ts`（如需给地区加 `frontWidthBase` / `terrainWidthMod`）

- [ ] **Step 1: 在 `RegionState` 加前线宽度基线（`types.ts`）**

  ```ts
  // types.ts RegionState 末尾
  frontWidthBase?: number;        // 地区前线宽度基线，单位：兵
  terrainWidthMod?: number;       // 地形前线宽度乘子 [0,1]
  ```

  缺省值给：`frontWidthBase=30000`、`terrainWidthMod` 按现有 `terrain` 字段查表（plain 1.0 / coast 0.95 / river 0.85 / steppe 0.90 / mountain 0.55）。**所有为 `[PLACEHOLDER]` 待 tune**。

- [ ] **Step 2: 改写 `advanceWar` 的 `CombatPower` 计算**

  在 `warfare.ts` 当前 `resolveBattle` 或 `advanceWar` 找到"算攻守强度"的位置，加：
  ```ts
  const frontWidth = region.frontWidthBase
    * (region.terrainWidthMod ?? 1.0)
    * infraWidthMod(faction)
    * commanderCoordination(faction);

  const engagedAttacker = Math.min(attackerCommitted, frontWidth);
  const engagedDefender = Math.min(defenderCommitted, frontWidth + region.garrison * 0.3);

  const combatPower = (committed: number, engaged: number) =>
    Math.pow(engaged, 0.90) * qualityMultiplier(faction) * postureMod;
  ```

  引入 3 个新 helper：`infraWidthMod / commanderCoordination / qualityMultiplier`（`qualityMultiplier` 详见 Task 2）。

- [ ] **Step 3: 改写 `progressDelta` 为 ln 公式**

  替换 `warfare.ts` 当前 `progressDelta = (strengthRatio - 1) * 6`（v0.8 已改为更复杂形式）：
  ```ts
  const powerAdv = Math.log(attackerPower / Math.max(1, defenderPower));
  const warSupportGap = attacker.warSupport - defender.warSupport;
  const weatherPenalty = seasonPenalty(region) + routeOverstretch(faction, target);
  const k1 = 4.0, k2 = 0.04, k3 = 1.0, k4 = 0.6;
  const progressDelta = k1 * powerAdv
                     + k2 * warSupportGap
                     - k3 * weatherPenalty
                     - k4 * routeOverstretch;
  ```

  所有 k 值为 `[PLACEHOLDER]`。**不要删 v0.8 引入的 `mobilizationMonths / distanceFromCapital / homeTurfMult`**——本 Task 只是把"持久战速度曲线"换为对数形式。

- [ ] **Step 4: 加 `computeFrontWidth` 工具函数**

  放到 `warfare.ts` 导出区域，方便 UI 战报显示。

- [ ] **Step 5: 单元测试（`tests/warfare.test.ts` 加 4 用例）**

  - 近邻战区 vs 远征战区同兵力对比：`expect(advancePower(localFront)).toBeGreaterThan(advancePower(remoteFront) * 1.5)`
  - 山地 vs 平原：`mountainFront.terrainWidthMod` 触发 `engagedTroops` 上限
  - 兵力翻倍 → `progressDelta` 增量应**小于**线性（验证 `pow(0.9)` 生效）
  - 战斗公式 typecheck 必须把 `attackerCommitted` 与 `engagedAttacker` 区分（不可混用）

- [ ] **Step 6: 跑 typecheck + test 验证**

  ```bash
  npm run typecheck
  npm test
  ```

  期望：test 数 +4 至少通过。

- [ ] **Step 7: 跑 batch 240 月观察大国远征速度**

  ```bash
  npm run batch
  ```

  期望：`errorRuns=0` 不变；`batchCaptureRate` 不会因为加了前线宽度而**突然**降低（因为同兵力时近邻战区仍可达上限）。

- [ ] **Step 8: Commit**

  ```bash
  git add src/core/warfare.ts src/core/types.ts src/data/regions.ts src/tests/warfare.test.ts
  git commit -m "feat(war): T1 engagedTroops^0.90 + ln progressDelta 前线宽度约束"
  ```

---

## Task 2: 训练度/装备度/士气三参数接入

**报告引用:**
- §3「建议新增 `FormationState`...`training / equipmentReadiness / morale`」+ §3「质量/状态权重」
- §4 参数表：`trainingOutputMonthly` 8%-18% / 战斗公式中 `(0.55 + 0.45 × training) × (0.50 + 0.50 × equipmentReadiness) × (0.60 + 0.40 × morale)`

**目的:** 把"动员后即可战"改为"动员后需训练、装备、士气才可战"。**注意**：本 Task 不引入完整 `FormationState`（那是 Task 7，PLAN-MIL-3 范畴），只在 `FactionState` 聚合层加 3 个标量字段，**配合现有 `mobilizationMonths` 使用**。

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/warfare.ts`
- Modify: `src/data/factions.ts`（默认值）
- Modify: `src/data/scenarios.ts`（开局注入）
- Modify: `src/tests/warfare.test.ts` / `src/tests/types.test.ts`（如果存在）

- [ ] **Step 1: 在 `FactionState` 加 3 字段**

  ```ts
  // types.ts FactionState 末尾（紧邻 homeTurfMult/maxCommitRatio）
  militaryTraining: number;       // 0..1（默认 0.6）
  equipmentReadiness: number;     // 0..1（默认 0.5）
  troopMorale: number;            // 0..1（默认 0.7）
  ```

  全部 `[PLACEHOLDER]`。

- [ ] **Step 2: 在 `warfare.ts` 加 `qualityMultiplier`**

  ```ts
  function qualityMultiplier(faction: FactionState): number {
    return (0.55 + 0.45 * faction.militaryTraining)
         * (0.50 + 0.50 * faction.equipmentReadiness)
         * (0.60 + 0.40 * faction.troopMorale);
  }
  ```

  这是 Task 1 引用但未实现的占位函数——本 Task 实现它。

- [ ] **Step 3: 月度更新规则（`runWarPhase.ts` 末段）**

  每场 `WarState` 每月：
  - `militaryTraining` 朝 `0.85` 收敛（+0.02/月，封顶）
  - `equipmentReadiness` 朝 `0.75` 收敛（+0.015/月，封顶）
  - 战斗胜利方 `troopMorale += 0.03`，战败方 `troopMorale -= 0.05`，封顶 [0.1, 0.95]
  - 长期战争 `warExhaustion` 触顶时 `troopMorale -= 0.02/月`

  数字均为 `[PLACEHOLDER]`。

- [ ] **Step 4: factions 11 势力 + rebel 填默认值**

  ```ts
  // factions.ts 模板
  ming: { ..., militaryTraining: 0.75, equipmentReadiness: 0.80, troopMorale: 0.70 },
  jurchen: { ..., militaryTraining: 0.70, equipmentReadiness: 0.60, troopMorale: 0.80 }, // 建州
  chahar: { ..., militaryTraining: 0.55, equipmentReadiness: 0.45, troopMorale: 0.65 },
  // 其它按规模/经济填差异化，tribal/rebel/local 给较低值
  ```

- [ ] **Step 5: 场景初始化 + 存量测试字面量补字段**

  - `scenarios.ts` `createMvpScenario` 给 11 势力注入（继承模板即可）
  - grep 所有 `FactionState` 字面量构造点补 3 字段（`src/tests/*` 必然有）

- [ ] **Step 6: 单元测试（4 用例）**

  - 训练度 0.3 vs 0.9 同兵力：训练方 `qualityMultiplier` 提升约 1.35×
  - 装备度 0.0 vs 1.0：装备方提升约 2.0×（`0.50 + 0.50×1.0 = 1.0`，`0.50 + 0.50×0 = 0.50`）
  - 战斗胜利 → morale 上升 0.03
  - warExhaustion=1.0 → morale 月降 0.02

- [ ] **Step 7: 跑 typecheck + test**

  ```bash
  npm run typecheck
  npm test
  ```

  期望：typecheck 0；test 数 +4 通过。

- [ ] **Step 8: 跑 batch + diagnose**

  ```bash
  npm run batch
  npx tsx src/scripts/diagnoseWars.ts
  ```

  期望：`mingSurvivalRate` 不暴跌（质量差距是温和的，不应破坏 v0.8.2 财政修复）；建州/大明 持久战 ~21 月 50% control 数字**可微调**但**不崩**。

- [ ] **Step 9: Commit**

  ```bash
  git add src/core/types.ts src/core/warfare.ts src/core/simulationPhases/runWarPhase.ts src/data/factions.ts src/data/scenarios.ts src/tests/warfare.test.ts
  git commit -m "feat(war): T2 militaryTraining/equipmentReadiness/troopMorale 质量参数"
  ```

---

## Task 3: mobilizationMonths 改"距离+集结+季节"公式

**报告引用:**
- §3「把 `mobilizationMonths` 改为'距离 + 集结 + 季节'」+ 短期里程碑验收「大国远征速度明显下降」
- §4 参数表：`baseAssemblyDays` 10-25 天 / `trainingOutputMonthly` 8%-18% / `winterPenalty` 10%-40%

**目的:** v0.8 现状下 `mobilizationMonths = max(0, distance - 1)` 只考虑距离。本 Task 加入"集结天数 + 季节惩罚"，让"边军能快速反应、中央军远征需 1-3 月集结"在数字上显式。

**Files:**
- Modify: `src/core/warfare.ts`（`createInitialWar` 与 `advanceWar` 的 `mobilizationMonths` 计算）
- Modify: `src/core/simulationPhases/runWarPhase.ts`（首月处理）
- Modify: `src/data/regions.ts`（`seasonalState` 字段，可选）

- [ ] **Step 1: 在 `RegionState` 加 `seasonalState` 字段（可选）**

  ```ts
  seasonalState?: "normal" | "mud" | "winter" | "drought" | "flood";
  ```

  缺省 `"normal"`。**所有 31 地区先不填**——本 Task 通过 `(month % 12)` 全局推断（10-3 月 → winter / 4-5 月 → mud / 6-9 月 → normal）。**后续 Task 5（movement）会替换为地区级 + 月度级双层计算**。

- [ ] **Step 2: 加 `computeMobilizationMonths` 工具函数**

  ```ts
  // warfare.ts
  const BASE_ASSEMBLY_DAYS = 18;        // [PLACEHOLDER]
  const SEASON_PENALTY: Record<string, number> = {
    normal: 0, mud: 0.25, winter: 0.5, drought: 0.15, flood: 0.35,
  };

  export function computeMobilizationMonths(
    distance: number,
    faction: FactionState,
    target: RegionState,
    currentMonth: number
  ): number {
    const baseMonths = Math.max(0, distance - 1);   // v0.8 既有
    const assemblyMonths = BASE_ASSEMBLY_DAYS / 30;
    const season = inferSeason(target, currentMonth);
    const seasonMult = 1 + (SEASON_PENALTY[season] ?? 0);
    const trainingMult = 1.4 - 0.4 * faction.militaryTraining;  // 训练差增 40% 减 40%
    return Math.ceil((baseMonths + assemblyMonths) * seasonMult * trainingMult);
  }

  function inferSeason(region: RegionState, month: number): string {
    return region.seasonalState ?? defaultSeasonForMonth(month);
  }

  function defaultSeasonForMonth(month: number): string {
    const m = month % 12;
    if (m >= 9 || m <= 2) return "winter";   // 10-3 月
    if (m === 3 || m === 4) return "mud";
    return "normal";
  }
  ```

- [ ] **Step 3: 替换 `createInitialWar` 内的 `mobilizationMonths` 计算**

  把 `Math.max(0, distance - 1)` 改为 `computeMobilizationMonths(distance, attacker, target, currentMonth)`。

- [ ] **Step 4: `runWarPhase.ts` 首月处理保持兼容**

  v0.8 已有"首月不战斗、只投送"逻辑。**只需保证 `FrontState.mobilizationMonths` 来自新公式**。

- [ ] **Step 5: 单元测试（3 用例）**

  - 同距离、normal season vs winter：winter 集结增 50%
  - 大明（training 0.75） vs 察哈尔（training 0.55）同距离远征战区：大明 mobilization 短 1-2 月
  - 缺省 `seasonalState`：10-3 月自动 winter

- [ ] **Step 6: 跑 typecheck + test + batch**

  ```bash
  npm run typecheck
  npm test
  npm run batch
  ```

  期望：test 数 +3 通过；`errorRuns=0`；`mingSurvivalRate` 与 v0.8.2 持平（季节不应对 5 月开战友好窗口有灾难性影响）。

- [ ] **Step 7: diagnoseWars 验证动员期**

  ```bash
  npx tsx src/scripts/diagnoseWars.ts
  ```

  期望输出：建州→大明动员期打印 `mobilizationMonths: 2` 或 `3`（distance 2 + 集训 0.6 × 冬季 1.5 = ~2.4 月）；察哈尔→大明 类似。

- [ ] **Step 8: Commit**

  ```bash
  git add src/core/warfare.ts src/core/simulationPhases/runWarPhase.ts src/data/regions.ts src/tests/warfare.test.ts
  git commit -m "feat(war): T3 mobilizationMonths 改'距离+集训+季节'公式"
  ```

---

## 基线表（实施后填写）

| 维度 | 实施前 | 实施后 | 变化 |
|---|---|---|---|
| typecheck errors | 0 | | |
| test 数 | 549 | | |
| batch errorRuns | 0 | | |
| batch mingSurvivalRate | ~0.84 | | |
| hash:state m=0 | 漂移（v0.8 baseline） | | |
| hash:state m=12 | 不变 | | |
| 单月 p95 (ms) | ~24 | | |
| diagnoseWars 建州→大明 50% control 月数 | ~21 | | |

## 验收红线

- [ ] typecheck 0 errors
- [ ] test 全部通过（期望 549+11=560）
- [ ] batch errorRuns=0
- [ ] hash:state m=12 节点不变（m=0 必然漂移，需 DETERMINISM-CHANGE 标注）
- [ ] diagnoseWars 显示动员期已含"集训+季节"分量

## 已知后续（PLAN-MIL-2 衔接）

- T1 引入的 `frontWidth` 暂用地区固定值，PLAN-MIL-2 Task 5 会改"边权 BFS"实时计算
- T2 引入的 3 字段为聚合层，PLAN-MIL-2 Task 6 占领治理会消费 `troopMorale` 派生出 `localSupport` 影响
- T3 引入的 `seasonalState` 默认推断，PLAN-MIL-2 Task 5 替换为"地区 × 月度"双层季节表
