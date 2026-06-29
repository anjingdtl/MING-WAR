import type { CliqueDef, FactionCliqueId } from "../core/types";

export const cliqueTemplates: Record<FactionCliqueId, CliqueDef> = {
  donglin: {
    id: "donglin",
    name: "东林党",
    shortName: "东林",
    description: "以江南士大夫为主体的政治派系，主张澄清吏治、减税惠民、反对矿税。",
    primaryTrait: "澄清吏治",
    policyAffinities: {
      agriculture: 2,
      finance: -4,
      military: -3,
      administration: 8,
      recovery: 6,
      frontier: -2,
    },
    // S3/S4: 东林代表士绅+城市工商业资本，主张低税、清流、反对皇权敛财。
    preferredLaws: ["low-tax", "clean-admin", "relief-priority"],
    opposedLaws: ["mining-tax", "commercial-tax", "land-survey"],
  },
  eunuchs: {
    id: "eunuchs",
    name: "内廷宦党",
    shortName: "宦党",
    description:
      "以司礼监、矿监税使为核心的宦官政治势力，依附皇权，主张开征商税矿税。",
    primaryTrait: "整顿财政",
    policyAffinities: {
      agriculture: -2,
      finance: 8,
      military: 2,
      administration: -6,
      recovery: -2,
      frontier: 0,
    },
    // S3/S4: 宦党依附皇权，主张扩张财源（矿税商税）、中央集敛。
    preferredLaws: ["mining-tax", "commercial-tax", "treasury-centralization"],
    opposedLaws: ["low-tax", "local-autonomy"],
  },
  gentry: {
    id: "gentry",
    name: "地方缙绅",
    shortName: "缙绅",
    description:
      "各地拥有土地的在乡士绅，反对清丈田亩，主张维持地方自治和低税率。",
    primaryTrait: "劝课农桑",
    policyAffinities: {
      agriculture: 6,
      finance: -4,
      military: 0,
      administration: -4,
      recovery: 4,
      frontier: -4,
    },
    // S3/S4: 缙绅代表在乡地主+小农共同体，反对清丈、主张地方自治与低税。
    preferredLaws: ["low-tax", "local-autonomy", "land-protection"],
    opposedLaws: ["land-survey", "commercial-tax"],
  },
  generals: {
    id: "generals",
    name: "军功勋贵",
    shortName: "勋贵",
    description: "世袭武勋和边疆将门，追求军费倾斜、边功封赏和军事自主权。",
    primaryTrait: "整军备战",
    policyAffinities: {
      agriculture: -2,
      finance: 0,
      military: 8,
      administration: 0,
      recovery: -4,
      frontier: 6,
    },
    // S3/S4: 勋贵追求军费倾斜与边疆军事自主，反对文官节制与财政紧缩。
    preferredLaws: ["military-funding", "frontier-autonomy"],
    opposedLaws: ["civilian-control", "austerity"],
  },
};
