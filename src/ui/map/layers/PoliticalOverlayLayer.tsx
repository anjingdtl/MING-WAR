import React from "react";
import type { GameState, RegionId } from "../../../core/types";
import { mapCanvas } from "../../../map/mapCanvas";
import type { MapTileShape } from "../../../map/mapTypes";
import { StaticClipDefs } from "./BaseGeoLayer";
import { getTileFillColor } from "../../lens/lensColorScales";
import type { LensId } from "../../lens/lensDefinitions";

interface PoliticalOverlayLayerProps {
  tiles: MapTileShape[];
  state: GameState;
  lens: LensId;
  selectedRegionId: RegionId | null;
  hoveredRegionId: RegionId | null;
}

/**
 * Layer 3 — 政治势力覆盖：按控制者着色，半透明叠加在省区图块之上。
 * playable 图块取 state.regions 的当前控制者；context 图块取 defaultControllerFactionId。
 * 纯视觉层，不承载交互（交互在 ProvinceTileLayer）。
 */
export const PoliticalOverlayLayer = React.memo(function PoliticalOverlayLayer({
  tiles,
  state,
  lens,
  selectedRegionId,
  hoveredRegionId
}: PoliticalOverlayLayerProps) {
  return (
    <svg
      id="lens-content"
      className="political-layer"
      viewBox={mapCanvas.viewBox}
      role="img"
      aria-label="万历朝动态势力区划图"
      data-testid="political-overlay-layer"
    >
      <StaticClipDefs />
      {tiles.map((tile) => {
        const { color, opacity } = getTileFillColor(tile, state, lens);
        const isContext = !tile.isPlayableRegion;
        return (
          <g
            key={`overlay-${tile.id}`}
            data-testid={`overlay-${tile.id}`}
            aria-hidden="true"
            className={[
              "political-overlay-region",
              isContext ? "is-context" : "",
              selectedRegionId === tile.id ? "is-selected" : "",
              hoveredRegionId === tile.id ? "is-hovered" : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {tile.paths.map((d, i) => (
              <path
                key={`${tile.id}-${i}`}
                data-testid={i === 0 ? `region-area-${tile.id}` : undefined}
                className="political-region__area"
                d={d}
                fill={color}
                fillOpacity={opacity}
                clipPath="url(#map-land-clip)"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
});
