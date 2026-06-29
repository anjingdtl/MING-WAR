# Northeast Asia Map and Event Art Expansion Design

## Context

The current game is styled after Victoria 3, but the playable map only covers Ming China plus a small set of frontier regions. The physical base map shows a wider East Asian world, while the political layer has too few interactive regions in Northeast Asia. This makes Liaodong, Jurchen expansion, Korea, Japan, and eastern Mongolia feel like map-edge decorations instead of a strategic theater.

The event system has a similar content gap. `EventDialog` currently imports a single vertical sprite sheet and chooses between `court`, `frontier`, and `famine` through a hard-coded `sceneKey(event)` heuristic. Many events therefore reuse loosely related art or lack a clear visual identity.

The approved direction is **Option C: a full cartographic pipeline**, paired with a typed event-art routing system.

## Goals

- Expand the playable province-region layout to cover Northeast Asia at a semi-detailed historical scale.
- Add a repeatable map data generation and validation pipeline so future region expansion does not require manually editing huge SVG path files.
- Keep the existing `GameMap` interaction model: SVG regions, hover cards, labels, lens coloring, zoom, selection, and route lines.
- Give every event a reliable illustration through typed routing, with dedicated art keys for important historical events and category-level fallbacks for generic events.
- Generate an initial event-art set large enough to support the current `mvpEvents`.

## Non-Goals

- Do not replace the current React/SVG map renderer with a full GIS runtime.
- Do not add county-level or province-equivalent microregions across all of Asia in this pass.
- Do not rebalance every economy, war, and AI system around the larger map in one step.
- Do not rely on generated text inside event illustrations.

## Map Architecture

The map remains rendered by `GameMap`, but region geometry becomes generated output instead of a hand-maintained source of truth.

### Source and Generated Layers

- `src/map/sources/`
  Stores source geography and region definitions for the map pipeline. Sources can include simplified GeoJSON, TopoJSON, or project-local JSON describing historical frontiers and merged administrative regions.

- `src/map/generated/`
  Stores generated TypeScript map output consumed by the app. The generated module exports the same kind of `MapRegionShape[]` currently used by `GameMap`: region id, SVG path strings, label point, label width, source, and enclave metadata.

- `src/map/mapConfig.ts`
  Becomes a stable facade that imports and re-exports generated map shapes. This keeps most app imports unchanged.

- `src/scripts/`
  Gains map build and validation scripts. The scripts transform source geography into the app coordinate system, simplify paths, merge historical regions, and validate data consistency.

### Coordinate System

The first version should preserve the existing `900x620` SVG viewBox to avoid broad UI churn. The build script projects source coordinates into that coordinate space and writes paths compatible with the current renderer.

If later expansion requires a wider map, that should be a separate design because it affects camera defaults, label density, side panels, and screenshot tests.

### Region Coverage

The initial Northeast Asia expansion should add approximately 14-18 regions:

- Korea: 4-5 regions, grouped from historical provinces into strategic macro-regions.
- Japan: 4-5 regions, grouped into major strategic blocks rather than individual domains.
- Jurchen and Northeast: 5-7 regions, including finer Liaodong/Liaoshen nodes and multiple Jurchen or Manchurian tribal spaces.
- Eastern Mongolia and steppe: 3-4 regions, expanding beyond the current hand-defined Chahar and Tumed frontier regions.

The existing Ming province regions remain playable. Frontier regions may be adjusted or split where the new data makes the old shape too coarse.

### Game Data Integration

`src/data/regions.ts` remains the simulation source of truth for economic and military state. Every generated map region must have a matching `RegionState` template.

`src/data/factions.ts` should add or update factions required by the new theater, likely including:

- Joseon Korea
- Japanese polity or regional blocs
- Additional Jurchen groups or successor/observer factions
- Expanded eastern Mongol entities

Faction scope should remain conservative: use active factions where they need simulation behavior, and observer factions where they primarily provide map ownership and diplomatic context.

### Validation Rules

Add automated validation that fails when:

- A `regionTemplates` key has no generated map shape.
- A generated map shape has no `regionTemplates` entry.
- A region connection points to a missing region.
- A label point is outside the SVG viewBox.
- A generated path is empty or cannot produce numeric bounds.
- Northeast Asia coverage is missing Korea, Japan, Jurchen/Northeast, or eastern Mongolia categories.

