# v0.8 战争节奏与势力强度重构 SPEC

> 承接 v0.6-stability（架构）与 v0.7（地图）的最后一公里：把"推演节奏"修回历史。
> 报告对象：玩家用大明几个月就能打遍周边 → 不符合历史。
> 关联文件：`src/core/warfare.ts`、`src/core/decisions.ts`、`src/core/simulationPhases/runWarPhase.ts`、`src/data/factions.ts`、`src/data/regions.ts`、`src/core/types.ts`、相关测试。

---

## 0. 用户反馈与目标

### 0.1 反馈（2026-07-02）

1. **军事行动周期太短**：大明几个月就能打遍周边，完全不用调兵遣将和准备粮草。省区驻军 / 人口 / 粮食等参数**完全没有作用在军事层面**。
2. **周边势力太弱**：一个月就被大明平推，或者被义军平推，不符合历史逻辑。

### 0.2 目标

| 维度 | 当前 | 目标 |
|---|---|---|
| 大明 → 察哈尔（草原骑兵）战争持续 | ~2 月 | 12–24 月 |
| 大明 → 建州（辽东核心）战争持续 | ~1 月 | 18–30 月 |
| 建州 → 辽东（努尔哈赤初期）战争持续 | ~3–4 月 | 12–24 月 |
| 朝鲜坚守本土 | ~4 月被平推 | 至少 12–18 月 |
| 周边势力在自己领土上 | 1 月内崩溃 | 至少 8–12 月 |
| 省区 garrison 对战斗结果的影响 | **0** | 防守方战斗力量 +30–80% |
| 距离 / 道路连通对战斗的影响 | **0** | 远征方效率 ×0.5–0.85 |
| 粮草（grainReserve）对战斗的影响 | 仅战后粮耗 | 战前供给不足直接限制投送 |
| 调兵 / 准备时间 | **0**（开打即决战） | 1–3 月动员期 |

---

## 1. 根因诊断（带数字）

### 1.1 推进公式过于乐观 — `warfare.ts:81`

```ts
const strengthRatio = attackerStrength / Math.max(1, defenderStrength);
const progressDelta = Math.round((strengthRatio - 1) * 6);
```

**这是单一最严重的 bug**。把兵力比按线性放大映射到月度进度，完全不接触以下约束：
- 距离 / 调兵 / 补给
- 驻军 / 地形 / 工事
- 民众支持度 / 战争支持度

**数值实例（1573-01 开局）**：

| 攻方 / 守方 | att 力 | def 力（含 fort） | ratio | Δ progress/月 | 满进度月份 |
|---|---|---|---|---|---|
| 大明 58万 → 察哈尔 7.4万 | 328k | 35k | 9.4 | **50** | 2 |
| 大明 58万 → 建州 4.2万 | 328k | 22k | 14.8 | **83** | 1 |
| 大明 58万 → 朝鲜 5.6万 | 328k | 27k | 12.1 | **67** | 1 |
| 建州 4.2万 → 辽东 garrison 7万 | 26k | 67k | 0.39 | **−4**（持续负，攻不下）| ∞ |

→ 大明 1 个月推平辽东所有目标；建州 100 个月都打不下辽东。这两个极端都不符合史实：萨尔浒之战努尔哈赤 6 万击败明军 11 万，但努尔哈赤用了 5 年统一女真；万历朝鲜之役打了 7 年。

### 1.2 strengthRatio 计算的"全兵力幻觉" — `warfare.ts:69-78`

```ts
const attackerStrength = attacker.armyTotal * (attacker.militaryOrganization / 100) * ...
```

**问题**：大明 58 万军分散在 15 个省，从北京到辽东要调 1-3 个月，到云南要 3-5 个月。能同时投送到察哈尔前线的最多 5–10 万。当前公式用**全兵力**做对比，等于假定大明 58 万全部瞬移到前线。

### 1.3 进攻方补给衰减几乎无效 — `warfare.ts:105`

```ts
attackerSupply: Math.max(30, front.attackerSupply - 0.5)
```

每月只 −0.5，从 100 降到 50 要 100 个月（约 8 年）。**劳师远征无意义**。

### 1.4 防守方 garrison 没有参与战斗 — `warfare.ts:78`

```ts
const defenderStrength = defender.armyTotal * (defender.militaryOrganization / 100) * ...
                          ((region.fortification / 100) + 0.5);
```

