import type { GameEvent } from "../../core/eventEngine";
import eventScenesUrl from "../../assets/art/ming-event-scenes.png";

interface EventDialogProps {
  event: GameEvent | null;
  onResolve: (optionId: string) => void;
}

export function EventDialog({ event, onResolve }: EventDialogProps) {
  if (!event) return null;
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <section className="event-dialog">
        <div className={`event-art event-art--${sceneKey(event)}`}>
          <img src={eventScenesUrl} alt="" />
        </div>
        <div className="event-copy">
          <span>{categoryLabel(event.category)}</span>
          <h2>{event.name}</h2>
          <p>{event.description}</p>
        </div>
        <div className="event-options">
          {event.options.map((option) => (
            <button key={option.id} onClick={() => onResolve(option.id)}>
              <strong>{option.name}</strong>
              <span>{option.shortEffect}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function sceneKey(event: GameEvent): string {
  if (event.category === "region" || event.id.includes("campaign")) return "frontier";
  if (event.id.includes("saarhu") || event.id.includes("jianzhou")) return "frontier";
  if (event.id.includes("reform") || event.id.includes("zhang")) return "court";
  return "famine";
}

function categoryLabel(category: GameEvent["category"]): string {
  switch (category) {
    case "region":
      return "区域事件";
    case "faction":
      return "朝局事件";
    case "chain":
      return "历史链";
    case "global":
      return "天下大势";
    case "fixed":
      return "定期事件";
    case "conditional":
      return "局势事件";
  }
}
