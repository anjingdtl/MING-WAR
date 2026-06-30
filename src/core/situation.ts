import type { GameState, SituationDef, SituationEvent, SituationState } from "./types";

/**
 * S6: 历史局势引擎。
 *
 * 局势是系统驱动的长期叙事（张居正改革 / 三大征 / 建州统一 / 辽东危机 /
 * 陕西流民 / 南明分裂）。trigger 由 S1–S5 的系统状态推动，advance 月度推进，
 * outcomes 检测多结局。确定性：advance 基于系统状态，不消费 random。
 */

export function ensureSituations(state: GameState): SituationState[] {
  if (!state.activeSituations) state.activeSituations = [];
  return state.activeSituations;
}

/**
 * 月度推进所有局势：先检查未激活局势的触发条件，再推进已激活局势并检测结局。
 * 返回事件（triggered / outcome），由 simulation 转 MonthlyReport。
 */
export function advanceSituations(
  state: GameState,
  defs: SituationDef[],
): SituationEvent[] {
  const events: SituationEvent[] = [];
  const sits = ensureSituations(state);

  // 1. 触发：未激活且条件满足的局势
  for (const def of defs) {
    const exists = sits.some((s) => s.id === def.id);
    if (!exists && def.trigger(state)) {
      sits.push({
        id: def.id,
        factionId: def.factionId,
        stage: 1,
        progress: 0,
        variables: {},
        active: true,
      });
      events.push({
        situationId: def.id,
        type: "triggered",
        title: def.name,
        body: def.description,
      });
    }
  }

  // 2. 推进 + 结局检测
  for (const sit of sits) {
    if (!sit.active) continue;
    const def = defs.find((d) => d.id === sit.id);
    if (!def) continue;
    const delta = def.advance(sit, state);
    Object.assign(sit, delta);
    for (const oc of def.outcomes) {
      if (oc.test(sit, state)) {
        sit.active = false;
        sit.outcome = oc.id;
        oc.effect?.(state);
        events.push({
          situationId: sit.id,
          type: "outcome",
          outcome: oc.id,
          title: def.name,
          body: oc.label,
        });
        break;
      }
    }
  }

  return events;
}
