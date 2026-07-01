import React from "react";
import type { GameState } from "../../../core/types";
import { mapCanvas } from "../../../map/mapCanvas";
import type { MapTileShape } from "../../../map/mapTypes";

interface MapRoutesLayerProps {
  playableTiles: MapTileShape[];
  state: GameState;
}

/**
 * Layer 5 — 连线层占位。
 * 区域 connections 只作为模拟数据使用，不再在地图底层绘制可见路线线段。
 */
export const MapRoutesLayer = React.memo(function MapRoutesLayer(_props: MapRoutesLayerProps) {
  return (
    <svg
      className="route-layer"
      viewBox={mapCanvas.viewBox}
      aria-hidden="true"
      data-testid="map-routes-layer"
    />
  );
});
