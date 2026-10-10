# PORTCUBE Competition 2.6 Final Report

Generated: 2026-08-27  
Project root: `D:\cixing\3chuang`  
Active case: `NB2026-0824-001` / Dataset A / 212 pieces  
Official solver identity: `hybrid-v2.5`

## 1. Executive Verdict

**READY_WITH_LIMITATIONS**

Competition 2.6 is complete as a coherent public experience plus professional spatial-decision workspace. The six-section landing, workspace separation, cargo/package visualization, proportional equipment choice, converged planning explanation, digital-twin analysis, shipment-readiness evidence flow, Source Reader, Rule-to-Twin navigation, solver regression protection, browser QA, and the 21 required screenshots are present and verified.

The experience freeze is declared:

`PORTCUBE_COMPETITION_2_6_EXPERIENCE_FREEZE`

This does not erase the disclosed limitations: Dataset A remains at 8.266% longitudinal CoG and therefore requires particular-circumstances review; the current bounded balance repair found no safe promotion; the full historical backend suite still contains legacy failures outside the current solver/readiness path; and no product claim extends to certified VGM, CSC, lashing engineering, carrier acceptance, terminal gate-in, customs clearance, or a global mathematical optimum.

## 2. Landing Architecture

The public route `/` is now a standalone continuous narrative, not a workspace page with its chrome hidden. It has six primary scroll chapters plus a final CTA:

1. Hero — product position and spatial composition.
2. Problem — why post-loading discovery is too late.
3. Cargo — packaging and constraints before abstract geometry.
4. Cargo to Space — geometry, stability, and port-access decisions.
5. Digital Twin — the same plan viewed as structure, balance, void, and unload sequence.
6. Verify — fact, condition, decision, and source.
7. Final CTA — enters `/workspace`.

The landing owns its own bright art direction and lightweight Three.js scene. Professional routes live under `/workspace`, so public storytelling and daily decision work no longer compete for one layout.

## 3. Six References Mapped to Six Sections

The six uploaded references were treated as composition and pacing references, not screens to copy and not workspace templates.

| Reference | Section | Principle absorbed | PORTCUBE translation |
|---|---|---|---|
| REFERENCE_01 | Hero | Oversized title, generous whitespace, one dominant product object | Bright industrial container/cargo composition; no hero KPI wall |
| REFERENCE_02 | Problem | Split narrative and strong before/after rhythm | Traditional late discovery contrasted with spatial pre-checks, without invented percentages |
| REFERENCE_03 | Cargo | Product-gallery pacing and material-led storytelling | Four-to-six real cargo-kit packaging types with compact constraint labels |
| REFERENCE_04 | Cargo to Space | Sequential transformation rather than a static feature grid | Cargo → constraint → candidate → packing space → stable result |
| REFERENCE_05 | Digital Twin | Full-width visual climax and progressive reveal | One container changes through normal, cutaway, balance, void, and unload concepts |
| REFERENCE_06 | Verify | Calm evidence layer and decisive closing action | Current value → condition → judgment → basis, followed by the workspace CTA |

Orange/green reference colors were deliberately not copied. All references remain confined to landing composition; none became a business-workspace template.

## 4. Landing Design System

- Surfaces: warm white, cool white, and very light blue-gray.
- Typography: deep navy/blue-black for hierarchy; Chinese-first copy.
- Interaction color: high-purity PORTCUBE blue with restrained cyan-blue accents.
- State colors: green only for proven success; amber only for review/data-required states.
- Layout: large editorial type, asymmetric spatial compositions, deliberate negative space, and fewer borders/cards.
- Visual rule: the container and packaging forms carry the story; badges, metrics, and software chrome recede.
- Prohibited visual tropes were avoided: no dark cyberpunk page, purple AI gradient, neon wireframe, glass-card wall, AI brain, or fake industrial telemetry.

## 5. Landing Motion System

Motion is short, staged, and subordinate to the narrative:

- Container/cargo entrance is layered rather than a cloud of independently flying objects.
- Pointer parallax is deliberately shallow.
- Section reveals use opacity/translation with restrained timing.
- Header behavior changes from hero-overlay treatment into a readable sticky navigation state.
- The Three.js experience pauses when offscreen, and `prefers-reduced-motion` is respected.
- The capture query (`?capture=1`) makes all sections deterministic for screenshot QA; normal navigation retains the intended scroll sequence.