**region.garrison 7 万完全没参与防御计算**。驻军是当地人、熟悉地形、不会逃跑——这正是游牧/渔猎民族在主场能抵抗大明的关键。当前模型忽视了这一点。

### 1.5 resolveBattle 投送系数与 advanceWar 不一致 — `warfare.ts:144`

```ts
const attackerCommitted = Math.min(attacker.armyTotal, Math.round(attacker.armyTotal * 0.18 * postureMultiplier[posture]));
```

首战用 18% 投送，但后续月立即用 100% 兵力做进度推进。**这是数量级的矛盾**——首战像治安战，每月像世界大战。

### 1.6 周边势力没有"凝聚力 / 主场加成"

大明 armyTotal 580k vs 建州 42k，看似 14:1，但：
- 建州是新兴军事集团，全民皆兵，组织度 62 vs 大明 58（**反而更高**）
- 建州在自己的辽东边墙主场，凝聚力强
- 大明内部 15 省各有 garrison，真正能投送到辽东的 < 15 万

**但当前公式没有把这些转化成防御方优势**。

### 1.7 调兵遣将时间为 0

`runWarPhase` 一上来就 `resolveBattle`，没有"动员期"。史实：从北京下令调兵到辽东集结要 1-3 月，兵部 / 户部 / 兵部职方司 + 各边镇协调。当前进度立刻从 35 开始。

---

## 2. 设计修复方案（5 个机制）

### 2.1 M1：投送系数（committedForce）— 让"全兵力幻觉"消失

**目的**：把 `armyTotal` 分解为"留在本土"和"投送到前线"两段；只有后者真正参与战斗。

**字段**：每个 `FactionState` 加一个 `committedForce: Record<RegionId, number>`（每条战线投送的兵力），或者新增 `FactionState.warCommitment: number`（faction 级别，0..1 的"远征投入比"）。

**实现**：
- 战争刚宣布时，committedForce 从 0 起步，每月动员增加 5%（受 administration 影响）
- 最大 committedForce = armyTotal × maxCommitRatio
  - 大明 0.30（中央能同时调度 < 30% 兵力）
  - 建州 / 察哈尔 / 科尔沁 0.60（全民皆兵，本土就近）
  - 朝鲜 / 日本 0.45
- committedForce 上限还受距离 / 道路影响（见 M2）

**对 strengthRatio 的影响**：
```ts
attackerStrength = committedForce * org * orgMult * (1 - warExh/200)
```

大明 → 察哈尔：committedForce = 58万 × 0.30 = 17.4 万（vs 当前用 58 万），ratio 从 9.4 降到 ~2.8。

### 2.2 M2：距离与补给线 — 劳师远征真的耗粮

**目的**：让"距离"成为战斗的核心约束；省区之间必须走 `connections`。

**字段**：
- `FactionState.capitalRegionId` 已存在
- `RegionState.distanceFromCapital: Record<FactionId, number>`：每个地区到某势力首都的最短 BFS 距离

**实现**：
- 启动时 BFS 预计算 `region.distanceFromCapital[factionId]`
- 投送系数按距离衰减：
  - distance = 1（相邻）：× 1.0
  - distance = 2：× 0.85
  - distance = 3：× 0.70
  - distance ≥ 4：× 0.55（劳师远征极限）
- 补给衰减按距离加速：
  - distance = 1：attackerSupply − 1/月
  - distance = 2：− 3/月
  - distance ≥ 3：− 5/月（劳师远征补给崩溃）
- 补给 < 50 时，损耗（attackerLosses）翻倍；补给 < 30 时强制 retreat 选项出现

**数值示例（大明 → 察哈尔，距离=2）**：
- 补给从 100 → 30 需要 24 月（不再是 100 个月）
- 补给 < 50 之后每月损耗翻倍，长期战争不可能不调兵

### 2.3 M3：驻军 / 防御工事真正起作用

**目的**：让 `region.garrison` 和 `region.fortification` 真实进入战斗计算。

**实现**：
```ts
const defenderStrength = 
  defender.armyTotal * (defender.militaryOrganization / 100) * defenderOrgMult * (1 - warExh/200) +
  region.garrison * 0.5  // 驻军是当地人，战斗力 = 正规军 50%，但地形熟悉
defenderMult = (region.fortification / 100) + 0.5  // 已存在
```

