# MING-WAR 大地图体系重构 — 执行计划 PLAN

> 项目代号：MING-WAR
> 文档版本：v0.7-map-refactor-plan
> 编写日期：2026-06-30
> 上游文档：`docs/MING-WAR_MapRefactor_v0.7_SPEC.md`（v0.7-map-refactor-design）
> 执行模式：9 阶段顺序执行（含 0 前置），每阶段结束做 review + commit
> 范围：仅大地图视觉层（`physicalMap.ts` / `mapRegionSource.ts` / `factionMapLabels.ts` / `rebuildGeoMap.ts`），不动业务 / 状态 / 存档 / 模拟

---

## §0. 执行原则

1. **顺序执行**：9 阶段有强依赖（前置 → 重建 → 修正 → 校验 → 回看 → 回滚 → 文档），不允许跳阶段。
2. **零回归硬要求**：每阶段结束必须 `npm test` 全绿 + `npm run hash:state` 与 v0.6.1-patch 基线一致。
3. **小步提交**：每阶段可拆 2-3 个 commit（chore: / refactor: / feat:），但**阶段边界必须有一次 review**。
4. **TDD 优先**：`validateInitialFactions` 脚本先写测试用例（期望染色）再实现。
5. **不引入新依赖**：不装新的 geo 库（turf 等），NE 解析复用现有 `pathsFromFeatures`。
6. **最后做全量回归**：9 阶段全部 commit 后跑 typecheck + test + build + map:* 全部 + batch + hash:state，fix 后再 push。

---

## §1. 阶段划分与依赖

```text
┌──────────────────────────────────┐
│ 阶段 0：前置                     │  src/map/data/ne_cache/ 4 文件预下载
│   NE GeoJSON 入仓                │  src/scripts/fetchNeCache.ts 新增
│   + fetch-ne 脚本                │  package.json 新增 map:fetch-ne 脚本
└──────────┬───────────────────────┘
           │  cache 完整是后续所有阶段的前提
           ▼
┌──────────────────────────────────┐
│ 阶段 1：重建 physicalMap.ts       │  eastAsiaLandPaths / majorRiverPaths 来自 NE
│   真实海岸线 + 真实河流           │  majorLakePaths / MountainPaths / Ridge 保持手绘
└──────────┬───────────────────────┘
           │  底图就位
           ▼
┌──────────────────────────────────┐
│ 阶段 2：重建 mapRegionSource.ts   │  31 playable + 7 context 全部 NE 边界
│   31 playable + 7 context        │  Mongol 4 部 + jurchen 2 部 + bozhou 仍手绘
│   + mapTiles 自动重生成          │  generateMapRegions.ts 跑一次
└──────────┬───────────────────────┘
           │  region 几何对位
           ▼
┌──────────────────────────────────┐
│ 阶段 3：Wanli 修正层              │  shaanxi 缩关中（去 Gansu/Ningxia）
│   3 处历史偏差                    │  joseon 38° 同源裁切
│                                  │  Mongol 4 部 顶点 6→12
└──────────┬───────────────────────┘
           │  历史边界准了
           ▼
┌──────────────────────────────────┐
│ 阶段 4：势力标签与色板校验        │  factionMapLabels 坐标校验
│   factionMapLabels + 颜色       │  LABEL_ZOOM_THRESHOLDS 一致性
│   validateInitialFactions 新增   │  31 区染色 = ownerFactionId
└──────────┬───────────────────────┘
           │  染色与标签就位
           ▼
┌──────────────────────────────────┐
│ 阶段 5：验证 & 红线              │  map:rebuild-geo / map:generate / map:validate
│   CI 全绿                        │  typecheck / test / build / map:validate-init
│                                  │  batch / hash:state
└──────────┬───────────────────────┘
           │  CI 不挡 PR
           ▼
┌──────────────────────────────────┐
│ 阶段 6：视觉回看 & 调优          │  截屏 vs 百度地图
│   人工对比                        │  调 polygon 微小错位
│                                  │  调 labelX/Y 偏移
└──────────┬───────────────────────┘
           │  肉眼通过
           ▼
┌──────────────────────────────────┐
│ 阶段 7：回滚方案                  │  单独 commit 备份 v0.6.1-patch 版本
│   备份 + 演练                     │  演练 git revert 流程
└──────────┬───────────────────────┘
           │  兜底方案就位
           ▼
┌──────────────────────────────────┐
│ 阶段 8：提交与文档更新            │  PROGRESS.md 增 v0.7 战报
│   战报 + push                    │  README.md 增 NE 致谢
│                                  │  git push origin main
└──────────────────────────────────┘
```

---

## §2. 阶段 0：前置 — NE GeoJSON 预下载与缓存

### §2.1 目标

