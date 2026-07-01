import type { GameEvent } from "../core/eventEngine";
import disasterUrl from "../assets/art/event-disaster.png";
import diplomaticUrl from "../assets/art/event-diplomatic.png";
import economicUrl from "../assets/art/event-economic.png";
import frontierUrl from "../assets/art/event-frontier.png";
import intrigueUrl from "../assets/art/event-intrigue.png";
import militaryUrl from "../assets/art/event-military.png";
import politicalUrl from "../assets/art/event-political.png";
import popularUrl from "../assets/art/event-popular.png";
import jiashenCatastropheUrl from "../assets/art/events/jiashen-catastrophe.png";
import jisiIncidentUrl from "../assets/art/events/jisi-incident.png";
import koreanWarUrl from "../assets/art/events/korean-war.png";
import laterJinFoundedUrl from "../assets/art/events/later-jin-founded.png";
import liaoxiangSurchargeUrl from "../assets/art/events/liaoxiang-surcharge.png";
import saarhuCampaignUrl from "../assets/art/events/saarhu-campaign.png";
import shaanxiChainDroughtUrl from "../assets/art/events/shaanxi-chain-drought.png";
import tiaoobianControversyUrl from "../assets/art/events/tiaoobian-controversy.png";
import weiZhongxianPurgeUrl from "../assets/art/events/wei-zhongxian-purge.png";
import yuanChonghuanExecutionUrl from "../assets/art/events/yuan-chonghuan-execution.png";
import chongzhenEmperorUrl from "../assets/art/portraits/characters/chongzhen-emperor.png";
import joseonSeonjoUrl from "../assets/art/portraits/characters/joseon-seonjo.png";
import liChengliangUrl from "../assets/art/portraits/characters/li-chengliang.png";
import nurhaciUrl from "../assets/art/portraits/characters/nurhaci.png";
import toyotomiHideyoshiUrl from "../assets/art/portraits/characters/toyotomi-hideyoshi.png";
import wanliEmperorUrl from "../assets/art/portraits/characters/wanli-emperor.png";
import weiZhongxianUrl from "../assets/art/portraits/characters/wei-zhongxian.png";
import xiongTingbiUrl from "../assets/art/portraits/characters/xiong-tingbi.png";
import yuanChonghuanUrl from "../assets/art/portraits/characters/yuan-chonghuan.png";
import zhangJuzhengUrl from "../assets/art/portraits/characters/zhang-juzheng.png";
import ainuLeaderUrl from "../assets/art/portraits/factions/ainu.png";
import bozhouLeaderUrl from "../assets/art/portraits/factions/bozhou.png";
import chaharLeaderUrl from "../assets/art/portraits/factions/chahar.png";
import haixiLeaderUrl from "../assets/art/portraits/factions/haixi.png";
import korchinLeaderUrl from "../assets/art/portraits/factions/korchin.png";
import nurganLeaderUrl from "../assets/art/portraits/factions/nurgan.png";
import tumedLeaderUrl from "../assets/art/portraits/factions/tumed.png";

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
  jisi_incident: eventScene("event-jisi-incident", "己巳之变京师戒严图", "military", jisiIncidentUrl),
  liaoxiang_surcharge: eventScene("event-liaoxiang-surcharge", "辽饷加派财政图", "economic", liaoxiangSurchargeUrl),
  jiashen_catastrophe: eventScene("event-jiashen-catastrophe", "甲申国难京师危局图", "disaster", jiashenCatastropheUrl),
  tiaoobian_controversy: eventScene("event-tiaoobian-controversy", "一条鞭法争议朝议图", "economic", tiaoobianControversyUrl),
  wei_zhongxian_purge: eventScene("event-wei-zhongxian-purge", "魏忠贤诏狱密奏图", "intrigue", weiZhongxianPurgeUrl),
  yuan_chonghuan_execution: eventScene("event-yuan-chonghuan-execution", "袁崇焕之死朝堂图", "intrigue", yuanChonghuanExecutionUrl),
  shaanxi_chain_drought: eventScene("event-shaanxi-chain-drought", "陕西旱荒民变链图", "disaster", shaanxiChainDroughtUrl),
  korean_war: eventScene("event-korean-war", "援朝战争海陆军援图", "military", koreanWarUrl),
  later_jin_founded: eventScene("event-later-jin-founded", "后金建立部族会盟图", "frontier", laterJinFoundedUrl),
  saarhu_campaign: eventScene("event-saarhu-campaign", "萨尔浒之战军议图", "military", saarhuCampaignUrl)
};

