export type FactionId = string;
export type RegionId = string;
export type EventId = string;

export type TerrainType = "plain" | "mountain" | "steppe" | "river" | "coast";
export type ClimateType = "temperate" | "cold" | "dry" | "humid";
export type FactionType = "dynasty" | "tribal" | "local" | "rebel" | "successor" | "maritime";
export type FactionStatus = "active" | "collapsed" | "exiled" | "successor" | "observer";
export type MilitaryPosture = "conservative" | "balanced" | "aggressive";
export type DomesticFocus =
  | "agriculture"
  | "finance"
  | "military"
  | "administration"
  | "recovery"
  | "frontier";
export type MapLayer = "control" | "population" | "grain" | "tax" | "stability" | "army" | "controlLevel";

export type GoodId =
  | "grain"
  | "silver"
  | "cloth"
  | "iron"
  | "timber"
  | "salt"
  | "horses"
  | "weapons"
  | "tea"
  | "porcelain"
  | "shipMaterial";

export type IndustryType =
  | "farmland"
  | "irrigation"
  | "workshop"
  | "mine"
  | "saltField"
  | "marketTown"
  | "port"
  | "postRoad"
  | "granary"
  | "militaryTown";

export interface IndustryState {
  id: string;
  regionId: RegionId;
  type: IndustryType;
  level: number;
  ownership: "state" | "gentry" | "merchant" | "military" | "community";
  workforceRequired: number;
  workforceEmployed: number;
  inputs: Partial<Record<GoodId, number>>;
  outputs: Partial<Record<GoodId, number>>;
  efficiency: number;
  damage: number;
  profitability: number;
}

export type PopType =
  | "peasant"      // 自耕农
  | "tenant"       // 佃户
  | "artisan"      // 工匠
  | "merchant"     // 商人
  | "gentry"       // 士绅
  | "official"     // 官吏
  | "soldier"      // 军户
  | "migrant";     // 流民

export interface PopGroup {
  id: string;
  regionId: RegionId;
  type: PopType;
  size: number;
  employed: number;
  employment?: number; // alias
  wealth: number;
  literacy: number;
  subsistence: number;
  needsSatisfaction: number;
  taxBurden: number;
  politicalPower: number;
  loyalty: number;
  radicalism: number;
}

export type FactionCliqueId = string;

export interface CliqueDef {
  id: FactionCliqueId;
  name: string;
  shortName: string;
  description: string;
  primaryTrait: string;
  policyAffinities: Record<DomesticFocus, number>;
  /** S3/S4: 语义化法律标签（减税/开海/清丈…），S4 法律系统对接具体 LawId。 */
  preferredLaws: string[];
  opposedLaws: string[];
  /** 非 pop 力量来源描述（UI tooltip），如"centralization 高 → 力量高"。 */
  institutionalPowerSource?: string;
  /** 独有机制 id（如 "imperial-decree"、"kaocheng-effect"）。 */
  uniqueMechanic?: string;
}

export interface FactionCliqueState {
  cliqueId: FactionCliqueId;
  support: number;
  strength: number;
  activeModifier: number;
  /**
   * S3b: 集团对当前政策/处境的满意/不满（0-100），由成员 pop 的生活水平、
   * 税负、政策契合驱动。与 support（执政支持度）正交——一个强而不满的集团
   * 会推动政治运动（S3c）。support 仍驱动 administration 公式（不变）。
   */
  approval: number;
}

export interface CliqueReaction {
  cliqueId: FactionCliqueId;
  delta: number;
  reason: string;
}

export interface AiProfile {
  aggression: number;
  riskTolerance: number;
  economicFocus: number;
  centralizationPreference: number;
  historicalGoalWeight: number;
  defensePriority: number;
  warEndurance: number;
}

export type DisasterType = "drought" | "flood" | "famine" | "plague" | "locust";

export interface DisasterState {
  id: string;
  type: DisasterType;
  severity: number; // 0-1, affects intensity of effects
  remainingMonths: number;
}

/**
 * v0.9: 地区军事子结构 —— 把"驻军/人口/粮草"和"道路/季节/民心/抵抗"
 * 真正接到战斗 / 投送 / 占领 / 战疲公式。先于 v0.9.0 默认值落地，
 * 但所有字段保持 0/中性默认值，**本阶段不读取**（与 v0.8.x 行为等价）。
 */
