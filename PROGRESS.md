# 万历：山河崩塌 — 开发进度

> 本文档是接手 agent 的路标：项目走到哪了、怎么验证、下一步干啥、哪里有坑。
> 对应详细设计：`docs/v2-optimization-spec.md`（SPEC，含 S1–S4 战报）+ `docs/v2-implementation-plan.md`（PLAN）。
> 每次阶段完成后同步更新本文档 + SPEC 战报。

---

## 0. 项目概况

- **MING-WAR**：《万历：山河崩塌》——晚明大战略游戏，目标是模拟 **维多利亚3 (Victoria 3)** 的社会经济闭环。
- **技术栈**：React 19 + TypeScript + Vite 6 + Zustand + Vitest 3。月度模拟核心是纯函数 `simulateMonth`（`structuredClone` 输入、固定随机种子，确定性可复现）。
- **核心范式**：单一驱动闭环——`pop 劳动 → 产业生产 → 市场供需/价格 → pop 购买力/生活水平 → 财富分化 → 政治力量 → 政治运动/法律改革 → modifier → 反作用于生产`。每一环都建了零件，工作重心是**把环与环的齿轮咬合**，而非堆孤岛系统。

---

## 1. 当前状态（v0.3.0）

**维多利亚3 闭环进度：3 / 5 已接通**

| 闭环 | 阶段 | 状态 |
|---|---|---|
| 后果环（modifier 激活 + 账本驱动财政） | S1 | ✅ 完成 |
| 经济环（市场—人口—生产整合） | S2 | ✅ 完成 |
| 社会政治环（利益集团政治力量） | S3 | ✅ 完成 |
| 制度环（法律与改革系统） | S4 | ✅ 完成 |
| 外交战争环（外交博弈 + 战线战争） | S5 | ✅ 完成 |
| 内容收口（历史局势 + 完整周期） | S6 | ⬜ 下一步（里程碑） |

最新提交：`feat(diplomacy): S5 diplomacy + front-line war + peace talks`（外交战争环）

---

## 2. 已完成阶段

### S1　修正系统激活 + 账本驱动（后果环）
- `queryModifier` / `collectModifiers`：按 global→faction→region 级联聚合 modifier。
- modifier effectKey 词表接入各计算点：`tax-mult`/`grain-output-mult`（economy）、`maintenance-mult`（economy）、`control-flat`（control）、`army-org-mult`（warfare）。
- **⚠️ 注意**：`corruption-flat` / `stability-flat` 在 `modifiers.ts` 注释里标注"接 control.ts"，但 **S1b 实际未接入**（control.ts 只接了 control-flat）。S4 把它们归入"一次性 instant 施加"绕开此问题。若 S5+ 需要它们走月度 modifier，须先在 control.ts 补接入点。
- `applyLedgerToState` 是财政唯一真相源：所有收支走 ledger entry，月末统一结算，散点加减清零。不变量：`Δtreasury === 账本净额`。

### S2　市场—人口—生产整合（经济环）
- 统一粮食流：农业+产业产出 → `market.supply`；pop 需求篮子 → `market.demand`；价格基于真实供需。
- pop `needsSatisfaction` = 购买力（税后收入 / 篮子市价）；`wealth` 月累积；饥荒死亡仍由 `grainPerCapita` 物理粮食驱动（双链并行）。
- 产业利润按 ownership 流向对应 pop（gentry←farmland, merchant←marketTown, soldier←militaryTown），财富分化为 S3 政治力量铺路。

### S3　利益集团政治力量（社会政治环）
- clique `strength` 来自 pop wealth 聚合（`CLIQUE_POP_AFFINITY` + `computeFactionCliqueStrengthFromPops`），取代旧的地区属性映射（后者保留作 fallback）。
- `approval`（0-100，与 `support` 正交）：`50 + clamp(sat−50,−30,+20) + 政策契合×3 − tax-mult×50`。生活水平封顶确保加税/饥荒能压到运动阈值。
- 政治运动（`advancePoliticalMovements`）：强(strength≥30)+不满(approval≤35)集团推动诉求（减税/开海/自治/索饷），结算施加临时(12月)modifier；cooldown 防失控。
- **设计特性**：运动是危机放大器——无危机时几乎无感，战争/灾荒压低生活水平时才温和显现。

