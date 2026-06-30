# 维多利亚3式三层大地图重构 SPEC

**项目:** MING-WAR《万历：山河崩塌》
**日期:** 2026-06-30
**范围:** 战略大地图视觉、地图数据结构、政治势力覆盖、东亚周边势力全图
**目标:** 把现有“单一政治区划 SVG 地图”升级为可长期扩展的三层战略地图：底层省区地理、直接贴附在省区上的政治势力覆盖、完整东亚势力周边图。

---

## 1. 背景与现状

当前项目已经具备可用的战略地图基础：

- `src/ui/map/GameMap.tsx` 已实现 SVG 地图、缩放、拖拽、区域 hover、区域选择、Lens 着色。
- `src/map/physicalMap.ts` 提供东亚陆地、山脉、河流、湖泊等底层 SVG 路径。
- `src/map/source/mapRegionSource.ts` 与 `src/map/generated/mapRegions.ts` 提供区域 SVG path。
- `src/data/regions.ts` 用同一批 `RegionId` 驱动游戏模拟数据。
- `src/ui/lens/lensColorScales.ts` 已具备类似维多利亚3地图模式的 Lens 色板思路。

主要问题是：现有 `mapRegions` 同时承担“游戏省区”“地图底块”“政治覆盖区域”“周边势力边界”四种职责。MVP 阶段这样高效，但继续扩展到更完整的东亚大地图时，会出现边界不清、图层难叠、势力聚合困难、历史区划难以细化的问题。

---

## 2. 设计目标

### 2.1 核心目标

建立三层地图结构：

1. **大地图底层:** 绘制两京十三省、辽东边镇、播州土司，以及东北、蒙古、朝鲜、日本、虾夷、库页、西藏、乌斯藏、哈密、漠北、东南亚边缘等周边地理省区或区域块。
2. **政治势力覆盖:** 不再把势力色当作底图本体，而是在省区图块之上叠加半透明势力覆盖，直接贴合省区形状，可随 `controllerFactionId` 动态变化。
3. **完整东亚势力周边图:** 镜头默认展示明朝核心与东北亚，缩放/拖拽可查看更完整东亚势力环境，让玩家明确大明不是孤岛，而是处在东北女真、蒙古、朝鲜、日本、藏区、西南和海上力量包围的历史系统里。

### 2.2 视觉目标

参考维多利亚3的可读性，而不是复制其具体美术：

- 底层地理要像“真实地图”，有海陆、山脉、河流、湖泊、边缘地貌与纸张质感。
- 省区边界要可见但不抢势力色。
- 政治覆盖应有透明度、边缘描线和轻微混合，让玩家同时看到势力归属与地理底纹。
- 大势力名称应在低缩放时更显眼；省区名称应在中高缩放时更显眼。
- Lens 模式继续保留，政治 Lens 是默认视图，经济、军事、民生、朝堂 Lens 复用同一套省区底块。

---

## 3. 非目标

本阶段不做以下内容：

- 不引入真实 GIS 投影、在线地图服务或外部瓦片服务。
- 不把所有东亚地区都扩展成完整经济模拟省份。
- 不新增复杂 3D 地形。
- 不复制维多利亚3的受版权保护美术资产、UI 图标或具体地图贴图。
- 不重写战争、外交、经济核心循环；地图只提供更好的空间表达与交互入口。

---

## 4. 推荐方案

### 4.1 方案比较

**方案 A：沿用单层 `mapRegions`，继续增加 path**
优点是改动小。缺点是所有职责继续混在一起，后续做大势力标签、地图边界、不可交互远景区、局部省区细化都会越来越困难。

**方案 B：三层 SVG 结构，保留现有 React/SVG 技术栈**
优点是与当前代码兼容，性能可控，测试可覆盖，能直接复用 Lens、hover、选择和生成管线。缺点是需要一次数据结构整理。

**方案 C：Canvas/WebGL 地图渲染**
优点是未来可承载大量图块和动效。缺点是当前项目没有这套渲染基础，交互测试和可访问性成本更高。

**推荐采用方案 B。** 它能满足三层地图目标，同时不把项目带进过重的渲染架构迁移。

---

## 5. 三层地图架构

### 5.1 Layer 1：大地图底层 `BaseGeoLayer`

职责：

- 渲染海洋、陆地、山脉、河流、湖泊、海岸线、纸张/经纬线纹理。
- 渲染底层省区块边界，作为所有政治覆盖的几何基底。
- 包含“完整东亚势力周边图”的远景区域，即使部分区域暂不参与完整模拟，也要在视觉上存在。

底层区域类型：

