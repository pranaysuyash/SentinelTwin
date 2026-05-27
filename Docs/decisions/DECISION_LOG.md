# Architecture Decision Log

**Format:** D-XXX | Date | Decision | Rationale | Alternatives rejected

---

## D-001 | 2026-05-25 | Fork Pascal Editor (MIT) as the spatial foundation

**Decision:** Fork `pascalorg/editor` (MIT license) rather than building a 3D scene editor from scratch
or depending on it as an npm package.

**Rationale:**
- Pascal provides months of production-quality spatial editing work: wall drawing with mitering,
  door/window CSG cutouts, zone definitions, multi-level, furniture placement, R3F + Zustand + WebGPU
- Identical stack to what SentinelTwin needs — zero integration friction
- MIT license explicitly allows forking and commercial use
- SentinelTwin will mutate the data model (extend AnyNode), rendering pipeline (add security overlays),
  Zustand store (add simulation state), and tool system (add camera/zone/path tools) deeply enough that
  a dependency relationship creates more friction than a fork

**Alternative rejected — depend on `@pascal-app/core` as npm package:**
- Cannot extend AnyNode union without monkeypatching
- Cannot add security systems to the system loop
- Upstream changes could break our extensions
- No control over when they release fixes or changes

**Alternative rejected — build from scratch:**
- 2–4 weeks of work just to reach Pascal's current level of wall/door/window editing
- High risk of correctness bugs in CSG, mitering, geometry generation
- Pascal's BVH-ready geometry and dirty-tracking system are valuable patterns to inherit

**Implementation note:** Document every divergence from Pascal upstream in this file.
Monitor `pascalorg/editor` for improvements worth backporting quarterly.

---

## D-002 | 2026-05-25 | SecurityScene is the single source of truth

**Decision:** All layers (Pascal spatial, SentinelTwin security, simulation engine, AI agents,
report generator) communicate exclusively through the SecurityScene schema. No layer maintains
its own scene representation.

**Rationale:**
- Prevents the "two sources of truth" problem that kills simulations (UI shows one thing, sim computes another)
- Allows any agent (Claude, Codex, Gemini) to work on the same scene without format translation
- Makes testing deterministic: same SecurityScene JSON = same simulation output
- Enables before/after comparison by diff-ing two SecurityScene snapshots

**Implication:** Schema changes are expensive (8-step protocol). Design the schema right the first time.
Details in `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md`.

---

## D-003 | 2026-05-25 | Coverage engine is deterministic geometry, not AI

**Decision:** The coverage simulation (raycasting, DORI scoring, heatmap, path visibility) is
deterministic Three.js/geometry code. AI does not compute coverage numbers.

**Rationale:**
- Security recommendations based on AI-hallucinated coverage numbers are dangerous
- Deterministic geometry is testable, reproducible, and auditable
- Clients and security professionals can trust numbers that come from geometry, not inference
- Pattern: "AI proposes. Simulation verifies. AI explains."

**Implementation:** `@sentineltwin/simulation` package has zero React and zero AI dependencies.
It can run in a Web Worker. Input: SecurityScene. Output: SimulationResult.

---

## D-004 | 2026-05-25 | three-mesh-bvh is mandatory from day one

**Decision:** All raycasting in the coverage engine uses three-mesh-bvh acceleration.
This is not optional or a later optimization — it must be in place from the first working coverage engine.

**Rationale:**
- Without BVH, raycasting a scene with 50+ objects for a 40×40 grid iterates over all geometry
  for each ray, giving O(rays × objects) complexity. Unacceptable.
- With BVH, the same operation is O(rays × log(objects)) — typically 10–50× faster
- Building BVH later requires refactoring the entire raycasting layer
- Start with correct architecture: build merged vision-collider mesh + BVH on scene change

---

## D-005 | 2026-05-25 | AI model pipeline is model-agnostic with OpenAI as V0.1 default

**Decision:** All AI model calls go through a provider abstraction. The active provider is a
config flag, not a code change. GPT-4o with Structured Outputs is the default for V0.1.

**Rationale:**
- Avoid vendor lock-in at the architecture level while still shipping with the best available model
- OpenAI hackathon context: GPT-4o is the right default for judging, but the product doesn't
  permanently depend on it
- Different tasks have different model strength/cost tradeoffs (scene understanding → Qwen2.5-VL,
  report generation → GPT-4o, voice → Realtime API)
- Being model-agnostic is the right long-term architecture

**V0.1 defaults:**
- Command parsing: GPT-4o Structured Outputs
- Counterfactual: GPT-4o
- Report: GPT-4o
- Scene understanding (V0.2): TBD from bakeoff

---

## D-006 | 2026-05-25 | Instanced mesh for coverage heatmap (not canvas texture)

**Decision:** Coverage heatmap uses THREE.InstancedMesh with per-instance colors, not a canvas texture
painted on the floor.

**Rationale:**
- Per-cell color control without texture resolution limits
- 40×40 = 1,600 instances is negligible GPU cost
- Can directly update `instanceColor` TypedArray without texture readback
- Avoids canvas sizing/DPI complications
- Alternative (canvas texture) is visually smoother but more complex to update

**Alternative rejected — canvas texture on floor:**
- Requires canvas size proportional to scene, DPI scaling
- Updating requires canvas 2D context drawing, which is slower than typed array writes
- Cannot easily mix with Three.js coordinate system without UV mapping complexity

---

## D-007 | 2026-05-25 | Secondary Canvas for camera feed view (not render-to-texture)

**Decision:** Camera feed panel uses a separate `<Canvas>` component with its own R3F renderer,
not a render-to-texture (RTT) approach.

**Rationale:**
- Simpler to implement: just another Canvas with camera locked to simulated camera pose
- R3F makes secondary canvases trivial
- RTT requires additional render pass management in the main canvas

**Risk noted:** 4 active Canvas elements (camera wall mode) may be heavy on low-end GPUs.
Need to test. If performance is insufficient, switch to RTT for camera wall.

---

## D-008 | 2026-05-25 | Physics (Rapier) is optional in V0.1

**Decision:** Rapier physics is not required for V0.1. Simple AABB collision for drag-and-drop
is sufficient. Rapier can be added in V0.2.

**Rationale:**
- V0.1 coverage simulation is raycasting + geometry, not physics
- Simple bounding-box overlap check is sufficient to prevent objects from intersecting when dragged
- Rapier adds WASM bundle size overhead that is not justified for V0.1
- Focus V0.1 on the simulation core, not collision fidelity

**Note:** Physics collider ≠ vision collider. This distinction must be in the data model even before
Rapier is added. The `visionTransmission` property on ObstructionNode is data-model level, not physics-level.

---

## D-009 | 2026-05-25 | Adversarial path simulation uses Dijkstra with exposure cost

**Decision:** Find minimum-exposure path using Dijkstra's algorithm with cumulative detection
exposure as the cost function (not distance).

