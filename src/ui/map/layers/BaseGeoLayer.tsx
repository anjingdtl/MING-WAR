import React from "react";
import { mapCanvas } from "../../../map/mapCanvas";
import {
  eastAsiaLandPaths,
  majorLakePaths,
  majorMountainPaths,
  majorRiverPaths,
  terrainRidgePaths
} from "../../../map/physicalMap";

const inkMistShapes = [
  { cx: 292, cy: 494, rx: 210, ry: 86, rotate: -18, opacity: 0.22 },
  { cx: 480, cy: 392, rx: 260, ry: 104, rotate: -8, opacity: 0.18 },
  { cx: 682, cy: 258, rx: 240, ry: 94, rotate: 12, opacity: 0.16 },
  { cx: 786, cy: 520, rx: 180, ry: 72, rotate: -24, opacity: 0.13 },
  { cx: 192, cy: 220, rx: 170, ry: 66, rotate: 18, opacity: 0.12 }
] as const;

/**
 * Layer 1 — 底层地理：海洋、陆地、山脉、河流、湖泊、纸纹。
 * 纯静态，React.memo 跳过所有重渲染。
 */
export const BaseGeoLayer = React.memo(function BaseGeoLayer() {
  return (
    <>
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
          <radialGradient id="ink-mist" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="rgba(54, 47, 37, 0.56)" />
            <stop offset="62%" stopColor="rgba(54, 47, 37, 0.18)" />
            <stop offset="100%" stopColor="rgba(54, 47, 37, 0)" />
          </radialGradient>
          <pattern id="paper-grain" width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 1 H7 M2 0 V7" stroke="rgba(77, 66, 47, 0.13)" strokeWidth="0.42" />
            <path d="M5 0 L7 2 M0 6 L2 7" stroke="rgba(255, 250, 230, 0.22)" strokeWidth="0.36" />
          </pattern>
          <filter id="ink-wash-filter" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.014 0.035" numOctaves="2" seed="17" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="0.42" />
          </filter>
          <filter id="dry-brush-filter" x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="31" result="grain" />
            <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <clipPath id="base-land-clip" clipPathUnits="userSpaceOnUse">
            {eastAsiaLandPaths.map((path, idx) => (
              <path key={`base-land-clip-${idx}`} d={path} />
            ))}
          </clipPath>
        </defs>
        <rect className="map-sea" x="0" y="0" width={mapCanvas.width} height={mapCanvas.height} />
        <rect className="map-sea-paper" x="0" y="0" width={mapCanvas.width} height={mapCanvas.height} />
        {eastAsiaLandPaths.map((path, idx) => (
          <path key={`land-${idx}`} className="map-land" d={path} />
        ))}
        <g className="map-ink-mist-layer" clipPath="url(#base-land-clip)" filter="url(#ink-wash-filter)">
          {inkMistShapes.map((shape, idx) => (
            <ellipse
              key={`ink-mist-${idx}`}
              className="map-ink-mist"
              cx={shape.cx}
              cy={shape.cy}
              rx={shape.rx}
              ry={shape.ry}
              opacity={shape.opacity}
              transform={`rotate(${shape.rotate} ${shape.cx} ${shape.cy})`}
            />
          ))}
        </g>
        <rect className="map-paper-grain" x="0" y="0" width={mapCanvas.width} height={mapCanvas.height} />
        {majorMountainPaths.map((d, idx) => (
          <path key={`mountain-wash-${idx}`} className="map-mountain-wash" d={d} />
        ))}
        <g filter="url(#dry-brush-filter)">
          {majorMountainPaths.map((d, idx) => (
            <path key={`mountain-${idx}`} className="map-mountain" d={d} />
          ))}
          {terrainRidgePaths.map((d, idx) => (
            <path key={`ridge-${idx}`} className="map-ridge" d={d} />
          ))}
        </g>
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
          <path key={`river-shadow-${idx}`} className="map-river-shadow" d={d} />
        ))}
        {majorRiverPaths.map((d, idx) => (
          <path key={`river-bank-${idx}`} className="map-river-bank" d={d} />
        ))}
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
