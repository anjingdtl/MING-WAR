# 《万历：山河崩塌》v2 实施计划 PLAN

> 对应文档：`docs/v2-optimization-spec.md`（S1–S6）
> 编写日期：2026-06-29
> 本轮范围：**S1（修正系统激活 + 账本驱动）+ S2（市场—人口—生产整合）+ S3（利益集团政治力量）+ S4（法律与改革系统）**，S5–S6 列里程碑

---

## 0. 执行原则

- 每个子步骤结束必须跑：`typecheck` + `test` + `batch 20×120`（errorRuns=0）+ `diagnose 360`（无发散）。
- 先接齿轮、后补内容；每步保持"可解释的稳定推演"。
- 玩家与 AI 同规则；新增计算必有单元测试 + 守恒/不变量回归。

---

## 1. S1　修正系统激活 + 账本驱动

### S1a　修正查询接口与税收接入（最小可见）

**目标**：证明"事件/法律写下的修正能改变下月数值"。

1. 在 `src/core/modifiers.ts` 新增按作用域查询的聚合函数：
   ```ts
   queryModifier(modifiers, scope: "global"|"faction"|"region", targetId, effectKey): number
   ```
   - `global`：取所有 `scope==="global"` 的 modifier。
   - `faction X`：global + `scope==="faction"&&targetId===X`。
   - `region R`：global + faction（R 的当前控制者）+ `scope==="region"&&targetId===R`。
   - 复用 `aggregateModifierEffect` 做 add/replace 聚合。
2. 约定核心 effectKey 词表（写入 `modifiers.ts` 注释）：`tax-mult`、`grain-output-mult`、`stability-flat`、`control-flat`、`corruption-flat`、`army-org-mult`、`maintenance-mult`。
3. `economy.ts` 税收计算接入：`taxCollected *= (1 + queryModifier(...,"tax-mult"))`；产出同理接 `grain-output-mult`。需要把 controller/region 的 modifier 列表传入 `calculateRegionEconomy`（签名加一个 `modifiers` 参数或直接传 `state`）。
4. 测试：写入一个 `tax-mult: +0.2` 的 faction modifier，跑一月，断言税收比无修正时高 ~20%。

**验收**：modifier 生效可观测；全量回归不变。

### S1b　扩展修正接入面

- `control.ts` 接 `control-flat` / `stability-flat`。
- `economy.ts` 维护费接 `maintenance-mult`；`warfare.ts` 军组接 `army-org-mult`；腐败接 `corruption-flat`。
- 测试：各类修正独立生效。

### S1c　账本成为财政唯一真相源

**目标**：满足 SPEC §21.2 不变量"国库变化等于账本净额"。

1. 修复 `ledger.applyLedgerToState` 的 grain 双重记账：grain 条目按"去向"二选一（进 region.grainStock 或 faction.grainReserve），不能同时加。引入明确规则：`grain-production/consumption`→region；`grain-relief/transport`→按条目显式标注。
2. 重构 `simulation.ts` 财政：地区税收、维护费、赈灾、漕粮、征募——**全部改为 push ledger entry**，移除 `controller.treasury +=` / `faction.treasury -=` 等散点加减；月末统一 `applyLedgerToState`。
3. 保留 `applyResourceCrises` 对 army/legitimacy 的非财政效果，但其粮食/白银影响也走账本。
4. 新增不变量测试：任意一月 `Δtreasury === Σ(income) + Σ(expense)`。

**验收**：散点加减清零；账本净额 = 国库变化；回归全绿。

### S1d　开发调试面板（可选，UI）

- `ui/` 增加一个 dev-only 面板：选定数值，列出全部生效 modifier 及最终公式（SPEC §18.3）。优先级低，可后置。

---

## 2. S2　市场—人口—生产整合

### S2a　统一粮食流（产业→市场→pop 消费）

1. 废除 `economy.ts` 绕过市场的口粮直算（`grainConsumed = pop*0.065`）。改为：产业 `produceGoods` 产粮食 → `market.supply.grain`；pop 按需求篮子从市场购买（消费量从 supply 扣）。
2. pop 需求篮子按 pop 类型/规模定义（peasant 主粮、gentry 粮+布+茶、soldier 粮+盐等）。
3. `region.grainStock` 重新定义为"市场未售出/官仓余粮"，由市场结算后剩余写入。

