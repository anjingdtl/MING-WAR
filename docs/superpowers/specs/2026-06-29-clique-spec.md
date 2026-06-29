# 《万历：山河崩塌》策略层 v0.3 — 朝堂派系与内政代价 SPEC

> 文档类型：功能规格说明书（Feature SPEC）
> 基线来源：`docs/strategy-layer-optimization-plan.md`（阶段 A）
> 参考游戏：Victoria 3（利益集团 Interests 系统设计模式）
> 编写日期：2026-06-29
> 依赖版本：v0.2.0（已完成地图缩放拖动、25 事件库、数值反馈连锁）
> 新增代码量估算：~600 行 TS/TSX（模型 + 逻辑 + UI + 测试）

---

## 1. 功能定义

### 1.1 一句话规格

在内政决策中引入 4 个动态朝堂派系。每次切换内政重点都会产生派系支持度变化，支持度汇总为「行政效率」全局修正，各势力（含 AI）在推行政策时必须权衡派系得失。

### 1.2 解决的核心问题

当前 MVP 的内政重点切换是自由的、无代价的、无反馈的——玩家可以每月切换选项而不付出任何代价。这导致：

- 内政决策缺乏「策略张力」——没有「我该不该现在动这个」的犹豫。
- 历史合理性被破坏——东林党和阉党的冲突、地方缙绅的反抗在机制上不存在。
- 玩家感受不到朝廷是「人组成的」，而非「一个按钮」。

### 1.3 设计目标

| 目标 | 量化标准 |
|---|---|
| 内政切换有摩擦 | 每次切换至少影响 2 个派系 ±3 以上 |
| 派系有「个性」 | 每个派系对 6 项内政重点的偏好可预期 |
| AI 也受约束 | AI 内政决策考虑派系支持度，不自由切换 |
| 玩家能理解因果关系 | UI 明确显示切换后对派系的影响 |
| 不增加操作复杂度 | 内政重点切换仍然是 1 次点击 |

### 1.4 不做（本阶段明确排除）

- 国策制度切换（阶段 B）。
- 边策梯度系统（阶段 C）。
- 区域建设队列（阶段 D）。
- 阶层人口细分（阶段 E）。
- 事件链期刊系统（阶段 F）。
- 派系图/自定义派系名称（MVP 后扩展）。

---

## 2. 数据模型

### 2.1 派系定义

```ts
// 新增类型 — src/core/types.ts

export type FactionCliqueId = string;

export interface CliqueDef {
  id: FactionCliqueId;
  name: string;                    // 东林党
  shortName: string;               // 东林
  description: string;             // 以江南士大夫为主体的政治派系……
  primaryTrait: string;            // 澄清吏治
  policyAffinities: Record<DomesticFocus, number>;  // 对 6 项内政重点的态度（-10 ~ +10）
}
```

**MVP 四派系数据 — `src/data/cliques.ts`**

```ts
export const cliqueTemplates: Record<FactionCliqueId, CliqueDef> = {
  donglin: {
    id: "donglin",
    name: "东林党",
    shortName: "东林",
    description: "以江南士大夫为主体的政治派系，主张澄清吏治、减税惠民、反对矿税。",
    primaryTrait: "澄清吏治",
    policyAffinities: {
      agriculture: 2,
      finance: -4,      // 反对敛财
      military: -3,     // 文官轻武
      administration: 8,
      recovery: 6,
      frontier: -2      // 主和轻战
    }
  },
  eunuchs: {
    id: "eunuchs",
    name: "内廷宦党",
    shortName: "宦党",
    description: "以司礼监、矿监税使为核心的宦官政治势力，依附皇权，主张开征商税矿税。",
    primaryTrait: "整顿财政",
    policyAffinities: {
      agriculture: -2,
      finance: 8,
      military: 2,
      administration: -6,  // 与文官集团对立
      recovery: -2,
      frontier: 0
    }
  },
  gentry: {
    id: "gentry",
    name: "地方缙绅",
    shortName: "缙绅",
    description: "各地拥有土地的在乡士绅，反对清丈田亩，主张维持地方自治和低税率。",
    primaryTrait: "劝课农桑",
    policyAffinities: {
      agriculture: 6,
      finance: -4,      // 反对加税
      military: 0,
      administration: -4,  // 反对中央集权
      recovery: 4,
      frontier: -4      // 不想出钱打仗
    }
  },
  generals: {
    id: "generals",
    name: "军功勋贵",
    shortName: "勋贵",
    description: "世袭武勋和边疆将门，追求军费倾斜、边功封赏和军事自主权。",
    primaryTrait: "整军备战",
    policyAffinities: {
      agriculture: -2,
      finance: 0,
      military: 8,
      administration: 0,
      recovery: -4,     // 不想裁军
      frontier: 6
    }
  }
};
```

