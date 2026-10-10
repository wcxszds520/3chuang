# PORTCUBE Competition 2.3 Physical Packing Final Report

## 1. Final Verdict

PHYSICAL_PACKING_READY

Competition 2.3 的正式求解器为 `hybrid-v2.3`。最终基准的 Dataset A SPACE 方案满足全部冻结门槛：212/212、Hard Violation 0、Geometric Stability Invalid 0、Canonical/Web Operation Blocked 0、LIFO 与 insertion PASS、CoG 在项目策略内，且 2.629 s 小于 10 s。相对同一最终分析器重放的 V2.1 SPACE，Internal Void 从 7,523,920,000 mm³ 降到 3,766,360,000 mm³（49.9415%），Low-fill Interior Slices 从 12 降到 6（50%），Largest Contiguous Reserve 增加 588,645,000 mm³。正式 benchmark 判定为 `PROMOTE_HYBRID_V2_3`。

`PORTCUBE_PHYSICAL_PACKING_FREEZE` 只冻结这里验证过的几何、准静态、作业可行与项目策略行为；它不是绑扎施工图或动态运输安全认证。

## 2. Root Cause

V2.1 的空洞不是由 79.43% 利用率本身造成，而是由“同 SKU/同港序整块构造 + 全装即提前返回”的组合路径造成：

1. `backend/services/HybridConstraintPackingSolverV2.js:87` 进入 `_generateSingleStrategy`，在 `:94` 先生成 Fast Block baseline；只要它已经装完、validator 合法且 CoG 合规，`:96-97` 就构造 `saturatedBlock` 并立即返回。因此 Dataset A 不再进入后面的逐件 extreme-point、beam 或 repair 分支。
2. `backend/services/FastBlockPackingEngine.js:135` 的 `_buildGroups` 按 SKU/货物行建立独立 group；生成循环在 `:113` 用 `cursorX += orientation.l` 逐组向 X 方向推进，SKU group 被物化成空间块。
3. `backend/services/FastBlockPackingEngine.js:413-417` 的 `_spaceAcceptsGroup` 只允许同一 `portSequence`，尾部空间还只接受最高港序；结果元数据在 `:813` 明示 `same-port-only; no cross-batch gap filling`。一个块的 Width × Height 残余无法被兼容的其他 SKU/批次补入。
4. 因而“212/212 + validator valid”掩盖了 WHERE THE EMPTY SPACE IS：相邻 SKU block 之间保留大截面低填充谷、1,300 mm 最大内部水平间隙和碎片化内部空洞。V2.1 SPACE 的冻结截图 placement hash 为 `52197fb6`，证明这些指标来自真实布局而非示意图。

V2.3 移除 SKU/批次作为空间屏障，把数量拆成独立实例，在相同港序和可提取性约束下跨 SKU 填充 Width × Height 横截面，再沿 X 推进；安全规则仍逐候选硬过滤。

## 3. Final Solver Pipeline

