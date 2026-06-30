# 史实化校准设计文档

基于 `docs/deep-research-report.md` 的明代史料研究，对 1573-1662 playable era 进行事件、参数、派系三个层面的史实化修正，同时保持游戏性。

## 设计约束

- **范围**：1573-1662 局内深化，1573 开局不变，不引入前史可玩内容
- **事件哲学**：铁/钢/柔三类分流（见 §3）
  - 铁事件：君主不可控事态（人物死亡、敌方行动、天灾），效果固定
  - 钢事件：历史节点触发，君主做决策，每个决策有真实的政治/经济/军事权衡
  - 柔事件：系统状态驱动，可能不发生，触发后同样给君主决策
- **参数校准**：全面校准模拟引擎（人口、粮价、税收、灾荒等），修改核心模拟文件
- **派系网络**：4 cliques 重构为 5 大政治网络
- **实施方案**：分层递进（派系 → 参数 → 事件），每层独立可测
- **君主角色**：玩家扮演君主，所有涉及君主决策的事件必须提供有意义的选项，选项对应不同网络反应

## 1. 派系网络重构（4 → 5）

### 1.1 设计目标

将现有 4 个 cliques（donglin/eunuchs/gentry/generals）替换为研究报告建议的 5 大政治网络。现有 CliqueDef/FactionCliqueState 接口和计算管线保持不变，仅更新数据映射和新增独有机制。

### 1.2 5 大网络定义

#### imperial（皇权网络）

代表皇帝的个人权威与内廷决策通道。核心资源是诏令与礼制解释权。

- **pop 亲和度**：无直接社会基础（皇帝不代表任何阶级），力量来自制度性加成
- **institutionalPowerSource**：centralization 高 → 力量高，legitimacy 高 → support 高
- **policyAffinities**：administration +6, frontier +4, military +2, finance -2, agriculture -2, recovery -4
- **preferredLaws**：centralization, imperial-authority, court-control
- **opposedLaws**：local-autonomy, civilian-control, austerity
- **独有机制 `imperial-decree`**：当 imperial strength > 50 时，faction centralization 月度 +0.3 加成（皇权推动集权）
- **政治运动**：无（皇权是权力来源而非诉求方）

#### reform（首辅改革网络）

代表张居正式的改革官僚群体。核心资源是考成法与督抚执行网络。

- **pop 亲和度**：official 0.7, gentry 0.5（改革派士绅）
- **institutionalPowerSource**：administration 高 → 力量加成
- **policyAffinities**：administration +8, finance +6, frontier +2, agriculture -2, military -2, recovery -4
- **preferredLaws**：land-survey, commercial-tax, treasury-centralization, kaocheng-law
- **opposedLaws**：low-tax, local-autonomy, austerity
- **独有机制 `kaocheng-effect`**：当 reform strength > 40 且 reform support > 55 时，administration 公式获得额外 +2 加成（考成法执行力放大）
- **政治运动诉求**：kaocheng（推动行政改革法律落实）

#### donglin（东林言路网络）

"言路—清议—士绅舆论"网络。核心资源是弹章（弹劾奏章）和清议。

- **pop 亲和度**：gentry 1.0, merchant 0.8, artisan 0.6, official 0.4
- **institutionalPowerSource**：江南商业区财富
- **policyAffinities**：administration +8, recovery +6, agriculture +2, finance -4, military -3, frontier -2
- **preferredLaws**：low-tax, clean-admin, relief-priority
- **opposedLaws**：mining-tax, commercial-tax, land-survey
- **独有机制 `impeachment`**：当 donglin approval < 25 且 donglin strength > 35 时，reform 或 eunuch 网络 support 每月 -1（言官弹劾压制对手）
- **政治运动诉求**：reduce-tax（减税惠民，保持现有）

#### eunuch（阉党网络）

内廷—厂卫—阉党联盟。核心资源是近侍通道、厂卫、诏狱。