**Rationale:**
- Dijkstra gives provably optimal minimum-cost path
- Exposure cost = detection probability × time spent in detection zone
- This models a rational actor who minimizes total detection risk
- Tractable: 6,400 node graph with ~8 edges each = ~50,000 ops = <10ms in browser
- GSAP or BFS alternatives considered and rejected (BFS doesn't handle weighted costs)

**Alternative rejected — A* with heuristic:**
- Heuristic is hard to design for exposure minimization (not geometric distance)
- A* gives best performance when heuristic is admissible; here Dijkstra is cleaner
- May revisit if scene scale demands it (campus-level) 

---

## D-010 | 2026-05-25 | Build simulation core before introducing external editor forks

**Decision:** Build and prove SentinelTwin's own simulation pipeline first —
SecurityScene schema, coverage engine, adversarial path, camera view, report —
before integrating Pascal or any other external 3D editor repo.

**Rationale:**
- The simulation core (raycasting, DORI quality, adversarial path, heatmap) is entirely
  SentinelTwin's own work. None of it requires Pascal or any editor foundation.
- Introducing Pascal before understanding our own pipeline means we are building on top
  of something we don't fully understand yet, creating unnecessary constraint on our design.
- The right sequence: build and test the simulation pipeline standalone in a minimal R3F
  canvas → understand exactly what the spatial editor needs to provide → then decide what
  editor foundation (Pascal fork, own build, or something else) to bring in.
- External forks should be introduced only when we know precisely what we are asking them
  to do and have verified that they do it.

**Implication for PHASE_0_SETUP.md:**
- Task 0.1 (Pascal fork) is deferred. It is not the first task.
- First tasks: SecurityScene schema → minimal R3F canvas → coverage engine → demo scene
  → adversarial path → then evaluate what editor foundation is needed.
- Update PHASE_0_SETUP.md accordingly before any agent begins work.

**What this is NOT:**
- Not a rejection of Pascal. Pascal remains the current best candidate for the spatial
  editor foundation and the fork decision (D-001) stands as the plan once we reach that stage.
- Not a scope reduction. The full architecture is still the target.
- Not a hackathon compromise. This is the correct engineering sequence regardless of timeline.

**Alternative rejected — start with Pascal fork:**
- Forces understanding of Pascal's internals before we understand our own requirements
- Any mismatch between Pascal's architecture and our simulation needs requires retrofitting
- We may discover we need things Pascal does not support, or don't need things it provides

---

## D-011 | 2026-05-25 | Adversarial path simulation is a core primitive, not a later phase

**Decision:** Adversarial path simulation is treated as a core simulation primitive alongside
the coverage engine, not as a later feature added on top. It should be built and demoed
as early as possible — immediately after basic coverage works.

**Rationale:**
- Coverage heatmaps already exist in tools like JVSG and Axis Site Designer.
  They are not the differentiator.
- The adversarial path — showing the actual minimum-exposure route a motivated actor
  would take, updating live as objects and cameras change — does not exist anywhere.

---

## D-012 | 2026-05-26 | Shared 2D map system is canonical for minimap and path analysis

**Decision:** SentinelTwin’s 2D navigation/analysis surfaces use one shared map stack under
`apps/studio/src/components/map/` with a single coordinate projection, shared SVG layers,
distance-weighted path sampling, and store-backed path selection state.

**Rationale:**
- MiniMap and PathMap now need to agree exactly on geometry, highlighting, and replay position.
- Shared projection avoids the old “same scene, two slightly different SVG transforms” drift.
- Distance-weighted sampling makes long path segments behave correctly instead of inheriting the
  old equal-control-point bias.
- Keeping `activePathId` global preserves replay, ribbon, and map selection sync across panels.

**Alternatives rejected:**
- Keep the old inline SVG snippets inside `LeftPanel.tsx` and `ScenarioPathPanel.tsx`.
  That would preserve duplicated transforms and geometry drift.
- Keep silently defaulting to `scene.paths[0]` whenever selection is missing.
  That makes the path picker fake and hides selection state from the user.
  This is the feature that makes security professionals stop and say "I've never seen this."
- Delaying it to Phase 6 means the most novel and defensible piece of the product
  is the last thing built and least likely to be ready when it matters.
- The algorithm is well-designed (Dijkstra with exposure cost, <10ms on 6,400 nodes).
  The coverage engine is a prerequisite. Nothing else is.

**Implication:** Build phases should treat adversarial path as Phase 2 after coverage engine,
not Phase 4+. Update PHASE docs accordingly.

---

## D-012 | 2026-05-26 | PrivacyZoneNode is a first-class SecurityScene node type

**Decision:** PrivacyZoneNode is a built-in security node type with its own Zod schema,
rendering overlay, and compliance report export. It is NOT a post-hoc annotation or tag
on existing nodes.

**Rationale:**
- GDPR enforcement is escalating: CNIL (France) issued €200,000+ fines in 2025-2026 for

---

## D-013 | 2026-05-27 | Defensive framing is canonical for route-risk simulation outputs

**Decision:** Route-risk simulation remains in the deterministic engine, but user-facing and report-facing
surfaces must frame it as defensive coverage-failure analysis. Canonical field aliases were added:
`coverageFailurePath`, `coverageGapsUsed`, `camerasWithoutCoverageOnRoute`,
`criticalZonesReachableAlongRoute`, and `criticalZoneReachable`.

**Rationale:**
- Preserves security-audit value while avoiding evasion-oriented language.
- Aligns product behavior with SentinelTwin’s defensive framing policy.
- Keeps backward compatibility for existing stored data and existing UI/tests by retaining
  older field names as deprecated aliases.

**Alternatives rejected:**
- Immediate hard delete of older adversarial field names. Rejected due migration risk and
  parallel in-flight work that still references those names.
- Pure copy-only wording fix with no schema aliasing. Rejected because downstream code and reports
  would keep inconsistent semantics.

**Implementation notes:**
- `simulationResult` now exposes `coverageFailurePath` alongside the backward-compatible
  `adversarialPath`.
- `simulate-studio` populates both keys from one deterministic computation.
- Threat and replay panels now prefer defensive aliases with fallback to legacy names.
  excessive monitoring and disproportionate camera placement
- BIPA (Illinois) class-action risk: privacy zones around sensitive areas (changing rooms,
  restrooms, union offices, cafeterias) are a legal requirement, not best practice
- Healthcare (HIPAA): cameras must NOT capture PHI (patient screens, medical records) —
  privacy zones document compliance
- Every vertical (schools, healthcare, retail) needs documented privacy compliance evidence
- If privacy zones are post-hoc tags, compliance reports can't verify they existed at scene time

**Implementation:**
- `PrivacyZoneNode` in SecurityScene schema: polygon boundary + type (no-video, restricted-view,
  blindspot-required) + regulatory reference (GDPR Art 6, BIPA, HIPAA)
- Coverage engine excludes privacy zones from visibility computation
- Report layer generates privacy compliance section referencing applicable regulations
- Privacy zone overlay is visually distinct in the editor (red hatching or similar)

**Alternative rejected — post-hoc annotation on CameraNode:**
- Doesn't satisfy regulatory documentation needs (compliance requires explicit zone definition)
- Annotating camera FoV is not the same as defining a protected zone boundary
- Post-hoc tags can be removed without trace — audit trail requires first-class nodes

---

## D-013 | 2026-05-26 | SpatialLM confirmed for V0.4 scan-to-scene pipeline

**Decision:** Include SpatialLM (Apache 2.0) as the semantic extraction stage in the V0.4
scan-to-SecurityScene pipeline. It will follow VGGT (MIT) for camera pose + point maps and
feed into our SecurityScene compiler.

**Rationale (from May 2026 research):**
- SpatialLM outputs structured text with architectural elements (walls, doors, windows) and
  3D bounding boxes for furniture — directly usable for SecurityScene block extraction
- Apache 2.0 licensed — fully permissive for commercial use
- Standard Python environment (Python 3.11, PyTorch 2.4.1, CUDA 12.4), no Docker requirement
- 94.3 F1 @ .25 IoU on Structured3D layout estimation — competitive with dedicated methods
- Works with point clouds from monocular video, RGBD, or LiDAR — flexible input options
- 0.5B and 1B parameter sizes — reasonable VRAM footprint

**Pipeline confirmed:**
```
Phone video → VGGT (MIT) → point maps + camera poses
  → conversion step (point map tensor → Open3D PointCloud)
  → SpatialLM (Apache 2.0) → structured text (walls, doors, windows, furniture OBB)
  → SecurityScene compiler (our code) → SecurityScene JSON
  → User confirmation UI → final scene
```

**What changed from earlier assumption:**
- Previously assumed a tighter VGGT → Open3D integration. Research confirms a conversion step
  is needed (point map tensor → .ply or COLMAP format → Open3D loads it). This is standard.
- SpatialLM was assumed but not confirmed Apache 2.0. Now confirmed.

**Alternative rejected — scene understanding direct from GPT-4o Vision:**
- GPT-4o cannot produce metric 3D bounding boxes from single images
- SpatialLM operates on real point cloud data for geometric accuracy

---

## D-014 | 2026-05-26 | three-mesh-bvh performance target confirmed achievable

**Decision:** Proceed with three-mesh-bvh as the BVH acceleration layer for the coverage engine.
No need for alternative acceleration strategies.

**Rationale (from May 2026 research):**
- 6,400 rays (40×40 grid × 4 cameras) is well within three-mesh-bvh's capability on modern
  desktop GPUs. Target <16ms is achievable.
- Shared BVH: build merged vision-collider mesh once, raycast from all cameras
- Memory overhead is moderate (TypedArray-based tree, a few bytes per triangle)
- Web Worker offload available for BVH construction on large scenes
- Industry standard in Three.js ecosystem — well-maintained, documented

**Implementation guidance (from bench.):**
- Build merged vision-collider mesh on scene change (simulationDirty flag)
- Generate BVH once; reuse for all raycasts
- Consider Web Worker for BVH rebuild if scenes approach campus scale (100k+ triangles)

---

## D-015 | 2026-05-26 | Privacy compliance is a product requirement, not an optional overlay

**Decision:** SentinelTwin's privacy compliance features (privacy zones, DPIA report section,
compliance evidence export) are core product requirements from V0.1, not V2+ enhancements.