export interface RegionMilitaryState {
  /** 0..3 道路/桥梁/转运等级。中原与南方运河多 ≥2，草原/山地为 0-1。 */
  infrastructureLevel: number;
  /** 当月季节标签（normal / mud / winter / drought / flood / harvest）。 */
  seasonalState: "normal" | "mud" | "winter" | "drought" | "flood" | "harvest";
  /** 0..100 民众对外来势力的合作度（v0.9.4 occupation phase 使用）。 */
  localSupport: number;
  /** 0..100 被占领后的抵抗压力（>70 触发起义准备）。 */
  occupationResistance: number;
  /** 0..1 就地筹粮能力（军队征粮上限比例）。 */
  forageCapacity: number;
  /** 0..100 AI 目标权重（高 = 战略要地）。 */
  strategicValue: number;
}

/**
 * v0.9: 后勤节点 —— 仓储吞吐 / 海港 / 河港。仅重要节点挂载（不重要的
 * 为 null），先于 v0.9.2 logistics phase 落地；本阶段不读取。
 */
export interface LogisticsNodeState {
  regionId: RegionId;
  /** 0..3 仓储转运等级。 */
  depotLevel: number;
  /** 当前粮秣库存（统一折算）。 */
  depotStock: number;
  /** 当月最大运输吞吐。 */
  throughput: number;
  /** 0..3 海港（0 = 无）。 */
  portLevel: number;
  /** 0..3 河港。 */
  riverPortLevel: number;
}

export interface RegionState {
  id: RegionId;
  name: string;
  terrain: TerrainType;
  climate: ClimateType;
  ownerFactionId: FactionId;
  controllerFactionId: FactionId;
  population: number;
  populationCapacity: number;
  agriculture: number;
  commerce: number;
  taxCapacity: number;
  stability: number;
  control: number;
  fortification: number;
  grainStock: number;
  garrison: number;
  coreFactionIds: FactionId[];
  connections: RegionId[];
  activeDisasters: DisasterState[];
  rebelPressure: number;
  popGroups?: PopGroup[];
  industries?: IndustryState[];
  market?: import("./market").MarketState;
  /**
   * v0.8: 预计算的 BFS 距离表，key = factionId，value = 该地区到该势力首都
   * （capitalRegionId）的最短跳数。未计算时为空对象；createMvpScenario 与
   * 每局开始 / 地区拓扑变更时由 computeDistanceMap 写入。让"劳师远征"
   * 真正可感：距离越远，投送系数 / 补给衰减越差。
   */
  distanceFromCapital?: Record<FactionId, number>;
  /**
   * v0.9: 后勤节点（仓/港）。不重要节点为 null；不读取，仅占位。
   * v0.9.2 logistics phase 开始作为路径容量 / 调度枢纽的消费点。
   */
  logisticsNode?: LogisticsNodeState | null;
  /** v0.9: 军事子结构（必填，默认中性值）。v0.9.3/0.9.4 阶段读取。 */
  military: RegionMilitaryState;
}

/**
 * v0.9: 编队（formation）—— 一支有驻地、有训练度、有装备度的兵力单元。
 * 设计上把"兵力"细分到编队，而不是 faction.armyTotal 一个数字：
 * - troopCount：已动员总员额（含新兵）
 * - readyTroops：训练/装备到位后可投入战斗的兵
 * - reserveTroops：在训/补员中的后备
 * - training ∈ [0,1]：0=新兵 / 1=老兵
 * - equipmentReadiness ∈ [0,1]：0=赤手空拳 / 1=火绳枪齐备
 * - morale ∈ [0,1]：受 supplyRatio / 上月胜负影响
 * - supplyStockDays：前线随军粮折算天数（Vanguard buffer）
 * - commanderCoord ∈ [0,1]：0=无帅 / 1=名将
 * - posture：attack/defend/raid/garrison
 *
 * v0.9.0 默认空数组；v0.9.1 warPreparation phase 落地后由每月 tick 填充。
 * 此时不读取，仍与 v0.8.x 行为等价。
 */
