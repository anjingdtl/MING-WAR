# MING-WAR 军事系统改造执行清单 SPEC（v0.9.7 状态同步）

> **对接四份源文档**：
> 1. `docs/MING-WAR 军事系统优化改造深度研究报告.md`（研究报告，**WHY**）
> 2. `docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md`（设计 SPEC，**WHAT**）
> 3. `docs/superpowers/specs/2026-07-02-military-refactor-executable-spec.md`（可落地执行主 SPEC，**HOW**）
> 4. `src/core/{supply,siege,exhaustion,decisions,ai,season,movement}.ts` + `runWarPhase.ts`（已实现代码，**现状**）
>
> **本清单定位**：把"研究报告"和"设计 SPEC"压成**一份可由工程师逐条照做的执行清单**，并**同步 v0.9.7 实际落地状态**。每条都标注（a）对应研究报告章节；（b）对应 SPEC 章节；（c）落地代码位置 + commit hash 或"待办"。
>
> **基线**：2026-07-02 `main` 分支 `36456b4`（v0.9.7 末态，含 T1-T10 全部落地 + 3 次 DETERMINISM-CHANGE，**608 测试** / `mingSurvivalRate ≥ 0.85`）。
>
> **更新日期**：2026-07-02
> **更新人**：游戏设计师 / 接续 v0.9.7 状态

---

## 0. 执行清单总览（v0.9.7 末态）

| 任务 | 状态 | 落地 commit | 难度 | 估时 | 备注 |
|---|---|---|---|---|---|
| T1 基础数据结构（logisticsNode、infrastructure、formation） | ✅ | `2c9c9e1` | — | 已完成 | 5 类型 13 字段 |
| T2 兵员上限池钳位 | ✅ | `fcd5e1f` | — | 已完成 | committedForce ≤ armyTotal × maxCommitRatio × pool |
| T3 粮秣生产/仓储/运输 | ✅ | `c618861` | — | 已完成 | supply.ts + SupplyConvoy 状态机 |
| T4 围城/工事/战利品 | ✅ | `baf60e8` | — | 已完成 | siege.ts + capture 战利品走账本 |
| T5 战争疲劳/厌战 | ✅ | `8d106bf` | — | 已完成 | exhaustion.ts + warWear 效应 |
| T6 玩家决策面板 KPI 卡 | ✅ | `f027064` | — | 已完成 | 5-6 KPI 卡（具体 tooltip 在 T13）|
| T7 招抚/镇压双轨 | ✅ | `d56e47c` | — | 已完成 | rebellion.ts 双轨决策 |
| **T8 AI 升级 WarDesire 8 sub-score** | ✅ | **`15a3487`** | M | 已完成 | **DETERMINISM-CHANGE**（P5 随机扰动）|
| **T9 季节状态机** | ✅ | **`a178232`** | M | 已完成 | **DETERMINISM-CHANGE**（state 字段）|
| **T10 地形/基建边权 movement.ts** | ✅ | **`36456b4`** | M | 已完成 | **DETERMINISM-CHANGE**（state 字段）|
| **T11 道路/河运/海运 运输容量表** | ✅ | (已入 `regions.ts`) | S | 0.5d | 31 region 录入 infrastructureLevel / portLevel / riverPortLevel / depotStock |
| **T12 占地治理 occupation.ts** | ✅ | (工作区未 commit) | L | 1d | `tickOccupation` + `runRegionPhase` 接入 + 9 测试 |
| **T13 UI 战报 sub-tooltip** | ✅ | (工作区未 commit) | S | 0.5d | `DecisionPanel` KPI 卡接入 `Tooltip` |
| **T14 4 个 diagnose 脚本** | partial（wars/finances 已存在） | ⏳ | S | 0.5d | 加 supply/siege/exhaustion/war-months |
| **T15 tuning-military.xlsx 调参表** | ⏳ | — | S | 0.5d | 5 sheet + CI 校验 |
| **T16 5 条历史对照验收** | partial（萨尔浒未跑） | ⏳ | S | 0.5d | 全跑 + 报告 |

**优先级（v0.9.7 后）**：**T11 → T12 → T13 → T14 → T15 → T16**。
- T11/T12 是研究报告"裸露 1+2+3"的最后收口
- T13-T16 是验收与可读性
- 总估时：4d（1 周可全部完成）

**测试演进时间线**：377（v0.6 baseline）→ 461（v0.6-stability）→ 470（v0.6.1-patch）→ 530（v0.7.9）→ 549（v0.8.2）→ 570（v0.9.6）→ 608（T8+T9+T10 落地后）→ **623（T11+T12+T13）**。

---

## 1. T1-T10 已落地项执行复盘（v0.9.7 末态全绿）

### T1 数据结构（v0.9.0，commit `2c9c9e1`）

**做了什么**：
- `FactionState.formations: FormationState[]`
- `FactionState.conscriptionRate: number`
- `FactionState.warDesireModifier: number`
- `RegionState.logisticsNode: LogisticsNodeState | null`
- `RegionState.military: RegionMilitaryState`（含 `infrastructureLevel` / `seasonalState` / `localSupport` / `occupationResistance` / `forageCapacity` / `strategicValue` / `seasonalTravelMod` 等）

**研究报告对应**：§3 数据结构兼容式扩展
**SPEC 对应**：§3
**代码位置**：`src/core/types.ts`

**遗留待办**（v0.9.7 仍未修复）：
- [ ] `FactionState.warFatigue` 字段补到正式类型（当前在 `exhaustion.ts` 内 typecast，编译能过但类型不齐）
- [ ] `FormationState` 类型在 `types.ts` 显式导出

---

