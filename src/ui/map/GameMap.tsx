import { useRef, useState, useCallback, useEffect } from "react";
import { Swords, Wheat, Landmark, Shield, Users, Gauge, Crown, Plus, Minus, RotateCcw } from "lucide-react";
import type { DomesticFocus, GameState, MapLayer, MilitaryPosture, PlayerDecision, RegionId } from "../../core/types";
import { getValidMilitaryTargets } from "../../core/decisions";
import { mapRegions } from "../../map/mapConfig";
import { eastAsiaLandPaths, majorRiverPaths } from "../../map/physicalMap";
import { CliqueBar } from "../panels/CliqueBar";
import { cliqueTemplates } from "../../data/cliques";
import { computeCliqueReactions, computeAdministrationModifier } from "../../core/clique";

/* ------------------------------------------------------------------ */
/*  constants                                                         */
/* ------------------------------------------------------------------ */

const focusOptions: Array<[DomesticFocus, string]> = [
  ["agriculture", "农桑"],
  ["finance", "财政"],
  ["military", "军备"],
  ["administration", "吏治"],
  ["recovery", "休养"],
  ["frontier", "边疆"]
];

const postureOptions: Array<[MilitaryPosture, string]> = [
  ["conservative", "守势"],
  ["balanced", "均衡"],
  ["aggressive", "攻势"]
];

const layerOptions: Array<[MapLayer, string, typeof Crown]> = [
  ["control", "势力", Crown],
  ["population", "人口", Users],
  ["grain", "粮食", Wheat],
  ["tax", "税力", Landmark],
  ["stability", "稳定", Gauge],
  ["army", "驻军", Shield]
];

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.12;
const DRAG_THRESHOLD_PX = 5;

