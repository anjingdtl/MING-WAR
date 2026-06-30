/**
 * runMarketPhase — v0.6.1-patch B3
 *
 * 跨地区贸易 + 价格更新 + 自动投资（market 阶段）。
 * 业务逻辑从原 finalizeMonth.ts 末尾完整迁移，**不改** random 消费顺序、
 * **不改** state 写入顺序、**不改** ledger 调用顺序。
 */

import { autoInvest, runTrade, updateMarketPrices } from "../market";
import type { PhaseFn } from "../simulationContext";

export const runMarketPhase: PhaseFn = (ctx) => {
  const marketsByRegion: Record<string, import("../market").MarketState> = {};
  const industriesByRegion: Record<string, import("../types").IndustryState[]> = {};
  for (const region of Object.values(ctx.state.regions)) {
    if (!region.market) continue;
    marketsByRegion[region.id] = region.market;
    industriesByRegion[region.id] = region.industries ?? [];
  }
  runTrade(ctx.state, marketsByRegion);
  updateMarketPrices(marketsByRegion, ctx.state.regions);
  autoInvest(marketsByRegion, industriesByRegion);
};