把 4 个 Natural Earth 50m GeoJSON 公共领域文件**预下载入 `src/map/data/ne_cache/`**，并新增一次性 `map:fetch-ne` 脚本——`rebuildGeoMap.ts` 在后续阶段**只读 cache**。

### §2.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 0.1 | 创建 `src/map/data/ne_cache/` 目录 | 目录 | 空目录 + `.gitkeep` |
| 0.2 | 新增 `src/scripts/fetchNeCache.ts` | 新文件 | 4 文件齐全 → 0 输出；缺失 → 从 GH raw 下载 |
| 0.3 | 跑 `npm run map:fetch-ne` 拉 4 文件 | 命令 | `ne_50m_land.geojson` + `ne_50m_admin_0_countries.geojson` + `ne_50m_admin_1_states_provinces.geojson` + `ne_50m_rivers_lake_centerlines.geojson` 全部入仓 |
| 0.4 | 新增 `src/map/data/ne_cache/README.md` | 新文件 | 注明：Natural Earth public domain, 来源 URL, 下载日期 |
| 0.5 | `package.json` 新增 `map:fetch-ne` 脚本 | 修改 | `"map:fetch-ne": "tsx src/scripts/fetchNeCache.ts"` |
| 0.6 | 校验 4 文件总大小 < 5MB | `ls -la` | 实际 < 1.5MB |
| 0.7 | 提交 `chore(map): pre-download NE 50m GeoJSON to ne_cache` | commit | git log 有这条 |

### §2.3 关键约束

- `fetchNeCache.ts` **必须**幂等——跑一次和跑十次结果一致。
- cache 文件**不进** `.gitignore`——必须 git tracked。
- cache 文件**不**用 git lfs（< 5MB 不需要）。
- `fetchNeCache.ts` 在 `rebuildGeoMap.ts` 改造为"只读 cache"前，**不应该被自动调用**——只在手动 `npm run map:fetch-ne` 时跑。
- NE 公共领域 license：`README.md` 必须明确写"Natural Earth data is in the public domain"。

### §2.4 Review 检查表

- [ ] `src/map/data/ne_cache/` 存在，4 个 `.geojson` 文件齐全
- [ ] `ls -la` 总大小 < 5MB
- [ ] `npm run map:fetch-ne` 跑一次成功（首次下载）
- [ ] `npm run map:fetch-ne` 再跑一次成功（命中 cache，不重新下载）
- [ ] `package.json` 包含 `map:fetch-ne` 脚本
- [ ] 现有 470 测试不受影响（不读 cache）

### §2.5 Commit 计划

```bash
git add src/map/data/ne_cache/ src/scripts/fetchNeCache.ts package.json
git commit -m "chore(map): pre-download NE 50m GeoJSON to src/map/data/ne_cache/"
```

---

## §3. 阶段 1：重建 `physicalMap.ts`（真实海岸线 + 真实河流 + 山脉 + 湖泊）

### §3.1 目标

把 `src/map/physicalMap.ts` 中的 `eastAsiaLandPaths`（手绘 stylized）替换为 Natural Earth 50m 海岸线简化结果；`majorRiverPaths` 替换为 NE 50m 河流水系简化结果。`majorLakePaths` / `majorMountainPaths` / `terrainRidgePaths` 保持现有手绘。

### §3.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 1.1 | 重写 `rebuildGeoMap.ts` 的 `fetchJson` 改为读 cache | `src/scripts/rebuildGeoMap.ts` | 不再 `fetch(url)`；改为 `readFileSync(src/map/data/ne_cache/...)` |
| 1.2 | 改 `main()` 入口用 cache 路径 | `src/scripts/rebuildGeoMap.ts` | 4 文件从 `src/map/data/ne_cache/*.geojson` 读 |
| 1.3 | 调 `eastAsiaLandPaths` 简化阈值 | `src/scripts/rebuildGeoMap.ts` | `minDistance: 2.5, minArea: 8`（保持） |
| 1.4 | 调 `majorRiverPaths` 简化阈值 | `src/scripts/rebuildGeoMap.ts` | `minDistance: 2.0`（保持） |
| 1.5 | 保留 `majorLakePaths` / `MountainPaths` / `RidgePaths` 手绘生成 | `src/scripts/rebuildGeoMap.ts` | 沿用 `oval()` / `manualLine()` 不动 |
| 1.6 | 跑 `npm run map:rebuild-geo` 跑通 | 命令 | `physicalMap.ts` 重生成，路径数与 NE 海岸线规模匹配（40-80 paths） |
| 1.7 | `npm run build` 通过 | 命令 | tsc + vite build 0 错误 |
| 1.8 | 视觉：浏览器打开页面看海岸线 | 手测 | 黄海/东海/南海轮廓与百度地图肉眼一致（误差 ≤ 2 像素） |
| 1.9 | `git diff src/map/physicalMap.ts` 确认 改动 | 手测 | diff 极大量（手绘 → NE） |

