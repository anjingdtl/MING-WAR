# Northeast Asia Map and Event Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a repeatable Northeast Asia map generation/validation pipeline, expand the playable map at semi-detailed historical scale, and replace heuristic event art selection with typed illustrated event routing.

**Architecture:** Preserve the existing React/SVG renderer and `900x620` viewBox while moving political region geometry behind a generated facade. Add project-local map source data, deterministic generation and validation scripts, matching region/faction simulation data, and an event-art registry that resolves every `mvpEvents` entry through explicit metadata.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Vitest 3, TSX scripts, SVG path data, static PNG assets.

---

## File Structure

- `src/map/generated/mapRegions.ts`
  Generated political region shapes consumed by the app. This file exports `mapRegions` and imports shared map shape types.

- `src/map/mapTypes.ts`
  Shared `MapRegionSource`, `MapRegionShape`, and `MapRegionGroup` types. This avoids importing generated data only to use types.

- `src/map/mapConfig.ts`
  Stable facade that re-exports `mapRegions` and type aliases. Existing `GameMap` imports remain valid.

- `src/map/sources/regionSource.ts`
  Project-local source records for generated map regions. Each record contains id, group, source, label metadata, and one or more app-space SVG paths.

- `src/scripts/buildMapRegions.ts`
  Deterministic generator that writes `src/map/generated/mapRegions.ts` from `regionSource.ts`.

- `src/scripts/validateMapRegions.ts`
  CLI validator for source/generated map integrity. It checks one-to-one map/data coverage, connections, label bounds, path numeric bounds, and required Northeast Asia groups.

- `src/data/regions.ts`
  Adds new Northeast Asia `RegionState` templates and updates connections.

- `src/data/factions.ts`
  Adds Joseon, Japan, additional Jurchen/eastern steppe factions, and optional observer-style entities.

- `src/core/eventEngine.ts`
  Adds `EventVisualType`, `visualType`, and `artKey` to `GameEvent`.

- `src/data/events.ts`
  Adds explicit visual metadata to every current `mvpEvents` entry.

- `src/ui/dialogs/eventArt.ts`
  Art registry and `getEventArt(event)` resolver.

- `src/ui/dialogs/EventDialog.tsx`
  Uses `getEventArt` instead of `sceneKey` and the legacy sprite sheet.

- `src/assets/art/events/*.png`
  Eight initial banner illustrations.

- `src/tests/map-generated.test.ts`
  Tests generated/source map integrity.

- `src/tests/event-art.test.ts`
  Tests event art resolution and complete current-event coverage.

- `src/tests/dialogs.test.tsx`
  Updates dialog assertions to match the new individual-art rendering.

## Task 1: Introduce Generated Map Facade

**Files:**
- Create: `src/map/mapTypes.ts`
- Create: `src/map/generated/mapRegions.ts`
- Modify: `src/map/mapConfig.ts`
- Test: `src/tests/map-generated.test.ts`

- [ ] **Step 1: Write failing facade integrity tests**

Add `src/tests/map-generated.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { regionTemplates } from "../data/regions";
import { mapRegions as generatedMapRegions } from "../map/generated/mapRegions";
import { mapRegions } from "../map/mapConfig";

function numericValues(paths: string[]): number[] {
  return paths.flatMap((path) => [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])));
}

describe("generated map facade", () => {
  it("re-exports generated map regions through mapConfig", () => {
    expect(mapRegions).toBe(generatedMapRegions);
  });

  it("keeps map regions and simulation regions in sync", () => {
    const mapIds = mapRegions.map((region) => region.id).sort();
    const dataIds = Object.keys(regionTemplates).sort();
    expect(mapIds).toEqual(dataIds);
  });

  it("keeps every label inside the 900x620 viewBox", () => {
    for (const region of mapRegions) {
      expect(region.labelX, `${region.id} labelX`).toBeGreaterThanOrEqual(0);
      expect(region.labelX, `${region.id} labelX`).toBeLessThanOrEqual(900);
      expect(region.labelY, `${region.id} labelY`).toBeGreaterThanOrEqual(0);
      expect(region.labelY, `${region.id} labelY`).toBeLessThanOrEqual(620);
    }
  });

  it("keeps every generated path numerically bounded", () => {
    for (const region of mapRegions) {
      const values = numericValues(region.paths);
      expect(values.length, `${region.id} numeric path values`).toBeGreaterThanOrEqual(4);
      expect(values.every(Number.isFinite), `${region.id} finite path values`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/tests/map-generated.test.ts
```

Expected: FAIL because `src/tests/map-generated.test.ts` does not exist before Step 1 or because `mapConfig.ts` still owns types and generated output has not been introduced.

- [ ] **Step 3: Create shared map types**

Create `src/map/mapTypes.ts`:

