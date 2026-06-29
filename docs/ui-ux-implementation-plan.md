# MING-WAR UI/UX 全量建设计划

> 本计划是 `docs/ui-ux-optimization-spec.md` 的执行版。
> 每完成一个 Phase 就做一次 Review(测试 + 视觉验证),通过才进下一个 Phase。

## 项目基线(2026-06-29 启动)

- **分支**:`main`(已同步 `origin/main`)
- **远程**:https://github.com/anjingdtl/MING-WAR.git
- **测试基线**:16 测试文件 / 63 用例,全部通过
- **提交规范**(沿用现有):
  - `feat:` 新功能
  - `fix:` 修复
  - `refactor:` 重构
  - `test:` 测试
  - `docs:` 文档
  - `chore:` 构建/工具
  - `style:` 纯视觉/CSS
- **代码约束**:
  - `core/` 目录**绝对不动**(玩法层)
  - UI 改动仅限 `ui/`、`app/`、`assets/`
  - 通过 `store/gameStore.ts` 作为唯一接口
  - TypeScript strict 通过
  - 全部组件有 vitest + Testing Library 测试

---

## Phase 1: 视觉系统基础(1-2 周)

**目标**:建立统一的设计语言(配色/字体/装饰),抽出基础组件库

### 子任务
- [ ] **1.1 配色系统**:`app/theme.css` 集中所有 CSS 变量(明式官造色),`App.css` 改用变量
- [ ] **1.2 字体系统**:`index.html` 引入霞鹜文楷(LXGW WenKai)CDN,定义字体变量
- [ ] **1.3 装饰元素**:`ui/common/decor/` 下做 3 个 SVG 组件
  - `RuyiCorner.tsx`(如意云头角饰)
  - `GoldDivider.tsx`(描金分隔线)
  - `SealStamp.tsx`(印章)
- [ ] **1.4 基础组件抽取**:`ui/common/`
  - 重构 `StatBadge.tsx`,加 trend / tone / threshold / tooltip props
  - 新建 `Button.tsx`,五变体(primary/secondary/tertiary/danger/gold)
  - 新建 `Panel.tsx`,三类型(drawer/modal/popover)+ 装饰
- [ ] **1.5 测试**:`ui/common/*.test.tsx` 每个组件基础测试
- [ ] **1.6 替换现有应用**:把新 StatBadge 应用到 TopBar,验证视觉统一

### Review 标准
- [ ] `npm run test` 全过(63 → ≥ 70)
- [ ] `npm run build` 成功
- [ ] 视觉抽检:TopBar / LogPanel / EventDialog 三个屏色彩风格一致
- [ ] 字体在所有面板标题正常显示
- [ ] 装饰元素不破坏响应式

### 提交
- `style(theme): introduce Ming-dynasty color palette and font tokens`
- `feat(ui): extract Button, Panel, StatBadge v2 into common/`
- `feat(ui): add RuyiCorner, GoldDivider, SealStamp SVG decor`
- `test(ui): add tests for common components`

---

## Phase 2: 布局重构(2-3 周)

**目标**:把挤成一坨的布局理顺:Ticker Bar / 侧滑详情面板 / 邸报样式

### 子任务
- [ ] **2.1 Ticker Bar**:新建 `ui/layout/TickerBar.tsx`,替换 TopBar
  - 左:朝代纪年 + 当前月
  - 中:5 数值(国库/粮/军/疲劳/民望)用新 StatBadge v2,带趋势箭头
  - 右:危机指示器 + 推进按钮(主行动)
- [ ] **2.2 侧滑详情面板**:新建 `ui/layout/SidePanel.tsx`
  - 380px 宽抽屉,右滑入
  - 5 个 Tabs:区域 / 决策 / 朝堂 / 事件 / 大事记
  - 选中区域时默认开"区域" Tab
- [ ] **2.3 拆离 GameMap 内嵌决策**:`GameMap.tsx` 只管地图渲染
  - `RegionPanel` 升级(增加详情字段)
  - `DecisionPanel` 升级(增加预测展示)
  - `CliqueBar` 升级(增加更多派系信息)
  - 都接入 SidePanel