| Stage | Final implementation |
|---|---|
| Normalize | `normalizeContainer` 统一内部长宽高与 x/y/z 坐标；`expandInstances` 将每行 quantity 展开为稳定、唯一、quantity=1 的 cargo instance。 |
| Compatibility | `legalOrientations` 与 `operationSafeOrientations` 保留旋转、门洞、人工搬运 25 kg/1,200×1,200×1,000 mm、fragile、stackable、承载与 support 约束；SKU/批次不再是几何屏障。 |
| Port Stage | 按 `portSequence` 从高到低构造阶段。较早卸港货只可进入相邻阶段的 terminal mixed layer，且该层必须吃完当前港序剩余主货，防止 filler 被更高 X 的当前港货困住。 |
| Candidate Source | 正式 portfolio 同时评估 `CROSS_SECTION_LAYER` 与小规模 `FLOOR_EXTREME_POINT_BEAM`；Dataset A 选择前者。 |
| Layer Builder | 为 dominant depth 生成 BASE/AREA/WIDTH/HEIGHT/VOLUME 五类确定性变体与 balanced stack-column 变体；在 Width × Height 平面用墙面、货物面、support 面候选点放置，并沿 X 紧邻推进。 |
| Extreme Point | `crossSectionCandidatePoints` 从侧壁、货物 z 边与支撑顶面生成候选；≤9 件 floor-only 子问题另用三维 floor extreme points。 |
| Block Splitting | 原 SKU block 被 `expandInstances` 拆到单件粒度；同源 homogeneous low-fill layer 还可重新选择更短合法 depth。没有 Dataset A ID、SKU 名或 case ID 特判。 |
| Hard Filter | 每个候选先做边界、截面碰撞、support union、CoG-in-support、港序支撑、fragile/non-stackable、stack layer、heavy-on-light、承载与人工搬运检查；非法项不进入 soft score。 |
| Beam | `FloorExtremePointCandidate` 对最多 9 件使用 beamWidth=512、maximumStarts=8 的有界确定性 beam；大规模主路径以每 stage 的有限变体和最多 8 个 depth candidates 控制搜索。 |
| Global Compaction | `applyStrategyTranslation` 在保持全部相对坐标不变的前提下，把完整 cargo block 移到最近合法 X/Z 接触平面；SPACE 使用 50 mm 量化 CoG guardrail，BALANCE 对准 CoG，OPERATION 向门侧压紧。 |
| Void Repack | `BALANCED_STACK_COLUMNS` 对 dominant-depth group 重分列；`_compactHomogeneousResidualLayers` 对 fill<0.65 的单源残余层尝试更短合法朝向并只接受全装单层结果。这是当前确定性、局部、有限窗口 repack，而不是未实现的任意 8–30 件随机搜索。 |
| Operation Validator | 用共享 30/35/5/2 mm 项目净空构造 canonical loading sequence 和完整折线路径；后端 `CanonicalOperationFeasibility` 与 Web operation machine 双重重放。 |
| Stability Validator | 独立 `PlanValidator` 检查 bounds、collision、orientation、support、carrying、LIFO/insertion、CoG 与 `StabilityAnalyzer` 的 support polygon/stack CoG/slenderness。 |
| Portfolio Selection | 安全优先字典序：Hard → actual blocked → stability invalid → unloaded/loaded volume → LIFO/insertion → compactness/reserve → CoG guardrail → strategy objective → runtime；任何 V2.3 高优先级失败时可与保留的 V2.1 guardrail candidate 比较。Web 三策略推荐进一步把 securing unresolved/zones/count 放在 compactness 与 CoG 之前。 |

## 4. New Compactness Model

`PORTCUBE_LAYOUT_QUALITY_V2_3` 不再用一个 bounding compactness 代表布局质量：

- `occupiedDepth` / `occupiedDepthRatio`：全部 cargo 在 X 轴上的真实包络深度及其相对柜长；只在不破坏 CoG guardrail 时压缩。
- `crossSectionFillMean/P10/MinimumInterior`：以自适应 100 mm X 切片测 Width × Height 占用率；P10 能暴露少数严重“腰斩”切片，Dataset A 从 0.2286 提升到 0.7154。
- `lowFillInteriorSliceCount`：内部切片低于项目阈值 0.65 的数量，Dataset A 12→6。
- `internalVoidVolume/Ratio`：占用长度与局部 cargo envelope 内部、难以再利用的 grid 空间；Dataset A 最终为 3.76636×10⁹ mm³。
- `reserveVolume/largestContiguousReserve/reserveRegionCount`：与 internal void 互斥、可从 cargo block 外部连续利用的空区；最终 SPACE 最大连续 Reserve 为 8.542014272×10⁹ mm³。
- `narrowVoidVolume`：连通空区中不能容纳数据集合理朝向的狭窄部分；`enclosedVoidVolume`：与门侧不连通的封闭 cavity。二者独立于外部 Reserve。
- `interiorGapVolume/mean/maxInteriorHorizontalGap`：货物之间的真实水平 gap，150 mm 是 `PROJECT_POLICY` 关注阈值而非法定数字；Dataset A max gap 1,300→780 mm。
- `cargoContactRatioMean/wallContactRatio`：与邻货、柜壁和支撑面的有效接触比例，用来解释 restraint 与 secureability，不等同摩擦力。

网格 cell 根据最小相关 cargo dimension 自适应，并 clamp 到 50–150 mm；Dataset A 使用 50 mm。所有体积均以 mm³ 报告。

## 5. Securing Model

Geometric Stability 与 Cargo Securing 是两个独立结论：

- **Geometric Stability**：由 support union/polygon、单件与 stack CoG、support margin、stack load、slenderness、墙/邻货 restraint 决定，状态可解释为 stable、warning 或 invalid。Dataset A invalid=0、warning=0。
- **Cargo Securing**：`PORTCUBE_SECURING_REQUIREMENT_V2_3` 检测超过 150 mm 项目阈值的 reserve gap、自由暴露货垛面和 fragmented zones，输出 `SECURING_NOT_REQUIRED / SECURING_REQUIRED / SECURING_UNRESOLVED`、cargo IDs 与 blocking plane guidance。

最终推荐方案在几何上稳定，但 securing 为 `SECURING_UNRESOLVED`：45 件位于暴露边界，集中为 1 个建议 securing plane，需要工程人员选择 blocking/bracing/dunnage。该 plane 是位置与原因提示，不是施工图；系统没有把 `STABLE` 误写成“无需固定”。