```ts
import type { RegionId } from "../core/types";

export type MapRegionSource =
  | "natural-earth-admin1"
  | "historical-frontier-manual"
  | "tusi-enclave"
  | "generated-source";

export type MapRegionGroup = "ming" | "korea" | "japan" | "jurchen" | "mongolia" | "southwest";

export interface MapRegionShape {
  id: RegionId;
  paths: string[];
  labelX: number;
  labelY: number;
  labelWidth?: number;
  source: MapRegionSource;
  group?: MapRegionGroup;
  isEnclave?: boolean;
}
```

- [ ] **Step 4: Move current region array to generated module**

Create `src/map/generated/mapRegions.ts` by mechanically transforming the current `src/map/mapConfig.ts` content. Run this one-off migration command:

```bash
node -e "const fs=require('fs'); const src=fs.readFileSync('src/map/mapConfig.ts','utf8'); const body=src.replace('import type { RegionId } from \"../core/types\";','import type { MapRegionShape } from \"../mapTypes\";').replace(/export type MapRegionSource =[^;]+;\\r?\\n\\r?\\n/s,'').replace(/export interface MapRegionShape \\{[\\s\\S]*?\\}\\r?\\n\\r?\\n/,''); fs.mkdirSync('src/map/generated',{recursive:true}); fs.writeFileSync('src/map/generated/mapRegions.ts', body, 'utf8');"
```

The moved array must preserve every existing region id, path string, label, source, and `isEnclave` flag. To verify the move before changing behavior, run:

```bash
npm test -- src/tests/map-config.test.ts
```

Expected: PASS after `mapConfig.ts` is converted to the facade in Step 5.

- [ ] **Step 5: Convert `mapConfig.ts` to facade**

Replace `src/map/mapConfig.ts` with:

```ts
export type { MapRegionGroup, MapRegionShape, MapRegionSource } from "./mapTypes";
export { mapRegions } from "./generated/mapRegions";
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/tests/map-generated.test.ts src/tests/map-config.test.ts src/tests/map.test.tsx
```

Expected: PASS. Existing map rendering behavior remains unchanged.

- [ ] **Step 7: Commit facade slice**

Run:

```bash
git add src/map/mapTypes.ts src/map/generated/mapRegions.ts src/map/mapConfig.ts src/tests/map-generated.test.ts
git commit -m "refactor(map): introduce generated region facade"
```

## Task 2: Add Map Source and Generator Script

**Files:**
- Create: `src/map/sources/regionSource.ts`
- Create: `src/scripts/buildMapRegions.ts`
- Modify: `package.json`
- Test: `src/tests/map-generated.test.ts`

- [ ] **Step 1: Add failing test for generated/source parity**

Append to `src/tests/map-generated.test.ts`:

```ts
import { mapRegionSources } from "../map/sources/regionSource";

it("keeps generated region ids aligned with map source ids", () => {
  expect(mapRegions.map((region) => region.id).sort()).toEqual(
    mapRegionSources.map((region) => region.id).sort()
  );
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
npm test -- src/tests/map-generated.test.ts
```

Expected: FAIL because `src/map/sources/regionSource.ts` does not exist.

- [ ] **Step 3: Create source module seeded from generated regions**

Create `src/map/sources/regionSource.ts`:

```ts
import { mapRegions } from "../generated/mapRegions";
import type { MapRegionShape } from "../mapTypes";

export type MapRegionSourceRecord = MapRegionShape;

export const mapRegionSources: MapRegionSourceRecord[] = mapRegions.map((region) => ({ ...region }));
```

- [ ] **Step 4: Create generator script**

Create `src/scripts/buildMapRegions.ts`:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mapRegionSources } from "../map/sources/regionSource";

const outputPath = resolve(process.cwd(), "src/map/generated/mapRegions.ts");

