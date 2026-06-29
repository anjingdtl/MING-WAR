import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mapRegionSource } from "../map/source/mapRegionSource";

const outputPath = resolve(process.cwd(), "src/map/generated/mapRegions.ts");

const source = `import type { MapRegionShape } from "../mapTypes";

export const mapRegions: MapRegionShape[] = ${JSON.stringify(mapRegionSource, null, 2)};
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, source, "utf8");

console.log(`Generated ${mapRegionSource.length} map regions at ${outputPath}`);
