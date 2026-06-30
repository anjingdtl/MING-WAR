import type { GameState, TreatyType } from "../../core/types";
import { getRelation } from "../../core/diplomacy";

/**
 * S6 遗留#3：外交信息面板（只读）。
 *
 * 显示玩家势力与其他 active 势力的关系、条约、停战剩余月，以及进行中的
 * 战争（角色/进度/战争支持度）。让玩家看清外交全局与战局态势。
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
      <p className="muted">与他国的关系、条约及进行中的战争。</p>
      <ul className="diplomacy-list">
        {others.map((f) => {
          const rel = getRelation(state, playerId, f.id);
          const relation = rel ? Math.round(rel.relation) : 0;
          const treaties = rel?.treaties ?? [];
          const truce = rel?.truceMonths ?? 0;
          const label = relationLabel(relation);
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
                  <span>{role}战 · {opponent?.name ?? opponentId}</span>
                  <span className="muted">
                    进度 {Math.round(w.progress)}%
                    {support !== undefined ? ` · 支持 ${Math.round(support)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
