import { useState } from "react";
import { factionTemplates } from "../../data/factions";
import { resolveFactionLeaderPortrait } from "../../data/artCatalog";

interface StartDialogProps {
  onStart: (factionId: string, seed: number) => void;
}

export function StartDialog({ onStart }: StartDialogProps) {
  const [factionId, setFactionId] = useState("ming");
  const [seed, setSeed] = useState("157301");
  const leaderPortrait = resolveFactionLeaderPortrait(factionId);
  return (
    <section className="start-panel">
      <div className="start-portrait">
        <img
          src={leaderPortrait.src}
          alt={leaderPortrait.alt}
          style={{ objectPosition: leaderPortrait.objectPosition }}
        />
      </div>
      <div className="start-title">
        <h1>万历：山河崩塌</h1>
        <span>1573-1644</span>
      </div>
      <label>
        选择势力
        <select value={factionId} onChange={(event) => setFactionId(event.target.value)}>
          {Object.values(factionTemplates).map((faction) => (
            <option key={faction.id} value={faction.id}>
              {faction.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        随机种子
        <input value={seed} onChange={(event) => setSeed(event.target.value)} />
      </label>
      <button className="primary-button" onClick={() => onStart(factionId, Number(seed) || 157301)}>
        开始推演
      </button>
    </section>
  );
}