## 6. Landing Actual Implementation

`LandingPage.jsx` provides the semantic section structure, public navigation, CTA behavior, cargo showcase, solver narrative, twin story, and verification layer. `LandingExperience.jsx` provides the integrated industrial spatial composition. It reuses the real container and cargo-kit GLBs already in the repository, disposes generated thumbnails, and does not introduce AI-generated imagery or fabricated performance/business numbers.

The landing links into real application routes, including `/workspace`, and remains functional at 2560, 1920, and 1366 widths.

## 7. Workspace Architecture

Workspace routes are:

| Route | Responsibility |
|---|---|
| `/workspace` | Current-case overview and next decision |
| `/workspace/cargo` | Packaging, dimensions, handling, destination, and solver constraints |
| `/workspace/planning` | Equipment selection and strategy result |
| `/workspace/twin` | Spatial, balance, void, risk, operation, and unload analysis |
| `/workspace/readiness` | Shipment readiness, evidence, sources, and responsibility boundaries |

The workspace uses a compact dark top header and horizontal professional-tool navigation. Main content is wider, denser, and canvas-first where spatial inspection matters. Legacy route aliases remain available, while public `/` is outside the workspace shell.

## 8. Cargo Changes

Cargo is now a compact professional workbench rather than a gallery of generic cards. The primary table exposes:

- real package thumbnail, cargo name, and SKU;
- packaging type;
- dimensions;
- unit weight × quantity;
- destination;
- handling method;
- constraint summary.

The editor places a real packaging GLB preview above the editable facts and explicitly distinguishes the visual packaging asset from the solver envelope. Packaging types include carton, wood crate, palletized cartons, wrapped pallet, equipment case, drum, FIBC bag, and generic. Orientation, stackability, support, handling, and destination information continue to feed the solver rather than serving as decoration.

## 9. Container Selection Changes

The old equal-card treatment was replaced by a proportional visual selector using real container GLB thumbnails and physical proportions. Current deterministic preview values are:

| Equipment | Loaded | Remaining | Meaning |
|---|---:|---:|---|
| 20GP | 95 / 212 | 117 | Does not carry the complete shipment |
| 40GP | 176 / 212 | 36 | Does not carry the complete shipment |
| 40HQ | 212 / 212 | 0 | Complete-shipment candidate |

The UI labels the current selection as a reference profile and retains the boundary between reference equipment and an actual container instance.

## 10. Planning Changes

Planning now combines equipment choice, authoritative backend solve status, and strategy interpretation on one decision surface. It no longer pretends that identical placement hashes are three meaningfully different layouts. For Dataset A, SPACE, BALANCE, and OPERATION converge to the same placement hash, so the UI displays **“多目标收敛”**, one main plan, and three objective rows explaining the same result.

The selected 40HQ result is backend-solved, 212/212 loaded, zero hard violations, zero operation blocks, zero rehandles, full unload pass, and post-unload stable. Decision copy explicitly preserves the 8.27% engineering-review status.

## 11. Twin Changes

Twin remains the visual hero of the professional workspace. The 3D canvas occupies the dominant area and is driven by actual backend placements. It supports:

- overview, door, side, top, and cutaway cameras;
- normal, weight, port, space, balance, and risk analysis;
- load replay and multi-port unload simulation;
- placement reasoning, strategy comparison, and rule evidence;
- authoritative residual-space meshes with a deterministic grid fallback;
- cargo-set isolation for Rule-to-Twin focus.

The unload path is not a cosmetic color swap: cargo state advances through the operation timeline, target-port cargo leaves the container, and the remaining layout can be reviewed for accessibility and post-unload stability.

## 12. Readiness Changes

The former admission/compliance presentation is now **出运验证**. It summarizes what the system can establish, what needs evidence, and what remains external. The current mass facts show 8,623 kg calculated gross against 28,690 kg maximum operating gross. Calculated gross is kept distinct from a verified/declared VGM.

