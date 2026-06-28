import { mvpEvents } from "../data/events";
import { TopBar } from "../ui/layout/TopBar";
import { EventDialog } from "../ui/dialogs/EventDialog";
import { StartDialog } from "../ui/dialogs/StartDialog";
import { GameMap } from "../ui/map/GameMap";
import { DecisionPanel } from "../ui/panels/DecisionPanel";
import { LogPanel } from "../ui/panels/LogPanel";
import { RegionPanel } from "../ui/panels/RegionPanel";
import { useGameStore } from "../store/gameStore";

export function App() {
  const store = useGameStore();
  const pendingEvent = mvpEvents.find((event) => event.id === store.pendingEventId) ?? null;
  return (
    <main className="app-shell">
      <StartDialog onStart={store.startGame} />
      <TopBar state={store.state} onAdvance={store.advanceOneMonth} />
      <div className="main-grid">
        <DecisionPanel state={store.state} decision={store.decision} onChange={store.setDecision} />
        <GameMap
          state={store.state}
          layer={store.mapLayer}
          selectedRegionId={store.selectedRegionId}
          onSelect={store.selectRegion}
        />
        <RegionPanel state={store.state} selectedRegionId={store.selectedRegionId} />
      </div>
      <LogPanel reports={store.state.reports} />
      <EventDialog event={pendingEvent} onResolve={store.resolveEvent} />
    </main>
  );
}