### S4　法律与改革系统（制度环）
- **法律库** `src/data/laws.ts`：10 条明末法律，覆盖 SPEC §11 六大类（税制/土地/军制/海贸/地方治理/财政权力）。每条 `tags` 与 clique `preferredLaws`/`opposedLaws` 对接。
- **改革流程** `src/core/reform.ts`：
  - `computeReformSupport`：tags × clique 偏好 × strength → 支持/反对力量。
  - `computeReformMomentum`：`2 + 行政×0.08 + 合法性×0.03 + 支持×0.18 − 反对×0.28 − 腐败×0.04 − 战争疲劳×0.04 − 活跃战争×1.5 + (控制度−50)×0.03`，钳 [−6,+8]。**反对权重>支持权重**——改革比推动难。
  - `advanceReforms`：progress≥100 落实 / ≤0 且持续≥3 月失败（损合法性）。
  - `enactLaw`：落实写**永久** faction-scope modifier（接通 S1）+ 受益集团 approval/support 升、受损集团 approval 暴跌 → 触发 S3c 政治运动（闭环）。
  - `autoProposeReforms`：`domesticFocus → 倾向法律`（玩家与 AI 同规则）；momentum 预检过滤注定失败的改革；**tribal/rebel 不自动改革**。
- **effect 三分法**（enactLaw 分流）：
  - modifier-effect keys（tax-mult/grain-output-mult/maintenance-mult/control-flat/army-org-mult）→ 永久 modifier
  - faction-instant（centralization-flat/legitimacy-flat/corruption-flat）→ 一次性施加到 faction 字段
  - region-instant（stability-flat）→ 遍历控制区一次性施加
- 改革目前由 `domesticFocus` 自动驱动；"玩家手选某条法律"的 UI 留待后续。

### S5　外交博弈与持续战争（外交战争环）
- **外交关系层** `src/core/diplomacy.ts`：`DiplomaticRelation`（relation/trust/threat/rivalry/truceMonths/treaties/obligations）+ 5 类条约（alliance/tribute/trade/vassal/truce）。`GameState.diplomacy` 双边表，1573 开局初始化历史关系（朝鲜朝贡大明、土默特俺答封贡互市+停战 60 月、建州敌对、日本威胁朝鲜）。`advanceDiplomacy` 月度演变（停战倒计时/威胁重算/关系趋近）+ 条约财政后果走账本（互市关税 income-tariff、朝贡白银守恒转移），**确定性不消费 random**。
- **战线消耗模型** `warfare.ts`：`FrontState`（warSupport/supply）嵌入 WarState；`advanceWar` 改返回 `WarAdvanceResult`——每月按兵力×组织×地形推进 progress + **持续消耗**（军队 attrition、战地军费/军粮走 ledger、战疲累积、进攻方补给衰减），取代单月决胜。**确定性**。
- **修军队归零**（§5.2 核心）：征募从单一 `0.005 + warExhaustion<40 硬门槛` 改为分级 `0.012/0.006/0.003`，长期战争仍低速补员。seed7 10 年军队从 S4 的 11 回升到 **846,274**。
- **和平谈判** `src/core/peace.ts`：战争支持度（战疲/财政/占领/合法性）→ 触发和谈（支持度≤25 求和 / progress≥95 完胜 / 48 月双方疲惫媾和）→ 结算（割地/赔款/朝贡/停战 写回 diplomacy）。不止"占领即吞并"。
- **外交约束开战**（S5d）：`getValidMilitaryTargets` 过滤停战/盟友地区（玩家与 AI 同规则），停战制造备战窗口、同盟阻止互攻。
- **闭环达成**：战争咬合财政（战地军费/赔款/朝贡走账本）、补给（战线消耗）、动员（征募恢复）、外交（停战/盟友约束开战）、国内政治（战争支持度）。军费/补给/战疲能迫使停战，AI 受外交约束理性备战。

