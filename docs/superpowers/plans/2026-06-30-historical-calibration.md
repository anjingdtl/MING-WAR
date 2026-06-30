# 史实化校准实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 deep-research-report.md 对 1573-1662 playable era 进行派系网络重构、模拟引擎参数校准、历史事件扩展三层史实化修正。

**Architecture:** 分层递进（派系 → 参数 → 事件）。每层独立可测，回归验证通过 batch simulation。现有 CliqueDef/FactionCliqueState 接口保持，仅替换数据和新增机制。模拟引擎修改系数和新增 disaster 模块。事件层增加 tier/chainId 字段和三连锁链。

**Tech Stack:** React 19 + TypeScript 5.7 + Zustand 5 + Vitest 3, 纯客户端单页应用, 确定性模拟（seeded PRNG）

**Spec:** `docs/superpowers/specs/2026-06-30-historical-calibration-design.md`

---

## Phase 1: 派系网络重构（4 → 5 cliques）

### Task 1: 更新类型定义

**Files:**
- Modify: `src/core/types.ts`

- [ ] 更新 FactionCliqueId 值域（donglin/eunuchs/gentry/generals → imperial/reform/donglin/eunuch/frontier）
- [ ] MovementDemand 类型更新（移除 open-sea/autonomy，新增 kaocheng/mining-tax）
- [ ] CliqueDef 新增 institutionalPowerSource 和 uniqueMechanic 可选字段
- [ ] 运行 `npx vitest run` 确认类型变更导致的编译错误列表

### Task 2: 替换 clique 数据模板

**Files:**
- Modify: `src/data/cliques.ts`

- [ ] 替换 cliqueTemplates 为 5 大网络定义（imperial/reform/donglin/eunuch/frontier）
- [ ] 每个网络包含完整的 policyAffinities、preferredLaws、opposedLaws、institutionalPowerSource、uniqueMechanic

### Task 3: 重写 clique 计算核心

**Files:**
- Modify: `src/core/clique.ts`

- [ ] 更新 CLIQUE_POP_AFFINITY 表为 5 网络映射
- [ ] 更新 computeRegionCliqueWeights 为 5 网络
- [ ] 实现 5 个独有机制函数：imperial-decree, kaocheng-effect, impeachment, purge-prison, border-pressure
- [ ] 在 computeAdministrationModifier 中集成独有机制加成

### Task 4: 更新政治运动系统

**Files:**
- Modify: `src/core/politics.ts`

- [ ] 更新 CLIQUE_DEMAND 为 5 网络映射（imperial=null, reform=kaocheng, donglin=reduce-tax, eunuch=mining-tax, frontier=army-pay）
- [ ] 更新 DEMAND_EFFECT 新增 kaocheng 和 mining-tax 效果
- [ ] MovementDemand 类型同步

### Task 5: 更新 factions 初始数据

**Files:**
- Modify: `src/data/factions.ts`

- [ ] defaultCliques 函数更新为 5 网络默认值
- [ ] 各 faction 的 cliques 覆盖值更新（ming: donglin 55→reform 55, eunuchs 47→eunuch 47 等）

### Task 6: 更新事件中的旧 cliqueId 引用

**Files:**
- Modify: `src/data/events.ts`

- [ ] 搜索所有引用旧 cliqueId（donglin/eunuchs/gentry/generals 作为 cliqueId）的位置并更新

### Task 7: 更新改革系统对接

**Files:**
- Modify: `src/core/reform.ts`

- [ ] 对接 kaocheng 诉求（reform 网络运动成功后施加 admin-efficiency modifier）

### Task 8: 更新 UI CliqueBar

**Files:**
- Modify: `src/ui/panels/CliqueBar.tsx` (及任何引用旧 cliqueId 的 UI 文件)

- [ ] 更新网络名称、颜色、tooltip
- [ ] 搜索所有 UI 文件中的旧 cliqueId 引用并替换

### Task 9: 更新测试并验证

**Files:**
- Modify: `src/tests/` 中所有 clique 相关测试文件

- [ ] 更新测试数据中的 cliqueId
- [ ] 为 5 个独有机制各写至少 1 个测试
- [ ] 运行 `npx vitest run` 全量通过
- [ ] 运行 batch simulation 20 轮验证无 error
- [ ] Commit Phase 1

---

## Phase 2: 模拟引擎参数校准

### Task 10: 人口增长模型分区

**Files:**
- Modify: `src/core/population.ts`

- [ ] 新增 REGIONAL_GROWTH_BASE 和 DISASTER_DEATH_RATE 常量表
- [ ] calculatePopulation 函数改为按 region.climate 查表
- [ ] focusBoost 下调
- [ ] 更新相关测试

### Task 11: 粮价分区

**Files:**
- Modify: `src/core/market.ts`

