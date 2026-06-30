import type {
  FactionCliqueId,
  FactionCliqueState,
  CliqueDef,
  CliqueReaction,
  RegionState,
  DomesticFocus,
  PopType,
  Modifier,
  FactionId,
} from "./types";
import { queryModifier } from "./modifiers";

interface CliqueWeight {
  cliqueId: FactionCliqueId;
  weight: number;
}

/**
 * Compute clique weights for a single region based on its economic/social attributes.
 * Rules (5-network model):
 *   control > 70 → imperial weight
 *   taxCapacity > 60 → reform weight
 *   commerce > 70 → donglin weight
 *   taxCapacity > 70 → eunuch weight
 *   fortification > 60 → frontier weight
 */
export function computeRegionCliqueWeights(region: RegionState): CliqueWeight[] {
  const imperialWeight = region.control > 70 ? Math.min((region.control - 70) * 1.5 + 5, 15) : 0;
  const reformWeight = region.taxCapacity > 60 ? Math.min((region.taxCapacity - 60) * 1.5 + 4, 14) : 0;
  const donglinWeight = region.commerce > 70 ? Math.min((region.commerce - 70) * 2 + 8, 20) : 0;
  const eunuchWeight = region.taxCapacity > 70 ? Math.min((region.taxCapacity - 70) * 1.5 + 5, 15) : 0;
  const frontierWeight = region.fortification > 60 ? Math.min((region.fortification - 60) * 1 + 4, 12) : 0;

  return [
    { cliqueId: "imperial", weight: Math.round(imperialWeight) },
    { cliqueId: "reform", weight: Math.round(reformWeight) },
    { cliqueId: "donglin", weight: Math.round(donglinWeight) },
    { cliqueId: "eunuch", weight: Math.round(eunuchWeight) },
    { cliqueId: "frontier", weight: Math.round(frontierWeight) },
  ];
}

/**
 * Aggregate clique strength for a faction from all controlled regions.
 * strength = Σ(region.population × cliqueWeight) / totalPopulation
 */
export function computeFactionCliqueStrength(
  cliques: FactionCliqueState[],
  regions: RegionState[],
): FactionCliqueState[] {
  if (regions.length === 0) {
    return cliques.map((c) => ({ ...c, strength: 0 }));
  }

  const totalPopulation = regions.reduce((sum, r) => sum + r.population, 0);
  if (totalPopulation === 0) {
    return cliques.map((c) => ({ ...c, strength: 0 }));
  }

  const strengthAccum: Record<string, number> = {};
  for (const c of cliques) {
    strengthAccum[c.cliqueId] = 0;
  }

  for (const region of regions) {
    const weights = computeRegionCliqueWeights(region);
    for (const w of weights) {
      strengthAccum[w.cliqueId] = (strengthAccum[w.cliqueId] ?? 0) + region.population * w.weight;
    }
  }

  return cliques.map((c) => ({
    ...c,
    strength: Math.round(strengthAccum[c.cliqueId] / totalPopulation),
  }));
}

/**
 * Compute support deltas when domestic focus changes.
 * delta = (newAffinity - oldAffinity) × strength / 100, clamped to [-8, +8]
 */
export function computeCliqueReactions(
  newFocus: DomesticFocus,
  oldFocus: DomesticFocus,
  cliques: FactionCliqueState[],
  defs: Record<FactionCliqueId, CliqueDef>,
): CliqueReaction[] {
  return cliques.map((cs) => {
    const def = defs[cs.cliqueId];
    if (!def) {
      return { cliqueId: cs.cliqueId, delta: 0, reason: "未知派系" };
    }

    const newAffinity = def.policyAffinities[newFocus];
    const oldAffinity = def.policyAffinities[oldFocus];
    const rawDelta = (newAffinity - oldAffinity) * (cs.strength / 100);
    const delta = Math.max(-8, Math.min(8, Math.round(rawDelta)));

    let reason = "";
    if (delta > 0) reason = `偏好「${focusLabel(newFocus)}」`;
    else if (delta < 0) reason = `反对「${focusLabel(newFocus)}」`;
    else reason = "态度中立";

    return { cliqueId: cs.cliqueId, delta, reason };
  });
}

/**
 * Apply clique reactions to update support values, clamped to [0, 100].
 */
export function applyCliqueReactions(
  cliques: FactionCliqueState[],
  reactions: CliqueReaction[],
): FactionCliqueState[] {
  const reactionMap = new Map(reactions.map((r) => [r.cliqueId, r.delta]));
  return cliques.map((c) => ({
    ...c,
    support: Math.max(0, Math.min(100, c.support + (reactionMap.get(c.cliqueId) ?? 0))),
  }));
}

/**
 * Compute the administration modifier from clique states.
 * High support (>60) → positive contribution
 * Low support (<40) → negative contribution (×0.8 penalty factor)
 * Final result clamped to [-10, +10]
 */
