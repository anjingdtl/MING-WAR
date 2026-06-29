# 朝堂派系与内政代价 — 实施计划 PLAN

> **文档类型**：实施计划（PLAN）
> **基线 SPEC**：`docs/superpowers/specs/2026-06-29-clique-spec.md`
> **设计参考**：`docs/strategy-layer-optimization-plan.md`（阶段 A）
> **编写日期**：2026-06-29
> **预计总工作量**：8-12 小时（按 TDD 红→绿→重构循环）
> **测试文件**：新增 1 个，修改 3 个

---

## 目标

引入 4 个动态朝堂派系（东林党、内廷宦党、地方缙绅、军功勋贵），使内政重点切换产生派系支持度变化，汇总为势力行政效率修正。AI 决策受派系满意度约束。玩家通过 UI 可预览切换后果和当前派系格局。

---

## 范围边界

### Included

- 四个派系的类型定义与数据模板（`CliqueDef`）
- 势力级别的派系状态（`FactionCliqueState`：support / strength / modifier）
- 每月派系力量重新计算（基于区域经济社会结构）
- 行政效率修正计算与汇总
- 内政重点切换时的派系支持度变化
- AI 内政决策加入派系满意度权重
- 派系概览 UI 组件（`CliqueBar.tsx`）
- 内政重点按钮的切换预览 tooltip
- TopBar 派系预警图标
- 存档 v0.1 → v0.3 迁移函数
- 新势力 `rebels` 的默认派系初始化
- 全量测试覆盖

### Excluded

- 国策制度切换系统（阶段 B）
- 边策梯度（阶段 C）
- 区域建设队列（阶段 D）
- 阶层人口细分（阶段 E）
- 事件链期刊（阶段 F）
- 自定义派系名称或动态派系生成
- 派系跨势力联动
- 独立人物系统

---

## 文件结构

```
新增文件：
  src/core/clique.ts                派系计算纯函数（力量/修正/反应）
  src/data/cliques.ts               四派系数据模板
  src/ui/panels/CliqueBar.tsx       派系概览 UI 组件
  src/tests/clique.test.ts          派系系统单元测试

修改文件：
  src/core/types.ts                 新增 CliqueDef, FactionCliqueState 类型
                                    修改 FactionState（+cliques, +administrationBase）
  src/core/ai.ts                    升级 chooseDomesticFocus（+派系权重）
  src/core/simulation.ts            新增 updateFactionCliques 步骤
  src/data/scenarios.ts             createMvpScenario 初始化派系 + 版本号
  src/data/factions.ts              初始势力增加 cliques 初始值
  src/store/gameStore.ts            策略面板需读取派系状态
  src/ui/map/GameMap.tsx            内政按钮 + tooltip + CliqueBar 挂载
  src/ui/layout/TopBar.tsx          派系预警图标
  src/ui/common/StatBadge.tsx       可选：支持 tooltip prop
  src/save/saveManager.ts           新增 migrateToV0_3 存档迁移
  src/tests/simulation.test.ts      更新确定性期望值
  src/tests/decisions-ai.test.ts    更新 AI 决策测试
  src/tests/scenario.test.ts        验证 cliques 字段存在
```

---

## 任务拆分

### 任务 1：定义类型与数据模板

**文件**：`src/core/types.ts`, `src/data/cliques.ts`

```
- [ ] 在 types.ts 中新增 CliqueDef, FactionCliqueId, FactionCliqueState
- [ ] 在 FactionState 中新增 cliques: FactionCliqueState[], administrationBase: number
- [ ] 创建 src/data/cliques.ts，定义四派系模板：
       donglin, eunuchs, gentry, generals
       每项包含 name, shortName, description, primaryTrait, policyAffinities
- [ ] 确保 policyAffinities 的 6 个 key 与 DomesticFocus 对齐
- [ ] 编写 clique.test.ts 的类型存在性测试
```

**验收**：`tsc --noEmit` 通过，类型测试通过。

---

### 任务 2：实现派系计算纯函数

**文件**：`src/core/clique.ts`, `src/tests/clique.test.ts`

