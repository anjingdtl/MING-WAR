import React from "react";
import type { GameState, RegionId } from "../../../core/types";
import { mapCanvas } from "../../../map/mapCanvas";
import type { MapTileShape } from "../../../map/mapTypes";

interface ProvinceTileLayerProps {
  tiles: MapTileShape[];
  state: GameState;
  selectedRegionId: RegionId | null;
  hoveredRegionId: string | null;
  onTileAction: (tile: MapTileShape, alt: boolean) => void;
  onTilePointerEnter: (tile: MapTileShape, e: React.PointerEvent) => void;
  onTilePointerLeave: () => void;
}

/**
 * Layer 2 — 省区图块交互层：描边 + 命中区 + hover/click/focus。
 * 在 PoliticalOverlayLayer 之上渲染（透明填充捕获事件，描边勾勒边界）。
 * playable 图块走完整交互；context 图块走"周边势力概览"分支，不查询 RegionState。
 */
export const ProvinceTileLayer = React.memo(function ProvinceTileLayer({
  tiles,
  state,
  selectedRegionId,
  hoveredRegionId,
  onTileAction,
  onTilePointerEnter,
  onTilePointerLeave
}: ProvinceTileLayerProps) {
  return (
    <svg
      className="province-tile-layer"
      viewBox={mapCanvas.viewBox}
      aria-hidden="true"
      data-testid="province-tile-layer"
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {tiles.map((tile) => {
        const isContext = !tile.isPlayableRegion;
        const region = tile.isPlayableRegion ? state.regions[tile.id] : undefined;
        const ariaLabel = region
          ? `${region.name}，控制者：${state.factions[region.controllerFactionId]?.name ?? "未知"}`
          : `${tile.displayName}，周边势力/远景区域`;

        return (
          <g
            key={`tile-${tile.id}`}
            data-testid={`region-${tile.id}`}
            className={[
              "province-tile",
              tile.isEnclave ? "is-enclave" : "",
              isContext ? "is-context-tile" : "",
              selectedRegionId === tile.id ? "is-selected" : "",
              hoveredRegionId === tile.id ? "is-hovered" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            role="button"
            tabIndex={0}
            onClick={(e) => onTileAction(tile, e.altKey)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onTileAction(tile, false);
              }
            }}
            onPointerEnter={(e) => onTilePointerEnter(tile, e)}
            onPointerLeave={onTilePointerLeave}
            aria-label={ariaLabel}
          >
            {tile.paths.map((d, i) => (
              <path
                key={`${tile.id}-hit-${i}`}
                className="province-tile__hit"
                d={d}
                fill="transparent"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
});
