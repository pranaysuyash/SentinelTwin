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

---

## D-101 | 2026-05-28 | Camera inspector View tab should lead with explicit mode and target information

**Decision:** In the camera inspector, the View tab should surface a dedicated View Mode card and
Target Info card before the live feed, while keeping the DORI overlay summary and view toggles
wired to the same underlying feed state.

**Rationale:**
- The reference product treats mode selection and target context as first-class inspector controls,
  not as hidden footer chrome below the preview
- Surfacing the mode and target blocks first makes the inspector easier to scan and keeps the live
  feed from feeling like a static preview with a few toggle buttons attached
- The live feed still remains the source of truth for overlays; this decision is purely about
  information hierarchy and discoverability

**Alternatives rejected:**
- Keep view mode controls only below the feed: too easy to miss and weaker screenshot parity
- Merge target info into the DORI summary: collapses two distinct mental models into one block

---

## D-102 | 2026-05-29 | Novel algorithms panel should act as a navigation hub, not a read-only stats wall

**Decision:** The `NovelAlgorithmsTab` should expose direct jump actions for the strongest placement candidate, the largest blind region, the active path replay, and the 24-hour temporal profile.

**Rationale:**
- The panel already computes actionable analysis outputs, so keeping it read-only forces the operator to manually translate findings into map/replay navigation
- Reusing the existing store actions (`setViewMode`, `setBottomTab`, `setFocusScenePointRequest`, path replay controls) keeps the feature additive and avoids a separate navigation system
- The navigator strip makes the experimental algorithms useful in the same turn they are computed instead of relegating them to diagnostics-only output

**Alternatives rejected:**
- Keep the panel informational only: slower workflow and weaker product value
- Add a new navigation subsystem: unnecessary duplication because the store already has the right actions

## D-102 | 2026-05-28 | Local-only mode should hard-disable cloud-backed AI flows

**Decision:** SentinelTwin Studio exposes a persistent `Local Only Mode` toggle in View Settings. When enabled, cloud-backed AI parsing, fix proposals, counterfactuals, and report generation are disabled by policy even if a provider key is configured.

**Rationale:**
- The product serves security users who may not be able to upload site layouts or camera placements to a cloud provider
- A visible policy toggle is clearer than relying on the absence of an API key to imply privacy
- The local/offline helper paths already exist for common scene edits, so the boundary can be enforced without disabling core editing
- Keeping the policy in the shell and AI surfaces makes the constraint obvious at the point of use

**Alternatives rejected:**
- Hide the behavior behind provider selection only: too ambiguous and too easy to overlook
- Force all AI features off globally: too restrictive for users who can safely opt into cloud-backed assistance
- Not a hackathon compromise. This is the correct engineering sequence regardless of timeline.

**Alternative rejected — start with Pascal fork:**
- Forces understanding of Pascal's internals before we understand our own requirements
- Any mismatch between Pascal's architecture and our simulation needs requires retrofitting
- We may discover we need things Pascal does not support, or don't need things it provides

---

## D-102 | 2026-05-28 | Assumptions panel should surface a concise model summary before the detailed editor

**Decision:** The right-rail assumptions surface should start with a compact summary of the core model inputs
(DORI model, person height, grid resolution, lighting) and then provide the full editable assumptions form
below or in the bottom drawer.

**Rationale:**
- The reference security cockpit exposes assumptions as a quick-review summary, not only as a hidden editing form
- The user needs to know the model posture at a glance before diving into detailed thresholds
- Keeping the compact summary in the right rail preserves the full editor without making the shell feel heavy

**Alternatives rejected:**
- Keep the assumptions UI as a pure form: too utilitarian and too easy to miss in the right rail
- Move all assumptions to the bottom drawer: hides the key model posture from the main workspace

---

## D-103 | 2026-05-28 | Scenario/path panel should prioritize scenario summary over raw path controls

**Decision:** The scenario/path panel should present the active scenario as a summary card first,
with actor, intent, speed, path length, estimated time, route legend, and timeline link visible
before the lower edit/play controls.

**Rationale:**
- The reference screenshot is a scenario briefing surface, not just a path editor
- Making the scenario summary the primary structure helps the lower edit/play actions read as
  task actions instead of the whole purpose of the panel
- This keeps the active-path selector, replay link, and route metrics visible without forcing the
  user to parse a dense control stack

**Alternatives rejected:**
- Keep the panel as a path control strip: too flat and less aligned with the cockpit reference
- Move the timeline link lower than the stats: hurts discoverability for replay analysis

---

## D-104 | 2026-05-28 | Security Status rail should keep assumptions visible in compact mode

**Decision:** The compact Security Status right rail should render the assumption disclosure alongside the outcome summary and top issues instead of hiding assumptions behind a separate rail mode.

**Rationale:**
- The reference security cockpit keeps the model posture visible inside the status rail
- Compact mode should still communicate the planning assumptions that govern the numbers shown above it
- This keeps the default rail useful without forcing operators to switch modes just to understand the current model inputs

**Alternatives rejected:**
- Keep assumptions only in the dedicated assumptions rail: too hidden for the default security view
- Remove the disclosure entirely in compact mode: would reduce trust in the reported outcome

---

## D-105 | 2026-05-28 | Keep the studio editor camera-first while reserving a sensor schema boundary

**Decision:** Add a canonical `sensors` array to `SecurityScene` and surface its count in report/header summaries, but keep the current editor tools and simulation workflow camera-first until the multi-sensor design is explicitly scoped.

**Rationale:**
- The product is still camera-centered today, but the data model needs a safe extension point so future motion/contact/access-control work does not require a parallel scene format
- A zero-default `sensors` array makes the boundary explicit without forcing the editor to invent new sensor editing affordances before the product direction is settled
- Surfacing the sensor count in reports keeps the handoff honest about what the scene model currently contains, even if the UI does not yet expose dedicated sensor tools

**Alternatives rejected:**
- Keep sensors out of the schema entirely: would make later extension more disruptive
- Introduce full sensor editing tools now: too early for the current camera-first product scope

## D-106 | 2026-05-28 | Security outcomes should surface a dedicated privacy review section

**Decision:** Add an explicit privacy review section to the security outcome/report surfaces so privacy zones, restricted cells, and privacy-specific issues are visible instead of only being implicit in the generic issue list.

**Rationale:**
- Privacy zones are already part of the canonical scene model and simulation output
- If privacy is modeled, it should be reported in a dedicated review section, not hidden among unrelated issues
- Surfacing privacy separately better supports trust, compliance review, and explanation of why the simulation flags certain areas

**Alternatives rejected:**
- Leave privacy only in the generic issue list: too easy to miss and too weak for compliance-oriented review
- Put privacy only in the debug tab: would make an important modeled concept effectively invisible to users

---

## D-107 | 2026-05-29 | Provenance tab should expose a visible evidence ledger

**Decision:** Extend `SceneIntelligenceTab` with a concrete evidence ledger built from recent snapshots and scene change-log entries, so provenance reads like temporal operational history instead of only a node/edge graph.

**Rationale:**
- The product needs a visible answer to "what changed, when, and what evidence was saved?" without inventing a separate history system
- The store already has snapshots and change-log strings, so the tab can expose real temporal evidence immediately
- This creates a stronger bridge toward the full temporal operational twin without waiting for a new backend ledger architecture

**Alternatives rejected:**
- Keep provenance as graph-only: too static and less useful for operational review
- Build a separate event-sourcing system before surfacing anything: too heavy for the current state of the product

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
| D-023 | Local-first vs server-side compute? | Local-only mode is implemented in the studio shell; see D-102. Remaining deployment strategy questions are about cloud-backed opt-in, not whether the app can run with local-only policy. |
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

### D-063: Guided launcher CTAs should be outcome-first and state-aware
**Date:** 2026-05-27

**Decision:** Updated launcher 5-step copy and CTA labels to emphasize outcomes (assumptions, baseline check, stress, hardening, export), and disabled `Failure Drill` / `Test Cheapest Fix` when their prerequisites are missing.

**Rationale:**
- Docs/design flow called for an actionable sequence, not generic navigation text.
- Outcome-focused wording improves first-run clarity for operators/auditors.
- Disabled-state guardrails prevent dead-clicks and explain what must be configured first.

**Alternatives rejected:**
- **Keep generic labels** — rejected because they under-explain intent.
- **Allow all actions regardless of scene state** — rejected because it creates avoidable user confusion.

### D-064: Camera Wall should expose per-camera route visibility status
**Date:** 2026-05-27

**Decision:** Camera wall live-feed overlays now display per-camera route visibility percentage and quality-tier labels (strong/partial/weak), plus route-context badge in the wall header.

**Rationale:**
- The demo/context docs emphasize route viability as a primary outcome signal.
- Showing this per tile makes the wall actionable without switching views for each camera.

**Alternatives rejected:**
- **Keep route context only at wall-header level** — rejected because tile-level variation is hidden.
- **Display only quality without visibility ratio** — rejected because the time-visible dimension is core to route analysis.

### D-058: Guided scan intake should be a dedicated manual-assisted launch path that compiles into `scan`
**Date:** 2026-05-27

**Decision:** Added a dedicated `Scan a Site` intake flow in the launcher and TopBar that accepts site photos, lets the user manually place and classify scan candidates, and compiles the result into a canonical `scan` `SecurityScene` through shared scene-skeleton helpers.

**Rationale:**
- The scan-first experience needs to be visible as its own product mode, not hidden inside floor-plan import or a generic scene wizard.
- Manual-assisted scan is useful now and honest about current capability; the UI explicitly says AI perception is not wired yet.
- Compiling into the same `SecurityScene` path preserves the simulation/edit/replay/report loop and avoids a parallel scene representation.
- The implemented schema uses `source: "scan"` as the canonical scan import value. Earlier shorthand like `scan_import` was treated as descriptive wording, not a schema enum, so the docs now track the actual source token instead of a non-existent alias.

**Alternatives rejected:**
- **Fold scan-first into the floor-plan importer** — rejected because floor plans and site-photo intake are different user intents and require different review UX.
- **Create a separate scan scene model** — rejected because it would fragment the product around multiple truth sources.
- **Delay scan intake until AI segmentation is available** — rejected because the user asked for an end-to-end product flow now, and the manual-assisted path is already valuable without AI.

### D-065: Compare mode must render selected snapshot geometry for visual truth
**Date:** 2026-05-27

**Decision:** `CompareView` scene panels now render `snapshot.scene` for each selected scenario, rather than always using the current store scene geometry.

**Rationale:**
- Product claim in compare mode is before/after visual truth; using current geometry for both sides can misrepresent scenario deltas.
- Snapshot simulation cells and snapshot geometry must stay aligned in the same panel to maintain operator trust.

**Alternatives rejected:**
- **Keep current-scene geometry + only swap heatmap data** — rejected because it creates visually false comparisons.
- **Hide geometry and show only metrics** — rejected because the core use-case is spatial before/after analysis.

### D-066: Launcher should expose explicit feature maturity labels in-product
**Date:** 2026-05-27

**Decision:** Added a `Product Feature Status` panel on the launcher with `Available`, `Preview`, and `Planned` labels for key capability groups.

**Rationale:**
- Reduces confusion between prototype-ready and production-ready surfaces.
- Keeps docs and UX aligned with honest product framing.
- Helps demo operators avoid claiming unavailable flows as complete.

**Alternatives rejected:**
- **Keep maturity labels only in docs** — rejected because operators need this truth in the running app.
- **Hide planned features completely** — rejected because roadmap visibility is useful when explicitly labeled as planned.

### D-067: Scene intelligence should be a derived provenance graph layered on top of SecurityScene
**Date:** 2026-05-27

**Decision:** Added a derived `sceneIntelligenceGraph` in the studio store and surfaced it as a `PROVENANCE` bottom-panel tab that summarizes scene source lineage, entity counts, revision depth, snapshots, and simulation linkages without introducing a second scene model.

**Rationale:**
- The product needs a visible intelligence spine, not just more input modes, so operators can understand where scene data came from and how simulation validated it.
- Keeping the graph derived from `SecurityScene` preserves the single-source-of-truth rule and avoids parallel representations of the scene.
- Surfacing the graph in-product makes provenance, confidence, and evidence feel like first-class product concepts rather than hidden developer state.

**Alternatives rejected:**
- **Store provenance only in docs** — rejected because the product should make the scene spine visible to users and reviewers.
- **Create a separate graph-backed scene model** — rejected because it would fragment the canonical scene data model.
- **Delay provenance until live AI perception exists** — rejected because the derived graph is already useful with manual, scan, import, and simulation data.

### D-068: Bottom drawer and full-canvas modes should surface current-state evidence, not just raw tab content
**Date:** 2026-05-27

**Decision:** Kept `BottomPanel` as the analysis drawer but made the hidden analysis routes explicit (`counterfactual`, `threat`) and added stronger mode-aware summary surfaces in `ScenarioPathPanel`, `CameraViewMode`, `CameraWallView`, and `PathReplayView` so each mode explains current state, best camera, quality reason, and next action.

**Rationale:**
- The user feedback was not about missing capability, but about visual hierarchy and clarity of evidence.
- Exposing hidden tabs keeps the drawer honest and discoverable without flattening the architecture into one generic dashboard.
- Mode-specific current-state overlays make camera replay, wall, and path analysis read like security-simulation tools rather than generic media panels.

**Alternatives rejected:**
- **Hide the extra analysis routes again** — rejected because the capability already exists and should be discoverable.
- **Merge camera/wall/replay into one universal view** — rejected because each mode has a distinct operator job.
- **Push all “why” data only into the inspector** — rejected because the bottom drawer and full-canvas modes also need immediate context.

### D-069: Camera-wall rendering should prefer low-power demand updates, and command shortcuts should switch workspace state directly
**Date:** 2026-05-27

**Decision:** Switched camera wall and camera feed canvases to demand rendering with reduced device-pixel ratios and low-power WebGL hints, while extending the in-app command bar to drive workspace, privacy-zone, and simulation state directly (`/map`, `/wall`, `/replay`, `/camera-view`, `/compare`, `/privacy`, `/target`, `/simulate`, `/snapshot`).

**Rationale:**
- Camera wall is read-mostly and the previous always-on multi-canvas path was unnecessarily expensive on lower-end devices.
- Workspace and analysis commands should mutate the same canonical store actions as the toolbar, not live in a separate command-specific code path.
- Privacy-zone toggles and target-type changes are part of the simulation truth model, so command shortcuts should hit the same store methods as direct UI actions.

**Alternatives rejected:**
- **Keep the camera wall always-on** — rejected because it wastes GPU on an otherwise static dashboard.
- **Implement command shortcuts as UI-only state** — rejected because the commands need to affect the same simulation/workspace truth as the toolbar.
- **Hide privacy/target controls behind only one surface** — rejected because the operator workflow needs both visible controls and command-driven access.

### D-070: Compare mode should support snapshot-level simulation without mutating current working scene
**Date:** 2026-05-27

**Decision:** Added `simulateSnapshot(snapshotId)` in store and wired `Simulate Scenario B Now` in `CompareView` to recompute and persist simulation on the selected snapshot only.

**Rationale:**
- Before/after workflows need recovery for unsimulated snapshots without forcing users to switch current scene context.
- Snapshot A/B integrity is preserved when simulation is attached directly to snapshot records.

**Alternatives rejected:**
- **Force user to switch scene then run global simulation** — rejected due workflow friction and error risk.
- **Reuse latest simulated snapshot implicitly** — rejected because it can produce misleading A/B comparisons.

### D-071: Floor-plan correction preview should be interactive for openings, not checkbox-only
**Date:** 2026-05-27