**Rationale:**
- The same research that validated SentinelTwin's product gap also revealed that privacy
  compliance is the #1 adjacent pain point for every buyer persona:
  - DPOs need documented camera placement justification (GDPR Art. 35 DPIA)
  - Security consultants need to show clients that privacy zones are respected
  - School district directors need compliance evidence for grant reporting
  - Healthcare facility managers need Joint Commission-ready privacy documentation
- Privacy zones are a regulatory requirement, not a best practice — this makes them a
  mandatory consideration, not a nice-to-have
- Building privacy compliance as a core feature from day one avoids a later retrofit that
  would break the schema, report format, and simulation engine

**Impact on build sequencing:**
- PrivacyZoneNode in SecurityScene schema (V0.1 — data model, already planned)
- Privacy zone overlay in editor (V0.1 — visual enforcement in the editor)
- Coverage engine must respect privacy zones (V0.1 — raycast stops at privacy zone boundary)
- Compliance report section referencing applicable regulations (Phase 7 — after simulation core is stable)
- Dedicated privacy compliance evidence export formats (Phase 10 — per-jurisdiction report templates)

The key principle: **privacy zones are in the data model and engine from day one** (V0.1).
The compliance report export is split from the core enforcement because it depends on
stable simulation output and per-jurisdiction regulatory research.

**Impact on architecture docs:**
- Update ARCHITECTURE_OVERVIEW.md to explicitly call out privacy compliance flow
- Privacy is not an afterthought — it's in the core loop

---

### D-035: Phase 7 — Temporal Security Simulation

**Status:** Accepted — 2026-05-26
**Source:** PHASE_7_TEMPORAL_SIMULATION.md

**Decision:** Build a 24-hour temporal simulation layer that models how security posture changes over time, with:

1. **Schema types** — `TimeSchedule`, `TemporalSecurityProfile`, `HourlySecuritySnapshot`, `VulnerabilityWindow` added to `security-scene.ts` before `securitySceneBaseSchema` to avoid TDZ
2. **Temporal engine** (`simulation/temporal.ts`) — Builds a change timeline from schedule transitions (lights, occupancy), runs full coverage sim only at transition points (~10–15 per day), interpolates intermediate 15-min snapshots by state label matching
3. **Store integration** — `temporalProfile`, `temporalScrubHour/Minute` state with `setTemporalScrub` auto-switching `environmentMode` (day/night/dusk), `computeTemporalProfile` action
4. **TemporalProfileView UI** — 24h dashboard: summary cards, clickable coverage timeline bar (96 slots), vulnerability window cards (severity-colored, expandable), safest periods, zone coverage stability chart
5. **BottomPanel tab** — "24H PROFILE" tab between TIMELINE and BEFORE/AFTER

**Rationale:** Moves beyond static day/night toggle to answer "when is your site most vulnerable?". Coverage recomputed only at transition points (not all 96 slots) for performance.

**Bugfixes applied during validation:**
- `getExteriorLightState`: fixed operator precedence causing `0:00–2:00` to show incorrect state
- `vulnerabilityWindowSchema.endHour`: changed `max(23)`→`max(24)` to match engine output

## Future Decisions Pending

| ID | Question | Decision criteria |
|---|---|---|
| D-016 | When to move coverage engine to Web Worker? | Benchmark first. If >16ms on a 40×40 grid + 4 cameras on test hardware, move. |
| D-017 | Rapier: when to add? | Profile first build without it. Add if drag-and-drop quality is unacceptable. |
| D-018 | Camera wall: 4 Canvas or render-to-texture? | Test with 4 Camera nodes. If >30fps degradation, switch to RTT. |
| D-019 | Scene understanding model (V0.2)? | Run bakeoff in experiments/scene_understanding/ |
| D-020 | Segmentation model for scan mode (V0.2)? | Run bakeoff in experiments/segmentation/ |
| D-021 | Coverage entropy metric: surface in V0.1 or defer? | Show to target user for feedback first. |
| D-022 | GSAP vs motion (Framer Motion)? | Decided — use motion (Framer Motion v11, MIT). See D-011 addendum. |
| D-023 | Local-first vs server-side compute? | See Thread 23 in EXPLORATION_MAP.md. Must resolve before building any data persistence. |
| D-024 | Security Evidence Twin as product mode or primary frame? | See Thread 24 in EXPLORATION_MAP.md. Product decision, not technical. |
| D-025 | Text-to-scene as primary input or secondary? | See Q-016 in OPEN_QUESTIONS.md. Experiment first. |
| D-026 | Multi-sensor scope: camera-only or full physical security? | See Thread 25 in EXPLORATION_MAP.md. Affects data model. Decide before V1 design. |
| D-027 | Verkada Site Planner — competitive threat or market validation? | Market validation — 2D, vendor-locked, no simulation. Monitor for feature expansion. |
| D-028 | School/campus vertical — dedicated product or template? | Decide after V0.1 launch and user feedback. See Thread 40. |
| D-029 | Physical security SOAR — when to begin architecture? | V0.2: design agent architecture with SOAR integration in mind. V1: implement. |

---

## D-030 | 2026-05-26 | Coverage grid cell size = 0.25m (4 cells/meter) for Phase 0

**Decision:** Coverage grid uses 0.25m cell size (4 cells/meter) as the standard resolution.

**Rationale:**
- A human body is approximately 0.0.5m wide. At 0.25m cells, a person covers 2 cells in width,14
  giving DORI-meaningful spatial  coarse enough to compute quickly, fine enough toresolution 
  distinguish obstruction shadow at body scale.
- A 107m room produces a 4028 = 1,120 cell grid per camera. For 4 cameras: 4,480 raycasts per
  simulation run. This is well within the <16ms performance target at 0.25m.
- 0.25m aligns with typical tile/grid references in security planning tools (JVSG uses 0.25m by default).
- Coarser (0.5m) loses resolution at obstruction  a shelf's shadow covers only 1 cell and theedges 
  quality mismatch is not visible. Finer (0.1m) increases raycast count 6.25 without corresponding
  visual benefit.

**Implementation:** `cellsPerMeter = 4` constant in `src/simulation/grid.ts`. Displayed as "Grid: 0.25 m"
in the Studio status bar.

**Alternative  0.5m cells:**rejected 
- Too coarse for obstruction shadow detection at human-body scale
- Cash counter failure scenario loses fidelity

**Alternative  0.1m cells:**rejected 
- 100 cells/  vs 16 cells/  = 6.25Mm more raycasts
- No meaningful improvement in DORI quality classification at sub-0.25m scale
- Performance budget consumed without simulation accuracy gain

