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
  activeDisasters: string[];
  rebelPressure: number;
  popGroups?: PopGroup[];
  industries?: IndustryState[];
  market?: import("./market").MarketState;
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
}

export interface PlayerDecision {
  targetRegionId: RegionId | null;
  posture: MilitaryPosture;
  domesticFocus: DomesticFocus;
}

export interface WarState {
  id: string;
  attackerFactionId: FactionId;
  defenderFactionId: FactionId;
  targetRegionId: RegionId;
  progress: number;
  monthsActive: number;
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
export type MovementDemand = "reduce-tax" | "open-sea" | "army-pay" | "autonomy";

/** S3c: 一场由利益集团发起的政治运动（减税/开海/索饷/自治）。 */
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
}