### §3.3 关键约束

- **viewBox 不动**——仍是 `0 0 1000 700`。
- **投影参数不动**——`(lonMin:68, lonMax:148, latMin:7, latMax:58, width:1000, height:700)`。
- **脚本**不引新 npm 依赖（用 `node:fs` + `node:path` + `node:url`，已存在）。
- `rebuildGeoMap.ts` 改造后**永远不联网**——grep 验证：`grep -n "fetch(" src/scripts/rebuildGeoMap.ts` 应 0 命中。
- `physicalMap.ts` 仍是**自动生成产物**——`// AUTOGENERATED` 注释保留（阶段 5 统一加）。

### §3.4 Review 检查表

- [ ] `rebuildGeoMap.ts` 0 个 `fetch()` 调用
- [ ] `npm run map:rebuild-geo` 在断网环境跑通
- [ ] `physicalMap.ts` 中 `eastAsiaLandPaths` 数组长度 ≥ 30（NE 50m 简化后海岸线段数）
- [ ] `physicalMap.ts` 中 `majorRiverPaths` 数组长度 ≥ 10（NE 50m 河流水系数）
- [ ] `npm run build` 0 错误
- [ ] `npm test` 470 测试全绿
- [ ] `map:validate` 0 issue
- [ ] 视觉：海岸线与百度地图肉眼一致

### §3.5 Commit 计划

```bash
git add src/scripts/rebuildGeoMap.ts src/map/physicalMap.ts
git commit -m "refactor(map): phase 1 — physicalMap uses NE 50m coast + rivers (offline)"
```

---

## §4. 阶段 2：重建 `mapRegionSource.ts`（31 playable + 7 context）

### §4.1 目标

把 `src/map/source/mapRegionSource.ts` 中的 31 playable region 全部用 NE 真实边界替换手绘 stylized。**region id 不变**（与 `regionTemplates` 31 key 1:1 对齐）。

### §4.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 2.1 | 改 `buildRegions` 函数：15 个 NE admin1 边界 | `src/scripts/rebuildGeoMap.ts` | beizhili/nanzhili/shandong/shanxi/henan/shaanxi(本轮仍含 Gansu/Ningxia,阶段 3 改)/zhejiang/jiangxi/huguang/sichuan/fujian/guangdong/guangxi/yunnan/guizhou/liaodong 全部 NE |
| 2.2 | 改 `buildRegions` 函数：5 个 NE admin0 边界 | `src/scripts/rebuildGeoMap.ts` | joseon_north / joseon_south（**本轮仍用现代南北分界**,阶段 3 改 38° 同源）/ japan_west / japan_east / ezo 全部 NE |
| 2.3 | 改 `buildRegions` 函数：3 个 NE admin1 Russia 边界 | `src/scripts/rebuildGeoMap.ts` | amur_basin / nurgan_coast / sakhalin 全部 NE |
| 2.4 | 保留 7 个手绘 polygon | `src/scripts/rebuildGeoMap.ts` | tumed/chahar/korchin/hulunbuir/haixi/jianzhou/bozhou 仍手绘（阶段 3 微调） |
| 2.5 | 改 `buildContextTiles` 函数：tibet / mobei 用 NE | `src/scripts/rebuildGeoMap.ts` | NE admin1 Xizang / NE admin0 Mongolia |
| 2.6 | 保留 4 个手绘 context（hami / southeast-asia / liuqiu / western-pacific / northern-sea）| `src/scripts/rebuildGeoMap.ts` | 顶点 5 → 8-10 |
| 2.7 | 跑 `npm run map:rebuild-geo` | 命令 | `mapRegionSource.ts` 重生成，31 region + 7 context 全部有 path |
| 2.8 | 跑 `npm run map:generate` | 命令 | `mapTiles.ts` 自动 merge 成功 |
| 2.9 | 跑 `npm run map:validate` | 命令 | 0 issue（duplicate / orphan / label-out-of-bounds / empty-paths） |
| 2.10 | 视觉：31 region 全部肉眼可见 | 手测 | 浏览器打开页面，31 区全部有点击命中 |

### §4.3 关键约束

- **31 region id 全部不变**——严格匹配 `regionTemplates` key。
- **region label 坐标**（`labelX / labelY`）**不变**——硬编码 31 个 `[lon, lat]`，投影到 0-1000/0-700。
- **`source` 字段**变化：`"natural-earth-admin1"` / `"natural-earth-admin0"` / `"historical-frontier-manual"` / `"tusi-enclave"`。
- `mapRegionSource.ts` 是**自动生成产物**——不手改，只跑脚本生成。
- 31 region 必须**全部**有 `paths` 数组（长度 ≥ 1）——`map:validate` 兜底校验。