- `core-province`: 明朝核心省区，两京十三省。
- `frontier-province`: 辽东、播州、哈密、乌斯藏等边疆/土司/羁縻区域。
- `neighbor-region`: 周边势力区域，例如建州、海西、察哈尔、土默特、朝鲜、日本。
- `context-region`: 远景背景区域，例如漠北、西藏深处、东南亚边缘、琉球、海上航线区。

明朝核心底块清单：

- 北直隶
- 南直隶
- 山东
- 山西
- 河南
- 陕西
- 浙江
- 江西
- 湖广
- 四川
- 福建
- 广东
- 广西
- 云南
- 贵州

明朝边缘与特殊底块：

- 辽东
- 播州
- 哈密/关西边地
- 乌斯藏/西番方向
- 云贵土司边缘
- 琉球航线或东南海防区作为海上上下文

周边势力底块：

- 土默特
- 察哈尔
- 科尔沁
- 呼伦贝尔
- 建州
- 海西
- 黑龙江/奴儿干
- 奴儿干海岸
- 朝鲜北道
- 朝鲜三南
- 西日本
- 东日本
- 虾夷
- 库页
- 西藏
- 漠北/蒙古诸部远景
- 东南亚边缘势力区

### 5.2 Layer 2：省区图块 `ProvinceTileLayer`

职责：

- 渲染可交互省区图块。
- 与 `GameState.regions` 对齐的区域必须有稳定 `RegionId`。
- 暂不参与模拟的上下文区域使用 `MapTileId`，不进入 `GameState.regions`。
- 支持 hover、click、focus、keyboard selection。

关键规则：

- 游戏模拟区域使用 `regionId`。
- 纯地图上下文区域使用 `tileId`，不能误进入战斗、经济、人口计算。
- 每个图块必须有：
  - `id`
  - `displayName`
  - `paths`
  - `label`
  - `kind`
  - `defaultControllerFactionId`
  - `isPlayableRegion`
  - `importance`

### 5.3 Layer 3：政治势力覆盖 `PoliticalOverlayLayer`

职责：

- 直接构筑在省区图块之上，使用同一组 path 或聚合 path。
- 政治 Lens 下按 `controllerFactionId` 或默认控制者着色。
- 支持按势力聚合显示大名标签，如“大明”“建州女真”“察哈尔部”“朝鲜”“日本诸藩”。
- 非政治 Lens 下可降低势力覆盖透明度，让经济、军事、民生色板主导。

覆盖规则：

- 对 `isPlayableRegion=true` 的图块，从 `state.regions[id].controllerFactionId` 取当前控制者。
- 对 `isPlayableRegion=false` 的上下文图块，从 `defaultControllerFactionId` 取静态控制者。
- 当区域被占领或割让时，只改变政治覆盖，不改变底层地理图块。
- 同一势力的相邻图块可以生成 `FactionAreaLabel`，低缩放时显示势力大字，高缩放时显示省区小字。

---

## 6. 数据模型设计

### 6.1 新增地图类型

建议在 `src/map/mapTypes.ts` 拆分以下类型：

```ts
export type MapTileKind =
  | "core-province"
  | "frontier-province"
  | "neighbor-region"
  | "context-region"
  | "sea-zone";

export interface MapTileShape {
  id: string;
  displayName: string;
  paths: string[];
  labelX: number;
  labelY: number;
  labelWidth?: number;
  kind: MapTileKind;
  source: MapRegionSource;
  group?: MapRegionGroup;
  isPlayableRegion: boolean;
  defaultControllerFactionId?: string;
  importance: 1 | 2 | 3;
  isEnclave?: boolean;
}

export interface PoliticalOverlayShape {
  tileId: string;
  regionId?: string;
  factionId: string;
  paths: string[];
  opacity: number;
}

export interface FactionMapLabel {
  factionId: string;
  label: string;
  x: number;
  y: number;
  minZoom: number;
  maxZoom: number;
  importance: 1 | 2 | 3;
}
```

### 6.2 数据文件拆分

推荐文件结构：

- `src/map/mapTypes.ts`：地图类型。
- `src/map/mapCanvas.ts`：画布尺寸、默认镜头、缩放范围。
- `src/map/physicalMap.ts`：底层海陆与自然地理路径。
- `src/map/source/baseMapTiles.ts`：人工维护的底层图块源数据。
- `src/map/generated/mapTiles.ts`：生成后的稳定图块数据。
- `src/map/generated/factionMapLabels.ts`：势力大字标签坐标。
- `src/map/mapConfig.ts`：统一导出 `mapTiles`、`playableMapRegions`、`contextMapTiles`。

### 6.3 与现有模拟数据的关系

