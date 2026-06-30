/**
 * simulationService.test.ts — v0.6-stability §5.12
 *
 * LocalSimulationService 单元测试：
 * - startGame 初始化正确
 * - advanceMonth 单月推进 + hash 稳定
 * - advanceMonths 连续推进 + pause / event / collapse 终止
 * - saveGame / loadGame roundtrip 一致
 * - isPaused / pause / resume 状态
 */

import { describe, expect, it, beforeEach } from "vitest";
import { LocalSimulationService } from "../runtime/localSimulationService";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";
import { simulateMonth } from "../core/simulation";
import { computeStateHash } from "../core/stateHash";

describe("LocalSimulationService", () => {
  let service: LocalSimulationService;

  beforeEach(() => {
    service = new LocalSimulationService();
  });

  it("startGame initializes and returns a snapshot", async () => {
    const view = await service.startGame({ factionId: "ming", seed: 7 });
    expect(view.currentDate).toBe("1573-01");
    expect(view.playerFaction?.id).toBe("ming");
    expect(view.stateHash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("advanceMonth produces a MonthResult and updates internal state", async () => {
    await service.startGame({ factionId: "ming", seed: 7 });
    const month = await service.advanceMonth(defaultPlayerDecision);
    expect(month.date).toBe("1573-02");
    expect(month.stateHash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("advanceMonth hash matches direct simulateMonth hash (determinism)", async () => {
    const a = new LocalSimulationService();
    const b = new LocalSimulationService();
    await a.startGame({ factionId: "ming", seed: 7 });
    await b.startGame({ factionId: "ming", seed: 7 });
    const monthA = await a.advanceMonth(defaultPlayerDecision);
    // Direct simulation for comparison
    const stateB = b.getFullStateForDebug()!;
    const direct = simulateMonth({
      state: stateB,
      playerDecision: defaultPlayerDecision,
      randomSeed: stateB.seed
    });
    const directHash = computeStateHash(direct.nextState);
    expect(monthA.stateHash).toBe(directHash);
  });

  it("advanceMonths runs N months and reports progress", async () => {
    await service.startGame({ factionId: "ming", seed: 7 });
    const progressEvents: number[] = [];
    service.onProgress((p) => progressEvents.push(p.completed));
    const result = await service.advanceMonths(5, () => defaultPlayerDecision);
    // 由于事件触发可能在第 1 月终止，应 >= 1。
    // 完成次数在事件 / pause / ended / collapsed 之前正常累加。
    expect(result.months.length).toBeGreaterThanOrEqual(1);
    expect(result.months.length).toBeLessThanOrEqual(5);
    expect(progressEvents.length).toBe(result.months.length);
  });

  it("pause() aborts advanceMonths at the next iteration boundary", async () => {
    await service.startGame({ factionId: "ming", seed: 7 });
    setTimeout(() => service.pause(), 0);
    const result = await service.advanceMonths(20, () => defaultPlayerDecision);
    // pause 可能在事件后生效；接受 user-pause 或 event 终止
    expect(result.aborted).toBe(true);
    expect(["user-pause", "event"]).toContain(result.reason);
    // 不应跑满 20 月
    expect(result.months.length).toBeLessThan(20);
  });

  it("isPaused toggles correctly", () => {
    expect(service.isPaused()).toBe(false);
    service.pause();
    expect(service.isPaused()).toBe(true);
    service.resume();
    expect(service.isPaused()).toBe(false);
  });

  it("saveGame / loadGame roundtrip preserves state hash", async () => {
    await service.startGame({ factionId: "ming", seed: 7 });
    const before = await service.advanceMonth(defaultPlayerDecision);
    const save = await service.saveGame("test");
    expect(save.format).toBe("ming-war-save");
    expect(save.saveVersion).toBe(1);
    expect(save.checksum).toBe(before.stateHash);
    expect(save.state.currentDate).toBe("1573-02");

    // load
    const view = await service.loadGame(save);
    expect(view.stateHash).toBe(before.stateHash);
  });

  it("getFullStateForDebug returns the same state object reference", async () => {
    await service.startGame({ factionId: "ming", seed: 7 });
    const a = service.getFullStateForDebug();
    const b = service.getFullStateForDebug();
    expect(a).toBe(b);
  });

  it("rejects advanceMonth before startGame", async () => {
    await expect(service.advanceMonth(defaultPlayerDecision)).rejects.toThrow(/startGame/);
  });
});

describe("LocalSimulationService determinism (10 months)", () => {
  it("two independent services yield identical hashes at month 10", async () => {
    const a = new LocalSimulationService();
    const b = new LocalSimulationService();
    await a.startGame({ factionId: "ming", seed: 7 });
    await b.startGame({ factionId: "ming", seed: 7 });
    for (let i = 0; i < 10; i++) {
      const ma = await a.advanceMonth(defaultPlayerDecision);
      const mb = await b.advanceMonth(defaultPlayerDecision);
      expect(ma.stateHash).toBe(mb.stateHash);
    }
  }, 30_000);
});

// 验证 createMvpScenario 的基本行为不被本 phase 改动
describe("createMvpScenario (sanity)", () => {
  it("returns a valid initial state", () => {
    const state = createMvpScenario("ming", 7);
    expect(state.currentDate).toBe("1573-01");
    expect(state.playerFactionId).toBe("ming");
  });
});
