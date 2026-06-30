# Four-Layer Art System Design

## Context

The project has expanded beyond the original Ming-only MVP. `src/data/factions.ts` now includes Ming, Mongol, Jurchen, Joseon, Japan, Ainu, Nurgan, and Bozhou powers, while `src/data/events.ts` includes late-Ming Phase 3 events through 1644. The visual layer has not kept pace: event dialogs still resolve to eight generic event-family banners, and faction start portraits still reuse a four-slot sprite sheet.

## Approved Direction

Implement a full four-layer illustration system:

1. Event-specific scenes for major historical event chains.
2. Historical character portraits for people named or implied by event content.
3. Faction ruler or leader portraits for every active faction template.
4. Existing generic event-family banners as typed fallbacks.

## Goals

- Every current event resolves to a usable illustration.
- Major expanded events resolve to bespoke event art instead of broad family art.
- Events involving named historical people expose the matching portrait metadata so the UI can render the relevant人物立绘.
- Every faction template resolves to a faction leader portrait for faction selection and future faction panels.
- Existing eight family banners remain as fallbacks, preserving visual continuity and avoiding blank art for future events.

## Non-Goals

- Do not rebalance event mechanics.
- Do not replace the whole event dialog layout.
- Do not remove the legacy art assets; they stay as fallbacks.
- Do not add historically unsafe portrait claims beyond broad period-appropriate illustration. Portraits are interpretive game art, not museum likenesses.

## Asset Style

New assets must match the current `src/assets/art/event-*.png` direction:

- late Ming / early Qing historical illustration feel
- muted ink, mineral pigment, warm parchment, dark lacquer, and restrained red-gold accents
- painterly realism with UI-readable silhouettes
- no text, watermark, modern objects, gore, or fantasy styling
- event banners use wide 1280x320 crops
- portraits use square or near-square bust crops that can be shown in compact UI surfaces

## Data Model

Create `src/data/artCatalog.ts` as the single registry for art metadata. The registry owns:

- event family fallback definitions
- event-specific `eventArtById`
- character definitions and imported portrait assets
- `characterIdsByEventId`
- faction leader definitions and imported portrait assets
- `factionLeaderByFactionId`

`src/data/eventVisuals.ts` should become a thin compatibility wrapper over `artCatalog.ts` so existing imports continue to work while the richer model becomes available.

## Event Dialog Behavior

`EventDialog` should resolve art in this order:

1. event-specific scene from `eventArtById`
2. fallback family banner from the event visual type

It should also render all characters mapped to that event. Character portraits appear as a compact horizontal row below the banner and above the event text. This keeps the current dialog recognizable while making named-person events visibly specific.

## Faction Portrait Behavior

`StartDialog` should use `resolveFactionLeaderPortrait(factionId)` and render all faction options from `factionTemplates`, not just the first three. This ensures newly expanded factions have corresponding ruler/leader art available at game start.

## Initial Coverage

### Event-Specific Scenes

- `jisi_incident`
- `liaoxiang_surcharge`
- `jiashen_catastrophe`
- `tiaoobian_controversy`
- `wei_zhongxian_purge`
- `yuan_chonghuan_execution`
- `shaanxi_chain_drought`
- `korean_war`
- `later_jin_founded`
- `saarhu_campaign`

### Historical Character Portraits

- 张居正
- 万历帝
- 努尔哈赤
- 熊廷弼
- 魏忠贤
- 袁崇焕
- 崇祯帝
- 李成梁
- 丰臣秀吉
- 朝鲜宣祖

### Faction Leader Portraits

- 大明
- 土默特部
- 建州女真
- 察哈尔部
- 海西女真
- 科尔沁部
- 奴儿干诸部
- 朝鲜
- 日本诸藩
- 虾夷诸部
- 播州杨氏

## Acceptance Criteria

- Tests prove every current event resolves an event image.
- Tests prove Phase 3 expanded events use bespoke scene keys.
- Tests prove named-person events expose the expected character portrait ids.
- Tests prove every faction template has a faction leader portrait.
- `EventDialog` renders the chosen scene and mapped character portraits.
- `StartDialog` renders faction leader art and exposes all faction options.
- `npm test -- src/tests/event-visuals.test.tsx src/tests/dialogs.test.tsx src/tests/app-ui.test.tsx` passes.
- `npm run build` passes before commit and push.
