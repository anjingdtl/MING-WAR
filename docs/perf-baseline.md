# MING-WAR 性能基线报告

> 文档版本：v0.6-stability-baseline
> 编写日期：2026-06-30
> 用途：记录各 perf: 脚本的初始基线数据，作为后续 phase 优化前后的对比基准。

---

## 0. 基线采集方法

- 测试机：本机（Node.js ≥ 20）
- 测量方式：每个 perf 脚本用 `performance.now()` 在每次循环起止采样，输出 mean / p50 / p95 / max / min。
- 模拟条件：seed=7，faction=ming，playerDecision=defaultPlayerDecision，**不**含任何用户交互。
- 重复次数：可通过环境变量 `PERF_RUNS` / `PERF_YEAR_ROUNDS` 调整。

---

## 1. 初始基线（v0.3.0 + Phase 1 计时）

> 已采集（commit Phase 1 之前无基线对照，下列数字为 Phase 1 完成后本机首次采样）。

```bash
npm run perf:smoke      # 20 次单月
npm run perf:clone      # 不同月数各 1000 次 clone
npm run perf:save       # 不同月数各 100 次 JSON 序列化
npm run hash:state      # 6 节点状态哈希
```

### 1.1 单月（`perf:smoke` / `perf:month`，20 次采样）

| 指标 | 实测值 | 红线 |
|---|---|---|
| mean | 3.569 ms | — |
| p50 | 2.385 ms | — |
| p95 | 24.153 ms | < 200 ms ✅ |
| max | 24.153 ms | < 300 ms ✅ |
| min | 2.063 ms | — |

> 结论：单月模拟在主线程上**远低于** Worker 强制阈值（300 ms），Phase 3 的 Worker 改造**降为可选**。Phase 3 仅做 LocalSimulationService 抽象，Worker 实现留待 v0.7 视长跑性能决定。

### 1.4 structuredClone（`perf:clone`，1000 次采样）

| 月数 | mean ms | p95 ms | max ms |
|---|---|---|---|
| 0 | 0.979 | 1.249 | 2.236 |
| 240 | 9.580 | 15.954 | 19.072 |
| 1080 | 5.829 | 9.866 | 13.080 |

> 1080 月反而比 240 月快：因 ledgerHistory 60 月上限后大块历史（120 月起）已被压缩。

### 1.5 存档 JSON 体积（`perf:save`，100 次采样）

| 月数 | JSON 字节 | JSON KB | stringify mean | parse mean |
|---|---|---|---|---|
| 0 | 120803 | 117.97 | 0.341 ms | 0.445 ms |
| 240 | 756810 | 739.07 | 3.726 ms | 5.465 ms |
| 1080 | 557509 | 544.44 | 1.546 ms | 1.971 ms |

> 1080 月存档 544 KB，**远低于** SPEC 软上限 1.5 MB。状态分层后预计可再降 30%。

### 1.6 状态哈希（`hash:state`，seed=7）

| 月数 | 日期 | 哈希 |
|---|---|---|
| 0 | 1573-01 | `0b970ece82d2f0151bc90c8ea9cfaa3eaf492220` |
| 12 | 1574-01 | `c13553b1ebe88e45b293c2210a216d8259ca32d5` |
| 120 | 1583-01 | `89396aa447416b166a071c3a64d26db5ff3b198f` |
| 240 | 1593-01 | `c4e601c2d2dfbaff7d0f7c2a3171d6323abdbe2f` |
| 1080 | 1663-01 | `34c8763b4ec0ab296d1b820c029cc938ee1d14e7` |

> **跨版本回归红线**：上述 5 个哈希在 Phase 2-6 全部完成后**必须**保持一致。任何漂移需 `// DETERMINISM-CHANGE: <reason>` 注释 + PROGRESS.md 同步。

---

## 2. 阶段计时分布（`simulateMonth` timings）

`simulateMonth` 返回 `SimulationTiming`，dev 模式默认有值，prod 默认关。

| 阶段 | 含义 | 预期耗时占比 |
|---|---|---|
| clone | 月初 `structuredClone(state)` | < 5% |
| regions | 地区循环（pop/经济/控制/叛乱/市场/人口） | > 50% |
| market | 跨地区贸易 + 价格 + auto-invest | < 10% |
| faction | 势力循环（维护费/征募/腐败累积） | < 15% |
| diplomacy | 外交演变 + applyResourceCrises + 集团更新 | < 5% |
| politics | 法律改革 + 政治运动 | < 5% |
| warfare | 战斗 + 战线 + 和谈 | < 10% |
| situation | 历史局势推进 | < 1% |
| finalize | 推进日期 + ledger 历史 + 迁移 + 不变量 + history + alerts | < 5% |
| validation | `validateInvariants` | < 1% |

> 跑 `npm run perf:smoke` 后，把 `simulateMonth` 返回的 `timings` 字段填入上表。

---

## 3. 后续阶段验收

每完成一个 phase（2/3/4/5/6），重新跑 `npm run perf:month` / `npm run hash:state`，把数据追加到本文档 §4。

---

## 4. Phase 对比记录

| Phase | commit | 单月 p95 | hash 漂移 | 备注 |
|---|---|---|---|---|
| 0 (v0.3.0 + Phase 1) | 4cd82db | 24.153 ms | baseline | 410 测试全绿 |
| 2 (流水线拆分) | _TBD_ | 25.340 ms | **0 漂移** ✅ | 5 节点哈希完全一致 |
| 3 (store 拆分) | _TBD_ | _TBD_ | _TBD_ | — |
| 4 (Service 抽象) | _TBD_ | _TBD_ | _TBD_ | — |
| 5 (存档升级) | _TBD_ | _TBD_ | _TBD_ | — |
| 6 (CI) | _TBD_ | _TBD_ | _TBD_ | — |

### Phase 2 详情（流水线拆分）

- simulation.ts：777 行 → 145 行（编排器）
- 新增 `src/core/simulationContext.ts`：`SimulationContext` + `createSimulationContext` + `PhaseFn` 类型
- 新增 `src/core/simulationPhases/`：
  - `runRegionPhase.ts`（S2，地区循环）
  - `runFactionPhase.ts`（S3，势力循环）
  - `runDiplomacyPhase.ts`（S4，外交 + 资源危机 + 集团）
  - `runPoliticsPhase.ts`（S5，改革 + 运动）
  - `runSituationPhase.ts`（S6，历史局势）
  - `runWarPhase.ts`（S7，战斗 + 战线 + 和谈）
  - `finalizeMonth.ts`（S8，月末收口）
  - `helpers.ts`（applyRebellionConsequences / countControlledRegions）
- 新增 `src/tests/phases.test.ts`：7 阶段独立测试（每阶段验证 invariant error = 0）

**关键不变量**：
- random 消费点顺序保留（generateDisasters → applyResourceCrises → resolveBattle）
- state 写入顺序保留
- applyLedgerToState 调用顺序保留
- 5 节点 hash（0/12/120/240/1080 月）与 Phase 1 baseline **完全一致**