- **pop 亲和度**：official 0.4（依附内廷的官僚）
- **institutionalPowerSource**：faction tax-mult modifier 越高（加税越多），eunuch 越强（矿监税使是宦官权力基础）
- **policyAffinities**：finance +8, military +2, frontier 0, administration -6, agriculture -2, recovery -2
- **preferredLaws**：mining-tax, commercial-tax, treasury-centralization
- **opposedLaws**：low-tax, clean-admin, local-autonomy
- **独有机制 `purge-prison`**：当 eunuch strength > 60 且 imperial strength > 50 时，corruption 每月 +0.3（阉党腐败制度化），同时 donglin support 每月 -1
- **政治运动诉求**：mining-tax（扩张内廷财源，重命名自 open-sea）

#### frontier（边镇军政网络）

边疆军事集团。核心资源是战功、军纪、边贸。

- **pop 亲和度**：soldier 1.0
- **institutionalPowerSource**：控制区中 fortification > 60 的区域数量
- **policyAffinities**：military +8, frontier +8, administration 0, finance -2, agriculture -2, recovery -4
- **preferredLaws**：military-funding, frontier-autonomy
- **opposedLaws**：civilian-control, austerity
- **独有机制 `border-pressure`**：当 frontier strength > 40 且 armyTotal 环比下降（裁军）或 warExhaustion > 60 时，army-pay 运动触发阈值降低 10 点
- **政治运动诉求**：army-pay（军饷保障，保持现有）

### 1.3 接口变更

`CliqueDef` 新增两个可选字段：

```typescript
interface CliqueDef {
  // ...existing fields...
  institutionalPowerSource?: string;  // 非 pop 力量来源描述（UI tooltip）
  uniqueMechanic?: string;            // 独有机制 id
}
```

`FactionCliqueId` 值域：`"imperial" | "reform" | "donglin" | "eunuch" | "frontier"`

### 1.4 政治运动诉求更新

```typescript
type MovementDemand = "reduce-tax" | "kaocheng" | "mining-tax" | "army-pay";

const CLIQUE_DEMAND: Record<FactionCliqueId, MovementDemand | null> = {
  imperial: null,       // 皇权不发起运动
  reform: "kaocheng",   // 推动考成法落实
  donglin: "reduce-tax",
  eunuch: "mining-tax", // 扩张内廷财源
  frontier: "army-pay",
};
```

新增诉求效果：
- `kaocheng`：label "考成推行"，effects `{ "admin-efficiency": 0.03 }`（12 月行政效率加成）
- `mining-tax`：label "矿税扩张"，effects `{ "tax-mult": 0.05 }`（12 月税收加成，但会触发 donglin 弹章）

### 1.5 受影响文件

| 文件 | 改动说明 |
|------|---------|
| `src/data/cliques.ts` | 模板数据替换为 5 大网络 |
| `src/core/clique.ts` | pop affinity 表、region weights、administration modifier、5 个独有机制 |
| `src/core/politics.ts` | CLIQUE_DEMAND、DEMAND_EFFECT、MovementDemand 类型 |
| `src/core/types.ts` | FactionCliqueId 值域、MovementDemand 类型、CliqueDef 新字段 |
| `src/data/factions.ts` | defaultCliques 初始值更新 |
| `src/data/events.ts` | 约 5 处引用旧 cliqueId 的事件效果 |
| `src/core/reform.ts` | 对接 kaocheng 诉求 |
| `src/ui/panels/CliqueBar.tsx` | 网络名称/颜色/tooltip 更新 |

## 2. 模拟引擎参数校准

### 2.1 人口增长模型（population.ts）

**现状问题**：naturalGrowthRate 基础值 0.003/月（≈3.6%/年），远高于明代实际（0.2%-0.5%/年）。全国一刀切，不区分区域差异。

**校准方案**：

新增 `REGIONAL_GROWTH_BASE` 常量表，按 region.climate 分区：

