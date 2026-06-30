# Four-Layer Art System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved four-layer art system for event-specific scenes, historical character portraits, faction leader portraits, and generic fallback banners.

**Architecture:** Add a central `artCatalog` registry that imports all image assets and exposes resolver functions. Keep `eventVisuals.ts` as a compatibility layer, update `EventDialog` and `StartDialog` to consume the new registry, and keep the existing eight family banners as fallbacks.

**Tech Stack:** React 19, TypeScript 5.7, Vite static image imports, Vitest, Testing Library, generated PNG assets.

---

## File Structure

- `src/data/artCatalog.ts`: central asset imports, ids, registries, and resolver functions.
- `src/data/eventVisuals.ts`: compatibility wrapper around `artCatalog.ts`.
- `src/ui/dialogs/EventDialog.tsx`: render event scene plus mapped character portraits.
- `src/ui/dialogs/StartDialog.tsx`: render all faction options and faction leader portrait.
- `src/app/App.css`: layout styles for character portrait rows and faction leader portraits.
- `src/assets/art/events/*.png`: event-specific wide scene assets.
- `src/assets/art/portraits/characters/*.png`: historical character portraits.
- `src/assets/art/portraits/factions/*.png`: faction leader portraits.
- `src/tests/event-visuals.test.tsx`: registry and dialog tests.
- `src/tests/dialogs.test.tsx`: dialog rendering regression coverage.

## Task 1: Registry Tests

**Files:**
- Modify: `src/tests/event-visuals.test.tsx`

- [ ] **Step 1: Add failing tests for complete event, character, and faction coverage.**

Add tests that import `mvpEvents`, `factionTemplates`, and the new registry functions. They must assert:

```ts
expect(resolveEventScene(event).src).toBeTruthy();
expect(resolveEventScene(mvpEvents.find((event) => event.id === "jisi_incident")!).key).toBe("event-jisi-incident");
expect(resolveEventCharacters(mvpEvents.find((event) => event.id === "yuan_chonghuan_execution")!).map((item) => item.id)).toContain("yuan_chonghuan");
for (const factionId of Object.keys(factionTemplates)) {
  expect(resolveFactionLeaderPortrait(factionId).src, factionId).toBeTruthy();
}
```

- [ ] **Step 2: Run the focused test and verify RED.**

Run:

```bash
npm test -- src/tests/event-visuals.test.tsx
```

Expected: FAIL because `artCatalog.ts` and the new resolvers do not exist yet.

## Task 2: Registry Implementation

**Files:**
- Create: `src/data/artCatalog.ts`
- Modify: `src/data/eventVisuals.ts`

- [ ] **Step 1: Generate and place required image assets.**

Create the event, character, and faction PNG files listed in the design spec. Save them under:

```text
src/assets/art/events/
src/assets/art/portraits/characters/
src/assets/art/portraits/factions/
```

- [ ] **Step 2: Implement `artCatalog.ts`.**

Define:

```ts
export type EventVisualType = "political" | "popular" | "military" | "disaster" | "economic" | "diplomatic" | "frontier" | "intrigue";
export interface ArtImage { key: string; src: string; label: string; alt: string; objectPosition?: string; }
export interface CharacterPortrait extends ArtImage { id: string; role: string; }
export interface FactionLeaderPortrait extends ArtImage { factionId: string; }
export function resolveEventScene(event: GameEvent): ArtImage;
export function resolveEventCharacters(event: GameEvent): CharacterPortrait[];
export function resolveFactionLeaderPortrait(factionId: string): FactionLeaderPortrait;
```

Use explicit maps for event-specific scenes, characters by event id, and faction leaders by faction id.

- [ ] **Step 3: Keep `eventVisuals.ts` compatible.**

Export `EventVisualType`, `visualFamilies`, `eventVisualTypeById`, and `resolveEventVisual` from the new registry so existing callers continue to compile.

- [ ] **Step 4: Run focused tests and verify GREEN.**

Run:

```bash
npm test -- src/tests/event-visuals.test.tsx
```

Expected: PASS.

## Task 3: UI Binding

**Files:**
- Modify: `src/ui/dialogs/EventDialog.tsx`
- Modify: `src/ui/dialogs/StartDialog.tsx`
- Modify: `src/app/App.css`
- Modify: `src/tests/event-visuals.test.tsx`
- Modify: `src/tests/dialogs.test.tsx`

- [ ] **Step 1: Add failing UI assertions.**

Assert that `EventDialog` renders character portrait images for `yuan_chonghuan_execution`, and that `StartDialog` exposes all faction options.

- [ ] **Step 2: Run focused tests and verify RED.**

Run:

```bash
npm test -- src/tests/event-visuals.test.tsx src/tests/dialogs.test.tsx
```

Expected: FAIL because UI still renders only family banners and three faction options.

- [ ] **Step 3: Update `EventDialog`.**

Use `resolveEventScene(event)` for the banner image and `resolveEventCharacters(event)` for the portrait row.

- [ ] **Step 4: Update `StartDialog`.**

Use `Object.keys(factionTemplates)` for options and `resolveFactionLeaderPortrait(factionId)` for the displayed image.

- [ ] **Step 5: Add CSS.**

Add stable dimensions for `.event-character-row`, `.event-character-card`, `.event-character-card img`, `.start-portrait--leader`, and `.start-portrait--leader img`.

- [ ] **Step 6: Run focused tests and verify GREEN.**

Run:

```bash
npm test -- src/tests/event-visuals.test.tsx src/tests/dialogs.test.tsx
```

Expected: PASS.

## Task 4: Verification and Publish

**Files:**
- All changed files.

- [ ] **Step 1: Run focused verification.**

Run:

```bash
npm test -- src/tests/event-visuals.test.tsx src/tests/dialogs.test.tsx src/tests/app-ui.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run build verification.**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit and push main.**

Run:

```bash
git status --short
git add docs/superpowers/specs/2026-06-30-four-layer-art-system-design.md docs/superpowers/plans/2026-06-30-four-layer-art-system.md src
git commit -m "feat(art): add four-layer illustration system"
git push origin main
```
