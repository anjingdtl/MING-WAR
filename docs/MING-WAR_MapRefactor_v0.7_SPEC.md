# 《万历：山河崩塌》大地图体系重构 SPEC

> 项目代号：MING-WAR
> 文档版本：v0.7-map-refactor-design
> 编写日期：2026-06-30
> 文档性质：大地图（底图 / 省区 / 势力 / 标签）体系重构规格 + 一次性重构路线
> 上游需求：用户在主对话中明确"项目的大地图底层、省区、势力、文字都混为一体，我想重构这个大地图体系"
> 当前代码状态：v0.6.1-patch / 维多利亚3 五环闭环 S1–S6 全部接通 / 470 测试全绿 / 1000×700 viewBox 地图可渲染 / `rebuildGeoMap.ts` 已存在但**手绘 + 运行时网络** / 31 playable + 7 context tile 已落地

---

## §0. 文档定位

本 SPEC 不是另起一轮"内容设计"或"运行底座"，而是**大地图视觉层的彻底重构**。当前地图体系（`src/map/physicalMap.ts` + `src/map/source/mapRegionSource.ts` + `src/map/generated/factionMapLabels.ts`）的核心痛点是**底图手绘 + 省区 31 区形状粗糙 + 势力/标签由脚本重新生成时三个文件相互独立**——三者"混为一体"，任何一次"重生成底图"都连带改 `mapRegionSource` 的 polygon 形状、可能改 `factionMapLabels` 的坐标，**没有单一真相源**，没有离线可复现的边界。

本轮三条核心约束（与用户原话一致，并按当前代码收紧）：

1. **底图参考百度地图的真实地图，但用公开数据落地**：用 Natural Earth 公共领域简化海岸线（runtime-free、版本可控），不直接 ship 百度瓦片（授权 / 网络 / 体积都不允许）。
2. **政治势力按万历年间在对应省区上染色**：初始 `controllerFactionId` 来自 `regionTemplates.ownerFactionId`（已正确），不动 `state.regions`、不动 region id、不动模拟逻辑。
3. **完全抛弃旧有大地图体系**：旧的 `physicalMap.ts`（手绘 stylized）+ 旧的 `mapRegionSource.ts`（hand-coded Mongol 区域等）+ 旧的 `factionMapLabels.ts` 全部重新生成，**只保留 `mapTiles.ts`（含 metadata merge）的下游消费**。

---

## §1. 目标与非目标

### §1.1 目标（本轮必做）

| # | 目标 | 验收抓手 |
|---|---|---|
| G1 | 底图从手绘 stylized 切换为 Natural Earth 真实海岸线 + 真实河流 + 真实湖泊 | `physicalMap.ts` 中 `eastAsiaLandPaths` 由 NE 50m 海岸线简化而来；`majorRiverPaths` 由 NE 50m 河流水系简化而来 |
| G2 | 31 playable region 的 polygon 与现代中国 admin1 / 朝鲜半岛 / 日本 / 俄罗斯远东 admin1 真实边界对齐 | `validateMapRegions` 0 issue；肉眼对照百度地图区域，误差 ≤ 1 个 grid 单位 |
| G3 | 7 个 context tile 同步迁移到真实海岸线 | `tibet` / `hami` / `mobei` / `southeast-asia` / `liuqiu` / `western-pacific` / `northern-sea` 形状来自 NE 50m 海岸线 + 简化路径 |
| G4 | Wanli 初始势力染色完全沿用现有 `regionTemplates.ownerFactionId`，**不写新势力 / 不动势力色板** | 31 区开局染色与 v0.6.1-patch 完全一致；`mapFactionColors.ts` 不动 |
| G5 | `rebuildGeoMap.ts` 升级为**完全离线可重跑**——预下载的 NE GeoJSON 入 `src/map/data/ne_cache/`，**不依赖运行时网络** | `npm run map:rebuild-geo` 在断网环境下可执行；脚本只读 `ne_cache/` 目录 |
| G6 | 修正 3 处已知历史偏差 | (a) 朝鲜半岛为**单一 joseon**（南北韩合并为单 region 或维持南北 id 但生成同源）；(b) shaanxi 不再含 Gansu/Ningxia（只取嘉峪关内的"关中"）；(c) joseon_south / joseon_north 改用 Wanli-era 朝鲜八道而非现代南北韩 |
| G7 | 视觉管线层数、组件、viewBox 全部保持不变 | `mapCanvas.viewBox === "0 0 1000 700"`；`GameMap.tsx` 五层结构（BaseGeoLayer → Routes → PoliticalOverlay → ProvinceTile → Labels）不变 |

### §1.2 非目标（本轮不做）

- **不做**新加 playable region / context tile——31 + 7 锁死。
- **不做**势力色板调整（`mapFactionColors.ts` 不动）。
- **不做**region 名称 / 中文 / 拼音调整（`mapTileMetadata.ts` 不动）。
- **不做**3D 地图 / 真实墨卡托 / 等距投影切——继续 equirectangular 1000×700。
- **不做**百度瓦片直接集成（无授权、无网络许可）。
- **不做**鼠标 hover 浮出真经纬度——现有 hover card 字段足够。
- **不做**3D 地形 / 实际等高线 / 卫星影像——保持 SVG 矢量。
- **不做**真实海岸线逐年变化（万历 48 年间海岸线变迁 < 0.5 像素，单一底图即可）。