### §4.4 Review 检查表

- [ ] `mapRegionSource.ts` 中 playable region 数量 = 31
- [ ] `mapRegionSource.ts` 中 context tile 数量 = 7
- [ ] 31 region id 全部 ∈ `Object.keys(regionTemplates)`
- [ ] `npm run map:validate` 0 issue
- [ ] `npm run map:generate` 跑通
- [ ] `npm test` 470 测试全绿
- [ ] 视觉：31 region + 7 context 全部肉眼可见

### §4.5 Commit 计划

```bash
git add src/scripts/rebuildGeoMap.ts src/map/source/mapRegionSource.ts src/map/generated/mapTiles.ts src/map/source/baseMapTiles.ts
git commit -m "refactor(map): phase 2 — mapRegionSource uses NE 50m admin1/admin0 for 27 regions"
```

---

## §5. 阶段 3：Wanli 修正层（3 处历史偏差）

### §5.1 目标

修正 3 处已知历史偏差：

1. `shaanxi` 缩到关中（去掉 Gansu + Ningxia）
2. 朝鲜半岛 38° 同源裁切（南北同源 + bbox crop）
3. 蒙古 4 部 / 女真 2 部 / 播州 手绘 polygon 细化（顶点 6 → 12）

### §5.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 3.1 | 改 `shaanxi` 边界：只取 `Shaanxi` | `src/scripts/rebuildGeoMap.ts` | `china(["Shaanxi"])`，不再 `china(["Shaanxi", "Gansu", "Ningxia"])` |
| 3.2 | 改 joseon 边界：合并为 Korea 整体后 crop | `src/scripts/rebuildGeoMap.ts` | `joseon_north` 与 `joseon_south` 都来自 `countryRingPaths(admin0, "Korea", ...)`，再按 `[lon, lat]` 切 38° 上下 |
| 3.3 | 加 `ringBbox` crop 工具函数 | `src/scripts/rebuildGeoMap.ts` | 给定 ring + bbox，返回 bbox 内的 path（线性扫描简化） |
| 3.4 | 调蒙古 4 部手绘 polygon：顶点 6 → 12 | `src/scripts/rebuildGeoMap.ts` | tumed/chahar/korchin/hulunbuir 顶点 12 个；沿经度方向略弯 |
| 3.5 | 调女真 2 部手绘 polygon：顶点 6 → 12 | `src/scripts/rebuildGeoMap.ts` | haixi/jianzhou 顶点 12 个 |
| 3.6 | 调 bozhou 边界：顶点 5 → 10 | `src/scripts/rebuildGeoMap.ts` | 播州土司范围略扩大（杨应龙 叛乱时含 贵州 北部部分） |
| 3.7 | 跑 `npm run map:rebuild-geo` | 命令 | 3 处修正全部生效 |
| 3.8 | 跑 `npm run map:validate` | 命令 | 0 issue |
| 3.9 | 跑 `npm run map:generate` | 命令 | mapTiles.ts 重生成 |
| 3.10 | 视觉：38° 朝鲜分界与 shaanxi 缩到关中 | 手测 | 浏览器打开，朝鲜 38° 上下分明；陕西只剩关中 |
| 3.11 | 视觉：蒙古 4 部边界无 gap | 手测 | 4 部 polygon 互相相邻或重合 |
| 3.12 | `npm test` 470 测试全绿 | 命令 | 0 失败 |

### §5.3 关键约束

- **3 处修正全部通过 region id 不变**——`shaanxi` / `joseon_north` / `joseon_south` / `tumed` / `chahar` / `korchin` / `hulunbuir` / `haixi` / `jianzhou` / `bozhou` 10 个 id 全部保留。
- **染色不变**——`ownerFactionId` 全部不动。
- **手绘 polygon 顶点不超过 16**——避免文件膨胀。
- **手绘 polygon 必须与 NE 整体边界无 gap**（蒙古 4 部与 NE Mongolia 边界、女真 2 部与 NE Amur/Heilongjiang 边界）。
- **38° 朝鲜分界是粗略近似**——明朝不关心 38° vs 39°，可接受 ±1° 误差。

### §5.4 Review 检查表

- [ ] `shaanxi` polygon 视觉缩到关中（甘肃 / 宁夏不再在大明疆域内）
- [ ] joseon_north / joseon_south 边界同源（都来自 Korea 整体）
- [ ] 蒙古 4 部 + 女真 2 部 + 播州 顶点 ≥ 10
- [ ] 蒙古 4 部之间无明显 gap
- [ ] `npm run map:validate` 0 issue
- [ ] `npm test` 470 测试全绿
- [ ] `npm run hash:state` 与 v0.6.1-patch 基线一致（策略不变 → 必一致）

### §5.5 Commit 计划

