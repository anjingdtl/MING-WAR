import type { DomesticFocus, GameState, MilitaryPosture, PlayerDecision } from "../../core/types";
import { getValidMilitaryTargets } from "../../core/decisions";

interface DecisionPanelProps {
  state: GameState;
  decision: PlayerDecision;
  onChange: (decision: Partial<PlayerDecision>) => void;
}

const focusOptions: Array<[DomesticFocus, string]> = [
  ["agriculture", "劝课农桑"],
  ["finance", "整顿财政"],
  ["military", "整军备战"],
  ["administration", "澄清吏治"],
  ["recovery", "休养生息"],
  ["frontier", "经略边疆"]
];

const postureOptions: Array<[MilitaryPosture, string]> = [
  ["conservative", "保守"],
  ["balanced", "均衡"],
  ["aggressive", "激进"]
];

export function DecisionPanel({ state, decision, onChange }: DecisionPanelProps) {
  const targets = getValidMilitaryTargets(state, state.playerFactionId);
  return (
    <section className="side-panel">
      <h2>战略决策</h2>
      <label>
        军事方向
        <select value={decision.targetRegionId ?? ""} onChange={(event) => onChange({ targetRegionId: event.target.value || null })}>
          {targets.map((targetId) => (
            <option key={targetId} value={targetId}>
              {state.regions[targetId].name}
            </option>
          ))}
        </select>
      </label>
      <label>
        军事姿态
        <select value={decision.posture} onChange={(event) => onChange({ posture: event.target.value as MilitaryPosture })}>
          {postureOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        内政重点
        <select value={decision.domesticFocus} onChange={(event) => onChange({ domesticFocus: event.target.value as DomesticFocus })}>
          {focusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
