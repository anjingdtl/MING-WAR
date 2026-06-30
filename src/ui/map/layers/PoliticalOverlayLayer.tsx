import React, { useMemo } from "react";
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
  hoveredRegionId: string | null;
}

function tileFactionId(tile: MapTileShape, state: GameState): string | null {
  if (tile.isPlayableRegion) {
    return state.regions[tile.id]?.controllerFactionId ?? null;
  }
  return tile.defaultControllerFactionId ?? null;
}

/**
 * Layer 3 — 政治势力覆盖：按控制者着色，半透明叠加在省区图块之上。
 * playable 图块取 state.regions 的当前控制者；context 图块取 defaultControllerFactionId。
 * 政治 Lens 下 hover 省区时，同势力相邻覆盖区高亮。
 */
export const PoliticalOverlayLayer = React.memo(function PoliticalOverlayLayer({
  tiles,
  state,
  lens,
  selectedRegionId,
  hoveredRegionId
}: PoliticalOverlayLayerProps) {
  const hoveredFaction = useMemo(() => {
    if (!hoveredRegionId) return null;
    const tile = tiles.find((t) => t.id === hoveredRegionId);
    return tile ? tileFactionId(tile, state) : null;
  }, [hoveredRegionId, tiles, state]);

  const isPoliticalLens = lens === "control";

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
        const shouldClipToLand = tile.kind !== "sea-zone";
        const faction = tileFactionId(tile, state);
        const sameFaction = isPoliticalLens && hoveredFaction !== null && faction === hoveredFaction;
        return (
          <g
            key={`overlay-${tile.id}`}
            data-testid={`overlay-${tile.id}`}
            aria-hidden="true"
            className={[
              "political-overlay-region",
              isContext ? "is-context" : "",
              selectedRegionId === tile.id ? "is-selected" : "",
              hoveredRegionId === tile.id ? "is-hovered" : "",
              sameFaction ? "same-faction" : ""
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
                fillOpacity={sameFaction ? Math.min(opacity + 0.18, 0.95) : opacity}
                clipPath={shouldClipToLand ? "url(#map-land-clip)" : undefined}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
});
