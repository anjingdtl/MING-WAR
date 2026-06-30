import type { GameEvent } from "../core/eventEngine";

export const mvpEvents: GameEvent[] = [
  // ═══════════════════════════════════════════════════════════════════
  // 改革时期 (Reform Era)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "zhang_reform_pressure",
    name: "张居正整顿吏治",
    category: "faction",
    tier: "steel",
    sourceRefs: ["明史·张居正传", "万历十五年"],
    description: "首辅张居正推行考成法和财政整顿，朝廷行政效率提升，但官僚阻力开始积累。",
    priority: 80,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1573-01", end: "1577-06" },
      { type: "flag_absent", flag: "zhang_reform_started" }
    ],
    options: [
      {
        id: "support_reform",
        name: "支持整顿",
        shortEffect: "行政提高，腐败下降，稳定承压。",
        effects: [
          { factionId: "ming", administration: 8, corruption: -5, legitimacy: -2, setFlag: "zhang_reform_started" },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: 8 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: 5 } }
        ]
      },
      {
        id: "soften_reform",
        name: "缓和推行",
        shortEffect: "行政小幅提高，阻力较低。",
        effects: [
          { factionId: "ming", administration: 3, corruption: -2, setFlag: "zhang_reform_started" },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: 3 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 3 } }
        ]
      }
    ]
  },
  {
    id: "qingzhang_tianmu",
    name: "清丈田亩",
    category: "faction",
    tier: "steel",
    sourceRefs: ["明史·食货志", "张居正清丈田亩疏"],
    description: "朝廷下令重新丈量全国田亩，豪强隐匿的土地被析出，税基扩大，但地方怨声载道。",
    priority: 75,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1578-01", end: "1582-06" },
      { type: "flag_absent", flag: "qingzhang_done" }
    ],
    options: [
      {
        id: "enforce_nationwide",
        name: "全国强力清丈",
        shortEffect: "税收能力提高，多地稳定下降。",
        effects: [
          { factionId: "ming", treasury: 250000, legitimacy: -3 },
          { regionId: "nanzhili", stability: -5, rebelPressure: 6 },
          { regionId: "zhejiang", stability: -4, rebelPressure: 5 },
          { setFlag: "qingzhang_done" },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: 6 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -8 } }
        ]
      },
      {
        id: "pilot_provinces",
        name: "数省试点",
        shortEffect: "增收有限，阻力较小。",
        effects: [
          { factionId: "ming", treasury: 180000 },
          { regionId: "beizhili", stability: -2 },
          { setFlag: "qingzhang_done" },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: -3 } }
        ]
      }
    ]
  },
  {
    id: "yitiaobian_promotion",
    name: "一条鞭法推广",
    category: "faction",
    tier: "steel",
    sourceRefs: ["明史·食货志", "梁方仲《明代一条鞭法年表》"],
    chainId: "fiscal-reform-crisis",
    description: "赋役合并、计亩征银的改革开始推广，财政征收效率提高，但商品经济薄弱地区压力增大。",
    priority: 78,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1577-01", end: "1582-12" },
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
          { setFlag: "yitiaobian_done" },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: 10 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "eunuch", delta: 5 } }
        ]
      },
      {
        id: "gradual_rollout",
        name: "渐进实施",
        shortEffect: "税收小幅提升，社会冲击小。",
        effects: [
          { factionId: "ming", administration: 2 },
          { setFlag: "yitiaobian_done" },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 3 } }
        ]
      }
    ]
  },
  {
    id: "kaocheng_resistance",
    name: "考成法阻力",
    category: "faction",
    tier: "flexible",
    sourceRefs: ["明史·职官志"],
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
          { factionId: "ming", administration: 5, corruption: -3, legitimacy: -2 },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: 5 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -6 } }
        ]
      },
      {
        id: "ease_pressure",
        name: "适当放宽",
        shortEffect: "稳定提升，改革效果打折。",
        effects: [
          { factionId: "ming", administration: -2, corruption: 2, legitimacy: 2 },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 5 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: -4 } }
        ]
      }
    ]
  },
  // ═══════════════════════════════════════════════════════════════════
  // 铁事件 (Iron Events) — 君主不可控的纯事态
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "zhang_juzheng_death",
    name: "首辅之逝",
    category: "chain",
    tier: "iron",
    sourceRefs: ["明史·张居正传", "万历起居注"],
    description: "张居正病逝，改革失去最重要的推动者，清算与维持新政的争论浮出水面。",
    priority: 90,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1582-06", end: "1582-09" }
    ],
    options: [
      {
        id: "maintain_reform",
        name: "维持新政",
        shortEffect: "行政继续提高，合法性略降。",
        effects: [
          { factionId: "ming", administration: 6, corruption: -4, legitimacy: -3, setFlag: "reform_maintained" },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: 8 } }
        ]
      },
      {
        id: "purge_zhang",
        name: "清算张居正",
        shortEffect: "获得短期合法性和国库，行政与腐败恶化。",
        effects: [
          { factionId: "ming", treasury: 300000, administration: -8, corruption: 7, legitimacy: 5, setFlag: "zhang_purged" },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: -15 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: -20 } }
        ]
      }
    ]
  },
  {
    id: "later_jin_founded",
    name: "后金建立",
    category: "faction",
    tier: "iron",
    sourceRefs: ["清太祖实录", "满文老档"],
    description: "努尔哈赤建国称汗，女真势力从部族联盟升级为政权，对明朝的威胁质变。",
    priority: 92,
    conditions: [
      { type: "faction_exists", factionId: "jianzhou" },
      { type: "date_window", start: "1616-01", end: "1616-06" }
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
    tier: "iron",
    sourceRefs: ["明史·辽东传", "清太祖实录"],
    chainId: "liaodong-crisis",
    description: "后金攻陷抚顺，辽东边防出现裂口，明廷必须决定是反击还是固守。",
    priority: 90,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "faction_exists", factionId: "jianzhou" },
      { type: "date_window", start: "1618-04", end: "1618-09" },
      { type: "region_controller", regionId: "liaodong", factionId: "ming" }
    ],
    options: [
      {
        id: "counter_attack",
        name: "立刻反击",
        shortEffect: "夺回部分控制，但军队损失惨重。",
        effects: [
          { factionId: "ming", treasury: -300000, grain: -200000, armyTotal: -20000, warExhaustion: 5 },
          { regionId: "liaodong", control: -10, garrison: -14000, stability: -8 },
          { setFlag: "fushun_counter_attacked" },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 5 } }
        ]
      },
      {
        id: "fortify_passes",
        name: "固守关隘",
        shortEffect: "保存实力，放弃部分前沿。",
        effects: [
          { factionId: "ming", armyTotal: -8000, warExhaustion: 2 },
          { regionId: "liaodong", control: -16, stability: -4 },
          { factionId: "jianzhou", legitimacy: 4 },
          { setFlag: "fushun_fortified" }
        ]
      }
    ]
  },
  // ═══════════════════════════════════════════════════════════════════
  // 钢事件 (Steel Events) — 历史决策节点
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "purge_reform_legacy",
    name: "清算改革遗产",
    category: "chain",
    tier: "steel",
    sourceRefs: ["明史·张居正传", "万历野获编"],
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
          { factionId: "ming", administration: -4, corruption: 5, legitimacy: 2 },
          { factionId: "ming", cliqueSupport: { cliqueId: "imperial", delta: 3 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: -6 } }
        ]
      },
      {
        id: "full_reversal",
        name: "全面 overturn",
        shortEffect: "国库有所回流，行政与腐败严重倒退。",
        effects: [
          { factionId: "ming", treasury: 500000, administration: -10, corruption: 10, legitimacy: 4 },
          { factionId: "ming", cliqueSupport: { cliqueId: "imperial", delta: 6 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: -12 } }
        ]
      },
      {
        id: "limited_purge",
        name: "有限追夺",
        shortEffect: "仅追夺张居正个人荣誉，保留大部分改革。",
        effects: [
          { factionId: "ming", treasury: 150000, administration: -2, corruption: 2, legitimacy: 3 },
          { factionId: "ming", cliqueSupport: { cliqueId: "imperial", delta: 2 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: -3 } }
        ]
      }
    ]
  },
  {
    id: "state_succession_dispute",
    name: "国本之争",
    category: "faction",
    tier: "flexible",
    sourceRefs: ["明史·光宗本纪", "明史·后妃传"],
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
          { setFlag: "succession_resolved" },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 8 } }
        ]
      },
      {
        id: "favor_favorite",
        name: "倾向宠妃之子",
        shortEffect: "宫廷稳定，官僚集团离心。",
        effects: [
          { factionId: "ming", legitimacy: -4, administration: -4, corruption: 3 },
          { setFlag: "succession_resolved" },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -10 } },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: 5 } }
        ]
      }
    ]
  },
  // ═══════════════════════════════════════════════════════════════════
  // 万历三大征 (Three Great Campaigns of Wanli)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "ningxia_rebellion",
    name: "宁夏之役",
    category: "region",
    tier: "steel",
    sourceRefs: ["明史·宁夏传", "万历三大征考"],
    description: "宁夏将领哱拜据城反叛，朝廷必须迅速调兵平叛，否则西北震动。",
    priority: 85,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1592-04", end: "1592-12" },
      { type: "region_controller", regionId: "shaanxi", factionId: "ming" }
    ],
    options: [
      {
        id: "swift_suppression",
        name: "速调边军平叛",
        shortEffect: "耗费钱粮，西北控制恢复。",
        effects: [
          { factionId: "ming", treasury: -350000, grain: -350000, warExhaustion: 3 },
          { regionId: "shaanxi", stability: -8, control: 6, garrison: -8000 },
          { setFlag: "three_campaigns_started" },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 6 } }
        ]
      },
      {
        id: "negotiate_surrender",
        name: "招抚为主",
        shortEffect: "省钱但稳定和控制受损。",
        effects: [
          { factionId: "ming", treasury: -150000, legitimacy: -3 },
          { regionId: "shaanxi", stability: -12, control: -10, rebelPressure: 10 },
          { setFlag: "three_campaigns_started" },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -5 } }
        ]
      },
      {
        id: "appease_rebels",
        name: "招抚",
        shortEffect: "最省钱，但叛乱隐患留存。",
        effects: [
          { factionId: "ming", treasury: -80000, legitimacy: -2 },
          { regionId: "shaanxi", stability: -6, control: -4, rebelPressure: 6 },
          { setFlag: "three_campaigns_started" }
        ]
      }
    ]
  },
  {
    id: "korean_war",
    name: "援朝战争",
    category: "global",
    tier: "steel",
    sourceRefs: ["明史·朝鲜传", "壬辰倭乱史料"],
    description: "日本丰臣秀吉侵朝，朝鲜告急。明朝可选择大规模出兵援朝，或仅作象征性支援。",
    priority: 88,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1592-06", end: "1598-12" }
    ],
    options: [
      {
        id: "full_intervention",
        name: "全面出兵援朝",
        shortEffect: "辽东边军大量消耗，国库与粮食锐减。",
        effects: [
          { factionId: "ming", treasury: -1500000, grain: -900000, warExhaustion: 6, legitimacy: 3 },
          { regionId: "liaodong", garrison: -18000, stability: -6 },
          { setFlag: "korean_war_fought" },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 8 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "eunuch", delta: 5 } }
        ]
      },
      {
        id: "limited_aid",
        name: "有限援助",
        shortEffect: "减少消耗，但辽东防御压力转移。",
        effects: [
          { factionId: "ming", treasury: -400000, grain: -250000, legitimacy: -2 },
          { setFlag: "korean_war_limited" },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -4 } }
        ]
      },
      {
        id: "do_nothing",
        name: "坐视不理",
        shortEffect: "省钱，但朝鲜可能沦陷，合法性大损。",
        effects: [
          { factionId: "ming", legitimacy: -8 },
          { setFlag: "korean_war_ignored" },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -10 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -8 } }
        ]
      }
    ]
  },
  {
    id: "bozhou_campaign",
    name: "播州之役",
    category: "region",
    tier: "steel",
    sourceRefs: ["明史·播州传", "平播全书"],
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
          { setFlag: "three_campaigns_started" },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 4 } }
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
    tier: "steel",
    sourceRefs: ["明史·食货志", "太仓银库考"],
    description: "三大征接连用兵，太仓库银迅速见底，加派赋税的呼声渐起。",
    priority: 86,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1597-01", end: "1601-12" },
      { type: "flag_present", flag: "three_campaigns_started" }
    ],
    options: [
      {
        id: "emergency_tax",
        name: "加派赋税",
        shortEffect: "缓解财政，全国稳定下降。",
        effects: [
          { factionId: "ming", treasury: 500000, legitimacy: -4 },
          { regionId: "beizhili", stability: -4 },
          { regionId: "nanzhili", stability: -4 },
          { regionId: "henan", stability: -4 },
          { setFlag: "three_campaigns_cost_paid" },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: 4 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -8 } }
        ]
      },
      {
        id: "draw_reserves",
        name: "动用内帑与储备",
        shortEffect: "不扰民，但国库见底速度快。",
        effects: [
          { factionId: "ming", treasury: -600000, grain: -300000, legitimacy: 2 },
          { setFlag: "three_campaigns_cost_paid" },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 5 } }
        ]
      }
    ]
  },
  {
    id: "border_army_exhaustion",
    name: "边军疲惫",
    category: "faction",
    tier: "steel",
    sourceRefs: ["明史·兵志", "九边图说"],
    description: "连年征战使九边精锐损耗严重，军队补充困难，辽东防务尤其空虚。",
    priority: 80,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1599-01", end: "1605-12" },
      { type: "flag_present", flag: "three_campaigns_started" }
    ],
    options: [
      {
        id: "rotate_troops",
        name: "轮休边军",
        shortEffect: "恢复战力，短期防御下降。",
        effects: [
          { factionId: "ming", militaryOrganization: 4, warExhaustion: -5, armyTotal: -24000 },
          { regionId: "liaodong", garrison: -12000, stability: -3 },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 5 } }
        ]
      },
      {
        id: "keep_pressure",
        name: "维持高压",
        shortEffect: "保持驻军规模，但疲劳与损耗加剧。",
        effects: [
          { factionId: "ming", warExhaustion: 4, armyTotal: -16000, militaryOrganization: -3 },
          { regionId: "liaodong", garrison: -6000 },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -6 } }
        ]
      }
    ]
  },
  // ═══════════════════════════════════════════════════════════════════
  // 辽东危机 (Liaodong Crisis)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "jianzhou_unification",
    name: "建州整合",
    category: "faction",
    tier: "flexible",
    sourceRefs: ["清太祖实录"],
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
    tier: "flexible",
    sourceRefs: ["清太祖实录", "满洲实录"],
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
          { regionId: "haixi", stability: -5 },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 3 } }
        ]
      },
      {
        id: "ignore_northeast",
        name: "坐视其成",
        shortEffect: "省钱，但建州整合加速。",
        effects: [
          { factionId: "jianzhou", armyTotal: 8000, militaryOrganization: 5, legitimacy: 4 },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -4 } }
        ]
      }
    ]
  },
  {
    id: "saarhu_campaign",
    name: "萨尔浒之战",
    category: "global",
    tier: "steel",
    sourceRefs: ["明史·杨镐传", "清太祖实录", "萨尔浒之战研究"],
    chainId: "liaodong-crisis",
    description: "辽东局势恶化，明军与后金力量在东北形成关键碰撞。",
    priority: 95,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "faction_exists", factionId: "jianzhou" },
      { type: "date_window", start: "1619-01", end: "1619-06" }
    ],
    options: [
      {
        id: "commit_liaodong",
        name: "重兵经略辽东",
        shortEffect: "明朝国库和粮食大耗，辽东控制暂时提高。",
        effects: [
          { factionId: "ming", treasury: -900000, grain: -700000, armyTotal: -45000, warExhaustion: 6 },
          { regionId: "liaodong", control: 12, stability: -4, garrison: 8000 },
          { setFlag: "saarhu_committed" },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 6 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "eunuch", delta: 3 } }
        ]
      },
      {
        id: "preserve_strength",
        name: "保存实力",
        shortEffect: "减少消耗，但辽东控制下降。",
        effects: [
          { factionId: "ming", legitimacy: -4, armyTotal: -12000 },
          { regionId: "liaodong", control: -18, stability: -6 },
          { setFlag: "saarhu_preserved" },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -8 } }
        ]
      }
    ]
  },
  {
    id: "liaoshen_crisis",
    name: "辽沈危机",
    category: "region",
    tier: "flexible",
    sourceRefs: ["明史·辽东传"],
    chainId: "liaodong-crisis",
    description: "辽东与沈阳防御体系摇摇欲坠，朝廷急需选派能臣主持防务。",
    priority: 88,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1620-01", end: "1622-12" },
      { type: "region_controller", regionId: "liaodong", factionId: "ming" }
    ],
    options: [
      {
        id: "send_competent_commander",
        name: "选派能臣",
        shortEffect: "稳定与控制回升，耗费钱粮。",
        effects: [
          { factionId: "ming", treasury: -400000, grain: -300000 },
          { regionId: "liaodong", control: 10, stability: 6, garrison: 10000 },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 6 } }
        ]
      },
      {
        id: "local_defense",
        name: "倚仗当地将门",
        shortEffect: "省钱但控制提升有限，可能养痈。",
        effects: [
          { factionId: "ming", treasury: -120000 },
          { regionId: "liaodong", control: 4, stability: -3, corruption: 2 },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -3 } }
        ]
      }
    ]
  },
  {
    id: "xiong_tingbi_liaodong",
    name: "熊廷弼经略辽东",
    category: "faction",
    tier: "flexible",
    sourceRefs: ["明史·熊廷弼传"],
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
          { regionId: "liaodong", control: 12, stability: 5, garrison: 8000 },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 8 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -5 } }
        ]
      },
      {
        id: "civil_oversight",
        name: "文官监督",
        shortEffect: "防止将门坐大，但效率降低。",
        effects: [
          { factionId: "ming", treasury: -180000, administration: -2 },
          { regionId: "liaodong", control: 4, stability: -2 },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 5 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -4 } }
        ]
      }
    ]
  },
  // ═══════════════════════════════════════════════════════════════════
  // 秩序松动 (Order Erosion)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "mineral_tax_disaster",
    name: "矿税之祸",
    category: "faction",
    tier: "flexible",
    sourceRefs: ["明史·食货志", "明史·宦官传"],
    description: "朝廷派出矿监税使搜刮民间，商业繁荣地区首当其冲，民怨沸腾。",
    priority: 78,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1596-01", end: "1606-12" },
      { type: "flag_absent", flag: "mineral_tax_ended" },
      { type: "faction_treasury_below", factionId: "ming", value: 3000000 }
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
          { setFlag: "mineral_tax_ended" },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: -6 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 8 } }
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
          { regionId: "zhejiang", stability: -6, rebelPressure: 8 },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: 6 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -8 } }
        ]
      }
    ]
  },
  {
    id: "donglin_dispute",
    name: "东林党争",
    category: "faction",
    tier: "flexible",
    sourceRefs: ["明史·顾宪成传", "东林列传"],
    chainId: "court-faction-war",
    description: "朝中党争日趋激烈，政策摇摆不定，行政效率与合法性都受到侵蚀。",
    priority: 80,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1604-01", end: "1627-12" }
    ],
    options: [
      {
        id: "mediate_factions",
        name: "居中调停",
        shortEffect: "行政与稳定小幅恢复，但党争根源未除。",
        effects: [
          { factionId: "ming", administration: 3, legitimacy: 2, corruption: 1 },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 4 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "eunuch", delta: -2 } }
        ]
      },
      {
        id: "purge_donglin",
        name: "压制东林",
        shortEffect: "短期政局稳定，长期人才流失。",
        effects: [
          { factionId: "ming", administration: -4, legitimacy: -3, corruption: 4 },
          { regionId: "nanzhili", stability: -5 },
          { factionId: "ming", cliqueSupport: { cliqueId: "donglin", delta: -10 } },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: 6 } }
        ]
      }
    ]
  },
  {
    id: "eunuch_wei_rise",
    name: "魏忠贤掌权",
    category: "faction",
    tier: "flexible",
    sourceRefs: ["明史·魏忠贤传", "明史·宦官传"],
    chainId: "court-faction-war",
    description: "宦官魏忠贤逐渐掌握大权，厂卫横行，官僚体系腐败加剧。",
    priority: 82,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1620-01", end: "1627-12" }
    ],
    options: [
      {
        id: "restrain_eunuchs",
        name: "约束宦官",
        shortEffect: "腐败受抑，但宫廷不稳。",
        effects: [
          { factionId: "ming", corruption: -6, administration: 2, legitimacy: -2 },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: -8 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 8 } }
        ]
      },
      {
        id: "use_eunuchs",
        name: "借其制衡文官",
        shortEffect: "行政执行力提高，腐败与离心加剧。",
        effects: [
          { factionId: "ming", corruption: 8, administration: 3, legitimacy: -4 },
          { regionId: "beizhili", stability: -3 },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: 10 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -10 } }
        ]
      },
      {
        id: "cultivate_proxy",
        name: "培植为皇权代理人",
        shortEffect: "皇权扩张，但宦官尾大不掉。",
        effects: [
          { factionId: "ming", corruption: 5, centralization: 4, legitimacy: -2 },
          { factionId: "ming", cliqueSupport: { cliqueId: "imperial", delta: 8 } },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: 12 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -12 } }
        ]
      }
    ]
  },
  // ═══════════════════════════════════════════════════════════════════
  // 明末危机征兆 (Late Ming Crisis Signs)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "shaanxi_drought",
    name: "陕西大旱",
    category: "region",
    tier: "flexible",
    sourceRefs: ["明史·五行志", "陕西通志"],
    description: "陕西连年干旱，粮食绝收，流民开始聚集，如果不赈济，叛乱风险将迅速上升。",
    priority: 86,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1627-01", end: "1632-12" },
      { type: "region_controller", regionId: "shaanxi", factionId: "ming" }
    ],
    options: [
      {
        id: "large_relief",
        name: "开仓赈济",
        shortEffect: "消耗大量粮食，稳定与人口得以保全。",
        effects: [
          { factionId: "ming", grain: -500000, treasury: -200000, legitimacy: 2 },
          { regionId: "shaanxi", stability: 8, rebelPressure: -12, grainStock: 200000 },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: 5 } }
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
          { regionId: "shaanxi", stability: -10, rebelPressure: 25, population: -120000 }
        ]
      },
      {
        id: "work_for_relief",
        name: "以工代赈",
        shortEffect: "修建水利换取稳定，中期效果较好。",
        effects: [
          { factionId: "ming", grain: -300000, treasury: -350000 },
          { regionId: "shaanxi", stability: 5, rebelPressure: -6, grainStock: 100000 },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: 4 } }
        ]
      }
    ]
  },
  {
    id: "tianqi_political_crisis",
    name: "天启政治危机",
    category: "faction",
    tier: "flexible",
    sourceRefs: ["明史·熹宗本纪", "明史·宦官传"],
    description: "天启年间君权旁落，党争与宦官势力交织，朝廷行政能力进一步下滑。",
    priority: 80,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1620-01", end: "1627-12" }
    ],
    options: [
      {
        id: "reform_court",
        name: "整顿朝纲",
        shortEffect: "行政与合法性回升，但触动既得利益。",
        effects: [
          { factionId: "ming", administration: 5, legitimacy: 3, corruption: -3, centralization: 4 },
          { factionId: "ming", cliqueSupport: { cliqueId: "imperial", delta: 6 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "eunuch", delta: -6 } }
        ]
      },
      {
        id: "maintain_status_quo",
        name: "维持现状",
        shortEffect: "避免冲突，但腐败与低效继续恶化。",
        effects: [
          { factionId: "ming", corruption: 4, administration: -3, legitimacy: -2 },
          { factionId: "ming", cliqueApproval: { cliqueId: "imperial", delta: -5 } }
        ]
      }
    ]
  },
  // ═══════════════════════════════════════════════════════════════════
  // Phase 3 新增钢事件 (New Steel Events)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "jisi_incident",
    name: "己巳之变",
    category: "global",
    tier: "steel",
    sourceRefs: ["明史·庄烈帝本纪", "明史·袁崇焕传", "清太宗实录"],
    chainId: "liaodong-crisis",
    description: "后金绕道蒙古，突破长城防线直逼京师，己巳之变震动朝野。",
    priority: 93,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "faction_exists", factionId: "jianzhou" },
      { type: "date_window", start: "1629-10", end: "1630-03" },
      { type: "at_war_with", factionA: "ming", factionB: "jianzhou" },
      { type: "faction_army_above", factionId: "jianzhou", value: 120000 }
    ],
    options: [
      {
        id: "defend_city",
        name: "启用袁崇焕守城",
        shortEffect: "京师防御加强，但边军调动仓促。",
        effects: [
          { factionId: "ming", treasury: -300000, warExhaustion: 4 },
          { regionId: "beizhili", control: 8, stability: -6, garrison: 15000 },
          { setFlag: "jisi_defended" },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 6 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "imperial", delta: 3 } }
        ]
      },
      {
        id: "recall_border_troops",
        name: "调辽东边军回援",
        shortEffect: "京师解围但辽东防务空虚。",
        effects: [
          { factionId: "ming", treasury: -200000, warExhaustion: 5 },
          { regionId: "beizhili", control: 6, stability: -4, garrison: 20000 },
          { regionId: "liaodong", control: -12, garrison: -18000, stability: -5 },
          { setFlag: "jisi_recalled" },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -6 } }
        ]
      },
      {
        id: "scorched_earth",
        name: "坚守不出坚壁清野",
        shortEffect: "保存京师，但京畿民生凋敝。",
        effects: [
          { factionId: "ming", warExhaustion: 3, legitimacy: -4 },
          { regionId: "beizhili", stability: -12, population: -80000, rebelPressure: 8 },
          { setFlag: "jisi_scorched" },
          { factionId: "ming", cliqueApproval: { cliqueId: "imperial", delta: -5 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -4 } }
        ]
      }
    ]
  },
  {
    id: "liaoxiang_surcharge",
    name: "辽饷加派",
    category: "faction",
    tier: "steel",
    sourceRefs: ["明史·食货志", "辽饷考"],
    chainId: "fiscal-reform-crisis",
    description: "辽东战事消耗巨大，朝廷面临是否加征辽饷的艰难抉择。",
    priority: 87,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "faction_exists", factionId: "jianzhou" },
      { type: "date_window", start: "1618-01", end: "1620-12" },
      { type: "faction_treasury_below", factionId: "ming", value: 3000000 }
    ],
    options: [
      {
        id: "full_surcharge",
        name: "全额加派",
        shortEffect: "国库增收，全国稳定下降，民怨沸腾。",
        effects: [
          { factionId: "ming", treasury: 600000, legitimacy: -6 },
          { regionId: "beizhili", stability: -4, rebelPressure: 6 },
          { regionId: "henan", stability: -5, rebelPressure: 6 },
          { regionId: "shandong", stability: -4, rebelPressure: 5 },
          { setFlag: "liaoxiang_full" },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: 5 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -12 } },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 3 } }
        ]
      },
      {
        id: "partial_surcharge",
        name: "部分加派",
        shortEffect: "增收有限，辽东军需不足。",
        effects: [
          { factionId: "ming", treasury: 300000, legitimacy: -2 },
          { regionId: "beizhili", stability: -2, rebelPressure: 3 },
          { setFlag: "liaoxiang_partial" },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: 2 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -4 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -6 } }
        ]
      },
      {
        id: "use_privy_funds",
        name: "动用内帑",
        shortEffect: "不动民间，但皇帝私库大减。",
        effects: [
          { factionId: "ming", treasury: 250000, legitimacy: 3 },
          { setFlag: "liaoxiang_privy" },
          { factionId: "ming", cliqueSupport: { cliqueId: "imperial", delta: -8 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 5 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: 3 } }
        ]
      }
    ]
  },
  {
    id: "jiashen_catastrophe",
    name: "甲申国难",
    category: "global",
    tier: "steel",
    sourceRefs: ["明史·庄烈帝本纪", "甲申传信录", "明季北略"],
    description: "流寇逼近京师，大明江山摇摇欲坠。是死守、南迁还是议和？这是最后的抉择。",
    priority: 99,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1643-01", end: "1644-12" },
      { type: "faction_region_count_max", factionId: "ming", maxCount: 10 },
      { type: "faction_army_above", factionId: "rebels", value: 150000 },
      { type: "region_control_below", regionId: "beizhili", value: 30 }
    ],
    options: [
      {
        id: "defend_capital",
        name: "死守京师",
        shortEffect: "背水一战，成败在天。",
        effects: [
          { factionId: "ming", warExhaustion: 10, legitimacy: 5 },
          { regionId: "beizhili", control: 10, stability: -15, garrison: 20000 },
          { setFlag: "jiashen_defended" },
          { factionId: "ming", cliqueSupport: { cliqueId: "imperial", delta: 10 } },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 8 } }
        ]
      },
      {
        id: "flee_south",
        name: "南迁南京",
        shortEffect: "保存朝廷，但北方尽失。",
        effects: [
          { factionId: "ming", legitimacy: -10, administration: -8 },
          { regionId: "beizhili", control: -30, stability: -20 },
          { regionId: "nanzhili", control: 10, stability: 5 },
          { setFlag: "jiashen_fled_south" },
          { factionId: "ming", cliqueApproval: { cliqueId: "imperial", delta: -15 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -12 } }
        ]
      },
      {
        id: "negotiate_peace",
        name: "议和",
        shortEffect: "终局事件——以割地赔款换取暂时存续。",
        effects: [
          { factionId: "ming", legitimacy: -15, treasury: -500000 },
          { setFlag: "jiashen_negotiated" },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -15 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "imperial", delta: -10 } }
        ]
      }
    ]
  },
  {
    id: "tiaoobian_controversy",
    name: "一条鞭法争议",
    category: "faction",
    tier: "steel",
    sourceRefs: ["明史·食货志", "梁方仲《明代一条鞭法年表》"],
    chainId: "fiscal-reform-crisis",
    description: "一条鞭法全国化引发激烈争议，银征依赖加深，地方经济薄弱地区苦不堪言。",
    priority: 77,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1577-01", end: "1580-12" },
      { type: "flag_absent", flag: "yitiaobian_done" },
      { type: "faction_administration_above", factionId: "ming", value: 60 }
    ],
    options: [
      {
        id: "force_nationwide",
        name: "强力推动全国化",
        shortEffect: "改革加速，但地方反弹剧烈。",
        effects: [
          { factionId: "ming", administration: 6, legitimacy: -4 },
          { regionId: "sichuan", stability: -6, rebelPressure: 5 },
          { regionId: "guizhou", stability: -5, rebelPressure: 4 },
          { regionId: "yunnan", stability: -4, rebelPressure: 3 },
          { setFlag: "yitiaobian_done" },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: 12 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -8 } }
        ]
      },
      {
        id: "gradual_pilot",
        name: "渐进试点",
        shortEffect: "稳步推进，改革效果延缓。",
        effects: [
          { factionId: "ming", administration: 3, legitimacy: 1 },
          { setFlag: "yitiaobian_done" },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: 5 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 3 } }
        ]
      },
      {
        id: "suspend_reform",
        name: "暂缓",
        shortEffect: "避免冲突，但改革停滞。",
        effects: [
          { factionId: "ming", administration: -2 },
          { setFlag: "yitiaobian_done" },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: -8 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: -12 } }
        ]
      }
    ]
  },
  {
    id: "wei_zhongxian_purge",
    name: "魏忠贤诏狱",
    category: "faction",
    tier: "steel",
    sourceRefs: ["明史·魏忠贤传", "明史·阉党传", "东林列传"],
    chainId: "court-faction-war",
    description: "魏忠贤大肆迫害东林党人，诏狱遍地，朝中人人自危。",
    priority: 89,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1625-01", end: "1627-12" }
    ],
    options: [
      {
        id: "support_purge",
        name: "支持诏狱",
        shortEffect: "阉党得势，东林遭受清洗。",
        effects: [
          { factionId: "ming", corruption: 6, administration: -4, legitimacy: -3 },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: 12 } },
          { factionId: "ming", cliqueSupport: { cliqueId: "donglin", delta: -15 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -20 } }
        ]
      },
      {
        id: "stop_persecution",
        name: "制止迫害",
        shortEffect: "保护东林，但宦官势力反弹。",
        effects: [
          { factionId: "ming", corruption: -3, administration: 3, legitimacy: 2 },
          { factionId: "ming", cliqueSupport: { cliqueId: "eunuch", delta: -10 } },
          { factionId: "ming", cliqueSupport: { cliqueId: "donglin", delta: 10 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: 12 } }
        ]
      },
      {
        id: "play_both_sides",
        name: "利用两边制衡",
        shortEffect: "皇权渔利，但朝政更加混乱。",
        effects: [
          { factionId: "ming", corruption: 3, centralization: 3, administration: -2 },
          { factionId: "ming", cliqueSupport: { cliqueId: "imperial", delta: 6 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "eunuch", delta: -3 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -5 } }
        ]
      }
    ]
  },
  {
    id: "yuan_chonghuan_execution",
    name: "袁崇焕之死",
    category: "faction",
    tier: "steel",
    sourceRefs: ["明史·袁崇焕传", "明季北略"],
    chainId: "liaodong-crisis",
    description: "己巳之变后，袁崇焕被指控通敌，崇祯帝面临处置边将的艰难抉择。",
    priority: 88,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1629-01", end: "1630-12" },
      { type: "flag_present", flag: "event:jisi_incident" }
    ],
    options: [
      {
        id: "execute_yuan",
        name: "处死袁崇焕",
        shortEffect: "朝野震动，边防将领寒心。",
        effects: [
          { factionId: "ming", legitimacy: -4, militaryOrganization: -5 },
          { regionId: "liaodong", control: -8, stability: -6, garrison: -5000 },
          { setFlag: "yuan_executed" },
          { factionId: "ming", cliqueSupport: { cliqueId: "imperial", delta: 3 } },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: -15 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -18 } }
        ]
      },
      {
        id: "keep_yuan",
        name: "留用戴罪立功",
        shortEffect: "边将感念，辽东防务得以维持。",
        effects: [
          { factionId: "ming", legitimacy: -2 },
          { regionId: "liaodong", control: 5, stability: 3, garrison: 3000 },
          { setFlag: "yuan_kept" },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 8 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "imperial", delta: -3 } }
        ]
      },
      {
        id: "exile_yuan",
        name: "贬谪外放",
        shortEffect: "折中处置，两边都不太满意。",
        effects: [
          { factionId: "ming", legitimacy: -1, militaryOrganization: -2 },
          { regionId: "liaodong", control: -3, stability: -2 },
          { setFlag: "yuan_exiled" },
          { factionId: "ming", cliqueApproval: { cliqueId: "frontier", delta: -6 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "imperial", delta: -2 } }
        ]
      }
    ]
  },
  // ═══════════════════════════════════════════════════════════════════
  // Phase 3 新增柔事件 (New Flexible Events)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "shaanxi_chain_drought",
    name: "陕西旱荒—欠饷—民变",
    category: "region",
    tier: "flexible",
    sourceRefs: ["明史·五行志", "明史·流贼传", "陕西通志"],
    chainId: "fiscal-reform-crisis",
    description: "陕西连年大旱叠加欠饷，饥民与溃兵合流，民变一触即发。这是旱荒—饥荒—叛乱的链式触发。",
    priority: 91,
    conditions: [
      { type: "faction_exists", factionId: "ming" },
      { type: "date_window", start: "1628-01", end: "1633-12" },
      { type: "region_controller", regionId: "shaanxi", factionId: "ming" },
      { type: "region_stability_below", regionId: "shaanxi", value: 40 }
    ],
    options: [
      {
        id: "massive_relief_and_pay",
        name: "大规模赈济并补发军饷",
        shortEffect: "消耗巨额钱粮，但可遏制民变。",
        effects: [
          { factionId: "ming", treasury: -600000, grain: -800000 },
          { regionId: "shaanxi", stability: 12, rebelPressure: -18, grainStock: 300000, garrison: 5000 },
          { setFlag: "shaanxi_chain_broken" },
          { factionId: "ming", cliqueSupport: { cliqueId: "reform", delta: 6 } },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 4 } }
        ]
      },
      {
        id: "military_crackdown",
        name: "以军镇压",
        shortEffect: "暂时压制，但民怨更深。",
        effects: [
          { factionId: "ming", treasury: -200000, warExhaustion: 3 },
          { regionId: "shaanxi", stability: -5, rebelPressure: 12, population: -80000, garrison: -3000 },
          { setFlag: "shaanxi_chain_crackdown" },
          { factionId: "ming", cliqueSupport: { cliqueId: "frontier", delta: 4 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: -6 } }
        ]
      },
      {
        id: "minimal_response",
        name: "敷衍应对",
        shortEffect: "省钱，但叛乱压力暴涨。",
        effects: [
          { factionId: "ming", legitimacy: -5 },
          { regionId: "shaanxi", stability: -15, rebelPressure: 30, population: -150000 },
          { setFlag: "shaanxi_chain_erupted" },
          { factionId: "ming", cliqueApproval: { cliqueId: "reform", delta: -8 } },
          { factionId: "ming", cliqueApproval: { cliqueId: "donglin", delta: -6 } }
        ]
      }
    ]
  }
];