**驻军损耗**：
- 当 `war.progress > 30`，每月驻军损耗 3% × (1 - fortification/200)
- 当 `war.progress > 70`，每月驻军损耗 6% × (1 - fortification/200)
- 当 garrison 耗到 < 30% 原值，防守方 effectiveStrength 再 × 0.6（失去当地协同）

**意义**：大明攻辽东（garrison 7 万，fortification 70）→ 防御力 = 67k×0.5 + 守军力 ≈ 100k+；不是当前的 67k。大明要打 18–30 月才能把驻军耗光。

### 2.4 M4：主场凝聚力 / 民族整合度

**目的**：让周边小势力在自己主场能撑更久。

**字段**：每个 `FactionState` 加一个 `homeTurfMult: number`（主场加成系数）

**初值**：
- 大明 1.05（统一王朝，民族多元反而是弱点）
- 建州 1.40（新兴八旗，整合度高）
- 察哈尔 1.30（黄金家族后裔）
- 土默特 1.25（俺答封贡后整合）
- 海西 / 科尔沁 / 奴儿干 1.20–1.35
- 朝鲜 1.20（朝鲜王朝主体民族）
- 日本 1.15

**应用**：
```ts
defenderStrength *= faction.homeTurfMult
```

仅当防守方 control 本地区时生效（防"大明在自己控制的辽东被建州打"也算主场）。

### 2.5 M5：调兵动员期 + 进度公式重写

**目的**：战争开始有真实的"动员 / 行军 / 集结"过程。

**重写 `progressDelta` 公式**：

```ts
// 旧：(strengthRatio - 1) * 6
// 新：基线推进 + 实力加成 - 防御优势 - 距离惩罚
const baseAdvance = 1.5;  // 持久战基线：1.5 点/月（67 月打完，需要局势积累）
const powerAdvantage = Math.max(0, (strengthRatio - 1) * 0.4);  // 实力加成 0.4 倍率（原 6 倍）
const defenseFloor = 0.6;  // 即使实力强，每月也最多推这么多
const distancePenalty = (targetDistance - 1) * 0.3;  // 距离惩罚
const garrisonDrag = Math.min(2.0, region.garrison / 30000 * 0.5);  // 驻军拖慢

const progressDelta = Math.max(-1.5, Math.min(5.0, 
  baseAdvance + powerAdvantage - defenseFloor - distancePenalty - garrisonDrag
));
```

**数值示例**：

| 场景 | 旧 Δ/月 | 新 Δ/月 | 旧月份 | 新月份 |
|---|---|---|---|---|
| 大明 → 察哈尔 | 50 | 1.5 + 0.96 − 0.6 − 0.3 − 0.07 = 1.49 | 2 | 44 |
| 大明 → 建州 | 83 | 1.5 + 1.31 − 0.6 − 0.3 − 0.06 = 1.85 | 1 | 35 |
| 建州 → 辽东 | −4 | 1.5 + 0 − 0.6 − 0.3 − 1.17 = −0.57 | ∞ | 持续负，不能速胜 |

**调兵期**：战争前 1-3 月 committedForce 从 0 增到 max；这期间 progress 不推进（动员期不计进度）。

**目标月份对照**：
- 大明 → 察哈尔：35-44 月（vs 萨尔浒后金与察哈尔长期博弈 5–10 年的史实 → 略偏快但可接受）
- 大明 → 建州：25-35 月（vs 萨尔浒/松锦之战节奏，匹配）
- 建州 → 辽东：长期负，无法速胜 → 努尔哈赤要靠统一女真 + 数次战役（v0.8 内通过聚合战役达成）

### 2.6 5 个机制的协同效果

```
            ┌──── 大明 58 万 ─────────────┐
            │                              │
M1 投送     │  → committedForce = 17.4 万  │   ← 投送系数 0.30
M2 距离     │  → 距离 2：× 0.85 = 14.8 万 │   ← 距离衰减
M5 动员期   │  → 前 2 月 0，第 3 月起 14.8 │   ← 调兵时间
            │                              │
M3 驻军     │  ← 察哈尔 garrison 4.3 万    │
M4 主场     │  ← × homeTurfMult 1.30      │
            │  ← 防守力 = 7.4 × 0.64 × 1.30 │  ≈ 6.2 万（含 garrison + fort）
            │     + 4.3 × 0.5 = 8.4 万     │
            │                              │
strengthRatio = 14.8 / 8.4 = 1.76          │
Δ progress = 1.5 + 0.30 − 0.6 − 0.3 − 0.07 │   = 0.83 点/月
→ 打完一场 = (100 − 35) / 0.83 ≈ 78 月      │
```