CoG is presented on a truthful 0 / 5 / 10 scale. The 8.27% longitudinal result is worded as engineering guidance requiring particular-circumstances review, not a fabricated legal prohibition or automatic pass.

## 13. Evidence / Source Reader

Evidence is structured as:

`fact → condition → decision → basis`

Selecting evidence reveals a compact source excerpt and metadata instead of dropping the user into a PDF wall. Source Reader provides the exact relevant passage/context, rule state, claim level, and applicability. Rule-to-Twin deep links switch to the related spatial mode, apply the matching void/cargo focus, and dim unrelated objects.

## 14. Chinese Localization

Primary product language is Chinese across the landing, navigation, workspace labels, planning explanation, twin controls, readiness decisions, and evidence flow. English remains only where it is an established identifier or audit concept, such as PORTCUBE, SKU, VGM, CSC, GLB, LIFO, or solver/candidate IDs. The public experience avoids English-heavy “AI product” language.

## 15. Solver Baseline

The official identity remains `hybrid-v2.5`. The baseline selected tight V2.3 topology for Dataset A and preserves the higher-order gates:

- 212/212 loaded;
- 0 hard violations;
- 0 operation blocks;
- full unload pass;
- 0 future rehandles;
- post-unload stable;
- deterministic placement hash `095db720bcd6b519`;
- internal void 3.76636 m³;
- unexplained void 3.76129 m³;
- cross-section P10 71.538%;
- lateral CoG 0.096%;
- longitudinal CoG 8.266%, `PARTICULAR_CIRCUMSTANCES_REVIEW`.

## 16. Solver Defects Found

The audit found a real quality tradeoff, not a hidden correctness failure:

1. Legal global translation does not improve Dataset A because the selected topology is already constrained at the legal interval used by the candidate.
2. The V2.1 global-balance fallback can reach 5.61% longitudinal CoG, but expands unexplained void to 8.53004 m³ and materially worsens topology; it therefore cannot be promoted under the requested higher-order gates.
3. The new equal-envelope weight-swap challenger has 324 eligible pairs, but three bounded trials produced no meaningful CoG improvement.
4. Dataset A therefore remains a truthful engineering-review case rather than being mislabeled as ≤5%.
5. The old V2.4 selection could prefer the lower-CoG loose topology; V2.5 correctly preserves same-guidance-class topology quality, reducing internal void by 55.846% from that path.

## 17. Solver Challenger Iterations

| Iteration | Change | Loaded | Hard | CoG | Void | Port | Stability | Runtime | Promoted? |
|---:|---|---:|---:|---:|---:|---|---|---:|---|
| 1 | V23 tight topology (`V23_BASE`) | 212 | 0 | 8.266% | 3.76129 m³ | 0 blocked / 0 rehandle | 0 initial / 0 post invalid | 2,928 ms | Yes, baseline |
| 2 | Legal global translation | 212 | 0 | 8.266% | 3.76129 m³ | 0 / 0 | 0 / 0 | 2,928 ms | No |
| 3 | V21 fallback after local repair | 212 | 0 | 10.000% | 7.52392 m³ | 0 / 0 | 0 / 0 | 221 ms | No |
| 4 | V21 global-balance fallback | 212 | 0 | 5.610% | 8.53004 m³ | 0 / 0 | 0 / 0 | 221 ms | No — void/topology regression |
| 5 | Bounded load-balance-aware local repair | 212 | 0 | 8.266% | 3.76129 m³ | 0 / 0 | 0 / 0 | 13,593 ms | No — stopped after 3 no-improvement trials |

The bounded repair only considers same-port, packaging/handling/orientation-compatible, equal-envelope placements with different weights, revalidates all gates after each trial, and stops after three consecutive non-improvements. No solver identity change was made.

## 18. Final Dataset A

All three strategies reproduce the same authoritative placement result:

| Strategy | Loaded | Hard | Operation | Rehandle | Full unload | Post-stable | Long. CoG | Internal / unexplained void | Runtime |
|---|---:|---:|---:|---:|---|---|---:|---:|---:|
| SPACE | 212/212 | 0 | 0 | 0 | Pass | Yes | 8.266% | 3.76636 / 3.76129 m³ | 13,999 ms |
| BALANCE | 212/212 | 0 | 0 | 0 | Pass | Yes | 8.266% | 3.76636 / 3.76129 m³ | 12,062 ms |
| OPERATION | 212/212 | 0 | 0 | 0 | Pass | Yes | 8.266% | 3.76636 / 3.76129 m³ | 12,968 ms |

The repeated hash passes determinism. The UI correctly renders one converged plan.

## 19. Final Dataset B

Dataset B is 69/69 for SPACE, BALANCE, and OPERATION, with zero hard violations, zero operation blocks, full unload pass, zero rehandles, post-unload stability, and deterministic hash `22333144d52bb271`. Lateral and longitudinal CoG are both 0%, guidance is `WITHIN_GENERAL_GUIDANCE`, internal/unexplained void is 4.756 m³, and cross-section P10 is 25.214%. The portfolio selects `V21_GLOBAL_BALANCE_ASSISTED` while the product identity remains `hybrid-v2.5`.

## 20. Multi-port Result

The official benchmark contains 24 multi-port cases. All 24 pass the core and deterministic gates, full unload flow, post-unload stability, and zero future rehandle. Dataset A also reports `FULL_UNLOAD_PASS`, zero blocked cargo, zero rehandle, and stable residual states.

## 21. Packaging Result

The packaging corpus contains 24 cases covering all eight supported package types: CARTON, WOOD_CRATE, PALLETIZED_CARTONS, WRAPPED_PALLET, EQUIPMENT_CASE, DRUM, FIBC_BAG, and GENERIC. All 24 pass semantic constraints, solver constraints, and determinism.

## 22. Void Analysis

Void taxonomy is normalized to the required categories:

- `USABLE_RESERVE`
- `PORT_ACCESS`
- `DOOR_CLEARANCE`
- `STRUCTURAL_CLEARANCE`
- `SECURING_SPACE`
- `GEOMETRIC_RESIDUAL`
- `UNEXPLAINED_VOID`

Dataset A reports 3.76636 m³ internal void and 3.76129 m³ unexplained void. The Twin space mode uses the authoritative components when available and a deterministic grid only as a rendering fallback; it does not invent a summary volume from the fallback geometry.

## 23. Load Distribution Result

Dataset A is laterally centered at 0.096%, but longitudinal eccentricity is 8.266%. The UI therefore shows `PARTICULAR_CIRCUMSTANCES_REVIEW` on a 0/5/10 guidance scale and supplies review wording. It does not call the value a legal violation, does not claim a carrier-specific load-distribution envelope exists, and does not turn calculated mass into certified VGM.

## 24. Three.js Changes

- Added a dedicated landing experience using the real container/cargo asset registry.
- Added responsive, offscreen-aware render behavior for the public scene.
- Expanded Twin camera presets and verified side, top, and door views at 1920.
- Added residual-space zone meshes and exact void-category mappings.
- Added cargo-set isolation and dimming for Rule-to-Twin navigation.
- Preserved actual placement coordinates and replay state as the source of 3D cargo geometry.
- Kept the engineering Twin visually distinct from the brighter public illustration.

## 25. Blender MCP Usage

Blender MCP was **not used in Competition 2.6**. No report claim is made about a new Blender model, Poly Haven asset, HDRI download, or Blender iteration. The pass reused the repository's existing validated container and cargo-kit GLBs and focused on runtime composition, cameras, mapping, and interaction. This was sufficient for the scoped 2.6 landing/workspace convergence and avoids fabricating an asset-production history.

## 26. Performance

- Full official benchmark: 840,665 ms for the complete corpus and determinism run.
- Dataset A strategy wall time: approximately 12.1–14.0 s; the separate bounded-repair audit measured approximately 13.9–14.7 s.
- Dataset B strategy wall time: approximately 8.0–8.6 s.
- Production build succeeds; Vite reports a non-blocking large-chunk warning around 934.5 kB for the main JS chunk.
- Landing and Twin are route-separated, so their WebGL scenes are not rendered concurrently; the landing scene pauses offscreen.
- Browser interaction and camera transitions were visually smooth during QA. No instrumented FPS claim is made in this round because no authoritative FPS capture was recorded.

