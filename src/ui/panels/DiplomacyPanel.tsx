import type { GameState, TreatyType } from "../../core/types";
import { getRelation } from "../../core/diplomacy";
import { Button } from "../common/Button";
import { useGameStore } from "../../store/gameStore";

/**
 * S6 遗留#3/#2：外交面板（可交互）。
 *
 * 显示玩家势力与其他 active 势力的关系、条约、停战剩余月，以及进行中的战争。
 * 玩家可主动「缔结同盟」（关系≥20 且非停战/盟友）与「求和」（白和结束战争）。
 */
const TREATY_LABEL: Record<TreatyType, string> = {
  alliance: "同盟",
  tribute: "朝贡",
  trade: "互市",
  vassal: "附庸",
  truce: "停战",
};

function relationLabel(relation: number): string {
  if (relation >= 50) return "友善";
  if (relation >= 20) return "平和";
  if (relation >= -20) return "冷淡";
  if (relation >= -50) return "紧张";
  return "敌对";
}

export function DiplomacyPanel({ state }: { state: GameState }) {
  const proposeAlliance = useGameStore((s) => s.proposeAlliance);
  const requestPeace = useGameStore((s) => s.requestPeace);
  const playerId = state.playerFactionId;
  const others = Object.values(state.factions).filter(
    (f) => f.id !== playerId && f.status === "active",
  );
  const playerWars = state.wars.filter(
    (w) => w.attackerFactionId === playerId || w.defenderFactionId === playerId,
  );

  return (
    <section className="side-panel">
      <h2>外交与战局</h2>
      <p className="muted">与他国的关系、条约及进行中的战争。可主动结盟或求和。</p>
      <ul className="diplomacy-list">
        {others.map((f) => {
          const rel = getRelation(state, playerId, f.id);
          const relation = rel ? Math.round(rel.relation) : 0;
          const treaties = rel?.treaties ?? [];
          const truce = rel?.truceMonths ?? 0;
          const label = relationLabel(relation);
          const canAlly =
            !!rel &&
            rel.truceMonths === 0 &&
            !rel.treaties.includes("alliance") &&
            rel.relation >= 20;
          return (
            <li key={f.id} className="diplomacy-item">
              <header>
                <span className="diplomacy-item__name">{f.name}</span>
                <span className={`diplomacy-item__relation relation--${label}`}>
                  {label}（{relation}）
                </span>
              </header>
              <p className="muted">
                军力 {f.armyTotal.toLocaleString()}
                {treaties.length > 0 && ` · ${treaties.map((t) => TREATY_LABEL[t]).join("、")}`}
                {truce > 0 && ` · 停战 ${truce} 月`}
              </p>
              {canAlly && (
                <Button size="sm" variant="tertiary" onClick={() => proposeAlliance(f.id)}>
                  缔结同盟
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {playerWars.length > 0 && (
        <>
          <strong className="side-panel-label">进行中的战争</strong>
          <ul className="diplomacy-wars">
            {playerWars.map((w) => {
              const opponentId =
                w.attackerFactionId === playerId ? w.defenderFactionId : w.attackerFactionId;
              const opponent = state.factions[opponentId];
              const role = w.attackerFactionId === playerId ? "攻" : "守";
              const support =
                w.attackerFactionId === playerId
                  ? w.front?.attackerWarSupport
                  : w.front?.defenderWarSupport;
              return (
                <li key={w.id} className="diplomacy-war">
                  <div>
                    <span>{role}战 · {opponent?.name ?? opponentId}</span>
                    <span className="muted">
                      进度 {Math.round(w.progress)}%
                      {support !== undefined ? ` · 支持 ${Math.round(support)}` : ""}
                    </span>
                  </div>
                  <Button size="sm" variant="tertiary" onClick={() => requestPeace(w.id)}>
                    求和
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