- [ ] **2.4 邸报样式**:`LogPanel.tsx` 视觉重做
  - 老旧宣纸 SVG 背景
  - 雕版印刷字体
  - 头条 / 二条 / 短讯 分级
  - 内容生成逻辑可保留,只换视觉
- [ ] **2.5 测试**:为新组件写测试

### Review 标准
- [ ] 测试全过(70 → ≥ 85)
- [ ] 地图上不再有右下角挤的决策面板
- [ ] 侧滑面板开/关流畅,不影响地图
- [ ] 移动端(640px / 980px)布局不破
- [ ] 邸报风格统一(老旧宣纸)

### 提交
- `refactor(ui): introduce TickerBar replacing TopBar`
- `feat(ui): add SidePanel drawer with 5-tab detail views`
- `refactor(map): extract decision controls out of GameMap`
- `style(log): redesign LogPanel as Ming dynasty gazette`
- `test(ui): add tests for TickerBar, SidePanel, LogPanel`

---

## Phase 3: Lens 系统(2-3 周)— 核心范式

**目标**:5 Lens 全部跑通,色板 + 区域 hover 卡 + 切换过渡

### 子任务
- [ ] **3.1 Lens 数据层**:`ui/lens/` 新建
  - `lensDefinitions.ts` —— 5 个 Lens 的元数据
  - `lensColorScales.ts` —— 5 个 Lens 的色板
  - `lensHoverCards.tsx` —— 5 套 hover 卡模板
- [ ] **3.2 Lens 切换栏 UI**:`ui/layout/LensBar.tsx`
  - 左侧垂直栏,5 个按钮(势力/经济/军事/民生/朝堂)
  - 数字 1-5 快捷键
- [ ] **3.3 GameMap 集成**:
  - Lens 切换时地图色板平滑过渡(0.4s)
  - 区域 hover 浮动卡(200ms 出现)
  - Alt+点击区域 = 居中聚焦
- [ ] **3.4 区域 hover 卡**:5 个 Lens 各自的内容
- [ ] **3.5 测试**:5 个 Lens 的渲染快照测试

### Review 标准
- [ ] 测试全过(85 → ≥ 100)
- [ ] 5 个 Lens 都能切换,色板明显不同
- [ ] hover 区域能看到对应 Lens 的关键信息
- [ ] 快捷键 1-5 工作
- [ ] 切换过渡流畅(60fps 不掉)

### 提交
- `feat(lens): introduce 5-Lens information architecture`
- `feat(lens): add LensBar with keyboard shortcuts`
- `feat(map): region hover info cards per lens`
- `feat(map): smooth color palette transition on lens switch`
- `test(lens): snapshot tests for all 5 lens variants`

---

## Phase 4: Tooltip 与预测(1-2 周)

**目标**:扩展现有 `FocusTooltip` 到所有决策,数字都能 hover 出意义

### 子任务
- [ ] **4.1 通用 Tooltip 组件**:`ui/common/Tooltip.tsx`
  - 三种:`info` / `predict` / `detail`
  - 统一外观(月白底 + 驼色边 + 描金)
  - 出现延时 300ms
- [ ] **4.2 StatBadge v2 hover 明细**:接 Tooltip 系统
- [ ] **4.3 决策预测系统**:
  - 军事决策预测(军略目标 → 胜率预估)
  - 经济决策预测(内政重点 → 下月收支预估)
  - 派系预测已部分实现(扩展到所有政策)
- [ ] **4.4 应用到所有数字**:TopBar 数值、区域字段、派系力量都能 hover

### Review 标准
- [ ] 测试全过(100 → ≥ 115)
- [ ] 任何数字/标签 hover 都有 tooltip
- [ ] 决策前能看到后果预估
- [ ] tooltip 风格统一

### 提交
- `feat(tooltip): unified Tooltip system with 3 variants`
- `feat(predict): decision preview for military and economic choices`
- `refactor(stat): wire StatBadge v2 into Tooltip system`
- `test(tooltip): add tooltip and prediction tests`

---

## Phase 5: 邸报/大事记/新手引导(1-2 周)

**目标**:把"游戏"做成"读史"