Existing map tests should be updated to assert generated-shape integrity rather than only hard-coded hand-authored regions.

## Event Art Architecture

Events receive explicit visual metadata instead of relying on name/category string heuristics.

### Event Metadata

Extend `GameEvent` with optional visual fields:

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

export interface GameEvent {
  // existing fields
  visualType?: EventVisualType;
  artKey?: string;
}
```

`visualType` provides the category fallback. `artKey` is reserved for specific reusable scenes or major historical events.

### Art Registry

Create `src/ui/dialogs/eventArt.ts` with a registry that maps art keys and visual types to imported image assets:

- `getEventArt(event)` returns image URL, alt text, focus position, and optional tone.
- Resolution order: `event.artKey` -> `event.visualType` -> default crisis art.
- The registry owns all fallback behavior, so `EventDialog` no longer contains event-id substring checks.

### Asset Layout

Use individual project assets instead of one vertical sprite sheet:

- `src/assets/art/events/politics-court.png`
- `src/assets/art/events/economy-tax.png`
- `src/assets/art/events/popular-unrest.png`
- `src/assets/art/events/military-campaign.png`
- `src/assets/art/events/frontier-jurchen.png`
- `src/assets/art/events/korea-war.png`
- `src/assets/art/events/disaster-drought.png`
- `src/assets/art/events/collapse-crisis.png`

`EventDialog` displays art in a stable banner crop, preferably 16:9 or a restrained wide ratio. Registry focus metadata controls `object-position` so important details remain visible.

### Initial Event Mapping

Map current events by theme:

- Political court events: reforms, Zhang Juzheng, succession, party disputes, eunuchs.
- Economy events: land survey, Single Whip reform, mineral tax, campaign financing.
- Popular events: unrest, rebellion pressure, local disorder.
- Military events: Ningxia, Bozhou, border army fatigue.
- Frontier events: Jurchen integration, Nurhaci, Later Jin, Liaodong command.
- Diplomacy or Northeast war events: Korean War and Japan/Korea-related events.
- Disaster events: drought, famine, relief.
- Crisis events: Fushun, Saarhu, Liaoshen, late-collapse pressure.

Every `mvpEvents` entry must resolve to art without relying on a hard-coded id substring in the dialog component.

## Testing Strategy

### Map Tests

- Generated map shapes and region templates are one-to-one.
- Connections reference existing regions.
- Label points are inside the viewBox.
- Newly required Northeast Asia groups are present.
- Existing rendering tests still prove that region fill is driven by current faction control and lens state.

### Event Art Tests

- Every `mvpEvents` item resolves through `getEventArt`.
- `artKey` takes precedence over `visualType`.
- Unknown or incomplete events fall back to default crisis art.
- `EventDialog` renders the chosen image and does not depend on legacy sprite-sheet transform classes.

### Build Verification

- `npm run build`
- `npm test`
- Focused tests for map and event art should pass before running the full suite.

## Rollout Plan

1. Add map source schema, generated-output facade, and validation scripts.
2. Convert the current hand-authored map into generated output without changing visual behavior.
3. Add Northeast Asia source regions and generate the expanded political map.
4. Add matching region and faction templates for the new playable theater.
5. Add event visual metadata, art registry, and dialog rendering updates.
6. Generate and save the first eight event banner illustrations.
7. Update tests and run full verification.

## Risks and Mitigations

- **Map source complexity:** Keep the first source format simple and project-local. Avoid introducing a heavy GIS dependency unless generation quality demands it.
- **Path size growth:** Simplify generated SVG paths and validate output size. Keep generated files isolated.
- **Balance drift:** Use conservative initial populations, garrisons, and faction statuses. Treat deeper balance as follow-up work.
- **Illustration mismatch:** Use type-level fallbacks and focus metadata so every event has suitable art even before bespoke scenes exist.
- **Visual clutter:** Preserve the current viewBox and label-width controls, then use tests and screenshots to tune density.

## Approval State

The user approved:

- Northeast Asia expansion at a semi-detailed historical scale.
- Option C, a full cartographic pipeline, despite higher implementation cost.
- Typed event art routing with dedicated and fallback illustrations.
- The validation and testing boundaries above.