```bash
git add src/scripts/rebuildGeoMap.ts src/map/source/mapRegionSource.ts src/map/generated/mapTiles.ts
git commit -m "feat(map): phase 3 — Wanli accuracy fixes (shaanxi 关中, joseon 38°, mongol 12-vertex)"
```

---

## §6. 阶段 4：势力标签与色板校验

### §6.1 目标

校验 `factionMapLabels.ts` 坐标 + `mapFactionColors` 色板 + 31 区染色一致性。**新增** `validateInitialFactions` 脚本。

### §6.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 4.1 | 校验 `factionMapLabels` 全部 15 个标签 | `src/scripts/rebuildGeoMap.ts` | 标签 `(x, y)` 在 `0-1000 / 0-700` 内 |
| 4.2 | 校验 `factionMapLabels` 标签 `minZoom/maxZoom` | `src/scripts/rebuildGeoMap.ts` | `minZoom >= 0`，`maxZoom <= mapCanvas.maxZoom (4)`，且与 `LABEL_ZOOM_THRESHOLDS` 一致 |
| 4.3 | 新增 `src/scripts/validateInitialFactions.ts` | 新文件 | 遍历 31 region，校验 `PoliticalOverlayLayer` 输出 fill = `mapFactionColors[ownerFactionId]` |
| 4.4 | 用 jsdom + render PoliticalOverlayLayer | `src/scripts/validateInitialFactions.ts` | 30 行内能完整跑通 |
| 4.5 | 输 PASS / FAIL 表格 | `src/scripts/validateInitialFactions.ts` | 31 行 PASS / 0 FAIL |
| 4.6 | `package.json` 新增 `map:validate-init` 脚本 | 修改 | `"map:validate-init": "tsx src/scripts/validateInitialFactions.ts"` |
| 4.7 | 新增 `src/tests/validateInitialFactions.test.ts` | 新测试 | vitest 跑通，1 测试 PASS |
| 4.8 | 跑 `npm run map:validate-init` | 命令 | 31 region 全部 PASS |
| 4.9 | `npm test` 全绿 | 命令 | 470 + 1 = 471 测试全绿 |

### §6.3 关键约束

- **`mapFactionColors.ts` 不动**——本轮**不**改势力色板。
- **`factionMapLabels.ts` 是自动生成产物**——内容继承 v0.6.1-patch，15 个标签坐标不变。
- **`validateInitialFactions` 脚本读 `regionTemplates` + `mapFactionColors` + 模拟一次 PoliticalOverlayLayer 渲染**——不依赖 DOM 全套，只校验 fill 颜色。
- **染色校验是结构性的**——不是视觉对比（视觉在阶段 6 人工对）。

### §6.4 Review 检查表

- [ ] `npm run map:validate-init` 31 region 全部 PASS
- [ ] 15 个 faction label 全部在画布内
- [ ] 15 个 faction label minZoom / maxZoom 与 LABEL_ZOOM_THRESHOLDS 不冲突
- [ ] `mapFactionColors` 13 个势力色板未变
- [ ] `npm test` 471 测试全绿
- [ ] `npm run hash:state` 5 节点与 v0.6.1-patch 一致

### §6.5 Commit 计划

```bash
git add src/scripts/validateInitialFactions.ts src/scripts/rebuildGeoMap.ts src/tests/validateInitialFactions.test.ts src/map/generated/factionMapLabels.ts package.json
git commit -m "test(map): phase 4 — validateInitialFactions script + faction label check"
```

---

## §7. 阶段 5：验证 & 红线

### §7.1 目标

跑全套验证命令，确保 `npm run typecheck` / `npm test` / `npm run build` / `npm run map:*` 全部 + `npm run batch` / `npm run hash:state` 全部通过。

### §7.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 5.1 | `npm run typecheck` | 命令 | 0 错误 |
| 5.2 | `npm test` | 命令 | 471 测试全绿 |
| 5.3 | `npm run build` | 命令 | tsc + vite build 0 错误 |
| 5.4 | `npm run map:rebuild-geo` | 命令 | 3 个产物重生成 |
| 5.5 | `npm run map:generate` | 命令 | `mapTiles.ts` 重生成 |
| 5.6 | `npm run map:validate` | 命令 | 0 issue |
| 5.7 | `npm run map:validate-init` | 命令 | 31 region 全部 PASS |
| 5.8 | `npm run batch` | 命令 | `errorRuns=0`（100/100） |
| 5.9 | `npm run hash:state` | 命令 | 5 节点与 v0.6.1-patch 基线**完全一致** |
| 5.10 | `npm run perf:smoke` | 命令 | 单月 P95 < 200ms（应与 v0.6.1-patch 持平） |
| 5.11 | 跑 5.1-5.10 全套无错 | 命令 | 全绿 |

### §7.3 CI 关键命令（与 v0.6.1-patch 一致）

