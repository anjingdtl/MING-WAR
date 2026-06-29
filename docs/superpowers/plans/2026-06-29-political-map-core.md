# Political Map Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rectangular node map with a Wanli-era political map where province/frontier regions are clickable SVG areas and faction colors update from game state.

**Architecture:** Use a generated ink-wash terrain PNG as the non-interactive visual base. Put an SVG political layer above it; each `mapRegions` entry supplies a `path`, label point, and region id, while `GameMap` derives fill color from `state.regions[id].controllerFactionId`.

**Tech Stack:** React 19, Vite static image imports, TypeScript, Vitest, SVG.

---

### Task 1: Prove Political Color Is State-Driven

**Files:**
- Modify: `src/tests/map.test.tsx`

- [ ] **Step 1: Add a failing test**

Add a test that renders `GameMap` after changing Beijing's controller to `jianzhou`, then asserts the Beijing SVG area uses the Jianzhou faction color.

- [ ] **Step 2: Run the focused test**

Run: `npm test -- src/tests/map.test.tsx`
Expected: FAIL because the current map uses rectangular marker plates rather than region SVG areas with direct faction fill.

### Task 2: Define Region Polygons

**Files:**
- Modify: `src/map/mapConfig.ts`

- [ ] **Step 1: Replace rectangle geometry with SVG political geometry**

Each region gets `path`, `labelX`, `labelY`, and optional `labelWidth`. The initial 13 regions remain the same ids so existing simulation data keeps working.

- [ ] **Step 2: Keep the 900x620 coordinate system**

The map stays compatible with existing tests and UI sizing.

### Task 3: Render SVG Political Map

**Files:**
- Modify: `src/ui/map/GameMap.tsx`
- Modify: `src/app/App.css`

- [ ] **Step 1: Render one SVG path per region**

Each `path` uses `fill={faction.primaryColor}`, `data-testid="region-area-<id>"`, and `onClick={() => onSelect(id)}`.

- [ ] **Step 2: Move labels into SVG**

Use `labelX` and `labelY` from `mapConfig.ts`, preserving region name and layer value.

- [ ] **Step 3: Preserve map command panel**

Keep selected region details, target setting, posture, and domestic focus controls.

### Task 4: Replace Terrain Art

**Files:**
- Create: `src/assets/art/wanli-ink-terrain-map.png`
- Modify: `src/ui/map/GameMap.tsx`

- [ ] **Step 1: Generate from `example/万历年间的明朝.png`**

Use it as a composition reference. Generate a no-label ink-wash terrain map with East Asia coastline, Ming core, northern steppe, Liaodong, Tibet, southwest, Japan/Korea edge, and South China Sea edge.

- [ ] **Step 2: Save into project assets**

Copy the generated PNG into `src/assets/art/wanli-ink-terrain-map.png` and import that asset.

### Task 5: Verify

**Files:**
- Test: `src/tests/map.test.tsx`

- [ ] **Step 1: Run focused map tests**

Run: `npm test -- src/tests/map.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run full verification**

Run: `npm run build` and `npm test`
Expected: both commands exit 0.