---

## §2. 基础数据源 & 投影

### §2.1 为什么是 Natural Earth

| 候选 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 百度地图瓦片 | 国境线最准、中文标注好 | 授权禁止 ship / runtime 需 key / 瓦片非矢量 / 离线路权不清 | **否** |
| 高德 / 腾讯瓦片 | 同上 | 同上 | **否** |
| OpenStreetMap GeoJSON | 数据全、矢量 | 文件巨大（10MB+ 简化后才能用）、license 需保留 | 否（备选） |
| **Natural Earth 50m 公共领域矢量** | 公共领域（public domain）、`ne_50m_land` / `ne_50m_admin_0_countries` / `ne_50m_admin_1_states_provinces` / `ne_50m_rivers_lake_centerlines` 共 4 个文件 < 5MB、版本稳定（5 年没动） | 边界是现代的（不是万历年）；中文 label 缺失 | **是**（已用，需预下载） |
| 手绘 | 灵活 | 失真、与百度差异巨大 | **否（本轮替换）** |

**关键事实**：

- `rebuildGeoMap.ts:28-34` 已经从 `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/*.geojson` 拉 4 个文件。
- Natural Earth 是 **public domain**，ship 到 repo 无授权风险。
- 4 个文件合计 < 5MB，gzip 后 < 1.5MB，可直接进 `src/map/data/ne_cache/`（git lfs 都不需要）。
- 唯一的"历史准确度"问题靠**手工 overlay 修正**（Wanli-era 边界 ≠ 现代边界）——见 §3。

### §2.2 投影与坐标范围

**完全继承现有 `rebuildGeoMap.ts:36-43` 的投影参数**——本轮**不动**：

```ts
const bounds = {
  lonMin: 68,    // 涵盖 嘉峪关以西、新疆边缘
  lonMax: 148,   // 涵盖 库页岛、堪察加边缘
  latMin: 7,     // 涵盖 中南半岛、东南亚
  latMax: 58,    // 涵盖 北海、鄂霍次克海
  width: 1000,
  height: 700
} as const;
```

```text
投影公式（equirectangular）：
  x = round(((lon - lonMin) / (lonMax - lonMin)) * width)   → 0-1000
  y = round(((latMax - lat) / (latMax - latMin)) * height)  → 0-700（北朝上）
```

**简化阈值（minDistance 像素单位）**：

| 资产 | 阈值 | 含义 |
|---|---|---|
| `eastAsiaLandPaths` | 2.5 | 海岸线圆滑，相邻点 ≥ 2.5 像素 |
| `majorRiverPaths` | 2.0 | 河流更细 |
| region admin1 边界 | 1.8 | 省区边界略细于海岸线 |
| Mongol 4 部 / jurchen 4 部手绘 | 0 | 边界由修正层提供，不简化 |
| 圆形湖泊（`oval`） | 18 步 | 形状稳定 |

**为何不切到墨卡托**：万历游戏跨经度 80°，墨卡托在 lat≥40° 形变过大（蒙古 / 黑龙江 / 库页岛被严重拉宽），equirectangular 失真更可控（仅 5-8% 横向拉伸，与百度地图 lat 38 以上的视觉差异不可见）。

### §2.3 NE GeoJSON 预下载与缓存

新增目录 `src/map/data/ne_cache/`（git tracked）：

```text
src/map/data/ne_cache/
  ne_50m_land.geojson                    # 海岸线主文件（公共领域）
  ne_50m_admin_0_countries.geojson       # 国家轮廓（用于 朝鲜 / 日本 / 蒙古整体）
  ne_50m_admin_1_states_provinces.geojson  # 省/州级（中国 / 俄罗斯远东）
  ne_50m_rivers_lake_centerlines.geojson # 主要河流水系
  README.md                              # 注明：Natural Earth public domain, source URL, download date
```

**下载来源**（脚本一次性预下载，不需要每次都跑）：

- 主源：`https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_*.geojson`
- 备源（GH API 限流时用）：`https://www.naturalearthdata.com/...`

**`npm run map:fetch-ne` 新增脚本**（仅在 cache 缺失时使用）：

```text
# 阶段 0 子步骤
1. 检查 src/map/data/ne_cache/ 4 个文件是否齐全
2. 缺失则从 GH raw 下载到 cache 目录
3. 不存在则 fail-fast 报错（避免静默 fallback）
```

**硬约束**：

- `rebuildGeoMap.ts` 在 v0.7 改造后**只读 cache**，**不再 fetch 任何 URL**——保证离线和 CI 可重跑。
- cache 文件每次 release 前刷新一次（注释 + commit 信息记录"refresh date"）。
- 文件大小 < 5MB 总和，不上 git lfs。

---

## §3. 31 playable region 的重构

### §3.1 决策总表（按"源 / 修正层"分两栏）