export interface FormationState {
  id: string;
  factionId: FactionId;
  homeRegionId: RegionId;
  position: RegionId | null;
  troopCount: number;
  readyTroops: number;
  reserveTroops: number;
  training: number;
  equipmentReadiness: number;
  morale: number;
  supplyStockDays: number;
  commanderCoord: number;
  posture: "attack" | "defend" | "raid" | "garrison";
}

export interface FactionState {
  id: FactionId;
  name: string;
  type: FactionType;
  treasury: number;
  grainReserve: number;
  armyTotal: number;
  administration: number;
  militaryOrganization: number;
  legitimacy: number;
  corruption: number;
  centralization: number;
  warExhaustion: number;
  capitalRegionId: RegionId;
  primaryColor: string;
  traits: string[];
  aiProfile: AiProfile;
  status: FactionStatus;
  cliques: FactionCliqueState[];
  administrationBase: number;
  /**
   * v0.8: 主场防御加成。防守方在自己控制的地区（且是该势力核心/历史领地）
   * 时 effectiveStrength × homeTurfMult。周边小势力在自己领土凝聚力高
   * （建州 1.40、察哈尔 1.30），大明统一王朝反而内部多元，主场加成低
   * （1.05）。仅在防守且 control 本地区时生效。
   */
  homeTurfMult: number;
  /**
   * v0.8: 投送系数上限。最大 committedForce = maxCommitRatio × armyTotal
   * × distanceMult（距离衰减）。大明 0.30（中央调度有限），周边部落 0.55-
   * 0.60（全民皆兵就近集结）。让"全兵力幻觉"消失——大明 58 万投送到察哈尔
   * 前线最多 17.4 万，再乘距离衰减更少。
   */
  maxCommitRatio: number;
  /**
   * v0.8: 当前每条战线的投送兵力（regionId → committed force）。由
   * runWarPhase 月度动员增长（5%/月），达到上限后停止。war 结束时清零。
   * 让 committedForce 持久化在 faction 上，避免 war 状态需要重复计算。
   */
  warCommitments: Record<RegionId, number>;
  /**
   * v0.9.1: 兵员上限池。committedForce 的最终钳位：
   * `committedForce = min(armyTotal, maxCommitRatio × armyTotal × distanceMult, mobilizationPool)`。
   * 每月自然增长 5%（封顶 1.5× armyTotal）—— 反映长期养兵的成本。
   * v0.9.0 默认 = `armyTotal × 0.20`（近似"现役 + 战时可再动员"）。
   */
  mobilizationPool: number;
  /**
   * v0.9: 征兵率上限（0..0.25）。受法律 / 人口 / 战时恐慌影响。
   * 仅占位，v0.9.1 warPreparation phase 读取。
   */
  conscriptionRate: number;
  /**
   * v0.9: AI 宣战倾向修正（-50..+50）。具体效果由 v0.9.6 decisions 公式读取。
   */
  warDesireModifier: number;
  /**
   * v0.9.1: 该势力的编队清单。默认空数组，v0.9.1 起由 warPreparation 填充。
   */
  formations: FormationState[];
}

export interface PlayerDecision {
  targetRegionId: RegionId | null;
  posture: MilitaryPosture;
  domesticFocus: DomesticFocus;
  /** S6 遗留#3：玩家手选改革法律（覆盖 domesticFocus 自动倾向）。undefined=自动。 */
  reformLawId?: LawId;
}

/** S5: 战线状态 —— 让战争成为兵力/组织/补给的持续消耗，而非单月决胜。 */
export interface FrontState {
  /** 0..100 战争支持度（S5c 和谈阈值，由 warExhaustion/treasury/占领驱动）。 */
  attackerWarSupport: number;
  defenderWarSupport: number;
  /** 0..100 补给状况（进攻方远离本土会衰减，抬高损耗）。 */
  attackerSupply: number;
  defenderSupply: number;
  /**
   * v0.8: 调兵遣将剩余月（>0 时不推进 progress，每月初减 1）。距离越远
   * 动员期越长（distance=1 → 0，distance=2 → 1，distance=3 → 2，
   * distance≥4 → 3）。同时 committedForce 在此期间从 0 增到上限。
   * 让"开战即决战"变成"下旨—集结—开打"。
   */
  mobilizationMonths: number;
  /**
   * v0.8: 进攻方当前投送到本战线的兵力（committedForce）。在动员期
   * 单调递增到 maxCommitRatio × armyTotal × distanceMult。
   */
  attackerCommitted: number;
}

