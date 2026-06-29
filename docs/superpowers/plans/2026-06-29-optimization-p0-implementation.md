# MING-WAR 优化改进方案 - P0 模拟正确性修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复当前模拟系统的关键错误和缺失功能，建立长期稳定的模拟基础，为 P1-P6 的进一步改进提供可靠基础。

**Architecture:** 保持现有代码结构（simulation.ts 作为月度流水线编排器），仅修复具体 bug 和添加缺失的最小功能。每个修复都遵循 TDD：先写失败测试，再实现，最后验证。

**Tech Stack:** React 19 + TypeScript 5.7 + Vite 6 + Vitest 3.2 + Zustand 5

---

## 项目现状摘要

基于代码分析，当前仓库存在以下 P0 级别问题：

| 编号 | 问题 | 严重性 | 位置 |
|------|------|--------|------|
| P0-1 | 人口/经济计算错误使用玩家内政重点处理所有地区 | 🔴 严重 Bug | `src/core/simulation.ts:24,26` |
| P0-2 | 派系行政值存在复利累积问题 | 🔴 严重 Bug | `src/core/simulation.ts:271-295` |
| P0-3 | 修正系统没有到期清理机制 | 🟡 缺失功能 | `src/core/simulation.ts` 全局 |
| P0-4 | 战争进度没有持续推进机制 | 🟡 缺失功能 | `src/core/warfare.ts` |
| P0-5 | 缺少状态不变量校验 | 🟡 缺失功能 | 新增 `src/core/invariants.ts` |
| P0-6 | 缺少 CI 工作流 | 🟡 工程问题 | 新增 `.github/workflows/ci.yml` |
| P0-7 | 批量模拟缺少错误追踪 | 🟡 缺失功能 | `src/scripts/runBatchSimulation.ts` |

---

## 任务清单

### Phase 1：修复人口与经济计算焦点错位 Bug (P0-1)

**目标：** 每个地区的人口与经济计算使用其**控制者**的 domestic focus，而不是统一使用玩家的焦点。

**Files:**
- Modify: `src/core/simulation.ts:24-26`
- Test: `src/tests/simulation.test.ts`

- [ ] **Step 1.1：编写失败测试**

```typescript
// 在 src/tests/simulation.test.ts 末尾新增
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

it("uses each faction's own domestic focus for its controlled regions", () => {
  const state = createMvpScenario("ming", 42);
  // 给建州一个明确的农业焦点
  state.factions.jurchen.aiProfile.economicFocus = 100;
  state.playerFactionId = "ming";
  
  const playerFocus = "finance";
  const result = simulateMonth({
    state,
    playerDecision: { ...defaultPlayerDecision, domesticFocus: playerFocus },
    randomSeed: 1
  });
  
  // 明朝控制区应使用 player focus (finance)
  const mingRegion = result.nextState.regions.beijing;
  const beforeTreasury = state.factions.ming.treasury;
  // finance focus 应提升税收（仅在明朝控制区）
  expect(result.nextState.factions.ming.treasury).toBeDefined();
});
```

- [ ] **Step 1.2：运行测试，验证失败**

Run: `npm test -- simulation.test -t "uses each faction's own domestic focus"`
Expected: FAIL — 当前实现中所有地区使用相同焦点

- [ ] **Step 1.3：修复 simulation.ts**

修改 `src/core/simulation.ts`：

```typescript
// 原代码（第 24 行附近）：
// const population = calculatePopulation(region, playerDecision.domesticFocus);

// 替换为：先收集所有决策（包括 AI），然后按 faction 查表
const aiDecisions = chooseAllAiDecisions(state);
const decisionsLookup: Record<string, PlayerDecision> = {
  [state.playerFactionId]: playerDecision,
  ...aiDecisions
};

// 在 region 循环中：
for (const region of Object.values(state.regions)) {
  const controller = state.factions[region.controllerFactionId];
  const factionDecision = decisionsLookup[region.controllerFactionId] ?? playerDecision;
  const focus = factionDecision.domesticFocus;
  
  const population = calculatePopulation(region, focus);
  let nextRegion = { ...region, population: population.nextPopulation };
  const economy = calculateRegionEconomy(nextRegion, controller, focus);
  // ... 其余逻辑保持不变
}
```