### T2 兵员上限池钳位（v0.9.1，commit `fcd5e1f`）

**做了什么**：`warfare.ts:advanceWar` 加 `maxCommitRatio` + `pool` 双重钳位，`committedForce ≤ armyTotal × maxCommitRatio × pool`。

**研究报告对应**：§3 M1 投送系数
**SPEC 对应**：§4.3 战斗公式
**代码位置**：`src/core/warfare.ts:advanceWar`

**测试**：`src/tests/warfare.test.ts` 新增 9 个 v0.8 专项用例

**DETERMINISM-CHANGE**：是（钳位改变月间演化）

---

### T3 粮秣生产/仓储/运输（v0.9.2，commit `c618861`）

**做了什么**（`src/core/supply.ts`）：
- `SupplyConvoy` 状态机：派 → 在途 → 注入
- `depositMonthlySupply`：region 经济产出 × 0.4 注入 `logisticsNode.depotStock`
- `dispatchSupplyConvoy`：派一队补给，ETA 按 BFS 距离
- `tickSupplyConvoys`：每月推进 ETA-1，归 0 注入目标
- `computeSupplyRatio` + `applySupplyPressureMultiplier`：< 0.5 → × 0.5；< 0.75 → × 0.7

**研究报告对应**：§3 补给与粮草模型
**SPEC 对应**：§4.2 后勤层

**已实现常量**：
```ts
DEPOT_PRODUCTION_SHARE = 0.4
SIEGE_WEEKLY_GRAIN = 500
MAX_CONVOY_PAYLOAD = 30000
CONVOY_DECAY_PER_HOP = 0.05
SUPPLY_SHORTAGE_PENALTY = 0.5
```

**接入点**：`runWarPhase.ts:48-61` 计算 `supplyMultMap` 并在 `:161` 应用到 `committedAfterLosses`

**遗留待办**（T11 解决）：
- [ ] `depotStock` 起点：当前 `createMvpScenario` 中所有 region 初始化为 0，需按地区类型（中原/边地/海岛）赋不同起点
- [ ] `inTransitSupplies` 字段在 types.ts 显式声明
- [ ] 玩家手动派补给 UI：未实现（当前 AI 自动派，UI 不显示）

---

### T4 围城/工事/战利品（v0.9.3，commit `baf60e8`）

**做了什么**（`src/core/siege.ts`）：
- `tickSiegeDamage`：每月把 `attackerCommitted / 8 / fortLevel` 扣 garrison
- `applyCapturePlunder`：围城成功掠夺 `population × 0.10 × 5` + stability -15 + rebelPressure +5
- `applySiegeMaintenance`：围城期维护费 200/月走账本

**研究报告对应**：§3 围城与战利品
**SPEC 对应**：§4.4 占领层

**已实现常量**：
```ts
SIEGE_DMG_DIVISOR = 8
SIEGE_FORT_MIN = 1
SIEGE_GARRISON_FLOOR = 1000
SIEGE_MAINTENANCE_PER_REGION = 200
PLUNDER_POP_RATE = 0.10
PLUNDER_BASE_MULT = 5
CAPTURE_STABILITY_HIT = 15
CAPTURE_REBEL_PRESSURE_HIT = 5
```

**接入点**：`runWarPhase.ts:178-183`

**遗留待办**：
- [ ] 玩家手动"强攻 / 围困"二选一 UI（当前 AI 决策，UI 未做）
- [ ] `fortification` 字段在 capture 时是否衰减（现实：攻城器械破坏工事），当前不变

---

### T5 战争疲劳/厌战（v0.9.4，commit `8d106bf`）

**做了什么**（`src/core/exhaustion.ts`）：
- `computeFatigueDelta`：月度累加 `0.5 + casualties/10000 × 0.4 + duration × 0.2 - 0.5 × wins`
- `applyWarWearEffect`：fatigue > 100 → stability -2/月 + treasury × 0.05 流失
- T8 已将 `deescalateWeightBonus` 替换为 `computeWarDesire` 内的 `computeExhaustionRisk`

**研究报告对应**：§3 战疲（warExhaustion）
**SPEC 对应**：§4.5 战疲层

**已实现常量**：
```ts
FATIGUE_BASE = 0.5
FATIGUE_CASUALTIES_COEFF = 0.4
FATIGUE_DURATION_COEFF = 0.2
FATIGUE_WIN_BONUS = 0.5
FATIGUE_DEESCALATE_THRESHOLD = 70
FATIGUE_WARWEAR_THRESHOLD = 100
WARWEAR_STABILITY_HIT = 2
WARWEAR_TREASURY_RATE = 0.05
```

**接入点**：`runFactionPhase.ts` 末尾 `tickAllWarFatigue`

**遗留待办**（同 T1）：
- [ ] `warFatigue` 字段补到 `FactionState` 正式类型
- [ ] `casualtiesByFaction` / `winsByFaction` / `warMonthsByFaction` 三个计数器在 `runWarPhase` 中聚合

---

### T6 玩家决策面板 KPI 卡（v0.9.5，commit `f027064`）

**做了什么**：`DecisionPanel.tsx` 新增 6 指标卡（committedForce / distance / armyTotal / garrison / homeTurfMult / supplyRatio）

**研究报告对应**：§5 风险、兼容性与主要参考来源
**SPEC 对应**：§10 UI 层指引

**接入点**：`src/ui/DecisionPanel.tsx`

**遗留待办**（T13 解决）：
- [ ] 6 指标对应 sub-tooltip：当前 KPI 数字大但玩家不懂含义，需 hover 解释
- [ ] 历史曲线叠加（sandbox/compare run 模式）

---

### T7 招抚/镇压双轨（v0.9.6，commit `d56e47c`）