## 6. Operation BLOCKED Root Cause

冻结的 V2.1 Dataset A SPACE 真实回放在 **step 3** 阻塞：目标 cargo 为 **`stage3_svc_10_203`**，原因 **`PATH_COLLIDES_CARGO`**，旧路径与 step 1 已放置的同 SKU cargo **`stage3_svc_10_201`** 相交。SPACE 共 40 个 blocked；BALANCE/OPERATION 各 48 个。Dataset B 的首个同类证据为 step 58、`DATASET-B-1_1`，路径与 `DATASET-B-1_2` 相交。

根因不是目标 placement collision，而是回放路径和同层顺序：旧逻辑先沿 X 到目标 depth，再横移；对门侧堆叠目标还会先越过最终 X、随后向门退回，横移/回退会切入已放邻货或 supporter。

修复同时落在 backend 与 Web：

1. 同一 x/y 层先按离左右柜壁距离排序，wall-adjacent cargo 先装，保留中间横移通道。
2. cargo 刚过门平面就在未占用的高 X 截面完成 z 对齐，然后按目标 y 抬升，再沿 X 直达目标。
3. `doorInside.x = max(target.x, nominalDoorClearancePlane)`，门侧目标不再 overshoot 后回退。
4. 后端以 100 mm 分段采样整条 polyline；Web 使用同一节点和 clearance contract。最终 Dataset A canonical 与 frontend 均 212/212、blocked=0，浏览器完整回放也无阻塞。

## 7. Iteration History

仅列出留有可重放 artifact 的迭代，不虚构未保存的中间数字。

| Iteration | Major Change | Loaded | Internal Void (mm³) | Low-fill Slices | Largest Reserve (mm³) | CoG lateral/longitudinal | Blocked | Runtime | Promoted? |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 0 · frozen V2.1 baseline | 保存真实 placement/metrics；定位 SKU block early return 与旧 operation path | 212 | 7,910,020,000 | 12 | 7,567,269,272 | 0.000% / 10.000% | 40 | 343 ms | No |
| 1 · V2.3 smoke | mixed-SKU cross-section、instance split、residual reorientation、共享 operation geometry | 212 | 3,766,360,000 | 6 | 8,542,014,272 | 0.096% / 9.463% | 0 | 3,044 ms | No — smoke 只有 2 challenge + 2 oracle cases |
| 2 · final corpus | 有界 floor beam、48 fixed + 64 challenge + 20 exact oracle、双端 replay、严格 promotion gates | 212 | 3,766,360,000 | 6 | 8,542,014,272 | 0.096% / 9.463% | 0 | 2,629 ms | Yes — `PROMOTE_HYBRID_V2_3` |

说明：Iteration 0 使用在 operation/analyzer 修复前冻结的 `v2.1-baseline.json`。最终 promotion 的 49.9415% 使用同一**最终**分析器重算同一 V2.1 placement（7,523,920,000→3,766,360,000），避免跨版本量测偏差；其 placement hash 仍为 `52197fb6`。

## 8. Dataset A Before / After

同策略 SPACE 对比；Before 为冻结历史证据，After 为最终 V2.3。体积单位 mm³，深度/间隙单位 mm。

| Metric | V2.1 SPACE Before | V2.3 SPACE After | Change |
|---|---:|---:|---:|
| Loaded | 212/212 | 212/212 | 0 |
| Utilization | 79.4303% | 79.4303% | 0 pp |
| Occupied Depth | 11,350 | 11,260 | -90 |
| Internal Void | 7,910,020,000 historical; 7,523,920,000 comparable replay | 3,766,360,000 | -52.39% historical; **-49.94% comparable** |
| Low-fill Interior Slices | 12 | 6 | **-50%** |
| Cross-section P10 | 0.2286 | 0.7154 | +0.4868 |
| Largest Contiguous Reserve | 7,567,269,272 historical; 7,953,369,272 comparable replay | 8,542,014,272 | +974,745,000 historical; **+588,645,000 comparable** |
| Max Interior Horizontal Gap | 1,300 | 780 | -520 |
| Securing Zones / Required cargo | 2 / 105 | 1 / 53 | 更集中 |
| CoG lateral / longitudinal | 0.000% / 10.000%, PASS | 0.096% / 9.463%, PASS | PASS retained |
| Operation Cost | 20.4516 | 22.9161 | +2.4646 soft cost |
| Actual Blocked | 40 historical; 0 after shared-geometry reanalysis | 0 backend / 0 Web | root cause removed |
| Hard / Stability Invalid / LIFO / insertion | 0 / 0 / PASS / PASS | 0 / 0 / PASS / PASS | retained |
| Runtime | 343 ms historical | 2,629 ms wall | <10 s gate |

