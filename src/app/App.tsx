import { mvpEvents } from "../data/events";
import { TopBar } from "../ui/layout/TopBar";
import { EventDialog } from "../ui/dialogs/EventDialog";
import { StartDialog } from "../ui/dialogs/StartDialog";
import { GameMap } from "../ui/map/GameMap";
import { LogPanel } from "../ui/panels/LogPanel";
import { useGameStore } from "../store/gameStore";

export function App() {
  const store = useGameStore();
  const pendingEvent = mvpEvents.find((event) => event.id === store.pendingEventId) ?? null;
  return (
    <main className="app-shell">
      <StartDialog onStart={store.startGame} />
      <TopBar state={store.state} onAdvance={store.advanceOneMonth} />
      <div className="map-stage">
        <GameMap
          state={store.state}
          layer={store.mapLayer}
          onLayerChange={store.setMapLayer}
          decision={store.decision}
          onDecisionChange={store.setDecision}
          selectedRegionId={store.selectedRegionId}
          onSelect={store.selectRegion}
        />
        <LogPanel reports={store.state.reports} />
      </div>
      <EventDialog event={pendingEvent} onResolve={store.resolveEvent} />
    </main>
  );
}