**做了什么**：`rebellion.ts` 加招抚（reduce rebelPressure）和镇压（garrison + 但 stability 暴跌）两条路径

**研究报告对应**：§3 民心与占领管理（仅部分，研究报告把"治理"留给 T12）
**SPEC 对应**：§4.4 占领层（部分）

**接入点**：`src/core/rebellion.ts`

**遗留待办**：
- [ ] 招抚的具体账本成本（当前未走账本，是直接 reduce）
- [ ] 玩家手选招抚 vs AI 自动镇压的决策树

---

### T8 AI 升级 WarDesire 8 sub-score ✅（v0.9.7-1，commit `15a3487`）

**做了什么**（`src/core/decisions.ts:computeWarDesire` + `src/core/ai.ts:pickMaxWarDesire`）：

```ts
const warDesire =
  + computeWarGoalValue(faction, target)        // [0, +30]
  + computeBorderSecurityValue(faction, target) // [0, +20]
  + computeAllySupport(faction, target)          // [0, +20]
  - computeSupplyOverstretch(faction, target)    // [0, -40]
  - computeWinterPenalty(target)                 // [0, -30]
  - computeExhaustionRisk(faction)               // [0, -30]
  - computeTreasuryRisk(faction)                 // [0, -40]
  - computeOccupationRisk(target)                // [0, -25]
  + faction.warDesireModifier;                   // [-10, +10]
```

**研究报告对应**：§4 末尾"AI 行为必须同步升级"
**SPEC 对应**：§4.5 + §6 P5 随机消费点
**PLAN 对应**：PLAN-MIL-1 §AI 行为同步升级段

**接入点**：
- `src/core/ai.ts:pickMaxWarDesire` 替换原 `scoreTarget` 排序
- `runFactionPhase.ts` 末尾新增 `applyAiDecisionJitter`（P5 随机消费点）
- 玩家手选仍是手动覆盖（不变）

**测试**：`src/tests/decisions-ai.test.ts` +14 用例（实际比 SPEC 计划多 +9）

**P5 随机消费点登记**：
- 位置：`runFactionPhase` 末尾
- 用途：AI 决策扰动 ±3
- 顺序：与原 `chooseAllAiDecisions` 不再消费 random

**完成定义**（已达成）：
- [x] `npm test` 全过（584 → 597 → 608 累计）
- [x] 100×240 batch `errorRuns=0`
- [x] 玩家与 AI 同规则：玩家手选覆盖 AI，但不绕过 warDesire 检查
- [x] commit message `feat(ai): T8 WarDesire 7 风险项 (DETERMINISM-CHANGE)`
- [x] DETERMINISM-CHANGE banner 在 `decisions.ts` + `ai.ts` + `runFactionPhase.ts` 顶部

**DETERMINISM-CHANGE**：是（新增 P5 随机消费点 + sub-score 顺序写入 state）

**风险 R1 缓解**：warDesire < 0 时仍允许开战，概率 10%（`applyAiDecisionJitter` 在 [-5,+5] 区间扰动后变负时）— 已落地。

---

### T9 季节状态机 ✅（v0.9.7-2，commit `a178232`）

**做了什么**（`src/core/season.ts` 108 行新模块）：
- 6 种状态：`normal / mud / winter / drought / flood / harvest`
- `runRegionPhase.ts` 每月 1 号重算所有 region.military.seasonalState
- `warfare.ts` 战斗公式新增 `seasonalMod` 乘数

**研究报告对应**：§3"季节必须可感"
**SPEC 对应**：§3 RegionMilitaryState + §4.2 后勤层

**SEASONAL_COMBAT_MOD**（实际值）：
```ts
{
  normal: 1.0, mud: 0.85, winter: 0.75,
  drought: 0.95, flood: 0.80, harvest: 0.95,
}
```

**SEASONAL_TRAVEL_MOD**（实际值，供 T10 边权消费）：
```ts
{ mud: 1.5, winter: 1.8, flood: 1.7, drought: 1.2, normal: 1.0, harvest: 1.1 }
```

**接入点**：
- `src/core/simulationPhases/runRegionPhase.ts` 月初重算
- `src/core/warfare.ts:advanceWar` 应用 seasonalMod

**测试**：`src/tests/season.test.ts` +13 用例（实际比 SPEC 计划多 +5）

**完成定义**（已达成）：
- [x] `military.seasonalState` 每月正确更新
- [x] `seasonalMod` 在 `advanceWar` 中生效
- [x] 冬季战例 progress 显著慢于夏季（winter attacker 0.75 / defender 0.9 → ratio × 0.833）
- [x] DETERMINISM-CHANGE banner 在 `season.ts` 顶部 + commit message

**DETERMINISM-CHANGE**：是（state 字段写入）

---

### T10 地形/基建边权 movement.ts ✅（v0.9.7-3，commit `36456b4`）

**做了什么**（`src/core/movement.ts` 177 行新模块）：
- `computeEdgeDays(from, to, seasonalState)` → 边权公式
- `precomputeAllPaths(state, factionId)` → Dijkstra 缓存

**研究报告对应**：§3 边权公式 + §3 行军时间
**SPEC 对应**：§4.2 movementPhase

**边权公式（实际值）**：
```ts
TERRAIN_FACTOR = { plain: 1.0, coast: 0.9, river: 0.8, steppe: 1.3, mountain: 2.0 }
INFRA_FACTOR   = { 0: 1.4, 1: 1.0, 2: 0.8, 3: 0.6 }
edgeDays = max(1, ceil(baseDays(1) × terrain × season × infra))
```

**缓存策略**：
- 键：`(factionId, seasonMonth)` → `Map<RegionId, edgeDays>`
- 失效：`runWarPhase` 月初调用 `invalidateMovementCache()`（控制权变更/季节切换触发）

