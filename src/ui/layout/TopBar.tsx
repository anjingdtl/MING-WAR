import { AlertTriangle, PanelRight } from "lucide-react";
import { useState } from "react";
import { formatChineseDate } from "../../core/calendar";
import type { GameState } from "../../core/types";
import { cliqueTemplates } from "../../data/cliques";
import { Button } from "../common/Button";
import { StatBadge } from "../common/StatBadge";

interface TopBarProps {
  state: GameState;
  onAdvance: () => void;
  sidePanelOpen: boolean;
  onToggleSidePanel: () => void;
}

export function TopBar({ state, onAdvance, sidePanelOpen, onToggleSidePanel }: TopBarProps) {
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
      <div>
        <strong>{formatChineseDate(state.currentDate)}</strong>
        <span className="era-label">万历朝推演</span>
      </div>
      <StatBadge
        label="国库"
        value={faction.treasury}
        format="wan"
        thresholds={{ danger: 0, warning: 1000 }}
        title="国库存银(万两)"
      />
      <StatBadge
        label="粮食"
        value={faction.grainReserve}
        format="wan"
        thresholds={{ danger: 0, warning: 5000 }}
        title="粮储(万石)"
      />
      <StatBadge
        label="军队"
        value={faction.armyTotal}
        format="wan"
        title="全军兵力(万)"
      />
      <StatBadge
        label="民望"
        value={faction.legitimacy}
        thresholds={{ danger: 20, warning: 40 }}
        title="朝廷合法性(0-100)"
      />
      <StatBadge
        label="天命"
        value={faction.centralization}
        thresholds={{ danger: 20, warning: 40 }}
        title="中央集权(0-100)"
      />
      <StatBadge
        label="疲劳"
        value={faction.warExhaustion}
        tone={faction.warExhaustion > 60 ? "warning" : "default"}
        title="战争疲劳(0-100)"
      />
      {warnLevel !== "none" && minDef && (
        <div
          className={`clique-warn clique-warn--${warnLevel}`}
          onMouseEnter={() => setShowCliqueWarn(true)}
          onMouseLeave={() => setShowCliqueWarn(false)}
          style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "default" }}
        >
          <AlertTriangle
            size={18}
            color={warnLevel === "danger" ? "#b04436" : "#b98935"}
          />
          {showCliqueWarn && (
            <div className="clique-warn__tooltip">
              {warnLevel === "danger"
                ? `${minDef.name}极度不满(支持度 ${minClique!.support})`
                : `${minDef.name}不满(支持度 ${minClique!.support})`}
            </div>
          )}
        </div>
      )}
      <Button
        variant="primary"
        size="md"
        onClick={onAdvance}
        disabled={state.gameStatus === "finished"}
      >
        推进一月
      </Button>
      <Button
        variant={sidePanelOpen ? "secondary" : "tertiary"}
        size="md"
        onClick={onToggleSidePanel}
        iconLeft={<PanelRight aria-hidden="true" size={16} />}
        aria-pressed={sidePanelOpen}
        title={sidePanelOpen ? "关闭详情面板" : "打开详情面板"}
      >
        {sidePanelOpen ? "收起详情" : "展开详情"}
      </Button>
    </header>
  );
}