interface DragState {
  active: boolean;
  moved: boolean;
  startX: number;
  startY: number;
  viewX: number;
  viewY: number;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

/* ------------------------------------------------------------------ */
/*  GameMap component                                                 */
/* ------------------------------------------------------------------ */

interface GameMapProps {
  state: GameState;
  layer: MapLayer;
  onLayerChange?: (layer: MapLayer) => void;
  decision?: PlayerDecision;
  onDecisionChange?: (decision: Partial<PlayerDecision>) => void;
  selectedRegionId: RegionId | null;
  onSelect: (regionId: RegionId) => void;
}

export function GameMap({
  state,
  layer,
  onLayerChange,
  decision,
  onDecisionChange,
  selectedRegionId,
  onSelect
}: GameMapProps) {
  /* ---- derived data -------------------------------------------------- */
  const selectedRegion = selectedRegionId ? state.regions[selectedRegionId] : null;
  const selectedFaction = selectedRegion ? state.factions[selectedRegion.controllerFactionId] : null;
  const isPlayerRegion = selectedFaction?.id === state.playerFactionId;
  const playerFaction = state.factions[state.playerFactionId];
  const validTargets = getValidMilitaryTargets(state, state.playerFactionId);
  const currentDecision = decision ?? {
    targetRegionId: null,
    posture: "balanced" as MilitaryPosture,
    domesticFocus: "administration" as DomesticFocus
  };

  /* ---- pan / zoom state --------------------------------------------- */
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const panelRef = useRef<HTMLElement>(null);

  /* drag state is stored in a ref so the document-level listener can
     always see the latest values without stale closures */
  const dragRef = useRef<DragState>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    viewX: 0,
    viewY: 0
  });

  /* flag that signals "a drag happened in the current pointer sequence" —
     consumed by click handlers to suppress region selection */
  const gestureFlagRef = useRef(false);

  /* ---- focus tooltip state ----------------------------------------- */
  const [focusTooltip, setFocusTooltip] = useState<DomesticFocus | null>(null);

  /* ---- document-level drag listeners (stable, registered once) ---- */
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        d.moved = true;
        gestureFlagRef.current = true;
      }
      if (d.moved) {
        setView((prev) => ({
          ...prev,
          x: d.viewX + dx,
          y: d.viewY + dy
        }));
      }
    };

    const onPointerUp = () => {
      dragRef.current.active = false;
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  /* ---- zoom helpers ------------------------------------------------- */
  const clampZoom = useCallback((val: number) => clamp(val, MIN_ZOOM, MAX_ZOOM), []);

  const applyZoom = useCallback(
    (nextZoom: number, cx?: number, cy?: number) => {
      setView((prev) => {
        const zoom = clampZoom(nextZoom);
        if (!panelRef.current || cx === undefined || cy === undefined) {
          return { ...prev, zoom };
        }
        const rect = panelRef.current.getBoundingClientRect();
        const relX = cx - rect.left;
        const relY = cy - rect.top;
        const scale = zoom / prev.zoom;
        return {
          zoom,
          x: relX - (relX - prev.x) * scale,
          y: relY - (relY - prev.y) * scale
        };
      });
    },
    [clampZoom]
  );

  const zoomIn = useCallback(() => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    applyZoom(view.zoom * ZOOM_STEP, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [view.zoom, applyZoom]);

  const zoomOut = useCallback(() => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    applyZoom(view.zoom / ZOOM_STEP, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [view.zoom, applyZoom]);

  const resetView = useCallback(() => setView({ x: 0, y: 0, zoom: 1 }), []);

  /* ---- event handlers on the map panel ----------------------------- */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
      applyZoom(view.zoom * delta, e.clientX, e.clientY);
    },
    [view.zoom, applyZoom]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    gestureFlagRef.current = false;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      viewX: view.x,
      viewY: view.y
    };
  }, [view.x, view.y]);

  /* ---- region click: suppress when a drag gesture happened -------- */
  const handleRegionAction = useCallback(
    (regionId: RegionId) => {
      if (gestureFlagRef.current) {
        gestureFlagRef.current = false;
        return;
      }
      onSelect(regionId);
    },
    [onSelect]
  );

  /* consume stale gesture flag on any click within the panel --------- */
  const handlePanelClick = useCallback(() => {
    gestureFlagRef.current = false;
  }, []);

  /* ---- render ------------------------------------------------------ */
  const transformStyle: React.CSSProperties = {
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
    transformOrigin: "0 0"
  };

  return (
    <section
      className="map-panel"
      aria-label="战略地图"
      ref={panelRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onClick={handlePanelClick}
    >
      {/* ---- viewport (all map layers live inside this) ------------- */}
      <div className="map-viewport" style={transformStyle}>
        <svg className="physical-layer" viewBox="0 0 900 620" aria-hidden="true">
          <rect className="map-sea" x="0" y="0" width="900" height="620" />
          {eastAsiaLandPaths.map((path, idx) => (
            <path key={`land-${idx}`} className="map-land" d={path} />
          ))}
        </svg>

        <svg className="route-layer" viewBox="0 0 900 620" aria-hidden="true">
          {mapRegions.flatMap((shape) => {
            const region = state.regions[shape.id];
            return region.connections
              .filter((cid) => shape.id < cid)
              .map((cid) => {
                const target = mapRegions.find((s) => s.id === cid);
                if (!target) return null;
                return (
                  <line
                    key={`${shape.id}-${cid}`}
                    x1={shape.labelX}
                    y1={shape.labelY}
                    x2={target.labelX}
                    y2={target.labelY}
                  />
                );
              });
          })}
        </svg>

        <svg className="political-layer" viewBox="0 0 900 620" role="img" aria-label="万历朝动态势力区划图">
          {mapRegions.map((shape) => {
            const region = state.regions[shape.id];
            const faction = state.factions[region.controllerFactionId];
            const opacity = layer === "control" ? Math.max(0.34, region.control / 100) : 0.72;
            const lblW = shape.labelWidth ?? 96;

            return (
              <g
                key={shape.id}
                data-testid={`region-${shape.id}`}
                className={[
                  "political-region",
                  shape.isEnclave ? "is-enclave" : "",
                  selectedRegionId === shape.id ? "is-selected" : "",
                  currentDecision.targetRegionId === shape.id ? "is-target" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="button"
                tabIndex={0}
                onClick={() => handleRegionAction(shape.id)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") handleRegionAction(shape.id);
                }}
                aria-label={`${region.name}，控制者：${faction.name}`}
              >
                {shape.paths.map((d, i) => (
                  <path
                    key={`${shape.id}-${i}`}
                    data-testid={i === 0 ? `region-area-${shape.id}` : undefined}
                    className="political-region__area"
                    d={d}
                    fill={faction.primaryColor}
                    fillOpacity={opacity}
                  />
                ))}
                <foreignObject x={shape.labelX - lblW / 2} y={shape.labelY - 27} width={lblW} height="54">
                  <div className="political-label">
                    <strong>{region.name}</strong>
                    <span>{layerLabel(region, layer)}</span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        <svg className="river-overlay-layer" viewBox="0 0 900 620" aria-hidden="true">
          {majorRiverPaths.map((d, idx) => (
            <path key={`river-${idx}`} className="map-river" d={d} />
          ))}
        </svg>
      </div>

      {/* ---- UI overlay controls (not affected by pan/zoom) --------- */}
      <div className="map-controls" aria-label="地图图层">
        {layerOptions.map(([value, label, Icon]) => (
          <button
            key={value}
            className={layer === value ? "is-active" : ""}
            type="button"
            title={`切换到${label}图层`}
            onClick={() => onLayerChange?.(value)}
          >
            <Icon aria-hidden="true" size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="zoom-controls" aria-label="地图缩放">
        <button type="button" title="放大" onClick={zoomIn}>
          <Plus aria-hidden="true" size={16} />
        </button>
        <button type="button" title="重置视图" onClick={resetView}>
          <RotateCcw aria-hidden="true" size={16} />
        </button>
        <button type="button" title="缩小" onClick={zoomOut}>
          <Minus aria-hidden="true" size={16} />
        </button>
        <span className="zoom-level" aria-live="polite">
          {Math.round(view.zoom * 100)}%
        </span>
      </div>

      <aside className="map-command-panel" aria-label="战略决策">
        {/* --- header (always visible) --- */}
        <div className="commander-card">
          <div className={`portrait-sprite portrait-sprite--${portraitKey(selectedFaction?.id ?? state.playerFactionId)}`} />
          <div>
            <p className="eyebrow">{selectedFaction ? selectedFaction.name : "未选区域"}</p>
            <h2>{selectedRegion?.name ?? "—"}</h2>
            <p>
              {selectedRegion
                ? `${selectedFaction ? `${selectedFaction.name}控制` : "势力未知"} · 稳${selectedRegion.stability} · 控${selectedRegion.control}`
                : "在地图上选择区域"}
            </p>
          </div>
        </div>

        {/* --- region stats (always visible when a region is selected) --- */}
        {selectedRegion ? (
          <div className="compact-stats" aria-label="区域详情">
            <strong>区域详情</strong>
            <span>人口 {shortNumber(selectedRegion.population)}</span>
            <span>粮 {shortNumber(selectedRegion.grainStock)}</span>
            <span>税 {selectedRegion.taxCapacity}</span>
            <span>军 {shortNumber(selectedRegion.garrison)}</span>
            <span>稳 {selectedRegion.stability}</span>
            <span>控 {selectedRegion.control}</span>
          </div>
        ) : null}

        {/* --- player-only decision controls --- */}
        {isPlayerRegion && selectedRegion ? (
          <>
            <button
              className="primary-button map-action"
              type="button"
              disabled={!validTargets.includes(selectedRegion.id) || !onDecisionChange}
              onClick={() => onDecisionChange?.({ targetRegionId: selectedRegion.id })}
            >
              <Swords aria-hidden="true" size={18} />
              设为军略目标
            </button>
          </>
        ) : null}

        {isPlayerRegion ? (
          <>
            <label>
              军事方向
              <select
                value={currentDecision.targetRegionId ?? ""}
                onChange={(e) => onDecisionChange?.({ targetRegionId: e.target.value || null })}
                disabled={!onDecisionChange}
              >
                {validTargets.map((targetId) => (
                  <option key={targetId} value={targetId}>
                    {state.regions[targetId].name}
                  </option>
                ))}
              </select>
            </label>

            <div className="segmented-control" role="group" aria-label="军事姿态">
              {postureOptions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={currentDecision.posture === value ? "is-active" : ""}
                  onClick={() => onDecisionChange?.({ posture: value })}
                  disabled={!onDecisionChange}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="focus-grid" aria-label="内政重点">
              {focusOptions.map(([value, label]) => (
                <div key={value} style={{ position: "relative" }}>
                  <button
                    type="button"
                    className={currentDecision.domesticFocus === value ? "is-active" : ""}
                    onClick={() => onDecisionChange?.({ domesticFocus: value })}
                    onMouseEnter={() => setFocusTooltip(value)}
                    onMouseLeave={() => setFocusTooltip(null)}
                    disabled={!onDecisionChange}
                  >
                    {label}
                  </button>
                  {focusTooltip === value && (
                    <FocusTooltip
                      focus={value}
                      currentFocus={currentDecision.domesticFocus}
                      playerFaction={state.factions[state.playerFactionId]}
                    />
                  )}
                </div>
              ))}
            </div>

            <CliqueBar
              cliques={state.factions[state.playerFactionId]?.cliques ?? []}
              cliqueDefs={cliqueTemplates}
            />
          </>
        ) : selectedRegion ? (
          <p className="muted" style={{ textAlign: "center", padding: "8px 0" }}>
            {selectedFaction ? `${selectedFaction.name}非玩家势力，无法直接操控。` : "该区域无有效势力。"}
          </p>
        ) : null}
      </aside>
    </section>
  );
}

/* ================================================================== */
/*  helpers                                                           */
/* ================================================================== */

function layerLabel(region: GameState["regions"][string], layer: MapLayer): string {
  switch (layer) {
    case "population":
      return `${Math.round(region.population / 10000)}万人`;
    case "grain":
      return `粮${Math.round(region.grainStock / 10000)}万`;
    case "tax":
      return `税${region.taxCapacity}`;
    case "stability":
      return `稳${region.stability}`;
    case "army":
      return `军${Math.round(region.garrison / 1000)}k`;
    case "controlLevel":
      return `控${region.control}`;
    case "control":
      return region.controllerFactionId;
  }
}

function shortNumber(n: number): string {
  if (n >= 10000) return `${Math.round(n / 10000)}万`;
  if (n >= 1000) return `${Math.round(n / 1000)}千`;
  return String(n);
}

function portraitKey(fid: string): string {
  if (fid === "ming") return "emperor";
  if (fid === "jianzhou" || fid === "haixi") return "khan";
  if (fid === "tumed" || fid === "chahar") return "general";
  return "minister";
}

const focusLabels: Record<DomesticFocus, string> = {
  agriculture: "劝课农桑",
  finance: "整顿财政",
  military: "整军备战",
  administration: "澄清吏治",
  recovery: "休养生息",
  frontier: "经略边疆",
};

function FocusTooltip({
  focus,
  currentFocus,
  playerFaction,
}: {
  focus: DomesticFocus;
  currentFocus: DomesticFocus;
  playerFaction: import("../../core/types").FactionState;
}) {
  if (!playerFaction?.cliques?.length) return null;

  const reactions = computeCliqueReactions(
    focus,
    currentFocus,
    playerFaction.cliques,
    cliqueTemplates,
  );

  // Estimate admin modifier change
  const projectedCliques = playerFaction.cliques.map((cs) => {
    const reaction = reactions.find((r) => r.cliqueId === cs.cliqueId);
    const newSupport = Math.max(0, Math.min(100, cs.support + (reaction?.delta ?? 0)));
    return { ...cs, support: newSupport };
  });
  const projectedModifier = computeAdministrationModifier(projectedCliques);
  const currentModifier = computeAdministrationModifier(playerFaction.cliques);
  const modDelta = projectedModifier - currentModifier;

  return (
    <div className="focus-tooltip">
      <p className="focus-tooltip__title">切换到「{focusLabels[focus]}」</p>
      {reactions.map((r) => {
        const def = cliqueTemplates[r.cliqueId];
        if (!def) return null;
        const cls = r.delta > 0 ? "positive" : r.delta < 0 ? "negative" : "neutral";
        return (
          <div key={r.cliqueId} className="focus-tooltip__row">
            <span>{def.shortName}</span>
            <span className={`focus-tooltip__delta--${cls}`}>
              {r.delta > 0 ? `+${r.delta}` : r.delta}
            </span>
          </div>
        );
      })}
      {modDelta !== 0 && (
        <p className="focus-tooltip__admin">
          行政效率 {modDelta > 0 ? `+${modDelta}` : modDelta}
        </p>
      )}
    </div>
  );
}