`GameState.regions` 仍是模拟的事实来源。地图数据不能反向制造模拟区域。

映射规则：

- `MapTileShape.isPlayableRegion=true` 且 `id in state.regions`：完整交互与详情面板。
- `MapTileShape.isPlayableRegion=false`：只显示基础信息、势力归属和上下文说明；点击后侧栏显示“周边势力概览”，不进入征税、人口、粮储等详细模拟字段。
- 验证脚本必须区分 playable 与 context，避免把上下文图块报成 orphan。

---

## 7. 视觉与交互规格

### 7.1 默认视图

默认镜头应覆盖：

- 明朝两京十三省完整可见。
- 东北女真与蒙古边地可见。
- 朝鲜、日本在右侧可见。
- 西藏/西南/东南亚边缘只露出足够上下文，不压过主舞台。

建议画布从当前 `1000x700` 扩展到 `1200x760` 或保持 `1000x700` 但重新布局。优先保持现有 `1000x700`，如果周边势力拥挤，再进入第二阶段扩画布。

### 7.2 缩放层级

- `zoom < 0.85`: 显示势力大标签，隐藏多数省区数值，只保留重要省名。
- `0.85 <= zoom < 1.8`: 显示省区名和控制者/核心 Lens 字段。
- `zoom >= 1.8`: 显示更多边疆、土司、海岛、航线与小区域标签。

### 7.3 颜色与覆盖

政治覆盖：

- 明朝：使用当前 `#C63D32`，透明度约 `0.62-0.78`。
- 女真/东北：保留建州、海西、奴儿干的棕金、青灰差异。
- 蒙古诸部：使用蓝灰、青绿、草原色系，避免与大明红混淆。
- 朝鲜：蓝系。
- 日本：紫系。
- 上下文区域：降低饱和度，透明度低于 playable 区域。

底层图块：

- 省区本体为暖米色/纸色底。
- 海洋为低饱和蓝绿。
- 山脉、河流保留现有风格，但在政治覆盖下仍可辨认。

### 7.4 标签

标签分两类：

- `ProvinceLabel`: 省区/区域名，如“北直隶”“辽东”“朝鲜北道”。
- `FactionLabel`: 势力大字，如“大明”“建州女真”“察哈尔部”“朝鲜”“日本诸藩”。

规则：

- 低缩放优先显示 `FactionLabel`。
- 中高缩放优先显示 `ProvinceLabel`。
- 标签不得遮挡右侧面板、左侧 LensBar、缩放控件。
- 不使用说明性 UI 文案解释地图层，交互应靠视觉层次自然成立。

### 7.5 交互

保留现有能力：

- 鼠标滚轮缩放。
- 左键拖拽平移。
- 点击省区选择。
- Alt+点击聚焦。
- hover 显示 Lens 卡片。

新增能力：

- 点击上下文区域时，侧栏展示简化信息：“周边势力/远景区域”，不显示不存在的粮储、税力等模拟字段。
- 低缩放点击势力标签时，选择该势力首府或打开势力概览。
- 政治 Lens 下，hover 省区时高亮同一势力的相邻覆盖区。

---

## 8. 建设阶段

### Phase 1：地图数据分层

目标：不改变视觉表现的前提下，把 `mapRegions` 拆成底层图块与 playable 区域。

交付：

- `MapTileShape` 类型。
- `baseMapTiles` 源数据。
- `mapTiles` 生成数据。
- 验证脚本支持 playable/context 区分。
- 现有地图测试继续通过。

验收：

- 两京十三省、辽东、播州、现有东北/朝鲜/日本区域都能从新结构渲染。
- `npm run map:validate` 能检测重复 id、空 path、越界 label、缺失 playable region。

### Phase 2：三层渲染组件

目标：把 `GameMap.tsx` 拆成清晰三层，保留现有交互。

交付：

- `BaseGeoLayer`
- `ProvinceTileLayer`
- `PoliticalOverlayLayer`
- `MapLabelsLayer`
- `MapRoutesLayer`

验收：

- 政治覆盖直接贴合省区图块。
- 选中、hover、Lens 着色、缩放、拖拽均可用。
- `src/tests/map.test.tsx` 增加三层 DOM/ARIA 断言。

### Phase 3：完整东亚周边图扩展

目标：补齐视觉上的东亚周边势力环境。

交付：

- 西藏/乌斯藏、哈密/西域入口、漠北、东南亚边缘、琉球/海上航线等 context 图块。
- 周边势力默认控制者。
- 低饱和度远景覆盖色。

验收：

