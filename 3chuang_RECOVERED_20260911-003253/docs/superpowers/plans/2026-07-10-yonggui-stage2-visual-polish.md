# 甬柜易算第二阶段视觉精修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current session. Do not dispatch subagents for this repository goal.

**Goal:** 在不改变 API、真实装箱结果和 3D 状态机语义的前提下，完成六页商业视觉精修，并把 3D 升级为具有作业/复核双模式、工业箱体、清楚叉车、独立相机和分组队列的数字孪生场景。

**Architecture:** 保留 `Application → SessionProvider → workflow pages` 与 `OperationMachine`。二维变化限定在页面表现、纯派生数据和单一 CSS；3D 将场景模型、相机、标签和队列展示拆成纯帮助模块，`TwinScene` 继续负责单 RAF、真实 pose 和资源生命周期。

**Tech Stack:** React 18、Three.js 0.179、Lucide React、Vitest、ESLint、Vite、Playwright。

## Global Constraints

- 不修改后端 API、FastBlock、`loadedCargo` 坐标、装入/未装件数、利用率、重心、LIFO 或导出内容。
- 不修改 `OperationMachine` 状态语义、门端几何、门洞/碰撞、暂停/继续/重置/跳转逻辑。
- 不引入外链、无许可证资产、重型物理、后处理或大型模型。
- 保持单 RAF、delta-time、`InstancedMesh`、完整 dispose 和单 ResizeObserver。
- 不重新引入旧 `App.jsx`、`restore.css` 或旧页面/3D 树。
- 当前仓库存在任务前 dirty worktree，所有编辑使用 `apply_patch`，不 reset/clean，不提交或暂存用户工作。
- 每个实现任务先运行会失败的测试，再写最小实现，再运行目标测试和相关回归。

---

### Task 1: 商业页面语言与真实活动派生

**Files:**
- Create: `web-dashboard/src/domain/presentation/productCopy.js`
- Create: `web-dashboard/src/domain/presentation/activityTimeline.js`
- Test: `web-dashboard/src/domain/presentation/presentation.test.js`
- Modify: `web-dashboard/src/pages/workflows/DashboardPage.jsx`
- Modify: `web-dashboard/src/pages/workflows/CargoPage.jsx`
- Modify: `web-dashboard/src/pages/workflows/ContainerPage.jsx`
- Modify: `web-dashboard/src/pages/workflows/TwinPage.jsx`
- Modify: `web-dashboard/src/pages/workflows/CompliancePage.jsx`
- Modify: `web-dashboard/src/pages/workflows/ReportPage.jsx`

**Interfaces:**
- Produces `PAGE_COPY[route] = { title, subtitle }`。
- Produces `buildOrderActivity({ session, plan, planSource, localCompliance }): ActivityEntry[]` and `buildOrderTodos(...)`。

- [ ] **Step 1: Write the failing presentation test**

```js
import * as presentation from './productCopy.js';
import * as activity from './activityTimeline.js';

expect(presentation.PAGE_COPY.cargo.title).toBe('货物清单与 SKU 管理');
expect(activity.buildOrderActivity({ session, plan, planSource: 'backend', localCompliance })).toEqual(
  expect.arrayContaining([expect.objectContaining({ key: 'cargo-ready' }), expect.objectContaining({ key: 'backend-plan' })])
);
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- --run src/domain/presentation/presentation.test.js`  
Expected: FAIL because the two modules do not exist.

- [ ] **Step 3: Implement copy and session-derived activity/todos**

```js
export const PAGE_COPY = Object.freeze({
  dashboard: { title: '当前订单', subtitle: '查看订单进度、待办和最近操作。' },
  cargo: { title: '货物清单与 SKU 管理', subtitle: '维护本订单的尺寸、重量、包装与目的港信息。' },
  container: { title: '柜型选择与装柜方案', subtitle: '比较柜型预演，并生成后端真实装箱方案。' },
  twin: { title: '3D 装柜作业', subtitle: '按真实装箱坐标逐件复核装柜过程。' },
  compliance: { title: '合规审查与人工复核', subtitle: '查看本地规则、AI 审计与人工结论。' },
  report: { title: '报告预览与交付', subtitle: '核对最终方案并下载真实交付文件。' }
});
```

