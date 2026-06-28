import { formatChineseDate } from "../../core/calendar";
import type { GameState } from "../../core/types";
import { StatBadge } from "../common/StatBadge";

interface TopBarProps {
  state: GameState;
  onAdvance: () => void;
}

export function TopBar({ state, onAdvance }: TopBarProps) {
  const faction = state.factions[state.playerFactionId];
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
      <button className="primary-button" onClick={onAdvance} disabled={state.gameStatus === "finished"}>
        推进一月
      </button>
    </header>
  );
}