### 子任务
- [ ] **5.1 邸报内容生成器**:`core/journal.ts`(只在 ui 层加适配,不动 core 数值)
  - MonthlyReport → 邸报条目分级
  - 自动加"距 X 事件还有 N 月"倒计时
- [ ] **5.2 大事记时间线**:`ui/panels/ChroniclePanel.tsx`
  - 时间线形式
  - 关键事件可点击
  - 玩家行动入大事记
- [ ] **5.3 新手引导**:`ui/dialogs/TutorialDialog.tsx`
  - 5 折奏折引导
  - 老旧宣纸 + 雕版字风格
  - 渐进解锁
- [ ] **5.4 引导状态管理**:`store/tutorialStore.ts`(独立,不污染 gameStore)
- [ ] **5.5 测试**

### Review 标准
- [ ] 测试全过(115 → ≥ 130)
- [ ] 邸报头条/二条分级生效
- [ ] 大事记显示历史事件
- [ ] 首次启动走完 5 折引导
- [ ] 引导可"重看奏折"

### 提交
- `feat(journal): gazette content generator with severity tiers`
- `feat(chronicle): historical event timeline panel`
- `feat(tutorial): 5-scroll onboarding dialog with period styles`
- `test(journal): gazette and tutorial tests`

---

## Phase 6: 动效/快捷键/可访问性(1 周)

**目标**:打磨体验

### 子任务
- [ ] **6.1 动效系统**:`ui/common/animations.css` + hooks
  - 数字滚动(数值变化)
  - 面板滑入(出现)
  - 危机脉冲(0.8s 周期)
  - 印章盖章(0.3s 缩放+旋转)
- [ ] **6.2 快捷键系统**:`ui/hooks/useHotkeys.ts`
  - Space 推进、1-5 Lens、Esc 关闭、Tab 循环、Alt+点击聚焦、F 切侧滑、? 帮助
- [ ] **6.3 可访问性**:
  - aria-label / role 补全
  - 对比度验证(WCAG AA)
  - 色盲模式(`ui/a11y/colorblind.css`)
  - 字号可调
- [ ] **6.4 性能优化**:
  - 装饰元素不阻塞主线程
  - 地图渲染保持 60fps
  - 大量数据时面板虚拟化
- [ ] **6.5 测试扩充**:为新功能补齐

### Review 标准
- [ ] 测试全过(130 → ≥ 150)
- [ ] 数字变化是滚动而非突变
- [ ] 全部快捷键可用
- [ ] 屏幕阅读器能读出关键元素
- [ ] 色盲模式下区分度足够
- [ ] 60fps 保持

### 提交
- `feat(motion): animation system with reduced-motion support`
- `feat(hotkeys): keyboard shortcut system`
- `feat(a11y): accessibility enhancements and colorblind mode`
- `test(a11y): add accessibility and hotkey tests`

---

## 全量回归(终局)

- [ ] `npm run test` 全部通过(目标 ≥ 150 用例)
- [ ] `npm run build` 无错
- [ ] 视觉走查:对照 spec 的"目标"截图清单,逐项过
- [ ] 性能基线:主屏交互 < 16ms,Lens 切换 < 400ms
- [ ] 移动端:640/768/1024/1280 全部正常
- [ ] 旧测试全部仍通过(无回归)

## 最终交付

- [ ] 修复所有回归
- [ ] 更新 `PROGRESS.md` 记录这一轮的工作
- [ ] `git add -A` + `git commit` 一次性提交(或多笔按 phase 提交)
- [ ] `git push origin main`

---

## 风险与回退

| 风险 | 回退方案 |
|---|---|
| Phase 3 Lens 系统设计过重,实现困难 | 简化为 3 个 Lens(势力/经济/军事) |
| 装饰 SVG 性能不达标 | 装饰降级为简单 CSS 边框 |
| 新手引导拦截太死 | 加"跳过"按钮 |
| 侧滑面板在小屏放不下 | 移动端改为底部弹出(Bottom Sheet) |

## 进度跟踪

每次进入下一个 Phase 前:
1. 在本文件顶部更新 `## 当前进度`
2. 在 `PROGRESS.md` 同步
3. Review 通过才推进

