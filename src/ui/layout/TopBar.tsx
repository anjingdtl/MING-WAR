import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { formatChineseDate } from "../../core/calendar";
import type { GameState } from "../../core/types";
import { cliqueTemplates } from "../../data/cliques";
import { StatBadge } from "../common/StatBadge";

interface TopBarProps {
  state: GameState;
  onAdvance: () => void;
}

export function TopBar({ state, onAdvance }: TopBarProps) {
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
    <header className="top-bar">
      <div>
        <strong>{formatChineseDate(state.currentDate)}</strong>
        <span className="era-label">万历朝推演</span>
      </div>
      <StatBadge label="国库" value={Math.round(faction.treasury).toLocaleString()} tone={faction.treasury < 0 ? "danger" : "default"} />
      <StatBadge label="粮食" value={Math.round(faction.grainReserve).toLocaleString()} tone={faction.grainReserve < 0 ? "danger" : "default"} />
      <StatBadge label="军队" value={Math.round(faction.armyTotal).toLocaleString()} />
      <StatBadge label="疲劳" value={faction.warExhaustion} tone={faction.warExhaustion > 60 ? "warning" : "default"} />
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
                ? `${minDef.name}极度不满（支持度 ${minClique!.support}）`
                : `${minDef.name}不满（支持度 ${minClique!.support}）`}
            </div>
          )}
        </div>
      )}
      <button className="primary-button" onClick={onAdvance} disabled={state.gameStatus === "finished"}>
        推进一月
      </button>
    </header>
  );
}
