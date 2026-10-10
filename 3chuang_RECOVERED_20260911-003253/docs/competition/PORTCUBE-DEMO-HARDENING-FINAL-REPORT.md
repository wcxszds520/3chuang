# PORTCUBE Competition Demo Hardening — Final Report

## 1. Executive Verdict

**FINAL_DEMO_CODE_LOCK**

The final competition-demo hardening is complete. The work remained within the four authorized presentation items, preserved every frozen solver and shipment truth, passed frontend and authoritative backend regression, completed the real headed-browser walkthrough, passed the 1366 checks, produced and manually reopened exactly 16 runtime screenshots, and completed the UI-only rehearsal in **196.15 seconds**.

No new P0 or P1 issue was found. No unresolved, pending, review, or external-confirmation state was hidden or converted to PASS.

## 2. Baseline

The execution baseline was `PORTCUBE_FINAL_PRESENTATION_DEMO_FREEZE`. Before modification, the following were read and used as the visual and factual reference:

- `docs/competition/PORTCUBE-FINAL-PRESENTATION-POLISH-REPORT.md`
- `artifacts/final-presentation-polish/qa.json`
- The eleven specifically required baseline screenshots covering Space, selected VOID, Balance, Risk, Unload, Evidence Detail, Source Reader, and 1366 states.

The current implementation paths were then inspected for Risk rendering and legend semantics, securing status, VOID Inspector and associated-object data, Unload camera/review state, and Evidence Detail enum hierarchy. Browser verification was performed immediately after each scoped change.

## 3. Scope Lock

Only these four items were changed:

1. Twin Risk semantic visual separation.
2. Twin VOID Inspector business-first hierarchy.
3. Twin Unload presentation-camera framing.
4. Evidence Detail technical-enum demotion.

There was no solver optimization, placement or orientation change, cargo-truth change, readiness/evidence-truth change, unload-sequence change, page addition, demo-only component, screenshot-only state, fake statistic, or frozen-page redesign.

## 4. Risk Before / After

Before: Risk truth already contained `SECURING_UNRESOLVED`, but the broad cyan-green rendering could be read as a single “all safe” status. Geometry stability and transport-securing completeness were visually conflated.

After:

- The first-read statement is **“几何稳定 ≠ 运输系固已确认”**.
- Geometry-stable cargo uses low-saturation cyan/teal as an analysis state, not success green.
- Transport-securing incompleteness uses a separate amber outline/hatch and amber attention block.
- Red remains reserved for actual `INVALID` findings.
- The existing Risk categories remain available; none were removed or rewritten as traffic-light states.

The desktop and 1366 screenshots both show the two semantic layers together. The screen no longer reads as a completed all-green transport approval.

## 5. Risk Data Semantics

The Risk change is presentation-only and reads the current runtime analysis:

- Geometry: `STABLE` remains the existing geometry/support conclusion.
- Transport securing: `SECURING_UNRESOLVED` remains unresolved.
- Required cargo count: **45**, derived from the current `requiredCargoIds.length` equivalent runtime list. It is not hard-coded.
- Missing business facts: **摩擦参数 / 阻挡能力 / 系固信息**.
- Technical fields remain visible only as secondary trace information.

No securing result was invented. Unresolved is amber attention, not red failure and not green success. Stability results, cargo data, placements, and Risk truth are unchanged.

## 6. VOID Inspector Before / After

Before: the selected `VOID-I-001` drawer exposed a long list of internal object IDs at the primary visual level, giving the first viewport the character of a debug inspector.

After, the first viewport is business-first and shows:

- **未解释剩余空间**
- `VOID-I-001`
- **原因未决** / `UNEXPLAINED / UNRESOLVED`
- **2.08 m³**
- X `6250–7550 mm`
- Y `600–2600 mm`
- Z `0–800 mm`
- **关联货物：27 件**

The root-cause explanation is explicitly evidence-limited: the space is known to exist, but current evidence cannot determine which single constraint caused it. No algorithm, LIFO, geometry, door, balance, or fragmentation cause is guessed.