## 27. Frontend Tests

- Test suites: **32/32 passed**.
- Tests: **114/114 passed**.
- ESLint: **0 errors, 0 warnings**.
- Production build: **passed**, 1,664 modules transformed; chunk-size warning only.

The one stale presentation-copy expectation was updated from the old admission term to `出运验证`.

## 28. Backend Tests

Competition-relevant suites pass, including Hybrid V2/V2.3/V2.4/V2.5, Tiny Floor Oracle, Packaging Profile V2.5, Real-World Decision V2.4, Shipment Readiness V2.5 and API, Plan Validator, Stability, Deterministic Compliance, Void V2.5, and Load-Balance-Aware Local Repair. Backend lint has 0 errors and 62 pre-existing warnings.

The full historical Jest run completed in 893.664 s with 73 suites: 46 passed and 27 failed; 706 tests: 639 passed and 67 failed. The failures were audited rather than hidden. They are legacy-contract or environment tests referencing removed `RenderEngine`, `DBLFPackingEngine`, and `SimplePackingEngine` modules; old response strings/shapes; old stack-level assumptions; database foreign-key isolation; mini-program upload/string expectations; obsolete roadshow app/server assumptions; and network/database timeout/open-handle behavior. They do not contradict the relevant 2.6 solver/readiness gates, but remain a repository-maintenance limitation.

The official `benchmark:competition-2.5` rerun completed successfully with every published gate true: Dataset A/B, 48 fixed cases, 64 challenge cases, 20 tiny cases, 24 multi-port cases, 24 packaging cases, and 11 readiness/admission cases.

## 29. Browser QA

QA used a real browser against Vite at `http://127.0.0.1:4173` and the live backend. Verified flows include public landing scroll, workspace navigation, cargo editor, 20GP/40GP/40HQ selection, real backend solve, converged strategy presentation, Twin normal/space/unload modes, Readiness, evidence selection, Source Reader, Rule-to-Twin, and 2560/1920/1366 layouts.

Browser console result for the final flows: **0 application errors and 0 warnings**; only the React DevTools informational message appeared. The additional side/top/door solver views show coherent placement geometry and no camera clipping through cargo.

## 30. Screenshot Index

All required screenshots are under `artifacts/competition-2.6/screenshots`.

| # | File | Resolution | Purpose |
|---:|---|---|---|
| 01 | `01-landing-hero-1920.png` | 1920×1080 | Public first impression |
| 02 | `02-landing-problem-1920.png` | 1920×1080 | Problem narrative |
| 03 | `03-landing-cargo-1920.png` | 1920×1080 | Packaging understanding |
| 04 | `04-landing-solver-1920.png` | 1920×1080 | Cargo-to-space narrative |
| 05 | `05-landing-twin-1920.png` | 1920×1080 | Digital-twin climax |
| 06 | `06-landing-verify-1920.png` | 1920×1080 | Verification narrative |
| 07 | `07-landing-final-cta-1920.png` | 1920×1080 | Final workspace CTA |
| 08 | `08-workspace-cargo-1920.png` | 1920×1080 | Compact cargo table |
| 09 | `09-workspace-cargo-editor-1920.png` | 1920×1080 | GLB preview and editor |
| 10 | `10-workspace-planning-container-1920.png` | 1920×1080 | Proportional equipment choice |
| 11 | `11-workspace-planning-strategy-1920.png` | 1920×1080 | Converged backend result |
| 12 | `12-workspace-twin-normal-1920.png` | 1920×1080 | Twin normal mode |
| 13 | `13-workspace-twin-space-1920.png` | 1920×1080 | Residual-space analysis |
| 14 | `14-workspace-twin-unload-1920.png` | 1920×1080 | Multi-port unload simulation |
| 15 | `15-workspace-readiness-1920.png` | 1920×1080 | Shipment readiness overview |
| 16 | `16-workspace-evidence-1920.png` | 1920×1080 | Fact-condition-decision-basis |
| 17 | `17-workspace-source-reader-1920.png` | 1920×1080 | Compact source excerpt |
| 18 | `18-landing-2560.png` | 2560×1440 | Large-screen landing |
| 19 | `19-workspace-twin-2560.png` | 2560×1440 | Large-screen Twin |
| 20 | `20-landing-1366.png` | 1366×768 | Competition-laptop landing |
| 21 | `21-workspace-cargo-1366.png` | 1366×768 | Competition-laptop cargo |