| climate | 月增长率基准 | 年化约 | 依据 |
|---------|------------|--------|------|
| temperate | 0.00015 | 0.18% | 华北旱作区 |
| humid | 0.00030 | 0.36% | 江南稻作区 |
| cold | 0.00010 | 0.12% | 东北/草原 |
| dry | 0.00012 | 0.14% | 西北干旱区 |

```typescript
const REGIONAL_GROWTH_BASE: Record<ClimateType, number> = {
  temperate: 0.00015,
  humid: 0.00030,
  cold: 0.00010,
  dry: 0.00012,
};
```

`focusBoost` 同步下调：recovery 0.0003, agriculture 0.00015。

灾害致死率分级（取代固定 0.012）：

```typescript
const DISASTER_DEATH_RATE: Record<ClimateType, number> = {
  dry: 0.018,    // 旱灾杀伤力最大
  temperate: 0.012,
  humid: 0.010,  // 水灾相对可恢复
  cold: 0.014,
};
```

### 2.2 粮价分区（market.ts）

**现状问题**：BASE_PRICES.grain 全国统一 1.0，无法体现区域差异。

**校准方案**：

新增 `REGIONAL_GRAIN_BASE` 常量，在 initializeMarket 时按 region.climate 设置区域粮价基准：

| climate | grain base price | 依据 |
|---------|-----------------|------|
| temperate | 0.9 | 京畿/华北，漕运终端 |
| humid | 0.6 | 江南产粮区 |
| cold | 1.1 | 边疆运输成本高 |
| dry | 0.85 | 西北产粮不足 |

```typescript
const REGIONAL_GRAIN_BASE: Record<ClimateType, number> = {
  temperate: 0.9,
  humid: 0.6,
  cold: 1.1,
  dry: 0.85,
};
```

`adjustPrice` 的价格天花板从 basePrice × 5 下调为 basePrice × 4（对应极端危机 3.6 两峰值）。地板从 basePrice × 0.1 调为 basePrice × 0.3。

`adjustPrice` 函数签名增加 `regionalBasePrice` 参数：

```typescript
function adjustPrice(
  currentPrice: number,
  supply: number,
  demand: number,
  basePrice: number,
  regionalBasePrice: number  // 新增
): number
```

`updateMarketPrices` 改为按区域传入对应的 regionalBasePrice。

### 2.3 税收征解效率（economy.ts）

**现状问题**：税收系数 0.022 在当前人口规模下月收入约 180 万两（年 2160 万两），远超太仓口径 370-400 万两/年。

**校准方案**：

税收系数从 0.022 降至 0.004。引入 `collectionEfficiency` 因子：

```typescript
const collectionEfficiency = 0.45 + (faction.administration / 100) * 0.35;
```

最终公式：
```
taxCollected = population × (taxCapacity/100) × controlFactor × collectionEfficiency
             × financeBoost × (1 - corruptionLoss) × 0.004 × taxMult
```

验证：大明 administration=72 → efficiency≈0.70，31 区月收入 ≈ 33 万两（年 396 万两），对齐太仓口径。

### 2.4 军费占比与维护（economy.ts）

**现状问题**：当前军费 + 官僚费 vs 校准后税收的比例失衡。

**校准方案**：

| 参数 | 当前值 | 校准后 | 依据 |
|------|--------|--------|------|
| dynasty costPerSoldier | 0.55 | 0.28 | 月军费≈19 万两，占太仓 58% |
| tribal costPerSoldier | 0.22 | 0.15 | |
| local costPerSoldier | 0.45 | 0.30 | |
| rebel costPerSoldier | 0.10 | 0.08 | |
| dynasty adminCost | 900 | 500 | 月官僚费≈3.6 万两 |
| tribal adminCost | 500 | 300 | |
| local adminCost | 700 | 400 | |
| rebel adminCost | 200 | 150 | |

验证：大明和平时期月支出 ≈ 22.6 万两 vs 月收入 ≈ 33 万两，约 10 万两余裕。战争/灾荒/事件消耗会迅速侵蚀这个缓冲。