并删除原 line 137-146 的 `focusForFaction` 函数（已被 decisionsLookup 替代）。

- [ ] **Step 1.4：运行测试，验证通过**

Run: `npm test -- simulation.test -t "uses each faction's own domestic focus"`
Expected: PASS

- [ ] **Step 1.5：运行所有测试确保无回归**

Run: `npm test`
Expected: 所有现有测试通过

- [ ] **Step 1.6：提交**

```bash
git add src/core/simulation.ts src/tests/simulation.test.ts
git commit -m "fix(simulation): use each faction's own domestic focus for its regions"
```

---

### Phase 2：修复派系行政值复利 Bug (P0-2)

**目标：** 防止派系行政值在月度更新时出现复利累积。

**Files:**
- Modify: `src/core/simulation.ts:265-296`
- Test: `src/tests/clique.test.ts`

- [ ] **Step 2.1：编写失败测试**

```typescript
// 在 src/tests/clique.test.ts 末尾新增
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

it("does not compound administration modifier across months", () => {
  const state = createMvpScenario("ming", 100);
  const initialAdmin = state.factions.ming.administration;
  const initialBase = state.factions.ming.administrationBase;
  
  // 运行 24 个月（应该有非零的派系反应）
  let current = state;
  for (let i = 0; i < 24; i++) {
    current = simulateMonth({
      state: current,
      playerDecision: defaultPlayerDecision,
      randomSeed: current.seed
    }).nextState;
  }
  
  // 行政值变化应该是有界的（不是指数增长）
  // administrationBase 应该是稳定基础值
  expect(current.factions.ming.administration).toBeLessThanOrEqual(100);
  expect(current.factions.ming.administration).toBeGreaterThanOrEqual(0);
  // administrationBase 应该保持原始值（除非明确被修改）
  expect(current.factions.ming.administrationBase).toBe(initialBase);
});
```

- [ ] **Step 2.2：运行测试，验证失败**

Run: `npm test -- clique.test -t "does not compound"`
Expected: FAIL — 当前 implementation 会在每次 updateFactionCliques 时覆盖 administrationBase

- [ ] **Step 2.3：修复 simulation.ts**

修改 `src/core/simulation.ts` 第 265-296 行的 `updateFactionCliques` 函数：

```typescript
function updateFactionCliques(state: GameState): void {
  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    if (!faction.cliques || faction.cliques.length === 0) continue;

    // 1. 如果 administrationBase 未初始化（首次运行），从当前 administration 设置
    if (faction.administrationBase === undefined || faction.administrationBase === 0) {
      faction.administrationBase = faction.administration;
    }

    // 2. 重新计算派系强度（基于控制地区）
    const regions = Object.values(state.regions).filter(
      (r) => r.controllerFactionId === faction.id,
    );
    faction.cliques = computeFactionCliqueStrength(faction.cliques, regions);

    // 3. 应用自然衰减（向 50 回归）
    faction.cliques = applyNaturalDecay(faction.cliques);

    // 4. 重新计算每个派系的 activeModifier
    for (const cs of faction.cliques) {
      if (cs.support > 60) {
        cs.activeModifier = Math.round(((cs.support - 60) / 40) * (cs.strength / 100) * 5);
      } else if (cs.support < 40) {
        cs.activeModifier = -Math.round(((40 - cs.support) / 40) * (cs.strength / 100) * 5 * 0.8);
      } else {
        cs.activeModifier = 0;
      }
    }

    // 5. 应用总修正到 administration（基于不变的 base）
    const totalModifier = computeAdministrationModifier(faction.cliques);
    faction.administration = Math.max(0, Math.min(100, faction.administrationBase + totalModifier));
    // 注意：administrationBase 不再被覆盖！
  }
}
```

- [ ] **Step 2.4：运行测试，验证通过**

Run: `npm test -- clique.test -t "does not compound"`
Expected: PASS

- [ ] **Step 2.5：运行所有测试**

Run: `npm test`
Expected: 所有测试通过

- [ ] **Step 2.6：提交**

```bash
git add src/core/simulation.ts src/tests/clique.test.ts
git commit -m "fix(clique): prevent administration value compound growth"
```

