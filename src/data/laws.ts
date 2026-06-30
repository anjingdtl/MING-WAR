import type { LawDef, LawId } from "../core/types";

/**
 * S4: 法律库（SPEC §11 六大类：税制/土地/军制/海贸/地方治理/财政权力）。
 *
 * 每条法律的 `tags` 与利益集团 CliqueDef.preferredLaws/opposedLaws 的语义标签
 * 对接——这正是 SPEC §9.5 点名的"S4 法律系统对接真实 LawId"，把 S3 里空挂
 * 的标签真正通电：集团的偏好/反对 now 驱动具体法律的博弈。
 *
 * effects 落实（enactLaw）时分流：
 *   - modifier-effect keys → 永久 faction-scope modifier（月度查询生效）
 *   - instant-effect keys（centralization-flat/legitimacy-flat）→ 一次性施加
 *
 * 博弈图景（支持/反对集团，由 tags 与 clique 标签求交得出）：
 *   donglin : preferred[low-tax,clean-admin,relief-priority] opposed[mining-tax,commercial-tax,land-survey]
 *   eunuch  : preferred[mining-tax,commercial-tax,treasury-centralization] opposed[low-tax,local-autonomy]
 *   reform  : preferred[land-survey,commercial-tax,treasury-centralization] opposed[low-tax,local-autonomy]
 *   frontier: preferred[military-funding,frontier-autonomy] opposed[civilian-control,austerity]
 */
export const lawLibrary: Record<LawId, LawDef> = {
  // ── 税制 ──────────────────────────────────────────────────────────────
  "low-tax": {
    id: "low-tax",
    name: "轻徭薄赋",
    category: "tax",
    description: "减免田赋徭役，与民休息。士绅百姓拥护，但朝廷财源收紧。",
    tags: ["low-tax"],
    effects: { "tax-mult": -0.15 },
  },
  "mining-tax": {
    id: "mining-tax",
    name: "矿税商税",
    category: "tax",
    description: "派遣矿监税使四处开征，内帑充盈却激起民怨、滋生中饱私囊。",
    tags: ["mining-tax"],
    // 万历矿税之弊：财源扩张伴随严重腐败与民变。
    effects: { "tax-mult": 0.2, "corruption-flat": 3 },
  },
  "commercial-tax": {
    id: "commercial-tax",
    name: "征收商税",
    category: "tax",
    description: "对城市工商业加征税课，充实国库，但触犯士绅商贾利益。",
    tags: ["commercial-tax"],
    effects: { "tax-mult": 0.15 },
  },

  // ── 土地 ──────────────────────────────────────────────────────────────
  "land-survey": {
    id: "land-survey",
    name: "清丈田亩",
    category: "land",
    description:
      "重新丈量全国田亩、清查隐田，税基扩张、中央集权强化，但遭隐田士绅死命抵制。",
    tags: ["land-survey"],
    // 张居正清丈：donglin 反对、reform 支持（首辅改革推动清丈）。
    effects: { "tax-mult": 0.15, "centralization-flat": 8, "corruption-flat": -2 },
  },

  // ── 军制 ──────────────────────────────────────────────────────────────
  "military-funding": {
    id: "military-funding",
    name: "加派军饷",
    category: "military",
    description: "向边镇倾斜军费、扩充军备，勋贵拥护，但加重财政与百姓负担。",
    tags: ["military-funding"],
    effects: { "maintenance-mult": 0.2, "army-org-mult": 0.1 },
  },
  "civilian-control": {
    id: "civilian-control",
    name: "文官节制武将",
    category: "military",
    description: "以文制武、整顿军纪，强化中央控制，但削弱勋贵军事自主。",
    tags: ["civilian-control"],
    effects: { "army-org-mult": -0.05, "corruption-flat": -2, "control-flat": 2 },
  },

  // ── 海贸 ──────────────────────────────────────────────────────────────
  "open-sea": {
    id: "open-sea",
    name: "弛海禁开海",
    category: "maritime",
    description: "放松海禁、开通洋贸，关税与沿海繁荣俱增。对接宦党开海诉求。",
    tags: ["open-sea"],
    // 中立法律（无集团强烈偏好），落实靠行政力；语义延续 S3c 宦党 open-sea 诉求。
    effects: { "tax-mult": 0.08, "stability-flat": 1 },
  },

  // ── 地方治理 ──────────────────────────────────────────────────────────
  "local-autonomy": {
    id: "local-autonomy",
    name: "地方自治",
    category: "governance",
    description: "下放权力、允许乡绅自理，换取低税与低军费，但削弱中央控制。",
    tags: ["local-autonomy"],
    effects: { "control-flat": -3, "tax-mult": -0.08, "maintenance-mult": -0.05 },
  },
  "clean-admin": {
    id: "clean-admin",
    name: "澄清吏治",
    category: "governance",
    description: "整肃贪腐、考核官吏，清廉提升、地方安定，东林清流拥护。",
    tags: ["clean-admin"],
    effects: { "corruption-flat": -4, "stability-flat": 2 },
  },

  // ── 财政权力 ──────────────────────────────────────────────────────────
  "treasury-centralization": {
    id: "treasury-centralization",
    name: "财权归中央",
    category: "fiscal",
    description: "收缴地方财权、统一国库调度，集权强化、贪腐收敛，宦党拥护。",
    tags: ["treasury-centralization"],
    effects: { "centralization-flat": 6, "corruption-flat": -2 },
  },
};

/**
 * S4: modifier-effect keys —— 落实时写入永久 faction-scope modifier，由各计算点
 * 月度查询生效（均为乘数或持续效果）。这些 key 均已在 S1a/S1b 接入计算点：
 *   tax-mult/grain-output-mult(economy) maintenance-mult(economy)
 *   control-flat(control) army-org-mult(warfare)
 */
export const LAW_MODIFIER_EFFECT_KEYS = new Set([
  "tax-mult",
  "grain-output-mult",
  "maintenance-mult",
  "control-flat",
  "army-org-mult",
]);

/**
 * S4: faction 级一次性施加 —— 这些存量 stat（corruption/centralization/
 * legitimacy）无月度重算点，走永久 modifier 会每月累加至极值（反腐改革几月内
 * 把 corruption 压到 0），故落实瞬间一次性施加、钳到 [0,100]。
 *
 * 注：corruption-flat/stability-flat 在 modifiers.ts 注释里被标为"接 control.ts"，
 * 但 S1b 实际未接入（control.ts 只接 control-flat）。S4 把它们归入 instant，
 * 绕开缺失的月度查询点，仍保证"落实真实生效"。
 */
export const LAW_FACTION_INSTANT_KEYS: Record<string, keyof {
  centralization: number;
  legitimacy: number;
  corruption: number;
}> = {
  "centralization-flat": "centralization",
  "legitimacy-flat": "legitimacy",
  "corruption-flat": "corruption",
};

/** S4: region 级一次性施加 —— 落实时遍历该 faction 控制的所有 region 施加。 */
export const LAW_REGION_INSTANT_KEYS = new Set(["stability-flat"]);

/** 落实法律后写入的永久 modifier 的稳定 id（兼作"已落实"去重 key）。 */
export function lawModifierId(factionId: string, lawId: LawId): string {
  return `law-${factionId}-${lawId}`;
}

/** 该 faction 是否已落实某法律（按永久 modifier 存在性判定）。 */
export function isLawEnacted(activeModifiers: { id: string }[], factionId: string, lawId: LawId): boolean {
  return activeModifiers.some((m) => m.id === lawModifierId(factionId, lawId));
}
