import { Swords } from "lucide-react";
import type { ReactNode } from "react";
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
import { DiplomacyPanel } from "./DiplomacyPanel";
import { Tooltip } from "../common/Tooltip";

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

      {/* v0.9.5: 5 个军事 KPI 卡（动员池/仓储/在途/战伤/围城） */}
      <MilitaryKpis state={state} />

      <DiplomacyPanel state={state} />
    </section>
  );
}

/**
 * v0.9.5: 5 个军事 KPI 卡片 —— 让"动员池/仓储/在途/战伤/围城"在玩家面板上
 * 可见。从 FactionState / RegionState / activeWars / activeConvoys 聚合。
 */
function MilitaryKpis({ state }: { state: GameState }) {
  const playerFaction = state.factions[state.playerFactionId];
  if (!playerFaction) return null;

  // 1. 动员池：mobilizationPool / (armyTotal × 1.5)
  const poolCap = playerFaction.armyTotal * 1.5;
  const poolPct = poolCap > 0 ? Math.round((playerFaction.mobilizationPool / poolCap) * 100) : 0;

  // 2. 仓储：玩家所有控制区 depotStock 之和
  const depotTotal = Object.values(state.regions)
    .filter((r) => r.controllerFactionId === state.playerFactionId)
    .reduce((sum, r) => sum + (r.logisticsNode?.depotStock ?? 0), 0);

  // 3. 在途：activeConvoys 数
  const inFlight = (state.activeConvoys ?? [])
    .filter((c) => c.factionId === state.playerFactionId).length;

  // 4. 战伤：warFatigue（v0.9.4）
  const fatigue = playerFaction.warFatigue ?? 0;
  const fatigueLabel =
    fatigue < 70 ? "未起" :
    fatigue < 100 ? "厌战苗头" :
    fatigue < 130 ? "厌战激化" : "厌战极限";

  // 5. 围城：玩家为 attacker 或 defender 的 wars
  const underSiege = state.wars.filter(
    (w) => w.attackerFactionId === state.playerFactionId || w.defenderFactionId === state.playerFactionId,
  ).length;

  return (
    <div className="military-kpis" data-testid="military-kpis">
      <h3>军事态势 (v0.9.5)</h3>
      <div className="kpi-grid">
        <KpiCard
          label="动员池"
          value={`${poolPct}%`}
          hint={`${playerFaction.mobilizationPool.toLocaleString()} / ${poolCap.toLocaleString()}`}
          tooltip="mobilizationPool / (armyTotal × 1.5)。反映当前可立即投入战线的兵员比例；受征募速度、财政与战争损耗影响。"
        />
        <KpiCard
          label="仓储"
          value={depotTotal.toLocaleString()}
          hint="本方控制区粮秣"
          tooltip="本方控制区 logisticsNode.depotStock 之和。仓储越高，前线围城与持续作战的补给压力越小。"
        />
        <KpiCard
          label="在途"
          value={String(inFlight)}
          hint="补给车队"
          tooltip="本方活跃 SupplyConvoy 数量。车队每月向目标地区 depotStock 注入粮秣，距离越远损耗越大。"
        />
        <KpiCard
          label="战伤"
          value={`${Math.round(fatigue)}`}
          hint={fatigueLabel}
          tooltip="faction.warFatigue 累计值。≥70 出现厌战苗头，≥100 触发 warWear 政治运动（稳定性下降、国库流失）。"
        />
        <KpiCard
          label="围城"
          value={String(underSiege)}
          hint="活跃战线"
          tooltip="玩家作为进攻方或防守方的活跃 war 数量。数量越高，同时维持的围城/战线压力越大。"
        />
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint, tooltip }: { label: string; value: string; hint: string; tooltip: ReactNode }) {
  return (
    <Tooltip content={tooltip} placement="top" variant="info">
      <div className="kpi-card" data-testid={`kpi-${label}`}>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-hint">{hint}</div>
      </div>
    </Tooltip>
  );
}
