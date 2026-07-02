/**
 * exportTuningTable.ts — T15 输出 tuning-military.xlsx 调参表
 *
 * 把分散在 src/core/{warfare,supply,siege,exhaustion,economy,decisions,ai,
 * movement,season,occupation}.ts 的 [PLACEHOLDER] 调参常量汇总到 5 sheet 的
 * xlsx。供 designer 调参时集中参考 + 大版本回归时随版本提交。
 *
 * Sheet 设计：
 *   1. Combat       — 持久战公式钳位（warfare.ts）
 *   2. Supply       — 粮秣 / 仓储 / 运输（supply.ts）
 *   3. Siege        — 围城 / 工事 / 战利品（siege.ts）
 *   4. Exhaustion   — 战争疲劳 / 厌战（exhaustion.ts）
 *   5. Economy      — 税收 / 军费 / 占地（economy.ts / occupation.ts）
 *
 * 每个 sheet 列：
 *   常量名 | 当前值 | 类型 | SPEC 章节 | 调参建议 | 备注
 *
 * ⚠️  本表为 design-time 调参手册；调参完成后需同步 src/core/* 实际常量值。
 *
 * 用法：npx tsx src/scripts/exportTuningTable.ts
 */

import * as XLSX from "xlsx";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/* ===========================================================================
 * 表结构类型
 * =========================================================================== */

interface TuningRow {
  constant: string;
  value: string | number | boolean;
  type: "number" | "string" | "boolean";
  spec: string; // SPEC 章节号
  baseline?: string; // [PLACEHOLDER] baseline（设计假设）
  tuning: string; // 调参建议
  note?: string;
}

interface TuningSheet {
  name: string;
  module: string; // 模块路径
  specRef: string; // SPEC 文件
  rows: TuningRow[];
}

/* ===========================================================================
 * 5 个 sheet 数据
 * =========================================================================== */