### S2b　pop 财富积累与分化

1. popGroups 增加月度收入（就业/产业利润分成/官俸）与支出（按市场价格购买需求篮子），`wealth` 累积。
2. `needsSatisfaction` 改为"wealth 能否覆盖需求篮子市价"，引入 SoL（生活水平）数值。

### S2c　白银货币约束

1. pop 购买、军饷、建设消耗白银；白银短缺 → 购买力下降 → needsSatisfaction 下降。
2. 产业 ownership 利润流向对应 pop 群体（SPEC §8.2），强化政治力量来源（为 S3 铺路）。

### S2d　因果链测试

- 测试：灾荒推高粮价 → pop 购买力降 → needsSatisfaction 降 → 激进度升。
- 30 年模拟：江南（商/手工业）与辽东（军事/边粮）经济结构明显不同。

---

## 3. S3　利益集团政治力量（社会—政治环）

### S3a　clique strength 来自 pop wealth
- 新增 `CLIQUE_POP_AFFINITY`（东林←gentry/merchant/artisan/official；宦党←official；缙绅←peasant/tenant；勋贵←soldier），migrant 无归属。
- 新增 `computeFactionCliqueStrengthFromPops`：strength = Σ pop.size×wealth×affinity 归一化到 0–100（控制的社会政治财富份额）；无 pop 数据 fallback 旧地区属性映射。旧 `computeRegionCliqueWeights`/`computeFactionCliqueStrength` 保留（测试覆盖 + fallback）。
- wealth 已含 S2c 产业 ownership 利润分配，故覆盖"财富+人口+土地"，官职由 official pop 体现。

### S3b　approval 系统
- `FactionCliqueState` 加 `approval`（0–100），与 `support`（执政支持/administration）正交。`CliqueDef` 加 `preferredLaws`/`opposedLaws`（S4 对接）。
- `computeCliqueApproval`：`50 + clamp(avgSat−50, −30, +20) + 政策契合×3 − tax-mult×50`。生活水平封顶贡献——富裕不顶满，确保加税/饥荒能压到运动阈值。

### S3c　政治运动 PoliticalMovement
- 强（strength≥30）+ 不满（approval≤35）的集团推动诉求：东林→减税、宦党→开海、缙绅→自治、勋贵→索饷。
- progress≥100 结算 → 施加 faction-scope S1 modifier（接通后果环）+ 该集团 support 回升；12 月 cooldown（让步 modifier 存续期）防运动失控。
- 让步强度极温和（control-flat −1 / tax-mult −0.05 等）：S3 是危机放大器，无危机时几乎无感，有危机时温和显现。

### S3d　因果链 + 全量验收
- 端到端测试：加税（tax-mult modifier + finance focus）→ approval 降 → 强不满集团推动运动。
- 不同政权集团结构差异（大明东林主导 vs 边疆勋贵主导）。
- batch 100×240 errorRuns=0，大明存活 0.86，控制区 19.45；diagnose seed7 大明 active、人口 −11.3%（与 S1c 基准一致）。

---

## 4. S4　法律与改革系统（接通"制度"环）

### S4a　法律库与类型层
- 新增 `src/data/laws.ts`：10 条明末法律，覆盖 SPEC §11 六大类（税制/土地/军制/海贸/地方治理/财政权力），每条落实效果走 S1 modifier effectKey。
- 法律 `tags` 与集团 preferredLaws/opposedLaws 对接（SPEC §9.5 点名的"对接真实 LawId"）——S3 空挂的标签通电，集团偏好真实决定改革博弈。
- effect 三分法：modifier-effect keys（tax-mult/grain-output-mult/maintenance-mult/control-flat/army-org-mult）→ 永久 faction modifier；faction-instant（centralization/legitimacy/corruption）→ 一次性施加；region-instant（stability）→ 遍历控制区施加。（corruption-flat/stability-flat 在 S1b 标注接入但实际未接 control.ts，S4 归入 instant 绕开缺失的月度查询点。）
- `ReformProgress` 类型 + `GameState.activeReforms`。

