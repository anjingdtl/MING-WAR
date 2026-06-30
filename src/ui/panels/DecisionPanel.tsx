import { Swords } from "lucide-react";
import type {
  DomesticFocus,
  GameState,
  MilitaryPosture,
  PlayerDecision,
  RegionId
} from "../../core/types";
import { getValidMilitaryTargets } from "../../core/decisions";
import { isLawEnacted, lawLibrary } from "../../data/laws";
import { Button } from "../common/Button";
import { DecisionPrediction } from "./DecisionPrediction";

interface DecisionPanelProps {
  state: GameState;
  decision: PlayerDecision;
  onChange: (decision: Partial<PlayerDecision>) => void;
  /** 选中的区域(用于"设为军略目标"按钮) */
  selectedRegionId?: RegionId | null;
  /** 选择区域 */
  onSelectRegion?: (regionId: RegionId | null) => void;
}

const focusOptions: Array<[DomesticFocus, string]> = [
  ["agriculture", "劝课农桑"],
  ["finance", "整顿财政"],
  ["military", "整军备战"],
  ["administration", "澄清吏治"],
  ["recovery", "休养生息"],
  ["frontier", "经略边疆"]
];

const focusShort: Record<DomesticFocus, string> = {
  agriculture: "劝农",
  finance: "财政",
  military: "军备",
  administration: "吏治",
  recovery: "休养",
  frontier: "边疆"
};

const postureOptions: Array<[MilitaryPosture, string]> = [
  ["conservative", "保守"],
  ["balanced", "均衡"],
  ["aggressive", "激进"]
];

export function DecisionPanel({
  state,
  decision,
  onChange,
  selectedRegionId,
  onSelectRegion
}: DecisionPanelProps) {
  const targets = getValidMilitaryTargets(state, state.playerFactionId);
  const selectedRegion = selectedRegionId ? state.regions[selectedRegionId] : null;
  const isPlayerRegion = selectedRegion
    ? state.factions[selectedRegion.controllerFactionId]?.id === state.playerFactionId
    : false;
  const canTarget = selectedRegion
    ? isPlayerRegion && targets.includes(selectedRegion.id)
    : false;

  return (
    <section className="side-panel">
      <h2>战略决策</h2>
      <p className="muted">
        内政与军略方向。切换内政重点会触发朝堂派系反应。
      </p>

      {selectedRegion && isPlayerRegion ? (
        <Button
          variant="primary"
          block
          iconLeft={<Swords aria-hidden="true" size={16} />}
          disabled={!canTarget}
          onClick={() => onChange({ targetRegionId: selectedRegion.id })}
        >
          {decision.targetRegionId === selectedRegion.id
            ? "已设为军略目标"
            : `将「${selectedRegion.name}」设为军略目标`}
        </Button>
      ) : (
        <p className="muted" style={{ textAlign: "center", padding: "8px 0" }}>
          请先在地图上选择一个我方区域。
        </p>
      )}

      <label>
        军事目标
        <select
          value={decision.targetRegionId ?? ""}
          onChange={(event) => onChange({ targetRegionId: event.target.value || null })}
        >
          <option value="">— 未设 —</option>
          {targets.map((targetId) => (
            <option key={targetId} value={targetId}>
              {state.regions[targetId].name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <strong className="side-panel-label">军事姿态</strong>
        <div className="segmented-control">
          {postureOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={decision.posture === value ? "is-active" : ""}
              onClick={() => onChange({ posture: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <strong className="side-panel-label">内政重点</strong>
        <div className="focus-grid">
          {focusOptions.map(([value]) => (
            <button
              key={value}
              type="button"
              className={decision.domesticFocus === value ? "is-active" : ""}
              onClick={() => onChange({ domesticFocus: value })}
              title={focusShort[value]}
            >
              {focusShort[value]}
            </button>
          ))}
        </div>
      </div>

      <label>
        <strong className="side-panel-label">改革法律（手选覆盖内政自动）</strong>
        <select
          value={decision.reformLawId ?? ""}
          onChange={(event) =>
            onChange({ reformLawId: (event.target.value || undefined) as PlayerDecision["reformLawId"] })
          }
        >
          <option value="">— 内政自动 —</option>
          {Object.values(lawLibrary).map((law) => {
            const enacted = isLawEnacted(state.activeModifiers, state.playerFactionId, law.id);
            const active = (state.activeReforms ?? []).some(
              (r) => r.factionId === state.playerFactionId && r.lawId === law.id,
            );
            return (
              <option key={law.id} value={law.id} disabled={enacted}>
                {law.name}
                {enacted ? "（已落实）" : active ? "（推进中）" : ""}
              </option>
            );
          })}
        </select>
      </label>

      {onSelectRegion && selectedRegionId && (
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => onSelectRegion(null)}
        >
          清除区域选择
        </Button>
      )}

      <DecisionPrediction state={state} decision={decision} />
    </section>
  );
}