**Decision:** Added draggable door/window markers in `ImportReview` spatial preview and apply corrected positions through normalization.

**Rationale:**
- Operators need to correct near-miss detection coordinates, not only exclude entities.
- Lightweight marker dragging closes the biggest practical correction gap without requiring full CAD editing controls.

### D-072: Provenance graph should be interactive, not static
**Date:** 2026-05-28

**Decision:** Upgraded the `PROVENANCE` tab from a static graph summary into an interactive inspection surface with selectable nodes, selectable relations, selected-node trace counts, relation details, and focus controls that jump between source and target nodes.

**Rationale:**
- A visible provenance spine is useful, but the real product value comes when operators can trace a scene element back to its source and forward into simulation evidence without leaving the tab.
- Clickable nodes and relations make the graph a working diagnostic tool instead of a decorative dashboard panel.
- Keeping this inside the derived graph view preserves the single-source-of-truth rule while improving usability.

**Alternatives rejected:**
- **Keep the graph static and add more cards** — rejected because it does not support real trace exploration.
- **Move provenance inspection to a separate page** — rejected because the operator should inspect provenance in the same workflow where they are already reviewing the scene.
- **Delay relation inspection until a future evidence system** — rejected because the graph already contains usable relations and can support trace focus now.

### D-073: Provenance selections should be shareable through deep links
**Date:** 2026-05-28

**Decision:** Added URL-backed `provenanceNode` and `provenanceEdge` selection state to the `PROVENANCE` tab, plus a copyable deep-link action that preserves the current trace selection when sharing the workspace URL.

**Rationale:**
- Shareable trace links let a reviewer reopen the exact provenance state that matters instead of re-navigating the whole graph by hand.
- Persisting selection in the URL keeps provenance inspectable and reproducible without introducing another scene-state store.
- This keeps the provenance experience aligned with the rest of SentinelTwin’s evidence-first workflow.

**Alternatives rejected:**
- **Keep selection local-only** — rejected because the selected trace becomes hard to share and reference.
- **Serialize selection into the report model** — rejected because the trace is a UI-navigation state, not part of the canonical scene data.
- **Create a separate provenance viewer route** — rejected because the current tab already provides the right work surface.

**Alternatives rejected:**
- **Keep list-only include/exclude controls** — rejected because it cannot fix geometry drift.
- **Defer all correction to post-import scene editing** — rejected because import review should produce coherent baseline geometry.

### D-072: Opening snapping must use calibrated scale instead of hardcoded pixels-per-meter
**Date:** 2026-05-27

**Decision:** `snapOpeningsToWalls` now receives runtime `scalePixelsPerMeter` and uses it for opening width clamping.

**Rationale:**
- Hardcoded `50 px/m` breaks after user calibration and causes mis-clamped placements.
- Scale-aware snapping keeps door/window placement coherent across varying import scales.

**Alternatives rejected:**
- **Keep fixed conversion factor** — rejected due calibration drift.
- **Disable clamping entirely** — rejected because it allows off-wall openings.

### D-074: Floor-plan import review must expose structural diagnostics before scene creation
**Date:** 2026-05-28

**Decision:** `apps/studio/src/lib/floor-plan-import.ts` now emits machine-readable floor-plan diagnostics during validation: wall orientation counts, near-duplicate wall pairs, short wall fragments, off-wall door/window markers, and bounds coverage. `ImportReview` surfaces those flags in the detection details panel before the user creates a `SecurityScene`.

**Rationale:**
- Floor-plan import is only trustworthy if users can see why the heuristic extraction may be risky before it becomes canonical scene geometry.
- Diagnostics preserve the single-source-of-truth rule by staying on `FloorPlanResult` validation/review instead of creating a parallel scene model.
- This closes the practical gap between passive warnings and actionable review: duplicate fragments and off-wall openings are exactly the import failures operators can correct with existing prune/drag controls.

**Alternatives rejected:**
- **Rely only on confidence percentage** — rejected because a scalar confidence score does not tell the user what to fix.
- **Push all cleanup into post-import scene editing** — rejected because the baseline imported scene should be coherent before simulation/reporting.
- **Introduce an ML extractor now** — rejected for this slice; deterministic diagnostics harden the existing local-first path and will remain useful even when model-backed extraction arrives.

### D-073: Report-lite should include explicit before/after export mode from snapshots
**Date:** 2026-05-27

**Decision:** Report-lite now supports `Single Scene` and `Before/After` modes, with Snapshot A/B selectors and compare HTML export using `buildCompareReportData` and `exportCompareAsHtml`.

**Rationale:**
- Evidence export needs direct comparison artifacts, not only current-scene summaries.
- Reusing canonical compare report engine avoids duplicate logic and drift.

**Alternatives rejected:**
- **Keep compare export only in Compare JSON utility** — rejected because operators need report-grade artifacts.
- **Build a second compare export pipeline inside ReportLiteTab** — rejected due duplication risk.

### D-074: Compare export should prefer captured live-canvas evidence when available
**Date:** 2026-05-27

**Decision:** Added `Capture Visual Evidence` in `CompareView`, persisted captured A/B canvas data URLs in store with snapshot IDs, and wired `ReportLiteTab` compare export to embed those captures when IDs match.

**Rationale:**
- Report evidence quality improves when it reflects actual rendered compare panels, not only synthetic summary graphics.
- Snapshot-ID matching prevents accidental reuse of stale visuals after selection changes.

**Alternatives rejected:**
- **Always regenerate synthetic compare graphics only** — rejected due weaker evidence fidelity.
- **Capture visuals only during report export** — rejected because report tab may not have compare canvases mounted.

### D-075: Root launcher should be a studio dashboard home, not a centered setup card
**Date:** 2026-05-27

**Decision:** `apps/studio/src/app/page.tsx` now renders a full-screen `StudioDashboardHome` launch surface when not booted into `StudioShell`. The home screen centers the current workspace preview, current risk summary, operational mode links, recent workspaces, and quick-start actions.

**Rationale:**
- The root page is the product front door, so it must feel like the studio already exists rather than a form the user must complete before seeing the workspace.
- A dashboard launch surface preserves the existing wizards/import/AI flows while making coverage, replay, compare, and report feel immediate.
- The root should mirror the Studio shell language instead of presenting a centered onboarding card that implies setup is the primary job.

**Alternatives rejected:**
- **Keep the centered launcher card** — rejected because it reads like a checklist/form and undercuts the product.
- **Turn root into marketing landing page** — rejected because this is a working workspace, not a public brochure.
- **Split launch actions into a separate route** — rejected because the root should be the single, obvious entry point into the current workspace.

### D-076: Footage verification ships as explicitly non-forensic operator assist in V0.1
**Date:** 2026-05-27

**Decision:** Implemented first-cut footage verification in Camera View as an operator-assist surface only: reference frame upload, overlay/split comparison, opacity and alignment controls, plus explicit planning-only/non-forensic disclaimer copy.

**Rationale:**
- Real-world validation needs a practical bridge between simulated view and observed footage, but current simulation assumptions are still heuristic.
- Explicitly defensive language prevents overclaiming while enabling useful alignment and discrepancy inspection.

**Alternatives rejected:**
- **Delay all footage verification until full product version** — rejected because operators need immediate mismatch inspection capability.
- **Ship verification without disclaimer framing** — rejected due trust and safety risk around forensic overinterpretation.

### D-077: Manual scan correction must allow spatial repositioning before compile
**Date:** 2026-05-27

**Decision:** Extended `ScanSiteWizard` with interactive candidate correction: drag marker repositioning, arrow-key nudging, quick geometry sanity checks, and low-confidence compile override confirmation.

**Rationale:**
- Manual-assisted scan intake is only credible if users can correct geometry directly before scene compile.
- Confidence-aware compile gating keeps uncertainty explicit without blocking expert operators from proceeding intentionally.

**Alternatives rejected:**
- **List-only relabel/reject flow** — rejected because it cannot correct spatial drift.
- **Hard-block compile on all low-confidence inputs** — rejected because manual workflows need operator override.

### D-078: Footage verification should surface quantitative mismatch and visual-diff assist together
**Date:** 2026-05-27

**Decision:** Extended Camera View verification with a local downsampled mismatch score (`Alignment Quality`, 0-100 with Excellent/Good/Fair/Poor labels) and an optional difference heat overlay.

**Rationale:**
- Operators need more than visual intuition when comparing simulated feed vs reference frame.
- A bounded local metric and heat layer improve operator guidance while preserving the current defensive, non-forensic product framing.

**Alternatives rejected:**
- **Overlay-only comparison without metrics** — rejected because it does not quantify drift.
- **Server-side CV verification at this stage** — rejected due scope and architecture sequencing; local assist is sufficient for current phase.

### D-079: Scan reconstruction correction should include explicit structural auto-fix actions
**Date:** 2026-05-27

**Decision:** Added explicit review-step structural auto-fix actions in `ScanSiteWizard`: merge near-duplicate same-type candidates, snap door/window candidates toward nearest wall, and show diagnostics for duplicate groups/opening-wall proximity/pending candidates.

**Rationale:**
- Manual correction alone is slow and inconsistent when candidate density rises.
- Explicit, reversible auto-fix actions preserve operator control while accelerating structurally coherent scene preparation.

**Alternatives rejected:**
- **Keep correction fully manual** — rejected for operator throughput and inconsistency.
- **Apply hidden automatic corrections during compile** — rejected due trust and auditability concerns.

### D-078: Novel algorithms must ship through the canonical simulation/report spine, not a sidecar panel
**Date:** 2026-05-27

**Decision:** Wired Coverage Fragility Field, K-Robustness, Placement Oracle, Occlusion Blame Attribution, and Temporal Anomaly Detection into `simulate-studio.ts`, surfaced them in the `NOVEL ALGORITHMS` panel, and mirrored the same derived summaries into both the live report tab and canonical report export module.

**Rationale:**
- Novel analytics are only useful long-term if they flow through the same deterministic scene/result pipeline as the rest of SentinelTwin.
- Keeping the report exporter aligned with the dashboard drawer prevents the common drift where a “proof” panel and an “export” panel quietly diverge.

**Alternatives rejected:**
- **Leave the novel analytics as a dashboard-only experiment** — rejected because it would never become part of the product spine.
- **Build a separate export path just for novel metrics** — rejected because it creates duplicate summary logic and increases drift risk.

### D-080: Studio Home should expose a lightweight View Settings surface, not a full window manager
**Date:** 2026-05-28

**Decision:** Added a lightweight `View Settings` modal to the Studio shell that unifies the most important workspace controls: main view, canvas mode, scene layers, dock visibility, workspace presets, and saved layouts. The homepage now also auto-runs the demo simulation on first load and seeds demo workspaces/layouts when local storage is empty.

**Rationale:**
- The attached design and product feedback call for a clear way to show or hide major workspace pieces without forcing users into a desktop-style layout editor.
- The repo already had the building blocks scattered across presets, dock state, layer toggles, and view modes; the new modal makes that structure discoverable without inventing a second UI model.
- Auto-running the demo scene avoids the misleading empty-state problem where the dashboard says `Simulation pending` even though the built demo scene is available.

**Alternatives rejected:**
- **Build a full draggable window manager now** — rejected as too heavy for the current product stage and unnecessary for the immediate homepage gap.
- **Keep layout controls scattered across dock headers and side panels** — rejected because users need one place to reason about what is visible and why.
- **Leave the demo scene manual-only on first load** — rejected because it makes the default homepage feel like a launcher instead of a living security workspace.

### D-081: Homepage should foreground real scene work alongside the demo baseline
**Date:** 2026-05-28

**Decision:** Rebalanced the Studio homepage so `New Blank Scene`, `Import SecurityScene JSON`, `Scan a Site`, and `AI Layout Draft` are surfaced as a dedicated `Scene Work` entry point, instead of leaving them as secondary or footer-only actions beneath the demo preview.

**Rationale:**
- The demo scene should stay as the canonical reference baseline, but it cannot be the perceived end state of the product.
- Users need an immediate path to actual site work: blank scenes, imported scenes, and scan-assisted reconstruction.
- The product story is stronger when the homepage says "here is the demo baseline, and here is how you move into your own site work" rather than treating real scenes as an afterthought.

**Alternatives rejected:**
- **Leave real scene creation in the lower quick-start area only** — rejected because it makes the demo appear more important than actual user work.
- **Remove the demo entirely from the homepage** — rejected because the demo remains the best trust-building baseline and should remain visible.

### D-082: Homepage should separate user workspaces from reference demos
**Date:** 2026-05-28

**Decision:** Reworked the launcher project browser into two explicit groups: `Your Workspaces` for user-created/imported/scanned scenes, and `Reference Demo` for the canonical retail baseline.

**Rationale:**
- This makes the product story honest: demo scenes are reference material, not the center of gravity.
- Users need a visible mental model for where their own work will appear once they create or import it.
- Separating the two groups avoids the impression that the demo scene is the only meaningful workspace in the app.

**Alternatives rejected:**
- **Keep demo and user projects mixed in one list** — rejected because it blurs the product boundary the user explicitly called out.
- **Hide demo scenes entirely** — rejected because the demo remains valuable as a trust-building baseline and regression reference.

### D-083: Homepage should promote scene creation/import/scan as a primary call to action
**Date:** 2026-05-28

**Decision:** Added a prominent `Start a Scene` strip in the center column of the launcher so `New Blank Scene`, `Import SecurityScene JSON`, `Scan a Site`, and `AI Layout Draft` are visible as first-class actions alongside the workspace preview.

**Rationale:**
- The app must encourage actual scene work, not just demo browsing.
- The center column is the most attention-rich area of the homepage, so it should lead with user-created scene entry points.
- This better matches the intended product story: the demo is a trust-building baseline, but the user’s own scene is the real destination.

**Alternatives rejected:**
- **Keep real scene creation only in the left rail or footer** — rejected because it remains too easy to miss.
- **Remove the demo preview entirely** — rejected because the demo still provides a useful reference and validation target.

### D-083: Workspace layout manager should own view composition
**Date:** 2026-05-28

**Decision:** Treated the View Settings surface as the canonical workspace composition layer for Studio. The store now owns the full layout snapshot: view mode, workspace preset, canvas mode, dock collapse state, component visibility, analysis module visibility, right-panel mode, bottom drawer mode, pinned module, and custom layout persistence.

**Rationale:**
- The product already had strong subsystems, but they were spread across multiple chrome elements and hidden in separate controls.
- A single layout manager gives users one place to decide what they are seeing, which makes the workspace legible for editing, coverage review, replay, report generation, and client demos.
- Persisting custom layouts separately from scenes keeps the "what is the site?" model distinct from the "how should I inspect it?" model.

**Alternatives rejected:**
- **Keep all layout controls distributed across shell components** — rejected because it preserves the current discoverability problem.
- **Fold layout state into scene metadata** — rejected because scene content and UI composition have different lifecycles and should not drift together.
- **Treat report/client-demo modes as separate apps** — rejected because they are just workspace compositions over the same scene and simulation data.

### D-084: Homepage should use visual scene starter cards instead of plain action buttons
**Date:** 2026-05-28

**Decision:** Converted the `Start a Scene` callout into a `Scene Starter Gallery` of visual cards, so blank/import/scan/AI scene paths look like real primary workflows instead of utility actions.

**Rationale:**
- The homepage needed a stronger visual cue that actual scene work is first-class.
- Cards communicate distinct workflows better than a flat button list, which reduces the risk that users interpret scene creation as a secondary launcher task.
- This preserves the demo baseline while making the real scene path feel like the intended next step.

