# PORTCUBE Competition 2.10 Digital Twin Final Art Report

## 1 Executive Verdict

VISUAL_VERDICT: **READY**. ENGINEERING_VERDICT: **READY_WITH_LIMITATIONS**. OVERALL_VERDICT: **READY_WITH_TEST_ENVIRONMENT_LIMITATION**. All visual-art, solver-truth, frontend, backend and browser-functional gates passed. The only engineering limitation is that the headed Codex in-app Browser did not expose trustworthy LCP/FCP entries and throttled `requestAnimationFrame` after its initial visible burst; this is recorded as `PERFORMANCE_EVIDENCE_LIMITED`, not hidden or converted into a false performance pass.

The authorized visual freeze marker is:

`PORTCUBE_COMPETITION_2_10_DIGITAL_TWIN_FINAL_ART_FREEZE`

## 2 Competition 2.9 Baseline

The 2.9 baseline was read from `docs/competition/PORTCUBE-COMPETITION-2.9-FINAL-REPORT.md`, all baseline screenshots, `artifacts/competition-2.9/visual-qa.json` and `artifacts/competition-2.9/performance.json`. It already had correct business truth and a working six-mode Twin, but the principal objects were not consistently dominant: Landing Twin was embedded and small, Workspace Normal occupied roughly 40–45% of the stage, Space selection was weak, Balance relied on HUD explanation, Unload was visually uniform and side-on, Planning had disabled-looking alternatives and dead space, and the 1366 captures reduced the primary objects too aggressively.

## 3 Scope Freeze

The frozen Landing Evidence/Final CTA, Workspace Cargo/Inspector, Readiness/Evidence Detail/Source Reader and solver/data contracts were not redesigned. Cargo placements, shipment schema, evidence ownership, CoG and VOID truth were preserved. Work was confined to the permitted Landing composition tuning and the active Landing Twin, Workspace Twin, Planning Equipment, Strategy presentation and Unload surfaces. No AI assistant, new dashboard, map, weather, realtime port feed, permissions system, cloud layer or unrelated module was introduced.

## 4 Remaining Visual Problems Found

The inspect–modify–capture loop found and resolved four late issues: an empty first Workspace Normal capture, right-edge clipping caused by the docked browser panel, an over-cropped Landing Standard camera at both desktop and 1366 widths, and a staging label that initially sat behind the unload review panel. Each affected frame was overwritten, reopened and reviewed. No unresolved major visual defect remains; only the documented host capture/performance limitations remain.

## 5 Object-First Art Direction

The final hierarchy is container/cargo 70–80%, environment 15–25% and HUD 5–15%. Large dark empty fields, oversized worksite geometry and decorative overlays were reduced. The visual center is now the formal loaded CTU, selected cargo, selected VOID, CoG marker or unload route according to mode. Text and HUD explain those objects instead of competing with them.

## 6 Landing Twin Redesign

Landing Twin is a full-bleed decision stage with four modes: Standard, Space, Balance and Unload. Standard and Space occupy approximately 68% and 66% of the reviewed desktop viewport; the 1366 Standard frame is approximately 73%. The composition preserves the formal 212-placement plan and changes only presentation, camera and evidence overlays.

## 7 Workspace Twin Redesign

Workspace Normal now presents the CTU at approximately 73% desktop width and 75% in the reviewed 1366 frame. The toolbar remains one row, the formal plan HUD stays compact, and mode-specific inspector content no longer displaces the core object. Deep links reproduce Space, selected VOID, Balance and unload-step states for deterministic QA.

## 8 Environment Simplification

The inspection hall remains as a restrained context layer. Backdrop, rail, floor and zone geometry are quieter; Unload hides the normal worksite and uses a dedicated review deck. The resulting scene reads as an industrial decision space rather than a generic dark game environment. Environment noise is materially lower than 2.9 while the container frame and cargo keep their form cues.

## 9 Camera Presets