```bash
# PR 红线
npm run typecheck
npm test
npm run build
npm run map:rebuild-geo      # 新增 — 离线可跑
npm run map:generate         # 已有
npm run map:validate         # 已有
npm run map:validate-init    # 新增
npm run hash:state
npm run perf:smoke
```

### §7.4 关键约束

- **`hash:state` 必须 0 漂移**——region id 不变 + 势力不变 + 模拟逻辑不变 → 必一致。若漂移立即检查。
- **`batch errorRuns` 必须 0**——100/100 必须不失败。
- **CI 必须在 5 分钟内出 PR 结果**——`map:rebuild-geo` 在 cache 完整时 < 5 秒。

### §7.5 Review 检查表

- [ ] `npm run typecheck` 0 错误
- [ ] `npm test` 471 全绿
- [ ] `npm run build` 0 错误
- [ ] `npm run map:rebuild-geo` 跑通
- [ ] `npm run map:generate` 跑通
- [ ] `npm run map:validate` 0 issue
- [ ] `npm run map:validate-init` 31 PASS
- [ ] `npm run batch` errorRuns=0
- [ ] `npm run hash:state` 0 漂移
- [ ] `npm run perf:smoke` < 200ms

### §7.6 Commit 计划

（阶段 5 是验证阶段，**无独立 commit**——验证结果并入阶段 6 / 7 / 8 一起提交。）

---

## §8. 阶段 6：视觉回看 & 调优

### §8.1 目标

浏览器打开页面，手动对比百度地图，确认海岸线 / 省区 / 蒙古 / 朝鲜 / 山脉 / 河流 视觉与百度地图肉眼一致。**调优**微小错位（label 偏移、polygon 顶点微调）。

### §8.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 6.1 | 浏览器打开 `npm run dev` | 手测 | 页面加载，无 console 错误 |
| 6.2 | 视觉对比海岸线：朝鲜半岛 / 日本列岛 / 中南半岛 / 库页岛 | 手测 | 与百度地图肉眼一致（误差 ≤ 2 像素） |
| 6.3 | 视觉对比省区：河北 / 山西 / 陕西 / 山东 / 江苏 / 福建 / 广东 | 手测 | 与百度地图肉眼一致 |
| 6.4 | 视觉对比朝鲜 38° 分界 | 手测 | 38° 上下分明；与百度南北韩 38° 停战线 一致 |
| 6.5 | 视觉对比蒙古 4 部 | 手测 | 4 部相邻，无明显 gap；与现代蒙古地图比例一致 |
| 6.6 | 视觉对比女真 2 部 + 黑龙江 | 手测 | jianzhou / haixi / amur_basin / nurgan_coast 4 区相邻 |
| 6.7 | 视觉对比播州 enclave | 手测 | bozhou 在 贵州 内部，不与大明其他区重叠 |
| 6.8 | 视觉对比河流 | 手测 | 长江 / 黄河 / 珠江 / 黑龙江 在正确位置 |
| 6.9 | 视觉对比山脊 | 手测 | 喜马拉雅 / 天山 / 阴山 / 大兴安岭 大致位置对（手绘不要求严格准） |
| 6.10 | 视觉对比势力标签 | 手测 | 15 个 faction label 全部可见，不重叠 |
| 6.11 | 视觉对比 31 region 染色 | 手测 | 16 大明区全红、2 朝鲜全青绿、2 日本全紫、4 蒙古各色、2 女真各色、2 黑龙江、1 播州橙 |
| 6.12 | 截屏（PNG）+ 标记偏差 | 手测 | 截屏存档 `docs/screenshots/v0.7-map.png` |
| 6.13 | 调优 labelX / labelY | `src/scripts/rebuildGeoMap.ts` | 标签错位时微调 |
| 6.14 | 调优蒙古 4 部顶点 | `src/scripts/rebuildGeoMap.ts` | gap > 2 像素时微调 |
| 6.15 | 重跑全套验证 | 命令 | 调优后 5.1-5.11 全绿 |

### §8.3 关键约束

- **调优必须微量**——单次调整 < 5 个 label 坐标 / < 5 个 polygon 顶点。
- **调优后必须重跑全套验证**——避免引入新问题。
- **截屏存档**——便于回滚对比。

### §8.4 Review 检查表

- [ ] 31 region + 7 context 视觉无错位
- [ ] 31 region 染色与 `mapFactionColors[ownerFactionId]` 一致
- [ ] 15 faction label 全部可见
- [ ] 蒙古 4 部无 gap
- [ ] 截屏 `docs/screenshots/v0.7-map.png` 存档
- [ ] 调优后全套验证（5.1-5.11）全绿

### §8.5 Commit 计划