**Alternatives rejected:**
- **Keep the scene entry points as a button cluster** — rejected because the UI still read like a toolbar instead of a product path.
- **Move the scene entry points only into the side rail** — rejected because the center column is the strongest attention surface on the page.

### D-085: Homepage should treat "Your Workspaces" as a workspace hub, not just a saved-scene list
**Date:** 2026-05-28

**Decision:** Added starter tiles inside the `Your Workspaces` region itself, so the section offers blank/import/scan/AI workspace entry points even before the user has any saved projects.

**Rationale:**
- A workspace hub should show where to start, not only what already exists.
- This reduces the empty-state problem and keeps the demo from feeling like the only meaningful option.
- Repeating the starter affordances in the workspace region makes the user's own scene journey much more obvious.

**Alternatives rejected:**
- **Keep `Your Workspaces` as a passive list only** — rejected because new users would still have to infer how to begin real work.
- **Move starter tiles somewhere else entirely** — rejected because the workspace section is where users naturally expect to find their own scenes and starting points.

### D-086: Saved workspace cards should include thumbnail previews
**Date:** 2026-05-28

**Decision:** Added compact scene thumbnails to the `Your Workspaces` and `Reference Demo` cards so the homepage visually communicates real site layouts instead of relying on text and badges alone.

**Rationale:**
- Scene thumbnails make the workspace hub feel like a gallery of real projects.
- Visual previews help users distinguish their own sites from the demo baseline at a glance.
- Thumbnails reinforce that the app is about editable site scenes, not just launcher metadata.

**Alternatives rejected:**
- **Keep workspace cards text-only** — rejected because that still reads like a list rather than a workspace gallery.
- **Replace the full preview panel with thumbnails** — rejected because the larger workspace preview remains useful as the focal context area.

### D-087: Scene starter cards should carry origin badges
**Date:** 2026-05-28

**Decision:** Added origin badges to the scene starter cards and workspace seed tiles (`Blank`, `Import`, `Scan`, `AI`) so the homepage distinguishes entry paths immediately instead of relying on title text alone.

**Rationale:**
- The user asked for real scene work to be visible, and visual differentiation is part of making that feel first-class.
- Origin badges help users map each action to the kind of workspace they are about to create.
- This makes the launcher feel more like a project hub with distinct workflows rather than a generic action menu.

**Alternatives rejected:**
- **Use only card titles for differentiation** — rejected because titles are too subtle once the page is scanned quickly.
- **Use color alone with no labels** — rejected because labels remain necessary for accessibility and clarity.

### D-088: Selected workspace panel should reuse the same origin labels as the cards
**Date:** 2026-05-28

**Decision:** Added the same origin badge treatment to the selected workspace details panel so the demo/user workspace distinction stays consistent across the launcher.

**Rationale:**
- The launcher should tell one coherent story across the card grid and the detail panel.
- If the selected workspace panel used different language, the demo/reference distinction would be easy to miss.
- Reusing the same labels reduces cognitive load and keeps the homepage honest about what is a reference demo versus a user's own workspace.

**Alternatives rejected:**
- **Leave the detail panel unlabeled** — rejected because the selected workspace is the moment users actually inspect a scene and should not lose origin clarity.
- **Invent a different label system for the detail panel** — rejected because that would make the homepage inconsistent and harder to scan.

### D-089: Seed the demo scene with an initial simulation result on boot
**Date:** 2026-05-28

**Decision:** Seed the canonical demo scene with its simulation result during store initialization so the default homepage can show truthy coverage and last-run state on first paint instead of a pending placeholder.

**Rationale:**
- The homepage is the first product impression, so the baseline demo should behave like a real analyzed workspace immediately.
- Seeding the simulation avoids an unnecessary pending state before hydration while preserving the normal dirty/recompute flow after edits.
- The demo still remains a baseline, but now it is a truthful baseline rather than a blank shell.

**Alternatives rejected:**
- **Keep the first paint pending and rely on client-side recompute** — rejected because that preserves the exact demo-first rough edge we want to remove.
- **Remove the demo entirely from first load** — rejected because the demo remains important as a reference baseline and onboarding anchor.

### D-090: Seed one manual draft workspace alongside the reference demos
**Date:** 2026-05-28

**Decision:** Seed the default project list with a non-demo manual draft workspace so the launcher always contains at least one real user-workspace object, not just reference demos and creation shortcuts.

**Rationale:**
- The user wanted the product to move beyond demo-only framing, and a real draft workspace makes that visible immediately.
- The launcher now has a concrete "your work" item on first load while still preserving the demo baseline as a reference.
- This helps the workspace hub feel like a living project board instead of a demo gallery with action buttons attached.

**Alternatives rejected:**
- **Rely only on blank/import/scan starter cards** — rejected because those are actions, not workspace objects.
- **Seed multiple synthetic user projects** — rejected because one honest manual draft workspace is enough to prove the non-demo path without inventing a fake project library.

### D-091: Make the manual draft workspace contain actual scene content
**Date:** 2026-05-28

**Decision:** Populate the seeded manual draft workspace with a small but real scene layout: perimeter walls, a camera, a light, an obstruction, a critical zone, an entry point, and a path.

**Rationale:**
- A manual workspace should look like a genuine draft, not an empty placeholder with a user label.
- This keeps the homepage honest about actual scene work while still preserving the demo as the reference baseline.
- The seeded draft now demonstrates the same editing primitives the product is built around, just at a smaller starting scale than the full retail demo.

**Alternatives rejected:**
- **Keep the manual workspace blank** — rejected because a blank card still reads as a shortcut, not a real project.
- **Clone the retail demo and relabel it as manual** — rejected because that would blur the line between reference baseline and user work.

### D-092: Visually distinguish the seeded manual draft workspace from the demo baseline
**Date:** 2026-05-28

**Decision:** Gave the seeded manual workspace draft-specific visual treatment in the launcher cards and detail panel so it reads as in-progress user work rather than another generic saved scene.

**Rationale:**
- A real work object should be distinguishable from the reference demo at a glance.
- The UI should tell the user which scene is a draft workspace, not just list it in a different section.
- The draft accent helps preserve the story that the demo is the baseline while the manual workspace is where actual site work begins.

**Alternatives rejected:**
- **Keep the manual draft visually identical to other user workspaces** — rejected because then it still reads like a generic seeded example.
- **Make the manual draft look like the demo** — rejected because that undermines the baseline-vs-user-work distinction.

### D-093: Use hydration-stable time formatting in the launcher
**Date:** 2026-05-28

**Decision:** Format launcher timestamps with an explicit `hour12: true` setting so the server-rendered and client-rendered text stay aligned across locales.

**Rationale:**
- The launcher is a client component that still server-renders, so locale drift can cause hydration mismatches.
- A stable timestamp format keeps the homepage from re-rendering itself on boot.
- The workspace hub should be quiet and deterministic on first load.

**Alternatives rejected:**
- **Leave locale defaults in place** — rejected because the same timestamp can render differently between server and browser locales.
- **Hide timestamps entirely** — rejected because last-run visibility is part of the dashboard story.

### D-094: Ensure seeded saved projects have unique scene ids
**Date:** 2026-05-28

**Decision:** Assign unique ids to the seeded demo project scenes instead of reusing the cloned demo scene id across every seeded card.

**Rationale:**
- Duplicate keys in the project list produce noisy runtime warnings and can cause unstable card identity.
- Each seeded project card should behave like a distinct workspace record even when it originates from the same canonical demo source.
- Unique ids make the workspace hub act more like a real project board.

**Alternatives rejected:**
- **Keep reused ids because the scenes are conceptually the same demo** — rejected because React list identity still needs unique keys.
- **Drop some seeded demo variants** — rejected because the reference demo gallery is useful for onboarding and comparison.

### D-095: Seed the draft workspace with a real computed result and site-oriented name
**Date:** 2026-05-28

**Decision:** Rename the seeded manual workspace to `Shop Layout Draft` and compute its initial simulation result at bootstrap so the non-demo workspace is a real analyzed scene, not just a labeled placeholder.

**Rationale:**
- The user asked for actual scene work, and a draft with its own computed result makes that visible immediately.
- A site-oriented name reads more like a work-in-progress project than an internal seed artifact.
- Seeding the result means the draft card can show real coverage/issue state on first load, not a stubbed blank card.

**Alternatives rejected:**
- **Keep the manual draft result-less** — rejected because it still looks synthetic and incomplete.
- **Rename it to another generic seed label** — rejected because the point is to make it feel like a real scene work item, not another bootstrap artifact.

### D-096: Deduplicate saved projects on load and suppress the launcher's dynamic run-label hydration mismatch
**Date:** 2026-05-28

**Decision:** Deduplicate saved projects by scene id before exposing them to the launcher and suppress hydration warnings on the launcher's `currentRunLabel` so the homepage can render deterministically even when old local-storage data or timestamp formatting would otherwise drift.

**Rationale:**
- The launcher is a client component that still server-renders, so its dynamic timestamp label can differ slightly between server and browser hydration.
- Old local-storage records can contain repeated scene ids, which creates noisy React key warnings and makes the workspace list feel unstable.
- The launcher should stay quiet on first paint; user-facing content should not fail just because browser state is stale.

**Alternatives rejected:**
- **Leave the duplicate rows in place** — rejected because the warnings are noisy and the cards lose stable identity.
- **Remove the timestamp label entirely** — rejected because last-run context is part of the dashboard story.

### D-097: Defer launcher SVG previews until after hydration
**Date:** 2026-05-28

**Decision:** Render the launcher's math-heavy SVG scene previews behind a client-only hydration gate and show deterministic placeholder cards on the server / initial client paint.

**Rationale:**
- The preview polygons are derived from scene geometry and can produce small server/client string differences that React reports as attribute hydration mismatches.
- The placeholder keeps the launcher visually stable on first paint while preserving the richer preview once the client has mounted.
- This removes the last noisy hydration warning without removing the preview content entirely.

**Alternatives rejected:**
- **Keep SSR for the SVG previews and suppress warnings** — rejected because the underlying mismatch still exists and remains noisy in dev tools.
- **Remove the previews entirely** — rejected because the previews are part of the product story and help the launcher feel like a real workspace hub.

### D-098: Launch Report Lite into the report workspace
**Date:** 2026-05-28

**Decision:** Change the launcher's Report Lite entry points to open the dedicated `report` workspace mode instead of entering as `map + report preset`.

**Rationale:**
- The report surface already exists as a first-class `ReportView` in the shell, so launching it as a report workspace matches the product model better.
- Keeping the launcher on `map` forced the user to rely on a preset to discover the report destination, which diluted the distinction between analysis and report handoff.
- The report path should feel like a real destination, not a side drawer that happens to be available from the map workspace.

**Alternatives rejected:**
- **Keep the map-based launch path** — rejected because it undersells the report workspace and makes the launcher story less coherent.
- **Remove the Report Lite launcher action** — rejected because report export is a core product path and should remain visible.

### D-099: Default the right rail to Security Status until inspection is needed
**Date:** 2026-05-28

**Decision:** Make the studio right rail auto-fall back to `Security Status` when no scene object is selected, then auto-return to `Inspector` when the user selects an editable object.

**Rationale:**
- The design’s product posture is security-first, so an empty scene overview should read like a status cockpit rather than a properties editor.
- The inspector still needs to be front-and-center once a camera, obstruction, or zone is actually selected.
- This preserves the existing manual mode switcher while making the default state less editor-centric.

**Alternatives rejected:**
- **Keep `Inspector` as the default** — rejected because it makes the workspace feel like a generic editor when no object is selected.
- **Always force `Security Status`** — rejected because it would hide editing controls even when the user explicitly wants to inspect an object.

### D-100: Resolve `?studio=1` from page search params instead of `window.location`
**Date:** 2026-05-28

**Decision:** Use the page's resolved `searchParams` promise to decide the studio launch shortcut, rather than branching off `window.location` during render.

**Rationale:**
- The launcher/server mismatch was causing a hydration divergence between the dashboard shell and the direct-studio path.
- Resolving the query from page props makes the initial render deterministic and keeps the `?studio=1` shortcut aligned between server and client.
- This preserves the shortcut while removing the need for a client-only URL branch.

**Alternatives rejected:**
- **Keep `window.location` gating** — rejected because it reintroduces hydration mismatch on direct studio entry.
- **Remove the shortcut entirely** — rejected because the quick studio boot path is useful for power users and QA.

### D-101: Surface privacy metrics in the report workspace header
**Date:** 2026-05-28

**Decision:** Show privacy summary stats directly in `ReportView` alongside the existing coverage, issue, recommendation, and critical-zone cards.

**Rationale:**
- The report workspace is the handoff surface, so it should expose privacy posture at a glance instead of leaving it only inside the detailed outcome panel.
- Privacy zones, restricted cells, and privacy-specific issues are already modeled in the simulation result and in `SecurityOutcomePanel`, so surfacing them in the report header improves trust without adding new computation.
- The report needs to read like a client-ready evidence summary, and privacy is part of that evidence story.

**Alternatives rejected:**
- **Keep privacy only in the outcome panel** — rejected because the report header would remain incomplete relative to the modeled security posture.
- **Add a separate privacy-only report page** — rejected because it fragments the handoff surface and duplicates the same simulation evidence.

### D-102: Surface fragility and k-robustness in the report workspace header
**Date:** 2026-05-28

**Decision:** Show the simulation's fragility summary and k-robustness state directly in `ReportView` alongside the existing coverage, issue, recommendation, critical-zone, and privacy cards.

**Rationale:**
- The report workspace should communicate not just the current score, but how sensitive that score is to small scene changes and camera failures.
- The engine already computes `fragilitySummary` and `kRobustness`, and the report-lite surface already uses them; the full report header should match that level of rigor.
- Presenting the uncertainty posture in the handoff view makes the product more honest about the confidence and resilience of the result.

**Alternatives rejected:**
- **Leave fragility only in the bottom analysis tabs** — rejected because the report header would understate the uncertainty model.
- **Introduce a new separate uncertainty page** — rejected because the existing report workspace is the correct handoff surface.

### D-104: Add a wall snap action to the camera inspector
**Date:** 2026-05-28

**Decision:** Add a `Snap to Nearest Wall` control in the camera inspector that repositions the selected camera to the closest wall, raises it to a realistic mount height, and re-aims it toward the room interior.

**Rationale:**
- The editor already exposes raw camera position and mount fields, but the product spec also expects mount-aware snapping behavior so camera placement feels intentional rather than purely numeric.
- Reusing the existing wall geometry keeps the action grounded in the current scene model instead of introducing a separate placement heuristic.
- Putting the action in the inspector makes the control discoverable where users already tune camera optics and mount state.

**Alternatives rejected:**
- **Leave snapping to scene import only** — rejected because interactive camera tuning would still be missing a core workflow affordance.
- **Add a separate floating snap tool** — rejected because it would fragment the camera-placement workflow away from the inspector.

### D-105: Add a live camera comparison section to CompareView
**Date:** 2026-05-28

**Decision:** Extend `CompareView` with a camera-specific comparison section that compares two cameras from the current scene using live simulation results, in addition to the existing snapshot comparison workflow.

**Rationale:**
- The compare workspace already compares scenarios well, but the product spec and gap audit also call for camera-vs-camera analysis.
- The simulation already computes per-camera coverage, covered/failed critical zones, and offline impact, so the extra compare surface can reuse existing verified data.
- Keeping this inside `CompareView` preserves the scenario compare workflow while giving users a direct camera analysis view in the same destination.

**Alternatives rejected:**
- **Create a separate camera compare page** — rejected because it fragments the compare workflow and duplicates the snapshot compare shell.
- **Do nothing and keep snapshot-only compare** — rejected because it leaves one of the remaining visible comparison gaps intact.

