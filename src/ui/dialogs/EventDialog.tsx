import type { GameEvent } from "../../core/eventEngine";
import { resolveEventVisual } from "../../data/eventVisuals";
import { resolveEventCharacters, resolveEventScene } from "../../data/artCatalog";

interface EventDialogProps {
  event: GameEvent | null;
  onResolve: (optionId: string) => void;
}

export function EventDialog({ event, onResolve }: EventDialogProps) {
  if (!event) return null;
  const visual = resolveEventVisual(event);
  const scene = resolveEventScene(event);
  const characters = resolveEventCharacters(event);

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <section className="event-dialog">
        <div className={`event-art event-art--${visual.type}`} data-visual-type={visual.type}>
          <img src={scene.src} alt={scene.alt} />
        </div>
        {characters.length > 0 ? (
          <div className="event-characters" aria-label="事件人物">
            {characters.map((character) => (
              <figure key={character.id} className="event-character">
                <img
                  src={character.src}
                  alt={character.alt}
                  style={{ objectPosition: character.objectPosition }}
                />
                <figcaption>
                  <strong>{character.label}</strong>
                  <span>{character.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
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
