import React from "react";
import { mapCanvas } from "../../../map/mapCanvas";
import {
  eastAsiaLandPaths,
  majorLakePaths,
  majorMountainPaths,
  majorRiverPaths,
  terrainRidgePaths
} from "../../../map/physicalMap";

/**
 * Layer 1 — 底层地理：海洋、陆地、山脉、河流、湖泊、纸纹。
 * 纯静态，React.memo 跳过所有重渲染。
 */
export const BaseGeoLayer = React.memo(function BaseGeoLayer() {
  return (
    <>
      <svg className="physical-layer" viewBox={mapCanvas.viewBox} aria-hidden="true" data-testid="base-geo-layer">
        <defs>
          <radialGradient id="terrain-light" cx="48%" cy="42%" r="72%">
            <stop offset="0%" stopColor="#eadfb7" />
            <stop offset="58%" stopColor="#c8ba8d" />
            <stop offset="100%" stopColor="#9fb08e" />
          </radialGradient>
          <pattern id="paper-grain" width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 1 H7 M2 0 V7" stroke="rgba(77, 66, 47, 0.13)" strokeWidth="0.45" />
          </pattern>
        </defs>
        <rect className="map-sea" x="0" y="0" width={mapCanvas.width} height={mapCanvas.height} />
        {eastAsiaLandPaths.map((path, idx) => (
          <path key={`land-${idx}`} className="map-land" d={path} />
        ))}
        <rect className="map-paper-grain" x="0" y="0" width={mapCanvas.width} height={mapCanvas.height} />
        {majorMountainPaths.map((d, idx) => (
          <path key={`mountain-${idx}`} className="map-mountain" d={d} />
        ))}
        {terrainRidgePaths.map((d, idx) => (
          <path key={`ridge-${idx}`} className="map-ridge" d={d} />
        ))}
        {majorLakePaths.map((d, idx) => (
          <path key={`lake-${idx}`} className="map-lake" d={d} />
        ))}
      </svg>

      <svg
        className="river-overlay-layer"
        viewBox={mapCanvas.viewBox}
        aria-hidden="true"
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        {majorRiverPaths.map((d, idx) => (
          <path key={`river-${idx}`} className="map-river" d={d} />
        ))}
      </svg>
    </>
  );
});

/** 陆地裁切路径定义，供政治覆盖层复用 */
export const StaticClipDefs = React.memo(function StaticClipDefs() {
  return (
    <defs>
      <clipPath id="map-land-clip" clipPathUnits="userSpaceOnUse">
        {eastAsiaLandPaths.map((path, idx) => (
          <path key={`land-clip-${idx}`} d={path} />
        ))}
      </clipPath>
    </defs>
  );
});