Additional solver geometry captures live under `artifacts/competition-2.6/solver-visuals`: `dataset-a-side-1920.png`, `dataset-a-top-1920.png`, and `dataset-a-door-1920.png`.

## 31. Changed Files

The worktree contains cumulative Competition 2.x changes; this table identifies the major files with direct 2.6 responsibility rather than claiming that every dirty file originated in this pass.

| File | Responsibility |
|---|---|
| `web-dashboard/src/app/router.js` | Pathname routing, public/workspace route table, legacy aliases |
| `web-dashboard/src/app/Application.jsx` | Keeps landing outside the professional shell |
| `web-dashboard/src/app/AppShell.jsx` | Compact top navigation and current-case context |
| `web-dashboard/src/pages/landing/LandingPage.jsx` | Six-section landing narrative and CTA flow |
| `web-dashboard/src/three/LandingExperience.jsx` | Landing 3D composition, real assets, lifecycle/performance behavior |
| `web-dashboard/src/styles/app.css` | Landing/workspace visual systems and responsive behavior |
| `web-dashboard/src/pages/workflows/CargoPage.jsx` | Compact cargo table and packaging editor |
| `web-dashboard/src/pages/workflows/ContainerPage.jsx` | Visual equipment selector and converged strategy presentation |
| `web-dashboard/src/pages/workflows/TwinPage.jsx` | Twin toolbar, operation modes, unload and explanation flows |
| `web-dashboard/src/pages/workflows/CompliancePage.jsx` | Shipment readiness, evidence, and Source Reader |
| `web-dashboard/src/components/compliance/RegulationWorkbench.jsx` | Selected-rule evidence context and compact source interaction |
| `web-dashboard/src/three/TwinScene.jsx` | Placement scene, void meshes, cargo isolation, animation and views |
| `web-dashboard/src/three/presentation/cameraPresets.js` | Overview/door/side/top/cutaway camera direction |
| `web-dashboard/src/three/analytics/visualizationModes.js` | Exact analysis/void mappings |
| `web-dashboard/src/three/cargo/CargoVisualFactory.js` | Packaging-specific GLB/solver-envelope visual creation |
| `web-dashboard/src/domain/plan/activePlanViewModel.js` | Authoritative active-plan projection for UI consistency |
| `web-dashboard/src/services/packingApi.js` | Backend solve/readiness transport normalization |
| `backend/services/HybridConstraintPackingSolverV25.js` | Candidate portfolio and bounded balance-repair integration |
| `backend/services/packing/LoadBalanceAwareLocalRepair.js` | Safe equal-envelope weight-swap challenger |
| `backend/services/packing/VoidJustificationAnalyzer.js` | Required residual-space classification |
| `backend/services/realworld/ShipmentReadinessService.js` | Readiness decision/evidence aggregation |
| `backend/services/realworld/LoadDistributionAnalyzer.js` | CoG and load-distribution guidance analysis |
| `backend/routes/packing.js` | Solver/readiness API surface |
| `backend/__tests__/unit/LoadBalanceAwareLocalRepair.test.js` | Bounded repair regression coverage |
| `artifacts/competition-2.6/solver-challenger-audit.json` | Candidate-by-candidate solver evidence |
| `artifacts/competition-2.6/dataset-a-balance-challenger.json` | Final Dataset A strategy audit |

## 32. Known Limitations

1. Dataset A longitudinal CoG is 8.266%; it remains a particular-circumstances engineering review, not a ≤5% result.
2. The bounded balance challenger proved no safe improvement in three trials; it does not establish global optimality.
3. Dataset A solve time is approximately 12–15 seconds with the current quality/repair portfolio, above an aspirational sub-eight-second target.
4. Dataset B is valid and centered but visually sparse; its 4.756 m³ unexplained void is reported rather than cosmetically hidden.
5. No actual carrier/operator load-distribution envelope is supplied; only engineering guidance can be applied.
6. VGM, CSC, securing/lashing, dangerous-goods acceptance, terminal/carrier approval, customs, and live gate conditions still require external evidence or authority.
7. The production bundle has a non-blocking large-chunk warning.
8. The full historical backend suite has 27 legacy/environment suite failures despite all competition-relevant gates passing.
9. No authoritative FPS telemetry was recorded for this round, so the report makes no numeric frame-rate claim.