---

## 3. 验收红线与命令

每个子步骤 / 阶段必须全绿：

```bash
npm run typecheck      # tsc --noEmit，必须零错误
npm test               # vitest run，当前 323 测试
npm run build          # tsc -b && vite build
npm run map:validate   # 校验地图，31 地区
npm run batch          # 100×240 批量模拟，errorRuns 必须为 0
npm run diagnose       # 单局 seed7 月度轨迹 + popGroups 守恒审计
```

**当前基线指标（S4 完成时，供回归对比）**：

| 指标 | S5 值 | S4 值 | 对比 |
|---|---|---|---|
| 测试数 | 351 | 323 | +28（diplomacy 14 / peace 10 / warfare S5b 4） |
| batch errorRuns | 0 | 0 | = |
| batch 大明存活率 | 1.0 | 0.82 | **回升**（军队归零修复）|
| batch 平均控制区 | 25.08 | 14.49 | 回升（征募恢复 + 和谈割地）|
| batch 粮价 | 3.42 | 4.13 | 略降 |
| diagnose seed7（10年）| active，人口 −9.0%，**军队 846k** | active，−9.2%，军队 11 | 军队归零彻底修复 |

---

## 4. 下一步：S6 历史局势与完整周期（内容收口）

**目标**：把孤立事件升级为系统驱动的长期局势，补齐 1573–1662 主线，多结局可重复出现。

- `SituationState`（stage/progress/variables/outcomes）承载张居正改革、三大征、建州统一、辽东危机、陕西流民、南明分裂等。
- 局势变量由 S1–S5 的系统状态推动（如建州统一由 jianzhou 控制区扩张+军事力量触发；辽东危机由 ming-jianzhou 战争+大明财政/战疲触发）；事件作为局势的叙事表现。
- 当前 `endDate=1621-12`（万历末），S6 延伸到 1662（康熙元年），目标多结局（大明中兴 / 南明偏安 / 满清入关 / 流民建国等）。
- 依赖：S1–S5 全部已就绪。**入口**：新建 `src/core/situation.ts` + `src/data/situations.ts`；`simulation.ts` 月度推进局势；`eventEngine.ts` 局势触发叙事事件。

**验收**：历史局势由系统条件推动；完整周期可运行；多种结局在批量模拟中出现。

**S5 后平衡备注**：S5 修复军队归零后大明存活 1.0、控制区 25/31，偏稳健。S6 引入建州统一 / 辽东危机 / 南明分裂等局势后，会系统性引入大明中后期压力，自然平衡挑战性——无需在 S5 人工削弱征募。

---

## 5. ⚠️ 已知坑与设计约束（接手必读）

1. **确定性模拟的蝴蝶效应**：`simulateMonth` 用固定种子，`applyResourceCrises` 的 `random.next()` 调用次数依赖当月 crisis faction 数。任何**持久**状态改变（如 S4 改革落实改 corruption → 税收 → treasury → crisis 判定）都会扰动后续整个 random 序列，让不同 seed 的命运重新分配。**这是特性不是 bug**——评估改动时看 batch 整体指标，别被单个 seed 的剧烈变化误导。对照实验方法：临时注释新功能跑 batch 对比。

2. **军队归零脆弱性（S5 已修）**：~~长期多线战争里军队会耗到个位数（seed7 10 年军队 11）~~。S5 引入战线消耗模型 + 征募分级恢复（`0.012/0.006/0.003`，移除 `warExhaustion<40` 硬门槛），seed7 10 年军队回升到 846k。副作用是大明偏稳健（存活 1.0、控制区 25/31），待 S6 历史局势引入中后期压力自然平衡。