| Region id | 中文 | 源 | Wanli 修正层 | 备注 |
|---|---|---|---|---|
| `beizhili` | 北直隶 | NE admin1: `Hebei + Beijing + Tianjin` | 无（已对齐 Wanli） | 顺天府 / 保定府 / 河间府 等 |
| `nanzhili` | 南直隶 | NE admin1: `Jiangsu + Anhui + Shanghai` | 无（已对齐 Wanli） | 应天府直辖 |
| `shandong` | 山东 | NE admin1: `Shandong` | 无 | 济南府 / 兖州府 等 |
| `shanxi` | 山西 | NE admin1: `Shanxi` | 无 | 太原府 / 汾州府 等 |
| `henan` | 河南 | NE admin1: `Henan` | 无 | 开封府 / 河南府 等 |
| `shaanxi` | 陕西 | **NE admin1: `Shaanxi`（关中）** | **去掉 `Gansu + Ningxia`**（万历年间为 嘉峪关外 蒙古 / 藏族 域） | **本轮**修正 |
| `zhejiang` | 浙江 | NE admin1: `Zhejiang` | 无 | 杭州府 / 宁波府 等 |
| `jiangxi` | 江西 | NE admin1: `Jiangxi` | 无 | 南昌府 / 赣州府 等 |
| `huguang` | 湖广 | NE admin1: `Hubei + Hunan` | 无 | 武昌府 / 长沙府 等 |
| `sichuan` | 四川 | NE admin1: `Sichuan + Chongqing` | 无 | 成都府 / 重庆府 等 |
| `fujian` | 福建 | NE admin1: `Fujian` | 无 | 福州府 / 泉州府 等 |
| `guangdong` | 广东 | NE admin1: `Guangdong + Hainan` | 无 | 广州府 + 琼州府 |
| `guangxi` | 广西 | NE admin1: `Guangxi` | 无 | 桂林府 / 柳州府 等 |
| `yunnan` | 云南 | NE admin1: `Yunnan` | 无 | 云南府 / 大理府 等 |
| `guizhou` | 贵州 | NE admin1: `Guizhou` | 无 | 贵阳府 / 思州府 等 |
| `liaodong` | 辽东 | NE admin1: `Liaoning` | 无（万历 辽东都司 ≈ 现代 辽宁） | 辽阳 / 沈阳 / 广宁 |
| `tumed_steppe` | 土默特 | **手绘 polygon**（手绘层） | 历史边界（万历 俺答汗 范围） | `group: "mongolia"` |
| `chahar_steppe` | 察哈尔 | **手绘 polygon**（手绘层） | 历史边界（万历 林丹汗 早期） | `group: "mongolia"` |
| `korchin_steppe` | 科尔沁 | **手绘 polygon**（手绘层） | 历史边界 | `group: "mongolia"` |
| `hulunbuir` | 呼伦贝尔 | **手绘 polygon**（手绘层） | 历史边界 | `group: "mongolia"` |
| `haixi` | 海西女真 | **手绘 polygon**（手绘层） | 历史边界（扈伦四部中的海西女真） | `group: "jurchen"` |
| `jianzhou` | 建州女真 | **手绘 polygon**（手绘层） | 历史边界（建州三卫） | `group: "jurchen"` |
| `amur_basin` | 黑龙江流域 | NE admin1 Russia: `Amur Oblast + Jewish Autonomous Oblast` | 边界已对齐 Wanli（奴儿干都司） | `group: "jurchen"` |
| `nurgan_coast` | 奴儿干海岸 | NE admin1 Russia: `Khabarovsk Krai + Primorsky Krai` | 同上 | `group: "jurchen"` |
| `sakhalin` | 库页岛 | NE admin1 Russia: `Sakhalin Oblast` | 边界已对齐（明朝未实控） | `group: "japan"` |
| `joseon_north` | 朝鲜北部 | **NE admin0: `Korea`（南北合并为单源）** | **本轮修正**：南北同源 hand-cropped 38° 线 | **本轮**修正 |
| `joseon_south` | 朝鲜南部 | **同 `joseon_north` 单源** | 同一 NE 边界 hand-cropped 38° 线 | **本轮**修正 |
| `japan_west` | 日本西部 | NE admin0: `Japan` | 圆心 lon < 136.5 + lat < 41 | 战国末期/丰臣/关原前 |
| `japan_east` | 日本东部 | NE admin0: `Japan` | 圆心 lon ≥ 136.5 + lat < 41 | 同上 |
| `ezo` | 虾夷 | NE admin0: `Japan` | 圆心 lat ≥ 41（北海道） | 阿伊努 |
| `bozhou` | 播州 | **手绘 polygon**（tusi enclave） | 修正层：万历 播州土司杨应龙 范围 | `isEnclave: true` |

**统计**：

- **自动生成（NE admin1）**：15 个（`beizhili / nanzhili / shandong / shanxi / henan / zhejiang / jiangxi / huguang / sichuan / fujian / guangdong / guangxi / yunnan / guizhou / liaodong`）。
- **自动生成（NE admin0 韩国 / 日本国整体）**：5 个（`joseon_north / joseon_south` 共源 + `japan_west / japan_east / ezo`）。
- **自动生成（NE admin1 Russia）**：3 个（`amur_basin / nurgan_coast / sakhalin`）。
- **手绘 polygon（历史边界）**：8 个（`tumed / chahar / korchin / hulunbuir / haixi / jianzhou / bozhou`，外加 1 个 `joseon` 38° 分界线 hand-cropping）。

### §3.2 自动生成层的字段映射

`mapRegionSource.ts` 中每个 region shape 由 `rebuildGeoMap.ts:244-260` 的 `region()` 工厂函数生成，字段映射：