### D-106: Surface per-camera privacy impact in the inspector analytics tab
**Date:** 2026-05-28

**Decision:** Add a `Privacy Impact` section to the camera inspector analytics tab that shows privacy issues, restricted cells, and affected zones for the selected camera.

**Rationale:**
- Privacy is not only a report-level concern; it should be actionable while the user is tuning a specific camera.
- The simulation already carries privacy-restricted cells and privacy-category issues, so the inspector can surface that data without adding new model state.
- Putting the privacy impact in the camera analytics tab closes the last meaningful gap between privacy modeling and camera-level editing feedback.

**Alternatives rejected:**
- **Leave privacy only in the report panel** — rejected because it hides the camera-level source of the issue.
- **Add a separate privacy editor** — rejected because it would duplicate the existing inspector workflow and slow down camera tuning.

### D-107: Surface privacy issues in the Issues tab as a dedicated review section
**Date:** 2026-05-28

**Decision:** Add a privacy review block to the Issues tab so privacy issues, affected zones, affected cameras, and restricted-cell counts are visible in the same stream as general issues and recommendations.

**Rationale:**
- Privacy enforcement is now modeled by the simulation, but it should be actionable from the issues workflow where operators triage problems.
- The Issues tab is the natural place to jump from a finding to the impacted cameras and zones.
- Keeping privacy in a dedicated section preserves the general issue list while preventing privacy from getting buried in it.

**Alternatives rejected:**
- **Leave privacy issues only in the report panel** — rejected because operators need them earlier in the workflow.
- **Duplicate a full privacy dashboard** — rejected because it would be redundant with the existing report and inspector surfaces.

### D-108: Add an offline fallback parser to the AI command bar
**Date:** 2026-05-28

**Decision:** When no OpenAI API key is configured, the AI command bar should fall back to a deterministic offline parser for common scene-edit commands instead of hard-failing.

**Rationale:**
- The studio shell already exposes useful slash commands and common natural-language hints for scene work, so a missing key should not block the core edit loop.
- Common local actions like toggling day/night, report view, privacy visibility, snapshots, camera toggles, simple move/rotate/FOV edits, and light placement can be handled deterministically against the current `SecurityScene`.
- This keeps the command bar useful in local development and demo flows while preserving the OpenAI-backed path for richer candidate generation and report work.

**Alternatives rejected:**
- **Keep hard-failing without an API key** — rejected because it makes the command bar feel dead for common local workflows.
- **Send all commands through heuristic AI without an API key** — rejected because the local fallback should remain deterministic and testable.

### D-109: Wire the full visible tool rail into keyboard shortcuts
**Date:** 2026-05-28

**Decision:** The keyboard shortcut handler should mirror the visible tool rail and expose the same tool keys that the left panel advertises.

**Rationale:**
- The UI already teaches the keys in the left rail, so leaving most of them inactive makes the shell feel incomplete.
- This is a low-risk ergonomics improvement: the handler delegates to the existing active-tool state and does not change the scene model.
- Matching the visible rail and shortcut modal keeps the discoverability story honest for new users.

**Alternatives rejected:**
- **Leave only C/B/L wired** — rejected because the rest of the visible tool shortcuts would still be fake affordances.
- **Add a separate shortcut system** — rejected because that would duplicate the existing shell handler and invite drift.

### D-110: Expose Markdown export directly in the report handoff toolbar
**Date:** 2026-05-28

**Decision:** The report handoff tab should expose direct Markdown export alongside HTML, copy, and print actions.

**Rationale:**
- SentinelTwin reports are meant to be handed to clients and teammates in multiple formats, not only as a rendered HTML page.
- The report engine already produces canonical markdown, so surfacing it in the UI is low-risk and makes the handoff surface self-contained.
- Keeping export actions in the report toolbar avoids burying them in a secondary menu and matches the “workspace destination” framing of the report shell.

**Alternatives rejected:**
- **Keep Markdown export implicit through clipboard only** — rejected because it makes the export path too invisible.
- **Add a separate export dialog** — rejected because it would add extra friction without new capability.

### D-111: Wire the remaining single-key shell shortcuts from the spec
**Date:** 2026-05-28

**Decision:** Add the remaining single-key shell shortcuts for report, night mode, focus mode, and snapshot capture so the modal hints and the shell handler stay aligned with the spec language.

**Rationale:**
- The shell already had the corresponding actions, so wiring the keys is a low-risk usability improvement.
- Matching the keyboard hint modal to actual behavior keeps the studio honest and makes expert workflows faster.
- The actions map cleanly to existing store methods and do not introduce new scene logic.

**Alternatives rejected:**
- **Leave the shortcuts as toolbar-only** — rejected because the shell already advertises keyboard-driven workflows.
- **Create a separate shortcut subsystem** — rejected because that would duplicate existing handler logic and make drift more likely.

### D-112: Treat posture variation as a first-class deterministic report surface
**Date:** 2026-05-28

**Decision:** Implement coverage-under-posture variation as a deterministic target-height sweep over the canonical coverage evaluator, and surface it in the Novel Algorithms panel plus report exports.

**Rationale:**
- The existing evaluator already accepts an explicit target height, so posture variation can be expressed as a thin deterministic wrapper instead of a separate model.
- The product value is in showing how the same scene behaves for crouching, seated, child, and standing targets, not in inventing a second coverage engine.
- Surfacing the result in both the live panel and report exports keeps the analysis consistent across working and handoff contexts.

**Alternatives rejected:**
- **Keep posture variation as a docs-only idea** — rejected because the evaluator already supported the necessary primitive and the user-facing value is immediate.
- **Add a probabilistic body-pose model** — rejected for now because the requirement is to show posture sensitivity, not to simulate biomechanical motion.

### D-113: Export blind spot topology with severity and classification detail
**Date:** 2026-05-28

**Decision:** Carry blind-region topology detail into report exports and the report workspace summary rather than flattening it to a region count.

**Rationale:**
- The live Novel Algorithms panel already shows blind-region classifications, severity, and affected zones.
- The report/handoff surface should carry the same topology truth so clients can see whether the blind area is an isolated corner or an entry corridor to a critical zone.
- The detailed export is still deterministic and lightweight because it reuses the blind-region list already produced by the simulation.

**Alternatives rejected:**
- **Keep a count-only summary** — rejected because it hides the difference between isolated and critical blind regions.
- **Duplicate the topology analysis in the report layer** — rejected because the simulation already computes the canonical blind-region list.

### D-114: Export occlusion blame with per-obstruction detail
**Date:** 2026-05-28

**Decision:** Carry occlusion blame detail into report exports and the report-lite handoff surface so zone failure analysis remains actionable outside the live panel.

**Rationale:**
- The simulation already computes per-zone blame fractions, quality-without values, and improvement deltas for each obstruction.
- Flattening the result to a zone count would hide which obstruction is actually degrading the target zone.
- Exporting the obstruction list keeps the live novel panel, report workspace, and downloadable handoff aligned.

**Alternatives rejected:**
- **Keep occlusion blame count-only in exports** — rejected because it hides the specific obstruction-level action the user needs.
- **Move occlusion blame into a separate report-only analysis** — rejected because the simulation already computes the canonical occlusion-blame list.

### D-115: Export blind spot fingerprints with the blind-region topology
**Date:** 2026-05-28

**Decision:** Compute a deterministic fingerprint for the blind-region topology and carry it through the live novel panel and report exports.

**Rationale:**
- The live blind-spot topology view already exposes the connected region list, but a stable fingerprint makes the same failure pattern easier to compare across scenes and exports.
- The fingerprint is derived from the canonical blind-region list, so it stays deterministic and does not introduce another analysis path.
- Surfacing the fingerprint in both the live panel and handoff report keeps the comparison workflow aligned with the rest of the novel-algorithm bundle.

**Alternatives rejected:**
- **Keep blind spot fingerprinting as a docs-only idea** — rejected because the stable signature is inexpensive to compute and immediately useful in handoffs.
- **Build the full dataset clustering layer first** — rejected because the signature itself already has standalone value and does not require the dataset to be useful.

### D-116: Ship a first-pass reflective bounce proxy before full physical optics
**Date:** 2026-05-28

**Decision:** Implement Reflective Bounce Vision as a deterministic mirror-plane proxy using reflective windows, visibility checks, and an ignored-surface bounce pass, then expose it in the live novelty panel and report handoff.

**Rationale:**
- The product already needed a concrete user-visible answer for reflective windows instead of leaving the idea as pure research text.
- A deterministic mirror-plane proxy is inexpensive, stable, and consistent with the rest of the simulation engine's geometry-first approach.
- Shipping the first-pass version now keeps the live panel, report export, and novelty roadmap aligned while leaving room for future angle-of-incidence and reflectivity refinements.

**Alternatives rejected:**
- **Keep Reflective Bounce Vision as research-only** — rejected because the reflective-window effect was already cheap to model and immediately useful in the current product shell.
- **Wait for a full physical optics model** — rejected because that would delay the user-facing value and is not necessary for the current launch-quality simulation workflows.

### D-117: Export K-Robustness critical failure sets
**Date:** 2026-05-28

**Decision:** Carry the K-Robustness critical failure sets into the live novel panel and report handoff, not just the scalar `K=` result.

**Rationale:**
- The scalar robustness value tells users whether the setup survives a failure count, but not which cameras create the critical failure mode.
- Surfacing the actual failing camera sets keeps the analysis actionable and aligns the handoff report with the live panel.
- The simulation already computes the critical sets, so the export cost is low and deterministic.

**Alternatives rejected:**
- **Keep K-Robustness scalar-only** — rejected because it leaves the user without the concrete failure set needed to plan the fix.
- **Move the critical set detail into a separate modal only** — rejected because the report and live novelty panel should expose the same core result.

### D-118: Expose AI command residency as offline-first with cloud-backed availability
**Date:** 2026-05-28

**Decision:** Show an explicit offline-first residency banner in the AI command bar, and label whether cloud-backed parsing is available.

**Rationale:**
- The command hook already prefers the local offline parser for recognized scene edits, so the UI should say that out loud instead of implying every command is cloud-backed.
- Security-layout users need a clear indicator of what stays local and what requires a configured provider key.
- The command bar is the right place to disclose this because it is where the user decides whether to type a natural-language command at all.

**Alternatives rejected:**
- **Keep residency implicit** — rejected because it hides a product-critical data-residency behavior.
- **Hide it in a settings panel only** — rejected because the command bar itself is the point of trust and should disclose the mode immediately.

### D-119: Persist and surface the active AI provider in workspace settings
**Date:** 2026-05-28

**Decision:** Persist the active AI provider selection in studio state and expose it in View Settings so the command layer and AI draft launcher use the same provider source of truth.

**Rationale:**
- The command bar, report generation, and AI draft launcher were previously hard-wired or implicit, which made the shell lie about which model was active.
- A small store-backed provider selection keeps the shell coherent without introducing a second configuration path.
- Showing the provider in View Settings makes the AI surface discoverable and lets users verify the active model before typing a command.

**Alternatives rejected:**
- **Leave provider choice code-only** — rejected because the shell would still hide the active model.
- **Build a separate provider settings page** — rejected because View Settings already owns the layout and AI tool surface controls.

### D-120: Export the redundancy matrix through the report workspace
**Date:** 2026-05-28

**Decision:** Promote the redundancy matrix into the report workspace and canonical exports so the handoff surface carries the same single-point-of-failure detail as the live matrix panel.

**Rationale:**
- The bottom-panel matrix already exposes the right camera-vs-zone redundancy detail, but that detail was still trapped in the analysis drawer.
- Exporting the matrix into HTML, Markdown, and text keeps the report aligned with the live shell and makes the redundancy story visible in handoff artifacts.
- The report workspace already owns the client-ready evidence surface, so it is the right place to mirror the matrix without introducing a duplicate report format.

**Alternatives rejected:**
- **Leave redundancy only in the bottom drawer** — rejected because the handoff report would remain weaker than the live analysis surface.
- **Create a separate redundancy export artifact** — rejected because the existing report formats already cover the handoff use case and should remain canonical.

### D-121: Reuse compare evidence in the Before/After drawer
**Date:** 2026-05-28

**Decision:** Reuse the same compare visual evidence state in the bottom-panel Before/After tab and provide a direct handoff into the full Compare workspace when the user wants a deeper visual diff.

**Rationale:**
- The compare workspace already captures before/after canvases and exposes them as report-ready evidence, so the bottom drawer should not duplicate that pipeline.
- Keeping the drawer lightweight while still showing the visual diff makes the comparison story consistent across the shell and avoids a second evidence export path.
- A direct `Open Compare View` handoff lets the user jump from metrics to the richer compare surface without losing the snapshot pair.

**Alternatives rejected:**
- **Leave Before/After as metrics-only** — rejected because it hides the visual compare story behind a separate workspace.
- **Build a second thumbnail capture pipeline just for the drawer** — rejected because it would duplicate compare evidence and create drift with report exports.

### D-122: Surface camera presets in View Settings
**Date:** 2026-05-28

**Decision:** Keep the existing in-canvas camera preset picker, but surface the camera preset library in View Settings so the preset options are visible before placement.

**Rationale:**
- The picker already applies camera spec defaults correctly when the camera tool is active.
- View Settings is the right discoverability layer for users who want to know what presets exist before they start placing cameras.
- Surfacing the preset library in the layout modal keeps the product consistent with the rest of the workspace configuration surfaces.

**Alternatives rejected:**
- **Leave presets hidden in the canvas only** — rejected because users have to switch tools before discovering the library.
- **Create a separate preset management page** — rejected because the preset list is a placement aid, not a standalone settings domain.

### D-123: Footage verification preview should ship a multi-frame strip with deterministic best-frame scoring
**Date:** 2026-05-28

**Decision:** Extend Camera View verification preview to extract multiple timestamped frame candidates from local video uploads, score candidate quality deterministically, auto-pick a best candidate, and allow operators to override selection directly from the candidate strip.

**Rationale:**
- Single midpoint extraction is brittle for real clips where the target view may only appear in a subset of frames.
- A deterministic local quality score keeps the feature fast, offline-friendly, and aligned with the geometry-first simulation posture.
- Exposing auto-pick plus manual override in one panel gives operators speed and control without introducing backend ingest complexity.

**Alternatives rejected:**
- **Keep manual re-sampling only via timestamp slider** — rejected because operators still have to hunt blindly for good frames.
- **Delay multi-frame support until ONVIF/RTSP integration** — rejected because local file workflows are already high-value and can ship independently.

### D-124: Verification snapshots must persist video evidence lineage metadata
**Date:** 2026-05-28

**Decision:** Extend camera verification snapshots to persist source lineage metadata (`sourceType`, sampled timestamp, video duration, candidate-count, and best/selected candidate ids) so restored snapshots keep their acquisition context instead of only rendering state.

**Rationale:**
- Without lineage metadata, saved snapshots lose critical context about how the reference frame was chosen.
- Persisting metadata now improves operator trust and prepares the verification path for future evidence export without introducing a second data model.
- This remains lightweight and backward-compatible because metadata fields are optional.

**Alternatives rejected:**
- **Keep snapshots render-only (image + transforms)** — rejected because it discards frame selection provenance.
- **Store lineage only in transient component state** — rejected because reloading/restoring snapshots would still lose acquisition context.

### D-125: Saved verification snapshots must display evidence lineage summary in-panel
**Date:** 2026-05-28

**Decision:** Render a compact evidence summary under each saved verification snapshot entry in Camera View (`Image upload` for static uploads, and `Video sampledTime/duration · candidateCount · selected-mode` for video-derived references).

