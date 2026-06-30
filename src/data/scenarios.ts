import type { FactionState, GameState, PlayerDecision } from "../core/types";
import { initializePopGroups } from "../core/populationGroups";
import { initializeIndustries, initializeMarket } from "../core/market";
import { factionTemplates } from "./factions";
import { addTreaty, ensureRelation } from "../core/diplomacy";
import { regionTemplates } from "./regions";

export const defaultPlayerDecision: PlayerDecision = {
  targetRegionId: "liaodong",
  posture: "balanced",
  domesticFocus: "administration"
};

const rebelFaction: FactionState = {
  id: "rebels",
  name: "义军",
  type: "rebel",
  treasury: 0,
  grainReserve: 0,
  armyTotal: 0,
  administration: 20,
  militaryOrganization: 35,
  legitimacy: 15,
  corruption: 20,
  centralization: 10,
  warExhaustion: 0,
  capitalRegionId: "shaanxi",
  primaryColor: "#3A4A3A",
  traits: ["流民武装", "无固定补给"],
  aiProfile: {
    aggression: 55,
    riskTolerance: 60,
    economicFocus: 25,
    centralizationPreference: 10,
    historicalGoalWeight: 20,
    defensePriority: 40,
    warEndurance: 30
  },
  status: "active",
  cliques: [
    { cliqueId: "donglin", support: 30, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "eunuchs", support: 30, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "gentry", support: 30, strength: 0, activeModifier: 0, approval: 50 },
    { cliqueId: "generals", support: 30, strength: 0, activeModifier: 0, approval: 50 },
  ],
  administrationBase: 20,
};

/**
 * S5: 初始化 1573 年开局的历史外交关系（基于明末真实格局）。
 *
 * 这些关系是"外交环"的起点 —— 朝贡/互市/敌对的结构，决定了谁会参战、
 * 谁被停战约束、谁的财政受条约影响。之后由 advanceDiplomacy 月度演变。
 */
function initializeDiplomacy(state: GameState): void {
  // 朝鲜 → 大明：册封朝贡体系（朝贡 + 互市），obligations>0 表示朝鲜朝贡大明
  const joseonMing = ensureRelation(state, "joseon", "ming");
  joseonMing.relation = 60;
  joseonMing.trust = 70;
  joseonMing.obligations = 30;
  addTreaty(state, "joseon", "ming", "tribute");
  addTreaty(state, "joseon", "ming", "trade");

  // 土默特 → 大明：俺答封贡（1571）后的互市与长期和平
  const tumedMing = ensureRelation(state, "tumed", "ming");
  tumedMing.relation = 30;
  tumedMing.trust = 45;
  tumedMing.truceMonths = 60;
  addTreaty(state, "tumed", "ming", "trade");
  addTreaty(state, "tumed", "ming", "truce");

  // 建州 ↔ 大明：辽东目标的敌对萌芽（努尔哈赤崛起前夜的张力）
  const jianzhouMing = ensureRelation(state, "jianzhou", "ming");
  jianzhouMing.relation = -30;
  jianzhouMing.rivalry = 55;
  jianzhouMing.trust = 25;

  // 建州 ↔ 海西 / 科尔沁：女真内部统一张力
  for (const other of ["haixi", "korchin"]) {
    const rel = ensureRelation(state, "jianzhou", other);
    rel.relation = -15;
    rel.rivalry = 35;
  }

  // 察哈尔 → 大明：北边时战时和
  const chaharMing = ensureRelation(state, "chahar", "ming");
  chaharMing.relation = -10;
  chaharMing.rivalry = 20;

  // 日本 → 朝鲜：壬辰倭乱前夜的结构性威胁
  const japanJoseon = ensureRelation(state, "japan", "joseon");
  japanJoseon.relation = -20;
  japanJoseon.rivalry = 40;
  japanJoseon.threat = 60;

  // 虾夷 → 日本：北海贸易
  const ainuJapan = ensureRelation(state, "ainu", "japan");
  ainuJapan.relation = 10;
  addTreaty(state, "ainu", "japan", "trade");
}

export function createMvpScenario(playerFactionId = "ming", seed = 157301): GameState {
  // P2: initialize pop groups for each region
  // P3: initialize industries and markets for each region
  const regionsWithPops = structuredClone(regionTemplates);
  for (const region of Object.values(regionsWithPops)) {
    region.popGroups = initializePopGroups(region.id, region.population);
    region.industries = initializeIndustries(region.id, region.terrain, region.agriculture, region.commerce);
    region.market = initializeMarket(region.id);
  }

  const state: GameState = {
    version: "0.3.0",
    currentDate: "1573-01",
    endDate: "1662-12", // S6：延伸至康熙元年，覆盖 1573–1662 完整主线
    seed,
    playerFactionId,
    factions: { ...structuredClone(factionTemplates), rebels: structuredClone(rebelFaction) },
    regions: regionsWithPops,
    wars: [],
    activeModifiers: [],
    eventFlags: {},
    history: [],
    reports: [],
    alerts: [],
    gameStatus: "playing",
    diplomacy: {}
  };
  initializeDiplomacy(state);
  return state;
}
