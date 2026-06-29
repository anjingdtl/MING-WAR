import type { GameEvent } from "../core/eventEngine";

export const mvpEvents: GameEvent[] = [
  // 改革时期
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
    id: "qingzhang_tianmu",
    name: "清丈田亩",
    category: "faction",
    description: "朝廷下令重新丈量全国田亩，豪强隐匿的土地被析出，税基扩大，但地方怨声载道。",
    priority: 75,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1573-01", end: "1580-12" },
      { type: "flag_absent", flag: "qingzhang_done" }
    ],
    options: [
      {
        id: "enforce_nationwide",
        name: "全国强力清丈",
        shortEffect: "税收能力提高，多地稳定下降。",
        effects: [
          { factionId: "ming", treasury: 400000, legitimacy: -3 },
          { regionId: "nanzhili", stability: -5, rebelPressure: 6 },
          { regionId: "zhejiang", stability: -4, rebelPressure: 5 },
          { setFlag: "qingzhang_done" }
        ]
      },
      {
        id: "pilot_provinces",
        name: "数省试点",
        shortEffect: "增收有限，阻力较小。",
        effects: [
          { factionId: "ming", treasury: 180000 },
          { regionId: "beizhili", stability: -2 },
          { setFlag: "qingzhang_done" }
        ]
      }
    ]
  },
  {
    id: "yitiaobian_promotion",
    name: "一条鞭法推广",
    category: "faction",
    description: "赋役合并、计亩征银的改革开始推广，财政征收效率提高，但商品经济薄弱地区压力增大。",
    priority: 78,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1580-01", end: "1584-12" },
      { type: "flag_absent", flag: "yitiaobian_done" }
    ],
    options: [
      {
        id: "nationwide_rollout",
        name: "全国推行",
        shortEffect: "行政与税收提高，西南稳定略降。",
        effects: [
          { factionId: "ming", administration: 4, legitimacy: 2 },
          { regionId: "sichuan", stability: -3 },
          { regionId: "guizhou", stability: -3 },
          { setFlag: "yitiaobian_done" }
        ]
      },
      {
        id: "gradual_rollout",
        name: "渐进实施",
        shortEffect: "税收小幅提升，社会冲击小。",
        effects: [
          { factionId: "ming", administration: 2 },
          { setFlag: "yitiaobian_done" }
        ]
      }
    ]
  },
  {
    id: "kaocheng_resistance",
    name: "考成法阻力",
    category: "faction",
    description: "考成法压实官员责任，但官僚集团以各种方式抵制，行政效率提升受阻。",
    priority: 72,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1574-01", end: "1579-12" },
      { type: "flag_present", flag: "zhang_reform_started" }
    ],
    options: [
      {
        id: "tighten_inspection",
        name: "严加督察",
        shortEffect: "行政效率再升，官员阻力加大。",
        effects: [
          { factionId: "ming", administration: 5, corruption: -3, legitimacy: -2 }
        ]
      },
      {
        id: "ease_pressure",
        name: "适当放宽",
        shortEffect: "稳定提升，改革效果打折。",
        effects: [
          { factionId: "ming", administration: -2, corruption: 2, legitimacy: 2 }
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
        effects: [
          { factionId: "ming", administration: 6, corruption: -4, legitimacy: -3, setFlag: "reform_maintained" }
        ]
      },
      {
        id: "purge_zhang",
        name: "清算张居正",
        shortEffect: "获得短期合法性和国库，行政与腐败恶化。",
        effects: [
          { factionId: "ming", treasury: 300000, administration: -8, corruption: 7, legitimacy: 5, setFlag: "zhang_purged" }
        ]
      }
    ]
  },
  {
    id: "purge_reform_legacy",
    name: "清算改革遗产",
    category: "chain",
    description: "张居正身后的政治清算蔓延到新政本身，考成法与清丈田亩的成效面临反转。",
    priority: 82,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1583-01", end: "1587-12" },
      { type: "flag_present", flag: "zhang_purged" }
    ],
    options: [
      {
        id: "partial_restore",
        name: "保留务实条款",
        shortEffect: "减少行政损失，但无法阻止反弹。",
        effects: [
          { factionId: "ming", administration: -4, corruption: 5, legitimacy: 2 }
        ]
      },
      {
        id: "full_reversal",
        name: "全面 overturn",
        shortEffect: "国库有所回流，行政与腐败严重倒退。",
        effects: [
          { factionId: "ming", treasury: 500000, administration: -10, corruption: 10, legitimacy: 4 }
        ]
      }
    ]
  },
  {
    id: "state_succession_dispute",
    name: "国本之争",
    category: "faction",
    description: "立储问题引发朝廷长期争论，君臣对立消耗行政精力，地方官员观望不前。",
    priority: 76,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1586-01", end: "1601-12" },
      { type: "flag_absent", flag: "succession_resolved" }
    ],
    options: [
      {
        id: "uphold_eldest",
        name: "坚持立长",
        shortEffect: "符合礼法，但神宗怠政风险上升。",
        effects: [
          { factionId: "ming", legitimacy: 4, administration: -5 },
          { setFlag: "succession_resolved" }
        ]
      },
      {
        id: "favor_favorite",
        name: "倾向宠妃之子",
        shortEffect: "宫廷稳定，官僚集团离心。",
        effects: [
          { factionId: "ming", legitimacy: -4, administration: -4, corruption: 3 },
          { setFlag: "succession_resolved" }
        ]
      }
    ]
  },
  // 万历三大征
  {
    id: "ningxia_rebellion",
    name: "宁夏之役",
    category: "region",
    description: "宁夏将领哱拜据城反叛，朝廷必须迅速调兵平叛，否则西北震动。",
    priority: 85,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1592-01", end: "1593-12" },
      { type: "region_controller", regionId: "shaanxi", factionId: "ming" }
    ],
    options: [
      {
        id: "swift_suppression",
        name: "速调边军平叛",
        shortEffect: "耗费钱粮，西北控制恢复。",
        effects: [
          { factionId: "ming", treasury: -500000, grain: -350000, warExhaustion: 3 },
          { regionId: "shaanxi", stability: -8, control: 6, garrison: -8000 },
          { setFlag: "three_campaigns_started" }
        ]
      },
      {
        id: "negotiate_surrender",
        name: "招抚为主",
        shortEffect: "省钱但稳定和控制受损。",
        effects: [
          { factionId: "ming", treasury: -150000, legitimacy: -3 },
          { regionId: "shaanxi", stability: -12, control: -10, rebelPressure: 10 },
          { setFlag: "three_campaigns_started" }
        ]
      }
    ]
  },
  {
    id: "korean_war",
    name: "援朝战争",
    category: "global",
    description: "日本丰臣秀吉侵朝，朝鲜告急。明朝可选择大规模出兵援朝，或仅作象征性支援。",
    priority: 88,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1592-01", end: "1598-12" }
    ],
    options: [
      {
        id: "full_intervention",
        name: "全面出兵援朝",
        shortEffect: "辽东边军大量消耗，国库与粮食锐减。",
        effects: [
          { factionId: "ming", treasury: -1200000, grain: -900000, warExhaustion: 6, legitimacy: 3 },
          { regionId: "liaodong", garrison: -18000, stability: -6 },
          { setFlag: "korean_war_fought" }
        ]
      },
      {
        id: "limited_aid",
        name: "有限援助",
        shortEffect: "减少消耗，但辽东防御压力转移。",
        effects: [
          { factionId: "ming", treasury: -400000, grain: -250000, legitimacy: -2 },
          { setFlag: "korean_war_limited" }
        ]
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
          { factionId: "ming", treasury: -600000, grain: -450000, warExhaustion: 4 },
          { regionId: "bozhou", control: -22, stability: -10, garrison: -6000 },
          { setFlag: "three_campaigns_started" }
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
    id: "three_campaigns_cost",
    name: "三大征军费激增",
    category: "global",
    description: "三大征接连用兵，太仓库银迅速见底，加派赋税的呼声渐起。",
    priority: 86,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1597-01", end: "1600-12" },
      { type: "flag_present", flag: "three_campaigns_started" }
    ],
    options: [
      {
        id: "emergency_tax",
        name: "加派赋税",
        shortEffect: "缓解财政，全国稳定下降。",
        effects: [
          { factionId: "ming", treasury: 800000, legitimacy: -4 },
          { regionId: "beizhili", stability: -4 },
          { regionId: "nanzhili", stability: -4 },
          { regionId: "henan", stability: -4 },
          { setFlag: "three_campaigns_cost_paid" }
        ]
      },
      {
        id: "draw_reserves",
        name: "动用内帑与储备",
        shortEffect: "不扰民，但国库见底速度快。",
        effects: [
          { factionId: "ming", treasury: -600000, grain: -300000, legitimacy: 2 },
          { setFlag: "three_campaigns_cost_paid" }
        ]
      }
    ]
  },
  {
    id: "border_army_exhaustion",
    name: "边军疲惫",
    category: "faction",
    description: "连年征战使九边精锐损耗严重，军队补充困难，辽东防务尤其空虚。",
    priority: 80,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1599-01", end: "1602-12" },
      { type: "flag_present", flag: "three_campaigns_started" }
    ],
    options: [
      {
        id: "rotate_troops",
        name: "轮休边军",
        shortEffect: "恢复战力，短期防御下降。",
        effects: [
          { factionId: "ming", militaryOrganization: 4, warExhaustion: -5, armyTotal: -24000 },
          { regionId: "liaodong", garrison: -12000, stability: -3 }
        ]
      },
      {
        id: "keep_pressure",
        name: "维持高压",
        shortEffect: "保持驻军规模，但疲劳与损耗加剧。",
        effects: [
          { factionId: "ming", warExhaustion: 4, armyTotal: -16000, militaryOrganization: -3 },
          { regionId: "liaodong", garrison: -6000 }
        ]
      }
    ]
  },
  // 辽东危机
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
          { factionId: "jianzhou", administration: 4, legitimacy: 5, armyTotal: 6000 },
          { regionId: "jianzhou", stability: 5, control: 8 }
        ]
      }
    ]
  },
  {
    id: "nurgaci_uprising",
    name: "努尔哈赤起兵",
    category: "faction",
    description: "努尔哈赤以十三副遗甲起兵，开始统一女真诸部，辽东烽烟渐起。",
    priority: 82,
    conditions: [
      { type: "faction_exists", factionId: "jianzhou" },
      { type: "date_window", start: "1583-01", end: "1592-12" }
    ],
    options: [
      {
        id: "support_jurchen_rivals",
        name: "扶持女真各部",
        shortEffect: "消耗明朝资源，延缓建州扩张。",
        effects: [
          { factionId: "ming", treasury: -200000, grain: -150000 },
          { factionId: "jianzhou", armyTotal: -4000, legitimacy: -3 },
          { regionId: "haixi", stability: -5 }
        ]
      },
      {
        id: "ignore_northeast",
        name: "坐视其成",
        shortEffect: "省钱，但建州整合加速。",
        effects: [
          { factionId: "jianzhou", armyTotal: 8000, militaryOrganization: 5, legitimacy: 4 }
        ]
      }
    ]
  },
  {
    id: "later_jin_founded",
    name: "后金建立",
    category: "faction",
    description: "努尔哈赤建国称汗，女真势力从部族联盟升级为政权，对明朝的威胁质变。",
    priority: 92,
    conditions: [
      { type: "faction_exists", factionId: "jianzhou" },
      { type: "date_window", start: "1616-01", end: "1617-12" }
    ],
    options: [
      {
        id: "diplomatic_isolation",
        name: "外交孤立",
        shortEffect: "合法性受抑，但军事压力未减。",
        effects: [
          { factionId: "jianzhou", legitimacy: -6, treasury: -120000 },
          { factionId: "ming", legitimacy: 2 }
        ]
      },
      {
        id: "prepare_war",
        name: "整军备战",
        shortEffect: "辽东防御加强，财政消耗大。",
        effects: [
          { factionId: "ming", treasury: -400000, grain: -250000, warExhaustion: 2 },
          { regionId: "liaodong", garrison: 12000, control: 6 },
          { factionId: "jianzhou", militaryOrganization: 4, armyTotal: 6000 }
        ]
      }
    ]
  },
  {
    id: "fushun_falls",
    name: "抚顺失守",
    category: "region",
    description: "后金攻陷抚顺，辽东边防出现裂口，明廷必须决定是反击还是固守。",
    priority: 90,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "faction_exists", factionId: "jianzhou" },
      { type: "date_window", start: "1618-01", end: "1619-06" },
      { type: "region_controller", regionId: "liaodong", factionId: "ming" }
    ],
    options: [
      {
        id: "counter_attack",
        name: "立刻反击",
        shortEffect: "夺回部分控制，但军队损失惨重。",
        effects: [
          { factionId: "ming", treasury: -300000, grain: -200000, armyTotal: -26000, warExhaustion: 5 },
          { regionId: "liaodong", control: -10, garrison: -14000, stability: -8 }
        ]
      },
      {
        id: "fortify_passes",
        name: "固守关隘",
        shortEffect: "保存实力，放弃部分前沿。",
        effects: [
          { factionId: "ming", armyTotal: -8000, warExhaustion: 2 },
          { regionId: "liaodong", control: -16, stability: -4 },
          { factionId: "jianzhou", legitimacy: 4 }
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
          { factionId: "ming", treasury: -900000, grain: -700000, armyTotal: -34000, warExhaustion: 6 },
          { regionId: "liaodong", control: 12, stability: -4, garrison: 8000 },
          { setFlag: "saarhu_committed" }
        ]
      },
      {
        id: "preserve_strength",
        name: "保存实力",
        shortEffect: "减少消耗，但辽东控制下降。",
        effects: [
          { factionId: "ming", legitimacy: -4, armyTotal: -12000 },
          { regionId: "liaodong", control: -18, stability: -6 },
          { setFlag: "saarhu_preserved" }
        ]
      }
    ]
  },
  {
    id: "liaoshen_crisis",
    name: "辽沈危机",
    category: "region",
    description: "辽东与沈阳防御体系摇摇欲坠，朝廷急需选派能臣主持防务。",
    priority: 88,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1620-01", end: "1621-12" },
      { type: "region_controller", regionId: "liaodong", factionId: "ming" }
    ],
    options: [
      {
        id: "send_competent_commander",
        name: "选派能臣",
        shortEffect: "稳定与控制回升，耗费钱粮。",
        effects: [
          { factionId: "ming", treasury: -400000, grain: -300000 },
          { regionId: "liaodong", control: 10, stability: 6, garrison: 10000 }
        ]
      },
      {
        id: "local_defense",
        name: "倚仗当地将门",
        shortEffect: "省钱但控制提升有限，可能养痈。",
        effects: [
          { factionId: "ming", treasury: -120000 },
          { regionId: "liaodong", control: 4, stability: -3, corruption: 2 }
        ]
      }
    ]
  },
  {
    id: "xiong_tingbi_liaodong",
    name: "熊廷弼经略辽东",
    category: "faction",
    description: "熊廷弼提出守为正着、战为奇着的方略，朝廷可选择支持或掣肘。",
    priority: 84,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1619-01", end: "1621-12" }
    ],
    options: [
      {
        id: "grant_full_authority",
        name: "授予全权",
        shortEffect: "辽东防务改善，但文官集团不满。",
        effects: [
          { factionId: "ming", treasury: -350000, grain: -250000, legitimacy: -2 },
          { regionId: "liaodong", control: 12, stability: 5, garrison: 8000 }
        ]
      },
      {
        id: "civil_oversight",
        name: "文官监督",
        shortEffect: "防止将门坐大，但效率降低。",
        effects: [
          { factionId: "ming", treasury: -180000, administration: -2 },
          { regionId: "liaodong", control: 4, stability: -2 }
        ]
      }
    ]
  },
  // 秩序松动
  {
    id: "mineral_tax_disaster",
    name: "矿税之祸",
    category: "faction",
    description: "朝廷派出矿监税使搜刮民间，商业繁荣地区首当其冲，民怨沸腾。",
    priority: 78,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1596-01", end: "1606-12" },
      { type: "flag_absent", flag: "mineral_tax_ended" }
    ],
    options: [
      {
        id: "recall_tax_commissioners",
        name: "召回税使",
        shortEffect: "稳定回升，国库收入减少。",
        effects: [
          { factionId: "ming", treasury: -250000, legitimacy: 3 },
          { regionId: "nanzhili", stability: 6, rebelPressure: -8 },
          { regionId: "zhejiang", stability: 6, rebelPressure: -6 },
          { setFlag: "mineral_tax_ended" }
        ]
      },
      {
        id: "continue_taxation",
        name: "继续征收",
        shortEffect: "短期增收，多地稳定骤降。",
        effects: [
          { factionId: "ming", treasury: 350000, legitimacy: -3 },
          { regionId: "nanzhili", stability: -8, rebelPressure: 10 },
          { regionId: "jiangxi", stability: -6, rebelPressure: 8 },
          { regionId: "zhejiang", stability: -6, rebelPressure: 8 }
        ]
      }
    ]
  },
  {
    id: "donglin_dispute",
    name: "东林党争",
    category: "faction",
    description: "朝中党争日趋激烈，政策摇摆不定，行政效率与合法性都受到侵蚀。",
    priority: 80,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1604-01", end: "1620-12" }
    ],
    options: [
      {
        id: "mediate_factions",
        name: "居中调停",
        shortEffect: "行政与稳定小幅恢复，但党争根源未除。",
        effects: [
          { factionId: "ming", administration: 3, legitimacy: 2, corruption: 1 }
        ]
      },
      {
        id: "purge_donglin",
        name: "压制东林",
        shortEffect: "短期政局稳定，长期人才流失。",
        effects: [
          { factionId: "ming", administration: -4, legitimacy: -3, corruption: 4 },
          { regionId: "nanzhili", stability: -5 }
        ]
      }
    ]
  },
  {
    id: "eunuch_wei_rise",
    name: "魏忠贤掌权",
    category: "faction",
    description: "宦官魏忠贤逐渐掌握大权，厂卫横行，官僚体系腐败加剧。",
    priority: 82,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1620-01", end: "1621-12" }
    ],
    options: [
      {
        id: "restrain_eunuchs",
        name: "约束宦官",
        shortEffect: "腐败受抑，但宫廷不稳。",
        effects: [
          { factionId: "ming", corruption: -6, administration: 2, legitimacy: -2 }
        ]
      },
      {
        id: "use_eunuchs",
        name: "借其制衡文官",
        shortEffect: "行政执行力提高，腐败与离心加剧。",
        effects: [
          { factionId: "ming", corruption: 8, administration: 3, legitimacy: -4 },
          { regionId: "beizhili", stability: -3 }
        ]
      }
    ]
  },
  // 明末危机征兆
  {
    id: "shaanxi_drought",
    name: "陕西大旱",
    category: "region",
    description: "陕西连年干旱，粮食绝收，流民开始聚集，如果不赈济，叛乱风险将迅速上升。",
    priority: 86,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1620-01", end: "1621-12" },
      { type: "region_controller", regionId: "shaanxi", factionId: "ming" }
    ],
    options: [
      {
        id: "large_relief",
        name: "开仓赈济",
        shortEffect: "消耗大量粮食，稳定与人口得以保全。",
        effects: [
          { factionId: "ming", grain: -500000, treasury: -200000, legitimacy: 2 },
          { regionId: "shaanxi", stability: 8, rebelPressure: -12, grainStock: 200000 }
        ]
      },
      {
        id: "small_relief",
        name: "有限赈济",
        shortEffect: "部分缓解，但流民问题持续。",
        effects: [
          { factionId: "ming", grain: -150000, treasury: -60000 },
          { regionId: "shaanxi", stability: 2, rebelPressure: -4 }
        ]
      },
      {
        id: "ignore_drought",
        name: "暂不赈济",
        shortEffect: "省钱粮，但叛乱压力剧增。",
        effects: [
          { factionId: "ming", legitimacy: -3 },
          { regionId: "shaanxi", stability: -10, rebelPressure: 18, population: -120000 }
        ]
      }
    ]
  },
  {
    id: "tianqi_political_crisis",
    name: "天启政治危机",
    category: "faction",
    description: "天启年间君权旁落，党争与宦官势力交织，朝廷行政能力进一步下滑。",
    priority: 80,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1620-01", end: "1621-12" }
    ],
    options: [
      {
        id: "reform_court",
        name: "整顿朝纲",
        shortEffect: "行政与合法性回升，但触动既得利益。",
        effects: [
          { factionId: "ming", administration: 5, legitimacy: 3, corruption: -3, centralization: 4 }
        ]
      },
      {
        id: "maintain_status_quo",
        name: "维持现状",
        shortEffect: "避免冲突，但腐败与低效继续恶化。",
        effects: [
          { factionId: "ming", corruption: 4, administration: -3, legitimacy: -2 }
        ]
      }
    ]
  }
];
