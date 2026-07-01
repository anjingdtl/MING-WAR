# Four-Layer Art Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resume the interrupted art supplementation work by replacing generic/cropped art with dedicated event, character, and faction leader assets, then wiring all planned catalog entries through tests.

**Architecture:** Keep `src/data/artCatalog.ts` as the single registry. Add physical asset directories under `src/assets/art/`, import the new PNG files directly, and tighten tests so major events and planned人物立绘 cannot silently fall back to generic family art or the old combined portrait sheet. Faction leader entries may reuse a historical人物立绘 when the leader is already represented in the character catalog.

**Tech Stack:** React 19, TypeScript 5.7, Vite static PNG imports, Vitest, Testing Library, FFmpeg/PowerShell-generated PNG crops.

---

## Current Inventory

- Completed: `artCatalog.ts` exists and exposes `resolveEventScene`, `resolveEventCharacters`, and `resolveFactionLeaderPortrait`.
- Completed: `EventDialog` renders mapped character portraits below the event scene.
- Completed: `StartDialog` renders all `factionTemplates` and resolves a leader portrait per faction.
- Partial: 9 of the 10 planned event-specific scene keys are registered; `saarhu_campaign` is missing.
- Partial: 5 of the 10 planned historical characters are registered; missing 万历帝, 崇祯帝, 李成梁, 丰臣秀吉, 朝鲜宣祖.
- Completed: 4 faction leader entries reuse matching historical人物立绘（万历帝、努尔哈赤、朝鲜宣祖、丰臣秀吉） and 7 remaining factions have dedicated leader PNGs.
- Completed: physical directories `src/assets/art/events/`, `src/assets/art/portraits/characters/`, and `src/assets/art/portraits/factions/` exist and contain the active dedicated assets.

## File Structure

- Create: `src/assets/art/events/*.png`
- Create: `src/assets/art/portraits/characters/*.png`
- Create: `src/assets/art/portraits/factions/*.png`
- Modify: `src/data/artCatalog.ts`
- Modify: `src/tests/event-visuals.test.tsx`
- Modify: `PROGRESS.md`

## Task 1: Asset Coverage Tests

- [x] **Step 1: Identify completed and missing catalog coverage.**

Checked `docs/superpowers/specs/2026-06-30-four-layer-art-system-design.md`, `docs/superpowers/plans/2026-06-30-four-layer-art-system.md`, `src/data/artCatalog.ts`, `src/data/eventVisuals.ts`, `EventDialog`, `StartDialog`, and the current asset directory.

- [x] **Step 2: Add tests for planned dedicated event scenes.**

Add assertions for all 10 planned event ids:

```ts
expect(resolveEventScene(byId.saarhu_campaign).key).toBe("event-saarhu-campaign");
expect(resolveEventScene(byId.saarhu_campaign).src).toContain("saarhu-campaign");
```

- [x] **Step 3: Add tests for planned historical character coverage.**

Assert these ids resolve through the catalog:

```ts
[
  "zhang_juzheng",
  "wanli_emperor",
  "nurhaci",
  "xiong_tingbi",
  "wei_zhongxian",
  "yuan_chonghuan",
  "chongzhen_emperor",
  "li_chengliang",
  "toyotomi_hideyoshi",
  "joseon_seonjo"
]
```

- [x] **Step 4: Add tests that dedicated assets are not the old combined sheets.**

For bespoke event scenes, assert `src` contains `/events/`. For planned character and faction leader portraits, assert `src` contains `/portraits/characters/` or `/portraits/factions/`.

## Task 2: Generate Addressable PNG Assets

- [x] **Step 1: Create asset directories.**

Run:

```powershell
New-Item -ItemType Directory -Force src\assets\art\events, src\assets\art\portraits\characters, src\assets\art\portraits\factions
```

- [x] **Step 2: Generate event scene files.**

Create the 10 planned event PNGs as newly painted banners under `src/assets/art/events/`.

- [x] **Step 3: Generate character portrait files.**

Create the 10 planned historical character PNGs as newly painted portraits under `src/assets/art/portraits/characters/`.

- [x] **Step 4: Generate or reuse faction leader files.**

Reuse historical人物立绘 for Ming/Jianzhou/Joseon/Japan. Create dedicated newly painted faction leader PNGs for Tumed, Chahar, Haixi, Korchin, Nurgan, Ainu, and Bozhou.

## Task 3: Catalog Wiring

- [x] **Step 1: Import all dedicated event scene PNGs in `artCatalog.ts`.**

Replace `eventScene(key, label, type)` entries with `eventScene(key, label, type, src)`.

- [x] **Step 2: Register `saarhu_campaign`.**

Add:

```ts
saarhu_campaign: eventScene("event-saarhu-campaign", "萨尔浒之战军议图", "military", saarhuCampaignUrl)
```

- [x] **Step 3: Import and register all 10 historical人物立绘.**

Expand `characterPortraits` and `characterIdsByEventId` for event text that names or implies each person.

- [x] **Step 4: Import and register all faction leader portraits.**

Change `factionLeader(factionId, label, src)` to use explicit image src values. Reused historical leaders point to `portraits/characters/`; faction-only leaders point to `portraits/factions/`.

## Task 4: Verification

- [x] **Step 1: Run focused art and dialog tests.**

Run:

```bash
npm test -- src/tests/event-visuals.test.tsx src/tests/dialogs.test.tsx
```

Expected: PASS.

- [x] **Step 2: Run typecheck.**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 3: Run build.**

Run:

```bash
npm run build
```

Expected: PASS.
