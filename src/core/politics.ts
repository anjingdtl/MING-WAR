import type { FactionCliqueId, FactionId, GameState, Modifier } from "./types";

/** S3c: 政治运动诉求类型。 */
export type MovementDemand = "reduce-tax" | "kaocheng" | "mining-tax" | "army-pay";

/** S3c: 政治运动诉求的中文标签。 */
export const DEMAND_LABEL: Record<MovementDemand, string> = {
  "reduce-tax": "减税",
  "kaocheng": "考成推行",
  "mining-tax": "矿税扩张",
  "army-pay": "索饷",
};

/** S3c: 一场由利益集团发起的政治运动。 */
export interface PoliticalMovement {
  id: string;
  factionId: FactionId;
  cliqueId: FactionCliqueId;
  demand: MovementDemand;
  progress: number; // 0-100，到 100 即成功结算
  monthsActive: number;
}

/**
 * 网络 → 诉求映射（由其政治偏好派生，见 CliqueDef.preferredLaws）。
 *   imperial → null        （皇权网络不发起政治运动）
 *   reform   → kaocheng    （改革派推行考成法）
 *   donglin  → reduce-tax  （东林主张减税惠民）
 *   eunuch   → mining-tax  （阉党主张矿税扩张）
 *   frontier → army-pay    （边防网络诉求军饷）
 */
export const CLIQUE_DEMAND: Record<FactionCliqueId, MovementDemand | null> = {
  imperial: null,
  reform: "kaocheng",
  donglin: "reduce-tax",
  eunuch: "mining-tax",
  frontier: "army-pay",
};

/** 触发阈值：力量足够强（控制的社会财富份额）且足够不满。 */
export const MOVEMENT_STRENGTH_THRESHOLD = 30;
export const MOVEMENT_APPROVAL_THRESHOLD = 35;

/**
 * 诉求成功 → 施加的 modifier（接通 S1 后果环）。
 * 这些 modifier 经 queryModifier 的 global→faction→region 级联，在被该 faction
 * 控制的地区生效，从而把"政治运动"的后果真正反作用于经济/财政/控制——
 * 这是 S3 接通"社会—政治—后果"闭环的关键一环。
 */
const DEMAND_EFFECT: Record<
  MovementDemand,
  { label: string; effects: Partial<Record<string, number>> }
> = {
  // 让步强度刻意极温和：政治运动要能"可观测"地反作用于经济/财政/控制
  // （接通后果环，由单元/端到端测试证明），但在 batch 长期模拟里不致放大
  // 危机——S3 是危机放大器（战争/灾荒压低生活水平→approval→运动），强度
  // 必须小到无危机时几乎无感（如 seed 1 零运动大明健康扩张），有危机时
  // 才温和显现。叠加 12 月 cooldown 防累积。
  "reduce-tax": { label: "减税让步", effects: { "tax-mult": -0.05 } },
  "kaocheng": { label: "考成推行", effects: { "admin-efficiency": 0.03 } },
  "mining-tax": { label: "矿税扩张", effects: { "tax-mult": 0.05 } },
  "army-pay": { label: "加饷让步", effects: { "maintenance-mult": 0.03 } },
};

/**
 * S3c: 推进所有 faction 的政治运动。
 *
 * 对每个 active faction 的每个 clique：若 strength≥阈值且 approval≤阈值，
 * 发起或推进对应诉求的运动；处境改善（不再强或不不再不满）则运动衰退。
 * progress≥100 时结算——施加 S1 modifier（反作用于经济/财政/控制）并提升
 * 该集团 support（诉求被回应，执政支持回升，运动平息）。
 *
 * @returns 本月结算成功的运动（供 simulation 生成 report）
 */
export function advancePoliticalMovements(state: GameState): PoliticalMovement[] {
  const movements: PoliticalMovement[] = state.activeMovements
    ? state.activeMovements.map((m) => ({ ...m }))
    : [];
  const settled: PoliticalMovement[] = [];

  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active" || !faction.cliques) continue;

    for (const cs of faction.cliques) {
      const demand = CLIQUE_DEMAND[cs.cliqueId];
      if (!demand) continue;

      // border-pressure: frontier network lowers army-pay threshold by 10
      const effectiveStrengthThreshold =
        cs.cliqueId === "frontier" && cs.strength > 40
          ? MOVEMENT_STRENGTH_THRESHOLD - 10
          : MOVEMENT_STRENGTH_THRESHOLD;
      const strong = cs.strength >= effectiveStrengthThreshold;
      const displeased = cs.approval <= MOVEMENT_APPROVAL_THRESHOLD;
      const existing = movements.find(
        (m) => m.factionId === faction.id && m.cliqueId === cs.cliqueId && m.demand === demand,
      );

      if (existing) {
        if (strong && displeased) {
          // 力量越强推进越快；baseline +1.5 保证不满持续时终将结算，但速率
          // 刻意压低（0.3）——给改善条件让运动衰退留出窗口，避免开局脆弱期
          // 的运动被高 strength 瞬间推满结算。
          existing.progress += (cs.strength - MOVEMENT_STRENGTH_THRESHOLD) * 0.3 + 1.5;
        } else {
          existing.progress = Math.max(0, existing.progress - 2); // 处境改善 → 衰退
        }
        existing.monthsActive += 1;
        if (existing.progress >= 100) {
          settleMovement(state, existing);
          settled.push(existing);
        }
        continue;
      }

      // 触发新运动（结算后该诉求的让步 modifier 存续期=冷却期，防止运动失控）
      if (strong && displeased) {
        const cooldownId = movementModifierId(faction.id, cs.cliqueId, demand);
        const onCooldown = state.activeModifiers.some((m) => m.id === cooldownId);
        if (!onCooldown) {
          movements.push({
            id: `${state.currentDate}-${faction.id}-${cs.cliqueId}-${demand}`,
            factionId: faction.id,
            cliqueId: cs.cliqueId,
            demand,
            progress: (cs.strength - MOVEMENT_STRENGTH_THRESHOLD) * 0.3 + 1.5,
            monthsActive: 1,
          });
        }
      }
    }
  }

  const settledIds = new Set(settled.map((m) => m.id));
  state.activeMovements = movements.filter((m) => !settledIds.has(m.id));
  return settled;
}

/** 运动成功：施加 faction-scope modifier（S1 后果环）+ 提升集团 support。 */
function settleMovement(state: GameState, m: PoliticalMovement): void {
  const faction = state.factions[m.factionId];
  if (faction?.cliques) {
    const cs = faction.cliques.find((c) => c.cliqueId === m.cliqueId);
    if (cs) cs.support = Math.min(100, cs.support + 8); // 诉求被回应 → 执政支持回升
  }
  const effect = DEMAND_EFFECT[m.demand];
  const newMod: Modifier = {
    id: movementModifierId(m.factionId, m.cliqueId, m.demand),
    label: effect.label,
    scope: "faction",
    targetId: m.factionId,
    remainingMonths: 12,
    effects: effect.effects,
  };
  state.activeModifiers.push(newMod);
}

/** 让步 modifier 的稳定 id，兼作运动冷却 key（存续期内同诉求不再触发）。 */
function movementModifierId(
  factionId: string,
  cliqueId: FactionCliqueId,
  demand: MovementDemand,
): string {
  return `movement-${factionId}-${cliqueId}-${demand}`;
}
