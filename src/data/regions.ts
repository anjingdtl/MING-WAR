/**
 * ⚠️  DETERMINISM-CHANGE (T11 — 2026-07-02)
 * ---------------------------------------------------------------------------
 * 运输节点（道路/海港/河港/仓储）数据录入。
 *
 * - 31 region 显式赋值 infrastructureLevel / portLevel / riverPortLevel
 * - logisticsNode.depotStock 按地区类型启发式（核心 8000 / 边地 5000 / 其它 6000）
 * - 启发式规则与 `region()` 函数中的 CORE_REGIONS / PERIPHERY_REGIONS 常量同步
 *
 * 影响：state.military.infrastructureLevel 与 logisticsNode 字段值变化；
 * movement.ts 的 INFRA_FACTOR 钳位 + supply.ts 的 dispatchSupplyConvoy
 * 行为均受本改动影响（行为变化在 T10 已有，**数据**层面是本 T11 第一次
 * 真正落地）。
 *
 * 必须跑：npm run hash:state + npm run batch
 * 来源：docs/superpowers/specs/2026-07-02-military-refactor-executable-spec.md §4 T11
 * ===========================================================================
 */
import type { ClimateType, FactionId, RegionMilitaryState, RegionState, TerrainType } from "../core/types";

interface RegionTemplateInput {
  id: string;
  name: string;
  terrain: TerrainType;
  climate: ClimateType;
  ownerFactionId: FactionId;
  controllerFactionId?: FactionId;
  population: number;
  populationCapacity: number;
  agriculture: number;
  commerce: number;
  taxCapacity: number;
  stability: number;
  control: number;
  fortification: number;
  grainStock: number;
  garrison: number;
  coreFactionIds?: FactionId[];
  connections: string[];
  rebelPressure?: number;
  /**
   * v0.9.7 T11: 道路/基建等级 0..3 显式覆盖。0=草原/山野，1=泥路，
   * 2=石板/车马道，3=驰道/官道。未指定则按 terrain 启发式（coast/river
   * 默认 1，其余 0）。中原核心 2-3，南方省 1-2，草原/北疆 0。
   */
  infrastructureLevel?: 0 | 1 | 2 | 3;
  /**
   * v0.9.7 T11: 海港等级 0..3 显式覆盖。0=无，1=小渔港，2=市舶司级，
   * 3=京畿/泉州/广州型。沿海 region 未指定默认 1。
   */
  portLevel?: 0 | 1 | 2 | 3;
  /**
   * v0.9.7 T11: 河港等级 0..3 显式覆盖。0=无，1=普通渡口，2=运河/长江
   * 干流，3=京杭运河枢纽。river terrain 未指定默认 1。
   */
  riverPortLevel?: 0 | 1 | 2 | 3;
  /**
   * v0.9.7 T11: 仓储初始库存。中原核心 8000，边地 3000，海岛 5000。
   * v0.9.2 旧默认值 8000 不变，未指定时按地区类型启发式。
   */
  depotStockInit?: number;
}