```
- [ ] computeRegionCliqueWeights(region) → CliqueWeight[]
       基于 region.agriculture, commerce, taxCapacity 等计算权重
       规则：
         commerce > 70 → 东林 +8
         taxCapacity > 70 → 宦党 +5
         agriculture > 70 → 缙绅 +6
         fortification > 60 → 勋贵 +4
         所有权重标准化到 0-100

- [ ] computeFactionCliqueStrength(faction, regions) → 更新每个 cliques 的 strength
       strength = Σ(region.population × cliqueWeight) / 总人口

- [ ] computeCliqueReactions(newFocus, oldFocus, cliques, defs) → CliqueReaction[]
       规则：supportDelta = (newAffinity - oldAffinity) × strength/100
       clamp -8 ~ +8

- [ ] applyCliqueReactions(cliques, reactions) → 更新后的 cliques

- [ ] computeAdministrationModifier(cliques) → number
       规则：collect high-support(+)/low-support(-) 修正
       最终 = Σ(activeModifier)，clamp -10 ~ +10

- [ ] applyAdministrationModifier(faction) → faction.administration

- [ ] 测试：所有纯函数 TDD
```

**验收**：`clique.test.ts` 全部绿灯。

---

### 任务 3：集合初始数据

**文件**：`src/data/scenarios.ts`, `src/data/factions.ts`

```
- [ ] factionTemplates 中每个势力增加 cliques 初始数组
       每个派系 support=50, strength=0（首次月度结算时计算）
       大明初始 adjustment：东林 +5, 宦党 -3（反映历史起点）
       建州初始 adjustment：勋贵 +8, 缙绅 -5

- [ ] createMvpScenario 生成 cliques 为每个势力初始化
       version 升级为 "0.3.0"

- [ ] rebels 势力也初始化 cliques（四派系均 support=30, strength=0）

- [ ] 测试：scenario.test.ts 验证 cliques 存在且长度为 4
```

**验收**：场景生成含完整派系数据。

---

### 任务 4：集成到月度模拟

**文件**：`src/core/simulation.ts`, `src/tests/simulation.test.ts`

```
- [ ] 新增 updateFactionCliques(state) 函数
       在 simulateMonth 的步骤 5.5 调用（控制度结算后、事件检测前）
       逻辑：
         1. 保存 faction.administration → administrationBase
         2. 调用 computeFactionCliqueStrength 更新 strength
         3. 对每个派系计算 activeModifier
         4. 汇总 → faction.administration

- [ ] 导入 clique.ts 的函数，确保不引入循环依赖

- [ ] 测试：
       - 运行 simulateMonth 后验证 administration 被修改
       - 验证同一 seed 下结果仍然确定
       - 验证 administration 不会越界（0-100）

- [ ] 更新 simulation.test.ts 的确定性测试期望值
```

**验收**：模拟运行后 administration 值发生合理变化，所有已有测试通过或合理更新。

---

### 任务 5：升级 AI 内政决策

**文件**：`src/core/ai.ts`, `src/tests/decisions-ai.test.ts`

```
- [ ] 升级 chooseDomesticFocus(faction, regions)
       新增逻辑：
         1. 计算危机分数（保持原逻辑）
         2. 计算派系满意度分数：
            对每项 DomesticFocus，取最低支持度派系的 affinity 作为加分项
         3. 加权合并：crisisWeight × 0.6 + cliqueWeight × 0.4
         4. 最终选择最高分项

- [ ] 确保 AI 不会在支持度极低的派系偏好下强行切换

- [ ] 测试：
       - 建州势力（勋贵支持度高）应更倾向 military/frontier
       - 大明（东林+缙绅）应倾向 administration/recovery/agriculture
       - 不同 seed 下 AI 决策的合理变异性
```

**验收**：AI 决策受派系影响但不会完全忽略危机信号。

---

### 任务 6：创建派系概览 UI 组件

**文件**：`src/ui/panels/CliqueBar.tsx`

```
- [ ] 组件接口
       props: { cliques: FactionCliqueState[], cliqueDefs: Record<string, CliqueDef> }

- [ ] 水平布局 4 个派系卡片
       每卡片包含：
         - shortName 文字标签
         - 水平进度条（height 4px, width = support%）
           颜色：绿(support>60) / 黄(40-60) / 红(<40)
         - 修正值（+N / -N，红绿色）
         - hover 时展开 tooltip 显示 name, description, 当前 strength, 当前修正

- [ ] 组件不包含游戏逻辑，纯展示

- [ ] 测试：
       - 四个派系卡片渲染
       - support=72 时进度条宽度约 72%
       - modifier=+4 时显示 "+4"
       - modifier=-2 时显示 "-2" 且红色
```

**验收**：独立渲染正确，hover 显示详细信息。

---

### 任务 7：修改 GameMap 内政面板

**文件**：`src/ui/map/GameMap.tsx`