**Revisit trigger:** If scenes exceed 3030m (campus scale), consider adaptive resolution
(coarser in open areas, finer near critical zones). Document in OPEN_QUESTIONS.md when needed.

---

## D-031 | 2026-05-26 | npm install over bun install for runtime production dependency resolution

**Decision:** Use `npm install` (not `bun install`) for installing runtime dependencies in `apps/studio`.
Keep `bun test` for test execution (fast, works correctly with resolved node_modules).

**Rationale:**
- Bun's isolated-install mode fails to resolve transitive dependencies for Zod in the test environment:
  `import { z } from 'zod'` resolves correctly when node_modules is built by npm, but Bun's
  isolated mode creates a separate resolution context that breaks Zod's package export map.
- This is a Bun 1.3.4 behavior specific to packages that rely on `exports` field resolution.
  npm resolves it correctly via standard node resolution.
- The mismatch only appears in the test environment (vitest via Bun); the Next.js dev build
  (handled by Turbopack) resolves correctly in both cases.
- `bun test` continues to run tests fast (209ms for 5 tests) against the npm-resolved node_modules.

**Alternative  bun install throughout:**rejected 
- Caused `Cannot find module 'zod'` in vitest test runner
- Fixing required custom module resolution config in vitest.config.ts; npm install is simpler

**Note for agents:** When adding new dependencies, use `npm install <package>` (not `bun add`).
When running tests, use `bun test` or `npm test` (both invoke the same `bun test` command via package.json).

---

## D-033 | 2026-05-26 | CoverageSegmentPath supersedes AdversarialPathLine; remove redundant overlays

**Decision:** `CoverageSegmentPath` (colored segments per DORI quality level) supersedes
`AdversarialPathLine` (uniform dashed red line) as the canonical adversarial path renderer.
`AdversarialPathLine` was left in-place during Phase 4, creating a supersession violation:
`WorkspaceCanvas.tsx` and `PathReplayView.tsx` both rendered the old component alongside the new one.

**Rationale:**
- Colored segments (DORI blue→green→amber→orange→red) carry more information than uniform red
  — the security professional can immediately see which sections of the path are detected vs. blind
- Two parallel path renders in the same scene create visual confusion (overlapping lines)
- motto_v2.md Section 7 mandates removing superseded artifacts, not just building replacements

**Files changed:**
- `WorkspaceCanvas.tsx` — replaced `AdversarialPathLine` with `CoverageSegmentPath`, passing
  waypoints with their `detectionQuality` for colored segment rendering
- `PathReplayView.tsx` — removed redundant `AdversarialPathLine` overlay; `CoverageSegmentPath`
  already renders the coverage failure path with richer color coding
- `SharedScene.tsx` — `AdversarialPathLine` retained as a shared export (may be removed in
  a future cleanup pass after confirming no remaining references)

**Rejected alternative — keep both for different use cases:**
- Uniform red line carries strictly less information than colored segments
- No scenario where a uniform red line is preferable to color-coded quality bands
- Two conflicting path renders in the same view is a visual bug, not a feature

**Lesson:** When building a replacement component, immediately check all references to the old
one and update them. Supersession is not "build new + keep old" — it's "build new + redirect every
reference to the new path, then remove the old."

---

## D-032 | 2026-05-26 | Simulation trust boundaries must be verified against the scene contract

**Decision:** The coverage engine must honor the schema it exposes: camera `rangeM`, scene assumption thresholds, target height profiles for zone analysis, closed-door walkability, and door/window visibility penalties are all part of the canonical simulation path. Recommendations are only marked verified after a patched scene is re-simulated and shows a measurable improvement.

**Rationale:**
- SentinelTwin's value depends on trust, not just visual polish. If the schema exposes a field, the engine should use it or remove it.
- `rangeM` is a hard physical bound and must gate visibility before pixel-density scoring.
- `pixelsPerMeter` is a product input, not documentation; the quality classifier and area metrics must use it.
- Critical zones should be evaluated with target-specific sample heights so a face, plate, or vehicle is not reduced to a single hard-coded height.
- Recommendations cannot claim verification without a counterfactual simulation pass.

**Implementation:**
- `apps/studio/src/simulation/coverage.ts`
- `apps/studio/src/simulation/grid.ts`
- `apps/studio/src/simulation/simulate-studio.ts`
- `apps/studio/src/components/view/PathReplayView.tsx`
- `apps/studio/src/components/bottom-panel/ReportLiteTab.tsx`

**Alternative considered:** Leave the existing demo heuristics in place and only rename UI copy.
- Rejected because it preserves overclaiming and keeps the engine out of sync with the schema.

**Revisit trigger:** If the data model adds new target classes or sensor types, extend the target-height mapping and verification helpers rather than adding another scoring path.

---

## D-034 | 2026-05-26 | Phase 6 — Demoware Completion: close all remaining UI gaps before demo

**Decision:** Implement all P0–P2 gaps identified in the gap analysis (CAMERASTUDIO_GAP_ANALYSIS.md) as a single tracked phase, closing every UI gap from scene management to camera presets before any external walkthrough.

**What was built (11 items):**

### P0 — Demo-critical
1. **Scene Management** — localStorage save/load, scene selector dropdown (TopBar), "New Scene" button, "Import JSON" file picker and validation in `studio-store.ts`
2. **Report Export** — `buildHtmlReport()` function generates a styled HTML document from scene metrics + AI report, launched via `window.open()`+`document.write()` from ReportLiteTab
3. **Camera Failures Tab** — IssuesTab now shows per-camera failure mode toggles (blocked/dirty/offline) with live coverage impact metrics (loss %, cameras affected, zones exposed)
4. **Assumptions Panel** — New `AssumptionsPanel.tsx` component surfaces all `SimulationAssumption` fields with edit capability, wired into ContextRightPanel
5. **Visual Compare** — CompareView enhanced with side-by-side metrics panel showing coverage diff per camera + confidence impact + delta summary

### P1 — Product completeness
6. **Privacy Zones** — `ScenePrivacyZones` component renders privacy zone polygons in SharedScene with distinct styling (red hatching pattern, rotation indicator). Wired into WorkspaceCanvas via `layers.privacy_zones` layer toggle
7. **Redundancy Matrix** — New `RedundancyMatrixPanel.tsx` component showing camera-failure coverage impact per zone with colored severity cells. Wired into BottomPanel tabs
8. **Keyboard Shortcuts** — Global handler in StudioShell: Ctrl+N (new scene), Ctrl+S (save), Ctrl+O (import file input), 1–5 (view modes), C/B/L (camera/obstruction/light tools, toggle off if active), Esc (select tool), ? (shortcuts modal toggle). Input elements excluded via tagName check.

### P2 — Polish
9. **Scene Export UI** — "Export JSON" button in TopBar downloads current scene via Blob URL
10. **Test Without Obstruction** — ObstructionInspector's disabled button now calls `setSimulationPatch` to temporarily remove obstruction, recompute coverage, and show impact
11. **Camera Preset Library** — New `CameraPresetPicker.tsx` component defines 4 presets (Indoor Dome 90°, Bullet 60°, PTZ 360°, Fisheye 360°). Module-level `_currentPresetId` for sync read from callbacks; `getCameraPreset()` returns null when no preset selected (preserves default `createCameraNode()` behavior). Floating bar in WorkspaceCanvas when camera tool is active.