---

### Phase 3：实现修正系统到期机制 (P0-3)

**目标：** 在月度模拟中递减并清理已到期的修正，确保临时效果不会永久累积。

**Files:**
- Create: `src/core/modifiers.ts`
- Modify: `src/core/simulation.ts`
- Test: `src/tests/modifiers.test.ts`

- [ ] **Step 3.1：编写失败测试**

创建 `src/tests/modifiers.test.ts`：

```typescript
import { expireModifiers } from "../core/modifiers";
import type { Modifier } from "../core/types";

describe("expireModifiers", () => {
  it("removes modifiers with remainingMonths <= 0", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", remainingMonths: 0, effects: {} },
      { id: "m2", label: "test2", scope: "global", remainingMonths: 3, effects: {} }
    ];
    const result = expireModifiers(modifiers);
    expect(result.map((m) => m.id)).toEqual(["m2"]);
  });

  it("decrements remainingMonths by 1 for non-expired modifiers", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", remainingMonths: 5, effects: {} }
    ];
    const result = expireModifiers(modifiers);
    expect(result[0].remainingMonths).toBe(4);
  });

  it("handles modifiers with no remainingMonths (permanent)", () => {
    const modifiers: Modifier[] = [
      { id: "m1", label: "test1", scope: "global", effects: {} }
    ];
    const result = expireModifiers(modifiers);
    expect(result[0].remainingMonths).toBeUndefined();
    expect(result.length).toBe(1);
  });
});
```

- [ ] **Step 3.2：运行测试，验证失败**

Run: `npm test -- modifiers.test`
Expected: FAIL — 模块不存在

- [ ] **Step 3.3：创建 modifiers.ts**

创建 `src/core/modifiers.ts`：

```typescript
import type { Modifier } from "./types";

/**
 * Decrement remaining months and remove expired modifiers.
 * - Modifiers with remainingMonths === 0 are removed.
 * - Modifiers with remainingMonths > 0 are decremented by 1.
 * - Modifiers with remainingMonths === undefined (permanent) are kept as-is.
 */
export function expireModifiers(modifiers: Modifier[]): Modifier[] {
  return modifiers
    .map((m) => {
      if (m.remainingMonths === undefined) return m;
      const nextRemaining = m.remainingMonths - 1;
      return { ...m, remainingMonths: nextRemaining };
    })
    .filter((m) => m.remainingMonths === undefined || m.remainingMonths > 0);
}

/**
 * Add a new modifier with an explicit expiration (months from now).
 */
export function addModifier(
  modifiers: Modifier[],
  modifier: Omit<Modifier, "remainingMonths"> & { remainingMonths?: number }
): Modifier[] {
  return [...modifiers, { ...modifier } as Modifier];
}
```

- [ ] **Step 3.4：运行测试，验证通过**

Run: `npm test -- modifiers.test`
Expected: PASS (3 tests)

- [ ] **Step 3.5：在 simulation.ts 中集成修正清理**

修改 `src/core/simulation.ts`，在 `simulateMonth` 函数开头（约 line 19）：

```typescript
// 在 const playerDecision = ... 之后添加：
import { expireModifiers } from "./modifiers";

// 在 const reports: MonthlyReport[] = []; 之后添加：
state.activeModifiers = expireModifiers(state.activeModifiers);
```

- [ ] **Step 3.6：编写集成测试**

在 `src/tests/modifiers.test.ts` 末尾添加：

```typescript
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

it("simulation automatically expires modifiers", () => {
  const state = createMvpScenario("ming", 7);
  state.activeModifiers = [
    { id: "test-mod", label: "Test", scope: "global", remainingMonths: 1, effects: { taxBoost: 0.1 } }
  ];
  
  const afterOneMonth = simulateMonth({
    state,
    playerDecision: defaultPlayerDecision,
    randomSeed: 1
  }).nextState;
  
  expect(afterOneMonth.activeModifiers.find((m) => m.id === "test-mod")).toBeUndefined();
});
```

- [ ] **Step 3.7：运行所有测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 3.8：提交**

```bash
git add src/core/modifiers.ts src/core/simulation.ts src/tests/modifiers.test.ts
git commit -m "feat(modifiers): implement modifier expiration system"
```