### 2.5 灾荒常态压迫

**现状问题**：无定期灾害生成机制。灾害对人口/生产的影响过于粗暴（固定 0.012 死亡率、50% 产出惩罚）。

**校准方案**：

在 simulation 月度管线中新增 `generateDisasters` 步骤（在 economy 之前），按区域概率生成灾害：

| 区域条件 | 月灾害概率 |
|----------|-----------|
| climate=dry 且 stability < 60 | 3% |
| climate=temperate 且 stability < 50 | 1.5% |
| climate=humid 且 stability < 40 | 1% |
| climate=cold | 0.8% |
| 全局 baseline | 0.5% |

灾害效果分级：

| 灾害类型 | 触发区域 | 效果 |
|----------|---------|------|
| 旱灾 | dry regions | 粮食产量 -40%，粮价 +15%，stability -3 |
| 水灾 | humid regions | 粮食产量 -25%，商业产出 -20%，stability -2 |
| 疫病 | 任何区域（0.3%/月） | 人口死亡率 +0.5%，garrison -2%，stability -4 |

灾害持续时间：2-6 个月。`RegionState.activeDisasters` 从 `string[]` 改为 `{id: string, type: string, remainingMonths: number}[]`。

新增文件 `src/core/disaster.ts` 封装灾害生成和效果计算逻辑。

### 2.6 初始参数校准（regions.ts / factions.ts）

**区域人口上调 30-40%**（当前总量约 7000 万 → 目标约 9500 万-1 亿）：

| 区域 | 上调比例 |
|------|---------|
| 江南/湖广/浙江/江西/福建 | +40% |
| 华北（北直隶/山东/河南/山西） | +30% |
| 西南（四川/云南/贵州/广西） | +20% |
| 陕西 | +25% |
| 草原/边疆/东北 | 不动 |

populationCapacity 同比例上调，预留增长空间。

**明朝初始属性微调**：

| 属性 | 当前值 | 校准后 | 依据 |
|------|--------|--------|------|
| treasury | 8,200,000 | 5,000,000 | ≈太仓 15 年积蓄 |
| grainReserve | 12,500,000 | 8,000,000 | 与人口规模匹配 |
| corruption | 34 | 38 | 万历初年改革前偏高 |
| armyTotal | 680,000 | 580,000 | 名义 80 万，实能战者约 50-60 万 |

## 3. 历史事件扩展

### 3.1 GameEvent 接口增强

```typescript
interface GameEvent {
  // ...existing fields...
  tier?: "iron" | "steel" | "flexible";  // 三类分流标注
  sourceRefs?: string[];                   // 史源引用（UI tooltip 展示）
  chainId?: string;                        // 连锁事件链 id
}
```

所有字段可选，向后兼容现有事件数据。

### 3.2 现有事件分流与修正

#### 铁事件（3 个）

君主无法控制的纯事态，效果固定。

铁事件只剩 3 个（均为君主无法阻止的纯事态），效果固定：

| 事件 id | 时间窗 | 修正 |
|---------|--------|------|
| `zhang_juzheng_death` | 1582-06 ~ 1582-09 | 时间窗前移（死于万历十年六月）。reform 网络 strength 自动下降 |
| `later_jin_founded` | 1616-01 ~ 1616-06 | 窗口收窄。jianzhou legitimacy +10, armyTotal +8000 |
| `fushun_falls` | 1618-04 ~ 1618-09 | 窗口收窄。liaodong control -12，触发链事件检查 |

`gengxu_crisis_legacy`、`longqing_open_sea`、`anda_fenggong` 作为开局 modifier 处理，不经过事件系统（见 §3.5）。

#### 钢事件（12 个现有修正 + 6 个新增 = 18 个）

历史节点触发，君主做决策。

**现有钢事件修正：**

