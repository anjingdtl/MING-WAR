import type {
  DomesticFocus,
  FactionId,
  FactionState,
  GameState,
  LawId,
  PlayerDecision,
  ReformProgress,
} from "./types";
import { cliqueTemplates } from "../data/cliques";
import {
  isLawEnacted,
  lawLibrary,
  lawModifierId,
  LAW_FACTION_INSTANT_KEYS,
  LAW_MODIFIER_EFFECT_KEYS,
  LAW_REGION_INSTANT_KEYS,
} from "../data/laws";

/**
 * S4: domesticFocus → 倾向推进的法律（玩家与 AI 走同一套规则，复用现有
 * PlayerDecision 决策通道——无需为改革新增玩家输入）。
 *
 * focus 表示施政大方向，映射到该方向下最可能推动的制度性改革。autoPropose
 * 按此顺序尝试，并经 momentum 预检过滤掉注定失败的改革（避免反复消耗合法性）。
 */
export const FOCUS_REFORM_AFFINITY: Record<DomesticFocus, LawId[]> = {
  agriculture: [], // 劝课农桑：专注生产，不主动绑改革（清丈阻力过大，由 administration 承担）
  finance: ["treasury-centralization", "commercial-tax", "mining-tax"], // 整顿财政→集权/加税
  military: ["military-funding"], // 整军备战→军饷倾斜
  administration: ["clean-admin", "civilian-control", "land-survey"], // 澄清吏治→反腐/以文制武/清丈
  recovery: ["low-tax"], // 休养生息→减税惠民
  frontier: ["military-funding"], // 经略边疆→军费
};

/** 同一 faction 同时进行的改革上限（防止改革刷屏、注意力分散）。 */
export const MAX_CONCURRENT_REFORMS = 2;

export interface ReformSupport {
  supportPower: number;
  opposePower: number;
  supporters: FactionId[]; // 实为 cliqueId
  opponents: FactionId[];
}

/**
 * S4b: 计算一条法律在某 faction 的支持/反对力量。
 *
 * 把法律的 `tags` 与每个集团的 preferredLaws/opposedLaws 求交：
 *   preferred 命中 → 该集团 strength 计入支持
 *   opposed  命中 → 该集团 strength 计入反对
 *
 * 这是 S3 偏好标签"通电"的落点——集团的 preferredLaws/opposedLaws 不再是
 * 装饰，而是真实决定改革成败的博弈力量。
 */
export function computeReformSupport(
  faction: FactionState,
  lawId: LawId,
): ReformSupport {
  const law = lawLibrary[lawId];
  if (!law) return { supportPower: 0, opposePower: 0, supporters: [], opponents: [] };

  const tags = new Set(law.tags);
  let supportPower = 0;
  let opposePower = 0;
  const supporters: string[] = [];
  const opponents: string[] = [];

  for (const cs of faction.cliques ?? []) {
    const def = cliqueTemplates[cs.cliqueId];
    if (!def) continue;
    const prefers = def.preferredLaws.some((t) => tags.has(t));
    const opposes = def.opposedLaws.some((t) => tags.has(t));
    if (prefers) {
      supportPower += cs.strength;
      supporters.push(cs.cliqueId);
    }
    if (opposes) {
      opposePower += cs.strength;
      opponents.push(cs.cliqueId);
    }
  }
  return { supportPower, opposePower, supporters, opponents };
}

/**
 * S4c: 改革的月度推进力 momentum（progress 的月增量，可负）。
 *
 *   momentum = 2(基线)
 *            + 行政×0.08      (执行力——大明官僚强则改革快)
 *            + 合法性×0.03    (皇权背书)
 *            + 支持力量×0.18   (利益集团推力)
 *            − 反对力量×0.28   (既得利益阻力，权重更大——改革天然比推动难)
 *            − 腐败×0.04      (侵蚀执行力)
 *            − 战争疲劳×0.04
 *            − 活跃战争数×1.5 (战争分心)
 *            + (平均控制度−50)×0.03 (根基稳固)
 *
 * 钳到 [-6, +8]：阻力大的改革（如清丈遭双集团反对）momentum 为负，注定停滞/
 * 失败；高行政+强支持的改革（如大明澄清吏治）快速落实。反对权重(0.28) > 支持
 * 权重(0.18)，体现"改革比推动更难"——契合 SPEC"一条鞭法可能停滞"。
 */