### 2.2 势力派系状态

```ts
// 新增 & 修改 — src/core/types.ts

export interface FactionCliqueState {
  cliqueId: FactionCliqueId;
  support: number;      // 0–100，当前支持度
  strength: number;     // 派系力量（基于区域人口/经济结构，每月更新）
  activeModifier: number;  // 当前施加的修正值（由 support × strength 推得）
}

// 修改 FactionState，新增字段
export interface FactionState {
  // ……现有字段保持不变……
  cliques: FactionCliqueState[];        // 新增
  administrationBase: number;           // 新增：不受派系影响的原始行政值（供 UI 对比）
}
```

### 2.3 派系力量计算

每个势力的每个区域的「派系力量权重」由该区域的经济社会结构决定：

```ts
interface RegionCliqueWeight {
  cliqueId: FactionCliqueId;
  weight: number;  // 0–100
}

function computeRegionCliqueWeights(region: RegionState): RegionCliqueWeight[] {
  // 基于 region 的 agriculture, commerce, taxCapacity 等值计算
  // 举例：高 commerce 增加东林权重，低 agriculture 降低缙绅权重
}

function computeFactionCliqueStates(faction: FactionState, regions: RegionState[]): FactionCliqueState[] {
  // 汇总该势力所有控制区域的 cliqueWeights，得到各派系的总 strength
  // strength = Σ(region.population × regionCliqueWeight) / 总人口
  // support 从当前 FactionCliqueState 继承，新势力默认 50
}
```

### 2.4 派系修正对行政效率的影响

```ts
function computeCliqueAdminModifier(cliques: FactionCliqueState[]): number {
  // activeModifier 范围：-10 ~ +10
  // 汇总逻辑：
  //   支持度 > 60 的派系提供正向修正（+activeModifier）
  //   支持度 < 40 的派系提供负向修正（-activeModifier × 0.8，不满比满意更致命）
  // 最终 administraton = administrationBase + 汇总修正
}
```

### 2.5 内政切换的派系反应

```ts
interface CliqueReaction {
  cliqueId: FactionCliqueId;
  delta: number;  // 支持度变化，范围 -8 ~ +8
  reason: string;  // 简短原因，用于 UI  hover 提示
}

function computeCliqueReactions(
  newFocus: DomesticFocus,
  oldFocus: DomesticFocus,
  cliques: FactionCliqueState[],
  defs: Record<FactionCliqueId, CliqueDef>
): CliqueReaction[] {
  // 计算逻辑：
  // 1. 新 focus 的 affinity 减去旧 focus 的 affinity
  // 2. 差值 × 派系当前 strength / 100
  // 3. clamp 在 -8 ~ +8 范围内
}
```

### 2.6 数据文件结构

```
src/data/
├── cliques.ts        # 新增：CliqueDef 模板数据
├── events.ts         # 已有
├── factions.ts       # 修改：初始势力增加 cliques 字段
├── regions.ts        # 已有
└── scenarios.ts      # 修改：createMvpScenario 初始化 cliques
```

---

## 3. 游戏逻辑变更

### 3.1 月度结算新增步骤

在 `simulateMonth()` 中，在第 5 步（结算区域控制度/叛乱）之后、第 6 步（检测事件）之前，插入：

```
5.5  结算派系力量（每个势力）
5.6  更新派系修正值 → 写入 faction.administration 最终值
```

```ts
// simulation.ts 新增函数

function updateFactionCliques(state: GameState): void {
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    // 1. 保存原始行政值
    faction.administrationBase = faction.administration;
    // 2. 重新计算派系力量（每月可能变动，因区域易手）
    const regions = Object.values(state.regions)
      .filter(r => r.controllerFactionId === faction.id);
    updateCliqueStrength(faction, regions);
    // 3. 更新 activeModifier
    for (const cs of faction.cliques) {
      cs.activeModifier = computeAdminModifier(cs.support, cs.strength);
    }
    // 4. 汇总行政修正
    faction.administration = faction.administrationBase + sumCliqueModifiers(faction.cliques);
    faction.administration = clamp(faction.administration, 0, 100);
  }
}
```

### 3.2 AI 内政决策升级

修改 `chooseDomesticFocus()`：

```ts
// 当前逻辑：纯危机驱动（粮不够→农桑，钱不够→财政……）
// 升级后：危机权重 × 0.6 + 派系满意度权重 × 0.4

function chooseDomesticFocus(faction: FactionState, regions: RegionState[]): DomesticFocus {
  // 1. 计算危机分数（当前逻辑）
  const crisisScores = computeCrisisScores(faction, regions);
  // 2. 计算派系满意度分数（取最低支持度派系的偏好）
  const cliqueScores = computeCliqueSatisfactionScores(faction, crisisScores);
  // 3. 加权合并
  return weightedPick(crisisScores, cliqueScores, faction.aiProfile.economicFocus);
}
```