Seven semantic presets are frozen and unit-tested: `NORMAL_HERO`, `DOOR_REVIEW`, `SIDE_REVIEW`, `TOP_REVIEW`, `SPACE_REVIEW`, `BALANCE_REVIEW` and `UNLOAD_REVIEW`. Transitions use approximately 0.68–0.78 seconds with the required `cubic-bezier(.2,.8,.2,1)` feel. Landing Standard uses separate desktop and <=1400 px distance multipliers so neither breakpoint over-crops the CTU.

## 10 Lighting

The renderer uses sRGB output, ACES Filmic tone mapping and exposure 1.04. A 0.78 hemisphere light is supported by a 1.92 key, 0.68 fill, 0.92 rim and 1.42 overhead rectangular light. This preserves blue-metal separation, cargo material readability and open-door depth without flattening the scene.

## 11 Materials

Cargo remains fully opaque in Normal. Space mode reduces cargo to 0.34 opacity; residual volumes stay quiet while the selected VOID uses 0.27 fill and 0.98 edge opacity. Unload uses current/next/future emphasis of 100%/70%/40%. The review deck is matte and the route/staging materials use restrained cyan/teal emission-like contrast without changing formal cargo geometry.

## 12 Normal Mode

Normal is the main formal-plan view: 212/212 loaded, 100% replay completion, LIFO pass and the unchanged CoG summary. The CTU is the dominant object in Landing and Workspace, with the full frame readable and no invented placement differences.

## 13 Space Mode

Space mode exposes residual regions through a translucent CTU/cargo treatment. The unselected state remains legible without turning every residual cell into an equal-priority annotation. Selecting a VOID changes the spatial primary and opens the factual inspector.

## 14 VOID Spatial Evidence

`VOID-I-001` is visibly selected in amber and annotated exactly as `VOID-I-001 · 2.08 m³ · UNEXPLAINED · ROOT CAUSE UNRESOLVED`. The inspector preserves dimensions and related cargo. Total unexplained space remains approximately 3.76 m³. No visual treatment implies that the root cause is resolved.

## 15 Balance Mode

Balance is now a spatial top view rather than a HUD-only state. A true centerline, true CoG marker, distance cues and six floor segments appear in the 3D scene. Geometric stability remains a separate fact from the engineering-review judgement.

## 16 CoG Spatial Evidence

The displayed values are the formal values: lateral 0.096% and longitudinal 8.266%. The scene and panel both retain `STABLE` geometry/LIFO facts while the decision language remains `PARTICULAR_CIRCUMSTANCES_REVIEW`; stable geometry is not presented as automatic shipment approval.

## 17 Unload Spatial Replay

Unload uses an open-door three-quarter camera, deterministic 650–1100 ms cargo motion, a visible curved route and current/next/future opacity hierarchy. Captures at 0/212, 106/212 and 211/212 show a real spatial progression from full CTU through half unload to the nearly empty state.

## 18 Staging Zone

The route terminates in a dedicated outlined staging plane outside the doors. `STAGING ZONE · 已卸暂存` was repositioned and reduced so it remains readable below the review panel. Staged cargo proxies persist as visual evidence instead of disappearing from the scene.

## 19 Planning Equipment

20GP, 40GP and 40HQ share one visual scale and remain recognizable. Opacity communicates reference priority rather than disabled state. 40HQ is selected with the true 212/212 result; the real-container/CSC boundary remains explicitly reference-only.

## 20 Strategy Layout Cleanup

The previous dead comparison space is replaced by a formal top-layout projection and three-objective convergence panel. SPACE, BALANCE and OPERATION show the same placement hash `095db720bcd6b519`, so the UI does not fabricate visual differences when the strategies converge.

## 21 Landing Hero 1366

The hero cutaway is materially larger, the statement/CTA hierarchy remains intact and the object remains the visual anchor. The bounded capture shows no critical overlap or horizontal overflow.

## 22 Why 1366

The CTU remains central and the third question is visible in the initial section frame. Connector lines and callouts remain subordinate to the object.

## 23 Cargo 1366

The selected carton is shown as a full object, centered at large scale, with the packaging rail and three-step explanation retained. The final capture intentionally focuses the inspection stage rather than repeating the section intro.