**接入点**：
- `runWarPhase.ts` siegeWeeks 用 `getMovementDays` 替代 `distanceFromCapital`
- `supply.ts:dispatchSupplyConvoy` ETA 用 `movementPath` 替代

**测试**：`src/tests/movement.test.ts` +11 用例（实际比 SPEC 计划多 +1）

**完成定义**（已达成）：
- [x] `movementPath` 缓存正确
- [x] 5 个 region 距离表 vs 旧 `distanceFromCapital` 对照
- [x] DETERMINISM-CHANGE banner 在 `movement.ts` 顶部 + commit message

**DETERMINISM-CHANGE**：是（`movementPath` / `edgeDays` 写入 state）

---

## 2. T11-T16 待办项（详细执行步骤 · v0.9.7 后阶段）

### T11 道路/河运/海运 运输容量表 [S 0.5d]

**目标**：`regions.ts` 录入每 region 的 `infrastructureLevel` / `portLevel` / `riverPortLevel` 真实值，让 T10 movement 边权与 T3 supply 真正生效。

**研究报告对应**：§3 后勤单位与运输资源
**SPEC 对应**：§3 LogisticsNodeState

**当前实现**：`LogisticsNodeState.portLevel` 等字段已存在（v0.9.0 类型新增），但所有 region 初始化为 0；`infrastructureLevel` 在 `regions.ts` 中仅出现 1 次（默认值）。

**执行步骤**：

1. **数据录入** `src/data/regions.ts`：31 个 region 按历史填：

   | 类型 | `infrastructureLevel` | 代表 region |
   |---|---|---|
   | 中原核心 | 3 | 北直隶、南直隶、山东、山西、河南、陕西 |
   | 东南/西南 | 2 | 福建、广东、广西、贵州、云南、四川 |
   | 北疆/辽东 | 1 | 辽东、甘肃、宁夏 |
   | 海西/建州/察哈尔 | 0 | 海西、建州、察哈尔、土默特、科尔沁 |

   | 类型 | `portLevel` | 代表 region |
   |---|---|---|
   | 重要海港 | 3 | 天津、登州、南京、福州、广州、泉州、宁波 |
   | 中等海港 | 2 | 上海、温州、潮州 |
   | 普通沿海 | 1 | 其余沿海 region |
   | 内陆 | 0 | 全部内陆 region |

   | 类型 | `riverPortLevel` | 代表 region |
   |---|---|---|
   | 京杭运河 | 3 | 北直隶、山东、南直隶、扬州 |
   | 长江沿岸 | 2 | 四川、湖广、江西、安徽 |
   | 通航河流 | 1 | 黄河沿岸、西江沿岸 |

2. **数据迁移**：在 `createMvpScenario` 中显式赋值，不要走默认 0。

3. **修复 T3 遗留**：`depotStock` 起点按地区类型赋不同值（中原=8000 / 边地=3000 / 海岛=5000）。

4. **测试** `src/tests/regions.test.ts` +3 用例：
   - 至少 5 个 region 的 `infrastructureLevel ≥ 2`
   - 至少 4 个沿海 region 的 `portLevel ≥ 2`
   - 大同、北京、济南、扬州的运输节点数据完整

**完成定义**：
- [x] 31 个 region 都有显式运输节点（含 0 + 注释）
- [x] `npm test` 不报缺字段
- [ ] `supply.ts:dispatchSupplyConvoy` 用 `getMovementDays` 替代 BFS 距离（T10 已提供，仍走 BFS 距离——未阻塞）
- [x] **DETERMINISM-CHANGE**（state 字段值变化；`hash:state` 必漂移）

**实际落地**（2026-07-02）：`regions.ts` 已按地形/历史录入全部 31 region，并加 `depotStockInit` 启发式。

**commit 模板**：
```
chore(data): T11 运输节点录入 (DETERMINISM-CHANGE)

- 31 region 录入 infrastructureLevel / portLevel / riverPortLevel
- createMvpScenario 显式赋值，不再走默认 0
- depotStock 起点按地区类型（中原 8000 / 边地 3000 / 海岛 5000）
- 新增 3 个测试 (regions.test.ts)

DETERMINISM-CHANGE: state 字段值变化；T10 movement 接入会更慢
```

---

### T12 占地治理 occupation.ts [L 1d]

**目标**：实现 `localSupport` / `occupationResistance` 月度结算，让"占下" != "守稳"。

**研究报告对应**：§3 民心与占领管理
**SPEC 对应**：§4.4 占领层
**PLAN 对应**：PLAN-MIL-2 §occupation.ts 完整段

**当前实现**：`rebellion.ts` 有招抚/镇压（v0.9.6），但未连 `localSupport / occupationResistance`。

**执行步骤**：

1. **新增文件** `src/core/occupation.ts`：

   ```ts
   export function tickOccupation(
     state: GameState, regionId: RegionId, factionId: FactionId
   ): { region: RegionState; entries: LedgerEntry[] };
   ```

2. **核心规则**（每月）：

   ```ts
   const isIndigenous = isSameCulture(region, factionId);
   const baseResistance = isIndigenous ? 0.5 : 2.0;   // 同族 0.5/异族 2.0
   const garrisonDrag = Math.max(0, 1 - region.garrison / 5000);
   const stabilityMod = (100 - region.stability) / 50;
   const supplyMod = supplyRatio < 0.5 ? 1.5 : 1.0;

   region.military.occupationResistance +=
     baseResistance * garrisonDrag * stabilityMod * supplyMod;

   if (occupationResistance > 80) {
     region.rebelPressure += 1;  // 触发叛乱
   }
   ```

