import { useState } from "react";
import type { CliqueDef, FactionCliqueState } from "../../core/types";

interface CliqueBarProps {
  cliques: FactionCliqueState[];
  cliqueDefs: Record<string, CliqueDef>;
}

function supportColor(support: number): string {
  if (support > 60) return "#4a7c59";
  if (support >= 40) return "#8a7a3a";
  return "#8a3a3a";
}

function formatModifier(mod: number): string {
  if (mod > 0) return `+${mod}`;
  if (mod < 0) return `${mod}`;
  return "0";
}

export function CliqueBar({ cliques, cliqueDefs }: CliqueBarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="clique-bar" aria-label="朝堂派系">
      <strong className="clique-bar__title">朝堂</strong>
      <div className="clique-bar__grid">
        {cliques.map((cs) => {
          const def = cliqueDefs[cs.cliqueId];
          if (!def) return null;
          const isHovered = hoveredId === cs.cliqueId;
          return (
            <div
              key={cs.cliqueId}
              className="clique-card"
              onMouseEnter={() => setHoveredId(cs.cliqueId)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="clique-card__header">
                <span className="clique-card__name">{def.shortName}</span>
                <span className="clique-card__support">{cs.support}</span>
                <span
                  className="clique-card__modifier"
                  style={{ color: cs.activeModifier > 0 ? "#4a7c59" : cs.activeModifier < 0 ? "#8a3a3a" : "#66594c" }}
                >
                  {formatModifier(cs.activeModifier)}
                </span>
              </div>
              <div className="clique-card__bar">
                <div
                  className="clique-card__bar-fill"
                  style={{
                    width: `${cs.support}%`,
                    backgroundColor: supportColor(cs.support),
                  }}
                />
              </div>
              {isHovered && (
                <div className="clique-card__tooltip">
                  <p className="clique-card__full-name">{def.name}</p>
                  <p className="clique-card__desc">{def.description}</p>
                  <p className="clique-card__stat">力量: {cs.strength}</p>
                  <p className="clique-card__stat">主张: {def.primaryTrait}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
