/**
 * autoSave.test.ts — v0.6.1-patch B7
 *
 * 3 槽自动存档真实 IDB 测试（fake-indexeddb）：
 * - 写入 → 读回一致
 * - 校验失败时不覆盖上一个有效存档
 * - monthly / yearly / milestone 三槽独立
 * - isYearBoundary 工具
 */

// fake-indexeddb 副作用模块：注入 IDB 到 globalThis
import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import { writeAutoSave, readAutoSave, isYearBoundary } from "../save/autoSave";
import { LocalSimulationService } from "../runtime/localSimulationService";
import { defaultPlayerDecision } from "../data/scenarios";

beforeEach(async () => {
  // 每个 test 前清空 IDB
  // fake-indexeddb/auto 是 CJS 副作用模块，需从 globalThis 取 indexedDB
  const idb: IDBFactory | undefined = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (idb && typeof idb.databases === "function") {
    const dbs = await idb.databases();
    for (const d of dbs) {
      if (d.name) idb.deleteDatabase(d.name);
    }
  }
});

describe("autoSave — isYearBoundary", () => {
  it("returns true for YYYY-12", () => {
    expect(isYearBoundary("1573-12")).toBe(true);
    expect(isYearBoundary("1599-12")).toBe(true);
  });
  it("returns false for non-12 endings", () => {
    expect(isYearBoundary("1573-01")).toBe(false);
    expect(isYearBoundary("1573-06")).toBe(false);
    expect(isYearBoundary("1573-11")).toBe(false);
  });
  it("returns false for non-date strings", () => {
    expect(isYearBoundary("not-a-date")).toBe(false);
  });
});

describe("autoSave — real IDB roundtrip (fake-indexeddb)", () => {
  async function makeValidSave(name = "test-save") {
    const svc = new LocalSimulationService();
    await svc.startGame({ factionId: "ming", seed: 7 });
    return svc.saveGame(name);
  }

  it("writeAutoSave + readAutoSave roundtrip preserves metadata", async () => {
    const save = await makeValidSave("monthly-1");
    const write = await writeAutoSave("monthly", save);
    expect(write.ok).toBe(true);
    const read = await readAutoSave("monthly");
    expect(read).not.toBeNull();
    expect(read?.metadata.saveName).toBe("monthly-1");
  });

  it("three slots are independent", async () => {
    const save1 = await makeValidSave("monthly");
    const save2 = await makeValidSave("yearly");
    const save3 = await makeValidSave("milestone");
    expect((await writeAutoSave("monthly", save1)).ok).toBe(true);
    expect((await writeAutoSave("yearly", save2)).ok).toBe(true);
    expect((await writeAutoSave("milestone", save3)).ok).toBe(true);
    expect((await readAutoSave("monthly"))?.metadata.saveName).toBe("monthly");
    expect((await readAutoSave("yearly"))?.metadata.saveName).toBe("yearly");
    expect((await readAutoSave("milestone"))?.metadata.saveName).toBe("milestone");
  });

  it("corrupt save is rejected, last good save is preserved", async () => {
    const goodSave = await makeValidSave("good");
    expect((await writeAutoSave("monthly", goodSave)).ok).toBe(true);

    // 构造 corrupt save（checksum 错误）
    const corruptSave = structuredClone(goodSave);
    corruptSave.checksum = "0".repeat(40);
    expect((await writeAutoSave("monthly", corruptSave)).ok).toBe(false);

    // 上一个有效存档仍可读
    const read = await readAutoSave("monthly");
    expect(read?.metadata.saveName).toBe("good");
  });

  it("monthly / yearly / milestone map to distinct IDB keys", async () => {
    const save = await makeValidSave("probe");
    await writeAutoSave("monthly", save);
    await writeAutoSave("yearly", save);
    await writeAutoSave("milestone", save);
    // 三个槽独立 → 三个槽都应可读
    expect(await readAutoSave("monthly")).not.toBeNull();
    expect(await readAutoSave("yearly")).not.toBeNull();
    expect(await readAutoSave("milestone")).not.toBeNull();
  });
});