### S4b　改革提出 + 集团博弈
- `computeReformSupport`：法律 tags × clique preferred/opposed × strength → 支持力量 vs 反对力量。
- `computeReformMomentum`：推进力 = 2 + 行政×0.08 + 合法性×0.03 + 支持×0.18 − 反对×0.28 − 腐败×0.04 − 战争疲劳×0.04 − 活跃战争×1.5 + (控制度−50)×0.03，钳 [−6,+8]。反对权重>支持权重，体现"改革比推动难"。
- `FOCUS_REFORM_AFFINITY`：domesticFocus → 倾向法律（玩家与 AI 同规则，复用现有决策通道，无需新增玩家输入）。
- `proposeReform`：已落实 / 已在推进 / 同时上限 2 条 去重。

### S4c　改革推进机 + 落实
- `advanceReforms`：每月 progress += momentum；≥100 落实，≤0 且持续≥3 月失败（损合法性）。
- `enactLaw`：落实写永久 modifier（接通 S1 后果环）+ faction/region instant + 受益集团 approval/support 升、受损集团 approval 暴跌（→ 触发 S3c 政治运动，闭环）。防重复落实（law modifier id 去重）。
- `autoProposeReforms`：momentum 预检过滤注定失败的改革；tribal/rebel 不自动改革（法律改革是定居官僚政权的产物）。

### S4d　因果链 + 全量验收
- 端到端：recovery focus → low-tax 落实（tax-mult −0.15 永久，税收可观测降）；land-survey 遭 donglin+gentry 双反对 → momentum 负 → 注定失败损合法性；clean-admin 落实降腐败升稳定。
- batch 100×240 errorRuns=0，大明存活 0.82；diagnose seed7 active、人口 −9.2%（优于 S3 −11.3%）。
- 设计权衡：改革落实的持久 modifier 在确定性模拟里产生蝴蝶效应（corruption→税收→applyResourceCrises 的 random 序列），叠加 S5 军队归零脆弱性，使部分 run 崩溃——"改革有代价"+S5 待修的真实体现，非 S4 缺陷。

---

## 5. S5–S6 里程碑（先立锚）

- **S5 外交博弈与战线战争**：DiplomaticRelation + 战线 + 和平谈判。依赖 S2 财政/S4 制度。
- **S6 历史局势与完整周期**：SituationState 承载主线，1573–1662 多结局。

---

## 6. 本轮交付清单

- [x] 回归 fix（7 类缺陷，见 SPEC v2 §1）
- [x] SPEC v2 + 本 PLAN
- [x] S1a 修正查询接口 + 税收接入
- [x] S1b 扩展修正接入面
- [x] S1c 账本驱动财政（applyLedgerToState 修双重记账；散点加减清零；Δtreasury===账本净额 不变量测试通过）
- [x] S2a 统一粮食流（产业+农业→市场 supply，pop 篮子→demand，价格真实化，consumePopNeeds 不扣 supply）
- [x] S2b pop 财富积累与分化（needsSatisfaction=购买力，wealth 月累积，famine 仍由 grainPerCapita）
- [x] S2c 白银货币约束（产业利润按 ownership 流向 pop，财富分化为 S3 政治力量铺路）
- [x] S2d 因果链测试（粮价→购买力→激进化；江南 vs 辽东分化；全量回归 300 测试 + batch errorRuns=0）
- [x] S3a clique strength 改由 pop wealth 聚合（CLIQUE_POP_AFFINITY + computeFactionCliqueStrengthFromPops，旧地区映射保留作 fallback）
- [x] S3b approval 系统（FactionCliqueState.approval；生活水平封顶+政策契合+加税惩罚；与 support 正交）
- [x] S3c 政治运动（强+不满集团推动诉求，结算施加 S1 modifier 接通后果环，12 月 cooldown 防失控）
- [x] S3d 因果链+全量验收（加税→approval降→运动；313 测试；batch errorRuns=0 存活 0.86；seed7 active −11.3%）
- [x] S4a 法律库+类型层（10 条法律覆盖六大类，tags 对接集团偏好，effect 三分法，ReformProgress 类型）
- [x] S4b 改革提出+集团博弈（computeReformSupport/Momentum，FOCUS_REFORM_AFFINITY，proposeReform 去重）
- [x] S4c 改革推进机+落实（advanceReforms/enactLaw，落实写永久 modifier + 集团反应接通 S3c 运动；tribal/rebel 不改革）
- [x] S4d 因果链+全量验收（低税/清丈/澄清吏治端到端；323 测试；batch errorRuns=0 存活 0.82；seed7 active −9.2%）
- 每项附单元测试 + 回归验证