**Key design decisions:**
- **Module-level state for preset picker** — `_currentPresetId` is not React state because `ToolPlacementFloor` callback needs synchronous read without hooks. Returns `null` by default to preserve backward compatibility. This is pragmatic but not React-idiomatic — a store migration (putting preset into Zustand) would be a clean-up opportunity.
- **`buildHtmlReport()` via `window.open()`+`document.write()`** — avoids adding a jsPDF dependency for V0.1. The generated HTML includes inline CSS for standalone formatting. A production-quality PDF library should replace this before external distribution.
- **Keyboard shortcuts skip input elements** — `tagName` check on `(event.target as HTMLElement).tagName` prevents hijacking text input in scene name fields, AI command bar, and assumption editors.
- **Floating bar for CameraPresetPicker** — positioned absolutely (top-center of canvas area) rather than in a side panel, keeping it contextually near the 3D canvas where placement happens.

---

### D-036: Phase 8 — AI Agent Pipeline Production Hardening

**Status:** Accepted — 2026-05-26
**Source:** PHASE_8_AI_AGENT_PIPELINE.md

**Decision:** Upgrade the thin-wrapped agent system to a production-grade multi-agent pipeline with:

1. **Streaming in ModelProvider** — `completeStreaming()` returning `AsyncIterable<string>`, with OpenAI, Gemini, and Qwen providers all implementing it
2. **Retry + fallback** — `retryWithFallback()` with exponential backoff, jitter, abort signal handling, and backup provider fallback
3. **Rate limiting** — Sliding-window token bucket per provider tracking RPM/TPM limits
4. **Token tracking** — `TokenTracker` accumulating prompt/completion tokens per session/model/provider
5. **CoordinatorAgent** — Multi-agent router with `ConversationMemory` (ring buffer of 20 exchanges, automatic summarization at threshold)
6. **ProviderConfigPanel** — UI for switching providers, setting API keys, configuring model params
7. **AgentCoordinatorPanel** — Live monitoring UI with agent status, token usage, active chain display
8. **Tests** — Unit tests for retry logic, rate limiter, token tracker, coordinator routing, conversation memory

**Rationale:** Multi-turn conversation and streaming responses are expected baseline UX for AI-powered tools. Without orchestration, each agent is an isolated call with no context awareness. The coordinator enables cross-agent reasoning and a single conversation that spans editing, analysis, and report generation.

**Key decisions:**
- Provider interface is additive (streaming added as new method, not breaking existing interface)
- Rate limiting is in-process (sliding window, not distributed — fine for single-user Studio)
- Conversation memory is in-memory (no persistence across sessions — Phase 12 scope)
- Coordinator lives in React (uses Zustand store, not a separate worker)

**Validation:** TypeScript clean, ESLint 0 errors, all 4 agent tests pass, existing 52 tests still pass

---

### D-037: Phase 9 — Report Generation Engine

**Status:** Accepted — 2026-05-26
**Source:** PHASE_9_REPORT_GENERATION.md

**Decision:** Transform the existing markdown-only export into a full professional report generation system with:

1. **Report engine** (`report/index.ts`) — `buildReportData()` that structures all simulation data into a `ReportData` interface, with section rendering (Executive Summary, Coverage Summary, Zone Analysis, Camera Analysis, Issues, Recommendations, Adversarial Path, Assumptions, Temporal Profile)
2. **Format support** — HTML (with inline CSS, print-optimized), Markdown, Plain Text
3. **Standards compliance citations** — IEC 62676-4:2025 OODPCVS, DORI references in all reports
4. **Compare reports** — `buildCompareReport()` with side-by-side metric deltas
5. **Export** — Download HTML/Markdown/Text files, print-to-PDF (browser dialog), copy to clipboard
6. **AI enhancement** — ReportAgent uses AI for executive summary prose and recommendation narrative

**Rationale:** Security professionals need client-facing deliverables. A markdown display inside the app cannot be handed to a client or attached to a compliance report. Professional HTML reports with standards references, DORI citations, and print-to-PDF support provide the artifact layer.

**Key decisions:**
- No external PDF library — uses browser built-in print-to-PDF (zero dependencies)
- Templates are pure functions composing sections — no template engine dependency
- `ReportData` is JSON-serializable for future server-side generation
- Reports work fully without AI; AI is an enhancement layer

**Validation:** TypeScript clean, ESLint 0 errors, existing tests all pass

---

### D-038: Phase 10 — Scan-to-Scene Import Pipeline

**Status:** Accepted — 2026-05-26
**Source:** PHASE_10_SCAN_TO_SCENE.md

**Decision:** Build import pipelines and a scene builder wizard that enable users to create SecurityScenes from floor plan images, photos, or manual room-by-room specification:

1. **Floor plan import** (`lib/floor-plan-import.ts`) — Client-side image processing with Canvas API: gradient-based wall detection, contour tracing, dimension extraction, door/window gap identification. Returns structured `FloorPlanResult`.
2. **Scene templates** (`lib/scene-templates.ts`) — Pre-built configurations for retail shop, office, warehouse, school classroom, parking garage, with template categories and one-click creation
3. **SceneBuilderWizard** (`components/scan-to-scene/SceneBuilderWizard.tsx`) — Multi-step wizard: Room Setup → Import Method → Floor Plan Upload → Configure Assumptions → Review & Create
4. **ImportReview component** — Shows detected walls on canvas overlay with toggle

**Rationale:** The demo scene (`small-retail-shop.ts`) and blank canvas are the only two ways to get a scene. For SentinelTwin to be useful to security professionals, they need to create scenes from their actual site layouts — either via templates for common spaces or via floor plan image import.

**Key decisions:**
- Client-side only — no image upload to server (supports local-first architecture)
- Heuristic wall detection (gradient + contour) rather than ML — the 80% case works without external dependencies
- Templates are code-generated functions, not JSON files
- Multi-step wizard reduces cognitive load for the complex scene-creation task

**Validation:** TypeScript clean, ESLint 0 errors, existing tests all pass

---

## D-035 | 2026-05-26 | Canvas-first docked workspace with contextual panels and presets

**Decision:** Evolve the studio shell from fixed always-open side/bottom panels to a canvas-first dock layout with collapsible docks, contextual inspectors, resize handles, and workspace presets.

**Why:** SentinelTwin needs maximum canvas area for coverage analysis, path replay, camera wall, and compare workflows. A fixed panel layout permanently consumes too much space and cannot adapt to mode-specific tasks or object-specific inspection.

**What this means in practice:**
- Left, right, and bottom regions are treated as docks with collapsed/expanded states instead of permanent panels.
- The right dock becomes contextual: scene overview when nothing is selected, then camera / zone / obstruction / light inspectors when the selection changes.
- The bottom dock adapts to the active workspace preset, so replay and compare can prioritize timeline and deltas while camera wall can collapse by default.
- Workspace presets apply layout defaults for edit, coverage, camera wall, replay, compare, report, debug, and focus/demo modes.
- Focus mode hides docks to maximize the canvas for demos and close-up analysis.

**Rejected alternatives:**
- **Full free-form draggable docking immediately** — rejected for now because it adds complexity without improving the first-order UX gain. Collapsible, resizable, contextual docks are enough for the current product stage.
- **Keep fixed panels and only reduce widths** — rejected because the core problem is not width alone; it is the lack of mode-aware layout state and object-aware panel content.

**Implementation note:** Mode switches now also set the workspace preset so the shell can restore an appropriate dock arrangement when entering camera view, replay, compare, or camera wall workflows.

**Validation:**
- TypeScript: clean (tsc --skipLibCheck)
- ESLint: 0 errors across all new/changed files
- Tests: 29/30 pass (1 pre-existing InspectorPanel test failure unrelated to Phase 6)

**Alternatives considered:**
- **Full PDF library for report export** — rejected for V0.1. jsPDF/html2canvas adds ~100KB+ dependency. HTML export via browser's print-to-PDF is sufficient for demos.
- **Zustand store for camera preset** — cleaner React integration but requires `ToolPlacementFloor` to read from store synchronously, which doesn't work during R3F pointer events. Module-level state is a known tradeoff.
- **Modal for keyboard shortcuts** — considered `window.alert()` for simplicity, but an inline modal component provides better UX and matches the existing design patterns (InfoModal, DemoModeOverlay).

---