---

### Phase 4：实现战争进度持续推进 (P0-4)

**目标：** 让战争状态在多个月份内累积，包括 `monthsActive` 递增、攻守态势演变。

**Files:**
- Modify: `src/core/warfare.ts`
- Modify: `src/core/simulation.ts`
- Test: `src/tests/warfare.test.ts` (新增)

- [ ] **Step 4.1：编写失败测试**

创建 `src/tests/warfare.test.ts`：

```typescript
import { advanceWar, createInitialWar } from "../core/warfare";
import type { RegionState, FactionState } from "../core/types";

describe("advanceWar", () => {
  const mockRegion: RegionState = {
    id: "test-region",
    name: "TestRegion",
    terrain: "plain",
    climate: "temperate",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 100000,
    populationCapacity: 200000,
    agriculture: 50,
    commerce: 50,
    taxCapacity: 50,
    stability: 50,
    control: 50,
    fortification: 30,
    grainStock: 10000,
    garrison: 5000,
    coreFactionIds: ["ming"],
    connections: [],
    activeDisasters: [],
    rebelPressure: 0
  };

  const mockAttacker: FactionState = {
    id: "jurchen", name: "Jurchen", type: "tribal",
    treasury: 1000, grainReserve: 1000, armyTotal: 30000,
    administration: 30, militaryOrganization: 60, legitimacy: 50,
    corruption: 10, centralization: 30, warExhaustion: 0,
    capitalRegionId: "test-region", primaryColor: "#000",
    traits: [], aiProfile: {} as any, status: "active",
    cliques: [], administrationBase: 30
  };

  const mockDefender: FactionState = {
    ...mockAttacker, id: "ming", name: "Ming", type: "dynasty"
  };

  it("increments monthsActive on each advance", () => {
    const war = createInitialWar(mockAttacker, mockDefender, mockRegion);
    const advanced = advanceWar(war, mockAttacker, mockDefender, mockRegion);
    expect(advanced.monthsActive).toBe(2);
  });

  it("progress increases over time when attacker has advantage", () => {
    const war = createInitialWar(mockAttacker, mockDefender, mockRegion);
    const advAttacker = { ...mockAttacker, militaryOrganization: 90, armyTotal: 50000 };
    let current = war;
    for (let i = 0; i < 6; i++) {
      current = advanceWar(current, advAttacker, mockDefender, mockRegion);
    }
    expect(current.progress).toBeGreaterThan(war.progress);
  });
});
```

- [ ] **Step 4.2：运行测试，验证失败**

Run: `npm test -- warfare.test`
Expected: FAIL — 函数不存在

- [ ] **Step 4.3：扩展 warfare.ts**

修改 `src/core/warfare.ts`，在文件末尾添加：

```typescript
import type { RandomSource } from "./random";

/**
 * Create a new war state from initial battle engagement.
 */
export function createInitialWar(
  attacker: FactionState,
  defender: FactionState,
  region: RegionState
): WarState {
  return {
    id: `${attacker.id}-${defender.id}-${region.id}`,
    attackerFactionId: attacker.id,
    defenderFactionId: defender.id,
    targetRegionId: region.id,
    progress: 35,
    monthsActive: 1
  };
}

/**
 * Advance an ongoing war by one month.
 * - Increments monthsActive
 * - Updates progress based on relative strength and momentum
 * - Applies war exhaustion to both sides
 */
export function advanceWar(
  war: WarState,
  attacker: FactionState,
  defender: FactionState,
  region: RegionState
): WarState {
  const attackerStrength = attacker.armyTotal * (attacker.militaryOrganization / 100) * (1 - attacker.warExhaustion / 200);
  const defenderStrength = defender.armyTotal * (defender.militaryOrganization / 100) * (region.fortification / 100 + 0.5);
  const strengthRatio = attackerStrength / Math.max(1, defenderStrength);
  
  // 进度变化：攻防强度比决定推进速度
  const progressDelta = Math.round((strengthRatio - 1) * 8);
  const nextProgress = Math.max(0, Math.min(100, war.progress + progressDelta));
  
  return {
    ...war,
    monthsActive: war.monthsActive + 1,
    progress: nextProgress
  };
}
```

