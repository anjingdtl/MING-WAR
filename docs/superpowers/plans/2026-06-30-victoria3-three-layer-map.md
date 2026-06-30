# 维多利亚3式三层大地图重构 实施计划

> **执行方式：** 本会话内自主连续执行（executing-plans 风格），每个 Phase 完成即 commit，全部完成后全量回归 + 修复 + push。

**目标：** 把现有单层 `mapRegions` 升级为三层 SVG 战略地图（底层地理 / 省区图块 / 政治势力覆盖），补齐东亚周边势力环境，建立势力大字 + 省区细节的双层标签阅读体验。

**架构：** 保留 React/SVG 技术栈。`MapTileShape` 作为统一图块模型，按 `isPlayableRegion` 区分是否进入 `GameState.regions`。渲染拆为 `BaseGeoLayer` / `ProvinceTileLayer` / `PoliticalOverlayLayer` / `MapLabelsLayer` / `MapRoutesLayer` 五个清晰层级。

**依据规格：** `docs/superpowers/specs/2026-06-30-victoria3-three-layer-map-design.md`

**技术栈：** React 19 + TypeScript 5.7 + Vite 6 + vitest 3.2 + @testing-library/react + jsdom。无独立 lint，静态检查用 `npm run typecheck`。

---

## 现状关键约束（执行时必须遵守）

1. `RegionId` / `FactionId` 均为 `string`（非联合），编译期不挡错，靠验证脚本兜底。
2. `GameMap.tsx` 直接 `state.regions[shape.id]` 取数据——context 图块（无 RegionState）引入后会崩，这是 Phase 2 核心改造点。
3. 岛屿 path 靠 `eastAsiaLandPaths` 数组下标硬绑，拆分时保持顺序稳定。
4. `map-generated.test.ts` 强制 `mapRegions.id` 与 `regionTemplates.key` 同步——引入 context 图块后必须放松为"playable 子集同步"。
5. 画布 `1000×700`，现有 playable 坐标范围约 x:300-750 / y:190-540。
6. `npm test` = `vitest run`；`npm run typecheck` = `tsc --noEmit`；`npm run build` = `tsc -b && vite build`；`npm run map:validate`。

---

## Phase 1：地图数据分层（不改视觉）

**目标：** 把 `mapRegions` 拆成底层图块模型，引入 `isPlayableRegion` / `kind` / `defaultControllerFactionId` / `importance`，改造验证脚本区分 playable/context，现有渲染零变化。

**文件：**
- 改 `src/map/mapTypes.ts`：新增 `MapTileKind` / `MapTileShape` / `PoliticalOverlayShape` / `FactionMapLabel` 类型；`MapRegionShape` 保留为旧别名。
- 改 `src/map/source/mapRegionSource.ts`：现有 31 个图块补齐新字段（`kind` / `isPlayableRegion` / `defaultControllerFactionId` / `importance` / `displayName` / `group`）。
- 改 `src/scripts/generateMapRegions.ts`：生成 `mapTiles.ts`（含全字段），保留 `mapRegions.ts` 兼容导出。
- 新建 `src/map/generated/mapTiles.ts`：生成产物（含新字段）。
- 新建 `src/map/mapFactionColors.ts`：地图层势力色板（含背景势力），供 context 图块着色，不污染 GameState。
- 改 `src/map/mapConfig.ts`：导出 `mapTiles` / `playableMapRegions` / `contextMapTiles`；保留 `mapRegions` 别名（= playableMapRegions）维持向后兼容。
- 改 `src/scripts/validateMapRegions.ts`：新增 playable/context 区分；context 图块不报 orphan；新增 `missing-playable-kind` / `missing-default-controller-for-context` 检查。
- 改 `src/tests/map-config.test.ts`：两京十三省 + 辽东 `isPlayableRegion=true`；context 图块存在但不要求进 regionTemplates。
- 改 `src/tests/map-validation.test.ts`：context 图块不报 orphan；新增 playable 缺失检测。
- 改 `src/tests/map-generated.test.ts`：放松为 `playableMapRegions.id` ⊆ `regionTemplates.key` 双向同步。
- 改 `src/tests/map-generation-pipeline.test.ts`：源与生成产物 deepEqual（含新字段）。