3. **民心变化**：

   ```ts
   ΔlocalSupport = −occupationPenalty          // 外来统治基础 -2
                 + garrisonEffect              // 驻军维稳 +0.5/千人
                 + taxReliefEffect            // 减税 +0.2/级
                 − supplyShortagePenalty      // 补给差
                 − foreignCulturePenalty;     // 文化差（异族 -3，同族 0）
   ```

4. **触发逻辑**：
   - `occupationResistance > 70` 持续 3 月：emit `rebellionPrepare` 事件
   - `occupationResistance > 80`：立即 `rebelPressure += 1`（每月）
   - `localSupport > 50`：本地协防 +5% 守军
   - `localSupport < 20`：守军 −10%、税收 −20%、补给响应 −20%

5. **账本接入**：
   - 赈济：消耗国库 `grainReserve` → `localSupport +5/1000 单位粮`（上限 +20/月）
   - 掠夺：`grainStock −= min(localForage × 0.6, formation.demandForOneMonth)`（短期降低占用方后勤）

6. **接入点** `runRegionPhase.ts` 末尾：对每个 `controllerFactionId !== "ming"` 的 region 调用 `tickOccupation`（大明控制区同样要 localSupport 回升）。

7. **测试** `src/tests/occupation.test.ts` +8 用例：
   - 大明控制区 localSupport 回升
   - 异族控制 6 月后 `occupationResistance > 50`
   - garrison 充足时 occupationResistance 涨得慢
   - stability 低时 occupationResistance 涨得快
   - supplyRatio < 0.5 加速 occupationResistance
   - `occupationResistance > 80` 触发 rebelPressure
   - 同文化占领时 culture 惩罚 -50%
   - 账本正确：赈济扣国库 / 掠夺扣粮储

**完成定义**：
- [x] 异族控制大明旧壤 12 月内 `occupationResistance` 持续上升
- [x] `rebelPressure` 累加后触发叛乱（与 `rebellion.ts` 联动）
- [x] 账本走 `LedgerEntry`（不允许直接改 treasury）
- [x] **DETERMINISM-CHANGE** banner

**实际落地**（2026-07-02）：
- 新增 `src/core/occupation.ts: tickOccupation`
- `runRegionPhase.ts` 每月对每个 region 调用
- 新增 `src/tests/occupation.test.ts` 9 个用例
- `npm test` 623/623，batch errorRuns=0

**commit 模板**：
```
feat(occupation): T12 占地治理 (DETERMINISM-CHANGE)

- 新增 src/core/occupation.ts: tickOccupation
- 新增 occupationResistance / localSupport 月度结算
- 异族控制 / garrison 不足 / stability 低 / 补给差 4 个加速因子
- 赈济 / 掠夺走账本
- rebellion.ts 联动：occupationResistance > 80 → rebelPressure += 1
- 新增 8 个测试 (occupation.test.ts)

DETERMINISM-CHANGE: occupationResistance 写入 state；
  hash:state m=0 起漂移
```

**风险与缓解**：
- R3: occupationResistance 累积可能让大明 1585 之前就丢西北 → 异族控制 < 6 月时 occupationResistance 增长曲线平缓（指数而非线性）

---

### T13 UI 战报 sub-tooltip [S 0.5d]

**目标**：在 v0.9.5 KPI 卡上加 hover 解释。

**当前实现**（v0.9.5）：6 张 KPI 卡（committedForce / distance / armyTotal / garrison / homeTurfMult / supplyRatio），但玩家不懂含义。

**执行步骤**：

1. **修改** `src/ui/DecisionPanel.tsx`：
   - 每个 KPI 卡加 `title` 属性 + 内部 `<Tooltip>` 组件
   - Tooltip 内容：常量名 + 含义 + 当前值在历史上的位置（"中等" / "高" / "低"）

2. **6 个 KPI 解释**（v0.9.5 + 1）：

   | KPI | Tooltip 文案 |
   |---|---|
   | `committedForce` | "当前已投送到该战区的兵力（按距离 + 投送系数钳制后）" |
   | `distanceFromCapital` | "从贵方首都到该战区的最短图距离。> 5 时补给与战疲显著上升" |
   | `armyTotal` | "贵方全国账面兵力。committedForce 一般 ≤ 30%" |
   | `garrison` | "该省守军。capture 条件：garrison < 5000" |
   | `homeTurfMult` | "守方主场凝聚力（1.05 ~ 1.40）。建州/察哈尔在此战中享受 +30-40%" |
   | `supplyRatio` | "补给比，1.0 为满。0.75 以下战斗减半，0.5 以下额外减员" |

3. **测试**：snapshot 测试 `src/tests/decisionPanel.test.tsx` 验证 Tooltip 渲染。

**完成定义**：
- [x] 5 个军事 KPI 卡均接入 `Tooltip` hover 解释
- [x] `npm test` 不破坏现有 `decision-panel-v095.test.tsx`

**实际落地**（2026-07-02）：`DecisionPanel.tsx` 用现有 `Tooltip` 组件包裹 `KpiCard`，为动员池/仓储/在途/战伤/围城分别写机制说明。

**commit 模板**：
```
feat(ui): T13 KPI sub-tooltip

- DecisionPanel 6 个 KPI 卡加 hover Tooltip
- 文案参考研究报告 + 设计 SPEC §10
- 新增 2 个 snapshot 测试 (decisionPanel.test.tsx)
```

---

### T14 4 个 diagnose 脚本 [S 0.5d]

**目标**：与已存在的 `diagnoseWars.ts` / `diagnoseMingFinances.ts` 平行，加 4 个新脚本。

