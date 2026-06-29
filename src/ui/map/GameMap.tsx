import { useRef, useState, useCallback } from "react";
import { Swords, Wheat, Landmark, Shield, Users, Gauge, Crown, Plus, Minus, RotateCcw } from "lucide-react";
import type { DomesticFocus, GameState, MapLayer, MilitaryPosture, PlayerDecision, RegionId } from "../../core/types";
import { getValidMilitaryTargets } from "../../core/decisions";
import { mapRegions } from "../../map/mapConfig";
import { eastAsiaLandPaths, majorRiverPaths } from "../../map/physicalMap";

interface GameMapProps {
  state: GameState;
  layer: MapLayer;
  onLayerChange?: (layer: MapLayer) => void;
  decision?: PlayerDecision;
  onDecisionChange?: (decision: Partial<PlayerDecision>) => void;
  selectedRegionId: RegionId | null;
  onSelect: (regionId: RegionId) => void;
}

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
const DRAG_THRESHOLD = 4;

export function GameMap({
  state,
  layer,
  onLayerChange,
  decision,
  onDecisionChange,
  selectedRegionId,
  onSelect
}: GameMapProps) {
  const selectedRegion = selectedRegionId ? state.regions[selectedRegionId] : null;
  const selectedFaction = selectedRegion ? state.factions[selectedRegion.controllerFactionId] : null;
  const validTargets = getValidMilitaryTargets(state, state.playerFactionId);
  const currentDecision = decision ?? { targetRegionId: null, posture: "balanced", domesticFocus: "administration" };

  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; viewX: number; viewY: number } | null>(null);
  const isDragGestureRef = useRef(false);

  const clampZoom = useCallback((value: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)), []);

  const setZoom = useCallback(
    (nextZoom: number, centerX?: number, centerY?: number) => {
      setView((prev) => {
        const zoom = clampZoom(nextZoom);
        if (!panelRef.current || centerX === undefined || centerY === undefined) {
          return { ...prev, zoom };
        }
        const rect = panelRef.current.getBoundingClientRect();
        const x = centerX - rect.left;
        const y = centerY - rect.top;
        const scaleRatio = zoom / prev.zoom;
        return {
          zoom,
          x: x - (x - prev.x) * scaleRatio,
          y: y - (y - prev.y) * scaleRatio
        };
      });
    },
    [clampZoom]
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
      setZoom(view.zoom * delta, event.clientX, event.clientY);
    },
    [view.zoom, setZoom]
  );

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    isDragGestureRef.current = false;
    dragRef.current = {
      dragging: false,
      startX: event.clientX,
      startY: event.clientY,
      viewX: view.x,
      viewY: view.y
    };
    panelRef.current?.setPointerCapture(event.pointerId);
  }, [view.x, view.y]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;
      if (!dragRef.current.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragRef.current.dragging = true;
        isDragGestureRef.current = true;
      }
      if (dragRef.current.dragging) {
        setView((prev) => ({
          ...prev,
          x: dragRef.current!.viewX + dx,
          y: dragRef.current!.viewY + dy
        }));
      }
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleRegionClick = useCallback(
    (regionId: RegionId) => {
      if (isDragGestureRef.current) {
        isDragGestureRef.current = false;
        return;
      }
      onSelect(regionId);
    },
    [onSelect]
  );

  const handlePanelClick = useCallback(() => {
    isDragGestureRef.current = false;
  }, []);

  const resetView = useCallback(() => setView({ x: 0, y: 0, zoom: 1 }), []);
  const zoomIn = useCallback(() => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setZoom(view.zoom * ZOOM_STEP, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [view.zoom, setZoom]);
  const zoomOut = useCallback(() => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setZoom(view.zoom / ZOOM_STEP, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [view.zoom, setZoom]);

  const transformStyle = {
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
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handlePanelClick}
    >
      <div className="map-viewport" style={transformStyle}>
        <svg className="physical-layer" viewBox="0 0 900 620" aria-hidden="true">
          <rect className="map-sea" x="0" y="0" width="900" height="620" />
          {eastAsiaLandPaths.map((path, index) => (
            <path key={`land-${index}`} className="map-land" d={path} />
          ))}
        </svg>
        <svg className="route-layer" viewBox="0 0 900 620" aria-hidden="true">
          {mapRegions.flatMap((shape) => {
            const region = state.regions[shape.id];
            return region.connections
              .filter((connectionId) => shape.id < connectionId)
              .map((connectionId) => {
                const target = mapRegions.find((item) => item.id === connectionId);
                if (!target) return null;
                return (
                  <line
                    key={`${shape.id}-${connectionId}`}
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
            const labelWidth = shape.labelWidth ?? 96;

            return (
              <g
                key={shape.id}
                data-testid={`region-${shape.id}`}
                className={`political-region ${shape.isEnclave ? "is-enclave" : ""} ${selectedRegionId === shape.id ? "is-selected" : ""} ${
                  currentDecision.targetRegionId === shape.id ? "is-target" : ""
                }`}
                role="button"
                tabIndex={0}
                onClick={() => handleRegionClick(shape.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") handleRegionClick(shape.id);
                }}
                aria-label={`${region.name}，控制者：${faction.name}`}
              >
                {shape.paths.map((path, index) => (
                  <path
                    key={`${shape.id}-${index}`}
                    data-testid={index === 0 ? `region-area-${shape.id}` : undefined}
                    className="political-region__area"
                    d={path}
                    fill={faction.primaryColor}
                    fillOpacity={opacity}
                  />
                ))}
                <foreignObject x={shape.labelX - labelWidth / 2} y={shape.labelY - 27} width={labelWidth} height="54">
                  <div className="political-label">
                    <strong>{region.name}</strong>
                    <span>{layerValue(region, layer)}</span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        <svg className="river-overlay-layer" viewBox="0 0 900 620" aria-hidden="true">
          {majorRiverPaths.map((path, index) => (
            <path key={`river-${index}`} className="map-river" d={path} />
          ))}
        </svg>
      </div>

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
        <span className="zoom-level" aria-live="polite">{Math.round(view.zoom * 100)}%</span>
      </div>

      <aside className="map-command-panel" aria-label="地图战略决策">
        <div className="commander-card">
          <div className={`portrait-sprite portrait-sprite--${portraitKey(selectedFaction?.id ?? state.playerFactionId)}`} />
          <div>
            <p className="eyebrow">战略决策</p>
            <h2>{selectedRegion?.name ?? "未选区域"}</h2>
            <p>{selectedFaction ? `控制者：${selectedFaction.name}` : "在地图上选择区域。"}</p>
          </div>
        </div>

        {selectedRegion && selectedFaction ? (
          <>
            <div className="compact-stats" aria-label="区域详情">
              <strong>区域详情</strong>
              <span>人口 {shortNumber(selectedRegion.population)}</span>
              <span>粮 {shortNumber(selectedRegion.grainStock)}</span>
              <span>税 {selectedRegion.taxCapacity}</span>
              <span>军 {shortNumber(selectedRegion.garrison)}</span>
              <span>稳 {selectedRegion.stability}</span>
              <span>控 {selectedRegion.control}</span>
            </div>

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

        <label>
          军事方向
          <select
            value={currentDecision.targetRegionId ?? ""}
            onChange={(event) => onDecisionChange?.({ targetRegionId: event.target.value || null })}
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
            <button
              key={value}
              type="button"
              className={currentDecision.domesticFocus === value ? "is-active" : ""}
              onClick={() => onDecisionChange?.({ domesticFocus: value })}
              disabled={!onDecisionChange}
            >
              {label}
            </button>
          ))}
        </div>
      </aside>
    </section>
  );
}

function layerValue(region: GameState["regions"][string], layer: MapLayer): string {
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

function shortNumber(value: number): string {
  if (value >= 10000) return `${Math.round(value / 10000)}万`;
  if (value >= 1000) return `${Math.round(value / 1000)}千`;
  return String(value);
}

function portraitKey(factionId: string): string {
  if (factionId === "ming") return "emperor";
  if (factionId === "jianzhou" || factionId === "haixi") return "khan";
  if (factionId === "tumed" || factionId === "chahar") return "general";
  return "minister";
}