**Rationale:**
- Persisted metadata is only valuable if operators can inspect it without loading each snapshot blindly.
- A compact line keeps the panel dense while still surfacing critical provenance needed for auditability.
- This improves trust and speeds triage when multiple snapshots are saved for the same camera.

**Alternatives rejected:**
- **Only show filename in saved list** — rejected because it hides frame provenance and forces repeated load/inspect loops.
- **Move lineage details to a separate modal** — rejected because it adds unnecessary interaction cost for a high-frequency workflow.

### D-126: Coverage entropy should ship as a normalized, interpretable quality-distribution metric
**Date:** 2026-05-28

**Decision:** Implement Coverage Entropy as a normalized Shannon entropy over the simulated coverage-cell quality distribution, then expose it in the live Novel Algorithms panel, report workspace, and report exports.

**Rationale:**
- The open question was not whether the metric can be computed, but whether it can be made interpretable enough to be useful.
- A normalized entropy score plus dominant-quality share gives users both the compact signal and the explanation.
- Reusing the same helper across the panel and exports keeps the metric deterministic and avoids another one-off report-only summary.

**Alternatives rejected:**
- **Leave coverage entropy as a research note only** — rejected because the existing coverage-cell distribution already makes the metric cheap to compute.
- **Show entropy without a dominant-quality explanation** — rejected because the raw score alone is too abstract for operators.

### D-126: Footage verification should include deterministic auto-align assist
**Date:** 2026-05-28

**Decision:** Add an in-panel `Auto align` action that runs a deterministic multi-phase local search over overlay offsets and applies the best-scoring alignment match.

**Rationale:**
- Manual nudge controls are useful but slow for larger offset corrections.
- A deterministic local search keeps behavior explainable and offline-friendly while materially reducing operator effort.
- This builds on the existing alignment score model instead of introducing a second scoring pipeline.

**Alternatives rejected:**
- **Keep manual arrow/slider alignment only** — rejected because it is too slow for frequent verification loops.
- **Use model-based alignment inference** — rejected for now because deterministic geometry-first behavior is preferred for this preview stage.

### D-127: Verification snapshots should persist alignment provenance (manual vs auto)
**Date:** 2026-05-28

**Decision:** Persist `alignmentMethod` (`manual`/`auto`) and `autoAlignDelta` metadata with each camera verification snapshot, and surface this provenance in the saved snapshot evidence summary.

**Rationale:**
- Offset values alone do not explain whether alignment was operator-driven or assistant-driven.
- Persisting provenance makes snapshot evidence more audit-friendly and helps operators trust restored comparisons.
- Including score delta on auto-aligned snapshots gives a quick quality-improvement signal without opening a separate diagnostics surface.

**Alternatives rejected:**
- **Store only offsets + final score** — rejected because it hides workflow provenance.
- **Keep provenance transient-only in session state** — rejected because restore/export paths would lose operator context.

### D-128: Verification panel should show active alignment assist state
**Date:** 2026-05-28

**Decision:** Surface an `Alignment Assist` status block in Camera View that shows whether the current reference frame is idle, manually aligned, or auto-aligned, and display the auto-align score delta when available.

**Rationale:**
- Provenance hidden only inside saved snapshots is too indirect for the live verification workflow.
- Operators need immediate feedback on whether current offsets came from automation or manual adjustment.
- Showing the auto-align delta makes the assistant measurable instead of feeling like a black-box button.

**Alternatives rejected:**
- **Keep provenance only in saved snapshot summaries** — rejected because it does not help before saving.
- **Expose alignment method only via tooltip/microcopy** — rejected because it is too easy to miss in a dense verification panel.

### D-129: Calibration Assist v1 should include reference scale controls and scale-aware auto-align
**Date:** 2026-05-29

**Decision:** Extend Camera View verification calibration with a reference scale slider (`70%–130%`), persist scale in saved snapshots, and include scale as a search dimension in deterministic auto-align.

**Rationale:**
- Offset-only calibration cannot handle common real-world framing differences where reference footage appears slightly zoomed compared to simulation.
- A bounded scale range keeps interactions practical while preventing runaway distortions.
- Persisting scale with snapshot evidence preserves calibration reproducibility when reloading or reviewing saved references.

**Alternatives rejected:**
- **Offset-only alignment forever** — rejected because it produces false confidence when scale mismatch exists.
- **Full perspective warp calibration in this phase** — rejected as too complex for v1; scale + offset solves the majority of current mismatch cases with low UX overhead.

### D-127: Heuristic AI drafts should enrich obvious scene prompts with entry, light, and path hints
**Date:** 2026-05-28

**Decision:** Extend the deterministic AI layout draft fallback so obvious shop-like prompts also produce explicit front-entry labels, prompt-driven lighting, and a basic entry-to-counter path when the prompt calls for it.

**Rationale:**
- The current draft flow already turns text into editable `SecurityScene` drafts, but it was still template-heavy for common retail prompts.
- Adding these prompt hints makes the generated scene look authored rather than merely templated, which better matches the product's text-to-scene promise.
- The change stays deterministic, offline-friendly, and easy to test, so it is a safe improvement on the canonical draft path.

**Alternatives rejected:**
- **Wait for a full model-generated SecurityScene JSON pipeline** — rejected because the heuristic path can be improved immediately and still remains useful when no provider key is available.
- **Leave the template-only heuristic untouched** — rejected because obvious prompt cues like entry, lighting, and simple paths are already present in the user language and should be reflected in the draft.

### D-128: Model-backed AI drafts should compile an explicit scene blueprint
**Date:** 2026-05-28

**Decision:** Extend the model-backed AI layout draft path so structured output includes a concrete scene blueprint with explicit camera, light, obstruction, zone, entry, and path placements, then compile that blueprint into the editable `SecurityScene`.

**Rationale:**
- The existing structured draft path was useful but still mostly template-selection plus enrichment.
- A scene blueprint makes prompt-to-scene behavior materially more faithful to the user's request while staying schema-validated and deterministic at compile time.
- Keeping the blueprint as the structured boundary is safer than asking the model to emit raw full-scene JSON directly, because the compiler can normalize IDs, defaults, and node wiring consistently.

**Alternatives rejected:**
- **Ask the model for raw full `SecurityScene` JSON immediately** — rejected because the full schema is large and would be harder to keep stable across providers.
- **Keep structured output limited to template and dimensions only** — rejected because the product now needs more than a template selector to feel like legitimate text-to-scene.

### D-129: AI Layout Draft launcher should be preview-first, then apply
**Date:** 2026-05-28

**Decision:** Change the launcher's AI Layout Draft modal so it generates a reviewable preview card first, and only replaces the current workspace after the user explicitly chooses to apply the draft.

**Rationale:**
- The other scene-ingest flows already use review-first UX where possible, and the AI draft path should follow the same operator-safe pattern.
- A preview card makes the draft more transparent by surfacing scene name, counts, warnings, and provenance before any workspace replacement happens.
- Keeping application separate from generation reduces accidental workspace overwrite risk while still letting the user move quickly once the preview looks right.

**Alternatives rejected:**
- **Keep the immediate-apply launcher behavior** — rejected because it hides the draft contents until after the workspace has already been replaced.
- **Open Studio before previewing the draft** — rejected because the user should be able to inspect the result in the launcher and decide whether to use it.

### D-130: AI Layout Draft preview should show current-vs-draft replacement impact
**Date:** 2026-05-28

**Decision:** Add a compact current-vs-draft comparison strip to the AI Layout Draft preview modal so the user can see the replacement impact before applying the draft.

**Rationale:**
- A preview card is more trustworthy when it explicitly shows what the draft would change in the workspace.
- Current-vs-draft counts make the launcher safer for non-demo work because users can spot unexpected object growth or loss before committing.
- The comparison is lightweight and fits the launcher modal without needing a separate compare view.

**Alternatives rejected:**
- **Keep the preview card summary only** — rejected because it answers "what is this?" but not "what will this replace?"
- **Force the user into Studio for comparison** — rejected because the launcher should support review before commit on its own.

### D-131: AI Layout Draft preview should expose the generated SecurityScene JSON
**Date:** 2026-05-28

**Decision:** Add an expandable raw JSON disclosure inside the AI Layout Draft preview modal, plus a copy action, so users can inspect the exact generated `SecurityScene` before applying it.

**Rationale:**
- Prompt-to-scene becomes more trustworthy when the user can inspect the actual generated structure, not only a human summary and counts.
- A raw JSON view keeps the launcher aligned with the product's "AI proposes, user reviews, simulation verifies" framing.
- Copying the generated JSON is useful for debugging, handoff, and future import/export workflows without forcing a full Studio context switch.

**Alternatives rejected:**
- **Hide the generated JSON behind Studio-only tooling** — rejected because the launcher should already be able to disclose what it is about to apply.
- **Replace the preview summary with raw JSON only** — rejected because the summary and comparison still matter for quick human review.

### D-132: Report Lite should surface the latest-run executive summary before raw markdown
**Date:** 2026-05-28

**Decision:** Add a four-bullet executive summary card to the top of Report Lite so the report handoff begins with critical issue, primary cause, impact, and recommendation before the raw markdown body.

**Rationale:**
- The report handoff is more useful when the reader gets a compact decision summary first, rather than immediately dropping into raw markdown text.
- The bottom-row report summary already establishes the same four-bullet pattern, so surfacing it in Report Lite keeps the product’s report story consistent across surfaces.
- The summary is derived from the live simulation result, so it stays aligned with the actual modeled scene instead of becoming a static explanation.

**Alternatives rejected:**
- **Keep Report Lite as raw markdown only** — rejected because the handoff should be readable at a glance.
- **Invent a second summary model for the report tab** — rejected because the existing outcome/result data already provides the needed detail.

### D-133: Bottom row and Report Lite should share the same executive summary helper
**Date:** 2026-05-28

**Decision:** Move the four-bullet report summary into a shared helper so the bottom row and Report Lite render the same executive summary data from the same source of truth.

**Rationale:**
- The bottom row and report tab were both describing the same latest-run story with duplicated logic.
- Sharing the helper prevents drift between the compact report summary and the handoff tab summary.
- This keeps the report story aligned across surfaces without introducing a new summary model.

**Alternatives rejected:**
- **Leave the two summaries duplicated** — rejected because the text can diverge over time.
- **Remove the bottom-row summary** — rejected because the compact summary is still valuable as a glanceable state indicator.

### D-134: StatusBar should surface scene, view, selection, and coverage context
**Date:** 2026-05-28

**Decision:** Expand the compact status bar footer to show the current scene name, active view mode, selection summary, and live coverage/issue summary alongside the existing engine and run controls.

**Rationale:**
- The footer is visible on every studio surface, so it should carry a small amount of cockpit context rather than only engine and grid metadata.
- Scene name, view mode, and selection context help users orient themselves without opening a side panel.
- A live coverage/issue summary makes the footer a useful state indicator while remaining lighter than the full report or security-outcome surfaces.

**Alternatives rejected:**
- **Keep the footer as engine-only chrome** — rejected because it underuses a globally visible surface.
- **Move all context into the right rail** — rejected because the right rail is not always visible and already has heavier inspector content.

### D-135: Provenance should be a first-class top-bar destination
**Date:** 2026-05-28

**Decision:** Add a direct Provenance action to the TopBar so users can jump into the scene-intelligence trace graph from the main shell instead of hunting for the bottom tab.

**Rationale:**
- Provenance is a core SentinelTwin promise: users should be able to inspect how the current result was derived.
- The bottom tab already exists, but a top-bar shortcut makes the traceability workflow feel like a first-class command rather than a hidden analysis panel.
- The same action is available in the overflow menu, so the affordance remains reachable on narrower viewports.

**Alternatives rejected:**
- **Leave provenance only in the bottom tabs** — rejected because it undersells a core evidence feature.
- **Create a separate provenance drawer** — rejected because the existing scene-intelligence tab already provides the necessary surface.

### D-136: Issues tab recommendations should support explicit test/apply/revert
**Date:** 2026-05-28

**Decision:** Add a `Test Fix` action to the Issues tab recommendation cards that previews the recommendation patch and immediately re-runs the simulation before the user commits with `Apply Fix`.

**Rationale:**
- The triage loop is more useful when users can test a recommendation in one click instead of manually previewing and then separately running simulation.
- `Preview Fix`, `Test Fix`, `Apply Fix`, and `Revert Preview` create a clearer progression from safe inspection to committed scene change.
- The existing recommendation patch logic already supports deterministic preview/apply/revert, so the explicit test action is a low-risk usability improvement.

**Alternatives rejected:**
- **Keep preview/apply only** — rejected because the triage flow should make validation explicit.
- **Auto-apply recommendations without review** — rejected because it would be too aggressive for a security workspace.

### D-137: Metrics tab should surface advanced live signals alongside core coverage cards
**Date:** 2026-05-28

**Decision:** Expand the Metrics tab with a second row of advanced live signals, including coverage entropy, K-robustness, placement oracle, blind-spot fingerprint, reflective bounce, temporal anomalies, and occlusion blame counts.

**Rationale:**
- The Metrics tab is the fastest at-a-glance summary, so it should expose the richer live signals already computed by the simulation.
- These signals are useful before opening the deeper novel-algorithms/report surfaces and help the shell feel more like a true cockpit.
- Keeping them in a second row preserves the existing core metric cards while making the advanced signals visible without adding another panel.

**Alternatives rejected:**
- **Leave advanced signals only in lower tabs and reports** — rejected because users should see the richer signals at a glance.
- **Replace the core metrics row** — rejected because the core coverage/zone/camera summary is still the primary summary.

### D-138: Launcher browser should filter by scene source directly
**Date:** 2026-05-28

**Decision:** Add a source filter row to the launcher browser so users can directly filter workspace cards by origin (`Demo`, `Draft`, `Import`, `Scan`, `AI`, `Preset`) alongside the existing search, sort, folder, and tag controls.

**Rationale:**
- Scene origin is a primary way users distinguish baseline demo content from their own work.
- The launcher already has the counts and badges needed to make source filtering cheap and visible.
- A source filter closes the last obvious browser gap without introducing a new browser surface or changing the overall layout.

**Alternatives rejected:**
- **Keep source only as a badge** — rejected because users should be able to filter by origin, not just read it.
- **Add a separate browser page** — rejected because the existing launcher already owns the canonical workspace browsing surface.

### D-140: Camera mount snap should support wall, ceiling, and pole targets
**Date:** 2026-05-28

**Decision:** Expand the camera inspector mount snap action from wall-only snapping to a three-way mount menu covering wall, ceiling, and pole targets.

**Rationale:**
- The spec describes snap behavior for multiple mount types, not just wall anchoring.
- Wall-only snapping improved the workflow, but it still left the ceiling/pole cases as a visible product gap.
- A shared helper keeps the same mount logic available from both camera-inspector entry points without duplicating the geometry math.

**Alternatives rejected:**
- **Keep wall-only snapping** — rejected because it leaves the spec gap partially open.
- **Create a separate mount editor panel** — rejected because the inspector already owns the camera placement workflow.

### D-139: Help tab should mirror the live workflow instead of a generic help stub
**Date:** 2026-05-28

**Decision:** Expand the `Help` analysis tab into a real workflow guide with a step-by-step map, live shortcut groups derived from the shell keymap, domain terms, and recovery guidance.

**Rationale:**
- The help panel should teach the actual Studio workflow, not repeat generic onboarding text.
- Deriving the shortcut groups from the same live constants used by the shell keeps the guidance aligned with the real keymap.
- A richer help surface is useful for first-run users and still valuable for power users who need a quick workflow reference.

