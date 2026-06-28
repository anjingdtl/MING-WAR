# Wanli Collapse MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable MVP of 《万历：山河崩塌》 covering the 1573-1621 historical simulation loop with fixed-seed monthly turns, core economy/war/rebellion/event systems, basic save support, and a usable React map UI.

**Architecture:** Keep the simulation core pure TypeScript and independent from React. React and Zustand read/write player decisions and display state, while the monthly simulation runs through a Web Worker-compatible interface. Data for regions, factions, events, AI profiles, and scenarios is stored as TypeScript data modules first, with the module boundaries matching the future JSON/YAML data-driven shape.

**Tech Stack:** Vite, React, TypeScript, Zustand, Vitest, Testing Library, IndexedDB, Web Worker, custom SVG map.

---

## Scope Boundary

This plan implements the MVP defined in `docs/superpowers/specs/2026-06-28-wanli-collapse-project-spec.md`.

Included:

- Project scaffold and test setup.
- 6-region simulation validation prototype.
- Expansion to a 13-region MVP scenario within the spec's 12-24 region range.
- Three playable factions: Ming, Tumed, Jianzhou.
- AI factions for Chahar, Haixi Jurchen, and Bozhou.
- Monthly simulation from 1573-01 through 1621-12.
- Economy, population, warfare, control, rebellion, events, scoring, save/load, and basic UI.
- Batch simulation report for balancing.

Excluded:

- Full 1662 timeline.
- Full 36-45 region map.
- Complex diplomacy.
- Officer/person system.
- City building and tech tree.
- Individual unit movement.
- Multiplayer.
- Deep mobile adaptation.

---

## File Structure Map

Create these files and keep responsibilities narrow:

```text
package.json                         Project scripts and dependencies
index.html                           Vite entry HTML
vite.config.ts                       Vite and Vitest configuration
tsconfig.json                        TypeScript project settings
tsconfig.node.json                   TypeScript settings for Vite config
src/main.tsx                         React entry point
src/app/App.tsx                      Main app shell
src/app/App.css                      App layout styles
src/core/types.ts                    Shared domain types
src/core/calendar.ts                 Month arithmetic and date labels
src/core/random.ts                   Fixed-seed random generator
src/core/modifiers.ts                Modifier helpers
src/core/population.ts               Population and famine calculations
src/core/economy.ts                  Grain, tax, and treasury calculations
src/core/decisions.ts                Player and AI decision validation
src/core/ai.ts                       AI military and domestic choices
src/core/warfare.ts                  Battle and army-pool calculations
src/core/control.ts                  Regional control calculations
src/core/rebellion.ts                Rebellion risk and stage changes
src/core/eventEngine.ts              Event condition and option resolution
src/core/scoring.ts                  Stage scoring and end-state summary
src/core/simulation.ts               Monthly simulation orchestrator
src/data/factions.ts                 Faction definitions
src/data/regions.ts                  13-region MVP map data
src/data/events.ts                   MVP event definitions
src/data/scenarios.ts                Scenario creation helpers
src/map/mapConfig.ts                 SVG region geometry and layer metadata
src/store/gameStore.ts               Zustand game state store
src/save/saveManager.ts              IndexedDB save/load and migration
src/workers/simulation.worker.ts     Worker wrapper for monthly simulation
src/ui/layout/TopBar.tsx             Date, speed, and resource display
src/ui/panels/DecisionPanel.tsx      Military and domestic controls
src/ui/map/GameMap.tsx               SVG map and map interactions
src/ui/panels/RegionPanel.tsx        Selected region details
src/ui/panels/LogPanel.tsx           Monthly reports and event log
src/ui/dialogs/EventDialog.tsx       Event decisions
src/ui/dialogs/StartDialog.tsx       Faction selection and seed entry
src/ui/common/StatBadge.tsx          Reusable stat display
src/scripts/runBatchSimulation.ts    Balancing CLI
src/tests/*.test.ts                  Focused unit and integration tests
```

Commit after every task that passes its verification command. Because the current folder is not a git repository, Task 1 initializes git before the first commit.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.css`
- Test: `src/tests/smoke.test.ts`

- [ ] **Step 1: Initialize git and create source folders**

Run:

```powershell
git init
New-Item -ItemType Directory -Force -Path src,src/app,src/tests | Out-Null
```

Expected: `git status --short --branch` shows a new repository on `main` or `master` with untracked docs and source files after later steps.

- [ ] **Step 2: Create project package**

Create `package.json`:

```json
{
  "name": "ming-war",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "batch": "tsx src/scripts/runBatchSimulation.ts"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "typescript": "^5.7.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.2",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "jsdom": "^25.0.1",
    "tsx": "^4.19.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Create Vite and TypeScript config**

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: []
  }
});
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create the React entry point**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>万历：山河崩塌</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./app/App.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create `src/app/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <h1>万历：山河崩塌</h1>
      <p>月度历史推演 MVP 正在建立。</p>
    </main>
  );
}
```

Create `src/app/App.css`:

```css
:root {
  color: #231f1c;
  background: #f3eee3;
  font-family:
    "Noto Sans SC",
    "Microsoft YaHei",
    system-ui,
    sans-serif;
}

body {
  margin: 0;
}

.app-shell {
  min-height: 100vh;
  padding: 24px;
  box-sizing: border-box;
}
```

- [ ] **Step 5: Add a smoke test**

Create `src/tests/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("project scaffold", () => {
  it("runs the test environment", () => {
    expect("万历：山河崩塌").toContain("万历");
  });
});
```

- [ ] **Step 6: Install dependencies and verify**

Run:

```powershell
npm install
npm test
npm run build
```

Expected: tests pass and Vite builds a `dist` folder.

- [ ] **Step 7: Commit scaffold**

Run:

```powershell
git add .
git commit -m "chore: scaffold wanli collapse mvp"
```

Expected: one root commit containing docs and the initial app.

---

### Task 2: Core Domain Types

**Files:**
- Create: `src/core/types.ts`
- Test: `src/tests/types.test.ts`

- [ ] **Step 1: Define the domain model**

Create `src/core/types.ts`:

```ts
export type FactionId = string;
export type RegionId = string;
export type EventId = string;

export type TerrainType = "plain" | "mountain" | "steppe" | "river" | "coast";
export type ClimateType = "temperate" | "cold" | "dry" | "humid";
export type FactionType = "dynasty" | "tribal" | "local" | "rebel" | "successor" | "maritime";
export type FactionStatus = "active" | "collapsed" | "exiled" | "successor" | "observer";
export type MilitaryPosture = "conservative" | "balanced" | "aggressive";
export type DomesticFocus =
  | "agriculture"
  | "finance"
  | "military"
  | "administration"
  | "recovery"
  | "frontier";
export type MapLayer = "control" | "population" | "grain" | "tax" | "stability" | "army" | "controlLevel";

export interface AiProfile {
  aggression: number;
  riskTolerance: number;
  economicFocus: number;
  centralizationPreference: number;
  historicalGoalWeight: number;
  defensePriority: number;
  warEndurance: number;
}

export interface RegionState {
  id: RegionId;
  name: string;
  terrain: TerrainType;
  climate: ClimateType;
  ownerFactionId: FactionId;
  controllerFactionId: FactionId;
  population: number;
  populationCapacity: number;
  agriculture: number;
  commerce: number;
  taxCapacity: number;
  stability: number;
  control: number;
  fortification: number;
  grainStock: number;
  garrison: number;
  coreFactionIds: FactionId[];
  connections: RegionId[];
  activeDisasters: string[];
  rebelPressure: number;
}

export interface FactionState {
  id: FactionId;
  name: string;
  type: FactionType;
  treasury: number;
  grainReserve: number;
  armyTotal: number;
  administration: number;
  militaryOrganization: number;
  legitimacy: number;
  corruption: number;
  centralization: number;
  warExhaustion: number;
  capitalRegionId: RegionId;
  primaryColor: string;
  traits: string[];
  aiProfile: AiProfile;
  status: FactionStatus;
}

export interface PlayerDecision {
  targetRegionId: RegionId | null;
  posture: MilitaryPosture;
  domesticFocus: DomesticFocus;
}

export interface WarState {
  id: string;
  attackerFactionId: FactionId;
  defenderFactionId: FactionId;
  targetRegionId: RegionId;
  progress: number;
  monthsActive: number;
}

export interface Modifier {
  id: string;
  label: string;
  scope: "faction" | "region" | "global";
  targetId?: string;
  remainingMonths: number;
  effects: Partial<Record<string, number>>;
}

export interface MonthlyReport {
  id: string;
  date: string;
  type: "economy" | "war" | "rebellion" | "event" | "system";
  title: string;
  body: string;
  severity: "info" | "warning" | "danger";
}

export interface GameAlert {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "danger";
}

export interface TriggeredEvent {
  eventId: EventId;
  optionRequired: boolean;
}

export interface HistoricalRecord {
  date: string;
  summary: string;
  factionCount: number;
  controlledRegions: Record<FactionId, number>;
}

export interface GameState {
  version: string;
  currentDate: string;
  endDate: string;
  seed: number;
  playerFactionId: FactionId;
  factions: Record<FactionId, FactionState>;
  regions: Record<RegionId, RegionState>;
  wars: WarState[];
  activeModifiers: Modifier[];
  eventFlags: Record<string, boolean>;
  history: HistoricalRecord[];
  reports: MonthlyReport[];
  alerts: GameAlert[];
  gameStatus: "playing" | "paused" | "finished";
}

export interface SimulationInput {
  state: GameState;
  playerDecision: PlayerDecision;
  randomSeed: number;
}

export interface SimulationResult {
  nextState: GameState;
  reports: MonthlyReport[];
  triggeredEvents: TriggeredEvent[];
  alerts: GameAlert[];
}
```

- [ ] **Step 2: Add a type-level sanity test**

Create `src/tests/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FactionState, PlayerDecision, RegionState } from "../core/types";

describe("domain types", () => {
  it("supports the MVP faction, region, and decision shapes", () => {
    const faction: FactionState = {
      id: "ming",
      name: "大明",
      type: "dynasty",
      treasury: 8200000,
      grainReserve: 12500000,
      armyTotal: 680000,
      administration: 72,
      militaryOrganization: 58,
      legitimacy: 92,
      corruption: 34,
      centralization: 68,
      warExhaustion: 5,
      capitalRegionId: "beijing",
      primaryColor: "#C63D32",
      traits: ["bureaucracy"],
      aiProfile: {
        aggression: 35,
        riskTolerance: 30,
        economicFocus: 65,
        centralizationPreference: 70,
        historicalGoalWeight: 80,
        defensePriority: 70,
        warEndurance: 45
      },
      status: "active"
    };

    const region: RegionState = {
      id: "beijing",
      name: "北京",
      terrain: "plain",
      climate: "temperate",
      ownerFactionId: "ming",
      controllerFactionId: "ming",
      population: 1200000,
      populationCapacity: 1800000,
      agriculture: 45,
      commerce: 70,
      taxCapacity: 82,
      stability: 78,
      control: 90,
      fortification: 85,
      grainStock: 650000,
      garrison: 80000,
      coreFactionIds: ["ming"],
      connections: ["liaoxi"],
      activeDisasters: [],
      rebelPressure: 0
    };

    const decision: PlayerDecision = {
      targetRegionId: "liaoxi",
      posture: "balanced",
      domesticFocus: "administration"
    };

    expect(faction.capitalRegionId).toBe(region.id);
    expect(decision.targetRegionId).toBe("liaoxi");
  });
});
```

- [ ] **Step 3: Verify types and tests**

Run:

