import React from "react";
import type { GameState, MapLayer } from "../../../core/types";
import { mapCanvas, LABEL_ZOOM_THRESHOLDS } from "../../../map/mapCanvas";
import type { MapTileShape, FactionMapLabel } from "../../../map/mapTypes";
import type { LensId } from "../../lens/lensDefinitions";

interface MapLabelsLayerProps {
  tiles: MapTileShape[];
  state: GameState;
  layer: MapLayer;
  lens: LensId;
  zoom: number;
  factionLabels: FactionMapLabel[];
}

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

const { factionLabelMaxZoom } = LABEL_ZOOM_THRESHOLDS;

/**
 * Layer 4 — 标签层：势力大字 + 省区名，基于 zoom 切换可读层级。
 *
 * 缩放语义（Victoria 3 式）：
 *  - zoom < 0.85：显示势力大字（FactionLabel），隐藏 importance=3 的省区名，核心省区不显示数据字段
 *  - zoom >= 0.85：显示全部省区名 + Lens 字段，隐藏势力大字
 */
export const MapLabelsLayer = React.memo(function MapLabelsLayer({
  tiles,
  state,
  layer,
  lens: _lens,
  zoom,
  factionLabels
}: MapLabelsLayerProps) {
  const showFactionLabels = zoom < factionLabelMaxZoom;
  const showProvinceDetails = zoom >= factionLabelMaxZoom;

  return (
    <svg
      className="map-labels-layer"
      viewBox={mapCanvas.viewBox}
      aria-hidden="true"
      data-testid="map-labels-layer"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      {showFactionLabels &&
        factionLabels.map((fl) => (
          <foreignObject
            key={`faction-label-${fl.factionId}`}
            x={fl.x - 60}
            y={fl.y - 18}
            width={120}
            height={36}
          >
            <div className={`faction-map-label importance-${fl.importance}`}>{fl.label}</div>
          </foreignObject>
        ))}

      {tiles.map((tile) => {
        const lblW = tile.labelWidth ?? 96;
        const region = tile.isPlayableRegion ? state.regions[tile.id] : undefined;
        const name = region?.name ?? tile.displayName;
        const sub = region ? layerLabel(region, layer) : `${tile.defaultControllerFactionId ?? ""}`;

        const isMinor = tile.importance >= 3;
        const hideDueToZoom = isMinor && !showProvinceDetails;
        const hideDataField = !showProvinceDetails;

        if (hideDueToZoom) return null;

        return (
          <foreignObject
            key={`label-${tile.id}`}
            x={tile.labelX - lblW / 2}
            y={tile.labelY - 27}
            width={lblW}
            height={54}
          >
            <div className={tile.isPlayableRegion ? "political-label" : "political-label context-label"}>
              <strong>{name}</strong>
              {!hideDataField && <span>{sub}</span>}
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );
});