Activity functions derive timestamps from `order.createdAt`, `session.lastSavedAt`, `plan.timestamp`, `aiAudit.completedAt`, `manualReview.reviewedAt`; absent stages return no fake completion entry.

- [ ] **Step 4: Use copy in all H1s and add dashboard timeline/todos/version**

Dashboard must render `.order-activity`, `.order-todos`, `.plan-version`; cargo source copy becomes `当前订单 · 已自动保存`; user-facing 3D copy removes `loadedCargo` and coordinate jargon.

- [ ] **Step 5: Run target and full unit tests**

Run: `npm test -- --run src/domain/presentation/presentation.test.js` then `npm test`  
Expected: new tests and all existing tests PASS.

---

### Task 2: 基础视觉系统、工作台与货物密度

**Files:**
- Modify: `web-dashboard/src/styles/app.css`
- Modify: `web-dashboard/src/app/AppShell.jsx`
- Modify: `web-dashboard/src/pages/workflows/DashboardPage.jsx`
- Modify: `web-dashboard/src/pages/workflows/CargoPage.jsx`
- Modify: `tools/codex_final_visual.mjs`

**Interfaces:** Uses `PAGE_COPY`, `buildOrderActivity`, `buildOrderTodos` from Task 1.

- [ ] **Step 1: Strengthen visual script before CSS changes**

Add expected H1 mapping and structural checks:

```js
const expectedHeadings = {
  dashboard: '当前订单', cargo: '货物清单与 SKU 管理', container: '柜型选择与装柜方案',
  twin: '3D 装柜作业', compliance: '合规审查与人工复核', report: '报告预览与交付'
};
assert.equal(metrics.h1, expectedHeadings[route]);
if (route === 'dashboard') assert.equal(metrics.activityVisible, true);
if (route === 'cargo') assert.equal(metrics.tableEndVisible, true);
```

- [ ] **Step 2: Run the visual script and confirm RED at the first old H1**

Run: `node tools/codex_final_visual.mjs`  
Expected: FAIL because current H1s/structures still use phase-one copy.

- [ ] **Step 3: Update tokens and shell proportions**

Set neutral canvas/surface tokens, lighten the deep-green navigation, reduce line contrast, reserve shadow for overlay/document, and add `prefers-reduced-motion`. Keep all existing focus-visible rules.

- [ ] **Step 4: Implement dashboard and cargo layout**

Dashboard uses a smaller projection plus compact timeline/todos. Cargo uses 11–12px denser rows, Chinese port display, `.table-endcap`, and icon buttons with `data-tooltip` plus existing aria-label/title.

- [ ] **Step 5: Run lint, tests and 1280 screenshot check**

Run: `npm run lint && npm test` and capture dashboard/cargo at 1280.  
Expected: no overflow; cargo action column and table endcap visible; no behavior regression.

---

### Task 3: 可交互装箱投影与柜型尾货入口

**Files:**
- Modify: `web-dashboard/src/components/visual/PlanProjection.jsx`
- Create: `web-dashboard/src/components/visual/planProjectionModel.js`
- Test: `web-dashboard/src/components/visual/planProjectionModel.test.js`
- Modify: `web-dashboard/src/pages/workflows/ContainerPage.jsx`
- Modify: `web-dashboard/src/styles/app.css`
- Modify: `tools/codex_ui_states_e2e.mjs`

**Interfaces:**
- Produces `buildProjectionItems(cargo, viewMode)` without changing coordinates.
- `PlanProjection` accepts `interactive`, `viewMode`, `onViewModeChange` and manages hidden/hovered appearance keys.

- [ ] **Step 1: Write failing model tests**

```js
expect(buildProjectionItems(cargo, 'sku')[0]).toMatchObject({ cargoId: 'A', visible: true });
expect(buildProjectionItems(cargo, 'port')[0].groupLabel).toBe('港序 1');
expect(buildProjectionItems([{ ...cargo[0], fragile: true }], 'risk')[0].risk).toBe(true);
expect(cargo[0].x).toBe(originalX);
```