## 33. Three-minute Competition Demo

1. **0:00–0:35 — Landing Hero:** explain “让复杂装载，变成看得见的空间决策”; do not discuss KPIs yet.
2. **0:35–0:55 — Fast scroll:** show cargo understanding, constraints, spatial construction, Twin, and verification.
3. **0:55–1:20 — Cargo:** show a real packaging thumbnail, dimensions/weight/destination, and solver-envelope distinction.
4. **1:20–1:50 — Planning:** compare 20GP 95, 40GP 176, 40HQ 212; run/open the backend result; point out “多目标收敛”.
5. **1:50–2:35 — Twin:** switch normal → space → unload; show actual placements, residual zones, and zero-rehandle unloading.
6. **2:35–3:00 — Readiness:** show 8,623/28,690 kg, VGM distinction, 8.27% review guidance, and one fact-to-source trace.

## 34. Five-minute Competition Demo

1. **0:00–0:50 — Landing:** let the visual story establish the product before technical proof.
2. **0:50–1:25 — Problem/Cargo:** explain why package semantics, handling, and destination are solver inputs.
3. **1:25–2:15 — Equipment/Planning:** compare real proportions and residual cargo; show backend provenance and converged strategy logic.
4. **2:15–3:30 — Twin:** demonstrate side/top/door views, space mode, balance mode, and the first unload stage; show that remaining cargo is still stable.
5. **3:30–4:20 — Readiness/Evidence:** trace calculated gross, payload, CoG guidance, and Source Reader; use Rule-to-Twin.
6. **4:20–4:50 — Engineering truth:** state 212/212, hard 0, rehandle 0, 3.766 m³ internal void, 8.266% CoG review, and why the 5.61% loose candidate was rejected.
7. **4:50–5:00 — Close:** return to the message that PORTCUBE makes spatial decisions observable and reviewable before loading.

## 35. Recommended Competition Opening Order

Use the requested default flow:

`Landing → Landing Scroll → Workspace → Cargo → Planning → Twin → Readiness`

Do not open on a backend console, benchmark JSON, or deep evidence page. Keep solver-audit JSON available only as supporting proof if judges ask why 8.27% was retained.

## 36. Complete Context for ChatGPT

=== START OF PORTCUBE 2.6 COMPLETE CONTEXT FOR CHATGPT ===

PROJECT_ROOT: `D:\cixing\3chuang`

VERSION: Competition 2.6 experience freeze.

FINAL_VERDICT: READY_WITH_LIMITATIONS.

FREEZE_MARKER: `PORTCUBE_COMPETITION_2_6_EXPERIENCE_FREEZE`.

PRODUCT: PORTCUBE / 智港立方, a container loading digital-twin and pre-shipment decision workspace. It does not promise certified VGM/CSC/lashing, carrier/terminal/customs acceptance, gate-in, or global mathematical optimum.

PUBLIC_ARCHITECTURE: `/` is a bright, Chinese-first, six-section continuous landing page plus final CTA. It is visually and structurally separate from the professional workspace. Sections: Hero, Problem, Cargo, Cargo-to-Space, Digital Twin, Verify. Uploaded references informed composition/pacing only.

WORKSPACE_ROUTES: `/workspace`, `/workspace/cargo`, `/workspace/planning`, `/workspace/twin`, `/workspace/readiness`. The shell uses compact top navigation and content-first/canvas-first layouts.

ACTIVE_CASE: `NB2026-0824-001`, Dataset A, 212 pieces, reference 40HQ, backend-solved.

CARGO: compact table with real cargo-kit thumbnail, name/SKU, packaging, dimensions, weight×quantity, destination, handling, and constraints. Editor preview distinguishes visual packaging from solver envelope.