Raw IDs are now collapsed by default behind **“查看关联对象 27 项”** and, when disclosed, are labelled **“技术对象 ID”** and **“内部追溯信息”**.

## 7. VOID Data Derivation

`VOID-I-001` is still the existing selected runtime void. Its volume, classification, and bounds are read directly from that object. The displayed association count is computed from the selected void's current associated cargo/object list length; the browser readback produced **27**. No count, volume, bound, SKU category, or cause is hard-coded or inferred from the image.

Frozen VOID truth remains:

- Selected: `VOID-I-001`
- Volume: `2.08 m³`
- Classification: `UNEXPLAINED / UNRESOLVED`
- Total unexplained void: `3.76129 m³`

## 8. Unload Camera Before / After

Before: the 1366 review panel had already been corrected, but the door aperture, current cargo, and path were still modest in the remaining stage area.

After: only the `UNLOAD_REVIEW` presentation camera was adjusted. Its target is biased toward the door/work area and its crop scale is `0.72`. The resulting 1366 frame makes the CTU interior, door frame, current cargo, unload path, staging label, and review panel visible together. The panel does not replace or cover the stage, and the CTU is no longer a distant secondary object.

No scene coordinate, container, cargo, staging-zone truth, placement, or unload sequence was moved or changed.

## 9. Unload Boundary Validation

| State | Port/current meaning | Remaining | `EMPTY_CTU` | Result |
|---|---|---:|---|---|
| 0 / 212 | HAM start | 212 | No | PASS |
| 106 / 212 | RTM midpoint | 106 | No | PASS |
| 211 / 212 | ANR near-empty | 1 | No | PASS |
| 212 / 212 | Complete | 0 | Yes | PASS |

All four states were reached through live UI playback/step controls. The 211 boundary remains a real one-item state and is not presented as empty. Only 212 shows `EMPTY_CTU`.

## 10. Evidence Hierarchy Before / After

Before: the correct internal enum values and input field paths competed visually with the business judgement.

After, the first hierarchy is:

- Judgement: **需要工程复核**
- Completeness: **证据已满足指导计算**
- Rule: **重心指导区间**

The technical values remain available in smaller secondary text:

- `PARTICULAR_CIRCUMSTANCES_REVIEW`
- `COMPLETE_FOR_GUIDANCE`
- `GUIDANCE_BAND`

The input paths `loadDistribution.centreOfGravity` and `loadDistribution.segments` remain in Input Trace. The true CoG facts remain lateral `0.096%` and longitudinal `8.266%`. Responsibility, next action, and source remain visible.

Source Reader was not redesigned. Its **来源身份 / 命中摘录 / 本票应用** structure opens correctly; its locate-in-Twin action and Browser Back both work.

## 11. Files Changed

The task-specific changes are confined to these existing implementation files:

- `web-dashboard/src/pages/workflows/TwinPage.jsx` — Risk semantic status/legend copy and VOID Inspector business-first structure with dynamically derived counts and collapsed technical IDs.
- `web-dashboard/src/three/analytics/visualizationModes.js` — low-saturation cyan/teal stable-analysis palette used by Risk.
- `web-dashboard/src/three/presentation/cameraPresets.js` — `UNLOAD_REVIEW` presentation target/crop framing only.
- `web-dashboard/src/pages/workflows/CompliancePage.jsx` — Chinese business judgement/completeness/rule promoted above internal enum values.
- `web-dashboard/src/domain/presentation/localization.js` — exact Chinese presentation labels for completeness and guidance band.
- `web-dashboard/src/styles/app.css` — scoped Risk semantic layers, amber hatching, VOID hierarchy, and Evidence hierarchy styling.

The worktree contained broader existing user changes before this task. They were preserved and not cleaned, reset, committed, or pushed.

## 12. Solver Truth Reverification