## D-039 | 2026-05-26 | Use Webpack fallback for local dev/build while Turbopack endpoint writing is unstable

**Decision:** Run `apps/studio` development and build commands through `next dev --webpack` and `next build --webpack` instead of the Turbopack default for now.

**Rationale:**
- The local Next 16.2.6 dev server hit a reproducible `TurbopackInternalError` while writing page endpoints, with `range start index ... out of range for slice ...` in `.next/dev/logs/next-development.log`.
- Next.js 16 officially documents `--webpack` as the supported fallback for both `next dev` and `next build`.
- This keeps the studio usable immediately while we keep the Turbopack issue isolated and avoid conflating an upstream bundler crash with application correctness.

**Alternatives rejected:**
- **Keep Turbopack and hope cache clearing fixes it** — rejected because the error recurred across restarts and blocked visual verification.
- **Downgrade Next immediately** — rejected because the current Next release and the app code are otherwise aligned, and the issue is localized to the Turbopack path.

---

## D-040 | 2026-05-26 | Override nested PostCSS to the patched 8.5.15 line

**Decision:** Add a root `overrides` entry for `postcss` so the installed tree uses `8.5.15` everywhere, including the copy nested under `next`.

**Rationale:**
- `npm audit` reported a moderate PostCSS XSS advisory via the nested `next/node_modules/postcss@8.4.31` copy.
- The workspace already depends on `postcss@8.5.15` through `@tailwindcss/postcss`, so the patched line is already present and compatible in the tree.
- After the override, `npm audit` returned zero vulnerabilities and `npm ls` shows `postcss@8.5.15` deduped under `next`.

**Alternatives rejected:**
- **Leave the advisory unresolved because it is transitive** — rejected because the fix is small and does not require sacrificing the current app stack.
- **Downgrade Next** — rejected because the advisory is specific to the bundled PostCSS copy, not to a need to step back from the current Next release.

---

## D-041 | 2026-05-26 | Pin the studio runtime to Node 24.13.0

**Decision:** Add `engines.node` and `.nvmrc` for `apps/studio` to standardize on Node `24.13.0`.

**Rationale:**
- The local shell environment showed two different Node/npm combinations during install and audit work, which created noisy engine warnings and made reproducibility harder.
- The studio dependency set is compatible with Node 24, and the current environment is already on `v24.13.0`.
- Pinning the runtime reduces install drift without changing app behavior.

**Alternatives rejected:**
- **Leave Node unpinned** — rejected because the install warnings and environment drift are avoidable.
- **Pin to Node 23** — rejected because the supporting packages and current shell are already on the Node 24 line.

---

## D-042 | 2026-05-26 | Consolidate MiniMap and PathMap on one shared 2D map system

**Decision:** Use a shared `apps/studio/src/components/map/` renderer stack for minimap and path-map views, with one projection model, shared SVG layers, and interpolated path-quality sampling.

**Rationale:**
- The previous MiniMap and PathMap implementations duplicated projection math and diverged on geometry fidelity, which made selection, hover, and path analytics inconsistent.
- A shared projection plus reusable SVG layers keeps camera, obstruction, zone, path, and coverage rendering aligned across both surfaces.
- Interpolated sampling is required so quality ribbons reflect the full route rather than only authored waypoints on long segments.

**Alternatives rejected:**
- **Keep separate per-panel SVG renderers** — rejected because the duplication already caused projection drift and bounding-box shortcuts.
- **Leave path quality based only on authored points** — rejected because it can hide short low-quality spans inside long segments.

---

## D-043 | 2026-05-26 | Camera evaluation records should expose visibility and reason codes

**Decision:** The coverage engine's per-camera cell evaluation contract now includes an explicit `visible` boolean and machine-readable `reasonCodes` array alongside quality, range, FOV, and occlusion data.

**Rationale:**
- The simulation trust sprint requires not only correct numbers but also explainable reasons for why a target is or is not visible.
- A single `quality` field is insufficient for downstream UI, debug, and report surfaces to explain low-confidence or blocked cells.
- Distinguishing geometric visibility from quality lets the UI explain "visible but low detail" versus "not visible at all" without collapsing those states.

**Alternatives rejected:**
- **Keep the contract quality-only** — rejected because it forces downstream consumers to infer visibility from quality zero, which is lossy and ambiguous.
- **Add opaque freeform reason strings only** — rejected because machine-readable codes are easier to test, filter, and present consistently across UI surfaces.

---

## D-044 | 2026-05-27 | Authored scenario paths are the primary replay path; coverage-failure replay is secondary

**Decision:** `PathReplayView` and the timeline surfaces should prioritize authored `scene.paths` when present, using the coverage-failure route only as a fallback/secondary defensive analysis.

**Rationale:**
- The product needs to let users replay their own scenario first, because that is the user-authored story of what happened or what they want to review.
- Coverage-failure replay remains valuable as a defensive analysis layer, but it should not displace authored incident replay when both exist.
- This keeps the replay UX aligned with the core product loop: user scenario first, simulation overlay second.

**Alternatives rejected:**
- **Keep the failure route as the primary replay story** — rejected because it makes the defensive analysis feel like the only replay mode and hides the user-authored scenario.
- **Create a parallel replay system** — rejected because it would duplicate timing, controls, and timeline behavior instead of reusing the canonical path model.

### D-045: Path Replay is a dedicated full-canvas workspace mode
**Date:** 2026-05-27

**Decision:** `replay` now uses the full-canvas workspace shell, matching `camera_view` and `wall` so the replay surface can own the screen and present the actor/timeline as a primary workflow.

**Rationale:** The replay experience reads as a stage, not a docked sidebar. Keeping it in the docked layout split attention and made the timeline feel like a secondary debug widget instead of the main operator flow.

**Rejected alternative:** Leaving replay inside the docked layout and trying to widen the bottom panel. That still competes with the map and inspector chrome and does not produce the reference-style full-canvas playback experience.

### D-046: Shared map tokens and focus requests keep the 2D map system canonical
**Date:** 2026-05-27

**Decision:** The studio map stack should share one projection/geometry/token layer for MiniMap and PathMap, with canonical map color helpers and an explicit `focusScenePointRequest` store action for empty-map focus handoff to the 3D workspace.

**Rationale:** The minimap and path-map surfaces had started to diverge in projection math, quality coloring, and interaction semantics. Centralizing colors and geometry reduces drift, and using a store request for focus keeps the 2D map decoupled from the 3D workspace implementation while still enabling click-to-focus behavior.

**Alternatives rejected:**
- **Keep local per-component colors and geometry helpers** — rejected because it recreates the drift that caused the earlier half-finished map state.
- **Call OrbitControls directly from the map components** — rejected because it couples SVG UI widgets to the 3D scene implementation and makes the focus behavior harder to test.

### D-047: Map viewport state is scene-scoped, not remount-scoped
**Date:** 2026-05-27

**Decision:** MiniMap and PathMap keep their zoom/pan state in the shared store, but scene import/load/create resets both map viewports back to their canonical fit state.

**Rationale:** Users should not lose their map framing when the component remounts inside the same scene, but a new scene should not inherit stale zoom/pan from the previous one. Resetting viewport state at scene boundaries keeps the 2D maps deterministic while preserving in-scene navigation.

**Alternatives rejected:**
- **Auto-fit on every map remount** — rejected because it overwrites deliberate user navigation whenever the panel is recreated.
- **Keep viewport state across scenes** — rejected because it causes confusing stale framing when switching to a new scene or importing a different one.

### D-050: Workspace selection keeps a primary anchor plus grouped ids
**Date:** 2026-05-27

**Decision:** The studio workbench now tracks both `selectedNodeId` and `selectedNodeIds`, with the first selected node staying as the primary inspector anchor while shift/meta click and drag-select can capture grouped selections.