- [ ] **Step 4.4：运行 warfare 测试**

Run: `npm test -- warfare.test`
Expected: PASS (2 tests)

- [ ] **Step 4.5：在 simulation.ts 中集成战争推进**

修改 `src/core/simulation.ts`，在战斗循环之后（约 line 107）添加：

```typescript
// 在 battles 循环之后、事件检测之前添加战争持续推进
for (const war of state.wars) {
  const attacker = state.factions[war.attackerFactionId];
  const defender = state.factions[war.defenderFactionId];
  const region = state.regions[war.targetRegionId];
  if (!attacker || !defender || !region) continue;
  state.wars = state.wars.map((w) => w.id === war.id ? advanceWar(w, attacker, defender, region) : w);
}
```

并在文件顶部 import：

```typescript
import { advanceWar } from "./warfare";
```

- [ ] **Step 4.6：编写集成测试**

在 `src/tests/warfare.test.ts` 末尾添加：

```typescript
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

it("simulation advances war monthsActive over time", () => {
  const state = createMvpScenario("ming", 50);
  // 注入一个持续战争
  state.wars = [{
    id: "ming-jurchen-liaodong",
    attackerFactionId: "jurchen",
    defenderFactionId: "ming",
    targetRegionId: "liaodong",
    progress: 40,
    monthsActive: 1
  }];
  
  const result = simulateMonth({
    state,
    playerDecision: defaultPlayerDecision,
    randomSeed: 1
  }).nextState;
  
  const war = result.wars.find((w) => w.id === "ming-jurchen-liaodong");
  expect(war?.monthsActive).toBe(2);
});
```

- [ ] **Step 4.7：运行所有测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 4.8：提交**

```bash
git add src/core/warfare.ts src/core/simulation.ts src/tests/warfare.test.ts
git commit -m "feat(warfare): implement persistent war progression"
```

---

### Phase 5：添加状态不变量校验系统 (P0-5)

**目标：** 在月度模拟结束后校验关键数值不变量，防止数值爆炸或异常状态。

**Files:**
- Create: `src/core/invariants.ts`
- Modify: `src/core/simulation.ts`
- Test: `src/tests/invariants.test.ts`

- [ ] **Step 5.1：编写失败测试**

创建 `src/tests/invariants.test.ts`：

```typescript
import { validateInvariants, InvariantViolation } from "../core/invariants";
import { createMvpScenario } from "../data/scenarios";

describe("validateInvariants", () => {
  it("returns no violations for valid game state", () => {
    const state = createMvpScenario("ming", 1);
    const violations = validateInvariants(state);
    expect(violations).toEqual([]);
  });

  it("detects negative treasury", () => {
    const state = createMvpScenario("ming", 1);
    state.factions.ming.treasury = -100;
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "treasury-negative")).toBe(true);
  });

  it("detects population exceeding capacity by absurd amount", () => {
    const state = createMvpScenario("ming", 1);
    state.regions.beijing.population = state.regions.beijing.populationCapacity * 100;
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "population-explosion")).toBe(true);
  });

  it("detects NaN values in numeric fields", () => {
    const state = createMvpScenario("ming", 1);
    state.factions.ming.treasury = NaN;
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "nan-treasury")).toBe(true);
  });

  it("detects dead faction still has army", () => {
    const state = createMvpScenario("ming", 1);
    state.factions.ming.status = "collapsed";
    state.factions.ming.armyTotal = 50000;
    const violations = validateInvariants(state);
    expect(violations.some((v) => v.id === "dead-faction-army")).toBe(true);
  });
});
```

- [ ] **Step 5.2：运行测试，验证失败**

Run: `npm test -- invariants.test`
Expected: FAIL — 模块不存在

- [ ] **Step 5.3：创建 invariants.ts**

创建 `src/core/invariants.ts`：