const SHEETS: TuningSheet[] = [
  {
    name: "Combat",
    module: "src/core/warfare.ts",
    specRef: "docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md §4.3",
    rows: [
      {
        constant: "BASE_ADVANCE",
        value: 1.5,
        type: "number",
        spec: "§4.3 advanceWar",
        baseline: "约 1-2 月推进 1 步基准",
        tuning: "↑ → 大明攻势更猛；↓ → 持久战更长",
        note: "v0.8 PLACEHOLDER；待 diagnoseWars 验证",
      },
      {
        constant: "POWER_COEFF",
        value: 2.5,
        type: "number",
        spec: "§4.3 powerAdv",
        baseline: "ratio=2 → +2.5/月 优势力量可控",
        tuning: "↑ → 高兵力比更主导；↓ → 客场/驻军权重上升",
        note: "",
      },
      {
        constant: "DEFENSE_FLOOR",
        value: 0.6,
        type: "number",
        spec: "§4.3 FLOOR",
        baseline: "弱势守方仍有 0.6/月最低抵抗",
        tuning: "↑ → 守方更顽强；↓ → 持久战更短",
        note: "",
      },
      {
        constant: "DISTANCE_PEN",
        value: 0.3,
        type: "number",
        spec: "§4.3 DIST_PEN",
        baseline: "每增 1 距离 -0.3/月",
        tuning: "↑ → 远征惩罚更严；↓ → 距离钝化",
        note: "v0.8 M2",
      },
      {
        constant: "GARRISON_DRAG",
        value: 0.5,
        type: "number",
        spec: "§4.3 GARRISON_DRAG",
        baseline: "30k 驻军可消 0.5/月 progress",
        tuning: "↑ → 驻军防守更显著；↓ → 驻军权重降",
        note: "",
      },
      {
        constant: "CAPTURE_GARRISON_THRESHOLD",
        value: 5000,
        type: "number",
        spec: "§4.3 resolveBattle capture",
        baseline: "万历县城/卫所最小守备",
        tuning: "↑ → 城池更难被一次性吞并；↓ → 突破更易",
        note: "v0.8.1 引入，避免 garrison=0 即破",
      },
      {
        constant: "MOBILIZATION_PER_MONTH",
        value: 0.05,
        type: "number",
        spec: "§4.1 warCommitments",
        baseline: "committedForce 月度增 5%",
        tuning: "↑ → 兵力集结更快；↓ → 远征动员更慢",
        note: "v0.8 M1",
      },
    ],
  },
  {
    name: "Supply",
    module: "src/core/supply.ts",
    specRef: "docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md §4.2",
    rows: [
      {
        constant: "DEPOT_PRODUCTION_SHARE",
        value: 0.4,
        type: "number",
        spec: "§4.2 depositMonthlySupply",
        baseline: "grain产出 40% 注入仓储",
        tuning: "↑ → 仓储更充裕；↓ → 远征更受限",
        note: "v0.9.2",
      },
      {
        constant: "SIEGE_WEEKLY_GRAIN",
        value: 500,
        type: "number",
        spec: "§4.2 computeSupplyRatio",
        baseline: "千人周粮秣 500 单位",
        tuning: "↑ → 围城更难维持；↓ → 围城补给宽裕",
        note: "",
      },
      {
        constant: "MAX_CONVOY_PAYLOAD",
        value: 30000,
        type: "number",
        spec: "§4.2 dispatchSupplyConvoy",
        baseline: "单次运补上限 30k 单位",
        tuning: "↑ → 一次运补更多；↓ → 需要更多次运补",
        note: "",
      },
      {
        constant: "CONVOY_DECAY_PER_HOP",
        value: 0.05,
        type: "number",
        spec: "§4.2 tickSupplyConvoys",
        baseline: "每跳 5% 沿路损耗",
        tuning: "↑ → 远距离补给损耗加大；↓ → 距离钝化",
        note: "",
      },
      {
        constant: "SUPPLY_SHORTAGE_PENALTY",
        value: 0.5,
        type: "number",
        spec: "§4.2 applySupplyPressureMultiplier",
        baseline: "supplyRatio<0.5 时 committed ×0.5",
        tuning: "↑ → 更严厉缺粮惩罚；↓ → 饥饿容忍度提高",
        note: "",
      },
      {
        constant: "SUPPLY_HUNGRY_THRESHOLD",
        value: 0.75,
        type: "number",
        spec: "§4.2 applySupplyPressureMultiplier",
        baseline: "supplyRatio<0.75 → ×0.7",
        tuning: "↓ → 饥饿区间下限更低",
        note: "",
      },
    ],
  },
  {
    name: "Siege",
    module: "src/core/siege.ts",
    specRef: "docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md §4.4",
    rows: [
      {
        constant: "SIEGE_DMG_DIVISOR",
        value: 8,
        type: "number",
        spec: "§4.4 tickSiegeDamage",
        baseline: "siegeDmg = committed/8/fort",
        tuning: "↑ → 围城慢；↓ → 围城快",
        note: "v0.9.3",
      },
      {
        constant: "SIEGE_FORT_MIN",
        value: 1,
        type: "number",
        spec: "§4.4 tickSiegeDamage",
        baseline: "无工事最低 fort=1",
        tuning: "↑ → 即便无工事也抗揍",
        note: "",
      },
      {
        constant: "SIEGE_GARRISON_FLOOR",
        value: 1000,
        type: "number",
        spec: "§4.4 tickSiegeDamage",
        baseline: "garrison 不可低于 1000",
        tuning: "↑ → 城池更难清空；↓ → 投降更易",
        note: "",
      },
      {
        constant: "SIEGE_MAINTENANCE_PER_REGION",
        value: 200,
        type: "number",
        spec: "§4.4 applySiegeMaintenance",
        baseline: "围城工事月维护 200 金",
        tuning: "↑ → 围城月费更重；↓ → 轻装围城",
        note: "走 expense-construction 账本",
      },
      {
        constant: "PLUNDER_POP_RATE",
        value: 0.1,
        type: "number",
        spec: "§4.4 applyCapturePlunder",
        baseline: "战利品 = pop × 0.10 × 5",
        tuning: "↑ → 战利品更丰厚；↓ → 城市破坏轻",
        note: "",
      },
      {
        constant: "CAPTURE_STABILITY_HIT",
        value: 15,
        type: "number",
        spec: "§4.4 applyCapturePlunder",
        baseline: "capture stability -15",
        tuning: "↑ → 接管后统治更不稳；↓ → 民心更稳",
        note: "",
      },
      {
        constant: "CAPTURE_REBEL_PRESSURE_HIT",
        value: 5,
        type: "number",
        spec: "§4.4 applyCapturePlunder",
        baseline: "capture rebelPressure +5",
        tuning: "↑ → 叛乱更快发酵；↓ → 民众更顺",
        note: "",
      },
    ],
  },
  {
    name: "Exhaustion",
    module: "src/core/exhaustion.ts",
    specRef: "docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md §4.5",
    rows: [
      {
        constant: "FATIGUE_BASE",
        value: 0.5,
        type: "number",
        spec: "§4.5 computeFatigueDelta",
        baseline: "基础月增 0.5",
        tuning: "↑ → 战疲累积更快；↓ → 长期战争不易厌战",
        note: "v0.9.4",
      },
      {
        constant: "FATIGUE_CASUALTIES_COEFF",
        value: 0.4,
        type: "number",
        spec: "§4.5 computeFatigueDelta",
        baseline: "casualties/10000 × 0.4",
        tuning: "↑ → 高伤亡更厌战；↓ → 死亡代价钝化",
        note: "",
      },
      {
        constant: "FATIGUE_DURATION_COEFF",
        value: 0.2,
        type: "number",
        spec: "§4.5 computeFatigueDelta",
        baseline: "activeWarMonths × 0.2",
        tuning: "↑ → 长期更易厌战；↓ → 战争韧性高",
        note: "",
      },
      {
        constant: "FATIGUE_WIN_BONUS",
        value: 0.5,
        type: "number",
        spec: "§4.5 computeFatigueDelta",
        baseline: "胜仗月 -0.5",
        tuning: "↑ → 胜利可对冲更多疲劳",
        note: "",
      },
      {
        constant: "FATIGUE_DEESCALATE_THRESHOLD",
        value: 70,
        type: "number",
        spec: "§4.5 deescalateWeightBonus",
        baseline: ">70 触发 AI deescalate +30",
        tuning: "↓ → AI 更早撤军；↑ → 更激进",
        note: "",
      },
      {
        constant: "FATIGUE_WARWEAR_THRESHOLD",
        value: 100,
        type: "number",
        spec: "§4.5 applyWarWearEffect",
        baseline: ">100 触发 warWear（stability -2/月，treasury × 5%）",
        tuning: "↓ → warWear 更早发动",
        note: "",
      },
      {
        constant: "WARWEAR_STABILITY_HIT",
        value: 2,
        type: "number",
        spec: "§4.5 applyWarWearEffect",
        baseline: "stability 月减 2",
        tuning: "↑ → 厌战重创稳定",
        note: "",
      },
      {
        constant: "WARWEAR_TREASURY_RATE",
        value: 0.05,
        type: "number",
        spec: "§4.5 applyWarWearEffect",
        baseline: "国库 × 5% 月消耗",
        tuning: "↑ → 财政恶化更快",
        note: "",
      },
    ],
  },
  {
    name: "Economy",
    module: "src/core/economy.ts + src/core/occupation.ts",
    specRef: "docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md §9 historical",
    rows: [
      {
        constant: "taxRate (dynasty)",
        value: 0.007,
        type: "number",
        spec: "economy.ts:50",
        baseline: "万历九年太仓存银 1100 万两对齐",
        tuning: "↑ → 财政更宽；↓ → 财政更紧",
        note: "v0.8.2 0.004→0.007",
      },
      {
        constant: "costPerSoldier (dynasty)",
        value: 0.2,
        type: "number",
        spec: "economy.ts:82",
        baseline: "dynasty 月军饷 / soldier = 0.20",
        tuning: "↑ → 军费更重；↓ → 长期养兵更便宜",
        note: "v0.8.2 0.28→0.20；tribal 0.15 / rebel 0.08 / local 0.30 不变",
      },
      {
        constant: "fatigueInflationRate (placeholder)",
        value: 0.1,
        type: "number",
        spec: "§9 corruption",
        baseline: "dynasty/local 腐败自然累积 +0.1/月",
        tuning: "↑ → 晚期腐化更快",
        note: "S6 引入，触发陕西流民/南明偏安",
      },
      {
        constant: "occupationResistanceThreshold",
        value: 80,
        type: "number",
        spec: "occupation.ts tickOccupation",
        baseline: "resistance>80 触发 rebelPressure+1",
        tuning: "↓ → 占领迅速激化叛乱；↑ → 容忍度高",
        note: "v0.9.8 T12",
      },
      {
        constant: "grain-relief threshold (placeholder)",
        value: 5000,
        type: "number",
        spec: "occupation.ts applyRelief",
        baseline: "赈济扣 grainReserve 5000 单位",
        tuning: "↑ → 赈济更重；↓ → 容易救济",
        note: "走 grain-relief 账本",
      },
    ],
  },
];