```powershell
npm test -- src/tests/types.test.ts
npm run build
```

Expected: tests and TypeScript build pass.

- [ ] **Step 4: Commit types**

Run:

```powershell
git add src/core/types.ts src/tests/types.test.ts
git commit -m "feat: define simulation domain types"
```

---

### Task 3: Calendar and Fixed-Seed Random

**Files:**
- Create: `src/core/calendar.ts`
- Create: `src/core/random.ts`
- Test: `src/tests/calendar-random.test.ts`

- [ ] **Step 1: Implement calendar helpers**

Create `src/core/calendar.ts`:

```ts
export function advanceMonth(date: string): string {
  const [yearText, monthText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function monthIndex(date: string): number {
  const [yearText, monthText] = date.split("-");
  return Number(yearText) * 12 + Number(monthText) - 1;
}

export function monthsBetween(start: string, end: string): number {
  return monthIndex(end) - monthIndex(start);
}

export function isAfter(date: string, target: string): boolean {
  return monthIndex(date) > monthIndex(target);
}

export function isInDateWindow(date: string, start: string, end: string): boolean {
  const value = monthIndex(date);
  return value >= monthIndex(start) && value <= monthIndex(end);
}

export function formatChineseDate(date: string): string {
  const [year, month] = date.split("-");
  return `${year}年${Number(month)}月`;
}
```

- [ ] **Step 2: Implement deterministic random**

Create `src/core/random.ts`:

```ts
export interface RandomSource {
  seed: number;
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: T[]): T;
}

export function createRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  }

  return {
    get seed() {
      return state;
    },
    next,
    int(min: number, max: number) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick<T>(items: T[]) {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty array");
      }
      return items[Math.floor(next() * items.length)];
    }
  };
}
```

- [ ] **Step 3: Test date and random behavior**

Create `src/tests/calendar-random.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { advanceMonth, formatChineseDate, isInDateWindow, monthsBetween } from "../core/calendar";
import { createRandom } from "../core/random";

describe("calendar", () => {
  it("advances across year boundaries", () => {
    expect(advanceMonth("1573-01")).toBe("1573-02");
    expect(advanceMonth("1573-12")).toBe("1574-01");
  });

  it("checks date windows and labels", () => {
    expect(isInDateWindow("1582-07", "1582-07", "1582-12")).toBe(true);
    expect(isInDateWindow("1583-01", "1582-07", "1582-12")).toBe(false);
    expect(formatChineseDate("1619-03")).toBe("1619年3月");
    expect(monthsBetween("1573-01", "1574-01")).toBe(12);
  });
});

describe("fixed seed random", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = createRandom(1573);
    const b = createRandom(1573);
    expect([a.next(), a.next(), a.int(1, 10)]).toEqual([b.next(), b.next(), b.int(1, 10)]);
  });

  it("rejects empty picks", () => {
    const random = createRandom(1);
    expect(() => random.pick([])).toThrow("Cannot pick from an empty array");
  });
});
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm test -- src/tests/calendar-random.test.ts
npm run build
git add src/core/calendar.ts src/core/random.ts src/tests/calendar-random.test.ts
git commit -m "feat: add calendar and deterministic random"
```

Expected: tests pass and commit succeeds.

---

### Task 4: MVP Scenario Data

**Files:**
- Create: `src/data/factions.ts`
- Create: `src/data/regions.ts`
- Create: `src/data/scenarios.ts`
- Test: `src/tests/scenario.test.ts`

- [ ] **Step 1: Create faction definitions**

Create `src/data/factions.ts`:

```ts
import type { FactionState } from "../core/types";

export const factionTemplates: Record<string, FactionState> = {
  ming: {
    id: "ming",
    name: "大明",
    type: "dynasty",
    treasury: 8200000,
    grainReserve: 12500000,
    armyTotal: 680000,
    administration: 72,
    militaryOrganization: 58,
    legitimacy: 92,
    corruption: 34,
    centralization: 68,
    warExhaustion: 5,
    capitalRegionId: "beijing",
    primaryColor: "#C63D32",
    traits: ["庞大官僚体系", "两京制度", "边军体系", "天下正统"],
    aiProfile: {
      aggression: 35,
      riskTolerance: 30,
      economicFocus: 65,
      centralizationPreference: 70,
      historicalGoalWeight: 80,
      defensePriority: 70,
      warEndurance: 45
    },
    status: "active"
  },
  tumed: {
    id: "tumed",
    name: "土默特部",
    type: "tribal",
    treasury: 900000,
    grainReserve: 900000,
    armyTotal: 95000,
    administration: 38,
    militaryOrganization: 67,
    legitimacy: 55,
    corruption: 18,
    centralization: 35,
    warExhaustion: 2,
    capitalRegionId: "tumed_steppe",
    primaryColor: "#387CA3",
    traits: ["草原骑兵", "互市贸易", "部族联盟"],
    aiProfile: {
      aggression: 58,
      riskTolerance: 55,
      economicFocus: 45,
      centralizationPreference: 35,
      historicalGoalWeight: 70,
      defensePriority: 45,
      warEndurance: 55
    },
    status: "active"
  },
  jianzhou: {
    id: "jianzhou",
    name: "建州女真",
    type: "tribal",
    treasury: 420000,
    grainReserve: 620000,
    armyTotal: 42000,
    administration: 32,
    militaryOrganization: 62,
    legitimacy: 48,
    corruption: 12,
    centralization: 42,
    warExhaustion: 1,
    capitalRegionId: "jianzhou",
    primaryColor: "#B88928",
    traits: ["八旗雏形", "部族整合", "低成本动员", "辽东目标"],
    aiProfile: {
      aggression: 72,
      riskTolerance: 65,
      economicFocus: 38,
      centralizationPreference: 60,
      historicalGoalWeight: 88,
      defensePriority: 52,
      warEndurance: 70
    },
    status: "active"
  },
  chahar: {
    id: "chahar",
    name: "察哈尔部",
    type: "tribal",
    treasury: 620000,
    grainReserve: 520000,
    armyTotal: 74000,
    administration: 30,
    militaryOrganization: 64,
    legitimacy: 52,
    corruption: 16,
    centralization: 28,
    warExhaustion: 3,
    capitalRegionId: "chahar_steppe",
    primaryColor: "#5B6C9D",
    traits: ["草原声望", "联盟不稳"],
    aiProfile: {
      aggression: 62,
      riskTolerance: 58,
      economicFocus: 36,
      centralizationPreference: 30,
      historicalGoalWeight: 68,
      defensePriority: 44,
      warEndurance: 56
    },
    status: "active"
  },
  haixi: {
    id: "haixi",
    name: "海西女真",
    type: "tribal",
    treasury: 360000,
    grainReserve: 580000,
    armyTotal: 39000,
    administration: 28,
    militaryOrganization: 48,
    legitimacy: 40,
    corruption: 14,
    centralization: 26,
    warExhaustion: 1,
    capitalRegionId: "haixi",
    primaryColor: "#96713B",
    traits: ["人口较多", "派系分散"],
    aiProfile: {
      aggression: 50,
      riskTolerance: 45,
      economicFocus: 40,
      centralizationPreference: 32,
      historicalGoalWeight: 62,
      defensePriority: 55,
      warEndurance: 48
    },
    status: "active"
  },
  bozhou: {
    id: "bozhou",
    name: "播州杨氏",
    type: "local",
    treasury: 300000,
    grainReserve: 460000,
    armyTotal: 28000,
    administration: 34,
    militaryOrganization: 44,
    legitimacy: 45,
    corruption: 20,
    centralization: 24,
    warExhaustion: 0,
    capitalRegionId: "bozhou",
    primaryColor: "#7A8A3A",
    traits: ["山地防御", "地方自治"],
    aiProfile: {
      aggression: 38,
      riskTolerance: 35,
      economicFocus: 48,
      centralizationPreference: 24,
      historicalGoalWeight: 58,
      defensePriority: 72,
      warEndurance: 50
    },
    status: "active"
  }
};
```

- [ ] **Step 2: Create 13-region MVP data**

Create `src/data/regions.ts` with this structure and include all twelve records:

```ts
import type { RegionState } from "../core/types";

export const regionTemplates: Record<string, RegionState> = {
  beijing: {
    id: "beijing",
    name: "北京",
    terrain: "plain",
    climate: "temperate",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 1200000,
    populationCapacity: 1800000,
    agriculture: 45,
    commerce: 70,
    taxCapacity: 82,
    stability: 78,
    control: 90,
    fortification: 85,
    grainStock: 650000,
    garrison: 80000,
    coreFactionIds: ["ming"],
    connections: ["liaoxi", "shandong", "datong"],
    activeDisasters: [],
    rebelPressure: 0
  },
  liaoxi: {
    id: "liaoxi",
    name: "辽西",
    terrain: "plain",
    climate: "cold",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 520000,
    populationCapacity: 760000,
    agriculture: 42,
    commerce: 32,
    taxCapacity: 38,
    stability: 64,
    control: 76,
    fortification: 70,
    grainStock: 300000,
    garrison: 52000,
    coreFactionIds: ["ming", "jianzhou"],
    connections: ["beijing", "liaodong", "haixi"],
    activeDisasters: [],
    rebelPressure: 0
  },
  liaodong: {
    id: "liaodong",
    name: "辽东",
    terrain: "plain",
    climate: "cold",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 610000,
    populationCapacity: 880000,
    agriculture: 48,
    commerce: 35,
    taxCapacity: 42,
    stability: 62,
    control: 70,
    fortification: 64,
    grainStock: 330000,
    garrison: 64000,
    coreFactionIds: ["ming", "jianzhou"],
    connections: ["liaoxi", "jianzhou", "haixi"],
    activeDisasters: [],
    rebelPressure: 0
  },
  jianzhou: {
    id: "jianzhou",
    name: "建州",
    terrain: "mountain",
    climate: "cold",
    ownerFactionId: "jianzhou",
    controllerFactionId: "jianzhou",
    population: 220000,
    populationCapacity: 420000,
    agriculture: 36,
    commerce: 22,
    taxCapacity: 24,
    stability: 72,
    control: 78,
    fortification: 35,
    grainStock: 180000,
    garrison: 32000,
    coreFactionIds: ["jianzhou"],
    connections: ["liaodong", "haixi"],
    activeDisasters: [],
    rebelPressure: 0
  },
  haixi: {
    id: "haixi",
    name: "海西",
    terrain: "mountain",
    climate: "cold",
    ownerFactionId: "haixi",
    controllerFactionId: "haixi",
    population: 260000,
    populationCapacity: 460000,
    agriculture: 34,
    commerce: 24,
    taxCapacity: 22,
    stability: 58,
    control: 55,
    fortification: 30,
    grainStock: 170000,
    garrison: 29000,
    coreFactionIds: ["haixi", "jianzhou"],
    connections: ["liaoxi", "liaodong", "jianzhou"],
    activeDisasters: [],
    rebelPressure: 0
  },
  datong: {
    id: "datong",
    name: "大同",
    terrain: "steppe",
    climate: "dry",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 440000,
    populationCapacity: 660000,
    agriculture: 38,
    commerce: 36,
    taxCapacity: 34,
    stability: 66,
    control: 74,
    fortification: 76,
    grainStock: 240000,
    garrison: 56000,
    coreFactionIds: ["ming", "tumed", "chahar"],
    connections: ["beijing", "tumed_steppe", "chahar_steppe", "shaanxi"],
    activeDisasters: [],
    rebelPressure: 0
  },
  tumed_steppe: {
    id: "tumed_steppe",
    name: "土默特",
    terrain: "steppe",
    climate: "dry",
    ownerFactionId: "tumed",
    controllerFactionId: "tumed",
    population: 280000,
    populationCapacity: 420000,
    agriculture: 24,
    commerce: 46,
    taxCapacity: 28,
    stability: 68,
    control: 70,
    fortification: 28,
    grainStock: 140000,
    garrison: 52000,
    coreFactionIds: ["tumed"],
    connections: ["datong", "chahar_steppe", "shaanxi"],
    activeDisasters: [],
    rebelPressure: 0
  },
  chahar_steppe: {
    id: "chahar_steppe",
    name: "察哈尔",
    terrain: "steppe",
    climate: "dry",
    ownerFactionId: "chahar",
    controllerFactionId: "chahar",
    population: 240000,
    populationCapacity: 380000,
    agriculture: 22,
    commerce: 34,
    taxCapacity: 24,
    stability: 60,
    control: 56,
    fortification: 24,
    grainStock: 120000,
    garrison: 43000,
    coreFactionIds: ["chahar"],
    connections: ["datong", "tumed_steppe"],
    activeDisasters: [],
    rebelPressure: 0
  },
  shandong: {
    id: "shandong",
    name: "山东",
    terrain: "coast",
    climate: "temperate",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 1800000,
    populationCapacity: 2400000,
    agriculture: 62,
    commerce: 58,
    taxCapacity: 66,
    stability: 72,
    control: 82,
    fortification: 50,
    grainStock: 820000,
    garrison: 36000,
    coreFactionIds: ["ming"],
    connections: ["beijing", "henan", "jiangnan"],
    activeDisasters: [],
    rebelPressure: 0
  },
  shaanxi: {
    id: "shaanxi",
    name: "陕西",
    terrain: "plain",
    climate: "dry",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 1400000,
    populationCapacity: 1900000,
    agriculture: 52,
    commerce: 38,
    taxCapacity: 46,
    stability: 60,
    control: 70,
    fortification: 48,
    grainStock: 520000,
    garrison: 42000,
    coreFactionIds: ["ming"],
    connections: ["datong", "tumed_steppe", "henan", "bozhou"],
    activeDisasters: [],
    rebelPressure: 8
  },
  henan: {
    id: "henan",
    name: "河南",
    terrain: "plain",
    climate: "temperate",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 2100000,
    populationCapacity: 2700000,
    agriculture: 68,
    commerce: 52,
    taxCapacity: 60,
    stability: 66,
    control: 76,
    fortification: 42,
    grainStock: 900000,
    garrison: 35000,
    coreFactionIds: ["ming"],
    connections: ["shandong", "shaanxi", "jiangnan", "bozhou"],
    activeDisasters: [],
    rebelPressure: 4
  },
  jiangnan: {
    id: "jiangnan",
    name: "江南",
    terrain: "river",
    climate: "humid",
    ownerFactionId: "ming",
    controllerFactionId: "ming",
    population: 3200000,
    populationCapacity: 4200000,
    agriculture: 78,
    commerce: 86,
    taxCapacity: 90,
    stability: 76,
    control: 84,
    fortification: 58,
    grainStock: 1500000,
    garrison: 42000,
    coreFactionIds: ["ming"],
    connections: ["shandong", "henan", "bozhou"],
    activeDisasters: [],
    rebelPressure: 0
  },
  bozhou: {
    id: "bozhou",
    name: "播州",
    terrain: "mountain",
    climate: "humid",
    ownerFactionId: "bozhou",
    controllerFactionId: "bozhou",
    population: 360000,
    populationCapacity: 580000,
    agriculture: 44,
    commerce: 28,
    taxCapacity: 26,
    stability: 64,
    control: 58,
    fortification: 68,
    grainStock: 210000,
    garrison: 25000,
    coreFactionIds: ["bozhou", "ming"],
    connections: ["shaanxi", "henan", "jiangnan"],
    activeDisasters: [],
    rebelPressure: 2
  }
};
```

- [ ] **Step 3: Create scenario factory**

Create `src/data/scenarios.ts`:

```ts
import type { GameState, PlayerDecision } from "../core/types";
import { factionTemplates } from "./factions";
import { regionTemplates } from "./regions";

export const defaultPlayerDecision: PlayerDecision = {
  targetRegionId: "liaodong",
  posture: "balanced",
  domesticFocus: "administration"
};

export function createMvpScenario(playerFactionId = "ming", seed = 157301): GameState {
  return {
    version: "0.1.0",
    currentDate: "1573-01",
    endDate: "1621-12",
    seed,
    playerFactionId,
    factions: structuredClone(factionTemplates),
    regions: structuredClone(regionTemplates),
    wars: [],
    activeModifiers: [],
    eventFlags: {},
    history: [],
    reports: [],
    alerts: [],
    gameStatus: "playing"
  };
}
```

- [ ] **Step 4: Test scenario integrity**

Create `src/tests/scenario.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMvpScenario } from "../data/scenarios";

describe("MVP scenario", () => {
  it("creates a playable 13-region scenario", () => {
    const state = createMvpScenario("ming", 42);
    expect(Object.keys(state.regions)).toHaveLength(13);
    expect(state.factions.ming.status).toBe("active");
    expect(state.regions.beijing.controllerFactionId).toBe("ming");
    expect(state.currentDate).toBe("1573-01");
    expect(state.endDate).toBe("1621-12");
  });

  it("keeps every connection pointed at an existing region", () => {
    const state = createMvpScenario();
    const ids = new Set(Object.keys(state.regions));
    for (const region of Object.values(state.regions)) {
      for (const connection of region.connections) {
        expect(ids.has(connection), `${region.id} -> ${connection}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/tests/scenario.test.ts
npm run build
git add src/data/factions.ts src/data/regions.ts src/data/scenarios.ts src/tests/scenario.test.ts
git commit -m "feat: add mvp scenario data"
```

Expected: tests pass. If the region count expectation fails because the data intentionally has 13 regions, set the assertion to `13` and keep the larger MVP map.

---

### Task 5: Population and Economy

**Files:**
- Create: `src/core/population.ts`
- Create: `src/core/economy.ts`
- Test: `src/tests/economy-population.test.ts`

- [ ] **Step 1: Implement population calculations**

Create `src/core/population.ts`:

```ts
import type { DomesticFocus, RegionState } from "./types";

export interface PopulationResult {
  nextPopulation: number;
  deaths: number;
  migrants: number;
  growth: number;
}

export function calculatePopulation(region: RegionState, focus: DomesticFocus): PopulationResult {
  const capacityPressure = Math.max(0, region.population / region.populationCapacity - 0.85);
  const stabilityFactor = region.stability / 100;
  const foodStress = region.grainStock < region.population * 0.12 ? 0.018 : 0;
  const disasterStress = region.activeDisasters.length * 0.012;
  const focusBoost = focus === "recovery" ? 0.004 : focus === "agriculture" ? 0.002 : 0;
  const naturalGrowthRate = Math.max(0, 0.003 + focusBoost - capacityPressure * 0.01);
  const growth = Math.round(region.population * naturalGrowthRate * stabilityFactor);
  const deaths = Math.round(region.population * (foodStress + disasterStress));
  const migrants = Math.round(region.population * Math.max(0, (55 - region.stability) / 10000));
  const nextPopulation = Math.max(1000, region.population + growth - deaths - migrants);
  return { nextPopulation, deaths, migrants, growth };
}
```

- [ ] **Step 2: Implement economy calculations**

Create `src/core/economy.ts`:

```ts
import type { DomesticFocus, FactionState, RegionState } from "./types";

export interface EconomyResult {
  region: RegionState;
  grainProduced: number;
  grainConsumed: number;
  taxCollected: number;
  treasuryDelta: number;
  grainDelta: number;
}

export function calculateRegionEconomy(
  region: RegionState,
  faction: FactionState,
  focus: DomesticFocus
): EconomyResult {
  const stabilityFactor = region.stability / 100;
  const controlFactor = region.control / 100;
  const administrationFactor = faction.administration / 100;
  const corruptionLoss = faction.corruption / 140;
  const agricultureBoost = focus === "agriculture" ? 1.12 : 1;
  const financeBoost = focus === "finance" ? 1.14 : 1;
  const administrationBoost = focus === "administration" ? 0.94 : 1;
  const grainProduced = Math.round(
    region.population * (region.agriculture / 100) * 0.09 * stabilityFactor * agricultureBoost
  );
  const grainConsumed = Math.round(region.population * 0.075 + region.garrison * 0.16);
  const taxCollected = Math.max(
    0,
    Math.round(
      region.population *
        (region.taxCapacity / 100) *
        controlFactor *
        administrationFactor *
        financeBoost *
        administrationBoost *
        (1 - corruptionLoss) *
        0.018
    )
  );
  return {
    region: {
      ...region,
      grainStock: Math.max(0, region.grainStock + grainProduced - grainConsumed)
    },
    grainProduced,
    grainConsumed,
    taxCollected,
    treasuryDelta: taxCollected,
    grainDelta: grainProduced - grainConsumed
  };
}

export function calculateFactionMaintenance(faction: FactionState): { treasuryCost: number; grainCost: number } {
  return {
    treasuryCost: Math.round(faction.armyTotal * 1.8 + faction.administration * 1200),
    grainCost: Math.round(faction.armyTotal * 0.11)
  };
}
```

- [ ] **Step 3: Test population and economy**

Create `src/tests/economy-population.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateRegionEconomy, calculateFactionMaintenance } from "../core/economy";
import { calculatePopulation } from "../core/population";
import { createMvpScenario } from "../data/scenarios";

describe("population", () => {
  it("grows stable regions and harms starving regions", () => {
    const state = createMvpScenario();
    const jiangnan = state.regions.jiangnan;
    expect(calculatePopulation(jiangnan, "recovery").nextPopulation).toBeGreaterThan(jiangnan.population);

    const starving = { ...jiangnan, grainStock: 1, stability: 35 };
    expect(calculatePopulation(starving, "finance").nextPopulation).toBeLessThan(starving.population);
  });
});

