import React from "react";
import type { GameState } from "../../../core/types";
import { mapCanvas } from "../../../map/mapCanvas";
import type { MapTileShape } from "../../../map/mapTypes";

interface MapRoutesLayerProps {
  playableTiles: MapTileShape[];
  state: GameState;
}

/**
 * Layer 5 — 连线层：playable 区域之间的道路/连接线。
 * 只遍历 playable 图块（context 图块没有 connections 数据）。
 */
export const MapRoutesLayer = React.memo(function MapRoutesLayer({
  playableTiles,
  state
}: MapRoutesLayerProps) {
  const tileMap = new Map(playableTiles.map((t) => [t.id, t]));

  return (
    <svg
      className="route-layer"
      viewBox={mapCanvas.viewBox}
      aria-hidden="true"
      data-testid="map-routes-layer"
    >
      {playableTiles.flatMap((shape) => {
        const region = state.regions[shape.id];
        if (!region?.connections) return [];
        return region.connections
          .filter((cid) => shape.id < cid)
          .map((cid) => {
            const target = tileMap.get(cid);
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
  );
});