| 字段 | 来源 | 备注 |
|---|---|---|
| `id` | 硬编码 string | 必须与 `regionTemplates` 31 个 key 完全一致 |
| `paths` | NE 简化后 SVG path string[] | 由 `pathsForAdmin1` / `countryRingPaths` / `manualPath` 输出 |
| `labelX / labelY` | 硬编码 `[lon, lat]` → 投影 | 每个 region 中心点投影到 0-1000 / 0-700 |
| `labelWidth` | 硬编码数字 | 视觉宽度估算（不参与布局） |
| `source` | 字符串枚举 | `"natural-earth-admin1"` / `"natural-earth-admin0"` / `"historical-frontier-manual"` / `"tusi-enclave"` |
| `group` | 字符串枚举 | `"mongolia" / "jurchen" / "korea" / "japan" / "southwest"`（可选） |
| `isEnclave` | 仅 bozhou = `true` | 其他 region 省略 |
| `displayName / kind / isPlayableRegion / defaultControllerFactionId / importance` | 由 `mapTileMetadata.ts` merge | **本轮不动** metadata |

### §3.3 Wanli 修正层（3 处历史偏差）

#### §3.3.1 `shaanxi` 缩到关中

**原状**（`rebuildGeoMap.ts:293`）：

```ts
region("shaanxi", china(["Shaanxi", "Gansu", "Ningxia"]), [108.2, 35.6], 92, "natural-earth-admin1")
```

**问题**：万历年间甘肃（黄河以西部分）+ 宁夏全境在**嘉峪关外**——明朝只虚控，实际是 蒙古 / 藏族 / 撒里畏兀儿 域。**甘肃行省**（甘州 / 肃州）只到嘉峪关，关外是 蒙古 游牧 + 哈密 / 吐鲁番。

**v0.7 修正**：

```ts
region("shaanxi", china(["Shaanxi"]), [108.2, 35.6], 92, "natural-earth-admin1")
```

- **Gansu** 留在 context tile `hami`（哈密卫）或 `mobei`（漠北诸部）的视觉范围——context 不参与玩法。
- **Ningxia** 同样：明代 宁夏卫 仅 2-3 个军堡（花马池 / 宁夏镇），实控有限，留在 `mobei` context 范围更合理。
- **后果**：大明 2 京 13 省 中"陕西"变成 现代陕西——含 关中平原 + 汉中 + 延安 + 榆林 北部边墙，**地理上更接近 Wanli 关中**。

**对模拟的影响**：0 后果。`shaanxi` 区域的 `population` / `taxCapacity` / `connections` 全部是 region-level 数值，不依赖 polygon 形状。

#### §3.3.2 朝鲜半岛南北同源 + Wanli 八道近似

**原状**（`rebuildGeoMap.ts:313-314`）：

```ts
region("joseon_north", countryRingPaths(admin0, "North Korea", () => true), [127.3, 40.3], 84, ...)
region("joseon_south", countryRingPaths(admin0, "South Korea", () => true), [127.8, 36.1], 84, ...)
```

**问题**：

- 用的是 NE 的"North Korea" / "South Korea" admin0 ——**现代南北分界线**（38° 线，1948 年才成立），不是 Wanli-era 朝鲜八道。
- 万历年间朝鲜**没有南北分界**，是统一朝鲜王朝（李朝）。

**v0.7 修正**（两手准备，二选一）：

**方案 A（推荐）：维持 2 个 id，polygon 来自** `Korea` 整体 + bbox 裁切

```ts
// 取整个朝鲜半岛 admin0 polygon（NE 中 "Korea"），然后用经纬度 bbox 裁出两部分
const koreaPaths = countryRingPaths(admin0, "Korea", () => true);  // 整个朝鲜半岛
// 再做 bbox crop: joseon_north 拿 lat ≥ 38，joseon_south 拿 lat < 38
```

- region id 不变（`joseon_north` / `joseon_south`），不影响 `state.regions`。
- 视觉上**分界线在 38°**——这恰好是 现代南北韩 38° 停战线，**与 Wanli 朝鲜八道北部 / 中部 边界接近**（平安道 / 咸镜道 ≈ 38° 以北；黄海道 / 京畿道 / 全罗道 / 庆尚道 / 江原道 ≈ 38° 以南）。
- **Wanli 朝鲜八道**（京畿 / 忠清 / 全罗 / 庆尚 / 黄海 / 平安 / 咸镜 / 江原）的精确 bbox 不强求——3° 误差肉眼不可见。

**方案 B（备选）**：合并为单一 `joseon` region，id 直接换名——**会破 31 区 schema**，**不推荐**。

**最终采用方案 A**。

**对模拟的影响**：0 后果。两个 region id 都保留，polygon 改南北 38° 分界——`controllerFactionId: "joseon"` 不变。

#### §3.3.3 蒙古 4 部 / 女真 2 部手绘边界细化（可选微调）

**原状**（`rebuildGeoMap.ts:304-309`）：6 个手绘 polygon，每个 6 个经纬度顶点。

**问题**：6 顶点对 蒙古高原 这种 1000+ 公里 × 500+ 公里 区域太粗——视觉上像"豆腐块"。

**v0.7 修正**（轻量）：

- 每个 polygon 顶点数 6 → **10-14** 个；增加曲度，**长轴沿经度方向略弯**（地球曲率近似）。
- 4 部 蒙古 之间的边界**不能**有 gap（必须相邻或重合），避免地图出现"无人区"。
- 不与 NE 蒙古整体边界**冲突**（手绘 polygon 是 NE 蒙古内的子区域）。

