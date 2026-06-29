import type { GameEvent } from "../core/eventEngine";

export type EventVisualType = "political" | "popular" | "military" | "disaster";

export interface EventVisual {
  type: EventVisualType;
  label: string;
  alt: string;
  assetKey: string;
}

const visualFamilies: Record<EventVisualType, Omit<EventVisual, "type" | "assetKey">> = {
  political: {
    label: "政治事件",
    alt: "政治事件插画：朝堂议政与文书案牍"
  },
  popular: {
    label: "民众事件",
    alt: "民众事件插画：市井聚集与地方动荡"
  },
  military: {
    label: "军事事件",
    alt: "军事事件插画：边军行营与战事军报"
  },
  disaster: {
    label: "灾难事件",
    alt: "灾难事件插画：旱灾饥荒与荒村流民"
  }
};

export const eventVisualTypeById: Record<string, EventVisualType> = {
  zhang_reform_pressure: "political",
  qingzhang_tianmu: "popular",
  yitiaobian_promotion: "political",
  kaocheng_resistance: "political",
  zhang_juzheng_death: "political",
  purge_reform_legacy: "political",
  state_succession_dispute: "political",
  ningxia_rebellion: "military",
  korean_war: "military",
  bozhou_campaign: "military",
  three_campaigns_cost: "popular",
  border_army_exhaustion: "military",
  jianzhou_unification: "military",
  nurgaci_uprising: "military",
  later_jin_founded: "military",
  fushun_falls: "military",
  saarhu_campaign: "military",
  liaoshen_crisis: "military",
  xiong_tingbi_liaodong: "military",
  mineral_tax_disaster: "popular",
  donglin_dispute: "political",
  eunuch_wei_rise: "political",
  shaanxi_drought: "disaster",
  tianqi_political_crisis: "political"
};

export function resolveEventVisual(event: GameEvent): EventVisual {
  const type = eventVisualTypeById[event.id] ?? inferEventVisualType(event);
  return {
    type,
    assetKey: type,
    ...visualFamilies[type]
  };
}

function inferEventVisualType(event: GameEvent): EventVisualType {
  const text = `${event.id} ${event.name} ${event.description}`;

  if (/旱|灾|饥|荒|drought|famine/i.test(text)) return "disaster";
  if (/税|民|乱|流民|矿|popular|unrest/i.test(text)) return "popular";
  if (/war|campaign|army|battle|军|兵|战|役|边|辽东|女真|建州|后金/i.test(text)) return "military";
  return "political";
}