describe("economy", () => {
  it("collects taxes and updates grain stock", () => {
    const state = createMvpScenario();
    const result = calculateRegionEconomy(state.regions.jiangnan, state.factions.ming, "finance");
    expect(result.taxCollected).toBeGreaterThan(0);
    expect(result.region.grainStock).not.toBe(state.regions.jiangnan.grainStock);
  });

  it("charges military and bureaucracy maintenance", () => {
    const state = createMvpScenario();
    const maintenance = calculateFactionMaintenance(state.factions.ming);
    expect(maintenance.treasuryCost).toBeGreaterThan(0);
    expect(maintenance.grainCost).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm test -- src/tests/economy-population.test.ts
npm run build
git add src/core/population.ts src/core/economy.ts src/tests/economy-population.test.ts
git commit -m "feat: add population and economy calculations"
```

---

### Task 6: Decision Validation and AI Choices

**Files:**
- Create: `src/core/decisions.ts`
- Create: `src/core/ai.ts`
- Test: `src/tests/decisions-ai.test.ts`

- [ ] **Step 1: Implement decision validation**

Create `src/core/decisions.ts`:

```ts
import type { GameState, PlayerDecision, RegionId } from "./types";

export function getFactionRegionIds(state: GameState, factionId: string): RegionId[] {
  return Object.values(state.regions)
    .filter((region) => region.controllerFactionId === factionId)
    .map((region) => region.id);
}

export function getValidMilitaryTargets(state: GameState, factionId: string): RegionId[] {
  const controlled = new Set(getFactionRegionIds(state, factionId));
  const targets = new Set<RegionId>();
  for (const regionId of controlled) {
    const region = state.regions[regionId];
    for (const connectionId of region.connections) {
      const connection = state.regions[connectionId];
      if (connection.controllerFactionId !== factionId) {
        targets.add(connectionId);
      }
    }
  }
  return [...targets];
}

export function normalizePlayerDecision(state: GameState, decision: PlayerDecision): PlayerDecision {
  const validTargets = getValidMilitaryTargets(state, state.playerFactionId);
  const targetRegionId =
    decision.targetRegionId && validTargets.includes(decision.targetRegionId)
      ? decision.targetRegionId
      : validTargets[0] ?? null;
  return {
    targetRegionId,
    posture: decision.posture,
    domesticFocus: decision.domesticFocus
  };
}
```

- [ ] **Step 2: Implement AI decisions**

Create `src/core/ai.ts`:

```ts
import type { DomesticFocus, FactionState, GameState, PlayerDecision, RegionState } from "./types";
import { getValidMilitaryTargets } from "./decisions";

function scoreTarget(region: RegionState, faction: FactionState): number {
  const coreBonus = region.coreFactionIds.includes(faction.id) ? 30 : 0;
  const value = region.population / 100000 + region.taxCapacity + region.agriculture;
  const weakness = 100 - region.control + Math.max(0, 50000 - region.garrison) / 2000;
  const frontierBonus = faction.traits.some((trait) => trait.includes("辽东")) && region.id.includes("liao") ? 25 : 0;
  return value + weakness + coreBonus + frontierBonus;
}

export function chooseDomesticFocus(faction: FactionState, regions: RegionState[]): DomesticFocus {
  const averageStability = regions.reduce((sum, region) => sum + region.stability, 0) / Math.max(1, regions.length);
  const grainLow = faction.grainReserve < faction.armyTotal * 1.5;
  if (grainLow) return "agriculture";
  if (faction.treasury < faction.armyTotal * 6) return "finance";
  if (faction.corruption > 45) return "administration";
  if (averageStability < 55) return "recovery";
  if (faction.aiProfile.aggression > 60) return "military";
  return "frontier";
}

export function chooseAiDecision(state: GameState, factionId: string): PlayerDecision {
  const faction = state.factions[factionId];
  const controlledRegions = Object.values(state.regions).filter((region) => region.controllerFactionId === factionId);
  const targets = getValidMilitaryTargets(state, factionId);
  const targetRegionId =
    targets
      .map((targetId) => state.regions[targetId])
      .sort((a, b) => scoreTarget(b, faction) - scoreTarget(a, faction))[0]?.id ?? null;
  const posture = faction.aiProfile.riskTolerance > 60 ? "aggressive" : faction.aiProfile.defensePriority > 65 ? "conservative" : "balanced";
  return {
    targetRegionId,
    posture,
    domesticFocus: chooseDomesticFocus(faction, controlledRegions)
  };
}

export function chooseAllAiDecisions(state: GameState): Record<string, PlayerDecision> {
  return Object.fromEntries(
    Object.values(state.factions)
      .filter((faction) => faction.id !== state.playerFactionId && faction.status === "active")
      .map((faction) => [faction.id, chooseAiDecision(state, faction.id)])
  );
}
```

- [ ] **Step 3: Test valid targets and AI**

Create `src/tests/decisions-ai.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chooseAiDecision, chooseDomesticFocus } from "../core/ai";
import { getValidMilitaryTargets, normalizePlayerDecision } from "../core/decisions";
import { createMvpScenario } from "../data/scenarios";

describe("decision validation", () => {
  it("returns adjacent enemy targets", () => {
    const state = createMvpScenario("ming");
    expect(getValidMilitaryTargets(state, "ming")).toContain("tumed_steppe");
    expect(getValidMilitaryTargets(state, "ming")).toContain("jianzhou");
  });

  it("replaces invalid player targets with a valid target", () => {
    const state = createMvpScenario("ming");
    const decision = normalizePlayerDecision(state, {
      targetRegionId: "jiangnan",
      posture: "balanced",
      domesticFocus: "administration"
    });
    expect(decision.targetRegionId).not.toBe("jiangnan");
  });
});

describe("AI choices", () => {
  it("chooses a military target for Jianzhou", () => {
    const state = createMvpScenario("ming");
    const decision = chooseAiDecision(state, "jianzhou");
    expect(decision.targetRegionId).toBeTruthy();
  });

  it("responds to treasury crisis with finance focus", () => {
    const state = createMvpScenario();
    const faction = { ...state.factions.ming, treasury: 1 };
    const regions = Object.values(state.regions).filter((region) => region.controllerFactionId === "ming");
    expect(chooseDomesticFocus(faction, regions)).toBe("finance");
  });
});
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm test -- src/tests/decisions-ai.test.ts
npm run build
git add src/core/decisions.ts src/core/ai.ts src/tests/decisions-ai.test.ts
git commit -m "feat: add decision validation and ai choices"
```

---

### Task 7: Warfare, Control, and Rebellion

**Files:**
- Create: `src/core/warfare.ts`
- Create: `src/core/control.ts`
- Create: `src/core/rebellion.ts`
- Test: `src/tests/war-control-rebellion.test.ts`

- [ ] **Step 1: Implement battle resolution**

Create `src/core/warfare.ts`:

```ts
import type { FactionState, MilitaryPosture, RegionState, WarState } from "./types";
import type { RandomSource } from "./random";

export interface BattleResult {
  region: RegionState;
  attacker: FactionState;
  defender: FactionState;
  report: string;
  war: WarState | null;
}

const postureMultiplier: Record<MilitaryPosture, number> = {
  conservative: 0.72,
  balanced: 1,
  aggressive: 1.28
};

export function resolveBattle(
  region: RegionState,
  attacker: FactionState,
  defender: FactionState,
  posture: MilitaryPosture,
  random: RandomSource
): BattleResult {
  const attackerCommitted = Math.min(attacker.armyTotal, Math.round(attacker.armyTotal * 0.18 * postureMultiplier[posture]));
  const defenderCommitted = Math.min(defender.armyTotal, region.garrison);
  const terrainDefense = region.terrain === "mountain" ? 1.25 : region.terrain === "river" ? 1.12 : 1;
  const attackerPower =
    attackerCommitted * (attacker.militaryOrganization / 100) * (1 - attacker.warExhaustion / 200) * (0.9 + random.next() * 0.25);
  const defenderPower =
    defenderCommitted * (defender.militaryOrganization / 100) * terrainDefense * (region.fortification / 120 + 0.5) * (0.9 + random.next() * 0.25);
  const attackerWins = attackerPower > defenderPower;
  const attackerLoss = Math.round(attackerCommitted * (attackerWins ? 0.08 : 0.18));
  const defenderLoss = Math.round(defenderCommitted * (attackerWins ? 0.18 : 0.08));
  const nextControl = attackerWins ? Math.max(20, region.control - 18) : Math.max(25, region.control - 6);
  const captured = attackerWins && nextControl <= 35;

  return {
    region: {
      ...region,
      controllerFactionId: captured ? attacker.id : region.controllerFactionId,
      control: captured ? 38 : nextControl,
      garrison: Math.max(1000, region.garrison - defenderLoss)
    },
    attacker: {
      ...attacker,
      armyTotal: Math.max(0, attacker.armyTotal - attackerLoss),
      warExhaustion: Math.min(100, attacker.warExhaustion + (posture === "aggressive" ? 3 : 2))
    },
    defender: {
      ...defender,
      armyTotal: Math.max(0, defender.armyTotal - defenderLoss),
      warExhaustion: Math.min(100, defender.warExhaustion + 2)
    },
    report: captured
      ? `${attacker.name}攻占${region.name}，当地控制度骤降。`
      : `${attacker.name}进攻${region.name}，双方均有损失。`,
    war: captured
      ? null
      : {
          id: `${attacker.id}-${defender.id}-${region.id}`,
          attackerFactionId: attacker.id,
          defenderFactionId: defender.id,
          targetRegionId: region.id,
          progress: attackerWins ? 60 : 35,
          monthsActive: 1
        }
  };
}
```

- [ ] **Step 2: Implement control update**

Create `src/core/control.ts`:

```ts
import type { FactionState, RegionState } from "./types";

export function updateControl(region: RegionState, controller: FactionState): RegionState {
  const legitimacyBoost = controller.legitimacy / 60;
  const adminBoost = controller.administration / 80;
  const corePenalty = region.coreFactionIds.includes(controller.id) ? 0 : 1.8;
  const garrisonBoost = Math.min(2.5, region.garrison / Math.max(1, region.population) * 35);
  const nextControl = Math.max(
    0,
    Math.min(100, region.control + legitimacyBoost + adminBoost + garrisonBoost - corePenalty - region.rebelPressure / 40)
  );
  return {
    ...region,
    control: Math.round(nextControl)
  };
}
```

- [ ] **Step 3: Implement rebellion risk**

Create `src/core/rebellion.ts`:

```ts
import type { FactionState, RegionState } from "./types";

export interface RebellionResult {
  region: RegionState;
  erupted: boolean;
  report: string | null;
}

export function calculateRebellionRisk(region: RegionState, faction: FactionState): number {
  const lowStability = Math.max(0, 65 - region.stability);
  const lowControl = Math.max(0, 70 - region.control);
  const hunger = region.grainStock < region.population * 0.1 ? 18 : 0;
  const taxPressure = faction.corruption / 3;
  const garrisonSuppression = Math.min(25, region.garrison / Math.max(1, region.population) * 1000);
  return Math.max(0, lowStability + lowControl + hunger + taxPressure + region.rebelPressure - garrisonSuppression);
}

export function updateRebellion(region: RegionState, faction: FactionState): RebellionResult {
  const risk = calculateRebellionRisk(region, faction);
  const nextPressure = Math.min(100, region.rebelPressure + risk / 25);
  const erupted = nextPressure >= 75;
  return {
    region: {
      ...region,
      rebelPressure: erupted ? 45 : Math.round(nextPressure),
      stability: erupted ? Math.max(0, region.stability - 12) : region.stability
    },
    erupted,
    report: erupted ? `${region.name}民变扩大，当地叛乱压力转化为武装冲突。` : null
  };
}
```

- [ ] **Step 4: Test war, control, and rebellion**

Create `src/tests/war-control-rebellion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { updateControl } from "../core/control";
import { calculateRebellionRisk, updateRebellion } from "../core/rebellion";
import { createRandom } from "../core/random";
import { resolveBattle } from "../core/warfare";
import { createMvpScenario } from "../data/scenarios";

describe("warfare", () => {
  it("resolves a battle without negative armies", () => {
    const state = createMvpScenario();
    const result = resolveBattle(
      state.regions.liaodong,
      state.factions.jianzhou,
      state.factions.ming,
      "aggressive",
      createRandom(9)
    );
    expect(result.attacker.armyTotal).toBeGreaterThanOrEqual(0);
    expect(result.defender.armyTotal).toBeGreaterThanOrEqual(0);
    expect(result.report).toContain("辽东");
  });
});

describe("control", () => {
  it("raises control for legitimate core holders", () => {
    const state = createMvpScenario();
    const before = state.regions.beijing.control;
    const after = updateControl(state.regions.beijing, state.factions.ming);
    expect(after.control).toBeGreaterThanOrEqual(before);
  });
});

describe("rebellion", () => {
  it("increases rebellion risk under hunger and low stability", () => {
    const state = createMvpScenario();
    const region = { ...state.regions.shaanxi, grainStock: 1, stability: 30, control: 40 };
    expect(calculateRebellionRisk(region, state.factions.ming)).toBeGreaterThan(50);
    expect(updateRebellion({ ...region, rebelPressure: 74 }, state.factions.ming).erupted).toBe(true);
  });
});
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/tests/war-control-rebellion.test.ts
npm run build
git add src/core/warfare.ts src/core/control.ts src/core/rebellion.ts src/tests/war-control-rebellion.test.ts
git commit -m "feat: add war control and rebellion systems"
```

---

### Task 8: Event Engine and MVP Events

**Files:**
- Create: `src/core/eventEngine.ts`
- Create: `src/data/events.ts`
- Test: `src/tests/events.test.ts`

- [ ] **Step 1: Add event types to `src/core/eventEngine.ts`**

Create `src/core/eventEngine.ts`:

```ts
import { isInDateWindow } from "./calendar";
import type { EventId, FactionId, GameState, Modifier, RegionId } from "./types";

export type EventCondition =
  | { type: "faction_exists"; factionId: FactionId }
  | { type: "date_window"; start: string; end: string }
  | { type: "flag_absent"; flag: string }
  | { type: "region_controller"; regionId: RegionId; factionId: FactionId }
  | { type: "faction_treasury_below"; factionId: FactionId; value: number };

export interface EventEffect {
  factionId?: FactionId;
  regionId?: RegionId;
  treasury?: number;
  grain?: number;
  administration?: number;
  corruption?: number;
  legitimacy?: number;
  stability?: number;
  control?: number;
  setFlag?: string;
  modifier?: Modifier;
}

export interface EventOption {
  id: string;
  name: string;
  shortEffect: string;
  effects: EventEffect[];
}

export interface GameEvent {
  id: EventId;
  name: string;
  category: "fixed" | "conditional" | "faction" | "region" | "chain" | "global";
  description: string;
  priority: number;
  conditions: EventCondition[];
  options: EventOption[];
}

export function eventConditionMet(state: GameState, condition: EventCondition): boolean {
  switch (condition.type) {
    case "faction_exists":
      return state.factions[condition.factionId]?.status === "active";
    case "date_window":
      return isInDateWindow(state.currentDate, condition.start, condition.end);
    case "flag_absent":
      return !state.eventFlags[condition.flag];
    case "region_controller":
      return state.regions[condition.regionId]?.controllerFactionId === condition.factionId;
    case "faction_treasury_below":
      return (state.factions[condition.factionId]?.treasury ?? Number.POSITIVE_INFINITY) < condition.value;
  }
}

export function findTriggeredEvents(state: GameState, events: GameEvent[]): GameEvent[] {
  return events
    .filter((event) => !state.eventFlags[`event:${event.id}`])
    .filter((event) => event.conditions.every((condition) => eventConditionMet(state, condition)))
    .sort((a, b) => b.priority - a.priority);
}

export function applyEventOption(state: GameState, event: GameEvent, optionId: string): GameState {
  const option = event.options.find((item) => item.id === optionId);
  if (!option) {
    throw new Error(`Unknown option ${optionId} for event ${event.id}`);
  }

  const next: GameState = structuredClone(state);
  next.eventFlags[`event:${event.id}`] = true;

  for (const effect of option.effects) {
    if (effect.factionId) {
      const faction = next.factions[effect.factionId];
      faction.treasury += effect.treasury ?? 0;
      faction.grainReserve += effect.grain ?? 0;
      faction.administration = clamp(faction.administration + (effect.administration ?? 0));
      faction.corruption = clamp(faction.corruption + (effect.corruption ?? 0));
      faction.legitimacy = clamp(faction.legitimacy + (effect.legitimacy ?? 0));
    }
    if (effect.regionId) {
      const region = next.regions[effect.regionId];
      region.stability = clamp(region.stability + (effect.stability ?? 0));
      region.control = clamp(region.control + (effect.control ?? 0));
    }
    if (effect.setFlag) {
      next.eventFlags[effect.setFlag] = true;
    }
    if (effect.modifier) {
      next.activeModifiers.push(effect.modifier);
    }
  }

  next.reports.unshift({
    id: `${state.currentDate}-${event.id}`,
    date: state.currentDate,
    type: "event",
    title: event.name,
    body: `${option.name}：${option.shortEffect}`,
    severity: "warning"
  });

  return next;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
```

- [ ] **Step 2: Create MVP event data**

Create `src/data/events.ts`:

```ts
import type { GameEvent } from "../core/eventEngine";

export const mvpEvents: GameEvent[] = [
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
        effects: [{ factionId: "ming", administration: 6, corruption: -4, legitimacy: -3 }]
      },
      {
        id: "purge_zhang",
        name: "清算张居正",
        shortEffect: "获得短期合法性和国库，行政与腐败恶化。",
        effects: [{ factionId: "ming", treasury: 300000, administration: -8, corruption: 7, legitimacy: 5 }]
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
          { factionId: "ming", treasury: -600000, grain: -450000 },
          { regionId: "bozhou", control: -22, stability: -10 }
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
          { factionId: "jianzhou", administration: 4, legitimacy: 5 },
          { regionId: "jianzhou", stability: 5, control: 8 }
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
          { factionId: "ming", treasury: -900000, grain: -700000 },
          { regionId: "liaodong", control: 12, stability: -4 }
        ]
      },
      {
        id: "preserve_strength",
        name: "保存实力",
        shortEffect: "减少消耗，但辽东控制下降。",
        effects: [
          { factionId: "ming", legitimacy: -4 },
          { regionId: "liaodong", control: -18, stability: -6 }
        ]
      }
    ]
  }
];
```

- [ ] **Step 3: Test event detection and application**

Create `src/tests/events.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyEventOption, findTriggeredEvents } from "../core/eventEngine";
import { mvpEvents } from "../data/events";
import { createMvpScenario } from "../data/scenarios";