function region(input: RegionTemplateInput): RegionState {
  // v0.9: 军事子结构默认值。中性值为"刚开局"——0 道路等级、中性支持 50、
  // 0 抵抗压力、0.5 筹粮（中等地）、30 战略权重。后续 v0.9.x 阶段按 faction
  // 形态差异化（如中原 1-3、草原 0-1）；本阶段确保 typecheck 通过且所有
  // region 都有必填字段。
  const military: RegionMilitaryState = {
    infrastructureLevel: input.infrastructureLevel ?? 0,
    seasonalState: "normal",
    localSupport: 50,
    occupationResistance: 0,
    forageCapacity: 0.5,
    strategicValue: 30,
  };
  // v0.9.2: 所有可玩 region 启用 logisticsNode（context tile / 海面 留 null）。
  // 默认 depotLevel/portLevel/riverPortLevel 都按 terrain 启发式（仅占位）；
  // 实际差异化由 v0.9.3 围城阶段（§3 调参）追加。
  const isPlayable = input.id !== "northern-sea" && input.id !== "western-pacific" &&
    input.id !== "southeast-asia" && input.id !== "northeast-asia-edge" &&
    input.id !== "hami-corridor" && input.id !== "tibetan-plateau" && input.id !== "mongol-steppe";
  // v0.9.7 T11: 港口/河港等级启发式 + 显式覆盖
  const portLevel = input.portLevel ?? (input.terrain === "coast" ? 1 : 0);
  const riverPortLevel = input.riverPortLevel ?? (input.terrain === "river" ? 1 : 0);
  // v0.9.7 T11: 仓储初始库存启发式
  //   中原（北/南直隶、山东、山西、河南、陕西）→ 8000
  //   海岛/渔港/北疆/草原/山野 → 5000
  //   其它（东南/西南/朝鲜/日本）→ 6000
  const CORE_REGIONS = new Set([
    "beizhili", "nanzhili", "shandong", "shanxi", "henan", "shaanxi"
  ]);
  const PERIPHERY_REGIONS = new Set([
    "liaodong", "gansu", "ningxia", "haixi", "jianzhou", "chahar_steppe",
    "tumed_steppe", "korchin_steppe", "hulunbuir", "amur_basin",
    "nurgan_coast", "sakhalin", "ezo"
  ]);
  const depotStockInit = input.depotStockInit ?? (
    CORE_REGIONS.has(input.id) ? 8000 :
    PERIPHERY_REGIONS.has(input.id) ? 5000 :
    6000
  );
  const logisticsNode = isPlayable
    ? {
        regionId: input.id,
        depotLevel: 1,
        depotStock: depotStockInit,
        throughput: 30000,
        portLevel: portLevel as 0 | 1 | 2 | 3,
        riverPortLevel: riverPortLevel as 0 | 1 | 2 | 3,
      }
    : null;
  return {
    id: input.id,
    name: input.name,
    terrain: input.terrain,
    climate: input.climate,
    ownerFactionId: input.ownerFactionId,
    controllerFactionId: input.controllerFactionId ?? input.ownerFactionId,
    population: input.population,
    populationCapacity: input.populationCapacity,
    agriculture: input.agriculture,
    commerce: input.commerce,
    taxCapacity: input.taxCapacity,
    stability: input.stability,
    control: input.control,
    fortification: input.fortification,
    grainStock: input.grainStock,
    garrison: input.garrison,
    coreFactionIds: input.coreFactionIds ?? [input.ownerFactionId],
    connections: input.connections,
    activeDisasters: [],
    rebelPressure: input.rebelPressure ?? 0,
    // v0.9.2: 物流节点（可玩 region 默认 1 级仓 + 8k 库存）
    logisticsNode,
    military,
  };
}