/* ===========================================================================
 * Excel 生成
 * =========================================================================== */

function generateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const sheet of SHEETS) {
    const wsData: (string | number | boolean)[][] = [];
    // Header
    wsData.push(["常量名", "当前值", "类型", "SPEC 章节", "[PLACEHOLDER] baseline", "调参建议", "备注"]);
    // Module / Spec 行
    wsData.push([`模块: ${sheet.module}`, "", "", "", "", "", ""]);
    wsData.push([`SPEC: ${sheet.specRef}`, "", "", "", "", "", ""]);
    wsData.push([]); // 空行
    // Data 行
    for (const row of sheet.rows) {
      wsData.push([
        row.constant,
        row.value as string | number | boolean,
        row.type,
        row.spec,
        row.baseline ?? "",
        row.tuning,
        row.note ?? "",
      ]);
    }
    // 列宽
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 38 }, // 常量名
      { wch: 10 }, // 当前值
      { wch: 8 },  // 类型
      { wch: 30 }, // SPEC
      { wch: 32 }, // baseline
      { wch: 38 }, // 调参建议
      { wch: 28 }, // 备注
    ];
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  // 加 meta sheet
  const meta: (string | number)[][] = [
    ["MING-WAR 军事调参表"],
    [],
    ["生成脚本", "src/scripts/exportTuningTable.ts"],
    ["生成命令", "npx tsx src/scripts/exportTuningTable.ts"],
    ["基础版本", "v0.9.8 (T1-T13)"],
    ["完整 SPEC", "docs/superpowers/specs/2026-07-02-military-refactor-war-preparation-and-sustainment.md"],
    ["可执行 SPEC", "docs/superpowers/specs/2026-07-02-military-refactor-executable-spec.md"],
    [],
    ["Sheet 清单"],
    ["1. Combat", "warfare.ts 持久战公式钳位"],
    ["2. Supply", "supply.ts 粮秣/仓储/运输"],
    ["3. Siege", "siege.ts 围城/工事/战利品"],
    ["4. Exhaustion", "exhaustion.ts 战争疲劳/厌战"],
    ["5. Economy", "economy.ts + occupation.ts"],
    [],
    ["调参流程"],
    ["1. diagnoseSupply.ts / diagnoseSiege.ts / diagnoseExhaustion.ts / diagnoseWarMonths.ts 跑回归"],
    ["2. 在本表调当前值"],
    ["3. 同步 src/core/* 实际常量"],
    ["4. 跑 batch + 5 条历史对照（validateHistorical.ts）"],
    ["5. 提交 + 更新 PROGRESS.md"],
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(meta);
  metaWs["!cols"] = [{ wch: 30 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, metaWs, "Meta");
  return wb;
}

function main(): void {
  const outputDir = join(process.cwd(), "output");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, "tuning-military.xlsx");

  const wb = generateWorkbook();
  XLSX.writeFile(wb, outputPath);

  console.log(`✅ 已写入 ${outputPath}`);
  console.log(`   Sheet 数: ${SHEETS.length + 1}（含 Meta）`);
  console.log(`   Sheet 清单: ${SHEETS.map((s) => s.name).join(", ")}, Meta`);
  console.log("");
  console.log("⚠️  本表为 design-time 调参手册，调参后请同步 src/core/* 实际常量值");
  console.log("   并运行 diagnoseWar{s/Months} + validateHistorical 验收");
}

if (process.argv[1]?.includes("exportTuningTable")) {
  main();
}