## 24 Landing Twin 1366

The standard CTU occupies approximately 73% of the viewport and remains fully readable beside the mode rail. The responsive distance multiplier is distinct from desktop so the same scene does not become over-cropped.

## 25 Workspace Twin 1366

Normal remains approximately 75% wide and Unload approximately 68%. The toolbar is compact and the stage retains a CSS minimum height of 580 px. The 762 px host raster naturally shows only the upper portion of the scrollable stage; this is a capture-window limitation, not stage compression.

## 26 Motion System

Camera changes use semantic presets and 0.68–0.78 second easing. Unload cargo follows a deterministic Catmull–Rom route with directional arrowheads. Motion is used to explain state change and remains understandable in the three static evidence frames.

## 27 UI Simplification

Mode controls, formal-plan facts and inspector panels were retained; duplicate decoration, noisy grid emphasis and oversized HUD blocks were reduced. Space, Balance and Unload each have one primary evidence story. No new feature surface was added.

## 28 Art Direction QA

All hard art gates pass. Scores: Landing Hero 8.8, Landing Twin 8.9, Planning Equipment 8.6, Twin Normal 8.7, Twin Space 8.9, Twin Balance 8.8 and Twin Unload 8.8. Normal coverage is 73%, selected VOID is obvious, CoG is visible in 3D, the unload path and staging zone are visible, alternative equipment is recognizable, Strategy has no giant dead space and 1366 objects remain dominant.

## 29 Screenshot-by-Screenshot Scores

| Screenshot | Technical | Art Score | Primary Visual | Major Defect | Pass/Fail |
|---|---:|---:|---|---|---|
| 01-landing-hero-1920.png | PASS | 8.8 | Loaded cutaway container | None | PASS |
| 02-landing-why-1920.png | PASS | 8.6 | CTU + three questions | None | PASS |
| 03-landing-cargo-1920.png | PASS | 8.8 | Full carton object | None | PASS |
| 04-landing-twin-standard-1920.png | PASS | 8.8 | Formal 212-placement CTU | None | PASS |
| 05-landing-twin-space-1920.png | PASS | 8.9 | Transparent CTU + VOID | None | PASS |
| 06-planning-equipment-1920.png | PASS | 8.6 | Shared-scale equipment stage | None | PASS |
| 07-planning-strategy-1920.png | PASS | 8.7 | Converged formal layout | None | PASS |
| 08-twin-normal-1920.png | PASS | 8.7 | Workspace Normal | None | PASS |
| 09-twin-door-1920.png | PASS | 8.5 | Door-side review | Foreground rail remains visible | PASS WITH NOTE |
| 10-twin-space-1920.png | PASS | 8.6 | Residual-space field | None | PASS |
| 11-twin-space-void-selected-1920.png | PASS | 8.9 | Selected VOID + inspector | None | PASS |
| 12-twin-balance-1920.png | PASS | 8.8 | CoG + six floor segments | None | PASS |
| 13-twin-unload-start-1920.png | PASS | 8.7 | Full CTU + route | None | PASS |
| 14-twin-unload-mid-1920.png | PASS | 8.8 | Half unload + staging | None | PASS |
| 15-twin-unload-staging-1920.png | PASS | 8.8 | Empty CTU + staging | None | PASS |
| 16-landing-hero-1366.png | PASS | 8.7 | Responsive hero | None | PASS |
| 17-landing-why-1366.png | PASS | 8.5 | Responsive Why | None | PASS |
| 18-landing-cargo-1366.png | PASS | 8.7 | Responsive full carton | None | PASS |
| 19-landing-twin-1366.png | PASS | 8.6 | Responsive Standard Twin | None | PASS |
| 20-planning-equipment-1366.png | PASS | 8.4 | Responsive equipment stage | Lower matrix continues below fold | PASS WITH NOTE |
| 21-twin-normal-1366.png | PASS | 8.5 | Responsive Normal | Stage continues below bounded capture | PASS WITH NOTE |
| 22-twin-unload-1366.png | PASS | 8.5 | Responsive Unload | Lower path continues below bounded capture | PASS WITH NOTE |