- [ ] **Step 2: Verify RED, implement model, verify GREEN**

Run: `npm test -- --run src/components/visual/planProjectionModel.test.js` before and after implementation.

- [ ] **Step 3: Implement legend hover/click and three view buttons**

Buttons use `aria-pressed`; hidden categories reduce SVG visibility only. Figcaption reads `已装 N 件 · 从后门作业`.

- [ ] **Step 4: Add unloaded cargo dialog**

Container risk area exposes `查看未装货物`. Dialog lists real `unloadedCargo`; if backend only supplies count, show the exact count and explicit “后端未返回逐件原因”，not fake rows.

- [ ] **Step 5: Add UI-state assertions**

Verify toggling a legend changes matching polygon opacity, switching view retains coordinates, and unloaded trigger opens a dialog with real count. Run `node tools/codex_ui_states_e2e.mjs`.

---

### Task 4: 非等宽合规与 A4 章节报告

**Files:**
- Modify: `web-dashboard/src/pages/workflows/CompliancePage.jsx`
- Modify: `web-dashboard/src/pages/workflows/ReportPage.jsx`
- Modify: `web-dashboard/src/styles/app.css`
- Modify: `tools/codex_core_e2e.mjs`
- Modify: `tools/codex_final_visual.mjs`

**Interfaces:** Existing `localReport`, `session.aiAudit`, `session.manualReview`, `model`, `html`, and download handlers remain unchanged.

- [ ] **Step 1: Add failing browser assertions**

Core E2E must assert `.audit-stages` has `data-layout="42-33-25"`, no `.audit-stage__number`, report has four chapter tabs, `.report-sheet` has `data-paper="a4"`, and page number text exists.

- [ ] **Step 2: Run core E2E and confirm RED**

Run: `node tools/codex_core_e2e.mjs`  
Expected: FAIL at missing stage layout or report tabs after earlier business assertions pass.

- [ ] **Step 3: Implement compliance structure**

Use three unequal tracks, collapse PASS rules in `<details>`, show AI completed time, make manual review the narrow latest-decision rail, and render `.compliance-history ol` as one vertical timeline.

- [ ] **Step 4: Implement report chapters**

Use local `section` state with four buttons and `aria-pressed`; every chapter reads the same `model`. Keep HTML/CSV/JSON/print handlers and filenames untouched. Add A4 ratio, margins, page number and sticky compact delivery rail.

- [ ] **Step 5: Run core E2E and unit/build gates**

Run: `npm test && npm run build && node tools/codex_core_e2e.mjs`  
Expected: all previous download/print assertions and new visual structure assertions PASS.

---

### Task 5: 3D 纯表现模型——分组、标签和独立相机

**Files:**
- Create: `web-dashboard/src/three/presentation/queueGroups.js`
- Test: `web-dashboard/src/three/presentation/queueGroups.test.js`
- Create: `web-dashboard/src/three/presentation/labelLayout.js`
- Test: `web-dashboard/src/three/presentation/labelLayout.test.js`
- Create: `web-dashboard/src/three/presentation/cameraPresets.js`
- Test: `web-dashboard/src/three/presentation/cameraPresets.test.js`
- Modify: `web-dashboard/src/three/cameraFrame.test.js`
- Modify: `web-dashboard/src/three/TwinScene.jsx`

**Interfaces:**

```js
groupOperationQueue(queue, { currentIndex, completedIndices, blockedIndex })
// => [{ key, sku, packagingLabel, portSequence, batchId, firstIndex, items:[{ item,index }], completedCount, isCurrent, isBlocked }]

layoutProjectedLabels(labels, { width, height, gap, edge })
// => [{ id, x, y, hidden, scale }]

buildCameraPreset(view, { length, width, height, mode })
// => { bounds: THREE.Box3, direction: THREE.Vector3, up: THREE.Vector3, target: THREE.Vector3, margin }
```

