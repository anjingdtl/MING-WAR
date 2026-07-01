import React from "react";
import { mapCanvas } from "../../../map/mapCanvas";
import {
  eastAsiaLandPaths,
  majorLakePaths
} from "../../../map/physicalMap";

/**
 * Layer 1 — 底层地理：海洋、陆地、湖泊。
 * 纯静态，React.memo 跳过所有重渲染。
 */
export const BaseGeoLayer = React.memo(function BaseGeoLayer() {
  return (
    <svg className="physical-layer" viewBox={mapCanvas.viewBox} aria-hidden="true" data-testid="base-geo-layer">
      <defs>
        <radialGradient id="terrain-light" cx="46%" cy="40%" r="78%">
          <stop offset="0%" stopColor="#f1e4bd" />
          <stop offset="48%" stopColor="#d8c89b" />
          <stop offset="82%" stopColor="#b3b88f" />
          <stop offset="100%" stopColor="#8fa081" />
        </radialGradient>
        <radialGradient id="sea-wash" cx="62%" cy="30%" r="88%">
          <stop offset="0%" stopColor="#7ea7a8" />
          <stop offset="54%" stopColor="#527f8b" />
          <stop offset="100%" stopColor="#2f5666" />
        </radialGradient>
        <clipPath id="base-land-clip" clipPathUnits="userSpaceOnUse">
          {eastAsiaLandPaths.map((path, idx) => (
            <path key={`base-land-clip-${idx}`} d={path} />
          ))}
        </clipPath>
      </defs>
      <rect className="map-sea" x="0" y="0" width={mapCanvas.width} height={mapCanvas.height} />
      {eastAsiaLandPaths.map((path, idx) => (
        <path key={`land-${idx}`} className="map-land" d={path} />
      ))}
      {majorLakePaths.map((d, idx) => (
        <path key={`lake-${idx}`} className="map-lake" d={d} />
      ))}
    </svg>
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