Evidence: `artifacts/competition-2.3/v2.1-baseline.json` and `artifacts/competition-2.3/competition-2.3-benchmark.json`.

## 9. Dataset B

Dataset B 是 69 件 mixed diagnostic case；同策略 SPACE 对比。它不是 Dataset A freeze gate，且揭示了当前真实 Pareto limitation。

| Metric | V2.1 SPACE Before | V2.3 SPACE After | Change |
|---|---:|---:|---:|
| Loaded | 69/69 | 69/69 | 0 |
| Utilization | 25.0211% | 25.0211% | 0 pp |
| Occupied Depth | 7,600 | 11,100 | +3,500 |
| Internal Void | 4,756,000,000 | 4,080,000,000 | -14.21% |
| Low-fill Interior Slices | 76 | 112 | +36, worse |
| Cross-section P10 | 0.2521 | 0.1135 | -0.1387, worse |
| Largest Contiguous Reserve | 51,376,614,272 | 53,169,574,272 | +1,792,960,000 |
| Max Interior Horizontal Gap | 900 | 6,200 | +5,300, worse |
| Securing Zones / Required cargo | 3 / 51 | 1 / 42 | more concentrated |
| CoG lateral / longitudinal | 2.432% / 10.000%, PASS | 1.215% / 14.061%, **OUTSIDE PROJECT POLICY** | Pareto conflict |
| Operation Cost | 27.3958 | 28.7789 | +1.3831 |
| Actual Blocked | 5 frozen historical; 6 current shared replay | 0 backend / 0 Web | fixed |
| Hard / Stability Invalid / LIFO / insertion | 0 / 0 / PASS / PASS | 0 / 0 / PASS / PASS | retained |
| Runtime | 3,239 ms historical | 1,753 ms wall | -1,486 ms |

三种 V2.3 strategy 在 Dataset B 收敛到 hash `ffe1dc89`。它解决了 operation block、减少 internal void、扩大 reserve 并将 securing planes 集中为 1 个，但牺牲 occupied depth、low-fill/P10/max gap 且 longitudinal CoG 达 14.061%。因此报告不把 Dataset B 说成全指标胜利；这是已知的稀疏、多港序布局 Pareto limitation。

## 10. Synthetic Benchmark

| Corpus | Cases | Core success | Hard / Stability invalid / Operation blocked | Loaded V2.1→V2.3 | Mean void improvement | Void-improved cases | Mean runtime V2.1→V2.3 | Max V2.3 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Original fixed | 48 | 35/48 = 72.92% | 0 / 0 / 0 | 1,525→1,540 (**+15**) | -34.88% | 23/48 | 553.4→386.1 ms | 2,459 ms |
| Competition 2.3 challenge | 64 | 43/64 = 67.19% | 0 / 0 / 0 | 1,410→1,414 (**+4**) | **+27.72%** | 39/64 | 148.1→211.3 ms | 2,375 ms |

“Core success”还要求 CoG project-policy PASS；fixed 的 13 个失败和 challenge 的 21 个失败全部是 CoG policy failure，不是 hard、stability 或 operation failure。112 个 synthetic cases 均确定性复跑 hash 一致。Challenge 覆盖全部 17 类：uniform cartons、mixed SKU same/multi destination、large+small filler、tall+short、heavy+light、fragile、non-stackable、rotation restricted、manual+forklift、high residual、dense、LIFO、gap fragmentation、cross-section、operation insertion、securing reserve。

负的 fixed mean void improvement 表明通用 solver 仍会在部分稀疏/特殊比例 case 选择更安全但更松的解；不能用 Dataset A 的胜利替代 corpus-level limitation。

## 11. Tiny Oracle

20 个 tiny floor-only deterministic cases 与 exact oracle 比较：18/20 loaded count 精确匹配，match rate 90%，全部 20 个复跑确定性一致；总 loaded gap 为 -3，worst gap 为 -2。

- `TINY-ORACLE-01`：oracle 4，V2.3 2，gap -2；oracle 解自身有 2 个 operation blocked，V2.3 为 0。
- `TINY-ORACLE-09`：oracle 6，V2.3 5，gap -1；oracle 解自身有 2 个 operation blocked，V2.3 为 0。

因此两个差距均被标为 `operationConstrainedGapCaseIds`，`unexplainedLoadedGapCaseIds=[]`。该 oracle 证明纯几何最大装载上界，不是 operation-feasible oracle；不能据此声称存在可作业解支配 V2.3。

## 12. Before / After Screenshots