- [ ] 新增 REGIONAL_GRAIN_BASE 常量表
- [ ] initializeMarket 改为按 region.climate 设置区域粮价
- [ ] adjustPrice 增加 regionalBasePrice 参数
- [ ] 价格天花板 5x → 4x，地板 0.1x → 0.3x
- [ ] updateMarketPrices 改为按区域传入 regionalBasePrice
- [ ] 更新相关测试

### Task 12: 税收征解效率

**Files:**
- Modify: `src/core/economy.ts`

- [ ] 税收系数 0.022 → 0.004
- [ ] 引入 collectionEfficiency 因子
- [ ] 更新 calculateRegionEconomy 公式
- [ ] 更新相关测试

### Task 13: 军费占比调整

**Files:**
- Modify: `src/core/economy.ts`

- [ ] costPerSoldier 各类型下调
- [ ] adminCost 各类型下调
- [ ] 更新相关测试

### Task 14: 灾荒常态压迫

**Files:**
- Create: `src/core/disaster.ts`
- Modify: `src/core/simulation.ts`

- [ ] 新建 disaster.ts：generateDisasters 函数、灾害类型定义、灾害效果计算
- [ ] RegionState.activeDisasters 类型从 string[] 改为 DisasterState[]
- [ ] simulation.ts 月度管线中新增 generateDisasters 步骤（在 economy 之前）
- [ ] 灾害效果集成到 economy（产量惩罚）、market（粮价飙升）、population（死亡率）
- [ ] 为灾害系统编写测试

### Task 15: 初始参数校准

**Files:**
- Modify: `src/data/regions.ts`
- Modify: `src/data/factions.ts`

- [ ] 区域人口上调 30-40%（按区域分组）
- [ ] populationCapacity 同比例上调
- [ ] 明朝初始属性微调（treasury 5M, grainReserve 8M, corruption 38, armyTotal 580k）
- [ ] 更新相关测试

### Task 16: 校准验证

- [ ] 运行 `npx vitest run` 全量通过
- [ ] 运行 batch simulation 100 轮 × 240 月，确认 0 error runs
- [ ] 验证大明财政前 60 月保持正余额
- [ ] 验证粮价 240 月内不超过 base × 4
- [ ] Commit Phase 2

---

## Phase 3: 历史事件扩展

### Task 17: GameEvent 接口增强

**Files:**
- Modify: `src/core/eventEngine.ts`
- Modify: `src/core/types.ts`

- [ ] GameEvent 接口新增 tier?、sourceRefs?、chainId? 可选字段

### Task 18: 开局 modifier 初始化

**Files:**
- Modify: `src/data/scenarios.ts`

- [ ] createMvpScenario 中新增 3 个开局 modifier（maritime-trade-legalized, border-trade-restored, gengxu-defense-lesson）

### Task 19: 修正现有事件

**Files:**
- Modify: `src/data/events.ts`

- [ ] 铁事件（3个）：zhang_juzheng_death 时间窗前移, later_jin_founded 窗口收窄, fushun_falls 窗口收窄
- [ ] 钢事件（12个）：时间窗和数值校准（见 spec §3.2 表格）
- [ ] 柔事件（6个）：触发条件更新、选项增加
- [ ] 所有事件添加 tier 和 chainId 标注

### Task 20: 新增 10 个事件

**Files:**
- Modify: `src/data/events.ts`

- [ ] 新增钢事件：jisi_incident, liaoxiang_surcharge, jiashen_catastrophe, tiaoobian_controversy, wei_zhongxian_purge, yuan_chonghuan_execution
- [ ] 新增柔事件：shaanxi_chain_drought
- [ ] 每个事件包含完整 conditions、options（含网络 reaction）、tier、sourceRefs、chainId

### Task 21: 连锁事件链

**Files:**
- Modify: `src/data/events.ts`
- Modify: `src/core/eventEngine.ts`

- [ ] 实现链 A (fiscal-reform-crisis): flag 依赖检查
- [ ] 实现链 B (liaodong-crisis): flag 依赖检查
- [ ] 实现链 C (court-faction-war): 网络 strength/approval 依赖
- [ ] 事件选项的 effects 中增加 clique support/approval 联动效果

### Task 22: 事件层验证

- [ ] 运行 `npx vitest run` 全量通过
- [ ] 手动验证铁事件在正确时间窗触发
- [ ] 验证连锁事件链 flag 依赖逻辑
- [ ] Commit Phase 3

---

## 全量回归

### Task 23: 最终回归测试

- [ ] `npx vitest run` — 全部 377+ 测试通过
- [ ] `npx tsc --noEmit` — 零类型错误
- [ ] batch simulation 100 轮 × 240 月 — 0 error runs
- [ ] 检查所有 6 条历史局势可达（seed 扫描）
- [ ] Fix 所有发现的问题
- [ ] 最终 commit + git push 远端