```bash
git add src/scripts/rebuildGeoMap.ts src/map/source/mapRegionSource.ts src/map/generated/mapTiles.ts docs/screenshots/v0.7-map.png
git commit -m "fix(map): phase 6 — visual tweaks (label/polygon alignment to Baidu map)"
```

---

## §9. 阶段 7：回滚方案

### §9.1 目标

准备回滚预案：备份 v0.6.1-patch 三个生成产物 + 演练 git revert 流程。**不真回滚**，只准备。

### §9.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 7.1 | 备份 `src/map/physicalMap.ts` v0.6.1-patch 版本 | `docs/rollback/v0.6.1-patch_physicalMap.ts` | 副本存在 |
| 7.2 | 备份 `src/map/source/mapRegionSource.ts` v0.6.1-patch 版本 | `docs/rollback/v0.6.1-patch_mapRegionSource.ts` | 副本存在 |
| 7.3 | 备份 `src/map/generated/factionMapLabels.ts` v0.6.1-patch 版本 | `docs/rollback/v0.6.1-patch_factionMapLabels.ts` | 副本存在 |
| 7.4 | 备份 `src/scripts/rebuildGeoMap.ts` v0.6.1-patch 版本 | `docs/rollback/v0.6.1-patch_rebuildGeoMap.ts` | 副本存在 |
| 7.5 | 写回滚 README | `docs/rollback/README.md` | 注明：cp v0.6.1-patch_* 覆盖 src/ 即可回滚 |
| 7.6 | 演练回滚（不真 commit） | 命令 | `cp docs/rollback/v0.6.1-patch_*.ts src/...` 后 `npm run map:validate` 通过 |

### §9.3 关键约束

- **回滚备份是只读**——不修改 `src/` 真文件（演练除外）。
- **演练必须真跑 `map:validate`**——确认回滚后能恢复。
- **回滚 README 必须明确命令**——接手 agent 可一键回滚。

### §9.4 Review 检查表

- [ ] `docs/rollback/` 4 个备份 + README 存在
- [ ] 演练回滚后 `npm run map:validate` 0 issue
- [ ] 演练后恢复 v0.7 版本（不真 commit）

### §9.5 Commit 计划

```bash
git add docs/rollback/
git commit -m "chore(map): phase 7 — rollback backups + README"
```

---

## §10. 阶段 8：提交与文档更新

### §10.1 目标

更新 `PROGRESS.md` + `README.md` + 写 v0.7 战报，git push origin main。

### §10.2 子任务

| ID | 任务 | 文件 | 验收 |
|---|---|---|---|
| 8.1 | 更新 `PROGRESS.md` 增 v0.7 战报 | `PROGRESS.md` | 新增 §0.3 段，含完成日期 / commit 数 / 3 处修正 / 缓存大小 / 测试数 |
| 8.2 | 更新 `README.md` 增 NE 致谢 | `README.md` | 新增"Map Data Sources"段，注明 Natural Earth public domain |
| 8.3 | 更新 `docs/MING-WAR_MapRefactor_v0.7_SPEC.md` 战报 | SPEC | 填写 §8.3 战报（完成日期 / commit 数 / 验证结果） |
| 8.4 | 跑最终全套验证 | 命令 | typecheck / test / build / map:* / batch / hash:state / perf:smoke 全绿 |
| 8.5 | `git log --oneline` 增 v0.7 commit | 命令 | 至少 5 个 commit（阶段 0 / 1 / 2 / 3 / 4 / 6 / 7 / 8） |
| 8.6 | `git push origin main` | 命令 | push 成功 |

### §10.3 关键约束

- **PROGRESS.md 战报必须填数字**——不是"完成" / "已通过"——而是"470 → 471 测试"、"map:validate 0 issue"等具体指标。
- **README.md 致谢必须明确 license**——"Natural Earth data is in the public domain"。
- **最终全套验证必须 0 失败**——不允许带病 push。

### §10.4 Review 检查表

- [ ] `PROGRESS.md` 增 §0.3 战报段
- [ ] `README.md` 增 Map Data Sources 段
- [ ] `docs/MING-WAR_MapRefactor_v0.7_SPEC.md` §8.3 战报已填
- [ ] 最终全套验证 0 失败
- [ ] `git log --oneline` 有 v0.7 commit
- [ ] `git push origin main` 成功

### §10.5 Commit 计划

```bash
git add PROGRESS.md README.md docs/MING-WAR_MapRefactor_v0.7_SPEC.md
git commit -m "docs(map): phase 8 — PROGRESS.md v0.7 war report + README NE attribution"
```

---

## §11. 全量回归（阶段 5 / 8 通用）

### §11.1 回归清单

```bash
# 1. 静态
npm run typecheck

# 2. 单元测试
npm test

# 3. 构建
npm run build

# 4. 地图产物链
npm run map:rebuild-geo
npm run map:generate
npm run map:validate
npm run map:validate-init

# 5. 业务回归
npm run batch
npm run hash:state
npm run perf:smoke
```

