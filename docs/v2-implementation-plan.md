# 《万历：山河崩塌》v2 实施计划 PLAN

> 对应文档：`docs/v2-optimization-spec.md`（S1–S6）
> 编写日期：2026-06-29
> 本轮范围：**S1（修正系统激活 + 账本驱动）+ S2（市场—人口—生产整合）**，S3–S6 列里程碑

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

## 3. S3–S6 里程碑（本轮不实施，先立锚）

- **S3 利益集团政治力量**：clique strength 来自 pop wealth/官职/土地；集团 approval 驱动政治运动。依赖 S2 的 wealth。
- **S4 法律与改革**：改革流程（提出→博弈→落实），落实写入 S1 modifier。依赖 S3。
- **S5 外交博弈与战线战争**：DiplomaticRelation + 战线 + 和平谈判。依赖 S2 财政/S4 制度。
- **S6 历史局势与完整周期**：SituationState 承载主线，1573–1662 多结局。

---

## 4. 本轮交付清单

- [x] 回归 fix（7 类缺陷，见 SPEC v2 §1）
- [x] SPEC v2 + 本 PLAN
- [x] S1a 修正查询接口 + 税收接入
- [x] S1b 扩展修正接入面
- [x] S1c 账本驱动财政（applyLedgerToState 修双重记账；散点加减清零；Δtreasury===账本净额 不变量测试通过）
- [x] S2a 统一粮食流（产业+农业→市场 supply，pop 篮子→demand，价格真实化，consumePopNeeds 不扣 supply）
- [x] S2b pop 财富积累与分化（needsSatisfaction=购买力，wealth 月累积，famine 仍由 grainPerCapita）
- [x] S2c 白银货币约束（产业利润按 ownership 流向 pop，财富分化为 S3 政治力量铺路）
- [x] S2d 因果链测试（粮价→购买力→激进化；江南 vs 辽东分化；全量回归 300 测试 + batch errorRuns=0）
- 每项附单元测试 + 回归验证