## 30 Before / After Comparison

No screenshot was copied into this report. The comparison records source filenames and reviewed visual differences.

| 2.9 baseline | 2.10 evidence | Visual difference |
|---|---|---|
| 05-landing-twin-standard-1920.png | 04-landing-twin-standard-1920.png | Embedded/small stage -> full-bleed object-first CTU at ~68%. |
| 06-landing-twin-space-1920.png | 05-landing-twin-space-1920.png | Weak space state -> selected amber VOID with exact unresolved annotation. |
| 11-workspace-planning-equipment-1920.png | 06-planning-equipment-1920.png | Faded alternatives -> three recognizable shared-scale candidates. |
| 12-workspace-planning-strategy-1920.png | 07-planning-strategy-1920.png | Dead comparison area -> formal converged layout projection. |
| 13-workspace-twin-normal-1920.png | 08-twin-normal-1920.png | ~40–45% CTU -> ~73% CTU and compact HUD. |
| 14-workspace-twin-space-1920.png | 11-twin-space-void-selected-1920.png | General diagnostics -> selected spatial primary plus inspector. |
| 15-workspace-twin-balance-1920.png | 12-twin-balance-1920.png | HUD explanation -> spatial CoG, centerline and six segments. |
| 16-workspace-twin-unload-1920.png | 13/14/15-twin-unload-*.png | Side-on uniform state -> open-door path, progress and staging sequence. |
| 20-landing-hero-1366.png | 16-landing-hero-1366.png | Small hero object -> dominant cutaway with intact CTA hierarchy. |
| 21-landing-why-1366.png | 17-landing-why-1366.png | Third item cut -> third question visible. |
| 22-landing-cargo-1366.png | 18-landing-cargo-1366.png | Clipped object -> full centered carton. |
| 23-landing-twin-1366.png | 19-landing-twin-1366.png | Small Twin -> complete CTU at ~73%. |
| 24-workspace-planning-1366.png | 20-planning-equipment-1366.png | Weak equipment priority -> clear 40HQ selection without disabling alternatives. |
| 25-workspace-twin-1366.png | 21/22-twin-*-1366.png | Reduced scene -> dominant CTU with compact normal/unload controls. |

## 31 Formal Solver Reverification

The authoritative targeted backend run passed 11/11 suites and 35/35 tests in 1048.186 seconds. Dataset A remains `DEMO_DATA`, solver `hybrid-v2.5`, container `40HQ`, loaded 212/212 and placement hash `095db720bcd6b519`. Strategy convergence is TRUE. Independent validation reports 0 hard violations, 0 stability invalid, 0 operation blocked, 0 port blocked and 0 rehandles. `FULL_UNLOAD_PASS` and post-unload stability remain true. No solver, candidate-generation, beam, EP, support, LIFO, balance-repair or port-validation source was modified by the 2.10 art pass.

## 32 CoG Truth

Lateral CoG is 0.096%; longitudinal CoG is 8.266%. Geometric stability and LIFO are true, but longitudinal distribution remains `PARTICULAR_CIRCUMSTANCES_REVIEW`. Copy avoids “optimal”, “completely safe”, “automatically compliant” and “ready to ship” claims.

## 33 VOID Truth

`VOID-I-001` is 2.08 m³ and remains `UNEXPLAINED` / `UNRESOLVED`. Total unexplained VOID is approximately 3.76 m³. The selected-zone treatment does not change classification or infer a root cause.

## 34 Performance Method

Three unique-query Landing cold starts and three unique-query Workspace Normal cold starts were measured in the headed in-app Browser using the query-gated probe in `web-dashboard/index.html`. Navigation timing, CLS, resource counts and initial visible frame bursts were captured. The browser exposed no LCP/FCP entries and throttled rAF to ~1 Hz after its initial burst while `visibilityState` still reported `visible`; those samples are explicitly rejected as application FPS. The viewport override was reset after measurement.

## 35 Performance Results