export interface WarState {
  id: string;
  attackerFactionId: FactionId;
  defenderFactionId: FactionId;
  targetRegionId: RegionId;
  progress: number;
  monthsActive: number;
  /** S5: 战线状态（消耗/补给/支持度）。 */
  front?: FrontState;
}

/** S5: 外交条约类型。 */
export type TreatyType = "alliance" | "tribute" | "trade" | "vassal" | "truce";

/**
 * S5: 双边外交关系（接通"外交环"）。
 *
 * 存于 `GameState.diplomacy`，key = `relationKey(a,b)`（字典序规范化，保证
 * A↔B 双向只存一份）。同盟可触发参战、停战阻止开战、朝贡/互市作为条约
 * 月度反作用于财政（S2 账本）与 modifier（S1 后果环）——这是战争不再是
 * "单月战斗"的外交前置：开战前先过关系/威胁/停战/同盟的判断。
 */
export interface DiplomaticRelation {
  factionA: FactionId;
  factionB: FactionId;
  /** -100..100 综合关系（负=敌对，正=友善）。 */
  relation: number;
  /** 0..100 互信。 */
  trust: number;
  /** 0..100 互相威胁感知（取较大值，强邻即高威胁）。 */
  threat: number;
  /** 0..100 宿敌度（结构性对立，缓慢衰减）。 */
  rivalry: number;
  /** 停战剩余月（>0 时双方禁止相互攻击）。 */
  truceMonths: number;
  /** 当前生效的条约集合。 */
  treaties: TreatyType[];
  /** 恩义/义务（正=factionA 欠 factionB，负反之）。 */
  obligations: number;
}

export interface Modifier {
  id: string;
  label: string;
  scope: "faction" | "region" | "global";
  targetId?: string;
  remainingMonths?: number;
  effects: Partial<Record<string, number>>;
  stacking?: "add" | "multiply" | "replace";
}

export interface MonthlyReport {
  id: string;
  date: string;
  type: "economy" | "war" | "rebellion" | "event" | "system";
  title: string;
  body: string;
  severity: "info" | "warning" | "danger";
}

export interface GameAlert {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "danger";
}

export interface TriggeredEvent {
  eventId: EventId;
  optionRequired: boolean;
}

export interface HistoricalRecord {
  date: string;
  summary: string;
  factionCount: number;
  controlledRegions: Record<FactionId, number>;
}

/** S3c: 政治运动诉求类型。 */
export type MovementDemand = "reduce-tax" | "kaocheng" | "mining-tax" | "army-pay";

/** S3c: 一场由利益集团发起的政治运动（减税/考成/矿税/索饷）。 */
export interface PoliticalMovement {
  id: string;
  factionId: FactionId;
  cliqueId: FactionCliqueId;
  demand: MovementDemand;
  progress: number; // 0-100，到 100 即成功结算
  monthsActive: number;
}

/** S4: 法律类别（SPEC §11 六大类）。 */
export type LawCategory = "tax" | "land" | "military" | "maritime" | "governance" | "fiscal";

/** S4: 法律 id —— 与利益集团 preferredLaws/opposedLaws 的语义标签对接。 */
export type LawId = string;

/**
 * S4: 法律定义。
 *
 * 落实（enact）后其 `effects` 写入 S1 的 modifier 系统，成为制度性的长期
 * 后果——这是 S4 接通"制度环"的关键：改革不是一次性数值调整，而是持续
 * 反作用于经济/财政/控制的 modifier。
 *
 * effects 分两类（enactLaw 分流处理）：
 *   - modifier-effect keys（tax-mult/grain-output-mult/maintenance-mult/
 *     stability-flat/control-flat/corruption-flat/army-org-mult）→ 写入
 *     永久 faction-scope modifier，由各计算点月度查询生效；
 *   - instant-effect keys（centralization-flat/legitimacy-flat）→ 落实时
 *     一次性施加到对应 faction 数值（这些 stat 无月度查询点，避免累积爆炸）。
 */
export interface LawDef {
  id: LawId;
  name: string;
  category: LawCategory;
  description: string;
  /** 与 clique.preferredLaws/opposedLaws 匹配的语义标签，决定支持/反对集团。 */
  tags: string[];
  /** 落实效果（见上 effectKey 分类）。 */
  effects: Partial<Record<string, number>>;
}