**字段映射规则（31 个现有区域 → MapTileShape）：**
- 明朝两京十三省 + bozhou：`kind="core-province"`，`isPlayableRegion=true`，`importance=1`，`defaultControllerFactionId` 按 regionTemplates 初始 controller（多为 `ming`，bozhou=`bozhou`）。
- 辽东：`kind="frontier-province"`，`isPlayableRegion=true`，`importance=1`，`ming`。
- 女真/蒙古/奴儿干 playable 区（chahar_steppe/tumed_steppe/haixi/jianzhou/korchin_steppe/hulunbuir/amur_basin/nurgan_coast）：`kind="neighbor-region"`，`isPlayableRegion=true`，`importance=2`，对应部落 faction。
- 朝鲜/日本/虾夷/库页（joseon_north/joseon_south/japan_west/japan_east/ezo/sakhalin）：`kind="neighbor-region"`，`isPlayableRegion=true`，`importance=2`，对应 faction（joseon/japan/ainu，sakhalin→ainu 或 nurgan）。

**验收：**
- `npm run typecheck` 通过。
- `npm test` 通过（含改造后的地图测试）。
- `npm run map:validate` 通过。
- `GameMap.tsx` 暂不改，仍 import `mapRegions`（= playableMapRegions 别名），视觉零变化。

**Commit：** `feat(map): phase1 split map data into layered tile model`

---

## Phase 2：三层渲染组件拆分

**目标：** 把 `GameMap.tsx` 拆成清晰五层，政治覆盖贴合省区图块，context 图块可渲染不崩，交互不倒退。

**文件：**
- 改 `src/map/mapCanvas.ts`：收编缩放常量（`MIN_ZOOM` / `MAX_ZOOM` / `ZOOM_STEP` / `DRAG_THRESHOLD_PX`）+ 默认视口。
- 新建 `src/ui/map/layers/BaseGeoLayer.tsx`：海洋 rect + 陆地 + 山脉/山脊/湖 + 河流 + 纸纹（从 GameMap 抽出 StaticPhysicalLayer）。
- 新建 `src/ui/map/layers/ProvinceTileLayer.tsx`：渲染所有 `mapTiles` 的几何图块（playable + context），承载 hover/click，区分交互行为。
- 新建 `src/ui/map/layers/PoliticalOverlayLayer.tsx`：按 controller 着色；playable 取 `state.regions[id].controllerFactionId`，context 取 `tile.defaultControllerFactionId` + `mapFactionColors`。
- 新建 `src/ui/map/layers/MapLabelsLayer.tsx`：省区名标签（Phase 4 再加势力大字）。
- 新建 `src/ui/map/layers/MapRoutesLayer.tsx`：区域间连线。
- 改 `src/ui/map/GameMap.tsx`：组合五层；视口/缩放/hover 状态提升到此处分发；context 图块点击走"周边势力概览"分支（不查 RegionState）。
- 改 `src/ui/lens/lensColorScales.ts`：新增 `getContextTileColor(tile, lens)` / `getContextTileOpacity(tile)`，context 用 mapFactionColors + 低饱和。
- 改 `src/tests/map.test.tsx`：三层 DOM 断言（base/province/political data-testid）；context 图块渲染不崩；政治覆盖颜色来源 playable=current controller / context=default。
- 改 `src/tests/map-config.test.ts`：补充三层结构存在性。

**context 图块交互规则：**
- 点击 context 图块：侧栏/浮层显示 `{displayName} · 周边势力/远景区域`，不调用征税/人口/粮储字段。
- hover context 图块：显示势力名 + 标注"远景区域"。
- 政治覆盖：context 透明度低于 playable（如 0.45 vs 0.72）。

**验收：**
- `npm run typecheck` + `npm test` 通过。
- playable 区选中/hover/缩放/拖拽/Lens 着色全部不倒退。
- context 图块渲染、着色、可点击，不查 `state.regions`。
- `map.test.tsx` 含三层 DOM 断言。

**Commit：** `feat(map): phase2 split GameMap into three render layers`

---

## Phase 3：完整东亚周边图 context 图块扩展

**目标：** 补齐视觉上的东亚周边势力环境，让大明不再是孤岛。

**文件：**
- 改 `src/map/source/mapRegionSource.ts`：新增 context 图块（`isPlayableRegion=false`）：
  - `tibet`（乌斯藏/西藏）、`hami`（哈密/关西边地）、`mobei`（漠北蒙古诸部远景）、`sea-southeast-asia`（东南亚边缘）、`sea-liuqiu`（琉球/东南海防）、`sea-north`（北海/漠北海上）、`sea-west-pacific`（西太平洋远景）。
  - 每块带 `kind="context-region"` 或 `"sea-zone"`、`defaultControllerFactionId`、`importance=3`、简化 path（多边形近似，spec 允许粗略）。
