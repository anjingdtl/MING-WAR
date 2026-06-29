import type { GameState, PlayerDecision } from "../../core/types";
import {
  projectFinancials,
  projectGrainChange,
  projectCampaign,
  projectCliqueReactions
} from "../lens/predictions";
import { GoldDivider } from "../common/decor/GoldDivider";

interface DecisionPredictionProps {
  state: GameState;
  decision: PlayerDecision;
}

/**
 * 决策预测面板 — Phase 4
 *
 * 借鉴 V3 的"切换政策前显示后果",在决策面板底部展示:
 *  - 下月财政预估
 *  - 粮储变化预估
 *  - 军略胜率(若设置了目标)
 *  - 派系反应(已部分实现,这里完整化)
 */
export function DecisionPrediction({ state, decision }: DecisionPredictionProps) {
  const faction = state.factions[state.playerFactionId];
  if (!faction) return null;

  const financial = projectFinancials(state, decision);
  const grainChange = projectGrainChange(state, decision);
  const campaign = projectCampaign(state, decision);
  const cliques = projectCliqueReactions(faction, decision);

  return (
    <section className="decision-prediction" aria-label="决策预测">
      <header className="decision-prediction__header">
        <strong>下月预估</strong>
        <span className="decision-prediction__note">基于当前态势推算,实际可能受事件影响</span>
      </header>

      <GoldDivider length="100%" />

      <div className="decision-prediction__grid">
        <div className="prediction-cell">
          <span className="prediction-cell__label">税入</span>
          <strong className="prediction-cell__value">{financial.taxIncome}两</strong>
        </div>
        <div className="prediction-cell">
          <span className="prediction-cell__label">军费</span>
          <strong className="prediction-cell__value negative">-{financial.militaryCost}两</strong>
        </div>
        <div className="prediction-cell">
          <span className="prediction-cell__label">净流</span>
          <strong
            className={`prediction-cell__value ${
              financial.netFlow > 0 ? "positive" : financial.netFlow < 0 ? "negative" : ""
            }`}
          >
            {financial.netFlow > 0 ? "+" : ""}
            {financial.netFlow}两
          </strong>
        </div>
        <div className="prediction-cell">
          <span className="prediction-cell__label">粮变</span>
          <strong
            className={`prediction-cell__value ${
              grainChange > 0 ? "positive" : grainChange < 0 ? "negative" : ""
            }`}
          >
            {grainChange > 0 ? "+" : ""}
            {grainChange}石
          </strong>
        </div>
      </div>

      {campaign && (
        <div className="decision-prediction__campaign">
          <strong>军略:{campaign.targetName}</strong>
          <div className="campaign-meter">
            <div
              className={`campaign-meter__fill ${
                campaign.winChance > 0.6 ? "high" : campaign.winChance > 0.4 ? "mid" : "low"
              }`}
              style={{ width: `${Math.round(campaign.winChance * 100)}%` }}
            />
          </div>
          <div className="campaign-meter__legend">
            <span>预估胜率 {Math.round(campaign.winChance * 100)}%</span>
            <span>约 {campaign.estimatedMonths} 月</span>
          </div>
          <p className="campaign-meter__reason">{campaign.reasoning}</p>
        </div>
      )}

      {cliques.cliques.length > 0 && cliques.cliques.some((c) => c.delta !== 0) && (
        <div className="decision-prediction__cliques">
          <strong>派系反应</strong>
          <ul>
            {cliques.cliques.map((c) => (
              <li key={c.id}>
                <span>{c.id}</span>
                <span
                  className={
                    c.delta > 0 ? "positive" : c.delta < 0 ? "negative" : ""
                  }
                >
                  {c.delta > 0 ? `+${c.delta}` : c.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