**对模拟的影响**：0 后果。region id / faction 不变。

### §3.4 context tile 同步（7 个）

```text
tibet             乌斯藏            NE admin1: Xizang（西藏）        维持 context
hami              哈密              手绘（嘉峪关外 西域东端）         维持 hand-coded
mobei             漠北诸部          NE admin0: Mongolia              维持 context
southeast-asia    东南亚边缘        手绘（南中国海 / 中南半岛部分）  维持 hand-coded
liuqiu            琉球              手绘（钓鱼岛 / 琉球群岛）        维持 hand-coded
western-pacific  西太平洋          手绘（菲律宾海）                 维持 hand-coded
northern-sea      北海              手绘（鄂霍次克海）               维持 hand-coded
```

**所有 context tile 升级**：

- `tibet`：从 NE `Xizang` 切 polygon（更准）；保留 `defaultControllerFactionId: "tibet"`。
- `mobei`：从 NE `Mongolia` 切 polygon（更准）；保留 `defaultControllerFactionId: "mobei"`。
- 4 个 sea-zone（`liuqiu` / `western-pacific` / `northern-sea`）保持手绘，但顶点从 5 → 8-10 个。

---

## §4. 势力染色 (Wanli initial)

### §4.1 染色源（不写新势力）

```text
GameState.regions[<id>].controllerFactionId  ←  regionTemplates[<id>].ownerFactionId（开局）
                                                ↓ PoliticalOverlayLayer
                                              按 state.regions[id].controllerFactionId 查 mapFactionColors[<factionId>]
                                                ↓
                                              <path fill={color}>
```

**硬性约定**（本轮**不**改）：

- `regionTemplates` 的 31 个 `ownerFactionId` 已正确（见 `src/data/regions.ts`）。
- `mapFactionColors.ts` 的 13 个势力色板已正确（ming / joseon / japan / jianzhou / korchin / chahar / tumed / haixi / hulunbuir / nurgan / ainus / bozhou / mobei / tibet / liuqiu / southeast-asia / western-sea）。
- `PoliticalOverlayLayer.tsx` 的"按 faction 染色"逻辑已正确（基于 `state.regions[id].controllerFactionId`）。

**v0.7 不**做的事：

- **不**新增势力。
- **不**改势力色板。
- **不**改 region 初始 `ownerFactionId`。
- **不**改 `PoliticalOverlayLayer` 渲染逻辑。

### §4.2 已确认正确的 31 区染色（v0.6.1-patch → v0.7 不变）

| Region | ownerFactionId | 说明 |
|---|---|---|
| `beizhili / nanzhili / shandong / shanxi / henan / shaanxi(关中) / zhejiang / jiangxi / huguang / sichuan / fujian / guangdong / guangxi / yunnan / guizhou / liaodong` | `ming` | 大明 2 京 13 省 + 辽东都司（**16 区**） |
| `joseon_north / joseon_south` | `joseon` | 朝鲜王朝（李朝） |
| `japan_west / japan_east` | `japan` | 日本诸藩（战国末期/丰臣/关原前） |
| `ezo` | `ainu`（开 = `ainus`） | 虾夷（阿伊努） |
| `sakhalin` | `ainu` | 库页岛（费雅喀 / 阿伊努） |
| `jianzhou / haixi` | `jianzhou` / `haixi` | 建州三卫 / 海西女真 |
| `tumed_steppe / chahar_steppe / korchin_steppe / hulunbuir` | `tumed` / `chahar` / `korchin` / `hulunbuir` | 蒙古 4 部（俺答汗 / 林丹汗 / 科尔沁 / 呼伦贝尔） |
| `amur_basin / nurgan_coast` | `nurgan` | 奴儿干都司（实控有限） |
| `bozhou` | `bozhou` | 播州土司（杨应龙） |

**验证脚本**（本轮**新增**到 `src/scripts/`）：

```text
src/scripts/validateInitialFactions.ts  // 校验每个 region 染色 = ownerFactionId
  ↓
  对每个 region 跑 PoliticalOverlayLayer（jsdom 下 SVG snapshot）
  对比 fill = mapFactionColors[regionTemplates[id].ownerFactionId]
  输出 PASS / FAIL 表格
```

**红线条目**：

- 31 区都有 `fill`（不能出现 `fill="none"` 或未染色）。
- 染色色值 = `mapFactionColors[ownerFactionId]`（不能用 fallback 默认色）。
- 没有 "大明区被染成 joseon" 这种 id ↔ faction 不对应。

### §4.3 势力标签（`factionMapLabels`）

`factionMapLabels.ts`（自动生成）**完全继承**现有 15 个标签 + 坐标：

- `ming` 标在大明中心（武汉一带）
- `jianzhou` 标在建州女真核心
- `haixi` 标在海西女真核心
- `chahar / tumed / korchin / hulunbuir` 各标自己部
- `nurgan` 标在黑龙江入海口
- `joseon` 标在汉城（首尔）附近
- `japan` 标在京都附近
- `ainu` 标在北海道
- `bozhou / tibet / mobei / southeast-asia / liuqiu` 各标自己

**v0.7 校验**：