**Rationale:** The editor needs multi-object selection for real workbench workflows, but the inspector and transform handles still operate best with a single primary target. Keeping both a primary anchor and a grouped selection array preserves the existing inspector flow while enabling box-select and modifier-select without adding a separate selection model.

**Alternatives rejected:**
- **Replace the primary selection with only an array** — rejected because it would force a larger inspector and handles rewrite before grouped selection was even useful.
- **Keep single-node selection only** — rejected because it blocks the requested drag-select and multi-select workbench polish.

### D-048: Temporal engine reads scene.timeSchedule with range-based state resolution
**Date:** 2026-05-27

**Decision:** The temporal engine (`temporal.ts`) now resolves schedules from `scene.timeSchedule` when present, falling back to `DEFAULT_SCHEDULES` when the scene has no schedule. State functions use explicit range checks (`timeInPeriod` with wrap-around midnight support) rather than toggle logic.

**Rationale:**
- The original engine used hardcoded DEFAULT_SCHEDULES with simple range-based checks (e.g., `time >= 6 && time < 19` for daylight). Toggle-based generalization broke exterior light state because transitions wrap around midnight (hour 19→2→5→6) and don't follow a simple on/off toggle pattern.
- Range-based resolution from schedule periods is correct by construction: if time falls within any defined period, lights are on. Outside all periods, lights are off.
- `timeInPeriod(time, startHour, endHour)` handles wrap-around correctly (e.g., `endHour < startHour` means the period crosses midnight).

**Alternatives rejected:**
- **Toggle-based generalization** — rejected because it produces incorrect state when transitions wrap midnight (exterior lights showed ON during daylight, OFF during night).
- **Only support DEFAULT_SCHEDULES** — rejected because scenes with user-configured time schedules would produce wrong temporal profiles.
- **Require all schedule types** — rejected because partial schedules (e.g., only occupancy configured) should still work, with defaults filling the gaps.

### D-049: Camera wall ships as adaptive multi-Canvas feeds, not a single shared `<View>` viewport
**Date:** 2026-05-27

**Decision:** The current camera wall implementation uses separate live `Canvas` feeds for each visible camera plus an overview slot, with adaptive ordering (selected-first, then active cameras) and a 1-6 layout. We are not forcing the single-Canvas `<View>`/scissor pattern yet, and we are not converting the wall to RTT preemptively.

**Rationale:**
- The shipped wall is easier to reason about because each feed owns its own HUD, status state, and camera lock.
- The adaptive layout matches the current scene sizes better than a fixed 4-up grid.
- This keeps the implementation aligned with the verified `camera_view` full-canvas shell and avoids inventing a parallel shared-viewport system before performance demands it.

**Alternatives rejected:**
- **Force a single-Canvas `<View>` stack now** — rejected because the implementation would be more complex than the current need and would not improve correctness today.
- **Lock the wall to 4 views** — rejected because the current product state already needs to handle 1-6 cameras cleanly.
- **Switch to render-to-texture immediately** — rejected because there is no verified performance need yet.

### D-050: SceneBuilderWizard wired as modal overlay from TopBar "New Scene" button
**Date:** 2026-05-27

**Decision:** The SceneBuilderWizard (560 lines, previously dead code) is wired as a modal overlay triggered by the "New Scene..." button in the TopBar scene dropdown. The wizard provides three creation paths: blank canvas, template selection (5 templates), and floor plan import.

**Rationale:**
- The wizard was fully built but never imported by any component — pure dead code. Wiring it required only adding the import, a state flag, and a modal container in TopBar.
- The "New Blank Scene" button was replaced because the wizard subsumes it (blank canvas is step 1 of the wizard).
- Scene name is now dynamic (`scene.name || "Untitled Scene"`) instead of hardcoded "Small Retail Shop Demo".

**Alternatives rejected:**
- **Keep "New Blank Scene" and add separate template picker** — rejected because the wizard already provides both flows in a cohesive UX.
- **Route wizard to a new page/route** — rejected because a modal overlay is simpler and keeps the user in context.
- **Rewrite the wizard from scratch** — rejected because the existing implementation is complete, tested (templates have test coverage), and follows codebase conventions.

### D-051: Studio docks should be full-width shells with collapsible subpanels, not fixed-width inner islands
**Date:** 2026-05-27

**Decision:** The Studio left and right docks now use full-width flex shells, and the contextual right dock is split into its own toggled subpanels for selection inspector, assumptions, and scenario/path. The left dock now exposes section-level collapse controls for tools, layers, and minimap instead of wasting width on a fixed-width inner wrapper.

**Rationale:**
- The previous shell used fixed-width inner panels (`w-[186px]`, `w-[304px]`) inside wider dock shells, which created dead space and made the collapse affordance feel like it was stealing canvas width rather than giving it back.
- Section-level toggles match the product discussion better: users think in terms of tools, layers, minimap, selection inspector, assumptions, and path utilities, not one monolithic sidebar.
- The new structure preserves the canvas-first layout while making each utility panel independently hideable.

**Alternatives rejected:**
- **Keep the fixed-width inner panels and only tweak spacing** — rejected because it still wastes width and keeps the dock behavior conceptually wrong.
- **Collapse everything into one global toggle** — rejected because it removes context and makes the panel system less discoverable.
- **Move immediately to free-floating draggable panels** — rejected because the current need is controlled collapse and context awareness, not a full docking framework.

### D-052: Path replay should show collision-proofed samples, camera cones, and tile-floor coverage
**Date:** 2026-05-27

**Decision:** Path replay now visualizes the route using legalized replay samples, draws camera frustums in the replay canvas, and renders a tiled floor coverage surface so route failures are legible instead of implied.

**Rationale:**
- The replay actor must not visually walk through dense obstructions such as counters without the UI explicitly saying the route was corrected.
- Camera cones are the fastest way to explain "how did it breach?" because they show the line-of-sight envelope in the same view as the actor.
- A tiled floor makes the security map read as a live analytical surface, not a plain empty room with a few colored overlays.

**Alternatives rejected:**
- **Leave replay as a raw interpolation over authored points** — rejected because it hides obvious legality/collision problems.
- **Show only text explanations without scene proof** — rejected because the value of replay is visual trust, not a note in the corner.
- **Treat the floor as plain geometry and rely only on heatmap cells** — rejected because uncovered space still needs to feel like part of the security model.

### D-053: Root route now starts with scene launcher, and floor-plan imports materialize editable geometry
**Date:** 2026-05-27

**Decision:** `apps/studio/src/app/page.tsx` now renders a launcher before Studio (`Create or Import Scene`, `Open Current Workspace`, JSON import), and floor-plan wizard creation now calls `createSceneFromFloorPlan(...)` to produce a real editable scene skeleton (walls/doors/windows + dimensions) instead of reusing retail demo geometry.

**Rationale:**
- `goal2.md` explicitly required a visible create/import entry point and a pre-Studio launcher flow.
- Booting directly into `StudioShell` obscured product scope and made first-run scene setup non-discoverable.
- Floor-plan import previously changed only scene name/dimensions on top of a demo scene, which was misleading and broke trust in import behavior.

**Alternatives rejected:**
- **Keep direct Studio boot and rely on TopBar menus only** — rejected because first-touch discoverability remained poor.
- **Delay launcher until project backend exists** — rejected because the product shell can be fixed now without backend dependencies.
- **Treat floor-plan import as dimension-only metadata** — rejected because users expect imported geometry to become editable walls/doors/windows immediately.

### D-054: Floor-plan review must support manual calibration before scene creation
**Date:** 2026-05-27

**Decision:** The floor-plan review UI now supports explicit width/depth/height calibration and recalculates `scalePixelsPerMeter` through `recalibrateFloorPlanResult(...)` before converting to scene geometry.

**Rationale:**
- `goal2.md` requires a product-real floor-plan upload path with review and scale confirmation.
- Heuristic extraction alone is insufficient; users need a direct way to apply known real-world dimensions before creating the scene.
- Keeping geometry in pixel-space and updating scale/dimensions avoids lossy rewrites and keeps the conversion deterministic.