**Alternatives rejected:**
- **Keep Help as a short text stub** — rejected because it undersells the analysis drawer and repeats information already available elsewhere.
- **Move the workflow guide to a separate doc only** — rejected because the guidance should be available in-product where users are working.

### D-141: Launcher workspace management should support duplicate and rename actions
**Date:** 2026-05-28

**Decision:** Add Duplicate Workspace and Rename Workspace actions to the selected-workspace launcher card so saved scenes can be copied or retitled from the launcher before entering Studio.

**Rationale:**
- The launcher already owns the browser and metadata-editing surface for local workspaces.
- Duplicate/rename are the next obvious management actions after open, pin, folder, and tag editing.
- Prompting from the launcher keeps workspace management lightweight and avoids forcing users into the editor just to create a copy or retitle a draft.

**Alternatives rejected:**
- **Leave duplicate/rename in the editor only** — rejected because the launcher is the primary workspace hub.

### D-142: Sensors should have first-class editor and inventory surfaces before live fusion
**Date:** 2026-05-29

**Decision:** Expose sensors through a dedicated authoring tool, sensor inspector, and bottom-panel sensor inventory tab before attempting full live sensor-camera fusion.

**Rationale:**
- The schema already accepts sensors, so the next visible product gap is making them editable and inspectable in the same cockpit as cameras, lights, and zones.
- A dedicated sensor UI keeps the product honest about the current state of the fusion layer while giving the editor a concrete non-camera workflow.
- Keeping live fusion as a later step avoids conflating UI promotion with ONVIF/live-feed integration work.

**Alternatives rejected:**
- **Hide sensors until live fusion exists** — rejected because the schema boundary is already real and the product should surface it.
- **Jump straight to live-feed ingestion** — rejected because that would leave the authoring experience under-specified and would not close the visible cockpit gap first.

### D-164: Camera inspector should preview the nearest sensor before full live fusion
**Date:** 2026-05-29

**Decision:** Surface a nearest-sensor `Sensor Fusion` preview in the camera inspector analytics tab, showing the nearest sensor label, distance, state, and coverage mode while keeping the broader live sensor fusion workflow camera-first for now.

**Rationale:**
- The editor already has a canonical sensor schema and dedicated sensor tools, so the camera inspector should expose the current fusion boundary instead of hiding sensors entirely.
- A nearest-sensor preview gives operators an immediate sense of which non-camera layer is closest to the current view, without pretending the product has full live ONVIF ingestion yet.
- Keeping the preview scoped to the inspector avoids conflating a visible fusion hint with the larger live sensor-camera integration work.

**Alternatives rejected:**
- **Hide sensor information until full live fusion is complete** — rejected because the schema boundary and dedicated sensor UI already exist.
- **Build a full live fusion panel first** — rejected because that would overreach the current product stage and delay a useful inspector cue.

### D-165: Live camera feed should surface the nearest sensor alongside camera overlays
**Date:** 2026-05-29

**Decision:** Add a lightweight nearest-sensor `Sensor Fusion` overlay to the live camera feed and inspector feed, showing distance, state, coverage mode, and active sensor counts beside the existing camera overlays.

**Rationale:**
- The fusion boundary should be visible in the verification view, not only in a separate inspector analytics tab.
- A compact overlay makes the live camera surface cross-sensor aware without pretending full ONVIF/live ingestion exists yet.
- Showing active sensor counts and nearest-sensor state helps operators understand which non-camera layer is most relevant to the current view.

**Alternatives rejected:**
- **Keep sensors only in the inspector analytics tab** — rejected because the live feed itself should reflect the current fusion boundary.
- **Build a full cross-sensor event timeline first** — rejected because the overlay is a smaller, truthful step that still moves the product forward.

### D-166: Sensor edits should emit provenance events in the operational ledger
**Date:** 2026-05-29

**Decision:** Classify sensor-only scene mutations as sensor-specific operational evidence events so sensor add/update/remove actions create a visible audit trail alongside the broader scene history.

**Rationale:**
- The sensor layer is now a first-class scene object, so its edits should be traceable in the same ledger as camera and scene changes.
- Reusing the existing operational evidence pipeline avoids inventing a parallel history system just for sensors.
- A sensor-specific event kind keeps the provenance surface understandable instead of hiding the change under a generic scene update entry.

**Alternatives rejected:**
- **Log sensor edits only as generic scene updates** — rejected because it makes the sensor story harder to audit in the visible ledger.
- **Wait for full ONVIF ingestion before logging sensor changes** — rejected because local sensor edits already represent meaningful evidence today.

### D-167: Debug should expose a runtime health summary in-product
**Date:** 2026-05-29

**Decision:** Add a runtime health summary to the Debug panel that surfaces simulation state, AI policy/provider status, workspace access state, and sensor/camera health counts alongside the existing diagnostic bundle and evidence journal.

**Rationale:**
- The debug panel is the right place to answer the operator's first question: "is the studio healthy right now?"
- Runtime truth should be visible in-product instead of forcing the user to infer it from several separate panels.
- Reusing store-backed simulation, AI, and access state keeps the health summary aligned with the actual live truth instead of duplicating state.

**Alternatives rejected:**
- **Leave runtime truth only in the diagnostic bundle** — rejected because that is too hidden for day-to-day troubleshooting.
- **Create a separate monitoring dashboard** — rejected because the existing Debug panel already owns the operator-health surface.

### D-168: Debug should expose a runtime journey trace alongside health
**Date:** 2026-05-29

**Decision:** Extend the Debug panel and diagnostic bundle with a runtime journey trace and path health cards for import, scan, AI, render, save, and publish so the operator can see not just the current health state but also the recent path history that produced it.

**Rationale:**
- Runtime truth is more useful when it includes recent path history instead of only a static status snapshot.
- The existing evidence ledger already captures the kinds of lifecycle events we need, so a trace view can be built without inventing a parallel telemetry store.
- A compact journey-health surface makes the observability story closer to a real support workflow without waiting for backend telemetry infra.

**Alternatives rejected:**
- **Keep the bundle as state-only health** — rejected because it does not answer "what just happened?".
- **Delay until a full backend telemetry stack exists** — rejected because the product already has enough evidence events to show a useful trace today.
- **Build a separate workspace management modal** — rejected because the selected workspace card already has the right context and layout for these actions.

### D-142: Top-bar scene selector should mirror launcher workspace management
**Date:** 2026-05-28

**Decision:** Add Duplicate and Rename actions to each saved-scene row in the canonical top-bar scene selector so the primary shell exposes the same workspace-management operations as the launcher.

**Rationale:**
- The top bar is the canonical scene selector and should not lag behind the launcher on workspace management.
- Keeping duplicate/rename in the same scene dropdown makes the primary shell more consistent and avoids hiding basic project operations in a secondary view.
- The launcher already proved the pattern, so mirroring it in the top bar is a low-risk way to close the remaining visible gap.

**Alternatives rejected:**
- **Leave duplicate/rename launcher-only** — rejected because the top bar is the primary scene selector.
- **Add a separate workspace actions menu** — rejected because the existing scene dropdown already has the right context.

### D-143: Timeline replay should expose camera reach summary and explicit actor-follow mode
**Date:** 2026-05-28

**Decision:** Add a compact per-camera reach summary strip to the timeline tab and relabel the replay follow toggle as `Follow Actor` so the path replay HUD is more explicit without changing the simulation model.

**Rationale:**
- The timeline tab is the most reference-sensitive replay surface and benefits from a quick camera reach overview before the event table.
- The existing follow behavior already follows the actor; the label should say that clearly.
- This is a low-risk visual improvement that stays inside the existing replay model and does not require new simulation data.

**Alternatives rejected:**
- **Leave the timeline as a table-only surface** — rejected because the replay HUD still felt more streamlined than the reference.
- **Add new replay data structures** — rejected because the current result model already contains the reach summary needed for a stronger HUD.

### D-144: Critical-zone target type should be a shell-level default for new zones
**Date:** 2026-05-28

**Decision:** Promote the target-type switcher into a shell-level default: the top bar always shows the global target-type dropdown, the choice updates all existing critical zones, and the manual critical-zone placement tool uses the same default when creating new zones.

**Rationale:**
- The old zone-only bulk-edit behavior did not fully satisfy the product expectation of a global scene-level target switcher.
- A shell-level default makes the control useful before any zones exist and keeps new manual zones aligned with the user’s chosen target type.
- This keeps the scene-level workflow consistent without inventing a separate scene schema field.

**Alternatives rejected:**
- **Leave the switcher as a bulk-edit only control** — rejected because it still felt like a partial implementation.
- **Add a new scene-schema field for target default** — rejected because the workspace store already provides a lightweight default without schema churn.

### D-145: Light inspector should expose night-coverage contribution
**Date:** 2026-05-28

**Decision:** Add a night-impact section to the light inspector so each security light can explicitly toggle whether it contributes to night coverage and show a short simulation-impact summary inline.

**Rationale:**
- Security lights directly affect the lighting penalty and night-mode analysis, so the light inspector should expose that contribution where the light is edited.
- A compact inline explanation is more actionable than forcing users to infer the effect from the metrics or report surfaces.
- Keeping the control inside the existing inspector avoids inventing a separate analysis-only surface for a property that belongs to the light node itself.

**Alternatives rejected:**
- **Leave the light inspector as position/type/status only** — rejected because it hid a simulation-relevant property that already exists in the node model.
- **Move the night-coverage control into a separate analysis tab** — rejected because it would split the editable property away from the object that owns it.

### D-146: AI Layout Draft should expose editable raw SecurityScene JSON
**Date:** 2026-05-28

**Decision:** Keep the AI Layout Draft flow preview-first, but expose an editable raw `SecurityScene` JSON view with schema validation before apply.

**Rationale:**
- Prompt-to-scene is stronger when users can inspect the exact generated structure rather than only a human-readable summary.
- An editable JSON view lets advanced users correct a generated draft directly without leaving the preview-first flow.
- Schema validation preserves safety so the preview can still reject invalid JSON before it replaces the workspace.

**Alternatives rejected:**
- **Only show read-only JSON** — rejected because it would not support hands-on correction of generated drafts.
- **Skip JSON entirely and only keep summary cards** — rejected because it hides the actual structure that advanced users need to inspect.

### D-147: Manual-assisted scan review should expose explicit queue actions
**Date:** 2026-05-28

**Decision:** Make the scan candidate review surface explicitly show a `Needs Review` queue summary and direct `Accept`, `Review`, and `Reject` actions per candidate.

**Rationale:**
- Manual-assisted extraction is only useful if the user can quickly see what still needs attention and mark objects accordingly.
- A visible queue summary makes the correction burden legible before compile and keeps confidence issues from hiding in a status select.
- Direct action buttons are faster and clearer than forcing the user to work through only a dropdown.

**Alternatives rejected:**
- **Leave the review flow as status-select only** — rejected because it was too easy to miss pending items.
- **Add a separate review mode screen** — rejected because the existing candidate review panel already had the right context.

### D-148: R3F canvas entry points should import the local three-compat shim
**Date:** 2026-05-28

**Decision:** Import the local `three-compat` shim before every R3F canvas entry point so the Three.js r184 `Clock` deprecation warning is mitigated consistently across the studio canvases.

**Rationale:**
- The warning originates in `@react-three/fiber` internals, not app-local scene code, so a local compatibility layer is the least invasive mitigation.
- Importing the shim at each canvas entry point keeps the behavior explicit and avoids relying on a single hidden bootstrap.
- A source-level regression test can prove the mitigation stays wired without needing to depend on a console warning in CI.

**Alternatives rejected:**
- **Patch R3F locally** — rejected because it increases maintenance burden and diverges from the package's normal update path.
- **Ignore the warning** — rejected because the app already has a low-risk mitigation available and should use it consistently.

### D-149: Operational evidence memory should be the next platform spine
**Date:** 2026-05-29

**Decision:** Make Operational Evidence Memory the next major platform layer after the provenance graph. The ledger should capture scene edits, scan sessions, AI draft proposals, human corrections, snapshots, simulation runs, report outputs, and future live sensor events.

**Rationale:**
- Provenance summarization is useful, but the full vision needs a durable event memory that can reconstruct site history over time.
- A shared event/evidence spine makes every input mode feel like a compiler into one canonical history, instead of a separate silo.
- Temporal twin, incident replay, live feed alignment, and evidence-backed reporting all become much easier once there is one append-only memory layer.

**Alternatives rejected:**
- **Add another view mode first** — rejected because it deepens the shell without creating the platform memory the shell should reveal.
- **Invest in more importer polish first** — rejected because import alone does not create an auditable site history.
- **Start live sensor fusion first** — rejected because live evidence needs a canonical ledger to land in before it can be useful.

### D-150: Operational evidence ledger should show event kinds and before/after diffs in-product
**Date:** 2026-05-29

**Decision:** Expand the visible operational evidence ledger with explicit event-kind counts, before/after scene summaries, and reconstructable checkpoints so the temporal spine is readable in the UI before it becomes the canonical append-only store.

**Rationale:**
- The operational memory already existed as a visible ledger, but the temporal story is clearer when event types and scene deltas are visible at a glance.
- Before/after summaries make the checkpoint history more trustworthy without forcing users into the raw event payload.
- A richer visible ledger keeps the product aligned with the temporal vision while still allowing the underlying store design to evolve.

**Alternatives rejected:**
- **Leave the ledger as timestamp-only entries** — rejected because it hides the actual change semantics.
- **Jump straight to a full append-only storage rewrite** — rejected because the UI can gain clarity now without locking the storage model too early.

### D-151: Scan intake and AI draft proposals should emit lifecycle events into the operational ledger
**Date:** 2026-05-29

**Decision:** Record launcher-facing scan intake starts, scan session compiles, and AI draft proposals as explicit operational evidence events so the temporal ledger shows how the twin was requested, reviewed, and turned into a scene.

**Rationale:**
- The ledger is more useful when it captures the input-mode lifecycle, not only the finished scene-load event.
- Scan intake and AI draft generation are both user-visible proposals before commit, so they belong in the evidence trail even when the scene itself has not changed yet.
- Capturing these lifecycle events now keeps the visible ledger aligned with the full operational-memory direction without waiting for the append-only store rewrite.

**Alternatives rejected:**
- **Only record the final scene load** — rejected because it hides the proposal and review stages.
- **Wait for the append-only store rewrite first** — rejected because the user-facing ledger can improve now without blocking on the deeper storage decision.

### D-152: Operational evidence events should expose lifecycle branch labels and parent links
**Date:** 2026-05-29

**Decision:** Add lifecycle metadata to operational evidence events so the ledger can distinguish draft, imported, scanned, recovered, simulated, and published branches, and restore events can link back to their parent checkpoint.

**Rationale:**
- A flat event history is not enough once the ledger needs to represent recovery, publication, and review states.
- Branch labels make the visible history easier to scan without asking users to parse raw event kinds.
- Parent-event linkage keeps restored states explainable and supports future merge/replay semantics.

**Alternatives rejected:**
- **Keep only raw event kinds** — rejected because the ledger would still read like a linear log rather than a lifecycle model.
- **Wait for the append-only store rewrite first** — rejected because branch metadata can be added safely now and will carry forward into the deeper store redesign.

### D-153: Operational evidence ledger should support lifecycle and branch filters
**Date:** 2026-05-29

**Decision:** Add lifecycle-stage and branch-label filters to the visible operational evidence ledger so operators can navigate draft, imported, scanned, recovered, simulated, and published history without leaving the provenance surface.