### §11.2 不变量验证

- [ ] `map:validate` 0 issue
- [ ] `map:validate-init` 31 PASS
- [ ] 大明存活率 > 0.8（与 v0.6.1-patch ±5%）
- [ ] 大明平均控制区 = 16（开 2 京 13 省 + 辽东）
- [ ] `batch errorRuns=0`
- [ ] `hash:state` 5 节点 0 漂移

### §11.3 Fix 策略

发现的任何回归问题必须按以下顺序处理：

1. **CI 红线失败**（typecheck / test / build / map:validate / map:validate-init）：立即修复。
2. **模拟漂移**（batch 指标退化 > 10%）：评估是否影响玩法，不影响则记录在 PROGRESS.md。
3. **`hash:state` 漂移**：region id / 势力不变 → 不应该漂；漂移立即回滚 v0.6.1-patch。
4. **视觉错位严重**：阶段 6 调优，必要时分阶段 3 改 `rebuildGeoMap.ts`。

### §11.4 最终 commit + push

```bash
git add .
git commit -m "fix: full regression fixes from v0.7 map refactor"
git push origin main
```

---

## §12. 风险与回滚预案

| 阶段 | 风险 | 检测 | 回滚 |
|---|---|---|---|
| 0 | NE cache 文件未下载 | `npm run map:fetch-ne` 失败 | 重新跑 `map:fetch-ne` |
| 1 | 海岸线与百度差异 > 2 像素 | 视觉回归 | 调 `minDistance` 阈值 |
| 2 | 31 region id 不全 | `map:validate` orphan issue | 修 `rebuildGeoMap.ts` region() 调用 |
| 3 | shaanxi 缩到关中后甘肃 / 宁夏"消失" | 视觉回归 | 视觉确认；明朝实控嘉峪关内，OK |
| 3 | 38° 朝鲜分界与"朝鲜八道"不一致 | 视觉回归 | 38° 是粗略近似，可接受 |
| 4 | 染色校验 FAIL | `map:validate-init` 报 FAIL | 检查 `regionTemplates.ownerFactionId` 与 `PoliticalOverlayLayer` 染色 |
| 5 | `hash:state` 漂移 | `npm run hash:state` 漂 | 立即回滚到 v0.6.1-patch |
| 5 | `batch errorRuns > 0` | `npm run batch` 报错 | 立即回滚（region id / 势力不变 → 不应该出错） |
| 6 | 调优引入新问题 | 全套验证 FAIL | git revert 阶段 6 commit |
| 7 | 备份缺失 | `docs/rollback/` 不存在 | 重跑阶段 7 |
| 8 | push 失败 | `git push` 报错 | 解决冲突后重 push |

### §12.1 一键回滚命令

```bash
# 完全回滚 v0.7 到 v0.6.1-patch
cp docs/rollback/v0.6.1-patch_physicalMap.ts src/map/physicalMap.ts
cp docs/rollback/v0.6.1-patch_mapRegionSource.ts src/map/source/mapRegionSource.ts
cp docs/rollback/v0.6.1-patch_factionMapLabels.ts src/map/generated/factionMapLabels.ts
cp docs/rollback/v0.6.1-patch_rebuildGeoMap.ts src/scripts/rebuildGeoMap.ts
npm run map:generate
npm run map:validate
```

---

## §13. 验证命令总览（最终）

```bash
# PR 红线（5 分钟内）
npm run typecheck
npm test
npm run build
npm run map:rebuild-geo
npm run map:generate
npm run map:validate
npm run map:validate-init
npm run hash:state
npm run perf:smoke

# 阶段验收
npm run batch             # 100×240 errorRuns=0
npm run hash:state        # 5 节点 0 漂移
npm run map:validate      # 0 issue
npm run map:validate-init # 31 PASS
```

---

## §14. 完结

满足以下条件时，本轮大地图重构 PLAN 执行完成：

- [ ] 9 阶段（0 前置 + 1 重建 physicalMap + 2 重建 mapRegionSource + 3 Wanli 修正 + 4 校验 + 5 红线 + 6 视觉回看 + 7 回滚 + 8 提交文档）全部 commit
- [ ] 471 测试全绿（470 + 1 validateInitialFactions）
- [ ] `npm run map:validate` 0 issue
- [ ] `npm run map:validate-init` 31 PASS
- [ ] `npm run hash:state` 5 节点 0 漂移（与 v0.6.1-patch 一致）
- [ ] `npm run batch` `errorRuns=0`、大明平均控制区 = 16
- [ ] 视觉回归：31 region + 7 context 与百度地图肉眼一致
- [ ] 全量回归 fix 完毕
- [ ] `git push origin main` 成功
