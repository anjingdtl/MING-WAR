import type { GameState, SituationDef } from "../core/types";

/**
 * S6b: 1573–1662 主线历史局势。
 *
 * 每个局势由 S1–S5 的系统状态触发与推进（腐败/军力/战争/控制区/叛乱），
 * outcomes 在达成时施加效果（mutate faction 字段或写 S1 modifier）。确定性，
 * 不消费 random。局势把孤立事件升级为系统驱动的长期叙事。
 */

function controlledCount(state: GameState, factionId: string): number {
  let n = 0;
  for (const r of Object.values(state.regions)) {
    if (r.controllerFactionId === factionId) n++;
  }
  return n;
}

function hasWarBetween(state: GameState, a: string, b: string): boolean {
  return state.wars.some(
    (w) =>
      (w.attackerFactionId === a && w.defenderFactionId === b) ||
      (w.attackerFactionId === b && w.defenderFactionId === a),
  );
}

export const situationLibrary: SituationDef[] = [
  {
    id: "zhangjuzheng-reform",
    name: "张居正改革",
    description: "大明积弊日深，首辅张居正推行考成法、清丈田亩、一条鞭法，重振朝纲。",
    factionId: "ming",
    trigger: (st) => st.factions.ming?.status === "active" && st.factions.ming.corruption >= 30,
    advance: (sit, st) => {
      const ming = st.factions.ming;
      // 行政高推进快；战争拖延（高战疲）减速
      const speed = 2 + ming.administration * 0.08 - ming.warExhaustion * 0.05;
      return { progress: Math.max(0, Math.min(100, sit.progress + speed)) };
    },
    outcomes: [
      {
        id: "consolidated",
        label: "改革巩固：吏治澄清，国库充盈，大明一时中兴。",
        test: (sit) => sit.progress >= 100,
        effect: (st) => {
          const ming = st.factions.ming;
          ming.corruption = Math.max(0, ming.corruption - 15);
          ming.legitimacy = Math.min(100, ming.legitimacy + 8);
          st.activeModifiers.push({
            id: "zhangjuzheng-reform-consolidated",
            label: "张居正改革成效",
            scope: "faction",
            targetId: "ming",
            effects: { "tax-mult": 0.08 },
          });
        },
      },
      {
        id: "stalled",
        label: "改革遭既得利益强力阻击，人亡政息。",
        test: (_sit, st) => st.factions.ming.legitimacy < 35 || st.factions.ming.warExhaustion > 75,
        effect: (st) => {
          st.factions.ming.legitimacy = Math.max(0, st.factions.ming.legitimacy - 8);
        },
      },
    ],
  },
  {
    id: "jianzhou-unification",
    name: "建州统一女真",
    description: "努尔哈赤整合女真诸部，建立八旗，崛起于白山黑水。",
    factionId: "jianzhou",
    trigger: (st) => st.factions.jianzhou?.status === "active" && st.factions.jianzhou.armyTotal >= 40000,
    advance: (sit, st) => {
      const jz = st.factions.jianzhou;
      const regions = controlledCount(st, "jianzhou");
      const speed = 1.5 + regions * 0.8 + jz.militaryOrganization * 0.05;
      return { progress: Math.max(0, Math.min(100, sit.progress + speed)), variables: { regions } };
    },
    outcomes: [
      {
        id: "unified",
        label: "女真一统，八旗成军，建州成为大明辽东心腹大患。",
        test: (sit) => sit.progress >= 100,
        effect: (st) => {
          const jz = st.factions.jianzhou;
          jz.militaryOrganization = Math.min(100, jz.militaryOrganization + 25);
          jz.armyTotal += 60000;
          st.activeModifiers.push({
            id: "jianzhou-eight-banners",
            label: "八旗军制",
            scope: "faction",
            targetId: "jianzhou",
            effects: { "army-org-mult": 0.2 },
          });
        },
      },
    ],
  },
  {
    id: "imjin-war",
    name: "壬辰倭乱",
    description: "日本丰臣政权发兵侵朝鲜，大明援朝抗倭，七年兵燹。",
    factionId: "japan",
    trigger: (st) => st.factions.japan?.status === "active" && st.factions.japan.armyTotal >= 80000,
    advance: (sit, st) => {
      const atWar = hasWarBetween(st, "japan", "joseon") || hasWarBetween(st, "japan", "ming");
      const speed = atWar ? 4 : 1.5;
      return { progress: Math.max(0, Math.min(100, sit.progress + speed)) };
    },
    outcomes: [
      {
        id: "resolved",
        label: "倭乱平定，日本撤军，朝鲜残破，大明国力亦大损。",
        test: (sit) => sit.progress >= 100,
        effect: (st) => {
          const joseon = st.factions.joseon;
          if (joseon) {
            joseon.treasury = Math.max(0, Math.round(joseon.treasury * 0.7));
            joseon.warExhaustion = Math.max(0, joseon.warExhaustion - 20);
          }
        },
      },
    ],
  },
  {
    id: "liaodong-crisis",
    name: "辽东危机",
    description: "建州崛起后频频犯辽，大明辽东军费剧增，财政与战疲吃紧。",
    factionId: "ming",
    trigger: (st) =>
      hasWarBetween(st, "ming", "jianzhou") ||
      (st.factions.jianzhou?.status === "active" && st.factions.jianzhou.armyTotal >= 90000),
    advance: (sit, st) => {
      const ming = st.factions.ming;
      const jz = st.factions.jianzhou;
      // 建州威胁规模 + 大明财政紧张/战疲 → 危机推进
      const threat = (jz?.armyTotal ?? 0) / 50000;
      const fiscalPressure = Math.max(0, 50 - ming.treasury / 200000) * 0.1;
      const speed = threat + fiscalPressure + ming.warExhaustion * 0.4;
      return { progress: Math.max(0, Math.min(100, sit.progress + speed)) };
    },
    outcomes: [
      {
        id: "liaodong-lost",
        label: "辽东沦陷，大明丧失东北屏障，国势急转直下。",
        test: (sit) => sit.progress >= 100,
        effect: (st) => {
          st.factions.ming.legitimacy = Math.max(0, st.factions.ming.legitimacy - 15);
          st.factions.ming.warExhaustion = Math.min(100, st.factions.ming.warExhaustion + 10);
        },
      },
    ],
  },
  {
    id: "shaanxi-refugees",
    name: "陕西流民起义",
    description: "连年饥荒与苛税逼迫陕北流民揭竿，农民军席卷北方。",
    factionId: "ming",
    trigger: (st) => {
      const north = ["shaanxi", "shanxi", "henan"];
      const pressure = north.reduce((s, id) => s + (st.regions[id]?.rebelPressure ?? 0), 0);
      return pressure >= 180 || (st.factions.rebels?.armyTotal ?? 0) >= 100000;
    },
    advance: (sit, st) => {
      const rebels = st.factions.rebels;
      const speed = 2 + (rebels?.armyTotal ?? 0) / 50000;
      return { progress: Math.max(0, Math.min(100, sit.progress + speed)) };
    },
    outcomes: [
      {
        id: "rebellion-spreads",
        label: "流民军成气候，大明北方统治瓦解，天下大乱。",
        test: (sit) => sit.progress >= 100,
        effect: (st) => {
          st.factions.ming.legitimacy = Math.max(0, st.factions.ming.legitimacy - 12);
          st.factions.ming.centralization = Math.max(0, st.factions.ming.centralization - 10);
        },
      },
    ],
  },
  {
    id: "southern-ming",
    name: "南明偏安",
    description: "大明丧失北方核心，朝廷南渡，偏安江南。",
    factionId: "ming",
    trigger: (st) => {
      const mingRegions = controlledCount(st, "ming");
      return st.factions.ming?.status === "active" && mingRegions <= 15;
    },
    advance: (sit, st) => {
      const mingRegions = controlledCount(st, "ming");
      const speed = mingRegions <= 8 ? 5 : 2;
      return { progress: Math.max(0, Math.min(100, sit.progress + speed)) };
    },
    outcomes: [
      {
        id: "southern-ming-established",
        label: "南明建立，偏安江南，大明名存实亡，苟延残喘。",
        test: (sit) => sit.progress >= 100,
        effect: (st) => {
          st.factions.ming.legitimacy = Math.max(0, st.factions.ming.legitimacy - 20);
        },
      },
    ],
  },
];