- 改 `src/map/mapFactionColors.ts`：新增背景势力色（tibet/mobei/southeast-asia/liuqiu 等），低饱和。
- 重新生成 `src/map/generated/mapTiles.ts`。
- 改 `src/scripts/validateMapRegions.ts`：确保 context 图块 path 非空、label 在画布内。
- 改 `src/tests/map-config.test.ts`：断言 context 图块存在且 `isPlayableRegion=false`，不进 regionTemplates。
- 改 `src/tests/map-generated.test.ts`：playable 子集仍与 regionTemplates 同步；context 图块不计入该同步。

**context 图块坐标规划（1000×700 画布边缘）：**
- 西藏：左下 x:250-420 / y:340-470
- 哈密/关西：左上 x:260-400 / y:210-300
- 漠北：上部 x:400-650 / y:120-200
- 东南亚边缘：下部 x:480-720 / y:540-640
- 琉球/海上：右侧 x:760-900 / y:430-520
- 西太平洋远景：右上 x:820-980 / y:200-420

**验收：**
- 默认视图能看到明朝核心 + 东北 + 朝鲜 + 日本 + 西北/西南/海上 context。
- context 区域不进 `GameState.regions`，不破坏模拟测试。
- `npm test` + `map:validate` 通过。

**Commit：** `feat(map): phase3 expand east-asia context tiles`

---

## Phase 4：势力聚合标签与缩放语义

**目标：** 低缩放看势力大字，中高缩放看省区名，形成维多利亚3式阅读节奏。

**文件：**
- 新建 `src/map/generated/factionMapLabels.ts`：势力大字标签（factionId/label/x/y/minZoom/maxZoom/importance），覆盖大明/建州/海西/察哈尔/土默特/科尔沁/奴儿干/朝鲜/日本/虾夷 + 背景势力。
- 改 `src/map/mapConfig.ts`：导出 `factionMapLabels`。
- 改 `src/ui/map/layers/MapLabelsLayer.tsx`：
  - `zoom < 0.85`：优先 `FactionLabel`，隐藏次要省区数值。
  - `0.85 <= zoom < 1.8`：显示 `ProvinceLabel` + 控制者/Lens 字段。
  - `zoom >= 1.8`：显示边疆/土司/海岛小区域标签。
- 改 `src/ui/map/layers/PoliticalOverlayLayer.tsx`：政治 Lens 下 hover 省区时高亮同势力相邻覆盖。
- 改 `src/ui/map/GameMap.tsx`：把当前 zoom 透传给 MapLabelsLayer。
- 新建 `src/tests/map-labels.test.ts`：标签数据完整性（每势力至少 1 个标签、坐标在画布内、importance 合法）；zoom 阈值语义测试。

**验收：**
- 低缩放能快速识别"大明""建州女真""察哈尔部""朝鲜""日本诸藩"。
- 中高缩放省区名清晰。
- 标签不遮挡 LensBar/右侧面板/缩放控件。
- `npm test` 通过。

**Commit：** `feat(map): phase4 faction labels and zoom-based label semantics`

---

## Phase 5：视觉打磨与性能验收

**目标：** 让地图成为主体验界面，省区边界、政治覆盖透明度、海陆底色、纸纹细节到位。

**文件：**
- 改 `src/ui/map/layers/BaseGeoLayer.tsx`：海陆底色饱和度、纸纹细节、海岸线描边。
- 改 `src/ui/map/layers/ProvinceTileLayer.tsx`：省区边界描边粗细/颜色（可见但不抢势力色）。
- 改 `src/ui/map/layers/PoliticalOverlayLayer.tsx`：透明度梯度（大明 0.62-0.78、部落差异色、context 低饱和）。
- 改 `src/ui/map/GameMap.css`（或 App.css 地图段）：描边/混合模式/标签字体层级。
- 改 `src/ui/map/layers/MapLabelsLayer.tsx`：势力大字 vs 省区小字字号/字重对比。

**验收：**
- `npm run build` 通过。
- `npm test` 通过。
- `npm run typecheck` 通过。
- 地图交互在常规桌面浏览器缩放拖拽流畅（代码层面无性能回归：memo/分层保留）。

**Commit：** `feat(map): phase5 visual polish and perf sign-off`

---

## 收尾：全量回归 + 修复 + push

**步骤：**
1. `npm run typecheck` → 修复所有 TS 错误。
2. `npm test` → 修复所有失败用例。
3. `npm run build` → 修复构建问题。
4. `npm run map:validate` → 修复地图校验问题。
5. 若有修复 → commit `fix(map): full regression fixes after three-layer refactor`。
6. `git push origin main`。

---

## 设计原则（贯穿全程）

- **地图底块不是势力，势力覆盖不是省区，模拟区域不是全部地图区域。**
- context 图块永不进 `GameState.regions`。
- playable 图块永不脱离 `regionTemplates`。
- 验证脚本强制守住这两条边界。