- 默认视图能看到明朝核心、东北、朝鲜、日本。
- 缩放/平移能查看西北、西南、海上方向。
- context 区域不进入 `GameState.regions`，也不破坏模拟测试。

### Phase 4：势力聚合标签与缩放语义

目标：形成类似维多利亚3的“势力大字 + 省区细节”阅读体验。

交付：

- `factionMapLabels` 数据。
- 基于 zoom 的标签可见性。
- 同势力 hover 聚合高亮。

验收：

- 低缩放时能快速识别“大明”“建州女真”“察哈尔部”“朝鲜”“日本诸藩”等势力。
- 中高缩放时省区名清晰可读。
- 标签不与固定 UI 面板发生明显重叠。

### Phase 5：视觉打磨与性能验收

目标：让地图成为主体验界面，而不是贴图拼装。

交付：

- 省区边界描边、政治覆盖透明度、海陆底色、纸纹细节调整。
- 大地图截图回归。
- 渲染性能检查。

验收：

- `npm run build` 通过。
- `npm test` 通过。
- Playwright 桌面截图中地图非空、层次清楚、文字不明显重叠。
- 地图交互在常规桌面浏览器中缩放拖拽流畅。

---

## 9. 测试计划

### 9.1 单元测试

新增或更新：

- `src/tests/map-validation.test.ts`
  - playable 区域缺失时报错。
  - context 区域不被当作 orphan。
  - label 越界时报错。
  - 空 path 报错。
- `src/tests/map-config.test.ts`
  - 两京十三省均存在且 `isPlayableRegion=true`。
  - context 区域存在且不要求进入模拟。
  - 每个 playable tile 都能在 `regionTemplates` 找到对应数据。

### 9.2 组件测试

更新：

- `src/tests/map.test.tsx`
  - 渲染三层：base、province、political overlay。
  - 政治覆盖颜色来自当前控制者。
  - 上下文区域可渲染但不调用完整 region 详情。
  - 缩放按钮仍然工作。
  - 省区 click 仍然触发 `onSelect`。

### 9.3 视觉验证

使用 Playwright 做手动辅助验收：

- 桌面宽屏：`1920x1080`
- 常规桌面：`1440x900`
- 窄屏：`390x844`

检查：

- 地图非空。
- 大明核心不被右侧面板遮住关键交互。
- 省区边界可辨认。
- 势力覆盖与底层地形能同时阅读。
- 文字不大面积重叠。

---

## 10. 验收标准

本 SPEC 完成后，应满足：

- 玩家第一眼能看出这是一个东亚范围的大明晚期战略地图。
- 两京十三省是底层地图的核心结构，而不是散点或矩形按钮。
- 政治势力颜色是覆盖在省区图块之上的动态层。
- 明朝、女真、蒙古、朝鲜、日本、虾夷、奴儿干等周边势力在地图上形成完整空间关系。
- 旧有 Lens、hover、选择、缩放、拖拽能力不倒退。
- 纯上下文图块不会污染模拟数据。
- 后续可以继续把某个周边区域从 context 升级为 playable，而无需重写地图渲染。

---

## 11. 风险与控制

**风险：SVG path 数据体积继续膨胀。**
控制：保留生成管线，人工源数据与生成数据分离；远景 context 区域允许更粗略的 path。

**风险：标签过多导致地图拥挤。**
控制：引入 `importance` 与 zoom 阈值，低缩放只显示势力大字和一级省区。

**风险：context 区域误接入模拟。**
控制：验证脚本强制区分 `isPlayableRegion`；组件渲染时只有 playable 区域可调用完整 `RegionState` 字段。

**风险：视觉过度贴近参考游戏。**
控制：只借鉴层次、可读性和地图模式，继续使用本项目的明代纸本、朱色、缥色、墨线视觉系统。

---

## 12. 实施优先级

优先级从高到低：

1. 数据分层与验证脚本。
2. 三层渲染组件拆分。
3. 明朝两京十三省与现有周边区域迁移。
4. 东亚远景 context 图块扩展。
5. 势力大字与缩放标签系统。
6. 视觉打磨与截图验收。

---

## 13. 设计结论

本次地图重构应采用“三层 SVG 地图”方案：底层地理保持稳定，省区图块提供交互边界，政治势力作为动态覆盖层贴附其上。这样既能达到维多利亚3式大地图的战略阅读感，又能继续沿用当前 React/SVG/Lens/测试管线，不把项目拖进过重的渲染迁移。

最关键的工程原则是：**地图底块不是势力，势力覆盖不是省区，模拟区域不是全部地图区域。** 只要这三条边界立住，后续无论扩展日本、蒙古、西藏、西南土司还是海上势力，地图系统都能稳步生长。
