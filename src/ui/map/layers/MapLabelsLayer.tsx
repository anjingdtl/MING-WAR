import React from "react";
import type { GameState, MapLayer } from "../../../core/types";
import { mapCanvas } from "../../../map/mapCanvas";
import type { MapTileShape } from "../../../map/mapTypes";
import { resolveMapFactionColor } from "../../../map/mapFactionColors";
import type { LensId } from "../../lens/lensDefinitions";

interface MapLabelsLayerProps {
  tiles: MapTileShape[];
  state: GameState;
  layer: MapLayer;
  lens: LensId;
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

/**
 * Layer 4 — 标签层：省区名 + Lens 字段。
 * playable 图块显示 region.name + 数据标签；context 图块显示 displayName + 势力归属。
 * Phase 4 将在此基础上叠加势力大字与 zoom 可见性。
 */
export const MapLabelsLayer = React.memo(function MapLabelsLayer({
  tiles,
  state,
  layer,
  lens: _lens
}: MapLabelsLayerProps) {
  return (
    <svg
      className="map-labels-layer"
      viewBox={mapCanvas.viewBox}
      aria-hidden="true"
      data-testid="map-labels-layer"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      {tiles.map((tile) => {
        const lblW = tile.labelWidth ?? 96;
        const region = tile.isPlayableRegion ? state.regions[tile.id] : undefined;
        const name = region?.name ?? tile.displayName;
        const sub = region
          ? layerLabel(region, layer)
          : `${tile.defaultControllerFactionId ?? ""}`;

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
              <span>{sub}</span>
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );
});