Landing medians: TTFB 16.9 ms, DOMContentLoaded 792.0 ms, load 802.0 ms and content-ready 809.5 ms. Workspace Normal medians: TTFB 17.4 ms, DOMContentLoaded 657.5 ms, load 986.0 ms and content-ready 994.6 ms. CLS was 0 in every run. LCP/FCP are not evaluable. Initial visible bursts included 126–163 FPS on Landing and 73.93 FPS on the first Twin run, but the sustained gate remains `PERFORMANCE_EVIDENCE_LIMITED` because the host subsequently throttled sampling.

## 36 Build Result

Production build PASS: 1668 modules transformed. Entry JS 66.23 kB / 22.76 kB gzip; Landing Page 24.58 / 9.17; Landing Experience 4.06 / 2.16; Three deferred chunk 563.72 / 142.90; Twin Page 54.54 / 19.54; CSS 271.71 / 51.44. Versus 2.9, entry and Landing Page are unchanged; the bounded art pass adds 0.69 kB to Landing Experience, 13.24 kB to the deferred Three chunk and 5.09 kB CSS while preserving route-level deferral.

## 37 Frontend Tests

`npm run lint` PASS with zero warnings. `npm run test -- --run` PASS: 32 files and 117 tests. `npm run build` PASS. `git diff --check` reported only pre-existing line-ending conversion warnings and no whitespace error.

## 38 Backend Tests

PASS: `HybridConstraintPackingSolverV25`, fixed-seed `solverBenchmark`, `FloorExtremePointCandidate`, `ShipmentReadinessServiceV25`, `VoidJustificationAnalyzerV25`, `LoadBalanceAwareLocalRepair`, `RealWorldDecisionV24`, `PlanValidator`, `StabilityAnalyzer`, `PackagingProfileV25` and the shipment-readiness integration suite. Totals: 11 suites, 35 tests, 0 failures.

## 39 Browser QA

Functional browser QA reproduced Landing Hero/Why/Cargo/Twin modes, Planning Equipment/Strategy, Workspace Normal/Door/Space/selected VOID/Balance and deterministic Unload steps. The original empty Normal capture was rejected and replaced. All 22 final PNGs were reopened; PNG signatures, counts and raster sizes were verified. No critical horizontal overflow or unreadable truth state remains.

## 40 Remaining Limitations

1. `TEST_ENVIRONMENT_LIMITATION`: the docked in-app Browser exports 1662×1067 desktop and 1356×762 responsive rasters rather than native filename dimensions; no image was upscaled or fabricated.
2. `PERFORMANCE_EVIDENCE_LIMITED`: LCP/FCP and sustained foreground FPS need a trustworthy foreground Chrome run for a separate performance freeze.
3. VGM remains pending if unrecorded; CSC, carrier and actual-unit evidence remain external confirmations. The displayed container is a reference boundary, not actual-unit admission evidence.
4. At 1366 height, scrollable Planning/Workspace content continues below the initial bounded frame. Core objects and controls remain dominant and operable.

## 41 Final Competition Demo Flow

- 0:00–0:20 — Hero.
- 0:20–0:35 — Why.
- 0:35–0:55 — Cargo / Cargo→Space.
- 0:55–1:15 — Planning Equipment.
- 1:15–1:40 — Twin Normal → selected Space VOID.
- 1:40–2:00 — Balance with true CoG.
- 2:00–2:30 — Unload start → mid → staging.
- 2:30–2:50 — frozen Evidence / Source surfaces.
- 2:50–3:00 — truth boundary: engineering review, unresolved VOID, pending/external evidence.

## 42 Freeze Decision

Solver Truth PASS; Frontend PASS; Browser functional PASS. Landing Hero 8.8, Landing Twin 8.9, Planning Equipment 8.6, Twin Normal 8.7, Twin Space 8.9, Twin Balance 8.8 and Twin Unload 8.8. Normal and Landing Twin coverage exceed 65% and 62%; unload path, staging, 3D CoG and selected VOID are visible; 20GP/40GP remain recognizable; Strategy has no giant dead space; 1366 primary objects remain dominant. Therefore the visual final-art freeze is authorized. Performance remains a separately labelled evidence limitation and does not invalidate visual freeze.