export const regionTemplates: Record<string, RegionState> = {
  beizhili: region({
    id: "beizhili",
    name: "北直隶",
    terrain: "plain",
    climate: "temperate",
    ownerFactionId: "ming",
    population: 6760000,
    populationCapacity: 8970000,
    agriculture: 55,
    commerce: 78,
    taxCapacity: 86,
    stability: 78,
    control: 91,
    fortification: 88,
    grainStock: 2340000,
    garrison: 96000,
    connections: ["liaodong", "shanxi", "shandong", "henan", "chahar_steppe"],
    // v0.9.7 T11: 京畿——官道驰道+京杭运河北端+海运天津
    infrastructureLevel: 3,
    portLevel: 2,  // 天津
    riverPortLevel: 3  // 京杭运河北端
  }),
  nanzhili: region({
    id: "nanzhili",
    name: "南直隶",
    terrain: "river",
    climate: "humid",
    ownerFactionId: "ming",
    population: 13720000,
    populationCapacity: 17360000,
    agriculture: 80,
    commerce: 90,
    taxCapacity: 95,
    stability: 76,
    control: 86,
    fortification: 60,
    grainStock: 4480000,
    garrison: 54000,
    connections: ["shandong", "henan", "huguang", "jiangxi", "zhejiang"],
    // v0.9.7 T11: 南京/扬州——江南官道+京杭运河中枢+长江
    infrastructureLevel: 3,
    portLevel: 2,  // 上海/松江
    riverPortLevel: 3  // 京杭运河南端+长江
  }),
  shandong: region({
    id: "shandong",
    name: "山东",
    terrain: "coast",
    climate: "temperate",
    ownerFactionId: "ming",
    population: 8060000,
    populationCapacity: 10140000,
    agriculture: 66,
    commerce: 60,
    taxCapacity: 70,
    stability: 72,
    control: 84,
    fortification: 54,
    grainStock: 2470000,
    garrison: 42000,
    connections: ["beizhili", "henan", "nanzhili"],
    // v0.9.7 T11: 齐鲁大道+京杭运河中段+登州海运
    infrastructureLevel: 2,
    portLevel: 2,  // 登州
    riverPortLevel: 2  // 运河中段
  }),
  shanxi: region({
    id: "shanxi",
    name: "山西",
    terrain: "plain",
    climate: "dry",
    ownerFactionId: "ming",
    population: 5590000,
    populationCapacity: 7410000,
    agriculture: 50,
    commerce: 45,
    taxCapacity: 54,
    stability: 68,
    control: 77,
    fortification: 78,
    grainStock: 1430000,
    garrison: 68000,
    connections: ["beizhili", "shaanxi", "henan", "tumed_steppe", "chahar_steppe"],
    // v0.9.7 T11: 山西—晋商官道（北路通草原）
    infrastructureLevel: 2
  }),
  henan: region({
    id: "henan",
    name: "河南",
    terrain: "plain",
    climate: "temperate",
    ownerFactionId: "ming",
    population: 9880000,
    populationCapacity: 12090000,
    agriculture: 70,
    commerce: 55,
    taxCapacity: 68,
    stability: 66,
    control: 78,
    fortification: 46,
    grainStock: 2860000,
    garrison: 38000,
    connections: ["beizhili", "shandong", "nanzhili", "shanxi", "shaanxi", "huguang"],
    rebelPressure: 4,
    // v0.9.7 T11: 中原核心——四方辐辏
    infrastructureLevel: 3
  }),
  shaanxi: region({
    id: "shaanxi",
    name: "陕西",
    terrain: "plain",
    climate: "dry",
    ownerFactionId: "ming",
    population: 6500000,
    populationCapacity: 8875000,
    agriculture: 52,
    commerce: 38,
    taxCapacity: 50,
    stability: 60,
    control: 72,
    fortification: 64,
    grainStock: 1687500,
    garrison: 66000,
    connections: ["shanxi", "henan", "sichuan", "tumed_steppe", "chahar_steppe"],
    rebelPressure: 8,
    // v0.9.7 T11: 西安—西北驿道
    infrastructureLevel: 2
  }),
  zhejiang: region({
    id: "zhejiang",
    name: "浙江",
    terrain: "coast",
    climate: "humid",
    ownerFactionId: "ming",
    population: 9100000,
    populationCapacity: 11480000,
    agriculture: 72,
    commerce: 84,
    taxCapacity: 82,
    stability: 74,
    control: 84,
    fortification: 46,
    grainStock: 2380000,
    garrison: 30000,
    connections: ["nanzhili", "jiangxi", "fujian"],
    // v0.9.7 T11: 浙东驿道+明州/泉州海运
    infrastructureLevel: 2,
    portLevel: 3,  // 宁波/明州
    riverPortLevel: 1  // 钱塘
  }),
  jiangxi: region({
    id: "jiangxi",
    name: "江西",
    terrain: "river",
    climate: "humid",
    ownerFactionId: "ming",
    population: 8680000,
    populationCapacity: 10920000,
    agriculture: 74,
    commerce: 62,
    taxCapacity: 70,
    stability: 72,
    control: 82,
    fortification: 42,
    grainStock: 2590000,
    garrison: 28000,
    connections: ["nanzhili", "zhejiang", "fujian", "huguang", "guangdong"],
    // v0.9.7 T11: 赣江—长江支流
    infrastructureLevel: 1,
    riverPortLevel: 2
  }),
  huguang: region({
    id: "huguang",
    name: "湖广",
    terrain: "river",
    climate: "humid",
    ownerFactionId: "ming",
    population: 11760000,
    populationCapacity: 14700000,
    agriculture: 82,
    commerce: 66,
    taxCapacity: 78,
    stability: 70,
    control: 80,
    fortification: 45,
    grainStock: 3640000,
    garrison: 36000,
    connections: ["henan", "nanzhili", "jiangxi", "sichuan", "guizhou", "guangxi"],
    // v0.9.7 T11: 长江中游+汉水
    infrastructureLevel: 1,
    riverPortLevel: 2
  }),
  sichuan: region({
    id: "sichuan",
    name: "四川",
    terrain: "mountain",
    climate: "humid",
    ownerFactionId: "ming",
    population: 6720000,
    populationCapacity: 9120000,
    agriculture: 66,
    commerce: 46,
    taxCapacity: 55,
    stability: 67,
    control: 75,
    fortification: 58,
    grainStock: 2040000,
    garrison: 42000,
    connections: ["shaanxi", "huguang", "guizhou", "bozhou", "yunnan"],
    // v0.9.7 T11: 川蜀道难+长江上游
    infrastructureLevel: 1,
    riverPortLevel: 2
  }),
  fujian: region({
    id: "fujian",
    name: "福建",
    terrain: "coast",
    climate: "humid",
    ownerFactionId: "ming",
    population: 5460000,
    populationCapacity: 7280000,
    agriculture: 55,
    commerce: 76,
    taxCapacity: 60,
    stability: 70,
    control: 80,
    fortification: 44,
    grainStock: 1260000,
    garrison: 26000,
    connections: ["zhejiang", "jiangxi", "guangdong"],
    // v0.9.7 T11: 泉州港（开海后远东第一港）
    infrastructureLevel: 1,
    portLevel: 3  // 泉州
  }),
  guangdong: region({
    id: "guangdong",
    name: "广东",
    terrain: "coast",
    climate: "humid",
    ownerFactionId: "ming",
    population: 6240000,
    populationCapacity: 8160000,
    agriculture: 60,
    commerce: 80,
    taxCapacity: 68,
    stability: 69,
    control: 78,
    fortification: 42,
    grainStock: 1560000,
    garrison: 32000,
    connections: ["fujian", "jiangxi", "guangxi"],
    // v0.9.7 T11: 广州港+珠江
    infrastructureLevel: 1,
    portLevel: 3,  // 广州
    riverPortLevel: 1  // 珠江
  }),
  guangxi: region({
    id: "guangxi",
    name: "广西",
    terrain: "mountain",
    climate: "humid",
    ownerFactionId: "ming",
    population: 3120000,
    populationCapacity: 4800000,
    agriculture: 46,
    commerce: 34,
    taxCapacity: 35,
    stability: 62,
    control: 66,
    fortification: 38,
    grainStock: 840000,
    garrison: 26000,
    connections: ["huguang", "guangdong", "guizhou", "yunnan"],
    // v0.9.7 T11: 岭南—驿道稀疏
    infrastructureLevel: 1
  }),
  yunnan: region({
    id: "yunnan",
    name: "云南",
    terrain: "mountain",
    climate: "humid",
    ownerFactionId: "ming",
    population: 2880000,
    populationCapacity: 4680000,
    agriculture: 42,
    commerce: 32,
    taxCapacity: 32,
    stability: 60,
    control: 62,
    fortification: 42,
    grainStock: 780000,
    garrison: 30000,
    connections: ["sichuan", "guizhou", "guangxi"],
    // v0.9.7 T11: 滇道险
    infrastructureLevel: 0
  }),
  guizhou: region({
    id: "guizhou",
    name: "贵州",
    terrain: "mountain",
    climate: "humid",
    ownerFactionId: "ming",
    population: 2160000,
    populationCapacity: 3360000,
    agriculture: 40,
    commerce: 26,
    taxCapacity: 28,
    stability: 58,
    control: 60,
    fortification: 36,
    grainStock: 624000,
    garrison: 24000,
    connections: ["sichuan", "huguang", "guangxi", "yunnan", "bozhou"],
    rebelPressure: 3,
    // v0.9.7 T11: 黔道
    infrastructureLevel: 0
  }),
  liaodong: region({
    id: "liaodong",
    name: "辽东",
    terrain: "plain",
    climate: "cold",
    ownerFactionId: "ming",
    population: 610000,
    populationCapacity: 880000,
    agriculture: 48,
    commerce: 35,
    taxCapacity: 42,
    stability: 62,
    control: 70,
    fortification: 70,
    grainStock: 330000,
    garrison: 70000,
    coreFactionIds: ["ming", "jianzhou"],
    connections: ["beizhili", "haixi", "jianzhou", "korchin_steppe", "joseon_north"],
    // v0.9.7 T11: 辽东边墙—驿道
    infrastructureLevel: 1
  }),
  chahar_steppe: region({
    id: "chahar_steppe",
    name: "察哈尔",
    terrain: "steppe",
    climate: "dry",
    ownerFactionId: "chahar",
    population: 240000,
    populationCapacity: 380000,
    agriculture: 22,
    commerce: 34,
    taxCapacity: 24,
    stability: 60,
    control: 56,
    fortification: 24,
    grainStock: 120000,
    garrison: 43000,
    connections: ["beizhili", "shanxi", "shaanxi", "tumed_steppe", "korchin_steppe"],
    // v0.9.7 T11: 草原无官道
    infrastructureLevel: 0
  }),
  tumed_steppe: region({
    id: "tumed_steppe",
    name: "土默特",
    terrain: "steppe",
    climate: "dry",
    ownerFactionId: "tumed",
    population: 280000,
    populationCapacity: 420000,
    agriculture: 24,
    commerce: 46,
    taxCapacity: 28,
    stability: 68,
    control: 70,
    fortification: 28,
    grainStock: 140000,
    garrison: 52000,
    connections: ["shanxi", "shaanxi", "chahar_steppe"],
    // v0.9.7 T11: 草原+归化城互市口
    infrastructureLevel: 0
  }),
  haixi: region({
    id: "haixi",
    name: "海西",
    terrain: "mountain",
    climate: "cold",
    ownerFactionId: "haixi",
    population: 260000,
    populationCapacity: 460000,
    agriculture: 34,
    commerce: 24,
    taxCapacity: 22,
    stability: 58,
    control: 55,
    fortification: 30,
    grainStock: 170000,
    garrison: 29000,
    coreFactionIds: ["haixi", "jianzhou"],
    connections: ["liaodong", "jianzhou", "korchin_steppe", "hulunbuir", "amur_basin"],
    // v0.9.7 T11: 女真山路
    infrastructureLevel: 0
  }),
  jianzhou: region({
    id: "jianzhou",
    name: "建州",
    terrain: "mountain",
    climate: "cold",
    ownerFactionId: "jianzhou",
    population: 220000,
    populationCapacity: 420000,
    agriculture: 36,
    commerce: 22,
    taxCapacity: 24,
    stability: 72,
    control: 78,
    fortification: 35,
    grainStock: 180000,
    garrison: 32000,
    connections: ["liaodong", "haixi", "joseon_north", "amur_basin", "nurgan_coast"],
    // v0.9.7 T11: 建州老寨—佛阿拉/赫图阿拉山道
    infrastructureLevel: 0
  }),
  korchin_steppe: region({
    id: "korchin_steppe",
    name: "科尔沁",
    terrain: "steppe",
    climate: "cold",
    ownerFactionId: "korchin",
    population: 180000,
    populationCapacity: 320000,
    agriculture: 20,
    commerce: 28,
    taxCapacity: 18,
    stability: 58,
    control: 52,
    fortification: 18,
    grainStock: 90000,
    garrison: 26000,
    connections: ["chahar_steppe", "liaodong", "haixi", "hulunbuir"],
    // v0.9.7 T11: 草原
    infrastructureLevel: 0
  }),
  hulunbuir: region({
    id: "hulunbuir",
    name: "呼伦贝尔",
    terrain: "steppe",
    climate: "cold",
    ownerFactionId: "korchin",
    population: 120000,
    populationCapacity: 260000,
    agriculture: 18,
    commerce: 24,
    taxCapacity: 16,
    stability: 60,
    control: 48,
    fortification: 14,
    grainStock: 70000,
    garrison: 18000,
    connections: ["korchin_steppe", "haixi", "amur_basin"],
    // v0.9.7 T11: 极北草原
    infrastructureLevel: 0
  }),
  amur_basin: region({
    id: "amur_basin",
    name: "黑龙江",
    terrain: "river",
    climate: "cold",
    ownerFactionId: "nurgan",
    population: 95000,
    populationCapacity: 210000,
    agriculture: 16,
    commerce: 22,
    taxCapacity: 14,
    stability: 56,
    control: 44,
    fortification: 12,
    grainStock: 65000,
    garrison: 15000,
    connections: ["hulunbuir", "haixi", "jianzhou", "nurgan_coast", "sakhalin"],
    // v0.9.7 T11: 黑龙江水运（夏季）
    infrastructureLevel: 0,
    riverPortLevel: 2
  }),
  nurgan_coast: region({
    id: "nurgan_coast",
    name: "奴儿干",
    terrain: "coast",
    climate: "cold",
    ownerFactionId: "nurgan",
    population: 80000,
    populationCapacity: 180000,
    agriculture: 14,
    commerce: 26,
    taxCapacity: 12,
    stability: 54,
    control: 42,
    fortification: 12,
    grainStock: 50000,
    garrison: 12000,
    connections: ["amur_basin", "jianzhou", "sakhalin", "ezo"],
    // v0.9.7 T11: 苦夷岛
    infrastructureLevel: 0,
    portLevel: 1
  }),
  sakhalin: region({
    id: "sakhalin",
    name: "库页",
    terrain: "coast",
    climate: "cold",
    ownerFactionId: "ainu",
    population: 30000,
    populationCapacity: 85000,
    agriculture: 10,
    commerce: 18,
    taxCapacity: 8,
    stability: 62,
    control: 36,
    fortification: 8,
    grainStock: 18000,
    garrison: 3000,
    connections: ["amur_basin", "nurgan_coast", "ezo"],
    // v0.9.7 T11: 海岛渔村
    infrastructureLevel: 0,
    portLevel: 1
  }),
  joseon_north: region({
    id: "joseon_north",
    name: "朝鲜北道",
    terrain: "mountain",
    climate: "cold",
    ownerFactionId: "joseon",
    population: 1300000,
    populationCapacity: 1900000,
    agriculture: 46,
    commerce: 34,
    taxCapacity: 38,
    stability: 70,
    control: 72,
    fortification: 42,
    grainStock: 520000,
    garrison: 22000,
    coreFactionIds: ["joseon", "ming"],
    connections: ["liaodong", "jianzhou", "joseon_south"],
    // v0.9.7 T11: 朝鲜驿道
    infrastructureLevel: 1
  }),
  joseon_south: region({
    id: "joseon_south",
    name: "朝鲜三南",
    terrain: "coast",
    climate: "temperate",
    ownerFactionId: "joseon",
    population: 2600000,
    populationCapacity: 3400000,
    agriculture: 58,
    commerce: 46,
    taxCapacity: 50,
    stability: 72,
    control: 76,
    fortification: 34,
    grainStock: 980000,
    garrison: 26000,
    coreFactionIds: ["joseon", "ming"],
    connections: ["joseon_north", "japan_west"],
    // v0.9.7 T11: 朝鲜—釜山港+洛东江
    infrastructureLevel: 1,
    portLevel: 1
  }),
  japan_west: region({
    id: "japan_west",
    name: "西日本",
    terrain: "coast",
    climate: "humid",
    ownerFactionId: "japan",
    population: 4200000,
    populationCapacity: 5600000,
    agriculture: 60,
    commerce: 62,
    taxCapacity: 58,
    stability: 52,
    control: 44,
    fortification: 46,
    grainStock: 1200000,
    garrison: 52000,
    connections: ["joseon_south", "japan_east", "ezo"],
    // v0.9.7 T11: 博多/平户港
    infrastructureLevel: 1,
    portLevel: 2  // 博多
  }),
  japan_east: region({
    id: "japan_east",
    name: "东日本",
    terrain: "mountain",
    climate: "temperate",
    ownerFactionId: "japan",
    population: 3600000,
    populationCapacity: 5200000,
    agriculture: 56,
    commerce: 54,
    taxCapacity: 52,
    stability: 50,
    control: 42,
    fortification: 48,
    grainStock: 1000000,
    garrison: 40000,
    connections: ["japan_west", "ezo"],
    // v0.9.7 T11: 东国山道
    infrastructureLevel: 1
  }),
  ezo: region({
    id: "ezo",
    name: "虾夷",
    terrain: "mountain",
    climate: "cold",
    ownerFactionId: "ainu",
    population: 70000,
    populationCapacity: 180000,
    agriculture: 12,
    commerce: 22,
    taxCapacity: 10,
    stability: 64,
    control: 40,
    fortification: 10,
    grainStock: 45000,
    garrison: 6000,
    connections: ["japan_west", "japan_east", "nurgan_coast", "sakhalin"],
    // v0.9.7 T11: 山夷猎道
    infrastructureLevel: 0,
    portLevel: 1
  }),
  bozhou: region({
    id: "bozhou",
    name: "播州",
    terrain: "mountain",
    climate: "humid",
    ownerFactionId: "bozhou",
    population: 360000,
    populationCapacity: 580000,
    agriculture: 44,
    commerce: 28,
    taxCapacity: 26,
    stability: 64,
    control: 58,
    fortification: 68,
    grainStock: 210000,
    garrison: 25000,
    coreFactionIds: ["bozhou", "ming"],
    connections: ["sichuan", "guizhou"],
    rebelPressure: 2,
    // v0.9.7 T11: 播州土司—山道
    infrastructureLevel: 0
  })
};