**当前已有脚本**：
- ✅ `diagnoseWars.ts`（v0.8 战争时间线）
- ✅ `diagnoseMingFinances.ts`（v0.8.2 大明财政明细）
- ✅ `diagnoseSimulation.ts`（seed7 240 月）

**待加脚本**：

1. **新增** `src/scripts/diagnoseSupply.ts`：
   - 跑 1 个 seed × 60 月
   - 输出每月每 faction 的 `depotStock` / `inTransitSupplies` / `supplyRatio`
   - 重点观察：建州 → 大明 远征 supplyRatio < 0.5 时点

2. **新增** `src/scripts/diagnoseSiege.ts`：
   - 跑 1 个 seed × 60 月
   - 输出每场 siege 的 `monthsToCapture` / `casualties` / `plunder` / `fortificationDelta`
   - 重点观察：辽东 siege 月数 vs 萨尔浒史实 ~3 月

3. **新增** `src/scripts/diagnoseExhaustion.ts`：
   - 跑 1 个 seed × 60 月
   - 输出每 faction 的 `warFatigue` 曲线 + `deescalateWeightBonus` 触发时点
   - 重点观察：长期战争 faction fatigue > 100 触发 warWear

4. **新增** `src/scripts/diagnoseWarMonths.ts`：
   - 跑 100×240 batch
   - 输出 `warMonthsMedian` / `peaceRate` / `truceMonthsMedian`
   - 目标：`warMonthsMedian ∈ [12, 24]`，`peaceRate > 30%`

5. **接入 `package.json`**：4 个新 npm script `diagnose:supply` / `:siege` / `:exhaustion` / `:war-months`

**完成定义**：
- [ ] 4 个脚本退出码 0
- [ ] 输出 stdout 可读
- [ ] 报告附录：把 4 个脚本的输出汇总到 `output/diagnose-military-v0.9.md`

**commit 模板**：
```
chore(scripts): T14 4 diagnose 脚本

- diagnoseSupply.ts: 补给比时间线
- diagnoseSiege.ts: 围城时间线
- diagnoseExhaustion.ts: 战疲曲线
- diagnoseWarMonths.ts: 战争月份分布
- package.json 加 4 个 npm script
```

---

### T15 tuning-military.xlsx 调参表 [S 0.5d]

**目标**：5 张 sheet，所有 [PLACEHOLDER] 常量集中管理。

**执行步骤**：

1. **创建** `output/tuning-military.xlsx`（用 Python openpyxl 或 xlsx-cli），含 5 个 sheet：

   | Sheet | 列 | 行 |
   |---|---|---|
   | `1-参数表` | name, value, min, max, rationale | ~30 参数（按研究报告表） |
   | `2-势力差异` | faction, conscriptionRate, homeTurfMult, maxCommitRatio, commanderCoord | 11 势力 + rebel |
   | `3-战斗公式` | 公式项, 系数, 备注 | engagedTroops^0.90 + 4 乘数 + ln(r) |
   | `4-补给链` | 路径, baseDays, terrain, season, infra | BFS 边权 |
   | `5-历史对照` | 场景, 期望结果, 模拟结果, 偏差 | 5 条 |

2. **数据迁移**：把 `supply.ts` / `siege.ts` / `exhaustion.ts` / `decisions.ts` / `season.ts` / `movement.ts` / `warfare.ts` 的 `const` 全部映射到 Sheet 1。

3. **CI 校验**：`package.json` 加 `"validate:tuning": "node scripts/validateTuning.cjs"`，跑测试时校验 Sheet 1 与代码常量一致。

4. **提交**：把 `tuning-military.xlsx` commit 到 `output/`（已在 git）。

**完成定义**：
- [ ] 5 sheet 全部填齐
- [ ] 30 个常量与代码一一对应
- [ ] `npm run validate:tuning` 退出码 0

**commit 模板**：
```
chore(tuning): T15 调参表 tuning-military.xlsx

- output/tuning-military.xlsx 5 sheet 入仓
- 30+ 常量与代码一一对应
- scripts/validateTuning.cjs CI 校验脚本
- package.json 加 validate:tuning script
```

---

### T16 5 条历史对照验收 [S 0.5d]

**目标**：研究报告的 5 条历史对照必须全部命中。

**执行步骤**：

1. **新增** `src/scripts/historicalFidelity.ts`：
   - 输入：seed 范围 + 月数
   - 输出：5 个对照点是否命中

2. **5 条对照表**：

   | # | 场景 | 历史值 | 目标 | 验证方法 |
   |---|---|---|---|---|
   | 1 | 萨尔浒（1619）大明 vs 建州 | 大明 3-6 月未全占 | `progress < 50%` @ 6 月 | 取 seed 161901 看 progress 时间线 |
   | 2 | 援朝（1592）大明 vs 倭寇 | 6-12 月解汉城 | `control > 80%` @ 12 月 | 取 seed 159201 |
   | 3 | 辽东失守（1618）| 失守 12-18 月 | `controllerFactionId != "ming"` @ 18 月 | 取 seed 161801 |
   | 4 | 起义蔓延（1630）| 18-24 月 3+ region 叛乱 | `rebelRegions >= 3` @ 24 月 | 取 seed 163001 |
   | 5 | 大明存活 | ≥ 70% | `mingSurvivalRate >= 0.70` | 100×240 batch |

3. **输出** `output/historical-fidelity-v0.9.md`：5 行 markdown 表格 + 偏差分析。

4. **失败处理**：5 条中任一未命中，列出根因 + 调参建议，**不**要求立即修复（这是 T8-T12 完成后的回归测试）。

**完成定义**：
- [ ] 5 条全部命中（或列出偏差 + 调参建议）
- [ ] 报告附录 commit 到 git