- 所有标签 `(x, y)` 在 `0-1000 / 0-700` 内。
- 标签 `minZoom / maxZoom` 与 `mapCanvas.LABEL_ZOOM_THRESHOLDS` 不冲突。

---

## §5. 上下文与远景 tiles（7 个）

| id | 中文 | 源 | 类别 | 视觉权重 |
|---|---|---|---|---|
| `tibet` | 乌斯藏 | NE admin1 `Xizang` | context-region | 中（藏区） |
| `hami` | 哈密 | 手绘（含 哈密卫 / 嘉峪关外） | context-region | 低（远景） |
| `mobei` | 漠北诸部 | NE admin0 `Mongolia` | context-region | 中（蒙古高原余部） |
| `southeast-asia` | 东南亚边缘 | 手绘（南中国海 / 中南半岛） | context-region | 低（远景） |
| `liuqiu` | 琉球 | 手绘（琉球群岛） | sea-zone | 低（海域） |
| `western-pacific` | 西太平洋 | 手绘（菲律宾海） | sea-zone | 低（海域） |
| `northern-sea` | 北海 | 手绘（鄂霍次克海） | sea-zone | 低（海域） |

**v0.7 升级**：

- `tibet` / `mobei` 用 NE 真实边界（**视觉更准**）。
- 4 个手绘 context（`hami / southeast-asia / liuqiu / western-pacific / northern-sea`）顶点 5 → 8-10 个（**更平滑**）。
- `defaultControllerFactionId` 不变——`tibet / mobei / liuqiu / southeast-asia / western-sea` 保持。

---

## §6. 视觉层与渲染管线（重大变化）

### §6.1 视觉层架构——**完全保留**

```text
GameMap.tsx
  ↓
  BaseGeoLayer           ← 渲染 eastAsiaLandPaths + majorMountainPaths + terrainRidgePaths + majorLakePaths + majorRiverPaths
                            本轮：eastAsiaLandPaths 与 majorRiverPaths 来自 NE 50m；山脊/湖泊仍手绘
  ↓
  MapRoutesLayer         ← 区域间道路（按 state.regions[].connections）
  ↓
  PoliticalOverlayLayer  ← 按 state.regions[id].controllerFactionId 染色
  ↓
  ProvinceTileLayer      ← 31 playable + 7 context 描边 + hover/click 命中
  ↓
  MapLabelsLayer         ← region 名 + lens 字段 + factionMapLabels
```

**viewBox、缩放、拖动、hover card 完全保留**——`mapCanvas.viewBox === "0 0 1000 700"` 不变。

### §6.2 各层本轮的变化

| 层 | 数据源变化 | 代码变化 | 视觉变化 |
|---|---|---|---|
| `BaseGeoLayer` | `eastAsiaLandPaths` 从手绘 → NE 50m 海岸线；`majorRiverPaths` 从手绘 → NE 50m 河流水系；`majorLakePaths` / `majorMountainPaths` / `terrainRidgePaths` 保持 | 仅 `physicalMap.ts` 导出值变，组件代码不变 | 海岸线更准（黄海/东海/南海轮廓贴近百度）；中国主要河流（长江/黄河/珠江/黑龙江）出现在正确位置 |
| `MapRoutesLayer` | 不变 | 0 | 0 |
| `PoliticalOverlayLayer` | `tiles` 来自 `mapTiles.ts`（已 merge metadata），**region polygon 变**，但 `state.regions[id].controllerFactionId` 不变 | 0（只换 path，不换逻辑） | 染色贴合新 polygon（无明显视觉错位） |
| `ProvinceTileLayer` | 同上 | 0 | 描边跟随新 polygon |
| `MapLabelsLayer` | 31 region `labelX/labelY` 微调（polygon 中心更准）；`factionMapLabels` 坐标不变 | 0 | region 名标签位置更准（中心点而非手算） |

### §6.3 渲染管线的不变量

| 不变量 | 校验方式 |
|---|---|
| viewBox 1000×700 | `mapCanvas.viewBox === "0 0 1000 700"` 单元测试 |
| 31 playable region 全部渲染 | `validateMapRegions` 0 issue |
| 7 context tile 全部渲染 | 同上 |
| 染色色值 100% 对应 `mapFactionColors[controllerFactionId]` | `validateInitialFactions` PASS（新增脚本） |
| 没有"无人区"（不在任何 playable + context polygon 内的 land） | 视觉回归（截屏人工对百度地图） |
| 没有"两 region 互相覆盖"（边界 gap ≤ 1 像素） | 视觉回归 |

---

## §7. 与既有代码的解耦点

### §7.1 不动的代码（90% 范围）

| 文件 | 状态 |
|---|---|
| `src/map/mapCanvas.ts` | **完全不动**（viewBox 锁死） |
| `src/map/mapConfig.ts` | **完全不动**（re-export） |
| `src/map/mapTypes.ts` | **完全不动**（类型锁死） |
| `src/map/mapFactionColors.ts` | **完全不动**（色板锁死） |
| `src/map/source/mapTileMetadata.ts` | **完全不动**（displayName / controllerFactionId / importance 锁死） |
| `src/ui/map/GameMap.tsx` | **完全不动**（五层结构锁死） |
| `src/ui/map/layers/*.tsx` | **完全不动**（组件渲染逻辑锁死） |
| `src/data/regions.ts` | **完全不动**（31 区 ownerFactionId 锁死） |
| `src/core/simulation.ts` | **完全不动**（不动模拟逻辑） |
| `src/store/*` | **完全不动**（不动状态） |
| `src/save/*` | **完全不动**（不动存档） |