const characterPortraits: Record<string, CharacterPortrait> = {
  zhang_juzheng: characterPortrait("zhang_juzheng", "张居正立绘", "首辅", zhangJuzhengUrl),
  wanli_emperor: characterPortrait("wanli_emperor", "万历帝立绘", "大明皇帝", wanliEmperorUrl),
  nurhaci: characterPortrait("nurhaci", "努尔哈赤立绘", "建州首领", nurhaciUrl),
  xiong_tingbi: characterPortrait("xiong_tingbi", "熊廷弼立绘", "辽东经略", xiongTingbiUrl),
  wei_zhongxian: characterPortrait("wei_zhongxian", "魏忠贤立绘", "司礼监秉笔", weiZhongxianUrl),
  yuan_chonghuan: characterPortrait("yuan_chonghuan", "袁崇焕立绘", "辽东督师", yuanChonghuanUrl),
  chongzhen_emperor: characterPortrait("chongzhen_emperor", "崇祯帝立绘", "大明皇帝", chongzhenEmperorUrl),
  li_chengliang: characterPortrait("li_chengliang", "李成梁立绘", "辽东总兵", liChengliangUrl),
  toyotomi_hideyoshi: characterPortrait("toyotomi_hideyoshi", "丰臣秀吉立绘", "日本关白", toyotomiHideyoshiUrl),
  joseon_seonjo: characterPortrait("joseon_seonjo", "朝鲜宣祖立绘", "朝鲜国王", joseonSeonjoUrl)
};

export const characterIdsByEventId: Record<string, string[]> = {
  zhang_reform_pressure: ["zhang_juzheng", "wanli_emperor"],
  zhang_juzheng_death: ["zhang_juzheng", "wanli_emperor"],
  purge_reform_legacy: ["zhang_juzheng", "wanli_emperor"],
  state_succession_dispute: ["wanli_emperor"],
  korean_war: ["toyotomi_hideyoshi", "joseon_seonjo"],
  later_jin_founded: ["nurhaci"],
  nurgaci_uprising: ["nurhaci", "li_chengliang"],
  jianzhou_unification: ["nurhaci", "li_chengliang"],
  saarhu_campaign: ["nurhaci", "li_chengliang"],
  wei_zhongxian_purge: ["wei_zhongxian"],
  eunuch_wei_rise: ["wei_zhongxian"],
  yuan_chonghuan_execution: ["yuan_chonghuan", "chongzhen_emperor"],
  jisi_incident: ["yuan_chonghuan", "chongzhen_emperor"],
  jiashen_catastrophe: ["chongzhen_emperor"],
  xiong_tingbi_liaodong: ["xiong_tingbi"]
};

export const factionLeaderByFactionId: Record<string, FactionLeaderPortrait> = {
  ming: factionLeader("ming", "万历帝立绘", wanliEmperorUrl),
  tumed: factionLeader("tumed", "俺答汗立绘", tumedLeaderUrl),
  jianzhou: factionLeader("jianzhou", "努尔哈赤立绘", nurhaciUrl),
  chahar: factionLeader("chahar", "图们汗立绘", chaharLeaderUrl),
  haixi: factionLeader("haixi", "王台立绘", haixiLeaderUrl),
  korchin: factionLeader("korchin", "莽古思立绘", korchinLeaderUrl),
  nurgan: factionLeader("nurgan", "奴儿干诸部首领立绘", nurganLeaderUrl),
  joseon: factionLeader("joseon", "朝鲜宣祖立绘", joseonSeonjoUrl),
  japan: factionLeader("japan", "丰臣秀吉立绘", toyotomiHideyoshiUrl),
  ainu: factionLeader("ainu", "虾夷诸部首领立绘", ainuLeaderUrl),
  bozhou: factionLeader("bozhou", "杨应龙立绘", bozhouLeaderUrl)
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
  return factionLeaderByFactionId[factionId] ?? factionLeader("unknown", "未知势力首领立绘", wanliEmperorUrl);
}

function eventScene(key: string, label: string, type: EventVisualType, src: string): ArtImage {
  return {
    key,
    src,
    label,
    alt: `${label}：${visualFamilies[type].alt}`,
    type
  };
}

function characterPortrait(
  id: string,
  label: string,
  role: string,
  src: string
): CharacterPortrait {
  return {
    id,
    key: `portrait-${id}`,
    src,
    label,
    alt: label,
    role
  };
}

function factionLeader(factionId: string, label: string, src: string): FactionLeaderPortrait {
  return {
    factionId,
    key: `faction-${factionId}-leader`,
    src,
    label,
    alt: label
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
