import type { GameEvent } from "../core/eventEngine";

export const mvpEvents: GameEvent[] = [
  {
    id: "zhang_reform_pressure",
    name: "张居正整顿吏治",
    category: "faction",
    description: "首辅张居正推行考成法和财政整顿，朝廷行政效率提升，但官僚阻力开始积累。",
    priority: 80,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1573-01", end: "1577-12" },
      { type: "flag_absent", flag: "zhang_reform_started" }
    ],
    options: [
      {
        id: "support_reform",
        name: "支持整顿",
        shortEffect: "行政提高，腐败下降，稳定承压。",
        effects: [
          { factionId: "ming", administration: 8, corruption: -5, legitimacy: -2, setFlag: "zhang_reform_started" }
        ]
      },
      {
        id: "soften_reform",
        name: "缓和推行",
        shortEffect: "行政小幅提高，阻力较低。",
        effects: [
          { factionId: "ming", administration: 3, corruption: -2, setFlag: "zhang_reform_started" }
        ]
      }
    ]
  },
  {
    id: "zhang_juzheng_death",
    name: "首辅之逝",
    category: "chain",
    description: "张居正病逝，改革失去最重要的推动者，清算与维持新政的争论浮出水面。",
    priority: 90,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1582-07", end: "1582-12" }
    ],
    options: [
      {
        id: "maintain_reform",
        name: "维持新政",
        shortEffect: "行政继续提高，合法性略降。",
        effects: [{ factionId: "ming", administration: 6, corruption: -4, legitimacy: -3 }]
      },
      {
        id: "purge_zhang",
        name: "清算张居正",
        shortEffect: "获得短期合法性和国库，行政与腐败恶化。",
        effects: [{ factionId: "ming", treasury: 300000, administration: -8, corruption: 7, legitimacy: 5 }]
      }
    ]
  },
  {
    id: "bozhou_campaign",
    name: "播州之役",
    category: "region",
    description: "西南地方势力与中央秩序的矛盾激化，朝廷可选择军事解决或暂时安抚。",
    priority: 70,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1599-01", end: "1600-12" },
      { type: "region_controller", regionId: "bozhou", factionId: "bozhou" }
    ],
    options: [
      {
        id: "launch_campaign",
        name: "发兵平播",
        shortEffect: "国库消耗，播州控制下降。",
        effects: [
          { factionId: "ming", treasury: -600000, grain: -450000 },
          { regionId: "bozhou", control: -22, stability: -10 }
        ]
      },
      {
        id: "appease_bozhou",
        name: "暂行安抚",
        shortEffect: "短期省费，但地方控制问题保留。",
        effects: [
          { factionId: "ming", legitimacy: -2 },
          { regionId: "bozhou", stability: 6, control: 4 }
        ]
      }
    ]
  },
  {
    id: "jianzhou_unification",
    name: "建州整合",
    category: "faction",
    description: "建州部族整合速度加快，辽东边防压力上升。",
    priority: 75,
    conditions: [
      { type: "faction_exists", factionId: "jianzhou" },
      { type: "date_window", start: "1583-01", end: "1595-12" }
    ],
    options: [
      {
        id: "tribal_integration",
        name: "部族整合",
        shortEffect: "建州军事组织和兵力提升。",
        effects: [
          { factionId: "jianzhou", administration: 4, legitimacy: 5 },
          { regionId: "jianzhou", stability: 5, control: 8 }
        ]
      }
    ]
  },
  {
    id: "saarhu_campaign",
    name: "萨尔浒之战",
    category: "global",
    description: "辽东局势恶化，明军与后金力量在东北形成关键碰撞。",
    priority: 95,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "faction_exists", factionId: "jianzhou" },
      { type: "date_window", start: "1619-01", end: "1619-12" }
    ],
    options: [
      {
        id: "commit_liaodong",
        name: "重兵经略辽东",
        shortEffect: "明朝国库和粮食大耗，辽东控制暂时提高。",
        effects: [
          { factionId: "ming", treasury: -900000, grain: -700000 },
          { regionId: "liaodong", control: 12, stability: -4 }
        ]
      },
      {
        id: "preserve_strength",
        name: "保存实力",
        shortEffect: "减少消耗，但辽东控制下降。",
        effects: [
          { factionId: "ming", legitimacy: -4 },
          { regionId: "liaodong", control: -18, stability: -6 }
        ]
      }
    ]
  }
];