export function computeReformMomentum(
  state: GameState,
  faction: FactionState,
  lawId: LawId,
): number {
  const { supportPower, opposePower } = computeReformSupport(faction, lawId);

  const controlled = Object.values(state.regions).filter(
    (r) => r.controllerFactionId === faction.id,
  );
  const avgControl =
    controlled.length > 0
      ? controlled.reduce((s, r) => s + r.control, 0) / controlled.length
      : 0;

  const activeWars = state.wars.filter((w) => {
    const a = state.factions[w.attackerFactionId];
    const d = state.factions[w.defenderFactionId];
    return (
      (w.attackerFactionId === faction.id || w.defenderFactionId === faction.id) &&
      a?.status === "active" &&
      d?.status === "active"
    );
  }).length;

  const m =
    2 +
    faction.administration * 0.08 +
    faction.legitimacy * 0.03 +
    supportPower * 0.18 -
    opposePower * 0.28 -
    faction.corruption * 0.04 -
    faction.warExhaustion * 0.04 -
    activeWars * 1.5 +
    (avgControl - 50) * 0.03;

  return Math.max(-6, Math.min(8, Math.round(m * 10) / 10));
}

/**
 * S4b: 提出一条改革。已落实 / 已在推进 / 超过同时上限 → 返回 null。
 * 成功则 push 进 state.activeReforms 并返回该改革（momentum 已预算）。
 */
export function proposeReform(
  state: GameState,
  factionId: FactionId,
  lawId: LawId,
): ReformProgress | null {
  const faction = state.factions[factionId];
  if (!faction || faction.status !== "active") return null;
  if (!lawLibrary[lawId]) return null;
  if (isLawEnacted(state.activeModifiers, factionId, lawId)) return null;

  const active = (state.activeReforms ?? []).filter((r) => r.factionId === factionId);
  if (active.length >= MAX_CONCURRENT_REFORMS) return null;
  if (active.some((r) => r.lawId === lawId)) return null;

  const reform: ReformProgress = {
    id: `${state.currentDate}-${factionId}-${lawId}`,
    factionId,
    lawId,
    progress: 0,
    momentum: computeReformMomentum(state, faction, lawId),
    monthsActive: 0,
  };
  if (!state.activeReforms) state.activeReforms = [];
  state.activeReforms.push(reform);
  return reform;
}

/**
 * S4c: 落实一条法律——把"制度环"接通 S1 后果环，并产生明确的受益者/反对者。
 *
 *   1. modifier-effect keys → 永久 faction-scope modifier（月度查询，持续生效）
 *   2. faction-instant keys（centralization/legitimacy/corruption）→ 一次性施加
 *   3. region-instant keys（stability）→ 遍历控制区一次性施加
 *   4. 集团反应：受益集团 support/approval 升；受损集团 approval 暴跌
 *      （→ 可能触发 S3c 政治运动，闭环！）
 */
export function enactLaw(state: GameState, factionId: FactionId, lawId: LawId): void {
  const faction = state.factions[factionId];
  const law = lawLibrary[lawId];
  if (!faction || !law) return;
  if (isLawEnacted(state.activeModifiers, factionId, lawId)) return; // 防重复落实

  // 1. 永久 modifier（制度性长期后果，接通 S1）。即使某法律无 modifier-effect
  //    key（如 treasury-centralization 纯 instant），也写入此标记 modifier——
  //    其 id 兼作"已落实"去重 key（isLawEnacted 判定）。
  const modEffects: Partial<Record<string, number>> = {};
  for (const [k, v] of Object.entries(law.effects)) {
    if (LAW_MODIFIER_EFFECT_KEYS.has(k)) modEffects[k] = v as number;
  }
  state.activeModifiers.push({
    id: lawModifierId(factionId, lawId),
    label: law.name,
    scope: "faction",
    targetId: factionId,
    remainingMonths: undefined, // 永久
    effects: modEffects,
  });

  // 2. faction 级一次性施加
  for (const [k, v] of Object.entries(law.effects)) {
    applyFactionInstant(faction, k, v as number);
  }

  // 3. region 级一次性施加（遍历控制区）
  const regionEntries = Object.entries(law.effects).filter(([k]) =>
    LAW_REGION_INSTANT_KEYS.has(k),
  );
  if (regionEntries.length > 0) {
    for (const r of Object.values(state.regions)) {
      if (r.controllerFactionId !== factionId) continue;
      for (const [k, v] of regionEntries) {
        if (k === "stability-flat") {
          r.stability = Math.max(0, Math.min(100, r.stability + (v as number)));
        }
      }
    }
  }

  // 4. 集团反应（受益者 vs 反对者）
  const { supporters, opponents } = computeReformSupport(faction, lawId);
  for (const cs of faction.cliques ?? []) {
    if (supporters.includes(cs.cliqueId)) {
      cs.support = Math.min(100, cs.support + 6);
      cs.approval = Math.min(100, cs.approval + 10);
    }
    if (opponents.includes(cs.cliqueId)) {
      // 受损集团强烈不满 → approval 暴跌，下月可能触发政治运动（S3c 闭环）
      cs.approval = Math.max(0, cs.approval - 12);
    }
  }
}