3. **modifier effectKey 接入不一致**：见 §2 S1 的警告——`corruption-flat`/`stability-flat` 注释标了接入但实际没接。新增 modifier 效果前先 grep 确认 effectKey 有计算点消费，否则就是死数据。

4. **月度流水线顺序**（`simulation.ts`）：expire modifiers → region 循环（经济/控制/叛乱/市场/人口/账本）→ faction 循环（维护费 / **征募 S5b 分级**）→ **`advanceDiplomacy`（S5a 外交演变 + 条约财政）** → `applyResourceCrises` → `eliminateDefeatedFactions` → `updateFactionCliques` → `autoProposeReforms` + `advanceReforms`（S4）→ `advancePoliticalMovements`（S3c）→ 战斗（**S5d 外交约束开战**）→ 事件 → **`advanceWar` 战线消耗 + warSupport（S5b）→ `checkPeace` / `resolvePeace` 和谈（S5c）** → 账本归档 → 贸易/价格。S4 改革落实放在政治运动之前；S5 外交/战线/和谈全链路确定性，不消费 random（random 仅在 resolveBattle 首月遭遇战）。

5. **玩家与 AI 同规则**：所有系统对玩家 faction 和 AI faction 一视同仁（改革、运动、经济）。新增机制不要写 player-only 分支。

---

## 6. 核心文件地图

```
src/core/
  simulation.ts      月度流水线主函数 simulateMonth（齿轮咬合的编排者）
  types.ts           全部核心类型（GameState / FactionState / Modifier / Law / Reform...）
  economy.ts         地区经济 + 势力维护费（接 tax-mult/grain-output-mult/maintenance-mult）
  control.ts         地区控制更新（接 control-flat；⚠️ 未接 corruption/stability-flat）
  warfare.ts         战斗 + 战争推进（接 army-org-mult）—— S5 主战场
  market.ts          产业生产 / 市场供需 / 贸易 / 价格 / pop 消费
  populationGroups.ts 8 类 pop 的就业/需求/饥荒/流民/财富
  clique.ts          集团 strength（pop wealth 聚合）+ approval + administration
  politics.ts        S3c 政治运动
  reform.ts          S4 法律改革（propose/advance/enact/autoPropose）
  modifiers.ts       modifier 聚合 + queryModifier + collectModifiers（级联）
  ledger.ts          财政账本（唯一真相源）+ applyLedgerToState
  eventEngine.ts     事件条件/效果/触发
  ai.ts              AI 月度决策
  invariants.ts      状态不变量校验（NaN/负值/价格爆炸）
src/data/
  laws.ts            S4 法律库（10 条）+ effect key 分类
  cliques.ts         4 集团定义（preferredLaws/opposedLaws/policyAffinities）
  factions.ts        势力模板（大明/建州/土默特/朝鲜/日本...）
  scenarios.ts       createMvpScenario 入口
  events.ts          历史事件库
  regions.ts         31 地区模板
src/scripts/
  runBatchSimulation.ts   batch 验收
  diagnoseSimulation.ts   单局诊断
  validateMapRegions.ts   地图校验
src/tests/           每个核心模块对应测试（reform/clique/politics/ledger/invariants...）
docs/
  v2-optimization-spec.md     SPEC（含 S1–S4 完成战报 §8/§9/§10）
  v2-implementation-plan.md   PLAN（S1–S4 详细子步骤 + S5–S6 里程碑）
```

---

## 7. 提交历史（最近）

- `feat(diplomacy): S5 diplomacy + front-line war + peace talks`（外交战争环，本次）
- `fa69b64` feat(reform): S4 law & reform system closing the institutional loop
- `128ff48` feat(politics): S3 interest-group political power from pop wealth
- `b803dfd` feat(economy): ledger-driven finance + unified market-pop loop (S1c+S2)
- `05f0ba3` fix(sim): stabilize economy/pop and activate inert modifier system
- `46f9c20` feat(batch): include P1 ledger entries, P2 pop metrics, P3 market metrics