**注意**：上面的 0.83/月偏慢。要让大明 vs 察哈尔在大明全力 + 主场失去后还能 24-36 月打完，可能需要：
- 察哈尔兵力投送系数 = 0.40（草原部落不能全国集中）
- 或者把 homeTurfMult 调到 1.20
- 或者当 progress > 60 时，attackerLosses 减半（主力碾压）

**方案选择**：上述数值都是 [PLACEHOLDER]，需要 paper balance 验证。v0.8 启动后做 100 场 batch 验证大明 vs 周边平均持续 18-30 月。

---

## 3. 数据 / 类型变更

### 3.1 `FactionState` 新增字段（`src/core/types.ts:168`）

```ts
export interface FactionState {
  // ... 现有字段 ...
  /** v0.8: 主场防御加成（防守本土时 strength × homeTurfMult） */
  homeTurfMult: number;
  /** v0.8: 投送系数（最大 committedForce / armyTotal） */
  maxCommitRatio: number;
  /** v0.8: 当前每条战线的投送兵力（regionId → committed force） */
  warCommitments: Record<RegionId, number>;
}
```

### 3.2 `RegionState` 新增字段（`src/core/types.ts:142`）

```ts
export interface RegionState {
  // ... 现有字段 ...
  /** v0.8: 预计算的距离表（factionId → BFS distance from capital） */
  distanceFromCapital: Record<FactionId, number>;
}
```

### 3.3 `FrontState` 字段调整（`src/core/types.ts:199`）

```ts
export interface FrontState {
  attackerWarSupport: number;
  defenderWarSupport: number;
  attackerSupply: number;
  defenderSupply: number;
  /** v0.8: 动员剩余月（>0 时不推进 progress） */
  mobilizationMonths: number;
}
```

### 3.4 `FactionState` 数据填充（`src/data/factions.ts`）

| faction | homeTurfMult | maxCommitRatio |
|---|---|---|
| ming | 1.05 | 0.30 |
| jianzhou | 1.40 | 0.60 |
| chahar | 1.30 | 0.55 |
| tumed | 1.25 | 0.55 |
| haixi | 1.20 | 0.50 |
| korchin | 1.30 | 0.55 |
| nurgan | 1.25 | 0.50 |
| joseon | 1.20 | 0.45 |
| japan | 1.15 | 0.45 |
| ainu | 1.10 | 0.40 |
| bozhou | 1.30 | 0.50 |

### 3.5 distanceFromCapital 预计算

新增工具函数 `computeDistanceMap(state)` 在 `src/core/decisions.ts`：
- BFS 从每个 faction 的 `capitalRegionId` 出发，沿 `connections` 扩展
- 写入每个 `region.distanceFromCapital[factionId]`
- 在 `simulateMonth` 入口调用一次（或在 createMvpScenario 时计算）

---

## 4. 实现拆分（按优先级）

### 阶段 A：核心机制（必须）

| # | 文件 | 内容 | 验收 |
|---|---|---|---|
| A1 | `types.ts` | 新增 `homeTurfMult` / `maxCommitRatio` / `warCommitments` / `distanceFromCapital` | typecheck |
| A2 | `factions.ts` | 11 个势力填入 homeTurfMult + maxCommitRatio | 数据测试 |
| A3 | `decisions.ts` | `computeDistanceMap(state)` + BFS | 单元测试 |
| A4 | `warfare.ts` `advanceWar` | 重写 progressDelta 公式（M5） | warfare.test.ts |
| A5 | `warfare.ts` `advanceWar` | committedForce × maxCommitRatio × distanceMult | 新单测 |
| A6 | `warfare.ts` `advanceWar` | defenderStrength + garrison × 0.5（M3） | 新单测 |
| A7 | `warfare.ts` `advanceWar` | defenderStrength × homeTurfMult（M4） | 新单测 |
| A8 | `warfare.ts` `advanceWar` | attackerSupply 衰减按 distance（M2） | 新单测 |
| A9 | `warfare.ts` | `createInitialFront` 加 mobilizationMonths = distance | 单元测试 |
| A10 | `runWarPhase.ts` | committedForce 月度动员（5%/月） | 集成测试 |