/**
 * S4: 一条正在推进的法律改革（提出→辩论→落实/停滞/失败）。
 * progress 0-100；由 advanceReforms 每月按 行政/合法性/集团力量/控制度/腐败/
 * 战争 决定的 momentum 推进。
 */
export interface ReformProgress {
  id: string;
  factionId: FactionId;
  lawId: LawId;
  progress: number; // 0-100，到 100 即成功落实
  momentum: number; // 上月推进力（可负），供 UI 展示趋势
  monthsActive: number;
}

/**
 * S6: 历史局势状态 —— 系统驱动的长期叙事。
 *
 * 把孤立事件升级为局势：trigger 由系统状态（S1–S5 的财政/军事/控制/外交）
 * 推动，advance 月度推进 progress/stage/variables，outcomes 检测结局。
 * 局势变量由系统状态喂入，事件作为局势的叙事表现。
 */
export interface SituationState {
  id: string;
  factionId: FactionId | "global";
  /** 阶段索引（0=未触发，1+=进行中的阶段）。 */
  stage: number;
  /** 0-100 当前阶段进度。 */
  progress: number;
  /** 局势变量（由系统状态喂入，如占领数/战疲/腐败）。 */
  variables: Record<string, number>;
  active: boolean;
  /** 已达成的结局 id（active=false 时存在）。 */
  outcome?: string;
}

export interface SituationOutcome {
  id: string;
  label: string;
  test: (sit: SituationState, state: GameState) => boolean;
  /** S6b: 达成结局时施加效果（mutate 字段 / 写 modifier）。确定性。 */
  effect?: (state: GameState) => void;
}

/** S6: 局势定义（数据驱动，定义在 src/data/situations.ts）。 */
export interface SituationDef {
  id: string;
  name: string;
  description: string;
  factionId: FactionId | "global";
  /** 由系统状态判断是否激活。 */
  trigger: (state: GameState) => boolean;
  /** 月度推进：基于系统状态返回 partial 更新（progress/stage/variables）。 */
  advance: (sit: SituationState, state: GameState) => Partial<SituationState>;
  outcomes: SituationOutcome[];
}

/** S6: 局势引擎产出的事件（转 MonthlyReport）。 */
export interface SituationEvent {
  situationId: string;
  type: "triggered" | "outcome";
  outcome?: string;
  title: string;
  body: string;
}

export interface GameState {
  version: string;
  currentDate: string;
  endDate: string;
  seed: number;
  playerFactionId: FactionId;
  factions: Record<FactionId, FactionState>;
  regions: Record<RegionId, RegionState>;
  wars: WarState[];
  activeModifiers: Modifier[];
  eventFlags: Record<string, boolean>;
  history: HistoricalRecord[];
  reports: MonthlyReport[];
  alerts: GameAlert[];
  gameStatus: "playing" | "paused" | "finished";
  lastDomesticFocus?: DomesticFocus;
  ledgerHistory?: import("./ledger").MonthlyLedger[];
  /** S3c: 进行中的政治运动（强而不满的集团推动）。 */
  activeMovements?: PoliticalMovement[];
  /** S4: 进行中的法律改革（提出→辩论→落实/停滞/失败）。 */
  activeReforms?: ReformProgress[];
  /** S5: 双边外交关系表，key=relationKey(a,b)（字典序规范化）。 */
  diplomacy?: Record<string, DiplomaticRelation>;
  /** S6: 进行中的历史局势（系统驱动的长期叙事）。 */
  activeSituations?: SituationState[];
  /** v0.9.2: 进行中的补给车队（每月 ETA 递减，到期注入目的地 depotStock）。 */
  activeConvoys?: import("./supply").SupplyConvoy[];
}

export interface SimulationInput {
  state: GameState;
  playerDecision: PlayerDecision;
  randomSeed: number;
}

export interface SimulationResult {
  nextState: GameState;
  reports: MonthlyReport[];
  triggeredEvents: TriggeredEvent[];
  alerts: GameAlert[];
  /** v0.6-stability: 阶段计时（仅 dev 模式 / 显式 MINGWAR_TIMING=1 时有值）。 */
  timings?: import("./timing").SimulationTiming;
}
