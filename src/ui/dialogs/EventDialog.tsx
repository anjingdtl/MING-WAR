import type { GameEvent } from "../../core/eventEngine";
import { resolveEventVisual, type EventVisualType } from "../../data/eventVisuals";
import disasterUrl from "../../assets/art/event-disaster.png";
import diplomaticUrl from "../../assets/art/event-diplomatic.png";
import economicUrl from "../../assets/art/event-economic.png";
import frontierUrl from "../../assets/art/event-frontier.png";
import intrigueUrl from "../../assets/art/event-intrigue.png";
import militaryUrl from "../../assets/art/event-military.png";
import politicalUrl from "../../assets/art/event-political.png";
import popularUrl from "../../assets/art/event-popular.png";

interface EventDialogProps {
  event: GameEvent | null;
  onResolve: (optionId: string) => void;
}

const eventIllustrations: Record<EventVisualType, string> = {
  political: politicalUrl,
  popular: popularUrl,
  military: militaryUrl,
  disaster: disasterUrl,
  economic: economicUrl,
  diplomatic: diplomaticUrl,
  frontier: frontierUrl,
  intrigue: intrigueUrl
};

export function EventDialog({ event, onResolve }: EventDialogProps) {
  if (!event) return null;
  const visual = resolveEventVisual(event);

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <section className="event-dialog">
        <div className={`event-art event-art--${visual.type}`} data-visual-type={visual.type}>
          <img src={eventIllustrations[visual.assetKey]} alt={visual.alt} />
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