| 事件 id | 时间窗修正 | 效果校准 |
|---------|-----------|---------|
| `zhang_reform_pressure` | 1573-01 ~ 1577-06 | administration 加成提升，增加 reform 网络 support 联动 |
| `qingzhang_tianmu` | 1578-01 ~ 1582-06 | 窗口后移。treasury +40 万 → +25 万（对齐校准后税收基数） |
| `yitiaobian_promotion` | 1577-01 ~ 1582-12 | 窗口前移对齐报告。增加 silver_dependence modifier |
| `kaocheng_resistance` | 不变 | 对接 reform 网络机制 |
| `state_succession_dispute` | 不变 | 增加 donglin 网络 approval 联动 |
| `purge_reform_legacy` | 不变 | 增加第三选项"有限追夺"。imperial/reform 网络 support 联动 |
| `ningxia_rebellion` | 1592-04 ~ 1592-12 | 窗口收窄。增加第三选项"招抚" |
| `korean_war` | 1592-06 ~ 1598-12 | 全面出兵 treasury -120 万 → -150 万。增加第三选项"坐视不理" |
| `bozhou_campaign` | 不变 | 效果数值微调 |
| `three_campaigns_cost` | 1597-01 ~ 1601-12 | treasury +80 万 → +50 万（校准后基数更低） |
| `border_army_exhaustion` | 1599-01 ~ 1605-12 | 窗口延长 |
| `saarhu_campaign` | 1619-01 ~ 1619-06 | 窗口收窄到 6 月。armyTotal -34000 → -45000（史实损失约 4.5 万） |

**新增钢事件：**

| 事件 id | 时间窗 | 触发条件 | 选项概要 |
|---------|--------|---------|---------|
| `jisi_incident` | 1629-10 ~ 1630-03 | 明金战争中 且 jianzhou armyTotal > 120000 | A.启用袁崇焕守城 / B.调辽东边军回援 / C.坚守不出坚壁清野 |
| `liaoxiang_surcharge` | 1618-01 ~ 1620-12 | jianzhou 控制辽东邻近区域 且 treasury < 300 万 | A.全额加派 / B.部分加派 / C.动用内帑 |
| `jiashen_catastrophe` | 1643-01 ~ 1644-12 | ming 控制区 ≤ 10 且 rebel armyTotal > 150000 且 beizhili control < 30 | A.死守京师 / B.南迁南京 / C.议和（终局事件） |
| `tiaoobian_controversy` | 1577-01 ~ 1580-12 | yitiaobian_done 未设置 且 administration > 60 | A.强力推动全国化 / B.渐进试点 / C.暂缓（reform 网络联动） |
| `wei_zhongxian_purge` | 1625-01 ~ 1627-12 | eunuch strength > 60 且 imperial support < 40 | A.支持诏狱（eunuch +，donglin -）/ B.制止迫害 / C.利用两边制衡 |
| `yuan_chonghuan_execution` | 1629-01 ~ 1630-12 | jisi_incident flag 已设置 | A.处死袁崇焕（imperial +3，frontier -15）/ B.留用戴罪立功 / C.贬谪外放 |

**原计划为铁事件、因君主决策权升级为钢事件（4 个）：**

以下 4 个事件在初始设计中被归为铁事件，但根据"玩家扮演君主"的设计原则，它们涉及君主可决策的历史节点，因此升级为钢事件。

| 事件 id | 原分类 | 升钢原因 |
|---------|--------|---------|
| `purge_reform_legacy` | 铁 | 清算张居正是万历亲自推动的政治决策 |
| `ningxia_rebellion` | 铁 | 平叛方式由皇帝决定 |
| `korean_war` | 铁 | 是否出兵援朝是万历的重大战略决策 |
| `bozhou_campaign` | 铁 | 播州处置方式由朝廷决定 |

#### 柔事件（6 个现有修正 + 2 个新增 = 8 个）

系统状态驱动，可能不发生。