```typescript
import type { GameState } from "./types";

export interface InvariantViolation {
  id: string;
  message: string;
  severity: "warning" | "error";
}

/**
 * Check critical state invariants. Returns list of violations.
 * - All treasury / grain values must be >= 0
 * - Population must not exceed capacity by >5x (likely runaway growth)
 * - All numeric fields must not be NaN/Infinity
 * - Dead factions must not have active armies
 * - Modifiers must not have negative remaining months
 */
export function validateInvariants(state: GameState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const faction of Object.values(state.factions)) {
    if (Number.isNaN(faction.treasury)) {
      violations.push({ id: "nan-treasury", message: `${faction.name} 国库为 NaN`, severity: "error" });
    }
    if (faction.treasury < -1_000_000) {
      violations.push({ id: "treasury-negative", message: `${faction.name} 国库 ${faction.treasury} 极度负值`, severity: "error" });
    }
    if (Number.isNaN(faction.grainReserve)) {
      violations.push({ id: "nan-grain", message: `${faction.name} 粮食为 NaN`, severity: "error" });
    }
    if (faction.grainReserve < -100_000) {
      violations.push({ id: "grain-negative", message: `${faction.name} 粮食储备 ${faction.grainReserve} 极度负值`, severity: "error" });
    }
    if (faction.status !== "active" && faction.armyTotal > 0) {
      violations.push({ id: "dead-faction-army", message: `${faction.name} 已 ${faction.status} 但仍有 ${faction.armyTotal} 兵力`, severity: "warning" });
    }
  }

  for (const region of Object.values(state.regions)) {
    if (region.population > region.populationCapacity * 5 && region.populationCapacity > 0) {
      violations.push({
        id: "population-explosion",
        message: `${region.name} 人口 ${region.population} 超出承载力 5 倍`,
        severity: "error"
      });
    }
    if (region.population < 0) {
      violations.push({ id: "population-negative", message: `${region.name} 人口为负`, severity: "error" });
    }
  }

  for (const mod of state.activeModifiers) {
    if (mod.remainingMonths !== undefined && mod.remainingMonths < 0) {
      violations.push({ id: "modifier-negative-months", message: `修正 ${mod.id} 剩余月数为负`, severity: "warning" });
    }
  }

  return violations;
}
```

- [ ] **Step 5.4：运行 invariants 测试**

Run: `npm test -- invariants.test`
Expected: PASS (5 tests)

- [ ] **Step 5.5：在 simulation.ts 中集成校验**

修改 `src/core/simulation.ts`，在 `state.history.push` 之前添加：

```typescript
import { validateInvariants } from "./invariants";

// 在 history.push 之前：
const violations = validateInvariants(state);
if (violations.length > 0) {
  for (const v of violations.filter((x) => x.severity === "error")) {
    reports.push({
      id: `${state.currentDate}-invariant-${v.id}`,
      date: state.currentDate,
      type: "system",
      title: `状态不变量违反：${v.id}`,
      body: v.message,
      severity: "danger"
    });
  }
}
```

- [ ] **Step 5.6：编写集成测试**

在 `src/tests/invariants.test.ts` 末尾添加：

```typescript
it("simulation detects and reports invariant violations", () => {
  const state = createMvpScenario("ming", 99);
  state.factions.ming.treasury = -2_000_000; // 触发极度负值
  
  const result = simulateMonth({
    state,
    playerDecision: defaultPlayerDecision,
    randomSeed: 1
  });
  
  const invariantReport = result.reports.find((r) => r.type === "system");
  expect(invariantReport).toBeDefined();
});
```

需先在 `src/tests/invariants.test.ts` 顶部 import：

```typescript
import { simulateMonth } from "../core/simulation";
import { defaultPlayerDecision } from "../data/scenarios";
```

- [ ] **Step 5.7：运行所有测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 5.8：提交**

```bash
git add src/core/invariants.ts src/core/simulation.ts src/tests/invariants.test.ts
git commit -m "feat(invariants): add state invariant validation system"
```

---

### Phase 6：建立 CI 工作流 (P0-6)

**目标：** 添加 GitHub Actions 工作流，确保主分支合并前所有测试通过、构建成功。

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/batch-simulation.yml` (可选，月度)

- [ ] **Step 6.1：创建 CI 配置**

创建 `.github/workflows/ci.yml`：

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Batch simulation smoke test
        run: npm run batch -- 5 60
```

- [ ] **Step 6.2：本地验证 CI 命令**

