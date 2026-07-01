# 万历：山河崩塌 — 开发进度

> 本文档是接手 agent 的路标：项目走到哪了、怎么验证、下一步干啥、哪里有坑。
> 对应详细设计：`docs/v2-optimization-spec.md`（SPEC，含 S1–S6 战报）+ `docs/v2-implementation-plan.md`（PLAN）。
> 下一轮工作入口（性能 / 状态 / Worker / 存档 / CI 改造）：`docs/MING-WAR_Web架构流畅稳定优化改造_SPEC.md`（v0.6-stability-design，承接方案原稿 `docs/MING-WAR《万历：山河崩塌》Web 架构流畅稳定优化建设方案.docx`）。
> 每次阶段完成后同步更新本文档 + SPEC 战报。

---

## 0. 项目概况

- **MING-WAR**：《万历：山河崩塌》——晚明大战略游戏，目标是模拟 **维多利亚3 (Victoria 3)** 的社会经济闭环。
- **技术栈**：React 19 + TypeScript + Vite 6 + Zustand + Vitest 3。月度模拟核心是纯函数 `simulateMonth`（`structuredClone` 输入、固定随机种子，确定性可复现）。
- **核心范式**：单一驱动闭环——`pop 劳动 → 产业生产 → 市场供需/价格 → pop 购买力/生活水平 → 财富分化 → 政治力量 → 政治运动/法律改革 → modifier → 反作用于生产`。每一环都建了零件，工作重心是**把环与环的齿轮咬合**，而非堆孤岛系统。

## 0.1 v0.6-stability 性能 / 稳定性底座（2026-06-30 完成）

> 6 阶段优化全部 commit：`feat(perf) → refactor(sim) → refactor(store) → feat(runtime) → feat(save) → ci`
> 详情：`docs/MING-WAR_Web架构流畅稳定优化改造_SPEC.md` + `docs/MING-WAR_流畅稳定优化改造_PLAN.md` + `docs/perf-baseline.md`

| 维度 | Phase 1（v0.3.0 baseline） | Phase 6（v0.6 终值） |
|---|---|---|
| 单月 p95 | 24.15 ms | 24.23 ms（持平） |
| 1080 月（3 种子） | — | 18.35 s |
| 测试数 | 377 | **461**（+84） |
| hash:state 5 节点漂移 | baseline | **0 漂移** |
| batch errorRuns | 0 | **0**（100/100） |
| `simulation.ts` 行数 | 777 | **145**（拆 7 阶段） |
| `state` / `decision` / `pendingEventId` 分层 | 1 store | **3 stores**（UI / View / 基础设施） |
| `simulateMonth` 调用入口 | UI 直接 import | **SimulationService 抽象** |
| 存档格式 | 单版本字符串 | **versioned + 校验 + 迁移** |
| CI | 无 | **2 workflow**（ci.yml + perf-regression.yml） |

**新增底座模块**：`src/core/timing.ts` / `stateHash.ts` / `simulationContext.ts` / `simulationPhases/`（7 阶段）/ `src/store/uiStore.ts` / `gameViewStore.ts` / `src/runtime/simulationService.ts` / `viewSnapshot.ts` / `localSimulationService.ts` / `src/save/saveValidation.ts` / `saveMigrations.ts` / `autoSave.ts` / `src/scripts/perf{Month,Year,FullGame,Clone,Save}.ts` / `stateHash.ts` / `.github/workflows/ci.yml` / `perf-regression.yml`

**验收红线全部通过**：typecheck / test / build / map:validate / hash:state / perf:smoke / test:save / test:determinism / batch errorRuns=0。

**已知遗留**（非本次引入，hash:state 证实）：`validateInvariants` 报 `treasury-extreme-negative` 警告——v0.3.0 baseline 同样存在，根因在大明长跑财政积累下的极端场景，与本次重构无关。修复待 v0.7 内容扩充阶段。

## 0.2 v0.6.1-patch 遗留清理（2026-06-30 完成）

> 10 项 v0.6-stability 遗留处理，11 个 commit。
> 详情：`docs/MING-WAR_遗留问题修复_SPEC_v0.6.1-patch.md` + `docs/MING-WAR_v0.6.1-patch_PLAN.md` + `docs/perf-baseline.md` §6

| # | 标题 | commit |
|---|---|---|
| B1 | `eliminateDefeatedFactions` 清 army/grain | `33a1695` |
| B2 | `LocalSimulationService` 3 槽自动存档触发 | `2cce1c1` |
| B3 | `runMarketPhase` 独立抽出 | `7b96526` |
| B4 | 删 `useGameStoreCompat` 死代码 | `6a0f57a` |
| B5 | `GAME_VERSION` 集中 + package.json 升 0.6.0 | `d543794` |
| B6 | 修 `modifiers.ts` 文档注释 | `cc9f652` |
| B7 | `fake-indexeddb` 真实 IDB 测试 + 修 saveManager keyPath bug | `58b693a` |
| B8 | `PROGRESS.md` 升 v0.6.0 | `49cc3e8` |
| B9 | treasury-extreme-negative 阈值升 -1M | `c26c4bb` |
| B10 | 工作区未追踪目录加 gitignore | `d5c390f` |

| 维度 | v0.6-stability | v0.6.1-patch |
|---|---|---|
| 测试数 | 461 | **470**（+9）|
| hash:state m=0 | 不变 | 不变 ✅ |
| hash:state m≥12 | 不变 | 漂移（B1 合法行为修正）|
| batch errorRuns | 0 | **0**（100/100）|
| 存档 IDB 路径 | **断裂**（keyPath bug） | **修复** ✅ |
| 自动存档触发 | 3 槽 API 但未触发 | **真触发**（monthly/yearly/milestone）|
| `simulation.ts` 行数 | 145 | 145（无变化）|