### §7.2 必改的代码（3 个生成产物 + 1 个脚本 + 1 个新增脚本）

| 文件 | 状态 |
|---|---|
| `src/map/physicalMap.ts` | **重生成**（NE 真实海岸线 + 真实河流） |
| `src/map/source/mapRegionSource.ts` | **重生成**（NE 真实边界 + Wanli 修正） |
| `src/map/generated/factionMapLabels.ts` | **重生成**（坐标不变，content 复用） |
| `src/scripts/rebuildGeoMap.ts` | **重写**（完全离线、读 cache、加 Wanli 修正层） |
| `src/scripts/validateInitialFactions.ts` | **新增**（染色校验脚本） |

### §7.3 不影响的下游

| 下游 | 为什么不受影响 |
|---|---|
| `mapTiles.ts`（自动生成） | 由 `mapRegionSource` + `mapTileMetadata` merge，merge 逻辑不变；region id 全部不变 |
| `baseMapTiles.ts` | 重新生成即可 |
| `generateMapRegions.ts` | 跑一遍 `npm run map:generate` 即可 |
| `validateMapRegions.ts` | 跑一遍 `npm run map:validate` 即可 |
| `gameStore.ts` / `state.regions` | region id 全部不变 |
| `saveManager.ts` | region schema 不变；`migrateSave` 不需要 |
| `LocalSimulationService` | 不读 map 文件；不影响 |
| 470 测试 | 不动业务代码，0 改动 |

### §7.4 风险点

| 风险 | 概率 | 缓解 |
|---|---|---|
| NE admin1 边界与"大明 2 京 13 省"政治边界不完全对齐（如 beizhili 与山西在太行山一线有 1-2 像素 gap） | 中 | 阶段 6 视觉回看，肉眼对比；不严重可接受 |
| 朝鲜 38° 裁切后 joseon_north 区域过小 | 低 | 38° 是 朝鲜北部 / 中部 粗略分界，可接受 |
| NE admin1 某些省无 polygon（如 Beijing / Tianjin 单独为市） | 高 | beizhili 合并 Hebei + Beijing + Tianjin 三个 NE 特征解决（已实现） |
| 蒙古 4 部手绘边界与 NE 蒙古整体边界有 gap | 中 | 阶段 6 视觉回看 |
| cache 文件过大（> 5MB）导致 git pull 慢 | 低 | 实际 < 1.5MB gzip，无需 lfs |

---

## §8. 验收 & 战报

### §8.1 必跑命令

```bash
# 静态
npm run typecheck
npm test

# 构建
npm run build

# 地图产物链
npm run map:rebuild-geo     # 离线生成 3 个生成产物
npm run map:generate        # 重新生成 mapTiles.ts
npm run map:validate        # 校验 31 playable + 7 context + polygon + labelX/Y
npm run map:validate-init   # 新增 — 校验 31 区染色 = ownerFactionId

# 业务回归
npm run batch              # 100×240 errorRuns=0
npm run hash:state         # 5 节点哈希与 v0.6.1-patch 基线一致（策略不变 → 必一致）
```

### §8.2 完成判定（"本轮"完成硬条件）

满足以下**全部**条件时，认定大地图重构完成：

- [ ] 4 个 NE GeoJSON 已预下载入 `src/map/data/ne_cache/`（git tracked，< 5MB 总和）
- [ ] `rebuildGeoMap.ts` 已升级为完全离线（无 `fetch()` 任何 URL）
- [ ] `npm run map:rebuild-geo` 在断网环境下可执行并生成 3 个产物
- [ ] `npm run map:validate` 0 issue（duplicate / orphan / label-out-of-bounds / empty-paths / missing-default-controller）
- [ ] `npm run map:validate-init` PASS（31 区染色 100% 对应 ownerFactionId）
- [ ] `npm test` 全绿（470 个 + 新增 validateInitialFactions 测试）
- [ ] `npm run typecheck` 0 错误
- [ ] `npm run build` 0 错误
- [ ] `npm run batch` `errorRuns=0`（100/100）
- [ ] `npm run hash:state` 5 节点哈希与 v0.6.1-patch 基线**完全一致**（区域 id + 势力染色不变 → 必一致）
- [ ] 视觉回归：人工对百度地图截屏，确认海岸线 / 省界 / 朝鲜 38° 分界 / 蒙古 4 部 边界 误差 ≤ 1-2 像素

### §8.3 战报（完成时填）

```text
# 大地图重构战报（v0.7-map-refactor）

- 完成日期：
- commit 数：
- 31 playable region 形状：NE admin1 admin0 真实边界（27 自动 + 4 手绘修正）
- Wanli 修正：3 处（shaanxi 缩关中 / joseon 38° 分界 / 蒙古 4 部细化）
- 离线化：rebuildGeoMap.ts 0 fetch，全部读 src/map/data/ne_cache/
- cache 大小：X MB（4 文件）
- 测试：470 → 471（+1，新增 validateInitialFactions）
- 验证：map:validate 0 issue / map:validate-init PASS / typecheck 0 / test 471 / build 0 / batch errorRuns=0
- 视觉回归：人工对百度地图，确认 …
- hash:state 漂移：0（区域 id + 势力不变）
```

