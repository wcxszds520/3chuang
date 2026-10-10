# PORTCUBE Competition 2.2 Visual Freeze Report

Freeze label: `PORTCUBE_COMPETITION_VISUAL_FREEZE`

Date: 2026-08-22  
Project root: `D:\cixing\3chuang`  
Target case: `NB2026-0713-001`  
Primary target: 1920 × 1080 at 100% browser zoom

## Executive Verdict

**READY_WITH_LIMITATIONS**

PORTCUBE Competition 2.2 is visually frozen for the local CMIT competition demonstration. The five-page experience now reads as an industrial spatial-intelligence workspace rather than a generic administration dashboard: the decision brief is data-consistent, Strategy compares three real solutions, Twin is viewport-first, and Evidence connects rules to space. All final competition screenshots use actual browser state and `BACKEND_SOLVED` data.

The limitation is not a visual blocker: the repository-wide legacy backend test command still contains unrelated missing-module, historical assertion, and stochastic property-test failures. The solver-critical targeted suites, all web tests, production build, actual Packing API runs, Case API sync, browser console, and Dataset A cross-page regression pass. A genuine blocked operation path is also retained as a truthful runtime state rather than cosmetically bypassed.

## 1. P0 — Data Truth and UI Consistency

### Root cause

The Overview hero and the metric cards did not share one readiness model. The hero read the hydrated backend plan, while the metric-card count-up path initialized missing/asynchronous values as numeric zero. During and after hydration this allowed `212/212`, `79.4%`, `40HQ`, and `BACKEND_SOLVED` to coexist with `0/212`, `0.0%`, and `0 kg`. The issue was presentation-state divergence, not an incorrect backend solution.

### Fix

A normalized active-plan view model was introduced in:

- `web-dashboard/src/domain/plan/activePlanViewModel.js`
- `web-dashboard/src/domain/plan/activePlanViewModel.test.js`

`SessionProvider` now exposes `activePlanView`, consumed by Overview, Strategy/container recommendation, Twin, and the global context shell. Its normalized contract includes:

- `loadedCount`, `inputCount`, `unloadedCount`
- `utilization`, `totalWeight`, `weightRate`
- `cog`, `lateralCog`, `longitudinalCog`
- `stability`, `lifoCompliant`
- `algorithm`, `strategy`, `source`, `status`

The display contract explicitly separates not-ready from zero: `undefined`, `null`, and loading render as `—`; a verified numeric zero remains `0`. The Overview count-up initialization that manufactured transient zeros was removed.

### Single source of truth

```text
Backend plan
  → active-plan normalization
  → SessionProvider.activePlanView
  → Overview / Strategy / Twin / shell / Evidence context
```

No competition metric is hard-coded. Final Dataset A state is consistently `212/212`, `79.43%`, `8,623 kg`, `STABLE`, `hybrid-v2`, and `BACKEND_SOLVED`; the currently active strategy is displayed from the same normalized source.

## 2. Design Reference Research

Only public official product pages and documentation were used. These were principle references, not skins to copy.