export function computeAdministrationModifier(cliques: FactionCliqueState[]): number {
  let total = 0;

  for (const cs of cliques) {
    if (cs.support > 60) {
      // Positive: scaled by how far above 60 and by strength
      const contribution = ((cs.support - 60) / 40) * (cs.strength / 100) * 5;
      total += contribution;
    } else if (cs.support < 40) {
      // Negative: penalty factor 0.8, dissatisfaction is more impactful
      const penalty = ((40 - cs.support) / 40) * (cs.strength / 100) * 5 * 0.8;
      total -= penalty;
    }
  }

  return Math.max(-10, Math.min(10, Math.round(total)));
}

/**
 * Apply natural decay: each clique's support moves 1 point toward 50 per month.
 */
export function applyNaturalDecay(cliques: FactionCliqueState[]): FactionCliqueState[] {
  return cliques.map((c) => {
    if (c.support === 50) return c;
    const delta = c.support > 50 ? -1 : 1;
    return { ...c, support: c.support + delta };
  });
}

/**
 * S3a: 利益集团的社会基础——按 pop 类型的归属亲和度（0-1）。
 *
 * 一个集团的力量来自它所代言的 pop 群体的财富与人口，而非地区属性映射。
 * pop.wealth 已包含产业 ownership 的利润分配（S2c: gentry←farmland,
 * merchant←marketTown, soldier←militaryTown, peasant←community），所以
 * 这里只读 pop.wealth 即可覆盖"财富+人口+土地"。官职由 official pop 体现。
 *
 * 设计依据（晚明史）：
 *   - 东林党：江南士大夫(gentry) + 城市商业资本(merchant/artisan) + 清流文官
 *   - 宦党：  依附皇权的官僚系统(矿税官/内廷)，社会基础薄弱——失皇权即灭
 *   - 缙绅：  在乡地主 + 依附的自耕农/佃户（乡村利益共同体）
 *   - 勋贵：  世袭军户
 * migrant（流民）无政治组织，不归属任何集团。
 */
export const CLIQUE_POP_AFFINITY: Record<FactionCliqueId, Partial<Record<PopType, number>>> = {
  imperial: {},  // no pop base - power from institutional bonuses
  reform: { official: 0.7, gentry: 0.5 },
  donglin: { gentry: 1.0, merchant: 0.8, artisan: 0.6, official: 0.4 },
  eunuch: { official: 0.4 },
  frontier: { soldier: 1.0 },
};

/**
 * S3a: 从 faction 控制区的 popGroups 聚合集团力量（strength 真相来源）。
 *
 *   rawPower(clique) = Σ pop.size × pop.wealth × affinity(clique, pop.type)
 *   strength(clique) = rawPower(clique) / Σ_all rawPower × 100
 *
 * 归一化到 0-100：strength 表示该集团控制的"社会政治财富份额"。士绅/商人
 * 因 wealth 高（S2c 利润分配）自然占大头——这正是 S3 想要的"财富驱动力量"，
 * 取代旧的 commerce/agriculture 地区属性映射。
 *
 * 无 popGroups 数据（如裸 region）时 fallback 到旧地区属性映射，保证健壮性
 * 且不破坏现有单元测试。
 */
export function computeFactionCliqueStrengthFromPops(
  cliques: FactionCliqueState[],
  regions: RegionState[],
): FactionCliqueState[] {
  const rawPower: Record<string, number> = {};
  for (const c of cliques) rawPower[c.cliqueId] = 0;

  let totalPower = 0;
  for (const region of regions) {
    if (!region.popGroups) continue;
    for (const g of region.popGroups) {
      const size = Math.max(0, g.size);
      const wealth = Math.max(0, g.wealth);
      for (const c of cliques) {
        const aff = CLIQUE_POP_AFFINITY[c.cliqueId]?.[g.type] ?? 0;
        if (aff <= 0) continue;
        const power = size * wealth * aff;
        rawPower[c.cliqueId] += power;
        totalPower += power;
      }
    }
  }

  // 无 pop 数据或财富全 0 → fallback 旧地区属性映射（保现有测试 + 裸 region）
  if (totalPower <= 0) {
    return computeFactionCliqueStrength(cliques, regions);
  }

  return cliques.map((c) => ({
    ...c,
    strength: Math.round((rawPower[c.cliqueId] / totalPower) * 100),
  }));
}

/**
 * S3b: 计算集团 approval（对当前政策/处境的满意/不满，0-100）。
 *
 *   approval = 50 + clamp(avgSat−50, −30, +20) + 政策契合×3 − 显式加税×50
 *
 * 三路驱动，把 S2 的经济闭环接入政治：
 *   1. 生活水平（封顶贡献）：加权平均归属 pop 的 needsSatisfaction，贡献钳在
 *      [−30, +20]——富裕时 approval 偏高但不顶满，确保加税/饥荒仍能压到运动
 *      阈值以下。这是 S2→S3 的齿轮（购买力→政治不满）。
 *   2. 政策契合（×3）：当前 domesticFocus 与 clique policyAffinity 的方向。
 *      玩家 focus=finance（整顿财政=加税）→ 反感加税的东林/缙绅 approval 降。
 *   3. 显式加税（×50）：玩家写 tax-mult modifier（加税政策）直接重击。
 *
 * approval 与 support 正交：support 是历史执政支持（驱动 administration），
 * approval 是当下处境感受（驱动政治运动 S3c）。无成员 pop 数据时生活水平锚 50。
 */