---

## §9. 风险与回滚

### §9.1 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| NE admin1 边界与"大明 2 京 13 省"政治边界不对齐 | 视觉错位 1-2 像素 | 阶段 6 视觉回看；不严重可接受；严重时回到阶段 3 |
| shaanxi 缩到关中后丢失甘肃 / 宁夏视觉感 | 视觉"大明疆域"看起来小一些 | 与史实一致——万历年间甘肃 / 宁夏本就不在大明实控区 |
| 朝鲜 38° 分界与"朝鲜八道"边界不一致 | 视觉错位 | 38° 是粗略近似；明朝不关心 38° 还是 39°，可接受 |
| 蒙古 4 部手绘边界与 NE 蒙古整体边界有 gap | 地图"无人区" | 阶段 6 视觉回看；gap 需手工填补 |
| cache 文件未及时刷新（NE 5 年动一次，2026-06 还在 v5.1.x） | 边界与"最新"略有差异 | 5 年内不影响；下次大改再刷 |
| `rebuildGeoMap.ts` 离线化后丢失数据时无 fallback | cache 损坏 → 脚本失败 | `map:fetch-ne` 自动从 GH 拉 cache（CI 也支持） |
| `factionMapLabels.ts` 坐标未与新 region polygon 对齐 | 标签错位 | 阶段 4 校验 `minZoom/maxZoom` 与 `mapCanvas.LABEL_ZOOM_THRESHOLDS` 一致 |

### §9.2 回滚预案

| 场景 | 检测 | 回滚 |
|---|---|---|
| 视觉回归严重 | 阶段 6 人工对比发现 | `git revert` 整个 v0.7 commit；`src/map/physicalMap.ts` 等回到 v0.6.1-patch |
| 染色出错 | `npm run map:validate-init` FAIL | 不用回滚——修复 `rebuildGeoMap.ts` 的染色映射（ownerFactionId 来自 metadata，不应该错） |
| 模拟出错 | `npm run batch` errorRuns > 0 | 立即回滚（region id 不变 → 不应该出错） |
| 哈希漂移 | `npm run hash:state` 漂移 | 立即回滚（id 不变 + 势力不变 → 不应该漂） |
| CI 失败 | `npm run typecheck` / `npm test` 失败 | 修脚本 / 修 type；不修不回滚 |

### §9.3 不回滚场景

- 海岸线 1-2 像素错位（NE 数据源限制，可接受）
- 山脊 / 湖泊 仍手绘（v0.7 不动）
- 河流缺失小支流（NE 50m 河流水系不含 1-2 级支流；可接受）
- 蒙古 4 部边界与 NE 蒙古有 1-2 像素 gap（手绘限制，可接受）

---

## §10. 与已有 SPEC 的关系

| 文档 | 内容 | 关系 |
|---|---|---|
| `MING-WAR_Web架构流畅稳定优化改造_SPEC.md`（v0.6-stability） | 性能 / 状态 / Worker / 存档 / CI | **架构层**——本 SPEC 是其上的视觉层 |
| `MING-WAR_遗留问题修复_SPEC_v0.6.1-patch.md` | 10 项遗留清理 | **修补层**——本 SPEC 续接 v0.6.1-patch |
| `MING-WAR_优化改进方案_SPEC.md`（v0.4-design） | P0–P6 内容建设 | **内容层**——本 SPEC 不重做 |
| `v2-optimization-spec.md`（v0.5-design） | S1–S6 五环闭环 | **业务层**——本 SPEC 不动 |
| **本文档**（v0.7-map-refactor） | 大地图体系重构（底图 + 省区 + 势力 + 标签） | **视觉层**——本轮独立 |
| `docs/MING-WAR_MapRefactor_v0.7_PLAN.md` | 大地图重构执行计划 | **配套**——本 SPEC 的 9 阶段执行版 |

---

## §11. 总结

本 SPEC 的最终目标与用户原话一致：

> 1. 以百度地图的真实地图参考做基础 → **用 Natural Earth 公共领域矢量落地**（公开 / 离线 / 版本可控）。
> 2. 政治势力按万历年间在对应省区上染色 → **沿用现有 `regionTemplates.ownerFactionId`，不动势力色板 / 不动模拟 / 不动存档**。
> 3. 完全抛弃旧有大地图体系 → **`physicalMap.ts` / `mapRegionSource.ts` / `factionMapLabels.ts` 三个生成产物全部重生成，3 处历史偏差顺手修正**。

本轮**不做**：
- 不加新 playable / context tile。
- 不改势力色板。
- 不改 region 名称 / 中文 / 拼音。
- 不做墨卡托 / 3D / 真实等高线。
- 不直 ship 百度瓦片。
- 不动 `GameState.regions` / `region id` / 模拟逻辑 / 存档。

本轮**只做**：
- 让 31 区 + 7 context 的 polygon 与百度地图肉眼一致。
- 让 `rebuildGeoMap.ts` 在断网环境可一键重跑。
- 顺手修 3 处历史偏差（`shaanxi` 关中化、朝鲜 38° 同源、蒙古 4 部细化）。
- 为下一轮（v0.8 / v0.9 内容扩充）留下"地图就是真实地理"的底座。
