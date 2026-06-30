import type { MapTileKind } from "../mapTypes";

/**
 * 图块层级元数据：与几何数据（mapRegionSource）分离维护。
 * 几何 path 稳定少变，层级语义（kind/playable/controller）随设计演进，分开更安全。
 */
export interface MapTileMetadata {
  displayName: string;
  kind: MapTileKind;
  isPlayableRegion: boolean;
  defaultControllerFactionId: string;
  importance: 1 | 2 | 3;
}

const CORE = (displayName: string, controller = "ming"): MapTileMetadata => ({
  displayName,
  kind: "core-province",
  isPlayableRegion: true,
  defaultControllerFactionId: controller,
  importance: 1
});

const FRONTIER = (displayName: string, controller = "ming"): MapTileMetadata => ({
  displayName,
  kind: "frontier-province",
  isPlayableRegion: true,
  defaultControllerFactionId: controller,
  importance: 1
});

const NEIGHBOR = (displayName: string, controller: string): MapTileMetadata => ({
  displayName,
  kind: "neighbor-region",
  isPlayableRegion: true,
  defaultControllerFactionId: controller,
  importance: 2
});

export const mapTileMetadata: Record<string, MapTileMetadata> = {
  // 明朝两京十三省
  beizhili: CORE("北直隶"),
  nanzhili: CORE("南直隶"),
  shandong: CORE("山东"),
  shanxi: CORE("山西"),
  henan: CORE("河南"),
  shaanxi: CORE("陕西"),
  zhejiang: CORE("浙江"),
  jiangxi: CORE("江西"),
  huguang: CORE("湖广"),
  sichuan: CORE("四川"),
  fujian: CORE("福建"),
  guangdong: CORE("广东"),
  guangxi: CORE("广西"),
  yunnan: CORE("云南"),
  guizhou: CORE("贵州"),

  // 边疆/土司
  liaodong: FRONTIER("辽东"),
  bozhou: FRONTIER("播州", "bozhou"),

  // 蒙古诸部
  chahar_steppe: NEIGHBOR("察哈尔", "chahar"),
  tumed_steppe: NEIGHBOR("土默特", "tumed"),
  korchin_steppe: NEIGHBOR("科尔沁", "korchin"),
  hulunbuir: NEIGHBOR("呼伦贝尔", "korchin"),

  // 女真
  haixi: NEIGHBOR("海西", "haixi"),
  jianzhou: NEIGHBOR("建州", "jianzhou"),

  // 奴儿干
  amur_basin: NEIGHBOR("黑龙江", "nurgan"),
  nurgan_coast: NEIGHBOR("奴儿干", "nurgan"),

  // 周边国家
  sakhalin: NEIGHBOR("库页", "ainu"),
  joseon_north: NEIGHBOR("朝鲜北道", "joseon"),
  joseon_south: NEIGHBOR("朝鲜三南", "joseon"),
  japan_west: NEIGHBOR("西日本", "japan"),
  japan_east: NEIGHBOR("东日本", "japan"),
  ezo: NEIGHBOR("虾夷", "ainu")
};
