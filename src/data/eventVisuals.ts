import type { GameEvent } from "../core/eventEngine";

export type EventVisualType =
  | "political"
  | "popular"
  | "military"
  | "disaster"
  | "economic"
  | "diplomatic"
  | "frontier"
  | "intrigue";

export interface EventVisual {
  type: EventVisualType;
  label: string;
  alt: string;
  assetKey: EventVisualType;
}

export const visualFamilies: Record<EventVisualType, Omit<EventVisual, "type" | "assetKey">> = {
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
  },
  economic: {
    label: "财政事件",
    alt: "财政事件插画：银两账册与赋税核算"
  },
  diplomatic: {
    label: "海疆事件",
    alt: "海疆事件插画：港口军援与跨海调兵"
  },
  frontier: {
    label: "边疆事件",
    alt: "边疆事件插画：林海部族会盟与东北边地"
  },
  intrigue: {
    label: "宫廷事件",
    alt: "宫廷事件插画：灯下密议与宫廷党争"
  }
};

export const eventVisualTypeById: Record<string, EventVisualType> = {
  zhang_reform_pressure: "political",
  qingzhang_tianmu: "economic",
  yitiaobian_promotion: "economic",
  kaocheng_resistance: "political",
  zhang_juzheng_death: "intrigue",
  purge_reform_legacy: "intrigue",
  state_succession_dispute: "intrigue",
  ningxia_rebellion: "military",
  korean_war: "military",
  bozhou_campaign: "military",
  three_campaigns_cost: "economic",
  border_army_exhaustion: "military",
  jianzhou_unification: "frontier",
  nurgaci_uprising: "frontier",
  later_jin_founded: "frontier",
  fushun_falls: "military",
  saarhu_campaign: "military",
  liaoshen_crisis: "military",
  xiong_tingbi_liaodong: "military",
  mineral_tax_disaster: "popular",
  donglin_dispute: "intrigue",
  eunuch_wei_rise: "intrigue",
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
  if (/银|粮|赋|税|财政|treasury|grain|tax/i.test(text)) return "economic";
  if (/民|乱|流民|矿|popular|unrest/i.test(text)) return "popular";
  if (/海|朝鲜|援朝|外交|港|naval|coast|diplomacy/i.test(text)) return "diplomatic";
  if (/女真|建州|后金|部族|林|frontier|jurchen/i.test(text)) return "frontier";
  if (/war|campaign|army|battle|军|兵|战|役|边|辽东|女真|建州|后金/i.test(text)) return "military";
  if (/党|宦|宫|清算|succession|intrigue/i.test(text)) return "intrigue";
  return "political";
}
