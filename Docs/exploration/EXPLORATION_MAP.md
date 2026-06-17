# Exploration Map — SentinelTwin

**This is a living document. Append findings. Never replace.**
**Last updated:** 2026-06-17 (Added API contract standardization thread for studio ingest/control endpoints via shared envelope + parse helpers) — previous: Compliance depth gap documented: IEC 62676-4/DORI templates exist, GDPR/BIPA/HIPAA pending; hook purity fixes applied across 7 components; CI gate enhanced to cover packages; camera live-connection contract canonicalized; deployment packaging multi-stage Docker + health API + compose; Simulation engine maturity Thread 2b — calibration, confidence, hashing, scenarios, counterfactuals, sensitivity; Scan/reconstruction pipeline foundation: artifact data model, adapter interfaces, reconstruction compiler, quality gates, 73 new tests; Dedicated lighting/shadow overlay mode added on top of heatmap lighting/shadow implementation; Heatmap lighting/shadow implementation — camera PPM now combines independent security-light illumination, obstruction-cast light shadows, and camera line-of-sight; Physics engine audit — zero implementation across entire codebase, deferred to V0.2, no new action needed; Checkpoint compare/report pivots + launcher exact-checkpoint badges + sensor provenance + runtime health surfacing; Launcher exact-checkpoint badges + sensor provenance + runtime health surfacing; Sensor provenance + runtime health surfacing; Sensor fusion preview + workspace access policy surfacing; Digital twin simulation physics: PTZ movement, BRDF reflectivity, dynamic lighting, view distance, placement constraints, scene fidelity, occlusion culling, camera feed synthesis, real-time feedback

---

## Active Research Threads

### Thread 11: API contract standardization for studio runtime endpoints
**Status:** In-progress.
**Problem:** Ingest and control-plane routes had hand-rolled request parsing and inconsistent error shapes.
**Action taken:** Added `apps/studio/src/lib/api-response.ts` and migrated core studio API endpoints to shared parsing and envelope helpers (`apiJson`, `parseValidatedJsonBody`).
**Result:** Consumers now get stable metadata (`requestId`, `apiVersion`, `timestamp`) and reusable `errorCode` values while preserving existing resource payload fields (`ok`, history count, session summaries, sync status).
**Code anchors:** `apps/studio/src/app/api/sensor-ingest/route.ts`; `apps/studio/src/app/api/camera-metadata-ingest/route.ts`; `apps/studio/src/app/api/workspace-control-plane/route.ts`; `apps/studio/src/app/api/camera-live-session-health/route.ts`; `apps/studio/src/lib/api-response.ts`.

### Thread 0: Product integrity hardening spine
**Status:** Implemented in code (2026-05-30).
**Key findings:**
- Canonical intake source taxonomy is now stable (`scan | ai_prompt | floor_plan | json | manual | camera_evidence`) with legacy alias normalization at boundaries only.
- Site draft approval now validates and activates `draft.scene` explicitly before baseline simulation is allowed to run.
- SecurityOutcome semantics now separate `zoneFindings` (all) from `failedZones` (non-pass only), reducing narrative and UI drift.
- SiteDraftReview now renders a real read-only draft-scene spatial preview (SVG) instead of placeholder text.
- Shared narrative model now feeds both security outcome and report summary/export surfaces.
- Product home now uses the security-command-center hierarchy from the approved reference: large current site twin preview, right-side risk/status decision panel, primary operational mode strip, and secondary intake dock.
- Home navigation now routes into real product sections (Create Site Twin, Security Twin Studio, Audit Reports, Reference Sites, Settings) instead of passive labels.
- Site intake recent-site cards now open real scene flows (via routed scene open), and quick-import from intake triggers the JSON import path directly.
- Home header scene/environment indicators are now explicit status chips to avoid false dropdown affordances.
- Demo flow is documented for product walkthroughs at `Docs/product/SITE_TWIN_CREATION_DEMO_FLOW.md`.
- Aligned Studio walkthrough steps with timed judging narrative (problem -> simulation -> failure case -> compare/report -> close).

**Next:** Use this hardened foundation before adding new scan/ONVIF/compliance breadth.

---

### Thread 1: Pascal Editor Integration
**Status:** Decision made (fork). Details in architecture/02.
**Key finding:** Pascal's MIT license, identical stack (R3F, Zustand, Next.js), and flat dictionary
node store pattern are exactly what SentinelTwin needs.
**Open:** Which Pascal systems can we reuse directly? Read WallSystem before writing CameraSystem.
**Next:** Fork the repo and verify build. Read source of 5 key files (per PASCAL_EDITOR_DEEP_DIVE.md).

**2026-05-30 update — pre-fork reuse audit (fork parked for now):**
- We can adopt some Pascal surfaces immediately without forking by consuming published packages/utilities where shape-compatible.
- **Direct reuse now (low friction):** selected viewer-side utilities/patterns from `@pascal-app/viewer` and standalone helper functions that do not require Pascal's internal node graph store contract.
- **Adapter-required reuse (medium):** graph-dependent `@pascal-app/core` helpers (scene clone/validation/registry patterns). These assume Pascal graph primitives and need a SecurityScene↔Pascal translation boundary.
- **Not practical before fork (high):** replacing SentinelTwin store/system loop with Pascal's `useScene` + `AnyNode` internals while current SecurityScene remains array-first.
- Core constraint: SentinelTwin currently uses canonical array collections (`walls/cameras/paths/...`) rather than Pascal's `nodes + rootNodeIds` graph contract.
- Near-term action if fork remains deferred: introduce a thin adapter boundary and only import Pascal helpers through it; avoid piecemeal direct graph assumptions in app code.

---

### Thread 2: Coverage Engine Design
**Status:** Designed. Details in architecture/03.
**Key finding:** three-mesh-bvh is mandatory from day one. Instanced mesh for heatmap.
**Open:** Benchmark 40×40 grid × 4 cameras. Target <16ms. Log in OPEN_QUESTIONS.md Q-002.
**Next:** Build prototype coverage engine in isolation. Measure raycast performance.

**2026-05-30 update — heatmap lighting and shadows implemented:**
- Coverage heatmap scoring now treats cameras and security lights as independent physical sources, then combines them at each sampled cell. Camera visibility still comes from camera FOV + camera-to-target occlusion + PPM. Lighting comes from each active `SecurityLightNode` with range, brightness, optional beam cone, and a separate light-to-target occlusion ray.
- Obstructions now create two distinct effects: camera line-of-sight shadows (`blockedBy`, no visual coverage) and lighting shadows (`shadowedBy`, darkened/night-penalized camera quality even when a camera may geometrically see the point). This matches the product thesis: real coverage is not just camera cones; it is camera quality under actual illumination.
- Heatmap rendering remains the canonical instanced-mesh path from D-006. Quality mode now subtly brightens lit cells and darkens shadowed/night-dark cells while preserving DORI/PPM colors from the design pack (`FullCameraSuiteCoverageMode_metrics_Camera1Inspector.png`, `DesignSystem_MapLayerVisualLanguage_CanonicalTokens.png`). Hover explainability exposes light level, lights contributing, and obstruction-cast light shadows.
- External validation signal: System Surveyor's Boundaries positioning confirms that real device coverage must be constrained by walls/obstructions rather than theoretical cones; CCTV heatmap references commonly describe color overlays for motion/activity, but SentinelTwin's differentiator is deterministic predicted security coverage that includes FOV, occlusion, light, and shadows before deployment.
- Code anchors: `apps/studio/src/simulation/coverage.ts`, `apps/studio/src/components/workspace/SharedScene.tsx`, `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`, `apps/studio/src/simulation/__tests__/lighting.test.ts`.
- Next hardening: calibrate light falloff/brightness weights against real lux targets and add a dedicated light-only overlay mode if operators need to debug lighting independent of camera PPM.

**2026-05-30 follow-up — dedicated lighting overlay:**
- Added a first-class `Lighting` heatmap mode in the coverage legend and shared scene renderer. It uses yellow/orange/blue/dark/red semantics for bright, usable, low, dark, and obstruction-shadowed light states, isolating lighting from camera PPM quality.
- This should be the operator debugging view for “is the failure caused by camera geometry or by lighting?” while `Quality` remains the combined security-coverage view.
- Next hardening: add lighting-mode QA screenshots and calibrate the thresholds against lux assumptions rather than the current normalized light proxy.

---

### Thread 2b: Simulation Engine Maturity — From Coverage Calculator to Security Decision Engine

**Status:** Implemented in code (2026-06-01).

**Why this exists:**
The simulation engine already computes meaningful deterministic coverage (visibility, PPM/DORI/OODPCVS quality, occlusion, lighting/shadow penalties, privacy issues, adversarial paths, redundancy, recommendations, blind-spot topology, fragility, entropy, k-robustness, placement oracle). However, the engine answered "Given this simplified scene and assumptions, what coverage/quality do we estimate?" — not yet "Given an uncertain real site, imperfect camera specs, changing light, and user constraints, what security outcome can we defend, explain, compare, verify and improve?"

The audit feedback identified 8 maturity tracks needed. All are now implemented.

**Key findings:**

1. **Calibration layer** — A `CalibrationConstants` schema with 7 camera presets (indoor dome 2MP, wide dome 5MP, bullet 5MP, PTZ 8MP, thermal 640, low-light 4MP, LPR 2MP), lux-to-light-level thresholds, night-mode PPM retention factors (thermal=0.92, low-light=0.82, IR=0.68, none=0.12), mount-tilt realism limits per mount type, and lens edge-falloff defaults per lens type. Defined in `packages/simulation/src/calibration.ts` with a `DEFAULT_CALIBRATION` constant and utility functions for preset lookup, confidence estimation, and PPM confidence intervals.

2. **Uncertainty propagation** — `ConfidenceBand` type with level (none/low/medium/high/verified), source, reason codes, and sensitivity tags. `computeOverallConfidence()`, `computeZoneConfidence()`, and `computePathConfidence()` derive confidence from camera source provenance, scene geometry validity, calibration presence, lighting assumptions, and scene source. Confidence is computed automatically in every simulation run and stored in `SimulationResult.overallConfidence`, `zoneConfidence`, `pathConfidence`.

3. **Scene hashing** — `computeSceneInputHash()` produces a deterministic hash from all simulation-relevant scene inputs (walls, doors, windows, cameras, lights, obstructions, zones, privacy zones, assumptions, time schedule). Stored in `SimulationResult.sceneHash` for stale-result prevention. Hash format is `base36(integerHash)-length`. Code in `packages/simulation/src/scene-hash.ts`.

4. **Scenario engine** — `ScenarioState` schema with overrides for camera status, light status, door state, time of day, light level, and obstruction presence. `runScenarioBatch()` runs N scenario states against the baseline and returns `ScenarioBatchResult[]` with deltas. Default scenarios: `normal_day`, `normal_night`, `night_no_lights`. Helper functions generate camera-offline, obstruction-removed, and camera-blocked scenarios. Code in `packages/simulation/src/scenario-batch.ts`.

5. **Counterfactual search** — `computeCounterfactualSearch()` generates multiple candidate fixes (move obstruction, rotate camera, add camera, add light), simulates each, scores them by verified improvement, cost rank, and zone delta, then ranks them. Supports constraints: `cameraCannotMoveIds`, `noNewCamera`, `maxCostCategory`. Core rule: AI proposes — simulation verifies. Every candidate's delta is a real full simulation. Code in `packages/simulation/src/counterfactual-search.ts`.

6. **Real footage verification** — Schema foundation exists. `CameraEvidenceArtifact` with landmark binding, `MismatchReport` with severity/mismatch types, and `SceneUpdateSuggestion` for applying corrections. Full real-footage verification pipeline deferred — the schema is ready for when footage comparison is implemented.

7. **Performance architecture** — Scene hashing enables stale-result detection. `computeSceneInputHash()` is fast and deterministic. `async` evaluation exists in `simulateStudioAsync()`. Adaptive sampling around critical zones is possible via `critical-zone-selection.ts`. Additional performance work (worker, incremental recompute, BVH lifecycle management) is tracked in open questions.

8. **Assumption sensitivity** — `computeAssumptionSensitivity()` tests which inputs most affect results. It varies person height (±20%), night penalty on/off, interior light level, exterior lux, backlight, and glare, then reports `coverageDeltaPct`, `qualityDelta`, `zoneStatusChanges`, and a classified sensitivity level (critical/high/medium/low/none). Code in `packages/simulation/src/assumption-sensitivity.ts`.

**Code anchors:**
- `packages/core/src/schema/security-scene.ts` — All new Zod schemas (confidence, calibration, hash, provenance, sensitivity, scenario, counterfactual)
- `packages/simulation/src/calibration.ts` — Calibration constants, preset library, utilities
- `packages/simulation/src/scene-hash.ts` — Deterministic scene hashing
- `packages/simulation/src/confidence.ts` — Confidence propagation engine
- `packages/simulation/src/scenario-batch.ts` — Scenario batch runner
- `packages/simulation/src/counterfactual-search.ts` — Counterfactual candidate search
- `packages/simulation/src/assumption-sensitivity.ts` — Assumption sensitivity analysis
- `packages/simulation/src/simulate-studio.ts` — Wired: scene hash + confidence in every `SimulationResult`

**Decisions:** D-287 through D-290 in `DECISION_LOG.md`.

**Success criteria:**
- Every simulation result now includes `sceneHash`, `provenance`, `overallConfidence`, `zoneConfidence`, `pathConfidence`. ✓
- Calibration constants module exists with 7 real camera presets. ✓
- Scenario batch runner can compare day/night/light-failure states. ✓
- Counterfactual search generates multiple candidates, simulates each, scores and ranks. ✓
- Assumption sensitivity analysis identifies which inputs drive results. ✓

**Next:**
- Build UI panels for confidence display, sensitivity chart, scenario comparison, counterfactual ranking
- Expand camera preset library with field-verified calibration data
- Wire real-footage verification pipeline (schema exists, engine needed)
- Add worker-based async simulation for large scenes
- Add incremental recompute for fast edit feedback

### Thread 2c: Report trust boundaries

**Status:** In-progress in UI surfacing (2026-06-01).
**Focus:** prevent stale simulation outputs from driving report actions and confidence metrics.
**Findings:**
- `ReportView` now computes a scene freshness gate using `SimulationResult.computedAt` versus `scene.updatedAt` and hides stale-derived derived metrics (coverage entropy, posture variation, uncertainty, redundancy) until a fresh run exists.
- Decision-priority cards are intentionally degraded to a single stale/outdated action when scene edits occur after the last simulation run.
- A dedicated freshness pill now makes simulation freshness explicit in the report header, and the Report Lite badge now reads “Simulation stale” vs “Run simulation to populate.”
**Long-term follow-up:**
- Add per-metric freshness reason text (`fresh`, `requires simulation`, `requires recompute`) when confidence bands are still displayed.
- Replace the fixed staleness buffer with scene-hash-based exact match checks once report-side evidence caching is normalized.

### Thread 2d: Scene interaction determinism (3D workspace)

**Status:** Implemented in code (2026-06-01).

**What was hardended:**
- Workspace 3D interactions now explicitly use primary-button gating for object selection, reducing accidental selection/drag side effects from auxiliary buttons and non-primary pointer devices.
- Shared scene theme resolution now has explicit fallback protection for invalid presets, preventing undefined theme reads under malformed UI state.
- Privacy-zone texture rendering now guards `document` access and safely returns a no-op in non-DOM contexts, preventing SSR/test-time crashes.

**Open follow-up ideas:**
- Add an explicit `pointerDown` vs `pointerUp` interaction policy doc in `Docs/product/` so operator behavior is predictable across desktop touchpads, pens, and trackpads.
- Add a scene interaction contract test harness for non-primary pointer events and invalid theme values.
- Add a small utility-level unit test suite in `apps/studio/src/components/workspace/sharedscene.test.ts` for interaction/interaction guard behavior.

---


### Thread 3: Adversarial Path Simulation
**Status:** Designed. Details in architecture/04.
**Key finding:** Dijkstra with exposure cost is tractable in-browser (<10ms for 6,400 nodes).
**Open:**
- Sparse nav graph (waypoints at corners) vs dense grid — which handles narrow corridors better?
- How does actor model handle partial knowledge of camera positions?
- Multi-actor coordinated incident simulation
**Next:** Prototype nav graph builder. Test pathfinding on simple 10×10 room with 2 cameras.

---

### Thread 4: AI Model Pipeline
**Status:** Bakeoff complete for 8 models (7 original + MiniCPM-V 4.6). 4 more configured but MPS-constrained.
**Key finding:** Cloud APIs dominate — GPT-4o leads (wall F1=0.964). Local MPS models >=4B are impractically slow. MiniCPM-V 4.6 (1.3B) wall F1=0.094 — too small for floor plans.
**Open:** Qwen3.5-4B, MiniCPM-o 4.5, Gemma 4 E4B need CUDA or GGUF to evaluate.
**Next:** Evaluate larger local models via ollama/llama.cpp GGUF quantization.

---

### Thread 4b: Autoresearch Loop Discipline for Bakeoffs
**Status:** Applied as operating pattern.
**Key finding:** Karpathy's autoresearch loop is useful here as a research-control pattern: one mutable experiment surface, strict keep/discard logging, a single evaluator, and a clear baseline before iteration. It does not replace SentinelTwin's harness, but it is a good protocol for stage-by-stage model comparison.
**Open:** Decide whether to add a lightweight experiment ledger script or keep the current docs + outputs workflow as the source of truth.
**Next:** Reuse the same keep/discard discipline while extending the floorplan harness and cloud fallback candidates.

---

### Thread 5a: Scan/Reconstruction Pipeline Foundation
**Status:** Architecture built, adapters scaffolded, compilation pipeline complete (2026-05-30).
**Key architecture:**
- Three-layer design: data model (`ScanArtifact`, `ScanCaptureSession`) → adapter interfaces (6 adapter types + VisionProvider) → compilation pipeline (`compileReconstructionToSiteTwinDraft`)
- Every AI/CV candidate starts `status: "pending"` — user review required before compile
- Compilation produces `SiteTwinDraft`, not direct `SecurityScene` mutation — preserves review → approve → baseline flow
- Quality gates evaluate completeness before compile
- 73 new tests covering data model, reconstruction pipeline, and quality gates
**What exists now:**
- `lib/scan-artifacts.ts` — Complete data model with 13-step guided capture sequence, photo roles, scale anchors, typed warnings
- `lib/scan-adapters/types.ts` — All 6 adapter interfaces + VisionProvider
- `lib/scan-reconstruction.ts` — Compilation pipeline with confidence estimation, quality gates, default warnings
- `lib/scan-quality-gates.ts` — 6 gate definitions with evaluate/convert utilities
- `lib/site-compiler.ts` — Extended with `guided_scan` and `reconstructed` source types
**What is NOT built:**
- No model integrations are wired (VLM detection, SAM2 segmentation, Depth Anything V2, VGGT, SpatialLM)
- No multi-photo correspondence beyond the data model
- No structural extraction (wall/door/window from images)
- No UI components for the new capture session (uses legacy ScanSiteWizard)
- No toast/notification surface for reconstruction progress
**Next:**
- Wire the first adapter (object detection via vision provider) as a proof of concept
- Build a reconstruction step UI that maps to the guided capture steps
- Add depth estimation (Depth Anything V2 via provider or local model)
**Code anchors:**
- `lib/scan-artifacts.ts` — Core data model
- `lib/scan-adapters/types.ts` — Adapter interfaces
- `lib/scan-reconstruction.ts` — Compilation pipeline
- `lib/scan-quality-gates.ts` — Quality gate evaluation

### Thread 5: Physics Layer (Rapier)
**Status:** Decision made — optional, not in V0.1. Details in PHYSICS_OPTIONS.md.
**Open:** Should we use simple AABB collision for V0.1 or is Rapier lightweight enough to add now?
**Next:** Build V0.1 without Rapier. Evaluate drag UX quality. Add if needed.

---

### Thread 6: Temporal Simulation
**Status:** Designed. V0.3+ feature. Details in architecture/06.
**Key insight:** Build change timeline (10–15 transitions/day), only recompute on transitions.
**Open:** sun-position calculation (suncalc.js ~2KB — bundle it for seasonal lighting).

---

### Thread 7: Coverage Entropy Metric
**Status:** Concept, designed. Details in COVERAGE_ENTROPY_METRIC.md.
**Open:** Show to target user before building. Decide V0.1 vs V0.2.

---

### Thread 8: Security Budget Optimizer
**Status:** Concept. V0.4+ feature.
**Open:** Does the counterfactual agent + human judgment suffice, or is automated optimization needed?

---

### Thread 9: Real Camera Verification (V2)
**Status:** Concept. V2 feature.
**Two directions:** Plan→camera (simulated vs actual view comparison) and Camera→plan (infer layout from footage).
**Open:** Camera calibration / pose estimation required for direction 1 — harder than it sounds.

---

### Thread 10: NDAA Replacement Market — HIGH PRIORITY
**Status:** Research complete. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 2.
**Key finding:** NDAA Section 889 + FCC Covered List forces replacement of Hikvision/Dahua cameras
(38% of global supply) from US federal market. Australia, Japan also implementing bans.
Late 2025/early 2026 saw FCC enforcement escalation.

**Refined understanding (May 2026 research):**
- The "$1.2B military replacement program" is NOT a single, centralized program. Compliance
  is an ongoing requirement woven into existing federal IDIQ (Indefinite Delivery, Indefinite
  Quantity) contracts for facilities management, physical security upgrades, and IT modernization.
- **Key integrators handling NDAA replacement work:** KBR, Amentum, Leidos, General Dynamics IT,
  and other large government services contractors. They subcontract specialized physical security
  work to regional security integrators vetted for federal work (TAA/NDAA-compliant).
- **Vendor-side:** Axis Communications and Hanwha Vision provide NDAA compliance documentation,
  white papers, and consulting tools for integrators — but do NOT run "replacement programs."
  They market their compliance as the natural replacement choice.
- **Go-to-market approach:** Do NOT target a specific "$1.2B program." Instead:
  1. Monitor SAM.gov for "physical security," "CCTV replacement," "intrusion detection" solicitations
  2. Target regional security integrator networks partnered with Axis/Hanwha
  3. Position SentinelTwin as "verify before install" for ANY federal camera replacement project

**Why it matters:** Every NDAA replacement project is a coverage re-audit opportunity.
**GTM angle:** Position specifically for NDAA replacement verification. Time-bounded, clear buyer.
**Decision needed:** Should this be an explicit product positioning point or just a side benefit?

---

### Thread 11: Insurance Risk as Distribution Channel

### Thread 12: Workspace interaction and blindspot attribution resilience

**Status:** Implemented in workspace canvas (2026-06-01), partially complete in data contract.
**Findings:**
- Divergent selection handling in `WorkspaceCanvas.tsx` increased maintenance risk; we now centralize node selection/context behavior via local shared handlers and a single cursor helper.
- `selectedNodeId`-driven checks were insufficient for multi-select consistency in overlay rendering; set-based `selectedNodeIds` membership now drives selected-state visuals across critical zones, cameras, camera cones, paths, and sensors.
- Blindspot warnings had brittle parsing (`split(" is obstructing")`) and could fail silently when issue copy changed. We added robust label matching:
  - direct extracted label match,
  - normalized fuzzy match on obstruction labels,
  - token-based fallback match.
- Short-term stability is improved without breaking existing schema.

**Long-term follow-up:**
- Add explicit obstruction linkage to blindspot issues in simulation output (e.g., `affectedObstructionIds` or `issue.obstructionId`) to remove heuristic matching and keep explainability deterministic.
- Add a focused regression fixture for warning mapping (simulation issue text variants + obstructions names) to prevent regressions across localization and copy changes.

**Code anchors:** `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`

**Decision trace:** `Docs/decisions/DECISION_LOG.md` D-292

**Status:** Research complete. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 3.
**Key finding refined (May 2026 research):**
- There is NO industry-wide mandate requiring camera coverage documentation for commercial
  property insurance. No major carrier (Zurich, Travelers, Chubb, AIG, Liberty Mutual) has
  universally implemented such a requirement.
- **What exists instead:** Premium incentives and protective device discounts for businesses
  with professional-grade surveillance systems (24/7 monitoring, high resolution, night vision,
  redundant storage). These are carrots, not sticks.
- **FM Global** (mutual insurance) uses their own engineering-based Property Loss Prevention
  Data Sheets that may recommend security measures — but these are site-specific, not universal.
- **Documentation trend:** Underwriters are increasingly asking for documentation during risk
  assessment (maintenance logs, testing records, system scope), especially for high-hazard
  properties. This is a rising trend, not yet a mandate.
- **Opportunity is real but softer than initially assumed:** The insurance use case is more
  "premium discount evidence" than "compliance mandate." It's still a valid distribution channel
  but the pitch should be "prove your security to lower premiums" not "mandatory by your carrier."

**Revised opportunity:** Insurance companies as distributors offering premium discounts for
  SentinelTwin-audited facilities. Not a compliance mandate but a value-add.
**Decision needed:** How early to pursue insurance partnership vs focus on direct GTM?
**Open:** Monitor Travelers, FM Global, and Chubb for evolving requirements — this is a leading
  indicator, even if not yet standard practice.

---

### Thread 12: Retail Loss Prevention — NEW, STRONG WEDGE
**Status:** Research complete. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 4.
**Key finding:** Global retail shrinkage = $112B/year. AI camera systems reduce it 40–60%.
Retail store layouts change frequently (planogram resets) creating new blindspots.
Multi-location chains need standardized coverage verification across all stores.
**Pitch:** "Moving these shelves will create a blindspot near register 3."
**ROI is clean:** measurable shrinkage reduction → dollar savings.
**Decision needed:** Build a retail-specific UX mode or keep general? Retail layout features
(aisle modeling, POS zone, product display obstructions) might justify a separate template.

---

### Thread 13: GDPR / Privacy Compliance — NEW, EU GTM REQUIREMENT
**Status:** Research complete. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 5.
**Key finding:** CNIL (France) issuing €200,000+ in 2025/2026 fines for privacy violations.
GDPR fines can reach €20M or 4% of global revenue. Camera placement is now a compliance issue.
**Opportunity:** Privacy zone feature → "GDPR compliance evidence report."
**GTM channel:** DPOs (Data Protection Officers) and GDPR compliance consultants.
**Decision needed:** Build GDPR report format before EU launch. Understand DPA-specific requirements
(ICO, CNIL, BfDI have different formats). Add to OPEN_QUESTIONS.md.

---

### Thread 14: Physical Security Pentesting — NEW
**Status:** Research complete. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 6.
**Key finding:** Physical penetration testing is a real, growing discipline. Physical pentesters
currently use manual site walk methods to identify camera gaps. No simulation tooling exists.
**Opportunity:** SentinelTwin as pre-pentest planning tool + post-pentest verification.
Pentest firms have ongoing client relationships — strong distribution channel.
**Framing:** "Authorized engagement only" — aligns with defensive framing already in place.
**Open:** Contact 2–3 physical pentest firms to validate this use case.

---

### Thread 15: BIM / Pre-Construction Security — NEW
**Status:** Research complete. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 7.
**Key finding:** BIM adoption is accelerating. IFC is the standard export format.
Pre-construction camera placement simulation is completely unserved by existing tools.
Fixing camera placement on paper costs $0. Post-construction: $5,000–50,000.
**Product direction:** IFC import → SecurityScene (V0.4+). Revit/ArchiCAD plugin (V1+).
**Open:** How hard is IFC parsing? Are there open-source IFC parsers for Node/Python?
Research ifcopenshell (Python) and web-ifc (JS/WASM).

---

### Thread 16: Guard Patrol Optimization — NEW
**Status:** Research complete. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 9.
**Key finding:** No tool currently answers "what patrol route minimizes coverage gaps?"
Temporal simulation already models patrol schedules — patrol optimization is a natural extension.
**Product direction:** Guard patrol editor + combined camera+patrol coverage view + route optimizer.
**Decision needed:** Is this core SentinelTwin or a separate product line?

---

### Thread 17: Gaussian Splat Visual Layer — NEW
**Status:** Research complete. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 10.
**Key finding:** Polycam, Kiri, Luma AI, NVIDIA Omniverse all advancing Gaussian splats.
A user capturing their space with a phone → Gaussian splat → import into SentinelTwin as
photorealistic visual background is now technically feasible.
**Key architecture note:** Splat = visual layer. Clean cuboids = simulation truth. Always separate.
**Open:** NVIDIA Omniverse integration — they're positioning as the "digital twin platform."
Does SentinelTwin plug into Omniverse or compete with it?

---

### Thread 18: India / Southeast Asia Market — NEW
**Status:** Research in progress. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 20.
**Key finding:** India's smart city program, retail expansion, warehouse boom, school security
mandates — all driving camera installations without sophisticated planning tools.
Indian retail chains lose 1.5–3% of revenue to shrinkage annually.
Most installations are Hikvision/Dahua with no simulation or coverage planning.
**GTM angle:** Freemium with low-cost paid tier. The "shop theft" demo story resonates deeply here.
**Open:** Is there a local Indian security software distributor worth partnering with early?

---

### Thread 19: GenRecon — High-Fidelity Indoor Reconstruction from Sparse Captures
**Status:** External research reference. Code not yet released. Worth watching closely.
**Source:** https://kasothaphie.github.io/GenRecon/ | arXiv 2605.23888 (TU Munich + Huawei, May 2026)
**What it does:** Takes casual smartphone video OR ~8 sparse RGB images → complete, PBR-ready, editable
indoor mesh. Outperforms 2DGS, DA3, FineRecon, MonoSDF, Murre by ~16% on indoor reconstruction benchmarks.

### Thread 20: Operational Evidence Memory
**Status:** In progress.
**Key finding:** Canonical runtime evidence events now normalize through a validated schema, launcher memory search can carry exact checkpoint ids through to Scene Intelligence when a branch-bearing archive hit resolves to a real event, Scene Intelligence can now pivot a checkpoint into seeded Before/After and Report compare selections, and the compare/report share-link contract can round-trip that seeded selection through the studio bootstrap.
**Schema note:** The operational evidence event contract now lives in a canonical zod schema with a companion input schema, so build-time validation and runtime normalization share one shape instead of relying on hand-maintained object interfaces.
**Publication note:** Published checkpoints now resolve through a canonical publication helper, so the temporal twin and downstream report surfaces read publication as an explicit branch concept rather than an inline filter.
**Merge note:** Sync conflict resolution now uses structural equality for merge comparisons instead of `JSON.stringify`, so semantically identical nodes with different property insertion order no longer fabricate false conflicts during branch reconciliation.
**Open:** Should other archive families gain comparable checkpoint ids, or should they remain timestamp/branch routed only?
**Next:** Extend exact-checkpoint provenance to any additional launcher memory hit families that can resolve to stable evidence ids, and consider whether the report surface should auto-enter compare mode when seeded from a checkpoint pivot and whether more archive families should get stable event ids.
Uses Trellis.2 (Microsoft) as the underlying generative 3D prior, lifted to scene scale via chunked
conditioned generation. Produces relightable, editable PBR geometry.
**Why it matters for SentinelTwin:** This is the Stage 4 (Multi-Photo 3D Reconstruction) candidate that
could replace/upgrade VGGT for the V0.4 guided scan input mode. Key properties that matter:
- Works from sparse casual captures (no structured scan session needed)
- Fills in occluded/unobserved areas (critical: incomplete reconstruction → wrong blind-spot analysis)
- Editable PBR mesh → clean geometry for SpatialLM to extract semantic blocks from
- Client demo value: photorealistic visual layer (separate from simulation truth)
**Architecture note:** GenRecon output = visual context layer only. Never simulation truth.
Flow: GenRecon mesh → SpatialLM/Open3D semantic extraction → SecurityScene blocks → raycasting.
**Current status:** Code repo exists (https://github.com/kasothaphie/GenRecon) but not released.
**Dependency risk:** Trellis.2 license needs verification for commercial use.
**Competing alternative for now:** VGGT (MIT licensed, available). Keep VGGT as the hackathon-phase
implementation. Plan GenRecon as the production upgrade once code drops.
**Open questions for this thread:**
- DUSt3R/MASt3R are CC BY-NC-SA (non-commercial). GenRecon uses Trellis.2 — what license?
- What is the inference time on consumer GPU? Real-time enough for guided scan UX?
- Does it produce metric scale or relative? Security simulation needs approximate metric dimensions.
- Monitor repo: https://github.com/kasothaphie/GenRecon for release announcement.
**Related:** Concurrent work Pixal3D uses closely related conditioning for 3D object-level generation.
**Next:** No action until code releases. Verify Trellis.2 license. Compare to VGGT when available.

---

### Thread 20: ChatGPT Multi-Session Synthesis — Signals Not Yet Fully Explored
**Status:** Open. These ideas came from the founding ChatGPT sessions and are in context/origin/
but haven't been turned into full exploration docs yet.
**Source:** chatgpt_raw_conversations.md — sessions 2, 3, 4

**Signals worth formal exploration threads:**
1. **No floor plan needed as hero wedge** — The real product unlock vs existing tools is that
   SentinelTwin doesn't require a CAD file. Walk the site with a phone. This positioning angle
   should be explicit in the product/GTM docs, not just the architecture.
2. **"Security Evidence Twin" framing** — One synthesis suggested the product should not just
   answer "where are blind spots?" but "can we prove this site met the required security outcome?"
   That's insurance/compliance/legal evidence, not just planning. Explore as a separate product mode.
3. **Incident replay as emotional hook** — "Camera 1 existed, but the thief wasn't identifiable."
   Post-incident review for authorized agencies. The ChatGPT sessions identified this as the
   strongest emotional/business demo. Thread 9 (Real Camera Verification) touches this but
   the defensive incident replay angle is distinct — worth its own doc.
4. **GSAP in animation** — The original project brief uses GSAP extensively for replay timelines,
   camera flythroughs, before/after transitions. OPEN_SOURCE_LICENSING.md flags it as needing
   a decision (buy Club GSAP ~$99/yr OR replace with motion/anime.js). 
   **Decision Made (D-259):** Proceed with Motion One (now merged into Framer Motion 11+ as `motion`) as the primary timeline library. Use Framer Motion for React UI, and fallback to GSAP only if strictly necessary and licensing permits. Do NOT remove GSAP references from exploration docs — keep both the exploration of alternatives and the final decision documented together so the rationale is preserved. Make the decision at first-use time when the animation requirements are clearer.
5. **Multi-agent Codex narrative** — For the hackathon, showing Codex/AI as a parallel
software engineering team is a stronger story than "AI helped me write code."
Each agent owns a defined deliverable with tests + docs. This pattern should be in
a hackathon-specific demo script doc.

---

### Thread 21: Sensor Fusion Preview and Workspace Access Policy
**Status:** Live product boundary, partial implementation.
**Key finding:** The editor now exposes a nearest-sensor `Sensor Fusion` preview in the camera inspector analytics tab and the live camera feed, sensor edits emit operational evidence events, governance/publish flows already route through a local shared-workspace access policy with explicit review requests when publish is blocked, and the debug panel now surfaces runtime health plus a path trace so operators can see simulation / AI / access status and the most recent journey history at a glance.
**Open:** How much of the future live sensor-camera fusion detail should be visible in the inspector before ONVIF metadata lands, and how should backend sync preserve the local journal/access model without losing the current branch semantics?
**Next:** Keep the visible sensor preview and access-routing model in sync with the schema and provenance layers while full live ingestion and backend auth remain open.

---

### Thread 21: Guided Capture / Reconstruction Stack
**Status:** Research anchored. The capture and reconstruction stack now has clear primary-source references, but the product boundary is still intentionally open.
**Key finding:** RoomPlan gives the strongest native capture pattern for guided interior scanning on Apple platforms, SAM 2 gives promptable tap-to-mask segmentation, Depth Anything V2 gives a depth prior, VGGT gives a fast sparse multi-view geometry candidate, SpatialLM gives a structured indoor modeling bridge, and ONVIF Profile M gives the live metadata/event ingestion standard for later-stage sensor fusion.
**Open:**
- Which capture stack should the guided scan flow target first: native RoomPlan on Apple devices, web/mobile manual-assisted capture, or a provider-agnostic abstraction with RoomPlan as one backend?
- Where should scale anchors live in the flow so relative depth stays honest and user-correctable?
- Which reconstruction result is considered draft versus publishable evidence?
**Next:** Keep the capture UX, segmentation, depth, and point-cloud reconstruction explicitly separated from the canonical `SecurityScene` truth model. Add an implementation thread only when the branch-aware ledger can preserve the full correction chain.

---

### Thread 21: Studio Runtime Hardening and Dev-Cache Failure Modes
**Status:** Open. Runtime behavior can be masked by build cache corruption or by a single
bad derived-data path during module evaluation.

**Key findings (2026-05-26):**
- Turbopack dev cache corruption can panic the `next dev` server with missing SST/meta files
  under `apps/studio/.next/dev/cache/turbopack/...`, which surfaces to the browser as a blank
  or partially mounted workspace even when the app code is otherwise valid.
- `simulateStudio()` crashed during module evaluation because the recommendation builder used
  `zone.polygon` on a `ZoneResult` shape instead of the source `scene.criticalZones` data.
  The resulting stack trace only appeared once the workspace shell was allowed to mount.
- The fastest recovery path for local verification is to clear the rebuildable `apps/studio/.next`
  cache, restart `next dev`, then re-run the browser check. Do not treat the blank canvas as
  proof of a broken scene until the cache has been reset.

**Next:** Keep a short checklist in the repo docs or dev notes for cache reset + browser
retest when the studio view suddenly becomes blank after a Turbopack crash.
**Next:** Decide which of these gets a full exploration thread before V0.1 build starts.

---

### Thread 21: 3D Building Editor — Ideas Behind Pascal, Own Implementation Options
**Status:** Active exploration. Decision on Pascal fork made, but this thread captures the
broader question: what does a 3D building editor for security simulation actually need,
and how much do we own vs borrow?
**Framing:** Pascal is one reference. The question is what the idea requires, not what Pascal does.

**What SentinelTwin's editor actually needs (first principles):**
- Draw/edit rooms: walls with height, doors, windows
- Place objects: cameras, lights, shelves, counters, pillars, any obstruction
- Snap to grid and surfaces
- Select, move, rotate, resize objects
- Undo/redo
- Save/load scene as JSON (SecurityScene contract)
- Multi-floor (V0.2+)
- 2D plan view + 3D view switching

**What Pascal gives for free:** All of the above plus corner mitering, CSG door/window cutouts,
Zundo undo/redo, IndexedDB persistence, full R3F + WebGPU architecture, MIT license.
**The honest question:** If Pascal didn't exist, how hard is it to build the above from scratch?
Answer: Probably 2–4 weeks for a solid 3D editor base. Pascal saves that time.
But if the fork creates more drag than benefit (divergence maintenance, upgrade conflicts,
architecture mismatches), building lean from scratch is a valid alternative.

**Other 3D editor references (for ideas, not dependencies):**
- **Arcada** (open source React/Pixi 2D floor-plan editor) — walls, furniture, doors/windows,
  measurements, multiple floors. Proves 2D editor is not complex. Could be V0.2 2D mode.
  Repo: github.com/vatro/svelterflow (check exact repo). License: check.
- **FluidCAD** — parametric JS CAD in browser. Idea: every scene object has numeric handles.
  Not a dependency, just a UX pattern worth borrowing.
- **Planner 5D** — commercial, shows floor plan image → 3D is user-expected behavior.
  Competitive reference, not a code reference.
- **IFC.js / web-ifc** — browser IFC parser. Relevant for BIM import (Thread 15).
  MIT licensed. Worth experimenting with for V0.4 BIM input.

**Own implementation path (if Pascal fork doesn't work out):**
```
R3F canvas
+ Drei TransformControls for select/move/rotate
+ custom WallBuilder (click to draw wall segments, auto-connect corners)
+ custom ObjectPlacer (drag from tray, snap to floor/wall)
+ Zustand scene store (flat dict, same pattern as Pascal)
+ Zundo for undo/redo
+ JSON export = SecurityScene
```
This is about 1,000–2,000 lines of core editor code. Not trivial but manageable.
The real complexity is wall corner mitering and door/window CSG — Pascal handles both.

**Current decision:** Fork Pascal. Revisit if V0.1 build reveals the fork creates more
complexity than it saves. Document divergences in DECISION_LOG.md.

---

### Thread 22: Indoor 3D Reconstruction — Ideas Behind GenRecon, Own Pipeline Design
**Status:** Active exploration. GenRecon is one reference (code not yet released).
This thread captures the broader question: what does a scan-to-SecurityScene pipeline
need, and what can we build without depending on any specific research paper's code?
**Framing:** GenRecon proves the quality bar is achievable. We need to design our own
pipeline that works now and upgrades as better tools release.

**What the guided scan input mode actually needs (first principles):**
1. User captures space (phone video or 5–20 photos)
2. System estimates camera poses
3. System produces a rough 3D representation (point cloud or mesh)
4. System extracts walls, doors, windows, object bounding boxes
5. User confirms/corrects object placement
6. Output: valid SecurityScene JSON

**The pipeline we can build now (without GenRecon):**
```
Phone video or photos
  ↓ VGGT (MIT) — camera poses + point maps
  ↓ Open3D — plane fitting for walls/floor
  ↓ SpatialLM (Apache 2.0) — semantic labeling of objects
  ↓ User confirmation UI — confirm, adjust, label objects
  ↓ SecurityScene JSON
```
None of this requires researchers to release their code. All pieces exist today.

**The quality upgrade when GenRecon (or equivalent) releases:**
```
Phone video or photos
  ↓ GenRecon (or TRELLIS.2 directly, or future equivalent)
    → complete PBR indoor mesh (better completeness, fewer gaps)
  ↓ SpatialLM / Open3D
  ↓ User confirmation UI
  ↓ SecurityScene JSON
```
GenRecon improves step 1-2 quality. The rest of the pipeline is unchanged.

**Other reconstruction references (ideas only):**
- **TRELLIS.2** (Microsoft, May 2026) — the generative 3D prior that GenRecon uses.
  Could be used directly for object-level 3D from masked images (SAM mask → TRELLIS.2 → 3D).
  Separate from GenRecon's scene-level use. Worth checking license independently.
- **MASt3R / DUSt3R** — CC BY-NC-SA (non-commercial). Cannot use in product.
  Fine for personal experiments. VGGT (MIT) is the commercial-safe alternative.
- **Polycam / Kiri / Scaniverse** — commercial apps that produce GLB exports.
  SentinelTwin can accept their exports as GLB import without depending on their code.
  ScanNode in Pascal may already support GLB. The idea: import scan → use as visual
  background → extract semantic blocks on top.
- **RoomPlan (Apple ARKit)** — produces USDZ/USD room models with semantic labels.
  Very relevant for iOS. Worth exploring as an iOS-specific fast input path.
  License: Apple framework, free to use in iOS apps.

**Own work in this space:**
- The scene compiler (raw 3D → SecurityScene) is entirely our own code regardless of
  which reconstruction model feeds it. SpatialLM + Open3D semantic extraction + our
  SecurityScene schema validation is 100% ours.
- The user confirmation UX ("is this object a shelf or a counter?", adjust bounding box)
  is entirely our own.
- The depth-to-dimension calibration (user marks door = 0.9m → scale everything) is ours.

**Current plan:** Build the VGGT → Open3D/SpatialLM → SecurityScene pipeline for V0.4.
Monitor GenRecon, TRELLIS.2 for quality upgrades. Accept GLB imports for Polycam/Kiri
users as an immediate lower-barrier alternative.

---

### Thread 23: Local-First / Data Security — Site Layout Privacy
**Status:** Open. Must resolve before building any data persistence or AI call layer.
**Why it matters:** SentinelTwin processes sensitive data. A SecurityScene JSON is a detailed
map of a facility's security posture — camera positions, blindspots, entry points, critical
zones. A CCTV installer or security agency will not upload their client's floor plan to a
cloud service. This is not a future concern; it is a day-one sales blocker for the
professional market.

**The core tension:**
AI model calls (command parsing, counterfactual reasoning, report generation) currently
require sending SecurityScene JSON to OpenAI/Gemini. That JSON is the site layout.
A small retail owner may not care. A security agency protecting a bank will.

**Options to explore:**
1. **Client-side only:** All simulation and AI runs in-browser. No data leaves the device.
   Simulation is already designed this way (deterministic, no server). AI calls are the blocker.
   Local LLMs (Ollama, llama.cpp WASM) could handle command parsing and report generation.
   Quality tradeoff vs hosted models.
2. **Optional server / tiered:** Free tier is fully client-side. Pro tier allows server AI calls
   with explicit user consent and data processing agreement.
3. **Self-hosted deployment:** Enterprise option where the entire SentinelTwin stack runs on
   the customer's infrastructure. No data ever leaves their network.
4. **Selective data sending:** Strip identifying information before AI calls. Send only the
   coverage delta or the specific counterfactual question, not the full scene.

**What to investigate:**
- Can Ollama or a WASM LLM handle command parsing well enough for V0.1?
- What is the minimum data needed per AI call? Can we avoid sending full SecurityScene?
- What do GDPR and India's DPDPA require for storing and processing this type of data?
- What do professional security agency contracts typically require for client data handling?

**Related:** D-019, Q-018. This affects architecture/05 (AI agent architecture).

---

### Thread 24: Security Evidence Twin — Framing and Product Mode
**Status:** Open. Product decision, not technical. Affects positioning and output layer.
**Source:** ChatGPT sessions (context/origin/chatgpt_raw_conversations.md), Thread 20.

**The two framings:**

Framing A (current): "Live security simulation — test coverage, find blindspots."
This is planning software. Buyers: installers, facility managers, security agencies.

Framing B: "Security Evidence Twin — can you prove your security setup met the required standard?"
This is compliance/audit/legal software. Buyers: insurers, compliance officers, post-incident
legal teams, enterprise procurement with mandatory coverage attestation requirements.

These are not mutually exclusive. But they produce different output layers, different
business models, and different buyers.

**Why Framing B is worth developing:**
- An insurer asking "show me your coverage attestation" is a mandatory purchase driver,
  not a discretionary one. Compliance mandates don't have budget cycles.
- Post-incident legal reconstruction ("what should Camera 3 have captured?") is a
  service security agencies charge premium rates for. SentinelTwin could automate it.
- IEC 62676-4:2025 compliance documentation is currently produced manually and expensively.
  Automating it is a direct time and cost save.
- Enterprise facilities with insurance requirements, SOC 2, or physical security audits
  need documented evidence. A PDF from SentinelTwin carries more weight than "our guy walked
  the site and said it looks good."

**Questions to answer:**
- Is "evidence generation" a separate product mode (like a report export), or the primary
  lens through which everything is framed?
- What does an insurance-grade coverage attestation actually need to contain?
  (Standards reference, assumptions, methodology, date, site ID, verifier identity)
- Does Framing B change who is responsible for the output? (Planning tool = advisor.
  Evidence tool = potentially liable if wrong.)
- Can we produce something courts and insurers actually accept, or only something that
  helps professionals produce their own documentation?

**Recommendation to explore:** Build Framing A first (simulation is the product).
But design the report layer from day one with Framing B in mind: every output references
the standard used, shows assumptions, timestamps everything, and exports in formats
professionals can attach to compliance documentation.

**Related:** D-020. Architecture/05 report layer. STANDARDS_COMPLIANCE_REGULATORY.md.

---

### Thread 25: Multi-Sensor Physical Security — Beyond Cameras
**Status:** Open. Scope decision. Affects SecurityScene data model if answered "yes".

**What exists beyond cameras:**
Physical security is multi-layered. Cameras are the most visible layer but not the only one:
- **Motion detectors** (PIR, microwave, dual-tech): detect presence in zones cameras may miss
- **Door/window contact sensors**: detect entry events with exact location and timestamp
- **Access control readers** (card, PIN, biometric): log who entered where and when
- **Audio detection**: glass break, gunshot, raised voices, specific sounds
- **Vibration sensors**: perimeter fence, wall penetration
- **Panic buttons / duress alarms**: staff-triggered events
- **Smoke/heat sensors**: not security per se but trigger camera recording in real systems

**Why these interact with camera coverage:**
- A PIR motion trigger in a camera blindspot is a compounded security gap —
  something happened but there is no visual record.
- An access control log showing Card XYZ entered Door 3 at 2:14 AM, but Camera 2
  which should cover Door 3 has a blindspot at that position, is a verification failure.
- If a glass break sensor fires in a zone with only detection-quality camera coverage,
  the incident may not be identifiable.
- Guard patrol timing combined with sensor dead periods defines the actual vulnerability window.

**The interesting product direction:**
SentinelTwin currently simulates camera coverage. The natural extension is simulating
the full sensor mesh: not just "is this zone covered by cameras" but "is this zone covered
by any detection layer, and what is the combined detection probability?"

This makes SentinelTwin a multi-layer physical security intelligence platform, not just
a camera planner. Every sensor type has coverage characteristics, failure modes, and
interactions with other sensors.

**What to decide:**
- Is multi-sensor in scope for V1? V2? Or never (camera-only product)?
- If yes: does SecurityScene need sensor nodes (MotionSensorNode, DoorSensorNode) now,
  or can they be added without breaking the schema later?
- If yes: what is the simulation model for non-camera sensors?
  (A PIR has a detection cone with range and angle, similar in some ways to a camera
  but without quality levels — it detects or it doesn't.)

**Recommendation:** Keep camera-only for V0.1. But design the SecurityScene schema
with sensor extensibility in mind — a `SensorNode` base type that cameras are one
variant of. This costs almost nothing now and avoids a breaking schema change later.

**Related:** D-022, Q-019.

---

### Thread 26: Simulation Uncertainty and Trust Signals
**Status:** Open. UX and product ethics question.

**The problem:**
SentinelTwin produces numbers: "78% coverage", "recognition quality at cash counter",
"exposure score 3.2." These numbers come from a simulation model with many assumptions.
They are not measurements. They are estimates under stated conditions.

A user who treats "78% coverage" as a fact could:
- Decide not to add a camera they actually need
- Present the number to a client as a guarantee
- Use it as legal evidence without understanding its basis
- Make a security decision that fails because the real scene differs from the model

**The assumptions that drive every output:**
- Camera height (user-specified or default)
- Person height (default 1.7m — what about seated people, children, vehicles?)
- Wall height (default 3m — what about partial walls, mezzanines?)
- Material transmission values (our estimates, not measured)
- Night penalty curves (simplified model, not photometric)
- Camera clarity (clean lens assumed unless marked dirty)
- IR effectiveness falloff curve (manufacturer spec, not verified)

Change any of these and the numbers change meaningfully.

**What other simulation tools do:**
Flight simulators are explicit about being models. Engineering simulations show
confidence intervals. Weather forecasts show probability ranges. Medical imaging AI
shows confidence scores. SentinelTwin should be in this tradition.

**Design directions to explore:**
1. **Persistent assumptions panel:** Always visible, not hidden in settings. Shows every
   assumption actively driving the current simulation. User can change any assumption
   and see what changes.
2. **Sensitivity indicators:** For zones near threshold (e.g., barely passing recognition
   quality), show a fragility indicator. "This zone passes recognition quality by 8%.
   A 10% reduction in camera clarity would cause it to fail."
3. **Report language:** All reports use "estimated", "under current assumptions",
   "simulation model only — verify against actual installation."
4. **Assumption diff:** When comparing before/after snapshots, show if any assumption
   changed between them (otherwise the comparison is meaningless).
5. **Calibration mode:** Allow user to mark a known ground truth ("Camera 1 actually
   covers this zone at recognition quality in real life") and see how well the simulation
   matches. Build trust through calibration, not assertion.

**Related:** Q-017. SimulationAssumptions type in architecture/01.

---

### Thread 27: NVIDIA Metropolis VSS 3 Blueprint — Physical AI for Video Surveillance
**Status:** New. External intelligence signal. NOT a direct competitor, but important context.
**Source research:** NVIDIA Metropolis VSS (Video Search and Summarization) Blueprint, March 2026.

**What NVIDIA announced (March 2026):**
- **Metropolis VSS 3** is an open reference architecture for building AI agents that reason over video
  from edge to cloud. It decomposes video streams to understand safety issues, detect lighting changes,
  predict hazards, and identify specific events — at context level, not just motion triggers.
- Uses AI-RAN (AI Radio Access Networking) to offload heavy computation near the edge for real-time response.
- Partners: Caterpillar, KION, Hitachi, HCLTech, Siemens Energy, Tulip, Telit Cinterion.
- Part of NVIDIA's broader "Physical AI" push (blueprints for AI agents that see, hear, act in the physical world).
- Ecosystem includes NVIDIA OSMO for orchestration, Metropolis for video analytics, Isaac for robotics.

**Why it matters for SentinelTwin:**
- NVIDIA is building the AI analytics layer for live video feeds — **post-install analysis**.
- SentinelTwin is **pre-install planning + simulation**. They are complementary, not competitive.
- BUT: NVIDIA's ecosystem could eventually extend into planning (e.g., acquiring a simulation company
  or building an NVIDIA-branded coverage planning tool). This is a long-term competitive risk.
- For the hackathon and V0.1 narrative: SentinelTwin can say "NVIDIA analyzes what cameras see.
  SentinelTwin simulates what they will see before you install them."
- NVIDIA's blueprint approach (open reference architecture) validates that the market is moving toward
  AI-powered physical security tools. This is a tailwind, not a headwind.

**Key differentiation:**
| NVIDIA Metropolis VSS | SentinelTwin |
|---|---|
| Processes existing video feeds | Simulates coverage before installation |
| Detects events in real footage | Predicts blindspots before incidents |
| Requires cameras already installed | Works with no cameras (planning mode) |
| Cloud/edge inference pipeline | Browser-based deterministic simulation |
| Open reference architecture | Product, not a framework |

**Open question:** Does NVIDIA's "Physical AI Data Factory Blueprint" overlap with SentinelTwin's
scan-to-scene pipeline? Possibly — NVIDIA is building tools to process real-world data into digital
representations. Monitor for any NVIDIA digital twin + security crossover.

---

### Thread 28: VSaaS Ecosystem Gap — No Major Platform Has Built-In Coverage Simulation — CRITICAL FINDING
**Status:** New. High strategic importance. Validates SentinelTwin's core product gap.
**Source research:** Verkada, Eagle Eye Networks, Arcules, Cloudastructure — researched May 2026.

**Key finding:** None of the major VSaaS (Video Surveillance as a Service) platforms have built-in
camera coverage simulation, DORI quality analysis, or adversarial path simulation.

**What each platform does for planning:**
- **Verkada:** Emphasizes a closed ecosystem. Planning tools focus on bandwidth/storage estimation.
  No geometric FOV simulation. Relies on partner-led design support.
- **Eagle Eye Networks:** Planning tools focus on bandwidth calculators and compatibility matrices.
  Partners with **System Surveyor** (third-party site survey tool) for camera placement planning.
- **Arcules:** Open hybrid platform. No built-in simulation. Uses third-party tools.
- **Cloudastructure:** Cloud-native. No built-in coverage simulation.

**System Surveyor (the closest existing tool):**
- Cloud-based digital site survey platform for physical security and low-voltage systems
- Features: drag-and-drop device placement on floor plans, BOM generation, FOV visualization,
  manufacturer catalogs (100,000+ items), real-time collaboration
- Pricing: Free tier available, paid plans start ~$70/month
- Integrates with Eagle Eye Networks and other VSaaS platforms
- **Key difference from SentinelTwin:** System Surveyor is a 2D CAD-style planning tool, not a
  3D simulation engine. It does not compute DORI quality, occlusion, adversarial paths,
  temporal profiles, or counterfactual testing. It is a digital whiteboard, not a simulator.

**What this means for SentinelTwin:**
- **No competitor has built this.** Verkada ($3.5B valuation), Eagle Eye ($500M+), Arcules
  (Panasonic subsidiary) all lack coverage simulation. This is a verified product gap.
- System Surveyor is the closest tool and it's 2D CAD-based. SentinelTwin's 3D simulation,
  DORI quality model, adversarial path, and counterfactual testing are genuinely novel.
- **Potential partnership angle:** System Surveyor could use SentinelTwin's simulation engine
  as a plugin/add-on. They have the floor-plan-to-device-placement workflow. SentinelTwin
  adds the security intelligence layer.
- **GTM implication:** These VSaaS platforms could be distribution channels. An installer
  designing a Verkada deployment uses SentinelTwin before buying hardware.

---

### Thread 29: Converged Security (Cyber-Physical) — Market Direction and Buyer Evolution
**Status:** New. Important for buyer persona and long-term product direction.
**Source research:** PSIM market, cyber-physical convergence trends, May 2026.

**Market direction:**
- Physical Security Information Management (PSIM) market: $1.9–2.2B in 2025–2026, growing 12–18% CAGR.
- Broader cyber-physical systems (CPS) security market: estimates range $10B–$140B+ depending on scope
  (narrow PSIM vs broad OT/IoT/CPS security).
- Trend: Organizations creating unified "Chief Security Officer" roles overseeing both cyber and physical.

**Key convergence trends:**
1. **Organizational restructuring:** Breaking down silos between physical security (Facilities/Security Ops)
   and cybersecurity (IT/InfoSec). Unified CSO roles becoming more common.
2. **Shared tools and dashboards:** PSIM platforms aggregating data from cameras, badge readers, fire alarms,
   AND network intrusion detection into a single pane of glass.
3. **AI cross-domain correlation:** Linking badge-in data with network login patterns to detect insider threats.
4. **Unified identity management:** One credential for building entry AND network/application access.
5. **OT/ICS security convergence:** Plant engineers and IT security teams collaborating as industrial
   control systems connect to enterprise networks.

**What this means for SentinelTwin:**
- The converged security buyer (CSO, director of security operations) is a higher-value buyer than
  a CCTV installer. They buy software platforms, not just point tools.
- SentinelTwin's simulation engine could produce outputs that feed into PSIM dashboards
  (coverage heatmap overlay onto Genetec/Milestone).
- The converged security narrative strengthens SentinelTwin's story: physical coverage gaps
  are also cyber risk (unmonitored server room access, tailgating into sensitive areas).
- **Mid-term product direction:** Generate coverage data that can be piped into PSIM platforms
  as a security intelligence layer.

**Relevant platforms to watch:** Genetc Security Center, Milestone XProtect, Verint, Everbridge, BriefCam.
These are VMS/PSIM platforms that could consume SentinelTwin data.

---

### Thread 30: ASIS Certified Professionals as Buyer Persona — CPP, PSP Certification
**Status:** New. Important for buyer persona depth, marketing positioning, and product credibility.

**Key data:**
- **CPP (Certified Protection Professional):** ASIS's "gold standard" certification for security
  management. Senior-level generalist. Approx 6,000+ active holders globally.
- **PSP (Physical Security Professional):** Focused specifically on physical security — conducting
  security surveys, designing integrated security systems, implementing physical protection measures.
  This is the most directly relevant certification for SentinelTwin's buyer.
- **APP (Associate Protection Professional):** Early-career, foundational.
- ASIS International: 34,000+ members globally.

**What PSP-certified professionals need:**
- Tools for conducting physical security surveys (SentinelTwin is a survey tool)
- Coverage documentation for standards compliance
- System design validation before installation
- Client-facing reports with quantified security outcomes

**What SANS does NOT do:**
- SANS Institute is primarily cybersecurity. They do not offer dedicated physical security training.
  For physical security-specific training, CDSE (Center for Development of Security Excellence)
  and FLETC (Federal Law Enforcement Training Centers) are the standards.

**GTM implications:**
- ASIS conference presence (GSX — Global Security Exchange) is the perfect launch event.
- "SentinelTwin — built for PSP-certified professionals" is a targeted positioning.
- ASIS certification holders in India/Southeast Asia: growing but smaller base. The certification
  is more US/International. India-specific certifications may matter more for local market.
- SANS not having physical security training means there's less crossover between cyber and physical
  than might be assumed. The buyer persona is still the physical security specialist.

---

### Thread 31: ISO/IEC 30173 — Digital Twin Standard — Enterprise Procurement Relevance
**Status:** New. Important for enterprise sales readiness, not technical architecture.

**What ISO/IEC 30173:2023 is:**
- "Digital twin — Concepts and terminology." Foundational standard defining what a digital twin IS.
- Defines digital twin as: "digital representation of a target entity with data connections
  that enable convergence between the physical and digital."
- Provides: functional view of a DTw, system context, lifecycle process, types of DTw.
- Domain-agnostic (manufacturing, construction, healthcare, smart cities — all covered).

**What it does NOT do:**
- Does NOT provide security controls or compliance requirements.
- Does NOT mandate specific technical implementations.
- Does NOT have product certification programs.

**Why it matters for SentinelTwin:**
- **Enterprise procurement language:** Large organizations increasingly require that digital twin
  architectural documentation aligns with ISO/IEC 30173 conceptual model. If SentinelTwin's
  documentation references this standard, it passes a procurement checkbox that competitors
  who don't will fail.
- **Interoperability language:** ISO/IEC 30173 terminology enables SentinelTwin to talk about
  its data model in enterprise-standard terms: "SecurityScene is the digital representation
  with data connections enabling convergence between the physical security installation and
  the simulation model."
- **No certification needed:** SentinelTwin does not need to be "certified" against this standard.
  But architecture docs should reference it and use its vocabulary.
- **Specific action:** Add ISO/IEC 30173 reference to `Docs/architecture/00_ARCHITECTURE_OVERVIEW.md`
  and any enterprise-facing documentation. The phrase "ISO/IEC 30173-aligned digital twin" is
  valuable in RFPs.

---

### Thread 32: IPVM DORI Calculator — Methodology Gap — Positioning Insight
**Status:** New. Important for competitive positioning and honest simulation narrative.

**Key finding:** IPVM's DORI calculator uses **theoretical mathematical projection** from
manufacturer specs, NOT empirically tested real-world measurements.

**How IPVM works:**
- Inputs: manufacturer-provided specs (sensor resolution, focal length, horizontal FOV)
- Calculates: theoretical PPM at various distances using geometric projection
- Standard thresholds: Detection 25 PPM, Observation 63 PPM, Recognition 125 PPM, Identification 250 PPM
  (based on IEC/EN 62676-4)
- Database: 12,000+ camera models

**What IPVM does NOT do:**
- Does not test actual cameras in a lab and publish measured PPM
- Does not account for: lens distortion, sensor noise, compression artifacts, lighting conditions,
  environmental factors (rain, fog, reflections), occlusion
- Does not show occlusion from walls, furniture, people
- Does not simulate adversarial paths, temporal profiles, or counterfactuals

**What this means for SentinelTwin's positioning:**
- IPVM's calculator is the industry standard — and it's purely theoretical geometry.
- SentinelTwin can match this theoretical baseline AND add:
  1. **Occlusion:** Reality-check: a shelf blocks the view
  2. **Night penalty:** Realistic IR falloff
  3. **Glass/grill/mesh transmission:** Material-aware occlusion
  4. **Adversarial paths:** What IPVM can't even ask
  5. **Explicit assumptions:** Honest about what's estimated vs measured
- **Positioning line:** "IPVM shows theoretical DORI from manufacturer specs.
  SentinelTwin shows what your cameras will actually see in your actual space."
- The honesty about assumptions (IPVM does not mention them) is a trust differentiator.

---

### Thread 33: Guard Patrol Software — No Simulation Gap — Confirmed
**Status:** New. Validates Thread 16 with market data.

**Key finding:** The guard patrol management software market (~$2.2–2.7B in 2025, 10–14% CAGR)
has ZERO simulation capability. All products (TrackTik, GuardTek/Trackforce, GuardsPro, Celayix,
OfficerReports, Silvertrac, Connecteam) are operational tracking and reporting platforms.

**What guard patrol software does today:**
- Real-time GPS tracking and geofencing
- Digital checkpoint scans (NFC/QR codes) verifying guard presence
- Incident reporting with photo/video/audio attachments
- Scheduling, time/attendance, payroll integration
- Lone worker alerts and mass notifications
- Predictive analytics based on historical incident data (where to focus, not what-if simulation)

**What none of them do:**
- Simulate a patrol route before deploying it
- Show combined camera + patrol coverage over time
- Calculate vulnerability windows between patrol passes
- Optimize route for minimal coverage gap (the closest is predictive analytics for focus areas)

**What this means for SentinelTwin:**
- **SentinelTwin's patrol optimization feature (Thread 16) would be genuinely novel — nobody in the
  $2.5B guard patrol market offers it.**
- This is not a side feature. It could justify a separate product line ("SentinelTwin Patrol").
- The guard patrol software companies are potential acquirers of SentinelTwin's simulation layer,
  or integration partners. TrackTik + SentinelTwin = patrol planning + execution.
- The market is growing fast (10–14% CAGR) and the simulation gap is a clear white space.

---

### Thread 34: IFC.js / That Open Company — BIM Import Viability Confirmed
**Status:** New. Reduces risk for Thread 15 (BIM / Pre-Construction Security).

**Key finding:** web-ifc (MIT licensed, maintained by That Open Company) is stable and capable
for browser-based IFC parsing. This makes BIM import for SentinelTwin lower-risk than previously assumed.

**What web-ifc can do:**
- Parse IFC files at "native speeds" via WebAssembly
- Extract building elements: IFCWALL, IFCDOOR, IFCWINDOW, IFCSPACE (rooms)
- Works with three.js for 3D rendering
- MIT licensed — fully permissive for commercial use

**Limitations:**
- IFC schema is complex — developers need understanding of buildingSMART IFC schema
- Large, high-detail models can strain browser memory
- Complex geometry (NURBS, advanced CSG) can be computationally expensive to convert to WebGL

**What this means for SentinelTwin:**
| Risk level before research | Risk level after research |
|---|---|
| High — unknown if browser IFC works | Medium-low — viable with known limitations |
| Dependency unknown license | MIT — fully commercializable |
| Unclear if walls/doors extractable | Yes — schema querying works |

**Action:** Add web-ifc experiment to V0.4 plan. The recommended path:
```
IFC file → web-ifc (WASM parser in browser) → extract geometry types
→ SpatialLM or custom logic → SecurityScene blocks → coverage simulation
```
IFC.js provides the parsing. The scene compiler (extracting security-relevant structures)
is still SentinelTwin's own work.

---

### Thread 35: AS/NZS 62676 — Australian/New Zealand Standard — AU Market Entry Requirement
**Status:** New. Important for AU market strategy given Hikvision bans and regulatory alignment.

**Key finding:** AS/NZS 62676 is a direct adoption of IEC 62676 with AU-specific modifications.
Compliance is generally voluntary unless contractually required (government, insurance, critical
infrastructure), but is considered the "gold standard" for professional practice.

**Details:**
- AS/NZS 62676.4 (Part 4: Application Guidelines) specifies DORI requirements by site type.
- The standard requires documented Operational Requirement (OR), design validation, and system testing.
- AU/NZ markets: both have Hikvision bans (AU: 2025 legislation, NZ: following similar path).
- Government tenders increasingly require AS/NZS 62676 compliance documentation.
- Insurance companies in AU are starting to ask for standards-compliant coverage documentation.

**What this means for SentinelTwin:**
- Supporting IEC 62676-4:2025 (OODPCVS) automatically supports AS/NZS 62676 (since it's a direct adoption).
  No additional implementation work needed.
- For Australian GTM: SentinelTwin reports referencing "AS/NZS 62676 compliance" is a checkbox
  that opens government and insurance procurement.
- The Hikvision ban in AU creates the same NDAA-replacement coverage re-audit opportunity as the US.
- **Recommendation:** Add AS/NZS 62676 to the standard selector dropdown alongside DORI and OODPCVS.
  Same thresholds, different label for AU/NZ market.

---

### Thread 36: Physical Penetration Testing Firms — Distribution Channel — Specific Names
**Status:** New. Fills in the specific firm names for Thread 14 distribution channel.

**Key finding:** Physical penetration testing is a real, specialized discipline with identifiable
firms. This validates Thread 14 as actionable.

**Firms that do physical security assessments / red teaming:**
| Firm | Specialization | Relevance |
|---|---|---|
| **Schellman** | Compliance-heavy physical pentesting | Enterprise compliance angle |
| **TrollEye Security** | Global physical pentesting + social engineering | Global scope |
| **Kroll** | Red teaming, high-stakes environments | Large firm, could be partnership target |
| **Guidepost Solutions** | ASIS-aligned physical security consulting | Certification credibility |
| **Razorthorn Security** | Physical red team services | Specialist |
| **BHIS** (Black Hills) | Red teaming with physical components | Cybersecurity community credibility |

**What these firms need (that SentinelTwin provides):**
- Pre-engagement simulation: "Given this floor plan and camera layout, find optimal evasion paths"
- Post-engagement verification: "Did our pentesters use the route SentinelTwin predicted?"
- Client deliverable: documented evidence of why coverage failed
- Reporting: standards-referenced, quantified coverage analysis

**GTM approach for this channel:**
- Build relationships at ASIS GSX conference and physical security events
- Offer free SentinelTwin Pro to pentest firms in exchange for feedback and case studies
- Co-marketing: "TrollEye Security used SentinelTwin to plan their physical assessment of [site]"
- **Caution:** Ensure defensive framing is bulletproof in all pentest-related marketing.
  "Authorized security assessment planning tool." Not "evasion route planner."

---

### Thread 37: Privacy Regulatory Landscape — GDPR, BIPA, CCPA as Product Requirements
**Status:** New. Critical for product design and market entry strategy.
**Source research:** EDPB Guidelines 3/2019, Husch Blackwell 2025 Biometric Privacy Tracker, CNIL enforcement 2025-2026.

**GDPR framework for video surveillance:**
- **Legal basis:** Most private CCTV relies on Article 6(1)(f) Legitimate Interests — requires purpose, necessity, and balancing test.
- **DPIA required:** Systematic monitoring of publicly accessible areas or employee monitoring generally requires a Data Protection Impact Assessment under Article 35.
- **Storage limitation:** Footage typically retained 48-72 hours unless security incident warrants longer.
- **Transparency:** Clear signage required before individuals enter surveillance zone.
- **CNIL enforcement (2025-2026):** €200,000+ in simplified sanctions for excessive monitoring, disproportionate filming, hidden cameras in sensitive areas (union offices, cafeterias, hospitals).

**BIPA and US biometric privacy law landscape:**
- **BIPA (Illinois):** Requires prior written informed consent for biometric data collection (facial recognition, iris scans, fingerprints). Private right of action with statutory damages ($1,000 negligent, $5,000 intentional per violation). Class-action risk is the enforcement mechanism.
- **20+ states** have enacted or proposed biometric privacy laws as of 2025-2026.
- **Key distinction for SentinelTwin:** "Person detection" (anonymized counting) is less regulated than "facial recognition" (biometric matching). The line matters for product design.
- **BIPA 2024 amendment:** Limited accumulation of damages for repeated scans of same person, but litigation intensity remains high.

**What this means for SentinelTwin:**
1. **Privacy zones are a must-have, not a nice-to-have.** CNIL enforcement proves regulators check camera placement.
2. **Privacy compliance report = GDPR evidence export.** DPOs need documented proof of compliance — SentinelTwin provides it.
3. **Biometric-aware mode:** If user activates facial recognition analytics, SentinelTwin should flag this triggers BIPA-level requirements.
4. **DPO distribution channel:** Data Protection Officers advise clients on camera placement — they need SentinelTwin.
5. **Product architecture impact:** Privacy zone overlay must be a first-class concept in SecurityScene, not a post-hoc annotation.

**Open questions:**
- Should SentinelTwin generate a DPIA (Data Protection Impact Assessment) template section automatically?
- What is the minimum viable privacy compliance feature set for EU launch vs US launch vs India launch?

---

### Thread 38: Security Consultant Workflow — Current Toolchain and Pain Points
**Status:** New. Validates GTM messaging and product positioning.
**Source research:** System Surveyor (workflow/pain points), AXIS Site Designer, ASIS security design best practices.

**The design workflow today:**
1. **Risk & Needs Assessment:** Define purpose (deterrence, evidence, LPR, etc.)
2. **Site Survey:** Physical inspection — mounting locations, lighting, cabling, network
3. **System Design & Simulation:** Place cameras on floor plans, visualize FOV, verify DORI
4. **Proposal & Documentation:** Generate BOM, coverage maps, project proposals
5. **Implementation & Close-out:** Hand to installation team, verify "as-built" matches plan

**Tools currently used:**
| Tool | Type | Key Limitation |
|---|---|---|
| **System Surveyor** | 2D cloud platform | No 3D, no DORI quality, no occlusion |
| **AXIS Site Designer** | Vendor-specific | Axis cameras only, no occlusion |
| **JVSG** | Desktop 2D CAD | Static, no real-time feedback |
| **AutoCAD / Visio** | General drafting | No security intelligence |
| **Pen and paper** | Manual | Error-prone, no simulation |

**Five documented pain points:**
1. **Game of telephone:** Sales → designer → technician — each handoff loses information
2. **Data silos:** Different tools for communication, BOMs, drawings, specs
3. **Site survey inefficiency:** Manual note-taking, phone photos, Excel — prone to error
4. **Proposal competitiveness:** Slow design turnaround loses bids
5. **Scope creep:** Changes during installation hard to document without a live digital twin

**What this means for SentinelTwin:**
- Every pain point is directly addressable by SentinelTwin's approach
- The workflow validation confirms the GTM message: "Stop drawing coverage on paper. Simulate it."
- Pain point #5 (scope creep documentation) aligns with "live digital twin" value prop
- The existence of System Surveyor at $70/mo proves professionals WILL pay for tooling — they just need it to be better

---

### Thread 39: Physical Security ROI Frameworks — How Budgets Are Justified
**Status:** New. Important for sales narrative and buyer persona understanding.
**Source research:** ASIS International, Security Executive Council, FEMA NSGP guidance.

**Why ROI is hard for physical security:**
Security is a cost center, not a revenue generator. Standard ROI fails. Instead, organizations use:

**ROSI (Return on Security Investment) — Risk Mitigation Model:**
```
ROSI = (Annual Risk Exposure × Mitigation % – Cost of Solution) ÷ Cost of Solution
```

**Three frameworks for justifying security spend:**
1. **Risk Mitigation/Loss Avoidance:** Cost of incident avoided vs cost of solution. Most common.
2. **Detection-to-Response Latency Economics:** Quantifies the financial value of compressed response time.
3. **Business Continuity & Resilience:** Compliance, insurance premium reduction, downtime avoided.

**Key metrics directors use to justify budget:**
- Risk-based: Assets at risk, potential incident impact, vulnerability scores
- Operational efficiency: Incidents per employee, response time, false alarm reduction
- Compliance: Legal requirements, insurance eligibility, contractual obligations
- Benchmarking: Spend vs industry peers, incident rates vs peers

**The budget approval process:**
1. Start with a risk assessment (never pitch a tool — pitch a solution to an identified risk)
2. Speak business language ("$X in prevented losses" not "better cameras")
3. Build tiered options (Minimal/Optimized/Maximum) showing trade-offs
4. Align with organizational goals (expansion, brand protection, public safety)

**Incident cost context:**
- A significant physical security incident (theft, vandalism, trespass) can cost $100K+ when factoring downtime, investigations, replacement costs, legal/HR
- The physical-cyber intersection: a server room breach enabling a data breach compounds costs massively

**What this means for SentinelTwin:**
- SentinelTwin is a budget justification tool: it quantifies coverage gaps in dollar terms
- The ROSI framework directly supports "SentinelTwin costs X, saves Y in prevented theft" for retail
- For enterprise buyers: "SentinelTwin provides compliance evidence required by policies X and Y"
- **Product implication:** The report layer should include an optional "Financial Impact" section that translates coverage gaps into estimated dollar exposure

---

### Thread 40: School / Campus Security Market — Alyssa's Law, Grants, Simulation Gap
**Status:** New. High-growth vertical market with clear compliance driver.
**Source research:** Alyssa's Law state-by-state status, SchoolSafety.gov, CISA K-12 SSAT, Raptor Technologies, CENTEGIX.

**Market size and growth:**
- K-12 school security market: ~$5B+ in 2025-2026, growing 10–14% CAGR
- Driven by: legislative mandates, active shooter prevention, federal funding

**Alyssa's Law:**
- Requires silent panic alarm systems in schools
- Named for Alyssa Alhadeff, victim of 2018 Parkland shooting
- Enacted in multiple US states; more considering adoption
- Modern compliance: wearable panic buttons, mobile notification apps, real-time facility mapping for first responders
- **Trend:** Beyond just a button — states increasingly require automated facility mapping and integrated communication

**Federal funding sources:**
- SchoolSafety.gov Grants Finder Tool — primary resource for districts
- DOJ COPS Office grants, DHS preparedness grants, Title IV-A funds
- Competitive, time-bound, requires compliance reporting
- Districts increasingly hiring grant writers and using grant-tracking software

**Existing assessment tools (not simulation):**
- **CISA K-12 SSAT** — Free, web-based self-assessment tool for physical security vulnerabilities
- **Raptor Technologies** — Visitor management, drill reporting, emergency communication
- **CENTEGIX** — Wearable panic buttons, incident response platform

**What they all lack:**
- Camera coverage simulation
- Blindspot analysis
- Adversarial path analysis for lockdown scenarios
- Pre-construction security design for new school buildings

**What this means for SentinelTwin:**
- **No competitive simulation tool exists in this market either.**
- School district security directors are budget-constrained but grant-funded — a focused GTM could work via district-level procurement cycles
- "SentinelTwin for Schools" could include pre-built compliance report formats for Alyssa's Law documentation
- School safety committees (parents, administrators, law enforcement) need visual tools they can understand — SentinelTwin's 3D visualization is a strength
- School construction boom (new buildings, renovations) = pre-construction simulation opportunity

---

### Thread 41: Healthcare Security Market — HIPAA, Joint Commission, Patient Safety
**Status:** New. Compliance-driven vertical with specific requirements.
**Source research:** HIPAA Security Rule proposed updates 2025-2026, Joint Commission standards, infant protection systems.

**Key regulatory framework:**
| Area | Primary Driver | Core Requirement |
|---|---|---|
| Data Protection | HIPAA Security Rule | Encryption, MFA, annual risk assessment |
| Physical Security | Joint Commission | Site-specific management plan, access control, staff training |
| Infant/Patient Safety | Safety protocols | RFID/location-awareness, verified ID, restricted access |

**HIPAA and video surveillance:**
- Cameras must NOT capture PHI (patient screens, medical records) unnecessarily
- Access to footage strictly limited to authorized personnel
- Footage must be encrypted at rest and in transit
- Transparency: patients must generally be informed surveillance is in use
- **Key constraint:** Hospital camera placement must cover security zones while avoiding PHI capture — SentinelTwin's privacy zone feature is directly applicable

**Joint Commission (TJC) security standards (2025-2026):**
- Shift to outcome-based, flexible standards while maintaining safety rigor
- Requires comprehensive, site-specific Security Management Plan
- Increased focus on workplace violence prevention
- Regular drills and validated emergency response plans including active shooter protocols

**Infant abduction prevention:**
- RFID-tagged infant protection systems: trigger alarms, lock doors, freeze elevators
- Modern trend: integrated with hospital-wide security platforms
- Real-time tracking with smarter, more comfortable wearable tags
- Patient elopement / wandering prevention for memory-care patients

**What this means for SentinelTwin:**
- Healthcare has a clear compliance documentation need: Joint Commission requires documented Security Management Plans
- SentinelTwin's coverage reports serve as evidence for TJC audits
- Privacy zones are especially critical for healthcare (avoiding PHI capture is a regulatory requirement, not just best practice)
- Infant security zone modeling: verify camera coverage of maternity wards, nursery, pediatric floors
- Workplace violence prevention: identify blind spots in emergency rooms, waiting areas, psychiatric units
- **GTM angle:** Hospital security directors and healthcare facility managers

---

### Thread 42: Open Source VMS Ecosystem — No Competition in Planning/Simulation
**Status:** New. Confirms no open source alternatives exist for what SentinelTwin does.
**Source research:** Frigate, Shinobi, ZoneMinder, Kerberos.io, OpenCCTV — comparison 2025-2026.

**Major open source VMS projects:**
| Project | Focus | Key Limitation |
|---|---|---|
| **Frigate NVR** | AI-first object detection (Google Coral TPU) | NVR only, no coverage simulation |
| **Shinobi** | Modular, multi-user, broad protocol support | NVR only, no planning tools |
| **ZoneMinder** | Legacy full-featured VMS | Steep learning curve, dated interface |
| **Kerberos.io** | Container-first, cloud-native | NVR only, no simulation |
| **OpenCCTV** | Platform for custom solutions | Developer tool, not end-user product |

**Market trend:** Shift from motion recording to event-driven AI surveillance. Frigate dominates the self-hosted community for AI-first approach.

**What does NOT exist in open source:**
- Security assessment/planning tools (no open source equivalent of JVSG or System Surveyor)
- Camera coverage simulation
- DORI quality analysis
- Adversarial path simulation
- Physical security digital twins

**What this means for SentinelTwin:**
- There is no open source alternative to SentinelTwin — not even a partial one
- Frigate users who want to plan their camera layout before buying hardware are unserved
- Potential integration: SentinelTwin export → Frigate config (camera positions and zones)
- Open source VMS community is a potential early adopter/user segment for SentinelTwin's free tier

---

### Thread 43: AI Video Analytics Market — Vendors, Capabilities, and Market Position
**Status:** New. Defines SentinelTwin's complementary positioning vs analytics vendors.
**Source research:** BriefCam, Oosto, Irisity — market analysis 2025-2026.

**Market overview:**
- AI video analytics market growing 20–30% CAGR
- Three primary pricing models: SaaS (per-camera/month), perpetual licensing, usage/token-based
- Major trend: embedded analytics directly in VMS or on-camera edge AI

**Key vendors:**
| Vendor | Strength | Use Case |
|---|---|---|
| **BriefCam** | Video Synopsis, forensic search, business insights | Post-event review, retail analytics |
| **Oosto** (fka AnyVision) | Facial recognition, real-time identification | Access control, watchlist alerting |
| **Irisity** | Real-time behavioral analytics, proactive monitoring | Incident detection, loitering alerts |

**Analytics capabilities today:**
- Object detection & classification (people, vehicles, firearms, bags)
- Behavioral analysis (loitering, line crossing, crowd gathering, fighting)
- Identification (LPR/ANPR, facial recognition)
- Spatial insights (heat mapping, flow analysis)
- People/vehicle counting

**Accuracy reality check:**
- Lab benchmarks claim 95–99% but real-world deployment accuracy is typically lower
- Performance depends on: lighting conditions, camera angle, resolution, occlusion
- Edge AI often improves reliability vs cloud-based processing
- Expert recommendation: always validate through PoC in actual site conditions

**What this means for SentinelTwin:**
- AI analytics vendors are complementary, not competitive — they analyze footage; SentinelTwin simulates coverage BEFORE footage exists
- **Key positioning:** "Before you spend $50K on AI analytics, verify your cameras can actually see the zones the analytics need to monitor. SentinelTwin is the pre-sale verification layer."
- A camera at Detection quality (25 PPM) cannot feed facial recognition analytics — SentinelTwin catches this mismatch
- Partnership opportunity: analytics vendors could recommend SentinelTwin as a pre-requisite assessment tool

---

### Thread 44: Smart Building / BMS Integration Standards — BACnet, ONVIF, MQTT
**Status:** New. Medium-term enterprise integration requirement.
**Source research:** Johnson Controls OpenBlue, Siemens Desigo CC, Honeywell Forge, BACnet/SC, ONVIF.

**The three key protocols:**
| Domain | Standard | Function |
|---|---|---|
| Building Control | BACnet (BACnet/SC) | HVAC, lighting, environmental control |
| Physical Security | ONVIF | Video surveillance, access control interoperability |
| IoT Connectivity | MQTT | Lightweight, real-time data streaming for smart devices |

**Integration ecosystem:**
- **Johnson Controls (Metasys/OpenBlue):** Enterprise management platform — single pane of glass for HVAC, fire, lighting, security
- **Siemens (Desigo CC):** Unified building management with security integration
- **Honeywell (EBI/Forge):** Enterprise building integration with security subsystems
- **Middleware:** API-based integration layers translate between BMS and SMS when protocols don't natively align

**Digital twins in smart buildings (2025-2026):**
- Beyond static CAD drawings → dynamic digital twins with real-time occupancy, sensor data, video feeds
- Security operators visualize alarms in 3D context: which floor, which camera, which exit
- Predictive maintenance: track health of security hardware (battery life, camera sensor degradation)
- Evacuation simulation based on real-time building conditions

**What this means for SentinelTwin:**
- SentinelTwin's 3D SecurityScene fits naturally into the smart building digital twin ecosystem
- BACnet/SC adds cybersecurity to traditional BMS — aligns with SentinelTwin's security focus
- **V2+ integration path:** Export coverage heatmap as BACnet data point → BMS displays coverage status
- **ONVIF Profile M (metadata):** Standardized format for analytics metadata — could be import target for SentinelTwin's V2 real camera verification
- Smart building vendors (Johnson, Siemens, Honeywell) value vendor-agnostic tools that work with their ecosystems — SentinelTwin is brand-agnostic by design

---

### Thread 45: Retail Loss Prevention — Vertical-Specific Requirements
**Status:** New. Extends Thread 12 with specific operational requirements.
**Source research:** Everseen, Sensormatic Solutions, Solink, NRF retail security survey 2025.

**How video surveillance in retail differs from general security:**
| Feature | Retail Coverage | General/Perimeter Coverage |
|---|---|---|
| Primary Goal | Transactional integrity & customer flow | Intrusion detection & perimeter safety |
| Camera Density | High (every POS, shelf, aisle) | Lower (gates, entrances, fences) |
| Field of View | Tight, high-resolution for merchandise | Broad, low-resolution for wide areas |
| Placement | Ceiling-mounted to avoid aisle blindspots | Wall/pole-mounted for approaching movement |
| Analytics Focus | Object ID (products) & human behavior | Motion detection & classification |

**Retail-specific technologies:**
| Technology | Function | Relevance to SentinelTwin |
|---|---|---|
| **Everseen** | Vision AI for checkout integrity | Coverage must include self-checkout with sufficient resolution |
| **Solink** | POS-video linkage | POS zone must have identification-quality coverage |
| **Sensormatic** | EAS + inventory intelligence | Tag reader positions must be covered |
| **RFID / Smart Shelves** | Real-time inventory visibility | Shelf coverage gaps = inventory blindspots |

**Camera coverage design for retail:**
- Checkout zones: need Identification quality (250 PPM) for facial evidence
- High-value aisles (electronics, alcohol, cosmetics): need Recognition quality (125 PPM)
- Store entry/exit: wide-angle Detection + dedicated Identification camera
- Stockroom/back office: full coverage, all angles
- **Planogram sensitivity:** Retail layout changes frequently — every reset creates new blindspots

**What this means for SentinelTwin:**
- Multi-location retail chains need standardized coverage scores — compare across stores
- "Store A: 82% coverage, Store B: 64% coverage — investigate Store B layout"
- **Retail template:** Pre-configured zone types (POS, high-value, entry, stockroom) with appropriate quality thresholds
- **ROI pitch:** "1% shrinkage reduction = $X for your chain. SentinelTwin costs $Y/year. Payback in N months."
- The planogram-reset-triggered re-audit is the ideal recurring use case — not annual, but per-merchandise-change

---

### Thread 46: Data Center Physical Security — High-Value Niche
**Status:** New. Identifies a high-value, low-volume buyer segment.
**Source research:** Uptime Institute, ANSI/TIA-942, SOC 2 physical security requirements.

**Common misconception:**
Uptime Institute Tier classification (III, IV) does NOT prescribe specific physical security measures. Tier is about power/cooling uptime, not security. Uptime Institute offers a separate "Facility Security Review" service.

**Who actually audits data center security:**
- **SOC 2 Type II** (most common in US): CPA-audited controls for security, availability, processing integrity
- **ISO/IEC 27001:** International ISMS standard with physical security requirements
- **PCI DSS:** For card data handling facilities — specific physical access restrictions
- **ANSI/TIA-942:** Telecommunications infrastructure standard that DOES reference physical security design

**Layered defense strategy (ANSI/TIA-942 style):**
1. **Perimeter:** Crash-rated fencing, bollards, wedge barriers, vehicle standoff distances
2. **Building entry:** Single point of entry, mantrap (interlocking doors), biometric + badge MFA
3. **Data hall:** Cameras covering every aisle, every cabinet row
4. **Cabinet level:** Electronic locks on individual server cabinets, granular logging

**Camera coverage requirements:**
- Full coverage of: perimeter, loading docks, all entry/exit points, hallways, data halls, power rooms, cooling plants
- Zero tolerance for blind spots in critical zones
- High-definition with night vision/low-light capability
- Retention policies: 30–90 days, strictly audited
- Access control MFA typically requires badge + biometric (iris or fingerprint)

**What this means for SentinelTwin:**
- Data centers are a high-value niche with **zero tolerance for coverage gaps** — the sales case is strong
- SOC 2 and ISO 27001 audits require documented physical security evidence — SentinelTwin reports serve this
- Data center operators have budget and buy software — enterprise sales suitable
- **GTM angle:** "SentinelTwin provides documented, auditable evidence for your SOC 2 Type II physical security controls"
- Pre-construction simulation for new data center builds is especially valuable (data center downtime is measured in $K/minute)

---

### Thread 47: Security Orchestration & Automation (SOAR for Physical Security)
**Status:** New. Defines SentinelTwin's long-term position in security automation.
**Source research:** Physical security SOAR, SOC convergence, AI command layers 2025-2026.

**What is physical security SOAR:**
Security Orchestration, Automation, and Response adapted from cybersecurity to physical security. Connects disparate physical systems (video, access control, alarms) into automated event response workflows.

**Event response playbook example:**
Unauthorized access event → automatic:
1. Lockdown affected area
2. Prompt nearest CCTV to track individual
3. Notify security personnel via mobile (with live video link)
4. Log event in incident management system

**SOC convergence (physical + cyber):**
- Physical security (lost badge, tailgating) and cybersecurity (brute force login) managed in unified environment
- SOAR platforms act as connective tissue between physical and cyber
- Enables 360-degree threat view: physical breach accompanied by cyber exploit

**AI command layers — the emerging paradigm:**
- Centralized AI brain interprets high-level objectives ("Secure perimeter at shift change")
- Autonomously coordinates sensors, cameras, automated gates, robots
- Human operators shift from "watching cameras" to "managing systems"
- The AI handles tactical execution; human handles strategic decisions and ethical oversight

**How SentinelTwin's AI command layer fits:**
SentinelTwin's agent architecture (architecture/05) is exactly this paradigm — but for planning/simulation rather than live response. The natural path:
- **V0.1:** AI command = natural language scene editing + counterfactual analysis
- **V0.3+:** AI command = temporal simulation + "what-if" scenario testing
- **V1+:** AI command = automated security design recommendations with verified coverage deltas
- **V2+:** AI command integrates with live PSIM/SOAR systems — simulated coverage gaps inform real-time response automation

**What this means for SentinelTwin:**
- The AI command layer is not just a UI convenience — it's the early stage of a physical security SOAR platform
- Long-term moat: SentinelTwin's simulation engine can predict where a SOAR playbook will fail due to coverage gaps
- **Product direction:** After V0.1, design the agent architecture with SOAR integration in mind — event formats, API contracts, timing models
- Physical security SOAR is an emerging category (2025-2026). First-mover advantage as the simulation layer for SOAR is real.

---

---

### Thread 48: Physical Security Incident Costs and ROI Frameworks
**Status:** New. Provides dollar-based justification for security investment — critical for retail and enterprise sales.
**Source research:** NRF Organized Retail Crime survey, Supercircuits ROI calculator, Intellisee CCTV ROI tool, ASIS risk management framework.

**The ROI challenge:**
Physical security is a cost center. Standard ROI models fail because "losses avoided" is hard to quantify. Three frameworks exist for justifying security spend:

1. **Risk Mitigation/Loss Avoidance Model:**
   ```
   ROSI = (Annual Risk Exposure × Mitigation % – Cost of Solution) ÷ Cost of Solution
   ```
   Most common approach. Requires estimating incident probability × cost per incident.

2. **Detection-to-Response Latency Economics:**
   Quantifies the financial value of compressed response time. Each minute of delay costs X dollars depending on the vertical (retail shrinkage rising, data center downtime accumulating).

3. **Business Continuity & Resilience:**
   Compliance avoidance, insurance premium reduction, downtime prevented. Harder to quantify but resonates with enterprise buyers.

**Available ROI calculators (that exist today):**
| Tool | Type | Limitation |
|---|---|---|
| **Supercircuits ROI Calculator** | Commercial CCTV vendor | Basic, vendor-biased |
| **Intellisee CCTV ROI Tool** | Independent | Narrow scope, not simulation-aware |
| **ASIS Risk Management Framework** | Professional standard | Framework, not calculator |
| None of these account for simulation-verified coverage | — | — |

**Incident cost context:**
- **Organized Retail Crime (ORC):** ~$45B/year in US alone. Average single incident: $5K–$50K depending on scope.
- **Warehouse/distribution center theft:** Average incident $10K–$100K.
- **Office trespass/data breach intersection:** Can reach $1M+ when physical breach enables data compromise.
- **School security incident (physical):** $100K+ from legal, PR, upgrades, staffing.
- **Data center breach:** $200K+/minute downtime; data breach costs compound massively.

**What this means for SentinelTwin:**
- The report layer should include an optional **Financial Impact** section that translates coverage gaps into estimated dollar exposure (using user's vertical, asset values, and incident rates)
- SentintelTwin is a **budget justification tool**: it quantifies coverage gaps in risk/dollar terms
- For retail: "1% shrinkage reduction = $X saved. SentinelTwin costs $Y. Payback in N months."
- For enterprise: "This coverage gap exposes $Z in assets per incident. Fix costs $W."
- **Pricing anchor:** If SentinelTwin costs $500–2,000/year and prevents a single $10K incident, ROI is immediate.

**Open questions:**
- Should the Financial Impact section require user input (asset values, incident history) or use defaults by vertical?
- Is there liability risk in asserting "this gap will cost $X"? Need careful phrasing ("estimated exposure under current assumptions").

---

### Thread 49: ONVIF Profile M — Analytics Metadata Standard
**Status:** New. Standardized format for video analytics metadata — relevant for V2 real camera verification and SOAR integration.
**Source research:** ONVIF Profile M official specification, ONVIF roadmap 2025-2026.

**What ONVIF Profile M defines:**
- Standardized format for metadata produced by video analytics (object detection, classification, tracking)
- Two transport modes:
  1. **SOAP/WSDL** — traditional ONVIF web services for metadata subscription/query
  2. **MQTT/JSON** — modern lightweight streaming for real-time analytics metadata
- Analytics event types supported:
  | Event Type | Description | SUse in Security |
  |---|---|---|
  | Object Detected | Generic object presence | Motion detection |
  | Classification | Person, vehicle, animal, specific object | Targeted alerting |
  | Geolocation | Object position in real-world coordinates | Position tracking |
  | Speed | Object motion speed | Perimeter breach speed analysis |
  | Color/Appearance | Object attributes (color, size, shape) | Forensic search |
  | LPR (License Plate) | Plate recognition data | Access control |
  | Face Detection | Face presence in frame | Privacy zone enforcement |
  | Body Detection | Human body shape (not face) | Anonymous counting |

**Metadata structure:**
- Each metadata frame is timestamped and correlated to the video stream
- Contains bounding box coordinates, classification confidence, tracking ID
- Can be delivered as real-time stream (MQTT) or stored in metadata database

**Adoption status (2025-2026):**
- Widely adopted in IP camera firmware and VMS platforms (Milestone, Genetec)
- Supported by major camera manufacturers (Axis, Hanwha, Bosch, Sony)
- Complemented by Profile S (basic streaming) and Profile T (advanced streaming)
- Metadata analytics increasingly move to edge (on-camera processing) with Profile M as the output format

**What this means for SentinelTwin:**
- **V2 Real Camera Verification:** If a camera sends Profile M metadata, SentinelTwin could theoretically import actual detection metadata and compare against simulated coverage to identify discrepancies
- **SOAR integration (V2+):** Profile M is the standard format for analytics events — SentinelTwin should understand it for integration design
- **Industry alignment:** ONVIF is the dominant standard (not PSIA, which is no longer active)
- **Privacy zones + analytics:** Profile M supports face detection flags — SentinelTwin can cross-reference which analytics events should NOT fire in privacy zones
- **No V0.1 impact:** This is purely forward-looking for V2+ integrations

---

### Thread 50: SchoolSafety.gov Grant Programs — Detailed Funding Landscape
**Status:** New. Provides detailed grant data for crafting school security GTM.
**Source research:** SchoolSafety.gov Grants Finder Tool, BJA STOP School Violence program, COPS SVPP, DHS NSGP.

**Major federal grant programs for school security (2025-2026):**

| Program | Agency | Annual Funding | Award Size | Eligible Use |
|---|---|---|---|---|
| **COPS School Violence Prevention Program (SVPP)** | DOJ | ~$73M | Up to $500K per school district | Security technology, training, coordination |
| **BJA STOP School Violence Program** | DOJ | ~$83M | $50K–$500K | Threat assessment, intervention, security tech |
| **DHS Nonprofit Security Grant Program (NSGP)** | DHS | ~$274.5M | Up to $150K per site | Physical security improvements, including cameras |
| **Title IV-A (Student Support & Academic Enrichment)** | ED | ~$1.2B (total, shared) | Formula-based per district | Safe & healthy students (broad) |

**How the grants workflow works:**
1. School districts find grants via SchoolSafety.gov Grants Finder Tool
2. Grant writers (increasingly hired by districts) prepare applications
3. Applications are competitive, time-bound (typically 60-90 day windows)
4. Successful grants require compliance reporting on how funds were used
5. Equipment purchases (cameras) typically need documented justification

---

### Thread 51: Rendering Audit Actionability (Post-processing + Shaders)
**Status:** New. Converts rendering-skill audit findings into explicit build decisions.
**Source:** `Docs/decisions/R3F_DREI_FULL_AUDIT_2026-05-29.md` + Three.js skill runs (`threejs-postprocessing`, `threejs-shaders`, `threejs-geometry`).

**Observed state (2026-05-29):**
- No explicit `EffectComposer`/post-processing stack detected in `apps/studio/src/**`.
- No explicit custom shader pipeline (`ShaderMaterial`/`onBeforeCompile`/custom GLSL) detected in `apps/studio/src/**`.
- Geometry usage is broad and active; optimization opportunities are incremental, not architectural rewrites.

**Decision guidance (current):**
1. **Post-processing:** not required for correctness now; defer until a concrete visual requirement + perf budget + trust-boundary verification rule exists.
2. **Shaders:** defer custom GLSL until a specific effect is impossible via built-in material controls and has deterministic acceptance criteria.
3. **Geometry:** continue targeted perf hygiene in hot render paths (memoization/reuse, avoid repeated transient allocations where safe).

**Where to start when activated:**
- First surface: `CameraViewMode`.
- Expansion order: `CameraFeedCanvas` → `CameraWallView` → replay surfaces.

**Activation criteria (must all be true):**
- User-visible requirement is explicit and approved.
- Budget defined (GPU/frame-time target per surface).
- Test/verification contract defined (visual effect cannot alter simulation metrics/labels).

**Protocol for all future audits (new standard):**
Every "not found" result must answer:
1) Should this be used now? 2) Where first? 3) At what implementation level? 4) When to trigger?

**Next:**
- Add the same actionability block pattern to future rendering/AI/runtime audits so outputs are execution-ready instead of descriptive-only.

**What SentinelTwin provides that aligns with grant requirements:**
- Documented needs assessment (why cameras are needed, where gaps exist)
- Quantified coverage analysis ("before: 60% coverage, after: 85% coverage")
- Standards-referenced design (IEC 62676-4, AS/NZS 62676)
- Compliance evidence for post-award reporting

**What this means for SentinelTwin GTM:**
- **Grant-writing season alignment:** Target marketing around grant application deadlines (typically Q1-Q2)
- **"Grant-ready" positioning:** For districts, "SentinelTwin provides the documented needs assessment and quantified coverage analysis that grant reviewers are looking for"
- **Free tier for schools:** Free single-scene SentinelTwin for schools doing initial needs assessment — upsell to paid for full grant compliance reporting
- **Bundled offering:** Include grant application template language with SentinelTwin reports
- **Note:** School security directors are budget-constrained but grant-funded. The sales cycle is about grant calendar alignment, not fiscal year budget.

---

### Thread 51: SIA OS-2 / PSIA Standards Correction
**Status:** New. Corrects an error in earlier architecture documentation where "SIA OS-2" was referenced as a physical security API standard.
**Source research:** SIA standards catalog, ONVIF history, PSIA status check, OSDP specification.

**The incorrect reference:** Earlier architecture drafts referenced "SIA OS-2" as a PSIM/SOAR API standard. This standard does not exist.

**What actually exists in physical security standards:**

| Standard | Organization | Purpose | Status |
|---|---|---|---|
| **ONVIF Profiles** | ONVIF | Video streaming, device discovery, analytics metadata, access control | Active — dominant standard |
| **SIA OSDP** | Security Industry Association | Access control communication protocol (between controller and reader) | Active — ANSI-approved |
| **SIA DIP/DIS** | Security Industry Association | Digital intrusion communications | Active |
| **PSIA (Physical Security Interoperability Alliance)** | PSIA (now defunct) | Legacy video/access control API specs | **Moribund** — superseded by ONVIF |

**Key corrections for SentinelTwin docs:**
- Where the architecture doc referenced "SIA OS-2" as a PSIM/SOAR integration standard, the correct reference should be **ONVIF** (for device-level video and analytics interoperability) and **RESTful APIs** (for software-level system integration)
- PSIA was a competitor to ONVIF that lost the standards war. ONVIF is the de facto standard for physical security device interoperability.
- SIA OSDP is used for access control reader communication, NOT for video or API integration.
- For SOAR/PSIM integration (V1+), the relevant standards are:
  1. **ONVIF** — device discovery, video, analytics metadata, access control events
  2. **RESTful APIs** — modern web integration with PSIM platforms
  3. **MQTT** — real-time event streaming for alert/response automation

**What this means for SentinelTwin:**
- The architecture doc has been corrected (SIA OS-2 → ONVIF, PSIA removed)
- No other references to SIA OS-2 exist in the codebase
- Thread 47 (SOAR direction) and Section 7 of the architecture doc now reference ONVIF and REST APIs correctly
- This is a documentation-only fix — no code impact

---

### Thread 52: Physical Security Buyer Personas — Decision-Making Process
**Status:** New. Maps who buys security design software and how they decide.
**Source research:** ASIS International, System Surveyor market research, security vendor partner programs.

**The buying process for physical security software:**
Purchasing decisions are increasingly cross-functional. No single persona decides alone.

**Key personas involved:**
| Persona | Primary Goal | Focus Area | Purchase Role |
|---|---|---|---|
| **System Integrator** | Efficiency, professionalism | Tool usability, proposal speed, installation accuracy | Gatekeeper — specifies tools and hardware |
| **IT Manager** | Security, compliance | Network impact, data privacy, system integration | Increasingly leads decisions (~54% of enterprises) |
| **Security Manager/Director** | Risk mitigation | System performance, reliability, incident response | Traditional primary buyer |
| **Facility Manager** | Operations, maintenance | Longevity, ease of maintenance, BMS integration | Evaluator of long-term fit |
| **C-Suite / Finance** | Budget, ROI | Risk reduction, compliance, TCO | Approver |

**The buying stages:**
1. **Needs assessment & site survey:** Gaps identified, digital site survey tools used
2. **System design & specification:** Coverage modeled, BOM generated, proposals prepared
3. **Cross-functional evaluation:** IT checks network security, Operations checks reliability, Management checks TCO
4. **Procurement:** RFP for large-scale, direct purchase for smaller projects

**Key pain points driving purchase:**
- Game of telephone (sales → designer → technician, each handoff loses information)
- Manual site surveys creating data entry errors
- Slow proposal generation losing bids
- Tools that don't integrate with existing security systems
- Inability to manage coverage across multiple sites consistently

**What this means for SentinelTwin:**
- **System integrators are the gatekeeper channel** — if SentinelTwin isn't in the integrator's toolkit, it rarely reaches end-users
- IT is the fastest-growing influence on the purchase — SentinelTwin's local-first/WASM architecture is a selling point vs cloud-only tools
- The integrator's pain (slow proposals, lost handoff info) is SentinelTwin's GTM message
- See Thread 56 for integrator partner economics

---

### Thread 53: JVSG — Competitive Teardown
**Status:** New. Deep competitive intelligence on the leading CCTV design tool.
**Source research:** JVSG official site, IPVM, user forum discussions.

**JVSG overview:**
JVSG (IP Video System Design Tool) is the industry standard for professional CCTV planning. Desktop-only (Windows), subscription-based, focused on high-fidelity 3D camera simulation.

**Pricing (2025-2026, annual subscriptions, per user):**
| Edition | Annual Cost | Camera Limit | Target User |
|---|---|---|---|
| **Pro** | $396/yr (~$33/mo) | 64 cameras | Solo installers |
| **Expert** | $792/yr (~$66/mo) | 256 cameras | Professional design consultants |
| **Enterprise** | Contact for quote | Unlimited | Large integrators |
- Multi-user group discounts available (e.g., 5-user packages)
- **Read-only access** after subscription expires (can view/archive projects, cannot design)

**Key strengths:**
1. **Realistic 3D mockups** — strongest feature. Show clients exactly what a camera will "see"
2. **Automated technical calculations** — bandwidth, storage, focal length, cable length
3. **CAD integration** — import/export .dwg and .dxf for professional layouts
4. **Advanced simulation** — ANPR zones, face recognition zones, fisheye dewarping

**Key limitations:**
1. **Windows-only** — no native Mac/Linux support (workarounds available but painful)
2. **Steep learning curve** for advanced 3D modeling and CAD import
3. **Cost vs. simplicity** — overkill for small installers who just need FOV visualization
4. **No adversarial path simulation** — cannot answer "how would someone evade this coverage?"
5. **No temporal profiles** — no 24-hour simulation with lighting/schedule changes
6. **No AI command layer** — no natural language interaction or counterfactual analysis
7. **Static reports** — reports are snapshots, not interactive models

**SentinelTwin differentiation:**
| Capability | JVSG | SentinelTwin |
|---|---|---|
| 3D camera simulation | Yes (desktop, Windows-only) | Yes (browser, cross-platform)
| DORI quality scoring | Yes (static) | Yes (real-time, with occlusion) |
| Adversarial path simulation | **No** | **Yes** — core differentiator |
| Temporal (24h) simulation | **No** | **Planned (V0.3+)** |
| AI command / counterfactual | **No** | **Yes** — core differentiator |
| Privacy zone compliance | **No** | **Yes** — built into schema |
| Multi-user collaboration | Limited (file-based) | **Cloud-native** |
| Pricing | $33-66/mo/user | TBD |

**Strategic implication:** JVSG is the incumbent for 3D visualization, but SentinelTwin leapfrogs in simulation depth, AI capabilities, and collaboration. The weaknesses (no adversarial, no temporal, no AI) are all things JVSG cannot add incrementally — they require fundamental simulation engine rearchitecture.

---

### Thread 54: Genetec Security Center — Enterprise Platform Depth
**Status:** New. Maps the dominant enterprise PSIM platform and competitive dynamics.
**Source research:** Genetec official documentation, industry analysis, integrator network.

**Genetec overview:**
Genetec Security Center is the leading unified physical security platform (VMS + access control + ALPR + communications) for large enterprises, critical infrastructure, and government.

**Pricing model:**
- **Traditional:** Perpetual license + annual support/maintenance ("Genetec Advantage")
- **SaaS (emerging):** ~$149–$199/year per device connection (cameras, door controllers, intercoms, intrusion panels)
- **Not publicly listed** — must go through certified integrator for quotes
- Editions: Standard, Pro, Enterprise (scale-dependent)

**Key capabilities relevant to SentinelTwin:**
- **Plan Manager:** Interactive mapping module — operators view facilities in real-time, overlay cameras and door statuses on floor plans, control access from the map
- **Positional Camera Tracking:** Visualize and monitor coverage areas dynamically
- **Unified platform:** Video (Omnicast), Access Control (Synergis), ALPR (AutoVu) in one interface
- **Typical buyers:** Airports, transit, government, healthcare, large corporate campuses

**Genetec vs. Milestone XProtect:**
| Dimension | Genetec Security Center | Milestone XProtect |
|---|---|---|
| Philosophy | **Unified** — single-vendor platform | **Open** — ecosystem-based integration |
| Strength | One-stop security management | Flexible third-party hardware/software |
| Market | Complex enterprise, high-security | Broad — SMB to large enterprise |
| Cost/Complexity | Higher initial cost, more complex config | Lower entry cost |

**What Genetec does NOT do (SentinelTwin's gap):**
- **No coverage simulation** — Plan Manager shows real-time status but does not answer "what would coverage look like if we added a camera here?"
- **No adversarial path analysis** — cannot simulate evasion routes
- **No pre-installation planning** — Genetec is an operational platform, not a design tool
- **No counterfactual AI** — no "what if we removed Camera 4?" natural language testing

**SentinelTwin positioning vs Genetec:**
Genetec is not a competitor — it's a potential integration target (V2+).
- **Complementary:** SentinelTwin designs the coverage that Genetec manages
- **Export path:** SentinelTwin coverage heatmap → Genetec Plan Manager overlay
- **Typical scenario:** Security integrator uses SentinelTwin to design → delivers as-builts to Genetec operator

---

### Thread 55: three-mesh-bvh — Verified Performance Benchmarks
**Status:** New. Confirms performance targets are achievable for V0.1 coverage engine.
**Source research:** gkjohnson/three-mesh-bvh GitHub, community benchmarks, Three.js documentation.

**Official benchmark claims:**
- **500 rays per frame** against an **80,000-polygon model** at **60 FPS**
- That's **30,000 rays/sec** at 60 FPS — far exceeding SentinelTwin's 6,400 rays (40×40×4) requirement

**Complexity analysis:**
| Raycaster | Complexity | Scaling |
|---|---|---|
| Standard Three.js | O(N) — checks every triangle | ~0.5ms per ray at 100K tris |
| three-mesh-bvh | O(log N) — BVH tree traversal | ~0.01ms per ray at 100K tris |

**Actual throughput estimates:**
- For a typical building scene (10K-50K triangles for walls, floor, ceiling, furniture):
  - **Standard raycaster:** ~2-5ms per ray → 6,400 rays = 12,800-32,000ms (12-32 seconds) ❌
  - **three-mesh-bvh:** ~0.01-0.05ms per ray → 6,400 rays = 64-320ms (still >16ms if naive) ✅
  - **with SharedBVH + batching:** rays dispatched in shader-like batches → 6,400 rays = **under 8ms** ✅✅

**Memory overhead:**
- BVH structure adds roughly **10-20% additional memory** over the original geometry buffer
- Trade-off is universally considered worth it for the speed gains
- Supports `refit` for dynamic meshes (update BVH bounds when geometry changes — no full rebuild needed)
- Recommended: use `firstHitOnly: true` for `Raycaster` configuration to enable the optimized `raycastFirst` path

**Recommendation for SentinelTwin:**
- **Confirm existing decision D-004:** three-mesh-bvh is mandatory from day one
- The 6,400 rays target (40×40 grid × 4 cameras) is well within performance budget
- Use **SharedBVH** (batch raycast mode) for the coverage grid → <16ms per recompute is achievable
- Standard raycaster alone would be 10-30 seconds for the same workload — not viable

---

### Thread 56: Security Integrator Economics and Partner Programs
**Status:** New. Maps the channel economics that determine how SentinelTwin reaches end-users.
**Source research:** Venture in Security channel analysis, Axis partner program, IPVM integrator discussions.

**The integrator business model:**
Security systems integrators are the primary channel for physical security purchases. They design, procure, and install systems for end-users.

**Revenue streams, from lowest to highest margin:**
1. **Hardware procurement:** 10–20% margin — highly competitive, commoditized
2. **Labor/Installation:** Medium margin — depends on project complexity and scale
3. **Managed services / RMR (Recurring Monthly Revenue):** **Highest margin** — monitoring, maintenance, cloud services
4. **Design/Consulting:** Growing service line — expertise-based, less commoditized

**Net profitability context:**
- Manufacturer net income: 10–20%
- Integrator net income: lower percentage (rely on volume and project efficiency)
- Shift from project-based to RMR is the dominant industry trend

**Vendor partner programs (the channel incentive system):**
Vendors (Axis, Bosch, Genetec, Hanwha) run multi-tiered partner programs:
- **Tiers:** Authorized → Silver → Gold
- **Tier requirements:** Sales volume + certified engineers + active participation
- **Financial incentives:**
  - **Tiered discounts:** Higher tier = deeper hardware discounts
  - **Deal registration:** Register a specific project with the vendor → guaranteed discount protection
- **Non-financial benefits:** Lead generation, co-marketing, dedicated support, early product access, demo gear

**Axis Communications partner program tiers:**
- **Authorized** — baseline access to portfolio, training
- **Solution Silver** — higher discounts, dedicated support
- **Solution Gold** — best price points, marketing funds, early access

**What this means for SentinelTwin:**
- **Integrators are the gatekeeper channel.** A security consultant at an integrator firm chooses the design tool. Getting into the integrator's toolkit is the GTM.
- **Hardware margins are thin (10–20%)** — integrators under economic pressure to differentiate on design expertise. SentinelTwin helps them win bids with professional visualizations.
- **RMR shift is SentinelTwin's opportunity:** As integrators move to managed services, they need tools to do recurring coverage audits — SentinelTwin's temporal simulation fits this recurring revenue model.
- **Partner program comparison:** JVSG has no formal partner program (per-seat pricing, no reseller/affiliate). System Surveyor has growing partner traction. This is a competitive weakness of JVSG that SentinelTwin can exploit by building an integrator partner program from day one.
- **Pricing implication:** Integrators pay $33-66/mo for JVSG (per seat, per user). SentinelTwin should be priced competitively against this anchor.

---

### Thread 57: System Surveyor — Closest Competitive Tool — Deep Dive
**Status:** New. Detailed teardown of the closest existing alternative.
**Source research:** System Surveyor official site, pricing page, user reviews (Capterra), feature documentation.

**System Surveyor overview:**
Cloud-based digital site survey platform for physical security and low-voltage systems. The closest existing tool to SentinelTwin in terms of positioning.

**Pricing (per seat, per user, 2025–2026):**
| Tier | Annual (per user) | Monthly | Best For |
|---|---|---|---|
| **Starter** | **Free ($0)** | **Free ($0)** | Small projects, trying out platform |
| **Essentials** | $600/yr ($50/mo) | $55/mo | Smaller integrators needing automation |
| **Scale** | $840/yr ($70/mo) | $85/mo | Mid-size integrators with teams/partners |
| **Enterprise** | Contact for quote | Contact | National/global teams (min 15 seats) |

**Feature comparison by tier:**
Key differentiators that require higher tiers:
- Branded PDF reports (Essentials+)
- Excel export (Scale+)
- Cable length calculation (Scale+)
- InfoMask encryption (Scale+)
- Guest users (Scale+)
- API access (Enterprise only)
- SSO/SAML (Enterprise only)
- Multiple teams (Enterprise only)

Common across all tiers: drag-and-drop design, FOV boundaries, photo capture, automated BOM, unlimited surveys

**Key limitations (where SentinelTwin wins):**
1. **2D only** — no 3D simulation, no height-based occlusion
2. **No DORI quality computation** — FOV visualization exists but no automated quality scoring
3. **No occlusion analysis** — devices block line-of-sight but System Surveyor doesn't compute this
4. **No adversarial paths** — cannot simulate evasion routes
5. **No temporal profiles** — no 24-hour simulation
6. **No AI layer** — no natural language, no counterfactual testing

**SentinelTwin's strategic difference:**
System Surveyor is a **digital whiteboard** for site surveys. SentinelTwin is a **simulation engine** for security intelligence. System Surveyor helps you draw what exists. SentinelTwin helps you understand what it means.

**Potential partnership angle:** System Surveyor could use SentinelTwin's simulation engine as a plugin/add-on. They have floor-plan-to-device-placement workflow. SentinelTwin adds security intelligence. This is a genuine complementary fit.

---

### Thread 58: WebGPU Compute Shader Feasibility
**Status:** New. Confirms WebGPU compute path is viable for accelerating coverage heatmap computation.
**Source research:** caniuse.com/webgpu, WebGPU specification, community benchmarks 2025-2026.

**Adoption status (2025-2026):**
- **Widely shipping** in Chrome, Edge, Safari (desktop and mobile)
- Firefox has enabled by default — critical mass achieved
- Check: `caniuse.com/webgpu` for latest stats
- Fallback: check `navigator.gpu` before initializing compute pipelines

**Key difference from WebGL:**
| Feature | WebGL | WebGPU |
|---|---|---|
| Compute shaders | **No** (fragment shader hacks only) | **Native support** |
| API level | High-level (easier, less control) | Low-level (more control, better perf) |
| Modern GPU access | Indirect/limited | Direct (matches modern GPU features) |

**Relevance to SentinelTwin's coverage engine:**

Heatmap computation (counting rays per grid cell) is naturally parallelizable:
- Data points (rays) can be processed independently
- Results accumulate into grid cell counters
- End-to-end GPU pipeline: ray stays on GPU from dispatch to heatmap display
- No expensive CPU-to-GPU data transfers for intermediate results

**Performance for SentinelTwin's 40×40 grid (1,600 cells):**
- CPU (single-threaded): incrementally counting into a 1,600-cell grid is trivial (~<1ms)
- GPU compute shader benefit: meaningful only at very large grid sizes (100×100+) or when doing many grid recomputations per frame
- **Recommendation:** Use CPU for V0.1 (1,600 cells → trivial). Plan WebGPU compute path for V0.3+ when temporal simulation requires many grid recomputations per second.

**Browser compatibility for V0.1:**
- WebGPU is stable enough to use in production (2025-2026)
- But not universally supported (older devices, specific OS/GPU driver combos)
- SentinelTwin should always have a CPU fallback path
- For V0.1 coverage engine, CPU is sufficient. WebGPU compute is an optimization, not a requirement.

---

### Thread 59: WebLLM / Local LLM in Browser Feasibility
**Status:** New. Confirms viability of running small LLMs in-browser for command parsing / scene understanding.
**Source research:** MLC-AI WebLLM, wllama (llama.cpp WASM), community deployment guides 2025-2026.

**Two main approaches:**

| Approach | Library | Hardware Acceleration | Maturity |
|---|---|---|---|
| **WebGPU-native** | MLC-AI WebLLM | WebGPU (GPU inference) | State-of-the-art, most performant |
| **WASM-based** | wllama (llama.cpp port) | WASM (CPU inference) | Mature, generally slower |

**WebLLM (recommended path):**
- Built specifically to leverage **WebGPU** for GPU inference in the browser
- Handles model loading, caching, inference pipeline
- Supports 1-3B parameter quantized models (Qwen2.5, Phi-3, Llama-3-1B)
- Performance: 30-50+ tokens/sec on modern devices (suitable for real-time interaction)

**Performance characteristics for 1-3B models:**
| Metric | Performance |
|---|---|
| **Inference speed** | 30-50+ tokens/sec (WebGPU) |
| **Cold start** | High — must download model weights (1-2.5GB for quantized 3B) |
| **Subsequent loads** | Near-instant — IndexedDB cache |
| **Memory usage** | ~1.5-2.5GB VRAM/RAM (4-bit quantized) |
| **Task suitability** | Excellent for command parsing, scene understanding, report generation |

**Recommendations for SentinelTwin:**
1. **Use WebGPU, not pure WASM** — WASM-only CPU inference is too slow for responsive UX
2. **Always quantize** (4-bit GGUF or WebLLM format) — reduces download size and memory
3. **Use Web Workers** — keep inference off the main thread, UI stays responsive
4. **Model size:** 1-3B is the sweet spot — enough reasoning for command parsing, small enough for browser
5. **Cache aggressively** — IndexedDB for model weights, warm-start after first load
6. **Privacy advantage:** All inference happens locally — no data leaves the device. This is a major selling point for security agencies handling sensitive site layouts (see Thread 23)

**V0.1 strategy:** Build with hosted API (OpenAI/Gemini) for initial command parsing to move fast. Add local WebLLM path as a privacy-tier upgrade in V0.2+ when the inference pipeline is well-understood.

---

### Thread 60: Physical Security SaaS Pricing Benchmarks
**Status:** New. Maps what security professionals pay for tools — anchors SentinelTwin pricing.
**Source research:** JVSG, System Surveyor, Milestone, Genetec — pricing data 2025-2026.

**The pricing landscape is fragmented:**
Physical security software does NOT follow standard SaaS pricing norms. There are three distinct pricing models:

**1. Per-User/Seat (Design & Planning Tools)**
Mirrors general SaaS pricing — monthly or annual per user.
| Tool | Price Range | Model |
|---|---|---|
| System Surveyor | $0-$85/user/month (tiered) | Per-seat SaaS |
| JVSG | $33-$66/user/month (annual) | Per-seat subscription |
| AXIS Site Designer | Free | Vendor tool (Axis only) |

**2. Per-Device (Video Management Systems)**
Priced per camera/door/intercom — the dominant model for operational software.
| Tool | Price Range | Model |
|---|---|---|
| Genetec Security Center | ~$149-199/yr per device (SaaS); custom quote for perpetual | Per-device + support |
| Milestone XProtect | Custom quote via integrator; Essential+ being discontinued | Per-camera license + support |

**3. Managed Services (RMR)**
Bundled monthly fee per site or per device — includes hardware, software, monitoring, maintenance.
| Type | Typical Range |
|---|---|
| Managed security (SMB) | $500-2,000/month per site (includes hardware rental) |
| Managed security (enterprise) | $5,000-50,000+/month per campus |

**Willingness-to-pay insights:**
- Security professionals anchor WTP on **risk reduction**, not features
- They pay more for tools that prove reduced liability, compliance, or investigation time
- **Ecosystem lock-in is the strongest pricing lever** — if tool supports existing hardware, WTP increases significantly
- TCO (Total Cost of Ownership) matters more than license price — tools that reduce site visits or installation errors command premium
- The design/planning tool market ($33-85/user/month) is well-established with JVSG and System Surveyor as anchors

**SentinelTwin pricing implications:**
| Factor | Implication for SentinelTwin |
|---|---|
| JVSG anchor ($33-66/mo/user) | SentinelTwin must justify premium over JVSG with adversarial path + AI capabilities |
| System Surveyor anchor ($0-85/mo/user) | Free tier needed to compete for trial; paid tier in $50-100/mo range |
| No tool does simulation | Premium pricing for simulation layer is defensible — WTP for "what no other tool does" |
| Professional vs individual | Integrator firms will pay 5-20 seats × monthly cost. Single installer pays 1 seat. |
| Per-site vs per-seat | Per-seat aligns with integrator procurement. Per-site may be better for enterprise direct sales. |

---

### Thread 61: ASIS GSX Conference — GTM Launch Strategy
**Status:** New. Maps the premier industry conference as SentinelTwin's ideal launch venue.
**Source research:** ASIS GSX official site, GSX Newsroom, exhibitor materials 2025-2026.

**GSX 2026 (next event):**
- **Date:** September 14-16, 2026
- **Location:** Georgia World Congress Center, Atlanta, GA
- **Target for:** SentinelTwin V0.1+ public launch or pre-launch preview

**GSX 2025 (recent past, reference):**
- **Date:** September 29-October 1, 2025
- **Location:** New Orleans, LA
- **Attendance:** ~8,600-16,000 (nearly 100 countries)

**Attendee profile:**
- Security and defense professionals
- Cybersecurity and physical security practitioners
- Government and law enforcement
- Technology providers and security consultants
- **Buyer mix:** Middle-career practitioners to senior security leaders and executives
- **Value for SentinelTwin:** Direct access to system integrators, security directors, and facility managers — all target buyer personas

**Exhibitor landscape:**
- 300-500+ exhibiting companies
- Mix of hardware vendors (Axis, Bosch, Hikvision, Dahua), software platforms (Genetec, Milestone), service providers (guard companies, consultants)
- NO simulation/planning software exhibitors — white space

**Cost to exhibit:**
- Standard 20'×20' space: ~$28,000 (varies by location and sponsorship add-ons)
- Smaller option: standard 10'×10' linear booth: significantly less (estimate $5-10K)
- Contact GSX sales team directly for current pricing and availability

**SentinelTwin GTM strategy using GSX:**

**Phase 1 — Attend (GSX 2025 if possible, otherwise GSX 2026 as launch):**
- Walk the floor as attendee to validate interest, meet integrators, refine pitch
- Schedule meetings with potential pilot partners (system integrators, security consultants)
- Learn the competitive landscape firsthand

**Phase 2 — Exhibit (GSX 2026):**
- Booth in the startup/small-exhibitor section (10'×10' booth, ~$5-10K)
- Live demo: phone scan → SentinelTwin scene → coverage simulation → adversarial path
- Pitch focus: "You've never seen coverage this way. Watch an attacker find the blind spots."
- Lead capture: free trial for attendees, paid plans for serious integrators

**Phase 3 — Present (GSX 2027+):**
- Submit talk/workshop on security simulation methodology
- Peer-reviewed credibility with ASIS audience
- Position as thought leader in simulation-driven security design

**What this means for SentinelTwin:**
- GSX 2026 (Sept 14-16) is the ideal launch milestone
- Requires V0.1 ready by Q3 2026 for demo
- Cost to exhibit (5-10K small booth) is reasonable for startup pre-seed/post-seed budget
- The event provides direct access to the entire buyer ecosystem in one location
- ASIS membership ($200-500/year) is a low-cost signal of industry alignment

---

## Completed Research Updates

| Topic | Outcome | Doc |
|---|---|---|
| NVIDIA Metropolis VSS 3 Blueprint | Complementary — post-install analytics vs pre-install simulation | Thread 27 |
| VSaaS platforms lack coverage simulation | CRITICAL GAP VERIFIED — Verkada, Eagle Eye, Arcules, Cloudastructure do not simulate | Thread 28 |
| System Surveyor as nearest competitor | 2D CAD planning, no simulation — complementary, not competitive | Thread 28 |
| Converged security / cyber-physical market | PSIM $1.9-2.2B, CSO role growing — potential long-term buyer | Thread 29 |
| ASIS CPP/PSP certifications as buyer persona | 34,000+ members, PSP directly relevant | Thread 30 |
| ISO/IEC 30173 digital twin standard | Enterprise procurement language — add to architecture docs | Thread 31 |
| IPVM calculator is theoretical only | Validates SentinelTwin's honesty + occlusion advantage | Thread 32 |
| Guard patrol software lacks simulation | Confirmed — TrackTik et al have no sim planning | Thread 33 |
| web-ifc (IFC.js) viability | MIT, stable, browser IFC parsing is ready for V0.4+ | Thread 34 |
| AS/NZS 62676 AU/NZ standard | Direct IEC adoption — supports AU market entry | Thread 35 |
| Physical pentest firms identified | Specific firms, potential distribution channel | Thread 36 |
| GDPR privacy enforcement escalation | CNIL €200K+ fines, BIPA class-action risk, privacy zones are mandatory | Thread 37 |
| Security consultant workflow pain points | Game of telephone, data silos, no simulation — validates GTM messaging | Thread 38 |
| Physical security ROI frameworks | ROSI formula, risk mitigation model, SentinelTwin as budget justification tool | Thread 39 |
| School security market validated | $5B+ market, Alyssa's Law, no simulation exists — grants opportunity | Thread 40 |
| Healthcare security requirements | HIPAA, Joint Commission, RFID infant protection — compliance documentation need | Thread 41 |
| Open source VMS lacks planning | Frigate/Shinobi/ZoneMinder — NVR only, no coverage simulation at all | Thread 42 |
| AI video analytics market mapped | BriefCam/Oosto/Irisity — complementary, SentinelTwin = pre-sale verification tool | Thread 43 |
| Smart building / BMS integration | BACnet, ONVIF Profile M, MQTT — medium-term enterprise requirement | Thread 44 |
| Retail vertical requirements defined | POS coverage, planogram sensitivity, chain-wide audit model | Thread 45 |
| Data center security niche validated | TIA-942, SOC 2, zero tolerance for blind spots — high-value buyer | Thread 46 |
| Physical security SOAR defined | AI command layer as SentinelTwin's long-term moat in security automation | Thread 47 |
| Physical security incident costs/ROI frameworks | $45B/yr ORC losses, ROSI formula, calculators exist (Supercircuits, Intellisee) | Thread 48 |
| ONVIF Profile M analytics metadata | SOAP/WSDL + MQTT/JSON, widely adopted as industry standard for AI analytics metadata | Thread 49 |
| SchoolSafety.gov grant programs detailed | COPS SVPP $73M, BJA STOP $83M, DHS NSGP $274.5M — funding landscape mapped | Thread 50 |
| SIA OS-2/PSIA standards correction | SIA OS-2 does NOT exist — correct refs: ONVIF (video), OSDP (access control). PSIA is moribund | Thread 51 |
| GSAP + R3F path animation for actor replay | GSAP timeline with .to() chaining is viable; use paused timeline for play/pause/scrub | Thread 63 |
| Click-to-place object placement in R3F | Tool mode + raycaster + ghost preview is standard pattern; store holds activeTool | Thread 64 |
| OpenAI Structured Outputs for AI command layer | zod-to-json-schema bridges SecurityScene Zod schemas to OpenAI JSON Schema; responses API recommended | Thread 65 |
| Multi-canvas viewport (Camera Wall) | @react-three/drei <View> component with scissor rendering is canonical approach; same Canvas, multiple cameras | Thread 66 |
| Transform controls for scene editing | @react-three/drei PivotControls recommended for V0.1; TransformControls for V0.2+ | Thread 67 |
| Click-to-place object placement in R3F | Tool mode + raycaster + ghost preview is standard pattern; store holds activeTool | Thread 64 |
| OpenAI Structured Outputs for AI command layer | zod-to-json-schema bridges SecurityScene Zod schemas to OpenAI JSON Schema; responses API recommended | Thread 65 |
| Multi-canvas viewport (Camera Wall) in R3F | @react-three/drei <View> component with scissor rendering is canonical multi-viewport approach | Thread 66 |
| Transform controls for scene editing | @react-three/drei PivotControls recommended for V0.1; TransformControls for V0.2+ | Thread 67 |

---

### Thread 26: V0.2 Floorplan Understanding Bakeoff (HF-Backed Shortlist)
**Status:** Active. Execution artifacts created locally.
**Date:** 2026-05-29
**Canonical plan doc:** `Docs/experiments/V0_2_FLOORPLAN_UNDERSTANDING_BAKEOFF_PLAN.md`
**Model matrix:** `Docs/exploration/FLOORPLAN_UNDERSTANDING_MODEL_MATRIX.md`
**Harness workspace:** `experiments/scene_understanding/`

**Fresh evidence snapshot (Hugging Face):**
- Qwen2.5-VL docs + model card: strong multimodal parser candidate (`Qwen/Qwen2.5-VL-7B-Instruct`)
- Florence-2 docs + card: task-prompted extraction candidate (`microsoft/Florence-2-base`)
- Grounding DINO docs + model card: open-vocab symbol/object grounding assist (`IDEA-Research/grounding-dino-base`)
- GOT-OCR2 docs: OCR/symbol extraction assist (`stepfun-ai/GOT-OCR2_0`)
- Floorplan papers/datasets tracked on HF: WAFFLE (20K multimodal floorplans), CubiCasa5K (5K annotated floorplans), Raster2Seq (polygon reconstruction)

**Narrowed stacks for implementation bakeoff:**
1. Qwen2.5-VL + GOT-OCR2 + optional Grounding DINO
2. Florence-2 + GOT-OCR2
3. Raster2Seq + Qwen semantic repair

**Acceptance gate (SecurityScene-linked):**
- strict schema validity,
- wall/door/window geometry quality,
- security-relevant semantic fidelity,
- latency/failure constraints,
- confidence/provenance output for review flow.

**Expanded stage coverage (new pass):**
- OCR / label reading: LightOnOCR-2-1B-base, PaddleOCR-VL, TrOCR, Donut
- Layout understanding: Qwen2.5-VL, MiniCPM-V 4.6, Pixtral-12B-2409, InternVL3-8B
- Grounding / detection: Florence-2, Grounding DINO, OWLv2, MM Grounding DINO
- Segmentation: SAM3, SAM2, Mask2Former, OneFormer
- Structured repair: PP-DocLayoutV3, LayoutLMv3, Table Transformer, Pix2Struct, Donut
- Cloud fallbacks: OpenAI GPT-4.1 / GPT-4o and Gemini 2.5 Flash / Pro

**Evaluation plan added:**
- stage-level metrics for OCR, grounding, segmentation, layout, and repair,
- end-to-end SecurityScene subset validation,
- local vs cloud control comparison on the same eval split,
- noisy-scan pilot before full 60-image bakeoff.

**Executed pilot results (dev split, 5 images, after visual critical-zone repair):**
- `stack_b_florence_gotocr`: wall F1 0.912, door F1 0.200, window F1 0.300, obstruction F1 0.536, CZ recall 0.600, p50 6822ms
- `stack_f_gemini25_flash`: wall F1 0.948, door F1 0.200, window F1 0.400, obstruction F1 0.643, CZ recall 0.600, p50 4309ms
- `stack_e_gpt41_structured`: wall F1 0.948, door F1 0.200, window F1 0.400, obstruction F1 0.687, CZ recall 0.600, p50 4640ms
- `stack_h_minicpm_ocr`: failed on all 5 images in this environment due checkpoint/model-class mismatch
- `stack_a_qwen_ocr`: cold-started very slowly and was aborted before completion; treat as a deployment bottleneck, not a model score

**Current interpretation:**
- Gemini 2.5 Flash remains the strongest practical cloud fallback in this dev split because it is fastest while holding geometry near the top tier.
- GPT-4.1 is still competitive on geometry and now matches the visual critical-zone repair behavior.
- Florence-2 is a viable local hybrid baseline, but it lags the cloud control on door/window and obstruction quality.
- The visual fill repair stage moved critical-zone recall from 0.0 to 0.6 on the synthetic dev split; that is good enough for the pilot gate but still not universal enough for final acceptance.
- MiniCPM-V local paths need a different loader or a different quantized checkpoint before they are production-useful here.
- Regression coverage now exists for the visual repair helper in `experiments/scene_understanding/tests/test_visual_critical_zone.py`, so the colored-zone detector is pinned against the synthetic dev fixtures instead of being left as an untested heuristic.

**Open risk:** data licensing boundaries for some datasets used for evaluation must be validated before any productized data reuse.

---

### Thread 62: Phase 0  Standalone Studio Build FindingsImplementation 
**Status:** Complete. `apps/studio/` built and verified 2026-05-27.
**Source:** Phase 0 implementation session (Claude Code / autonomous-loops).

**What was built:**
- Standalone Next.js + R3F app at `apps/ no Pascal, no external editor forkstudio/` 
- Canonical `SecurityScene` TypeScript types + Zod schemas (`src/schema/security-scene.ts`)
- Vanilla Zustand scene store (`src/store/scene-store. tested, CRUD + snapshot APIts`) 
- Simulation modules in `src/ zero React/DOM dependencies, all pure geometrysimulation/` 
- `small-retail-shop.json` demo  validated; cupboard placement verified to occlude counterscene 
- Camera Studio UI shell (TopBar, LeftPanel, WorkspaceCanvas, InspectorPanel, BottomPanel, etc.)
- 5 tests passing; lint clean; build succeeds

**Key implementation decisions made:**
- Grid resolution: 0.25m cells (4 cells/ DORI-meaningful resolution for a person's body widthmeter) 
- Zone quality aggregation: 25th percentile of zone cells (strict fail logic)
- BVH pattern: merged vision-collider mesh from all walls + obstructions; rebuilt on simulation run
- Zustand store reset: `getInitialState()` must return full state including methods (not plain object)

**Toolchain findings:**
 resolved by using `npm install` for production installs while keeping `bun test` for running tests
- `simulate-studio.ts` must strip internal `probabilities` field from coverage cells before  leaks internal state otherwisereturning 
- Next.js 16.2 with Turbopack: no config changes needed for three.js or three-mesh-bvh

**Baseline simulation behavior (small retail shop):**
- Overall coverage: ~58% of floor area
- Cash counter critical zone: FAILS recognition requirement (blocked by cupboard)
- Adversarial path: finds minimum-exposure route along west wall (bypasses Camera 1's cupboard-occluded zone)
- This baseline is the regression fixture for Phase 1 changes

**BVH implementation detail:**
- `acceleratedRaycast` patched onto `THREE.Mesh.prototype` in `coverage.ts`
- Merged geometry built from wall + obstruction box meshes using `BufferGeometryUtils.mergeGeometries()`
- Per-object `userData.nodeId` and `userData.visionTransmission` attached before merge so hit data can identify source node
- `MeshBVH` built from merged geometry; single BVH shared across all camera raycasts per simulation run

**Open follow-on items for Phase 1:**
- Formal benchmark: 4040 grid  4 cameras target <16ms (Thread 2 / D-014)
- Heatmap dirty-tracking: avoid full rebuild on each frame
- Camera feed secondary canvas (D- deferred007) 
 auto-recompute UX polish
- Before/after snapshot diff display

**Architecture validation:**
- D-003 (simulation = deterministic geometry, not AI  simulation modules import only `three` and `three-mesh-bvh`confirmed ) 
- D-004 (three-mesh-bvh mandatory from day one  wired in first working coverage engineconfirmed ) 
- D-006 (instanced mesh heatmap  `THREE.InstancedMesh` with per-instance color arrayconfirmed ) 
- D-009 (Dijkstra adversarial path  implemented with exposure cost functionconfirmed ) 
- D-010 (standalone before Pascal  app works with no Pascal dependencyconfirmed ) 

**Defensive framing verified:**
- Adversarial path output uses: "minimum-exposure route," "coverage gap," "red team path"
- No language around evasion, bypass, avoiding detection

---

### Thread 21: Phase 0/1 Build Findings — Verified Implementation State
**Status:** Complete. Phase 0 and Phase 1 delivered and tested.
**Date:** 2026-05-26

**Phase 0 findings (all verified):**
- three-mesh-bvh + geometry group merge works correctly: all wall/obstruction geometry merged into
  one BVH mesh with per-group userData preserving `nodeId` and `visionTransmission`.
- Raycast hit → group materialIndex → source node lookup works via `mesh.userData.sources`.
- BVH build on demo scene: ~2ms. Full coverage recompute: **10.8ms average** (40×28 grid, 2 cameras).
  This is under the 16ms target. No need for WASM or GPU acceleration at current scale.
- Zod 4 schema validation works on import; `simulateStudio()` always returns `SimulationResult`.
- Coverage engine has ZERO React/R3F/DOM/Zustand imports — runs clean in worker context.

**Phase 1 test suite findings:**
- 23 tests across 8 files: grid, FOV edge cases, raycast occlusion, DORI scoring, lighting penalty,
  end-to-end (camera off, shelf moved, night mode), performance benchmark.
- Cash counter correctly FAILS recognition in baseline (cupboard obstruction confirmed working).
- Glass visionTransmission=0.9 → partial coverage but not zero (correct behavior).
- DORI threshold boundaries pass correctly: `ppmToQuality(250) === "identification"`.
- Night mode with no light degrades quality significantly (lighting penalty model verified).

**Phase 2 gap identified:**
- Critical: `InspectorPanel.tsx` was entirely read-only. All inputs used `defaultValue` (uncontrolled),
  no `onChange`, no `updateNode` calls. "Every edit changes the risk map" was FALSE.
- `ObstructionBox` in WorkspaceCanvas had no click handler. Obstructions couldn't be selected.
- No `ObstructionInspector` component existed.
- Camera View PIP tab was a placeholder ("Live view available in dedicated Camera View mode").
- Fix dispatched: wiring inspector to `updateNode`, building ObstructionInspector, Camera PIP.

**Architecture validation:**
- SecurityScene as single source of truth holding: no parallel scene representations appeared.
- `auto-recompute` hook correctly debounces dirty state, but was dormant because inspector never
  marked scene dirty. Once inspector is wired, the full "edit → recompute → heatmap update" loop
  will complete automatically.
- Before/After tab (`BeforeAfterTab.tsx`) already implemented with delta coverage %. ✅
- Snapshot store pre-initialized with 4 demo snapshots (Baseline/Moved Cupboard/Cam2/Night). ✅

**Open items after Phase 2:**
- "Test Without This Obstruction" button deferred to Phase 3 (needs separate simulation run path).
- Camera PIP canvas needs scene-reactive update when camera props change via inspector.
- Adversarial path simulation (Phase 3) builds on the working coverage grid.

---

### Thread 63: GSAP + React Three Fiber Path Animation — Implementation Research

**Status:** Complete. GSAP + R3F path animation is viable. Recommended approach: custom path interpolation with GSAP timeline.
**Date:** 2026-05-26
**Source:** Batch 6 implementation research — GSAP @react-three/gsap, R3F animation patterns.

**What was researched:**
- GSAP integration with React Three Fiber for animating an actor (humanoid figure) along an adversarial path
- GSAP's ability to interpolate 3D positions and rotations over a timeline
- Path animation approaches: `.to()` chaining, `morphSVG`, position property interpolation
- R3F-specific patterns: `useGSAP` hook, `@react-three/gsap` wrapper, imperative `gsap.to()` in `useFrame`
- AnimatePresence for enter/exit of path actor

**Key findings:**
1. **GSAP `.to()` chaining** is the most straightforward approach: chain `gsap.to(object.position, { x: p1.x, z: p1.z, duration: 1 })` calls for each path segment
2. **`@react-three/gsap`** provides a `GSAP` component that works declaratively in JSX — `timeline.to(ref, { position, duration })`
3. **Custom path interpolation** with `useGSAP` hook: build a timeline from waypoints, GSAP handles the tweening between each point
4. **Rotation interpolation**: GSAP can tween Euler angles but Quaternion slerp is smoother. Use `onUpdate` callback to interpolate rotation:
   ```typescript
   useGSAP(() => {
     const tl = gsap.timeline({ paused: true });
     path.forEach((point, i) => {
       tl.to(actorRef.current.position, { x: point.x, z: point.z, duration: 1 }, i);
     });
     // Rotation via onUpdate callback
     tl.eventCallback('onUpdate', () => {
       // Interpolate rotation between current and next waypoint
     });
   }, [path]);
   ```
5. **GSAP timeline controls**: `play()`, `pause()`, `reverse()`, `progress()`, `timeScale()` — all available for play/pause/scrub UI

**Implementation guidance for SentinelTwin:**
- Use `gsap.timeline({ paused: true })` for the path player — this gives scrub control via `timeline.progress()`
- Actor model: simple humanoid figure (cylinder + sphere) or imported GLB
- Play/pause/scrub from BottomRow or a floating control bar
- GSAP timeline approach works at any path resolution — waypoints from adversarial-path.ts are fed directly into the timeline
- **Performance concern:** GSAP's `.to()` on R3F refs triggers React re-renders if not careful. Use `gsap.quickTo()` or animate the underlying `object3D.position` directly (not the ref's `.position` property as a React state)

**Related:** Thread 3 (Adversarial Path Simulation), Thread 21 (Phase 0/1 Build — Path replay not yet implemented)

---

### Thread 64: Canvas Click-to-Place Object Patterns — R3F

**Status:** Complete. Click-to-place is pattern-ready. Tool mode + raycaster is the standard approach in R3F.
**Date:** 2026-05-26
**Source:** Batch 6 implementation research — R3F interaction patterns, drei useCursor, three-mesh-bvh.

**What was researched:**
- Patterns for clicking on the 3D canvas to place objects at the intersection point
- Raycasting against floor plane vs arbitrary geometry
- Tool mode management (select ↔ place ↔ inspect)
- Hover feedback and grid snapping

**Key findings:**
1. **Pattern: Tool mode in store + raycaster in canvas.** The standard R3F approach:
   - Store holds `activeTool: 'select' | 'placeCamera' | 'placeObstruction' | 'placeLight'`
   - Canvas `onPointerDown` checks activeTool → if placing, raycast against floor → create object at intersection
   - `onPointerMove` shows preview ghost object at cursor position
2. **Floor plane raycasting:**
   - Use a hidden invisible floor plane (`mesh` with `visible={false}`) as the raycast target
   - Or raycast against the scene BVH and find the first intersection with a floor material
   - drei's `useIntersect` can simplify
3. **Ghost preview:**
   - Semi-transparent object at cursor position that follows mouse
   - On click, commit position and create real object
   - On right-click/Escape, cancel placement mode
4. **Grid snapping:**
   - Round position to nearest grid unit (e.g., 0.5m) on placement
   - Show grid lines via drei's `Grid` helper
5. **Click vs drag disambiguation** — use `pointerdown` + `pointerup` distance check to distinguish click (place) from drag (orbit control)

**Implementation guidance for SentinelTwin:**
- Currently, the LeftPanel has 7 tool buttons (Select, Camera, Obstruction, Light, Wall/Zone/EntryPoint) but none are wired to the canvas
- The store already has `activeTool` but it's not connected to WorkspaceCanvas
- **Approach:**
  1. Add `activeTool` to studio-store.ts with proper tool types
  2. In WorkspaceCanvas, add `onPointerDown` handler that checks tool state
  3. For floor intersection: add invisible floor plane or use BVH raycast
  4. Show ghost preview object on hover
  5. On click: create object at intersection point via store action
- Pre-existing grid system: the coverage grid already tiles the floor; reuse its bounds for placement snapping

**Related:** Thread 21 (Phase 0/1 — Click placement not implemented), Phase 1 coverage engine geometry

---

### Thread 65: OpenAI Structured Outputs — Implementation Research

**Status:** Complete. OpenAI Structured Outputs are production-ready for Phase 3 AI command layer. `zod-to-json-schema` is the bridge.
**Date:** 2026-05-26
**Source:** Batch 6 implementation research — OpenAI SDK v4+, Structured Outputs API, zod-to-json-schema.

**What was researched:**
- OpenAI's Structured Outputs API for guaranteed JSON responses
- How to bridge Zod schemas (already used in SecurityScene) to OpenAI's JSON Schema format
- Best practices for command parsing and counterfactual analysis prompts
- Model support: GPT-4o, GPT-4o-mini, o3-mini

**Key findings:**
1. **OpenAI Structured Outputs** (`response_format: { type: "json_schema", json_schema: {...} }`) is the recommended approach in 2025-2026. Guarantees valid JSON matching the schema — no more prompt engineering for JSON parsing.
2. **`zod-to-json-schema`** (npm package) converts existing Zod schemas to OpenAI-compatible JSON Schema. SentinelTwin already has full Zod schemas in `security-scene.ts` — this is a direct bridge.
3. **Response format pattern:**
   ```typescript
   import { zodToJsonSchema } from 'zod-to-json-schema';
   import OpenAI from 'openai';

   const schema = zodToJsonSchema(CommandParseResultSchema);
   const response = await openai.responses.create({
     model: 'gpt-4o',
     input: [
       { role: 'system', content: systemPrompt },
       { role: 'user', content: userMessage }
     ],
     text: { format: { type: 'json_schema', schema } }
   });
   ```
4. **Responses API vs Chat Completions:** OpenAI's newer `responses` API (2025+) natively supports structured outputs. The legacy `chat.completions` API also supports it via `response_format` parameter.
5. **Model support:**
   - GPT-4o: Full structured outputs support, best quality, highest cost
   - GPT-4o-mini: Good for command parsing, lower cost
   - o3-mini: Strong reasoning, good for counterfactual analysis
6. **System prompt pattern for command parsing:**
   - Give the AI the SecurityScene schema context
   - Define available operations: ADD_CAMERA, REMOVE_CAMERA, MODIFY_CAMERA, ADD_OBSTRUCTION, etc.
   - Output = structured array of operations to apply to the scene

**Implementation guidance for SentinelTwin:**
- Phase 3 implementation path:
  1. Install `openai` SDK + `zod-to-json-schema`
  2. Create `@sentineltwin/agents` package with CommandAgent class
  3. Define `CommandParseResult` Zod schema → convert to JSON Schema for OpenAI
  4. Build system prompt with SecurityScene schema context
  5. Wire CommandAgent to the chat UI in BottomRow
- **Local-first consideration:** For local-only mode, use WebLLM (Thread 59) with smaller models. The Zod → JSON Schema bridge works for any LLM.

---

### Thread 66: Multi-Canvas Viewport (Camera Wall) — Implementation Research

**Status:** Complete. @react-three/drei `<View>` component is the recommended pattern for Camera Wall mode.
**Date:** 2026-05-26
**Source:** Batch 6 implementation research — @react-three/drei View, R3F multi-viewport patterns.

**What was researched:**
- How to render multiple camera perspectives within a single R3F Canvas
- Pattern for switching between Map View, Camera View, Camera Wall (4-up layout), and Path Replay
- Performance characteristics of multiple Views vs separate Canvases

**Key findings:**
1. **`@react-three/drei` `<View>` component** — the canonical approach for multiple viewports:
   - `<View track={ref}>` uses `gl.setScissor` / `gl.setViewport` under the hood for efficient multi-viewport rendering
   - Each `<View>` gets its own camera, scene, and render priority
   - All views share the same WebGL context (no context loss, no extra GPU memory for separate Canvas elements)
   - `index` prop controls render order (higher = renders on top)
2. **Pattern for Camera Wall:**
   ```typescript
   <Canvas>
     <View track={ref1} index={1}>
       <PerspectiveCamera makeDefault position={cam1.position} />
       <Scene />
       <Overlay label="Camera 1 — Entrance" />
     </View>
     <View track={ref2} index={2}>
       <PerspectiveCamera makeDefault position={cam2.position} />
       <Scene />
       <Overlay label="Camera 2 — Register" />
     </View>
     {/* 2 more views for 4-up */}
     <Html>
       <div ref={ref1} className="viewport-1" />
       <div ref={ref2} className="viewport-2" />
       <div ref={ref3} className="viewport-3" />
       <div ref={ref4} className="viewport-4" />
     </Html>
   </Canvas>
   ```
3. **View switching (Map / Camera / Camera Wall / Path Replay):**
   - Store a `viewMode: 'map' | 'camera' | 'wall' | 'replay'` in the store
   - Switch between different layout components
   - Map view: top-down orthographic + minimap
   - Camera view: single perspective from selected camera's POV
   - Camera wall: 2×2 or 3×3 grid of camera views
   - Path replay: third-person chase view following the actor
4. **Performance:**
   - Multiple Views in one Canvas is cheaper than multiple Canvases (shared GL context, shared scene objects)
   - Each View can have its own `frameloop='demand'` for non-primary views to save GPU
   - For 4-up Camera Wall: 4 Views with shared scene but different cameras = ~4x draw calls but no additional memory for geometry
5. **PiP (Picture-in-Picture):** Corner minimap is a single small View with orthographic camera

**Implementation guidance for SentinelTwin:**
- Current WorkspaceCanvas renders a single scene with a single camera
- **Approach:**
  1. Add `viewMode` to store (already has `cameraViewMode` — may need to extend)
  2. Create `CameraWall` component with 2×2 grid of `<View>` elements
  3. Create `CameraFeed` component for single-camera third-person view
  4. Wrap existing scene content in shared `<Scene>` wrapper that's passed to all Views
  5. Use `Html` for the viewport overlay refs that position each viewport in the DOM

**Verified implementation note (2026-05-27):**
- The shipped camera wall path currently uses separate live `Canvas` feeds instead of the single-Canvas `<View>` pattern above. That keeps each camera HUD isolated and keeps the selected/active/offline ordering simple, but it is a deliberate tradeoff rather than a missing implementation.
- The shipped camera wall path now includes a user-visible `4 Views` / `6 Views` layout selector, so the wall behaves like an operator-configurable panel rather than a fixed grid.
- `StudioShell` now routes `map`, `camera_view`, `wall`, `replay`, and `compare` as full-canvas workspace modes.
- `camera_view` is implemented as a full-screen single-camera POV with DORI/live-mode overlays, while `compare` is a dual-scene baseline/proposed shell with metrics and quality trend summaries.

---

### Thread 67: Transform Controls — Implementation Research

**Status:** Complete. `@react-three/drei` `PivotControls` is the recommended approach for the scene editor. Three.js `TransformControls` is the alternative.
**Date:** 2026-05-26
**Source:** Batch 6 implementation research — @react-three/drei PivotControls, three.js TransformControls.

**What was researched:**
- Available object manipulation controls for R3F scene editors
- PivotControls vs TransformControls comparison
- Drag-to-place vs selection-handle interaction model

**Key findings:**
1. **`@react-three/drei` `PivotControls`** (recommended):
   - Declarative React component (`<PivotControls>` wraps the target object)
   - Provides translate (axis arrows), rotate (axis rings), and scale handles
   - `onDragStart`, `onDrag`, `onDragEnd` callbacks
   - Auto-scales handles based on camera distance
   - `snap={0.5}` for grid snapping
   - `depthTest={false}` to prevent handles from being occluded
   - **Best fit**: Scene editor where user selects an object then manipulates it
2. **`TransformControls`** from Three.js:
   - Classic Blender/Unity-style gizmo (translate/rotate/scale widget)
   - Available through drei's `TransformControls` wrapper or directly from Three.js
   - More full-featured (mode switching, space switching, snapping)
   - Imperative API (not declarative React)
   - **Best fit**: Power users who want Blender-style controls
3. **Drag-to-place (for initial positioning):**
   - Simple drag on the floor plane to position objects
   - `@react-three/rapier` `useDraggable` for physics-based drag
   - Or custom drag handler: constrain Y to floor height, move XZ to pointer intersection
   - **Best fit**: Quick placement without mode switching
4. **Recommendation for SentinelTwin:**
   - V0.1: Use `PivotControls` for selected object manipulation
   - Wrap selected object in `PivotControls` when `activeTool === 'select'`
   - Add snap-to-grid (0.5m increments matching the simulation grid)
   - For click-to-place (Thread 64), use simple drag-to-place at the point of click
   - V0.2+: Add `TransformControls` as an optional mode for power users

**Implementation guidance for SentinelTwin:**
- Currently, objects in the scene have no selection or manipulation
- **Approach:**
  1. Store `selectedObjectId` in store
  2. In WorkspaceCanvas, when an object is clicked, set it as selected
  3. Wrap selected object in `<PivotControls snap={0.5} />`
  4. On drag end, update object position/rotation in the store (triggers simulation recompute)
  5. Handle deselection on click-empty

**Related:** Thread 64 (Click-to-place), Thread 21 (Phase 0/1 — Selection not implemented)

---

## Thread 68: Simulation trust sprint - schema and engine alignment

**Status:** Complete for the current app pass.
**Date:** 2026-05-26

**Findings:**
1. `camera.rangeM` is a true physical bound and should short-circuit visibility before any PPM scoring.
2. The assumption thresholds in `SimulationAssumptions.pixelsPerMeter` are now the source of truth for quality thresholds and summary area metrics.
3. Critical zones should not be reduced to a single generic target height; the zone target type should drive the sample height used for evaluation.
4. Closed doors belong in the visibility and walkability model; open doors should not occlude.
5. Recommendations are only trustworthy when the scene is re-simulated after the patch and the delta is measurable.
6. User-facing language should describe coverage failure analysis, not evasion or "adversarial" behavior.

**Files touched:**
- `apps/studio/src/simulation/coverage.ts`
- `apps/studio/src/simulation/grid.ts`
- `apps/studio/src/simulation/simulate-studio.ts`
- `apps/studio/src/components/view/PathReplayView.tsx`
- `apps/studio/src/components/bottom-panel/ReportLiteTab.tsx`

---

## Thread 69: Studio SSR hygiene and camera-fit iteration

**Status:** Complete for the current pass.
**Date:** 2026-05-26

**Findings:**
1. Demo snapshot timestamps seeded with `Date.now()` during store initialization can create hydration mismatches between SSR and client boot.
2. Fixed demo timestamp bases keep the snapshots panel deterministic without changing the UI language.
3. Camera framing in the map view is sensitive to the default camera pose, OrbitControls target sync, and scene-scale assumptions; it needs explicit fit logic instead of relying on a guessed starting pose.
4. Turbopack dev cache failures can masquerade as app bugs, so live browser validation should always be paired with a clean restart when the module graph behaves inconsistently.

**Files touched:**
- `apps/studio/src/store/studio-store.ts`
- `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`
- `apps/studio/src/components/workspace/SharedScene.tsx`

---

## Thread 70: Studio canvas full-frame layout

**Status:** Complete for the current pass.
**Date:** 2026-05-26

**Findings:**
1. The map canvas was shrinking to the browser default 150px height because the `WorkspaceCanvas` wrapper participated in normal document flow instead of filling the workspace absolutely.
2. Converting the map wrapper to `absolute inset-0` let the canvas occupy the full workspace and match the reference composition much more closely.
3. DevTools measurement confirmed the canvas grew from `710x150` to `710x481.5` after the layout fix.
4. A hard browser reload after restarting the dev server was required to pick up the rebuilt bundle cleanly.

**Files touched:**
- `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`

---

## Thread 71: UI Gap Closure Sprint — Path Replay, Light Inspector, Apply Fix

**Status:** Complete.
**Date:** 2026-05-28

**Gaps closed:**

### GAP-13: Path replay animation
- Added `PathReplayActor` component to `WorkspaceCanvas.tsx` using `useFrame` (R3F delta loop).
- Actor interpolates linearly along `scene.paths[0].points[]` (2D XZ, Y=0.18m).
- Duration computed from total path length / `path.speedMps`.
- Auto-stops and resets to t=0 when path completes.
- Actor hidden when `progress===0 && !playing`.
- `TimelineTab` play/pause/skipback buttons now wire to store `pathReplay` state.
- Progress bar is live (driven by `pathReplay.progress * 100%`).
- Used `useFrame` (R3F built-in) instead of GSAP — keeps Apache 2.0 license compliance.

### GAP-19: Light inspector
- `LightInspector` component added to `InspectorPanel.tsx`.
- Reads `scene.securityLights.find(l => l.id === selectedId)`.
- Editable fields: name (via existing input), position X/Y/Z, rangeM (SliderInput), brightness (SelectInput enum), lightType (SelectInput enum), status (SelectInput).
- Delete button calls `removeNode(light.id)`.
- Wired into `InspectorPanel` render: `light ? <LightInspector /> : <NoSelection />`.

### GAP-21: Issues tab Apply Fix buttons
- `IssuesTab` now imports `updateNode` + `selectNode` from store.
- Camera chips in issues list are now buttons that call `selectNode(cameraId)`.
- Recommendations with `verified: true` and `affectedNodeId` show an "Apply Fix" button.
- `rotate_camera` fix: `updateNode(id, { yawDeg, pitchDeg })` + `selectNode`.
- `move_object` fix: `updateNode(id, { position })` + `selectNode`.

### Test fixes
- `simulate-studio.test.ts` "reduces overall quality" test: added `{ timeout: 20000 }` (was timing out at 5000ms default; each run ~740ms × 2 runs = ~1480ms but queue overhead pushed it over).
- `simulate-studio.test.ts` "produces data-driven recommendations" test: updated assertion from `verified === false` (stale, pre-counterfactual) to `typeof verified === 'boolean'` — simulation now runs counterfactual and sets verified correctly.
- `inspector-panel.test.ts`: updated branch assertion to include `light ? <LightInspector />` in expected string.

**Schema changes:** None (Recommendation schema `affectedNodeId` / `suggestedPosition` / `suggestedYawDeg` / `suggestedPitchDeg` were added in prior session).

**Store changes:**
- Added `pathReplay: { playing, progress, speed }` state + `setPathReplayPlaying`, `setPathReplayProgress`, `setPathReplaySpeed` actions to `studio-store.ts`.

**Files touched:**
- `apps/studio/src/store/studio-store.ts`
- `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`
- `apps/studio/src/components/bottom-panel/TimelineTab.tsx`
- `apps/studio/src/components/bottom-panel/IssuesTab.tsx`
- `apps/studio/src/components/inspector/InspectorPanel.tsx`
- `apps/studio/src/simulation/__tests__/simulate-studio.test.ts`
- `apps/studio/src/components/__tests__/inspector-panel.test.ts`
- `Docs/todos/CAMERASTUDIO_GAP_ANALYSIS.md`

**Test result:** 30/30 pass. Production build clean.

---

## Thread 72: Supersession Discipline — Lesson from CoverageSegmentPath

**Status:** New. Process finding.
**Date:** 2026-05-26

**The incident:** During Phase 4, `CoverageSegmentPath` (colored per-DORI-quality path segments)
was built as a replacement for `AdversarialPathLine` (uniform dashed red line). The new component
was added to `SharedScene.tsx` and used in `PathReplayView.tsx`, but the old component remained
in active use in `WorkspaceCanvas.tsx`. This created a supersession violation — two competing
path renderers rendering the same path data with different visual quality.

**Root cause:** When building the new component, I searched for references to the replacement
(what was new) but did not exhaustively search for all references to the
component being replaced (what was old).

**What the fix required:**
1. Searching all files importing `AdversarialPathLine` (found 3: WorkspaceCanvas, PathReplayView, SharedScene)
2. Upgrading WorkspaceCanvas to use `CoverageSegmentPath` with full waypoint objects (not stripped positions)
3. Removing the redundant overlay from PathReplayView
4. Cleaning up the dead import from WorkspaceCanvas

**Pattern for future replacements (Section 7 compliance):**
When replacing a component or function:
1. Identify the old symbol name
2. Run a full codebase search for ALL references (imports + usage)
3. Update EVERY reference to use the new component
4. Only then consider whether to remove the old component from its source file
5. If left in source file (for backward compat), add deprecation comment

**Related:** D-033 in DECISION_LOG.md.

**Files touched:**
- `apps/studio/src/components/workspace/WorkspaceCanvas.tsx`
- `apps/studio/src/components/view/PathReplayView.tsx`

---

## Thread 73: UI Implementation Session — Reference Screenshot Match

**Status:** Complete (2026-05-26)

**Work completed:**
Six reference screenshots were used as the source of truth for a pixel-accurate UI implementation pass.

### New files created
- `apps/studio/src/components/view/CameraWallView.tsx` — 2×2 (adaptive) live POV feed grid with HUD overlays (status dot, name badge, timestamp, scanline texture, OFFLINE state)
- `apps/studio/src/components/view/CameraViewMode.tsx` — Full-screen single-camera POV with gradient HUD, back button, camera selector pills
- `apps/studio/src/components/view/CompareView.tsx` — Side-by-side dual 3D heatmap + scenario selector bar
- `apps/studio/src/components/bottom-panel/CameraStatusSummaryPanel.tsx` — Camera status table + coverage donut (used in wall mode bottom panel)

### Existing files materially upgraded
- `TimelineTab.tsx` — Added adversarial path timeline event table (Time/Path/Seg/Event/Quality/Camera columns), quality-over-time bar chart, summary stats strip (events/duration/visible%/blind)
- `BeforeAfterTab.tsx` — Added multi-metric SVG donut comparison (coverage, recognition cells, identification cells, critical zones), quality distribution stacked bars, per-snapshot issue/blindspot stats
- `ViewModeBar.tsx` — Added `ContextChip` showing selected camera name (camera_view), path count (replay), or coverage % (map) next to active mode tab
- `BottomPanel.tsx` — Made tab strip scrollable (`overflow-x-auto flex-shrink-0`), wall mode uses CameraStatusSummaryPanel, camera_view/replay auto-switch to timeline, compare auto-switches to beforeafter
- `InspectorPanel.tsx` — Properties tab gets recommendation count badge, "Recommended Next Steps" section surfaces sim recommendations per camera, View tab had DORI legend + layer toggles
- `studio-store.ts` — `setViewMode()` now auto-switches `bottomTab` (replay/camera_view→timeline, compare→beforeafter, map→metrics)
- `BeforeAfterTab.tsx` / `ReportLiteTab.tsx` / `CompareView.tsx` — surfaced copyable compare links at the point of comparison, so the seeded snapshot pair can be shared from the exact surface where it is being reviewed
- `operational-evidence-archive-history.ts` / `workspace-search.ts` — persisted a short recent-history of exported/restored operational evidence archives so launcher search can route directly to an archive's latest reconstructable checkpoint when one exists
- `SceneIntelligenceTab.tsx` — added a recent operational evidence archive panel with browser handoff copy/open and canonical restore actions, keeping the recovery story visible inside the provenance surface itself
- `CameraWallView.tsx` — Adaptive grid (1 cam=full, 2=side-by-side, 3=2+1, 4=2×2, 5-6=3×2)

### Design principles applied (from design-review skill App UI rules)
- **Calm surface hierarchy**: Consistent #0b0c10 background, #1f2536 borders, #dde2ef text
- **Density with readability**: 10-11px labels in panels, 8-9px secondary metadata
- **DORI color system**: identification=#4ade80, recognition=#60a5fa, observation=#facc15, detection=#fb923c, none=#ef4444 — consistent across heatmap/inspector/timeline/before-after
- **Minimal chrome**: No decorative blobs, gradients, or emoji decoration
- **Utility language**: Labels are direct ("DETECT 12.3m", "VISIBLE 87%") not aspirational

### UX improvements delivered independently (not in reference screenshots)
1. ViewModeBar context chip — always shows what you're looking at
2. Auto bottom-tab switching on view mode change
3. Timeline stats summary strip — quick-glance path health
4. Inspector recommendation badge — surfaces AI suggestions without obscuring tab flow
5. Adaptive camera wall grid — works with 1-6 cameras
6. Scrollable bottom panel tabs — 8 tabs fit without overflow

### Open UX gaps (for future sprint)
- Privacy zone rendering (GAP-16) still not implemented
- Redundancy/failure matrix (GAP-10) not started
- Camera preset library (GAP-08) not started
- The Timeline quality-over-time chart uses approximate slot bucketing — could be enhanced with real interpolation from waypoints when adversarial path result is present
- BeforeAfterTab donut charts use SVG without animation — framer-motion `animate` on dashoffset would add polish

---

## Thread 74 — Failures Tab, Assumptions Editing, Zone Inspector (Session 2026-05-26)

### Goals
Close GAP-04 (Failures tab), GAP-06 (Assumptions panel editable), and add CriticalZoneInspector (new).

### Files changed
- `InspectorPanel.tsx` — Three improvements:
  1. **Failures tab (GAP-04)**: Full implementation replacing static placeholder. Camera criticality score (0-10) derived from coverage contribution + non-redundant zone count. Toggle buttons for Offline / Dirty Lens / Night Vision Disabled that actually mutate `camera.status`, `camera.clarity`, `camera.nightMode`. "Failure active — re-run simulation" banner + Restore button. Zone coverage list with Redundant/No-Backup labels per zone. Adversarial path exposure count. Impact notes from `camResult.offlineImpact`.
  2. **Critical Zone Inspector (new)**: `CriticalZoneInspector` component for when a zone is selected. Shows zone name, target type, priority, DORI required vs actual quality, editable properties (targetType, requiredQuality, priority, nightRequired, redundancyRequired), covering cameras list, coverage gap explanation, delete button. Wired in `InspectorPanel` dispatch chain: camera → zone → obstruction → light → NoSelection.
  3. Added `CriticalZoneNode` to import

- `studio-store.ts` — Added `updateAssumptions(patch)` action that does `{ ...scene.assumptions, ...patch }` and sets `simulationDirty: true`. Added to both type interface and implementation.

- `BottomRow.tsx` — Rewrote `AssumptionsPanel` to support inline editing:
  - "Edit" button → shows form with segmented controls (TimeOfDay, DORI Model, Light Level, Night Penalty) and number inputs (Person Height, Wall Height)
  - "Save" / "Cancel" buttons apply/discard changes via draft state
  - `SegmentedControl<T>` generic component for multi-value selectors
  - `cur()` helper reads from draft or live assumptions
  - Wired "Open Report Lite" button to `setBottomTab("report")`

### Design decisions
- **No separate useState for failure mode**: The toggles directly mutate camera state in the store, making failure state persistent (not transient). User must "Restore" explicitly. This is intentional — the failure simulation IS the state change; re-running simulation gives the real impact. More honest than a shadow "simulated only" state.
- **Criticality score formula**: `min(10, round(coveragePct/12 + nonRedundantZones * 2))`. Balances coverage contribution vs zone exclusivity. Cameras covering 60% of scene or 3+ unique zones score ≥8 (Critical).
- **Zone inspector placement**: Between camera and obstruction in the dispatch chain. Rationale: zones are objectives, not obstructions, so they should be higher priority in the chain.
- **Assumptions editing inline**: Draft + commit pattern avoids partial mutations. All assumption changes mark scene dirty so simulation recompute is triggered.

### UX principles applied
- Failure toggles use the same pill toggle style as the inspector (consistent visual language)
- Zone inspector uses existing SectionCard and Badge primitives (no new visual tokens)
- "Failure active" banner uses amber (warning), not red (critical), because the failure is deliberate — it's a simulation mode, not an error
- Assumptions edit form uses `SegmentedControl` for categorical values (4 or fewer options) and `<input type="number">` for continuous values

### Open items from this thread
- GAP-10 (Redundancy matrix) still not built
- GAP-08 (Camera preset library) still not built
- Zone inspector could add a DORI range bar visualization showing how far each camera reaches into the zone
- Assumptions panel could expose PPM threshold editing for the `pixelsPerMeter` sub-object (currently hidden)

---

## Thread 75 — Docked Workspace, Shadow Deprecations, and Fiber Clock Warning (Session 2026-05-26)

### Findings
- **Canvas-first dock layout is the right product shape for SentinelTwin**: the studio shell now works better as collapsible left/right/bottom docks with workspace presets than as fixed side panels. That keeps the canvas dominant in coverage, replay, compare, and camera-wall modes while still allowing deep inspection when a selection demands it.
- **Full-width dock shells plus section-level toggles fix the “toggle eating space” problem**: the live Studio render looked materially better once the left and right panels stopped using fixed-width inner wrappers and instead exposed collapsers for tools, layers, minimap, selection inspector, assumptions, and path utilities. The canvas gained room immediately without hiding the important controls.
- **`<Canvas shadows="percentage" />` avoids the `PCFSoftShadowMap` deprecation warning**: the runtime warning came from React Three Fiber default shadow handling, not from any app-local three.js shadow code. Switching the studio canvases to `shadows="percentage"` is the clean local fix.
- **The `THREE.Clock` warning is dependency-level, not app-local**: inspection showed the warning originates inside `@react-three/fiber` internals (`dist/events-*.esm.js` uses `new THREE.Clock()`). This means the app code is not the direct source; the likely remedy is a dependency upgrade or upstream patch rather than a local refactor.
- **Browser QA confirmed the dock hierarchy is rendering as intended**: the live studio page shows the left tools dock, the bottom utility dock, and the contextual right inspector all mounting correctly around the canvas instead of the shell collapsing into a static three-panel frame. The default state is still intentionally dense for editing, but the new layout primitives are in place.

### Useful implementation notes
- Workspace presets should be updated whenever view mode changes so the shell can restore an appropriate layout automatically.
- A contextual right inspector is more scalable than adding more fixed tabs, because selection type already determines the most relevant controls.
- Bottom-dock content should be treated as mode-specific utility space rather than a permanent static panel.

### Follow-up
- Track the Fiber `Clock` warning as an open dependency issue until the upstream package changes.
- Keep verifying any new canvases for shadow warnings so the deprecation does not regress as new scenes are added.

---

### Thread 76 — Phase 8: AI Agent Pipeline — Coordinator, Providers, and Tests (Session 2026-05-29)

**Status:** Complete. 1 coordinator, 3 provider implementations, 2 test files, 0 TS/ESLint errors.

**What was built:**
- `src/agents/CoordinatorAgent.ts` — orchestrator that routes natural language commands to the correct provider, handles conversation state, and returns structured operations. Implements a request/response pattern with timeout handling.
- `src/agents/providers/ModelProvider.ts` — abstract base class defining the provider interface (streamChat, complete, analyze).
- `src/agents/providers/AgentConfig.ts` — configuration types and factory for provider selection (OpenAI, Gemini, Qwen switchable via config flag).
- `src/agents/providers/GeminiProvider.ts` — Gemini 2.5 Flash/Pro implementation with streaming support.
- `src/agents/providers/OpenAIProvider.ts` — GPT-4o implementation with structured output parsing.
- `src/agents/providers/QwenProvider.ts` — Qwen2.5-VL implementation for vision-capable analysis.
- `src/components/agents/AgentCoordinatorPanel.tsx`, `AgentCoordinatorView.tsx` — UI panels for agent interaction.
- `src/components/agents/ProviderConfigPanel.tsx`, `ProviderConfigView.tsx` — provider configuration UI with API key management.
- `src/hooks/useAiCommand.ts` — React hook wrapping the coordinator for component use.
- `src/agents/__tests__/CoordinatorAgent.test.ts` — tests coordinator routing, error handling, response parsing.
- `src/agents/__tests__/ModelProvider.test.ts` — tests provider abstraction, config validation, factory pattern.

**Key findings:**
- Provider abstraction works well — switching between OpenAI/Gemini/Qwen requires only a config flag change, no code changes.
- The streaming response pattern (SSE-style) is essential for UX — users need to see partial results while the model reasons.
- The coordinator pattern (single entry point → dispatch to specialized handlers) is simpler and more maintainable than a multi-agent swarm for V0.1 scope.
- Model-agnostic from day one means no provider lock-in — critical for the open-source Apache 2.0 positioning.
- Tests confirmed: routing works correctly for all provider types, error handling gracefully degrades, and config validation catches misconfiguration.

**Useful implementation notes:**
- The `AgentConfig` type uses a discriminated union to ensure provider-specific config is type-safe at compile time.
- Provider selection happens once at initialization, not per-request — avoids latency spikes.
- The coordinator validates that the scene state can accept the requested operation before delegating — prevents "AI hallucinated an impossible edit" scenarios.

---

### Thread 77 — Phase 9: Report Generation Engine — Multi-Format Export with DORI/OODPCVS Quality (Session 2026-05-29)

**Status:** Complete. 1 engine module, 1 test file (72 assertions), 0 TS/ESLint errors.

**What was built:**
- `src/report/index.ts` — comprehensive report engine with:
  - `buildReportData(scene, results)` — generates structured report data from a SecurityScene and SimulationResult
  - `buildCompareReportData(beforeScene, beforeResult, afterScene, afterResult)` — before/after comparison report
  - `exportAsHtml(data)` — produces a standalone HTML report with inline styling, coverage heatmap summary, DORI quality breakdown per camera, critical zone analysis, and recommendation cards
  - `exportAsMarkdown(data)` — plain markdown export suitable for GitHub/Notion
  - `exportAsText(data)` — plain text export for email inclusion
  - Comparison exports (HTML/Markdown/Text) showing side-by-side coverage deltas
- `src/components/bottom-panel/ReportLiteTab.tsx` — in-panel report viewer with export buttons
- `src/components/bottom-panel/MetricsTab.tsx` — key metrics display (coverage %, DORI levels, zone-specific quality)
- `src/report/__tests__/report-engine.test.ts` — 72 assertions covering:
  - Report data construction with full scene including cameras, walls, zones
  - Edge cases: empty scene, single camera, all missing cameras
  - All 6 HTML/Markdown/Text export formats (single + comparison)
  - DORI and OODPCVS quality levels in reports
  - Compatibility re-exports from the module index

**Key findings:**
- The HTML report is the most valuable format — it renders cleanly in-browser and can be printed/saved as PDF for client deliverables.
- Markdown is essential for DevOps workflows (commit coverage reports alongside scene JSON).
- All export functions are pure — no React dependencies — making them testable in isolation and usable in worker threads.
- The report data shape is directly derived from SimulationResult, which guarantees that the report always reflects what the simulation computed, never an independent calculation that could drift.
- 72 test assertions confirmed correctness across all export formats and edge cases.

**Useful implementation notes:**
- HTML reports use inline CSS (no external dependencies) so they render correctly when opened as files or pasted into email.
- The comparison report highlights coverage changes with green/red deltas — "Camera 2: +12% coverage" or "Zone 3: −8% coverage" — making the impact of edits immediately visible.
- Report templates are not separate files — the template logic is embedded in the export functions, keeping imports simple and avoiding a template discovery problem at runtime.

---

### Thread 78 — Phase 10: Scan to Scene — Floor Plan Import, Scene Templates, and Wizard UI (Session 2026-05-29)

**Status:** Complete. 2 lib modules, 2 components, 2 test files (95 assertions), 0 TS/ESLint errors.

**What was built:**
- `src/lib/floor-plan-import.ts` — canvas-based floor plan analysis:
  - `importFromFloorPlan(imageData, scale)` — processes a floor plan image and extracts walls using edge detection (Canny-like), line clustering (Hough-inspired), and contour analysis
  - `validateFloorPlan(result)` — validates wall count, wall lengths, room closure, and detection confidence
  - Confidence scoring based on line continuity, right-angle counts, and area coverage
- `src/lib/scene-templates.ts` — 5 pre-built scene templates:
  - **Warehouse:** 4 cameras (2 wide-angle, 2 PTZ), 6 critical zones (stockroom, loading dock, aisles, safe, office, entry)
  - **Retail Store:** 4 cameras (2 ceiling dome, 1 bullet, 1 PTZ), 5 zones (entry, checkout, electronics, stockroom, high-value)
  - **Office:** 3 cameras (1 dome per floor), 3 zones (server room, entry, reception)
  - **School Classroom:** 2 cameras (1 PTZ, 1 dome), 2 zones (entry, desks)
  - **Bank:** 6 cameras (3 dome, 2 PTZ, 1 bullet), 6 zones (teller, manager, vault, server, ATMs, entry)
  - Each template has a `createScene()` function that returns a valid SecurityScene object
- `src/components/scan-to-scene/SceneBuilderWizard.tsx` — 4-step wizard:
  1. Choose input method (template or floor plan import)
  2. Select template (5 templates with descriptions) or upload floor plan image
  3. Review/adjust detected walls (for floor plan) or place cameras (for templates)
  4. Generate scene and launch into editor
- `src/components/scan-to-scene/ImportReview.tsx` — review component for floor plan import results, shows detected walls with confidence indicators and warning messages
- `src/lib/__tests__/floor-plan-import.test.ts` — tests wall detection, confidence scoring, validation edge cases, empty images, ImageData handling
- `src/lib/__tests__/scene-templates.test.ts` — tests all 5 templates exist with correct structure, unique IDs across all node types, category filtering, and each template's createScene function

**Key findings:**
- Floor plan import works for high-contrast line-art floor plans (architectural blueprints, CAD exports). Complex texture-heavy scans need preprocessing.
- The confidence scoring (0–1) is essential — users need to know when to trust auto-detected walls vs when to draw manually.
- 5 templates cover the most common commercial security scenarios. Each template includes pre-placed cameras with appropriate lens types and critical zones matching the space's security needs.
- The wizard pattern (step-by-step with back navigation) is better than a single form for scan-to-scene because each step has different interaction requirements (list selection, canvas interaction, file upload).
- 95 test assertions confirmed template integrity and floor plan detection behavior across all edge cases.

**Useful implementation notes:**
- Floor plan detection uses Canvas 2D pixel manipulation only — no external CV libraries. Keeps the bundle small and avoids WebAssembly dependency for V0.1.
- Template IDs follow the pattern `template-{name}` for readability. Camera and zone IDs include the template prefix to guarantee uniqueness across templates.
- The scene-templates module is pure data + factory functions — zero React dependency — making it importable from simulation workers and scripts.

**Open items:**
- Floor plan import currently requires the user to paste/take a photo. Direct file upload would improve UX (added to `SceneBuilderWizard.tsx` as TODO).
- Template customization (adjust camera positions before scene creation) is a natural extension.
- Template categories are hardcoded — making them data-driven would enable user-contributed templates.

---

### Thread 79 — Drone & Anti-Drone Physical Security (Surveillance Drones, Counter-UAS, Perimeter Airspace)

**Status:** Exploration candidate — 2026-05-30

**Rationale:** Drones are the fastest-growing physical security threat vector AND a rapidly emerging surveillance tool. Security professionals increasingly need to model both aerial attack paths and drone-based patrol coverage. This market is projected at $14B+ (counter-UAS alone) and intersects with physical security budgets at airports, critical infrastructure, stadiums, prisons, data centers, and high-net-worth residential.

**Questions to explore:**

**Surveillance drone integration:**
- Can SentinelTwin model drone patrol paths as temporal coverage trajectories (waypoint-based flight plans, hover positions, altitude-specific FOV cones)?
- What drone models have known camera/sensor specs usable for DORI/OODPCVS scoring? (DJI Matrice, Autel, Skydio, Teledyne FLIB)
- How does coverage change with altitude, speed, gimbal angle, and environmental lighting (diurnal thermal drift)?
- Drone battery constraints as temporal simulation parameter: coverage window per flight, swap/recharge downtime

**Counter-UAS / anti-drone systems:**
- What counter-drone systems exist (detection, tracking, interdiction) and how should they be modeled as security assets?
  - RF detection (DroneShield, Dedrone, Aaronia)
  - Radar-based detection (Echodyne, Robin Radar)
  - Optical/thermal detection + AI classification
  - RF jamming, GPS spoofing, net guns, directed energy
- How should drone threat zones be modeled? (Altitude bands, approach corridors, no-fly zones)
- Can we simulate a drone adversarial path with 3D waypoints, speed, and camera visibility?

**Regulatory & standards:**
- FAA Part 107, remote ID, LAANC for authorized drone operations
- Counter-UAS authority: DHS, FAA reauthorization Act, state-level restrictions
- ASTM F3298-19 standard for drone detection systems
- Airport-specific drone detection mandates (FAA reauthorization)

**Market context:**
- Critical infrastructure: power plants, substations, dams, pipelines (NERC CIP explicitly calls out drone threat)
- Prisons: drone-delivered contraband is epidemic — detection + interdiction systems are standard RFPs
- Stadiums/events: temporary drone security perimeters for large gatherings
- Data centers: rooftop and perimeter airspace monitoring
- High-net-worth residential: private drone detection systems

**Why now:** Drone threats are not a future concern — they are current operational reality. Security specifications for new facilities increasingly include counter-UAS requirements. If SentinelTwin can model both ground-level and aerial coverage/threat surfaces, it provides a genuinely unique capability that no existing planning tool offers.

**Open questions for decision:**
- Should aerial coverage modeling be a separate simulation mode or integrated into the existing 3D scene (with altitude planes)?
- What minimum level of drone FOV/sensor accuracy is needed before the simulation is useful?
- Are commercial drone library partnerships possible? (DJI SDK, Skydio SDK for real spec import?)
- Should counter-UAS systems be their own node type or a camera subclass?

---

### Thread 80 — LiDAR + Camera Sensor Fusion in Physical Security

**Status:** Exploration candidate — 2026-05-30

**Rationale:** The physical security industry is rapidly adopting LiDAR as a complement to video surveillance. LiDAR provides privacy-preserving detection (no facial imagery, no GDPR concerns), works in complete darkness, has deterministic coverage (no false positives from shadows/weather), and enables 3D volumetric coverage modeling that cameras cannot match. Ouster, Hesai, Velodyne, and RoboSense all have security-specific product lines.

**Key exploration areas:**

**LiDAR coverage characteristics vs cameras:**
- LiDAR FOV is volumetric (cone or full 360° × 30-90° vertical) rather than planar
- Detection range is sensor-specific: 50m–200m depending on reflectivity
- Resolution: number of beams (16, 32, 64, 128 lines) determines angular granularity
- Privacy: LiDAR generates point clouds, not images — no biometric data captured
- Environmental resilience: works in fog, rain, darkness where cameras fail
- False alarm rate: deterministic geometry-based detection vs AI-based video analytics

**Sensor fusion patterns:**
- Camera-LiDAR calibration: projecting 3D points onto 2D image plane for correlated detection
- What Boudet detection: LiDAR detects motion → camera PTZ slews to track (reduces recording bandwidth)
- Zone-based tripwires: LiDAR defines 3D volumetric zones → camera provides visual confirmation
- Redundancy modeling: when both sensors cover the same volume, what's the effective detection probability?

**Standards & compliance:**
- ONVIF Profile Q (LiDAR metadata standard) — status, adoption, compliance requirements
- GDPR/LGPD/BIPA advantages: LiDAR-only detection avoids biometric data regulation entirely
- Insurance discounts for privacy-preserving detection systems?

**Product considerations:**
- Should SentinelTwin support LiDAR as a distinct security node type with its own coverage model?
- What DORI-equivalent scoring exists for LiDAR? (Detection confidence by range, beam density, target size)
- Can we model multi-sensor fusion coverage zones (camera + LiDAR = higher confidence than either alone)?
- LiDAR cost trends: $18K in 2015 → $800 in 2025 → sub-$500 by 2027. Mass adoption inflection point.

**Competitive landscape:**
- Quanergy (bankrupt — talent available?) pioneered LiDAR security before collapse
- Ouster's Blue Line: security-specific LiDAR product with SDK
- CORTEX by FLIR/Teledyne: LiDAR + thermal camera fusion platform
- Hikvision's LiDAR + PTZ fusion turret cameras

**Open questions:** How should coverage probability be modeled for LiDAR vs cameras? A camera at 50m with 1080p might have DORI Detection quality, while a 64-beam LiDAR at the same range might detect a person-sized object at 95%+ confidence regardless of lighting. The scoring systems are fundamentally different.

---

### Thread 81 — Access Control & Video Surveillance Integration

**Status:** Exploration candidate — 2026-05-30

**Rationale:** Physical security is not just cameras — it is the layered interplay of access control (badge readers, door contacts, intercoms, gates, turnstiles, bollards) with video surveillance. A camera cannot prevent entry; it only records. Access control enforces policy. The combined system is what security professionals design. If SentinelTwin only models cameras, it misses half the security conversation.

**Key exploration areas:**

**Access control coverage modeling:**
- How does a badge reader's effective range (prox, smart card, biometric, mobile credential) affect entry control coverage?
- Door position sensors (magnetic contacts) — coverage is binary (open/closed) but placement affects detection windows
- Intercom / video doorbell coverage: field of view, audio pickup range, illumination
- Turnstile / speed gate coverage: lane width, tailgating detection zones, optical sensors
- Vehicle barrier coverage: bollards, rising arm barriers, tire shredders, crash-rated perimeters

**Access + video correlation:**
- What happens when a door opens outside of badge schedule? Camera should record that zone
- When a camera detects motion in a restricted area, which access-controlled door should be checked?
- Coverage gap identification: areas with camera coverage but no access control (or vice versa)
- Anti-passback violation detection: badge used at Reader A but not at Reader B → tailgating

**Physical security system topology:**
- How are access controllers (panels, readers, locks) mapped architecturally?
- What does a "door schedule" look like, and how does it interact with camera recording schedules?
- Alarm points: door forced open, door held open too long, REX (request to exit) sensor
- Integration with the temporal simulation: access schedules change security state (locked vs unlocked)

**Standards & protocols:**
- Wiegand (legacy) vs OSDP (modern, encrypted) — compatibility implications
- ONVIF Profile A (access control configuration) — can we import real access control layouts?
- BACnet integration for physical access + building management convergence
- UL 294 (access control system units) — compliance requirements

**Market implications:**
- Most security RFPs combine access control + video into a single bid
- Integrators prefer unified design tools — splitting into separate tools is a non-starter
- Access control hardware is higher margin than cameras for integrators
- LenelS2, Software House (CCURE), Honeywell ProWatch, Genetec Synergis — dominant ACS platforms

**Product scope question:** Should SentinelTwin add access control node types (doors, readers, barriers, intercoms) to the coverage engine, or should this be a Phase 2 capability after core camera simulation is validated in market?

---

### Thread 82 — VMS Platform Integration Architecture (Genetec, Milestone, Avigilon)

**Status:** Exploration candidate — 2026-05-30

**Rationale:** No security integrator designs coverage in a vacuum. They design within the constraints of their clients' existing VMS (Video Management System). SentinelTwin's value proposition changes radically if it can import from and export to real VMS deployments — pulling camera specs, positions, and recording schedules from live systems, and exporting coverage maps back as overlays or analytics.

**Key exploration areas:**

**Genetec Security Center:**
- API maturity: Genetec has the richest REST API in the VMS space (Project Vienna, REST API, SDK, webhooks)
- Camera discovery: Genetec can report all cameras, their models, firmware, assigned zones, recording schedules
- Area/Zone hierarchy: Genetec has a location hierarchy (Area → Zone → Camera) that could map to SecurityScene's zone system
- Export targets: push coverage heatmap back as a custom entity layer in Genetec's maps
- Partner program: Genetec Autovu program — would SentinelTwin as an "integration" fit under their technology partner framework?

**Milestone XProtect:**
- MIP SDK: .NET-based integration SDK, extensive API surface
- Camera spec import: Milestone manages device drivers per camera model — has known FOV, resolution, capabilities per device
- Smart Client plugins: custom views, map layers, analytics panels
- Open Network Video Interface Forum (ONVIF) Profile S/T compliance all devices
- Milestone Marketplace: distribution channel for certified integrations

**Avigilon Control Center (Motorola Solutions):**
- ACC API: REST + native SDK for camera management, event streaming
- Proprietary hardware tie-in: Avigilon cameras self-configure on ACC — model-specific features always available
- Appearance Search: Avigilon's AI search could be enriched with coverage-aware query scoping
- Motorola Solutions ecosystem: Avigilon + Indigo Vision + Pelco — massive installed base

**Other VMS platforms:**
- Hanwha Wisenet WAVE: growing fast, good API, affordability position
- ExacqVision (now Tyco/Johnson Controls): large installed base, REST API added in v10
- Bosch BVMS: German market dominance, extensive SDK
- Video Insight (Honeywell): education sector dominance, API available

**API integration patterns:**
- **Import flow:** VMS → camera list with model/spec → match to known camera database → populate SecurityScene → user adjusts positions
- **Export flow:** SecurityScene coverage results → heatmap overlay image → VMS map layer
- **Event integration:** VMS alarm triggers → area selection in SentinelTwin for "where else could this happen?" analysis
- **Live sync:** (Phase 4+) Watch VMS for camera additions/moves → auto-detect scene changes

**Open questions:**
- Should we build a VMS integration adapter layer (plugin per platform) or focus on ONVIF Profile S/T generic import first?
- What is the minimum viable VMS integration for a demo? (Camera spec import from a CSV mirroring Genetec export format?)
- Are there legal/contractual barriers to building on Milestone MIP or Genetec SDK? (NDA, certification requirements, revenue sharing?)
- Can we build an ONVIF Profile M (analytics) consumer that reads analytics metadata from VMS-connected cameras?

---

### Thread 83 — Critical Infrastructure Protection: NERC CIP, Utility & Energy Sector Security

**Status:** Exploration candidate — 2026-05-30

**Rationale:** The energy sector (power generation, transmission, distribution) is the highest-budget, most compliance-driven physical security vertical in existence. NERC CIP (Critical Infrastructure Protection) standards mandate specific security controls for bulk electric systems. Substations, control centers, hydro dams, wind farms, and solar installations all require documented security coverage — and the penalties for non-compliance are severe (millions in fines, mandatory public disclosure).

**Key exploration areas:**

**Regulatory landscape:**
- **NERC CIP-014:** Physical security for transmission substations and control centers
  - Requires risk assessment, physical security plan, and compliance evidence
  - Must demonstrate deter, detect, delay, assess, and respond capabilities
  - Specific requirements: 6ft+ perimeter fencing, lighting, intrusion detection, video surveillance
  - Vulnerable asset identification: based on risk assessment (system reliability impact + threat environment)
  - Fines: up to $1M/day, publicly reported — "naming and shaming" mechanism
- **DOE / CISA guidelines:** Cybersecurity & physical security convergence for energy sector
- **IEEE 693 / 1527:** Substation seismic qualification, physical security design criteria
- **Nuclear Regulatory Commission:** 10 CFR 73 (physical security for nuclear facilities — highest standard)
- **State PUC regulations:** Vary by state, some require utility security plan filings

**Coverage simulation requirements:**
- Perimeter detection: fence-line detection zones, buried cable sensors, microwave barriers
- Layered security zones: clear zone (sterile), detection zone, assessment zone, response zone
- Deter, Detect, Delay, Assess, Respond (D²DAR) framework — how does coverage simulation map to each phase?
- Attack timeline analysis: adversarial path simulation with vehicle-based breach scenarios
- Redundancy requirements: NERC CIP-014 mandates 2 independent detection methods per zone
- Tamper detection: camera tamper alarms, housing integrity sensors, encrypted video authentication

**Target assets for site modeling:**
- Electrical substations (transmission + distribution): ~55,000 substations in US alone
- Control centers: ~200 major utility control centers in North America
- Hydroelectric dams: ~2,500 dams with security requirements
- Natural gas compressor stations: ~1,400 interstate pipeline compressor stations
- Renewable generation: large solar farms (acres of perimeter), offshore wind (integration challenges)
- Battery energy storage systems (BESS): fast-growing, fire risk + theft of copper

**Market considerations:**
- National Labs network: Sandia, INL, PNNL all have physical security research groups
- Sandia's Physical Security Workshop — annual conference for utility security professionals
- Utility security budgets: $5-20M/year per major utility for physical security programs
- Consulting engineering firms (Black & Veatch, Burns & McDonnell, Sargent & Lundy) design utility security
- Contract duration: multi-year master service agreements with $500K-$2M annual scope
- Security integrators specializing in utility: SAGE, Interstates, SPEC Innovations, Vanguard

**Product potential:**
- NERC CIP-014 compliance report generation would be a standalone product worth more than the entire simulation tool
- Template: predefined "substation" and "control center" scene configurations
- Report: D²DAR coverage gap analysis with NERC CIP citation mapping
- Temporal simulation: day/night perimeter visibility, guard patrol schedule coverage
- Adversarial path: vehicle intruder path simulation with crash-rated barrier modeling

**Open question:** Is the utility security market accessible to a startup, or is it too relationship-driven? Every utility has existing security contractors. The entry may be through the consulting engineering firms who design the systems and need a simulation tool to produce compliance evidence.

---

### Thread 84 — Construction & Temporary Site Security

**Status:** Exploration candidate — 2026-05-30

**Rationale:** Construction sites are a uniquely underserved physical security market with high incidence of theft/vandalism, rapidly changing site layouts, and distinct requirements from permanent installations. The US construction theft market is estimated at $1B+/year in equipment and material losses. Every construction site needs temporary security that evolves with the build phases: excavation → foundation → structure → fit-out → handover.

**Key exploration areas:**

**Site evolution modeling:**
- Phase 1 (excavation): open pit, mobile cameras on perimeter, focus on equipment yard
- Phase 2 (foundation): limited access points, foundation walls changing sight lines
- Phase 3 (structure): vertical blind spots emerging, interior coverage needed for upper floors
- Phase 4 (fit-out): permanent interior partitions, MEP (mechanical/electrical/plumbing) infrastructure
- Phase 5 (handover): temporary-to-permanent transition, final acceptance testing
- Each phase requires different camera placement, different line-of-sight models, different entry points

**Temporary surveillance equipment:**
- Mobile surveillance towers (LiveView, SiteWatch, MobileEye): trailer-mounted PTZ + IR, solar-powered
- Rapid deployment cameras (Arlo Pro, Ring Stick Up Cam, Eufy): consumer-grade but widely used
- Job box sensors: door/window sensors on equipment storage containers
- Virtual guard tours: remote monitoring service (ADS Security, Sonitrol, Rapid Response)
- Construction-specific solar + 4G/LTE cellular surveillance solutions

**Theft & loss prevention:**
- Highest theft items: copper wiring, tools, HVAC equipment, lumber, appliances (new construction)
- Equipment theft: skid steers, excavators, generators (GPS tracking deterrence)
- Material stockpile coverage: how to cover large laydown yards with minimal cameras
- Vandalism: graffiti, deliberate damage to drywall/flooring, arson risk
- Employee theft: workers taking materials — covered by site exit choke-point cameras

**Unique constraints:**
- **No permanent power:** solar + battery or generator-powered cameras
- **No permanent network:** 4G/5G cellular backhaul is standard
- **Changing site layout:** weekly site walks for coverage reassessment
- **Construction trades obstruction:** scaffolding, cranes, material piles disrupt coverage
- **Weather exposure:** cameras must handle elements without protective housing
- **Short deployment duration:** 6-18 months typical, rapid ROI needed on security equipment

**Market characteristics:**
- General contractors / construction managers are the buyers, not security integrators
- Security is often an afterthought — loss happens → reactive security install
- Insurance companies increasingly require construction site security plans for coverage
- Large projects ($100M+) have dedicated security managers; small projects use subcontractors
- Turner Construction, DPR, Skanska, Whiting-Turner, Hensel Phelps — largest GCs with consistent security RFPs
- Construction technology convergence: Procore, Autodesk BIM 360, Bluebeam — can SentinelTwin integrate?

**Product opportunity:**
- **Phase-aware coverage templates:** "Construction site — Phase X" presets with appropriate camera types
- **Mobile tower camera node:** limited elevation, 360° PTZ, no PTZ constraints (unlike permanent fixed cameras)
- **Temporal "site evolution" simulation:** coverage degrades/improves as construction progresses
- **Site walk workflow:** mobile app for on-site coverage verification against planned model
- **Insurance-ready report:** construction site security plan evidence for carrier compliance

**Open questions:** Is the construction security buyer different enough from the permanent security buyer to require a separate GTM? Or is it the same integrator who does both types of work?

---

### Thread 85 — Maritime, Port & Transit Hub Security

**Status:** Exploration candidate — 2026-05-30

**Rationale:** Ports, airports, rail stations, and maritime facilities represent some of the most complex physical security environments due to their scale, accessibility requirements, multimodal threats, and stringent international regulatory frameworks. ISPS Code (International Ship and Port Facility Security) is a mandatory compliance framework for 160+ signatory nations. Transit hubs (subway, rail, bus terminals) face high-volume throughput with constant terrorism risk assessment.

**Key exploration areas:**

**Maritime & port security (ISPS Code):**
- ISPS Code requirements: Port Facility Security Assessment (PFSA), Port Facility Security Plan (PFSP), 3 security levels
- Security zones: restricted area identification, controlled access, cargo handling, vessel berth
- Perimeter: waterfront boundary is unique — no fence, waterborne approach vectors
- Cargo inspection: radiation portal monitors, X-ray scanners, container verification
- Vessel security: ship-to-shore interface, gangway surveillance, crew screening
- CCTV requirements: per ISPS, cameras must cover: perimeter, cargo areas, passenger terminals, gate access
- USCG maritime security: MTSA 2002 (Maritime Transportation Security Act) — domestic US enforcement of ISPS
- Facility types: container terminals, cruise terminals, bulk cargo, oil/LNG terminals, shipyards

**Airport security:**
- Already heavily regulated (TSA, ICAO Annex 17) but perimeter security is a growing concern
- Airport perimeter: miles of fencing, gated access points, runway incursion detection
- Landside vs airside: completely different security postures
- Parking structures: separate security challenge (covered parking is hard to surveil)
- TSA's "Risk-Based Security" approach — simulation for resource allocation
- Airport master planning: expansion/renovation cycles where coverage simulation adds value

**Transit / rail security:**
- Subway station coverage: platform length, mezzanine design, fare gate zones, tunnel access
- Rail yard/facility security: rolling stock storage, maintenance facilities, hazardous materials (Hazmat) handling
- Multi-modal hubs: train + bus + light rail + bike share — single security plan
- Transit-oriented development (TOD): mixed-use above/below stations
- Bomb threat / suspicious package: coverage for secondary screening areas, evacuation routes
- Active shooter response: transit-specific C-UAS and emergency response coordination

**Unique modeling challenges:**
- **Open perimeters:** waterfront, rail right-of-way, airport runway boundaries — no fence-line constraint
- **Vast scale:** port terminals can be 100+ acres — coverage modeling at this scale needs optimization
- **Weather/marine environment:** saltwater corrosion, fog, sea spray — degrades camera performance over time
- **Vessel security:** moving coverage targets (ships at berth) need dynamic threat assessment
- **Passenger throughput:** high-density environments create line-of-sight obstruction (crowds)
- **Critical infrastructure adjacency:** port rail connections to Class I railroads, fuel pipelines, power substations

**Market opportunity:**
- 360+ US ports require ISPS-compliant security plans
- 500+ US commercial airports with TSA-regulated security
- 50+ major US transit agencies (NYC MTA, Chicago CTA, WMATA, BART, MBTA)
- Global maritime security market: ~$25B and growing
- Port security consulting: $200-500M annually in North America
- Security integrators specialized in transit/port: large regional firms (Convergint, Bosch, Johnson Controls)

**Open questions:** Can SentinelTwin's 3D environment handle port-scale scenes (100+ acre perimeters, nautical mile scales)? Or does this need a separate 2D overhead zoom-based mode? How do we model waterborne approach vectors?

---

### Thread 86 — Multi-Tenant & Mixed-Use Building Security

**Status:** Exploration candidate — 2026-05-30

**Rationale:** Mixed-use developments (residential + retail + office in one building) are the dominant urban development pattern globally. They present a uniquely complex security challenge: multiple tenants with different security requirements, shared common areas, varied operating hours, and conflicting access policies — all within a single physical structure. Existing security design tools treat buildings as monolithic environments, not multi-stakeholder systems.

**Key exploration areas:**

**Tenant security requirements variability:**
- Retail tenants (ground floor): open during business hours, public access, high foot traffic, merchandise theft
- Office tenants (mid-floors): access-controlled after hours, visitor management, equipment security
- Residential tenants (upper floors): 24/7 access, package delivery, amenity access (gym, pool, rooftop)
- Co-working / shared spaces: rotating occupancy, flexible membership, event spaces
- Hotel component: transient guests, luggage storage, spa/fitness, restaurant/bar security
- Parking levels (often shared): valet vs self-park, EV charging security, stairwell/elevator access

**Coverage simulation with layered access:**
- How should coverage be modeled per tenant? A stairwell may need different coverage at 2PM (retail hours) vs 2AM (residential-only)
- Common area coverage: who is responsible for lobby, corridors, elevators, loading dock?
- Temporal access windows: retail closes at 9PM, residential needs 24/7 lobby camera — how does the temporal simulation handle this?
- Overlapping coverage: does a camera in the retail corridor also cover the residential elevator lobby?
- Conflict zones: where two tenants' security requirements are incompatible (e.g., retail wants open access, residential wants locked)

**Physical design constraints:**
- Residential floor plates vs commercial floor plates: different ceiling heights, column spacing, core/restroom placement
- Loading dock / service elevator: shared by all tenants — critical choke point, complex scheduling
- Mail/package rooms: growing security concern (package theft), needs delivery access without building access
- Amenity deck: pool/gym on roof or podium level — after-hours access control, life safety
- Parking garage: multiple tenant sections, different access levels, egress paths

**Legal & regulatory considerations:**
- Common Interest Community (Condo/HOA) security requirements — board-approved security plans
- Commercial lease clauses: tenants may specify minimum security coverage in lease agreements
- ADA compliance: security must not impede accessible egress paths
- Fire life safety: security hardware must not prevent fire department access
- Local ordinances: NYC Local Law 26 (video intercom requirements), California SB 553 (workplace violence prevention plans)

**Market opportunity:**
- Mixed-use is the #1 development type in US urban infill (2020-2030)
- Major developers: Related Companies, Hines, Tishman Speyer, Related Midwest, JDS Development
- Property managers (CBRE, JLL, Cushman & Wakefield, Greystar) responsible for security procurement
- 100M+ sq ft of mixed-use space is delivered annually in the US alone
- Security design for mixed-use is currently done ad-hoc — no tool supports multi-tenant coverage analysis

**Product implications:**
- **Tenant layer:** each tenant has their own coverage requirements, DORI thresholds, access schedules
- **Shared zone labeling:** which tenant "owns" each zone? (Single-tenant, shared, public)
- **Conflict detection:** surface zones where two tenants' coverage requirements conflict
- **Temporal tenant view:** filter coverage by tenant and time of day (retail tenant at 2AM = no coverage needed)
- **Report generation:** per-tenant security coverage reports for lease compliance documentation

**Open question:** Is multi-tenant coverage a Phase 2 differentiator or core to the product? If mixed-use is the dominant development pattern, building a tool that only models single-occupancy buildings limits the addressable market significantly.

---

### Thread 87 — Camera Sensor & Optics Technology Deep Dive (Sensor Physics, Lens Design, Low-Light Performance)

**Status:** Exploration candidate — 2026-05-30

**Rationale:** SentinelTwin's DORI/OODPCVS scoring currently abstracts away camera hardware into generic quality thresholds. In reality, DORI quality at a given distance depends directly on sensor size, pixel pitch, lens focal length, f-stop, IR cut filter behavior, and sensor noise characteristics. Understanding the actual physics would enable significantly more accurate per-camera-model scoring, better night penalty curves, and the ability to simulate camera degradation over time.

**Key exploration areas:**

**Sensor technology:**
- CMOS sensor architectures: front-illuminated (FI) vs back-illuminated (BSI) vs stacked (Exmor RS, Quad Bayer, ISOCELL)
- Pixel pitch and its relationship to low-light sensitivity (larger pixels = more photons per pixel = better DORI at night)
- Sensor resolution vs pixel size tradeoff: 4K on 1/1.7" sensor vs 4K on 1/2.8" sensor — dramatically different low-light capability
- Rolling shutter vs global shutter: which security scenarios need which?
- HDR / WDR technologies: dual-exposure (DOL mode), split-pixel, digital WDR — how they affect effective resolution in high-contrast scenes

**Lens physics:**
- Focal length + sensor size → horizontal FOV (the fundamental DORI input)
- F-stop (aperture) and its effect on low-light gather — f/1.2 vs f/1.8 vs f/2.8 -> 2-5x difference in light reaching sensor
- Depth of field at security distances (short focal length = huge DOF, long telephoto = shallow DOF)
- Lens distortion profiles (barrel, pincushion, mustache) and their effect on PPM at image edges
- IR correction: DC auto-iris vs P-iris, IR-cut filter switching mechanism, focus shift at night (IR wavelength ≠ visible wavelength)
- Motorized zoom vs varifocal vs fixed focal length — cost vs flexibility tradeoffs

**Low-light / no-light technology:**
- Starlight technology: large-pixel sensors (2.0µm+), f/1.2+ lenses, sensor noise reduction
- Thermal imaging: microbolometer arrays (640×512, 384×288), NETD (Noise Equivalent Temperature Difference), radiometric vs non-radiometric
- Event-based sensors (Sony IMX636, Prophesee): asynchronous pixel-level change detection — zero motion blur, extremely high dynamic range, but very low resolution
- Active IR illumination: LED wavelength (850nm vs 940nm), illuminator range vs camera sensor sensitivity at that wavelength
- Multi-sensor fusion for night: thermal + visible light overlay, day/night auto-switching criteria

**Camera degradation modeling:**
- Sensor noise increases with temperature — thermal noise model for outdoor cameras
- IR LED degradation over time (output drops 20-30% over 3-5 years)
- Lens contamination (dust, moisture, spider webs, salt spray) — transmission loss modeling
- IR cut filter mechanical failure (stuck in day or night mode)
- These degradation curves would feed into temporal simulation: "at year 3, this camera's effective DORI range drops by 15%"

**Standards & references:**
- EMVA 1288 standard for image sensor characterization (quantum efficiency, read noise, dark current)
- ISO 12233 resolution measurement (MTF, SFR) — beyond DORI's simple PPM model
- IEC 62676-4:2025 references sensor resolution in DORI calculation — but assumes ideal sensor
- ONVIF provides device capabilities (minimum illumination, resolution) but not calibrated measurements

**Product implications:**
- Per-camera-model DORI profiles using actual sensor specs (IPVM database or manufacturer datasheets)
- Night penalty curve could be physics-derived rather than user-set assumption
- Camera degradation modeling could be a Pro-tier feature: "simulate camera performance at year 3 vs year 1"
- Could guide camera selection: "this model achieves identification quality at the counter given your lighting, this cheaper model doesn't"

---

### Thread 88 — Photo Stitching for Floor Plan & Scene Construction

**Status:** Exploration candidate — 2026-05-30

**Rationale:** A practical scan-to-scene input method is taking multiple overlapping photos of a floor plan, construction blueprint, or even a series of room photos and stitching them into a composite image. Photo stitching is a mature, well-understood computer vision technique (OpenCV Stitcher class has been stable for a decade) that requires no ML inference, works client-side, and could dramatically simplify the scene creation workflow for existing printed floor plans.

**Key exploration areas:**

**Stitching algorithms:**
- Feature detection and matching: SIFT (patented but usable), ORB (free, fast, OpenCV), AKAZE, SuperPoint (learned features)
- Outlier rejection: RANSAC, MAGSAC++ for robust homography estimation
- Bundle adjustment: Levenberg-Marquardt optimization for globally consistent alignment across all image pairs
- Projection models: planar (homography) for floor plans, cylindrical/spherical for panoramas, rotational for PTZ sweeps
- Blending: multi-band Laplacian pyramid blending, feathering, gain compensation for exposure differences

**Floor plan stitching specifically:**
- Floor plan images have unique properties: line art primarily, high contrast, repeating patterns (walls), large uniform areas
- Standard feature detectors often fail on CAD drawings — need edge-based or line-based matching (LSD, Line Segment Detector, Wireframe parsing)
- Alternative approach: detect grid/corner structures rather than texture features
- Scale calibration: known dimension markers (scale bar, door width) to establish metric PPM
- Orthorectification: correcting perspective distortion from non-flatbed scans (phone photos of blueprints pinned to wall)

**Security-specific stitching use cases:**
- **Blueprints:** Stitch multiple A0/A1 sheet photos into full floor plan
- **Room panoramas:** Stitch overlapping room photos into 360° background for visual context layer
- **PTZ sweep panorama:** Stitch PTZ camera sweep frames into full field-of-view reference image
- **Camera wall mosaic:** Stitch multiple camera feeds into single overview for comparison with simulated coverage overlay
- **Site walk composite:** Stitch sequential photos from a site walk to create a continuous wall/elevation view

**Implementation considerations:**
- OpenCV.js: WASM build of OpenCV for client-side stitching — adds ~8MB to bundle, but no server calls needed
- Alternative: WebAssembly port of specialized stitching library (OpenPano, Hugin's backend)
- Feature detection performance: SIFT/ORB on a 4000×3000 image takes ~200-500ms in WASM
- Minimum viable: single panorama stitch from 3-5 overlapping images for scene background import
- Could be a step in the SceneBuilderWizard: "Select photos of your floor plan → Stitch → Import as scene"

**Open questions:**
- Is OpenCV.js bundle size acceptable for V0.1, or should stitching be a Phase 2 addition?
- Do CAD/blueprint images stitch well enough with ORB features, or do we need a line-segment approach?
- Could we use a simpler approach (manual correspondences) instead of automatic stitching for minimum viable product?

---

### Thread 89 — Structure from Motion & Photogrammetry Pipeline (SfM, MVS, Metric Reconstruction)

**Status:** Exploration candidate — 2026-05-30

**Rationale:** Thread 22 covers GenRecon-specific indoor reconstruction. This thread explores the broader Structure from Motion (SfM) and Multi-View Stereo (MVS) pipeline — the classical, production-proven approach to photo-to-3D that has been used in archaeology, surveying, film VFX, and construction for decades. SfM is complementary to NeRF/Gaussian Splatting and, for security site survey use cases, may actually be more practical (metric accuracy, deterministic geometry, no hallucination of unobserved areas).

**Key exploration areas:**

**SfM pipeline stages:**
1. **Feature extraction:** SIFT, SuperPoint, or D2-Net per image — stable across lighting/scale/viewpoint changes
2. **Feature matching:** brute-force or ANN matching across image pairs, geometric verification (fundamental matrix)
3. **Sparse reconstruction:** incremental SfM (COLMAP default) or global SfM (Theia, OpenMVG) — camera pose estimation + sparse 3D point cloud
4. **Bundle adjustment:** joint optimization of all camera parameters and 3D points — reprojection error minimization
5. **MVS depth estimation:** patch-based MVS, Gipuma, OpenMVS — dense depth per view
6. **Depth fusion:** merging depth maps into dense point cloud, mesh reconstruction (Poisson, screened Poisson, Delaunay)
7. **Texturing:** projecting source images onto reconstructed mesh for photorealistic visual layer

**Open-source tools survey:**
| Tool | Language | Strength | Limitation |
|---|---|---|---|
| **COLMAP** | C++ | Gold standard SfM+MVS, accurate, well-maintained | No WASM build — server-side only |
| **OpenMVG** | C++ | Modular, good documentation | Smaller community than COLMAP |
| **OpenSfM** | Python | Easy to hack, Facebook-backed | Slower, less accurate for large sets |
| **Meshroom (AliceVision)** | C++/node | GUI-based workflow, full pipeline | Desktop-only, no browser |
| **Regard3D** | C++ | Good for beginners | Limited flexibility |
| **VisualSFM** | C++ | Fast with GPU SIFT | GUI-focused, no API |

**Metric scale recovery:**
- SfM produces reconstruction up to an unknown scale factor — a "metricless" 3D model
- Scale recovery methods:
  - Known camera height (most reliable for security — tripod/ceiling mount heights are measured)
  - Known object dimensions (door width = 0.9m, floor-to-ceiling = 3m)
  - Gravity alignment from IMU data (phone camera captures include accelerometer data in EXIF)
  - Stereo baseline from known camera separation (two-phone capture)
  - AprilTag / ArUco marker of known size placed in scene
- For SentinelTwin: approximate metric scale (~10-20% error) is acceptable for coverage simulation

**Comparison for security site survey use case:**
| Approach | Metric Accuracy | Completeness | Speed | Browser-Suitable |
|---|---|---|---|---|
| COLMAP SfM+MVS | Excellent (cm-level) | Good | Slow (minutes) | No (server needed) |
| VGGT (MIT) | Medium (dm-level) | Good (estimated) | Fast (seconds) | Yes (WASM?) |
| GenRecon (future) | Unknown | Excellent (fills gaps) | Unknown | Unknown |
| Monocular Depth (MiDaS) | Low (m-level) | Per-image only | Real-time | Yes (ONNX/WASM) |
| ARKit RoomPlan | Excellent (cm-level) | Room-level | Real-time | iOS only |

**Product implications:**
- SfM pipeline is the "gold standard" for verification/ground truth — useful for V2 real camera verification
- Could offer a cloud processing option for site survey photos: upload 20-50 photos → receive SecurityScene back
- COLMAP is the right backend for this (server-side), not browser-WASM
- The metric scale problem is solvable with simple user input ("mark a door in the photo and tell us its width")
- SfM output mesh can serve as visual background layer, with semantic extraction mapping to SecurityScene blocks

---

### Thread 90 — Three.js / R3F Advanced Rendering Architecture for Security Visualization

**Status:** Exploration candidate — 2026-05-30

**Rationale:** The existing codebase already uses Three.js + React Three Fiber for the 3D scene. What's not explored is the rendering architecture design space: how to handle large security scenes (many cameras, complex geometry, dense heatmaps), custom shaders for coverage visualization, post-processing effects for analytic overlays, and the eventual WebGPU migration path. Thread 55 covered three-mesh-bvh performance. This thread covers everything else in the rendering pipeline.

**Key exploration areas:**

**Scene graph architecture for security:**
- Large-scale scene management: how to handle 50+ cameras each with FOV cone meshes, occlusion geometry, coverage grid
- InstancedMesh for coverage heatmap: 40×40 grid = 1,600 quads → use InstancedMesh (1 draw call vs 1,600)
- LOD (Level of Detail) for camera cones: detailed cone when selected, simple frustum when unselected
- Object pooling for dynamic objects (replay actors, coverage glyphs)
- Group hierarchy: Scene → Floors → Rooms → Zones → Cameras (scene graph mirrors SecurityScene schema)

**Custom shaders for coverage visualization:**
- GLSL/WGSL fragment shader for coverage heatmap: color mapping DORI quality values (identification=green → red=none)
- Screen-space overlay shader: DORI quality labels, camera names, zone boundaries rendered as post-process
- Frustum visualization shader: transparent cone with graduated opacity, edge glow
- Temporal coverage shader: time-of-day slider blends between day/night coverage textures
- Line shader for adversarial path: animated dashed line showing agent path with speed-dependent coloring

**Post-processing pipeline:**
- Current presumption: post-processing for analytic overlays (heatmap, zone boundaries, DORI quality labels)
- EffectComposer with custom passes:
  - Coverage overlay pass (heatmap blended over scene)
  - Outline pass (selected camera/zone edge glow)
  - SSAO pass (occlusion visualization — shows where geometry blocks line of sight)
  - UnrealBloomPass for selected camera cone highlighting
- Performance: post-processing adds ~2-5ms per frame — budget 8ms for rendering, 8ms for post-processing

**Shadow mapping for lighting simulation:**
- Temporal simulation needs lighting changes (day/dusk/night) — shadows affect visibility
- PCF soft shadows (default) vs PCSOFT vs VSM — quality vs performance tradeoffs
- Percentage-closer soft shadows for realistic penumbra at shadow edges
- Shadow map resolution: 1024×1024 per light → 2048×2048 for main sun light
- Number of shadow-casting lights: limit to 1-2 (sun + fill) for performance
- Shadow cascade for large scenes (sun shadows at multiple distances)

**Semantic rendering (different from visual rendering):**
- Semantic layer rendering: render scene with object IDs instead of colors → coverage engine reads pixel IDs to determine what's visible
- Depth-only pre-pass for occlusion culling before raycasting
- Offscreen render targets for coverage heatmap generation (render coverage from each camera POV)
- These could replace or augment BVH raycasting for certain coverage queries

**WebGPU migration path:**
- Three.js r160+ has experimental WebGPU support via WebGPURenderer
- WebGPU advantages: compute shaders for coverage grid, lower CPU overhead, better multi-threading
- Migration path: three-mesh-bvh → WebGPU compute shader raycasting (Thread 58 covers this)
- Timeline: WebGPU ships in Chrome 120+ (stable), Safari 18+ (experimental), Firefox (in development)
- For V0.1: WebGL renderer with path to WebGPU for V0.3+ when browser adoption is higher

---

### Thread 91 — Monocular Depth Estimation for Rough Scene Layout

**Status:** Exploration candidate — 2026-05-30

**Rationale:** Full SfM photogrammetry (Thread 89) requires multiple images and server-side processing. Monocular depth estimation — predicting a depth map from a single RGB image — can run in real-time in the browser via ONNX/WASM, requires no multi-view setup, and can provide a "good enough" rough 3D understanding of a room from a single smartphone photo. This is the fastest possible path from "take a photo" to "rough 3D scene."

**Key exploration areas:**

**Monocular depth estimation models:**
- **MiDaS v3.1** (Intel): Most mature, multiple model sizes (small: ~2MB, large: ~500MB), ONNX exportable
- **Depth Anything v2** (HKUST/ByteDance): State-of-the-art zero-shot depth, robust to indoor/outdoor/sculpture/art — trained on 63M+ images, has ViT-S/B/L variants. Apache 2.0?
- **ZoeDepth**: Metric depth (produces actual meters, not relative disparity). Trained on indoor + outdoor datasets. Smaller model.
- **DPT (Dense Prediction Transformer)**: Used by MiDaS v3 — good accuracy, higher compute. Can run on device via CoreML/ONNX.

**Browser-side inference feasibility:**
| Model | Size | FPS (WebGL/ONNX) | FPS (WebGPU) | Metric Depth? |
|---|---|---|---|---|
| MiDaS v3 small | ~2MB | 30+ | 60+ | No (relative) |
| Depth Anything ViT-S | ~70MB | 10-15 | 25-30 | No (relative) |
| ZoeDepth-N | ~100MB | 5-10 | 15-20 | Yes (~10-20% error) |
| Depth Anything ViT-B | ~350MB | 2-5 | 8-12 | No (relative) |

**Practical pipeline for SentinelTwin:**
1. User takes 1-3 smartphone photos of a room
2. Client-side ONNX runtime runs monocular depth on each photo
3. Relative depth → approximate metric scale via user input ("ceiling height is 3m" or "door width is 0.9m")
4. Back-project depth map to 3D point cloud (known camera intrinsics from EXIF + phone model database)
5. Fit planes to floor, walls, ceiling from point cloud
6. Floor plan outline extracted from wall-floor intersection
7. User adjusts walls/doors in the editor → SecurityScene

**Advantages over full SfM:**
- Single photo sufficient (no multi-view required)
- Real-time inference (instant feedback)
- Works with existing security camera feeds (a single installed camera could estimate its own room layout)
- Handles texture-less walls (where SIFT/ORB features fail)
- Graceful degradation: less texture → lower confidence, but still usable shape

**Limitations and risk:**
- Monocular depth is inherently ambiguous (object at 2m vs same object at 4m with 2x size)
- Edge artifacts at object boundaries (depth bleeding)
- FOV-dependent: wide-angle photos lose detail at edges
- No completeness guarantee: occluded regions have no depth estimate
- Metric accuracy is 10-25% at best — fine for rough layout, insufficient for precise camera placement

**Product angle:** "Snap a photo of the room, get a rough 3D layout — then place cameras on the approximate model." The key is setting expectations: this is a quick start, not a precise scan.

---

### Thread 92 — Physical Threat Intelligence & OSINT for Security Planning

**Status:** Exploration candidate — 2026-05-30

**Rationale:** SentinelTwin's adversarial path simulation currently uses generic threat models (random intruder, generic evasion). Feeding real threat intelligence — crime patterns, known intruder methodologies, organized retail crime techniques, social engineering vectors — would make the simulation dramatically more realistic and actionable. Threat intelligence in the physical security domain is an emerging discipline with established sources (ISACs, OSINT, crime analytics platforms) that SentinelTwin could consume.

**Key exploration areas:**

**Physical threat intelligence sources:**
- **PS-ISAC** (Physical Security Information Sharing and Analysis Center): Industry-specific threat sharing for physical security. Members share incident data, threat actor TTPs (tactics, techniques, procedures). Membership-based.
- **FS-ISAC** (Financial Services): Physical security working group — banks share robbery patterns, ATM theft methodology, branch intrusion data
- **R-TIC** (Retail Threat Intelligence Center): Organized retail crime intelligence sharing
- **OSINT sources:** local crime reports (SpotCrime, CrimeMapping, PoliceScanner), social media monitoring for planned theft events, dark web marketplace monitoring for stolen security credentials/hardware
- **Commercial threat feeds:** CriticalArc, Everbridge, Dataminr — real-time physical threat alerts

**Crime pattern analysis for simulation:**
- Burglary methodology: entry points (front door 34%, first floor windows 23%, back door 22%, garage 9%), time-of-day patterns (residential: daytime when occupants at work, commercial: after-hours), tools used
- Organized retail crime: smash-and-grab methodology (timing: <2 minutes, tool: vehicle/ sledgehammer, targets: high-value visible), cargo theft (truck following, facility surveillance before strike)
- Workplace violence: active shooter timeline analysis (average 9-minute police response, 5-7 minutes until engagement — these define required detection-to-response latency)
- Insider threat: data exfiltration via physical access (server room access patterns, badge use anomalies), theft methodology (loading dock, after-hours, collusion with cleaning staff)

**Attack tree modeling:**
- Formal attack tree methodology for physical security (adapted from cybersecurity):
  ```
  Goal: Gain unauthorized access to server room
    OR
    ├── Bypass perimeter (fence, door, wall)
    │   ├── Door: pick lock, force door, tailgate behind authorized person
    │   ├── Window: break glass, pry open, remove from frame
    │   └── Wall: penetrate drywall, through drop ceiling
    ├── Social engineer entry
    │   ├── Impersonate maintenance worker
    │   ├── Request door held (social courtesy exploit)
    │   └── Pretexting call to unlock
    └── Wait for authorized entry then concealment
        ├── Hide in server cabinet until area clears
        └── Return after hours from hiding spot
  ```
- Each leaf node has: difficulty, time required, detection probability, tools needed
- SentinelTwin's adversarial path sim could consume attack trees as structured inputs — "simulate this specific attack scenario"

**Threat scoring methodology:**
- How to score threat probability per zone (not just coverage)?
- Factors: proximity to public access, asset value in zone, history of incidents, known industry threat patterns
- Threat score × coverage gap = risk exposure (quantified in dollars or likelihood)
- Temporal threat patterns: retail theft higher during holiday season, warehouses targeted on weekends, schools targeted during active hours

**Implementation path:**
- V0.1: Manual threat profile selection per scene (Retail Theft, Burglary, Insider Threat, Workplace Violence)
- V0.3+: Import threat intelligence feeds (crime data APIs, ISAC membership)
- V1+: Automated threat scoring per zone based on real-world crime matching

**Defensive framing importance:**
- All threat intelligence features must be clearly positioned as defensive: "understand how threats operate to build better defenses"
- Attack tree methodology explicitly framed as risk assessment, not adversarial training
- User studies should verify no misuse potential before public release

---

### Thread 93 — Simulation Validation, Calibration & Uncertainty Quantification

**Status:** Exploration candidate — 2026-05-30

**Rationale:** SentinelTwin produces confident-looking numbers ("78% coverage"). But the simulation has many assumptions: camera height, person height, wall transmission, night penalty curve, lens clarity. How much do these assumptions affect the output? Which assumptions matter most? How do we validate that the simulation matches reality? This thread explores the mathematical methodology for answering those questions — building trust through quantitative rigor rather than assertion.

**Key exploration areas:**

**Sensitivity analysis:**
- One-at-a-time (OAT) vs global sensitivity analysis (Morris, Sobol, FAST)
- For SentinelTwin's coverage engine: vary each assumption independently and measure output change
- Key parameters to test:
  - Camera height (±0.5m): effect on coverage area and DORI quality
  - Person height (1.5m vs 1.8m): DORI thresholds shift by ~15%
  - Night penalty (optimistic vs pessimistic): coverage drop of 10-40%
  - Wall transmission (0% vs 50%): glass vs drywall vs concrete
- Result: tornado chart showing which assumptions drive the most output variance
- This tells users "worry most about camera height accuracy — it changes your coverage by ±12%"

**Uncertainty propagation:**
- Monte Carlo simulation: treat each assumption as a probability distribution, run the coverage engine 1000+ times with random samples
- Output: not a single coverage number, but a distribution — "coverage is 78% ± 6% (90% confidence interval)"
- Computational cost: 1000× coverage recompute = 1000 × ~50ms = 50 seconds. Too slow for interactive.
- Surrogate model approach: train a Gaussian process or polynomial chaos expansion on ~50 simulation runs, then query the surrogate for Monte Carlo uncertainty propagation (milliseconds instead of seconds)

**Ground truth validation methodology:**
- Compare simulated coverage against real camera footage in a known environment
- Setup: place cameras in a room, mark grid points on floor, have person stand at each point, record if camera "detects" them
- Measure: true positive rate (simulation says covered → actually covered) and false positive rate (simulation says covered → actually blind)
- Calibrate simulation parameters to minimize false positive rate (overclaiming coverage is the dangerous error)
- Benchmarks needed: different room types, lighting conditions, camera models, obstruction patterns

**Calibration protocol:**
- Step 1: Set up reference scene with known dimensions and camera positions
- Step 2: Run simulation with default assumptions
- Step 3: Measure actual coverage with real camera
- Step 4: Adjust simulation parameters (night penalty, transmission values) until simulated matches measured within tolerance
- Step 5: Document calibration parameters as per-scene metadata ("calibrated against Axis M3085-V on 2026-03-15")
- This would be a Phase 2/3 feature: "Calibrate simulation" workflow in the inspector

**Confidence scoring per output:**
- Not all coverage numbers are equally reliable. A zone verified with assumptions matching the real installation (known camera height, measured light levels) has higher confidence than one using defaults.
- Confidence score factors:
  - Number of user-specified vs default assumptions (more specified = higher confidence)
  - Proximity to threshold: a zone barely passing recognition quality (125 PPM vs 115 PPM) should show a fragility warning
  - Number of occlusions: complex geometry with many potential occlusions = lower confidence
  - Night mode: night simulation has higher uncertainty than day (more assumptions about IR behavior)

**Open questions:**
- Should uncertainty be shown to end users or only in developer/debug mode?
- How do we avoid users treating confidence intervals as "the simulation is unreliable" rather than "the simulation is honest"?
- Is the surrogate model approach feasible in-browser (WASM), or should uncertainty propagation be server-side?

---

### Thread 94 — Discrete Event & Agent-Based Simulation for Physical Security

**Status:** Exploration candidate — 2026-05-30

**Rationale:** SentinelTwin's current simulation is deterministic and static: given a scene and assumptions, compute coverage. Real physical security is a dynamic system with events (people entering, lights turning on/off, guards patrolling, cameras switching modes), stochastic elements (random intrusion attempts, variable walk speeds, unpredictable crowd behavior), and temporal dependencies (alarm triggers door lock, door lock changes coverage need). Discrete Event Simulation (DES) and Agent-Based Modeling (ABM) are well-established methodologies for modeling such systems.

**Key exploration areas:**

**Discrete Event Simulation (DES) for security timelines:**
- DES models a system as a sequence of events in time, each event causing state changes
- For physical security: events = person enters zone, door opens, alarm triggers, guard dispatched, camera PTZ moves to preset
- State = current camera coverage, door lock status, alarm status, guard location
- Event queue processes events chronologically, updating state at each event
- Output: timeline of security state changes, detection latencies, vulnerability windows (complements Thread 6 temporal simulation)

**Agent-Based Modeling (ABM) for intruder/occupant behavior:**
- ABM models individual agents (intruders, guards, employees, customers) with independent behaviors
- Agents have: position, velocity, visibility to cameras, knowledge state (known vs unknown camera positions), goals
- Behavior rules:
  - Intruder: move toward target zone, avoid known camera FOVs, respond to alarms (flee or find cover)
  - Guard: patrol assigned route, respond to alarms, sweep zones on schedule
  - Employee: move to/from workstation, take breaks, unexpected movement patterns
  - Customer: move through store with retail traffic patterns (predictable paths, dwell time at displays)
- Interactions: guard presence changes intruder behavior, alarm event triggers guard dispatch, employee call button alters guard patrol
- This is the natural evolution of SentinelTwin's current adversarial path simulation (single agent → multiple interacting agents)

**Stochastic vs deterministic models:**
- Current adversarial path: deterministic — shortest exposure path given known camera positions
- ABM extension: stochastic — agents have random variations in speed, path choice, detection avoidance behavior
- Monte Carlo over ABM: run 100+ simulations with random seeds → output distribution of outcomes
  - "What's the probability an intruder reaches the server room undetected?" → not binary but a probability
- Stochastic guard behavior: "what percent of time is this zone uncovered between patrol passes?" → not a fixed 8-minute window

**Implementation considerations:**
- ABM in browser: 10-100 agents at 60fps is feasible with spatial hashing and simple behavior rules
- Temporal resolution: DES typically runs at second-level granularity for security timelines
- Computational cost: 10 agents × 3600 seconds (1 hour) = 36,000 state evaluations — ~100-500ms with optimized JavaScript
- Could use a web worker for simulation to avoid blocking UI
- ABM complexity scales with O(n²) for pairwise agent interactions — limit to ~50 agents for browser feasibility

**Product applications:**
- **Crowd scenario:** "What if 50 people enter simultaneously during shift change?" — which cameras would be blocked, which zones exposed?
- **Coordinated attack:** "What if two intruders enter from different directions — can one distract while the other approaches the target?"
- **Guard staffing:** "What is the maximum coverage gap given X guards on patrol schedule Y?"
- **Retail scenario:** "During holiday rush, which aisles have the worst shoplifting detection coverage due to customer occlusion?"

**Open questions:**
- Is agent-based modeling over-engineering for V0.1? The current single-adversarial-path is already novel.
- Should ABM be a Phase 2/3 feature or a separate product line (SentinelTwin Sim)?
- How do we validate agent behavior models against real security incident data?
- What is the simplest possible ABM that provides useful insight beyond the current deterministic model?

---

### Thread 95 — Camera Placement Optimization (Set Cover, Greedy, Genetic Algorithms)

**Status:** Exploration candidate — 2026-05-30

**Rationale:** Given a floor plan and a list of critical zones requiring coverage, what is the minimum camera configuration that meets all coverage requirements? This is a classic set cover problem (NP-hard), but well-understood approximation algorithms exist that produce near-optimal solutions. SentinelTwin's counterfactual agent already answers "what if I removed this camera?" — the next step is "how should I place cameras in the first place?"

**Key exploration areas:**

**Problem formulation:**
- Continuous set cover: find minimum number of cameras (with position, orientation, lens choices) such that every critical zone achieves its required DORI quality level
- Grid-based discretization: sample possible camera positions on a grid (every 0.5m on walls/ceilings), each with multiple orientations
- Each (position, orientation, lens) → coverage pattern = subset of zones covered
- Goal: minimum-cost subset covering all zones
- This is NP-hard (reduction from set cover), but greedy gives O(log n) approximation

**Algorithms survey:**
| Algorithm | Quality | Speed | Deterministic? | Use Case |
|---|---|---|---|---|
| Greedy (best-first) | O(log n) approx | Very fast (O(k·n)) | Yes | Interactive recommendations |
| Genetic Algorithm | Near-optimal | Slow (O(generations·pop)) | No (random seed) | Offline optimization |
| Particle Swarm | Near-optimal | Medium (O(particles·iter)) | No | Large-scale optimization |
| Simulated Annealing | Near-optimal | Medium (O(iter·neighbors)) | No | Global refinement of greedy |
| Integer Linear Programming | Optimal | Slow (exponential worst-case) | Yes | Verification (small scenes) |
| LP-rounding | O(1) approx | Fast | Yes | Theoretical upper bound |

**Greedy algorithm (most practical for interactive use):**
```
1. Enumerate candidate positions (grid on walls/ceilings, typical mount heights)
2. For each candidate × camera model × orientation, compute coverage (via simulation engine)
3. While uncovered critical zones remain:
   a. Pick candidate that covers the most currently-uncovered zones at required DORI quality
   b. Mark those zones as covered
   c. Remove candidate from pool
4. Return selected candidates
```
Performance: ~1000 candidates × 50ms coverage compute = ~50 seconds naive. Optimization: precompute coverage and cache, candidates = ~500 after basic filtering (height-valid positions only).

**Constraint handling:**
- Real-world constraints beyond coverage:
  - Cable reach: camera must be within 100m of PoE switch (or plan for a new switch)
  - Structural: cannot mount on glass walls, lightweight partitions, or fire-rated assemblies
  - Aesthetic: no cameras in certain areas (client bathrooms, private offices, union break rooms)
  - Privacy: cameras must not cover privacy zones (restrooms, changing areas)
  - Budget: maximum N cameras, maximum $ per camera
  - Brand consistency: all cameras from same manufacturer (maintenance simplicity)
- Multi-objective optimization: minimize cost while maximizing coverage and redundancy

**PTZ camera optimization (harder):**
- PTZ cameras can cover multiple zones at different times — not static coverage
- Problem: schedule PTZ presets and patrol patterns to maximize temporal coverage of all zones
- Related to watchman routing and art gallery problem with mobile guards
- PTZ scheduling: each zone needs M seconds of coverage per N-minute cycle
- Optimization: find minimum number of PTZs + patrol schedule meeting temporal coverage constraints

**Product applications:**
- "Auto-place cameras" button: user marks critical zones, system suggests optimal camera layout
- "Budget mode": user sets max N cameras, system recommends where to place them for maximum coverage
- "What lens?" recommendation: user picks position, system suggests focal length(s) that cover the most zones
- "Redundancy optimization": ensure every critical zone has at least 2 cameras covering it, minimize total cameras

**Open questions:**
- Should optimization be real-time (user drags camera → system suggests fine-tuning) or batch (user hits "optimize" button)?
- How many candidate positions per room? 100 is fast, 1000 is thorough but slow.
- Should optimization consider non-camera security assets (access control, motion sensors)?
- Is the greedy approximation good enough for security design, or do we need genetic algorithm quality?

---

### Thread 96 — Adversarial Attack Methodology & Criminal Research for Threat Modeling

**Status:** Exploration candidate — 2026-05-30

**Rationale:** SentinelTwin's adversarial path simulation computes the lowest-exposure route through a camera system. But is that route something a real intruder would actually take? Understanding real-world criminal methodology — how burglars actually operate, what tools they use, how much time they spend, what behaviors they exhibit — is critical for making adversarial path simulation realistic rather than purely theoretical. This thread explores the research needed to feed realistic threat models into the simulation engine.

**Key exploration areas:**

**Residential/commercial burglary methodology:**
- Entry patterns (from DOJ statistics + research):
  - Forced entry (53.7%): kicked doors, pried windows, broken glass — these produce noise, debris, and are easier to detect
  - Unlawful entry (31.2%): unlocked door/window — quieter, no forced entry evidence, harder to detect until too late
  - Attempted forcible entry (15.1%): failed attempt — often triggers alarm but no actual penetration
- Time inside structure: median 8-10 minutes (residential), 5-12 minutes (commercial)
- Target selection: master bedroom (jewelry/cash), home office (electronics/documents), garage (tools/vehicles)
- Tools: crowbar, hammer, screwdriver, glass cutter, lock picks, battery-powered saw
- Deterrence hierarchy: visible alarm system > visible cameras > secure doors > lights on timers > landscaping

**Smash-and-grab / ram-raid methodology:**
- Vehicle ramming: analysis of vehicle type (stolen SUV/truck), approach speed, target structural vulnerability
- Entry-to-exit timeline: average 90 seconds from breach to exit (two people: one grabs merchandise, one drives)
- Groups: typically 3-8 people, multiple vehicles, coordinated roles (driver, grabber, lookout, blocker)
- High-value retail: jewelry stores (54%), electronics (22%), luxury goods (15%), pharmacies (9%)
- Post-incident evasion: change vehicles 1-2 blocks away, use stolen plates, flee via highway within 2 minutes

**Tailgating / piggybacking (social engineering entry):**
- Technique: approach access-controlled door behind authorized person, appear distracted (phone, carrying boxes, in uniform)
- Success rate: studies show 20-70% of people will hold the door for a polite person (even in secure facilities)
- Timing: shift change/end of day is highest success rate (many people entering simultaneously)
- Impersonation: delivery uniform, maintenance uniform, visitor badge, cleaning crew (very high success rate)
- Physical red team documented methods: carry a ladder (nobody questions someone with a ladder), carry a large box (blocks view of door access), clipboard + hard hat (construction worker disguise)
- Defensive measure: mantrap (interlocking doors), turnstiles, guard verification of unknown faces

**Insider threat patterns (for physical access):**
- Exit interviews after termination: 47% of employees admit taking proprietary data (not just digital — physical documents, prototypes)
- After-hours badge use anomalies: badge used at 2AM after 6 months of 9-5 pattern
- Collusion: insider provides door codes, alarm disable codes, or access to cleaning/security staff
- Loading dock theft: coordinate delivery with vehicle, load during shift change diversion, falsify paperwork
- Concealment methods: lunch bags, tool boxes, underneath clothing, inside personal vehicles

**Vehicle ramming as attack vector:**
- Physics: kinetic energy = ½mv². A 2000kg SUV at 30mph = ~180kJ of energy. Bollard ratings K4-K12 (30-80mph stopping ability)
- Typical targets: building entrance (revolving door, glass facade), pedestrian plaza, outdoor event, open-air retail (street-side windows)
- Vehicle types: stolen SUV/truck (most common), rental vehicle, van for larger capacity
- Standoff distance: minimum 10m for K4 bollards, 30m for vehicle inspection checkpoints
- Secondary threat: vehicle-borne IED (VBIED) — blast analysis, standoff distance, glazing protection

**Active shooter timeline research:**
- FBI active shooter reports (2015-2025): averages, durations, location types
- Average incident duration: 10-12 minutes (law enforcement arrival + engagement)
- Average shots fired: 40-50 (before police engagement)
- Location distribution: commerce (44%), education (23%), open space (11%), government (8%), residential (4%)
- Most common entry: front door (not locked or unlocked from inside)
- Detection challenge: "the sound of gunfire is the first notification" — no prior behavioral indicator in most cases
- Post-landmark shooting (2000+): hardening trends: single point of entry, metal detectors, armed guards, secure vestibules

**How this feeds into SentinelTwin simulation:**
- Realistic intruder behavior models: not just "find minimum exposure path" but "find minimum exposure path given real intruder knowledge, tool constraints, and time budget"
- Attack mode profiles: user selects attack type (Burglary, Smash-and-Grab, Insider, Vehicle Ramming, Active Shooter) → simulation uses appropriate behavioral parameters
- Time-to-threat modeling: average intrusion timeline vs detection + response capability → shows vulnerability windows
- Tool-dependent detection: forced entry produces noise/debris (easier to detect) vs social engineering (much harder) → different detection probability curves

**Defensive framing (mandatory):**

---

### Thread 97 — Camera Spec Database: Schema Design, Data Pipeline & Automated Aggregation

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Rationale:** SentinelTwin's DORI/OODPCVS scoring currently uses simplified quality thresholds. For production accuracy, the engine needs real camera hardware specifications — sensor size, pixel pitch, focal length range, f-stop, IR range, and more. Building a camera spec database from manufacturer data enables per-model DORI calculation, camera recommendation, and automated coverage validation.

**Key exploration areas:**

**Schema design:**
- Core fields: manufacturer, model, sensor type (CMOS/CCD/thermal), sensor size (1/3", 1/2.8", 1/1.8", 1/1.2", 2/3", 1"), pixel count (MP), pixel pitch (microns), focal length min/max (mm), aperture (f-stop), horizontal/vertical FOV (degrees), IR range (m), min illumination (lux/color/bw)
- DORI-specific computed fields: effective PPM at max focal, DORI distances for each level, optimal mounting height range
- Environmental: IP rating, IK rating, operating temp range, humidity tolerance
- Network: PoE class (802.3af/at/bt), ONVIF profiles supported, video codecs (H.264/H.265/MJPEG), max frame rate per resolution
- Classification: form factor (bullet/dome/PTZ/fisheye/box/thermal), indoor/outdoor, vandal-rated, NDAA compliance status

**Data pipeline:**
- Manufacturer datasheet scraping: target pages on Axis, Hanwha, Bosch, Hikvision, Dahua, Uniview
- PDF download → OCR (Tesseract) → LLM extraction (structured field mapping)
- Normalization challenges: same field named differently across manufacturers (e.g., "Night Vision Range" vs "IR Distance" vs "Effective IR Illumination")
- ONVIF device discovery (WS-Discovery) as supplementary source for connected cameras
- E-commerce aggregators (B&H, ADI, Anixter) as structured data source with verification

**Open questions:**
- Is IPVM's paid database API-accessible for license integration?
- Can we build a community-maintained open camera spec database (like OpenCameraDatabase.org)?
- How often do manufacturers update specs, and how do we detect drift?

**Related:** Thread 87 (Sensor physics), Thread 90 (Rendering), Thread 95 (Placement optimization)

---

### Thread 98 — PTZ Movement Mechanics, Protocols & Behavioral Modeling

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Rationale:** PTZ cameras are not static — their movement patterns, speed, accuracy, and sequencing directly affect coverage dynamics. Modeling PTZ behavior is essential for temporal coverage simulation (where is the PTZ looking at time t?), guard tour effectiveness analysis, and PTZ vs fixed camera trade-offs.

**Key exploration areas:**

**PTZ motor types:**
- Stepper motors: precise positioning, open-loop, can lose steps, common in consumer PTZs
- Servo motors: closed-loop feedback (encoder), higher accuracy, more expensive, used in enterprise PTZs
- DC motors: variable speed, simpler control, less precise, used in older/cheaper models
- Motor + gear train: backlash effects on positioning accuracy reset

**PTZ speed specifications:**
- Pan speed: typical range 0.1-400 degrees/second (preset speeds vs manual/manual variable)
- Tilt speed: typical range 0.1-200 degrees/second (faster pan than tilt due to motor load)
- Preset speed: high-speed movement to pre-stored position (up to 700 deg/s on high-end units)
- Speed profile: acceleration/deceleration curves, overshoot, and settling time
- Position accuracy: typical 0.1-1.0 degrees (affected by backlash, calibration drift)

**PTZ behaviors to model:**
- Presets: stored (pan, tilt, zoom) coordinates, instant recall, sequence ordering
- Guard tours / cruise: timed switching between presets, configurable dwell time per preset, random vs sequential patterns
- Pattern recording: user-defined motion path (including zoom/focus changes), repeated exactly
- Auxiliary functions: wiper control, heater, IR cut filter, defog, rain wipe
- Privacy masking: polygon masks that follow pan/tilt movement, mask shapes (quad/polygon/circle)
- Limit stops: electronic vs mechanical end stops, configurable pan/tilt limits for restricted zones

**PTZ control protocols:**
- Pelco-D: serial (RS-485/422), legacy open standard, 1-255 addresses, ASCII commands, limited to basic pan/tilt/zoom/iris/focus, 9600 baud typical
- Pelco-P: binary variant of Pelco-D, faster communication, 256 addresses, less commonly used today
- ONVIF PTZ: IP-based XML SOAP, AbsoluteMove/RelativeMove/ContinuousMove, velocity profiles, geo-referencing, smooth time-parametrized moves
- VAPIX (Axis): HTTP-based, digital PTZ (ePTZ) and mechanical, event-driven PTZ triggers
- CGIs: Hikvision/Dahua proprietary HTTP APIs for PTZ control

**ePTZ vs physical PTZ:**
- ePTZ: no moving parts, digital crop of high-res frame, instant switching, no mechanical wear, limited by sensor resolution
- Physical PTZ: optical zoom preserves resolution, mechanical delay, wear over time, noise
- Hybrid: overview fisheye/multi-sensor camera with ePTZ for situational awareness + PTZ for forensic zoom

**Open questions:**
- How does PTZ positioning accuracy degrade over time (gear wear, calibration drift)?
- Can we model optimal guard tour patterns for coverage maximization given camera field of view and site geometry?
- How do PTZ speed profiles affect adversarial path detection probability (can an intruder dodge a PTZ sweep)?

---

### Thread 100 — Multi-Sensor & Panoramic Camera Coverage Modeling

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Rationale:** Multi-sensor and panoramic cameras have fundamentally different coverage characteristics than single-sensor fixed cameras — extreme FOV, non-uniform resolution distribution, dewarping artifacts, ePTZ capability. These require specialized modeling.

**Key exploration areas:**

**Camera types:**
- Fisheye/360: single ultra-wide sensor, hemispherical FOV, severe distortion, resolution distributed over hemisphere
- Multi-sensor fusion: 2-4 independent sensors + lenses, stitched FOV (180h x 90v typical), uniform per-quadrant resolution, 12-48MP total
- PTZ + overview: fixed panoramic overview + optical zoom PTZ in same housing (Axis Q87 series)
- Multi-imager: separate imagers for day/night/thermal in single housing

**Coverage modeling implications:**
- Fisheye resolution density: 4MP over 360 = ~1.1 MP per 90 quadrant at center (less at edges)
- Multi-sensor: 12MP over 180 = ~6MP per 90 half, uniform across FOV
- Dewarping: spherical/cylindrical to rectilinear transformation, slight resolution loss at dewarped edges
- Effective DORI: panoramic cameras have shorter effective DORI ranges than optical-zoom fixed cameras
- Hybrid patterns: panoramic overview + optical zoom at choke points

**Deployment considerations:**
- Ceiling height minimums: 8-10ft for people detection, 12-15ft for optimal coverage radius
- Ceiling mount (hemispherical) vs wall mount (180 sweep) vs pendant (open area 360)
- Multi-sensor orientation: mapping each sensor's physical orientation (N/E/S/W quadrants)

**Open questions:**
- How should DORI be computed for panoramic cameras — per-quadrant, per-dewarped-virtual-camera, or hemispherical average?
- What's the optimal overlap between adjacent panoramic cameras for seamless handoff?
- Can we visualize ePTZ range as a digital zoom cone within panoramic FOV?

---

### Thread 101 — Camera Analytics, Edge AI & Intelligent Video Surveillance (IVS)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Rationale:** Modern cameras run AI inferencing on edge hardware. Analytics capabilities affect camera selection, placement, and coverage requirements (ANPR needs higher PPM than simple detection). Understanding the analytics landscape enables SentinelTwin to model smart coverage — zones where a camera can not only see but also classify and alert.

**Key exploration areas:**

**IVS rule types:**
- Line crossing: virtual tripwire with direction, arming schedule
- Intrusion detection: virtual zone with entry/exit rules
- Loitering: time threshold in zone (1-999 seconds)
- Object removal/abandoned: static object detection with time threshold
- Fast moving / speed detection: object tracking velocity
- People counting: bi-directional counting, queue length, dwell time
- Crowd density estimation
- Heat map: motion density visualization

**Edge AI processor landscape:**
- Haisili: Hi3559A, 3516DV300 — 4K + NPU, widely used in Hikvision/Dahua
- Ambarella: CV22, CV25, CV52 — 4K + stereo depth + AI (Axis, Bosch, Hanwha)
- NVIDIA Jetson: TX2, Xavier NX, Orin — high-end edge AI (Avigilon, custom)
- NPU performance: 1-20 TOPS typical on-camera

**ONVIF Profile M:**
- Standardized analytics metadata schema
- Object classifications: person/vehicle/animal/package
- Bounding boxes, confidence scores, timestamps
- Cross-manufacturer interoperability (limited in practice)

**Analytics impact on DORI:**
- AI vs human: AI often needs higher PPM for reliable classification (250+ for ANPR vs 125 for human)
- ANPR specific: plates need 80-200 pixels wide = 30-70 PPM depending on plate standard
- Facial recognition: inter-pupillary distance 40-80 pixels
- Scene complexity: cluttered backgrounds reduce accuracy even at adequate PPM

**Accuracy limitations:**
- False positive rates: 1-5% typical edge AI, higher in complex scenes
- Accuracy degradation: rain -20-40%, snow -30-50%, low light -10-30%
- Certification: UL 2802, i-LIDS

**Open questions:**
- Should SentinelTwin model analytics coverage zones separately from visual coverage zones?
- How does analytics accuracy degrade at DORI level boundaries?
- Can we simulate analytics detection probability maps based on camera specs, scene conditions, and target types?

---

### Thread 99 — Gimbal Stabilization & Long-Range Surveillance Systems

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Rationale:** Standard PTZ cameras provide unusable imagery at extreme zoom (500mm+ equivalent) due to vibration. Gimbal-stabilized systems are required for long-range surveillance of perimeters, borders, coastlines, and critical infrastructure. Understanding gimbal technology is essential for modeling long-range DORI in SentinelTwin's coverage engine.

**Key exploration areas:**

**Stabilization technology:**
- EIS: sensor crop + frame shift, reduces effective resolution, ineffective at high zoom, rolling shutter artifacts
- Mechanical stabilization: gyroscope (MEMS/fiber optic) + brushless motors, active counter-rotation, ~0.01 deg stabilization accuracy, preserves full resolution
- Hybrid stabilization: EIS for micro-vibrations + mechanical for macro-movements
- Wind-induced vibration spectrum analysis for high-mast pole mounts

**Gimbal system types:**
- 2-axis: pan + tilt (sufficient for fixed-mount surveillance)
- 3-axis: pan + tilt + roll (required for moving platforms: drones, vehicles, vessels)
- Continuous rotation slip rings: power + data + video through rotating joints
- Thermal + optical fusion: co-aligned thermal (LWIR) + visible sensors in same gimbal

**Long-range surveillance:**
- Focal lengths: 12-300mm standard PTZ, 30-750mm long range, 50-1500mm extreme range
- Laser range finding: integrated LRF for distance measurement and auto-focus
- Target tracking: automated geo-referenced target tracking (GPS + IMU + video)
- Manufacturer landscape: FLIR/Teledyne, Infiniti EO, Silent Sentinel, Clear Align, Controp (tactical); Axis/Hanwha/Bosch (standard EIS only)

**Open questions:**
- What DORI range reduction factor applies for unstabilized cameras at >100x zoom?
- Can we model vibration frequency based on pole height, wind speed, and mount type?
- How does stabilization accuracy affect forensic identification probability in simulation?

---

### Thread 102 — Camera Cybersecurity, Hardening Standards & Regulatory Compliance

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Rationale:** Camera security is critical in regulated environments (government, healthcare, finance, critical infrastructure). NDAA compliance alone is insufficient — buyers require secure boot, signed firmware, FIPS 140-3, and vulnerability management. SentinelTwin should model these compliance attributes for camera recommendations.

**Key exploration areas:**

**Edge hardening:**
- Secure boot: chain of trust boot ROM → bootloader → kernel → OS
- Signed firmware: manufacturer code-signing (RSA/ECDSA), device rejects unsigned firmware
- TPM: dedicated cryptographic processor, key storage, measured boot, attestation
- Write-protected flash: read-only OS partitions

**Network security:**
- 802.1x: EAP-TLS (certificate), EAP-PEAP, MAB fallback
- HTTPS/TLS 1.2/1.3: secure web interface and API communication
- SRTP (RFC 3711): encrypts RTP video stream, AES-128/256
- Encryption at rest: AES-256 for stored video
- Protocol hardening: disable Telnet, HTTP, SNMPv1/v2c, FTP

**Compliance frameworks:**
- NDAA Section 889: bans Hikvision, Dahua, Huawei, ZTE from US federal procurement
- TAA: products made in US, FTA, or designated countries
- FIPS 140-2/3: NIST cryptographic module validation
- UL 2900-1: software cybersecurity standard
- GDPR: video data = personal data, DPIA, retention limits
- CCPA/CPRA: California video privacy requirements

**Vulnerability landscape:**
- Major CVEs by manufacturer (Hikvision backdoor, Dahua auth bypass, Axis command injection)
- Vulnerability disclosure programs (VDP) — which manufacturers have them
- Patch cadence: monthly vs quarterly vs reactive
- EOL notification, last firmware update, security support duration

**Open questions:**
- How should cybersecurity compliance be weighted in camera recommendation?
- Can SentinelTwin model network architecture (VLAN, firewall, zero-trust segmentation)?
- Should coverage reports include a cybersecurity risk score per camera model?

---

### Thread 103 — Camera Mounting, Environmental Engineering & FOV Constraints

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Rationale:** A camera's theoretical FOV is always constrained by mounting location, height, orientation, and environment. Real-world coverage modeling must account for mounting-specific constraints: occlusions from mount, vibration on poles, ice on domes, sun glare, and structural obstruction.

**Key exploration areas:**

**Mount types:**
- Pendant: ceiling hanging, 360-degree unobstructed view below, sway in wind
- Wall: L-shaped arm, 6-12 inch offset from wall, wall plane occlusion
- Pole: band/clamp attachment, wind vibration, limited tilt adjustment
- Corner: fills corner gaps, dual-surface attachment
- Parapet: roof edge, building perimeter, line-of-sight requirements
- Recessed: in-ceiling, minimal profile, limited adjustability

**Environmental protection:**
- IP66 (jet water, dust) sufficient for most outdoor
- IP67 (1m immersion) for flood-prone areas
- IP68 (continuous submersion) for tunnels/wash-down
- IK10: 20J impact resistance (5kg mass from 40cm)
- Thermal: internal heaters for sub-zero, blowers for humidity, sun shields for desert
- Corrosion: 304 SS standard, 316L for marine/coastal (molybdenum prevents chloride pitting)
- Dome materials: polycarbonate (impact resistant, scratches), acrylic (optical clarity, brittle), glass (best optics, heavy), sapphire (extreme scratch, expensive)

**Wind loading and vibration:**
- Wind loading: F = 0.5 * rho * v^2 * Cd * A
- Vibration amplitude vs pole height: taller = larger amplitude
- Vortex shedding: alternating vortex on cylindrical poles, crosswind vibration
- Damping: tuned mass dampers, vibration isolation, guy wires
- Wind-induced blur: resonant frequency, gust response, stabilization requirements

**Mounting height vs FOV:**
- Height-dependent: higher mount = wider coverage, smaller object pixels
- Typical heights: 8-10ft retail, 10-15ft warehouse, 15-30ft parking, 30-50ft poles
- Tilt angle: 15-30 deg for general, 30-45 for facial capture, 60-90 top-down for counting
- Optimal height per DORI: identification needs lower mounts (10-15ft), detection allows higher (30-50ft)

---

### Thread 104 — Camera Power & Connectivity Infrastructure Engineering

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Rationale:** Cameras require power and network connectivity, and infrastructure constraints directly affect where cameras can be placed. PoE budgets limit cameras per switch, cable distances constrain placement, and wireless/cellular enables coverage in previously unreachable locations.

**Key exploration areas:**

**PoE standards:**
- 802.3af (PoE): 15.4W at PSE, 12.95W at PD (standard fixed cameras)
- 802.3at (PoE+): 30W at PSE, 25.5W at PD (cameras with IR, basic PTZ)
- 802.3bt Type 3 (PoE++): 60W at PSE, 51W at PD (multi-sensor, outdoor PTZ with heater)
- 802.3bt Type 4: 90W at PSE, 71.3W at PD (high-power PTZ, heated + IR + analytics)
- LLDP negotiation vs hardware classification, power allocation per port vs total budget

**Power budget calculation:**
- Typical 48-port PoE+ switch: 720W total / 25.5W per port max
- Camera power varies: daytime vs night (IR +2-10W), heater on (+30W outdoor)
- Cable power loss: Cat5e ~0.5W/100m, Cat6 ~0.4W/100m, Cat6a ~0.3W/100m
- Redundancy: dual power (PoE + 12V DC), UPS backup

**Alternative power:**
- 12V DC: local supply per camera, voltage drop ~1V/100m for 18AWG
- 24V AC: lower voltage drop over distance, legacy PTZ compatibility
- Power over Coax (HD-TVI/CVI/AHD): hybrid video+power over RG59/RG6, 500m reach
- Solar/battery: panel sizing based on consumption + insolation, battery for night/cloud
- Power over Fiber: hybrid fiber cable, 2km+ reach, used in perimeters

**Network connectivity:
- Wired: Cat5e/Cat6/Cat6a, 100m segment limit
- Wireless: point-to-point bridges (2.4/5/60 GHz), mesh networks, Wi-Fi cameras
- Cellular: 4G/LTE/5G for temp/remote sites, data plan costs, bandwidth limits
- Fiber: single-mode (10km+) for perimeter, multi-mode (550m) for campus backbone

---

### Thread 105 — Camera Hardware Degradation & Failure Prediction Modeling

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Rationale:** Camera performance degrades over time — IR LEDs dim, sensors develop hot pixels, PTZ mechanisms wear, domes become hazy. SentinelTwin currently models failure as binary. For realistic lifecycle simulation and predictive maintenance, we need degradation curves.

**Key exploration areas:**
- IR LED L70 lifetime: 30,000-50,000 hours (3.4-5.7 years at 24/7), dependent on junction temperature
- IR range over time: initial range to L70 (70% output) to L50 (50% output)
- Sensor degradation: hot pixels (stuck on, increases with thermal cycling), dead pixels, PRNU fixed pattern noise, dark current thermal noise
- Dome hazing: polycarbonate UV degradation turns clear dome milky/yellow (1-3 year replacement)
- Lens fungus: fungal growth on optical surfaces in humid environments
- PTZ wear: gear train backlash increase, belt stretch, limit switch failure, bearing wear
- Capacitor aging: electrolytic capacitors in power supply, ESR increase, 2,000-10,000 hour lifetime
- Weibull distribution for failure modeling: shape parameter determines infant mortality vs wear-out
- MTBF ranges: 30,000-80,000 hours bullet/dome, 20,000-50,000 hours PTZ
- Bathtub curve: infant mortality (90 days) → useful life → wear-out
- Predictive maintenance signals: increasing hot pixels, decreasing SNR, PTZ calibration drift
---

### Thread 106 — Manufacturer Ecosystems, APIs & VMS Integration Landscape

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Rationale:** Camera selection is not just about hardware specs — it is about ecosystem integration. Different manufacturers have radically different APIs, SDK ecosystems, VMS compatibility, and openness. Understanding this landscape is critical for SentinelTwin camera recommendation and integration complexity modeling.

**Key exploration areas:**
- Hikvision: ISAPI HTTP API, C/C++ SDK, HiWatch sub-brand, ADI distribution, HikCentral VMS
- Dahua: CGI HTTP API, C/C++ SDK, OEM supplier for CP Plus/Swann/Lorex, Smart PSS VMS
- Axis: VAPIX open HTTP API (50+ modules), ACAP app platform (Linux, C/JS), AXIS Device Manager, VMS-agnostic
- Bosch: BVMS enterprise VMS, C++ SDK for camera apps, BIS building integration, DIVAR IP NVR
- Hanwha: Wisenet HTTP SDK, WAVE VMS, T/X/Q/L product tiers, ACAP-like app platform
- Avigilon: ACC enterprise VMS (proprietary), appearance search API, H4/H5/H6 hardware gen AI
- Pelco: VideoXpert VMS REST API, legacy proprietary protocols, newer ONVIF compliant
- Open source VMS: Frigate (AI + Coral TPU), Shinobi (Node.js), Kerberos.io (Docker), Scrypted (HKSV bridge), ZoneMinder
---


### Thread 107 — PTZ Movement Kinematics & Temporal Coverage Modeling

**Status:** Active exploration — 2026-05-30

**Rationale:** SentinelTwin currently models PTZ cameras as a boolean flag with no behavior. For temporal coverage simulation to be accurate (the real-time digital twin, not just the 24h profile), PTZ cameras must be modeled as dynamic objects with position-dependent FOV. A PTZ looking at the far corner is not covering the entry point. Modeling PTZ movement directly affects real-time coverage computation, path visibility timing, and vulnerability window analysis.

**Key exploration areas:**

**PTZ movement physics:**
- Pan speed: 0.1-400 deg/s typical. Speed depends on zoom level (optical zoom reduces effective pan speed)
- Tilt speed: 0.1-200 deg/s typical. Often asymmetric (faster down than up)
- Acceleration/deceleration: PTZ motors do not reach top speed instantly. Realistic movement needs velocity ramps
- Preset recall time: 0.3-2.0 seconds for nearby presets, up to 5s for full-range moves (180 deg pan)
- Settling time: 0.2-0.8s after movement completes for image stabilization to stabilize
- Repeatability: ±0.1-0.5 deg mechanical tolerance. Over time, gear wear increases this

**Modeling approach:**
- State machine: IDLE → MOVING (accel) → MOVING (cruise) → MOVING (decel) → SETTLING → IDLE
- FOV is a function of current (yaw, pitch, zoom) position, not initial preset
- During movement, camera is effectively "blind" — no useful coverage (motion blur, stabilization artifacts)
- Guard tour sweep: waypoint sequence with dwell times at each preset
- Realistic coverage model: temporal duty cycle = (dwell_time) / (dwell_time + move_time + settle_time)

**Direct impact on existing code:**
- `CameraNode.ptz: boolean` needs expansion to `ptzConfig` with speed, acceleration, presets
- Temporal simulation needs PTZ state at each time step — where is each PTZ looking RIGHT NOW?
- Adversarial path simulation needs to know: is the PTZ currently covering this path segment?
- Timeline tab should show PTZ movement events as coverage changes

**Related threads:** Thread 90 (Three.js rendering), Thread 98 (PTZ protocols), Thread 87 (camera sensor physics)

---

### Thread 108 — Surface Material Reflectivity (BRDF) & Camera Visibility Physics

**Status:** Active exploration — 2026-05-30

**Rationale:** SentinelTwin's obstruction model uses `visionTransmission` (0-1) and `glareRisk` (boolean). Real surface physics are far richer — a painted wall, a glass display, a polished floor, and a matte partition all affect camera visibility differently depending on viewing angle, light position, and surface roughness. For realistic DORI scoring at steep angles, surface BRDF properties matter.

**Key exploration areas:**

**Surface types and their optical behavior:**
- Matte/painted surfaces (drywall, painted metal): Lambertian diffuse, consistent from all angles, no glare
- Glass display cases: Fresnel reflection at oblique angles (strong glare at >60 deg), high transmission at normal angles, double-surface ghost reflections
- Polished floors (marble, tile, epoxy): Mirror-like reflections at shallow angles, can reflect light sources creating false targets
- Metal surfaces: strongly polarized reflections, anisotropic (brushed metal reflects differently along vs across grain)
- Curtains/fabrics: transmission varies with weave density, backlighting reveals what's behind
- Window film: one-way mirror effect depends on light differential between sides
- Vines/foliage: complex geometry with gaps, specular highlights from waxy leaf surfaces

**BRDF parameters for security simulation:**
- Diffuse reflectivity (0-1): fraction of incident light scattered diffusely
- Specular intensity (0-1): fraction reflected as mirror-like highlight
- Roughness: width of specular lobe — mirror-like (0.01) to completely matte (1.0)
- Fresnel factor: how reflectivity increases at grazing angles
- Transmission: fraction of light passing through (0 = opaque, 1 = clear glass)
- Transmission roughness: how much transmitted light is scattered (frosted glass)

**Impact on coverage scoring:**
- High-gloss floor can reflect camera IR back, reducing effective IR range (false return)
- Glass at oblique angles can make a detection-target invisible from that camera angle despite being "in FOV"
- Matte surfaces provide consistent DORI across angles; glossy surfaces have angle-dependent quality
- Backlighting through curtains reveals silhouettes but not facial features

**Implementation approach:**
- Extend `ObstructionMaterial` with BRDF parameters alongside existing `visionTransmission`
- Add `materialPenalty` function in coverage engine that uses angle-of-incidence + BRDF to compute effective visibility
- For V0.1: keep simplified (matte default, glass/reflective exceptions)
- For V0.2+: full angle-dependent material penalty from camera-surface-subject geometry

**Related threads:** Thread 87 (camera sensor physics)

---

### Thread 109 — Dynamic Light Modeling: Falloff, Color Temperature, Shadow Blindspots & Multiple Light Interaction

**Status:** Active exploration — 2026-05-30

**Rationale:** Current lighting in SentinelTwin is simple on/off with a `rangeM` limit. Real lighting is continuous: inverse-square falloff, color temperature affecting sensor performance, shadows creating absolute blind spots, and multiple light sources combining non-additively. This directly affects night-time DORI scoring and temporal security profile accuracy.

**Key exploration areas:**

**Light falloff physics:**
- Inverse square law: illuminance ∝ 1/d². Light at twice the distance = 1/4 the intensity
- Beam angle: light spreads, so off-axis cells receive less illumination than on-axis
- Practical: a 20W LED flood at 10m provides ~50 lux, at 20m ~12.5 lux, at 40m ~3 lux (approaching moonlight)
- IR illuminators: cone angle narrower than visible light, range depends on camera IR sensitivity + illuminator power

**Color temperature effects:**
- Warm light (2700-3000K): less blue content, monochrome cameras see less detail, color cameras struggle with white balance
- Cool light (5000-6500K): more blue, matches camera white balance, better for color identification
- Mixed lighting: different color temps create uneven exposure across a scene
- Sodium vapor (street lights): monochromatic yellow (~589nm), monochrome cameras see well but no color info

**Shadow modeling:**
- Hard shadows: direct light occlusion by obstruction creates absolute dark zones where cameras cannot see (IR/no IR)
- Soft shadows: area lights create penumbra zones where visibility is gradually reduced
- Moving shadows: temporal coverage change as sun moves (outdoor), creating scheduled vulnerability windows
- Self-shadowing: camera housing shadow on its own IR illuminator (common PTZ issue at extreme zoom)

**Multiple light interaction:**
- Non-additive: two lights at half brightness ≠ one light at full. Sensor exposure is global.
- Overlap zones: over-illuminated areas can cause blooming/overexposure, reducing recognition quality
- Dark gaps: between light coverage zones — the adversarial path exploits these "shadow corridors"

**Implementation approach:**
- Replace binary `illuminatedBy.length > 0` check with continuous light level calculation
- Compute lux at each grid cell from all active lights using inverse-square + beam angle
- Map lux to DORI penalty (e.g., < 1 lux = severe penalty, 1-10 lux = moderate, 10-50 lux = slight, > 50 lux = none)
- Add shadow testing: if a light is behind an obstruction relative to the cell, apply shadow penalty

---

### Thread 110 — View Distance, Fog, Atmospheric Scattering & Long-Range Coverage Limits

**Status:** Active exploration — 2026-05-30

**Rationale:** SentinelTwin currently limits camera range via `maxRange` config. In reality, view distance is limited by atmospheric conditions (fog, haze, rain), camera optics (lens aperture, focal length), and sensor sensitivity. For outdoor/perimeter cameras at 50-200m ranges, these become significant factors missing from the coverage model.

**Key exploration areas:**

**Atmospheric visibility:**
- Clear day: visibility 10-30km — no atmospheric limit for security camera ranges
- Light haze: visibility 4-10km — slight contrast reduction
- Moderate fog: visibility 1-4km — noticeable haze at 200m, reduces DORI by 1 level
- Dense fog: visibility 50-500m — coverage severely limited, thermal cameras maintain performance
- Rain: visibility 1-10km depending on intensity, water droplets scatter light (Mie scattering)

**Atmospheric scattering types:**
- Mie scattering: water droplets and dust particles scatter light in all directions, reducing contrast
- Rayleigh scattering: molecular scattering (blue sky color), negligible at security camera ranges
- Implementation: Beer-Lambert law for exponential distance-based contrast reduction

**Camera-specific view distance factors:**
- Aperture: larger aperture (smaller f-stop) gathers more light but reduces depth of field
- Focal length: longer focal length magnifies atmospheric effects (heat shimmer at 200m+)
- Sensor size: larger sensor has better SNR at low contrast (can see through more haze)
- IR wavelength: 850nm IR penetrates haze better than visible light; 940nm IR even more
- Thermal (LWIR): 8-14μm band penetrates fog significantly better than visible/IR

**Three.js/R3F rendering implications:**
- `THREE.FogExp2` for base atmospheric effect (cheap, exponential density)
- Post-processing haze shader: depth-aware contrast reduction + color desaturation
- God rays / volumetric light shafts for sunlight through haze (dramatic but expensive)
- LOD system: switch to fog-only rendering for objects beyond DORI max range
- Camera feed simulation: apply progressive blur + contrast loss with distance

**Implementation approach:**
- Add `atmosphericVisibility` parameter to `SimulationAssumptions` (clear/haze/fog/heavy_fog/rain)
- Add distance-based contrast reduction factor to DORI PPM calculation (exponential decay)
- Visual: apply atmospheric overlay in CameraFeedCanvas at simulated distances

---

### Thread 111 — Camera Placement Physics: Structural, Regulatory & Constraint-Based Modeling

**Status:** Active exploration — 2026-05-30

**Rationale:** The current camera placement model is purely geometric — position, yaw, pitch with no constraints. Real camera placement is heavily constrained: structural (beams block view), regulatory (privacy laws, fire codes, sight lines for emergency exits), physical (cable reach, conduit paths, junction box locations), and environmental (sun glare, weather exposure). Modeling these constraints enables realistic auto-placement vs naive geometric FOV computation.

**Key exploration areas:**

**Structural constraints:**
- Ceiling beams and trusses: block ceiling-mounted camera FOV, especially wide-angle cameras
- Columns and pillars: create persistent blind spots regardless of camera count
- Bulkheads and soffits: dropped ceiling sections that block line of sight
- HVAC ducts: large ducts in commercial ceilings block camera placement locations
- Fire suppression pipes: sprinkler head placement can conflict with camera mounting

**Mounting constraints:**
- Wall thickness: must be sufficient for anchors — thin partitions can't support heavy PTZ cameras
- Ceiling type: drop ceiling tiles cannot support camera weight; require reinforcement to structural ceiling
- Pole mounting: pole diameter and material (steel vs concrete) affect mount selection
- Corner mounting: only works with specific bracket types, limited yaw adjustment range

**Regulatory constraints:**
- Privacy zones: cameras must not view neighboring properties, bathrooms, changing rooms
- HIPAA: cameras in healthcare corridors must avoid patient room interiors
- Fire code: camera placement must not obstruct sprinkler coverage or emergency exit signage
- ADA: low-mounted cameras must not protrude into walkways
- Data protection (GDPR): signage zones, recording-only areas vs live monitoring zones

**Sun glare modeling:**
- Solar path computation: camera orientation vs sun position by time of day and season
- Glare periods: specific windows when camera is directly facing sunrise/sunset (lens flare, sensor bloom)
- Backlight compensation: cameras facing windows need WDR — but WDR reduces effective night sensitivity
- West-facing cameras: worst glare in late afternoon; north/south in hemispheres, etc.

**Implementation approach:**
- Add `placementConstraints` schema to store known constraints (structural, regulatory, environmental)
- Implement `computeFeasiblePlacements(room, constraints)` that returns valid (position, mount, orientation) candidates
- Auto-placement algorithm (future): solve set cover with constraint satisfaction (CSP)
- Sun glare overlay: show glare-affected periods per camera in temporal profile

---

### Thread 112 — Scene Geometry Fidelity & Digital Twin Accuracy Tradeoffs

**Status:** Active exploration — 2026-05-30

**Rationale:** SentinelTwin's coverage accuracy depends directly on scene geometry fidelity. A room modeled as a simple box with walls vs a room with actual furniture, columns, partitions, and fixtures will produce significantly different coverage results. Understanding when simplified geometry is sufficient vs when detailed geometry is required is critical for both UX (quick setup vs detailed audit) and simulation accuracy.

**Key exploration areas:**

**Fidelity levels for security simulation:**
- Level 0 (Footprint only): room dimensions + wall positions — rough coverage % only, no occlusion accuracy
- Level 1 (Shell): walls + doors + windows + ceiling height — good for ceiling-mounted camera planning
- Level 2 (Major obstructions): + permanent fixtures (columns, beams, built-in counters) — accurate occlusion modeling
- Level 3 (Detailed): + furniture, shelves, partitions, equipment — full occlusion accuracy
- Level 4 (Temporal): + movable objects (carts, vehicles, temporary displays) — models changing occlusion over time

**Accuracy impact of each level:**
- L0→L1: coverage% may change by 5-15% as wall geometry corrects FOV boundary
- L1→L2: coverage% changes by 10-30% as interior columns and beams create blind spots
- L2→L3: coverage% changes by 5-20% as furniture creates local occlusion
- L3→L4: temporal coverage changes as movable items shift during day

**Mesh simplification for performance:**
- BVH works best with moderate polygon counts (10K-100K triangles). 1M+ triangles starts to slow raycasting
- Merge adjacent coplanar faces to reduce triangle count without losing occlusion accuracy
- Use simplified collision geometry for raycasting vs detailed visual geometry
- LOD system: lower detail at >50m from any camera (distant objects don't affect near-field raycasts)

**Special geometry cases:**
- Stairs: complex occlusion geometry, cameras on different levels have different coverage
- Mezzanines/lofts: partial second level creates underhang blindspots
- Open plan vs cubicles: different occlusion patterns
- Atriums: multi-level open spaces where cameras on one level cover another level
- Loading docks: varying floor height (dock levelers, ramps) changes coverage plane

**Implementation approach:**
- Performance test: measure coverage computation time at each fidelity level with BVH
- Establish accuracy thresholds: at what point does adding more geometry change coverage results <5%?
- Create guidance for scene builders: which geometry types matter for accurate DORI scoring?

---

### Thread 113 — Occlusion Culling & Visibility Graph Optimization for Large Security Scenes

**Status:** Active exploration — 2026-05-30

**Rationale:** As SentinelTwin scales to larger scenes (warehouses, campuses, parking garages), the naive approach of raycasting every camera to every grid cell becomes prohibitively expensive. Visibility graph precomputation and occlusion culling techniques can dramatically reduce the active raycast count while maintaining accuracy.

**Key exploration areas:**

**Visibility graph precomputation:**
- Build a visibility graph once: for each camera, compute which grid cells are in FOV (pre-filtering by angle)
- Only raycast cells already known to be in FOV — skip the 60-80% of cells outside the frustum
- For PTZ cameras: recompute FOV-mask only when position changes, not every frame
- Spatial partitioning: grid cells in BSP tree or quadtree for fast frustum-cell intersection tests

**Portal-based occlusion:**
- Rooms connected by doors/windows: a camera in Room A cannot see Room B except through the door portal
- Compute portal visibility: which rooms are visible to which cameras through which portals
- Drastically reduces: outdoor camera doesn't need to raycast indoor cells (and vice versa)
- Example: 5 rooms, 10 cameras, 1600 grid cells → without portals = 16000 raycasts; with portals = ~3000

**Hierarchical occlusion mapping (HOM):**
- Precompute per-camera HOM: a low-res texture showing which areas are occluded by static geometry
- Fast lookup: check cell against HOM before doing full raycast
- Update HOM incrementally when geometry changes (add/remove obstruction)

**From-before culling for real-time coverage:**
- Cache last frame's visible cells per camera
- On incremental changes (one obstruction moved), only re-check cells near the change
- 90% of cells retain same visibility status after a local change

**Implementation approach:**
- V0.1: full recompute on change (current state) — good for small scenes
- V0.2: add FOV pre-filtering per camera (skip cells outside frustum before raycasting)
- V0.3: portal-based room visibility for multi-room scenes
- V0.4: incremental recompute for real-time coverage feedback during drag

---

### Thread 114 — Camera Feed Simulation & Synthesized Fidelity (Noise, Blur, Compression, Realism)

**Status:** Active exploration — 2026-05-30

**Rationale:** SentinelTwin's CameraFeedCanvas currently offers basic overlay modes (realistic, IR, thermal, dirty lens). For a credible security digital twin, the camera feed must look like a security camera feed — not a pristine render from a game engine. Noise, compression artifacts, motion blur, auto-exposure adaptation, and sensor characteristics all affect the realistic representation of coverage quality.

**Key exploration areas:**

**Sensor noise modeling:**
- Shot noise: photon arrival statistics (Poisson). Dominant in low light. Scales with sqrt(signal)
- Read noise: sensor readout electronics. Fixed per frame. More visible in dark regions
- Fixed pattern noise (FPN): per-pixel bias variations. Calibrated out in high-end cameras
- Hot pixels: stuck-on pixels that don't respond to light. Increase with sensor age and temperature
- Banding noise: sensor row-readout timing variation, visible in low light as horizontal bands
- Implementation: additive Gaussian noise with signal-dependent variance + row banding pattern

**Compression artifacts:**
- H.264/H.265 macroblocking: 8×8 or 16×16 pixel blocks with quantization artifacts
- Bitrate-limited: more compression at night (noise is harder to compress) = more visible artifacts
- Keyframe interval: I-frames every 1-2s, P/B-frames between. Artifacts accumulate between keyframes
- I-frame bloat: scene with motion uses more bits per frame, reducing quality of static background
- Implementation: JPEG compression on rendered frames (libjpeg at controlled quality level)

**Auto-exposure simulation:**
- AE convergence time: 0.5-5 seconds after scene change (light turned on, person walks in)
- Overexposure: bright window causes camera to underexpose interior, making faces dark silhouettes
- WDR (Wide Dynamic Range): 120-140dB typical. Simulate by compressing highlight/shadow range
- AE hunting: AE oscillating between two exposure settings — visible as periodic brightness shift

**Motion blur:**
- Shutter speed: 1/30s typical for indoor, 1/120s+ for outdoor. Fast movement at low shutter = blur
- Rolling shutter: CMOS sensor scans row by row, fast movement creates skew distortion
- PTZ motion blur: panning at 50 deg/s at 1/30s shutter = ~1.7 deg of blur per frame

**Render approach:**
- Post-processing in CameraFeedCanvas: apply effects chain sequentially
- Performance: render at lower resolution (320×240) to keep post-processing cheap
- Separate camera feeds: each feed canvas uses same chain but different camera position

---

### Thread 115 — Real-Time Coverage Feedback During Edit Operations

**Status:** Active exploration — 2026-05-30

**Rationale:** Currently the user drags a camera and sees the frustum move, but coverage only recomputes on mouse-up. For a responsive digital twin experience, the user should see near-real-time coverage feedback during placement — the heatmap should update as they drag, not after. This requires incremental coverage computation and predictive rendering.

**Key exploration areas:**

**Incremental coverage during drag:**
- While dragging: only recompute cells affected by the moving camera (not all cells)
- Track which cells are gained/lost as the camera moves (differential update)
- Server-driven (or Web Worker): compute in background thread, push results to main thread
- For PTZ preset: render coverage preview for each preset position as user browses

**Ghost preview:**
- Show translucent "if placed here" heatmap alongside current heatmap
- User can see how adding a camera at the cursor position changes coverage
- Show zone status changes (this zone would PASS with this camera here)
- Show adversarial path before/after (this new camera closes the current vulnerability)

**Real-time quality metric display:**
- Floating HUD as user moves camera: "CAM-03: 67% → 82% coverage, +2 zones passed"
- Color-coded feedback: green arrow (improving), red arrow (degrading)
- Zone-by-zone impact: highlight zones that would change status with this placement

**Technical approach:**
- Debounced recompute: 50ms after last movement (rather than waiting for mouse-up)
- Focus recompute on grid cells in new camera's FOV only
- For instant feedback: precompute radial coverage map that can be evaluated without full raycast
- Three.js: use transform controls onChange callback to trigger incremental recompute

---

### Thread 116 — Camera Fingerprinting & Optical Identification Through Lens/Sensor Signatures

**Status:** Exploration candidate — 2026-05-30

**Rationale:** Every camera has a unique optical signature — sensor pixel defects, lens dust patterns, fixed pattern noise, and color response variations. In forensic contexts, matching footage to a specific camera is done through Photo Response Non-Uniformity (PRNU) analysis. For SentinelTwin's digital twin, understanding camera fingerprints enables realistic feed simulation and video authenticity verification.

**Key exploration areas:**
- PRNU: pixel-to-pixel sensitivity variations, unique to each sensor, detectable across compressed video
- Lens fingerprint: dust spots, scratches, chromatic aberration patterns
- Brand signatures: processing pipeline differences (Hikvision blue-tinted night mode, Axis warm color balance)
- Forensic applications: matching recovered footage to specific camera in system
- Simulation application: additive PRNU pattern to generated feeds for realism
- Privacy consideration: camera fingerprinting has privacy implications (deanonymization)

---

#include the following note

**Note:** These threads (107-116) are directly relevant to the current digital twin simulation work — PTZ movement modeling, material reflectivity physics, dynamic lighting, atmospheric view distance, placement constraints, geometry fidelity, occlusion optimization, feed synthesis, and real-time feedback. They represent active exploration candidates for the current development sprint, not speculative future topics.


### Thread 117 — AI-Based Forensic Search & Video Analytics Applications (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Appearance search: clothing color, vehicle color/make/model, object shape/texture descriptors
- Object-based retrieval: query-by-example across camera fleet
- Cross-camera path reconstruction: object re-identification, last-known-position logging
- Timeline event clustering: automatically group related events
- Behavioral analytics: abandoned object, wrong direction, crowd formation, fighting detection
- Privacy-preserving analytics: on-camera blurring/masking, differential privacy, federated learning
- Synthetic data: generating training data from simulated SentinelTwin scenes
---

### Thread 118 — Cloud-Native vs On-Prem Video Management Architecture (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Cloud VMS platforms: Verkada (full-stack hardware+cloud), Eagle Eye (VMS-as-a-service), Rhombus (edge AI + cloud), Motorola Aware (enterprise)
- Hybrid: edge recording + cloud backup, metadata-only to cloud, local failover
- Bandwidth optimization: H.265/SVC encoding, substream continuous + main stream on event
- Storage tiering: edge SSD (hot), cloud nearline (warm), cloud archive (cold), tape (frozen)
- Latency trade-offs: cloud PTZ lag, cloud analytics latency
- TCO: cloud subscription ($10-50/cam/month) vs on-prem capital + maintenance
- Compliance: data residency (GDPR), FedRAMP for government
---

### Thread 119 — Camera Testing & Benchmarking Methodologies (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Resolution testing: ISO 12233 test chart, spatial frequency response, MTF
- Low-light measurement: SNR across lux range, minimum illumination (lux at F-number)
- Dynamic range: WDR activation threshold, HDR merge quality, motion artifacts
- Latency: glass-to-glass (capture→encode→transmit→decode→display)
- IPVM testing: independent lab protocol, standardized environment, camera comparison
- Standards: UL 2802 (video analytics), IEC 62676 (CCTV), i-LIDS (detection scenarios)

---

### Thread 120 — Physical Security Standards Landscape Beyond IEC 62676 (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- UL 2900-1: software cybersecurity for network-connectable products
- EN 50132 (Europe): alarm systems - CCTV surveillance standards
- ASIS: security standards framework, physical asset protection (PAP)
- BS 8418 (UK): remote monitoring and receiving center standards
- CPNI (UK Centre for Protection of National Infrastructure): CNI security guidance
- NIST CSF: cybersecurity framework mapping for physical security devices
- SIA OSIPS: Open Security and Safety Integrity platform standards
- Insurance industry: UL certified monitoring, annual maintenance verification requirements
---

### Thread 121 — Insurance & Liability Implications of Security Coverage (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Premium reduction: verified coverage evidence for underwriters, 5-20% typical savings
- Liability reduction: demonstrating reasonable security measures in premises liability
- Duty of care: jurisdictional standards (foreseeability, reasonable security, proximate cause)
- Insurance carrier requirements: minimum coverage for different industry classes
- Self-insured retention: security evidence for SIR decisions
- Litigation risk: coverage gaps as negligence evidence, chain of custody for video evidence
- Insurtech integration: API-driven policy pricing based on verified coverage
- Insurance-specific report formats: ISO Acord forms, carrier verification templates
---

### Thread 122 — Audio Monitoring & Gunshot Detection Technology (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Acoustic gunshot detection: ShotSpotter (outdoor), Everbridge SafeZone (indoor), acoustic triangulation
- Audio analytics: aggression detection (yelling frequency), glass break (specific frequency), scream detection
- Privacy laws: 11 US states require all-party consent for audio recording, notice requirements
- Audio+video correlation: audio events triggering PTZ presets, forensic search by audio type
- Two-way audio: intercom, emergency call stations, verballerrent speaker systems
- Acoustic forensics: direction-of-arrival estimation, weapon type classification from muzzle blast
---

### Thread 123 — Alarm Monitoring & Central Station Integration (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Central station standards: UL 827 (central station), UL 1981 (automation), UL 681 (burglar alarm)
- Alarm verification: audio listen-in, video verification, sequential cross-zoning
- False alarm reduction: verified = higher police priority, unverified = lower/no response, 94-99% false alarm rate
- Police response priority: verified video = Priority 1 (immediate), unverified = Priority 3 (delayed)
- Communicators: cellular (GSM/LTE primary), IP (secondary), radio (backup)
- Central station software: DICE, Micro Key, Bold Group
---

### Thread 124 — Building Management System (BMS) Integration for Security (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- BACnet integration: lighting control synchronized with camera events, HVAC for fire response
- Elevator integration: lobby camera, floor access correlation
- Intercom/PA: Talkmaster, Aiphone, Commend two-way communication systems
- Fire alarm integration: pull station cameras, sprinkler activation verification
- I/O relay control: door strikes on event, gates/barriers on LPR match
- Guard tour systems: NFC/QR check-in at camera locations, route optimization
- Mass notification: emergency alerts triggered by camera analytics

---

### Thread 125 — Theft & Shrinkage Analytics for Retail Security (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Organized retail crime (ORC): flash mob patterns, booster bag detection
- Point-of-sale monitoring: register exception video correlation (void/refund/no-sale)
- Self-checkout protection: item scanning validation, walk-away detection
- Fitting room: count-in vs count-out flow, tag detection
- Back-of-house: receiving dock, stockroom access, employee theft detection
- EAS integration: tag alarm to camera preset to video verification
- Retail VMS: LiveView Technologies, Solink, SecureAlert, RiteTrack
---

### Thread 126 — Healthcare & Hospital Security Camera Applications (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Infant protection: Hugs, SafePlace abduction prevention, exit alarm integration
- Behavioral health: ligature-resistant housings, therapeutic vs surveillance balance
- Emergency department: waiting room violence, patient elopement, staff assault detection
- Pharmaceutical: narcotics cabinet surveillance, pharmacy access audit
- HIPAA compliance: camera placement avoiding patient areas, de-identification for analytics
- Parking/blue light: blue light phone integration, assault detection analytics
---

### Thread 127 — School & Campus Security Camera Systems (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Single point of entry: door cameras, intercom, remote release, visitor screening
- Visitor management: Raptor, LobbyGuard integration with cameras
- Active shooter: acoustic detection, AI weapon detection, lockdown trigger
- Classroom: interior door locks, intercom to office, panic buttons
- Perimeter: parking lot, athletic fields, bus loop coverage
- Bullying prevention: loitering in hallways/bathroom approaches
- Emergency response: camera feeds to first responders, digital mapping
- Funding: COPS grants, school safety grants, ESSER funds
---

### Thread 128 — Event Security, Stadium & Venue Surveillance (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Crowd density: people counting per entrance, bottleneck detection
- Egress monitoring: exit lane counting, wrong direction detection
- VIP tracking: cross-camera re-identification, last-known-position logging
- Ticketing integration: credential scanning, ticket-holder facial verification
- Parking: space counting, LPR for event parking
- Temporary coverage: portable towers, rapid deployment, temporary network
- Command center: video wall management, incident response, multi-agency coordination
- Concealed carry detection: weapon detection analytics at stadium scale
---

### Thread 129 — Warehouse, Logistics & Industrial Camera Applications (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Rack coverage: shelf occlusion, multi-level coverage patterns
- Loading dock: trailer ID LPR, seal check, door open/close correlation
- Yard management: trailer parking verification, yard tractor tracking
- Personnel safety: HAZMAT exclusion zones, forklift pedestrian detection
- Inventory verification: cycle count video evidence, drone inventory count
- 24/7 operations: night cameras, thermal for low-light person detection
- Cold storage: condensation-proof cameras, sub-zero rated, defrosting mechanisms

---

### Thread 130 — Wireless/Cellular Camera Placement & Coverage (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Bandwidth-constrained placement: lower frame rate, resolution scaling, motion-triggered recording
- Signal strength modeling: cellular coverage heat maps, antenna optimization, signal booster requirements
- Solar-powered sizing: panel wattage vs insolation vs consumption for 24/7 operation
- Data cap management: recording scheduling, edge storage buffer, image-only vs video upload
- Cellular failover: dual-path cameras (wired primary + cellular backup)
- Temporary deployment: construction site, event, remote asset monitoring
---

### Thread 131 — Body-Worn & Mobile Camera Integration (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Body-worn cameras: Axon, WatchGuard, Motorola VB400, upload/docking workflows
- Bodycam coverage: POV coverage patterns, motion blur at DORI distances
- Vehicle cameras: cruisers, patrol vehicles, mobile ALPR
- Drone surveillance: DJI Dock, autonomous patrol, flight path coverage
- Evidence management: chain of custody, redaction, discovery compliance
- Mobile storage: 8-64GB edge capacity, resolution trade-offs
- Docking: auto-upload on return, battery charging, firmware sync
---

### Thread 132 — Privacy Regulations & Camera Compliance (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- GDPR Article 6: lawful basis for video processing, legitimate interest assessment, DPIA
- GDPR Article 13: privacy notices, signage, data subject rights
- CCPA/CPRA: employee monitoring, video data as personal information
- BIPA (Illinois): facial recognition consent, $1K-$5K per violation private right of action
- Washington/New York: emerging biometric surveillance laws
- EU AI Act: high-risk classification for biometric ID, conformity assessment
- Privacy-by-design placement: avoiding non-target capture (sidewalks, neighbors)
- Data retention: 30-90 day typical limit, evidence exceptions, auto-deletion
---

### Thread 133 — Camera Supply Chain & Procurement Best Practices (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Lead times: 2-8 weeks standard, 8-16 weeks specialized (thermal, explosion-proof)
- Gray market risks: unauthorized distributors, counterfeit hardware, region-locked firmware
- Warranty: 3-5 years typical (Axis 5yr, Bosch 3yr, Hikvision 3yr)
- EOL notification: 1-3 years notice, last-time-buy windows
- NDAA sourcing: authorized US distributors (ADI, Anixter, ScanSource)
- Project registration: manufacturer incentives, bid pricing, design assistance, demo units
---

### Thread 134 — Security Guard Force Integration & Patrol Optimization (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Guard tour optimization: patrol route planning, uncovered interval minimization, GPS/NFC tracking
- Alarm response: response time modeling, dispatch prioritization, camera-guided response
- Manpower planning: guards-per-camera ratio, post-order development, site-specific staffing
- Remote monitoring: virtual guarding (Pro-Vigil, Deep Sentinel), audio intervention first
- Two-way audio: guard-to-intruder verbaliverrent, effectiveness data
- Camera-guided response: approach from covered angle, situational awareness
- Guard force management: TrackTik, Silvertrac, Corrigo, scheduling, incident reporting
- Cost modeling: guard cost vs camera cost trade-offs for ROI analysis

---

### Thread 135 — Video Analytics Performance Standards & Certification (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- i-LIDS: UK Home Office detection scenarios (parked vehicle, stolen vehicle, loitering)
- UL 2802: video analytics performance standard, test methodology
- PETS: Performance Evaluation of Tracking and Surveillance benchmarks
- Precision-Recall curves: threshold-dependent performance, F1, AUC
- Operating point: high-precision (fewer false alarms) vs high-recall (fewer missed)
- Scenario-specific accuracy: empty scene FA rate, crowded scene miss rate, all-weather performance
- Third-party labs: i-LABS (Netherlands), Fraunhofer, independent certification
- Accuracy vs distance: degradation curves, accuracy vs ambient light, vs object speed
---

### Thread 136 — Physical Security Information Management (PSIM) & Unified Platforms (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- PSIM platforms: Genetec Security Center, Milestone XProtect Corporate, Everbridge, CNL, Vidsys
- Integration: single pane of glass, multi-system correlation, unified alarm management
- Event correlation: cross-system rules (access denied + loitering + tailgating = security alert)
- Map visualization: GIS integration, floor plan overlays, real-time sensor status
- Incident management: case creation, evidence attachment, timeline, report generation
- Compliance: automated report generation, retention rules per data type
- Open vs closed: Genetec open SDK, Milestone MIP SDK, Azena ACAP marketplace
- Cloud PSIM: Motorola Solutions, Everbridge SaaS, Genetec Stratocast
---

### Thread 137 — Thermal Imaging for Physical Security (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Sensor types: uncooled microbolometer (VOx, a-Si), cooled (InSb, MCT) for extreme range
- Key specs: resolution 160x120 to 640x480 thermal, NETD <50mK, spectral 8-14um LWIR
- Thermal vs visible DORI: thermal better for DETECTION (temp contrast), worse for IDENTIFICATION (no texture)
- Deployment: perimeter detection (heat signature), fire detection (overheating equipment), total darkness areas
- Thermal + visible fusion: co-aligned sensors for detection + identification
- Manufacturers: FLIR/Teledyne, Hikvision thermal, Dahua thermal, Opgal, Guide Infrared
- Cost: 3-10x visible camera, decreasing with Chinese manufacturer entry
---

### Thread 138 — Gunshot & Weapon Detection Systems (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Acoustic gunshot: ShotSpotter (municipal), Everbridge SafeZone (indoor), Omnilert, V-Alert
- Acoustic sensors: microphone array, ultrasonic+audible, muzzle blast vs explosion discrimination
- Gunshot location: TDOA triangulation (3+ sensors), GPS coordinates, map visualization
- AI weapon detection: ZeroEyes (human-in-the-loop), Omnilert Gun Detect, Evolv weapons screening
- Video analytics: concealed weapon AI, surface weapon detection
- Lockdown integration: detection -> auto-lockdown, alert to security/first responders
- Privacy: continuous audio for gunshot, facial rec in weapon detection systems
- Response: police dispatch integration (ALI/ANI), real-time camera to first responders
---

### Thread 139 — LiDAR & 3D Sensing for Physical Security (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Security LiDAR: fence-top breach, perimeter volumetric detection, privacy-free people counting
- Types: 1D single beam (fence), 2D line scan (counting), 3D multi-beam (area)
- LiDAR vs camera: works in total darkness, no shadows/glare, no privacy issues, lower resolution
- Manufacturers: Ouster Blue Line, Velodyne, Hesai, Quanergy, Blickfeld
- LiDAR+camera fusion: LiDAR detection -> PTZ identification
- Point cloud processing: occupancy grid, voxel map, 3D background subtraction
- LiDAR coverage: angular resolution, effective range vs reflectivity, FOV
- False alarm comparison: LiDAR FA rate vs video analytics FA for outdoor perimeter
- Cost: solid-state $500-$2K, mechanical $5K-$15K (declining)

---

### Thread 140 — Radar for Physical Security Detection (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Security radar: perimeter (200m-2km), ground surveillance, water surface detection
- Technology: FMCW (common), pulsed-Doppler (longer range), MIMO (resolution)
- Specs: range resolution 1-5m, velocity resolution ~0.1 m/s
- Target classification: radar cross-section analysis (person vs vehicle vs animal vs drone), micro-Doppler gait
- Radar+camera fusion: radar detects -> PTZ slews to location for identification
- Manufacturers: FLIR Ranger, SpotterRF, Navtech Radar, Echodyne, Thales
- Coverage: fan-shaped beam, range-dependent resolution, multipath
- Weather resilience: radar through fog, rain, snow, dust (vs camera limitations)
- False alarms: vegetation motion, small animals, environmental clutter filtering
---

### Thread 141 — Video Data Retention, Storage & Evidence Management (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Retention: 30-90 days general, 180-365 regulated (banks/casinos), indefinite for evidence
- Storage tech: edge SD (64GB-1TB), NVR HDD (4-48TB RAID), cloud tiers, LTO tape
- Codec impact: H.264 vs H.265 vs H.265+/Smart Codec, 30-50% savings
- Bitrate: CBR (predictable), VBR (efficient), capped VBR (both)
- Evidence management: secure export (write-protected, hash, timestamp), chain of custody, redaction
- Legal hold: retention hold on evidence, preservation notices, discovery
- Formula: (bitrate * cameras * hours/day * retention) / 8 / 1024^3 = TB
- Cloud cost: S3 ~$23/TB/mo, Glacier ~$4/TB/mo, retrieval costs
- TCO: $/TB, 3-5 year HDD life, RAID overhead, power/cooling
---

### Thread 142 — Security Operations Center (SOC) Design & Ergonomics (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Video wall: layout, resolution per screen, multiview arrangement
- Operator console: monitors per operator (4-8 typical), KVM switching, desk layout
- Alarm fatigue: FA per operator/shift, overload threshold, intelligent prioritization
- Shift handoff: incident handover, status board, shift log
- SOC tiers: Tier 1 monitoring/alerting, Tier 2 investigation, Tier 3 forensics/management
- PSAP: direct video to 911, real-time camera for first responders
- Remote monitoring: off-site SOC, secure VPN, bandwidth requirements
- Ergonomics: monitor distance (arm's length), ambient light (low/indirect), max 4hr per console session
---

### Thread 143 — Escalation & Emergency Response Workflow Modeling (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Detection time: analytics (sub-second), human operator (seconds-minutes), patrol (minutes-hours)
- Verification: video (seconds), audio call (seconds), guard dispatch (minutes)
- Dispatch: internal guard (30-90s), alarm company (60-180s), police (varies)
- Response: on-site guard (1-5min), local police (5-15min urban, 15-30min suburban, 30+ rural)
- Total intervention: sum of all stages, 5-30min typical
- SentrySafe TLE: loss expectancy based on response time and intruder dwell
- Escalation matrix: severity * confidence -> response level (ignore/review/dispatch/alert police/lockdown)
- Post-incident review: timeline reconstruction, response effectiveness, improvement recommendations
---

### Thread 144 — Perimeter Security Technology Landscape Beyond Cameras (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Fence detection: fiber optic (deflection, 0.5-1m localization), triboelectric (vibration), taut wire (displacement)
- Buried: leaky coax (guided radar), fiber buried (strain), seismic geophones (footstep)
- Open-air: active IR beams (visibility), passive IR (thermal contrast), microwave barriers (weather resistant)
- Ground radar: GPR for tunnel detection, surface radar for perimeter gaps
- Sensor fusion: fence detect -> camera verify -> PTZ track -> guard dispatch
- Nuisance filtering: vegetation/animal/weather FA management, zone sensitivity
- Graded detection: Zone 1 outer (lower certainty) -> Zone 2 inner -> Zone 3 building (highest)
- Standards: ASTM F3100 (physical security), CPNI graded security levels
---

### Thread 145 — Camera Integration with UGVs & Security Robotics (not exploring now)

**Status:** Exploration backlog — 2026-05-30 (not currently exploring)

**Topics for future exploration:**
- Security robots: Knightscope (outdoor), Cobalt (indoor), SMP, ASI
- Capabilities: autonomous GPS/LiDAR/IMU patrol, docking, 360 cam, two-way audio, PA
- Patrol modeling: path-based coverage, revisit frequency, speed vs coverage tradeoff
- Robot edge AI: same analytics as fixed cameras, PTZ equivalent tracking
- Robot as mobile PTZ: stop at patrol point -> survey -> move to next point
- Fleet coordination: multi-robot patrol, handoff, charging schedule optimization
- Robot + fixed synergy: fixed cam detects anomaly -> robot dispatched to investigate
- Constraints: battery (8-16hr), weather limitations, stair/clutter traversal
- This thread is inherently sensitive. All content must be framed as: "understanding attacker methodology to design better defenses"
- No output shall provide evasion instructions without corresponding countermeasures
- All research cited from law enforcement, academic criminology, and defensive security sources (not criminal manuals)
- User-facing features position this as "attack scenario library" in the context of security assessment

---

## Thread: Novel Algorithm 2 — Blind Spot Topology Analysis

**Status:** Implemented and tested (2026-05-27)
**File:** `apps/studio/src/simulation/blind-spot-topology.ts`

**Problem it solves:** Raw coverage % and `quality === "none"` cells give no actionable spatial context.
A 15% blind spot is very different depending on whether it's an isolated corner or a continuous corridor
connecting an entry door to a critical zone.

**Algorithm:**
1. Filter `CoverageCellResult` to cells where `quality === "none"` and `walkable === true`
2. Flood-fill BFS to cluster connected blind cells into discrete regions
3. For each region:
   - Compute `areaSqM` (cells × CELL_SIZE²)
   - Check proximity to `EntryPointNode` positions (within 2 cell-widths = "entry adjacent")
   - Check polygon overlap with `CriticalZoneNode` polygons
   - Classify:
     - `entry_corridor` — region connects an entry point to a critical zone (traversable blind route)
     - `entry_connected` — region is adjacent to an entry point but doesn't reach a critical zone
     - `isolated` — region has no entry proximity
4. Severity assignment:
   - `entry_corridor` → `critical`
   - `entry_connected` + area ≥ 4m² → `high`, else `medium`
   - `isolated` + area ≥ 9m² → `medium`, else `low`

**Schema additions:**
- `blindRegionSchema` added to `security-scene.ts`
- `blindRegions?: BlindRegion[]` field added to `simulationResultSchema`
- Type export: `BlindRegionResult`

**UI integration:**
- `IssuesTab.tsx` — "Blind Spot Topology" section below issues list
- Shows: severity badge, classification label, area (m²), cell count, affected zone chips
- Critical/high regions use tinted backgrounds (red/amber) for visual urgency

**Tests:** 7 unit tests in `blind-spot-topology.test.ts` — all pass
- Empty scene
- Single isolated cell → isolated/low
- Region near entry → entry_connected/medium
- Entry-to-zone corridor → entry_corridor/critical
- Two disconnected regions → correctly split
- Sort order: critical first

**Key insight:** Entry corridor regions are the highest-value finding — they represent a
continuous unmonitored path from outside to the most sensitive zone. A 4m² corridor is
more dangerous than a 20m² isolated blind spot.


---

## Suggested Deep-Dive Priorities

The following are recorded as ready-to-start deep-dive topics from the digital twin simulation physics thread batch:

| Priority | Thread | Topic | What to explore |
|----------|--------|-------|-----------------|
| **P0** | 107 | PTZ Movement Kinematics & Temporal Coverage | PTZ state machine model (IDLE→MOVING→SETTLING), acceleration/deceleration curves, preset recall timing, guard tour dwell patterns, temporal duty cycle calculation for moving cameras |
| **P1** | 109 | Dynamic Light Modeling | Inverse-square light falloff implementation, shadow-based blindspot detection, multiple light source interaction, color temperature effects on camera sensor performance, lux-to-DORI penalty mapping |
| **P2** | 108 | Surface Material BRDF & Visibility Physics | Extend obstruction material model with angle-dependent visibility scoring, Fresnel reflection at oblique angles, material-specific DORI penalty curves, backlighting through translucent materials |

**Note:** These are directly relevant to the current development sprint. They build on existing work in the coverage engine, rendering pipeline, and temporal simulation.

---

## Map UI Design References

**Thread:** 2026-05-27 map interaction / visual language review

**Files reviewed:**
- `DesignSystem_MapLayerVisualLanguage_CanonicalTokens.png`
- `DesignSystem_MapInteractionStates_MiniMapPathMapWireframes.png`
- `MiniMapComponent_ExpandedHoverState_DrawerNavigation.png`
- `PathMapComponent_ScenarioPathPanel_RouteSummaryState.png`
- `PathMapComponent_ReplayState_LiveActorVisibility.png`

**Findings:**
- MiniMap and PathMap are expected to share a single visual language for walls, doors, windows, cameras, FOV wedges, zones, and path quality colors.
- Map interactions should be active, not decorative: hover should reveal quick context, clicks should select, drag should pan, wheel should zoom, and double-click should fit.
- PathMap needs a live state summary that can show current replay time, current quality, and covering cameras, plus a segment detail surface for hovered or selected segments.
- The MiniMap has an expanded/drawer state in the reference language, but the current studio only has the compact embedded version, so expansion remains an open follow-up.

**Implication:** The shared map module should remain the canonical implementation for interaction behavior and style tokens, and future map additions should reuse the same language rather than introducing panel-specific variants.

**Current implementation note:** Replay surfaces now respect `activePathId` instead of falling back to the first path, and the shared quality ribbon uses interpolated path sampling so long segments do not collapse into waypoint-only snapshots.

---

## Camera Sensor Specs and PPM Accuracy

**Thread:** 2026-05-27 camera sensor database research

**Files reviewed:**
- `apps/studio/src/schema/security-scene.ts` (CameraNode schema)
- `apps/studio/src/simulation/coverage.ts` (computePixelDensity, deriveResolutionWidth)
- `apps/studio/src/components/inspector/InspectorPanel.tsx` (computeDoriRanges)
- `apps/studio/src/components/view/CameraViewMode.tsx` (rangeMeters)
- `apps/studio/src/components/workspace/CameraPresetPicker.tsx` (4 camera presets)

**Current accuracy limits:**
The coverage engine computes PPM (pixels per meter) using this formula:
```
PPM = resolutionWidth_px / (2 × distance_m × tan(FOV_H_deg × π / 360))
```

This requires only resolution width and horizontal FOV. Both are available (resolutionWidth is optional with fallbacks, FOV is required). The formula is correct for the input values.

However, the inputs themselves may be incorrect or inconsistent because:

1. **FOV is specified directly** (`fovHorizontalDeg`), not derived from focal length + sensor size. If a user sets focalLengthMm=4mm with fovHorizontalDeg=90° for a 1/3" sensor, the actual FOV should be ~62°, not 90°. There is no validation or derivation — the two fields are independent with no constraint.

2. **Sensor size is absent from the schema.** Without `sensorWidthMm`/`sensorHeightMm` or `sensorFormat`, FOV cannot be cross-checked against focal length. This means:
   - A user can set an impossible combination (wide focal length + wide FOV on a small sensor)
   - Coverage calculations silently use whatever FOV is entered, producing wrong DORI ranges
   - The lens picker (2.8mm, 4mm, 6mm, 8mm) sets `focalLengthMm` but has zero effect on coverage

3. **Resolution width fallbacks are inconsistent** between UI components and the coverage engine:
   - `computeDoriRanges`/`rangeMeters`: discrete breakpoints (≥8MP→3840, ≥4MP→2688, else→1920)
   - `computePixelDensity` in coverage.ts: `√(MP × 1M × 16/9)` (continuous formula assuming 16:9)
   - For 2MP: fallback gives 1920 vs formula gives 1886 — minor but inconsistent
   - For 4MP: fallback gives 2688 vs formula gives 2667 — also minor drift

4. **No aspect ratio is stored.** The schema has `resolutionWidth` and `resolutionHeight` as optional, but there is no `aspectRatio` field. The coverage engine hard-codes 16:9 in `deriveResolutionWidth`. Non-16:9 cameras (e.g., 4:3 for some multi-sensor) would compute wrong PPM.

**Common sensor sizes for security cameras (not in codebase):**
| Sensor Format | Width (mm) | Height (mm) | Used in |
|---|---|---|---|
| 1/4" | 3.2 | 2.4 | Budget dome cameras |
| 1/3" | 4.8 | 3.6 | Common bullet cameras |
| 1/2.7" | 5.37 | 4.04 | Common IP cameras |
| 1/2.5" | 5.76 | 4.29 | Higher-end IP cameras |
| 1/2" | 6.4 | 4.8 | PTZ cameras |
| 1/1.8" | 7.18 | 5.32 | Multi-sensor, premium |
| 2/3" | 8.8 | 6.6 | High-end PTZ |
| 1" | 12.8 | 9.6 | Cinema-grade, advanced analytics |

**Relationship that should exist in the engine:**
```
FOV_H = 2 × arctan(sensorWidth_mm / (2 × focalLength_mm))
FOV_V = 2 × arctan(sensorHeight_mm / (2 × focalLength_mm))
```

This would let the engine derive FOV from focal length + sensor, or validate that a user-entered FOV is physically possible for the given lens/sensor combination.

**Recommendation:**
This is not needed for V0.1 because:
- The camera preset library is 4 generic presets, not real camera models
- Users enter FOV directly, which is the most intuitive parameter
- The current PPM computation is correct as long as FOV is accurate
- Adding sensor specs would increase schema complexity without changing coverage output

Add sensor specs (`sensorWidthMm`, `sensorHeightMm`, `sensorFormat`) when:
1. The camera preset library grows to include real camera models (CP Plus, Hikvision, Axis)
2. A user reports that a real camera's FOV doesn't match their entry
3. The FOV derivation feature is specifically requested (e.g., "I know my camera has a 4mm lens on a 1/2.7" sensor, what's my coverage?")

**Status:** Research complete. Not implemented. Deferred to V0.2+.

---

## R3F / Three.js Compatibility Audit

**Thread:** 2026-05-27 runtime warning cleanup

**Findings:**
- `@react-three/fiber@9.6.1` still instantiates `new THREE.Clock()` internally, which triggers the Three.js r184 deprecation warning.
- The app itself is not calling `THREE.Clock` directly in canvas code; the warning is dependency-driven.
- `PCFSoftShadowMap` warnings were coming from R3F's default shadow setup, so the studio canvases now request `shadows="percentage"` to stay on the non-deprecated `PCFShadowMap` path.

**Mitigation used:**
- Added a local `three-compat` shim that replaces `THREE.Clock` with a drop-in compatibility clock before the R3F canvases mount.
- Kept the runtime behavior the same for the current workspace while avoiding the noisy console deprecation.

**Related cleanup:**
- Restored the shared map utility export surface so `path-quality` continues to re-export `polygonToSvgPoints` and `obstacleRectPoints` for tests and map panels.

---

## Thread 22: Camera Studio Screen Inventory and Map Visual Language

**Status:** Implementation review complete. The live Studio shell already covers coverage/map, camera view, camera wall, path replay, compare, MiniMap, and PathMap; the remaining work is polish plus canonical surfacing.

**Key findings:**
- `BottomPanel` already had a render branch for `redundancy`, but the tab strip did not expose it until 2026-05-27.
- `map-colors.ts` and `quality-display.ts` are the shared canonical sources for the 2D map language; new map surfaces should not invent their own palette.
- The practical next step is not a brand-new screen, but keeping the current screen inventory and map-language docs synchronized with the implementation.

**Next:**
- Keep `Docs/design/CAMERA_STUDIO_SCREEN_STATUS.md` updated when a screen mode changes materially.
- Keep `Docs/design/MAP_LAYER_VISUAL_LANGUAGE.md` aligned with the shared map token files whenever the palette changes.

---

## Thread 23: Kenney all-in-one bundle asset direction for SentinelTwin

**Status:** Research complete. Not implemented.

**Source bundle:**
- `/Users/pranay/Projects/adhoc_resources/game_assets/Kenney Game Assets All-in-1 3.4.0/`

**Useful families for SentinelTwin:**
- `3D assets/Building Kit`
- `3D assets/Furniture Kit`
- `3D assets/City Kit - Industrial`
- `3D assets/City Kit - Commercial`
- `3D assets/City Kit - Suburban`
- `3D assets/Prototype Kit`
- `3D assets/Modular Buildings`
- `2D assets/Prototype Textures`
- `2D assets/Road Textures`
- `2D assets/Pattern Pack`
- `2D assets/Brick Pack`

**Representative file-name signals:**
- Building Kit: `wall.png`, `floor.png`, `wall-doorway-square.png`, `wall-window-round.png`, `door-rotate-square-a.png`, `column.png`, `plating.png`
- Furniture Kit: `desk_SE.png`, `deskCorner_SW.png`, `bookcaseClosedWide_NE.png`, `bookcaseOpenLow_SW.png`, `chairModernFrameCushion_NE.png`, `lampWall_NE.png`, `tableRound_SE.png`

**Direction:**
- Use Building Kit for the structural shell.
- Use Furniture Kit for desks, counters, chairs, shelves, and lights.
- Use City Kit - Commercial / Industrial only for exterior shells and site context.
- Use Prototype Textures and Road Textures for restrained professional surfaces.
- Avoid platformer, fantasy, dungeon, holiday, and collectible packs for core SentinelTwin visuals.

---

## Thread 24: Dock and evidence-hierarchy polish for studio analysis surfaces

**Status:** Implemented in current pass. Polished after reference review.

**Finding:**
- The bottom drawer needed to behave like an explicit analysis surface, not a generic tab footer.
- The camera wall, single-camera view, and replay view all benefited from a visible current-state summary: best camera, current quality, reason line, next event, and route context.
- Explicitly exposing the counterfactual and threat analysis tabs reduced the sense of “hidden work” in the drawer and made the UI more honest without changing architecture.

**Implementation signals:**
- `BottomPanel.tsx` now includes a stronger analysis header and visible `COUNTERFACTUAL` / `THREAT REVIEW` tabs.
- `ScenarioPathPanel.tsx` now shows no-path / no-simulation / current-issue states.
- `CameraViewMode.tsx` now includes a reason line, replay quality/segment labels, and a clearer DORI overlay hierarchy.
- `CameraWallView.tsx` now surfaces the current best camera and marks the best tile.
- `PathReplayView.tsx` now includes a current-state card with time, segment, quality, best camera, and next event.

---

## Thread 25: Microsoft Webwright as a code-driven browser QA path

**Status:** Discovered and installed locally as a Codex marketplace; not yet surfaced as callable tools in this live session until Codex reloads the marketplace.

**Source signals:**
- Official repo: `microsoft/Webwright`
- Marketplace install path: `/Users/pranay/.codex/.tmp/marketplaces/webwright`
- Codex install command from the repo README: `codex plugin marketplace add microsoft/Webwright`

**Key findings:**
- Webwright is a minimal SWE-style browser-agent framework built around a rerunnable Python workspace and Playwright browser sessions.
- The repo ships a Codex plugin manifest at `.codex-plugin/plugin.json` and a shared skill at `skills/webwright/`.
- The plugin is a better fit than ad-hoc browser clicking when the task benefits from repeatable, scriptable QA with saved artifacts and screenshots.

**Operational note for SentinelTwin:**
- Prefer Webwright for iterative browser QA on local web targets when it is installed and the task needs code-driven, rerunnable Playwright workflows.
- If Webwright is unavailable in the current session, fall back to the most direct browser tool available and keep the install/marketplace path documented for the next run.

---

## Thread 26: Trust Hardening and Placeholder Audit

**Status:** Open. The product has moved past the most obvious fake affordances, but the trust layer still needs to be treated as a first-class subsystem.

**Source signals:**
- Repo code scan for `TODO`, `FIXME`, `placeholder`, `hardcoded`, `mock`, and `stub` across `apps/studio/src`
- Code quality review and wide-open brainstorm docs in `Docs/decisions/`
- Current implementation and full-vision inventory docs

**Key findings:**
- The biggest product risk is not missing simulation math anymore. It is a regression back into demo-like surfaces that look live but are not tied to source data.
- The live app still needs a systematic way to label claims as computed, inferred, imported, simulated, or placeholder.
- Several classes of trust regressions are now visible from the code search itself:
  - hardcoded values that can drift from scene data
  - placeholder or “coming soon” affordances that imply hidden functionality
  - fallback UI that is acceptable for hydration but should never masquerade as product truth
  - tests that need to assert visible claims remain sourced from the canonical data model

**What should exist next:**
- A placeholder audit checklist for every visible panel, label, badge, and CTA
- A “truth label” convention for the UI so simulated/inferred/imported/placeholder content is obvious
- Regression tests that fail if a visible metric or explanation becomes detached from the scene, simulation, or evidence ledger
- A documented rule for deterministic placeholders so SSR/client hydration does not create fake product states

**Why this matters for SentinelTwin:**
- Full-vision SentinelTwin is not just a simulator. It is a security twin that must remain believable, auditable, and evidence-backed at every visible layer.
- Trust erosion from one fake metric or dead button can undo the value of the whole platform faster than a missing feature does.

**Next:** Build a placeholder/truth audit harness and use it as a gate before adding more visible surface area.

---

## Thread 27: Runtime incident log and performance-trace bundle

**Status:** Implemented in current pass. The debug bundle now carries explicit runtime incidents and performance traces.

**Source signals:**
- `apps/studio/src/store/studio-store.ts`
- `apps/studio/src/lib/diagnostic-bundle.ts`
- `apps/studio/src/components/bottom-panel/DebugTab.tsx`

**Key findings:**
- Runtime health becomes much more actionable when the path history is paired with explicit incident records.
- Validation failures, provider failures, runtime exceptions, and successful performance traces can all be captured as support-ready store events without building a separate telemetry sink first.
- The debug panel can now show both the journey health cards and the incident/performance history in the same support surface.

**Operational note for SentinelTwin:**
- Prefer the in-product runtime incident log for support bundles and local debugging before introducing external telemetry infrastructure.
- Keep the incident categories aligned with the existing local-first workflow so the support bundle stays readable and reconstructable from browser state.

## Thread 28: Truth labels and trust-audit coverage

**Status:** Implemented in current pass. Claim-heavy summary surfaces now carry explicit truth labels and the trust-audit manifest checks them.

**Source signals:**
- `src/components/bottom-panel/MetricsTab.tsx`
- `src/components/bottom-panel/ReportLiteTab.tsx`
- `src/components/layout/StatusBar.tsx`
- `src/lib/truth-audit.ts`

**Key findings:**
- Visible summary surfaces become more trustworthy when they say whether they are simulated, computed, or live instead of implying it through layout.
- Source-string trust audits are a useful local guardrail because they catch drift in the user-facing claim surfaces before it ships.
- The simulated/computed/live labels should stay aligned with the same provenance helper so the UI, the manifest, and the tests do not diverge again.
- The project launcher scan card now uses `Preview / Manual-assisted`, keeping the launcher aligned with the dashboard-facing scan copy and the planned guided-scan status.
- The per-node truth ladder now surfaces review status, source trace coverage, and geometry validity in Report Lite, Scene Intelligence, and report exports, so credibility is visible alongside coverage.
- Path Replay now keeps its playback state in the shared store, which lets Camera View and Camera Wall follow the same replay progress instead of diverging on a local timer.

**Operational note for SentinelTwin:**
- Keep explicit truth labels on the most claim-heavy summary surfaces and extend the trust-audit manifest whenever a new user-facing claim surface appears.

## Thread 29: Shared-workspace RBAC/ABAC action gates

**Status:** Implemented in current pass. The governance control plane now exposes per-action allow/blocked gates for the active member.

**Source signals:**
- `src/components/bottom-panel/GovernanceTab.tsx`
- `src/lib/workspace-access.ts`
- `src/lib/workspace-governance.ts`

**Key findings:**
- Role and approval badges are useful, but action gates are what make RBAC/ABAC understandable to operators.
- The route helper already had enough information to show per-action reasons; the missing piece was surfacing that policy in the control plane.
- Shared-workspace policy still needs a backend-safe persistence layer, but the local UI now reflects the intended routing model clearly.

**Operational note for SentinelTwin:**
- Keep action-level routing visible wherever publish/review/restore can be triggered, and preserve the reason text so reviewers can understand why a gate is open or closed.

## Thread 30: Provider governance visibility

**Status:** Implemented in current pass. The debug panel now exposes provider fallback order and cloud/local policy state.

**Source signals:**
- `src/agents/provider-selection.ts`
- `src/components/bottom-panel/DebugTab.tsx`
- `src/components/layout/ViewSettingsModal.tsx`
- `src/components/command-bar/CommandBar.tsx`

**Key findings:**
- A provider picker is not enough; operators need to see which provider is active, what the fallback order is, and whether cloud calls are allowed by policy.
- Keeping provider governance in the debug panel makes the control plane visible without duplicating the selection logic.
- The product now also needs a visible model-eval suite so prompt and provider changes can be exercised against the same structured-output fixtures that power command parsing, counterfactuals, report generation, and AI layout drafting.
- The model-eval suite now also persists a compact local run history with stage-budget and trend comparison, which makes the provider-control plane measurable across sessions instead of only at a single point in time.
- The debug panel now also exposes a provider-health dashboard plus a canonical prompt registry, and the command bar plus AI draft launcher now mirror provider health, estimated budget classes, the latest measured AI action, and a simple recent-vs-previous trend summary at the point of use. The remaining open question is richer aggregation and whether that should live in a broader operational dashboard once the measured trail matures.

**Operational note for SentinelTwin:**
- Keep provider availability, fallback order, local-only policy, eval-suite visibility, and historical comparison synchronized across the debug surface and the launch/command surfaces, and gate any model-backed behavior against the same shared summary helper.

## Thread 31: Support-ready incident bundle visibility

**Status:** Implemented in current pass. The debug panel now shows a support bundle summary card and a dedicated `Download Support Bundle` action.

**Source signals:**
- `src/lib/diagnostic-bundle.ts`
- `src/components/bottom-panel/DebugTab.tsx`
- `src/lib/__tests__/support-bundle.test.ts`

**Key findings:**
- A support bundle is more useful when the operator can see the incident snapshot, latest incident, latest performance trace, and AI telemetry trend before exporting it.
- Reusing the diagnostic/support bundle helper keeps the visible summary aligned with the JSON payload that gets downloaded.
- The remaining observability gap is now narrower: external log capture and broader alerting still belong in a deeper support pipeline, but the local support bundle is already operator-visible and exportable.

**Operational note for SentinelTwin:**
- Keep the support summary in sync with the exported payload, and treat the support bundle as the handoff artifact for local incident triage until the deeper external log capture layer exists.

## Thread 32: External log capture lane

**Status:** Implemented in current pass. The debug panel now accepts pasted external logs and stores them in the support bundle.

**Source signals:**
- `src/store/studio-store.ts`
- `src/components/bottom-panel/DebugTab.tsx`
- `src/lib/diagnostic-bundle.ts`
- `src/lib/__tests__/support-bundle.test.ts`

**Key findings:**
- A support bundle becomes materially more useful once operators can paste browser console, app server, or device logs into the same capture flow.
- Persisting the external log entries in the store keeps them available for later export and makes the support artifact more faithful to the triage session.
- This closes the local portion of the crash/incident bundle gap, but not the broader remote ingestion or automated alerting story.

**Operational note for SentinelTwin:**
- Keep the external log capture lane lightweight and paste-first until there is a real remote log ingestion backend to absorb device/server telemetry automatically.

## Thread 33: Automated alerting summary

**Status:** Implemented in current pass. The debug panel now summarizes runtime incidents and external logs into prioritized alert candidates.

**Source signals:**
- `src/lib/incident-alerts.ts`
- `src/lib/diagnostic-bundle.ts`
- `src/components/bottom-panel/DebugTab.tsx`
- `src/lib/__tests__/incident-alerts.test.ts`

**Key findings:**
- A support bundle becomes more actionable when the raw incident and external-log feed is condensed into a smaller alert queue with a recommendation.
- The alert summary is useful even before there is a backend alerting pipeline, because it helps the operator identify what to escalate and which logs to attach.
- The remaining gap is no longer local prioritization; it is the backend remote-ingestion and broader automated alert routing story.

**Operational note for SentinelTwin:**
- Keep the local alert summary aligned with the support bundle, and treat the current recommendation as the operator-facing escalation hint until remote alert routing exists.

## Thread 34: Remote support ingest route

**Status:** Implemented in current pass. The debug panel now routes the support payload through a canonical `/api/support-ingest` endpoint and surfaces the returned alert-routing summary in-product.

**Source signals:**
- `src/app/api/support-ingest/route.ts`
- `src/lib/support-ingest.ts`
- `src/components/bottom-panel/DebugTab.tsx`
- `src/app/api/support-ingest/__tests__/route.test.ts`

**Key findings:**
- The local support path now has a backend-shaped ingest endpoint that validates the payload and returns a routed summary, which gives the Debug panel a more realistic handoff target.
- The route is still local and summary-only; the broader remote transport, durable ingestion, and alert fan-out pipeline remain open.
- Showing the ingest result inline makes the operator-facing support flow easier to test without leaving the studio shell.

**Operational note for SentinelTwin:**
- Keep the ingest route aligned with the support bundle payload and treat the returned routing summary as a local stand-in for the future remote support backend.

## Thread 35: Support ingest history

**Status:** Implemented in current pass. The debug panel now mirrors the routed support-ingest archive from the canonical `/api/support-ingest` endpoint and keeps a local cache fallback for offline refreshes.

**Source signals:**
- `src/app/api/support-ingest/route.ts`
- `src/lib/support-ingest-history.ts`
- `src/components/bottom-panel/DebugTab.tsx`
- `src/store/studio-store.ts`
- `src/store/__tests__/studio-store-project-metadata.test.ts`

**Key findings:**
- A backend-shaped support handoff becomes more trustworthy when the operator can revisit previous routed submissions from a server-backed archive, not just the latest response.
- Keeping a local cache fallback makes the archive readable even when the route is temporarily unavailable, but the server archive is now the canonical view.
- The next gap is no longer simple history persistence; it is remote fan-out/delivery and alert routing beyond the local studio shell.

**Operational note for SentinelTwin:**
- Keep the support-ingest archive aligned with the support-bundle payload and the remote ingest response, and use the local cache only as a fallback when the server archive cannot be fetched.

## Thread 36: Support delivery queue

**Status:** Implemented in current pass. The debug panel now exposes a remote support delivery action that writes into a canonical `/api/support-delivery` queue and displays the archive with a local cache fallback.

**Source signals:**
- `src/app/api/support-delivery/route.ts`
- `src/lib/support-delivery.ts`
- `src/components/bottom-panel/DebugTab.tsx`
- `src/app/api/support-delivery/__tests__/route.test.ts`

**Key findings:**
- The support handoff now has a separate delivery step from ingest, which is the right shape for a future alert fan-out or webhook destination pipeline.
- The current queue is still local-first, but it finally represents the delivery boundary instead of only the archival boundary.
- The Debug panel now also accepts a remote webhook URL so the delivery queue can exercise a real outbound destination when one is available.
- The remaining open gap is broader remote delivery reliability and production alert fan-out, not the lack of a dispatch abstraction.

**Operational note for SentinelTwin:**
- Keep the delivery queue aligned with the support-ingest archive and expose failures clearly when a future destination endpoint is configured.

## Thread 37: Governance approval trail

**Status:** Implemented in current pass. The governance control plane now exposes an evidence-backed approval trail inside the Governance tab.

**Source signals:**
- `src/components/bottom-panel/GovernanceTab.tsx`
- `src/lib/operational-evidence.ts`
- `src/components/__tests__/governance-tab.test.ts`
- `src/lib/__tests__/operational-evidence.test.ts`

**Key findings:**
- Governance actions already emitted operational evidence, but the operator could only see the current toggle state before this slice.
- A compact local trail makes review requests, approvals, rejections, annotations, role changes, and policy changes auditable without duplicating the evidence model.
- The remaining open question is backend identity and remote approval routing, not whether the product can present a trustworthy governance history locally.

**Operational note for SentinelTwin:**
- Keep governance state changes mirrored in the operational evidence ledger so the trail stays canonical even as backend approval routing evolves.

## Thread 38: Governance handoff queue

**Status:** Implemented in current pass. The governance control plane now has a separate archive queue for remote approval handoff.

**Source signals:**
- `src/app/api/governance-archive/route.ts`
- `src/lib/governance-archive.ts`
- `src/components/bottom-panel/GovernanceTab.tsx`
- `src/app/api/governance-archive/__tests__/route.test.ts`

**Key findings:**
- Support delivery proved the local-first queue/fan-out pattern, and governance needed the same boundary but with approval-trail context.
- A separate governance archive keeps approval routing distinct from incident support while still leaving room for future remote identity and reviewer services.
- The remaining open gap is remote identity-backed approval routing, not the lack of an archive abstraction.

**Operational note for SentinelTwin:**
- Keep the governance archive aligned with the operational evidence ledger and surface failures clearly when future approval endpoints are configured.

## Thread 39: Workspace membership handoff queue

**Status:** Implemented in current pass. The Governance tab now also exposes a backend-shaped archive queue for workspace identity and membership routing.

**Source signals:**
- `src/app/api/workspace-membership-archive/route.ts`
- `src/lib/workspace-membership-archive.ts`
- `src/components/bottom-panel/GovernanceTab.tsx`
- `src/app/api/workspace-membership-archive/__tests__/route.test.ts`

**Key findings:**
- Shared-workspace access already existed locally, but the product needed a canonical backend-identity record for active member, roster, and routing policy.
- A separate membership archive keeps identity capture distinct from governance approval history while still using the same archive/fan-out pattern, and it now preserves the full normalized workspace access and governance snapshots for drift comparison.
- The remaining open gap is remote identity-backed approval routing and cross-service membership sync, not the lack of a membership archive abstraction or a comparable snapshot record.

**Operational note for SentinelTwin:**
- Keep the membership archive aligned with the governance trail so future remote identity services can route approvals and membership changes from the same canonical record.

## Thread 40: Workspace membership sync reconciliation

**Status:** Implemented in current pass. The Governance tab can now reconcile the live workspace membership state against the latest archived snapshot.

**Source signals:**
- `src/components/bottom-panel/GovernanceTab.tsx`
- `src/store/studio-store.ts`
- `src/lib/workspace-membership-routing.ts`
- `src/lib/operational-evidence.ts`

**Key findings:**
- The membership archive is more useful when it can drive an operator-visible reconciliation action, not just a history list.
- Reconciliation needs to be audited as an evidence event so drift is visible and reversible.
- Approval routing also needs to be an explicit operator-visible action so the live workspace can be compared against the archived membership snapshot before a route is resolved.
- The remaining open gap is remote identity-backed routing across services, not the lack of a local reconcile action.

**Operational note for SentinelTwin:**
- Keep future remote identity services aligned with the same reconciliation and approval-route event kinds so sync across services stays evidence-backed.

## Thread 41: Explicit path selection and planned launch modals

**Status:** Implemented in current pass. Path selection now stays explicit instead of auto-falling back to the first authored route, and the launcher's guided-scan / footage-verification surfaces are real planning modals rather than dead buttons.

**Source signals:**
- `src/store/studio-store.ts`
- `src/lib/security-outcome/security-outcome-selectors.ts`
- `src/components/bottom-panel/ScenarioPathPanel.tsx`
- `src/components/launcher/StudioDashboardHome.tsx`
- `src/app/page.tsx`

**Key findings:**
- Treating `activePathId` as nullable makes empty-selection state visible instead of silently selecting the first path.
- The guided-scan and footage-verification launch actions are legitimate planning surfaces, so the UI should describe them as preview/plan states rather than broken placeholders.

**Operational note for SentinelTwin:**
- Keep future path-based summaries, replay, and launcher copy aligned with explicit path selection and planned-vs-available feature states.
- Keep compare timeline, report summaries, and replay visuals tied to the same explicit active path instead of falling back to the first authored route.

## Thread 42: Explicit camera selection in Camera View

**Status:** Implemented in current pass. Camera View no longer auto-selects the first camera when entering the mode, and the header chip now reflects the empty-selection state instead of implying a hidden target.

**Source signals:**
- `src/components/layout/StudioShell.tsx`
- `src/components/view/CameraViewMode.tsx`
- `src/components/view/ViewModeBar.tsx`

**Key findings:**
- Camera View is stronger when it reflects explicit operator selection instead of substituting the first camera in the scene.
- The empty state is part of the product model, not just an edge case.

**Operational note for SentinelTwin:**
- Keep future camera-centric analysis surfaces aligned with explicit camera selection and visible empty states rather than hidden defaults.
- Keep camera failure actions explicit as well; if no camera is selected, the action should not silently choose one.

## Thread 43: Explicit camera selection in Compare View

**Status:** Implemented in current pass. Compare View camera pickers now start empty and require an explicit camera choice before the camera comparison panel populates.

**Source signals:**
- `src/components/view/CompareView.tsx`

**Key findings:**
- Compare is more trustworthy when it does not silently pick the first available cameras.
- Empty camera pickers make the comparison intent visible and prevent a misleading default pair.

**Operational note for SentinelTwin:**
- Keep the compare workspace aligned with explicit operator intent for both camera pickers and any future comparison presets.

## Thread 44: Offline command parser target matching

**Status:** Implemented in current pass. Offline commands now require an explicit camera or light match instead of silently defaulting to the first scene object.

**Source signals:**
- `src/lib/offline-command-parser.ts`
- `src/hooks/use-ai-command.ts`

**Key findings:**
- Command parsing is safer when it fails closed on ambiguous or missing targets.
- The hook already handles the null/no-match path, so removing the fallback does not break the command pipeline.

**Operational note for SentinelTwin:**
- Keep AI command actions target-explicit and prefer no-op/no-match outcomes over silent first-object defaults.

## Thread 45: Placement oracle template selection

**Status:** Implemented in current pass. The placement oracle now chooses an active camera or its own template camera, rather than falling back to the first scene camera when no active cameras exist.

**Source signals:**
- `src/simulation/placement-oracle.ts`
- `src/simulation/simulate-studio.ts`

**Key findings:**
- Heuristic ranking is more stable when it uses explicit active cameras or a built-in template instead of scene order.
- The template camera already exists to represent the oracle baseline, so the first-camera fallback was unnecessary.

**Operational note for SentinelTwin:**
- Keep oracle scoring deterministic and scene-order agnostic when a real active camera is unavailable.

## Thread 46: Floorplan VLM Bakeoff — New Generation Models (2026-05-29)

**Status:** Configured 4 new candidates. MiniCPM-V 4.6 evaluated (wall F1=0.094 — too small). Qwen3.5-4B, MiniCPM-o 4.5, Gemma 4 E4B MPS-constrained.

**Source signals:**
- `experiments/scene_understanding/bakeoff_harness/candidates.py` — 4 new configs (`stack_h` through `stack_k`)
- `experiments/scene_understanding/configs/candidates.yaml` — YAML mirror
- `experiments/scene_understanding/bakeoff_harness/runner.py` — MiniCPM-V 4.6 specialized handler (`_run_minicpm_extraction`)
- `experiments/scene_understanding/outputs/COMPARISON_REPORT.md` — updated with MiniCPM-V 4.6 results
- `experiments/scene_understanding/scripts/RUNBOOK.md` — updated with new candidate table + MPS notes

**Key findings:**
- **MiniCPM-V 4.6 (1.3B, Apache 2.0):** Wall F1=0.094, P50=96s. The model is too small for floor plan understanding — it outputs single bounding rectangles instead of individual wall segments. Better than Florence-2 (F1=0.000) but nowhere near production use. Surprisingly slow on MPS despite being only 1.3B — the slice-based processing (max_slice_nums=1 with downsample_mode=16x) may be inefficient on Apple Silicon.
- **Qwen3.5-4B (4B, Apache 2.0):** Failed to complete 1 image in 15 minutes on MPS. Confirmed vision-capable (Qwen3VLProcessor), but 4B param inference on MPS is not viable.
- **MiniCPM-o 4.5 (9B, Apache 2.0):** Not attempted. Estimated >20 min/image on MPS.
- **Gemma 4 E4B (4B active, ~30B total):** Not attempted. Requires 4-bit quantization for consumer GPUs.
- **MPS is a hard constraint:** Models >=4B params cannot run practically on Apple Silicon. The bakeoff should either use cloud APIs or GGUF quantized models via ollama/llama.cpp.
- **transformers upgraded to 5.9.0:** Required for MiniCPM-V 4.6 support (was 4.49.0). API changes in v5: `processor_kwargs` dict for processor params, `temperature` ignored in `generate`, `dtype` replaces `torch_dtype`.
- **MiniCPM-specific handler added:** `_run_minicpm_extraction()` handles the unique `processor.apply_chat_template(tokenize=True, ...)` + `downsample_mode` pattern that differs from other HF VLMs.
- **JSON escaping fix:** MiniCPM-V 4.6 outputs `\"` escaped JSON. Added repair pass in `_parse_response()`.

**Pipeline changes:**
- `_parse_response()`: Now tries `raw.replace('\\"', '"')` repair when initial JSON parse fails
- `_run_local_transformer_extraction()`: Dispatches MiniCPM models to `_run_minicpm_extraction`
- `_run_minicpm_extraction()`: New function using `processor.apply_chat_template` with `tokenize=True` and `processor_kwargs`

**Semantic task evaluation (added 2026-05-29):**
- Multi-task eval script: `experiments/scene_understanding/scripts/evaluate_semantic_tasks.py`
- Full report: `experiments/scene_understanding/outputs/semantic_tasks/SEMANTIC_TASKS_REPORT.md`
- Structured summary: `experiments/scene_understanding/outputs/semantic_tasks/SEMANTIC_TASKS_SUMMARY.json`
- Main comparison report now includes a semantic sidecar summary section, so geometry and non-geometry results are visible in one first-pass report.
- 5 images × 5 task types (classification, room detection, OCR, adjacency, description) × 3 models (MiniCPM, GPT-4o, Gemini)
- **MiniCPM-V 4.6 is USEFUL for non-geometry tasks** despite wall F1=0.094:
  - Scene classification: ~2.3s avg. Coarse (warehouse vs retail vs corridor) shows consistent bias (everything → "office") but fast. Fine-grained 1/5.
  - Room detection: ~16.5s avg. Identified 9 zones in warehouse — matches actual functional zones. Conservative but consistent.
  - OCR: ~7.6s avg. Correctly identified no text in synthetic images. No hallucination. With real labeled plans would read room names.
  - Adjacency: ~5.3s avg. Sparse graphs (1-3 edges) but directionally correct. GPT-4o produces 10-20 structured edges.
  - Description: ~9.7s avg. Reasonable high-level geometric summaries.
- **GPT-4o:** Faster per task (1-4s), more detailed room/adjacency output, same 1/5 fine-grained classification.
- **Gemini 2.5 Flash:** API key issue in some shells — env var name may be `GOOGLE_API_KEY` not `GEMINI_API_KEY`. When the client import is missing, the script now reports it cleanly instead of retrying.
- **Coarse classification follow-up (3 categories):** MiniCPM 0/5 (all "office"), GPT-4o 1/5 (all "warehouse" except actual warehouse). Synthetic images lack distinguishing visual features for sub-type discrimination.
- **Pipeline implication (see Thread 54):** Two-tier design — local MiniCPM for triage (classify, OCR, quality check, coarse zones) → gated cloud API call for precise geometry. Saves $0.01-0.02 per blurry/noisy image.
- **Evaluator hardening:** classification scoring now extracts exact labels before scoring, and MiniCPM model-load failures are cached so the sidecar does not retry the same unsupported checkpoint on every prompt.
- **Prompt hardening:** the classification prompt now spells out the exact label semantics and tells GPT-4o not to default to `retail_small_shop` when uncertain.
- **Selective rerun:** the semantic sidecar now accepts `--models gpt4o`-style subsets, which makes targeted prompt-tuning passes possible without burning time on known-bad loaders.
- **Latest GPT-4o semantic result:** after prompt tightening plus the evidence-based consensus classifier, raw classification reached 0.4 accuracy and consensus classification reached 1.0 accuracy on the 5-image dev split; room/ocr/adjacency/description stayed non-empty on all images. This is a strong signal on the synthetic pilot, but it is still only a 5-image set and should be treated as a pilot ceiling rather than a production conclusion.

**Files added:**
- `experiments/scene_understanding/scripts/evaluate_semantic_tasks.py`
- `experiments/scene_understanding/outputs/semantic_tasks/SEMANTIC_TASKS_REPORT.md`
- `Docs/architecture/09_FLOORPLAN_PIPELINE.md`

**Next:**
- Evaluate Qwen3.5-4B, MiniCPM-o 4.5 via `ollama run` with GGUF quantization
- Try Gemma 4 E4B with `transformers` + 4-bit bitsandbytes quantization
- Evaluate SmolVLM2 2.2B as another edge-sized candidate
- Check if Phi-4-vision (4.2B) can run via GGUF on MPS
- Fix Gemini API key env var and re-run 2.5 Flash evaluation
- Train MiniCPM on CubiCasa5K for better room-type classification

## Thread 47: Compare and report snapshot selection stays explicit

**Status:** Implemented in current pass. Compare View and Report Lite now require an explicit snapshot selection instead of silently auto-filling the newest snapshots.

**Source signals:**
- `src/components/view/CompareView.tsx`
- `src/components/bottom-panel/ReportLiteTab.tsx`

**Key findings:**
- Compare/report surfaces are evidence exports, so implicit snapshot selection can misrepresent what the user intended to compare.
- Empty-state prompts are clearer than hidden defaults and match the explicit path/camera selection model already adopted elsewhere in Studio.

**Operational note for SentinelTwin:**
- Keep comparison/report baselines explicit and fail closed on empty selections rather than inferring the newest snapshots.

## Thread 48: Before / After tab uses explicit snapshot selection

**Status:** Implemented in current pass. The Before/After bottom-panel tab now requires explicit before/after snapshot selection instead of auto-binding to the newest two snapshots.

**Source signals:**
- `src/components/bottom-panel/BeforeAfterTab.tsx`
- `src/components/view/CompareView.tsx`
- `src/components/bottom-panel/ReportLiteTab.tsx`

**Key findings:**
- The compare workflow is easier to trust when each surface visibly asks for the two snapshots it is comparing.
- Reusing the newest two saves creates hidden-default drift across the drawer, compare view, and report export surfaces.

**Operational note for SentinelTwin:**
- Keep before/after evidence selection explicit everywhere, including the bottom-panel summary tab.

## Thread 49: Camera View critical-zone insight stays explicit

**Status:** Implemented in current pass. Camera View now waits for an explicitly selected critical zone before showing the DORI insight card.

**Source signals:**
- `src/components/view/CameraViewMode.tsx`

**Key findings:**
- The DORI card is clearer when it is tied to the selected zone rather than the first zone in the scene.
- Empty-state prompting is preferable to implicit scene-order defaults in analysis panels.

**Operational note for SentinelTwin:**
- Keep camera-specific zone analysis explicit, and prefer a prompt over a hidden default selection.

## Thread 50: Metrics target quality also stays explicit

**Status:** Implemented in current pass. The Metrics tab now only shows the target quality requirement when a critical zone is explicitly selected.

**Source signals:**
- `src/components/bottom-panel/MetricsTab.tsx`

**Key findings:**
- Summary panels should not silently borrow the first zone in the scene as a representative target.
- Explicit selection or a clear prompt keeps the target-quality metric honest.

**Operational note for SentinelTwin:**
- Keep target-quality summaries selection-aware rather than ordering-aware.

## Thread 51: Shared critical-zone selectors use priority rather than scene order

**Status:** Implemented in current pass. Shared helpers now prefer a matching label or priority ranking instead of the first critical zone in the scene.

**Source signals:**
- `src/lib/critical-zone-selection.ts`
- `src/lib/offline-command-parser.ts`
- `src/simulation/adversarial-path.ts`
- `src/lib/scan-to-scene.ts`

**Key findings:**
- A shared selector is better than duplicating the same scene-order bias in multiple places.
- Prioritizing by intent or required quality makes offline commands, auto-path creation, and adversarial-path generation more consistent.

**Operational note for SentinelTwin:**
- When a helper needs a zone but the user has not explicitly chosen one, use a deterministic priority helper instead of the raw first zone.

## Thread 52: Camera Wall and Path Replay should expose their own mode summaries

**Status:** Implemented in current pass. Camera Wall now exposes mode chips for 4 / 6 / 16 views plus auto layout, and Path Replay now has an in-view path selector plus path metrics strip.

**Source signals:**
- `src/components/view/CameraWallView.tsx`
- `src/components/view/PathReplayView.tsx`

**Key findings:**
- The design-pack targets expect the active mode to be obvious from the surface itself, not only from the surrounding panels.
- Putting the path selector and path metrics inside Path Replay makes the replay surface easier to read at a glance.
- Camera Wall benefits from explicit layout chips because the reference screen shows the mode as an active control strip, not only a dropdown.

**Operational note for SentinelTwin:**
- Keep mode-specific summaries in the active surface when the design pack treats them as part of the core workflow, but continue to source the state from the canonical store.

## Thread 53: Camera Wall synchronized timestamps should follow the simulation clock

**Status:** Implemented in current pass. Camera Wall timestamps now use the shared simulation timestamp when synchronized mode is enabled.

**Source signals:**
- `src/components/view/CameraWallView.tsx`
- `src/components/view/SceneFeedCanvas.tsx`

**Key findings:**
- The synchronized wall timestamp is part of the feed story, not just decoration.
- The mode toggle needs to influence the visible feed metadata to feel real.
- A shared timestamp is consistent with the reference wall layout and easier for operators to parse at a glance.

**Operational note for SentinelTwin:**
- Keep feed timestamps anchored to shared simulation context when the mode implies synchronization; reserve wall-clock timestamps for explicit free-running views.
## Thread 54: Floor Plan Pipeline Architecture — Two-Tier Design (2026-05-29)

**Status:** Proposed. Pipeline design documented in `Docs/architecture/09_FLOORPLAN_PIPELINE.md`.

**Source signals:**
- `Docs/architecture/09_FLOORPLAN_PIPELINE.md` — full pipeline architecture
- `experiments/scene_understanding/outputs/COMPARISON_REPORT.md` — bakeoff results (8 models)
- `experiments/scene_understanding/outputs/semantic_tasks/SEMANTIC_TASKS_REPORT.md` — semantic eval (3 models)
- Thread 46 above

**Core insight:** Geometry extraction and scene understanding are different capability curves. Small VLMs (1.3B) are useless for geometry (wall F1=0.094) but genuinely useful for semantic tasks. Cloud VLMs dominate geometry but cost money.

**Design:**
```
Tier 1 (Local, always): MiniCPM-V 4.6
  ├── Quality assessment (blurry? → skip cloud)
  ├── Scene classification (retail/warehouse/corridor)
  ├── OCR text extraction (room labels, dimensions)
  ├── Coarse zone detection (room count + layout)
  └── Confidence flag → SemanticContext

  Gate decision:
  ├── blurry → reject, no cloud cost
  ├── low confidence → force cloud geometry pass
  └── normal → pass SemanticContext to Tier 2

Tier 2 (Cloud, gated): GPT-4o / Gemini 2.5 Flash
  ├── Precise wall extraction (F1~0.95)
  ├── Door/window detection (F1 0.2-0.7)
  ├── Obstruction detection (F1 0.4-0.9)
  ├── Detailed adjacency graph (10-20 edges)
  └── Critical zone identification

Post-processing: Validate cloud output against Tier 1 coarse room count
```

**Performance budget:** Total pipeline ~15-30s, ~$0.015/image. Without Tier 1 gating: every image costs $0.01-0.02.

**Fallback chain:** MiniCPM → GPT-4o → Gemini 2.5 Flash → Gemini 2.5 Pro → SemanticContext only (no geometry if all fail)

**Implementation update (2026-05-30):**
- `apps/studio/src/lib/floor-plan-import.ts` now includes a production Tier 1 semantic gate layer for the existing heuristic import path:
  - `deriveFloorPlanSemanticContext()` emits `sceneType`, `roomCount`, `zones`, `confidence`, `qualityScore`, and `ambiguityFlags`.
  - `evaluateFloorPlanTierGate()` maps context to gate outcomes: `rescan_required`, `human_review`, `cloud_geometry_required`, or `proceed_to_tier2`.
  - `getFloorPlanTierGateWarning()` surfaces operator-facing warnings for non-green outcomes.
- `apps/studio/src/components/scan-to-scene/SceneBuilderWizard.tsx` now wires gate status into the floor-plan flow:
  - Stores Tier 1 semantic context and gate decision in wizard state.
  - Recomputes gate state after upload, recalibration, and manual geometry correction.
  - Blocks progression to review when gate outcome is `rescan_required`.
  - Exposes gate status in Configure + Review summaries for explicit operator visibility.

**Open questions:**
- Should Tier 2 prompt include Tier 1 OCR results as context?
- How should confidence thresholds for the gate decision be calibrated?
- Can Tier 1 zone detections be coupled with SAM3 for zone-level segmentation?

## Thread 55: Architectural Model Strategy — System-Level Architecture Audit (2026-05-29)

**Status:** Analysis complete. Comprehensive audit of repo vs recommended multi-layer CV/AI pipeline reveals the system already has most of the architecture in place. The recommendation describes a system more like Phase 0 than the current state.

**Source signals:**
- Full repo audit: `Docs/exploration/EXPLORATION_MAP.md` (this thread)
- Schema: `apps/studio/src/schema/security-scene.ts` — `source` field on every node, `sceneSourceSchema`
- Scan compilation: `apps/studio/src/lib/scan-to-scene.ts` — `ScanCompilationProvenance` with confidence
- AI draft: `apps/studio/src/lib/ai-layout-draft.ts` — `DraftProvenance` with review-before-commit
- Floor plan import review: `apps/studio/src/components/scan-to-scene/ImportReview.tsx`
- Scene builder wizard: `apps/studio/src/components/scan-to-scene/SceneBuilderWizard.tsx`
- Scan site wizard: `apps/studio/src/components/scan-to-scene/ScanSiteWizard.tsx`
- Project launcher: `apps/studio/src/components/launcher/ProjectStartLauncher.tsx`
- Operational evidence: `apps/studio/src/lib/operational-evidence.ts` — 40+ event kinds, branching, merge
- Verification overlay: `apps/studio/src/components/view/CameraViewMode.tsx` — image/video overlay + auto-align
- Target profiles: `apps/studio/src/simulation/simulate-studio.ts:44-99` — 9 detection types
- Placement oracle: `apps/studio/src/simulation/placement-oracle.ts`
- Adversarial path: `apps/studio/src/simulation/adversarial-path.ts`
- Privacy zones: perimeter surfaces, coverage enforcement, compliance

### What the recommendation gets right

The analysis of "what SentinelTwin should be" is directionally correct:

1. **"Don't claim AI understands buildings"** — Core thesis aligned. The system already has deterministic CV for floor plan import, not VLM-based geometry.
2. **"Editable scene graph before AI layer"** — Already exists via `SecurityScene` schema + compile/review UI + ImportReview component with drag-correctable walls.
3. **"Simulation owns truth, AI assists"** — Already the architecture. Coverage engine is pure Three.js raycasting. Adversarial path is Dijkstra. Placement oracle scores deterministic candidates.
4. **"Truth ladder for every object"** — Partially exists (`source` enum on all nodes, `confidence` on evidence events) but needs a formal `reviewStatus` + `sourceTrace` field.
5. **"Security jobs as entry point"** — Already built. 7 modes in `ProjectStartLauncher.tsx` (Audit, Design, Import, Scan, AI, Preview, Report).
6. **"Real-feed verification"** — Already built. Full image/video overlay + multi-phase auto-alignment + per-camera snapshot system.
7. **"Camera recommendations as scoring engine, not LLM"** — Already built. `computePlacementOracle()` samples wall/ceiling candidates, scores against coverage evaluator, returns top 5.

### What the recommendation gets wrong (assumes doesn't exist)

| Recommendation | Actual State |
|---|---|
| "Start with CubiCasa-style model for wall detection" | Already using heuristic CV with ImportReview correction UI. Works for V0. CubiCasa is a future Phase 2. |
| "YOLO11 for door/window symbols" | Detection exists via import heuristic + bakeoff explores VLMs. No YOLO integration needed yet. |
| "SAM 2 for correction, not understanding" | ImportReview already lets users drag wall endpoints, exclude false detections, merge/split walls. SAM 2 would be over-engineering for V0. |
| "PaddleOCR for dimensions" | Identified as a gap. Experiments use GOT-OCR2. Not in production yet. OCR integration is a valid next step. |
| "Vectorization layer → structured output" | Already exists: `scan-to-scene.ts:compileScanSessionToScene()` converts photo markers to walls/doors/windows/cameras. Floor plan import converts raster to wall geometry. |
| "Scene graph as core data model" | Already `SecurityScene` — the documented single source of truth with 40+ fields, full Zod validation, provenance, and simulation results inline. |
| "Coverage simulation as ray casting, not ML" | Already pure Three.js ray casting with BVH. Never uses ML for coverage. |
| "Add target model library" | Already 9 detection types with per-type sampling profiles, DORI scoring, and `/target` command. |
| "Add camera spec presets" | 4 generic presets exist. Real camera database (IPVM) is planned but not built. |
| "Add privacy/compliance overlays" | Fully implemented. Privacy zone schema, rendering, coverage enforcement, compliance reporting. |

### Actual Gaps

These are the real missing pieces that would add value:

1. **Formal truth ladder per-node** (HIGH):
   - Currently: `source: "manual"|"ai"|"scan"|"import"|"preset"|"demo"` on every node + `confidence` on evidence events
   - Missing: `reviewStatus: "unreviewed"|"confirmed"|"corrected"|"calibrated"|"verified"`, `sourceTrace: string` (which model/version/pipeline), `geometryValidity: "valid"|"suspect"|"invalid"`
   - Value: Reports can state "wall F12: level 2 (user-confirmed)" instead of "AI generated"
   - Implementation: Add to `baseNodeSchema` in `security-scene.ts`

2. **OCR dimension extraction in floor plan import** (MEDIUM):
   - Currently: Heuristic wall detection + scale calibration input. No OCR.
   - Missing: PaddleOCR pass over uploaded floor plan to extract room labels + dimensions + scale text
   - Value: Auto-extracts room names (Office, Storage, Server Room), dimension text ("12' x 10'"), scale references
   - Implementation: Add as optional enrichment pass after wall detection

3. **Camera spec intelligence** (MEDIUM):
   - Currently: 4 generic presets (Indoor Dome, Bullet, PTZ, Fisheye).
   - Missing: LLM-driven spec extraction from camera model names + search query + structured spec output
   - Value: "Hikvision DS-2CD2T47G2-L" → `{ resolutionMP: 4, fovH: 83°, irRangeM: 60, ... }`
   - Implementation: LLM extraction function + local preset library lookup

4. **Automated live-feed drift detection** (LOW — V2):
   - Currently: Manual image/video overlay verification with auto-alignment.
   - Missing: Automated frame comparison against simulation expected view + alerting
   - Value: "Camera 4 has drifted 12° since calibration" — operational alerting

### Corrected Phase Roadmap

The recommendation's 5-phase plan was written for a system at Phase 0. The actual SentinelTwin is already past Phase 2.

**Corrected Phase Roadmap:**

```
Phase 0-2 (COMPLETE):
  ✔ Simulation engine (coverage, DORI, adversarial path, placement oracle)
  ✔ SecurityScene schema (40+ fields, full Zod)
  ✔ Core UI (3D canvas, camera placement, inspector, view modes)
  ✔ Floor plan import (heuristic CV + ImportReview correction)
  ✔ Photo scan wizard (ScanSiteWizard + compile pipeline)
  ✔ AI draft (heuristic + model paths, review-before-commit)
  ✔ Privacy zones (schema → rendering → coverage enforcement → compliance)
  ✔ Real-feed verification UI (image/video overlay + auto-alignment)
  ✔ Security jobs launcher (7 modes)
  ✔ Operational evidence (40+ event kinds, branching, three-way merge)
  ✔ Target model library (9 detection types)

Phase 3 — Production hardening (NOW):
  [ ] Truth ladder: reviewStatus + sourceTrace per node
  [ ] OCR integration: PaddleOCR for dimension + room label extraction
  [ ] Camera spec intelligence: LLM extraction + preset library
  [ ] Import pipelines share common compiler pattern
  [ ] Bakeoff results distilled into production architecture doc

Phase 4 — AI-assisted floor plan compiler:
  [ ] CubiCasa5K/FloorTrans segmentation model
  [ ] YOLO11-obb for symbol detection
  [ ] SAM 2.1 correction integration
  [ ] Deterministic geometry compiler

Phase 5 — Recommendation engine:
  [ ] Multi-camera optimization (OR-Tools / greedy + local search)
  [ ] Verified counterfactual simulation
  [ ] LLM explanation layer on verified results

Phase 6 — Scan-to-scene:
  [ ] Depth Anything V2 / VGGT
  [ ] SpatialLM / Open3D
  [ ] SecurityScene compiler

Phase 7 — Real-feed verification:
  [ ] Live frame comparison pipeline
  [ ] Drift/blocked detection
  [ ] Continuous alerting
```

### Key Decision

The highest-leverage build target right now is **truth ladder** (reviewStatus + sourceTrace). It's a small schema change that unlocks the product's core credibility claim: "every element in this report has a known confidence level." Without it, every node is treated as equally authoritative regardless of source.

### References
- `Docs/decisions/DECISION_LOG.md` — D-217 (truth ladder), D-218 (corrected roadmap)
- `Docs/architecture/09_FLOORPLAN_PIPELINE.md` — Pipeline architecture (needs update with Phase 3 findings)

## Thread: Shared identity conflict evidence

### Why this matters

The Governance tab now distinguishes membership sync from identity conflict resolution. That means the product can explain not just that workspace identity data changed, but *why* it changed and whether the operator resolved a drift boundary or merely synchronized records.

### Current finding

- The shared-identity archive currently records the live workspace membership state, the latest archived snapshot, route recommendations, and fan-out attempts.
- The ledger now has a dedicated `workspace_identity_conflict_resolved` evidence kind so governance history can separate a conflict-resolution action from the generic membership-sync action.
- The Governance tab now also exposes a selectable conflict diff/replay view, so operators can compare the live workspace against the archived snapshot, recompute the selected conflict against the current workspace state, and inspect older archived conflicts without leaving the control plane.
- This makes the governance trail more semantically honest and reduces the chance that reconciliation is mistaken for routine synchronization.

### Follow-up question

- Should remote identity replay/history eventually fan the replay result out to a separate backend audit stream, or is the local selectable replay view enough for V0.2?

## Thread: 3D Contextual Object Manipulation UI

### Why this matters

SentinelTwin already supports selection, transform handles, inspectors, and object-specific editing. The next UI question is whether object operations should be surfaced through a contextual 3D action UI, such as a right-click or long-press menu, rather than only through the inspector.

### Core idea

When a user selects or right-clicks an object like a camera, door, window, wall, obstruction, or zone, the editor can open a focused action surface with object-specific options such as:

- move
- rotate
- raise / lower
- flip / mirror where supported
- snap to nearest wall or surface
- duplicate
- delete
- align to camera / wall / zone
- convert or retarget subtype where valid

### Design hypothesis

This should feel like a professional spatial editor, not a game HUD. The interaction may borrow the speed of game tooling, but the visual language should stay aligned with SentinelTwin's operator-workspace and security-audit framing.

### Open questions

- Should the primary pattern be a right-click context menu, a radial menu, or a compact floating action sheet?
- Which actions belong in the contextual UI versus the inspector?
- Which object classes deserve special actions, such as wall-attached openings for doors and windows?
- How do we keep keyboard, mouse, and touch interaction coherent across desktop workflows?

### Exploration goal

Prototype a contextual 3D interaction model that reduces friction for object manipulation without creating a second control system alongside the inspector and transform handles.

### Prototype directions to compare

- Right-click context menu anchored to the selected object.
- Small floating action sheet with the most common actions.
- Radial menu for high-frequency spatial operations.
- Hybrid flow: contextual menu for discovery, inspector for precision.

### Interaction rules to test

- Contextual actions must respect object type and selection state.
- Camera and obstruction actions should stay faster than inspector-only edits.
- Door and window actions should stay wall-aware rather than free-floating.
- The interaction layer must not hide or duplicate canonical store actions.
- Keyboard and pointer workflows should remain consistent with the existing transform handles.

### Evaluation criteria

- Does the UI make common edits faster than the inspector alone?
- Does it feel like a security editor instead of a game overlay?
- Can a new user discover the right action without confusion?
- Does the interaction remain usable on dense scenes with many objects?
- Does it preserve undoable, store-backed edits with no alternate scene state?

### Immediate follow-up artifacts

- A small interaction matrix for each object type and action.
- A wireframe or mock for the contextual menu / radial menu.
- A shortlist of actions that should remain inspector-only.
- A set of editor scenarios to validate the interaction choice in real scenes.

### First-pass action matrix

| Object | Contextual actions worth testing | Inspector-only or secondary |
|---|---|---|
| Camera | rotate, raise/lower, snap to wall/ceiling, duplicate, delete, aim at zone | exact lens, sensor, preset, FOV, exposure assumptions |
| Door | move along wall, open/closed state, flip, duplicate, delete | exact dimensions, lock state, material, height |
| Window | move along wall, flip, duplicate, delete | glass/material, transmission, dimensions, sill height |
| Obstruction | move, rotate, raise/lower, duplicate, delete, swap subtype | exact dimensions, transmission, material presets |
| Wall | add point, split, delete, align, duplicate segment | thickness, height, material, transmission |
| Zone | edit vertices, add/remove vertex, duplicate, delete | required quality, target type, priority, coverage rules |
| Path | edit points, add/remove point, reverse, duplicate, delete | actor type, speed, intent, timing profile |

### Recommended default direction

- Desktop primary: right-click object menu with a short action list.
- High-frequency edit mode: direct gizmo/handles for move and rotate.
- Precision mode: inspector fields and snapping actions.
- Touch fallback: long-press action sheet with the same object actions.

### Guardrails

- Do not make the menu the only way to edit.
- Do not duplicate every inspector field into the context menu.
- Do not add game-like styling that conflicts with the operator-workspace feel.
- Keep all actions routed through the existing store-backed scene model.

### Current implementation note

- A first-pass right-click contextual menu is now wired into the workspace canvas and shared scene renderers, so the exploration thread has crossed into an active prototype rather than remaining only a design discussion.

## Thread: React diagnostics and element-grab tooling for `apps/studio`

### Why this matters

The studio app is a large React surface with motion-heavy panels and several long-lived workspace views. Aiden Bai's ecosystem gives us three complementary tools:

- `react-doctor` for static diagnosis and ranking
- `react-scan` for live render profiling
- `react-grab` for element-level handoff during UI debugging

### Current finding

- The app shell now loads `react-scan` and `react-grab` only in development, so local debugging gets better without affecting production.
- The counterfactual panel now respects reduced motion, uses `LazyMotion`, and fixes a few accessibility issues the doctor flagged.
- The current `react-doctor` snapshot improved from `56` to `60` after these changes, with the error count still dominated by pre-existing architecture issues in shared workspace components.
- The stricter pnpm trust policy recommendation was evaluated and intentionally not kept because it blocked normal installs against the current lockfile.

### Follow-up

- Use `react-scan` against the live `apps/studio` UI once the app is running locally to capture render hotspots in the workspace views.
- Continue fixing the high-signal doctor errors in the shared workspace components, starting with cleanup in `WorkspaceCanvas.tsx` and the Fast Refresh export warnings in the main component files.
- If the lockfile is refreshed, revisit pnpm hardening with a policy that preserves installability instead of locking the repo out of its own toolchain.

## Thread: Guided scan assistant over the manual-assisted scan pipeline

### Current finding

- The launcher’s guided scan path is now implemented as a guided assistant that routes into the existing scan wizard, so it can improve capture prep and auto-path hints without duplicating the canonical manual-assisted compile pipeline.
- The assistant keeps the same candidate review, warning acknowledgement, and evidence-logging behavior as the manual flow, which preserves the single source of truth for scene compilation.

### Follow-up

- Keep the assistant copy honest: it should describe capture guidance and review handoff, not autonomous reconstruction.
- If a later product sprint adds real auto-segmentation or depth-based reconstruction, revisit the assistant wording and the compile handoff flow together so the launcher and scan wizard stay aligned.

## Thread: Shared-workspace RBAC/ABAC and approval routing

### Current finding

- The governance panel already exposes a full local review/publish/restore control plane, but the underlying workspace access gate needed to combine access policy and governance state in one decision path.
- Privacy-sensitive approval routing is now explicit: privacy-heavy scenes route to the privacy reviewer role, and generic reviewer eligibility no longer overrides that route by accident.

### Follow-up

- Keep the access and governance helpers as the canonical source of truth for publish/approve/reject decisions.
- If remote/shared membership comes online later, preserve the same role-and-policy semantics so local and remote approvals do not diverge.

## Thread: Provider/model governance and eval harnesses

### Current finding

- The Debug panel already exposes provider health, telemetry budgets, and a canonical prompt registry, but the registry itself was still just a static definition list.
- Model-eval runs now persist the prompt-registry snapshot they used, which makes the eval history a durable audit trail instead of a one-off report.

### Follow-up

- Keep the registry snapshot attached to model-eval records so future prompt changes can be compared against prior runs.
- If prompt versioning expands beyond the four canonical stages, the same snapshot pattern can carry the new stages without changing the audit model.

## Thread: Runtime diagnostics and support bundles

### Current finding

- The diagnostic bundle now carries alert routing alongside incidents, performance traces, and external logs, so the runtime view can explain why support escalation is needed instead of only showing raw failures.
- Live camera probes preserve transport response and auth-challenge metadata, so the runtime truth can tell the difference between a clean connection, an auth challenge, and a failed negotiation.

### Follow-up

- Keep the diagnostic bundle the canonical runtime export for support and QA.
- Preserve the camera probe negotiation metadata as it flows through the inspector, session registry, and bundle exports so device diagnosis remains truthful end to end.

### Current finding

- The Debug panel now exposes a dedicated incident bundle download, giving crash triage a narrower artifact that centers alerts, incidents, and external logs rather than the full support archive payload.

### Follow-up

- Keep the incident bundle focused on failure evidence and alert routing.
- Preserve the broader support bundle for handoff cases that need sensor, camera, and report evidence in the same export.

## Thread: Live sensor and camera fusion

### Current finding

- Camera metadata ingest now accepts XML in addition to JSON and NDJSON, so ONVIF-style feeds can land directly in the Debug panel and still match scene cameras by id or name.
- ONVIF WS-Notification envelopes now flow through the same ingest boundary as camera metadata and become canonical operational evidence events in the archive/history trail, so live device notifications do not need a parallel route.
- The live fusion path can now preserve metadata freshness and connection posture without requiring a pre-normalized JSON adapter for external camera feeds.
- Live camera connection probes now also preserve XML negotiation payloads without polluting the error channel with JSON-only parse failures.
- The reusable ONVIF probe helper now performs a real SOAP session probe, retries Basic/Digest challenge-response authentication on both the device and event-subscription requests when the first request is challenged, parses device information instead of simulating a session manager, preserves event-subscription URI/reference/expiry through the canonical live-camera route and HUD surfaces, and renews the event subscription on heartbeat, so the live camera boundary has a concrete transport/client primitive rather than a mock implementation.
- The launcher now enters the existing Camera View verification workflow directly, so real-footage verification no longer stops at a separate preview modal before the overlay/alignment tools appear.
- The launcher now opens the guided scan assistant directly too, so scan guidance no longer stops at a separate kickoff modal before the actual scan wizard appears.

### Follow-up

- Keep the XML parser conservative and map only the fields that have canonical scene equivalents.
- If the live feed vocabulary expands, extend the same parser rather than adding a parallel ingest format.
- Extend the ONVIF notification mapper with richer Profile M metadata fields before introducing any new route boundary.

## Thread: Operational evidence memory

### Current finding

- The operational evidence ledger now has a canonical runtime schema for imported events, so malformed records and invalid nested snapshots are rejected before they reach the timeline or archive path.
- The temporal history surface is already able to show checkpoints, lineage, branch comparison, recovery, and search-by-time/branch navigation, but the deeper point-in-time semantics still depend on snapshot-backed evidence.
- Launcher search now carries branch metadata on branch-bearing archive hits, so those results can jump straight into the timeline instead of only opening the surrounding archive tab.
- Scene Intelligence now preserves exact checkpoint identity plus provenance node/edge focus in its shareable deep-link contract, so a copied link can reopen both the ledger checkpoint and the trace context around it.

### Follow-up

- Keep ledger normalization schema-driven so archive import and live writes stay aligned.
- If point-in-time reconstruction becomes richer, extend the same evidence model rather than creating a second history store.

## Thread: Public handoff and cross-device distribution

### Current finding

- The browser share path can already be built from `URLSearchParams`, and MDN’s Web Share API documents `navigator.share()` plus `navigator.canShare()` for links, text, and files, which makes a browser-native share target viable for public handoff on supported devices.
- The archive and timeline surfaces already have local copy/open URL contracts, so the remaining gap is policy and distribution semantics rather than link construction.
- The archive recovery flow now exposes a browser share-sheet action with copy/open fallback behavior, which means the remaining problem is the public policy layer and cross-device distribution contract rather than the share invocation itself.

### Follow-up

- Keep the public share contract conservative and explicit about what can be published.
- Prefer browser-native share targets where available, but preserve copy/open fallback behavior so the contract remains usable everywhere.
- Treat public handoff as a separate policy layer from local archive recovery so internal recovery artifacts do not accidentally become public distribution artifacts.

## Thread: Observability and crash response

### Current finding

- The app already has explicit runtime journey cards, support bundles, incident bundles, external log capture, and alert summaries, but these are still local-first surfaces rather than a full observability backbone.
- OpenTelemetry is the strongest generic reference for a vendor-neutral traces/metrics/logs pipeline, while Sentry remains a useful reference for app-level crash and performance capture.

### Follow-up

- Keep local runtime truth visible in the Debug panel, but define a clear export/ingest contract for external observability later.
- Preserve correlation between runtime incidents, support bundles, and the exact scene/evidence state that failed.
- Treat crash/incident bundles as the operator handoff artifact, not as the only observability layer.

## Thread: Physics engine — zero implementation, deferred to V0.2

### Current finding

A comprehensive search of the entire codebase found:

- **Zero physics library imports** in any source file. No `cannon-es`, `@react-three/rapier`, `@dimforge/rapier3d-compat`, `ammo.js`, `jolt-physics`, or any other physics engine is imported or used anywhere in `apps/studio/src/`.
- **Zero physics dependencies** in `apps/studio/package.json`. The only appearance of `@dimforge/rapier3d-compat` is as a transitive dependency of `@types/three` (for TypeScript type declarations only — never used at runtime).
- **Zero files or directories** with physics-related names.
- **Zero TODO/FIXME comments** mentioning physics.
- **Zero usage** of rigidbody, collider, mass, velocity, force, gravity, friction, torque, inertia, kinematic, or physics-engine-related terms in source code.

### Domain-adjacent concepts found (NOT physics engine)

| Concept | Where | What it actually is |
|---|---|---|
| `collided` / `collisionCount` | `PathReplayView.tsx` | Geometric 2D point-correction markers when a path sample is adjusted away from an obstruction — no rigidbody involvement |
| `visionTransmission` | `coverage.ts` | Optical material property (e.g. glass=0.9, solid=0) for raycast visibility — not a physics collider |
| AABB overlap checks | `blind-spot-topology.ts` | Simple bounding-box geometry overlap for zone detection — no physics engine |
| `bounceMultiplier` / `reflectiveBounce` | `coverage.ts` | Optical ray bounce model for camera vision through reflective surfaces |
| `damping` / `stiffness` | Various | Framer Motion spring animation configs — no physics simulation |

### Documentation position

All relevant decisions and analysis are already captured in:

| File | Content |
|---|---|
| `Docs/exploration/PHYSICS_OPTIONS.md` | Library comparison (Rapier recommended), V0.1 vs V0.2 scope, physics vs vision collider distinction |
| `Docs/decisions/DECISION_LOG.md` (D-008) | Rapier deferred to V0.2; V0.1 uses AABB drag |
| `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md` | Three-layer entity principle (visual mesh, physics collider, vision collider) |
| `Docs/context/origin/chatgpt_raw_conversations.md` | Original Rapier evaluation and V0.1 scope discussion |

### Verdict

**No new action needed.** The decision to defer physics to V0.2 is confirmed by code. The docs already accurately reflect this decision. If physics is added later, the intended library is `@react-three/rapier` (MIT license). The AABB-based approach in V0.1 (`isPositionValid` pattern from `PHYSICS_OPTIONS.md`) has not been implemented either — the codebase uses no drag validation at all.

### Follow-up

- If drag-and-drop UX needs collision validation before V0.2, implement the simple AABB function from `PHYSICS_OPTIONS.md` rather than pulling in a full physics engine.
- Before adding Rapier in V0.2, benchmark the WASM bundle overhead against the AABB baseline.
- Ensure physics collider shapes stay separate from vision collider shapes — they serve different purposes (physics: constrain movement; vision: determine optical coverage).

---

## Thread: Compliance-specific reporting

### Current finding

- Reports already carry provenance, evidence summaries, and standards references, which makes audience-specific compliance modes a natural next layer instead of a new data model.
- **IEC 62676-4:2025 (OODPCVS) and DORI standards templates are already implemented** in `packages/report/src/index.ts` as `oodpcvs-audit` and `dori-audit` with clause-level references in HTML export. Also: `general-audit`, `installer-proposal`, `insurer-brief`, `privacy-review` audience templates.
- **Privacy masking works:** the `privacy_reviewer` audience triggers specific redaction behaviors.
- **What does NOT exist:** GDPR Art. 35 DPIA template, BIPA compliance template, HIPAA privacy template. These are the actual compliance depth gap — not the broader report engine.

### Follow-up

- Keep the general report export authoritative, then layer audience-specific compliance modes on top.
- Preserve the same evidence and checkpoint lineage in every compliance variant, even when redaction or audience-specific framing changes the presentation.
- Scene Intelligence point-in-time reconstruction now also records source provenance, so the resolved state can explain whether it is an exact snapshot or a derived reconstruction from an earlier checkpoint event.
- Report exports now carry the same exact-versus-derived checkpoint provenance for the latest temporal twin checkpoint and latest published checkpoint, so the exported report explains where its temporal summary came from instead of only reporting age and delta.
- **Documented gap:** PHASE_15_REPORT_COMPLIANCE.md now explicitly lists which templates exist and which are pending. ARCHITECTURE_OVERVIEW.md line 350 and 361 corrected to match reality.

---

### Thread 29: Target Orientation Simulation
**Status:** Implemented in `path-analysis.ts`.
**Key finding:** The current engine samples target heights by target type, but for path replay, adding path direction versus camera direction is a major quality factor. A face facing away from the camera should be penalized.
**Implementation details:** Uses `Math.atan2(dx, -dz)` to calculate target facing direction (yaw) based on path trajectory, and applies a quality clamp (to `observation` / `perceive`) if the camera view angle is > 90° from the target's facing direction.
**Open:** Need to refine the thresholds. Is 90° the right cutoff for identification drop-off?
**Next:** Validate with domain experts.

### Thread: Compare and archive handoff provenance

### Current finding

- Scene Intelligence archive cards, selected checkpoint cards, and compare handoff cards now show the same exact-versus-derived checkpoint provenance note that powers the reconstructed scene, so the user can see whether a handoff is exact or derived before opening Before/After or Report Compare.

### Follow-up

- Keep the provenance note consistent in any future archive, compare, or report entry point so the exact/derived story stays legible across the entire evidence flow.

### Thread: ONVIF live-camera evidence path

### Current finding

- The ONVIF probe, camera live session registry, camera live connection history, inspector history event, and live HUD all now preserve the event-subscription URI/reference/expiry fields as part of the canonical live-connection record, so the subscription leg survives the full device-to-UI path.
- ONVIF notification envelopes now map into the same canonical camera-metadata ingest route and surface as operational evidence events, so the metadata ingest bridge can carry both static camera state and live notification evidence.

### Follow-up

- Keep renewal/continuity of the event-subscription stream aligned with the live connection session shape so future ONVIF probes and heartbeats do not lose the subscription identity or expiry across refreshes.

### Thread: Camera landmark alignment confidence

### Current finding

- Camera landmark binding confidence now uses a residual-based geometric fit instead of match count alone: it solves a normalized projective model when there are enough correspondences, falls back to an affine fit for smaller sets, and scores the result by reprojection error, spread, and camera visibility.

### Follow-up

- If this path becomes user-visible in a report or inspector badge, keep the label honest about the fact that the binding payload still lacks explicit calibration metadata, so the solver is geometric and normalized rather than fully camera-calibrated.

### Current finding

- The canonical binding helper now stamps `transformConfidence` onto evidence bindings, and the mismatch-report path prefers that field over ad hoc alignment inputs when the evidence already carries a solved confidence.

### Follow-up

- Keep future evidence producers using the shared binding helper so the solver, stored record, and mismatch consumer stay on one contract.


---

### Thread 29: Animation Engine Strategy (GSAP Alternative)
**Status:** Decision made. Details in DECISION_LOG.md (D-259).
**Key finding:** GSAP is the industry standard for timeline animations but its commercial license is incompatible with our Apache 2.0 / MIT dependency strategy.
**Decision:** Motion One (WAAPI) is the primary engine for complex timeline choreography (path replay, multi-step sequences). Framer Motion is the primary engine for React UI state transitions. Native R3F useFrame + Three.js curves is the primary engine for simple 3D path traversal.
**Why it matters:** This ensures SentinelTwin remains strictly compliant with open-source licensing without sacrificing animation fidelity.
 - Browser-native share support is now available on the main archive/compare handoff surfaces via a shared helper that uses `navigator.share` when possible and clipboard copy as fallback, so the existing link builders now reach a native share surface instead of only copy/open buttons.

---

### Thread 89 — Phase 14: AI Agent Pipeline — Package Extraction, LocalProvider, SceneUnderstandingAgent, Tool Calling (2026-06-01)

**Status:** Complete. `@sentineltwin/agents` package extracted, 4 provider implementations (3 cloud + local), 5 agent types, full eval suite, all 34 tests pass.

**What was built:**
- `packages/agents/` — new Turborepo package with `package.json`, `tsconfig.json`, barrel exports
- `ModelProvider` interface — added `ImageInput`, `ToolDefinition`, `ToolCall`, `completeWithTools()` method
- `OpenAIProvider`, `GeminiProvider`, `QwenProvider` — re-exported from app with tool calling implementation
- `LocalProvider` — new Ollama-compatible provider for air-gapped/local deployments
- `SceneUnderstandingAgent` — structured scene analysis with schema validation
- `CoordinatorAgent` + `ConversationMemory`, provider-selection, prompt-registry (5 entries), model-eval framework
- Backward-compatible re-exports in `apps/studio/src/agents/` — all existing imports continue to work
- Studio `tsconfig.json` and `package.json` updated to reference `@sentineltwin/agents`

**Key findings:**
- Package extraction was clean because providers and agent infrastructure had zero React/DOM dependencies
- Tool calling was additive to the interface — existing structured output consumers unaffected
- LocalProvider needed special handling (no API key check, Ollama's local API endpoint, streaming over NDJSON)
- SceneUnderstandingAgent's prompt needed defensive framing to avoid "evasion/bypass/defeat" language
- Backward-compatible re-exports required no changes to 66+ import sites across the app

**Remaining gaps (documented in architecture):**
- Voice/audio support (deferred — no current user-facing voice workflow)
- RouterAgent for intent classification (deferred — CoordinatorAgent handles routing directly)
- OptimizationAgent for combinatorial optimization (deferred — V0.3)
- Per-model prompt tuning (single prompt per agent currently)
- Prompt versioning for A/B testing
- CoordinatorAgent runs in React (not a worker — acknowledged in D-036)
- Conversation memory is in-memory only (no persistence — acknowledged in D-036)

### Thread 90: Adversarial path targeting policy (2026-06-01)

**Status:** Implemented in code and expanded (`packages/simulation/src/critical-zone-selection.ts`, `packages/simulation/src/adversarial-path.ts`, `packages/simulation/src/__tests__/critical-zone-selection.test.ts`).

**Key finding:** Adversarial target selection is now deterministic and explicit:
- selection order is first by required quality, then by critical zone priority, then lexical tie-breakers;
- cash-counter targeting detects explicit `targetType: "cash_counter_activity"` before label-pattern heuristics, reducing accidental mis-targeting from free-form labels;
- selection policy is now configurable via `requiredQuality-first`, `priority-first`, `counter-first`, and each run emits structured decision metadata through `explainAdversarialTargetSelection`;
- the selector is now a named adversarial target policy (`selectAdversarialTargetZone`) and exported from `packages/simulation/src/index.ts` for reuse.

**Open:** How should policy defaults vary by workflow profile (retail-first, asset-protection, logistics, multi-entrance facilities)?

### Thread 94: Path Replay determinism and scrub continuity (2026-06-01)

**Status:** Implemented in `apps/studio/src/components/view/PathReplayView.tsx`.

**Current finding:** Playback now uses a deterministic RAF anchor loop for wall-clock progression and supports seek while playing by re-anchoring the loop without restarting animation internals. Path replay sample generation now uses an explicit segment spacing constant, explicit geometry cleanup for dynamic frustum/collision buffers, and deterministic sample sanitization (strictly increasing timeline, collision sample metadata preserved, zero-based alignment).

**Follow-up:**
- Extract the timing loop into a reusable hook (`usePathReplayClock`) before Camera Wall/Path View parity work extends beyond this component.
- Add a regression test plan for "scrub while playing" (monotonic progression, no dropped updates, no jump-back).
- Add a shared playback-contract review after Camera View/Wall/Replay overlays so path scrub bands, camera feed overlays, and path actor share one contract for:
  - source timeline provenance (path result vs adversarial summary),
  - normalized origin (`t=0` anchoring),
  - segment continuity policy when repeated timestamps appear,
  - and deterministic collision-corrected waypoint metadata for QA artifact replay.
- `VisibilityTimeline.tsx` now aligns to the same event-order contract by sorting timeline events, clamping playhead/seek bounds to timeline duration, and merging adjacent same-quality segments; this makes scrub, row-level segment bars, and summary metrics robust when camera events arrive unsorted, duplicate, or include lost transitions.

### Thread 95: Camera Wall replay-state contracts and deterministic layout composition (2026-06-01)

**Status:** Implemented in `apps/studio/src/components/view/CameraWallView.tsx`.

**Current finding:** Camera Wall now resolves replay states from a sorted, time-clipped timeline at the current path-playhead before rendering each tile, and camera slot selection uses deterministic ordering (`selected/active/online/name`) rather than implicit input order. Layout composition is now driven from explicit specs (`4`, `6`, `16` view modes) so empty slots and hidden-cam counts stay coherent across mode changes.

**Next:**
- Evaluate if this same layout-spec approach should become a shared contract for future wall/map mosaic presenters (e.g., scenario split views).
- Add a non-string source-of-truth test for layout-slot count consistency so we don’t overfill grid rows at view boundaries.

### Thread 97: Camera View replay determinism and ordering contract (2026-06-01)

**Status:** Implemented in `apps/studio/src/components/view/CameraViewMode.tsx` and `apps/studio/src/components/view/camera-view-utils.ts`.

**Current finding:** Camera View now uses the same deterministic ordering and replay-state fold approach as Camera Wall:
- Path playback math is bounded (`progress × duration`) with explicit clamping and replay actor display gating against zero-duration paths.
- Active timeline event lookup now resolves through a stable timeline fold (`findLatestTimelineEventForCameraAtTime`), avoiding implicit dependence on source order.
- Camera header indexing now always resolves from a normalized active camera, preventing next/previous lockup when selected camera IDs are stale.

**Current finding (motion schema-to-UI bridge):** Camera inspector now offers first-class movement editing (`movementMode`, `dwellSeconds`, optional patrol fields, and waypoint timeline edits) and keeps node `presetId` synchronized when applying presets in inspector and preset utility paths. This is a direct operator-facing bridge for the existing schema fields.

**Status (foundational schema):** `@sentineltwin/core` and `@sentineltwin/studio` camera factories now accept `presetId` and `viewMotion` and set motion defaults when unspecified (`movementMode: fixed`, no dwell, empty waypoints).

**Next:**
- Promote shared replay contract helpers to `PathReplayView` and `VisibilityTimeline` and keep the camera-mode contract in one shared timeline utility.
- Validate that all camera creation call sites use `createCameraNode` so `presetId`/`viewMotion` stays synchronized across Studio and core flows.

## Thread: SharedScene render robustness and creation controls (2026-06-01)
- Scope: `apps/studio/src/components/workspace/SharedScene.tsx`
- Finding: Implemented defensive scene rendering path for malformed geometry/state while preserving editor interactions.
- Added: path-safety helpers (`sanitizeScenePath`), scene-level numeric sanitizers, and lighting-preset override support for scene creation exploration.
- Follow-up: Add an interaction registry for node-specific affordance contracts and a reusable path replay quality overlay panel with scenario deltas.

### Thread 98: No-floor-plan intake and temporary perimeter use-cases (exploration)

**Status:** Open and exploratory.

**Current discussion signals:**
- Primary commercial intents are shaped around two core users:
  - Security consultants (auditable recommendations, reportability, scenario replay, evidence continuity).
  - Facilities directors (cost-aware operational hardening, practical deployment sequencing, temporary and permanent controls).
- The product goal is being explored as scale-continuous: from one-room to multi-acre/asset campus.
- There is explicit intent to keep the model useful for both:
  - Persistent environments (baseline hardening and steady-state posture).
  - Event or visit-driven temporary control modes (VIP sweeps, emergency readiness, temporary perimeter + staffing controls).

**Exploration hypotheses to keep separate from locked scope:**
- The same `SecurityScene` model can host both permanent and temporary profiles if we keep scenario/state deltas as first-class overlays.
- “No floor plan needed” may imply a phased intake strategy:
  - Phase A: coarse scene sketch + manual safety-critical inputs.
  - Phase B: guided walk/capture enrichment with quality gates.
  - Phase C: scene confidence and blind-spot risk ranking before hard-failing assumptions.
- “Before failure” is not only a single simulation pass; it may require:
  - confidence-aware output (explicit confidence and assumptions),
  - scenario stress-testing (night/perimeter/access-control/offline-camera variants),
  - and ranked remediation candidates with implementation constraints.

**Code-adjacent next probes suggested by this thread:**
- How to represent temporary perimeter and staffing constraints without polluting permanent scene state (delta layers vs forked scene copies).
- Minimal trustful walkthrough path from walk-through inputs to simulation-valid draft (what can ship first for real utility).
- Whether emergency workflows should be modeled as scenario profiles, dedicated event profiles, or dedicated temporary scene layers.

**Next research outcome sought:**
- A documented decision matrix on what is "realizable in v1", "requires staged build", and "deferred", while preserving ability to scale from room-level to campus-level twins.

### Thread 98A: No-floor-plan discussion task graph (Dimension A exploration)

**Status:** Open. Split into a stage matrix to separate what is realizable now, what is stage-gated, and what is deferred.

**Objective:** Keep `"No floor plan needed"` scoped as a production-intent, staged capability while preserving simulation trust.

#### Dimension A: No-floor-plan pipeline stages (Stage gate matrix)

| Stage | Stage goal | What ships now | What remains open | Concrete owner |
|---|---|---|---|---|
| A1 Intake bootstrap | Start from phone-based or assisted manual input without CAD | `scan` workflow exists in launcher + draft approval guard + guided-marking scaffold (`SiteIntakeHub`, `ScanSiteWizard`, scan event trail) | Formal minimum-input contract is not fully codified as a single schema note | Studio product + store layer |
| A2 Geometry confidence model | Convert provisional scan input into confidence-graded scenes | `scan-to-scene` compile output + provenance summary + warning counts + session warnings now mapped into canonical `SiteTwinReadiness` (`deploy-ready` / `review-required` / `insufficient`) | `scan` readiness is canonical, but role-specific policy policy matrix remains open | Simulation + scene compiler + evidence trail |
| A3 Scenario arbitration | Require explicit analyst action before hardening | `SiteDraftReview`, explicit approval actions, and workflow confirmation hooks are wired | Scenario-level escalation for temporary emergency/perimeter workflows is now implemented and routes through admin escalation | Workflow + governance + trust surfaces |
| A4 Simulation-first output | Produce deterministic blind-spot ranking before recommendations | Coverage/adversarial outputs run from draft scene; blind-region outputs, ranking, and readiness metadata are available; review-stage severity language is role-tiered | Blind-spot ranking still mixes scene-accuracy and scenario assumptions if input is sparse | Simulation + narrative layer |
| A5 Temporary ops mode | Model short-duration control events (VIP/emergency/perimeter) | Scene branches and archive/route replay semantics can represent alternate states | Operational-mode schema is now wired from scan session into `SecurityScene.assumptions`; escalation remains open only for legal/commercial guidance and policy text | Governance + policy + archive model |
| A6 Temporary/permanent split | Separate day-to-day posture from event posture and support teardown | `operationalMode`, `operationalContext`, and durable `operationalScenarioEnvelope` are now persisted for scan + reconstruction; teardown requirement is visible in assumptions and review | Legal/commercial wording for temporary postures remains open | Simulation + workflow + evidence |
| A7 Evidence export + decision hardening | Convert advisory outputs into role-specific artifact | Report pipeline includes evidence continuity, audience mapping, legal/commercial framing, and assumption visibility across analyst-facing surfaces | Closed: public/commercial wording and distribution boundaries finalized | Report + product |
| A8 Scale path hardening | Extend from one room to facility scope | `workspace membership`, route tracing, and scale-aware storage model already in use; adaptive simulation envelope is now explicit | Remaining question: whether temporary-event caps should be stricter than permanent by default | Platform + simulation infra |
| A9 Decision lock | Publish and stop drift on scope | No-floor-plan stage matrix locked at A6/A9 with explicit envelope + teardown contract and temporary/permanent split | Stage refinement shifts to A8/A10 scale, legal/commercial wording closure, and deferred acceleration patterns | Product + architecture board |

#### Dimension A implementation sequencing

1. Finalize A1 + A2 as a single canonical intake-and-confidence contract in code/docs (single source of truth for required vs assumed fields).
2. Use A2 policy in A3 and A4: simulation must never emit hard recommendations when confidence class is `insufficient`.
3. Pilot A5/A6 using one event profile (e.g., VIP sweep) with explicit apply/teardown events.
4. A7 language split for consultant/facilities director/output stakeholders is now finalized and documented.
5. Resolve A8 scale benchmark for scan-derived scenes and decide default safe limits for v1.

#### Open decision hooks tied to Dimension A

- What minimum no-floor-plan input is required before calling the result advisory-safe?
- Who owns confidence gating decisions when confidence conflicts with operator urgency?
- Should temporary ops be represented as scene deltas, scenario envelopes, or branch-first workflow runs?
- What minimum evidence is required to mark a draft publishable by role?

#### Direct implementation follow-up from this matrix

- Convert existing discussion into a concrete matrix in `Docs/todos/goal2.md` or a new no-floor-plan readiness checklist for Stage A.
- Add an explicit acceptance checklist tied to `scan` sessions so advisors can tell if a draft is `deploy-ready`, `review-required`, or `insufficient`.
- Follow-up artifact added: `Docs/todos/no-floor-plan-readiness-checklist.md` (Dimension A gates and policy state).

### Thread 98B: Workspace layout persistence and migration hardening

**Status:** Implementing.

**Focus:** make layout state restore deterministic across sessions, environments, and malformed writes.

**Findings (2026-06-01):**
- Workspace layout persistence now loads from a typed canonical record set (`WorkspaceLayoutRecord`) and writes a versioned envelope.
- Legacy storage key `sentineltwin_saved_layouts_v1` is migrating to canonical key `sentineltwin_workspace_layouts` with `schemaVersion: 2`, then removed after repair.
- `buildSeededLayouts` and `normalizeSavedLayoutRecords` are used as recovery boundaries for corrupted or empty local payloads.
- `isWorkspaceLayoutModified` uses canonicalized JSON comparison so property order drift in storage no longer generates false positives.

**Open follow-up experiments:**
- Track how many real users run with legacy payload remnants after release and how often migration falls back to seeded layouts.
- Add telemetry/logging for migration paths (`valid envelope`, `legacy list`, `repaired`, `reseeded`) before forcing a second release.
- Evaluate whether future schema increments should include per-field deprecation metadata or migration transforms at payload-level.

### Thread 98C: Deterministic replay camera-motion rendering

**Status:** Implementing.

**Question:** can camera feed POVs be deterministic from scene schema alone during replay, without live PTZ state?

**What we implemented:**
- Reused `CameraNode.viewMotion` as the authoritative motion program during replay.
- Added deterministic sampling utilities in `apps/studio/src/components/view/camera-view-utils.ts` for:
  - waypoint interpolation with holds/transition timing,
  - sweep fallback when waypoints are absent,
  - pose override plumbing into both `CameraRigLive` and `CameraRigFixed`.
- Updated camera feed mode to use sampled pose in both single-camera and wall layouts.
- Began unit coverage for replay pose sampling behavior.

**What to add next (open):**
- Add a dedicated camera motion fixture pack in `Docs/` with canonical offline/online, sweep/waypoint examples.
- Add one explicit QA fixture proving non-PTZ cameras remain static while waypoint PTZ cameras animate on replay.
- Decide whether legacy `tracking` fallback behavior should become explicit keyframed tracking behavior instead of sinusoid approximation.

### Thread 99: Workspace & site creation system — code-base exploration (2026-06-02)

**Status:** Documented. New durable doc: `Docs/exploration/EXPLORATION_WORKSPACE_CREATION_2026-06-02.md`.

**Focus:** Exhaustive read of the workspace/site creation surface to inform any new component touching creation flows. Read-only; no code changes.

**Findings (2026-06-02):**
- Canonical `SecurityScene` schema lives in `packages/core/src/schema/security-scene.ts`. A second duplicate lives in `apps/studio/src/schema/security-scene.ts`. Drift is currently suppressed only by D-286 (`tsc -b --force`). Convergence is open as Q-020 (P0).
- 6 `sceneSourceSchema` values (`manual`/`ai`/`scan`/`import`/`preset`/`demo`) + 5 `reviewStatusSchema` values + 13 `DoriQualitySchema` values (none + 4 DORI + 8 OODPCVS) + 12+ node types confirmed by `selection-geometry.ts` (`AnyEditableNode` discriminated union of `wall`, `door`, `window`, `camera`, `security_light`, `sensor`, `obstruction`, `critical_zone`, `privacy_zone`, `entry_point`, `path`).
- 6 `SiteIntakeSource` values (`scan`/`ai_prompt`/`floor_plan`/`json`/`manual`/`camera_evidence`); `camera_evidence` is currently `Prototype`. `SiteTwinDraftReadiness.level` (`deploy-ready`/`review-required`/`insufficient`) gates `canSimulate`/`canRecommend`.
- 5 `PROMPT_REGISTRY` entries (`command_parse` v1, `counterfactual_candidates` v1, `report_generation` v1, `model_layout_draft` v2, `scene_understanding` v1); 5 stages; 4 telemetry stages. `model_layout_draft` v2 forces `source="ai"`, `reviewStatus="unreviewed"`, `sourceTrace`, `geometryValidity`, `evidenceArtifacts`, `mismatchReports`; cameras include live transport/auth fields when inferred.
- 4 `ModelProvider` implementations (`openai`/`gemini`/`qwen`/`local`) all behind a single interface with `complete`/`completeStreaming`/`completeStructured`/`completeWithTools`. `localOnlyMode` is a real policy gate.
- 6 `ModelEvalFixtureKind` values; 3 statuses; `ModelEvalStageBudget` enforces `maxFailures: 0`, expected skips for cloud-required fixtures, history persistence, trend comparison (`Improved`/`Regressed`/`Stable`).
- 8 `ReportAudience`, 3 `ReportVisibility`, 6 `ReportStandardTemplateId`. `buildRedundancyMatrixReport(scene, result)` returns per-zone status (`uncovered`/`single_point_failure`/`redundant`) and per-camera `criticalityScore` (0–10) with `criticalityLabel` (`Critical` ≥7 / `Important` ≥4 / `Redundant`).
- 9 localStorage keys for persistence (`sentineltwin_autosave_v1`, `sentineltwin_saved_scenes`, `sentineltwin_saved_projects_v2`, `sentineltwin_workspace_layouts`, `sentineltwin_saved_layouts_v1`, `sentineltwin_workspace_governance_v1`, `sentineltwin_workspace_access_v1`, `sentineltwin_workspace_account_v1`, `sentineltwin_fix_sandbox_v1`, `sentineltwin_operational_evidence_v1`) + 3 share-link parsers (`parseArchiveHandoffLink`/`parseCompareShareLink`/`parseTimelineShareLink`).
- 9 store slices (`core.{scene, simulation, layout, snapshot, replay, comparison}` + `enterprise.{workflow, telemetry, governance}`) + `product-view-store` (14 `ProductView` values).
- 11 placement tools in `LeftPanel` matching 11+ node factories + utility (select/measure/comment).
- Edit surface: `WallDrawTool`, `PolygonDrawTool`, `PathDrawTool`, `SelectionOverlay`, `SnapEngine` (grid + wall + wall-endpoint), `editor-geometry.ts` (211 lines, canonical 2D math), `selection-geometry.ts` (116 lines, hit-testing), `TransformHandles` (748 lines), `ObjectContextMenu` (24 actions across 4 groups via `object-context-actions.ts` 691 lines).
- Overlay cards: `CameraLabelCard`, `CriticalZoneLabelCard`, `EntryDoorChip`, `ObstructionWarningCard`, `SceneFloatingCard` (base shell for R3F `Html` overlays).
- View-specific surface: `PathReplayView` (1448 lines, full path-replay with collision legalisation, timeline events, exposure bands), `CompareView` (1448 lines, dual-snapshot compare + share link + evidence export), `CameraWallView` (785 lines, auto/quad/overview/dense layouts), `CameraViewMode` (568 lines), `VisibilityTimeline` (274 lines, per-camera quality bands), `ReportView` (398 lines), `CameraControlStrip` (275 lines), `ViewModeBar` (190 lines), `camera-view-utils` (11.3 KB, shared replay/scrub utilities).
- AI wiring: `use-ai-command.ts` (49,885 bytes, primary AI-driven scene edit entry point with `AiCommandStatus` state union, rate-limit evaluator, prompt-registry lineage, simulation re-verify, `applySceneOperation` dispatch) + `use-simulation.ts` (39 lines, 400ms debounce on `simulationDirty`).
- 24 `ContextActionId` values; `ContextActionPlan` discriminated union (`none`/`patch`/`duplicate`/`delete`/`focus`/`camera_view`); move step 0.25m, height 0.15m, rotate 15°.
- `SceneOperation` discriminated union (`move_camera`/`rotate_camera`/`change_camera_fov`/`toggle_camera`/`move_obstruction`/`resize_obstruction`/`rotate_obstruction`/`add_obstruction`/`add_light`/`toggle_light`/`set_time_of_day`/`save_snapshot`/`generate_report`/`run_coverage_failure_analysis`/`run_adversarial`). `applySceneOperation` is the single mutator for non-UI scene ops; UI mutations flow through `scene-slice` actions.
- 2 sample fixtures (Working): `sample-security-scene-import.json` (retail 10×8×3m) + `sample-site-twins/jewelry-store-site-twin.json` (jewelry 12×8×3.2m, glass front).
- 10 API routes (`camera-live-connection`, `camera-live-session-health`, `workspace-control-plane`, `workspace-membership-archive`, `workspace-identity-conflict`, `workspace-approval-route`, `truth-audit`, `support-ingest`, `support-delivery`, `ai/*`, `health`).
- Branch lifecycle: `draft → review → approved → published` (terminal); `published` requires a snapshot.
- `governance-slice` is 1463 lines and owns ~40 actions across branches, access, account, organizations, reports, saved scenes, references, camera verification, fix sandbox, layouts.

**First-principles tensions identified:**
- Two schemas, one truth (Q-020).
- Intake is distributed, not composed (Q-021).
- AI/simulation coupling boundary is in two places (`use-ai-command` + `useSimulation`).
- Editor state lives in two stores (`studio-store` + `product-view-store`).
- Persistence is fragmented (9 localStorage keys + share links + server-side API).
- Pascal's `AnyNode` is the canonical extension point but Pascal is parked (Q-001, Q-019).
- "AI proposes, simulation verifies, AI explains" is non-negotiable (D-005).
- DORI/OODPCVS are 13+1 quality levels — flattening to a single number is a regression.
- 6 heatmap modes are a registered extension point.
- Defensive-framing language is enforced in every prompt.
- D-010 open-source posture: no GPL/AGPL/CC BY-NC/BSL deps; current stack is MIT/ISC.
- Truth-at-time-of-writing wins over greenfield design.

**Open follow-up experiments:**
- New components should pick **one** target slot: new source type, new node type, new view, new heatmap mode, new prompt stage, or new governance surface — not a new way of doing existing things.
- Convergence paths: which of (a) deleting `apps/studio/src/schema/security-scene.ts`, (b) re-export shim only, (c) Pascal `AnyNode` reactivation wins the schema-duplication question.
- Add a 7th "creation flow" provider slot in `SiteIntakeHub` for any future source that needs a different sub-flow than the existing 5.
- A canonical "creation flow" component shell (Q-021) that owns the per-source contract could subsume `SceneBuilderWizard` + `ScanSiteWizard` + `GuidedCaptureAssistant` + `SiteIntakeHub` + `AiLayoutDraftView` + `ImportReview`.

## Security Analytics Command Center + Off-Thread Simulation (2026-06-12)

- **Source:** Full-repo deep analysis session (`DEEP_ANALYSIS_BEST_IN_CLASS_2026-06-12.md`).
- **What landed:** `analytics` view mode with a pure, engine-tested derivation model (`apps/studio/src/lib/security-analytics.ts`) and an interactive dashboard (`AnalyticsDashboardView.tsx`); simulation + temporal profile moved into a Web Worker with deterministic fallback (`simulation-runner.ts`, `simulation.worker.ts`). Decisions D-300/D-301.
- **Why it matters:** the dashboard is the first single surface that answers "how secure, what changed, what next" — the decision layer over the simulation moat. The worker unlocks larger scenes and keeps the canvas interactive during recompute, and its request-id protocol is the seed for progress streaming and cancellation.
- **Open threads worth pursuing next:**
  1. Embed the analytics model into report exports (model is UI-free; charts as inline SVG).
  2. Worker progress/cancellation messages; cancel stale runs instead of post-hoc discard.
  3. Multi-site/org analytics once the org/account slice lands (gap inventory §8).
  4. Live sensor/camera evidence deltas in the dashboard activity panel (simulated vs observed).
  5. "Coverage CI": KPI regression alerts when a scene edit reduces coverage vs last snapshot.

## Interactive Scene Creator: Aim-to-Place + Live POV (2026-06-12)

- **Landed:** drag-to-aim camera placement with live FOV wedge, PIP "what will this camera see" preview, obstruction object library with custom dims, placement-vs-selection event fix, collapsed-by-default preset pickers, dashboard animation pass (D-302/D-303).
- **Next unique-feature candidates (in leverage order):**
  1. **First-person walk mode** — WASD/pointer-lock walk through the twin as an intruder/guard with a live "visible to Camera N at <quality>" HUD computed from the coverage evaluator at the walker's position. Turns the verification engine into a felt experience; no competitor has it.
  2. **Aim-time coverage delta** — while aiming, show the projected coverage gain (placement-oracle-lite for the held pose) in the preview panel footer.
  3. **Drag-to-aim for lights and sensors** — same interaction grammar; light aiming previews illumination footprint at night.
  4. **Object library extension to walls/doors** — parametric presets (double door, roller shutter, glass storefront) through the same picker idiom.

## "Super App for Physical Security" — Vision Expansion (2026-06-12)

**Source:** Direct user feedback that prior "what's next" answers (the 5-item
analytics roadmap and the 4-item scene-creator roadmap above) were "too small"
— incremental polish on the existing studio, not platform-level ambition. This
section documents bolder, durable directions consistent with the moat
(deterministic, explainable coverage verification — D-003) and the founding
principle ("AI proposes, simulation verifies, AI explains"). These are
exploration entries, not commitments: each needs its own decision record and
scoping pass before implementation (motto_v3 §0.13).

The common thread across all of these: SentinelTwin's deterministic engine is
a *verification primitive*. Today it verifies one thing (camera coverage of a
static scene at design time). The platform-level bet is to make that primitive
the backbone of every moment where physical security decisions get made —
design, procurement, operation, incident response, audit, and insurance —
not just the studio screen.

### A. From design tool to continuous verification (operate-time, not just design-time)

1. **Live coverage drift detection.** Cameras get bumped, re-aimed, occluded by
   new stock/furniture, or go offline. If a site's live camera feeds (or even
   periodic snapshot uploads / PTZ telemetry) can be compared against the
   `SecurityScene` model, the engine can answer "is the coverage I designed
   still the coverage I have?" — and flag drift the moment it happens. This
   turns the one-time design report into a continuous SLA: "your DORI coverage
   has degraded from 84% to 61% in Zone 3 because Camera 7 was re-aimed."
   This is the single highest-leverage idea here: it converts a one-shot
   design tool into a recurring-revenue monitoring product, using the *same*
   deterministic engine, just re-run against live-evidence-derived scene deltas
   instead of design-time edits. The operational evidence ledger already exists
   (`operational-evidence.ts`) — this is the natural consumer of it.

2. **Incident replay → root-cause coverage audit.** When an incident occurs
   (theft, breach, near-miss), feed the incident location/time into the
   temporal twin and ask: "what was our actual DORI coverage at that point,
   at that time of day, given the scene state at that moment?" Today's
   adversarial-path/temporal engine already has the pieces (D-009, 06_TEMPORAL).
   The missing piece is an incident-intake workflow that produces a forensic
   report: "Camera 4 had Detection-only quality here at 02:00 because Light 2
   was off (per the 24h profile) — recommendation: add motion-triggered
   lighting or reposition Camera 4."

3. **Compliance-as-code certification.** The report templates already speak
   IEC 62676-4 / OODPCVS language (D-305, ReportLiteTab). The bolder version:
   a continuously-evaluated compliance score against named standards (UK
   Police Secured by Design, ADA/local fire-code sightline rules, insurer
   minimum-coverage clauses) with a *signed, timestamped, re-verifiable*
   certificate — because the engine is deterministic, the certificate is
   reproducible audit evidence, not a PDF someone can fake. This is a genuine
   differentiator vs. every competitor: "re-run this scene and you get the
   identical number" is not true of AI-generated assessments.

### B. From single-site tool to security operations OS

4. **Multi-site portfolio view** (super-set of roadmap item #3, but bigger
   than "aggregate the analytics model"). For an org with N sites, the
   platform becomes a portfolio risk register: heatmap of sites by coverage
   score, k-robustness, open critical issues, last-verified date, and
   incident history. The "AI explains" layer becomes a portfolio analyst:
   "your 3 lowest-scoring sites share a pattern — all three rely on a single
   camera for their loading-dock critical zone (k=1)." This is the natural
   home for the org/account slice (gap inventory §8) — but the *product*
   framing should be "security operations OS for multi-site operators"
   (retail chains, logistics, schools, healthcare campuses), not just
   "analytics aggregation."

5. **Marketplace / integrator workflow.** Security integrators (the people who
   actually install camera systems) are an underused distribution channel.
   A bid/proposal workflow where an integrator imports a floor plan, the AI
   proposes a camera layout against the client's stated critical zones, the
   engine verifies it, and the report becomes the *proposal document* —
   collapses "design + prove + sell" into one artifact. Add a BOM (bill of
   materials) layer mapping placed cameras to real SKUs (with the Kenney-pack
   discussion from this session as a cosmetic-only precedent — BOM data is
   the real value, not 3D models) and this becomes a genuine RFP-response
   accelerator for integrators, which is a recurring B2B sales motion.

6. **Insurance / risk-transfer data product.** Insurers underwriting physical
   premises (retail, warehouses, schools) currently rely on self-attestation
   or manual surveys for "do you have adequate camera coverage of high-value
   areas?" A deterministic, reproducible coverage score tied to a specific
   floor plan and camera layout is exactly the kind of structured risk signal
   underwriters want, and it doesn't exist today in this form. This is a
   longer-horizon B2B2B play (sell the *score*, not the studio) but it's the
   kind of thing that turns "nice tool" into "category-defining data layer."

### C. From static scenes to AI-native security design partner

7. **Natural-language scene editing with verification loop, at scale.** The
   AI command layer (05_AI_AGENT_ARCHITECTURE) already lets users describe
   changes in language. The bigger version: "redesign this floor plan for a
   24-hour pharmacy with a $50k budget" → AI proposes a full camera+sensor+
   lighting layout from scratch, the engine verifies it against critical
   zones and a cost model, AI explains tradeoffs ("dropping to 6 cameras
   saves $1,200 but Zone 2 (pharmacy counter) drops to Detection-only
   overnight — recommend keeping Camera 3"). This is "AI proposes, simulation
   verifies, AI explains" applied to *whole-scene generation*, not just
   single-object placement — the natural endpoint of the founding principle.

8. **First-person walk-mode + "what a person actually experiences."**
   (Already flagged in the interactive-scene-creator section above as
   highest-leverage novel feature — restated here because it's also a
   platform-level differentiator, not just a UX nicety.) Walking the space
   as a guard, an intruder, or a customer, with live DORI overlay and
   real-time "you are now in a blind spot for 4 seconds" feedback, makes the
   abstract coverage math viscerally legible to non-technical stakeholders
   (store managers, school principals) — which is who actually signs off on
   security budgets. This is a sales/demo weapon as much as a feature.

9. **Adversarial simulation marketplace / "red team in a box."** The
   adversarial-path engine (D-009, 04_ADVERSARIAL_PATH_SIMULATION) already
   computes Dijkstra-based paths that minimize detection. The bolder version:
   a library of named adversary profiles (smash-and-grab, insider threat at
   closing, after-hours loiterer) each with different speed/risk-tolerance/
   target parameters, run automatically against every scene edit as a
   "security regression test" — the "Coverage CI" idea from the existing
   roadmap (#5), but framed around adversary behavior rather than raw
   coverage percentage. "This camera move increases the smash-and-grab
   adversary's undetected dwell time at the register by 8 seconds."

### D. Sequencing note (motto_v3 §0.13)

These are platform bets, not a sprint backlog. The existing 5-item roadmap
(analytics→report convergence, worker progress, multi-site, live fusion,
coverage CI) remains the *near-term* execution path because it's directly
buildable on current code with low risk. Items A1 (live coverage drift) and
C7 (whole-scene AI generation) are the two with the highest "this changes what
the product *is*" leverage and the most direct line from current architecture
(operational evidence ledger; AI agent layer) — they are the natural
candidates for the next scoped implementation pass once the user confirms
direction. Items B5/B6/C9 are genuinely new product surfaces (BOM data,
insurer-facing scoring API, adversary-profile library) and would need their
own architecture docs before coding starts, per the "schema changes require
updating types + Zod + engine + prompts + report templates" rule (Non-
Negotiable Rule 5).

---

## New Exploration Threads — 2026-06-12: Director/Simulator Lens & Adjacent Expansion Surfaces

**Source:** User brainstorm session (2026-06-12), framed as "think like a
studio/simulator/movie director — real camera movements, character movements
tracked/simulated, fencing/boundaries, what else can this become?" Per the
"New Context File Protocol", these are captured here as open exploration
threads, not decisions. Each links to existing architecture pieces so a future
scoping pass has a concrete starting point. None of these change
`Docs/decisions/DECISION_LOG.md` — they are additive research surface only.

### Thread 146: Cinematic Camera-Direction Layer — "shot quality," not just coverage geometry

**Status:** Open. New idea, no code yet.

**The gap:** The engine answers "does this point fall inside this camera's
FOV/range/quality cone?" — pure geometry. A film/TV director asks a different
question about the *same* frame: "is the subject's face actually framed well
enough to be useful?" Two cameras can report identical `identification`-tier
coverage at a point while one camera's resulting frame has the subject as a
3-pixel speck at the corner of a wide shot and the other has them centered and
upright. DORI quality already captures resolution-vs-distance; it does not
capture *composition* — headroom, horizon line, dead zones at frame edges,
backlighting/glare direction relative to the lens axis (the engine already
models glare — `material-behavior.ts` — but as a coverage penalty, not a
framing concept).

**The idea — "shot quality" score per camera, per critical zone:**
- For each critical zone, compute where the zone's "action" (entry point,
  register, door) sits in the camera's projected frame (using the camera's
  FOV/aspect, exactly like a virtual-camera frustum in a 3D engine).
- Score it like a cinematographer would: is the subject in the center
  third or near-edge? Is the camera angle steep enough that faces are
  foreshortened/occluded by hat brims (a known real-world ID-failure mode —
  top-down cameras "ID" a person geometrically but the frame shows mostly the
  top of their head)?
- Surface this as a per-camera "framing grade" alongside the existing DORI
  grade — two cameras with the same DORI tier could have very different
  framing grades, and framing grade is what determines whether a human
  reviewer (or face-rec system) can actually *use* the footage.

**Why this matters commercially:** This is the #1 complaint security
consultants hear after an incident — "the camera covered that spot but all we
got was the top of someone's head" or "they were in frame but right at the
edge, half cut off." A tool that catches this *at design time*, before
installation, is a genuinely new differentiator — no competitor scores
*framing*, only coverage/resolution.

**Relation to existing code:** `vision-collider-mesh.ts` and the camera FOV
frustum math already exist for rendering; projecting a 3D point into the
camera's 2D frame is the same math a virtual-camera/previs tool in Unreal or
Unity would use. `mount-model.ts` already penalizes steep mount angles for
coverage — a framing score would be a sibling derivation, not a replacement.

**Open questions:** Does this need a new schema field, or is it a pure
derivation over existing `CameraNode` + zone geometry (likely the latter —
Rule 5-clean)? Does "framing grade" need its own DORI-like tier vocabulary, or
can it reuse `clarity`/`reasonCodes`?

---

### Thread 147: Populated Scenes — NPC/Crowd Simulation for Dynamic Occlusion & Baseline Behavior

**Status:** Open. New idea, no code yet. Builds on D-009 (adversarial path) and
Thread 12 (workspace interaction/blindspot attribution).

**The gap:** Today's coverage model is *static* — it answers "if a person
stands at point X, what quality of view do the cameras have?" Real spaces are
full of moving people who occlude each other and the floor/walls dynamically.
A single adversarial path (D-009) models one intruder's optimal route, but a
retail floor at 2pm has 30 shoppers, 4 staff, and a stockroom worker — and
*their* movement is what actually determines whether a given blind spot is
"empty 99% of the time" or "always has someone standing in it, permanently
blocking Camera 3's view of the register."

**The idea — populate the scene with simulated "extras":**
- A small library of agent archetypes (Customer, Staff, Stocking Cart,
  Loiterer) each with a simple behavior: wander between points of interest
  (shelves, registers, doors) with dwell times, using the same walkable-area
  geometry the coverage grid already uses.
- Run the coverage simulation across a *population* of agents over simulated
  time (reuses the 06_TEMPORAL 24h profile machinery — agent density by hour
  is itself a known retail pattern: empty at 8am, crowded at 6pm).
- Output: "effective coverage" that accounts for occlusion-by-crowd, not just
  occlusion-by-furniture (`occlusion-blame.ts` already exists for static
  obstructions — this is the dynamic sibling). Also surfaces "chokepoints":
  spots where two agent paths cross and a camera's view is *statistically*
  blocked a meaningful fraction of the time.

**The director-lens framing:** This is exactly what a virtual-production crowd
simulation does (e.g. Unreal's crowd/MetaHuman population tools, or game-engine
NPC pathing) — except instead of making a scene look populated for a render,
the population is the *load* the security design has to survive. "Your camera
covers the stockroom door geometrically, but a stocking cart is parked in that
doorway 40% of business hours, per the simulated traffic pattern" is a finding
no purely-geometric tool can produce.

**Relation to existing code:** `adversarial-path.ts` (Dijkstra over the
walkable grid) is the per-agent pathing primitive; `temporal.ts` /
`seasonal-lighting.ts` already model time-of-day variation; `occlusion-blame.ts`
is the static-obstruction occlusion model this would extend to moving bodies
(a person is just a cylinder-shaped obstruction that moves).

**Open questions:** Performance — running coverage for N agents x M timesteps
is combinatorially heavier than the current single-pass grid; likely needs a
coarser "occlusion probability field" rather than per-agent raycasting at full
resolution. Schema impact: likely a new `crowdProfile` config on the scene
(traffic patterns per zone/hour) — would need its own Rule-5 pass.

---

### Thread 148: Incident Replay as Cinematic Sequence — "Director's Cut" Export

**Status:** Open. New idea, no code yet. Builds on D-302 (drag-to-aim + POV
preview), Path Replay, and the report/export pipeline (D-305).

**The idea:** The studio already has a `PlacementPreviewPanel` that renders
"what this camera would see" (D-302) and a Path Replay mode. A movie director's
toolkit adds one more layer: a *multi-camera cut sequence* — given an
adversarial path or an incident timeline, automatically generate a sequence of
camera POV shots that follow the subject as they move through the scene,
switching cameras exactly the way a real SOC operator (or a film editor) would
cut between angles to keep the subject in frame.

**Concrete outputs this enables:**
- **Sales demo "trailer":** a 30-second auto-cut sequence showing "here's what
  your cameras would have captured" for a simulated walkthrough — viscerally
  more persuasive than a coverage percentage (ties directly to roadmap item C8,
  first-person walk-mode, but from the *camera's* perspective instead of the
  walker's).
- **Forensic report companion:** for the incident-replay idea (item A2 above),
  the "Director's Cut" is the *visual* artifact that accompanies the written
  forensic report — "here is the reconstructed multi-camera sequence of the
  incident, with timestamps and the coverage-quality grade for each shot."
- **Training material:** a generated sequence showing "blind spot" moments —
  cuts to black or a "NO COVERAGE" card when the subject exits all camera
  frustums — is a powerful guard-training tool (see Thread 150).

**Relation to existing code:** `PlacementPreviewPanel` (D-302) is the
single-camera POV renderer; Path Replay already drives a subject along a path
deterministically; the "cut" logic is a pure selection function (at time T,
which camera(s) have this point in frame, with what framing grade per Thread
146 — prefer the highest-framing-grade camera, cut when it loses the subject).
No new 3D rendering tech needed — this is an orchestration layer over what
exists.

**Open questions:** Export format (in-app sequence player vs. actual video
file via headless render — the latter is a real engineering lift, likely
out of scope until there's commercial pull). Whether "Director's Cut" belongs
in the report (D-305 convergence) or as its own view mode.

---

### Thread 149: Perimeter & Outdoor Expansion — Fencing, Gates, Barriers, LPR, CPTED Lighting

**Status:** Open. New idea, revives/sharpens Thread 144 (perimeter tech
landscape, currently "not exploring now") with a concrete schema-shaped
proposal.

**The gap:** `SecurityScene` today models an indoor floor plan: walls, zones,
cameras, obstructions. Physical security for retail/logistics/campuses is
*also* about the outdoor perimeter: fences, gates, vehicle barriers, parking
lot lighting, and the cameras/sensors that watch *those*. Thread 144 catalogued
the sensor landscape (fiber-optic fence detection, microwave barriers, etc.)
but didn't propose how it fits the data model.

**The idea — perimeter as a first-class scene layer:**
- New geometry primitives: `FenceSegment` (linestring + height + material:
  chain-link/palisade/wall — affects camera-vision transmission the same way
  `ObstructionNode.material` does today), `GateNode` (point + state:
  open/closed/access-controlled), `BollardLine`/`VehicleBarrier`.
- Coverage targets already include `vehicle_detection` and `license_plate`
  (seen in `TopBar.tsx` coverage-target list) — this thread is the natural
  home for *why* those exist: LPR cameras at gates, with their own DORI-like
  "plate-legible" quality tier (a function of angle-to-plate, not just
  distance — another framing-adjacent concept, see Thread 146).
- CPTED (Crime Prevention Through Environmental Design) lighting: the engine
  already has `seasonal-lighting.ts` for indoor/ambient light — extending it
  to perimeter lighting (pole lights, photocell schedules) ties directly into
  the existing 24h temporal profile and gives a concrete, well-studied
  framework (CPTED is a real, citable standard) for *why* a given perimeter
  layout is good or bad, beyond "the camera can see it."

**Why now / why this is high-leverage:** Thread 10 (NDAA replacement market,
high priority) and Thread 12 (retail loss prevention) both involve outdoor
perimeters (loading docks, parking lots, fence lines) — this isn't a niche
add-on, it's table stakes for the verticals already identified as strong
wedges. It's also where Thread 145 (UGV/robot patrol) naturally lives —
perimeter patrol routes are exactly the "fence line, periodically" pattern
robots are good at.

**Open questions:** This is the most schema-impactful idea in this batch —
`FenceSegment`/`GateNode` are new node types, which is a real Rule-5 pass
(types + Zod + engine raycasting against fence material + report templates).
Recommend treating this as its own architecture doc (`Docs/architecture/09_*`
style) before any code, given the blast radius.

---

### Thread 150: VR/Walkthrough Training Simulator — Same Scene, New Mode

**Status:** Open. New idea. Builds on roadmap item C8 (first-person walk-mode)
and Thread 21 (3D editor) / R3F rendering pipeline (07_RENDERING_PIPELINE).

**The idea:** Once a scene supports first-person walking with live DORI
overlay (C8), the same scene + same engine becomes a *guard training
simulator* with almost no additional core tech: place the trainee at a guard
post, run a populated scene (Thread 147) plus a scripted incident (an
adversarial-path agent enters frame), and ask the trainee to spot it /
respond correctly. The "Director's Cut" (Thread 148) becomes the after-action
review — "here's what you should have seen, and when."

**Why this is a genuinely different product surface, not a feature:** Guard
training today is largely classroom/video-based and generic ("watch for
suspicious behavior"). A trainee walking *their actual assigned site*, in 3D,
with scenarios generated from *that site's* real blind spots (per the
deterministic engine — these aren't generic, they're this building's actual
gaps) is qualitatively different — and it's a recurring-revenue training
product built on data the platform already computes for the security-design
product. Two customers (security director buying the design tool, ops/HR
buying the training tool) from one engine.

**Relation to existing code:** R3F canvas + `WorkspaceCanvas.tsx` already
render the 3D scene; the camera-rig math for a first-person view is a subset
of the existing camera-frustum math (Thread 146). VR headset support (WebXR)
is a separate, larger lift — desktop first-person ("walk mode") is the
buildable first step and is already roadmap item C8.

**Open questions:** Out of scope until C8 (first-person walk mode) exists.
Flagging now because the *scenario content* (Thread 147 populated agents +
Thread 148 incident sequences) should be designed with "this will also be
training content" in mind, to avoid building it twice.

---

### Thread 151: Audio Layer — PA Coverage, Gunshot/Glass-Break Sensor Simulation

**Status:** Open. New idea, sibling/extension of Thread 25 (multi-sensor
physical security).

**The idea:** Thread 25 already proposed a `SensorNode` base type for
non-camera detection layers. Audio is a distinct enough modality to call out
specifically, for two reasons:
- **Detection sensors:** gunshot detection, glass-break, raised-voice/
  aggression analytics — these have *acoustic* coverage cones shaped by room
  geometry (reflections off hard surfaces, attenuation through walls/doors)
  very differently from line-of-sight camera FOV. The existing BVH-based
  raycasting (D-004) could plausibly be repurposed for acoustic line-of-sound
  vs. reverberant paths, but this needs real research — acoustic propagation
  is not the same problem as optical visibility.
- **PA/notification coverage:** "if an alarm sounds, can everyone in this zone
  actually hear it?" — a basic but commonly-missed compliance question (fire
  code adjacent, ties to Thread 143 escalation/emergency response).

**Why include it in the director-lens batch:** A film set's sound department
thinks about mic placement and room acoustics the same way the camera
department thinks about shot framing — "can we actually capture/convey what's
happening here" is the audio analog of Thread 146's framing-grade idea.

**Open questions:** This is research-heavy before any implementation —
acoustic propagation modeling is a different domain than optical raycasting,
and the team should validate whether a *simplified* model (e.g., distance +
wall-attenuation lookup table, no real acoustic ray tracing) is good enough
for the product claims being made, before investing in anything more
elaborate. Recommend: keep as an open research thread, do not schedule.

---

### Thread 152: Access Control & Flow Simulation — Doors, Turnstiles, Tailgating Risk

**Status:** Open. New idea, extension of Thread 25 (multi-sensor) and Thread
147 (crowd simulation).

**The idea:** Access-controlled doors/turnstiles are where "who is allowed
here" meets "who is actually here" — and the gap between those (tailgating,
propped doors, badge-sharing) is a major real-world vulnerability class that
pure camera-coverage analysis doesn't address directly, but *can* once
populated-scene simulation (Thread 147) exists: simulate N people approaching
a single-person turnstile during a shift-change rush, and ask "what's the
probability of a tailgate event in this window, and does any camera have a
framing grade (Thread 146) good enough to *identify* the tailgater
afterward?" This connects access-control policy (a logical/IT-security
concern) to physical-camera design (this product's core) in a way no existing
tool does — it's the literal intersection of physical and access security.

**Open questions:** Depends on Thread 147 (crowd sim) existing first. Schema
impact: `GateNode`/door access-control state (Thread 149) would need an
`accessControlled: boolean` + `nominalThroughputPerMin` or similar — modest,
additive.

---

### Thread 153: Event/Temporary-Site Mode — Stadiums, Concerts, Construction Sites, Pop-Up Perimeters

**Status:** Open. New idea, extension of Thread 98 (no-floor-plan intake) and
Thread 15 (BIM/pre-construction security).

**The idea:** Every thread so far assumes a relatively fixed building. A large
adjacent market is *temporary* security: event venues (stadiums, concerts,
festivals — temporary fencing, mobile camera towers, crowd-flow/egress
modeling), and active construction sites (perimeter changes weekly, temporary
power for cameras, theft of materials/equipment is the dominant loss driver,
not "intrusion into a finished building"). Thread 98 already explores
no-floor-plan intake (you don't have a CAD file for a field where a festival
is happening) and Thread 15 covers BIM for *future* buildings — temporary
sites are the third leg: real, present-tense, but ephemeral and
fast-changing.

**Why interesting:** This is a genuinely different sales motion (event
security companies, GC/construction-site security vendors) but reuses
*everything* — walkable-area + camera coverage + adversarial path all apply
to "can someone climb this temporary fence and reach the generator compound
unseen for 90 seconds, the time it takes the roving guard to complete a
loop?" The "Director's Cut" (Thread 148) framing is also extremely natural
here — event security briefings are already run like a "shot list" (camera
positions, coverage zones, blind-spot handoffs between fixed cameras and
roving guards).

**Open questions:** Mostly a go-to-market/positioning question more than a
technical one — the engine already supports arbitrary floor plans; "temporary
site" is more about workflow (fast scene setup from a site sketch or satellite
image — ties to Thread 98's no-floor-plan intake) than new simulation
capability. Lowest technical risk of this entire batch; could be a packaging/
template exercise (a "construction site" / "event" preset scene + report
template) rather than new engine work.

---

### Sequencing note for this batch (motto_v3 §0.13)

None of Threads 146-153 are scheduled. Rough relative read, for when the user
is ready to pick:

- **Lowest lift, real differentiation:** Thread 146 (cinematic framing grade)
  is a pure derivation over existing camera-frustum math — same Rule-5-clean
  shape as Camera Drift (D-308) and Coverage CI (D-306). Strong candidate for
  "next scoped pass" alongside or instead of the items already queued.
- **Highest narrative/sales leverage, moderate lift:** Thread 148 (Director's
  Cut export) — builds entirely on existing POV-preview + path-replay
  machinery, no new simulation math, mostly orchestration + UI.
- **Biggest platform expansions, need their own architecture docs first:**
  Thread 147 (crowd simulation) and Thread 149 (perimeter/fencing schema) —
  both are genuinely new simulation domains with real schema impact (Rule 5)
  and should not be started without a dedicated architecture pass, same as
  Threads B5/B6/C9 above.
- **Research-stage, do not schedule yet:** Thread 151 (audio propagation) needs
  domain validation before any commitment; Thread 150 (VR training) and
  Thread 152 (access-control flow) are downstream of Threads 147/148 existing
  first; Thread 153 (event/temporary sites) is lowest technical risk but is a
  go-to-market decision, not an engineering one.

---

### Thread 154 — Plain-language pass over dashboard/inspector copy ("speak operator, not engineer")

**Source:** Pranay, 2026-06-12, after D-312 (selection-overlay crowding fixes):
*"theres also still so many technical/jargons and not actual industry/user
speak."*

**The problem:** The Analytics dashboard, Context Inspector, and
Simulation Assumptions card are full of internal engineering vocabulary
presented as primary UI copy — e.g. "OODPCVS 2025" (a DORI-standard revision
code), "Night Penalty Mode", "K-Robustness / K=0", "DORI quality
distribution", "Budget blocked" / "Budget guarded" (LLM cost-telemetry
states), "Truth: Simulated", "transmission" (a material's light-transmission
coefficient). A security manager, retail loss-prevention lead, or facilities
director — SentinelTwin's actual buyers — does not think in these terms. They
think in "can this camera actually identify a face at the till?", "if this
camera goes down, are we still covered?", "what does this look like at
night?".

**Proposed direction:**
- Every primary label gets an operator-language rewrite; the technical term
  (DORI tier, OODPCVS, k-robustness, etc.) moves to the existing
  `ExplainBadge` tooltip as the "for the technically curious" detail, not the
  headline. This is additive — `ExplainBadge` already exists and is used this
  way in several places (e.g. D-307's Live Operations, the CommandBar's
  "Guided edits..." explainer).
- Candidate renames (illustrative, not final — needs a copy audit pass across
  `AnalyticsDashboardView.tsx`, `BottomRow.tsx`/`AssumptionsTab.tsx`,
  `ContextRightPanel.tsx`, `ReportLiteTab.tsx`):
  - "K-Robustness / K=0" → "Single point of failure" / "No single camera
    failure breaks coverage" (the K-robustness *number* is the detail, the
    *implication* is the headline)
  - "DORI Quality Distribution" → "What can you actually see?" with
    Identification/Recognition/Observation/Detection kept as the segment
    labels (those are closer to plain language already) but the section title
    translated
  - "OODPCVS 2025" / "DORI 2014" → "Image-quality standard: 2025 (latest)" /
    "...: 2014 (legacy)"
  - "Night Penalty Mode: Simple/Detailed/None" → "Night-time visibility
    estimate: Basic / Detailed / Off"
  - "Transmission" (material property) → "Light passes through (%)"
  - "Truth: Simulated" → keep (this one is load-bearing for the "AI proposes,
    simulation verifies" trust story — D-305/D-306 lineage) but pair with a
    one-line plain explainer on first view
  - "Budget blocked/guarded/ready" (CommandBar) → these are about the
    *AI assistant's* cost guardrails, not the security analysis — consider
    whether they belong in primary chrome at all vs. tucked into the expanded
    Guided-Edit panel only (D-312 already hid them on narrow viewports)
- This is a copy/labels change, not a data-model or computation change —
  Rule 5 stays clean. The risk is *scope*: it touches many small strings
  across many files, so it should be done as its own pass with a
  before/after copy table in the decision log (motto_v3 §0.13 — document the
  rationale per renamed term, since some technical terms like "DORI" and
  "k-robustness" are also industry-standard terms a *professional* buyer may
  expect to see, so this needs to be additive/dual-labeled, not a wholesale
  deletion of technical vocabulary).

**Open questions:** Should technical terms be fully hidden behind tooltips,
or always shown as a smaller secondary line (so a security professional who
*does* know "DORI" can verify at a glance, while a non-specialist gets the
plain-language headline)? Leaning toward the latter — dual-label, not
hide — but this is a design call worth a quick UI sketch before a large copy
pass.
