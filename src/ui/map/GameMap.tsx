import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Plus, Minus, RotateCcw } from "lucide-react";
import type { GameState, MapLayer, RegionId } from "../../core/types";
import { mapCanvas } from "../../map/mapCanvas";
import { mapRegions } from "../../map/mapConfig";
import {
  eastAsiaLandPaths,
  majorLakePaths,
  majorMountainPaths,
  majorRiverPaths,
  terrainRidgePaths
} from "../../map/physicalMap";
import { getRegionColor, getRegionOpacity } from "../lens/lensColorScales";
import type { LensId } from "../lens/lensDefinitions";
import { RegionHoverCard } from "../lens/RegionHoverCard";

/* ------------------------------------------------------------------ */
/*  constants                                                         */
/* ------------------------------------------------------------------ */

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.12;
const DRAG_THRESHOLD_PX = 5;

/** Pre-computed region shape lookup for route rendering (avoids O(n) find per connection). */
const REGION_SHAPE_MAP = new Map(mapRegions.map((s) => [s.id, s]));

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

/** Static SVG layers that never change — memoized to skip re-render entirely. */
const StaticPhysicalLayer = React.memo(function StaticPhysicalLayer() {
  return (
    <>
      <svg className="physical-layer" viewBox={mapCanvas.viewBox} aria-hidden="true">
        <defs>
          <radialGradient id="terrain-light" cx="48%" cy="42%" r="72%">
            <stop offset="0%" stopColor="#eadfb7" />
            <stop offset="58%" stopColor="#c8ba8d" />
            <stop offset="100%" stopColor="#9fb08e" />
          </radialGradient>
          <pattern id="paper-grain" width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 1 H7 M2 0 V7" stroke="rgba(77, 66, 47, 0.13)" strokeWidth="0.45" />
          </pattern>
        </defs>
        <rect className="map-sea" x="0" y="0" width={mapCanvas.width} height={mapCanvas.height} />
        {eastAsiaLandPaths.map((path, idx) => (
          <path key={`land-${idx}`} className="map-land" d={path} />
        ))}
        <rect className="map-paper-grain" x="0" y="0" width={mapCanvas.width} height={mapCanvas.height} />
        {majorMountainPaths.map((d, idx) => (
          <path key={`mountain-${idx}`} className="map-mountain" d={d} />
        ))}
        {terrainRidgePaths.map((d, idx) => (
          <path key={`ridge-${idx}`} className="map-ridge" d={d} />
        ))}
        {majorLakePaths.map((d, idx) => (
          <path key={`lake-${idx}`} className="map-lake" d={d} />
        ))}
      </svg>

      <svg className="river-overlay-layer" viewBox={mapCanvas.viewBox} aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
        {majorRiverPaths.map((d, idx) => (
          <path key={`river-${idx}`} className="map-river" d={d} />
        ))}
      </svg>
    </>
  );
});

/** Static clip-path defs — memoized separately since it's inside the political layer SVG. */
const StaticClipDefs = React.memo(function StaticClipDefs() {
  return (
    <defs>
      <clipPath id="map-land-clip" clipPathUnits="userSpaceOnUse">
        {eastAsiaLandPaths.map((path, idx) => (
          <path key={`land-clip-${idx}`} d={path} />
        ))}
      </clipPath>
    </defs>
  );
});

interface GameMapProps {
  state: GameState;
  layer: MapLayer;
  onLayerChange?: (layer: MapLayer) => void;
  selectedRegionId: RegionId | null;
  onSelect: (regionId: RegionId) => void;
  /** 当 Alt+点击区域时,父级收到此事件用于聚焦动画 */
  onFocusRegion?: (regionId: RegionId) => void;
  /** 当前 Lens — 决定地图色板 + 区域 hover 卡字段 */
  lens: LensId;
}

/**
 * 战略地图 — Phase 3 集成 Lens 系统
 *
 * 主要变化:
 *  - 区域填充色由 lens 决定(取代了原 layer)
 *  - 鼠标 hover 区域时,显示该 Lens 字段的浮动卡
 *  - Alt+点击区域 → 通知父级聚焦(由父级决定如何响应)
 *  - 移除原 6 图层按钮(由 LensBar 取代)
 */