| Frozen fact | Verified value | Result |
|---|---|---|
| Dataset | `DEMO_DATA` | UNCHANGED |
| Solver | `hybrid-v2.5` | UNCHANGED |
| Container | `40HQ reference profile` | UNCHANGED |
| Loaded | `212 / 212` | UNCHANGED |
| Placement hash | `095db720bcd6b519` | UNCHANGED |
| Strategy convergence | `true` | UNCHANGED |
| Hard violations | `0` | UNCHANGED |
| Stability invalid | `0` | UNCHANGED |
| Operation blocked | `0` | UNCHANGED |
| Port blocked | `0` | UNCHANGED |
| Rehandles | `0` | UNCHANGED |
| Full unload | `FULL_UNLOAD_PASS = true` | UNCHANGED |
| Post-unload stability | `true` | UNCHANGED |
| CoG | `0.096% / 8.266%` | UNCHANGED |
| CoG judgement | `PARTICULAR_CIRCUMSTANCES_REVIEW` | UNCHANGED |
| Selected VOID | `VOID-I-001 / 2.08 m³` | UNCHANGED |
| Total unexplained void | `3.76129 m³` | UNCHANGED |
| VGM | `PENDING_IF_UNRECORDED` | UNCHANGED |
| Actual container / CSC / carrier / terminal | `EXTERNAL_CONFIRMATION` | UNCHANGED |

The placement hash gate did not move. No frozen truth changed.

## 13. Frontend Tests

- Focused regression: **2 files / 5 tests / 0 failures — PASS**.
- `npm run lint`: **PASS**, 0 warnings.
- `npm run test -- --run`: **32 files / 117 tests / 0 failures — PASS**.
- `npm run build`: **PASS**, 1,668 modules, 44.18 seconds.
- Final `git diff --check`: **PASS**; only informational LF/CRLF working-copy notices were emitted.

## 14. Backend Tests

The fresh authoritative targeted truth regression passed:

- **11 suites**
- **35 tests**
- **0 failures**
- **1,164.949 seconds**

The run covered Hybrid V2.5, solver benchmark, floor extreme-point behavior, shipment-readiness integration, VOID justification, real-world decision rules, stability, plan validation, packaging profile, and load-balance repair truth.

## 15. Browser Console

The final real-browser flow completed with:

- Console errors: **0**
- Warnings: **0**
- New warnings: **0**
- Route errors: **0**
- Critical interaction failures: **0**
- Dead buttons in the rehearsal: **0**

No DevTools or manual URL edit was required to continue the final rehearsal.

## 16. Responsive 1366

The required 1366 checks passed:

- Risk: headline, two semantic layers, required count, and legend are readable; unresolved securing is not success green.
- VOID Inspector: ID, `2.08 m³`, classification, X/Y/Z bounds, association count, and collapsed technical disclosure appear in the first viewport.
- Unload: CTU, door aperture, current cargo, path, staging label, and review panel are simultaneously visible without stage/panel overlap.
- Evidence Detail: Chinese business conclusion is primary; CoG facts, responsibility, next action, and secondary enums remain readable.

No main-content obstruction or 1366 critical clipping was found.

## 17. Screenshot Index

Exactly **16 / 16** runtime PNG screenshots exist in `artifacts/demo-hardening-final/screenshots/`. There are no JPG or other image files in the directory. Every image was captured from the real browser state, converted losslessly to a true PNG container without resizing, cropping, compositing, Photoshop, fake overlays, or upscaling, and then manually reopened.