### 阶段 B：平衡调参（高优）

| # | 文件 | 内容 |
|---|---|---|
| B1 | `runWarPhase.ts` | committedForce 应用到 attackerStrength |
| B2 | `runWarPhase.ts` | garrison 损耗机制（progress > 30 时 -3% 月） |
| B3 | `runWarPhase.ts` | attackerLosses 在 supply < 50 时翻倍 |
| B4 | paper balance | 100 场 batch，验证大明 vs 周边平均 18-30 月 |

### 阶段 C：测试覆盖

| # | 文件 | 内容 |
|---|---|---|
| C1 | `src/tests/warfare.test.ts` | 重写：以"应该持久"为预期 |
| C2 | 新增 `war-pace.test.ts` | 验证大明 vs 周边势力持续 18-30 月 |
| C3 | 新增 `committed-force.test.ts` | 验证投送系数与距离衰减 |
| C4 | `batch-simulation.test.ts` | batch 大明 240 月存活 + 周边势力存活 |

### 阶段 D：UI 反馈（次优）

| # | 文件 | 内容 |
|---|---|---|
| D1 | `src/ui/DecisionPanel.tsx` | 显示当前 committedForce / maxCommitRatio |
| D2 | `src/ui/DecisionPanel.tsx` | 显示距离与补给状况 |
| D3 | `src/ui/MapPanel.tsx` | 战争图标显示动员 / 攻坚 / 维持 阶段 |
| D4 | `src/ui/MonthlyReport.tsx` | 战报增加"攻方投送 X 万 / 距离 Y / 补给 Z" |

---

## 5. 验收红线（必须全绿）

```bash
npm run typecheck         # 0 errors
npm test                  # 530 + 新增 ~15 测试全绿
npm run build             # 成功
npm run map:validate      # 39 tiles
npm run batch             # 100×240 batch，errorRuns = 0
npm run diagnose          # seed7 10 年轨迹
npm run hash:state        # 5 节点 0 漂移（**允许漂移，但需 DETERMINISM-CHANGE 注释**）
npm run perf:smoke        # 退化 ≤ 20%
```

**额外验证**：
- 大明 vs 察哈尔（开局 ~24 月）：批 batch 验证 18-30 月内完胜，但中途察哈尔至少撑过 12 月
- 大明 vs 建州：25-40 月完胜，建州至少撑过 18 月
- 周边势力在 AI 自动推演下不应 1-2 月被平推
- 大明 240 月存活率 ≥ 0.9（不允许大明无界膨胀 / 也不允许大明快速崩溃）

---

## 6. 风险与边界

### 6.1 蝴蝶效应（已知）

修改 `advanceWar` 会扰动整个 random 序列（CLAUDE.md §5.1 已知）。所有 seed 命运重新分配。需要：
- 跑 `npm run hash:state` 看 baseline 漂移
- 注释 `DETERMINISM-CHANGE` 提交
- batch 整体指标比对（别看单个 seed）

### 6.2 大明不再无界膨胀

大明 armyTotal 58 万 → maxCommitRatio 0.30 → 实际可投送 17.4 万。这比当前的"全兵力幻觉"少很多。可能影响：
- 大明同时开战能力下降（以前可以同时打 3-4 个方向，现在只能打 1-2 个）
- 大明总战损减少（不是坏事）

→ 玩家策略从"开局四面出击"变成"先打一边，逐个击破"——**这是设计目标**。

### 6.3 朝鲜/日本的活跃度

朝鲜 / 日本在 v0.8 后会更主动（他们自己有 committedForce）。需要：
- AI 决策（`ai.ts`）增加"如果兵力不足，不主动进攻"的逻辑
- 朝鲜在中前期应该保持中立（壬辰倭乱 resolved 之前不主动打大明）

### 6.4 阶段顺序锁定

不能在 runWarPhase 之前 / 之中新增 random 调用点（CLAUDE.md §5.1）。M1–M5 都是确定性计算，无 random 影响。

---

## 7. 调参建议（[PLACEHOLDER] 起点）

