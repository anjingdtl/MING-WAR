import { useState } from "react";
import { factionTemplates } from "../../data/factions";
import portraitSheetUrl from "../../assets/art/ming-character-portraits.png";

interface StartDialogProps {
  onStart: (factionId: string, seed: number) => void;
}

export function StartDialog({ onStart }: StartDialogProps) {
  const [factionId, setFactionId] = useState("ming");
  const [seed, setSeed] = useState("157301");
  return (
    <section className="start-panel">
      <div className={`start-portrait start-portrait--${portraitKey(factionId)}`}>
        <img src={portraitSheetUrl} alt="" />
      </div>
      <div className="start-title">
        <h1>万历：山河崩塌</h1>
        <span>1573-1644</span>
      </div>
      <label>
        选择势力
        <select value={factionId} onChange={(event) => setFactionId(event.target.value)}>
          {["ming", "tumed", "jianzhou"].map((id) => (
            <option key={id} value={id}>
              {factionTemplates[id].name}
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

function portraitKey(factionId: string): string {
  if (factionId === "ming") return "emperor";
  if (factionId === "jianzhou") return "khan";
  return "general";
}