function GameMapInner({
  state,
  layer,
  onLayerChange,
  selectedRegionId,
  onSelect,
  onFocusRegion,
  lens
}: GameMapProps) {
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const panelRef = useRef<HTMLElement>(null);

  const dragRef = useRef<DragState>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    viewX: 0,
    viewY: 0
  });

  const gestureFlagRef = useRef(false);

  /* ---- hover 状态(用于 RegionHoverCard) ---- */
  const [hoveredRegionId, setHoveredRegionId] = useState<RegionId | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  /* ---- document-level drag listeners -------------------------------- */
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

  const handleRegionAction = useCallback(
    (regionId: RegionId, alt: boolean) => {
      if (gestureFlagRef.current) {
        gestureFlagRef.current = false;
        return;
      }
      if (alt) {
        onFocusRegion?.(regionId);
      } else {
        onSelect(regionId);
      }
    },
    [onSelect, onFocusRegion]
  );

  const handlePanelClick = useCallback(() => {
    gestureFlagRef.current = false;
  }, []);

  const handleRegionPointerEnter = useCallback(
    (regionId: RegionId, e: React.PointerEvent) => {
      setHoveredRegionId(regionId);
      setHoverPos({ x: e.clientX, y: e.clientY });
      if (panelRef.current) {
        setContainerRect(panelRef.current.getBoundingClientRect());
      }
    },
    []
  );

  const handleRegionPointerLeave = useCallback(() => {
    setHoveredRegionId(null);
  }, []);

  const handlePanelPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (hoveredRegionId) {
        setHoverPos({ x: e.clientX, y: e.clientY });
      }
    },
    [hoveredRegionId]
  );

  const handlePanelPointerLeave = useCallback(() => {
    setHoveredRegionId(null);
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
      onPointerMove={handlePanelPointerMove}
      onPointerLeave={handlePanelPointerLeave}
      onClick={handlePanelClick}
    >
      <div className="map-viewport" style={transformStyle}>
        <StaticPhysicalLayer />

        <svg className="route-layer" viewBox={mapCanvas.viewBox} aria-hidden="true">
          {mapRegions.flatMap((shape) => {
            const region = state.regions[shape.id];
            return region.connections
              .filter((cid) => shape.id < cid)
              .map((cid) => {
                const target = REGION_SHAPE_MAP.get(cid);
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

        <svg
          id="lens-content"
          className="political-layer"
          viewBox={mapCanvas.viewBox}
          role="img"
          aria-label="万历朝动态势力区划图"
        >
          <StaticClipDefs />
          {mapRegions.map((shape) => {
            const region = state.regions[shape.id];
            const faction = state.factions[region.controllerFactionId];
            const fill = getRegionColor(region, state, lens);
            const opacity = getRegionOpacity(region, lens);
            const lblW = shape.labelWidth ?? 96;

            return (
              <g
                key={shape.id}
                data-testid={`region-${shape.id}`}
                className={[
                  "political-region",
                  shape.isEnclave ? "is-enclave" : "",
                  selectedRegionId === shape.id ? "is-selected" : "",
                  hoveredRegionId === shape.id ? "is-hovered" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="button"
                tabIndex={0}
                onClick={(e) => handleRegionAction(shape.id, e.altKey)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") handleRegionAction(shape.id, false);
                }}
                onPointerEnter={(e) => handleRegionPointerEnter(shape.id, e)}
                onPointerLeave={handleRegionPointerLeave}
                aria-label={`${region.name},控制者:${faction.name}`}
              >
                {shape.paths.map((d, i) => (
                  <path
                    key={`${shape.id}-${i}`}
                    data-testid={i === 0 ? `region-area-${shape.id}` : undefined}
                    className="political-region__area"
                    d={d}
                    fill={fill}
                    fillOpacity={opacity}
                    clipPath="url(#map-land-clip)"
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

      <RegionHoverCard
        regionId={hoveredRegionId}
        state={state}
        lens={lens}
        screenX={hoverPos?.x ?? 0}
        screenY={hoverPos?.y ?? 0}
        containerRect={containerRect}
        visible={hoveredRegionId !== null}
      />
    </section>
  );
}

export const GameMap = React.memo(GameMapInner);

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