/** faction 级 instant 施加（类型安全的显式映射，避免动态字段赋值的类型问题）。 */
function applyFactionInstant(faction: FactionState, key: string, value: number): void {
  if (!(key in LAW_FACTION_INSTANT_KEYS)) return;
  const clamp = (cur: number) => Math.max(0, Math.min(100, cur + value));
  if (key === "centralization-flat") faction.centralization = clamp(faction.centralization);
  else if (key === "legitimacy-flat") faction.legitimacy = clamp(faction.legitimacy);
  else if (key === "corruption-flat") faction.corruption = clamp(faction.corruption);
}

/** 改革失败：损合法性，反对集团因成功阻击而支持回升。 */
function failReform(state: GameState, reform: ReformProgress): void {
  const faction = state.factions[reform.factionId];
  if (!faction) return;
  faction.legitimacy = Math.max(0, faction.legitimacy - 3);
  const { opponents } = computeReformSupport(faction, reform.lawId);
  for (const cs of faction.cliques ?? []) {
    if (opponents.includes(cs.cliqueId)) {
      cs.support = Math.min(100, cs.support + 4);
    }
  }
}

/**
 * S4c: 推进所有进行中的改革。每月由 simulation 调用。
 *
 * progress += momentum；≥100 落实，≤0 且持续≥3 月则失败。返回本月落实/失败
 * 的改革（供 simulation 生成 report）。
 */
export function advanceReforms(
  state: GameState,
): { enacted: ReformProgress[]; failed: ReformProgress[] } {
  const reforms = (state.activeReforms ?? []).map((r) => ({ ...r }));
  const enacted: ReformProgress[] = [];
  const failed: ReformProgress[] = [];

  for (const r of reforms) {
    const faction = state.factions[r.factionId];
    if (!faction || faction.status !== "active") continue;
    r.momentum = computeReformMomentum(state, faction, r.lawId);
    r.progress += r.momentum;
    r.monthsActive += 1;
    if (r.progress >= 100) {
      enactLaw(state, r.factionId, r.lawId);
      enacted.push(r);
    } else if (r.progress <= 0 && r.monthsActive >= 3) {
      failReform(state, r);
      failed.push(r);
    }
  }

  const done = new Set([...enacted, ...failed].map((r) => r.id));
  state.activeReforms = reforms.filter((r) => !done.has(r.id));
  return { enacted, failed };
}

/**
 * S4c: 按 domesticFocus 自动提出改革（玩家与 AI 同规则）。
 *
 * 每个 active faction 每月至多提一条（受 MAX_CONCURRENT_REFORMS 上限约束），
 * 且经 momentum 预检——只提推进力为正的改革，避免注定失败者反复消耗合法性。
 */
export function autoProposeReforms(
  state: GameState,
  decisionsLookup: Record<string, PlayerDecision>,
): ReformProgress[] {
  const proposed: ReformProgress[] = [];
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    // 法律改革是定居官僚政权的产物——部落联盟走部族军事民主（S5 战争/外交），
    // 流民武装无固定政权可言，二者均不主动推动立法改革。这避免了"义军立法
    // 减税"这类荒谬结果，也收窄了改革对战争序列的扰动。
    if (faction.type === "tribal" || faction.type === "rebel") continue;
    const activeCount = (state.activeReforms ?? []).filter(
      (r) => r.factionId === faction.id,
    ).length;
    if (activeCount >= MAX_CONCURRENT_REFORMS) continue;

    const focus = decisionsLookup[faction.id]?.domesticFocus ?? "recovery";
    const candidates = FOCUS_REFORM_AFFINITY[focus] ?? [];
    for (const lawId of candidates) {
      // momentum 预检：阻力压倒支持的改革不主动提（玩家仍可手动 proposeReform 强推）
      if (computeReformMomentum(state, faction, lawId) <= 0) continue;
      const r = proposeReform(state, faction.id, lawId);
      if (r) {
        proposed.push(r);
        break; // 每 faction 每月至多一条
      }
    }
  }
  return proposed;
}