describe("event engine", () => {
  it("finds date-window events", () => {
    const state = createMvpScenario("ming");
    const events = findTriggeredEvents(state, mvpEvents);
    expect(events.map((event) => event.id)).toContain("zhang_reform_pressure");
  });

  it("applies selected option effects and sets event flag", () => {
    const state = createMvpScenario("ming");
    const event = findTriggeredEvents(state, mvpEvents)[0];
    const next = applyEventOption(state, event, event.options[0].id);
    expect(next.eventFlags[`event:${event.id}`]).toBe(true);
    expect(next.reports[0].type).toBe("event");
  });
});
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm test -- src/tests/events.test.ts
npm run build
git add src/core/eventEngine.ts src/data/events.ts src/tests/events.test.ts
git commit -m "feat: add event engine and mvp events"
```

---

### Task 9: Monthly Simulation Orchestrator

**Files:**
- Create: `src/core/simulation.ts`
- Test: `src/tests/simulation.test.ts`

- [ ] **Step 1: Implement `simulateMonth`**

Create `src/core/simulation.ts`:

```ts
import { chooseAllAiDecisions } from "./ai";
import { advanceMonth, isAfter } from "./calendar";
import { updateControl } from "./control";
import { normalizePlayerDecision } from "./decisions";
import { calculateFactionMaintenance, calculateRegionEconomy } from "./economy";
import { findTriggeredEvents } from "./eventEngine";
import { calculatePopulation } from "./population";
import { createRandom } from "./random";
import { updateRebellion } from "./rebellion";
import { resolveBattle } from "./warfare";
import { mvpEvents } from "../data/events";
import type { FactionState, GameState, MonthlyReport, PlayerDecision, SimulationInput, SimulationResult } from "./types";

export function simulateMonth(input: SimulationInput): SimulationResult {
  const state = structuredClone(input.state);
  const random = createRandom(input.randomSeed);
  const reports: MonthlyReport[] = [];
  const playerDecision = normalizePlayerDecision(state, input.playerDecision);
  const aiDecisions = chooseAllAiDecisions(state);

  for (const region of Object.values(state.regions)) {
    const controller = state.factions[region.controllerFactionId];
    const population = calculatePopulation(region, playerDecision.domesticFocus);
    let nextRegion = { ...region, population: population.nextPopulation };
    const economy = calculateRegionEconomy(nextRegion, controller, focusForFaction(controller, state, playerDecision, aiDecisions));
    nextRegion = economy.region;
    nextRegion = updateControl(nextRegion, controller);
    const rebellion = updateRebellion(nextRegion, controller);
    nextRegion = rebellion.region;
    state.regions[region.id] = nextRegion;
    controller.treasury += economy.treasuryDelta;
    controller.grainReserve += economy.grainDelta;

    if (population.deaths > 0 || population.migrants > 0) {
      reports.push({
        id: `${state.currentDate}-${region.id}-population`,
        date: state.currentDate,
        type: "economy",
        title: `${region.name}人口波动`,
        body: `增长${population.growth}，死亡${population.deaths}，外迁${population.migrants}。`,
        severity: population.deaths > population.growth ? "warning" : "info"
      });
    }

    if (rebellion.report) {
      reports.push({
        id: `${state.currentDate}-${region.id}-rebellion`,
        date: state.currentDate,
        type: "rebellion",
        title: `${region.name}叛乱扩大`,
        body: rebellion.report,
        severity: "danger"
      });
    }
  }

  for (const faction of Object.values(state.factions)) {
    if (faction.status !== "active") continue;
    const maintenance = calculateFactionMaintenance(faction);
    faction.treasury -= maintenance.treasuryCost;
    faction.grainReserve -= maintenance.grainCost;
    if (faction.treasury < 0) {
      faction.warExhaustion = Math.min(100, faction.warExhaustion + 4);
      reports.push({
        id: `${state.currentDate}-${faction.id}-deficit`,
        date: state.currentDate,
        type: "economy",
        title: `${faction.name}财政赤字`,
        body: "军费与官僚维护超过收入，战争疲劳上升。",
        severity: "warning"
      });
    }
  }

  const decisions: Record<string, PlayerDecision> = {
    [state.playerFactionId]: playerDecision,
    ...aiDecisions
  };

  for (const [factionId, decision] of Object.entries(decisions)) {
    if (!decision.targetRegionId) continue;
    const attacker = state.factions[factionId];
    const target = state.regions[decision.targetRegionId];
    const defender = state.factions[target.controllerFactionId];
    if (!attacker || !defender || attacker.id === defender.id) continue;
    const battle = resolveBattle(target, attacker, defender, decision.posture, random);
    state.regions[target.id] = battle.region;
    state.factions[attacker.id] = battle.attacker;
    state.factions[defender.id] = battle.defender;
    reports.push({
      id: `${state.currentDate}-${attacker.id}-${target.id}-battle`,
      date: state.currentDate,
      type: "war",
      title: `${attacker.name}进攻${target.name}`,
      body: battle.report,
      severity: battle.region.controllerFactionId === attacker.id ? "danger" : "info"
    });
    if (battle.war) {
      state.wars = state.wars.filter((war) => war.id !== battle.war?.id).concat(battle.war);
    }
  }

  const triggered = findTriggeredEvents(state, mvpEvents).slice(0, 1);
  const nextDate = advanceMonth(state.currentDate);
  state.currentDate = nextDate;
  state.seed = random.seed;
  state.reports = [...reports, ...state.reports].slice(0, 300);
  state.history.push({
    date: nextDate,
    summary: `${nextDate} 月度结算完成。`,
    factionCount: Object.values(state.factions).filter((faction) => faction.status === "active").length,
    controlledRegions: countControlledRegions(state)
  });
  state.alerts = triggered.map((event) => ({
    id: `alert-${event.id}`,
    title: event.name,
    body: event.description,
    severity: "warning"
  }));
  state.gameStatus = isAfter(nextDate, state.endDate) ? "finished" : triggered.length > 0 ? "paused" : "playing";

  return {
    nextState: state,
    reports,
    triggeredEvents: triggered.map((event) => ({ eventId: event.id, optionRequired: true })),
    alerts: state.alerts
  };
}