**Rationale:**
- The ledger already exposes the branch metadata, so the next usability gain is to let the operator slice the history by that metadata directly.
- Search alone still leaves too much manual scanning when the user wants to inspect a specific lifecycle phase.
- Filter chips keep the navigation fast and lightweight while remaining consistent with the existing evidence surface.

**Alternatives rejected:**
- **Keep branch data read-only** — rejected because branch metadata is only half the value without navigation.
- **Move branch navigation into a separate page** — rejected because the provenance surface already has the right context for this filtering.

### D-154: SentinelTwin should expose a local governance control plane before multi-user RBAC arrives
**Date:** 2026-05-29

**Decision:** Add a local Governance tab with role selection, review-required vs open-publish policy, review request/approval/rejection actions, and review annotations, and log those control-plane actions into the operational evidence ledger.

**Rationale:**
- The product already has publish/recover provenance, but the control plane still needs a visible place where approval intent is explicit.
- A local governance model makes the current single-user workflow auditable now without pretending backend auth or multi-user RBAC already exists.
- Recording role and policy changes as evidence keeps the publish path explainable and prepares the app for future shared-workspace permission semantics.

**Alternatives rejected:**
- **Keep publish as a blind button** — rejected because the product would still hide the approval model.
- **Pretend multi-user RBAC is already implemented** — rejected because the current codebase is local-first and single-user, so the honest step is a local governance spine first.

### D-155: Branch restores should target explicit lifecycle states
**Date:** 2026-05-29

**Decision:** Allow evidence-backed checkpoint restores to reopen a scene as draft, recovered, or published instead of forcing every restore through a single anonymous recovery branch.

**Rationale:**
- The provenance UI already exposes lineage and compare paths, so the next improvement is to make restore target intent visible too.
- Different restore outcomes are operationally meaningful: a rollback to draft is not the same as reopening a published state.
- Explicit branch targets make the event ledger more useful for future merge/recover semantics and reduce ambiguity in the audit trail.

**Alternatives rejected:**
- **Keep one generic restore action** — rejected because it hides operator intent.
- **Add a separate page for branch choice** — rejected because branch-target recovery belongs beside the existing lineage preview and checkpoint controls.

### D-155: Branch lineage previews should live in the provenance tab before an append-only store rewrite
**Date:** 2026-05-29

**Decision:** Add branch-head lineage previews and point-in-time checkpoint ancestry to the provenance tab so operators can inspect parent chains before restoring or publishing, while leaving the deeper append-only event-store rewrite for a later platform slice.

**Rationale:**
- The ledger already has parent-event links and reconstructable snapshots, so a visible parent-chain preview is the highest-value next usability step.
- Showing lineage in-product makes the temporal model more understandable now without prematurely freezing the storage architecture.
- The deeper branch-merge and append-only persistence work is still important, but it should build on the live navigation/preview surface rather than block it.

**Alternatives rejected:**
- **Wait for the canonical event store first** — rejected because the user-facing lineage preview is useful now and does not depend on the store rewrite.
- **Hide branch ancestry behind a separate page** — rejected because the provenance tab already has the right context for checkpoint navigation.

### D-156: Branch comparison should expose merge-preflight deltas before any merge policy lands
**Date:** 2026-05-29

**Decision:** Add a branch-comparison panel in the provenance tab that lets operators choose left and right lineage heads, inspect their common ancestor, and review scene-count deltas before any future merge policy is designed.

**Rationale:**
- A merge policy is easier to design when the operator can already see how two branches diverge.
- The current store already exposes reconstructable checkpoints, so a comparison view can provide immediate value without a storage rewrite.
- Presenting deltas in the provenance tab keeps the branch workflow in the same context as publish, restore, and lineage preview.

**Alternatives rejected:**
- **Wait for branch merge semantics to be implemented first** — rejected because the UI can and should surface comparison value now.
- **Hide branch comparison until the append-only store rewrite** — rejected because it would delay a useful preflight tool that already has enough data to be meaningful.

### D-157: Restore-to-branch actions should be explicit in the provenance tab
**Date:** 2026-05-29

**Decision:** Add visible restore-to-branch actions from branch lineage and branch comparison views so operators can reconstitute a checkpoint into draft, recovered, or published targets instead of only restoring into one implicit branch.

**Rationale:**
- The store already accepts a target branch for restore operations, so the missing piece is exposing that capability in the lineage UI.
- Explicit targets make the branch model discoverable and prepare the surface for future branch merge semantics.
- Showing restore intent where the user inspects branch ancestry is clearer than hiding it in a generic button.

**Alternatives rejected:**
- **Keep a single implicit restore button** — rejected because it hides the branch target semantics that now matter to the workflow.
- **Move restore-target selection into a separate workflow page** — rejected because it would fragment the provenance flow and dilute the lineage context.

### D-158: Archive restore should allow explicit branch targets in the debug panel
**Date:** 2026-05-29

**Decision:** Add a branch target selector to the debug archive restore workflow so the latest archived checkpoint can be restored as draft, recovered, or published directly from the recovery panel.

**Rationale:**
- The archive already carries the full scene, evidence, and governance state, so the recovery UI should respect the same branch semantics used by provenance restore.
- Explicit branch targets make the archive path useful for real recovery work, not just a generic support import.
- Keeping the branch choice in the debug panel makes the backup / recovery workflow discoverable without hiding it in a separate settings page.

**Alternatives rejected:**
- **Restore only into recovered** — rejected because it would throw away the existing branch model and make archive restore less useful.
- **Hide archive recovery behind the provenance tab only** — rejected because debug is the natural place for backup/restore actions and support workflows.

### D-159: Operational evidence should be exportable as a recovery archive
**Date:** 2026-05-29

**Decision:** Add an explicit operational evidence archive export and restore path that packages the current scene, simulation result, operational evidence ledger, and governance state into a downloadable JSON archive that can be restored back into Studio.

**Rationale:**
- The evidence layer is only truly useful for recovery if it can survive beyond the current browser session.
- A dedicated archive makes the recovery boundary explicit, instead of relying on ad hoc localStorage state.
- Bundling scene, evidence, and governance together preserves the full operational context needed to reconstruct or continue a site state.

**Alternatives rejected:**
- **Leave recovery as raw localStorage only** — rejected because it is not portable, not inspectable, and not a real backup workflow.
- **Split scene, evidence, and governance into separate archives** — rejected because it would make recovery harder and increase mismatch risk between the three states.

### D-160: Archive restore should be gated by merge preflight
**Date:** 2026-05-29

**Decision:** Make the debug archive workflow load the archive first, then require a merge-preflight result before applying it to the workspace. Only same-state or fast-forward-compatible archives can be applied directly.

**Rationale:**
- A recovery archive is useful as a real-world support artifact only if it can be checked against the live ledger before it overwrites state.
- Blindly restoring any archive into the workspace would hide divergence and make the branch model less trustworthy.
- A merge-preflight step keeps the archive path aligned with the provenance branch model and surfaces real conflicts instead of silently discarding current work.

**Alternatives rejected:**
- **Keep direct restore-on-upload** — rejected because it would allow accidental rewinds or overwrites without showing divergence.
- **Require a separate merge page** — rejected because the debug panel is already the recovery surface and should own the preflight.

### D-161: Operational evidence persistence should be append-only journals
**Date:** 2026-05-29

**Decision:** Persist operational evidence as append-only journal batches in localStorage rather than as a single mutable array, while keeping the in-memory ledger API unchanged and preserving the journal payload in exportable archives.

**Rationale:**
- The provenance surface already needs reconstructable lineage and branch comparison, so the browser persistence should preserve a real history trail instead of rewriting the log in place.
- Append-only journal batches make recovery and migration easier to reason about because every append, rebase, merge, clear, restore, or divergent rewrite becomes an explicit record, and carrying the journal itself through archive export keeps those records recoverable without flattening them away.
- Keeping the store API unchanged lets the existing evidence UI continue to work while the storage model becomes more canonical underneath it.

**Alternatives rejected:**
- **Continue storing a single mutable array** — rejected because it preserves the old rewrite model and makes history reconstruction weaker.
- **Move immediately to a remote event store** — rejected because the current slice should make the local browser history model truthful first, before introducing sync or multi-user infrastructure.

### D-162: Diverged archive recovery should perform a conflict-free three-way merge
**Date:** 2026-05-29

**Decision:** When a loaded operational evidence archive diverges from the live workspace but shares a reconstructable ancestor, the debug recovery flow should perform a three-way scene merge and apply it only if the merge is conflict-free. Direct overwrite remains reserved for same-state and fast-forward-compatible archives.

**Rationale:**
- The recovery archive is more useful when it can recover not only identical states but also compatible diverged branches without discarding the live branch.
- A three-way merge keeps the common ancestor explicit and makes the branch model visible instead of treating divergent recovery as a hidden overwrite.
- Blocking only the true conflicts keeps the recovery path honest while still allowing useful local recovery workflows to proceed.

**Alternatives rejected:**
- **Always overwrite the workspace with the archive** — rejected because it would erase local changes and undermine trust in the branch model.
- **Require manual branch comparison before any archive application** — rejected because the debug panel already has the necessary context and should own the merge preflight and application flow.

### D-163: Shared-workspace access should be modeled as a local member-routing layer before backend auth arrives
**Date:** 2026-05-29

**Decision:** Add a local shared-workspace access model with active member selection, single-user vs shared mode, and routing summaries for reviewer roles so the product can expose multi-user-style governance before a backend identity system is wired.

**Rationale:**
- The current product still runs local-first, but the control plane should already reflect the multi-user mental model the platform needs.
- Keeping member routing local first lets the app express who is acting, who can review, and which role is required for approval without pretending a remote auth system exists.
- The access model gives diagnostics, provenance, and recovery a consistent identity layer to carry forward into future backend sync.

**Alternatives rejected:**
- **Wait for backend auth before modeling shared access** — rejected because it would keep the product single-user in practice and delay the shared-workspace UX.
- **Bake the access logic directly into publish buttons only** — rejected because the routing model needs to be visible in the governance panel, archive, and diagnostics surfaces.

### D-164: Runtime incidents and performance traces should be first-class diagnostic bundle data
**Date:** 2026-05-29

**Decision:** Record runtime failures, user-facing validation issues, and performance traces as explicit runtime incidents in the shared store, then surface the incident log and performance trace list in the debug diagnostic bundle instead of leaving them implicit in console output.

**Rationale:**
- The observability layer is more useful when it can explain both the recent path history and the recent runtime failures that produced it.
- Capturing incident kinds and performance traces in the same bundle makes support artifacts more actionable without inventing a separate logging system.
- Keeping the data in the existing store and debug surface preserves the local-first workflow while still making the runtime truth visible.

**Alternatives rejected:**
- **Keep incidents only in the console** — rejected because console-only trace data is not discoverable enough for support workflows.
- **Build a separate telemetry sink first** — rejected because the current slice should make the local diagnostics truthful before introducing external observability infrastructure.

### D-165: Claim-heavy summary surfaces should carry explicit truth labels and be covered by the in-product trust audit
**Date:** 2026-05-29

**Decision:** Add explicit truth labels to the high-visibility summary surfaces that users rely on for product truth, and make the trust-audit manifest verify those labels alongside the existing feature/governance/provenance surfaces.

**Rationale:**
- The product has enough live/computed/simulated/imported/placeholder states now that the UI should tell users what kind of truth each summary is presenting.
- A visible truth label is more durable than relying on implementation context or hidden code comments.
- The trust-audit route is already the right local-first gate for keeping claim-heavy surfaces aligned with the manifest, so it should cover the new labels too.

**Alternatives rejected:**
- **Leave truth labels implicit and rely on component naming** — rejected because component names do not tell users what kind of claim is being shown.
- **Add a separate audit for truth labels later** — rejected because the existing trust-audit harness already owns visible-claim alignment and should remain the single gate.

### D-166: Shared-workspace governance should expose per-action gates in the control plane
**Date:** 2026-05-29

**Decision:** Surface explicit allow/blocked gates for edit, annotate, request review, approve, reject, publish, and restore actions in the governance tab so workspace role, access mode, and scene posture are visible as actionable policy rather than only summary badges.

**Rationale:**
- Shared-workspace RBAC/ABAC is easier to trust when the operator can see per-action results instead of only a high-level role label.
- The existing `canPerformWorkspaceAction(...)` helper already computes the relevant decisions, so the UI should show that policy instead of hiding it.
- The governance tab becomes a better control plane when it explains why a member is allowed or blocked on each workflow step.

**Alternatives rejected:**
- **Keep governance as summary badges only** — rejected because summary badges do not explain which concrete actions are gated.
- **Move action gating to a separate admin screen** — rejected because the current governance tab is already the local control plane for role and approval routing.

### D-167: Provider governance should be visible as a fallback-order dashboard
**Date:** 2026-05-29

**Decision:** Surface provider selection, active model, local-only policy, cloud availability, and fallback order in the debug panel so AI behavior is explainable from the product shell rather than only from configuration state.

**Rationale:**
- Provider selection without visibility into availability or fallback order leaves the AI control plane opaque.
- The debug surface is the right place to show provider health because it already carries runtime, incident, and truth-audit context.
- A shared helper for provider governance keeps the command bar, AI draft launcher, and debug panel aligned on the same model truth.

**Alternatives rejected:**
- **Leave provider governance only in View Settings** — rejected because settings alone do not explain runtime fallback order.
- **Build a separate provider dashboard route first** — rejected because the debug panel already functions as the local operability surface and should own the initial provider-governance view.

### D-168: Provider/model evaluation should be visible as a debug-panel suite
**Date:** 2026-05-29

**Decision:** Add a product-visible model-eval suite in the Debug panel that runs the current provider/model against canonical structured-output fixtures for command parsing, counterfactuals, report generation, and AI layout drafting, while clearly showing pass/fail/skip outcomes.

**Rationale:**
- The provider/model control plane is only trustworthy if prompt changes and provider swaps can be exercised against the same structured-output tasks the app already depends on.
- The Debug panel is the right local-operability surface because it already carries runtime health, incidents, trust audit, and provider governance.
- A visible suite gives operators a stable benchmark without introducing a separate evaluation app or a hidden experiments-only workflow.

