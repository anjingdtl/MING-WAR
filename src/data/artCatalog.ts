import type { GameEvent } from "../core/eventEngine";
import disasterUrl from "../assets/art/event-disaster.png";
import diplomaticUrl from "../assets/art/event-diplomatic.png";
import economicUrl from "../assets/art/event-economic.png";
import frontierUrl from "../assets/art/event-frontier.png";
import intrigueUrl from "../assets/art/event-intrigue.png";
import militaryUrl from "../assets/art/event-military.png";
import politicalUrl from "../assets/art/event-political.png";
import popularUrl from "../assets/art/event-popular.png";
import portraitSheetUrl from "../assets/art/ming-character-portraits.png";

export type EventVisualType =
  | "political"
  | "popular"
  | "military"
  | "disaster"
  | "economic"
  | "diplomatic"
  | "frontier"
  | "intrigue";

export interface ArtImage {
  key: string;
  src: string;
  label: string;
  alt: string;
  objectPosition?: string;
  type?: EventVisualType;
}

export interface EventVisual {
  type: EventVisualType;
  label: string;
  alt: string;
  assetKey: EventVisualType;
}

export interface CharacterPortrait extends ArtImage {
  id: string;
  role: string;
}

export interface FactionLeaderPortrait extends ArtImage {
  factionId: string;
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
  tianqi_political_crisis: "political",
  jisi_incident: "military",
  liaoxiang_surcharge: "economic",
  jiashen_catastrophe: "disaster",
  tiaoobian_controversy: "economic",
  wei_zhongxian_purge: "intrigue",
  yuan_chonghuan_execution: "intrigue",
  shaanxi_chain_drought: "disaster"
};

const eventFamilyAssets: Record<EventVisualType, string> = {
  political: politicalUrl,
  popular: popularUrl,
  military: militaryUrl,
  disaster: disasterUrl,
  economic: economicUrl,
  diplomatic: diplomaticUrl,
  frontier: frontierUrl,
  intrigue: intrigueUrl
};

export const eventArtById: Record<string, ArtImage> = {
  jisi_incident: eventScene("event-jisi-incident", "己巳之变京师戒严图", "military"),
  liaoxiang_surcharge: eventScene("event-liaoxiang-surcharge", "辽饷加派财政图", "economic"),
  jiashen_catastrophe: eventScene("event-jiashen-catastrophe", "甲申国难京师危局图", "disaster"),
  tiaoobian_controversy: eventScene("event-tiaoobian-controversy", "一条鞭法争议朝议图", "economic"),
  wei_zhongxian_purge: eventScene("event-wei-zhongxian-purge", "魏忠贤诏狱密奏图", "intrigue"),
  yuan_chonghuan_execution: eventScene("event-yuan-chonghuan-execution", "袁崇焕之死朝堂图", "intrigue"),
  shaanxi_chain_drought: eventScene("event-shaanxi-chain-drought", "陕西旱荒民变链图", "disaster"),
  korean_war: eventScene("event-korean-war", "援朝战争海陆军援图", "military"),
  later_jin_founded: eventScene("event-later-jin-founded", "后金建立部族会盟图", "frontier")
};

const characterPortraits: Record<string, CharacterPortrait> = {
  zhang_juzheng: characterPortrait("zhang_juzheng", "张居正立绘", "首辅", "8% center"),
  nurhaci: characterPortrait("nurhaci", "努尔哈赤立绘", "建州首领", "92% center"),
  wei_zhongxian: characterPortrait("wei_zhongxian", "魏忠贤立绘", "司礼监秉笔", "58% center"),
  yuan_chonghuan: characterPortrait("yuan_chonghuan", "袁崇焕立绘", "辽东督师", "72% center"),
  xiong_tingbi: characterPortrait("xiong_tingbi", "熊廷弼立绘", "辽东经略", "72% center")
};

export const characterIdsByEventId: Record<string, string[]> = {
  zhang_reform_pressure: ["zhang_juzheng"],
  zhang_juzheng_death: ["zhang_juzheng"],
  purge_reform_legacy: ["zhang_juzheng"],
  later_jin_founded: ["nurhaci"],
  nurgaci_uprising: ["nurhaci"],
  jianzhou_unification: ["nurhaci"],
  wei_zhongxian_purge: ["wei_zhongxian"],
  eunuch_wei_rise: ["wei_zhongxian"],
  yuan_chonghuan_execution: ["yuan_chonghuan"],
  jisi_incident: ["yuan_chonghuan"],
  xiong_tingbi_liaodong: ["xiong_tingbi"]
};

export const factionLeaderByFactionId: Record<string, FactionLeaderPortrait> = {
  ming: factionLeader("ming", "大明君主立绘", "0% center"),
  tumed: factionLeader("tumed", "土默特部首领立绘", "66% center"),
  jianzhou: factionLeader("jianzhou", "建州女真首领立绘", "100% center"),
  chahar: factionLeader("chahar", "察哈尔部首领立绘", "66% center"),
  haixi: factionLeader("haixi", "海西女真首领立绘", "100% center"),
  korchin: factionLeader("korchin", "科尔沁部首领立绘", "66% center"),
  nurgan: factionLeader("nurgan", "奴儿干诸部首领立绘", "100% center"),
  joseon: factionLeader("joseon", "朝鲜君主立绘", "33% center"),
  japan: factionLeader("japan", "日本诸藩大名立绘", "66% center"),
  ainu: factionLeader("ainu", "虾夷诸部首领立绘", "66% center"),
  bozhou: factionLeader("bozhou", "播州杨氏土司立绘", "33% center")
};

export function resolveEventVisual(event: GameEvent): EventVisual {
  const type = eventVisualTypeById[event.id] ?? inferEventVisualType(event);
  return {
    type,
    assetKey: type,
    ...visualFamilies[type]
  };
}

export function resolveEventScene(event: GameEvent): ArtImage {
  const visual = resolveEventVisual(event);
  return eventArtById[event.id] ?? {
    key: `event-${visual.assetKey}`,
    src: eventFamilyAssets[visual.assetKey],
    label: visual.label,
    alt: visual.alt,
    type: visual.type
  };
}

export function resolveEventCharacters(event: GameEvent): CharacterPortrait[] {
  return (characterIdsByEventId[event.id] ?? [])
    .map((id) => characterPortraits[id])
    .filter((portrait): portrait is CharacterPortrait => Boolean(portrait));
}

export function resolveFactionLeaderPortrait(factionId: string): FactionLeaderPortrait {
  return factionLeaderByFactionId[factionId] ?? factionLeader("unknown", "未知势力首领立绘", "66% center");
}

function eventScene(key: string, label: string, type: EventVisualType): ArtImage {
  return {
    key,
    src: eventFamilyAssets[type],
    label,
    alt: `${label}：${visualFamilies[type].alt}`,
    type
  };
}

function characterPortrait(
  id: string,
  label: string,
  role: string,
  objectPosition: string
): CharacterPortrait {
  return {
    id,
    key: `portrait-${id}`,
    src: portraitSheetUrl,
    label,
    alt: label,
    role,
    objectPosition
  };
}

function factionLeader(factionId: string, label: string, objectPosition: string): FactionLeaderPortrait {
  return {
    factionId,
    key: `faction-${factionId}-leader`,
    src: portraitSheetUrl,
    label,
    alt: label,
    objectPosition
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
