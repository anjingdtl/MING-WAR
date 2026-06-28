# 万历：山河崩塌 MVP 全项目质量检查计划

> 日期：2026-06-28
> 目的：确保项目可运行、无重大 Bug，每 Phase 检查通过后 commit，全部完成后 push

## 检查总览

| Phase | 模块 | 文件数 | 测试数 | 检查要点 |
|---|---|---|---|---|
| 1 | 骨架+类型 | 7 | 6 | 配置正确性、类型定义完整性、日历/随机模块 |
| 2 | 推演核心 | 10 | 10 | 人口/经济/决策/AI/战争/控制/叛乱逻辑 |
| 3 | 引擎+数据 | 12 | 8 | 事件引擎/模拟编排/评分/批量CLI/数据定义 |
| 4 | 状态+UI | 16 | 6 | 存档/Store/地图/UI组件/App集成 |
| 5 | 全流程集成 | 全部 | 30 | 全量测试+build+batch+dev server |

---

## Phase 1: 项目骨架与类型系统

**检查文件：**
- 配置：package.json, vite.config.ts, tsconfig.json, tsconfig.node.json, index.html, .gitignore, src/main.tsx
- 核心：src/core/types.ts, src/core/calendar.ts, src/core/random.ts
- 测试：src/tests/smoke.test.ts, src/tests/types.test.ts, src/tests/calendar-random.test.ts

**检查项：**
1. [ ] package.json scripts 完整性（dev/build/test/batch）
2. [ ] vite.config.ts 插件+测试环境配置
3. [ ] tsconfig 编译设置正确
4. [ ] types.ts 类型定义完整（GameState/FactionState/RegionState/PlayerDecision等）
5. [ ] calendar.ts 月份推进+日期格式化
6. [ ] random.ts 固定种子随机数
7. [ ] 运行 smoke / types / calendar-random 测试
8. [ ] 运行 tsc 类型检查

---

## Phase 2: 推演核心逻辑

**检查文件：**
- src/core/population.ts, economy.ts, decisions.ts, ai.ts, warfare.ts, control.ts, rebellion.ts
- 测试：economy-population.test.ts, decisions-ai.test.ts, war-control-rebellion.test.ts

**检查项：**
1. [ ] population.ts 人口计算（增长/饥荒/承载上限）
2. [ ] economy.ts 经济计算（粮食/税收/国库/维护）
3. [ ] decisions.ts 决策验证（军事目标/内政重点/姿态）
4. [ ] ai.ts AI决策（军事+内政，所有势力）
5. [ ] warfare.ts 战斗结算（兵力/地形/士气/随机）
6. [ ] control.ts 控制度变化
7. [ ] rebellion.ts 叛乱风险+阶段
8. [ ] 运行相关测试全通过
9. [ ] 验证跨模块导入一致性

---

## Phase 3: 引擎与数据层

**检查文件：**
- src/core/eventEngine.ts, simulation.ts, scoring.ts
- src/data/events.ts, factions.ts, regions.ts, scenarios.ts
- src/scripts/runBatchSimulation.ts
- 测试：events.test.ts, simulation.test.ts, batch-simulation.test.ts, scenario.test.ts

**检查项：**
1. [ ] eventEngine.ts 事件条件检测+选项应用
2. [ ] events.ts 5个MVP事件定义完整
3. [ ] simulation.ts 月度推演编排（8步骤）
4. [ ] scoring.ts 势力评分
5. [ ] factions.ts 6势力数据完整
6. [ ] regions.ts 13区域数据完整
7. [ ] scenarios.ts 场景工厂
8. [ ] runBatchSimulation.ts CLI可执行
9. [ ] 运行相关测试全通过
10. [ ] npm run batch -- 5 12 快速验证

---

## Phase 4: 状态管理与UI组件

**检查文件：**
- src/save/saveManager.ts, src/store/gameStore.ts
- src/map/mapConfig.ts
- src/ui/common/StatBadge.tsx
- src/ui/layout/TopBar.tsx
- src/ui/panels/DecisionPanel.tsx, RegionPanel.tsx, LogPanel.tsx
- src/ui/map/GameMap.tsx
- src/ui/dialogs/EventDialog.tsx, StartDialog.tsx
- src/app/App.tsx, App.css
- 测试：save-store.test.ts, app-ui.test.tsx, map.test.tsx, dialogs.test.tsx

**检查项：**
1. [ ] saveManager.ts IndexedDB 接口正确
2. [ ] gameStore.ts Zustand actions 完整
3. [ ] mapConfig.ts 13区域坐标定义
4. [ ] GameMap.tsx SVG渲染+点击交互
5. [ ] DecisionPanel.tsx 决策控件
6. [ ] RegionPanel.tsx 区域详情
7. [ ] LogPanel.tsx 月度日志
8. [ ] TopBar.tsx 顶部信息栏
9. [ ] EventDialog.tsx 事件弹窗
10. [ ] StartDialog.tsx 开始界面
11. [ ] App.tsx 组件集成（无遗漏）
12. [ ] 运行UI测试全通过
13. [ ] npm run build 通过

---

## Phase 5: 全流程集成验收

**检查项：**
1. [ ] npm test 全量30测试通过
2. [ ] npm run build 生产构建成功
3. [ ] npm run batch -- 100 240 无错误
4. [ ] npm run dev 启动正常
5. [ ] curl 验证 HTTP 200 + vite 转换
6. [ ] 端到端场景验证：大明开局→选目标→推进12月→处理事件→查看区域
7. [ ] 跨模块类型一致性检查
8. [ ] 最终提交

---

## 发现与修复记录

| # | Phase | 文件 | 问题 | 修复 |
|---|---|---|---|---|
| - | - | - | - | - |