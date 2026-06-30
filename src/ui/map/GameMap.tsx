import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Plus, Minus, RotateCcw } from "lucide-react";
import type { GameState, MapLayer, RegionId } from "../../core/types";
import { mapCanvas, DEFAULT_VIEWPORT } from "../../map/mapCanvas";
import { mapTiles, playableMapRegions, factionMapLabels } from "../../map/mapConfig";
import type { MapTileShape } from "../../map/mapTypes";
import type { LensId } from "../lens/lensDefinitions";
import { RegionHoverCard } from "../lens/RegionHoverCard";
import { BaseGeoLayer } from "./layers/BaseGeoLayer";
import { MapRoutesLayer } from "./layers/MapRoutesLayer";
import { PoliticalOverlayLayer } from "./layers/PoliticalOverlayLayer";
import { ProvinceTileLayer } from "./layers/ProvinceTileLayer";
import { MapLabelsLayer } from "./layers/MapLabelsLayer";

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */

const { minZoom, maxZoom, zoomStep, dragThresholdPx } = mapCanvas;

const PLAYABLE_IDS = new Set(playableMapRegions.map((t) => t.id));

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
 * 战略地图 — 三层 SVG 架构（Victoria 3 式）
 *
 * 渲染层次（从下到上）：
 *  1. BaseGeoLayer     — 海陆地形、山脉、河流、纸纹
 *  2. MapRoutesLayer   — 区域间道路连线
 *  3. PoliticalOverlayLayer — 势力着色覆盖（半透明，贴合省区）
 *  4. ProvinceTileLayer — 省区描边 + 交互命中区（hover/click/focus）
 *  5. MapLabelsLayer   — 省区名 + Lens 字段标签
 *
 * playable 图块走完整交互与模拟数据；context 图块仅视觉表达，不查询 RegionState。
 */
function GameMapInner({
  state,
  layer,
  onLayerChange: _onLayerChange,
  selectedRegionId,
  onSelect,
  onFocusRegion,
  lens
}: GameMapProps) {
  const [view, setView] = useState<{ x: number; y: number; zoom: number }>({ ...DEFAULT_VIEWPORT });
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

  /* ---- hover 状态 ---- */
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  const hoveredPlayableRegionId = useMemo(
    () => (hoveredTileId && PLAYABLE_IDS.has(hoveredTileId) ? hoveredTileId : null),
    [hoveredTileId]
  );

  /* ---- document-level drag listeners -------------------------------- */
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) > dragThresholdPx) {
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
  const clampZoom = useCallback((val: number) => clamp(val, minZoom, maxZoom), []);

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
    applyZoom(view.zoom * zoomStep, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [view.zoom, applyZoom]);

  const zoomOut = useCallback(() => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    applyZoom(view.zoom / zoomStep, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [view.zoom, applyZoom]);

  const resetView = useCallback(() => setView({ ...DEFAULT_VIEWPORT }), []);

  /* ---- event handlers on the map panel ----------------------------- */
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 / zoomStep : zoomStep;
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

  const handleTileAction = useCallback(
    (tile: MapTileShape, alt: boolean) => {
      if (gestureFlagRef.current) {
        gestureFlagRef.current = false;
        return;
      }
      if (!tile.isPlayableRegion) {
        return;
      }
      if (alt) {
        onFocusRegion?.(tile.id);
      } else {
        onSelect(tile.id);
      }
    },
    [onSelect, onFocusRegion]
  );

  const handlePanelClick = useCallback(() => {
    gestureFlagRef.current = false;
  }, []);

  const handleTilePointerEnter = useCallback(
    (tile: MapTileShape, e: React.PointerEvent) => {
      setHoveredTileId(tile.id);
      setHoverPos({ x: e.clientX, y: e.clientY });
      if (panelRef.current) {
        setContainerRect(panelRef.current.getBoundingClientRect());
      }
    },
    []
  );

  const handleTilePointerLeave = useCallback(() => {
    setHoveredTileId(null);
  }, []);

  const handlePanelPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (hoveredTileId) {
        setHoverPos({ x: e.clientX, y: e.clientY });
      }
    },
    [hoveredTileId]
  );

  const handlePanelPointerLeave = useCallback(() => {
    setHoveredTileId(null);
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
        <BaseGeoLayer />

        <MapRoutesLayer playableTiles={playableMapRegions} state={state} />

        <PoliticalOverlayLayer
          tiles={mapTiles}
          state={state}
          lens={lens}
          selectedRegionId={selectedRegionId}
          hoveredRegionId={hoveredTileId}
        />

        <ProvinceTileLayer
          tiles={mapTiles}
          state={state}
          selectedRegionId={selectedRegionId}
          hoveredRegionId={hoveredTileId}
          onTileAction={handleTileAction}
          onTilePointerEnter={handleTilePointerEnter}
          onTilePointerLeave={handleTilePointerLeave}
        />

        <MapLabelsLayer tiles={mapTiles} state={state} layer={layer} lens={lens} zoom={view.zoom} factionLabels={factionMapLabels} />
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
        regionId={hoveredPlayableRegionId}
        state={state}
        lens={lens}
        screenX={hoverPos?.x ?? 0}
        screenY={hoverPos?.y ?? 0}
        containerRect={containerRect}
        visible={hoveredPlayableRegionId !== null}
      />
    </section>
  );
}

export const GameMap = React.memo(GameMapInner);
