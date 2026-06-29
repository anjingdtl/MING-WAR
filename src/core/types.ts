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

export type FactionCliqueId = string;

export interface CliqueDef {
  id: FactionCliqueId;
  name: string;
  shortName: string;
  description: string;
  primaryTrait: string;
  policyAffinities: Record<DomesticFocus, number>;
}

export interface FactionCliqueState {
  cliqueId: FactionCliqueId;
  support: number;
  strength: number;
  activeModifier: number;
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