`PORTCUBE_COMPETITION_2_10_DIGITAL_TWIN_FINAL_ART_FREEZE`

## 43 COMPLETE CONTEXT FOR CHATGPT

=== START OF PORTCUBE 2.10 COMPLETE CONTEXT FOR CHATGPT ===

PROJECT_ROOT: D:\cixing\3chuang

BASELINE: Competition 2.9 report, screenshots, visual QA and performance artifacts were inspected before modification.

VISUAL_VERDICT: READY

ENGINEERING_VERDICT: READY_WITH_LIMITATIONS

OVERALL_VERDICT: READY_WITH_TEST_ENVIRONMENT_LIMITATION

FINAL_FREEZE: AUTHORIZED

SOLVER: hybrid-v2.5

PLACEMENT_HASH: 095db720bcd6b519

DATASET_A: DEMO_DATA / 40HQ

LOADED: 212/212; convergence TRUE; hard/stability/operation/port/rehandle all 0; FULL_UNLOAD_PASS true; post-unload stable true

COG: lateral 0.096%; longitudinal 8.266%; PARTICULAR_CIRCUMSTANCES_REVIEW

VOID: VOID-I-001 2.08 m³ UNEXPLAINED / UNRESOLVED; total unexplained approximately 3.76 m³

LANDING_HERO: READY, art 8.8, dominant cutaway

LANDING_TWIN: READY, art 8.9, Standard/Space/Balance/Unload, 68% desktop and 73% responsive Standard coverage

PLANNING_EQUIPMENT: READY, art 8.6, 20GP/40GP/40HQ recognizable, 40HQ selected 212/212

STRATEGY: convergence TRUE, formal top layout, no fabricated strategy differences

TWIN_NORMAL: READY, art 8.7, approximately 73% desktop coverage

TWIN_SPACE: READY, art 8.9, selected VOID spatial primary

TWIN_BALANCE: READY, art 8.8, true CoG + centerline + six floor segments

TWIN_UNLOAD: READY, art 8.8, deterministic route, open doors, current/next/future hierarchy

ENVIRONMENT: quiet inspection context; hidden in unload review

CAMERA: NORMAL_HERO, DOOR_REVIEW, SIDE_REVIEW, TOP_REVIEW, SPACE_REVIEW, BALANCE_REVIEW, UNLOAD_REVIEW

LIGHTING: ACES Filmic, exposure 1.04, hemisphere/key/fill/rim/overhead rig

UNLOAD_PATH: visible Catmull–Rom route with arrowheads; 650–1100 ms deterministic motion

STAGING_ZONE: outlined spatial zone and readable `STAGING ZONE · 已卸暂存` label

RESPONSIVE: 1366 hero/why/cargo/twin/planning/workspace gates pass; stage CSS min-height 580 px

ART_DIRECTION_SCORES: Hero 8.8; Landing Twin 8.9; Planning 8.6; Normal 8.7; Space 8.9; Balance 8.8; Unload 8.8

PERFORMANCE: CLS 0; Landing content-ready median 809.5 ms; Twin 994.6 ms; LCP/FCP/sustained FPS TEST_ENVIRONMENT_LIMITATION

FRONTEND_TESTS: lint PASS; 32/32 files and 117/117 tests PASS; build PASS

BACKEND_TESTS: 11/11 suites and 35/35 tests PASS in 1048.186 s

BROWSER_QA: 22/22 required PNGs captured, opened and reviewed; browser viewport reset

SCREENSHOT_PATH: D:\cixing\3chuang\artifacts\competition-2.10\screenshots

KNOWN_LIMITATIONS: bounded in-app-browser raster; performance evidence limited; VGM/CSC/carrier/actual-unit confirmations remain external

FREEZE_MARKER: PORTCUBE_COMPETITION_2_10_DIGITAL_TWIN_FINAL_ART_FREEZE

=== END OF PORTCUBE 2.10 COMPLETE CONTEXT FOR CHATGPT ===