function formatValue(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

const body = `import type { MapRegionShape } from "../mapTypes";

export const mapRegions: MapRegionShape[] = ${formatValue(mapRegionSources)};
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, body, "utf8");
console.log(`Wrote ${mapRegionSources.length} map regions to ${outputPath}`);
```

- [ ] **Step 5: Add build script command**

Update `package.json` scripts:

```json
"map:build": "tsx src/scripts/buildMapRegions.ts"
```

- [ ] **Step 6: Run generator and focused test**

Run:

```bash
npm run map:build
npm test -- src/tests/map-generated.test.ts
```

Expected: generator exits 0 and focused test passes.

- [ ] **Step 7: Commit generator slice**

Run:

```bash
git add package.json src/map/sources/regionSource.ts src/scripts/buildMapRegions.ts src/map/generated/mapRegions.ts src/tests/map-generated.test.ts
git commit -m "feat(map): add deterministic region generator"
```

## Task 3: Add Map Validator CLI

**Files:**
- Create: `src/scripts/validateMapRegions.ts`
- Modify: `package.json`
- Test: `src/tests/map-generated.test.ts`

- [ ] **Step 1: Add failing test for required Northeast Asia groups**

Append to `src/tests/map-generated.test.ts`:

```ts
it("covers required Northeast Asia map groups", () => {
  const groups = new Set(mapRegions.map((region) => region.group).filter(Boolean));
  expect(groups.has("korea")).toBe(true);
  expect(groups.has("japan")).toBe(true);
  expect(groups.has("jurchen")).toBe(true);
  expect(groups.has("mongolia")).toBe(true);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
npm test -- src/tests/map-generated.test.ts
```

Expected: FAIL because current regions have no Korea or Japan groups.

- [ ] **Step 3: Create validator CLI**

Create `src/scripts/validateMapRegions.ts`:

```ts
import { mapRegions } from "../map/mapConfig";
import { regionTemplates } from "../data/regions";
import type { MapRegionGroup } from "../map/mapTypes";

const requiredGroups: MapRegionGroup[] = ["korea", "japan", "jurchen", "mongolia"];
const viewBox = { minX: 0, minY: 0, maxX: 900, maxY: 620 };

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function valuesFor(paths: string[]): number[] {
  return paths.flatMap((path) => [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])));
}

const mapIds = new Set(mapRegions.map((region) => region.id));
const dataIds = new Set(Object.keys(regionTemplates));

for (const id of dataIds) {
  if (!mapIds.has(id)) fail(`Missing map shape for region template: ${id}`);
}

for (const region of mapRegions) {
  if (!dataIds.has(region.id)) fail(`Missing region template for map shape: ${region.id}`);
  if (region.labelX < viewBox.minX || region.labelX > viewBox.maxX) fail(`Label X outside viewBox: ${region.id}`);
  if (region.labelY < viewBox.minY || region.labelY > viewBox.maxY) fail(`Label Y outside viewBox: ${region.id}`);
  const values = valuesFor(region.paths);
  if (values.length < 4) fail(`Path has too few numeric values: ${region.id}`);
  if (!values.every(Number.isFinite)) fail(`Path has non-finite values: ${region.id}`);

  for (const connection of regionTemplates[region.id].connections) {
    if (!dataIds.has(connection)) fail(`Region ${region.id} connects to missing region: ${connection}`);
  }
}

const groups = new Set(mapRegions.map((region) => region.group).filter(Boolean));
for (const group of requiredGroups) {
  if (!groups.has(group)) fail(`Missing required Northeast Asia group: ${group}`);
}

console.log(`Validated ${mapRegions.length} map regions.`);
```

- [ ] **Step 4: Add validate script command**

Update `package.json` scripts:

```json
"map:validate": "tsx src/scripts/validateMapRegions.ts"
```

- [ ] **Step 5: Run validator and confirm it fails before expansion**

Run:

```bash
npm run map:validate
```

Expected: FAIL with `Missing required Northeast Asia group: korea`.

- [ ] **Step 6: Leave validator failing until Task 4 adds coverage**

Do not relax the validator. The failure is the acceptance pressure for Northeast Asia coverage.

## Task 4: Expand Northeast Asia Regions and Factions

**Files:**
- Modify: `src/map/sources/regionSource.ts`
- Modify: `src/map/generated/mapRegions.ts`
- Modify: `src/data/regions.ts`
- Modify: `src/data/factions.ts`
- Test: `src/tests/map-generated.test.ts`

- [ ] **Step 1: Add Northeast Asia source records**

Append source records to `mapRegionSources` for these ids and groups:

```ts
const northeastAsiaSources: MapRegionSourceRecord[] = [
  { id: "korea_northwest", group: "korea", source: "generated-source", paths: ["M706 262 L735 258 L748 284 L731 310 L703 300 Z"], labelX: 724, labelY: 283, labelWidth: 106 },
  { id: "korea_northeast", group: "korea", source: "generated-source", paths: ["M735 258 L765 268 L772 299 L748 284 Z"], labelX: 754, labelY: 277, labelWidth: 106 },
  { id: "korea_central", group: "korea", source: "generated-source", paths: ["M703 300 L731 310 L745 337 L720 352 L697 326 Z"], labelX: 721, labelY: 324, labelWidth: 106 },
  { id: "korea_south", group: "korea", source: "generated-source", paths: ["M720 352 L745 337 L763 365 L746 397 L716 382 Z"], labelX: 740, labelY: 365, labelWidth: 106 },
  { id: "japan_kyushu", group: "japan", source: "generated-source", paths: ["M768 424 L793 412 L808 430 L795 455 L768 450 Z"], labelX: 788, labelY: 434, labelWidth: 96 },
  { id: "japan_west", group: "japan", source: "generated-source", paths: ["M807 395 L848 372 L863 389 L828 421 Z"], labelX: 836, labelY: 395, labelWidth: 96 },
  { id: "japan_central", group: "japan", source: "generated-source", paths: ["M860 370 L905 342 L923 358 L884 396 Z"], labelX: 891, labelY: 367, labelWidth: 96 },
  { id: "japan_east", group: "japan", source: "generated-source", paths: ["M919 337 L964 302 L982 319 L946 363 Z"], labelX: 949, labelY: 330, labelWidth: 96 },
  { id: "japan_north", group: "japan", source: "generated-source", paths: ["M930 244 L980 218 L995 250 L955 285 Z"], labelX: 961, labelY: 251, labelWidth: 96 },
  { id: "liaoshen", group: "jurchen", source: "generated-source", paths: ["M650 210 L688 213 L694 250 L662 265 L640 238 Z"], labelX: 667, labelY: 238, labelWidth: 96 },
  { id: "hurha", group: "jurchen", source: "generated-source", paths: ["M690 178 L732 168 L751 204 L721 226 L690 213 Z"], labelX: 719, labelY: 197, labelWidth: 96 },
  { id: "warka", group: "jurchen", source: "generated-source", paths: ["M732 168 L779 149 L805 178 L751 204 Z"], labelX: 766, labelY: 176, labelWidth: 96 },
  { id: "eastern_chahar", group: "mongolia", source: "generated-source", paths: ["M640 154 L690 150 L690 185 L648 190 Z"], labelX: 666, labelY: 170, labelWidth: 116 },
  { id: "khorchin", group: "mongolia", source: "generated-source", paths: ["M690 150 L738 140 L732 168 L690 178 Z"], labelX: 714, labelY: 158, labelWidth: 108 }
];
```

Then export:

```ts
export const mapRegionSources: MapRegionSourceRecord[] = [
  ...mapRegions.map((region) => ({ ...region })),
  ...northeastAsiaSources
];
```

- [ ] **Step 2: Add faction templates**

Add to `src/data/factions.ts`:

```ts
joseon: {
  id: "joseon",
  name: "朝鲜",
  type: "dynasty",
  treasury: 1200000,
  grainReserve: 1800000,
  armyTotal: 85000,
  administration: 58,
  militaryOrganization: 42,
  legitimacy: 78,
  corruption: 28,
  centralization: 60,
  warExhaustion: 0,
  capitalRegionId: "korea_central",
  primaryColor: "#7A8A3A",
  traits: ["宗藩秩序", "两班官僚", "半岛防线"],
  aiProfile: { aggression: 24, riskTolerance: 28, economicFocus: 55, centralizationPreference: 58, historicalGoalWeight: 70, defensePriority: 78, warEndurance: 42 },
  status: "active",
  cliques: defaultCliques({ gentry: 58 }),
  administrationBase: 58
},
japan: {
  id: "japan",
  name: "日本诸势力",
  type: "maritime",
  treasury: 1800000,
  grainReserve: 2100000,
  armyTotal: 160000,
  administration: 50,
  militaryOrganization: 66,
  legitimacy: 55,
  corruption: 24,
  centralization: 38,
  warExhaustion: 2,
  capitalRegionId: "japan_central",
  primaryColor: "#5B6C9D",
  traits: ["战国余波", "海上动员", "诸侯割据"],
  aiProfile: { aggression: 62, riskTolerance: 58, economicFocus: 48, centralizationPreference: 42, historicalGoalWeight: 75, defensePriority: 54, warEndurance: 62 },
  status: "active",
  cliques: defaultCliques({ generals: 62 }),
  administrationBase: 50
},
khorchin: {
  id: "khorchin",
  name: "科尔沁部",
  type: "tribal",
  treasury: 380000,
  grainReserve: 340000,
  armyTotal: 42000,
  administration: 26,
  militaryOrganization: 58,
  legitimacy: 44,
  corruption: 14,
  centralization: 24,
  warExhaustion: 0,
  capitalRegionId: "khorchin",
  primaryColor: "#4F8A8B",
  traits: ["草原骑射", "部族联姻"],
  aiProfile: { aggression: 54, riskTolerance: 52, economicFocus: 34, centralizationPreference: 24, historicalGoalWeight: 58, defensePriority: 48, warEndurance: 54 },
  status: "active",
  cliques: defaultCliques(),
  administrationBase: 26
}
```

- [ ] **Step 3: Add region templates**

Add `RegionState` templates for every new source id. Use this exact region block inside `regionTemplates`:

```ts
korea_northwest: region({
  id: "korea_northwest",
  name: "朝鲜西北",
  terrain: "mountain",
  climate: "cold",
  ownerFactionId: "joseon",
  population: 780000,
  populationCapacity: 1150000,
  agriculture: 48,
  commerce: 34,
  taxCapacity: 42,
  stability: 72,
  control: 72,
  fortification: 42,
  grainStock: 340000,
  garrison: 18000,
  connections: ["liaodong", "liaoshen", "korea_northeast", "korea_central"]
}),
korea_northeast: region({
  id: "korea_northeast",
  name: "朝鲜东北",
  terrain: "mountain",
  climate: "cold",
  ownerFactionId: "joseon",
  population: 520000,
  populationCapacity: 820000,
  agriculture: 38,
  commerce: 28,
  taxCapacity: 34,
  stability: 70,
  control: 68,
  fortification: 34,
  grainStock: 260000,
  garrison: 14000,
  connections: ["korea_northwest", "hurha", "korea_central"]
}),
korea_central: region({
  id: "korea_central",
  name: "朝鲜畿湖",
  terrain: "river",
  climate: "temperate",
  ownerFactionId: "joseon",
  population: 1500000,
  populationCapacity: 2100000,
  agriculture: 62,
  commerce: 52,
  taxCapacity: 58,
  stability: 76,
  control: 78,
  fortification: 46,
  grainStock: 620000,
  garrison: 26000,
  connections: ["korea_northwest", "korea_northeast", "korea_south"]
}),
korea_south: region({
  id: "korea_south",
  name: "朝鲜南部",
  terrain: "coast",
  climate: "temperate",
  ownerFactionId: "joseon",
  population: 1260000,
  populationCapacity: 1800000,
  agriculture: 60,
  commerce: 46,
  taxCapacity: 54,
  stability: 74,
  control: 74,
  fortification: 38,
  grainStock: 520000,
  garrison: 22000,
  connections: ["korea_central", "japan_kyushu", "japan_west"]
}),
japan_kyushu: region({
  id: "japan_kyushu",
  name: "九州",
  terrain: "coast",
  climate: "humid",
  ownerFactionId: "japan",
  population: 1150000,
  populationCapacity: 1650000,
  agriculture: 54,
  commerce: 58,
  taxCapacity: 50,
  stability: 66,
  control: 62,
  fortification: 46,
  grainStock: 430000,
  garrison: 32000,
  connections: ["korea_south", "japan_west"]
}),
japan_west: region({
  id: "japan_west",
  name: "日本西国",
  terrain: "coast",
  climate: "humid",
  ownerFactionId: "japan",
  population: 1700000,
  populationCapacity: 2300000,
  agriculture: 58,
  commerce: 62,
  taxCapacity: 58,
  stability: 64,
  control: 60,
  fortification: 48,
  grainStock: 650000,
  garrison: 42000,
  connections: ["korea_south", "japan_kyushu", "japan_central"]
}),
japan_central: region({
  id: "japan_central",
  name: "畿内东海",
  terrain: "coast",
  climate: "temperate",
  ownerFactionId: "japan",
  population: 2200000,
  populationCapacity: 3000000,
  agriculture: 64,
  commerce: 72,
  taxCapacity: 68,
  stability: 68,
  control: 66,
  fortification: 54,
  grainStock: 860000,
  garrison: 54000,
  connections: ["japan_west", "japan_east"]
}),
japan_east: region({
  id: "japan_east",
  name: "关东奥羽",
  terrain: "plain",
  climate: "temperate",
  ownerFactionId: "japan",
  population: 1600000,
  populationCapacity: 2300000,
  agriculture: 60,
  commerce: 48,
  taxCapacity: 52,
  stability: 62,
  control: 58,
  fortification: 44,
  grainStock: 620000,
  garrison: 46000,
  connections: ["japan_central", "japan_north"]
}),
japan_north: region({
  id: "japan_north",
  name: "虾夷北境",
  terrain: "mountain",
  climate: "cold",
  ownerFactionId: "japan",
  population: 180000,
  populationCapacity: 360000,
  agriculture: 24,
  commerce: 30,
  taxCapacity: 20,
  stability: 58,
  control: 42,
  fortification: 20,
  grainStock: 90000,
  garrison: 9000,
  connections: ["japan_east", "warka"]
}),
liaoshen: region({
  id: "liaoshen",
  name: "辽沈",
  terrain: "plain",
  climate: "cold",
  ownerFactionId: "ming",
  population: 420000,
  populationCapacity: 680000,
  agriculture: 42,
  commerce: 32,
  taxCapacity: 36,
  stability: 58,
  control: 62,
  fortification: 64,
  grainStock: 240000,
  garrison: 52000,
  coreFactionIds: ["ming", "jianzhou"],
  connections: ["liaodong", "jianzhou", "haixi", "hurha", "korea_northwest"]
}),
hurha: region({
  id: "hurha",
  name: "虎尔哈",
  terrain: "mountain",
  climate: "cold",
  ownerFactionId: "haixi",
  population: 150000,
  populationCapacity: 300000,
  agriculture: 28,
  commerce: 20,
  taxCapacity: 18,
  stability: 60,
  control: 52,
  fortification: 24,
  grainStock: 110000,
  garrison: 18000,
  coreFactionIds: ["haixi", "jianzhou"],
  connections: ["liaoshen", "haixi", "warka", "korea_northeast", "khorchin"]
}),
warka: region({
  id: "warka",
  name: "瓦尔喀",
  terrain: "mountain",
  climate: "cold",
  ownerFactionId: "jianzhou",
  population: 130000,
  populationCapacity: 280000,
  agriculture: 26,
  commerce: 18,
  taxCapacity: 16,
  stability: 64,
  control: 58,
  fortification: 22,
  grainStock: 100000,
  garrison: 17000,
  connections: ["hurha", "jianzhou", "japan_north", "khorchin"]
}),
eastern_chahar: region({
  id: "eastern_chahar",
  name: "东察哈尔",
  terrain: "steppe",
  climate: "dry",
  ownerFactionId: "chahar",
  population: 180000,
  populationCapacity: 300000,
  agriculture: 18,
  commerce: 28,
  taxCapacity: 20,
  stability: 58,
  control: 50,
  fortification: 18,
  grainStock: 80000,
  garrison: 30000,
  connections: ["chahar_steppe", "khorchin", "hurha"]
}),
khorchin: region({
  id: "khorchin",
  name: "科尔沁",
  terrain: "steppe",
  climate: "dry",
  ownerFactionId: "khorchin",
  population: 210000,
  populationCapacity: 340000,
  agriculture: 20,
  commerce: 30,
  taxCapacity: 22,
  stability: 62,
  control: 56,
  fortification: 20,
  grainStock: 95000,
  garrison: 34000,
  connections: ["eastern_chahar", "hurha", "warka"]
})
```

Also update existing connections:

```ts
liaodong.connections includes "liaoshen" and "korea_northwest"
haixi.connections includes "liaoshen" and "hurha"
jianzhou.connections includes "liaoshen" and "warka"
chahar_steppe.connections includes "eastern_chahar"
```

- [ ] **Step 4: Generate map output**

Run:

```bash
npm run map:build
```

Expected: `src/map/generated/mapRegions.ts` includes every new id from `northeastAsiaSources`.

- [ ] **Step 5: Run validator and focused tests**

Run:

```bash
npm run map:validate
npm test -- src/tests/map-generated.test.ts src/tests/map-config.test.ts src/tests/scenario.test.ts
```

Expected: PASS. This turns the RED required-group test GREEN.

- [ ] **Step 6: Commit Northeast Asia expansion**

Run:

```bash
git add src/map/sources/regionSource.ts src/map/generated/mapRegions.ts src/data/regions.ts src/data/factions.ts src/scripts/validateMapRegions.ts package.json src/tests/map-generated.test.ts
git commit -m "feat(map): expand northeast asia regions"
```

## Task 5: Add Event Visual Metadata and Resolver

**Files:**
- Modify: `src/core/eventEngine.ts`
- Modify: `src/data/events.ts`
- Create: `src/ui/dialogs/eventArt.ts`
- Test: `src/tests/event-art.test.ts`

- [ ] **Step 1: Write failing event art tests**

Create `src/tests/event-art.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { GameEvent } from "../core/eventEngine";
import { mvpEvents } from "../data/events";
import { getEventArt } from "../ui/dialogs/eventArt";

describe("event art routing", () => {
  it("resolves art for every current MVP event", () => {
    for (const event of mvpEvents) {
      const art = getEventArt(event);
      expect(art.src, event.id).toBeTruthy();
      expect(art.alt, event.id).toContain(event.name);
      expect(art.objectPosition, event.id).toMatch(/%|center|left|right|top|bottom/);
    }
  });

  it("lets specific artKey override visualType fallback", () => {
    const event: GameEvent = {
      id: "override_example",
      name: "专属插画测试",
      category: "global",
      visualType: "politics",
      artKey: "korea-war",
      description: "测试专属插画优先级。",
      priority: 1,
      conditions: [],
      options: []
    };

    expect(getEventArt(event).key).toBe("korea-war");
  });

  it("falls back to crisis art for incomplete metadata", () => {
    const event: GameEvent = {
      id: "fallback_example",
      name: "回退插画测试",
      category: "conditional",
      description: "测试默认危机插画。",
      priority: 1,
      conditions: [],
      options: []
    };

    expect(getEventArt(event).key).toBe("collapse-crisis");
  });
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
npm test -- src/tests/event-art.test.ts
```

Expected: FAIL because `src/ui/dialogs/eventArt.ts` and visual metadata do not exist.

- [ ] **Step 3: Extend event types**

Add to `src/core/eventEngine.ts`:

```ts
export type EventVisualType =
  | "politics"
  | "popular"
  | "military"
  | "disaster"
  | "frontier"
  | "economy"
  | "diplomacy"
  | "crisis";
```

Update `GameEvent`:

```ts
visualType?: EventVisualType;
artKey?: string;
```

- [ ] **Step 4: Add event art registry**

Create `src/ui/dialogs/eventArt.ts`:

```ts
import type { EventVisualType, GameEvent } from "../../core/eventEngine";
import politicsCourtUrl from "../../assets/art/events/politics-court.png";
import economyTaxUrl from "../../assets/art/events/economy-tax.png";
import popularUnrestUrl from "../../assets/art/events/popular-unrest.png";
import militaryCampaignUrl from "../../assets/art/events/military-campaign.png";
import frontierJurchenUrl from "../../assets/art/events/frontier-jurchen.png";
import koreaWarUrl from "../../assets/art/events/korea-war.png";
import disasterDroughtUrl from "../../assets/art/events/disaster-drought.png";
import collapseCrisisUrl from "../../assets/art/events/collapse-crisis.png";

export interface EventArt {
  key: string;
  src: string;
  alt: string;
  objectPosition: string;
}

const artByKey: Record<string, Omit<EventArt, "alt">> = {
  "politics-court": { key: "politics-court", src: politicsCourtUrl, objectPosition: "50% 45%" },
  "economy-tax": { key: "economy-tax", src: economyTaxUrl, objectPosition: "50% 50%" },
  "popular-unrest": { key: "popular-unrest", src: popularUnrestUrl, objectPosition: "50% 55%" },
  "military-campaign": { key: "military-campaign", src: militaryCampaignUrl, objectPosition: "50% 45%" },
  "frontier-jurchen": { key: "frontier-jurchen", src: frontierJurchenUrl, objectPosition: "52% 45%" },
  "korea-war": { key: "korea-war", src: koreaWarUrl, objectPosition: "50% 50%" },
  "disaster-drought": { key: "disaster-drought", src: disasterDroughtUrl, objectPosition: "50% 54%" },
  "collapse-crisis": { key: "collapse-crisis", src: collapseCrisisUrl, objectPosition: "50% 48%" }
};

const fallbackByVisualType: Record<EventVisualType, string> = {
  politics: "politics-court",
  popular: "popular-unrest",
  military: "military-campaign",
  disaster: "disaster-drought",
  frontier: "frontier-jurchen",
  economy: "economy-tax",
  diplomacy: "korea-war",
  crisis: "collapse-crisis"
};

export function getEventArt(event: GameEvent): EventArt {
  const key = event.artKey && artByKey[event.artKey]
    ? event.artKey
    : event.visualType
      ? fallbackByVisualType[event.visualType]
      : "collapse-crisis";
  const art = artByKey[key] ?? artByKey["collapse-crisis"];
  return {
    ...art,
    alt: `${event.name}事件插画`
  };
}
```

- [ ] **Step 5: Add visual metadata to every event**

Update each `mvpEvents` object in `src/data/events.ts`:

```ts
visualType: "politics"
```

Use this mapping:

```ts
zhang_reform_pressure -> politics, artKey politics-court
qingzhang_tianmu -> economy, artKey economy-tax
yitiaobian_promotion -> economy, artKey economy-tax
kaocheng_resistance -> politics, artKey politics-court
zhang_juzheng_death -> politics, artKey politics-court
purge_reform_legacy -> politics, artKey politics-court
state_succession_dispute -> politics, artKey politics-court
ningxia_rebellion -> military, artKey military-campaign
korean_war -> diplomacy, artKey korea-war
bozhou_campaign -> military, artKey military-campaign
three_campaigns_cost -> economy, artKey economy-tax
border_army_exhaustion -> military, artKey military-campaign
jianzhou_unification -> frontier, artKey frontier-jurchen
nurgaci_uprising -> frontier, artKey frontier-jurchen
later_jin_founded -> frontier, artKey frontier-jurchen
fushun_falls -> crisis, artKey collapse-crisis
saarhu_campaign -> crisis, artKey collapse-crisis
liaoshen_crisis -> crisis, artKey collapse-crisis
xiong_tingbi_liaodong -> frontier, artKey frontier-jurchen
mineral_tax_disaster -> economy, artKey economy-tax
donglin_dispute -> politics, artKey politics-court
eunuch_wei_rise -> politics, artKey politics-court
shaanxi_drought -> disaster, artKey disaster-drought
tianqi_political_crisis -> politics, artKey politics-court
```

- [ ] **Step 6: Run focused test**

Run:

```bash
npm test -- src/tests/event-art.test.ts
```

Expected: PASS after Task 6 creates the imported image files. If the image files are not present yet, TypeScript/Vite resolution fails as expected and this task remains incomplete.

## Task 6: Generate Initial Event Banner Assets and Update Dialog

**Files:**
- Create: `src/assets/art/events/politics-court.png`
- Create: `src/assets/art/events/economy-tax.png`
- Create: `src/assets/art/events/popular-unrest.png`
- Create: `src/assets/art/events/military-campaign.png`
- Create: `src/assets/art/events/frontier-jurchen.png`
- Create: `src/assets/art/events/korea-war.png`
- Create: `src/assets/art/events/disaster-drought.png`
- Create: `src/assets/art/events/collapse-crisis.png`
- Modify: `src/ui/dialogs/EventDialog.tsx`
- Modify: `src/app/App.css`
- Test: `src/tests/dialogs.test.tsx`
- Test: `src/tests/event-art.test.ts`

- [ ] **Step 1: Generate eight raster illustrations**

Use the built-in image generation path, one image per prompt, save final images into `src/assets/art/events/`. Each prompt should request a 16:9 historical illustration, no text, no watermark, Ming late-sixteenth to early-seventeenth century visual language, muted ink-and-mineral palette, and UI banner readability.

Use these prompt cores:

```text
politics-court: Ming dynasty court hall, officials arguing over reform memorials, emperor's throne distant, tense political atmosphere, historical illustration, no text.
economy-tax: Ming tax clerks and local gentry examining land registers and grain accounts, rural estate background, fiscal pressure, historical illustration, no text.
popular-unrest: hungry villagers and displaced peasants gathering near a county granary under watchful soldiers, unrest without gore, historical illustration, no text.
military-campaign: Ming frontier army marching with banners, supply carts, dust, fortified pass in distance, historical illustration, no text.
frontier-jurchen: Jurchen cavalry and tribal leaders in cold forest-steppe near Liaodong palisades, rising frontier power, historical illustration, no text.
korea-war: Ming and Joseon allied forces near a Korean mountain fortress facing an overseas invasion threat, late 1590s war mood, historical illustration, no text.
disaster-drought: cracked Shaanxi farmland, dry riverbed, relief officials opening grain stores for famine victims, historical illustration, no text.
collapse-crisis: burning Liaodong frontier beacon towers and retreating messengers before a stormy sky, strategic crisis, historical illustration, no text.
```

- [ ] **Step 2: Update EventDialog**

Replace sprite-sheet import and `sceneKey` usage in `src/ui/dialogs/EventDialog.tsx`:

```tsx
import type { GameEvent } from "../../core/eventEngine";
import { getEventArt } from "./eventArt";

interface EventDialogProps {
  event: GameEvent | null;
  onResolve: (optionId: string) => void;
}

export function EventDialog({ event, onResolve }: EventDialogProps) {
  if (!event) return null;
  const art = getEventArt(event);
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <section className="event-dialog">
        <div className="event-art">
          <img src={art.src} alt={art.alt} style={{ objectPosition: art.objectPosition }} />
        </div>
        <div className="event-copy">
          <span>{categoryLabel(event.category)}</span>
          <h2>{event.name}</h2>
          <p>{event.description}</p>
        </div>
        <div className="event-options">
          {event.options.map((option) => (
            <button key={option.id} onClick={() => onResolve(option.id)}>
              <strong>{option.name}</strong>
              <span>{option.shortEffect}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
```

Keep the existing `categoryLabel` function. Delete the `sceneKey` function.

- [ ] **Step 3: Update event CSS**

Change `src/app/App.css` event art rules:

```css
.event-art {
  aspect-ratio: 16 / 7;
  max-height: 230px;
  overflow: hidden;
  background: var(--color-xuan-2);
}

.event-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

Remove:

```css
.event-art--court img { transform: translateY(0); }
.event-art--frontier img { transform: translateY(-33.333%); }
.event-art--famine img { transform: translateY(-66.666%); }
```

- [ ] **Step 4: Update dialog tests**

In `src/tests/dialogs.test.tsx`, assert that the dialog renders an image with alt text containing the event name:

```ts
expect(screen.getByRole("img", { name: /事件插画/ })).toBeInTheDocument();
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/tests/event-art.test.ts src/tests/dialogs.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit event art slice**

Run:

```bash
git add src/core/eventEngine.ts src/data/events.ts src/ui/dialogs/eventArt.ts src/ui/dialogs/EventDialog.tsx src/app/App.css src/assets/art/events src/tests/event-art.test.ts src/tests/dialogs.test.tsx
git commit -m "feat(events): add typed illustrated event art"
```

## Task 7: Full Verification and Map Visual QA

**Files:**
- Test commands only unless failures require fixes.

- [ ] **Step 1: Run map pipeline checks**

Run:

```bash
npm run map:build
npm run map:validate
```

Expected: both exit 0.

- [ ] **Step 2: Run focused feature tests**

Run:

```bash
npm test -- src/tests/map-generated.test.ts src/tests/map-config.test.ts src/tests/map.test.tsx src/tests/event-art.test.ts src/tests/dialogs.test.tsx
```

Expected: all focused suites pass.

- [ ] **Step 3: Run full test suite**

Run:

```bash
npm test
```

Expected: all suites pass.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build exit 0.

- [ ] **Step 5: Visual smoke check**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Open the local URL and verify:

- The political map shows added Korea, Japan, Jurchen/Northeast, and eastern Mongolia clickable regions.
- Region hover cards work on at least one new region.
- Selecting a new region opens side-panel region detail without runtime errors.
- A triggered event dialog shows a new standalone banner illustration, not the legacy sprite sheet.

- [ ] **Step 6: Commit verification fixes**

If verification required fixes, commit them:

```bash
git add <fixed-files>
git commit -m "fix: stabilize northeast asia map event art rollout"
```

If no fixes were required, do not create an empty commit.

## Self-Review Checklist

- Spec coverage: Tasks 1-4 cover generated map pipeline, source data, validation, Northeast Asia regions, and faction/region integration. Tasks 5-6 cover typed event metadata, art resolver, standalone assets, and dialog rendering. Task 7 covers required verification.
- TDD coverage: Every behavioral code slice starts with a failing test, then implementation, then focused verification.
- No scope shrink: The plan keeps Option C and does not replace it with a hand-only map patch.
- Generated assets: Task 6 explicitly requires eight project-local event PNGs.
- Verification: The plan includes map build, map validate, focused tests, full tests, build, and visual smoke check.