| 事件 id | 时间窗 | 触发条件 | 修正 |
|---------|--------|---------|------|
| `eunuch_wei_rise` | 1620-01 ~ 1627-12 | eunuch strength > 40 且 imperial support < 50 | 增加第三选项"培植为皇权代理人" |
| `mineral_tax_disaster` | 1596-01 ~ 1606-12 | faction treasury < 3000000 | 增加条件：国库吃紧时才触发 |
| `xiong_tingbi_liaodong` | 1619-06 ~ 1622-12 | liaodong control < 50 | 不变 |
| `liaoshen_crisis` | 1620-01 ~ 1622-12 | liaodong control < 40 或 jianzhou armyTotal > 100000 | 不变 |
| `tianqi_political_crisis` | 1620-01 ~ 1627-12 | eunuch strength > 50 且 administration < 50 | 对接 5 网络机制 |
| `donglin_dispute` | 1604-01 ~ 1627-12 | 窗口延长 | 对接 donglin/eunuch 网络互动 |
| `shaanxi_drought` | 1627-01 ~ 1632-12 | 时间窗后移 7 年（关键修正）。增加粮价飙升效果 | 增加第四选项"以工代赈" |
| `shaanxi_chain_drought` (新) | 1628-01 ~ 1633-12 | shaanxi stability < 40 且 garrison < 30000 且 grainStock < population × 0.08 | 旱荒—欠饷—民变链式触发 |

### 3.3 事件选项与网络反应联动

每个钢/柔事件的选项必须对应不同的 5 大网络反应。设计原则：

- 选择加税/扩财 → eunuch support +，donglin approval -
- 选择赈灾/减税 → reform support +，treasury -
- 选择军事扩张 → frontier support +，treasury -
- 选择集权/亲政 → imperial support +，其他网络 approval -
- 选择放权/休养 → 各网络 approval +，但 imperial strength -

示例（`liaoxiang_surcharge` 三选项的网络反应）：

```
A. 全额加派：
   eunuch support +5, donglin approval -12, frontier support +3
   treasury +12%/月, peasant_burden +18%, 北方 rebelPressure +6

B. 部分加派：
   eunuch support +2, donglin approval -4, frontier approval -6
   treasury +6%/月, 辽东 military_supply +8%

C. 动用内帑：
   imperial support -8, donglin approval +5, reform approval +3
   treasury +5%/月, imperial_privy_funds -15%
```

### 3.4 三条连锁事件链

#### 链 A：条鞭—辽饷—流民链 `chain: fiscal-reform-crisis`

```
yitiaobian_promotion → tiaoobian_controversy → liaoxiang_surcharge → shaanxi_chain_drought
```

触发逻辑：每个后续事件检查前一个事件的 flag。全国推行条鞭 → 增加银征依赖 → 辽饷加派时压力更大 → 陕西旱灾时民变更猛烈。"改革副作用"链。

#### 链 B：辽东危机链 `chain: liaodong-crisis`

```
fushun_falls → saarhu_campaign → liaoshen_crisis → liaoxiang_surcharge → jisi_incident → yuan_chonghuan_execution
```

触发逻辑：地理和军事状态的级联恶化。抚顺失守 → 被迫决战萨尔浒 → 辽沈防务动摇 → 加派辽饷 → 后金绕道入塞 → 边将清算。

#### 链 C：东林—阉党链 `chain: court-faction-war`

```
donglin_dispute → eunuch_wei_rise → wei_zhongxian_purge
```

触发逻辑：党争升级链。东林争议 → 魏忠贤趁势掌权 → 诏狱清洗东林。每步依赖对应网络 strength/approval 状态。

`chainId` 字段让 UI 在事件日志中显示连锁标记（如"辽东危机链 · 第 3 环"）。

### 3.5 开局 modifier（前史事件处理）

以下事件发生在 1573 之前，不作为游戏内触发事件，而是在游戏初始化时直接写入 modifier：

