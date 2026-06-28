import type { GameEvent } from "../../core/eventEngine";

interface EventDialogProps {
  event: GameEvent | null;
  onResolve: (optionId: string) => void;
}

export function EventDialog({ event, onResolve }: EventDialogProps) {
  if (!event) return null;
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <section className="event-dialog">
        <h2>{event.name}</h2>
        <p>{event.description}</p>
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