所有截图均为实际 Vite + backend 页面、1270×714，并使用相同 camera preset；没有缩放 cargo、改变 placement、隐藏 gap 或修改柜体尺寸。

| View | V2.1 | V2.3 |
|---|---|---|
| Side cutaway | `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.1-space-side-cutaway.png` | `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-side-cutaway.png` |
| Top | `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.1-space-top.png` | `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-top.png` |
| Door cutaway | `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.1-space-door-cutaway.png` | `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-door-cutaway.png` |
| Internal Void debug | — | `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-internal-void-debug-top.png` |
| Controlled Reserve debug | — | `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-controlled-reserve-debug-top.png` |

实际视觉检查结论：V2.1 side 仍有明显中央 block gap；V2.3 横截面更连续，剩余空间主要集中在 cargo block 边界；红色 internal-void 与绿色 reserve overlay 可见；未发现孤立高垛、穿插、越界或为紧凑而产生的 Dataset A CoG 违规。

## 13. Final Strategy Results

Dataset A V2.3：

| Strategy | Hash | Loaded | Void / Low-fill / P10 | Largest Reserve | CoG Lateral / Longitudinal | Securing planes / cargo | Blocked | Operation Cost | Wall runtime |
|---|---|---:|---|---:|---|---|---:|---:|---:|
| SPACE | `dd541130` | 212 | 3.76636e9 / 6 / 0.7154 | 8.542014272e9 | 0.096% / 9.463% | 1 / 53 | 0 | 22.9161 | 2,629 ms |
| BALANCE | `71c963c0` | 212 | 3.76636e9 / 6 / 0.7154 | 8.410839872e9 | 0.096% / 8.266% | 1 / 45 | 0 | 22.7366 | 2,392 ms |
| OPERATION | `71c963c0` | 212 | 3.76636e9 / 6 / 0.7154 | 8.410839872e9 | 0.096% / 8.266% | 1 / 45 | 0 | 22.7366 | 2,295 ms |

BALANCE 与 OPERATION **完全收敛到同一 placement hash**。SPACE 的相对 cargo topology 也相同，但使用不同的整体 X translation；因此 SPACE→OPERATION diff 显示 212 件 moved、CoG 9.46→8.27、reserve 8.54e9→8.41e9，而 void 3.77e9、blocked 0 不变。BALANCE→OPERATION diff 为 moved=0。

## 14. Recommended Strategy

最终推荐 **OPERATION**。三方案先通过同一 Hard/Operation/Stability/Loaded/LIFO 门槛；SPACE 的 securing-required cargo 为 53、CoG longitudinal 9.463%、operation cost 22.9161。BALANCE/OPERATION 将其改善为 45、8.266%、22.7366，同时保持相同 void、low-fill、P10 与 0 blocked。BALANCE 和 OPERATION 的布局及质量完全相同，最终由末级 wall runtime 2,295<2,392 ms 选择 OPERATION。

浏览器 Overview、Strategy、Twin 和 global session 均默认该推荐；用户手动切换才改变当前策略。推荐不是第四策略。

## 15. Known Physical Limitations

- 模型是 **Geometric + Quasi-static + Operation-aware Engineering Heuristic**，没有 friction coefficient simulation、lashing-force/tension calculation、ship-motion/6-DOF inertial simulation、material deformation、carton crushing 或 forklift rigid-body/dynamic physics。
- Securing plane 是 project guidance；真实 blocking/bracing/dunnage 形式、强度、摩擦和施工必须由合格工程人员依据 cargo 与运输条件确定。
- Operation replay 使用轴对齐 cargo AABB、离散折线路径和 100 mm 后端采样；不建模叉车转弯半径、轮胎、门槛、人员或现场障碍。
- Void/Reserve 使用 50–150 mm 自适应 voxel 与 100 mm cross-section slice，数值是确定性工程量测而不是连续体积分解析解。
- Dataset B 暴露稀疏多港序 Pareto conflict：0 blocked 与更集中 securing reserve 达成，但纵向 CoG 14.061% 超出当前项目策略，且 low-fill/max gap 恶化；正式推荐规则不会把 outside-policy plan 压过可用 safe plan。
- 50% internal-void 优先目标差 0.0585 percentage point；真实最大、同分析器改善为 49.9415%，已超过 mandatory 30%，没有四舍五入成 50%。
- Floor exact/beam 仅覆盖 tiny floor-only case；大规模求解仍是有界 deterministic heuristic，不能宣称全局最优。

## 16. Tests