**commit 模板**：
```
docs: T16 历史对照报告

- output/historical-fidelity-v0.9.md 5 行对照表
- src/scripts/historicalFidelity.ts 自动验证脚本
- 5 条对照全部命中（或列出偏差 + 调参建议）
```

---

## 3. 实施节奏（v0.9.7 后 · 1 周计划）

| 日 | 完成项 | 关键 commit | DETERMINISM-CHANGE |
|---|---|---|---|
| D1 | T11（数据录入） | `chore(data): T11 运输节点录入` | T11 是 |
| D2-D3 | T12（occupation） | `feat(occupation): T12 占地治理` | T12 是 |
| D4 | T13（KPI tooltip） | `feat(ui): T13 KPI tooltip` | 否 |
| D5 | T14（4 diagnose 脚本） | `chore(scripts): T14 4 diagnose` | 否 |
| D6 | T15（xlsx） | `chore(tuning): T15 xlsx` | 否 |
| D7 | T16（历史对照 + 验收） | `docs: T16 历史对照报告` | 否 |

**关键依赖**：
- T11 → T10 movement 真正生效（不录入边权没意义）
- T12 → T4 siege 战利品 / T7 rebellion 双轨的真实反馈
- T13 → T6 KPI 卡（已落地）
- T14 → T3/T4/T5/T8 模块（已落地）
- T15 → T1-T10 全部（已落地）
- T16 → T11-T15 全部

---

## 4. 验收红线（DoD · v0.9.7 后）

完成 T11-T16 后，以下必须全部满足：

- [ ] `npm run typecheck` 0 errors（v0.9.7 已 0）
- [ ] `npm test` 全过（v0.9.7 已 608，预期 ~620）
- [ ] `npm run batch` 100×240：
  - `errorRuns=0`（v0.9.7 已 0）
  - `mingSurvivalRate >= 0.85`（v0.9.7 baseline）
  - `peaceRate > 30%`
  - `warMonthsMedian ∈ [12, 24]`
- [ ] 4 个 diagnose 脚本（supply/siege/exhaustion/war-months）退出码 0
- [ ] 5 条历史对照全部命中
- [ ] `tuning-military.xlsx` 提交到 `output/`
- [ ] `historical-fidelity-v0.9.md` 提交到 `output/`
- [ ] PROGRESS.md 升 v0.9.8+，加 §6 军事系统改造章节
- [ ] 6 个 KPI Tooltip 落地（T13）
- [ ] 单月 p95 ≤ v0.8 baseline × 1.25（约 30ms，T8/T9/T10 后未复测，T11 录入后复测）

---

## 5. 风险登记（v0.9.7 后）

| # | 风险 | 等级 | 缓解 | 当前状态 |
|---|---|---|---|---|
| R1 | T8 改 AI 决策树可能让 AI 不再开新战，`finishedRuns` 暴跌 | 中 | fallback：warDesire < 0 时仍允许开战，概率 10% | ✅ 已落地（`applyAiDecisionJitter`） |
| R2 | T9 季节 + T10 movement 联动可能让大明 < 1573 都不能投送到辽东 | 中 | 冬季只影响 path 长度，不影响可投送性 | ✅ 已落地（seasonalCombatMod 攻方受拖累但仍 ≥ 0.75）|
| R3 | T12 occupationResistance 累积可能让大明 1585 之前就丢西北 | 中 | 异族控制 < 6 月时 occupationResistance 增长曲线平缓（指数而非线性） | ✅ T12 已落地 |
| R4 | T15 xlsx 校验可能与代码常量不同步 | 低 | CI 强制 require 同步 | ⏳ T15 待落地 |
| R5 | T16 历史对照可能因 T8-T12 的 [PLACEHOLDER] 调参失败 | 低 | 接受失败，把偏差列入下一版 SPEC | ⏳ T16 待落地 |
| R6 | T10 movementPath 缓存未在控制权变更时清空 | 中 | runWarPhase 头部检查 graphCacheInvalid | ✅ 已落地（`invalidateMovementCache()`）|
| R7 | T12 占领者未消耗国库即可稳住 | 中 | localSupport > 50 强制触发 taxRelief 走账本 | ✅ T12 已落地（赈济走 grain-relief 账本）|
| R8 | T8-T12 累计 hash 漂移 ≥ 5 节点 | 中 | 4 处 DETERMINISM-CHANGE 标注（已完成 3/4）| ✅ T12 已标注 |

---

## 6. 与已落地的 v0.9.0-v0.9.7 边界

| 已实现 | 本 checklist 是否修改 |
|---|---|
| `supply.ts` 全部常量 | ❌ 不改（v0.9.2 已定）|
| `siege.ts` 全部常量 | ❌ 不改（v0.9.3 已定）|
| `exhaustion.ts` 全部常量 | ❌ 不改（v0.9.4 已定）|
| `decisions.ts:computeWarDesire` 8 sub-score | ❌ 不改（v0.9.7-1 已定）|
| `ai.ts:pickMaxWarDesire` | ❌ 不改（v0.9.7-1 已定）|
| `season.ts:computeSeasonalState` | ❌ 不改（v0.9.7-2 已定）|
| `movement.ts:computeEdgeDays` + `precomputeAllPaths` | ❌ 不改（v0.9.7-3 已定）|
| `runWarPhase.ts` phase 顺序 | ❌ 不改（已稳定）|
| `types.ts` 字段 | 部分：T1 遗留 `warFatigue` / `FormationState` 补正式类型 |

**核心原则**：已实现代码是基线，本 checklist 只在 T11-T16 增量扩展。**任何对 v0.9.0-v0.9.7 的回退必须先单独开 SPEC 评估。**

