/**
 * runFactionPhase — v0.6-stability §3.2 S3
 *
 * 势力循环：维护费（走账本）/ 征募 / 腐败累积 / v0.9.1 兵员上限增长。
 * 业务逻辑从原 simulation.ts L272-348 完整迁移。
 *
 * ⚠️ DETERMINISM-CHANGE (v0.9.1 — 2026-07-02)
 * 新增 faction.mobilizationPool 月度自然增长（5% 上限 1.5x armyTotal）。
 * 调用顺序在 army 征募之后、deficit 报告之前——保证征募/池 增长联动
 * 模拟仍产出单一序列。
 *
 * ⚠️ DETERMINISM-CHANGE (T8 — 2026-07-02)
 * 末尾新增 applyAiDecisionJitter（P5 随机消费点）：对每条 AI 决策
 * warDesire ∈ [-5, +5] 时加 ±3 扰动。位置在所有维护/征募/腐败/疲劳
 * 计算之后——保证 S3 内不出现新 random 序列断点。
 * 结果会覆盖 ctx.aiDecisions + ctx.decisionsLookup（供 S4-S7 复用）。
 */

import { calculateFactionMaintenance } from "../economy";
import { applyLedgerToState, type LedgerEntry } from "../ledger";
import { applyAiDecisionJitter } from "../ai";
import type { PhaseFn } from "../simulationContext";

export const runFactionPhase: PhaseFn = (ctx) => {
  for (const faction of Object.values(ctx.state.factions)) {
    if (faction.status !== "active") continue;
    const maintenance = calculateFactionMaintenance(faction, ctx.state.activeModifiers);
    const treasuryBefore = faction.treasury;
    // S1c: maintenance settled through the ledger
    const maintEntries: LedgerEntry[] = [];
    if (maintenance.bureaucratCost !== 0) {
      maintEntries.push({ category: "expense-bureaucrat", source: `${faction.name} 官僚俸禄`, amount: -maintenance.bureaucratCost, factionId: faction.id });
    }
    if (maintenance.armyPayCost !== 0) {
      maintEntries.push({ category: "expense-army-pay", source: `${faction.name} 军饷`, amount: -maintenance.armyPayCost, factionId: faction.id });
    }
    if (maintenance.grainCost !== 0) {
      maintEntries.push({ category: "grain-consumption", source: `${faction.name} 军粮`, amount: -maintenance.grainCost, factionId: faction.id, goodId: "grain" });
    }
    applyLedgerToState(ctx.state, maintEntries);
    ctx.ledgerEntries.push(...maintEntries);
    const inDeficit = treasuryBefore < maintenance.treasuryCost;

    // v0.9.1: 兵员上限池月度自然增长（5%/月，封顶 1.5× armyTotal）。
    // 反映"长期养兵"的时间成本——大明 11.6 万 pool → 第 12 月爬到 ~19 万。
    // 不需国库支持（与征募独立），与破坏 ratio 测度的稳定最小侵入。
    if (faction.status === "active") {
      const cap = faction.armyTotal * 1.5;
      faction.mobilizationPool = Math.min(cap, faction.mobilizationPool + Math.max(100, Math.round(faction.armyTotal * 0.05)));
    }

    // 和平期征募
    const controlledPop = Object.values(ctx.state.regions)
      .filter((r) => r.controllerFactionId === faction.id)
      .reduce((sum, r) => sum + r.population, 0);
    const armyTarget = controlledPop * (faction.type === "tribal" ? 0.015 : 0.006);
    // S5b: 战疲分级征募
    if (faction.armyTotal < armyTarget && faction.treasury > maintenance.treasuryCost * 2) {
      const recruitRate =
        faction.warExhaustion < 40 ? 0.008
        : faction.warExhaustion < 65 ? 0.004
        : 0.0015;
      const recruit = Math.min(Math.round(armyTarget - faction.armyTotal), Math.round(armyTarget * recruitRate));
      const recruitCost = Math.round(recruit * 0.5);
      if (recruit > 0 && faction.treasury >= recruitCost) {
        const recruitEntries: LedgerEntry[] = [
          { category: "military-recruitment", source: `${faction.name} 募兵`, amount: recruit, factionId: faction.id },
          { category: "expense-army-pay", source: `${faction.name} 募兵安家银`, amount: -recruitCost, factionId: faction.id }
        ];
        applyLedgerToState(ctx.state, recruitEntries);
        ctx.ledgerEntries.push(...recruitEntries);
        faction.armyTotal += recruit;
      }
    }
    if (inDeficit) {
      faction.warExhaustion = Math.min(100, faction.warExhaustion + 4);
      ctx.reports.push({
        id: `${ctx.state.currentDate}-${faction.id}-deficit`,
        date: ctx.state.currentDate,
        type: "economy",
        title: `${faction.name}财政赤字`,
        body: "军费与官僚维护超过收入，战争疲劳上升。",
        severity: "warning"
      });
    }

    // S6 遗留#1：中后期内部衰变
    if ((faction.type === "dynasty" || faction.type === "local") && faction.corruption < 80) {
      faction.corruption = Math.min(80, faction.corruption + 0.1);
    }

    // v0.9.4: 战争疲劳累加。base 0.5 + 战月 × 0.2 - 胜奖励（无具体战月 → 0）。
    // casualties 项留待 v0.9.6 AI 升级时接驳；本阶段仅启动累加，让大明 vs
    // 多线 30+ 月的长期战争 fatigue 自然爬到 70+ 触发 deescalate。
    const activeWarMonths = ctx.state.wars
      .filter((w) => w.attackerFactionId === faction.id || w.defenderFactionId === faction.id)
      .reduce((sum, w) => sum + (w.monthsActive > 0 ? 1 : 0), 0);
    if (activeWarMonths > 0) {
      const prev = faction.warFatigue ?? 0;
      faction.warFatigue = Math.min(200, prev + 0.5 + 0.2 * activeWarMonths);
      // 越过 100 阈值时施加 warWear 效果
      if (prev < 100 && faction.warFatigue >= 100) {
        const loss = Math.round(faction.treasury * 0.05);
        if (loss > 0) {
          faction.treasury = Math.max(0, faction.treasury - loss);
          ctx.ledgerEntries.push({
            category: "expense-court",
            source: `${faction.name} 厌战消耗`,
            amount: -loss,
            factionId: faction.id,
          });
        }
        // 减少全体控制区 stability 2
        for (const r of Object.values(ctx.state.regions)) {
          if (r.controllerFactionId === faction.id) {
            r.stability = Math.max(0, r.stability - 2);
          }
        }
      }
    }
  }

  // T8 P5: AI 决策随机扰动（warDesire ∈ [-5, +5] 时 ±3 jitter）。
  // 必须在所有 S2-S4 random 消费点之后，且在 S7 war 阶段之前，
  // 让 S4 外交 / S5 改革 / S7 战争 都用 jittered 决策。
  const jittered = applyAiDecisionJitter(ctx.state, ctx.aiDecisions, ctx.random);
  ctx.aiDecisions = jittered;
  // 同步 decisionsLookup（runDiplomacyPhase / runPoliticsPhase 用）
  for (const [fid, dec] of Object.entries(jittered)) {
    if (ctx.decisionsLookup[fid]) {
      ctx.decisionsLookup[fid] = dec;
    }
  }
};
