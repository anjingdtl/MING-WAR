import type { GameState, MapLayer, RegionId } from "../../core/types";
import { mapRegions } from "../../map/mapConfig";

interface GameMapProps {
  state: GameState;
  layer: MapLayer;
  selectedRegionId: RegionId | null;
  onSelect: (regionId: RegionId) => void;
}

export function GameMap({ state, layer, selectedRegionId, onSelect }: GameMapProps) {
  return (
    <section className="map-panel" aria-label="战略地图">
      <svg viewBox="0 0 900 620" role="img" aria-label="明末战略区地图">
        {mapRegions.map((shape) => {
          const region = state.regions[shape.id];
          const faction = state.factions[region.controllerFactionId];
          const opacity = layer === "control" ? Math.max(0.38, region.control / 100) : 0.86;
          return (
            <g key={shape.id}>
              <rect
                data-testid={`region-${shape.id}`}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                rx="4"
                fill={faction.primaryColor}
                fillOpacity={opacity}
                stroke={selectedRegionId === shape.id ? "#1f1a16" : "#f7ecd8"}
                strokeWidth={selectedRegionId === shape.id ? 4 : 2}
                onClick={() => onSelect(shape.id)}
              />
              <text x={shape.x + shape.width / 2} y={shape.y + shape.height / 2 - 4} textAnchor="middle">
                {region.name}
              </text>
              <text x={shape.x + shape.width / 2} y={shape.y + shape.height / 2 + 16} textAnchor="middle" className="map-value">
                {layerValue(region, layer)}
              </text>
            </g>
          );
        })}
      </svg>
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