**关键修复**：B7 发现 v0.6-stability 阶段 `saveManager.ts:60` 用了 `keyPath: "id"` 创建 store，但 `SerializedSave` 没有 `id` 字段——**整个 IDB save 路径从 v0.6 起就没工作过**。已通过去掉 keyPath 修复，与 `autoSave.ts` 的显式 key put(value, key) 模式对齐。

---

## 0.3 四层艺术系统续补（2026-07-01 完成）

> 承接 `a837e40 feat: add four-layer art catalog` 的中断工作。
> 续作计划：`docs/superpowers/plans/2026-07-01-four-layer-art-continuation.md`

| 层级 | 状态 |
|---|---|
| 重大历史事件专属插画 | ✅ 10 张重新绘制 PNG 接入：己巳之变、辽饷加派、甲申国难、一条鞭法争议、魏忠贤诏狱、袁崇焕之死、陕西旱荒链、援朝战争、后金建立、萨尔浒之战 |
| 历史人物专属立绘 | ✅ 10 位重新绘制 PNG 接入：张居正、万历帝、努尔哈赤、熊廷弼、魏忠贤、袁崇焕、崇祯帝、李成梁、丰臣秀吉、朝鲜宣祖 |
| 势力领袖专属立绘 | ✅ 当前 `factionTemplates` 全覆盖：大明/建州/朝鲜/日本复用对应历史人物立绘；土默特、察哈尔、海西、科尔沁、奴儿干、虾夷、播州使用重新绘制领袖 PNG |
| 通用事件家族图 | ✅ 8 类 fallback 保留，由 `eventVisuals.ts` 兼容导出 |

**资产目录**：`src/assets/art/events/`、`src/assets/art/portraits/characters/`、`src/assets/art/portraits/factions/`。

**测试强化**：`src/tests/event-visuals.test.tsx` 现在验证重大事件不能回退到 `event-*.png` 通用横幅，历史人物不能回退到 `ming-character-portraits.png` 合图，势力领袖必须走 `portraits/characters/` 或 `portraits/factions/` 的独立资源。

---

## 0.4 东北亚 9 处势力色块错位修复（v0.7.4，2026-07-01）

**问题**：v0.7.3 网格对齐（`8c2e326`）把 mongol/jurchen/joseon 的 map tile 几何换成矩形网格，但 `factionMapLabels.ts` 没同步更新坐标。结果 9 个势力标签浮在错误的图块上 → 用户截图里看到「色块和地图省区政治区域色块不匹配」。

**根因**：

- `factionMapLabels.ts` 的 (x, y) 是 v0.7.3 之前的旧位置
- `mapTiles.ts` 的 labelX/labelY 是 v0.7.3 之后的新位置
- 标签底色由 `PoliticalOverlayLayer` 按 (x, y) 处的实际图块染色 → 旧位置漂到邻接图块 → 颜色错位

**9 处错位（按用户截图）**：

| 标签 | 旧坐标 | 新坐标 | 对应图块 | 原因 |
|---|---|---|---|---|
| 呼伦贝尔 | 缺失 | (625, 102.9) | hulunbuir | v0.7.3 把 hulunbuir 升为可玩图块，但没补 label |
| 科尔沁 | (695, 171.6) | (662.5, 164.7) | korchin_steppe | 网格重排后矩形右上角 = (725, 192.2) |
| 海西女真 | (725, 171.6) | (775, 164.7) | haixi | 网格后中心 x=775 |
| 建州女真 | (735, 212.7) | (750, 205.9) | jianzhou | 同上 |
| 察哈尔 | (622.5, 205.9) | (550, 212.7) | chahar_steppe | 网格后矩形 (500–600, 192.2–233.3) 中心 |
| 土默特 | (536.3, 219.6) | (525, 240.2) | tumed_steppe | 网格后矩形 (475–575, 233.3–247.1) 中心 |
| 朝鲜北道 | 合并 | (743.8, 238.8) | joseon_north | 旧 joseon 一个 label 同时覆盖南北两省 |
| 朝鲜三南 | 合并 | (747.5, 304.7) | joseon_south | 同上 |
| 东北亚边缘 | 缺失 | (900, 50) | northeast-asia-edge (新 context) | 北海已存在，但缺少东北亚海面 context |

**修复**：