function focusForFaction(
  faction: FactionState,
  state: GameState,
  playerDecision: PlayerDecision,
  aiDecisions: Record<string, PlayerDecision>
) {
  return faction.id === state.playerFactionId
    ? playerDecision.domesticFocus
    : aiDecisions[faction.id]?.domesticFocus ?? "recovery";
}

function countControlledRegions(state: GameState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const region of Object.values(state.regions)) {
    counts[region.controllerFactionId] = (counts[region.controllerFactionId] ?? 0) + 1;
  }
  return counts;
}
```

- [ ] **Step 2: Test monthly simulation**

Create `src/tests/simulation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { simulateMonth } from "../core/simulation";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("monthly simulation", () => {
  it("advances one month and records history", () => {
    const state = createMvpScenario("ming", 1573);
    const result = simulateMonth({
      state,
      playerDecision: defaultPlayerDecision,
      randomSeed: state.seed
    });
    expect(result.nextState.currentDate).toBe("1573-02");
    expect(result.nextState.history).toHaveLength(1);
    expect(result.nextState.reports.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same seed and decision", () => {
    const a = createMvpScenario("ming", 42);
    const b = createMvpScenario("ming", 42);
    const first = simulateMonth({ state: a, playerDecision: defaultPlayerDecision, randomSeed: a.seed });
    const second = simulateMonth({ state: b, playerDecision: defaultPlayerDecision, randomSeed: b.seed });
    expect(first.nextState).toEqual(second.nextState);
  });
});
```

- [ ] **Step 3: Verify and commit**

Run:

```powershell
npm test -- src/tests/simulation.test.ts
npm run build
git add src/core/simulation.ts src/tests/simulation.test.ts
git commit -m "feat: orchestrate monthly simulation"
```

---

### Task 10: Batch Simulation CLI

**Files:**
- Create: `src/core/scoring.ts`
- Create: `src/scripts/runBatchSimulation.ts`
- Test: `src/tests/batch-simulation.test.ts`

- [ ] **Step 1: Implement MVP scoring**

Create `src/core/scoring.ts`:

```ts
import type { FactionId, GameState } from "./types";

export interface FactionScore {
  factionId: FactionId;
  factionName: string;
  controlledRegions: number;
  controlledPopulation: number;
  treasury: number;
  grainReserve: number;
  averageStability: number;
  legitimacy: number;
  score: number;
}

export function scoreFaction(state: GameState, factionId: FactionId): FactionScore {
  const faction = state.factions[factionId];
  const regions = Object.values(state.regions).filter((region) => region.controllerFactionId === factionId);
  const controlledPopulation = regions.reduce((sum, region) => sum + region.population, 0);
  const averageStability =
    regions.length === 0 ? 0 : regions.reduce((sum, region) => sum + region.stability, 0) / regions.length;
  const score = Math.round(
    controlledPopulation / 10000 +
      regions.length * 120 +
      Math.max(0, faction.treasury) / 50000 +
      Math.max(0, faction.grainReserve) / 75000 +
      averageStability * 4 +
      faction.legitimacy * 3 -
      faction.warExhaustion * 5
  );
  return {
    factionId,
    factionName: faction.name,
    controlledRegions: regions.length,
    controlledPopulation,
    treasury: faction.treasury,
    grainReserve: faction.grainReserve,
    averageStability: Number(averageStability.toFixed(1)),
    legitimacy: faction.legitimacy,
    score
  };
}

export function scoreAllFactions(state: GameState): FactionScore[] {
  return Object.keys(state.factions)
    .map((factionId) => scoreFaction(state, factionId))
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 2: Create batch runner**

Create `src/scripts/runBatchSimulation.ts`:

```ts
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
}

export function runBatchSimulation(runs = 100, months = 240): BatchSummary {
  let totalMingRegions = 0;
  let totalTopScore = 0;
  let totalReports = 0;
  let finishedRuns = 0;

  for (let index = 0; index < runs; index += 1) {
    let state = createMvpScenario("ming", 157301 + index);
    for (let month = 0; month < months && state.gameStatus !== "finished"; month += 1) {
      const result = simulateMonth({
        state,
        playerDecision: defaultPlayerDecision,
        randomSeed: state.seed
      });
      state = result.nextState;
    }
    totalMingRegions += Object.values(state.regions).filter((region) => region.controllerFactionId === "ming").length;
    totalTopScore += scoreAllFactions(state)[0]?.score ?? 0;
    totalReports += state.reports.length;
    if (state.gameStatus === "finished") {
      finishedRuns += 1;
    }
  }

  return {
    runs,
    months,
    averageMingRegions: Number((totalMingRegions / runs).toFixed(2)),
    averageTopScore: Number((totalTopScore / runs).toFixed(2)),
    averageReports: Number((totalReports / runs).toFixed(2)),
    finishedRuns
  };
}

if (process.argv[1]?.includes("runBatchSimulation")) {
  const runs = Number(process.argv[2] ?? 100);
  const months = Number(process.argv[3] ?? 240);
  console.log(JSON.stringify(runBatchSimulation(runs, months), null, 2));
}
```

- [ ] **Step 3: Test scoring and batch runner**

Create `src/tests/batch-simulation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scoreAllFactions } from "../core/scoring";
import { runBatchSimulation } from "../scripts/runBatchSimulation";
import { createMvpScenario } from "../data/scenarios";

describe("scoring", () => {
  it("ranks factions with numeric scores", () => {
    const scores = scoreAllFactions(createMvpScenario());
    expect(scores[0].score).toBeGreaterThan(0);
    expect(scores[0].controlledRegions).toBeGreaterThan(0);
  });
});

describe("batch simulation", () => {
  it("returns stable aggregate metrics", () => {
    const summary = runBatchSimulation(3, 12);
    expect(summary.runs).toBe(3);
    expect(summary.months).toBe(12);
    expect(summary.averageMingRegions).toBeGreaterThan(0);
    expect(summary.averageTopScore).toBeGreaterThan(0);
    expect(summary.averageReports).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Verify CLI and commit**

Run:

```powershell
npm test -- src/tests/batch-simulation.test.ts
npm run batch -- 5 24
npm run build
git add src/core/scoring.ts src/scripts/runBatchSimulation.ts src/tests/batch-simulation.test.ts
git commit -m "feat: add scoring and batch simulation runner"
```

Expected: CLI prints JSON with `runs`, `months`, `averageMingRegions`, `averageTopScore`, `averageReports`, and `finishedRuns`.

---

### Task 11: Save Manager and Store

**Files:**
- Create: `src/save/saveManager.ts`
- Create: `src/store/gameStore.ts`
- Test: `src/tests/save-store.test.ts`

- [ ] **Step 1: Implement IndexedDB save manager**

Create `src/save/saveManager.ts`:

```ts
import type { GameState, PlayerDecision } from "../core/types";

export interface SaveGame {
  id: string;
  name: string;
  savedAt: string;
  state: GameState;
  decision: PlayerDecision;
  version: string;
}

const dbName = "wanli-collapse";
const storeName = "saves";

export function createSaveGame(name: string, state: GameState, decision: PlayerDecision): SaveGame {
  return {
    id: `${Date.now()}-${state.currentDate}`,
    name,
    savedAt: new Date().toISOString(),
    state,
    decision,
    version: state.version
  };
}

export function openSaveDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveGame(save: SaveGame): Promise<void> {
  const db = await openSaveDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(save);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listSaves(): Promise<SaveGame[]> {
  const db = await openSaveDb();
  const saves = await new Promise<SaveGame[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as SaveGame[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return saves.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
```

- [ ] **Step 2: Implement Zustand store**

Create `src/store/gameStore.ts`:

```ts
import { create } from "zustand";
import { applyEventOption } from "../core/eventEngine";
import { simulateMonth } from "../core/simulation";
import type { GameEvent } from "../core/eventEngine";
import type { GameState, MapLayer, PlayerDecision, RegionId } from "../core/types";
import { mvpEvents } from "../data/events";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

interface GameStore {
  state: GameState;
  decision: PlayerDecision;
  selectedRegionId: RegionId | null;
  mapLayer: MapLayer;
  pendingEventId: string | null;
  startGame: (factionId: string, seed: number) => void;
  setDecision: (decision: Partial<PlayerDecision>) => void;
  selectRegion: (regionId: RegionId | null) => void;
  setMapLayer: (layer: MapLayer) => void;
  advanceOneMonth: () => void;
  resolveEvent: (optionId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createMvpScenario(),
  decision: defaultPlayerDecision,
  selectedRegionId: "beijing",
  mapLayer: "control",
  pendingEventId: null,
  startGame: (factionId, seed) =>
    set({
      state: createMvpScenario(factionId, seed),
      decision: defaultPlayerDecision,
      selectedRegionId: "beijing",
      pendingEventId: null
    }),
  setDecision: (decision) => set({ decision: { ...get().decision, ...decision } }),
  selectRegion: (regionId) => set({ selectedRegionId: regionId }),
  setMapLayer: (layer) => set({ mapLayer: layer }),
  advanceOneMonth: () => {
    const current = get();
    const result = simulateMonth({
      state: current.state,
      playerDecision: current.decision,
      randomSeed: current.state.seed
    });
    set({
      state: result.nextState,
      pendingEventId: result.triggeredEvents[0]?.eventId ?? null
    });
  },
  resolveEvent: (optionId) => {
    const current = get();
    const event = mvpEvents.find((item): item is GameEvent => item.id === current.pendingEventId);
    if (!event) return;
    set({
      state: applyEventOption(current.state, event, optionId),
      pendingEventId: null
    });
  }
}));
```

- [ ] **Step 3: Test save object and store actions**

Create `src/tests/save-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSaveGame } from "../save/saveManager";
import { useGameStore } from "../store/gameStore";
import { createMvpScenario, defaultPlayerDecision } from "../data/scenarios";

describe("save manager", () => {
  it("creates versioned save objects", () => {
    const state = createMvpScenario("ming", 1);
    const save = createSaveGame("测试存档", state, defaultPlayerDecision);
    expect(save.version).toBe("0.1.0");
    expect(save.state.currentDate).toBe("1573-01");
  });
});

describe("game store", () => {
  it("starts and advances a game", () => {
    useGameStore.getState().startGame("ming", 77);
    useGameStore.getState().advanceOneMonth();
    expect(useGameStore.getState().state.currentDate).toBe("1573-02");
  });
});
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm test -- src/tests/save-store.test.ts
npm run build
git add src/save/saveManager.ts src/store/gameStore.ts src/tests/save-store.test.ts
git commit -m "feat: add save manager and game store"
```

---

### Task 12: Main UI Shell

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.css`
- Create: `src/ui/layout/TopBar.tsx`
- Create: `src/ui/panels/DecisionPanel.tsx`
- Create: `src/ui/panels/RegionPanel.tsx`
- Create: `src/ui/panels/LogPanel.tsx`
- Create: `src/ui/common/StatBadge.tsx`
- Test: `src/tests/app-ui.test.tsx`

- [ ] **Step 1: Create reusable stat badge**

Create `src/ui/common/StatBadge.tsx`:

```tsx
interface StatBadgeProps {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "danger";
}

export function StatBadge({ label, value, tone = "default" }: StatBadgeProps) {
  return (
    <div className={`stat-badge stat-badge--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
```

- [ ] **Step 2: Create top bar**

Create `src/ui/layout/TopBar.tsx`:

```tsx
import { formatChineseDate } from "../../core/calendar";
import type { GameState } from "../../core/types";
import { StatBadge } from "../common/StatBadge";

interface TopBarProps {
  state: GameState;
  onAdvance: () => void;
}

export function TopBar({ state, onAdvance }: TopBarProps) {
  const faction = state.factions[state.playerFactionId];
  return (
    <header className="top-bar">
      <div>
        <strong>{formatChineseDate(state.currentDate)}</strong>
        <span className="era-label">万历朝推演</span>
      </div>
      <StatBadge label="国库" value={Math.round(faction.treasury).toLocaleString()} tone={faction.treasury < 0 ? "danger" : "default"} />
      <StatBadge label="粮食" value={Math.round(faction.grainReserve).toLocaleString()} tone={faction.grainReserve < 0 ? "danger" : "default"} />
      <StatBadge label="军队" value={Math.round(faction.armyTotal).toLocaleString()} />
      <StatBadge label="疲劳" value={faction.warExhaustion} tone={faction.warExhaustion > 60 ? "warning" : "default"} />
      <button className="primary-button" onClick={onAdvance} disabled={state.gameStatus === "finished"}>
        推进一月
      </button>
    </header>
  );
}
```

- [ ] **Step 3: Create decision panel**

Create `src/ui/panels/DecisionPanel.tsx`:

```tsx
import type { DomesticFocus, GameState, MilitaryPosture, PlayerDecision } from "../../core/types";
import { getValidMilitaryTargets } from "../../core/decisions";

interface DecisionPanelProps {
  state: GameState;
  decision: PlayerDecision;
  onChange: (decision: Partial<PlayerDecision>) => void;
}

const focusOptions: Array<[DomesticFocus, string]> = [
  ["agriculture", "劝课农桑"],
  ["finance", "整顿财政"],
  ["military", "整军备战"],
  ["administration", "澄清吏治"],
  ["recovery", "休养生息"],
  ["frontier", "经略边疆"]
];

const postureOptions: Array<[MilitaryPosture, string]> = [
  ["conservative", "保守"],
  ["balanced", "均衡"],
  ["aggressive", "激进"]
];

export function DecisionPanel({ state, decision, onChange }: DecisionPanelProps) {
  const targets = getValidMilitaryTargets(state, state.playerFactionId);
  return (
    <section className="side-panel">
      <h2>战略决策</h2>
      <label>
        军事方向
        <select value={decision.targetRegionId ?? ""} onChange={(event) => onChange({ targetRegionId: event.target.value || null })}>
          {targets.map((targetId) => (
            <option key={targetId} value={targetId}>
              {state.regions[targetId].name}
            </option>
          ))}
        </select>
      </label>
      <label>
        军事姿态
        <select value={decision.posture} onChange={(event) => onChange({ posture: event.target.value as MilitaryPosture })}>
          {postureOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        内政重点
        <select value={decision.domesticFocus} onChange={(event) => onChange({ domesticFocus: event.target.value as DomesticFocus })}>
          {focusOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
```

- [ ] **Step 4: Create region and log panels**

Create `src/ui/panels/RegionPanel.tsx`:

```tsx
import type { GameState, RegionId } from "../../core/types";
import { StatBadge } from "../common/StatBadge";

interface RegionPanelProps {
  state: GameState;
  selectedRegionId: RegionId | null;
}

export function RegionPanel({ state, selectedRegionId }: RegionPanelProps) {
  const region = selectedRegionId ? state.regions[selectedRegionId] : null;
  if (!region) {
    return <section className="side-panel"><h2>区域详情</h2><p>请选择地图区域。</p></section>;
  }
  const faction = state.factions[region.controllerFactionId];
  return (
    <section className="side-panel">
      <h2>{region.name}</h2>
      <p className="muted">控制者：{faction.name}</p>
      <div className="stat-grid">
        <StatBadge label="人口" value={region.population.toLocaleString()} />
        <StatBadge label="粮食" value={region.grainStock.toLocaleString()} />
        <StatBadge label="税力" value={region.taxCapacity} />
        <StatBadge label="驻军" value={region.garrison.toLocaleString()} />
        <StatBadge label="稳定" value={region.stability} tone={region.stability < 50 ? "warning" : "default"} />
        <StatBadge label="控制" value={region.control} tone={region.control < 50 ? "warning" : "default"} />
      </div>
    </section>
  );
}
```

Create `src/ui/panels/LogPanel.tsx`:

```tsx
import type { MonthlyReport } from "../../core/types";

interface LogPanelProps {
  reports: MonthlyReport[];
}

export function LogPanel({ reports }: LogPanelProps) {
  return (
    <section className="log-panel">
      <h2>月度日志</h2>
      <div className="log-list">
        {reports.slice(0, 12).map((report) => (
          <article key={report.id} className={`log-item log-item--${report.severity}`}>
            <strong>{report.title}</strong>
            <span>{report.date}</span>
            <p>{report.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Wire the app shell**

Modify `src/app/App.tsx`:

```tsx
import { TopBar } from "../ui/layout/TopBar";
import { DecisionPanel } from "../ui/panels/DecisionPanel";
import { LogPanel } from "../ui/panels/LogPanel";
import { RegionPanel } from "../ui/panels/RegionPanel";
import { useGameStore } from "../store/gameStore";

export function App() {
  const { state, decision, selectedRegionId, advanceOneMonth, setDecision } = useGameStore();
  return (
    <main className="app-shell">
      <TopBar state={state} onAdvance={advanceOneMonth} />
      <div className="main-grid">
        <DecisionPanel state={state} decision={decision} onChange={setDecision} />
        <section className="map-placeholder">
          <h1>万历：山河崩塌</h1>
          <p>地图原型将在下一任务接入。当前可先推进月份并观察日志。</p>
        </section>
        <RegionPanel state={state} selectedRegionId={selectedRegionId} />
      </div>
      <LogPanel reports={state.reports} />
    </main>
  );
}
```

Replace `src/app/App.css` with:

```css
:root {
  color: #251f1b;
  background: #efe8dc;
  font-family:
    "Noto Sans SC",
    "Microsoft YaHei",
    system-ui,
    sans-serif;
}

body {
  margin: 0;
}

button,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 16px;
  box-sizing: border-box;
}

.top-bar,
.side-panel,
.map-placeholder,
.log-panel {
  border: 1px solid #c7b89f;
  background: #fffaf0;
  border-radius: 6px;
}

.top-bar {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  overflow-x: auto;
}

.era-label,
.muted {
  color: #72675b;
  margin-left: 8px;
}

.primary-button {
  border: 0;
  border-radius: 6px;
  background: #9f332b;
  color: #fff;
  padding: 10px 14px;
  cursor: pointer;
}

.main-grid {
  display: grid;
  grid-template-columns: 260px minmax(420px, 1fr) 300px;
  gap: 12px;
  margin-top: 12px;
}

.side-panel,
.map-placeholder,
.log-panel {
  padding: 14px;
}

.side-panel label {
  display: grid;
  gap: 6px;
  margin: 12px 0;
}

.side-panel select {
  min-height: 36px;
}

.map-placeholder {
  min-height: 420px;
  display: grid;
  align-content: center;
  text-align: center;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.stat-badge {
  display: grid;
  gap: 2px;
  min-width: 88px;
  padding: 8px;
  border: 1px solid #ddd0b9;
  border-radius: 6px;
  background: #f8f1e4;
}

.stat-badge span {
  color: #6d6256;
  font-size: 12px;
}

.stat-badge--warning {
  border-color: #c99238;
}

.stat-badge--danger {
  border-color: #b04436;
  color: #8c241c;
}

.log-panel {
  margin-top: 12px;
}

.log-list {
  display: grid;
  gap: 8px;
  max-height: 240px;
  overflow: auto;
}

.log-item {
  border-left: 4px solid #9a8b75;
  padding: 8px 10px;
  background: #f8f1e4;
}

.log-item span {
  margin-left: 8px;
  color: #756a5e;
  font-size: 12px;
}

.log-item p {
  margin: 4px 0 0;
}
```

- [ ] **Step 6: Test app rendering**

Create `src/tests/app-ui.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";

describe("App UI", () => {
  it("renders the core decision surface", () => {
    render(<App />);
    expect(screen.getByText("万历：山河崩塌")).toBeTruthy();
    expect(screen.getByText("战略决策")).toBeTruthy();
    expect(screen.getByText("区域详情")).toBeTruthy();
    expect(screen.getByText("月度日志")).toBeTruthy();
  });
});
```

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm test -- src/tests/app-ui.test.tsx
npm run build
git add src/app src/ui src/tests/app-ui.test.tsx
git commit -m "feat: build main mvp ui shell"
```

---

### Task 13: SVG Map Prototype

**Files:**
- Create: `src/map/mapConfig.ts`
- Create: `src/ui/map/GameMap.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/tests/map.test.tsx`

- [ ] **Step 1: Create map config**

Create `src/map/mapConfig.ts`:

```ts
import type { RegionId } from "../core/types";

export interface MapRegionShape {
  id: RegionId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const mapRegions: MapRegionShape[] = [
  { id: "chahar_steppe", x: 160, y: 40, width: 130, height: 70 },
  { id: "tumed_steppe", x: 80, y: 120, width: 130, height: 70 },
  { id: "datong", x: 220, y: 130, width: 110, height: 70 },
  { id: "beijing", x: 350, y: 140, width: 100, height: 70 },
  { id: "liaoxi", x: 480, y: 120, width: 110, height: 70 },
  { id: "liaodong", x: 610, y: 110, width: 110, height: 70 },
  { id: "haixi", x: 700, y: 40, width: 105, height: 65 },
  { id: "jianzhou", x: 720, y: 145, width: 110, height: 70 },
  { id: "shaanxi", x: 190, y: 250, width: 130, height: 80 },
  { id: "shandong", x: 420, y: 260, width: 120, height: 75 },
  { id: "henan", x: 300, y: 350, width: 130, height: 80 },
  { id: "jiangnan", x: 440, y: 430, width: 150, height: 90 },
  { id: "bozhou", x: 190, y: 470, width: 140, height: 90 }
];
```

- [ ] **Step 2: Create map component**

Create `src/ui/map/GameMap.tsx`:

```tsx
import type { GameState, MapLayer, RegionId } from "../../core/types";
import { mapRegions } from "../../map/mapConfig";

interface GameMapProps {
  state: GameState;
  layer: MapLayer;
  selectedRegionId: RegionId | null;
  onSelect: (regionId: RegionId) => void;
}

export function GameMap({ state, layer, selectedRegionId, onSelect }: GameMapProps) {
  return (
    <section className="map-panel" aria-label="战略地图">
      <svg viewBox="0 0 900 620" role="img" aria-label="明末战略区地图">
        {mapRegions.map((shape) => {
          const region = state.regions[shape.id];
          const faction = state.factions[region.controllerFactionId];
          const opacity = layer === "control" ? Math.max(0.38, region.control / 100) : 0.86;
          return (
            <g key={shape.id}>
              <rect
                data-testid={`region-${shape.id}`}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                rx="4"
                fill={faction.primaryColor}
                fillOpacity={opacity}
                stroke={selectedRegionId === shape.id ? "#1f1a16" : "#f7ecd8"}
                strokeWidth={selectedRegionId === shape.id ? 4 : 2}
                onClick={() => onSelect(shape.id)}
              />
              <text x={shape.x + shape.width / 2} y={shape.y + shape.height / 2 - 4} textAnchor="middle">
                {region.name}
              </text>
              <text x={shape.x + shape.width / 2} y={shape.y + shape.height / 2 + 16} textAnchor="middle" className="map-value">
                {layerValue(region, layer)}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function layerValue(region: GameState["regions"][string], layer: MapLayer): string {
  switch (layer) {
    case "population":
      return `${Math.round(region.population / 10000)}万人`;
    case "grain":
      return `粮${Math.round(region.grainStock / 10000)}万`;
    case "tax":
      return `税${region.taxCapacity}`;
    case "stability":
      return `稳${region.stability}`;
    case "army":
      return `军${Math.round(region.garrison / 1000)}k`;
    case "controlLevel":
      return `控${region.control}`;
    case "control":
      return region.controllerFactionId;
  }
}
```

- [ ] **Step 3: Insert map into app**

Modify `src/app/App.tsx`:

```tsx
import { TopBar } from "../ui/layout/TopBar";
import { GameMap } from "../ui/map/GameMap";
import { DecisionPanel } from "../ui/panels/DecisionPanel";
import { LogPanel } from "../ui/panels/LogPanel";
import { RegionPanel } from "../ui/panels/RegionPanel";
import { useGameStore } from "../store/gameStore";

export function App() {
  const {
    state,
    decision,
    selectedRegionId,
    mapLayer,
    advanceOneMonth,
    setDecision,
    selectRegion
  } = useGameStore();
  return (
    <main className="app-shell">
      <TopBar state={state} onAdvance={advanceOneMonth} />
      <div className="main-grid">
        <DecisionPanel state={state} decision={decision} onChange={setDecision} />
        <GameMap state={state} layer={mapLayer} selectedRegionId={selectedRegionId} onSelect={selectRegion} />
        <RegionPanel state={state} selectedRegionId={selectedRegionId} />
      </div>
      <LogPanel reports={state.reports} />
    </main>
  );
}
```

Append to `src/app/App.css`:

```css
.map-panel {
  min-height: 420px;
  border: 1px solid #c7b89f;
  background: #fffaf0;
  border-radius: 6px;
  padding: 8px;
}

.map-panel svg {
  width: 100%;
  height: 100%;
  min-height: 420px;
  display: block;
}

.map-panel rect {
  cursor: pointer;
}

.map-panel text {
  pointer-events: none;
  fill: #241f1b;
  font-size: 18px;
  font-weight: 700;
}

.map-panel .map-value {
  font-size: 13px;
  font-weight: 500;
}
```

- [ ] **Step 4: Test map rendering**

Create `src/tests/map.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameMap } from "../ui/map/GameMap";
import { createMvpScenario } from "../data/scenarios";

describe("GameMap", () => {
  it("renders region labels and handles selection", () => {
    const onSelect = vi.fn();
    render(<GameMap state={createMvpScenario()} layer="control" selectedRegionId="beijing" onSelect={onSelect} />);
    expect(screen.getByText("北京")).toBeTruthy();
    fireEvent.click(screen.getByTestId("region-beijing"));
    expect(onSelect).toHaveBeenCalledWith("beijing");
  });
});
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/tests/map.test.tsx
npm run build
git add src/map src/ui/map src/app/App.tsx src/app/App.css src/tests/map.test.tsx
git commit -m "feat: add svg strategy map"
```

---

### Task 14: Event Dialog and Start Flow

**Files:**
- Create: `src/ui/dialogs/EventDialog.tsx`
- Create: `src/ui/dialogs/StartDialog.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/tests/dialogs.test.tsx`

- [ ] **Step 1: Create event dialog**

Create `src/ui/dialogs/EventDialog.tsx`:

```tsx
import type { GameEvent } from "../../core/eventEngine";

interface EventDialogProps {
  event: GameEvent | null;
  onResolve: (optionId: string) => void;
}

export function EventDialog({ event, onResolve }: EventDialogProps) {
  if (!event) return null;
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <section className="event-dialog">
        <h2>{event.name}</h2>
        <p>{event.description}</p>
        <div className="event-options">
          {event.options.map((option) => (
            <button key={option.id} onClick={() => onResolve(option.id)}>
              <strong>{option.name}</strong>
              <span>{option.shortEffect}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create start dialog**

Create `src/ui/dialogs/StartDialog.tsx`:

```tsx
import { useState } from "react";
import { factionTemplates } from "../../data/factions";

interface StartDialogProps {
  onStart: (factionId: string, seed: number) => void;
}

export function StartDialog({ onStart }: StartDialogProps) {
  const [factionId, setFactionId] = useState("ming");
  const [seed, setSeed] = useState("157301");
  return (
    <section className="start-panel">
      <h2>选择势力</h2>
      <select value={factionId} onChange={(event) => setFactionId(event.target.value)}>
        {["ming", "tumed", "jianzhou"].map((id) => (
          <option key={id} value={id}>
            {factionTemplates[id].name}
          </option>
        ))}
      </select>
      <label>
        随机种子
        <input value={seed} onChange={(event) => setSeed(event.target.value)} />
      </label>
      <button className="primary-button" onClick={() => onStart(factionId, Number(seed) || 157301)}>
        开始推演
      </button>
    </section>
  );
}
```

- [ ] **Step 3: Wire dialogs into app**

Modify `src/app/App.tsx` to include pending event lookup and start flow:

```tsx
import { mvpEvents } from "../data/events";
import { TopBar } from "../ui/layout/TopBar";
import { EventDialog } from "../ui/dialogs/EventDialog";
import { StartDialog } from "../ui/dialogs/StartDialog";
import { GameMap } from "../ui/map/GameMap";
import { DecisionPanel } from "../ui/panels/DecisionPanel";
import { LogPanel } from "../ui/panels/LogPanel";
import { RegionPanel } from "../ui/panels/RegionPanel";
import { useGameStore } from "../store/gameStore";

export function App() {
  const store = useGameStore();
  const pendingEvent = mvpEvents.find((event) => event.id === store.pendingEventId) ?? null;
  return (
    <main className="app-shell">
      <StartDialog onStart={store.startGame} />
      <TopBar state={store.state} onAdvance={store.advanceOneMonth} />
      <div className="main-grid">
        <DecisionPanel state={store.state} decision={store.decision} onChange={store.setDecision} />
        <GameMap
          state={store.state}
          layer={store.mapLayer}
          selectedRegionId={store.selectedRegionId}
          onSelect={store.selectRegion}
        />
        <RegionPanel state={store.state} selectedRegionId={store.selectedRegionId} />
      </div>
      <LogPanel reports={store.state.reports} />
      <EventDialog event={pendingEvent} onResolve={store.resolveEvent} />
    </main>
  );
}
```

Append to `src/app/App.css`:

```css
.start-panel {
  display: flex;
  align-items: end;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #c7b89f;
  background: #fffaf0;
  border-radius: 6px;
}

.start-panel h2 {
  margin: 0;
}

.start-panel label {
  display: grid;
  gap: 4px;
}

.start-panel input,
.start-panel select {
  min-height: 34px;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(23 18 14 / 52%);
  padding: 20px;
}

.event-dialog {
  width: min(620px, 100%);
  padding: 20px;
  border-radius: 8px;
  background: #fffaf0;
  border: 1px solid #c7b89f;
}

.event-options {
  display: grid;
  gap: 10px;
}

.event-options button {
  display: grid;
  gap: 4px;
  text-align: left;
  padding: 12px;
  border: 1px solid #c7b89f;
  border-radius: 6px;
  background: #f8f1e4;
  cursor: pointer;
}
```

- [ ] **Step 4: Test dialogs**

Create `src/tests/dialogs.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventDialog } from "../ui/dialogs/EventDialog";
import { StartDialog } from "../ui/dialogs/StartDialog";
import { mvpEvents } from "../data/events";

describe("dialogs", () => {
  it("starts a game with selected faction", () => {
    const onStart = vi.fn();
    render(<StartDialog onStart={onStart} />);
    fireEvent.click(screen.getByText("开始推演"));
    expect(onStart).toHaveBeenCalledWith("ming", 157301);
  });

  it("resolves event options", () => {
    const onResolve = vi.fn();
    render(<EventDialog event={mvpEvents[0]} onResolve={onResolve} />);
    fireEvent.click(screen.getByText(mvpEvents[0].options[0].name));
    expect(onResolve).toHaveBeenCalledWith(mvpEvents[0].options[0].id);
  });
});
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/tests/dialogs.test.tsx
npm run build
git add src/ui/dialogs src/app/App.tsx src/app/App.css src/tests/dialogs.test.tsx
git commit -m "feat: add event and start dialogs"
```

---

### Task 15: MVP Gate and Runtime Verification

**Files:**
- Create: `docs/superpowers/reports/2026-06-28-mvp-validation.md`
- Modify: files only if verification exposes concrete defects

- [ ] **Step 1: Run the full automated suite**

Run:

```powershell
npm test
npm run build
npm run batch -- 100 240
```

Expected:

- Vitest exits with all tests passing.
- Build exits successfully.
- Batch command prints JSON for 100 runs and 240 months.

- [ ] **Step 2: Run the dev server**

Run:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Expected: Vite prints a local URL at `http://127.0.0.1:5173/`.

- [ ] **Step 3: Manual browser smoke test**

Open `http://127.0.0.1:5173/` and verify:

- The top bar shows date, treasury, grain, army, and fatigue.
- The start panel lets the player choose Ming, Tumed, or Jianzhou.
- The map shows all MVP regions with faction colors.
- Clicking a region updates the right panel.
- Changing military target, posture, and domestic focus updates the controls.
- Pressing `推进一月` advances the date and adds logs.
- When an event appears, the dialog blocks play until an option is selected.

- [ ] **Step 4: Write validation report**

Create `docs/superpowers/reports/2026-06-28-mvp-validation.md`:

```markdown
# Wanli Collapse MVP Validation

Date: 2026-06-28

## Automated Verification

- `npm test`: PASS
- `npm run build`: PASS
- `npm run batch -- 100 240`: PASS

## Runtime Verification

- Dev server URL: http://127.0.0.1:5173/
- Faction selection: PASS
- Map rendering: PASS
- Region selection: PASS
- Decision controls: PASS
- One-month advancement: PASS
- Event dialog: PASS

## Notes

- MVP validates the 1573-1621 monthly simulation loop.
- Full 1662 history range remains outside this MVP gate.
```

- [ ] **Step 5: Commit validation report**

Run:

```powershell
git add docs/superpowers/reports/2026-06-28-mvp-validation.md
git commit -m "test: record mvp validation"
```

---

## Final Release Gate

Before declaring the MVP complete, run:

```powershell
npm test
npm run build
npm run batch -- 100 240
npm run dev -- --host 127.0.0.1 --port 5173
```

The MVP is complete only when:

- All automated tests pass.
- The production build succeeds.
- The batch simulation completes without runtime errors.
- The browser app opens locally.
- A player can start as Ming, choose a military target, choose an internal focus, advance at least 12 months, handle any triggered event, and inspect region details on the map.
- The validation report is written and committed.

---

## Spec Coverage Check

This plan covers:

- Fixed seed reproducibility through `src/core/random.ts`.
- Calendar and 1573-1621 monthly progression through `src/core/calendar.ts` and `src/core/simulation.ts`.
- Economy, population, warfare, control, rebellion, AI, events, scoring-ready reports, and history records.
- Three playable factions and MVP AI factions.
- 12-plus-region MVP map and basic map layers.
- Zustand store, IndexedDB save object shape, event dialog, decision panel, top metrics, region details, and logs.
- Batch simulation balancing and final runtime gate.

The full 1662 timeline, complete historical event set, full map, audio, deep visual polish, and commercial compliance review are deliberately outside this MVP plan.