### 3.3 派系事件（基础版）

```
事件类型：clique_shift
触发条件：任意派系 support > 80 持续 6 个月
事件名："[派系名]势力坐大"
选项：
  1. 顺势重用 → support +5, 对立派系 -8
  2. 稍加抑制 → support -8, 对立派系 +3
  3. 维持不变 → support -2, 行政效率暂时 -3

事件类型：clique_collapse
触发条件：任意派系 support < 15 持续 6 个月
事件名："[派系名]失势"
选项：
  1. 安抚挽回 → support +6, 国库 -100000
  2. 任其衰败 → strength -10, 对立派系 +5
```

---

## 4. UI 变更规格

### 4.1 战略决策面板重构

**改动文件**：`src/ui/map/GameMap.tsx`

当前 `map-command-panel` 底部有三个区域：
```
[ 军事方向下拉 ]
[ 军事姿态三按钮 ]
[ 内政重点六按钮 ]
```

改为四个区域：
```
[ 军事方向下拉 ]
[ 军事姿态三按钮 ]
[ 内政重点六按钮 ]       ← 保持不变，但每项增加派系反应提示
[ 朝堂派系概览 ]          ← 新增
```

### 4.2 派系概览 UI（新增组件）

**新建文件**：`src/ui/panels/CliqueBar.tsx`

```tsx
// 横向排列 4 个派系卡片，每个卡片显示：
// - 派系简称（东林/宦党/缙绅/勋贵）
// - 支持度进度条（彩色渐变）
// - 当前修正值（+3 / -2，红绿色）
// - hover 展开详细信息

// 交互：点击派系卡片 → 显示该派系对当前 6 项内政重点的详细偏好
```

组件状态（简化）：

```
┌──────────────────────────────────────────────┐
│  朝堂  东林 ██████████ 72 +4  宦党 ████ 38 -2 │
│        缙绅 ███████ 64 +2  勋贵 █████ 52  0    │
└──────────────────────────────────────────────┘
```

### 4.3 内政重点按钮增强

每项内政重点按钮增加 **hover tooltip**，预览切换后的派系反应：

```
┌──────────────────────────┐
│ 切换到「整军备战」       │
│ → 军功勋贵 +6  (好)     │
│ → 东林党   -3  (差)     │
│ → 宦党     +1           │
│ → 缙绅       0          │
│ 预计行政效率：-1         │
└──────────────────────────┘
```

### 4.4 TopBar 信号增强

在 TopBar 的 StatBadge 行增加一个派系预警图标：

- 当任意派系 support < 25 → 显示黄色警告图标
- 当任意派系 support < 15 → 显示红色警告图标
- 点击图标跳转到派系详情

---

## 5. 游戏状态与存档兼容

### 5.1 版本升级

- `GameState.version` 从 `"0.1.0"` 升级至 `"0.3.0"`
- 新增存档迁移函数 `migrateToV0_3(state: GameState): GameState`
  - 为旧存档的每个势力补充默认派系状态（support=50, strength 基于区域自动计算）

### 5.2 迁移注意事项

```
迁移函数检查清单：
- [ ] 旧存档加载后能正常运行
- [ ] 旧存档的派系状态由迁移函数自动初始化
- [ ] 迁移后不影响月度推演结果的确定性（同一 seed 同一决策 → 同一结果）
- [ ] 新增 rebels 势力的兼容性检查（已有）
```

---

## 6. 测试规格

### 6.1 新增单元测试

**文件**：`src/tests/clique.test.ts`

| 测试项 | 描述 | 优先级 |
|---|---|---|
| clique weight computation | region.cliqueWeights 基于 region 属性正确计算 | P0 |
| faction clique strength aggregation | 势力派系力量由所控区域权重加权汇总 | P0 |
| support delta on focus change | 切换内政重点产生正确方向和大小的派系反应 | P0 |
| admin modifier computation | 派系修正汇总到 administration 的计算正确 | P0 |
| AI considers cliques | AI 内政决策受派系支持度影响 | P1 |
| admin clamped 0-100 | 修正后行政值不越界 | P1 |

### 6.2 修改现有测试

| 文件 | 改动 |
|---|---|
| `src/tests/simulation.test.ts` | 重新计算确定性的期望值（cliques 改变了 administration） |
| `src/tests/decisions-ai.test.ts` | AI 决策测试需考虑派系因素 |
| `src/tests/scenario.test.ts` | 验证新场景包含 cliques 字段 |

### 6.3 新增 UI 测试

| 测试项 | 描述 |
|---|---|
| CliqueBar renders | 四个派系卡片正确渲染 |
| CliqueBar support bars | 支持度进度条与数值一致 |
| focus button tooltips | hover 或点击提示显示派系反应预览 |
| isPlayerRegion guard | 非玩家势力区域不显示 CliqueBar |