| 事件 | 开局 modifier | 效果 |
|------|-------------|------|
| 隆庆开海 (1567) | `maritime-trade-legalized` | 沿海区域 commerce +0.05 modifier，福建/广东初始 stability +5 |
| 俺答封贡 (1571) | `border-trade-restored` | tumed aggression -10，border_raids modifier -0.15，tumed_steppe commerce +10 |
| 庚戌之变遗策 (1550) | `gengxu-defense-lesson` | beizhili fortification +10，ming initial militaryOrganization +3 |

这些 modifier 在 `createMvpScenario` 中初始化，不占用事件系统。

## 4. 数值校准总表

### 4.1 事件 treasury/grain 效果校准

| 事件 | 当前值 | 校准后 | 依据 |
|------|--------|--------|------|
| `korean_war` (full) | treasury -1,200,000 | -1,500,000 | 七年累计耗太仓约 780-1000 万两 |
| `three_campaigns_cost` (tax) | treasury +800,000 | +500,000 | 校准后税收基数更低 |
| `saarhu_campaign` (commit) | armyTotal -34,000 | -45,000 | 史实损失约 4.5 万 |
| `shaanxi_drought` (ignore) | rebelPressure +18 | +25，+grainPrice modifier | 荒旱+欠饷叠加 |
| `qingzhang_tianmu` (enforce) | treasury +400,000 | +250,000 | 校准后税收基数下调 |
| `ningxia_rebellion` (swift) | treasury -500,000 | -350,000 | 宁夏之役实际规模较小 |
| `fushun_falls` (counter) | armyTotal -26,000 | -20,000 | 抚顺之战规模有限 |

### 4.2 基准参数速查表（1573-1644 剧本）

| 参数 | 基准值 | 危机修正 | 实现位置 |
|------|--------|---------|---------|
| 年人口增长率 | 华北 0.18%，江南 0.36% | 战争/大疫/大荒年 -0.5%~-2.0% | population.ts |
| 中央现金岁入 | 月 33 万两（年 396 万两） | 战事极盛时可透支 | economy.ts |
| 军费占中央支出 | 平时 55-60% | 辽事后 70-85% | economy.ts |
| 平年米价 | 华北 0.9，江南 0.6 | 荒年 1.3-2.0，极端 2.2-3.6 | market.ts |
| 基础叛乱概率 | 平年省级 0.5-2%/月 | 荒旱+欠饷+米贵叠加后 5-12%/月 | rebellion.ts |
| 派系冲突强度 | 平年 0.1-0.3 | 东林-阉党高峰 0.6-0.9 | clique.ts |
| 税收征解效率 | 条鞭前 0.45-0.55 | 条鞭后 0.6-0.8 | economy.ts |
| 灾害频率 | 北方 1.5-3%/月 | 南方 1%/月，全局 0.5%/月 | disaster.ts |

## 5. 实施分层与验证

### 层 1：派系网络重构

- 替换 CliqueDef 数据 + FactionCliqueId 值域
- 实现 5 个独有机制
- 更新 CLIQUE_POP_AFFINITY 和 CLIQUE_DEMAND
- 验证：现有 377 测试中 clique 相关用例全部更新并通过；batch simulation 20 轮无 error

### 层 2：模拟引擎校准

- 修改 population.ts、market.ts、economy.ts 的核心系数
- 新增 disaster.ts 和 generateDisasters 管线步骤
- 更新 regions.ts 人口和 factions.ts 初始属性
- 验证：batch simulation 100 轮 × 240 月，0 error runs；大明财政在前 60 月保持正余额；粮价在 240 月内不超过 base × 4；至少 1 个种子在 1627 年后触发陕西旱荒

### 层 3：历史事件扩展

- GameEvent 接口增强（tier/sourceRefs/chainId）
- 修正现有 25 个事件的时间窗和数值
- 新增 10 个事件
- 实现 3 条连锁事件链的 flag 依赖
- 新增 3 个开局 modifier
- 验证：全量测试通过；手动验证每条铁事件在正确时间窗触发；钢事件的每个选项产生不同的网络 reaction；连锁事件链至少有一条在 batch simulation 中完整触发
