import { useCallback, useEffect, useMemo, useState } from "react";
import { mvpEvents } from "../data/events";
import { TopBar } from "../ui/layout/TopBar";
import { SidePanel, type SidePanelTab } from "../ui/layout/SidePanel";
import { EventDialog } from "../ui/dialogs/EventDialog";
import { MainMenu } from "../ui/dialogs/MainMenu";
import { TutorialDialog } from "../ui/dialogs/TutorialDialog";
import { HelpModal } from "../ui/dialogs/HelpModal";
import { GameMap } from "../ui/map/GameMap";
import { LogPanel } from "../ui/panels/LogPanel";
import { LensBar } from "../ui/lens/LensBar";
import { LENS_BY_ID, type LensId } from "../ui/lens/lensDefinitions";
import { useGameStore } from "../store/gameStore";
import { useUiStore } from "../store/uiStore";
import { useGameViewStore } from "../store/gameViewStore";
import { useHotkeys } from "../ui/hooks/useHotkeys";

const TUTORIAL_KEY = "mingwar:tutorial-seen";

const LENS_ORDER: LensId[] = ["control", "economy", "military", "people", "court"];

export function App() {
  // v0.6-stability §3.4 / §4.6：精确选择器订阅，避免整 store 触发重渲染
  const startGame = useGameStore((s) => s.startGame);
  const loadGameFromSave = useGameStore((s) => s.loadGameFromSave);
  const advanceOneMonth = useGameStore((s) => s.advanceOneMonth);
  const resolveEvent = useGameStore((s) => s.resolveEvent);
  const setDecision = useGameStore((s) => s.setDecision);
  const state = useGameStore((s) => s.state);
  const decision = useGameViewStore((s) => s.decision);
  const reports = useGameViewStore((s) => s.reports);
  const pendingEventId = useUiStore((s) => s.pendingEventId);
  const mapLayer = useUiStore((s) => s.mapLayer);
  const setMapLayer = useUiStore((s) => s.setMapLayer);
  const selectedRegionId = useUiStore((s) => s.selectedRegionId);
  const selectRegion = useUiStore((s) => s.selectRegion);
  const pendingEvent = mvpEvents.find((event) => event.id === pendingEventId) ?? null;
  const [mainMenuOpen, setMainMenuOpen] = useState(true);

  // Phase 5: Tutorial 状态
  const [tutorialOpen, setTutorialOpen] = useState(() => {
    try {
      return !localStorage.getItem(TUTORIAL_KEY);
    } catch {
      return true;
    }
  });

  // Phase 6: Help modal
  const [helpOpen, setHelpOpen] = useState(false);

  // 提供开发者入口
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tutorial") === "1") {
      setTutorialOpen(true);
    }
    if (params.get("help") === "1") {
      setHelpOpen(true);
    }
  }, []);

  // Phase 2: 侧滑详情面板
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidePanelTab>("region");

  // Phase 3: 当前 Lens
  const [lens, setLens] = useState<LensId>("control");

  // Lens 切换时同步 mapLayer
  useEffect(() => {
    const def = LENS_BY_ID[lens];
    if (def.mapLayer && def.mapLayer !== mapLayer) {
      setMapLayer(def.mapLayer);
    }
    setActiveTab(def.defaultTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens]);

  // Phase 6: 集中快捷键管理
  const hotkeys = useMemo(
    () => [
      {
        key: "?",
        handler: () => setHelpOpen(true)
      },
      {
        key: "f",
        handler: () => setSidePanelOpen((v) => !v)
      },
      {
        key: "F",
        handler: () => setSidePanelOpen((v) => !v)
      },
      {
        key: "Escape",
        handler: () => {
          if (helpOpen) setHelpOpen(false);
          else if (sidePanelOpen) setSidePanelOpen(false);
        }
      },
      ...LENS_ORDER.map((lensId, idx) => ({
        key: String(idx + 1),
        handler: () => {
          setLens(lensId);
          if (!sidePanelOpen) setSidePanelOpen(true);
        }
      }))
    ],
    [sidePanelOpen, helpOpen]
  );

  useHotkeys(tutorialOpen || mainMenuOpen ? [] : hotkeys);

  /* ---- stable callbacks for memoized children ---- */
  const toggleSidePanel = useCallback(() => setSidePanelOpen((v) => !v), []);
  const closeSidePanel = useCallback(() => setSidePanelOpen(false), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const completeTutorialCb = useCallback(() => {
    try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch { /* ignore */ }
    setTutorialOpen(false);
  }, []);
  const handleMenuStart = useCallback(() => {
    startGame("ming", 157301);
    setMainMenuOpen(false);
  }, [startGame]);
  const handleMenuLoad = useCallback(
    async (saveId: string) => {
      const ok = await loadGameFromSave(saveId);
      if (ok) setMainMenuOpen(false);
    },
    [loadGameFromSave]
  );
  const handleRegionSelect = useCallback(
    (id: string) => {
      selectRegion(id);
      setActiveTab("region");
      setSidePanelOpen((v) => (v ? v : true));
    },
    [selectRegion]
  );

  return (
    <main className="app-shell">
      {mainMenuOpen && <MainMenu onStart={handleMenuStart} onLoad={handleMenuLoad} />}
      <TopBar
        state={state}
        onAdvance={advanceOneMonth}
        sidePanelOpen={sidePanelOpen}
        onToggleSidePanel={toggleSidePanel}
      />
      <div className="map-stage">
        <LensBar current={lens} onChange={setLens} />
        <GameMap
          state={state}
          layer={mapLayer}
          onLayerChange={setMapLayer}
          selectedRegionId={selectedRegionId}
          onSelect={handleRegionSelect}
          lens={lens}
        />
        <LogPanel reports={reports} />
        <SidePanel
          state={state}
          decision={decision}
          onDecisionChange={setDecision}
          selectedRegionId={selectedRegionId}
          onSelectRegion={selectRegion}
          open={sidePanelOpen}
          onClose={closeSidePanel}
          initialTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
      <EventDialog event={pendingEvent} onResolve={resolveEvent} />
      {tutorialOpen && !mainMenuOpen && (
        <TutorialDialog onComplete={completeTutorialCb} onSkip={completeTutorialCb} />
      )}
      <HelpModal open={helpOpen} onClose={closeHelp} />
    </main>
  );
}
