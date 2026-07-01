import {
  AlertTriangle,
  CalendarDays,
  ChevronsRight,
  Coins,
  Crown,
  Flame,
  PanelRight,
  Shield,
  Users,
  Wheat
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { memo, useState } from "react";
import { formatChineseDate } from "../../core/calendar";
import type { GameState } from "../../core/types";
import { cliqueTemplates } from "../../data/cliques";

interface TopBarProps {
  state: GameState;
  onAdvance: () => void;
  sidePanelOpen: boolean;
  onToggleSidePanel: () => void;
}

interface ResourcePillProps {
  label: string;
  value: string;
  title: string;
  Icon: LucideIcon;
  tone?: "default" | "warning" | "danger";
}

function formatWan(value: number): string {
  return `${(value / 10000).toFixed(1)}万`;
}

function thresholdTone(value: number, warning: number, danger: number): ResourcePillProps["tone"] {
  if (value <= danger) return "danger";
  if (value <= warning) return "warning";
  return "default";
}

function ResourcePill({ label, value, title, Icon, tone = "default" }: ResourcePillProps) {
  return (
    <div className={`hud-resource hud-resource--${tone}`} title={title} aria-label={`${label}: ${value}`}>
      <Icon aria-hidden="true" size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export const TopBar = memo(function TopBar({ state, onAdvance, sidePanelOpen, onToggleSidePanel }: TopBarProps) {
  const faction = state.factions[state.playerFactionId];
  const [showCliqueWarn, setShowCliqueWarn] = useState(false);

  // Find lowest-support clique
  const cliques = faction.cliques ?? [];
  const minClique = cliques.length
    ? cliques.reduce((min, c) => (c.support < min.support ? c : min), cliques[0])
    : null;
  const minDef = minClique ? cliqueTemplates[minClique.cliqueId] : null;
  const warnLevel = !minClique ? "none" : minClique.support < 15 ? "danger" : minClique.support < 25 ? "warning" : "none";

  return (
    <header className="top-bar" aria-label="状态条">
      <div className="top-bar__date" title="当前日期">
        <CalendarDays aria-hidden="true" size={17} />
        <div>
          <strong>{formatChineseDate(state.currentDate)}</strong>
          <span>万历朝</span>
        </div>
      </div>
      <div className="top-bar__resources" aria-label="国势指标">
        <ResourcePill
          label="国库"
          value={formatWan(faction.treasury)}
          Icon={Coins}
          tone={thresholdTone(faction.treasury, 1000, 0)}
          title="国库存银(万两)"
        />
        <ResourcePill
          label="粮储"
          value={formatWan(faction.grainReserve)}
          Icon={Wheat}
          tone={thresholdTone(faction.grainReserve, 5000, 0)}
          title="粮储(万石)"
        />
        <ResourcePill label="军队" value={formatWan(faction.armyTotal)} Icon={Shield} title="全军兵力(万)" />
        <ResourcePill
          label="民望"
          value={String(faction.legitimacy)}
          Icon={Users}
          tone={thresholdTone(faction.legitimacy, 40, 20)}
          title="朝廷合法性(0-100)"
        />
        <ResourcePill
          label="天命"
          value={String(faction.centralization)}
          Icon={Crown}
          tone={thresholdTone(faction.centralization, 40, 20)}
          title="中央集权(0-100)"
        />
        <ResourcePill
          label="疲劳"
          value={String(faction.warExhaustion)}
          Icon={Flame}
          tone={faction.warExhaustion > 60 ? "warning" : "default"}
          title="战争疲劳(0-100)"
        />
      </div>
      <div className="top-bar__actions">
        {warnLevel !== "none" && minDef && (
          <div
            className={`clique-warn clique-warn--${warnLevel}`}
            onMouseEnter={() => setShowCliqueWarn(true)}
            onMouseLeave={() => setShowCliqueWarn(false)}
          >
            <AlertTriangle aria-hidden="true" size={17} />
            <span className="visually-hidden">朝堂警报</span>
            {showCliqueWarn && (
              <div className="clique-warn__tooltip">
                {warnLevel === "danger"
                  ? `${minDef.name}极度不满(支持度 ${minClique!.support})`
                  : `${minDef.name}不满(支持度 ${minClique!.support})`}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="hud-icon-button hud-icon-button--advance"
          onClick={onAdvance}
          disabled={state.gameStatus === "finished"}
          title="推进一月"
        >
          <ChevronsRight aria-hidden="true" size={18} />
          <span className="hud-action-label">一月</span>
        </button>
        <button
          type="button"
          className={`hud-icon-button ${sidePanelOpen ? "is-active" : ""}`}
          onClick={onToggleSidePanel}
          aria-pressed={sidePanelOpen}
          title={sidePanelOpen ? "关闭详情面板" : "打开详情面板"}
        >
          <PanelRight aria-hidden="true" size={18} />
          <span className="visually-hidden">{sidePanelOpen ? "关闭详情面板" : "打开详情面板"}</span>
        </button>
      </div>
    </header>
  );
});