| # | File | Dimensions | Review |
|---:|---|---|---|
| 1 | `01-twin-risk-desktop.png` | 1673×1074 | PASS |
| 2 | `02-twin-risk-1366.png` | 1356×762 | PASS |
| 3 | `03-twin-void-desktop.png` | 1673×1074 | PASS |
| 4 | `04-twin-void-1366.png` | 1356×762 | PASS |
| 5 | `05-twin-unload-start-desktop.png` | 1673×1074 | PASS |
| 6 | `06-twin-unload-mid-desktop.png` | 1673×1074 | PASS |
| 7 | `07-twin-unload-near-empty-desktop.png` | 1673×1074 | PASS |
| 8 | `08-twin-unload-complete-desktop.png` | 1673×1074 | PASS |
| 9 | `09-twin-unload-1366.png` | 1356×762 | PASS |
| 10 | `10-evidence-detail-desktop.png` | 1683×1080 | PASS |
| 11 | `11-evidence-detail-1366.png` | 1366×768 | PASS |
| 12 | `12-source-reader-desktop.png` | 1683×1080 | PASS |
| 13 | `13-final-demo-landing.png` | 1673×1074 | PASS |
| 14 | `14-final-demo-planning.png` | 1673×1074 | PASS |
| 15 | `15-final-demo-twin.png` | 1673×1074 | PASS |
| 16 | `16-final-demo-readiness.png` | 1673×1074 | PASS |

No white frame, loading state, wrong mode, wrong boundary, broken drawer, or route-error frame remained in the final set.

## 18. Three-Minute Rehearsal

The complete UI-only operator flow took **196.15 seconds**, within the requested **3:20 maximum**.

| Step | Live action/check | Result |
|---|---|---|
| Landing | Hero statement and entry to professional workspace | PASS |
| Cargo | 10 SKU / 212 pieces; no data edits | PASS |
| Planning | 20GP / 40GP / 40HQ; 40HQ as formal reference; converged strategy truth | PASS |
| Twin Normal | 212 / 212 formal placement | PASS |
| Twin Space | Space analysis and real `VOID-I-001` locate through the existing Evidence → Twin UI action | PASS |
| Twin Balance | 8.266% and engineering-review judgement | PASS |
| Twin Risk | Geometry stable is visibly distinct from securing unresolved | PASS |
| Twin Unload | UI playback/steps reached 0, 106, 211, and 212 with exact boundary semantics | PASS |
| Readiness | Seven responsibility actions; missing material was not converted to PASS | PASS |
| CoG Detail | Fact → calculation → judgement → responsibility → next action → source | PASS |
| Source Reader | Source identity, cited excerpt, and current-shipment application | PASS |
| Evidence → Twin → Back | Locate action and Browser Back | PASS |

The clean preview origin also opened directly to `DEMO_DATA`, 10 SKU, and 212 pieces without an old-session migration banner. No automatic storage deletion was added. A fresh clean origin requires a formal solve before formal Readiness evidence appears, which is the intended workflow; the competition preflight should retain the solved demo state.

The closing statement remains: “PORTCUBE 把货物事实、空间求解、三维复核和出运证据放进同一条可追溯决策链。”

## 19. Remaining Limitations

1. **TEST_ENVIRONMENT_LIMITATION — performance telemetry:** the embedded headed-browser environment does not expose trustworthy LCP/FCP or sustained-FPS measurements. No performance number is fabricated. The production build passed.
2. **Expected evidence state:** VGM remains `PENDING_IF_UNRECORDED`; actual container, CSC, carrier, and terminal acceptance remain `EXTERNAL_CONFIRMATION`. These are required truthful states, not product failures.
3. **Competition-machine preflight:** manually clear only old site local/session storage, open the app, verify 10 SKU / 212 `DEMO_DATA`, generate or retain the formal solved plan, and keep the page stable. Production code does not automatically clear user data.

There is no unresolved hardening P0/P1 and no limitation that blocks the required demo flow.

## 20. Final Lock Decision

All Definition-of-Done gates are satisfied: Risk semantics are no longer misleading, the VOID first viewport is business-readable with dynamically derived associations, Unload framing and all four boundaries are correct, Evidence is business-first without losing traceability, Source Reader and Evidence → Twin remain functional, solver truth and placement hash are frozen, regressions pass, console is clean, 16 screenshots are verified, desktop and 1366 pass, and the live rehearsal completes within 3:20.

**FINAL_DEMO_CODE_LOCK: AUTHORIZED**

**PORTCUBE_FINAL_DEMO_CODE_LOCK**

NO FURTHER PRODUCT OR VISUAL REFACTORING RECOMMENDED BEFORE COMPETITION SUBMISSION.