```
- [ ] 在 map-command-panel 底部挂载 CliqueBar
       条件：isPlayerRegion（仅当所选区域属于玩家势力）
       props：从 state.factions[state.playerFactionId].cliques 传入

- [ ] 内政重点按钮增强
       每项按钮增加 onMouseEnter/onMouseLeave 状态
       hover 时显示 tooltip（Clip 组件）：
         标题："切换到「［内政重点名］」"
         列表：每个派系名称 + 箭头 + 预计支持度变化
              如："东林党 ▼ -3"
              颜色：红降绿升
         底部："预计行政效率：[+1 / -2 / 0]"

- [ ] tooltip 使用 portal 渲染避免被父容器 overflow 截断

- [ ] 确保非玩家势力区域选择时 CliqueBar 不显示
```

**验收**：hover 内政按钮可见派系反应预览，CliqueBar 正确显示。

---

### 任务 8：修改 TopBar 增加预警

**文件**：`src/ui/layout/TopBar.tsx`, `src/ui/common/StatBadge.tsx`

```
- [ ] 在 TopBar StatBadge 行末尾增加派系预警图标
       读取 state.factions[playerFactionId].cliques
       计算最低支持度派系：
         minSupport < 15 → 红色警报图标（⚠️红色）+ tooltip "[派系名]极度不满"
         minSupport < 25 → 黄色警报图标（⚠️黄色）+ tooltip "[派系名]不满"
         minSupport >= 25 → 不显示

- [ ] 图标使用 lucide-react 的 AlertTriangle

- [ ] 可选：StatBadge 组件增加 tooltip prop 支持
```

**验收**：低支持度时 TopBar 出现预警图标。

---

### 任务 9：实现存档迁移

**文件**：`src/save/saveManager.ts`, `src/tests/save-store.test.ts`

```
- [ ] 新增 migrateToV0_3(state: GameState): GameState
       检测 state.version < "0.3.0"
       对每个 faction：
         1. 新增 cliques 字段（默认 support=50, strength=0）
         2. 新增 administrationBase = faction.administration

- [ ] 在 saveManager 加载时调用迁移函数

- [ ] 测试：
       - 构造旧版本状态 → 迁移 → 验证 cliques 存在
       - 迁移后不影响其他字段
```

**验收**：旧存档加载后派系系统正常工作。

---

### 任务 10：全量测试与验收

```
- [ ] 运行全量测试：npm test -- --run → 全部通过
- [ ] 运行 npm run build → 无类型错误
- [ ] 批量模拟验收：
       - 运行 50 局 × 120 个月
       - 输出派系支持度分布（avg/min/max 四派系）
       - 输出行政效率分布
       - 验证无 crash / NaN / 死循环
- [ ] 肉眼验收：
       - 启动游戏 → 观察 CliqueBar 显示
       - 切换内政重点 → 观察支持度变化
       - hover 按钮 → 查看 tooltip
       - 选择非玩家区域 → CliqueBar 隐藏
```

---

## 任务依赖图

```
任务 1 (类型+数据) ──┬──→ 任务 2 (核心逻辑 TDD)
                    │        │
                    │        └──→ 任务 4 (集成模拟)
                    │               │
                    └──→ 任务 3 (初始数据) ─→ 任务 4
                                              │
                    任务 5 (AI 升级) ←───────┘
                         │
                         ├──→ 任务 8 (TopBar 预警)
                         │
                         └──→ 任务 7 (GameMap 面板)
                                  │
                    任务 6 (CliqueBar UI) ─┘
                         │
                    任务 9 (存档迁移) ──── 独立可并行
                         │
                    任务 10 (全量验收) ←── 所有任务
```

---

## TDD 循环节奏

每个任务按红→绿→重构循环执行：

```
1. 写失败测试（red light）
2. 写最小实现让测试通过（green light）
3. 运行全量测试确认无回归
4. 重构（如有需要）
5. git add + git commit（每个任务一个 commit）
```

---

## 提交策略

| 任务 | 提交信息 |
|---|---|
| 1 + 2 | `feat(clique): 定义派系类型、数据模板与核心计算函数` |
| 3 | `feat(clique): 初始势力派系数据与场景版本升级` |
| 4 | `feat(clique): 月度模拟集成派系结算` |
| 5 | `feat(clique): AI决策加入派系满意度权重` |
| 6 + 7 | `feat(clique): 派系概览UI与内政按钮tooltip` |
| 8 | `feat(clique): TopBar派系预警图标` |
| 9 | `feat(clique): 存档v0.1→v0.3迁移` |
| 10 | `test(clique): 全量测试验收与批量模拟报告` |