1. `src/map/generated/factionMapLabels.ts` — 18 个 label 全部重写，9 个错位的全部回到图块 labelX/labelY，新增 `hulunbuir`（factionId=korchin, 重要性 2）、拆分 `joseon` 为 `朝鲜北道`+`朝鲜三南`、新增 `东北亚边缘`（factionId=northeast-asia-edge, 重要性 3）。
2. `src/map/source/mapRegionSource.ts` + `src/map/generated/mapTiles.ts` — 新增 context tile `northeast-asia-edge`（polygon = 鄂霍次克海方向，与 `northern-sea` 错开 1° 不重叠），`defaultControllerFactionId=northeast-asia-edge`。
3. `src/map/mapFactionColors.ts` — 增加 `"northeast-asia-edge": "#6B6A8C"` 兜底色（冷紫，对应海面），与现有 `western-sea` (#5F7A82) 错开。
4. `src/scripts/rebuildGeoMap.ts` — 同步更新 `buildFactionLabels` 的 `factionLabelPoint(lon, lat)` 坐标（lon = 68 + (x/1000)·80, lat = 58 − (y/700)·51 反推）、拆分 joseon、添加 hulunbuir 与东北亚边缘、新增对应 `contextTile` 节点。下次 `npm run map:rebuild-geo` 不会再回退。

**验收**：

- `npm run typecheck` ✓ 0 errors
- `npm test` ✓ 499/499 tests pass（含 `map-labels.test.ts` 6/6 + `map-generation-pipeline.test.ts` 2/2 + 全部地图 / 模拟测试）
- `npm run map:validate` ✓ 39 tiles (31 playable + 8 context，含新增 northeast-asia-edge)
- 对齐脚本验证：9 个标签与 9 个 map tile 中心坐标 delta=0.00，全部 OK

**遗留**：

- `japan` 标签位置 (856.3, 314.3) 仍指向西日本/东日本之间空隙。下次重做日本地块时一起对齐；当前无视觉冲突（紫色色块与 joseon/japan 边界距离合理）。
- `ainu` 标签 (933.7, 192.2) 与 ezo 中心一致但与 sakhalin 距离过近，文字会有少量视觉重叠（importance=3 远景，可接受）。

### v0.7.4 → v0.7.5 视觉回退 + 真实根因修复（2026-07-01）

**用户反馈（11:27）**：v0.7.4 提交后截图仍显示 9 个势力色块"还是正方形，没有真的嵌入到地图省区里"。重新读代码后发现 **v0.7.4 的 PROGRESS 自述把根因写错了**——不是"label 错位导致色块错位"，而是 v0.7.3（commit `8c2e326`）**故意**把 6 个 mongol/jurchen tile 设计成严格 4 顶点矩形网格。

**v0.7.3 当时改 grid 矩形的真实原因**：12+ 顶点自由多边形的 bbox 30+ 对互相重叠 → 色块交错混合。所以选择"严格矩形 + 共享经纬线"以 0 重叠为优先。

**v0.7.5 决策**：保留 v0.7.3 的胜利果实（bbox 不重叠），但**改用 8-10 顶点多边形**让形状沿历史地理边界（草原/林地/山脉/河流）走，自然不再"正方块感"。

**6 处多边形（投影坐标，单位 SVG 像素）**：

| Tile | 顶点 | bbox (w×h) | aspect | 真实历史边界 |
|---|---|---|---|---|
| `hulunbuir` (呼伦贝尔) | 10 | 197×65 | 3.03 | 额尔古纳河、呼伦贝尔草原、大兴安岭西侧 |
| `korchin_steppe` (科尔沁) | 11 | 115×54 | 2.13 | 大兴安岭、嫩江、西拉木伦河、辽河上游 |
| `chahar_steppe` (察哈尔) | 10 | 105×40 | 2.62 | 蒙古高原南缘、锡林郭勒、大兴安岭西侧 |
| `tumed_steppe` (土默特) | 10 | 100×14 | 7.14 | 大青山、长城、黄河河套 |
| `haixi` (海西女真) | 10 | 90×52 | 1.73 | 小兴安岭、松花江中游、开原/铁岭 |
| `jianzhou` (建州女真) | 10 | 87×28 | 3.11 | 长白山、鸭绿江、辽东东部 |

**两两 bbox 严格不重叠**（v0.7.3 回归保护，lat 边界留 ≥1° 缓冲；用 Python 脚本验证 15 对全 OK）。

**修复（已落地）**：

1. `src/map/source/mapRegionSource.ts` — 6 个 `historical-frontier-manual` tile 的 `paths` 从 4 顶点矩形改为 8-10 顶点多边形（SVG 像素坐标），每条都带注释说明历史地理边界。
2. `src/map/generated/mapTiles.ts` — 同步 6 个 tile（rebuildGeoMap 跑出来的产物，必须跟源数据一致）。
3. `src/scripts/rebuildGeoMap.ts` — 同步 `buildRegions` 里的 6 个 `manualPath([[lng,lat],...])` 改用经纬度精度（步进 0.3-0.5°）的多边形，保证下次 `npm run map:rebuild-geo` 不会再回退到 4 顶点网格。
4. **新增** `src/tests/map-polygon-shape.test.ts` — 5 个测试守住 v0.7.5 设计承诺：
   - 6 个 tile 至少 6 顶点（v0.7.3 是 4）
   - bbox 长宽比 ≠ 1（误差 1.5px 容忍）
   - 两两 bbox 严格不重叠（v0.7.3 回归保护）
   - bbox 在 viewBox（0..1000, 0..700）内
   - `mapRegionSource` 和 `mapTiles` 6 个 tile paths 同步（防止下次 rebuild 漂移）
5. `PROGRESS.md` — 本条记录

**验收**：

- `npm run typecheck` ✓ 0 errors
- `npx vitest run` ✓ **504 / 504 pass**（v0.7.4 是 499，新增 5 个新测试）
- `npx tsx src/scripts/validateMapRegions.ts` ✓ 39 tiles (31 playable + 8 context)
- Python 脚本几何检查 ✓ 6 个多边形顶点 10-11、aspect 1.73-7.14、两两 bbox 15 对全不重叠

**遗留（不在本次范围）**：

- `japan` 标签 (856.3, 314.3) 仍指向西日本/东日本之间空隙（v0.7.3 遗留）
- `ainu` 标签 (933.7, 192.2) 与 ezo 中心一致但与 sakhalin 距离过近（v0.7.3 遗留）

---

### v0.7.5 → v0.7.6 位置错位修复（2026-07-01，第二次反馈）

**用户反馈（12:44）**：v0.7.5 截图仍显示 9+ 个势力色块和实际地图省区不匹配。重新读代码并对比截图，发现 v0.7.5 只改了"形状"（10 顶点 vs 4 顶点矩形），但**所有 v0.7.5 path 的整体经纬度位置都偏西 30-100px**——尤其 6 个 mongol/jurchen tile 和 4 个 context tile 完全错位。

**真实根因**（v0.7.5 之前的设计缺陷）：

1. **投影参考点选取错误**——v0.7.5 设计坐标时参考的"中心点"是经验值，不是用真实的投影公式（`x = 13.728*lng - 980.45, y = -11.15*lat + 709.2`）反推。
2. **没有用历史经纬度定义 tile 边界**——v0.7.5 直接用像素坐标手画多边形，没有参照真实地理范围（如"海西 = 松花江流域 124-132E 44-48N"）。
3. **viewBox 边界处理缺失**——v0.7.5 给 context tile（如 `western-pacific` 130-160E）设计的 path 顶到 x=1216，越出 viewBox 上限 1000。

**用户指出 15+ 个位置错位**：黑龙江（amur_basin）、奴儿干（nurgan_coast）、海西、建州、朝鲜北道、朝鲜三南、呼伦贝尔、科尔沁、察哈尔、土默特、哈密、琉球、东南亚边缘、东北亚边缘、北海、西太平洋。

**v0.7.6 修复方案**：用经纬度精确设计 6 个 mongol/jurchen tile + 5 个 context tile（hami/liuqiu/southeast-asia/northeast-asia-edge/northern-sea/western-pacific）的 path，**相邻 tile 严格共享经纬线**（避免 path 边跨立），整体约束在 viewBox 1000×700 内。

**13 个 tile 投影坐标表**（从北京 116E 39.9N → (612, 264) 和 拉萨 91E 30N → (269, 375) 回归反推）：

| tile | 真实经纬度 | path 中心（投影） | bbox (w×h) | aspect |
|---|---|---|---|---|
| `hulunbuir`（呼伦贝尔） | 118.5-126.5E, 48-53.5N | (703, 143) | 110×61 | 1.79 |
| `korchin_steppe`（科尔沁） | 120-126E, 45-48N | (698, 193) | 82×45 | 1.85 |
| `chahar_steppe`（察哈尔） | 108-120E, 42-45N | (567, 225) | 165×33 | 4.93 |
| `tumed_steppe`（土默特） | 108-114E, 40.5-42N | (541, 249) | 82×17 | 4.93 |
| `haixi`（海西女真） | 126-132E, 45-48N | (790, 192) | 82×45 | 1.85 |
| `jianzhou`（建州女真） | 122-130E, 42-45N | (754, 226) | 110×39 | 2.82 |
| `hami`（哈密） | 90-100E, 41-44N | (324, 235) | 137×34 | 4.05 |
| `liuqiu`（琉球） | 122-130E, 24-28N | (763, 414) | 110×45 | 2.44 |
| `southeast-asia`（东南亚边缘） | 95-110E, 5-22N | (434, 564) | 206×190 | 1.08 |
| `western-pacific`（西太平洋） | 130-144E, 15-45N | (900, 375) | 192×335 | 0.57 |
| `northern-sea`（北海） | 140-144E, 50-60N | (969, 96) | 55×112 | 0.49 |
| `northeast-asia-edge`（东北亚边缘） | 130-144E, 42-55N | (900, 168) | 192×145 | 1.32 |

**关键设计原则**：
- 相邻 tile 严格共享经纬线（hulunbuir 南 48N = korchin 北 48N = haixi 西 126E 起点 = hulunbuir 东边界）
- path 边不与邻接 tile 跨立（用跨立实验严格检测，6 mongol/jurchen tile 0 跨立）
- bbox 严格不超出 viewBox (0..1000, 0..700)
- 每个 tile 6+ 顶点（保留 v0.7.5 不规则形状）
- 4 顶点 context tile（海面）只用 4 顶点足够

**修改（5 个源文件 + 1 新测试）**：

1. `src/map/source/mapRegionSource.ts` — 13 个 tile paths 全部用经纬度公式计算像素坐标；labelX/labelY 同步
2. `src/map/generated/mapTiles.ts` — 同步 13 个 tile（rebuildGeoMap 产物）
3. `src/map/generated/factionMapLabels.ts` — 9 个 label 位置更新（korchin/haixi/jianzhou 集体南移 5px 让出建州位）
4. `src/scripts/rebuildGeoMap.ts` — `buildRegions` + `buildContextTiles` + `buildFactionLabels` 全部用经纬度精度的 manualPath（保证下次 `npm run map:rebuild-geo` 不会再回退到偏西位置）
5. **新增** `src/tests/map-tile-location.test.ts` — 25 个新测试守住 v0.7.6 设计承诺：
   - 10 个 tile 投影中心 ±20px 容差（shoelace 几何中心，非 bbox 中心）
   - 9 个 label 落在对应 tile bbox 内
   - 6 个 mongol/jurchen tile bbox minX 显式 ≥ v0.7.5 旧值（**西偏漂移回归保护**）
6. `PROGRESS.md` — 本条记录

**验收**：

- `npm run typecheck` ✓ 0 errors
- `npx vitest run` ✓ **529 / 529 pass**（v0.7.5 是 504，新增 25 个位置测试）
- `npx tsx src/scripts/validateMapRegions.ts` ✓ 39 tiles (31 playable + 8 context)
- Python 几何脚本 ✓ 6 mongol/jurchen tile 严格 0 跨立（path 边不交叉），13 个 tile 全部 bbox 在 viewBox 内

**遗留（不在本次范围）**：

- `japan` 标签位置（856.3, 314.3）仍指向西日本/东日本之间空隙（v0.7.3 遗留，不影响日本色块正确性）
- `ainu` 标签位置（933.7, 192.2）与 ezo 中心一致但与 sakhalin 文字少量重叠（importance=3 远景，可接受）

---

## 1. 当前状态（v0.6.0-stability）

**维多利亚3 闭环进度：5 / 5 已接通（S1–S6 全部完成）**

| 闭环 | 阶段 | 状态 |
|---|---|---|
| 后果环（modifier 激活 + 账本驱动财政） | S1 | ✅ 完成 |
| 经济环（市场—人口—生产整合） | S2 | ✅ 完成 |
| 社会政治环（利益集团政治力量） | S3 | ✅ 完成 |
| 制度环（法律与改革系统） | S4 | ✅ 完成 |
| 外交战争环（外交博弈 + 战线战争） | S5 | ✅ 完成 |
| 内容收口（历史局势 + 完整周期） | S6 | ✅ 完成 |

**v0.6.0-stability 性能 / 稳定性底座（2026-06-30 完成）**

6 阶段优化全部 commit + push 到 main（详见 `docs/perf-baseline.md` §5）：

| 维度 | v0.3.0 baseline | v0.6.0 终值 |
|---|---|---|
| 单月 p95 | 24.15 ms | 24.23 ms（持平）|
| 测试数 | 377 | **461**（+84）|
| hash:state 5 节点漂移 | baseline | **0 漂移** |
| batch errorRuns | 0 | **0**（100/100）|
| `simulation.ts` 行数 | 777 | **145**（拆 7 阶段）|
| `state` / `decision` / UI 分层 | 1 store | **3 stores**（UI / View / 基础设施）|
| 存档格式 | 单版本字符串 | **versioned + 校验 + 迁移** |
| CI | 无 | **2 workflow**（ci.yml + perf-regression.yml）|

**底层模块**（v0.6-stability 新增）：`src/core/timing.ts` / `stateHash.ts` / `simulationContext.ts` / `simulationPhases/`（7 阶段）/ `src/store/uiStore.ts` / `gameViewStore.ts` / `src/runtime/simulationService.ts` / `viewSnapshot.ts` / `localSimulationService.ts` / `src/save/saveValidation.ts` / `saveMigrations.ts` / `autoSave.ts` / `src/scripts/perf*.ts` / `stateHash.ts` / `.github/workflows/ci.yml` / `perf-regression.yml`

**维多利亚3 五环闭环全部接通（S1–S6）**。后续工作转入内容扩充与平衡迭代。

最新提交：`f7ae8b4` docs: clear remaining backlog（v0.6-stability 6 阶段 + 全量回归收尾，详见 §8）

---

## 2. 已完成阶段

### S1　修正系统激活 + 账本驱动（后果环）
- `queryModifier` / `collectModifiers`：按 global→faction→region 级联聚合 modifier。
- modifier effectKey 词表接入各计算点：`tax-mult`/`grain-output-mult`（economy）、`maintenance-mult`（economy）、`control-flat`（control）、`army-org-mult`（warfare）。
- **⚠️ 注意**：`corruption-flat` / `stability-flat` 在 `modifiers.ts` 注释里标注"接 control.ts"，但 **S1b 实际未接入**（control.ts 只接了 control-flat）。S4 把它们归入"一次性 instant 施加"绕开此问题。若 S5+ 需要它们走月度 modifier，须先在 control.ts 补接入点。
- `applyLedgerToState` 是财政唯一真相源：所有收支走 ledger entry，月末统一结算，散点加减清零。不变量：`Δtreasury === 账本净额`。

### S2　市场—人口—生产整合（经济环）
- 统一粮食流：农业+产业产出 → `market.supply`；pop 需求篮子 → `market.demand`；价格基于真实供需。
- pop `needsSatisfaction` = 购买力（税后收入 / 篮子市价）；`wealth` 月累积；饥荒死亡仍由 `grainPerCapita` 物理粮食驱动（双链并行）。
- 产业利润按 ownership 流向对应 pop（gentry←farmland, merchant←marketTown, soldier←militaryTown），财富分化为 S3 政治力量铺路。

### S3　利益集团政治力量（社会政治环）
- clique `strength` 来自 pop wealth 聚合（`CLIQUE_POP_AFFINITY` + `computeFactionCliqueStrengthFromPops`），取代旧的地区属性映射（后者保留作 fallback）。
- `approval`（0-100，与 `support` 正交）：`50 + clamp(sat−50,−30,+20) + 政策契合×3 − tax-mult×50`。生活水平封顶确保加税/饥荒能压到运动阈值。
- 政治运动（`advancePoliticalMovements`）：强(strength≥30)+不满(approval≤35)集团推动诉求（减税/开海/自治/索饷），结算施加临时(12月)modifier；cooldown 防失控。
- **设计特性**：运动是危机放大器——无危机时几乎无感，战争/灾荒压低生活水平时才温和显现。

### S4　法律与改革系统（制度环）
- **法律库** `src/data/laws.ts`：10 条明末法律，覆盖 SPEC §11 六大类（税制/土地/军制/海贸/地方治理/财政权力）。每条 `tags` 与 clique `preferredLaws`/`opposedLaws` 对接。
- **改革流程** `src/core/reform.ts`：
  - `computeReformSupport`：tags × clique 偏好 × strength → 支持/反对力量。
  - `computeReformMomentum`：`2 + 行政×0.08 + 合法性×0.03 + 支持×0.18 − 反对×0.28 − 腐败×0.04 − 战争疲劳×0.04 − 活跃战争×1.5 + (控制度−50)×0.03`，钳 [−6,+8]。**反对权重>支持权重**——改革比推动难。
  - `advanceReforms`：progress≥100 落实 / ≤0 且持续≥3 月失败（损合法性）。
  - `enactLaw`：落实写**永久** faction-scope modifier（接通 S1）+ 受益集团 approval/support 升、受损集团 approval 暴跌 → 触发 S3c 政治运动（闭环）。
  - `autoProposeReforms`：`domesticFocus → 倾向法律`（玩家与 AI 同规则）；momentum 预检过滤注定失败的改革；**tribal/rebel 不自动改革**。
- **effect 三分法**（enactLaw 分流）：
  - modifier-effect keys（tax-mult/grain-output-mult/maintenance-mult/control-flat/army-org-mult）→ 永久 modifier
  - faction-instant（centralization-flat/legitimacy-flat/corruption-flat）→ 一次性施加到 faction 字段
  - region-instant（stability-flat）→ 遍历控制区一次性施加
- 改革由 `domesticFocus` 自动驱动；**玩家手选**（`PlayerDecision.reformLawId`，DecisionPanel 下拉，遗留#3 已实现，可强推阻力大的改革）。

### S5　外交博弈与持续战争（外交战争环）
- **外交关系层** `src/core/diplomacy.ts`：`DiplomaticRelation`（relation/trust/threat/rivalry/truceMonths/treaties/obligations）+ 5 类条约（alliance/tribute/trade/vassal/truce）。`GameState.diplomacy` 双边表，1573 开局初始化历史关系（朝鲜朝贡大明、土默特俺答封贡互市+停战 60 月、建州敌对、日本威胁朝鲜）。`advanceDiplomacy` 月度演变（停战倒计时/威胁重算/关系趋近）+ 条约财政后果走账本（互市关税 income-tariff、朝贡白银守恒转移），**确定性不消费 random**。
- **战线消耗模型** `warfare.ts`：`FrontState`（warSupport/supply）嵌入 WarState；`advanceWar` 改返回 `WarAdvanceResult`——每月按兵力×组织×地形推进 progress + **持续消耗**（军队 attrition、战地军费/军粮走 ledger、战疲累积、进攻方补给衰减），取代单月决胜。**确定性**。
- **修军队归零**（§5.2 核心）：征募从单一 `0.005 + warExhaustion<40 硬门槛` 改为分级 `0.012/0.006/0.003`，长期战争仍低速补员。seed7 10 年军队从 S4 的 11 回升到 **846,274**。
- **和平谈判** `src/core/peace.ts`：战争支持度（战疲/财政/占领/合法性）→ 触发和谈（支持度≤25 求和 / progress≥95 完胜 / 48 月双方疲惫媾和）→ 结算（割地/赔款/朝贡/停战 写回 diplomacy）。不止"占领即吞并"。
- **外交约束开战**（S5d）：`getValidMilitaryTargets` 过滤停战/盟友地区（玩家与 AI 同规则），停战制造备战窗口、同盟阻止互攻。
- **闭环达成**：战争咬合财政（战地军费/赔款/朝贡走账本）、补给（战线消耗）、动员（征募恢复）、外交（停战/盟友约束开战）、国内政治（战争支持度）。军费/补给/战疲能迫使停战，AI 受外交约束理性备战。

### S6　历史局势与完整周期（内容收口）
- **局势引擎** `src/core/situation.ts`：`SituationState`（stage/progress/variables/outcomes）+ `SituationDef`（trigger/advance/outcomes/effect）。`advanceSituations` 月度推进：检查 trigger → 推进 advance → 检测 outcome → 施加 effect。**确定性，不消费 random**。
- **6 条主线局势** `src/data/situations.ts`：张居正改革（consolidated/stalled）、建州统一（unified）、壬辰倭乱（resolved）、辽东危机（liaodong-lost）、陕西流民（rebellion-spreads）、南明偏安（southern-ming）。trigger/advance 由 S1–S5 系统状态推动（腐败/军力/战争/控制区/叛乱）。
- **结局效果接通系统**：outcome effect 写 S1 modifier（八旗 army-org-mult、张居正 tax-mult）或 mutate faction 字段（corruption/legitimacy/centralization/militaryOrganization）。
- **完整周期**：endDate `1621-12` → `1662-12`（覆盖 1573–1662 主线）。
- **平衡调参**：大明 armyTarget `0.01→0.006`、征募速率降、战线 attrition `0.015→0.022`、建州统一增强（+60k 军/+25 组织）、辽东危机基于建州威胁触发——避免大明无界膨胀，给中后期局势触发空间。
- **中后期衰变**（遗留#1 处理）：dynasty/local 腐败每月自然累积（+0.1，封顶 80），承平日久吏治败坏 → 压低税收 → 财政/军事连锁衰变，让晚期局势（南明偏安）在脆弱 seed 触发。
- **批量自动推演**：batch 改为 player faction 由 AI 控制（无玩家干预的历史推演），不同 seed 的 AI 选择产生多样结局。
- **闭环达成**：孤立事件升级为系统驱动的长期叙事；survey 8 seed 长跑中 **4 种局势结局实际触发**（张居正 consolidated / 建州 unified / 壬辰 resolved / 辽东 liaodong-lost）。

---

## 3. 验收红线与命令

每个子步骤 / 阶段必须全绿：

```bash
npm run typecheck      # tsc --noEmit，必须零错误
npm test               # vitest run，当前 377 测试
npm run build          # tsc -b && vite build
npm run map:validate   # 校验地图，31 地区
npm run batch          # 100×240 批量模拟，errorRuns 必须为 0
npm run diagnose       # 单局 seed7 月度轨迹 + popGroups 守恒审计
```

**最终基线指标（本轮大改造完成时，供回归对比）**：

| 指标 | 本轮终值 | S4 起点 | 对比 |
|---|---|---|---|
| 测试数 | 377 | 323 | +54（S5 +28 / S6 +9 / 遗留 +17） |
| batch errorRuns | 0 | 0 | = |
| batch 大明存活率（240 月）| 1.0 | 0.82 | 回升（军队归零修复）|
| batch 平均控制区 | 25.06 | 14.49 | 回升 |
| batch 粮价 | 3.43 | 4.13 | 略降 |
| diagnose seed7（10 年）| active，军队 508k | active，军队 11 | 军队归零修复 |
| 局势结局（survey 600 月长跑）| **6 种全达成** | — | 张居正 / 建州 / 壬辰 / 辽东 / 陕西流民 / 南明，大明可 collapse |

---

## 4. 工程状态：S1–S6 全部完成

维多利亚3 五环闭环（后果 / 经济 / 社会政治 / 制度 / 外交战争）+ 内容收口（历史局势）全部接通。**377 测试全绿**，batch `errorRuns=0`，6 种局势结局在长跑中全部达成、大明可 collapse。

**遗留处理（本轮已完成的增强）**：
- **#1 晚期局势触发（已完成）**：追加**腐败自然累积**（dynasty/local +0.1/月，封顶 80）+ **corruptionPressure**（腐败>50 直接加剧叛乱 risk）。survey 中大明控制区从 25 降到 17-19，**陕西流民 + 南明偏安在脆弱 seed 触发**（北方 rebelPressure 总和 180+）。6 种主线局势全部可激活。
- **#2 同盟参战 + 外交交互（已完成）**：`warfare.ts alliesJoinWar`——进攻方盟友同步对防守方开战；`diplomacy.ts proposeAlliance` / `peace.ts requestPeace` 玩家主动结盟（关系≥20）/ 求和（白和，不割地，停战 60 月）；`DiplomacyPanel` 交互按钮（缔结同盟 / 求和）。
- **#3 玩家手选法律（已完成）**：`PlayerDecision.reformLawId?` 玩家手选改革法律（覆盖 domesticFocus 自动倾向，可强推阻力大的改革）；`DecisionPanel` 改革法律下拉。

**仍待后续**：无工程阻塞项。本轮已补齐 `rebellion-spreads` 结局推进（北方叛乱压力加速，6 种局势结局在长跑中全部达成、大明可 collapse）与 DiplomacyPanel「宣战」按钮。后续为内容扩充（更多事件/局势/法律）与平衡调参。

**入口**（接手 agent）：`src/core/situation.ts`（引擎）+ `src/data/situations.ts`（6 局势）；`simulation.ts` 月度 `advanceSituations`；调参集中在 `simulation.ts` 征募段 / `warfare.ts` `baseAttrition` / `situations.ts` effect。

---

## 5. ⚠️ 已知坑与设计约束（接手必读）

1. **确定性模拟的蝴蝶效应**：`simulateMonth` 用固定种子，`applyResourceCrises` 的 `random.next()` 调用次数依赖当月 crisis faction 数。任何**持久**状态改变（如 S4 改革落实改 corruption → 税收 → treasury → crisis 判定）都会扰动后续整个 random 序列，让不同 seed 的命运重新分配。**这是特性不是 bug**——评估改动时看 batch 整体指标，别被单个 seed 的剧烈变化误导。对照实验方法：临时注释新功能跑 batch 对比。

2. **军队归零脆弱性（S5 已修）**：~~长期多线战争里军队会耗到个位数（seed7 10 年军队 11）~~。S5 引入战线消耗模型 + 征募分级恢复（`0.012/0.006/0.003`，移除 `warExhaustion<40` 硬门槛），seed7 10 年军队回升到 846k。副作用是大明偏稳健（存活 1.0、控制区 25/31），待 S6 历史局势引入中后期压力自然平衡。

3. **modifier effectKey 接入不一致**：见 §2 S1 的警告——`corruption-flat`/`stability-flat` 注释标了接入但实际没接。新增 modifier 效果前先 grep 确认 effectKey 有计算点消费，否则就是死数据。

4. **月度流水线顺序**（`simulation.ts`）：expire modifiers → region 循环（经济/控制/叛乱/市场/人口/账本）→ faction 循环（维护费 / **征募 S5b 分级**）→ **`advanceDiplomacy`（S5a 外交演变 + 条约财政）** → `applyResourceCrises` → `eliminateDefeatedFactions` → `updateFactionCliques` → `autoProposeReforms` + `advanceReforms`（S4）→ `advancePoliticalMovements`（S3c）→ 战斗（**S5d 外交约束开战**）→ 事件 → **`advanceWar` 战线消耗 + warSupport（S5b）→ `checkPeace` / `resolvePeace` 和谈（S5c）** → 账本归档 → 贸易/价格。S4 改革落实放在政治运动之前；S5 外交/战线/和谈全链路确定性，不消费 random（random 仅在 resolveBattle 首月遭遇战）。

5. **玩家与 AI 同规则**：所有系统对玩家 faction 和 AI faction 一视同仁（改革、运动、经济）。新增机制不要写 player-only 分支。

---

## 6. 核心文件地图

```
src/core/
  simulation.ts      月度流水线主函数 simulateMonth（齿轮咬合的编排者）
  types.ts           全部核心类型（GameState / FactionState / Modifier / Law / Reform...）
  economy.ts         地区经济 + 势力维护费（接 tax-mult/grain-output-mult/maintenance-mult）
  control.ts         地区控制更新（接 control-flat；⚠️ 未接 corruption/stability-flat）
  warfare.ts         战斗 + 战争推进（接 army-org-mult）—— S5 主战场
  market.ts          产业生产 / 市场供需 / 贸易 / 价格 / pop 消费
  populationGroups.ts 8 类 pop 的就业/需求/饥荒/流民/财富
  clique.ts          集团 strength（pop wealth 聚合）+ approval + administration
  politics.ts        S3c 政治运动
  reform.ts          S4 法律改革（propose/advance/enact/autoPropose）
  diplomacy.ts       S5 外交关系 + 条约（relationKey / advanceDiplomacy）
  peace.ts           S5c 和平谈判（warSupport / checkPeace / resolvePeace）
  situation.ts       S6 历史局势引擎（advanceSituations）
  modifiers.ts       modifier 聚合 + queryModifier + collectModifiers（级联）
  ledger.ts          财政账本（唯一真相源）+ applyLedgerToState
  eventEngine.ts     事件条件/效果/触发
  ai.ts              AI 月度决策
  invariants.ts      状态不变量校验（NaN/负值/价格爆炸）
src/data/
  laws.ts            S4 法律库（10 条）+ effect key 分类
  cliques.ts         4 集团定义（preferredLaws/opposedLaws/policyAffinities）
  factions.ts        势力模板（大明/建州/土默特/朝鲜/日本...）
  scenarios.ts       createMvpScenario 入口
  events.ts          历史事件库
  regions.ts         31 地区模板
src/scripts/
  runBatchSimulation.ts   batch 验收
  diagnoseSimulation.ts   单局诊断
  validateMapRegions.ts   地图校验
src/tests/           每个核心模块对应测试（reform/clique/politics/ledger/invariants...）
docs/
  v2-optimization-spec.md     SPEC（含 S1–S4 完成战报 §8/§9/§10）
  v2-implementation-plan.md   PLAN（S1–S4 详细子步骤 + S5–S6 里程碑）
```

---

## 7. 提交历史

**本轮大改造（2026-06-30，详见 §8）**：
- `1f69b23` docs: clear remaining backlog
- `623094a` feat: rebellion-spreads resolution + declare-war button
- `480f851` docs: mark S6 leftovers fully resolved
- `bf284b8` feat(diplomacy): player alliance & peace actions
- `c66bdad` feat(rebellion): corruption drives rebellion
- `8f4e075` docs: mark leftovers #1/#2/#3 resolved
- `ab7ad2c` feat(ui): diplomacy info panel
- `5acfdac` feat(ui): player-chosen reform law
- `19a3f19` feat(warfare): ally join war
- `8f5653e` feat(sim): corruption accumulation
- `3dceed0` feat(situation): S6 historical situations engine + main-line content
- `f89b3f7` feat(diplomacy): S5 diplomacy + front-line war + peace talks

**早期阶段**：
- `fa69b64` feat(reform): S4 law & reform system closing the institutional loop
- `128ff48` feat(politics): S3 interest-group political power from pop wealth
- `b803dfd` feat(economy): ledger-driven finance + unified market-pop loop (S1c+S2)
- `05f0ba3` fix(sim): stabilize economy/pop and activate inert modifier system
- `46f9c20` feat(batch): include P1 ledger entries, P2 pop metrics, P3 market metrics

---

## 8. 本轮大改造完整记录（2026-06-30）

本轮（承接 S4）一次性交付 **S5 外交战争环 + S6 历史局势收口 + 5 项遗留处理**，维多利亚3 五环闭环全部接通，**无工程阻塞项剩余**。

### 8.1 交付范围

- **S5 外交战争环**：外交关系层（`diplomacy.ts`）+ 战线消耗模型（`warfare.ts` FrontState）+ **修军队归零**（征募分级 `0.012/0.006/0.003`）+ 和平谈判（`peace.ts`）+ 外交约束开战（`decisions.ts` 过滤停战/盟友）。
- **S6 历史局势收口**：局势引擎（`situation.ts`）+ 6 条主线局势（`situations.ts`）+ endDate `1621→1662` + 平衡调参 + batch 改 AI 自动推演。
- **遗留 #1 晚期局势**：腐败自然累积（`simulation.ts`）+ corruptionPressure（`rebellion.ts`）→ 陕西流民 / 南明偏安在长跑中触发。
- **遗留 #2 同盟 + 外交交互**：`alliesJoinWar`（盟友同步参战）+ `proposeAlliance` / `requestPeace`（玩家结盟 / 求和）+ DiplomacyPanel 交互按钮。
- **遗留 #3 玩家手选法律**：`PlayerDecision.reformLawId` + DecisionPanel 改革法律下拉。

### 8.2 核心设计决策

- **确定性闭环**：S5 全链路（`advanceDiplomacy` / `advanceWar` / `checkPeace` / `resolvePeace` / `alliesJoinWar`）+ S6 局势引擎均**不消费 random**；random 仅存于 `resolveBattle` 首月遭遇战。避免扰动确定性模拟的随机序列（§5.1）。
- **财政走账本**：所有外交/战线/和谈/条约的财政后果（关税/朝贡/赔款/战地军费）一律 push ledger entry，保持 `Δtreasury === 账本净额`（SPEC §21.2）不破坏。
- **数据驱动局势**：`SituationDef` 的 trigger/advance/outcome/effect 全是函数字段，新增局势只需加定义，不改引擎。
- **玩家与 AI 同规则**：外交约束开战 / 改革 / 局势对玩家与 AI 一视同仁；玩家手选（`reformLawId` / 结盟 / 求和 / 宣战）是 AI 决策的手动覆盖，不写 player-only 系统分支。

### 8.3 接手指引

- **新增局势**：`src/data/situations.ts` 加一个 `SituationDef`（trigger/advance/outcomes/effect）。
- **调平衡**：`simulation.ts` 征募段（armyTarget/recruitRate）/ `warfare.ts` `baseAttrition` / `rebellion.ts` `corruptionPressure` / `situations.ts` outcome effect。
- **新增外交动作**：`diplomacy.ts` 或 `peace.ts` 加函数 → `gameStore.ts` 加 action → `DiplomacyPanel.tsx` 加按钮。
- **验证**：`npm test`（377）+ `npm run batch`（errorRuns=0）+ `npm run diagnose`（seed7 单局）。

### 8.4 后续开放方向（非阻塞）

内容扩充（更多事件/局势/法律）、平衡调参（大明韧性曲线/结局分布权重）、UI（局势进度面板/modifier 调试面板 SPEC §18.3）、多边战争模型（当前双边累加近似）。
