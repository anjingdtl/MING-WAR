import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { baseMapTiles } from "../map/source/baseMapTiles";

const outputPath = resolve(process.cwd(), "src/map/generated/mapTiles.ts");

const source = `import type { MapTileShape } from "../mapTypes";

export const mapTiles: MapTileShape[] = ${JSON.stringify(baseMapTiles, null, 2)};
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, source, "utf8");

const playableCount = baseMapTiles.filter((t) => t.isPlayableRegion).length;
const contextCount = baseMapTiles.length - playableCount;
console.log(
  `Generated ${baseMapTiles.length} map tiles at ${outputPath} (${playableCount} playable, ${contextCount} context)`
);