---

## 7. 随机种子消费点（必须登记的扩展点）

> v0.8 已登记（`docs/superpowers/specs/2026-07-02-war-pace-and-faction-strength.md`）：S2 / S4 / S7。
> v0.9.0-v0.9.6 未新增（保持确定性 0 漂移）。
> **v0.9.7 新增 1 处**：

| 编号 | 位置 | 用途 | 顺序 | 落地 |
|---|---|---|---|---|
| **P5** | `runFactionPhase` 末尾 | AI 决策扰动 ±3 | T8 落地 | ✅ `15a3487` |
| 无 | `season.ts:computeSeasonalState` | 纯函数无 random | T9 | ✅ 纯函数 |
| 无 | `movement.ts:precomputeAllPaths` | 纯函数无 random | T10 | ✅ 纯函数 |

**T11-T16 待办预期**：

| 编号 | 位置 | 用途 | 顺序 | 状态 |
|---|---|---|---|---|
| 无 | `regions.ts` 数据录入 | 纯数据写入，无 random | T11 | ⏳ |
| 无 | `occupation.ts:tickOccupation` | 纯函数无 random | T12 | ⏳ |
| 无 | UI / 调参表 / diagnose | 离线/纯函数 | T13-T16 | ⏳ |

**任何新增 / 顺序变更必须在 commit 顶部打 `DETERMINISM-CHANGE` banner**。

---

## 8. v0.9.7 末态验收（已达成）

| 维度 | v0.8.2 起点 | v0.9.6 中间态 | v0.9.7 末态 |
|---|---|---|---|
| 测试数 | 549 | 570 | **608**（+38 v0.9.7 三连）|
| typecheck | 0 | 0 | **0** ✅ |
| `batch 100×240 errorRuns` | 0 | 0 | **0** ✅ |
| `mingSurvivalRate` | 0.84 | 0.85 | **≥ 0.85** ✅ |
| `大明→察哈尔 投送峰值` | 174k | 105k | **≤ 105k** ✅（movement 钳位叠加）|
| `季节状态机` 写入 state | ❌ | ❌ | ✅ 6 状态机 |
| `movementPath` 写入 state | ❌ | ❌ | ✅ Dijkstra 缓存 |
| `computeWarDesire` 8 sub-score 落地 | ❌ | ❌ | ✅ 8 sub-score |
| `hash:state` 累计 DETERMINISM-CHANGE 标注 | 0 | 0 | **3**（T8/T9/T10）|
| DETERMINISM-CHANGE 待补 | 0 | 0 | **1**（T12 occupation）|

---

## 9. 参考资料

1. `docs/MING-WAR 军事系统优化改造深度研究报告.md`（研究报告，**WHY**）
2. `docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md`（设计 SPEC，**WHAT**）
3. `docs/superpowers/specs/2026-07-02-military-refactor-executable-spec.md`（可落地执行主 SPEC，**HOW**）
4. `docs/superpowers/specs/2026-07-02-war-pace-and-faction-strength.md`（v0.8 SPEC）
5. `docs/superpowers/plans/2026-07-02-military-refactor-plan-1.md`（PLAN-MIL-1 战斗公式）
6. `docs/superpowers/plans/2026-07-02-military-refactor-plan-2.md`（PLAN-MIL-2 三模块）
7. `src/core/{supply,siege,exhaustion,decisions,ai,season,movement}.ts`（v0.9.2/3/4/7 实现）
8. `src/core/simulationPhases/{runWarPhase,runRegionPhase,runFactionPhase}.ts`（编排层）
9. `src/tests/{warfare,decisions-ai,season,movement}.test.ts`（v0.9.7 测试矩阵）
10. `src/scripts/{diagnoseWars,diagnoseMingFinances}.ts`（已存在 diagnose）
11. `output/tuning-military.xlsx`（待建）
12. PROGRESS.md（接手活路标）
13. 游戏设计 agent 内置：Behavioural Economics、Systemic Design、Advanced Economy Design

---

## 10. 接手指引

### 第一步：读 4 份文档
1. **本 checklist**（`docs/superpowers/specs/2026-07-02-military-refactor-execution-checklist.md`）— 状态表
2. **可落地执行主 SPEC**（`docs/superpowers/specs/2026-07-02-military-refactor-executable-spec.md`）— 活路标
3. **研究报告**（`docs/MING-WAR 军事系统优化改造深度研究报告.md`）— WHY
4. **设计 SPEC**（`docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md`）— WHAT

### 第二步：跑基线（5 分钟）
```bash
npm run typecheck      # 0 errors
npm test               # 608/608 pass
npm run batch          # errorRuns=0, mingSurvivalRate ~0.85
npm run hash:state     # 5 节点 baseline（已漂移 3 次是正常的）
```

### 第三步：选 T 任务
按本清单 §2 优先级：**T11 → T12 → T13 → T14 → T15 → T16**。

### 第四步：照 §2 卡片逐项执行
每张卡片含：目标 / 执行步骤 / 测试清单 / 验收 / commit 模板 / 风险。

### 第五步：4 类 DoD 红线全绿
见 §4。

### 第六步：交付物入仓
- `tuning-military.xlsx` → `output/`
- `historical-fidelity-v0.9.md` → `output/`
- `PROGRESS.md` 升 v0.9.8+，加 §6 军事系统改造章节
- 全部 commit 推 `git push origin main`

---

**文档版本**：v0.9.7-sync
**基线 commit**：`36456b4`（2026-07-02，T8+T9+T10 三连提交后）
**下一次更新**：T11-T16 全部 commit 后，§2 状态表改为全 ✅，文档升至 v0.9.8-sync。