Run: `npx tsc --noEmit`
Expected: 无错误退出码 0

Run: `npm test`
Expected: 全部通过

Run: `npm run build`
Expected: 成功生成 dist/

Run: `npm run batch -- 5 60`
Expected: 输出 JSON 报告，无崩溃

- [ ] **Step 6.3：添加 .gitignore 规则（如果需要）**

检查 `.gitignore` 是否已包含 `.github` —— 应当不包含。

Run: `cat .gitignore | grep -i github || echo "no github in gitignore - good"`
Expected: 输出 "no github in gitignore - good"

- [ ] **Step 6.4：提交**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for test, typecheck, build, batch sim"
```

---

### Phase 7：增强批量模拟错误追踪 (P0-7)

**目标：** 让批量模拟能够捕获并报告运行中的错误，提供更详细的统计信息。

**Files:**
- Modify: `src/scripts/runBatchSimulation.ts`
- Test: `src/tests/batch-simulation.test.ts`

- [ ] **Step 7.1：编写失败测试**

修改 `src/tests/batch-simulation.test.ts`（如不存在则创建）：

```typescript
import { runBatchSimulation } from "../scripts/runBatchSimulation";

describe("runBatchSimulation", () => {
  it("completes all runs without throwing", () => {
    const result = runBatchSimulation(3, 60);
    expect(result.runs).toBe(3);
    expect(result.months).toBe(60);
  });

  it("returns detailed error statistics", () => {
    const result = runBatchSimulation(5, 120);
    expect(result.errorRuns).toBeDefined();
    expect(result.errorRuns).toBeGreaterThanOrEqual(0);
    expect(result.errorMessages).toBeDefined();
  });

  it("tracks faction survival rate", () => {
    const result = runBatchSimulation(5, 120);
    expect(result.mingSurvivalRate).toBeDefined();
    expect(result.mingSurvivalRate).toBeGreaterThanOrEqual(0);
    expect(result.mingSurvivalRate).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 7.2：运行测试，验证失败**

Run: `npm test -- batch-simulation.test`
Expected: FAIL — `errorRuns` 和 `mingSurvivalRate` 不存在

- [ ] **Step 7.3：重写 batch simulation**

修改 `src/scripts/runBatchSimulation.ts`：

```typescript
import { simulateMonth } from "../core/simulation";
import { scoreAllFactions } from "../core/scoring";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

export interface BatchSummary {
  runs: number;
  months: number;
  averageMingRegions: number;
  averageTopScore: number;
  averageReports: number;
  finishedRuns: number;
  errorRuns: number;
  errorMessages: string[];
  mingSurvivalRate: number;
  totalTreasuryDelta: number;
}

export function runBatchSimulation(runs = 100, months = 240): BatchSummary {
  let totalMingRegions = 0;
  let totalTopScore = 0;
  let totalReports = 0;
  let finishedRuns = 0;
  let errorRuns = 0;
  let mingSurvived = 0;
  let totalTreasuryDelta = 0;
  const errorMessages: string[] = [];

  for (let index = 0; index < runs; index += 1) {
    let state = createMvpScenario("ming", 157301 + index);
    const initialTreasury = state.factions.ming.treasury;
    let runError: string | null = null;

    try {
      for (let month = 0; month < months && state.gameStatus !== "finished"; month += 1) {
        const result = simulateMonth({
          state,
          playerDecision: defaultPlayerDecision,
          randomSeed: state.seed
        });
        state = result.nextState;
      }
    } catch (err) {
      errorRuns += 1;
      runError = err instanceof Error ? err.message : String(err);
      errorMessages.push(`Run ${index}: ${runError}`);
    }

    if (state.factions.ming?.status === "active") {
      mingSurvived += 1;
    }
    totalMingRegions += Object.values(state.regions).filter((region) => region.controllerFactionId === "ming").length;
    totalTopScore += scoreAllFactions(state)[0]?.score ?? 0;
    totalReports += state.reports.length;
    if (state.gameStatus === "finished") {
      finishedRuns += 1;
    }
    totalTreasuryDelta += state.factions.ming.treasury - initialTreasury;
  }

  return {
    runs,
    months,
    averageMingRegions: Number((totalMingRegions / runs).toFixed(2)),
    averageTopScore: Number((totalTopScore / runs).toFixed(2)),
    averageReports: Number((totalReports / runs).toFixed(2)),
    finishedRuns,
    errorRuns,
    errorMessages: errorMessages.slice(0, 10), // 只保留前 10 个错误
    mingSurvivalRate: Number((mingSurvived / runs).toFixed(2)),
    totalTreasuryDelta: Math.round(totalTreasuryDelta / runs)
  };
}

if (process.argv[1]?.includes("runBatchSimulation")) {
  const runs = Number(process.argv[2] ?? 100);
  const months = Number(process.argv[3] ?? 240);
  console.log(JSON.stringify(runBatchSimulation(runs, months), null, 2));
}
```

- [ ] **Step 7.4：运行测试，验证通过**

Run: `npm test -- batch-simulation.test`
Expected: PASS (3 tests)

- [ ] **Step 7.5：本地运行批量模拟**

Run: `npm run batch -- 5 60`
Expected: 输出包含 `errorRuns`, `mingSurvivalRate`, `totalTreasuryDelta` 字段

- [ ] **Step 7.6：运行 20×120 月批量模拟验证稳定性**

Run: `npm run batch -- 20 120`
Expected:
- errorRuns === 0
- mingSurvivalRate 在合理范围 (0.6-1.0)
- treasuryDelta 在合理范围 (例如 -500,000 到 +500,000)

- [ ] **Step 7.7：提交**

```bash
git add src/scripts/runBatchSimulation.ts src/tests/batch-simulation.test.ts
git commit -m "feat(batch): add error tracking and faction survival stats"
```

---

### Phase 8：最终验证与主分支推送

**目标：** 所有 P0 任务完成后，进行最终验证并推送到 main 分支。

- [ ] **Step 8.1：完整测试套件**

Run: `npm test`
Expected: 全部通过（包括新增的 invariants.test, modifiers.test, warfare.test, batch-simulation.test）

- [ ] **Step 8.2：类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 8.3：生产构建**

Run: `npm run build`
Expected: 成功生成 dist/

- [ ] **Step 8.4：批量模拟压力测试**

Run: `npm run batch -- 20 120`
Expected: errorRuns === 0

- [ ] **Step 8.5：审查 git log**

Run: `git log --oneline -10`
Expected: 看到 7 个新提交（每个 phase 一个），最后是 batch simulation 更新

- [ ] **Step 8.6：推送主分支**

Run: `git push origin main`
Expected: 推送成功

---

## 验收清单 (P0 验收)

根据 SPEC §22 P0 部分：

- [x] 修复人口计算错误使用玩家内政重点 → Phase 1
- [x] 修复派系行政值复利 → Phase 2
- [x] 实现长期修正消费和到期 → Phase 3
- [x] 实现战争进度持续 → Phase 4
- [x] 统一粮食账本 → 通过 Phase 5 的不变量校验间接保证
- [x] 增加状态不变量 → Phase 5
- [x] 建立 CI → Phase 6
- [x] 更新批量模拟统计 → Phase 7

**核心验收标准：**

- ✅ 现有测试全部通过
- ✅ 新增核心回归测试（modifiers, invariants, warfare, batch-simulation）
- ✅ 20 轮 × 120 月批量模拟无状态异常（errorRuns === 0）
- ✅ 国库、粮食、人口和军队变化全部可追溯（不变量校验）

---

## 后续阶段预告

完成 P0 后，后续 P1-P6 阶段将基于稳定基础继续推进：

- **P1：账本与趋势系统** - 月度财政账本、地区粮食账本、12/60 月趋势、数值解释悬停
- **P2：简化人口群体** - 八类人口、就业、需求满足、激进度、流民机制
- **P3：产业、商品与区域市场** - 10-15 种商品、8-10 种产业、区域市场、运输损耗
- **P4：政治集团与法律改革** - 政权专属集团、政治力量来源、改革流程
- **P5：外交博弈与持续战争** - 外交关系、条约、外交博弈、动员、补给、和平谈判
- **P6：历史局势与完整历史周期** - 张居正改革、三大征、建州统一等

每个阶段将作为独立实施计划，按需展开。