export function computeCliqueApproval(
  cliqueId: FactionCliqueId,
  focus: DomesticFocus,
  regions: RegionState[],
  defs: Record<FactionCliqueId, CliqueDef>,
  modifiers: Modifier[] = [],
  factionId?: FactionId,
): number {
  const affinity = defs[cliqueId]?.policyAffinities[focus] ?? 0;

  // 成员 pop 生活水平（按亲和度×人口加权）—— approval 的主导信号
  let satSum = 0;
  let satWeight = 0;
  for (const r of regions) {
    if (!r.popGroups) continue;
    for (const g of r.popGroups) {
      const aff = CLIQUE_POP_AFFINITY[cliqueId]?.[g.type] ?? 0;
      if (aff <= 0) continue;
      const w = aff * Math.max(0, g.size);
      satSum += g.needsSatisfaction * w;
      satWeight += w;
    }
  }
  const avgSat = satWeight > 0 ? satSum / satWeight : 50;

  // 玩家显式加税（faction 级 tax-mult modifier）惩罚
  const taxPressure = factionId
    ? queryModifier(modifiers, "faction", factionId, "tax-mult")
    : 0;

  // 生活水平贡献钳在 [−30, +20]：sat=100 仅 +20（避免富裕时 approval 爆表，
  // 让加税/饥荒仍能把 approval 压到运动阈值以下）；sat 低最多 −30。这样太平
  // 盛世集团 approval 偏高但不顶满，一旦加税/整军/灾荒即可跌破 35 触发运动。
  const satContrib = Math.max(-30, Math.min(20, avgSat - 50));

  const approval = 50 + satContrib + affinity * 3 - taxPressure * 50;
  return Math.max(0, Math.min(100, Math.round(approval)));
}

function focusLabel(focus: DomesticFocus): string {
  const labels: Record<DomesticFocus, string> = {
    agriculture: "劝课农桑",
    finance: "整顿财政",
    military: "整军备战",
    administration: "澄清吏治",
    recovery: "休养生息",
    frontier: "经略边疆",
  };
  return labels[focus];
}

/**
 * 5-network unique mechanics applied monthly.
 * Returns modifiers to apply to faction stats.
 */
export interface CliqueMechanicEffects {
  centralizationDelta?: number;
  administrationDelta?: number;
  corruptionDelta?: number;
  cliqueSupportDeltas?: Record<string, number>;
}

export function applyCliqueUniqueMechanics(
  cliques: FactionCliqueState[],
  faction: { centralization: number; legitimacy: number; administration: number; corruption: number; warExhaustion: number; armyTotal: number },
  defs: Record<FactionCliqueId, CliqueDef>,
): CliqueMechanicEffects {
  const effects: CliqueMechanicEffects = {};
  const cliqueMap = new Map(cliques.map(c => [c.cliqueId, c]));

  // imperial-decree: when imperial strength > 50, centralization +0.3/month
  const imperial = cliqueMap.get("imperial");
  if (imperial && imperial.strength > 50) {
    effects.centralizationDelta = (effects.centralizationDelta ?? 0) + 0.3;
  }

  // kaocheng-effect: when reform strength > 40 AND reform support > 55, admin +2
  const reform = cliqueMap.get("reform");
  if (reform && reform.strength > 40 && reform.support > 55) {
    effects.administrationDelta = (effects.administrationDelta ?? 0) + 2;
  }

  // impeachment: when donglin approval < 25 AND donglin strength > 35,
  // reform or eunuch support -1/month (whichever is stronger)
  const donglin = cliqueMap.get("donglin");
  if (donglin && donglin.approval < 25 && donglin.strength > 35) {
    const eunuch = cliqueMap.get("eunuch");
    const reformC = cliqueMap.get("reform");
    const target = (eunuch && reformC && eunuch.strength > reformC.strength) ? "eunuch" : "reform";
    effects.cliqueSupportDeltas = { ...effects.cliqueSupportDeltas, [target]: -1 };
  }

  // purge-prison: when eunuch strength > 60 AND imperial strength > 50,
  // corruption +0.3/month, donglin support -1/month
  const eunuchC = cliqueMap.get("eunuch");
  if (eunuchC && eunuchC.strength > 60 && (imperial?.strength ?? 0) > 50) {
    effects.corruptionDelta = (effects.corruptionDelta ?? 0) + 0.3;
    effects.cliqueSupportDeltas = {
      ...effects.cliqueSupportDeltas,
      donglin: (effects.cliqueSupportDeltas?.donglin ?? 0) - 1,
    };
  }

  // border-pressure: when frontier strength > 40 AND (warExhaustion > 60),
  // army-pay movement threshold lowered (tracked via return value, applied in politics.ts)
  // This is informational - the actual threshold adjustment happens in politics.ts

  return effects;
}