**Alternatives rejected:**
- **Auto-detection only** — rejected because confidence varies across plans and users need correction controls.
- **Hidden numeric scale setting only** — rejected because width/depth/height is easier for field users than raw px/m.
- **Full CAD editing before conversion** — rejected for now as it over-expands scope versus immediate goal2 requirements.

### D-055: AI layout draft should output editable SecurityScene JSON from launcher prompts
**Date:** 2026-05-27

**Decision:** Added an `AI Layout Draft` launcher action that converts a text prompt into an editable `SecurityScene` (template + dimensions inference) rather than producing a static image or off-canvas text output.

**Rationale:**
- `goal2.md` explicitly asks for prompt-based layout draft output as `SecurityScene` JSON.
- Keeping output as scene data preserves the product loop: edit -> simulate -> compare -> report.
- A template-backed heuristic draft is sufficient as an initial bootstrap while model-backed semantic layout quality matures.

**Alternatives rejected:**
- **Image-only generation** — rejected because it cannot directly feed simulation and editing.
- **Delay until full agentic layout planner is built** — rejected because goal2 requires immediate prompt-to-scene capability.
- **Hardcode a single template output** — rejected because prompt keyword routing (retail/office/warehouse/classroom/residential) provides better first-pass relevance.

### D-056: Camera wall POV must follow live camera edits, not mount-once initialization
**Date:** 2026-05-27

**Decision:** `CameraRigFixed` was changed to recompute position/look target whenever camera transform inputs change (`id`, `position`, `yawDeg`, `pitchDeg`) instead of running only once behind an initialization guard.

**Rationale:**
- `goal2.md` requires camera view/wall to react correctly to camera edits.
- A mount-only rig can display stale POVs after in-studio camera moves/rotations, reducing trust in simulation review.
- Re-synchronizing on transform changes keeps wall feeds aligned with current scene state.

**Alternatives rejected:**
- **Keep one-time initialization for stability** — rejected because it preserves stale camera views after edits.
- **Force remount per tile key churn** — rejected because direct dependency-based sync is clearer and less brittle.

### D-057: Floor-plan review should allow false-positive pruning before scene creation
**Date:** 2026-05-27

**Decision:** Added detection correction controls in `ImportReview` to selectively keep/remove detected walls, doors, and windows, then apply corrected geometry back into the wizard state before creating the scene.

**Rationale:**
- `goal2.md` requires a real floor-plan upload + review loop, not just passive metrics.
- Heuristic extraction frequently over-detects segments; users need direct pruning controls to avoid importing noisy geometry.
- Applying corrections at `FloorPlanResult` level keeps downstream scene conversion deterministic and testable.

**Alternatives rejected:**
- **Show detections read-only** — rejected because it blocks user correction of obvious false positives.
- **Only recalibrate dimensions without geometry edits** — rejected because scale fixes do not remove noisy walls/openings.
- **Delay correction controls until full CAD editor** — rejected because goal2 needs immediate practical review flow.

### D-058: AI layout draft should use structured model output with deterministic fallback
**Date:** 2026-05-27

**Decision:** `AI Layout Draft` now attempts structured model generation (`templateId`, dimensions, scene name, assumptions) when `NEXT_PUBLIC_OPENAI_API_KEY` is available, and automatically falls back to deterministic local drafting if unavailable/failing.

**Rationale:**
- `goal2.md` requires prompt-to-`SecurityScene` output; model-backed parsing improves intent matching over pure keyword heuristics.
- Fallback is required to keep the feature functional in offline/no-key development and tests.
- Structured schema output keeps scene creation safe and predictable.

**Alternatives rejected:**
- **Heuristic-only drafting** — rejected as insufficient for full P3 expectations.
- **Model-only with hard failure on missing key** — rejected because it breaks local usability and CI stability.
- **Unstructured model text parsing** — rejected due fragility compared to schema-validated output.

### D-059: AI draft should enrich generated scenes with key prompt intent hints
**Date:** 2026-05-27

**Decision:** Added deterministic post-generation enrichment that maps prompt cues into scene entities: requested camera count, shelf/counter hints, and back-storage critical zone hints.

**Rationale:**
- `goal2.md` P3 expectation is not just “any JSON,” but useful prompt-to-scene behavior aligned to user intent.
- Template selection + dimensions alone often misses requested operational details (e.g., “two shelves”).
- Post-generation enrichment preserves schema safety while improving practical fidelity.

**Alternatives rejected:**
- **Trust template defaults only** — rejected because it ignores explicit user constraints.
- **Full free-form geometry synthesis immediately** — rejected as too brittle for this stage without stronger planner/validator loops.
- **Model-only placement without deterministic guardrails** — rejected because fallback consistency and testability are required.

### D-060: Launcher should expose explicit 5-step product workflow, not only feature cards
**Date:** 2026-05-27

**Decision:** Added a guided 5-step workflow section in the launcher with direct action buttons into assumptions, scene wizard, map builder, baseline simulation, and replay/night/report actions.

**Rationale:**
- `goal2.md` explicitly defines a 5-step user flow to reduce “only a testbed” confusion.
- Feature cards alone communicate capabilities, but not operational sequence.
- Direct action handoffs keep the onboarding flow executable instead of purely instructional.

**Alternatives rejected:**
- **Keep flow only in docs/README** — rejected because users need this guidance in product UI.
- **Add separate onboarding route later** — rejected because launcher can deliver immediate product-shell clarity.

### D-061: Guided step-5 actions should execute failure/counterfactual flows directly
**Date:** 2026-05-27

**Decision:** Extended launcher step-5 actions to include direct `Failure` (toggle an active camera off + open Issues) and `Cheapest Fix` (run obstruction counterfactual + open Counterfactual tab) controls.

**Rationale:**
- `goal2` flow calls for actionable “next action” operations, not just navigation links.
- Fast-path controls let users experience core value (failure impact + fix deltas) without hunting through panels first.

**Alternatives rejected:**
- **Only navigate to tabs without executing actions** — rejected because it adds friction and weakens first-run clarity.
- **Delay to command-bar-only interaction** — rejected because launcher is now the primary guided shell.

### D-062: Camera View should surface per-camera replay visibility status
**Date:** 2026-05-27

**Decision:** Added a per-camera path visibility overlay in Camera View showing visibility percentage, quality ceiling, and status tier (strong/partial/weak) from `pathResults.visibilityByCamera`.

**Rationale:**
- Demo/design flow expects camera POV to communicate operational replay quality directly.
- This closes a UX gap between timeline data and what users see in single-camera mode.

**Alternatives rejected:**
- **Keep visibility only in timeline tab** — rejected because users in camera mode lose route outcome context.
- **Show only raw seconds** — rejected because percentage+status communicates risk faster.

### D-058: Guided scan intake should be a dedicated manual-assisted launch path that compiles into `scan_import`
**Date:** 2026-05-27

**Decision:** Added a dedicated `Scan a Site` intake flow in the launcher and TopBar that accepts a site photo, lets the user manually place and classify scan candidates, and compiles the result into a canonical `scan_import` `SecurityScene` through shared scene-skeleton helpers.

**Rationale:**
- The scan-first experience needs to be visible as its own product mode, not hidden inside floor-plan import or a generic scene wizard.
- Manual-assisted scan is useful now and honest about current capability; the UI explicitly says AI perception is not wired yet.
- Compiling into the same `SecurityScene` path preserves the simulation/edit/replay/report loop and avoids a parallel scene representation.

**Alternatives rejected:**
- **Fold scan-first into the floor-plan importer** — rejected because floor plans and site-photo intake are different user intents and require different review UX.
- **Create a separate scan scene model** — rejected because it would fragment the product around multiple truth sources.
- **Delay scan intake until AI segmentation is available** — rejected because the user asked for an end-to-end product flow now, and the manual-assisted path is already valuable without AI.