EQUIPMENT: proportional 20GP/40GP/40HQ visual selector. Results: 20GP 95/212 (117 remaining), 40GP 176/212 (36 remaining), 40HQ 212/212.

PLANNING: Dataset A SPACE/BALANCE/OPERATION have the same placement hash, so the UI displays “多目标收敛” and one main plan rather than three fake alternatives.

TWIN: dominant real-placement 3D canvas; overview/door/side/top/cutaway cameras; normal/weight/port/space/balance/risk; load replay; multi-port unload; actual residual components; cargo-set isolation; Rule-to-Twin.

READINESS: renamed 出运验证. Evidence structure is fact → condition → decision → basis. Current calculated gross/max operating gross is 8,623/28,690 kg. Calculated gross is distinct from verified VGM. Longitudinal CoG 8.27% is shown on 0/5/10 guidance scale as particular-circumstances review.

SOURCE_READER: selected relevant excerpt and metadata, not a PDF wall. Rule-to-Twin applies related spatial focus.

OFFICIAL_SOLVER: `hybrid-v2.5`; identity unchanged.

DATASET_A: all three strategies 212/212, hard 0, operation 0, full unload pass, rehandle 0, post-unload stable, deterministic hash `095db720bcd6b519`, lateral CoG 0.096%, longitudinal CoG 8.266% review, internal void 3.76636 m³, unexplained void 3.76129 m³, cross-section P10 71.538%.

BALANCE_CHALLENGER: equal-envelope, compatible, weight-different swap repair. 324 eligible pairs, 3 trials, stopped after three consecutive no-improvement results, not promoted. A V21 candidate reached 5.61% CoG but worsened unexplained void to 8.53004 m³ and was correctly rejected.

DATASET_B: all three strategies 69/69, hard 0, operation 0, full unload, rehandle 0, post-stable, CoG 0/0, deterministic hash `22333144d52bb271`, void 4.756 m³.

CORPORA: fixed 48/48 core+deterministic; challenge 64/64; tiny 20/20; multi-port 24/24 full unload/post-stable/zero-rehandle/deterministic; packaging 24/24 across eight types; readiness/admission 11/11.

VOID_CATEGORIES: `USABLE_RESERVE`, `PORT_ACCESS`, `DOOR_CLEARANCE`, `STRUCTURAL_CLEARANCE`, `SECURING_SPACE`, `GEOMETRIC_RESIDUAL`, `UNEXPLAINED_VOID`.

THREE_JS: dedicated landing scene, real repository GLBs, route/offscreen lifecycle control, enlarged engineering Twin, new void meshes, isolation/dimming, and verified side/top/door cameras. Blender MCP was not used in 2.6; no external asset claim is made.

TEST_STATUS: frontend 32/32 suites and 114/114 tests; lint clean; build pass. Relevant backend solver/readiness tests pass. Full historical backend Jest: 46/73 suites and 639/706 tests pass; 27 legacy/environment suites remain failed and are disclosed. Official full benchmark completes with every published gate true.

BROWSER_STATUS: real frontend/backend, required flows verified, final console 0 application errors/warnings, 21 required screenshots complete at 2560/1920/1366 plus three solver-angle captures.

ARTIFACTS: `artifacts/competition-2.6/screenshots`, `artifacts/competition-2.6/solver-visuals`, `artifacts/competition-2.6/solver-challenger-audit.json`, `artifacts/competition-2.6/dataset-a-balance-challenger.json`, and `artifacts/competition-2.5/competition-2.5-benchmark.json`.

KNOWN_LIMITATIONS: Dataset A remains 8.266% longitudinal CoG review; bounded repair found no safe improvement; Dataset A runtime is ~12–15 s; Dataset B remains sparse; no carrier-specific load envelope; external/certified decisions remain external; Vite large-chunk warning; 27 legacy backend suites fail; no numeric FPS capture.

DEMO_FLOW: Landing → scroll story → Workspace → Cargo → Planning → Twin → Readiness. Lead with visual/product value, prove packaging/equipment/solver truth, finish with explainability and claim boundaries.

=== END OF PORTCUBE 2.6 COMPLETE CONTEXT FOR CHATGPT ===