- [ ] **Step 1: Write all three failing test files**

Queue test proves flattened `items.map(index)` equals original `[0..n-1]`; label test proves rectangles do not overlap and stay in bounds; camera test proves four target vectors differ and all corners remain in frame.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- --run src/three/presentation`  
Expected: FAIL because modules are absent.

- [ ] **Step 3: Implement minimal pure modules**

No DOM/WebGL in tests. Camera presets may reuse/export `computeCameraFrame`; TwinScene keeps a compatibility export so the phase-one camera test still passes.

- [ ] **Step 4: Run tests and confirm GREEN**

Run: `npm test -- --run src/three/presentation src/three/cameraFrame.test.js`.

---

### Task 6: 工业箱体、清楚双门、叉车与作业场地

**Files:**
- Create: `web-dashboard/src/three/scene/createIndustrialContainer.js`
- Create: `web-dashboard/src/three/scene/createIndustrialForklift.js`
- Create: `web-dashboard/src/three/scene/createWorksite.js`
- Create: `web-dashboard/src/three/scene/sharedResources.js`
- Test: `web-dashboard/src/three/scene/sceneDescriptors.test.js`
- Modify: `web-dashboard/src/three/TwinScene.jsx`

**Interfaces:**
- `createIndustrialContainer(group, dimensions)` returns `{ doors, shellMaterials, reviewCutaway, descriptor }`。
- `createIndustrialForklift()` returns the existing runtime contract `{ group, carriage, forks, wheels, descriptor }`。
- `createWorksite(scene, dimensions)` returns `{ group, debugGrid, descriptor }`。
- Descriptor fields expose structure counts for unit/E2E diagnostics without exposing Three internals.

- [ ] **Step 1: Write failing descriptor tests**

```js
expect(CONTAINER_STRUCTURE_PARTS).toEqual(expect.arrayContaining(['floor','side-walls','roof','front-wall','corner-posts','door-frame','threshold','left-door','right-door','lock-rods','handles','corrugation']));
expect(FORKLIFT_STRUCTURE_PARTS).toEqual(expect.arrayContaining(['counterweight','cab','mast','fork-carriage','forks','wheels','hubs','steering','warning-light']));
```

- [ ] **Step 2: Verify RED, implement shared geometry/material factories, verify GREEN**

Repeated ribs, wheels and markings must share geometries/materials; no per-frame allocations.

- [ ] **Step 3: Replace old container/forklift/environment creation in TwinScene**

Keep the exact `doors.leftPivot/rightPivot`, `forklift.carriage/forks/wheels` handles used by animation. Move infinite grid to `debugGrid.visible=false` by default.

- [ ] **Step 4: Add mode material switching**

`applySceneMode(runtime, 'operation'|'review')` changes shell/cutaway/grid/labels only and writes datasets: `sceneMode`, `shellOpaque`, `debugGridVisible`, `containerPartCount`, `forkliftPartCount`.

- [ ] **Step 5: Run all unit tests and lint**

Run: `npm run lint && npm test`.

---

### Task 7: 3D 页面双模式、屏幕标签与分组队列 UI

**Files:**
- Modify: `web-dashboard/src/pages/workflows/TwinPage.jsx`
- Modify: `web-dashboard/src/three/TwinScene.jsx`
- Modify: `web-dashboard/src/styles/app.css`
- Modify: `tools/codex_three_motion_e2e.mjs`
- Modify: `tools/codex_ui_states_e2e.mjs`

**Interfaces:** Uses the three presentation helpers and scene factories from Tasks 5–6. `TwinScene` adds props `mode`, `debugLayers` and renders a fixed `.scene-label-layer`.

- [ ] **Step 1: Add failing UI/3D assertions**

Assert default mode is operation, `data-shell-opaque="true"`, grid false, review switch changes mode without changing target/cargo count, label diagnostics report no overlap, group flatten order equals queue order, and group expansion/jump updates the real machine index.

- [ ] **Step 2: Run scripts and confirm RED**

Run: `node tools/codex_three_motion_e2e.mjs` and `node tools/codex_ui_states_e2e.mjs`  
Expected: fail at missing mode/group/label diagnostics after existing assertions pass.

- [ ] **Step 3: Implement mode/view toolbar and user copy**

Use `作业模式 / 剖切复核` buttons with `aria-pressed`; default operation. Scene layers move into collapsed `图层与调试`; coordinate details move into a nested debug disclosure.

- [ ] **Step 4: Implement grouped queue**

Render group summary (SKU, count, current item, port, completion) and expanded item buttons with preserved `index`. Completed groups collapse, current/blocked group stays open, jump-to-group uses first incomplete index.

- [ ] **Step 5: Implement projected label layer and camera presets**

Update three fixed DOM labels each frame from world anchors. Use `layoutProjectedLabels`; hide debug sprites in operation mode. Apply independent preset on view/mode/resize; follow remains smooth.

- [ ] **Step 6: Run 3D motion, UI states, core E2E and unit tests**

Expected: all original assertions plus mode, label, camera and grouping assertions PASS; target coordinates unchanged.

---

### Task 8: 最终视觉脚本、三视口与十类 3D 状态证据

**Files:**
- Modify: `tools/codex_final_visual.mjs`
- Create: `tools/codex_stage2_3d_visual.mjs`
- Modify: `docs/codex/WEB_REBUILD_STATE.md`
- Modify: `docs/codex/THREE_D_OPERATION_SPEC.md`
- Modify: `docs/codex/INTERACTION_MATRIX.md`
- Modify: `docs/codex/FINAL_ACCEPTANCE.md`

**Interfaces:** Final scripts consume only visible UI and existing `.twin-canvas` diagnostics; no production test hooks that change state semantics.

- [ ] **Step 1: Expand final capture matrix**

For each of 1920×1080, 1672×941, 1280×720 capture dashboard, cargo, container, twin-operation, twin-review, compliance, report. Assert expected H1, no horizontal overflow, no overlay, operation controls visible, report A4, compliance unequal layout, operation/review dataset correctness.

- [ ] **Step 2: Add ten 3D state captures**

Capture overview, door, side, top, operation-in-progress, fork-pickup, entering-door, placed-complete, BLOCKED, grouped-queue-expanded. BLOCKED uses a localStorage session whose one cargo is physically wider than the door but retains real geometry validation; it must not alter backend application code.

- [ ] **Step 3: Run complete final gate**

```powershell
cd web-dashboard
npm run lint
npm test
npm run build
cd ..
node tools/codex_core_e2e.mjs
node tools/codex_three_motion_e2e.mjs
node tools/codex_ui_states_e2e.mjs
node tools/codex_final_visual.mjs
node tools/codex_stage2_3d_visual.mjs
git diff --check
```

Expected: all commands exit 0; application-level console/page/request errors are 0 except the explicitly simulated and filtered UI-state 500.

- [ ] **Step 4: Open every final screenshot and iterate**

Check page density, product tone, repeated visuals, title language, A4 document feel, industrial container, door area, forklift, ground, labels, composition, 1280 readability and recording suitability. Any visible miss returns to the owning task and requires recapture.

- [ ] **Step 5: Update acceptance docs and perform scope audit**

Record actual counts/plan IDs/file sizes and real limitations. Verify no legacy references, no unrelated task edits, no stale failure images, and no completion markers unsupported by evidence.

## Plan Self-Review

- Spec coverage: all six page refinements, two 3D modes, industrial scene, door, forklift, ground, light, label avoidance, independent cameras, grouped queue, performance and final evidence map to Tasks 1–8.
- Placeholder scan: no unresolved implementation placeholders; every new interface and test command is named.
- Type consistency: `groupOperationQueue`, `layoutProjectedLabels`, `buildCameraPreset`, scene factory return handles and `TwinScene` mode datasets are used with the same names across tasks.
- Scope: all tasks preserve phase-one domain behavior; no backend or state-machine rewrite is scheduled.
- Execution: the goal explicitly requires continuous single-session execution, so implementation proceeds inline without a user-choice pause or subagents.