### 6.4 批量模拟验收

在现有批量模拟脚本中增加：

```ts
// 在 runBatchSimulation 输出中新增：
interface CliqueMetrics {
  avgSupportDonglin: number;     // 东林平均支持度
  avgSupportEunuchs: number;     // 宦党平均支持度
  avgSupportGentry: number;      // 缙绅平均支持度
  avgSupportGenerals: number;    // 勋贵平均支持度
  factionCollapseByClique: number; // 因派系支持度 < 10 触发的势力崩溃次数
  avgAdministration: number;     // 平均行政效率
  administrationsWithoutCliques: number[]; // 用以对比有无派系系统的行政效率
}
```

验收标准：
- 不同势力派系支持度分布应显著不同（如大明东林强、建州勋贵强）
- 行政效率不应出现全 100 或全 0 的极端分布
- 势力不会因派系系统而 3 年内必然崩溃

---

## 7. 实施步骤

| 步骤 | 文件 | 工作量 |
|---|---|---|
| 1. 定义类型和派系数据 | `types.ts`, `cliques.ts` | 小 |
| 2. 实现派系计算逻辑 | `clique.ts`（新 core 文件） | 中 |
| 3. 集成到 simulatMonth | `simulation.ts` | 小 |
| 4. 升级 AI 决策 | `ai.ts` | 小 |
| 5. 升级 scenarios | `scenarios.ts`, `factions.ts` | 小 |
| 6. 创建 CliqueBar UI | `CliqueBar.tsx`（新文件） | 中 |
| 7. 修改 GameMap 内政按钮 | `GameMap.tsx` | 中 |
| 8. TopBar 预警图标 | `TopBar.tsx`, `StatBadge.tsx` | 小 |
| 9. 存档迁移 | `saveManager.ts` | 中 |
| 10. 测试编写 | `clique.test.ts`（新），修改 3 个已有测试 | 中 |
| 11. 批量模拟验收 | `runBatchSimulation.ts` | 小 |

---

## 8. 边界情况与风险控制

### 8.1 边界情况

| 场景 | 处理方式 |
|---|---|
| 势力没有控制任何区域 | cliques 保持默认值（support=50, strength=0） |
| 所有派系支持度同时降到 0 | 行政效率最低为 0，不会变为负数 |
| 势力继承/变更 | 继承时 cliques 重置为初始值 |
| 旧存档加载 | 迁移函数自动补充 cliques |
| 玩家频繁切换内政重点（每月切换） | 支持度变化即时生效，但每次切换产生 cooldown 标记，同月第二次切换支持度惩罚 ×1.5 |
| AI 重复选择同一内政重点 | AI 逻辑已包含切换代价，不会无故反复切换 |

### 8.2 数值风险

| 风险 | 控制 |
|---|---|
| 派系支持度全极端（0 或 100） | 支持度变化每步 clamp，有向 50 回归的微弱趋势 |
| 行政效率波动过大 | 修正值上限 ±10（通过派系汇总计算限制） |
| 某派系长期主导导致玩法单调 | 历史事件（如「国本之争」）会强制调整派系力量 |
| 不同势力派系分布一样 | 势力特性（traits）修改初始派系支持度 |

### 8.3 玩家体验风险

| 风险 | 控制 |
|---|---|
| 派系系统增加了认知负担 | UI 渐进展示：默认只显示进度条，hover 查看详情 |
| 玩家不理解派系修正如何影响游戏 | TopBar 行政效率旁增加「受影响」小标记，hover 解释来源 |
| 新手忽略派系维度 | 引导流程增加一次派系事件，让玩家自然遇到 |


## 9. TDD 实施顺序（推荐）

```
1. 写 clique.test.ts 的纯函数测试（computeCliqueWeights 等）
2. 实现 clique.ts 的纯函数逻辑（红灯 → 绿灯）
3. 写 simulation 集成测试（verify administrations change）
4. 集成 clique 到 simulateMonth
5. 创建 CliqueBar UI 组件 + 写 UI 测试
6. 修改 GameMap 内政按钮
7. 修改 TopBar
8. 实现存档迁移
9. 运行批量模拟 + 验收
10. commit + push
```

---

## 10. 禁止事项（明确排除）

本 SPEC 明确**不包含**以下内容：

- 玩家可以主动提拔/打压具体派系（那是阶段 B 的内容）。
- 派系有独立的人物名称/画像（人物系统不在 MVP 范围）。
- 派系跨势力联动（如玩家势力的事件影响 AI 势力的派系）。
- 派系分裂/合并机制。
- 自定义新派系/动态生成派系。
- 基于派系的外交加成。