| Reference | Principle absorbed | PORTCUBE application |
| --- | --- | --- |
| [Linear UI refresh](https://linear.app/changelog/2026-03-12-ui-refresh) and [redesign notes](https://linear.app/now/how-we-redesigned-the-linear-ui) | Navigation recedes; main content and consistent hierarchy lead | Quiet 70 px rail, subtle active indicator, compact context strip |
| [Autodesk Fusion interface](https://help.autodesk.com/view/fusion360/ENU/?contextId=LP-STEPS-P13N-SNP-GS-OTH-CRD-1) | Canvas-first workspaces and purpose-driven contextual tools | Twin viewport dominance and one VIEW / ANALYZE / EXPLAIN toolbar |
| [Figma UI3](https://www.figma.com/blog/behind-our-redesign-ui3/), [UI3 approach](https://www.figma.com/blog/our-approach-to-designing-ui3/), and [UI3 help](https://help.figma.com/hc/en-us/articles/23954856027159-Navigating-UI3-Figma-s-new-UI) | Precision, contextual properties, restrained floating controls, direct manipulation | Cargo inspector, compact controls, low-elevation panels, measured motion |
| [NVIDIA Omniverse digital twins](https://docs.omniverse.nvidia.com/digital-twins/latest/overview.html) and [SimReady](https://docs.omniverse.nvidia.com/simready/latest/index.html) | Semantic and visual fidelity must coexist in an industrial twin | GLB node contracts, real plan projection, calibrated PBR assets and scene hierarchy |

North star: **Industrial Spatial Intelligence Workspace** — precise, calm, spatial, confident, cinematic, technical, premium, fast, and readable.

## 3. Global UI Changes

- **Navigation:** five primary pages only — Overview, Cargo, Strategy, Twin, Evidence. The default rail is 70 px and expands as an overlay, so the canvas never shifts. Active state uses a small accent and icon emphasis rather than a large blue tile.
- **Context strip:** a 46 px global strip replaces five card-like cells. Case ID leads; dataset, piece count, container, plan source/strategy, and stability become concise metadata with tabular numerals.
- **Card reduction:** large fields are sections, panes, strips, canvas, inspector, toolbar, and hairline divisions. Elevation is reserved for drawers, dropdowns, inspectors, and modals.
- **Typography:** Chinese is primary. Uppercase English is retained only where it carries navigational or product meaning. Projector-critical body and context text keeps usable contrast and size.
- **Spacing and shape:** an 8 px-derived rhythm, 8–10 px controls, and 10–14 px major panels replace oversized radii and stacked shadows.
- **Motion:** rail, controls, panels, analysis transitions, camera, and drawers use short purpose-specific timings; false 0–100% progress and repeated KPI count-ups are absent.
- **Color:** the application chrome is neutral; blue/teal is reserved for selection and action, status colors are semantic, and the graphite Twin canvas gives the 3D product visual priority.

## 4. Page-by-Page Freeze State

### Overview — Current Decision Brief

**Before problem:** KPI-home composition, duplicated calculations, contradictory zero cards, too many similarly weighted cards, and a small 3D subject in excess empty space.

**Change:** a roughly 65/35 hero-to-decision composition, tighter three-quarter hero framing, a compact real-metric rail, one current-decision pane, one state-dependent CTA, and a subtle workflow line. The shared active-plan view model supplies every number.

**Final design logic:** in five seconds a judge can identify the container-loading problem, a real solved plan, the 3D digital twin, current stability/source, and the next action.

**Remaining issue:** the lightweight hero still shares the main Three runtime bundle; route-level renderer splitting is a post-competition optimization, not a freeze blocker.

### Cargo — Engineering Data Editor

**Before problem:** CRUD-dashboard impression, summary cards, diffuse toolbar hierarchy, and editing context competing with the table.

**Change:** one summary strip (`10 SKU · 212 PCS · 8,623 KG`), a dense table with restrained separators, a single primary “新增 SKU” action, and a 320–400 px contextual overlay inspector grouped by geometry, handling, stacking, destination, and provenance.

**Final design logic:** the table remains the engineering surface; tools and detail appear only around the selected row.

**Remaining issue:** Cargo and Evidence intentionally scroll at 1366 × 768 because they are data workspaces, not hero pages.

### Strategy — Decision Lanes

**Before problem:** three generic SaaS cards made cross-strategy comparison slow and visually implied three independent products.

**Change:** a compact 20GP / 40GP / 40HQ selector, three aligned decision lanes, shared metric rows, actual solution thumbnails, two-plan comparison action, and a restrained `RECOMMENDED` accent. Hard constraints, stability, CoG, compactness, operation cost, and solve information are aligned for horizontal reading.

**Final design logic:** SPACE, BALANCE, and OPERATION remain real strategies under one safety system. `RECOMMENDED` is a product-level portfolio selection, not a fourth solver strategy. Selection order is hard violations → stability → loaded count → LIFO/insertion → CoG guardrail → strategy objective → layout quality → runtime. Policy failures appear inline and cannot also be recommended.

**Remaining issue:** the captured Dataset A strategies converge on identical load/utilization and partially identical operational metrics; the interface truthfully shows this rather than manufacturing differentiation.

### Twin — Absolute Hero Experience

**Before problem:** pale, flat web-runtime lighting; overly large environment; distant cameras; toy-like forklift; toolbar competition; and Blender assets looking substantially better than runtime.

**Change:** the viewport occupies the dominant page area; one contextual toolbar exposes VIEW, ANALYZE, and EXPLAIN. The default cutaway/review framing makes real cargo readable. The environment is reduced to a premium three-bay inspection studio. Materials, lighting, camera, ground contact, shadow behavior, and runtime GLBs were recalibrated. Decision Replay, Strategy Diff, Risk, and Rule→Space remain contextual modes rather than permanent panels.

**Final design logic:** UI supports the spatial decision. The container and cargo lead in five seconds; controls become visible when needed. Solver placements are not beautified or rearranged.

**Remaining issue:** one actual operation sequence reaches a truthful `BLOCKED` cargo state; the captured operation evidence documents it. The Blender studio render is the clearest close visual of Forklift V2.

### Evidence — Evidence Workbench

**Before problem:** document-reader and stacked-card treatment weakened the connection between regulation, human review, and the physical arrangement.

**Change:** a document/evidence field paired with a compact rule stack and selected-rule context. The primary `VIEW IN TWIN` action connects the selected rule to its spatial evidence; AI explanation is subordinate and collapsible. Export is contextual rather than a page-dominating destination.

**Final design logic:** evidence selection drives document focus and Twin focus, making compliance traceable from rule to placement.

**Remaining issue:** full PDF rendering and some external evidence availability still depend on the configured local/demo source material.

## 5. Three.js Visual Parity

### Renderer and color

- ACES Filmic tone mapping with exposure `0.82`.
- `RoomEnvironment` through PMREM for stable, local, dependency-free PBR reflection.
- Graphite background and fog; no claim of an external HDRI download.
- GLTF color/material paths remain compatible with the installed Three.js runtime.

### Lighting

- A directional key establishes form.
- Lower-intensity fill preserves readable cargo faces without flattening the scene.
- Rim/overhead light separates the container from the graphite background.
- Background and environment remain lower contrast than the container/cargo hero.

### Materials and grounding

- Container teal saturation, metalness, roughness, cutaway shell, interior, and door hardware were calibrated for runtime parity.
- Cargo uses real-world material families: kraft, wood, off-white wrapping, and charcoal equipment rather than SKU rainbow coding.
- Forklift uses industrial body paint, rubber, mechanical metal, seat, light, and fork-metal families.
- Neutral industrial floor plus real contact shadows grounds container, cargo, and forklift; SSAO is not forced.

### Shadow and performance policy

The static shadow atlas is rendered once and invalidated only while actors or spawn animations move. Static environment meshes are batched by material into seven batches. This reduces steady-state render work without changing plan geometry.

### Camera direction

- Overview: tightened full-container three-quarter framing with less empty warehouse.
- Door: emphasizes lock bars, hinges, handle, frame, and insertion direction.
- Side and top: analytical views for volume, port, space, and balance.
- Cutaway: readable cargo against a shell that retains sufficient contrast.
- Focus transitions are directed rather than continuous showcase orbiting.

## 6. Blender and Asset Art Pass

### Blender MCP use

Blender was directly inspected and modified through Blender MCP. The workflow included scene inspection, mesh/material edits, viewport review, studio rendering, further edits, saving the `.blend`, and glTF export. It was not a one-shot procedural generation pass.

### Forklift Hero V2 — three meaningful visual iterations

1. **Wheel and driver credibility:** tyre shoulders, tread blocks, rims, hubs and bolts; dashboard, steering wheel, gauges, pedals, seat, and bevel refinement.
2. **Mast and load mechanism:** nested mast rails and crossbars, pulley/chain indications, framed carriage, and reinforced tapered forks.
3. **Industrial finish and body detail:** restrained PORTCUBE paint treatment, engine hood/vents/seams, exhaust, tow hardware, grab rails, axles, fenders, lamps, and beacon base.

A final LOD pass removed 16 evenly distributed tread blocks while retaining 18 treads per wheel, bringing the model within the requested triangle budget. Runtime node contracts are preserved: `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr`, `forklift_carriage`, `fork_l`, and `fork_r`. Existing operation animation continues to drive wheels, carriage, and forks without an OperationMachine rewrite.

Source: `D:\cixing\3chuang\assets-src\blender\forklift.blend`  
Runtime: `D:\cixing\3chuang\web-dashboard\public\assets\3d\forklift.glb`  
Studio render: `D:\cixing\3chuang\web-dashboard\output\blender\forklift-v22-final.png`

### Container final pass

The existing ~69k-triangle container was retained. Export-safe explicit PBR parameters replaced procedural-only material ramps for painted shell, cutaway shell, and deep-teal components. Door hardware, edge response, floor/interior separation, and reduced cyan saturation were refined without decorative geometry inflation.

Source: `D:\cixing\3chuang\assets-src\blender\container-kit.blend`  
Runtime: `D:\cixing\3chuang\web-dashboard\public\assets\3d\container-40hq.glb`  
Studio render: `D:\cixing\3chuang\web-dashboard\output\blender\container-v22-final.png`

### Cargo and environment

Cargo geometry was retained and runtime material authenticity was calibrated; shared material families and limited label detail prevent texture-per-item inflation. The inspection environment was reduced from five repetitive bays to three curated bays with fewer markings, muted safety yellow, suppressed decorative cyan, and reduced SCAN/VERIFY emphasis. The worker remains optional and hidden in final-plan presentation, appearing only where an operation step needs it.

## 7. Final Asset Statistics

Exact GLB triangle counts were read from primitive index accessors.

| Asset | Triangles | Materials | GLB size | Freeze note |
| --- | ---: | ---: | ---: | --- |
| 40HQ container | 69,522 | 15 | 3.50 MB | Retained geometry; material/export parity pass |
| Forklift V2 | 69,936 | 10 | 4.27 MB | Three Blender iterations + final tread LOD |
| Cargo kit | 9,888 | 14 | 0.67 MB | Authentic neutral material system |
| Inspection bay | 83,704 | 10 | 2.48 MB | Runtime composition reduced to three bays |
| Worker | 4,352 | 6 | 0.30 MB | Optional operation actor; hidden in final plan |

Runtime inspection confirmed `container=glb`, `forklift=glb`, and `environment=glb` rather than fallback assets.

## 8. Screenshot Index

All browser images below were captured from the actual application. Unless noted otherwise, they are 1920 × 1080 and show real `BACKEND_SOLVED` state.

| Screenshot | Resolution | Purpose |
| --- | --- | --- |
| `web-dashboard/output/playwright/competition-2.2/final-overview-backend-solved-1920x1080.png` | 1920 × 1080 | Five-second home-screen and P0 metric consistency proof |
| `web-dashboard/output/playwright/competition-2.2/final-cargo-backend-solved-1920x1080.png` | 1920 × 1080 | Engineering table, summary strip, action hierarchy |
| `web-dashboard/output/playwright/competition-2.2/final-cargo-inspector-backend-solved-1920x1080.png` | 1920 × 1080 | Selected-row contextual inspector |
| `web-dashboard/output/playwright/competition-2.2/final-strategy-backend-solved-1920x1080.png` | 1920 × 1080 | Three real decision lanes and product recommendation |
| `web-dashboard/output/playwright/competition-2.2/final-twin-cutaway-backend-solved-1920x1080.png` | 1920 × 1080 | Main Twin hero, cargo visibility, contextual toolbar |
| `web-dashboard/output/playwright/competition-2.2/final-twin-forklift-operation-backend-solved-1920x1080.png` | 1920 × 1080 | Actual operation state and forklift runtime integration |
| `web-dashboard/output/playwright/competition-2.2/final-twin-forklift-v2-runtime-1920x1080.png` | 1920 × 1080 | Forklift V2 runtime inspection |
| `web-dashboard/output/playwright/competition-2.2/final-twin-forklift-v2-door-view-1920x1080.png` | 1920 × 1080 | Door/insertion direction and runtime actor |
| `web-dashboard/output/playwright/competition-2.2/final-decision-replay-backend-solved-1920x1080.png` | 1920 × 1080 | Accepted/rejected/valid-candidate explanation hierarchy |
| `web-dashboard/output/playwright/competition-2.2/final-strategy-diff-backend-solved-1920x1080.png` | 1920 × 1080 | Spatial old/new/unchanged comparison and delta strip |
| `web-dashboard/output/playwright/competition-2.2/final-twin-risk-backend-solved-1920x1080.png` | 1920 × 1080 | Risk-mode legibility and performance state |
| `web-dashboard/output/playwright/competition-2.2/final-evidence-backend-solved-1920x1080.png` | 1920 × 1080 | Evidence workbench layout |
| `web-dashboard/output/playwright/competition-2.2/final-evidence-workbench-backend-solved-1920x1080.png` | 1920 × 1080 | Scrolled/selected evidence context |
| `web-dashboard/output/playwright/competition-2.2/final-rule-to-space-backend-solved-1920x1080.png` | 1920 × 1080 | Rule-to-Twin spatial traceability |
| `web-dashboard/output/playwright/competition-2.2/final-twin-normal-backend-solved-2560x1440.png` | 2560 × 1440 | Large-screen composition |
| `web-dashboard/output/playwright/competition-2.2/final-twin-normal-backend-solved-1366x768.png` | 1366 × 768 | Demo compatibility and overflow check |
| `web-dashboard/output/blender/forklift-v22-final.png` | Blender studio render | Forklift V2 art review after three iterations |
| `web-dashboard/output/blender/container-v22-final.png` | Blender studio render | Container material/door final review |

## 9. Screenshot-Based Design Self-Critique

These are subjective internal design scores, not test metrics. Each primary hero remains at or above 8.0 for Premium Feel and Competition Impact.

| Screenshot | Hierarchy | Focus | Density | Spacing | Type | Premium | Industrial | Interaction | Impact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Overview | 9.0 | 9.1 | 8.6 | 8.8 | 8.6 | 8.6 | 8.7 | 8.8 | 8.8 |
| Cargo | 8.6 | 8.7 | 9.0 | 8.5 | 8.5 | 8.2 | 8.5 | 8.8 | 8.2 |
| Strategy | 9.1 | 9.0 | 8.8 | 8.6 | 8.7 | 8.7 | 8.6 | 9.0 | 8.9 |
| Twin Cutaway | 9.3 | 9.4 | 8.7 | 9.0 | 8.5 | 9.1 | 9.2 | 8.9 | 9.3 |
| Twin Operation | 8.8 | 8.9 | 8.5 | 8.8 | 8.4 | 8.7 | 9.0 | 8.8 | 9.0 |
| Decision Replay | 8.8 | 9.0 | 8.5 | 8.7 | 8.4 | 8.6 | 8.8 | 8.9 | 8.8 |
| Strategy Diff | 8.9 | 8.9 | 8.6 | 8.7 | 8.5 | 8.7 | 8.8 | 8.8 | 8.9 |
| Risk | 8.8 | 9.0 | 8.5 | 8.8 | 8.4 | 8.7 | 8.9 | 8.8 | 8.8 |
| Evidence | 8.7 | 8.7 | 8.8 | 8.5 | 8.5 | 8.3 | 8.5 | 8.9 | 8.4 |
| Rule→Space | 8.9 | 9.1 | 8.5 | 8.8 | 8.4 | 8.7 | 8.9 | 9.0 | 9.0 |

The remaining lower scores are concentrated in inherently dense engineering/evidence workspaces, not the hero views. The final pages do not rely on logo, card volume, or decorative HUD effects for identity.

## 10. Performance

Measured in the actual 1920 × 1080 browser session after the visual pass and static batching:

| Mode | FPS observed | Draw calls | Triangles | Textures | GPU memory estimate | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Normal / Cutaway | 99–108 | 128 | 301,630 | 17 | ~55.9 MB | Pass, above 60 FPS target |
| Operation | 120–121 | 122–126 | 85,030–101,854 | 17 | ~55.9 MB class | Pass, above 50 FPS target |
| Risk | 83 | 87 | 288,490 | 16 | ~55.9 MB | Pass, above 50 FPS target |
| Strategy Diff | Not isolated as a separate counter sample | Same Twin renderer class | Mode-dependent overlay | Same asset set | Same class | Visually smooth; no measured standalone number claimed |

Additional responsive observations: 2560 × 1440 held approximately 63–82 FPS depending on camera/settling state. At 1366 × 768 the scene observed approximately 130 FPS, `scrollWidth` equaled the 1366 px viewport, and the page remained operable without horizontal overflow.

## 11. Data Regression and Test Status

### Actual strategy generation

All three plans were generated by the backend for Dataset A:

| Strategy | Loaded | Utilization | Longitudinal CoG | Stability | Compactness | Operation cost | Source |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- |
| SPACE | 212/212 | 79.43% | 10.00% | STABLE | 0.878 | 20.45 | BACKEND_SOLVED / hybrid-v2 |
| BALANCE | 212/212 | 79.43% | 5.61% | STABLE | 0.878 | 19.79 | BACKEND_SOLVED / hybrid-v2 |
| OPERATION | 212/212 | 79.43% | 5.61% | STABLE | 0.878 | 19.79 | BACKEND_SOLVED / hybrid-v2 |

The solver search core and placements were not altered for visual appearance in this round.

### Passing gates

- Web lint: passed.
- Web tests: **30 files / 102 tests passed**.
- Web production build: passed.
- Backend targeted integration/unit gates: **2 suites / 26 tests passed** (`packing.test.js`, `algorithm-orchestrator.test.js`).
- Backend lint: zero errors; 62 pre-existing warnings.
- Packing API: actual generation succeeded for SPACE, BALANCE, and OPERATION.
- Case API sync: successful.
- Browser console: clean apart from the React DevTools informational message; no application warnings or errors.
- `git diff --check`: clean; only repository line-ending notices.

### Build note

The build reports a non-fatal chunk-size warning: application entry approximately 908.28 kB minified / 359.74 kB gzip; Three chunk approximately 550.48 kB minified / 139.58 kB gzip.

### Repository-wide legacy test limitations

The full legacy backend suite was sampled and stopped after producing unrelated failures and excessive output. Known examples include missing historical modules (`RenderEngine`, `SimplePackingEngine`), outdated endpoint/behavior assertions, two older `OptimizedPackingEngine` compliance assertions, and a stochastic LayeredPackingEngine property counterexample. These were not changed because the Competition 2.2 mandate freezes solver behavior unless a verified current hard-constraint/stability/placement/validator defect is found.

## 12. Known Limitations

1. The full historical backend test suite is not green; targeted competition-critical suites and actual APIs are green.
2. One real operation route can reach a `BLOCKED` cargo state. It remains visible and truthful; no placement was manually changed to manufacture a prettier animation.
3. Strategy Diff was visually verified but not sampled as its own isolated performance counter; it uses the same renderer/asset class and was smooth in browser QA.
4. The production JavaScript bundles are large enough to trigger Vite's chunk warning. This does not impair the local competition flow after startup.
5. Cargo/Evidence scroll on the 1366 × 768 compatibility target by design.
6. The final forklift studio image predates the invisible final tread-count LOD reduction; the exported runtime model is the verified 69,936-triangle version.

## 13. Final Competition Experience

### Three-minute version

1. **0:00–0:25 — Overview:** open on `NB2026-0713-001`. Point out the solved 212/212 plan, 79.43% utilization, 8,623 kg, stable state, and `BACKEND_SOLVED / hybrid-v2`. Use the five-second decision brief before clicking.
2. **0:25–0:55 — Cargo:** show the 10-SKU / 212-piece engineering dataset and open one row's contextual inspector to establish real inputs.
3. **0:55–1:30 — Strategy:** compare SPACE, BALANCE, and OPERATION in aligned lanes; explain that `RECOMMENDED` is the portfolio winner, not a fourth algorithm.
4. **1:30–2:30 — Twin:** enter the cutaway hero, switch Door/Top briefly, then demonstrate Risk and one focused cargo. Show Forklift Operation only if the current step is suitable; otherwise keep the hero framing and explain the truthful blocked-state guard.
5. **2:30–3:00 — Evidence:** select one rule, use `VIEW IN TWIN`, and close on Rule→Space traceability.

### Five-minute version

1. **0:00–0:35 — Decision brief:** establish case, solver source, real metrics, and the single next action.
2. **0:35–1:10 — Engineering input:** show high-density Cargo, a selected SKU inspector, and handling/stacking provenance.
3. **1:10–2:00 — Multi-objective decision:** compare three backend-generated strategies, CoG/stability/operation metrics, policy guardrails, and recommendation logic.
4. **2:00–3:20 — Digital Twin:** start with cutaway, use Door and Top cameras, switch Normal/Risk, focus a cargo, and show the industrial asset quality. If appropriate, play a short forklift operation segment.
5. **3:20–4:05 — Explainability:** run Decision Replay and show accepted, rejected, and valid-not-selected candidates without overwhelming the viewport.
6. **4:05–4:30 — Strategy Diff:** compare two real plans with spatial old/new/unchanged treatment and the delta strip.
7. **4:30–5:00 — Compliance closure:** open Evidence, select a rule, invoke Rule→Space, and return to the Twin hero as the closing product image.

## 14. Five-Second Judge Tests

- **Overview:** pass. The container-loading domain, solved status, true metrics, stability, 3D focus, and next CTA are visible without interaction.
- **Twin:** pass. Container, cargo, and spatial analysis dominate; navigation and tooling visibly recede.
- **Anti-SaaS check:** pass for hero pages. Strategy uses comparison lanes rather than cards; Overview is a decision brief; Twin remains canvas-first.
- **Anti-student-demo check:** pass. The scene has authored camera direction, industrial asset detail, PBR differentiation, grounding, lighting hierarchy, and real solver projection.

## 15. Final Context Handoff

# === START OF PORTCUBE 2.2 CONTEXT FOR CHATGPT ===

PROJECT_ROOT: `D:\cixing\3chuang`.

OFFICIAL_SOLVER: `hybrid-v2`; display name `PORTCUBE Hybrid Constraint Packing Solver V2.1`; benchmark-selected / best-known PORTCUBE solution. Competition 2.2 did not alter placements for aesthetics.

RECOMMENDED_PLAN_LOGIC: Product-level portfolio winner, not a fourth strategy. Order: hard violations → stability → loaded count → LIFO/insertion → CoG guardrail → strategy objective → layout quality → runtime. Reuses current portfolio principle.

ACTIVE_CASE_DATA: `NB2026-0713-001`, Dataset A, 10 SKU, 212 pieces, 8,623 kg, 40HQ, 212/212 loaded, 79.43% utilization, STABLE, `BACKEND_SOLVED`, `hybrid-v2`. Final current strategy comes from active state.

OVERVIEW_DATA_FIX: The hero read the hydrated plan while KPI count-up/default formatting converted not-ready values to zero. Added `web-dashboard/src/domain/plan/activePlanViewModel.js`, exposed it as `SessionProvider.activePlanView`, and routed core UI through it. Loading/null is `—`; true zero is `0`.

WEB_PAGES: Five primary pages only — Overview, Cargo, Strategy, Twin, Evidence. Delivery remains outside primary navigation.

NAVIGATION_DESIGN: Quiet 70 px rail with subtle active indicator and overlay expansion; Twin keeps it collapsed; main content never reflows on hover.

CONTEXT_BAR: 46 px strip led by case ID, then demo-data status, piece/container metadata, backend source/strategy, and stability with tabular numerals.

DESIGN_REFERENCES: Official Linear navigation/hierarchy; Autodesk Fusion canvas-first/context tools; Figma UI3 precision/context properties/motion; NVIDIA Omniverse semantic and visual digital-twin fidelity. Principles only, no product skin copied.

DESIGN_SYSTEM: Neutral chrome, graphite viewport, restrained teal/blue action color, semantic statuses, 8 px-derived spacing, 8–10 px controls, 10–14 px panels, low shadow/elevation, Chinese-first typography, measured motion.

OVERVIEW_LAYOUT: 65/35 current-decision brief with lightweight 3D hero, compact real-metric rail, one decision context pane, one state-dependent CTA, subtle workflow line.

CARGO_LAYOUT: Engineering data editor with one summary strip, dense table, consolidated toolbar, one primary Add SKU action, and overlay contextual inspector.

STRATEGY_LAYOUT: Compact container selector plus three aligned decision lanes for SPACE/BALANCE/OPERATION; small real-plan thumbnails; inline policy state; restrained RECOMMENDED accent; compare-in-Twin action.

TWIN_LAYOUT: Viewport-first hero with one toolbar grouped as VIEW / ANALYZE / EXPLAIN. Default cutaway/review shows real cargo. Decision Replay, Strategy Diff, and Risk are contextual modes.

EVIDENCE_LAYOUT: Evidence workbench with document/evidence area, compact rule stack, selected rule detail, subordinate AI explanation, and primary VIEW IN TWIN traceability.

THREE_RENDERER: ACES Filmic, exposure 0.82, graphite background/fog, RoomEnvironment PMREM, runtime GLB assets, material-based environment batching, static shadow invalidation policy.

THREE_LIGHTING: Directed key, softer fill, rim/overhead separation, environment reflection, neutral floor, real contact shadows; no external HDRI claim and no forced SSAO.

THREE_CAMERA: Authored Overview, Door, Side, Top, and Cutaway compositions. Hero/Overview reduce empty space; Door emphasizes hardware/insertion; analytical views serve spatial questions.

CONTAINER_FINAL: 69,522 tris, 15 materials, 3.50 MB. Existing geometry retained; export-safe PBR materials, reduced saturation, improved cutaway/interior/door response.

FORKLIFT_FINAL: Three Blender MCP iterations plus final LOD. 69,936 tris, 10 materials, 4.27 MB. Credible wheels, driver area, mast/carriage/chains, forks, body/mechanical details, and restrained PORTCUBE identity. Runtime animation node contract preserved.

CARGO_FINAL: 9,888 tris, 14 materials, 0.67 MB. Neutral authentic material families, restrained labels/detail, no rainbow SKU encoding.

ENVIRONMENT_FINAL: 83,704 tris, 10 materials, 2.48 MB source asset; runtime composition reduced from five repetitive bays to three with fewer markings, muted yellow, and lower background hierarchy.

WORKER_STATUS: 4,352 tris, 6 materials, 0.30 MB. Optional operation actor; hidden in final-plan hero; no close-up presentation investment.

DECISION_REPLAY: Background recedes; selected cargo retains material/outline; rejected is warm ghost, valid-not-selected is cool ghost, accepted is teal highlight; concise reason/support/stability/LIFO/score context.

STRATEGY_DIFF: Old plan low-opacity ghost, new plan normal, unchanged reduced; delta strip communicates CoG, stability, operation cost, and moved count without dashboard charts.

RULE_TO_SPACE: Evidence rule selection can focus the corresponding spatial condition in Twin through the primary VIEW IN TWIN action.

SCREENSHOT_PATHS: `D:\cixing\3chuang\web-dashboard\output\playwright\competition-2.2` for actual browser captures; `D:\cixing\3chuang\web-dashboard\output\blender` for final studio renders.

PERFORMANCE: Normal 99–108 FPS / 128 calls / 301,630 tris / 17 textures; Operation 120–121 FPS / 122–126 calls / 85,030–101,854 tris / 17 textures; Risk 83 FPS / 87 calls / 288,490 tris / 16 textures; Strategy Diff visually smooth but not isolated as a standalone counter sample. 2560×1440 approximately 63–82 FPS; 1366×768 approximately 130 FPS and no horizontal overflow.

TEST_STATUS: Web lint pass; 30 files/102 web tests pass; production build pass with chunk warning; 2 suites/26 targeted backend tests pass; backend lint 0 errors/62 pre-existing warnings; actual Packing API generated three strategies; Case API sync passed; browser console clean; diff whitespace check clean.

KNOWN_LIMITATIONS: Historical full backend suite has unrelated missing-module/outdated/stochastic failures; one real operation path reaches BLOCKED; Strategy Diff lacks a standalone FPS sample; Vite reports large chunks; dense workspaces scroll at 1366×768; studio render predates invisible forklift tread LOD.

FINAL_DEMO_FLOW: 3-minute — Overview → Cargo inspector → Strategy lanes → Twin cutaway/Risk → Evidence Rule→Space. 5-minute adds authored cameras, Operation when suitable, Decision Replay, and Strategy Diff before evidence closure.

FINAL_VERDICT: `READY_WITH_LIMITATIONS`. Visual freeze is suitable for local CMIT competition demonstration; reopen code only for a critical bug, visual blocker, or competition-material requirement.

# === END OF PORTCUBE 2.2 CONTEXT FOR CHATGPT ===