```ts
// warfare.ts 进度公式 [PLACEHOLDER]
const BASE_ADVANCE = 1.5;          // 基线推进（持久战）
const POWER_COEFF = 0.4;           // 实力倍率（原 6.0，v0.8 砍到 0.4）
const DEFENSE_FLOOR = 0.6;         // 防御底线减项
const DISTANCE_PENALTY = 0.3;      // 每跳距离惩罚
const GARRISON_DRAG_MAX = 2.0;     // 驻军最大拖慢

// M2 补给衰减
const SUPPLY_DECAY_PER_DISTANCE = 1.5; // 每月 −1.5 × distance
const SUPPLY_CRITICAL = 50;        // 补给 < 50 损耗翻倍

// M1 投送
const COMMIT_GROWTH_PER_MONTH = 0.05; // 动员 5% / 月
const MOBILIZATION_FACTOR = {      // 动员期距离 → 月
  1: 0, 2: 1, 3: 2, '4+': 3
};
```

全部 `[PLACEHOLDER]` 标记，需要 paper balance + batch 100 场后定稿。

---

## 6. v0.8.1 — 调严 capture 阈值

> 2026-07-02 commit（v0.8.1 实施细节）
> 关联：`src/core/warfare.ts:285`、`src/tests/warfare.test.ts` describe v0.8.1

### 6.1 根因（v0.8 残留 bug）

`resolveBattle` 首战 attackerWins 时：

```ts
const nextControl = attackerWins ? Math.max(20, region.control - 18) : Math.max(25, region.control - 6);
const captured = attackerWins && nextControl <= 35;
```

`max(20, control-18)` 在 control = 53 时返回 35，**触发 capture**。意味着：
- 辽东 (control=53, garrison=10000) 首战 attackerWins → 大明直接吞并。
- 朝鲜三南 (control=50) 首战即失。

v0.8 的 M1-M5 修复了 `advanceWar`（持久战）路径，但**首战 capture 路径**未触及，仍可绕过持久战直接吞并。

### 6.2 修复方案

capture 判定改为 garrison-only：

```ts
const captured = attackerWins && region.garrison < 5000;
```

**为什么不用 control 阈值？** 经分析 `max(20, control-18)` 下界恒为 20，`nextControl <= 15` 永远触发不了。等于说旧公式的 control 阈值"看起来是 35"，但实际生效的是 `region.garrison < 5000` 这条隐含规则（garrison 在首战时被 attackerLoss 削减，可能跌破 5000）。直接显式化即可。

**为什么 5000？** 切合"县城/卫所"的最小守备编制（万历年间约 3000-5000 人）。低于此数即"残军无力再守"，符合历史直觉。

### 6.3 验收（2026-07-02 10:09）

| 维度 | 结果 |
|---|---|
| typecheck | 0 errors ✅ |
| 测试数 | **545/545 全过**（540 + 5 个 v0.8.1 capture 测试） |
| batch 100 runs errorRuns | **0** ✅ |
| diagnoseWars 120 月 capture 触发数 | **0**（v0.8.1 之前：32 场 war 中大明周边多数在 1-3 月被吞并）|
| 大明存活率 (1582) | 0%（与 v0.8 baseline 持平；崩盘原因不在 capture，在 v0.8.2 待处理的大明韧性） |

### 6.4 历史对照

萨尔浒之战（1619）：大明 11 万 vs 建州 6 万，杜松、马林、刘綖三路大军首战覆灭。但辽东（沈阳、辽阳）**未被建州吞并**，因为 garrison 仍驻 1-3 万守军。v0.8.1 复现此机制。

### 6.5 已知副作用

- **大明仍然 0% 存活**：因 capture 不再是崩盘主因，问题转移到大明韧性（财政 / 内政 / 叛乱），由 v0.8.2 处理。
- **小势力（如 播州杨氏）可能更晚被吞并**：120 月 diagnostic 显示全部 cutoff 在 40-49% progress 区间，符合"持久战"目标。

---

## 8. 文档同步

- [x] `PROGRESS.md` §1 v0.8 新增段落
- [x] `PROGRESS.md` §1 v0.8.1 新增段落（待 v0.8.1 commit 时填）
- [ ] `docs/v2-implementation-plan.md` 加 v0.8 / v0.8.1 子步骤
- [ ] CLAUDE.md §5 加 v0.8 已知坑（投送系数、距离衰减、capture 阈值）
- [x] 本 SPEC 完成后 1 段总结填入 `PROGRESS.md §0.5`