**Alternatives rejected:**
- **Leave evaluation only in experiments/** — rejected because the product shell would still lack a local gate for prompt/provider changes.
- **Build a separate provider eval route first** — rejected because the Debug panel already owns local diagnostics and should present the first canonical suite.

### D-169: Model-eval history should persist and compare across runs
**Date:** 2026-05-29

**Decision:** Persist the Debug-panel model-eval suite as a local browser history with a stage-budget summary and a visible comparison trend between recent runs.

**Rationale:**
- A visible eval gate is only useful if operators can see whether the current provider/model is improving or regressing over time.
- The Debug panel already owns the provider-governance surface, so it should also own the persisted history and the immediate run delta.
- A compact local history keeps the feature self-contained without creating a second provider dashboard or a separate telemetry backend.

**Alternatives rejected:**
- **Keep only the latest eval result** — rejected because it hides trend changes and makes provider swaps harder to judge.
- **Push history to a separate analytics service first** — rejected because the operator needs the comparison in the product shell now, not later.

### D-170: Provider health and prompt registry should be visible in the Debug panel
**Date:** 2026-05-29

**Decision:** Add a Debug-panel provider health dashboard plus a canonical prompt registry surface so operators can inspect provider readiness, prompt versions, and structured-output stage metadata in one place.

**Rationale:**
- The model-eval suite is more useful when operators can immediately see which providers are healthy and which prompts are canonical.
- Prompt/version visibility belongs beside the provider-governance controls because the two are part of the same AI operating model.
- Keeping the registry and health dashboard in the Debug panel avoids inventing another governance route while still exposing the missing operational truth.

**Alternatives rejected:**
- **Leave prompt metadata only in code** — rejected because the operator needs to see the registry in-product.
- **Create a separate provider-health page first** — rejected because the Debug panel already owns the local AI diagnostics surface.

### D-171: Provider health should also appear at point of use in the command bar and AI draft launcher
**Date:** 2026-05-29

**Decision:** Mirror the provider-health summary into the command bar and AI draft launcher so the current AI action surface shows the same provider readiness truth as the Debug panel.

**Rationale:**
- Operators should not have to leave the AI action surface to know whether the active provider is healthy, partial, or blocked.
- The command bar and AI draft launcher are the two highest-frequency AI action points, so they should carry the same health summary as the Debug panel.
- Reusing the shared provider-health helper keeps the visible truth aligned across surfaces without duplicating policy logic.

**Alternatives rejected:**
- **Keep provider health only in Debug** — rejected because that leaves point-of-use AI surfaces blind to provider readiness.
- **Create a separate provider status page** — rejected because the product already has a cohesive AI control plane and should not fragment it.

### D-172: Estimated cost and latency policy should be visible alongside provider health
**Date:** 2026-05-29

**Decision:** Surface an estimated cost/latency policy summary with stage readiness thresholds in the Debug panel, command bar, and AI draft launcher, while keeping the actual measured telemetry work open for a future slice.

**Rationale:**
- Operators need a quick budget class readout when selecting a provider or approving an AI draft.
- Estimated policy classes are useful immediately, even before per-run measured telemetry is fully tracked.
- Reusing the shared telemetry helper keeps the policy numbers aligned across the AI surfaces without introducing a second budget model.

**Alternatives rejected:**
- **Wait for measured telemetry before showing anything** — rejected because the product would stay opaque at the point of use.
- **Hide cost/latency policy in Debug only** — rejected because the command bar and draft launcher are the surfaces where the budget choice matters most.

### D-173: Measured AI action telemetry should be visible at point of use
**Date:** 2026-05-29

**Decision:** Record measured AI action telemetry for command parsing, counterfactuals, report generation, and AI layout drafting, and surface the latest measured action in the command bar, AI draft launcher, and Debug panel.

**Rationale:**
- A per-run trail makes the provider story more actionable than estimated budget classes alone.
- Showing the latest action where operators already launch AI work keeps the telemetry useful instead of burying it in Debug.
- Persisting the trail locally keeps the data available for debugging and trend comparison without introducing a separate backend.

**Alternatives rejected:**
- **Keep telemetry Debug-only** — rejected because the command bar and draft launcher need the latest run truth at point of use.
- **Wait for a backend analytics pipeline first** — rejected because the local trail already provides useful measured history and can be expanded later.

### D-174: Support handoff should be visible as a first-class Debug-panel summary
**Date:** 2026-05-29

**Decision:** Surface a support bundle summary card in Debug with the incident snapshot, latest incident, latest performance trace, and AI telemetry trend, and keep the export action labeled `Download Support Bundle`.

**Rationale:**
- Operators need to see what the support artifact contains before they export it.
- A visible support summary reduces the chance that incident data exists only as an opaque download button.
- Reusing the shared diagnostic/support bundle helper keeps the visible summary aligned with the exported payload.

**Alternatives rejected:**
- **Keep the support bundle only as a download button** — rejected because the operator should be able to inspect the artifact content inline.
- **Split support data into a separate page** — rejected because the Debug panel already owns the runtime truth and incident surfaces.

### D-175: External log capture should be first-class in the support bundle
**Date:** 2026-05-29

**Decision:** Add a paste-based external log capture lane in Debug and persist it alongside runtime incidents so the support bundle can export external logs together with the local incident snapshot.

**Rationale:**
- The remaining support gap was not the local incident log itself, but the ability to bring external logs into the same artifact.
- A paste-first capture lane is the lightest way to get browser console, app server, or device logs into the bundle without inventing a backend pipeline first.
- Persisting the capture locally keeps the support artifact useful across reloads and keeps the export aligned with what operators can inspect in Debug.

**Alternatives rejected:**
- **Leave external logs out of the support bundle** — rejected because the bundle would still stop short of the support-ready goal.
- **Wait for remote log ingestion first** — rejected because the local capture path already makes the support bundle materially more useful.

### D-176: Support handoff should include an automated alert summary
**Date:** 2026-05-29

**Decision:** Add an automated alerting summary in Debug and the support bundle that prioritizes runtime incidents and external logs into alert candidates, with a clear escalation recommendation.

**Rationale:**
- Raw incident logs are hard to act on without a prioritization layer.
- A local alert summary gives operators a first pass at what needs escalation while keeping the logic in the same in-product support flow.
- Reusing the same runtime incidents and external log captures keeps the alerting summary aligned with the exported support bundle.

**Alternatives rejected:**
- **Keep alerting as raw incidents only** — rejected because that still leaves the operator to manually infer priority.
- **Wait for a backend alerting pipeline** — rejected because the local alert summary already improves the support flow and can later feed a real pipeline.

### D-177: Persist support-ingest history in Debug
**Date:** 2026-05-29

**Decision:** Keep routed support-ingest submissions in a visible local history list in Debug so the backend-shaped handoff remains auditable across refreshes.

**Rationale:**
- A one-shot routed response is useful, but a support workflow is easier to trust when the operator can revisit prior submissions and see what was routed over time.
- Persisting the ingest history locally keeps the feature aligned with the current browser-first support pipeline while the deeper remote transport remains open.
- Reusing the Debug panel as the triage ledger avoids inventing another support-monitoring surface.

**Alternatives rejected:**
- **Only show the latest ingest response** — rejected because the operator loses the support trail after the next submission.
- **Wait for a remote alerting backend before history** — rejected because the local history already improves the support flow and can later feed the real backend.

### D-178: Support ingest archive should be server-backed with local fallback
**Date:** 2026-05-29

**Decision:** Keep routed support-ingest submissions in a canonical server-side archive behind `/api/support-ingest`, while the Debug panel keeps a local cache fallback for offline visibility.

**Rationale:**
- A one-shot response is not enough once the support flow is meant to be auditable over time.
- The server archive makes the support handoff canonical without forcing a second external monitoring system yet.
- The local cache fallback keeps the panel useful during transient route failures without hiding the fact that the server archive is authoritative.

**Alternatives rejected:**
- **Keep only local history** — rejected because it leaves the route itself stateless and less representative of the future transport model.
- **Push directly to an external service first** — rejected because the project still needs a canonical local route and archive that can be verified inside the studio shell.

### D-179: Support delivery should use a canonical queue before external fan-out
**Date:** 2026-05-29

**Decision:** Add a separate `/api/support-delivery` queue that consumes the canonical support-ingest archive and tracks dispatch attempts before any real external webhook or notification fan-out exists.

**Rationale:**
- Ingest and delivery are different concerns; the product needs a dispatch boundary so future webhook or alert transport does not get mixed into the ingest archive.
- A canonical queue gives operators a visible delivery trail while keeping the implementation local and auditable.
- Keeping the queue separate from ingest also leaves room for genuine remote destinations later without redesigning the support handoff again.

**Alternatives rejected:**
- **Fold delivery into the ingest route** — rejected because it would blur archival and dispatch concerns.
- **Wait for a real external notification service first** — rejected because the project can already verify a delivery boundary locally.

### D-180: Governance tab should expose a visible approval trail
**Date:** 2026-05-29

**Decision:** Add a governance trail section to the Governance tab that surfaces review requests, approvals, rejections, annotations, role changes, and policy changes from the operational evidence ledger.

**Rationale:**
- The control plane already mutates workspace state through evidence-backed actions, but the operator still needs a focused trail to review what happened and when.
- Reusing the operational evidence ledger keeps governance auditability in one canonical history instead of inventing a second log.
- A visible trail makes the local governance workflow easier to trust while backend identity and remote approval routing remain open.

**Alternatives rejected:**
- **Leave governance auditability inside the evidence rail only** — rejected because the operator would have to search the broader timeline to review approvals.
- **Create a separate governance log store** — rejected because it would duplicate the existing evidence trail and create drift.

### D-181: Governance handoff should use a canonical archive queue before remote approval fan-out
**Date:** 2026-05-29

**Decision:** Add a separate `/api/governance-archive` queue that consumes the visible governance trail and tracks dispatch attempts before any real remote approval service or webhook fan-out exists.

**Rationale:**
- Governance approvals are a real product boundary and should have their own archive path rather than piggybacking on support logs.
- The queue gives operators a visible dispatch trail for review requests, approvals, rejections, annotations, and policy changes.
- Keeping the queue separate from support delivery makes the remote-approval routing path explicit for future identity and service integration work.

**Alternatives rejected:**
- **Fold governance into the support queue** — rejected because it would blur incident support and approval routing concerns.
- **Wait for a real identity service first** — rejected because the project can already verify a governance dispatch boundary locally.

### D-182: Workspace membership should have a canonical archive queue before remote identity fan-out
**Date:** 2026-05-29

**Decision:** Add a separate `/api/workspace-membership-archive` queue that captures the current workspace roster, active member, and routing policy before any real remote identity or approval-routing service exists.

**Rationale:**
- Backend identity needs a canonical record of who is active, which members exist, and which route policy is in force.
- Keeping this queue separate from governance approvals keeps identity capture distinct from approval history while still using the same archive/fan-out pattern.
- A visible membership archive gives the Governance tab a backend-shaped identity handoff without waiting for cross-service auth infrastructure.

**Alternatives rejected:**
- **Fold membership capture into governance archive** — rejected because identity records and approval records are different product boundaries.
- **Wait for shared backend identity services first** — rejected because the app can already validate a durable membership archive locally.

### D-183: Workspace membership reconciliation should be a first-class sync action
**Date:** 2026-05-29

**Decision:** Add a `Sync Membership Snapshot` action in the Governance tab that reconciles the current workspace membership against the latest archived membership snapshot and records a `workspace_membership_synced` evidence event.

**Rationale:**
- A backend-identity record is only useful if operators can reconcile the live workspace against it.
- Emitting a dedicated evidence event keeps sync and drift visible in the same audit trail as the rest of the governance history.
- The sync action makes the archive a real operational control instead of a passive history list.

**Alternatives rejected:**
- **Only show drift without a sync action** — rejected because the archive would still be passive.
- **Silently overwrite the live membership state** — rejected because the operator needs an auditable reconciliation step.

### D-184: Scene editing should surface validation feedback instead of silently rejecting edits
**Date:** 2026-05-29

**Decision:** The Studio workbench now surfaces immediate placement feedback for invalid wall, door/window, zone, and path edits, and direct manipulation reuses the same snapping rules as placement.

**Rationale:**
- Silent rejection makes the editor feel broken and hides the difference between a valid edit and a near-miss.
- A shared snap path keeps placement and transform behavior aligned instead of drifting into separate interaction models.
- Validation feedback is now part of the product loop, not just an internal implementation detail.

**Alternatives rejected:**
- **Keep silent rejection** — rejected because users cannot tell whether the editor accepted the edit.
- **Create a second transform-specific snap system** — rejected because it would fork the scene-editing rules and create drift.

### D-184: Active path selection should not auto-fall back to the first path
**Date:** 2026-05-29

**Decision:** Keep `activePathId` explicit and allow it to remain `null` after scene loads, restores, and merges unless the user chooses a path.

**Rationale:**
- The map, replay, and outcome surfaces should reflect the operator's actual selection rather than implicitly promoting the first authored path.
- Automatic fallback made the UI look selected even when no explicit path was chosen, which blurred the distinction between default state and user intent.
- Keeping `activePathId` nullable makes the selection model consistent with the shared map stack and future multi-path workflows.

**Alternatives rejected:**
- **Auto-select the first path on every scene load** — rejected because it hides the empty-selection state and reintroduces implicit behavior.

### D-185: Scene editing should keep keyboard deletion, duplication, and vertex editing in the canonical editor surface
**Date:** 2026-05-29

**Decision:** The Studio workbench should treat delete/backspace, Cmd/Ctrl+D, and polygon/path vertex insertion/removal as first-class editor interactions routed through the shared store-backed editor state and canonical mutation actions.

**Rationale:**
- The editor is only credible if authors can remove, duplicate, and reshape geometry without leaving the workbench or editing JSON directly.
- Keeping these interactions in the canonical store path preserves undo/redo and keeps visual truth aligned with simulation truth.
- Shared validation feedback needs to be visible even when the tool mode is select, otherwise deletion failures become silent again.

**Alternatives rejected:**
- **Leave deletion/duplication to inspector-only actions** — rejected because the canvas would remain too limited for real scene editing.
- **Implement a separate editing state for keyboard flows** — rejected because it would fork the interaction model and risk drift from the scene source of truth.
- **Keep fallback only in the selector layer** — rejected because that still forces a hidden choice into reports and replay state.

### D-185: Camera view selection should not auto-fall back to the first camera
**Date:** 2026-05-29

**Decision:** Keep camera selection explicit in Camera View and let the empty state appear when no camera has been chosen.

**Rationale:**
- Camera View should show what the operator explicitly selected, not silently substitute the first camera in the scene.
- The empty state is useful because it tells the operator the view has no active target yet, instead of implying a choice that was never made.
- This keeps camera selection aligned with the explicit-path behavior already adopted for replay and analysis surfaces.

**Alternatives rejected:**
- **Auto-select the first camera when entering Camera View** — rejected because it hides the empty-selection state and weakens operator intent.
- **Keep the fallback only in the view header** — rejected because the main content would still be driven by an implicit selection.

### D-186: Compare camera pickers should not auto-fall back to the first available cameras
**Date:** 2026-05-29

**Decision:** Leave Compare View camera A/B empty until the operator selects them, instead of defaulting to the first and second cameras in the scene.

**Rationale:**
- Compare is a deliberate inspection workflow, so it should not guess which cameras the operator wants to compare.
- Empty selectors make the explicit choice visible and prevent the view from implying a comparison that was never asked for.
- This keeps Compare aligned with the same selection discipline used in path and camera view surfaces.

**Alternatives rejected:**
- **Auto-fill camera A/B from the first two cameras** — rejected because it hides operator intent and can mislead the initial comparison.
- **Only leave one side empty** — rejected because the comparison needs both sides to be explicit to stay trustworthy.

### D-187: Offline command parsing should not auto-fall back to the first camera or light
**Date:** 2026-05-29

**Decision:** Require an explicit camera or light match in the offline command parser instead of quietly choosing the first scene object.

**Rationale:**
- Command parsing should only act on a target the parser can identify clearly.
- Returning the first camera/light for ambiguous or empty targets hides errors and can change the wrong object without operator intent.
- Null is the safer outcome because the caller already knows how to surface a no-match path.

**Alternatives rejected:**
- **Keep the first-object fallback for ambiguous commands** — rejected because it can mutate the wrong target.
- **Guess based on scene order or status** — rejected because it still invents an implicit choice.

### D-188: Placement oracle should not auto-fall back to the first scene camera
**Date:** 2026-05-29

**Decision:** Let the placement oracle use an active camera candidate or its own template camera instead of borrowing the first camera in the scene.

**Rationale:**
- The oracle is a scoring heuristic, so it should not inherit arbitrary scene ordering when no active camera exists.
- The template camera already captures the oracle's baseline assumptions, so the first-scene fallback was unnecessary.
- Removing the fallback keeps placement recommendations tied to actual active cameras or an explicit template.

**Alternatives rejected:**
- **Keep the first camera fallback for inactive scenes** — rejected because it introduces arbitrary scene-order bias.
- **Return null immediately when no active camera exists** — rejected because the template camera still provides a useful baseline.