| Verification | Result |
|---|---|
| Canonical Competition 2.3 benchmark | PASS; `PROMOTE_HYBRID_V2_3`; 48 fixed + 64 challenge + 20 tiny; total benchmark 194,421 ms |
| Backend physical/solver/orchestrator/API Jest set | PASS; 10 suites, 51 tests, 0 failures, 373.774 s |
| Frontend Vitest | PASS; 31 files, 105 tests, 0 failures, 13.17 s |
| Backend ESLint | PASS exit 0; 0 errors, 62 remaining warnings across older/current repository files; all five new Competition 2.3 unused-binding warnings were removed before handoff |
| Frontend ESLint | PASS; 0 errors/warnings |
| Vite production build | PASS; 1,670 modules; only known >900 kB chunk advisory |
| Browser flows | PASS: Overview, Strategy, Twin, timeline 1→212, Door, Cutaway, Risk, Inspector, Decision Replay, SPACE/BALANCE/OPERATION Diff |
| Browser console | PASS: 0 error/warn/warning entries after final flow |
| Screenshots | PASS: 14 PNG files, all 1270×714, visually inspected |
| Repository-wide backend `npm test` | NOT GREEN: 40/65 suites and 617/681 tests passed; 25 suites / 64 tests failed in 988.296 s, then one MySQL TCP handle remained and was stopped after Jest printed its final summary. Failures are outside the V2.3 targeted set: missing historical `RenderEngine`, `SimplePackingEngine`, and `DBLFPackingEngine` modules; old Layered/PackingEngine expectations; old localized API/miniprogram string contracts; and shared-DB foreign-key cleanup. The targeted physical set above is green. |

The V2.3 Dataset A unit test also scans implementation text and rejects identifiers `NB2026-0713-001`, `stage3_*` and named Dataset A SKUs, preventing case-specific rules.

## 17. Changed Files

**Solver**

- `backend/services/HybridConstraintPackingSolverV23.js`
- `backend/services/HybridConstraintPackingSolverV2.js`
- `backend/services/packing/CrossSectionLayerBuilder.js`
- `backend/services/packing/FloorExtremePointCandidate.js`
- `backend/services/FastBlockPackingEngine.js`
- `backend/services/AlgorithmOrchestrator.js`
- `backend/config/solverPolicy.js`
- `backend/config/packingPolicy.js`
- `backend/routes/packing.js`

**Metrics**

- `backend/services/packing/PlanMetrics.js`
- `backend/services/packing/LayoutQualityAnalyzer.js`
- `backend/services/packing/SecuringAnalyzer.js`
- `backend/benchmarks/runPhysicalPackingBaseline.js`
- `backend/benchmarks/runPhysicalPackingBenchmark.js`
- `backend/benchmarks/projectBenchmarkCases.js`
- `backend/benchmarks/solverBenchmarkCases.js`
- `backend/benchmarks/physicalPackingChallengeCases.js`
- `backend/benchmarks/tinyOracleCases.js`
- `backend/benchmarks/TinyFloorPackingOracle.js`

**Validator**

- `backend/services/packing/PlanValidator.js`
- `backend/services/packing/StabilityAnalyzer.js`
- `backend/__tests__/unit/HybridConstraintPackingSolverV23.test.js`
- `backend/__tests__/unit/PhysicalPackingMetricsV23.test.js`
- `backend/__tests__/unit/FloorExtremePointCandidate.test.js`
- `backend/__tests__/unit/TinyFloorPackingOracle.test.js`
- `backend/__tests__/unit/PlanValidator.test.js`
- `backend/__tests__/unit/StabilityAnalyzer.test.js`
- `backend/__tests__/unit/solverBenchmark.test.js`
- `backend/__tests__/integration/packing.test.js`

**Operation**

- `backend/services/packing/CanonicalOperationFeasibility.js`
- `web-dashboard/src/three/operation/geometry.js`
- `web-dashboard/src/three/operation/operationMachine.js`

**Web**

- `web-dashboard/src/services/packingApi.js`
- `web-dashboard/src/domain/plan/strategyRecommendation.js`
- `web-dashboard/src/domain/plan/strategyRecommendation.test.js`
- `web-dashboard/src/pages/workflows/ContainerPage.jsx`
- `web-dashboard/src/pages/workflows/DashboardPage.jsx`
- `web-dashboard/src/pages/workflows/TwinPage.jsx`
- `web-dashboard/src/three/TwinScene.jsx`
- `web-dashboard/src/three/analytics/visualizationModes.js`
- `web-dashboard/src/styles/app.css`
- `web-dashboard/src/app/session/SessionProvider.jsx`
- `web-dashboard/src/app/session/sessionReducer.js`

## 18. Final Screenshot Paths

1. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.1-space-door-cutaway.png`
2. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.1-space-side-cutaway.png`
3. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.1-space-top.png`
4. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-door-cutaway.png`
5. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-side-cutaway.png`
6. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-top.png`
7. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-internal-void-debug-top.png`
8. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-controlled-reserve-debug-top.png`
9. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-space-internal-void-debug.png` (superseded side debug, retained evidence)
10. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-strategy-physical-metrics.png`
11. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-overview-recommended-operation.png`
12. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-risk-geometric-vs-securing.png`
13. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-decision-replay.png`
14. `D:\cixing\3chuang\artifacts\competition-2.3\screenshots\v2.3-strategy-diff-space-operation.png`

Benchmark artifacts:

- `D:\cixing\3chuang\artifacts\competition-2.3\competition-2.3-benchmark.json`
- `D:\cixing\3chuang\artifacts\competition-2.3\competition-2.3-cross-sections.csv`
- `D:\cixing\3chuang\artifacts\competition-2.3\competition-2.3-synthetic.csv`
- `D:\cixing\3chuang\artifacts\competition-2.3\competition-2.3-tiny-oracle.csv`
- `D:\cixing\3chuang\artifacts\competition-2.3\v2.1-baseline.json`
- `D:\cixing\3chuang\artifacts\competition-2.3\v2.1-cross-sections.csv`

## 19. Final Demo Case

`NB2026-0713-001` 的最终真实正式 Plan：

| Field | Result |
|---|---|
| solver / version | `hybrid-v2.3` / `2.3` |
| strategy | **OPERATION** |
| loaded | 212/212; unloaded 0 |
| utilization | 79.430316% |
| placement hash | `71c963c0` |
| CoG | lateral 0.095517%; longitudinal 8.266192%; within project policy |
| internal void | 3,766,360,000 mm³ |
| largest contiguous reserve | 8,410,839,872 mm³ |
| cross-section | low-fill slices 6; P10 0.715383; max interior gap 780 mm |
| geometric stability | stable; invalid 0; warning 0 |
| securing | `SECURING_UNRESOLVED`; 45 exposed cargo; 1 suggested securing plane; blocking/bracing/dunnage engineering review required |
| operation | canonical 0 blocked; Web 0 blocked; complete 212/212 replay |
| hard / LIFO / insertion | 0 / PASS / PASS |
| operation cost / canonical wall runtime | 22.736598 / 2,295 ms |

# === START OF PORTCUBE 2.3 CONTEXT FOR CHATGPT ===

PROJECT_ROOT: D:\cixing\3chuang

FINAL_SOLVER: hybrid-v2.3 (`backend/services/HybridConstraintPackingSolverV23.js`)

FINAL_SOLVER_VERSION: 2.3; official solver policy and API `auto` resolve to hybrid-v2.3

ROOT_CAUSE_V21_GAPS: FastBlock groups SKU rows into independent X slices and `_spaceAcceptsGroup` forbids cross-batch filling; `_generateSingleStrategy` returns the all-loaded saturated block before per-item search, preserving interior gaps

COMPACTION_PIPELINE: normalize → compatible orientations → descending port stages → mixed-SKU cross-section/stack columns + tiny floor beam → hard validation → bounded residual-layer reorientation → rigid global strategy translation → void/securing analysis → dual operation replay → stability validation → V2.1 guardrail portfolio

BLOCK_SPLITTING: quantity rows are expanded to stable single-cargo instances; monolithic SKU blocks are eliminated; homogeneous low-fill residual layers may be reoriented only when every instance still fits one legal layer

MIXED_SKU_POLICY: SKU_AND_BATCH_ARE_NOT_SPATIAL_BARRIERS; port access, orientation, support, fragile/non-stackable, carrying, handling and CoG constraints remain barriers

CROSS_SECTION_LAYER: deterministic Width×Height layers advance contiguously along X; five ordering variants plus balanced stack columns; terminal adjacent-port fillers only

VOID_MODEL: adaptive 50–150 mm occupancy grid separates internal fragmented void from door/edge-connected reserve; 100 mm X slices quantify fill and gaps

COMPACTNESS_METRICS: occupiedDepth, crossSectionFillMean/P10/minimum, lowFillInteriorSliceCount, internal/narrow/enclosed void, largestContiguousReserve, residual regions, gap volume/max gap, cargo/wall contact

SECURING_MODEL: PORTCUBE project-policy requirement detection only; final OPERATION is geometrically stable but SECURING_UNRESOLVED with 45 cargo and 1 blocking-plane guidance zone

GEOMETRIC_STABILITY: support polygon/union, cargo and stack CoG, margins, load propagation, restraint and slenderness; Dataset A invalid=0 warning=0

OPERATION_FEASIBILITY: shared backend/Web high-X door path, wall-first same-layer order, post-door lateral alignment and no door-side overshoot; Dataset A canonical/Web blocked=0

BLOCKED_ROOT_CAUSE: V2.1 SPACE step 3 `stage3_svc_10_203` PATH_COLLIDES_CARGO with already placed `stage3_svc_10_201`; old path aligned laterally at target depth and overshot door-side targets; fixed by wall-first order and post-door alignment

LOADING_SEQUENCE: ascending x, then y, then wall distance, then z/loadingIndex; earlier-unload cargo retains higher-X extraction corridor; browser replay 1→212 complete

DATASET_A_BEFORE: frozen V2.1 SPACE hash 52197fb6; 212/212; util79.4303%; depth11350; void7.91002e9 historical (7.52392e9 comparable final analyzer); low12; P10.2286; reserve7.567269272e9 historical (7.953369272e9 comparable); gap1300; securing2/105; CoG0/10 PASS; blocked40 historical; 343ms

DATASET_A_AFTER: V2.3 SPACE hash dd541130; 212/212; util79.4303%; hard0; stability0; blocked0; LIFO/insertion PASS; depth11260; void3.76636e9; low6; P10.7154; reserve8.542014272e9; gap780; securing1/53; CoG.0955/9.463 PASS; 2629ms

DATASET_B_RESULT: V2.3 all strategies hash ffe1dc89; 69/69; hard/stability/blocked0; void4.08e9; reserve5.3169574272e10; securing1/42; CoG1.215/14.061 OUTSIDE policy; lowfill/max-gap worse, documented Pareto limitation

SYNTHETIC_RESULT: fixed48 core35, hard/stability/operation0, loaded+15, mean void improvement -34.88%, avg386ms; challenge64 core43, all17 classes, hard/stability/operation0, loaded+4, mean void improvement+27.72%, avg211ms; determinism112/112

TINY_ORACLE_RESULT: 20 cases, 18 exact loaded matches (90%), total gap -3; only TINY-01/-09 differ and both exact oracle layouts have 2 operation blocks; unexplained gaps none

SPACE_RESULT: hash dd541130; 212; void3.76636e9; reserve8.542014272e9; CoG.0955/9.463; securing1/53; blocked0; opCost22.9161; 2629ms

BALANCE_RESULT: hash71c963c0; 212; void3.76636e9; reserve8.410839872e9; CoG.0955/8.266; securing1/45; blocked0; opCost22.7366; 2392ms

OPERATION_RESULT: hash71c963c0; 212; void3.76636e9; reserve8.410839872e9; CoG.0955/8.266; securing1/45; blocked0; opCost22.7366; 2295ms

RECOMMENDED_STRATEGY: OPERATION; safety/loaded/layout gates tie, it improves securing count/CoG/operation cost over SPACE and beats identical BALANCE only at final runtime tie-break

STRATEGY_CONVERGENCE: BALANCE and OPERATION placements are identical; SPACE has the same packing topology with a different rigid X translation

RUNTIME: Dataset A canonical SPACE/BALANCE/OPERATION wall 2629/2392/2295ms; full benchmark 194421ms; all formal solver runtimes below 10s

TESTS: benchmark PROMOTE; backend Competition 2.3 set 10 suites/51 tests pass; frontend 31 files/105 tests pass; both lints and Vite build pass; browser flows and console pass; repository-wide backend is 40/65 suites and 617/681 tests passed with 25 legacy/integration suites failing outside the V2.3 target set

SCREENSHOT_PATHS: D:\cixing\3chuang\artifacts\competition-2.3\screenshots (14 PNGs; before/after side/top/door, void, reserve, metrics, overview, risk, replay, diff)

TOP_CHANGED_FILES: HybridConstraintPackingSolverV23.js; CrossSectionLayerBuilder.js; FloorExtremePointCandidate.js; LayoutQualityAnalyzer.js; SecuringAnalyzer.js; PlanValidator.js; StabilityAnalyzer.js; CanonicalOperationFeasibility.js; AlgorithmOrchestrator.js; packing.js; packingApi.js; strategyRecommendation.js; TwinPage.jsx; TwinScene.jsx

KNOWN_LIMITATIONS: no friction/lashing force/ship motion/material deformation/forklift rigid-body physics; voxel/sampled engineering heuristic; Dataset B CoG Pareto conflict; large-scale optimality not proven; securing requires engineer

FINAL_VERDICT: PHYSICAL_PACKING_READY; PROMOTE_HYBRID_V2_3; PORTCUBE_PHYSICAL_PACKING_FREEZE

# === END OF PORTCUBE 2.3 CONTEXT FOR CHATGPT ===

PORTCUBE_PHYSICAL_PACKING_FREEZE
