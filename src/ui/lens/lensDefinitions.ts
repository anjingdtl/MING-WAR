/**
 * Lens 系统 — 5 个视角的元数据。
 *
 * Phase 3 核心改造:借鉴 V3 的 5-Lens 范式,把地图从"图层堆叠"升级为"视角切换"。
 * 每个 Lens 决定 1) 地图色板 2) hover 卡字段 3) 详情面板默认 Tab。
 */

import type { LucideIcon } from "lucide-react";
import { Crown, Landmark, MapPin, Scale, Users } from "lucide-react";
import type { GameState, MapLayer, RegionState } from "../../core/types";
import type { SidePanelTab } from "../layout/SidePanel";

export type LensId = "control" | "economy" | "military" | "people" | "court";

export interface HoverField {
  label: string;
  value: string;
  tone?: "default" | "warning" | "danger" | "positive";
}

export interface LensDefinition {
  id: LensId;
  name: string;
  description: string;
  Icon: LucideIcon;
  /** 对应的核心图层(切 Lens 时同步设置) */
  mapLayer: MapLayer;
  /** 详情面板默认 Tab */
  defaultTab: SidePanelTab;
  /** 区域 hover 卡字段 */
  hoverFields: (region: RegionState, state: GameState) => HoverField[];
  /** 切到此 Lens 时是否显示 LensBar 中 */
  visible: boolean;
}

export const LENSES: LensDefinition[] = [
  {
    id: "control",
    name: "势力",
    description: "各势力控制范围与控制度",
    Icon: Crown,
    mapLayer: "control",
    defaultTab: "region",
    visible: true,
    hoverFields: (region, state) => {
      const faction = state.factions[region.controllerFactionId];
      return [
        { label: "控制者", value: faction?.name ?? "无" },
        {
          label: "控制度",
          value: `${region.control}`,
          tone:
            region.control < 30 ? "danger" : region.control < 50 ? "warning" : "default"
        },
        {
          label: "稳定度",
          value: `${region.stability}`,
          tone:
            region.stability < 30
              ? "danger"
              : region.stability < 50
              ? "warning"
              : "default"
        }
      ];
    }
  },
  {
    id: "economy",
    name: "经济",
    description: "税力、商业、农业产出",
    Icon: Landmark,
    mapLayer: "tax",
    defaultTab: "decision",
    visible: true,
    hoverFields: (region) => [
      { label: "税力", value: `${region.taxCapacity}`, tone: region.taxCapacity >= 60 ? "positive" : "default" },
      { label: "农业", value: `${region.agriculture}` },
      { label: "商业", value: `${region.commerce}` },
      {
        label: "估算收入",
        value: `${region.taxCapacity * 10}两/月`
      }
    ]
  },
  {
    id: "military",
    name: "军事",
    description: "驻军、防御与战备",
    Icon: Scale,
    mapLayer: "army",
    defaultTab: "decision",
    visible: true,
    hoverFields: (region) => [
      {
        label: "驻军",
        value: `${Math.round(region.garrison / 1000)}千`,
        tone: region.garrison < 1000 ? "danger" : "default"
      },
      { label: "防御", value: `${region.fortification}` },
      {
        label: "地形",
        value:
          region.terrain === "plain"
            ? "平原"
            : region.terrain === "mountain"
            ? "山地"
            : region.terrain === "steppe"
            ? "草原"
            : region.terrain === "river"
            ? "水乡"
            : "沿海"
      },
      { label: "气候", value: climateLabel(region.climate) }
    ]
  },
  {
    id: "people",
    name: "民生",
    description: "人口、粮储、叛乱压力",
    Icon: Users,
    mapLayer: "grain",
    defaultTab: "region",
    visible: true,
    hoverFields: (region) => [
      {
        label: "人口",
        value: `${Math.round(region.population / 10000)}万`
      },
      {
        label: "粮储",
        value: `${Math.round(region.grainStock / 10000)}万石`,
        tone: region.grainStock < 5000 ? "danger" : region.grainStock < 20000 ? "warning" : "positive"
      },
      {
        label: "叛乱压力",
        value: `${region.rebelPressure}`,
        tone: region.rebelPressure > 75 ? "danger" : region.rebelPressure > 50 ? "warning" : "default"
      },
      {
        label: "承载",
        value: region.population > region.populationCapacity ? "超载" : "充足",
        tone: region.population > region.populationCapacity ? "warning" : "positive"
      }
    ]
  },
  {
    id: "court",
    name: "朝堂",
    description: "派系对区域的影响(当前以控制者代表)",
    Icon: MapPin,
    mapLayer: "control",
    defaultTab: "court",
    visible: true,
    hoverFields: (region, state) => {
      const faction = state.factions[region.controllerFactionId];
      const playerFaction = state.factions[state.playerFactionId];
      const isPlayer = faction?.id === state.playerFactionId;
      return [
        {
          label: "势力",
          value: faction?.name ?? "无",
          tone: isPlayer ? "positive" : "default"
        },
        {
          label: "对朝堂影响",
          value: isPlayer ? "直接" : "间接(可干预)"
        },
        {
          label: "玩家天命",
          value: `${playerFaction?.centralization ?? 0}`,
          tone:
            (playerFaction?.centralization ?? 0) < 30
              ? "danger"
              : (playerFaction?.centralization ?? 0) < 50
              ? "warning"
              : "positive"
        }
      ];
    }
  }
];

export const LENS_BY_ID: Record<LensId, LensDefinition> = Object.fromEntries(
  LENSES.map((l) => [l.id, l])
) as Record<LensId, LensDefinition>;

function climateLabel(c: RegionState["climate"]): string {
  switch (c) {
    case "temperate":
      return "温带";
    case "cold":
      return "寒带";
    case "dry":
      return "干旱";
    case "humid":
      return "湿润";
  }
}
