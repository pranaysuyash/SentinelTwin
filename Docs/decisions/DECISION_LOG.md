# Architecture Decision Log

**Format:** D-XXX | Date | Decision | Rationale | Alternatives rejected

---

## D-294 | 2026-06-01 | Deterministic seek-aware path replay timing loop

**Decision:** Path replay playback in `PathReplayView.tsx` now uses a requestAnimationFrame-based timeline loop with an explicit time anchor so slider scrubbing while playing reuses the same loop without stutter or timeline drift.

**Rationale:**
- The previous motion-driven timeline restarted from stale internal state when seeking mid-playback and could visually jump on scrub.
- A deterministic tick loop keeps playback time authoritative in React state while preserving seek updates from user controls.
- Geometry generation in replay now reuses a single shared segment step constant and avoids hard-coded literals, making movement sampling behavior explicit.
- Immediate disposal of dynamically created cone and collision-line geometries prevents scene-object churn across re-renders in long replay sessions.

**Alternatives rejected:**
- Keep Framer Motion `animate` in place with seek re-initialization logic only: rejected due to repeated restarts and fragile timing behavior.
- Pause-and-restart playback state on every slider move: rejected because it produced perceived stutter and broke continuous visibility state updates during scrub.

---

## D-295 | 2026-06-01 | Add primary-button gating for scene interactions and harden scene-theme fallback

**Decision:** Three.js scene nodes now gate selection actions on primary-pointer input (`button === 0`) and resolve invalid themes through a day-theme fallback.

**Rationale:**
- Selection and context actions in `WorkspaceCanvas` and `SharedScene` should behave consistently regardless of input device and prevent non-primary click paths from mutating studio selection state.
- Workspace scene sizing and environment parameters can drift to malformed values during rapid edits or partially hydrated scenes; hard clamps and theme fallback behavior keep scene renderers stable and deterministic.
- `SceneLighting`/`resolveTheme` now uses an explicit fallback so unknown presets cannot produce undefined reads and crash the render branch.

**Alternatives rejected:**
- Keep selection tied to generic click handlers without button checks: rejected due to unpredictable right-click/auxiliary-device side effects.
- Keep direct theme indexing without fallback: rejected due to avoidable render-time null references during malformed state transitions.

## D-296 | 2026-06-01 | Centralize workspace-layout persistence migration in governance slice

**Decision:** Persisted workspace layouts are now canonicalized through the governance-layer `workspace-layouts` helpers and loaded as versioned envelopes.

**Rationale:**
- Move load/normalize/repair flow to one path so layout persistence behaves consistently for seeds, user edits, and migrations.
- Both legacy array payloads and current envelope payloads are normalized against `WorkspaceLayoutRecord` schema, then persisted as `{ schemaVersion: 2, layouts: [...] }`.
- Legacy `sentineltwin_saved_layouts_v1` entries are migrated and removed during load.
- `isWorkspaceLayoutModified` now uses canonicalized key-ordering, so persisted equivalence checks are stable across serialization order.

**Alternatives rejected:**
- Keep layout persistence logic duplicated in `layout-slice.ts`: rejected due to drift and stale migration behavior.
- Keep mixed write formats: rejected because dual formats increase ambiguity in recovery and testing.


## D-244 | 2026-05-30 | Canonicalize site-intake source taxonomy and explicit draft activation

**Decision:** Canonical site-intake sources are now fixed to:
`scan | ai_prompt | floor_plan | json | manual | camera_evidence`.
Legacy aliases (`json_import`, `footage_verify`) are accepted only at normalization boundaries and are immediately translated before compiler/session state. Draft approval must validate and activate `draft.scene` explicitly before any baseline simulation run is allowed.

**Rationale:**
- Source-key drift was creating inconsistent compiler/session behavior and brittle tests.
- Approval previously depended on pre-mutated scene state; this violated a review-first, canonical-draft pipeline.
- Making activation explicit ensures simulation runs from approved truth, not stale workspace state.

**Alternatives rejected:**
- Keep legacy keys in canonical type: rejected due to long-term drift and ambiguity.
- Keep implicit approval behavior: rejected due to non-deterministic handoff and weak provenance semantics.

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

## D-243 | 2026-05-29 | Launcher memory hits should visibly expose exact checkpoint routing when available

**Decision:** Workspace memory search results in the launcher should surface an explicit `Exact checkpoint` badge whenever a hit carries a resolved timeline event id, so deep-link precision is visible to the user instead of hidden in routing state.

**Rationale:**
- The launcher memory flow now preserves exact checkpoint identity for branch-bearing archive hits when the archive record provides a stable event id
- Showing that precision in the result row makes the behavior legible and helps distinguish exact checkpoint jumps from broader branch or timestamp jumps
- The badge makes the launcher contract easier to test and harder to regress silently

**Alternatives rejected:**
- Keep exact checkpoint routing as a hidden field only: works technically, but users cannot tell when a hit is precise versus approximate
- Add a separate visual style for every archive family: unnecessary; the checkpoint badge is enough to communicate precision without making the UI noisy

---

## D-102 | 2026-05-29 | Demo scene is the default launch flow and all other workflows are advanced

**Decision:** The launcher and in-dashboard start surface should present the seeded retail demo as the
single primary path on first render. Floor-plan, scan, AI draft, and video-verify workflows remain
available from an explicit “advanced” expansion path.

**Rationale:**
- Deterministic seeded demo is the only workflow that is fully end-to-end and produces predictable
  onboarding and simulation behavior for first-run users.
- A visible primary demo path reduces first-run ambiguity and prevents users from entering partially
  implemented flows without explicit intent.
- Advanced workflows are still discoverable, but clearly labeled as preview/prototype stages and opt-in.
- This aligns with the product thesis where the loop is `load baseline → run simulation → verify impact →
  replay → recommend` while advanced flows expand input method selection, not replace the baseline.

**Alternative rejected — show all flows equally at startup:**
- Encourages users to start in incomplete pipelines and assume parity across all modalities.
- Dilutes onboarding clarity for operators who need one trustworthy entry path before using tools.
- Increases false expectations because several workflows (guided scan, floor-plan reconstruction, AI draft,
  footage verification) are still explicitly preview/partial by implementation status.

**Implementation:** 
- `StudioDashboardHome` now renders a primary demo action and collapses all non-demo entry routes
  behind an explicit "Explore advanced workflows" control.
- `ProjectStartLauncher` now shows the demo action as the default card and moves all other options
  behind an "Advanced workflows" toggle.

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

## D-103 | 2026-05-29 | Camera view coordinator should delegate chrome, scene helpers, and verification overlays to dedicated modules

**Decision:** `CameraViewMode.tsx` should own orchestration and state plumbing only. The view chrome, scene interaction helpers, and verification overlay rendering now live in separate modules:
- `apps/studio/src/components/view/camera-view-chrome.tsx`
- `apps/studio/src/components/view/camera-view-scene.tsx`
- `apps/studio/src/components/view/camera-verification-overlay.tsx`
- `apps/studio/src/components/view/camera-verification-panel.tsx`
- `apps/studio/src/components/view/camera-verification-workflow.ts`

**Rationale:**
- The camera view had grown into a mixed coordinator/leaf-component file, which made further changes risky and obscured the actual render flow
- Splitting by responsibility keeps the camera view readable while preserving the same runtime behavior and shared store state
- Dedicated modules make it easier to evolve the live feed chrome, scene interaction, and verification UI independently without reintroducing a monolith

**Alternatives rejected:**
- Keep the camera view monolithic and continue shaving warnings: that would preserve the same structural coupling
- Split only one component at a time: slower and leaves the same coordination/leaf-component boundary problem in place

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

## D-039A | 2026-06-01 | Restore Turbopack as the Studio default after green App Router build

**Decision:** Use Turbopack for `apps/studio` dev and build by default again. Keep `STUDIO_DEV_BUNDLER=webpack` as an explicit emergency override through `run-fixed-port.mjs`, but do not force it in the watchdog.

**Rationale:**
- `NEXT_PRIVATE_WORKER_THREADS=false pnpm --dir apps/studio exec next build --turbopack --experimental-app-only` now completes successfully.
- The recent local 500s were stale `.next/dev` artifact and missing-install issues, not a current Turbopack compilation failure.
- Matching dev/build/deploy on Turbopack reduces drift and avoids treating Webpack fallback as the normal path after the underlying blocker is gone.

**Verification:**
- Turbopack App Router-only build completed successfully on 2026-06-01.
- Hydration-sensitive dashboard values are gated behind the existing `hydrated` flag before switching defaults.

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

### D-161: Saved workspaces should carry org-aware metadata before the full org model exists
**Date:** 2026-05-29

**Decision:** Store `workspaceOrganization`, `workspaceOwner`, and `workspaceVisibility` on saved workspace records and surface those fields in the launcher/editor so the catalog can express ownership and visibility now, even though the canonical org/account model is still open.

**Rationale:**
- The launcher needed an honest way to distinguish personal, shared, and published workspaces without waiting for a full org/account backend.
- Keeping these fields on the saved-project record makes the workspace catalog richer without introducing a parallel catalog schema.
- The visible catalog metadata now matches the current product boundary better than folder/tags alone.

**Alternatives rejected:**
- **Wait for the canonical org/account backend first** — rejected because the launcher and workspace browser still need to communicate ownership state now.
- **Use folder and tags as the only catalog metadata** — rejected because they cannot express org, owner, or visibility semantics.

### D-162: Timeline share links should use one canonical builder/parser across the page and provenance surface
**Date:** 2026-05-29

**Decision:** Introduce a shared timeline share-link helper that builds, parses, and restores checkpoint URLs carrying provenance node/edge focus plus timeline event, branch, and query state, and use it from both the Scene Intelligence provenance surface and the app bootstrap.

**Rationale:**
- The checkpoint link contract should live in one place so copy/open/restore all speak the same URL format.
- The provenance tab and the page bootstrap already represent both ends of the timeline link flow, so they should share the same helper instead of duplicating URLSearchParams logic.
- An openable link is more durable than a clipboard-only flow and makes the branch/time timeline contract easier to reuse later for deeper cross-device handoff.

**Alternatives rejected:**
- **Keep the URL logic inline in the component** — rejected because it duplicates the contract and increases drift risk.
- **Leave share links as clipboard-only strings** — rejected because the product needs a reusable and openable checkpoint contract, not just a copied URL.
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

### D-190: Workspace approval routing should be a first-class evidence action
**Date:** 2026-05-29

**Decision:** Add a visible `Resolve Approval Route` action in the Governance tab that compares the live workspace against the latest archived membership snapshot, records a `workspace_approval_routed` evidence event, and surfaces the route status, target reviewer, and drift state in the control plane.

**Rationale:**
- Remote approval routing only becomes trustworthy when the operator can see how the live workspace compares to the archived membership record before route resolution.
- Emitting a dedicated evidence event keeps routing distinct from membership sync while still keeping both in the same audit trail.
- Surfacing route status, target reviewer, and drift state makes the governance control plane explain the actual approval path rather than just the current toggle state.

**Alternatives rejected:**
- **Leave routing implicit inside the publish action** — rejected because the operator would still not see the route decision as its own auditable step.
- **Overwrite membership state instead of recording a route event** — rejected because routing should be visible before reconciliation, not hidden by it.

### D-191: Shared-identity conflict handling should be trust-audited in the Governance tab
**Date:** 2026-05-29

**Decision:** Keep the `Identity Conflict Resolution` surface, the `Resolve Identity Conflict` action, and the remote identity-conflict archive boundary in the Governance tab, and cover the visible copy in the trust-audit manifest so the shared-identity conflict path is treated as a first-class claim surface.

**Rationale:**
- The identity-conflict flow is now a user-facing governance control, so it should be part of the same visible-claim audit as the approval and membership flows.
- Trust-auditing the visible text helps prevent the conflict boundary from drifting out of sync with the actual route/archive implementation.
- The conflict surface remains separate from approval routing and membership sync, which keeps each control-plane boundary understandable.

**Alternatives rejected:**
- **Leave conflict handling only in route code and tests** — rejected because the visible control plane would remain unaudited.
- **Merge conflict handling back into the approval route** — rejected because conflict resolution is its own decision surface and should stay explicit.

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

### D-186: Door and window editing should include a canonical wall-snap action
**Date:** 2026-05-29

**Decision:** The inspector should expose a shared `Snap to Nearest Wall` action for doors and windows so openings can be corrected back onto the closest wall segment without manual coordinate entry.

**Rationale:**
- Openings are easiest to place approximately and then correct precisely.
- A shared wall-snap action keeps placement and inspector correction aligned with the same geometry helper.
- This reduces accidental floating doors/windows while preserving the underlying scene schema.

**Alternatives rejected:**
- **Leave wall correction to numeric fields only** — rejected because it is too brittle for routine editor work.
- **Add separate snap logic per inspector panel** — rejected because it would create drift and duplicate geometry rules.
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

### D-189: MiniCPM-V 4.6 needs a specialized extraction handler (different HF API pattern)
**Date:** 2026-05-29

**Decision:** Add `_run_minicpm_extraction()` in `runner.py` instead of trying to make `_run_transformers_vlm_extraction()` handle MiniCPM's unique `processor.apply_chat_template(tokenize=True, ...)` pattern.

**Rationale:**
- MiniCPM-V 4.6 uses a non-standard API where `apply_chat_template` with `tokenize=True` does both tokenization and image processing in one call (returns `input_ids`, `pixel_values`, `image_grid_thw`)
- The standard `_run_transformers_vlm_extraction` uses `tokenize=False` then a separate `processor(images=image, text=text)` call, which fails for MiniCPM
- MiniCPM-V 4.6 requires `downsample_mode` passed to both `apply_chat_template` AND `generate`

### D-226: SentinelTwin should use a hybrid contextual object-action menu in the 3D workbench
**Date:** 2026-05-29

**Decision:** Surface object-specific 3D actions through a right-click context menu anchored to the selected object, while keeping transform handles and inspectors as the canonical precision surfaces.

**Rationale:**
- The editor already has store-backed selection, snapping, and transform handles, so the contextual layer can sit on top of the canonical scene model rather than replacing it.
- A contextual menu makes frequent object actions discoverable and faster without forcing every adjustment into the inspector.
- The menu can be object-specific while still routing every mutation through the same update/duplicate/delete/focus paths as the rest of the workbench.

**Alternatives rejected:**
- **Inspector-only editing** — rejected because it is too slow for common spatial adjustments.
- **Radial menu as the only control surface** — rejected because it reduces discoverability and could feel too game-like for the operator workspace.
- **Separate interaction state or scene model** — rejected because it would create drift from the SecurityScene source of truth.
- Images must be passed via `{"type": "image", "url": path}` not PIL objects in the messages

**Alternatives rejected:**
- **Generalize `_run_transformers_vlm_extraction`** — rejected because it would make the existing code more fragile and harder to reason about. The MiniCPM pattern is fundamentally different (one-step vs two-step processing).
- **Add `downsample_mode` to every local model call** — rejected because only MiniCPM uses it; it would add noise to other models.

### D-190: Floor plan VLM bakeoff — cloud APIs dominate local MPS models
**Date:** 2026-05-29

**Decision:** Accept that practical floor plan VLM inference requires either cloud APIs or GGUF-quantized local models. Models >=4B params cannot run on Apple Silicon via transformers.

**Rationale:**
- MiniCPM-V 4.6 (1.3B, smallest candidate): wall F1=0.094, P50=96s — too small, too slow
- Qwen3.5-4B: failed to complete 1 image in 15 minutes on MPS
- Qwen2.5-VL-7B: wall F1=0.661 but P50=86s — barely feasible
- GPT-4o: wall F1=0.964, P50=5s — 20x faster AND better
- Four new candidates configured but all require CUDA or GGUF to evaluate

**Alternatives rejected:**
- **Continue evaluating larger local models on MPS** — rejected as impractical. Qwen3.5-4B alone would take >1 hour for 5 images.
- **Downgrade to CPU inference** — would be even slower than MPS.

### D-191: Novel algorithm map focus should leave a transient visual highlight
**Date:** 2026-05-29

**Decision:** When the Novel Algorithms navigator focuses a scene point, keep the existing camera/map focus behavior and also emit a short-lived highlight marker in the map views.

**Rationale:**
- The action already changes viewport state through `focusScenePointRequest`, but that alone is easy to miss visually.
- A transient marker makes the interaction legible in the minimap and path map without introducing a second navigation model.
- Keeping the highlight derived from the same focus request preserves one source of truth and avoids a parallel focus system.

**Alternatives rejected:**
- **Only move the camera and clear the request immediately** — rejected because the action reads as a silent state mutation.
- **Add a permanent selected-node state for the focus point** — rejected because the focus target is not always a real scene node and the marker should be transient.
- **Create a separate highlight store unrelated to focus requests** — rejected because it would duplicate the navigation contract and invite drift.

### D-192: Compare and report snapshot selection should stay explicit
**Date:** 2026-05-29

**Decision:** Compare View and Report Lite should require an explicit snapshot selection and should not silently fall back to the newest saved snapshots when the selection is empty.

**Rationale:**
- Hidden snapshot defaults create the same class of drift we already removed from path and camera selection.
- Compare/report exports are evidence surfaces, so implicit baseline/proposed choices can misrepresent what the user actually selected.
- Empty-state prompts make the selection intent visible and keep the before/after workflow honest.

**Alternatives rejected:**
- **Auto-fill the newest snapshots for convenience** — rejected because it hides state and makes compare/report output look selected when it is not.
- **Auto-fill the two latest snapshots after a refresh** — rejected for the same reason and because it reintroduces ordering bias.

### D-193: Before / After tab should not auto-pick the latest snapshots
**Date:** 2026-05-29

**Decision:** The Before/After analysis tab should require explicit before/after snapshot selection and should not auto-bind to the newest two saves.

**Rationale:**
- Before/After is an evidence comparison surface, so the chosen pair must be visible and intentional.
- Reusing the newest saved snapshots creates the same hidden-default problem we removed from the compare and report surfaces.
- Explicit selectors make the comparison state clearer when the panel is opened from the bottom drawer.

**Alternatives rejected:**
- **Use the latest two snapshots as the default** — rejected because it hides state and can misrepresent the pair under review.
- **Infer the pair from compare report selection only** — rejected because the bottom-panel tab should remain directly usable on its own.

### D-194: Camera View DORI insight should require an explicit critical zone
**Date:** 2026-05-29

**Decision:** Camera View should only render the DORI insight card when a critical zone is explicitly selected, instead of falling back to the first critical zone in the scene.

**Rationale:**
- The zone insight is a direct analysis surface, so it should reflect the user’s chosen zone rather than scene ordering.
- Auto-picking the first zone hides intent and makes the panel feel like it knows more than it does.
- An empty-state prompt is more honest and matches the explicit selection pattern used across the compare/report surfaces.

**Alternatives rejected:**
- **Keep the first critical zone fallback** — rejected because it introduces implicit ordering bias.
- **Auto-select the most important zone** — rejected because it still hides user intent and creates another ranking heuristic.

### D-195: Metrics target quality should follow explicit zone selection
**Date:** 2026-05-29

**Decision:** The Metrics tab should display target quality requirements only when a critical zone is explicitly selected, instead of showing the first zone in the scene.

**Rationale:**
- Metrics still need to be honest about what they are summarizing.
- Showing the first zone implied a default target that the user never chose.
- An explicit prompt keeps the target-quality metric aligned with the selected node model used elsewhere in Studio.

**Alternatives rejected:**
- **Keep the first critical zone as the target sample** — rejected because it hides intent and creates arbitrary ordering bias.
- **Choose the zone with highest risk automatically** — rejected because it adds a new heuristic instead of fixing the hidden default.

### D-196: Shared critical-zone selectors should prefer intent or priority over scene order
**Date:** 2026-05-29

**Decision:** Shared helpers that need a critical zone without an explicit user selection should prefer label intent or a deterministic priority ranking over raw scene order.

**Rationale:**
- Offline commands, auto path generation, and adversarial-path scoring all need a fallback target when the user has not selected a zone.
- Choosing the first zone creates arbitrary scene-order bias.
- A shared priority helper keeps the heuristics consistent and easier to audit.

**Alternatives rejected:**
- **Keep using the first critical zone** — rejected because it ties behavior to array order.
- **Duplicate the selection heuristic in each caller** — rejected because it would drift across features and become harder to reason about.

### D-194: Sensor live signals should flow through the operational evidence trail
**Date:** 2026-05-29

**Decision:** Treat sensor triggers, heartbeats, faults, and restores as first-class operational evidence events and surface them in the sensor tab and camera overlays, while keeping real ONVIF/external ingest as the next integration step.

**Rationale:**
- The schema already models sensors, but without live event evidence the sensor layer still reads like static inventory.
- Writing the live signals into the same operational trail as other scene actions keeps the temporal story canonical and makes Scene Intelligence able to reason about them immediately.
- Surface-level overlays in the camera and sensor tabs make the live evidence legible without creating a second, disconnected monitoring surface.

**Alternatives rejected:**
- **Keep sensor activity as a local-only UI feed** — rejected because it would hide the evidence trail from provenance and report surfaces.
- **Jump straight to ONVIF ingestion before local signal handling** — rejected because the repo still needs a canonical local event model for future external metadata.

### D-195: Pasted sensor metadata should resolve into canonical sensor evidence
**Date:** 2026-05-29

**Decision:** Accept pasted JSON or NDJSON sensor metadata in the sensor panel, resolve it against the current scene sensors, and convert the matched records into canonical live sensor evidence events.

**Rationale:**
- The app needs a concrete intake seam before any real external feed integration can be trusted.
- A pasted batch preserves a deterministic, local-first workflow that can be exercised immediately without depending on hardware or network availability.
- Matching by sensor id or label keeps the intake path useful for real metadata samples while still requiring the scene to provide canonical sensor identity.

**Alternatives rejected:**
- **Freeform text parsing only** — rejected because it would be too ambiguous to map reliably into evidence records.
- **Make the intake write raw logs only** — rejected because the point is to advance the canonical evidence graph, not create a separate log bucket.

### D-196: Scene Intelligence should surface sensor live evidence
**Date:** 2026-05-29

**Decision:** Show sensor live events inside the Scene Intelligence / provenance surface so sensor activity is part of the temporal story alongside snapshots, change-log entries, and operational memory events.

**Rationale:**
- The provenance surface is the canonical place where the app explains what changed and why.
- If sensor evidence only appears in the sensor tab, the temporal story stays fragmented and operators have to hop across panels to understand live activity.
- Surfacing the events here keeps the operational timeline coherent without introducing a separate live-monitoring subsystem.

**Alternatives rejected:**
- **Keep sensor events isolated in the Sensors tab** — rejected because it would make the evidence trail harder to follow.
- **Build a duplicate live monitoring dashboard** — rejected because it would create a parallel truth source for the same evidence.

### D-197: Debug should reuse the same sensor metadata parser
**Date:** 2026-05-29

**Decision:** Let the Debug panel reuse the same pasted sensor metadata parser and sensor event writer as the Sensors panel instead of creating a second ingest implementation.

**Rationale:**
- The parser and event writer are the canonical contract for local live metadata.
- Reusing the same intake path keeps support/debug, sensor operations, and provenance aligned.
- A single parser avoids drift between the operator-focused sensor workflow and the diagnostic/support workflow.

**Alternatives rejected:**
- **Build a separate debug-only ingest parser** — rejected because it would duplicate the canonical intake contract.
- **Keep Debug limited to external logs only** — rejected because the repo already has enough structure to route sensor metadata into the same evidence trail.

### D-198: Sensor metadata intake should also exist behind an API boundary
**Date:** 2026-05-29

**Decision:** Expose a dedicated `/api/sensor-ingest` route that accepts pasted sensor metadata and returns canonical live sensor events so the intake path has a backend-shaped boundary in addition to the local parser.

**Rationale:**
- The repo needs a reusable seam for future external integrations, not only a client-only helper.
- A route makes the metadata intake path testable as an API contract and keeps the UI code from becoming the only implementation.
- Returning normalized sensor events keeps the backend-shaped contract focused on canonical evidence rather than raw logs.

**Alternatives rejected:**
- **Keep sensor ingest client-only** — rejected because it would weaken the boundary needed for future external feed binding.
- **Make the route persist sensor state independently** — rejected because the canonical store should remain the place that mutates the live scene and event trail.

### D-199: Exported reports should include an operational evidence appendix
**Date:** 2026-05-29

**Decision:** Include a first-class operational evidence appendix in single-scene and compare report exports so the handoff artifact carries change-log counts, evidence counts, sensor-related evidence, and recent evidence entries alongside the simulation summary.

**Rationale:**
- The report is the product-facing artifact that stakeholders keep, so it should carry the same ledger story as the in-app provenance surface.
- Evidence counts and recent entries make the exported artifact more auditable without forcing the user back into the studio shell.
- Keeping the appendix derived from the scene change log preserves a single canonical source instead of inventing a parallel report-only ledger.

**Alternatives rejected:**
- **Leave evidence only in the in-app provenance tab** — rejected because exported reports would remain too thin for handoff.
- **Create a separate evidence export format first** — rejected because the report artifact is the highest-leverage place to surface the evidence trail immediately.

### D-200: Compact report summaries should expose the evidence trail
**Date:** 2026-05-29

**Decision:** Add an `Evidence Trail` line to the compact report summary strip so the first-glance report card shows change-log and evidence counts before the user opens the full report or export artifact.

**Rationale:**
- The compact summary is the operator’s first read on what happened, so evidence presence should be visible there too.
- Showing evidence counts in the summary keeps the summary, preview, and exported artifacts aligned around the same canonical ledger.
- It gives the bottom-row/report-card surfaces a concrete bridge to the provenance and report handoff flows.

**Alternatives rejected:**
- **Keep evidence only in the detailed report view** — rejected because the compact summary would still feel disconnected from the rest of the evidence-led flow.
- **Add a separate evidence-only panel** — rejected because the evidence trail already belongs in the existing report summary contract.

### D-200: Camera Wall and Path Replay should carry their own high-signal summary strips
**Date:** 2026-05-29

**Decision:** Keep the Camera Wall mode controls and the Path Replay selection/metrics strip inside their respective view components so the design-pack targets remain visible in the workspace, rather than forcing the user to reconstruct the mode state from lower panels alone.

**Rationale:**
- The reference screens present these mode-specific controls at the top of the active surface, not only in the surrounding panels.
- Putting the summary strip in the view itself makes the active mode feel intentional and reduces the gap between the screenshot targets and the live shell.
- The controls remain thin wrappers around existing store state, so the view stays authoritative without creating a duplicate state model.

**Alternatives rejected:**
- **Leave all path and layout controls only in the bottom panel** — rejected because the mode surfaces would feel flatter and less like the reference product.
- **Create a separate control system just for these views** — rejected because that would duplicate state and drift from the canonical store-backed selection model.

### D-201: Report and compare surfaces should export a reusable evidence bundle
**Date:** 2026-05-29

**Decision:** Add a versioned JSON evidence bundle export from the report and compare surfaces that packages the scene, report data, compare context, and evidence trail as a reusable handoff artifact.

**Rationale:**
- The operator needs a durable artifact that travels with the evidence trail, not only rendered prose or HTML.
- JSON keeps the bundle structured enough to be re-imported, archived, or post-processed by support and future integrations.
- Reusing the canonical report and compare objects avoids inventing another parallel summary schema.

**Alternatives rejected:**
- **Expose only HTML/Markdown/PDF** — rejected because those are presentation formats, not a reusable evidence package.
- **Create a separate evidence-only schema with no report context** — rejected because the report and compare objects already carry the canonical scene story.

### D-202: Support bundles should include the canonical report evidence bundle
**Date:** 2026-05-29

**Decision:** Include the versioned report evidence bundle inside the support bundle so the support handoff carries the same canonical report/evidence artifact alongside the diagnostic bundle.

**Rationale:**
- Support handoffs often need the diagnostic bundle and the user-facing report context together.
- Reusing the same canonical report evidence bundle avoids splitting the exported truth into two parallel JSON shapes.
- It makes the support path a superset of the report handoff instead of a separate artifact family.

**Alternatives rejected:**
- **Keep support bundles diagnostic-only** — rejected because the report/evidence context is part of the real support story.
- **Create a second support-specific evidence schema** — rejected because it would duplicate the same canonical scene/report story in another shape.

### D-203: Camera Wall synchronized timestamps should follow the simulation clock
**Date:** 2026-05-29

**Decision:** Drive the Camera Wall tile timestamps from the shared simulation timestamp when synchronized mode is enabled, and only fall back to live wall-clock time when the user explicitly disables synchronization.

**Rationale:**
- The design target shows all visible camera tiles carrying the same shared time, which is only honest if the mode is tied to a common simulation timestamp.
- A real synchronized-time toggle should affect the rendered timestamp, not just the label on the control.
- Using the simulation timestamp preserves a consistent route/scene story across feeds and makes the wall more readable.

**Alternatives rejected:**
- **Leave the timestamp as wall-clock only** — rejected because it makes the synchronized-time control decorative instead of functional.
- **Introduce a separate wall clock state per tile** — rejected because that would fragment the wall into unrelated times and drift from the reference.

### D-204: Sensor ingest should persist a history-backed archive boundary
**Date:** 2026-05-29

**Decision:** Treat `/api/sensor-ingest` as a history-backed ingest boundary that stores each parsed sensor metadata submission alongside its derived live events, summary, and scene context.

**Rationale:**
- The sensor lane already has a canonical local event model, so the next leverage point is persistence and replay rather than another parser variant.
- A history-backed ingest boundary makes the live evidence path auditable and replayable without inventing a parallel storage mechanism.
- Reusing the route pattern from support and governance keeps the live sensor seam aligned with the rest of the operational handoff architecture.

**Alternatives rejected:**
- **Keep sensor ingest client-only** — rejected because it would weaken the boundary needed for future external feed binding.
- **Create a separate sensor-specific evidence schema with no history** — rejected because it would duplicate the same live-evidence story without making it replayable.

### D-205: Support bundles should carry the sensor ingest archive
**Date:** 2026-05-29

**Decision:** Include the recent sensor ingest archive summary inside the support bundle so live metadata handoff travels with the diagnostic and report evidence package.

**Rationale:**
- The sensor archive is part of the operational evidence trail, so leaving it out of the support bundle would split the same handoff story across multiple exports.
- The support bundle already carries the canonical report evidence and diagnostic state, so the sensor archive belongs in the same transport shape.
- Surfacing the archive in the debug panel makes the evidence chain visible instead of hidden in local storage or a route response.

**Alternatives rejected:**
- **Keep sensor ingest archive separate from support bundle** — rejected because operators would need to piece together evidence from multiple exports.
- **Duplicate the archive in another export format only** — rejected because the support bundle should remain the canonical handoff payload.

### D-206: Workspace membership archives should carry the approval route summary
**Date:** 2026-05-29

**Decision:** Include the computed workspace approval route summary in the workspace membership archive payload and history so approval routing travels with the canonical identity snapshot.

**Rationale:**
- The archive already stores the identity snapshot that approval routing depends on, so carrying the route summary keeps the decision and its evidence together.
- Approval routing depends on the current scene and workspace state, which are available at dispatch time in the Governance tab but not recoverable from the archive alone.
- Persisting the route summary in the same queue avoids splitting membership evidence from the route that membership implies.

**Alternatives rejected:**
- **Recompute the approval route later from the archived workspace alone** — rejected because the route depends on scene context that the archive does not reconstruct perfectly.
- **Keep the route only in the visible Governance tab** — rejected because the archive would then lose the actual routing decision that operators acted on.

### D-207: Support bundles should include the live approval route summary
**Date:** 2026-05-29

**Decision:** Include the current workspace approval route summary in the diagnostic/support bundle so governance routing travels with the broader support handoff.

**Rationale:**
- The support bundle already carries governance and access state, so carrying the resolved approval route keeps the support artifact aligned with what the operator sees.
- The current approval route is a derived truth from scene, workspace access, and governance state, so it belongs in the diagnostic bundle rather than being recomputed by a remote consumer.
- Including it makes the support payload more actionable for routing-related incidents and escalation reviews.

**Alternatives rejected:**
- **Leave approval routing out of the support bundle** — rejected because the support artifact would be missing a key governance decision.
- **Expose approval routing only in the UI** — rejected because support handoffs need the same routing context as the operator-facing control plane.

### D-208: Approval routing should be archived through a canonical route endpoint
**Date:** 2026-05-29

**Decision:** Add a dedicated `/api/workspace-approval-route` endpoint that archives the resolved approval route, fan-out status, and current governance context so approval routing can be dispatched and replayed as its own canonical control-plane artifact.

**Rationale:**
- Approval routing is a distinct handoff from membership archival, so it deserves its own archive boundary rather than being folded into the membership record alone.
- The route endpoint makes the operator action auditable with the resolved route, delivery attempts, and route history in one place.
- Keeping the route archive separate preserves the membership archive as the identity snapshot while still letting the route travel alongside it.

**Alternatives rejected:**
- **Keep approval routing only in the local Governance tab** — rejected because the route would not be replayable or fan-out capable.
- **Fold approval routing into the membership archive only** — rejected because the route is a separate control-plane action with its own delivery semantics.

### D-209: Workspace identity conflicts should have their own archive boundary
**Date:** 2026-05-29

**Decision:** Add a dedicated `/api/workspace-identity-conflict` endpoint that archives drift against the latest membership snapshot, the resolved approval route context, and fan-out attempts so shared-identity conflict handling has a canonical record before real backend identity services exist.

**Rationale:**
- Membership archival captures the canonical identity snapshot, but conflict handling needs its own artifact because reconciliation and fan-out semantics are distinct from the snapshot itself.
- The conflict archive keeps the current/live access state, archived access state, route context, and delivery attempts together so remote shared-identity workflows can reason about reconciliation without re-deriving the drift later.
- Separating the conflict record from both the membership archive and the approval-route archive preserves each control-plane boundary while still letting them travel together in the Governance tab.

**Alternatives rejected:**
- **Fold conflict handling into the membership archive only** — rejected because the snapshot and the conflict decision are different product boundaries.
- **Wait for a real backend identity service first** — rejected because the app can already model the conflict boundary locally and should not leave that workflow implicit.

### D-210: Workspace identity conflicts should resolve to an explicit policy recommendation
**Date:** 2026-05-29

**Decision:** Make the `/api/workspace-identity-conflict` response return a concrete resolution status, resolution label, reason, and recommended action so the identity-conflict boundary behaves like a real policy service rather than only a historical archive.

**Rationale:**
- Shared-identity conflict handling needs an actionable policy outcome, not just a snapshot of drift.
- Returning a resolution from the same boundary keeps the policy decision aligned with the archived evidence and avoids a second derivation step in the UI.
- The explicit recommendation makes the Governance tab useful as a control plane for reconciliation, review routing, and publish readiness.

**Alternatives rejected:**
- **Keep the conflict boundary archival-only** — rejected because the product needs a concrete policy recommendation for the operator.
- **Derive the resolution only in the UI** — rejected because the policy boundary should remain canonical and reusable by future services.

### D-211: Sensor ingest should accept external feed URLs through the canonical ingest route
**Date:** 2026-05-29

**Decision:** Extend `/api/sensor-ingest` so it can pull JSON or NDJSON from a live feed URL, archive that source metadata, and route the resulting sensor evidence through the same canonical ingest path as pasted metadata.

**Rationale:**
- Live evidence fusion should not fork into a separate feed pipeline before the scene model learns about the evidence.
- Reusing the canonical ingest route keeps pasted metadata and external pulls in one archive/history model, which makes provenance, support handoff, and future ONVIF binding easier to reason about.
- The sensor panel can now operate as a real bridge from remote metadata into the operational evidence trail instead of only being a paste box.

**Alternatives rejected:**
- **Create a separate external-feed API** — rejected because it would duplicate the ingest boundary and drift from the canonical sensor history.
- **Keep external feeds client-only** — rejected because external feed binding belongs in the same server-side ingest boundary that archives the evidence.

### D-212: Camera metadata should ingest through the canonical camera-metadata route
**Date:** 2026-05-29

**Decision:** Add a dedicated `/api/camera-metadata-ingest` boundary that accepts pasted JSON/NDJSON or an external feed URL, archives the source metadata, and applies matched camera state deltas through the canonical store.

**Rationale:**
- Camera health metadata is part of the same operational evidence story as sensor ingress, so it should travel through a single canonical ingest boundary rather than a UI-only shortcut.
- Resolving camera metadata against the live scene cameras lets the inspector update camera status, clarity, and night-mode state through the existing store/evidence path instead of inventing a parallel camera history.
- The archive/history boundary keeps the operator-facing bridge, support bundle, and future ONVIF binding aligned around the same evidence model.

**Alternatives rejected:**
- **Keep camera metadata client-only** — rejected because the evidence would not be replayable or archive-backed.
- **Fold camera metadata into sensor ingest** — rejected because camera health metadata is distinct from sensor evidence and deserves its own archive boundary.

### D-213: Camera metadata ingest should persist as a store-backed event stream
**Date:** 2026-05-29

**Decision:** Persist camera metadata ingest as its own scene-scoped event stream in the studio store and surface the latest events in the live camera overlays and provenance timeline.

**Rationale:**
- A camera-metadata route without a durable event stream would still leave the operator story fragmented between the inspector, camera glass, and provenance trail.
- Keeping the event stream in the store makes the latest camera health state immediately reusable by live camera views, Scene Intelligence, and future ONVIF bindings without re-fetching the archive endpoint.
- The event stream complements the canonical ingest route: one boundary archives the submission, the store preserves the operational event record, and the UI can reuse the same truth in multiple places.

**Alternatives rejected:**
- **Keep the camera metadata event local to the inspector** — rejected because the state would vanish from the rest of the operator experience.
- **Store only the archived raw feed without an event stream** — rejected because the product needs a live, queryable event trail for the camera glass and provenance surfaces.

### D-214: Live camera binding should persist as a canonical camera connection event stream
**Date:** 2026-05-29

**Decision:** Persist live camera bindings as a scene-scoped camera connection event stream in the studio store, back them with the camera node’s live-feed fields, and surface the latest bindings in the camera glass and Scene Intelligence provenance trail.

**Rationale:**
- Live camera binding is a separate operational action from camera-health metadata, so it needs its own canonical event trail.
- Keeping the binding on the scene graph lets the camera inspector, camera glass, and provenance surface read the same truth without inventing parallel connection state.
- A live binding event stream creates the right seam for the eventual ONVIF/RTSP/device-protocol integration without waiting for that integration to exist first.

**Alternatives rejected:**
- **Store live binding only in component state** — rejected because the live connection would disappear from the camera glass and evidence trail.
- **Fold live binding into the metadata archive** — rejected because metadata health and device connection are distinct actions with different operational meanings.

### D-215: Live camera binding should probe through a canonical backend route before updating the scene graph
**Date:** 2026-05-29

**Decision:** Route live camera binds and disconnects through a dedicated camera-live-connection probe/archive boundary so the operator UI receives an observed connection result before updating the scene graph.

**Rationale:**
- A backend round-trip gives the live connection seam a real protocol-shaped boundary instead of only trusting local form state.
- The probe/archive route preserves the same evidence pattern as the sensor and camera metadata ingest boundaries, which keeps the operator story and the archived artifact aligned.
- Returning the observed connection state from the route lets the camera scene node, camera glass, and Scene Intelligence reflect the same result the backend archived.

**Alternatives rejected:**
- **Keep live camera binding client-only** — rejected because the UI would still be the only place that knows whether the bind was actually archived.
- **Skip a probe/archive boundary and mutate the scene directly** — rejected because the live connection would remain a local-only affordance with no canonical backend evidence trail.

### D-216: Live camera bindings should refresh as a canonical session lease while connected
**Date:** 2026-05-29

**Decision:** Treat connected live camera bindings as renewable session leases by allowing the inspector to refresh the canonical live-connection route with the existing session id, start time, and confirmation time while the camera remains connected.

**Rationale:**
- A bind-only model still treats the connection as a one-shot probe, which is not enough to represent a long-running camera session.
- Preserving the same session id across refreshes makes the archive, support bundle, and camera glass read like a real operational lease instead of a sequence of unrelated binds.
- A refresh action keeps the route canonical while giving the operator a visible way to renew the session without inventing a parallel management path.

**Alternatives rejected:**
- **Keep the session as a one-shot bind only** — rejected because the connection would still read like a single probe rather than a maintained live session.
- **Move refresh handling into component state only** — rejected because the session lifecycle would disappear from the canonical archive and support handoff.

### D-222: Live camera transport sessions should remain distinct from the operator lease registry
**Date:** 2026-05-29

**Decision:** Model the device/protocol-side session identity separately from the operator-facing live-session lease by recording a transport session handle, transport state, heartbeat, probe count, and protocol profile alongside the lease registry and scene graph fields.

**Rationale:**
- The operator lease answers "is this camera session alive and when does it expire?" while the transport handle answers "what protocol-side session did the probe or refresh negotiate?"
- Keeping both surfaces distinct lets the inspector, camera glass, archive, and support bundle explain the full lifecycle without collapsing transport negotiation into the lease timer.
- This is a cleaner stepping stone toward real ONVIF/RTSP session management because the data model now reserves room for a true device-side handle and heartbeat loop.

**Alternatives rejected:**
- **Collapse transport details into the lease registry only** — rejected because the transport-side identity would be lost and the model would still look like a single lease.
- **Keep transport details only in the backend response** — rejected because the scene graph, support bundle, and operator surfaces would still not share the same transport truth.

### D-221: Floor plan understanding pipeline — two-tier local-first triage → cloud API
**Date:** 2026-05-29

**Decision:** Design the floor plan understanding pipeline as two tiers: (1) always-run local MiniCPM-V 4.6 for semantic triage (classification, OCR, quality, coarse zones), then (2) gated cloud API call (GPT-4o / Gemini 2.5 Flash) for precise geometry extraction only when Tier 1 passes quality checks.

**Rationale:**
- Geometry extraction and scene understanding are fundamentally different capability curves. Small VLMs (1.3B) are useless for geometry (wall F1=0.094) but genuinely useful for classification (~2s), OCR (~8s), and coarse zone detection (~16s).
- Cloud APIs dominate geometry (GPT-4o wall F1=0.964, P50=5s) but cost $0.01-0.02 per image. Gating with local triage saves money on blurry/noisy inputs.
- Tier 1 provides OCR context for Tier 2 prompts (room labels, dimensions), improving cloud geometry accuracy.
- Pipeline is fully feasible on a MacBook Pro — Tier 1 runs entirely on-device in ~5-15s.

**Alternatives rejected:**
- **Cloud-only pipeline** — rejected because it costs $0.01-0.02 for every image including garbage input, and provides no offline fallback.
- **Local-only pipeline with a larger model** — rejected because no local model >=4B can run practically on MPS. Only 1.3B models are feasible locally.
- **Single model for all tasks** — rejected because no model excels at both geometry and semantic understanding in our eval set. MiniCPM-V 4.6 is weak at geometry; GPT-4o is weak at fine-grained scene classification (1/5).
- **Parallel local + cloud with result merge** — rejected as over-engineering for V0. The sequential gate pattern is simpler and provides natural cloud cost savings.

### D-220: Formal truth ladder per node (reviewStatus + sourceTrace)
**Date:** 2026-05-29

**Decision:** Add `reviewStatus`, `sourceTrace`, and `geometryValidity` fields to the base node schema in SecurityScene, representing a formal "truth ladder" from unreviewed AI output to verified/certified ground truth.

**Schema addition:**

```ts
reviewStatus: z.enum(["unreviewed", "accepted", "corrected", "calibrated", "verified"]).default("unreviewed")
sourceTrace: z.string().default("")  // model/pipeline/version identifier
geometryValidity: z.enum(["valid", "suspect", "invalid"]).default("valid")
```

**Rationale:**
- Currently every node has a `source` enum (manual/ai/scan/import/preset/demo) but no review/workflow state. The same node could be AI-generated and user-confirmed, but the schema only records the origin, not the trust level.
- Reports need to express "wall 12: level 2 (user-confirmed)" rather than "wall 12: unknown trust."
- The concept already works at the system level (OperationalEvidenceEvent confidence, scene review/approve/reject governance) but doesn't exist at the individual node level.
- Adding to the base schema makes every node type uniformly trustworthy-aware.

**Alternatives rejected:**
- **Keep trust only at the event level** — rejected because individual nodes in a scene compiled from multiple sources need per-node trust indicators. A scene can have 3 AI-generated walls, 5 user-confirmed walls, and 10 scan-sourced walls — the event level can't represent this granularity.
- **Use a separate trust store outside the schema** — rejected because it duplicates the schema and invites drift. The SecurityScene is the single source of truth.
- **Skip geometryValidity** — rejected because even a reviewed node could have invalid geometry (duplicate, zero-length, degenerate polygon). Geometry validity is a separate concern from review status.

**Implementation note:** The per-node truth ladder is now surfaced in Report Lite, Scene Intelligence, and report exports so the credibility state remains visible in the same surfaces that explain coverage and provenance.

### D-218: Corrected model roadmap — most "recommended" architecture already exists
**Date:** 2026-05-29

**Decision:** Accept the corrected roadmap derived from the comprehensive codebase audit. The system is past Phase 2 (simulation engine, schema, core UI, floor plan import, photo scan, AI draft, privacy zones, verification UI, jobs launcher, operational evidence, target profiles). Current Phase is 3 (production hardening).

**Rationale:**
- An external architectural review (ChatGPT) recommended a 12-layer CV/AI pipeline starting with "CubiCasa5K segmentation + YOLO11 + PaddleOCR + SAM 2" as the first step. This assumes a Phase 0 codebase.
- The actual codebase already has heuristic CV import with review UI, full scene compilation wizard, multi-source provenance tracking, deterministic coverage with placement oracle, manual verification overlay, and 7-mode launcher.
- The actual gaps are smaller and more specific: truth ladder per-node, OCR integration in production pipeline, and camera spec intelligence.
- Investing in CubiCasa5K/YOLO11/SAM 2 now would be premature — the current heuristic + review pipeline works, and the bakeoff is exploring future options in parallel.

**Alternatives rejected:**
- **Follow the recommended 12-layer plan literally** — rejected because it would rebuild systems that already work, deferring the actual gaps.
- **Invest in CubiCasa5K model training this sprint** — rejected because the current heuristic import handles the majority case. CubiCasa belongs in Phase 4 when production data justifies it.
- **Delay truth ladder for larger AI pipeline work** — rejected because the truth ladder is the single highest-leverage credibility feature, costs ~50 lines of schema, and unlocks report quality.

### D-219: Shared identity conflict should be logged as its own evidence kind
**Date:** 2026-05-29

**Decision:** Record the Governance-tab conflict result as a first-class `workspace_identity_conflict_resolved` operational evidence event instead of collapsing it into the generic membership-sync bucket.

**Rationale:**
- The workspace identity archive already captures the live-vs-archived drift and the route recommendation, but the ledger should still distinguish between a membership sync and a conflict-resolution action.
- Operators need to see when the shared identity boundary itself was resolved, not just that the underlying roster data was synchronized.
- This keeps the governance trail semantically richer without adding a new parallel history source.

**Alternatives rejected:**
- **Keep using `workspace_membership_synced`** — rejected because it hides the actual conflict-resolution action behind a generic sync label.
- **Skip a ledger event and rely on the archive only** — rejected because the governance trail would then miss the operator-visible resolution step.
- **Add a separate conflict history not tied to the evidence ledger** — rejected because it duplicates history and weakens the single operational trail.

### D-220: Shared identity conflict history should be replayable as a diff view
**Date:** 2026-05-29

**Decision:** Surface the latest workspace identity conflict as a selectable diff/replay view in the Governance tab, showing live-vs-archived membership, policy, route, and resolution details from the canonical conflict archive.

**Rationale:**
- The conflict archive already stores the live snapshot, archived snapshot, route recommendation, and delivery attempts, but operators still need a readable comparison surface rather than only a list of archived records.
- A dedicated diff view keeps the current/live workspace and the archived snapshot visible side by side, which makes the remaining identity-handling question easier to reason about.
- Replaying a selected conflict from history gives the Governance tab a concrete review workflow without introducing a second archive model.

**Alternatives rejected:**
- **Keep the conflict history as a plain list only** — rejected because a list does not explain what changed or which snapshot is being compared.
- **Create a separate conflict replay route** — rejected because it would duplicate the existing archive and add another persistence path.
- **Hide the archived snapshot behind the summary card** — rejected because the whole point of the archive is to make the live-vs-archived boundary inspectable.

### D-221: Guided scan should remain a guided assistant over the manual-assisted compile path
**Date:** 2026-05-29

**Decision:** The guided scan launcher path is implemented as a guided assistant that helps the user capture and prepare photos, then hands off to the same manual-assisted review and compile pipeline used by Scan Site.

**Rationale:**
- The current scan-to-scene system already compiles a canonical `SecurityScene` from user-reviewed candidates. The new assistant should improve capture prep and auto-path hints without inventing a parallel reconstruction engine.
- Keeping the compile path shared avoids duplicating validation, provenance, and operational evidence behavior.
- The product remains honest: the assistant shortens setup and guidance, but the user still confirms, edits, and compiles the scene.

**Alternatives rejected:**
- **Advertise the guided assistant as autonomous reconstruction** — rejected because the code does not perform automatic segmentation/depth solve yet and that would overstate capability.
- **Create a second guided scan compiler** — rejected because it would duplicate the canonical scan pipeline and drift from the manual-assisted flow.
- **Leave the guided path as a planned banner only** — rejected because the launcher now has a concrete guided-assistant experience that should be reflected in the decision log.

### D-221: Temporal evidence should be backed by a canonical timeline object
**Date:** 2026-05-29

**Decision:** Represent operational evidence history through a canonical event-centered timeline builder and a state-at-time-T resolver, rather than relying only on UI-side sorting, checkpoint lookup, or ad hoc reconstruction helpers.

**Rationale:**
- Scene Intelligence already needed a replay scrubber, checkpoint preview, and branch comparison surface, and the report handoff needed the same time-aware story.
- A reusable timeline object makes the temporal model available to multiple surfaces without duplicating sort/reconstruction logic.
- The state-at-time-T resolver keeps point-in-time reconstruction honest by deriving it from the same ordered evidence stream that powers the UI.

**Alternatives rejected:**
- **Keep reconstruction in each UI surface** — rejected because it duplicates ordering and checkpoint logic, which will drift.
- **Store a separate temporal history model parallel to the evidence ledger** — rejected because it would create another source of truth.
- **Treat checkpoint snapshots as the only temporal source** — rejected because the operator needs event-centered history and not just snapshot inspection.

### D-222: Selected graph nodes should carry node-level evidence history
**Date:** 2026-05-29

**Decision:** Annotate Scene Intelligence graph nodes with node-affecting evidence history metadata so the selected-node inspector can show evidence count, latest evidence kind, and latest evidence time directly on the canonical graph representation.

**Rationale:**
- The scene graph is already the primary provenance navigation surface, so node history belongs on the node model itself instead of in a separate inspector-only lookup.
- The operational evidence stream already records the affected node ids, timestamps, and before/after summaries required to derive this metadata.
- Exposing the latest evidence directly on the selected graph node helps operators see version history without jumping to another panel.

**Alternatives rejected:**
- **Keep node history in a separate detail panel only** — rejected because the graph would still lack its own version semantics.
- **Create a separate node-history store** — rejected because it duplicates the evidence stream and invites drift.
- **Hide the node version metadata behind event search** — rejected because operators need the latest version signal immediately in the selected node inspector.

### D-223: Trust audit surfaces should cover simulation-backed data panels
**Date:** 2026-05-29

**Decision:** Extend the static trust audit to cover 6 additional simulation-wired panels (NovelAlgorithmsTab, RedundancyTab, ThreatAnalysisPanel, TemporalProfileView, BeforeAfterTab, TimelineTab) with required-import and forbidden-pattern checks.

**Rationale:**
- The original trust audit covered 12 surfaces (launcher, governance, provenance, metrics, report, status bar, AI command bar, debug) but left the core simulation panels unaudited.
- These 6 panels are the primary product surface where operators see simulation results — if they regress to stub/hardcoded data, the product value collapses silently.
- Static phrase checks (required imports from simulation engine, forbidden "stub"/"hardcoded"/"placeholder" patterns) catch the most common regression modes without runtime overhead.
- The audit runs in the test suite and fails CI if any surface drifts.

**Alternatives rejected:**
- **Runtime data-provenance checks only** — rejected because they require a running app and are harder to integrate into CI.
- **Snapshot-based UI testing** — rejected because snapshots are brittle and catch visual changes, not data-wiring regressions.
- **Manual code review only** — rejected because it does not scale and is not enforced by CI.

### D-224: bun:test timeout options removed entirely instead of worked around
**Date:** 2026-05-29

**Decision:** Remove all `{ timeout: N }` options from bun:test test calls and the `setTestTimeout` import instead of finding a type-compatible workaround.

**Rationale:**
- bun:test's TypeScript types do not export `setTestTimeout` and the second argument to `test()` is the test function, not options — the timeout pattern was incorrect for bun's test API.
- Tests run well within default timeouts (longest: ~5.6s, default bun timeout is 5s for individual tests but the report-engine tests all pass within bounds).
- Removing the broken pattern is cleaner than adding a type cast or a separate bun-specific config.

**Alternatives rejected:**
- **Add `@ts-ignore` or type cast** — rejected because the pattern is fundamentally wrong for bun's API.
- **Switch to vitest** — rejected because bun:test is the project standard and all other tests use it correctly.
## D-223 - Operational evidence fusion should be a single camera-health summary

- Date: 2026-05-29
- Status: Accepted
- Context: Sensor proximity, camera metadata freshness, and live-connection/session posture were showing up as separate fragments across Camera View, Camera Feed, and Inspector analytics.
- Decision: Derive one canonical operational-fusion summary in the shared sensor-fusion layer and render it as the primary health card on camera surfaces, while keeping the lower-level evidence cards as drill-down context.
- Rationale: Operators need one consistent health signal that combines the three evidence streams, and the shared helper keeps the view, feed, and inspector surfaces aligned.
- Consequence: Camera-facing surfaces now share the same operational-health label/detail, while preserving the source evidence cards for investigation.

## D-224 - Live camera sessions should support explicit heartbeat renewal

- Date: 2026-05-29
- Status: Accepted
- Context: The live camera path already supported bind, refresh, and disconnect, but the current lease model still renewed by re-probing instead of by an explicit keepalive.
- Decision: Add a first-class `heartbeat` action to the live-camera route and registry so a connected session can be renewed without re-fetching the upstream device payload.
- Rationale: Real live device sessions need an explicit keepalive/heartbeat loop, and the operator UI should renew the lease without forcing a new probe every time.
- Consequence: The route, archive, registry, and inspector now distinguish probe refresh from session heartbeat, making the live connection model closer to a real device session lifecycle.

## D-225: Launcher-first root boot removed hidden `?studio=1` bypass

- Date: 2026-05-29
- Status: Accepted
- Context: The root page had a hidden query-string shortcut that bypassed the visible launcher/dashboard and mounted `StudioShell` directly when `studio=1` was present.
- Decision: Remove the hidden boot flag and keep the root app flow launcher-first, with `StudioDashboardHome` as the default entry and explicit in-app actions as the only path into `StudioShell`.
- Rationale: The product already exposes a canonical launcher/dashboard flow with explicit workspace entry actions. A hidden query bootstrap created a second boot path, obscured actual app behavior, and encouraged patchwork debugging instead of matching the user-facing flow.
- Consequence: The app now reflects the real product flow on first load, tests no longer encode the hidden bypass, and any direct workspace entry happens through visible launcher actions instead of an undocumented query flag.

## D-226 - Live camera sessions should carry protocol auth metadata through the canonical record

- Date: 2026-05-29
- Status: Accepted
- Context: The live camera lease path already tracked bind/refresh/heartbeat/disconnect, but the session record still collapsed authorization into the transport/session state and hid it from the canonical archive.
- Decision: Add explicit auth mode/state/session fields to the live connection request, probe response, session registry, scene camera node, inspector archive, and operational-fusion summary.
- Rationale: Operators need to see whether a live camera is merely connected or actually authenticated, and the support/archive trail should preserve that distinction for later review.
- Consequence: The live session model now carries `authMode`, `authState`, `authRealm`, `authSessionId`, and `authSessionExpiresAt` across the main record path, while the camera view and inspector surfaces can explain the auth posture alongside the lease and transport metadata.

## D-227 - Workspace publish approval must combine access policy with governance state

- Date: 2026-05-29
- Status: Accepted
- Context: The shared-workspace access helpers and governance state both described publish and review posture, but the effective gate was split across helpers and the UI could drift from the actual approval route.
- Decision: Treat publish as allowed only when the active member is publish-capable and the combined workspace policy/governance state permits it, and treat privacy-sensitive approval routes as requiring the privacy reviewer role rather than any generic reviewer.
- Rationale: Shared-workspace RBAC/ABAC needs one canonical decision path so the governance panel, store actions, and review routing all explain the same approval truth.
- Consequence: `canPerformWorkspaceAction` now uses the governance state for publish decisions, the governance panel reflects the same gate, and privacy-sensitive approval decisions no longer accept the wrong reviewer role.

## D-228 - Model eval runs should persist the prompt-registry snapshot they used

- Date: 2026-05-29
- Status: Accepted
- Context: The prompt registry was visible in Debug, but the model-eval history only stored pass/fail outcomes and could not explain which prompt catalog version produced a given run.
- Decision: Attach a prompt-registry snapshot, digest, and version metadata to every model-eval run record and surface that snapshot in Debug alongside the current registry summary.
- Rationale: Provider/model governance needs traceability from prompt definitions to eval results so prompt changes, provider swaps, and stage budgets can be audited together.
- Consequence: Model-eval history now persists the registry snapshot it used, and Debug can compare the live registry against the most recently recorded snapshot.

## D-229 - Workspace retrieval should be a canonical launcher surface

- Date: 2026-05-29
- Status: Accepted
- Context: The launcher already surfaced workspaces, scan entry points, and report/report-history flows, but there was no canonical retrieval surface for searching the current scene, saved workspaces, evidence, and report snapshot from one query.
- Decision: Add a workspace memory search surface to the launcher that retrieves current-scene, saved-workspace, evidence, and report hits from one canonical query and labels the entry flows with explicit maturity states.
- Rationale: SentinelTwin should feel like a retrieval workspace, not just a list of recent scenes, and the launcher is the right place to expose that user-facing memory spine.
- Consequence: The launcher now exposes workspace memory search, the start-project cards carry honest maturity labels, and the gap inventory can treat retrieval as a distinct platform layer instead of leaving it implicit.

## D-230 - Launcher should present the seeded retail scene as the reference baseline, not the only complete path

- Date: 2026-05-29
- Status: Accepted
- Context: The launcher copy still described the seeded retail scene as the only fully complete workflow even after the import, blank-scene, scan, AI draft, and report entry points had been wired as real end-to-end paths.

## D-231 - Live camera probes should preserve auth challenges and transport response metadata

- Date: 2026-05-29
- Status: Accepted
- Context: A real camera often answers with a 401/403 challenge or a non-OK transport response before a session is authenticated, but the live connection trail was flattening that negotiation into a generic failure.
- Decision: Capture the transport response status/text plus the auth challenge header/scheme/realm in the live connection probe, session registry, inspector archive, and operational-fusion summary.
- Rationale: The operator and support trail should show whether a connection failed, was challenged, or was still negotiating, because those are materially different states when diagnosing a live device.
- Consequence: The live camera path can now preserve a challenge-response negotiation step as part of the canonical session record instead of collapsing it into a single error state.
- Decision: Reframe the launcher and dashboard start surfaces so the seeded retail scene is the canonical reference baseline, while the import, scan, blank-scene, AI draft, and report flows are described as real entry points with explicit maturity labels.
- Rationale: The product no longer needs to pretend that only the demo path is real. Keeping the launcher truthful reduces trust drift and matches the actual execution paths now available in the Studio shell.
- Consequence: The launcher wording now treats the retail scene as baseline/reference, the other entry paths are described as real workflows, and the product story is less demo-centric without removing the seeded scene itself.

## D-231 - Fixed-port Studio bootstrap should seed the dev prerender manifest and use a non-mutating document shim

- Date: 2026-05-29
- Status: Accepted
- Context: Fresh `next dev` boots under the fixed-port wrapper were failing with missing `.next/dev/prerender-manifest.json` errors and a generated `_document.js` shim that tried to assign to a getter-only `default` property.
- Decision: Have `apps/studio/scripts/run-fixed-port.mjs` seed the minimal dev prerender manifest before starting Next and emit a `_document` shim that exports the resolved module without mutating its `default` property.
- Rationale: The Studio should be able to boot from a clean `.next` directory without a manual warmup or ad-hoc file restoration, and the fixed-port wrapper is the right place to enforce that bootstrap contract.
- Consequence: Fresh dev boots now have the manifest files Next expects, the root shell and API routes render instead of 500ing on first load, and the fixed-port launcher remains the canonical way to start the app on port 3000.

## D-232 - Diagnostic bundles should carry alert routing and registry snapshots

- Date: 2026-05-29
- Status: Accepted
- Context: The support bundle already carried incidents and external logs, but the diagnostic export and Debug runtime card did not expose a canonical alert-routing summary, and model-eval history did not preserve the prompt-registry snapshot it used.
- Decision: Attach alert routing to the diagnostic bundle, surface it in the runtime health card, and persist prompt-registry snapshots with each model-eval run.
- Rationale: Runtime truth needs one support-ready export that explains incidents, traces, external logs, and alert routing together, while provider/model governance needs a durable registry trail to explain eval results across prompt changes.
- Consequence: The Debug panel can show alert routing directly from the diagnostic bundle, and model-eval history becomes an auditable trace of the prompt catalog used for each run.

## D-233 - Incident bundles should be a focused crash/export artifact

- Date: 2026-05-29
- Status: Accepted
- Context: The general support bundle is intentionally broad, but operators also need a failure-focused export that centers incidents, performance traces, external logs, and alert routing without the extra archive payloads.
- Decision: Add a first-class incident bundle built from the diagnostic bundle plus alert summary and failure-oriented slices, and expose it as a dedicated Debug download action.
- Rationale: Crash/incident handoff should have a narrower artifact that is easy to reason about during triage while still preserving the canonical runtime evidence.
- Consequence: Debug now offers a dedicated incident bundle download alongside the broader support bundle, and the failure-focused export can evolve independently without duplicating the support artifact.

## D-234 - Camera metadata ingest should accept XML as a first-class feed format

- Date: 2026-05-29
- Status: Accepted
- Context: The Debug panel already supported JSON and NDJSON camera metadata imports, but many live camera feeds and ONVIF-style metadata streams arrive as XML.
- Decision: Extend camera metadata ingest to parse XML feeds directly while mapping only canonical scene fields such as camera identity, status, clarity, night mode, feed mode, notes, and timestamp.
- Rationale: The operator should be able to paste or fetch a live XML metadata feed without a lossy pre-conversion step, while keeping the ingest surface strict enough to avoid inventing unsupported fields.
- Consequence: Camera metadata ingest can now consume XML as a first-class input format, and future feed vocabulary changes should extend the same parser instead of adding a parallel ingest path.

## D-235 - Live camera probes should accept XML as a first-class wire format

- Date: 2026-05-29
- Status: Accepted
- Context: The live camera probe already understood JSON/NDJSON and could parse XML-ish payloads, but XML feeds were still being penalized by the JSON parser with false error noise.
- Decision: Treat XML payloads as a first-class live probe input and suppress JSON-only parse errors when the payload is clearly XML.
- Rationale: Operators need truthful probe diagnostics, especially when the camera replies in XML or SOAP, and the error channel should only report real parse failures.
- Consequence: XML probe responses now flow through the live connection path cleanly, and the diagnostic trail reflects actual negotiation issues rather than parser artifacts.

## D-238 - Temporal evidence should distinguish published checkpoints from reconstructable checkpoints

- Date: 2026-05-29
- Status: Accepted
- Context: The operational evidence ledger already supported point-in-time reconstruction, but published scene states were still implicitly treated as generic checkpoints in the live surfaces and report exports.
- Decision: Track published checkpoints as a separate temporal concept from reconstructable checkpoints, including separate counts, ages, and current-vs-published deltas in the evidence summary, Scene Intelligence, and report exports.
- Rationale: Publication is a user-visible semantic boundary, not just another snapshot. Keeping it explicit makes the evidence model honest about what is reconstructed from history versus what was intentionally promoted to a published branch.
- Consequence: The temporal twin can now answer both “what was reconstructable?” and “what was published?” without flattening the publish step into a generic point-in-time checkpoint.

## D-239 - Timeline search should accept branch and time query tokens, with launcher hits seeding checkpoint focus

- Date: 2026-05-29
- Status: Accepted
- Context: The launcher could already search workspaces and archives, and Scene Intelligence already had branch filters and checkpoint previews, but there was no canonical way to jump from a search hit to a specific place in the temporal ledger.
- Decision: Teach the evidence timeline to accept `branch:`, `after:`, `before:`, and `time:` query tokens, and have launcher hits seed a checkpoint focus target that opens Scene Intelligence near the selected timestamp.
- Rationale: Time/branch navigation should use the same evidence trail and search language everywhere, so the launcher can route into the timeline without inventing a second navigation system.
- Consequence: The launcher can now seed a timeline checkpoint target from search hits, Scene Intelligence can honor branch/time query tokens on the same ledger, and the remaining gap is the share-link contract rather than the basic navigation syntax.

## D-240 - Operational evidence events should normalize through a canonical runtime schema

- Date: 2026-05-29
- Status: Accepted
- Context: The operational evidence ledger already powered timeline, recovery, and archive flows, but its import path still relied on manual shape checks instead of a canonical runtime schema.
- Decision: Add a canonical runtime schema for operational evidence events and use it during ledger normalization, including validation of nested scene snapshots before they are accepted into archives or recovery flows.
- Rationale: The memory layer is only trustworthy if imported history is validated the same way everywhere, and invalid checkpoints should not slip into the time-travel surface or archive import path.
- Consequence: Archive and journal normalization now reject malformed evidence records up front, while the visible evidence ledger keeps using the same canonical event shape across timeline, branch, and recovery surfaces.

## D-241 - Launcher memory search should surface branch-bearing archive hits as timeline jumps

- Date: 2026-05-29
- Status: Accepted
- Context: Workspace search already returned archive hits, but branch-bearing archive records were still opening the surrounding tab instead of jumping directly into the timeline branch they described.
- Decision: Carry branch metadata on workspace memory hits, and when a hit has a meaningful branch target, route the launcher into Scene Intelligence with a branch/time query and timeline focus instead of only opening the archive tab.
- Rationale: Branch-aware retrieval should respect the same temporal ledger users inspect in provenance, so archive hits that already know their branch target should land near that checkpoint instead of forcing a second navigation step.
- Consequence: Branch-bearing governance, membership, and identity-conflict hits now jump into the timeline with branch/time focus, while non-branch archives continue to open their owning tab.

## D-242 - Timeline deep links should preserve checkpoint identity and provenance focus

- Date: 2026-05-29
- Status: Accepted
- Context: Scene Intelligence already supported copyable deep links, but the URL contract only carried the timestamp, query, and branch label, which was not enough to restore the exact checkpoint and provenance trace context on reload.
- Decision: Extend the timeline focus request and deep-link contract to carry exact checkpoint identity plus provenance node/edge ids, then restore them when Scene Intelligence loads.
- Rationale: Shareable links should reopen the precise checkpoint or trace the user was inspecting, not merely a nearby timestamp that happens to resolve to the same branch.
- Consequence: Timeline links can now round-trip exact checkpoint selection and trace focus, making branch and checkpoint sharing more trustworthy across reloads and handoffs.

## D-244 - Scene Intelligence should pivot reconstructable checkpoints into compare/report snapshot pairs

- Date: 2026-05-29
- Status: Accepted
- Context: Scene Intelligence could already reconstruct checkpoints and show branch comparison data, but the compare/report surfaces still required users to manually seed snapshot pairs from elsewhere.
- Decision: Add explicit pivot actions from the checkpoint reconstruction card into Before/After and Report Lite, seeding the shared compare-report selection with a trusted snapshot pair resolved from the current checkpoint context.
- Rationale: The evidence surface should not only explain a checkpoint; it should hand that checkpoint off to the next analysis surface so cross-view auditing feels like one continuous workflow.
- Consequence: Scene Intelligence can now jump the operator into compare/report analysis with a seeded pair, and the Before/After tab can treat that seed as a real default instead of forcing a second manual selection.

## D-245 - Compare/report share links should round-trip seeded checkpoint pairs through the studio bootstrap

- Date: 2026-05-29
- Status: Accepted
- Context: Scene Intelligence and the compare/report tabs could seed selection in-memory, but those compare selections still could not survive a shareable URL round-trip.
- Decision: Add compare snapshot ids and compare mode to the studio share-link contract, parse them during app bootstrap, and auto-enter the correct workspace mode when the link is opened.
- Rationale: The shared compare selection is only truly useful if a copied link can reopen the exact comparison state, not just the timeline checkpoint that produced it.
- Consequence: Compare and report share links can now reopen seeded snapshot pairs through the launcher/bootstrap path, and the report tab will come up in compare mode when that state is present.

## D-246 - Compare surfaces should expose the share-link contract at the point of use

- Date: 2026-05-29
- Status: Accepted
- Context: The compare/report share-link contract existed in the bootstrap path, but the main comparison surfaces still required users to rely on upstream handoff flows to discover or copy the link.
- Decision: Add explicit compare-link copy actions to Before/After, Report Lite, and Compare View so the seeded pair can be shared from the surface where the comparison is already selected.
- Rationale: The share contract is only truly useful when it is visible at the point of comparison, not only in the reconstruction panel that seeded it.
- Consequence: Operators can now copy the exact comparison link from the compare/report surfaces themselves, and each surface clearly advertises whether it is sharing the before/after or report compare mode.

## D-243 - Bakeoff predictions should map to SecurityScene through a TypeScript bridge

- Date: 2026-05-29
- Status: Accepted
- Context: The V0.2 floorplan bakeoff produced validated Python `SecuritySceneSubset` artifacts (normalized [0,1] line segments), but the studio editor could not consume them. The existing `floor-plan-import.ts` pipeline consumed a `FloorPlanResult` (pixel-origin edge detection), not model predictions. Closing this gap required a TypeScript bridge that converts bakeoff predictions to a Zod-valid `SecurityScene` with 3D meter-scaled nodes.
- Decision: Add a `bakeoffToSecurityScene()` function in `apps/studio/src/lib/bakeoff-bridge.ts` that accepts a `BakeoffPrediction` (matching the Python `SecuritySceneSubset` shape) and a `ScaleReference` (known dimension + axis hint per Q-009), and produces a complete `SecurityScene` with wall nodes, door/entry-point pairs, window nodes, obstruction nodes, and critical zone nodes. Scale defaults to `knownDimensionM: 8` when user input is not provided. The import flow in both the launcher (`page.tsx`) and the studio shell (`TopBar.tsx`) auto-detects bakeoff predictions by `image_id` + `walls` and routes them through the bridge.
- Rationale: Without the bridge, bakeoff results were siloed in the Python experiment harness and invisible to the product. The bridge closes the end-to-end flow: floorplan image → bakeoff → editor → simulate → iterate. The auto-detection approach avoids breaking the existing SecurityScene JSON import contract.
- Consequence: Bakeoff prediction JSON files can be dragged/imported into the studio and produce editable scenes. The hardcoded default scale (8m) should be replaced with a user-visible scale input in a follow-up. 6 unit tests validate the bridge at `apps/studio/src/lib/__tests__/bakeoff-bridge.test.ts`.

## D-244 - Root home should lead with the security job, not the demo sample

- Date: 2026-05-29
- Status: Accepted
- Context: The root dashboard was still reading as a demo-first studio surface, even though the app now has a real product front door, launcher, and multiple job-based entry paths.
- Decision: Keep the existing Studio workspace and launcher infrastructure, but make the top of `/` present a product-home hero that leads with `Start Security Audit`, `Continue Current Workspace`, and `Advanced Workflows`, while demoting the seeded retail scene to an explicitly optional reference demo.
- Rationale: Users should understand the product job before they understand the workspace mechanics. The demo remains valuable, but it should be framed as a sample baseline rather than the identity of the app.
- Consequence: The app now reads as a security audit product with a workspace underneath it, rather than a demo shell with a few extra entry points.

## D-245 - Workspace-memory result cards should expose explicit target metadata

- Date: 2026-05-29
- Status: Accepted
- Context: The launcher already knew how to route archive, report, evidence, and workspace hits, but the cards themselves still read like generic search snippets even when they pointed at a timeline branch or exact checkpoint.
- Decision: Add explicit target metadata to workspace-memory result cards so the launcher can show what each hit will open before the user clicks it, including whether the hit routes to a timeline branch, exact checkpoint, report snapshot, debug surface, or workspace view.
- Rationale: The search engine should not hide its routing intent. Showing the destination in the card itself turns results into understandable navigation actions and creates a reusable contract for future cross-view handoff.
- Consequence: Workspace-memory hits now expose target/route badges in the launcher, and branch-aware archive hits read as direct navigation routes rather than opaque snippets.

## D-247 - Operational evidence archives should have a browser-openable handoff link

- Date: 2026-05-29
- Status: Accepted
- Context: The archive recovery flow already supported local file import and merge preflight, and timeline links already had a browser-openable share contract, but exported operational evidence archives still could not be reopened from a URL into the debug/recovery UI.
- Decision: Add a canonical archive handoff link helper that serializes the operational evidence archive plus the target restore branch into the studio URL, and teach the page bootstrap and debug panel to restore that request back into the merge-preflight flow.
- Rationale: Recovery artifacts should be shareable through the same browser-native link contract as timeline checkpoints, so an archive can be opened directly into the recovery cockpit instead of only via a downloaded file.
- Consequence: The debug recovery panel can now copy or open a browser-link handoff for the current archive, and the app can rehydrate that archive into merge preflight on load.

## D-248 - Launcher search should surface recent operational evidence archives as timeline checkpoints

- Date: 2026-05-29
- Status: Accepted
- Context: Operational evidence archives could be exported and restored, but they were not visible in launcher search as a recoverable archive family even though each archive carries a reconstructable latest event chain.
- Decision: Persist a short local recent-history list of exported/restored operational evidence archives and include it in workspace-memory search, routing hits to the latest reconstructable checkpoint when a latest event id is available.
- Rationale: Operational memory becomes more useful when the launcher can find a recent recovered archive by query and jump directly to the checkpoint embodied by that archive.
- Consequence: Launcher search can now surface operational evidence archive hits with exact-checkpoint routing, and the recent archive history is preserved locally for short-term retrieval.

## D-249 - Guided walkthrough and focus preset should use product language, not demo wording

- Date: 2026-05-29
- Status: Accepted
- Context: The guided walkthrough and focus preset were real product flows, but the visible shell still labeled them with demo-first copy (`Demo Mode`, `Demo Walkthrough`, `Client demo mode with all docks hidden`).
- Decision: Keep the underlying walkthrough and focus preset implementation intact, but rename the visible labels to guided-workflow language (`Guided Walkthrough`, `Enter/Exit Guided Walkthrough`, `Focused workspace with all docks hidden`).
- Rationale: The user-facing shell should describe the actual workflow intent instead of reinforcing demo framing for functionality that is already implemented and exercised in-product.
- Consequence: The launcher and top-bar affordances now read as real guided/focus workflows, and the last obvious demo-first labels in the shell are removed without changing the underlying store/state model.

## D-249 - Scene Intelligence should expose recent operational evidence archives as recovery cards

- Date: 2026-05-29
- Status: Accepted
- Context: Launcher search could now find recent operational evidence archives, but the provenance surface itself still only showed the current evidence timeline and reconstructable checkpoints.
- Decision: Add a recent operational evidence archive panel to Scene Intelligence that can copy/open the browser handoff link and restore an archive through the canonical importer.
- Rationale: Recovery should not require leaving the provenance surface when the archive is already part of the current workspace history.
- Consequence: Scene Intelligence now shows the recent archive history alongside the checkpoint timeline, and each archive can be reopened or restored from the same panel.

## D-250 - Compliance reporting modes should be audience-aware within the canonical report spine

- Date: 2026-05-30
- Status: Accepted
- Context: The report pipeline already carried provenance, evidence, and temporal history, but compliance-specific reporting still read like a future gap because the app lacked an explicit audience contract.
- Decision: Add a canonical report-audience mode to the existing report engine and report tab, with audience-aware framing for operator, auditor, insurer, installer, and privacy reviewer exports, and thread the selected audience through both single-scene and compare report generation.
- Rationale: Compliance reporting should remain a single canonical spine with audience-aware framing, not a separate reporting system. The report tab is already the product surface where export intent is chosen, so it is the right place to select the audience mode.
- Consequence: Report exports now preserve explicit audience context in the same report contract, while the remaining compliance work is narrowed to policy-driven redaction, visibility control, and report catalog design.

## D-251 - ONVIF probes should use a real SOAP session client, not a simulated session manager

- Date: 2026-05-29
- Status: Accepted
- Context: The live camera probe route already handled JSON, NDJSON, and XML responses, but the reusable ONVIF helper was still a mock session manager that only simulated probe timing and device negotiation.
- Decision: Replace the mock ONVIF client with a real fetch-based SOAP probe that can parse device information, event subscription URIs, media URIs, auth challenge headers, and connection state, and let the canonical camera-live-connection probe route reuse that helper for ONVIF bindings.
- Rationale: ONVIF support should be built on a real transport/client primitive even if full authenticated multi-step subscription renewal is still a future seam. The shared helper keeps the ONVIF path canonical instead of pretending a simulated session is enough.
- Consequence: The ONVIF probe path now returns real device information from SOAP responses, camera live probe tests can exercise the client directly, and the remaining gap narrows to authenticated multi-step ONVIF session management rather than the initial probe itself.

## D-252 - Real footage verification should enter Camera View directly instead of a preview modal

- Date: 2026-05-30
- Status: Accepted
- Context: The launcher already had a dedicated camera-verification workflow in Camera View, but the start-project path still opened a separate preview modal that duplicated the implementation story and kept the entry point looking provisional.
- Decision: Route the launcher action directly into the existing Camera View verification workflow with the verification panel open, and keep the launcher copy focused on what the workflow actually does instead of explaining a preview shell.
- Rationale: The Camera View verification path is already the canonical implementation. A separate modal only diluted the real workflow and made the launcher look less implemented than it is.
- Consequence: The launcher no longer stops at a preview gate for real-footage verification, the Camera View workflow becomes the visible implementation boundary, and the remaining gap is the verification fidelity itself rather than the entry path.

## D-252 - Point-in-time reconstruction should expose source provenance, not just the reconstructed scene

- Date: 2026-05-30
- Status: Accepted
- Context: Scene Intelligence already resolved a reconstructed scene at a selected checkpoint, but the UI only knew whether a snapshot existed. It did not say whether the resolved scene was exact or derived from an earlier snapshot source.
- Decision: Add a richer time-slice resolver that returns the reconstructed scene plus the source snapshot event, distance from the selected checkpoint, and exact-versus-derived provenance, then surface that provenance directly in Scene Intelligence.
- Rationale: Operational memory is more useful when users can see where the reconstructed state came from. Exact/derived provenance makes checkpoint restoration and archive review more trustworthy without changing the canonical reconstruction path.
- Consequence: Scene Intelligence can now explain whether a checkpoint is an exact scene snapshot or a derived reconstruction from an earlier snapshot, and the same provenance metadata is available for future timeline/report surfaces.

## D-253 - Report exports should expose policy presets, not just audience labels

- Date: 2026-05-30
- Status: Accepted
- Context: Audience-aware reporting existed, but the export surface still needed a visible policy layer so operators could choose internal/shared/privacy-safe handling before copying or exporting a report.
- Decision: Add a report catalog to Report Lite with explicit export presets plus a visibility selector for internal, shared, and privacy-safe export policies, and apply the selected policy to the canonical report output before export.
- Rationale: The product should make export intent explicit before the artifact is generated. A catalog of presets is more trustworthy than a single generic export button because it makes the sharing posture visible in the same workflow where the export is created.
- Consequence: Report Lite now shows preset cards and visibility controls in-product, and the remaining compliance work narrows to deeper redaction semantics, regulator-specific policy, and template differentiation beyond the current shared/privacy-safe presets.

## D-254 - Report temporal twin summaries should carry checkpoint provenance

- Date: 2026-05-30
- Status: Accepted
- Context: The temporal twin summary already showed event counts, checkpoint counts, ages, and deltas, but it did not tell report readers whether the latest checkpoint was an exact snapshot or a reconstruction derived from an earlier snapshot event.
- Decision: Extend the temporal twin summary with explicit checkpoint provenance fields and surface them in report summaries, HTML exports, markdown exports, and plain-text exports.
- Rationale: Report exports should preserve the same checkpoint lineage trust signal that Scene Intelligence now shows in the interactive reconstruction view. Provenance text makes the exported report less ambiguous without changing the underlying reconstruction model.
- Consequence: Reports now say when the latest checkpoint is exact versus derived, and the same provenance metadata is available to any future export or comparison surface built on the temporal twin summary.

## D-255 - The launcher should expose a local workspace catalog summary as the org/account bridge

- Date: 2026-05-30
- Status: Accepted
- Context: Saved workspaces already carried organization, owner, and visibility metadata, but the launcher still only exposed those fields as per-card metadata rather than as a first-class workspace catalog boundary.
- Decision: Add a canonical local workspace catalog summary derived from saved workspaces and surface it in the launcher with scope, organization, owner, visibility, and catalog-health breakdowns, while keeping billing, invites, and ownership transfer explicitly open.
- Rationale: The product needs a visible bridge from the current local workspace list to the future org/account model without pretending that plan or invite infrastructure already exists.
- Consequence: The launcher now shows a dedicated workspace catalog summary, the org/account boundary is visible in-product, and the remaining work stays focused on the canonical org/account, billing, and transfer model rather than another metadata patch.

## D-257 - Report exports should emit scene-scoped evidence URIs and anchor-backed evidence links

- Date: 2026-05-30
- Status: Accepted
- Context: The report engine already exposed provenance, evidence summaries, and audience-aware exports, but exported handoff artifacts still lacked explicit link targets for the recent operational evidence entries they described.
- Decision: Extend the canonical report contract with `sceneId`, per-entry evidence anchor IDs, and scene-scoped evidence URIs, then render those links in the existing HTML, Markdown, and text report exports instead of building a separate evidence surface.
- Rationale: Evidence handoff should be traceable inside the canonical report spine. Anchor-backed links are the smallest durable step toward clickable report sections and keep the report engine aligned with the same scene identity used elsewhere in the product.
- Consequence: Report exports now expose linkable evidence entries and scene IDs, and future compliance/reporting work can build on the same contract for deeper drill-through, redaction, and standards-specific templates.

## D-256 - The launcher should expose a local workspace account summary as the org/account bridge

- Date: 2026-05-30
- Status: Accepted
- Context: The workspace catalog bridge made organization, owner, and visibility visible, but the product still needed an explicit account posture with plan, quota, and entitlement signals so the org boundary could read like an account model instead of only a catalog summary.
- Decision: Add a derived local workspace account summary to the launcher that surfaces plan posture, soft quota, and entitlements from the current workspace catalog, while keeping billing, invites, and ownership transfer explicitly open.
- Rationale: The product needs to reveal the account boundary as an operational bridge now, not wait for the canonical remote org/account backend before the UI becomes legible.
- Consequence: The launcher now shows both catalog and account bridges, and the remaining work stays focused on the canonical org/account backend rather than on more metadata-only fields.

## D-255 - Guided scan reconstruction should open the real assistant instead of a kickoff modal

- Date: 2026-05-30
- Status: Accepted
- Context: The guided scan path already compiled through the real `ScanSiteWizard` in guided mode, but the launcher still paused on a kickoff modal that only described the assistant instead of launching it.
- Decision: Route the guided scan launcher action directly into the guided scan assistant and let the assistant open the existing wizard immediately with the guided scan notice and auto-path hints enabled.
- Rationale: The assistant was already implemented, so a preview-like kickoff layer only made the workflow look less complete than it looks. The direct launch path is clearer and reduces one more stub-style gate.
- Consequence: Guided scan now behaves like a real entry workflow from the launcher, the remaining gap is richer capture/reconstruction depth rather than the entry path itself, and the product truth manifests can describe it as a previewable native flow instead of a planned placeholder.

## D-259 - ONVIF binding should perform real challenge-response retries and carry camera credentials through the probe path

- Date: 2026-05-30
- Status: Accepted
- Context: The reusable ONVIF helper already parsed device info and auth challenges, but it still stopped at a single unauthenticated probe, and the camera inspector had schema-level ONVIF username/password fields that were not yet forwarded through the live binding request.
- Decision: Keep the canonical camera-live binding path honest by retrying ONVIF probes with a real Basic or Digest Authorization header when the device challenges the first request, and forward any stored ONVIF credentials from the camera inspector into the live-connection request path.
- Rationale: Real devices often require challenge/response negotiation before they reveal metadata. The scene schema already reserves ONVIF credentials, so the UI and route should honor them instead of leaving them as schema-only state.
- Consequence: The live camera probe can now complete a real Basic or Digest retry before the canonical archive is written, and the remaining device-protocol seam narrows to longer-lived subscription renewal and event streaming rather than initial credential negotiation.

## D-256 - Componentize analytics display surface and compact MetricsTab layout

- Date: 2026-05-30
- Status: Accepted
- Context: The MetricsTab used 2 single-value donut charts that consumed the same column space as richer cards, a standalone Coverage Fragility card, and standalone Recognition/Identification cards — 8 columns total, 25% of which was low-density visual decoration. The advanced signals section was a wall of 7 text-description pairs with no visual encoding. The Outcome Summary on the launcher dashboard right panel was text-only, making failures hard to scan.
- Decision: (1) Extract `MiniStat` → `shared/MiniStat.tsx` (big-number card pattern, previously local to StudioDashboardHome). (2) Extract `QualityBar` → `shared/QualityBar.tsx` (horizontal segmented quality-distribution bar, previously local to BeforeAfterTab). (3) Merge standalone Coverage Fragility into Worst Area Quality card with separator + sub-label, reducing the main grid from 8 to 6 columns. (4) Merge standalone Recognition Area + Identification Area into a single Walkable Area Quality card with side-by-side numbers. (5) Replace the 7-card advanced-signals text wall with a compact 2-column color-coded signal table with status dots (good/warn/neutral). (6) Update Outcome Summary to use `QualityBadge` components (`shared/QualityBadge.tsx`) for compact required→actual quality display. (7) Update `BeforeAfterTab` to use the shared `QualityBar` instead of its local copy.
- Rationale: Keeping the donut charts (design intent) but freeing 2 columns reduces wasted horizontal space while preserving the approved visual language. Merging related metrics (Recog+Ident, Fragility→Worst) creates more information-dense cards without losing data. The color-coded signal table replaces prose reading with scanable status at a glance. Using `QualityBadge` in the Outcome Summary makes failures visually distinct without needing to read text.
- Alternative rejected — remove donuts entirely: The UI design pack shows donut charts for Overall Coverage and Average Quality as intentional design elements. Removing them creates divergence from the approved visual language. Instead, the cards are given more breathing room by reducing the grid count.
- Alternative rejected — keep everything as-is: The 8-column grid was low-density and the advanced signals section was consumed as prose. Users scanning for failures had to read every text row.
- Files created: `src/components/shared/MiniStat.tsx`, `src/components/shared/QualityBar.tsx`
- Files modified: `src/components/bottom-panel/MetricsTab.tsx`, `src/components/bottom-panel/BeforeAfterTab.tsx`, `src/components/launcher/StudioDashboardHome.tsx`, `src/components/__tests__/metrics-tab.test.ts`

## D-257 - Adversarial Path Target Orientation Penalties

- Date: 2026-05-30
- Status: Accepted
- Context: Target height was modeled, but target facing direction was completely missing. When a person walks away from a camera, their face is not visible, making recognition and identification impossible, yet the previous engine assigned quality based purely on distance and occlusion.
- Decision: Compute target facing direction (yaw) derived from the path trajectory. Compare this direction against the angle from the target to the covering cameras. Apply a hard clamp on the maximum quality metric (capping at `observation` for DORI, `perceive` for OODPCVS) if the camera is > 90° off the target's facing direction.
- Rationale: Face-capture requires the target to be facing the camera (or in profile, < 90° offset). Without orientation penalties, path replay simulates false confidence in recognition where no facial features could be captured.
- Consequence: Path visibility timelines will now downgrade quality when the target is walking away. The engine is now closer to physical reality.

## D-258 - Compare and archive handoffs should expose checkpoint provenance alongside the checkpoint itself

- Date: 2026-05-30
- Status: Accepted
- Context: Scene Intelligence and the report exports already exposed exact-versus-derived checkpoint provenance for reconstructed scenes, but the compare handoff surfaces still only described the selected checkpoint and snapshot pair without making the provenance legible at the point of use.
- Decision: Surface checkpoint provenance directly in Scene Intelligence archive cards, selected checkpoint cards, and compare handoff cards, and reuse the same provenance note when the checkpoint is bridged into Before/After or Report Compare flows.
- Rationale: Users should not have to infer whether a handoff is exact or derived from the checkpoint card alone. Making the provenance visible where the compare action is launched keeps the evidence story coherent across timeline, archive, compare, and report surfaces.
- Consequence: The provenance language now stays consistent from reconstruction through handoff, and the remaining work is to extend the same trust signal into any other archive/compare surfaces that grow from this workflow.


## D-259 - GSAP vs Motion One for Path Replay Animation

- Date: 2026-05-30
- Status: Accepted (Resolves D-018 from AGENTS.md)
- Context: The original project brief anticipated using GSAP for timeline animations (like actor path replay), but GSAP has a proprietary commercial license that violates the project's MIT/Apache 2.0 dependency requirements.
- Decision: Use Motion One as the primary 1:1 replacement for GSAP timeline choreography. Use Framer Motion for general React UI transitions. Use Native R3F `useFrame` for pure 3D canvas path traversal when full timeline control is not needed.
- Rationale: Motion One is MIT licensed, built on WAAPI, highly performant, and offers a Timeline API comparable to GSAP's `gsap.timeline()`. This maintains strict open-source licensing compliance.
- Consequence: Path replay animation work is now unblocked.

## D-023 | 2026-05-30 | Deletion of CanvasViewTabs

**Decision:** Deleted `CanvasViewTabs.tsx` as it was superseded by `ViewModeBar.tsx`.

**Rationale:**
- The newer `ViewModeBar` component provides additional features and is better integrated with the new Area 1 roadmap.
- `CanvasViewTabs` was redundant code.

## D-024 | 2026-05-30 | Typescript Error Remediation across API Routes and Stores

**Decision:** Replaced `Request` parameter types with `NextRequest` on all `app/api/*/route.ts` API route handlers, and resolved associated downstream test typing mismatches. 
Fixed the `CameraLiveConnectionEventRecord` and `WorkspaceApprovalRouteSummary` types to appropriately mark unsupplied properties as optional or to supply mock values in tests.

**Rationale:**
- Next.js 15+ API routes strongly prefer `NextRequest` from `next/server` over the global `Request` to access Next.js-specific properties (like `nextUrl`, `cookies`).
- Test mismatches were cascading and creating a fragile build state.
- Allowed the `studio-store` to pass `tsc` cleanly.

## D-260 - Operational evidence archives should preserve the workspace account bridge

- Date: 2026-05-30
- Status: Accepted
- Context: The launcher now exposes a derived local workspace account bridge, but archive restore still needed to round-trip that account posture instead of rebuilding it from defaults during recovery and merge-preflight.
- Decision: Include the workspace account profile in the operational evidence archive shape and restore path so exported archives preserve the local account bridge across recovery, merge-preflight, and archive handoff flows.
- Rationale: The account bridge is now part of the workspace truth model, so recovery should preserve it alongside the scene, ledger, governance, and access state.
- Consequence: Exported archives now carry the workspace account profile, and recovery can reopen with the same local account posture instead of falling back to a default profile.

## D-261 - Governance branch sync should compare against the latest archived operational evidence branch

- Date: 2026-05-30
- Status: Accepted
- Context: The Governance tab had a visible sync control, but it still faked the comparison with a null placeholder instead of using the archive branch ledger that the app already preserves locally.
- Decision: Compare the current operational evidence branch against the latest archived operational evidence branch and surface the sync result as a real branch-sync report in Governance.
- Rationale: The sync control should explain the actual branch state, not imply a remote system that the app does not have. The archive ledger already provides enough history to show same / fast-forward / diverged branch posture.
- Consequence: Governance now shows a real branch-sync comparison against the latest archived branch, and the mock remote sync placeholder is gone.

## D-261 - Approval routing should carry a stable identity key and eligibility metadata

- Date: 2026-05-30
- Status: Accepted
- Context: The governance route archive and identity-conflict replay surfaces already summarized routing decisions, but the backend contract still lacked a stable route identity that could survive reloads, archive round-trips, and cross-service replay without recomputing everything from the current UI state.
- Decision: Extend the canonical workspace approval route summary with a deterministic route key, route scope, and active-member eligibility metadata, and normalize older archived route records back into that contract on load.
- Rationale: Route summaries should be replayable as backend identity artifacts, not just human-readable labels. The stable key makes the route comparable across archives, while the eligibility metadata makes it clear whether the active member can actually execute the route or must hand off to the reviewer path.
- Consequence: Approval routes now have a reproducible backend-facing identity contract, and archive/history loaders can round-trip older records without fragmenting the governance model.

## D-262 - Measured AI telemetry should persist prompt registry lineage

- Date: 2026-05-30
- Status: Accepted
- Context: Measured AI telemetry already captured provider, model, duration, and token estimates, but the run trail still did not record which canonical prompt registry entry produced the action, which made the telemetry useful for performance but weak for provenance.
- Decision: Persist prompt registry lineage on each measured AI action telemetry record, including prompt id, version, title, agent, stage, and output schema, and surface that lineage in the Debug panel and support ingestion path.
- Rationale: AI actions should be explainable as canonical prompt executions, not just opaque provider calls. Recording prompt lineage keeps the telemetry aligned with the prompt registry and makes support bundles, debug logs, and runtime reports auditable.
- Consequence: The AI execution ledger can now explain which prompt definition produced a given action, while still leaving the prompt registry itself as the canonical source of prompt metadata.

## D-265 - Prompt registry snapshots should persist as a history ledger

- Date: 2026-05-30
- Status: Accepted
- Context: The prompt registry was visible in Debug, but it still behaved like a current-state table rather than a durable governance trail for future prompt-stage changes and audit replay.
- Decision: Persist prompt registry snapshots as a history ledger captured from model eval runs and manual snapshots, and expose the snapshot trail in the Debug panel alongside the live prompt registry.
- Rationale: The registry should be auditable across time, not just visible in the current UI. Capturing snapshots keeps prompt evolution aligned with the existing eval and telemetry history without inventing a separate prompt-management system too early.
- Consequence: The app can now compare current registry state against historical snapshots, and future prompt-stage growth can build on a durable history instead of starting from a blank table.

## D-263 - ONVIF event subscription details should survive the full live-camera evidence path

- Date: 2026-05-30
- Status: Accepted
- Context: The ONVIF probe could already negotiate credentials and fetch the event-subscription leg, but the subscription URI/reference/expiry still risked getting lost between the probe result, camera node, inspector cards, and event-ledger trail.
- Decision: Treat ONVIF event-subscription URI, reference, and expiry as canonical live-camera state and carry them through the probe response, camera node schema, stored live-connection events, live session registry, inspector cards, and HUD surfaces.
- Rationale: Subscription details are part of the real device handshake story and operators need to see them in the same archive/session trail as the rest of the live-camera state. Keeping them in one canonical path avoids a hidden split between the probe result and the visible evidence model.
- Consequence: The live camera path now preserves event-subscription metadata through the UI, store, archive, and route responses instead of only reporting the initial credential negotiation, and the remaining gap is specifically renewal/continuity of that live event stream.

## D-264 - Compare handoffs should carry the checkpoint provenance note through compare/report bootstrap

- Date: 2026-05-30
- Status: Accepted
- Context: Scene Intelligence already exposed exact-versus-derived checkpoint provenance on the reconstructed checkpoint card, but the compare/report handoff only received the snapshot ids. That made the shareable compare pair legible, but the provenance story itself could still be dropped at the point the handoff left Scene Intelligence.
- Decision: Extend the compare share-link contract and compare/report bootstrap state with an optional provenance note, and surface that note in Before/After, Report Lite, and Compare View when the seeded compare pair still matches the active selection.
- Rationale: The handoff should preserve the same exact/derived trust signal that Scene Intelligence already computed, instead of forcing operators to reconstruct it from the source checkpoint after they have already crossed into compare/report mode.
- Consequence: Compare/report surfaces now stay aligned with Scene Intelligence when the comparison was seeded from a checkpoint, while still falling back to an explicit prompt when the active pair no longer matches the seeded provenance.

## D-266 - ONVIF heartbeat renewal should refresh the event-subscription lease, not just preserve it

- Date: 2026-05-30
- Status: Accepted
- Context: The live-camera heartbeat path already preserved ONVIF event-subscription URI/reference/expiry in the registry and UI, but that still left the subscription lease static unless a new probe happened to run.
- Decision: Teach the ONVIF client to renew the event subscription through the subscription reference when the lease is nearing expiry, and have the canonical camera-live heartbeat path call that renewal helper so the live session can stay continuous without a new probe.
- Rationale: Real ONVIF sessions need an actual renewal step. Preserving the lease metadata is useful, but it is not the same as refreshing the device-side subscription. The heartbeat path is the natural place to do that because it already models keepalive semantics.
- Consequence: Heartbeat renewals now extend the live ONVIF subscription lease and update the canonical session/archive/UI fields, narrowing the remaining gap to longer-lived continuity and device-side event streaming rather than basic lease bookkeeping.

## D-267 - Studio build should include explicit fallback routes for production artifact stability

- Date: 2026-05-30
- Status: Accepted
- Context: The clean production build for `apps/studio` was failing on Next-generated fallback artifacts for the app-router `not-found` route and the exported `500.html` page, which blocked browser verification even though the main dashboard implementation was otherwise ready.
- Decision: Add explicit `src/app/not-found.tsx` and `src/pages/500.tsx` fallback routes so Next can produce the required production artifacts deterministically during clean builds.
- Rationale: The dashboard must be verifiable from a clean production build, not only from a partially seeded dev tree. Providing explicit fallbacks keeps the app resilient and avoids relying on auto-generated error-route artifacts that were intermittently missing in this environment.
- Consequence: The studio now builds cleanly from a fresh `.next` tree and can be launched into a stable production server for visual comparison against the design pack.

## D-268 - AI provider governance should persist a history ledger alongside the live selection

- Date: 2026-05-30
- Status: Accepted
- Context: The AI control plane already exposed the live provider selection, local-only policy, prompt registry history, and measured telemetry lineage, but provider governance itself still behaved like a current-state snapshot instead of a durable trail of selection and policy changes.
- Decision: Persist AI provider governance snapshots as a history ledger captured from provider selection changes, local-only policy changes, manual capture, and eval runs, and expose that trail in the Debug panel alongside the live provider governance summary.
- Rationale: Provider choice and local-only policy are part of the operational AI control plane, not just configuration. Keeping a history makes provider changes auditable over time and aligns the provider layer with the existing prompt-registry and telemetry history patterns.
- Consequence: The app can now compare current provider policy against prior snapshots, and future provider/model governance work can build on a durable history instead of only the live selection state.

## D-269 - AI action telemetry should compare recent runs against a longer-horizon policy baseline

- Date: 2026-05-30
- Status: Accepted
- Context: The AI telemetry trail already summarized recent-vs-previous window movement, but that still only exposed a short local trend and did not distinguish momentary spikes from broader drift over a longer operational baseline.
- Decision: Extend the AI telemetry summary with a longer-horizon policy baseline and expose a policy label and policy note in the Debug panel alongside the short-window trend summary.
- Rationale: The control plane should tell operators whether recent AI performance is actually drifting relative to the longer run history, not just whether the latest few events are faster or slower than the immediately preceding slice.
- Consequence: The debug telemetry trail now supports both short-window trend and longer-horizon policy comparison, while leaving room for future operator-tunable thresholds and broader telemetry dashboards.

## D-270 - ONVIF notification envelopes should map into canonical operational evidence through the existing camera metadata ingest boundary

- Date: 2026-05-30
- Status: Accepted
- Context: The camera metadata ingest route already handled JSON, NDJSON, and generic XML camera records, but ONVIF WS-Notification envelopes were still being parsed only as a library helper instead of flowing into the operational ledger through the canonical ingest/archive path.
- Decision: Extend the existing `/api/camera-metadata-ingest` boundary so it can parse ONVIF notification envelopes into operational evidence events, persist those events in the camera metadata archive history, and let the inspector feed them into the canonical operational evidence ledger.
- Rationale: ONVIF metadata should not require a parallel route or a mock bridge when the existing ingest path already owns camera metadata, history persistence, and scene-matched evidence updates. Reusing that path keeps camera metadata, ONVIF notification evidence, and inspector history aligned around one canonical archive model.
- Consequence: ONVIF notification envelopes now land as first-class evidence events through the camera metadata ingest path, while the broader ONVIF Profile M richness remains a future extension of the same canonical ingest boundary rather than a separate system.

## D-271 - AI telemetry policy should be persisted and editable alongside the live longer-horizon comparison

- Date: 2026-05-30
- Status: Accepted
- Context: The AI telemetry control plane already compared recent runs against a longer-horizon baseline, but the threshold values themselves still lived as hard-coded constants rather than a persisted operator control.
- Decision: Persist the AI telemetry policy in the store and expose it as an editable Debug-panel control that drives the telemetry summarizer.
- Rationale: Operators need to tune the telemetry windows and regression thresholds without changing code, and the policy should travel with the rest of the AI governance state so telemetry comparisons stay auditable over time.
- Consequence: The telemetry control plane now carries a persisted recent/baseline window policy plus duration, token, and success-rate thresholds, and future work can expand the single policy into stage-specific profiles or broader dashboard controls without reworking the storage shape.

## D-265: Browser-native share surfaces should reuse the same link builders with copy fallback

**Context:** Scene Intelligence, compare, and report surfaces already had canonical deep-link builders for checkpoints, archives, and compare handoffs, but they still depended on copy/open buttons only.

**Decision:** Add a shared share-link helper that attempts `navigator.share` when available and falls back to clipboard copy when the native share surface is unavailable, so the same handoff URLs work on mobile and desktop without forking the link contract.

**Why:** This keeps the public handoff flow aligned with the existing copy/open behavior, avoids duplicate link-building code, and gives the product a real browser-native share surface where supported.

**Consequence:** Archive and compare cards can now share the same checkpoint/archive URLs through the browser share sheet, while existing copy/open buttons remain available as the fallback path.

## D-272 - Operational evidence events should be schema-first and build-time validated

- Date: 2026-05-30
- Status: Accepted
- Context: The operational evidence layer already had a parser wrapper and hand-maintained TypeScript event shape, but the canonical event contract itself was still implicit in caller code and normalizer assumptions.
- Decision: Define the operational evidence event contract as a canonical zod schema plus companion input schema, and make `buildOperationalEvidenceEvent(...)` validate/canonicalize its inputs before emitting a ledger event. Nested scene snapshots must be validated against the SecurityScene parser before they can enter the event, and the normalized event must satisfy the output schema before it is returned.
- Rationale: The evidence ledger is a platform spine, so the event shape needs to be discoverable and enforceable in one place. Schema-first validation reduces drift between builder, archive, journal, and UI callers, while still allowing the builder to canonicalize blank human-authored fields into the final event form.
- Consequence: Ledger imports and live event creation now share one canonical contract, malformed snapshots are rejected at the boundary, and future event kinds or payload extensions can be added by extending the schema rather than duplicating validation logic across callers.

## D-273 - SentinelTwin reviews and planning must use full-vision framing, not milestone shorthand

- Date: 2026-05-30
- Status: Accepted
- Context: Milestone shorthand (for example, checkpoint-style version framing) was repeatedly causing implementation and review loops to optimize for local demo completeness rather than full product truth.
- Decision: Evaluate and plan SentinelTwin only against the full product vision using explicit state buckets: real, partial, scaffold/placeholder, missing, and next-build-required.
- Rationale: The simulation engine is a core subsystem, not the product endpoint. Full-vision framing keeps intake, evidence, verification, reporting, collaboration, and deployment gaps visible and actionable.
- Consequence: Audits, implementation backlogs, and acceptance criteria must map each subsystem to full-vision state and required next work; checkpoint shorthand must not be used as completion logic.

## D-274 - Publication checkpoints should be resolved through a canonical publication helper

- Date: 2026-05-30
- Status: Accepted
- Context: The temporal twin summary already distinguishes reconstructable checkpoints from published checkpoints, but the published branch was still being resolved inline by multiple callers using the same kind/published-flag filter.
- Decision: Add a canonical publication checkpoint resolver that returns the latest published entry plus its source provenance, and use that resolver from the temporal twin summary instead of duplicating the publication lookup logic inline.
- Rationale: Publication is a semantic layer on top of the evidence timeline, not just another event filter. Centralizing the lookup makes the published branch easier to reason about and keeps report/Scene Intelligence publication views aligned.
- Consequence: The ledger now has an explicit publication checkpoint helper that can be reused by the report and timeline surfaces, while the temporal twin summary remains the single consumer of the resolved publication checkpoint state.

## D-275 - Camera View verification snapshots should enter the operational evidence ledger

- Date: 2026-05-30
- Status: Accepted
- Context: The real-footage verification workflow already saved alignment snapshots locally, but those captures were still living only in panel state and panel-specific summaries instead of the canonical evidence trail.
- Decision: When the operator saves a Camera View verification snapshot, also emit a `snapshot_saved` operational evidence event with verification branch metadata, scene provenance, revision depth, affected camera id, and confidence derived from the alignment score.
- Rationale: Verification is an operational activity, not a throwaway preview. Saving the snapshot into the evidence ledger keeps the verification workflow auditable alongside scene edits, scans, simulations, and reports, and it makes the current preview-level verification path feel like part of the same product spine.
- Consequence: Camera View verification snapshots now round-trip through the evidence ledger and can be searched, audited, and timeline-linked from the same provenance surface as the rest of the scene history, while the feature status remains preview until real-feed validation is stronger.

## D-276 - Workspace approval route summaries should be schema-first and archive-validated

- Date: 2026-05-30
- Status: Accepted
- Context: The approval route summary already carried route key, scope, labels, and drift metadata, but the summary shape was still being hand-normalized in the archive loader instead of validated by a canonical schema.
- Decision: Define a workspace approval route summary schema and use it for route normalization and archive loading, so route records and their derived metadata are parsed through one canonical contract.
- Rationale: The approval route is a governance primitive that travels through live UI, archive history, conflict replay, and handoff logs. A schema-backed route summary reduces drift and makes the route contract explicit enough to reuse beyond a single helper.
- Consequence: Workspace approval routes now normalize through a shared schema before they enter archive or conflict records, and future remote approval routing can extend the same contract instead of inventing another route shape.

---

## D-277 - Unified Site Twin draft/review pipeline for all intake sources

- Date: 2026-05-30
- Status: Accepted
- Context: Site creation was fragmented across multiple surfaces (SiteIntakeHub, ProjectStartLauncher, ScanSiteWizard, SceneBuilderWizard, AI draft modal, JSON import) with no shared review contract. Each source had its own compile path, and some bypassed review entirely.
- Decision: Define a canonical `SiteTwinDraft` type that every intake source must produce before the scene becomes active. The draft includes entity counts, assumptions, actionable warnings with suggested fixes, missing prerequisites, provenance, and suggested next actions. A single `compileToSiteTwinDraft()` function upgrades any `SiteCompilerResult` into this draft. The `SiteDraftReview` component renders the full draft uniformly regardless of source.
- Rationale: A shared review contract ensures every site twin goes through the same quality gate, regardless of how it was created. This prevents low-quality AI drafts or incomplete scans from entering the simulation pipeline without human review. Actionable warnings with suggested fixes reduce operator cognitive load. Missing prerequisite tracking makes it clear when baseline simulation can run.
- Consequence: All five intake sources (scan, AI draft, floor plan, JSON, manual) now flow through one review → approve → baseline simulation → Studio pipeline. The `canRunBaselineSimulation()` function gates automatic simulation to scenes with at least one camera and one critical zone. Manual/guided scan naming is consistent: dashboard "Scan a Site" → manual mode, "Guided Scan Assistant" → guided mode. Maturity language is truthful everywhere: no claims of automatic segmentation, depth, or reconstruction.
- Key files: `lib/site-compiler.ts` (unified draft model), `components/site-intake/SiteDraftReview.tsx` (full review UI), `app/page.tsx` (routing), `lib/__tests__/site-twin-draft.test.ts` (22 tests)
- Alternatives rejected: per-source review components (duplicate UI, drift risk), bypassing review for "trusted" sources like JSON import (trust without verification is how errors propagate), keeping separate compile functions without a shared draft type (already had this and it caused inconsistency).

## D-279 - Scan/Reconstruction pipeline is architecture-first, adapter-scaffolded, review-enforced

- Date: 2026-05-30
- Status: Accepted
- Context: The product had a working manual-assisted scan pipeline (ScanSiteWizard → compileScanSessionToScene), but no foundation for AI/CV-assisted reconstruction. Adding real capture-to-scene compilation without a data model would create the same kind of fragmentation that the SiteTwinDraft unification fixed for intake sources.
- Decision: Build the scan/reconstruction pipeline in three layers:
  1. **Data model first** — `ScanArtifact`, `ScanCaptureSession`, and enhanced `ScanCandidate` types with capture steps, photo roles, scale anchors, artifact/candidate linkage, and typed warnings. These live in `lib/scan-artifacts.ts` and are independent of any specific AI model.
  2. **Adapter interfaces** — `ObjectDetectionAdapter`, `SegmentationAdapter`, `DepthEstimationAdapter`, `ScaleAnchoringAdapter`, `MultiPhotoCorrespondenceAdapter`, `StructuralExtractionAdapter`, and `VisionProvider` in `lib/scan-adapters/types.ts`. All interfaces exist; no model backends are wired yet.
  3. **Compilation pipeline** — `compileReconstructionToScene()` and `compileReconstructionToSiteTwinDraft()` convert approved session candidates into canonical `SiteTwinDraft` through the existing site-compiler pipeline, preserving the review → approve → baseline simulation flow.
- Rationale: The previous scan pipeline had no intermediate representation for AI/CV outputs (masks, depth maps, detection results). Adding model integrations without a shared data model would make each model a disconnected experiment. The three-layer approach lets models be integrated incrementally while the product contract stays stable. The adapter interfaces are deliberately wider than what will be implemented first, so future model experiments have a place to live.
- Key design rules:
  - Every AI/CV candidate starts with `status: "pending"`. Only user-accepted candidates reach compilation (`forceReview: true` by default).
  - The pipeline produces `SiteTwinDraft`, not direct `SecurityScene` mutation. The site-draft-approval path applies to all reconstruction output.
  - All adapters return confidence and warnings. The quality gate system evaluates completeness before compile.
  - Adapter interfaces are scaffolded but not wired. This is intentional: the architecture is ready before any model dependency is introduced.
  - `ScanArtifact` supports photos, depth maps, masks, point clouds, and camera poses — only photos are wired in the initial implementation.
- Files created:
  - `lib/scan-artifacts.ts` — Core data model (380 lines)
  - `lib/scan-adapters/types.ts` — Adapter interfaces (90 lines)
  - `lib/scan-reconstruction.ts` — Compilation pipeline (340 lines)
  - `lib/scan-quality-gates.ts` — Quality gate evaluation (130 lines)
  - `lib/__tests__/scan-artifacts.test.ts` — 33 tests
  - `lib/__tests__/scan-reconstruction.test.ts` — 27 tests
  - `lib/__tests__/scan-quality-gates.test.ts` — 12 tests
- Site compiler extended: `"guided_scan"` and `"reconstructed"` source types added.
- Total: 73 new tests, all passing. Existing 359 tests unchanged, 12 existing scan tests unchanged.

## D-278 - Report exports should surface visibility redaction and buyer drill-through explicitly

- Date: 2026-05-30
- Status: Accepted
- Context: Report exports already carried audience policies and visibility labels, but the buyer-facing drill-through path was still implicit and the redaction posture was easy to miss in the exported artifact itself.
- Decision: Add explicit visibility/redaction summaries, buyer drill-through shortcuts, and privacy masking summaries directly into the report export surfaces, and mirror the same disclosure framing in compare exports.
- Rationale: Report artifacts need to read like buyer-ready handoff material, not just simulation dumps. Showing the redaction posture and direct section shortcuts at the point of export makes the report easier to consume, easier to trust, and harder to misread when it is shared outside the workspace.
- Consequence: Report exports now expose a visible redaction story and direct drill-down path, while the remaining work remains on standards-specific templates, catalog persistence, and richer export formats.

## D-280 - SecurityScene evidence parity and live transport metadata synchronization

- Date: 2026-05-31
- Status: Accepted
- Context: Runtime and schema consumers drifted after adding live evidence/mismatch workflows and camera transport metadata, causing type/runtime mismatches between `apps/studio`, `@sentineltwin/core`, and `@sentineltwin/simulation`.
- Decision: Treat `evidenceArtifacts` and `mismatchReports` as first-class SecurityScene fields across schema, scene skeletons, migrations, and compiler boundaries; keep camera live transport/auth challenge fields optional but schema-defined for provenance fidelity.
- Rationale: Evidence-backed verification cannot be durable if scene contracts differ by package. Schema parity plus migration support prevents regressions while preserving older scene imports.
- Consequence: Studio scene parsing now migrates legacy comment ids and defaults, scene defaults include evidence arrays, core/studio schema parity is restored, and simulation callers compile against one scene contract.

## D-281 - Collision layer schema for three-layer entity model

- Date: 2026-05-31
- Status: Accepted
- Context: Principle 3 ("three-layer entities") was aspirational — the schema had no fields for controlling visual mesh, physics collider, or vision collider participation per node. The vision collider mesh builder included all physical nodes unconditionally.
- Decision: Add `collisionLayerSchema` as an optional field on all physical node types (walls, doors, windows, cameras, security lights, obstructions, sensors). Each field (`visualMesh`, `physicsCollider`, `visionCollider`) defaults to `true`. The `vision-collider-mesh.ts` builder now skips nodes where `visionCollider: false`.
- Rationale: Per-node collision layer control enables decorative objects that shouldn't block cameras, invisible collision volumes for pathfinding, and fine-grained rendering control without duplicate scene representations.
- Consequence: Physical nodes carry an optional `collisionLayer` object. Existing scenes without the field parse correctly (optional with Zod defaults downstream). `buildVisionColliderMesh` respects `visionCollider`. `physicsCollider` field is reserved for future nav-mesh integration.

## D-282 - generateNodeId utility and AnyNode type

- Date: 2026-05-31
- Status: Accepted
- Context: ID generation was scattered across modules with ad-hoc implementations (e.g. `Math.random().toString(36)` in `reconstruction-pipeline.ts` and `organization-store.ts`). No centralized `AnyNode` union type existed.
- Decision: Add `generateNodeId(prefix)` to core schema with typed `IdPrefix` union covering all 17 ID prefixes enforced by Zod `.startsWith()`. Add `AnyNode` as the canonical union of all node types, with `AnyEditableNode = AnyNode` as a backward-compatible alias.
- Rationale: Centralized ID generation ensures prefix compliance without callers needing to know Zod constraints. `AnyNode` provides a single union type for generic node operations.
- Consequence: New code should use `generateNodeId("cam_")` instead of ad-hoc random strings. `AnyNode` is available for type-safe generic node arrays.

## D-283 - getNodeById flat lookup utility

- Date: 2026-05-31
- Status: Accepted
- Context: The store had no `getNodeById` method. All node lookups were O(n) linear scans via `Array.find()` on individual node type arrays. Callers had to know which array to search.
- Decision: Add `findNodeInScene(scene, id)` pure utility and `getNodeById(id)` store method that scans all 11 node collections and returns `AnyNode | null`.
- Rationale: Provides a single entry point for node lookup without callers knowing the node type. The O(n) scan is acceptable for current scene sizes (<2000 nodes). A flat `Record<id, AnyNode>` dict requires a full schema migration (D-284) and is deferred.
- Consequence: `store.getState().getNodeById("cam_abc123")` returns the camera node or null. Implementation uses linear scan; O(1) optimization deferred.

## D-284 - Resolution fallback guard for deriveResolutionWidth

- Date: 2026-05-31
- Status: Accepted
- Context: `deriveResolutionWidth` in `coverage.ts` had a silent failure path: if `resolutionMP` was 0 or missing alongside both `resolutionWidth` and `resolutionHeight`, the function would return `0`, producing zero PPM and effectively "no coverage" for that camera.
- Decision: Clamp `resolutionMP` to a minimum of `0.1` before computing fallback dimensions.
- Rationale: Zero-PPM coverage is a silent failure that looks like a legitimate coverage gap. A minimum of 0.1 MP (100k pixels) ensures the fallback produces a reasonable width and valid coverage, even with incomplete camera data.
- Consequence: Cameras with missing specs will still produce plausible fallback coverage instead of silently showing zero.

## D-285 - Landmark binding confidence should come from a normalized geometric fit

- Date: 2026-05-31
- Status: Accepted
- Context: `computeLandmarkAlignmentConfidence` previously returned a hand-tuned score based mostly on match count, which could overstate confidence for weak landmark sets and ignored the actual correspondence geometry.
- Decision: Replace the count-based stub with a normalized correspondence solver. Use a projective fit when there are enough correspondences, fall back to an affine fit for smaller valid sets, then score the result by reprojection residuals, landmark spread, and a soft camera visibility prior.
- Rationale: Binding confidence should be derived from the match geometry itself, not from arbitrary count thresholds. Residual-based scoring is more durable, easier to reason about, and less likely to mislead downstream UI/report surfaces.
- Consequence: The helper is now a real geometric estimator rather than a placeholder heuristic, and the shared binding builder stamps that confidence onto the canonical evidence payload so downstream consumers can prefer the stored transform confidence. It remains normalized rather than fully camera-calibrated because the binding schema does not yet carry explicit calibration metadata.

## D-286 - Package builds must regenerate declaration boundaries from source

- Date: 2026-05-31
- Status: Accepted
- Context: `@sentineltwin/core` could report a successful build while `packages/core/dist/index.d.ts` was missing because `tsconfig.tsbuildinfo` was stale. Downstream `@sentineltwin/simulation` then failed with `TS6305` when TypeScript compared core source files against missing/outdated declaration outputs.
- Decision: Build referenced packages with TypeScript build mode forced (`tsc -b --force`), remove `tsconfig.tsbuildinfo` during package clean, cache `tsconfig.tsbuildinfo` together with `dist`, and avoid source-path aliases from `@sentineltwin/simulation` back into `@sentineltwin/core/src`. The Studio production build also clears `.next` before `next build` so dev/prod static manifests cannot be mixed across build ids.
- Rationale: A package boundary is only valid when source, emitted declarations, and incremental build metadata agree. Trusting stale incremental metadata after `dist` changes breaks the monorepo contract. Downstream packages should consume core through its package/reference boundary, not by reaching through to source files. The same artifact-boundary rule applies to Next output: `.next` is generated build state and should not survive into a fresh production build when manifests can drift.
- Consequence: `core`, `simulation`, and `report` rebuild their public declarations from source on package build; clean removes both emitted artifacts and incremental state; Turbo cache restore keeps declaration output and build metadata together; `simulation` no longer mixes core source aliases with project-reference declaration checks; Studio production builds regenerate `.next` from scratch.

---

## D-287 — Simulation engine maturity: calibration, confidence, hashing, provenance

- Date: 2026-06-01
- Status: Accepted
- Context: The simulation engine computed deterministic coverage but offered no calibration basis, confidence estimates, or provenance metadata. Every simulation result appeared equally trustworthy regardless of input quality. See Thread 2b in exploration map for full audit.
- Decision: Add four foundational maturity layers simultaneously:
  1. **Calibration constants module** (`packages/simulation/src/calibration.ts`) with 7 camera presets (indoor dome 2MP, wide dome 5MP, bullet 5MP, PTZ 8MP, thermal 640, low-light 4MP, LPR 2MP), lux-to-light-level thresholds, night-mode PPM retention factors, mount tilt limits, and lens edge-falloff defaults. Default calibration is always available; scenes can override via `SecurityScene.calibrationConstants`.
  2. **Scene hashing** (`packages/simulation/src/scene-hash.ts`) — deterministic hash of all simulation-relevant inputs. Every `SimulationResult` now carries a `sceneHash` for stale-result detection.
  3. **Confidence propagation** (`packages/simulation/src/confidence.ts`) — `ConfidenceBand` with level, source, reason codes, and sensitivity tags. Computed automatically from camera provenance, geometry validity, calibration presence, and lighting assumptions. Stored in `SimulationResult.overallConfidence`, `zoneConfidence`, `pathConfidence`.
  4. **Simulation provenance** (`SimulationResult.provenance`) — engine version, calibration version, computation mode, execution time.
- Rationale: Without calibration, confidence, and provenance, every simulation result is equally credible regardless of input quality. This is dangerous for a security audit tool. The calibration module provides named constants that can be traced to source spec sheets. Confidence bands give operators a quick signal about when to trust a result. Scene hashing enables future stale-result prevention. Provenance enables debugging and regression tracking.
- Consequence: Every `simulateStudio()` call now emits scene hash, provenance, and confidence bands. Calibration is used by default. Scene hashes can be compared with `isSceneHashMatch()` for stale-result prevention. No UI panels exist yet for these fields — they are data-level only for now.
- Key files:
  - `packages/core/src/schema/security-scene.ts` — New schemas: `confidenceLevelSchema`, `confidenceBandSchema`, `calibrationCameraPresetSchema`, `calibrationConstantsSchema`, `sceneInputHashSchema`, `simulationProvenanceSchema`
  - `packages/simulation/src/calibration.ts` — Default calibration constants, preset library, utility functions
  - `packages/simulation/src/scene-hash.ts` — Deterministic hashing
  - `packages/simulation/src/confidence.ts` — Confidence computation
  - `packages/simulation/src/simulate-studio.ts` — Wired at lines 689-710
- Alternatives rejected: Hardcoding calibration in the coverage engine (breaks schema-driven design), skipping confidence for V0.1 (too risky for a security tool), using crypto.subtle for hashing (overkill for stale-result detection).

## D-288 — Scenario batch runner for multi-state comparison

- Date: 2026-06-01
- Status: Accepted
- Context: The engine simulated only the current scene state. Operators needed to compare security posture across scenarios: day vs night, camera failure, light failure, obstruction moved.
- Decision: Add `ScenarioState` schema with overrides for camera status, light status, door state, time of day, light level, and obstruction presence. Add `runScenarioBatch()` that clones the scene, applies each state, re-simulates, and returns deltas. Default scenarios: `normal_day`, `normal_night`, `night_no_lights`. Helper generators: `generateCameraOfflineScenarios()`, `generateObstructionRemovedScenarios()`, `generateCameraBlockedScenarios()`.
- Rationale: Batch comparison is the foundation for temporal simulation and what-if analysis. Each scenario is a first-class concept with structured overrides rather than ad-hoc scene mutations. The delta model makes comparison explicit and reportable.
- Consequence: `runScenarioBatch()` returns `ScenarioBatchResult[]` with coverage/quality/zone/adversarial deltas. Results are NOT embedded in `SimulationResult` (avoids circular schema dependency). UI can call batch independently and store results alongside scene snapshots.
- Key files:
  - `packages/core/src/schema/security-scene.ts` — `scenarioStateSchema`, `scenarioBatchResultSchema`
  - `packages/simulation/src/scenario-batch.ts` — `runScenarioBatch()`, generators, `applyScenarioState()`
- Alternatives rejected: Embedding scenarios in `SimulationResult` (circular Zod dependency), running scenarios as separate ad-hoc calls (no structured comparison), storing full re-simulation results per scenario (too heavy).

## D-289 — Counterfactual search with verified simulation ranking

- Date: 2026-06-01
- Status: Accepted
- Context: The existing recommendation engine produced one heuristic recommendation (move first obstruction, rotate first camera). Operators needed to see multiple options ranked by simulated improvement, cost, and constraints.
- Decision: Add `computeCounterfactualSearch()` that generates candidate fixes (move obstruction, rotate camera, add camera, add light), simulates each, computes a score from improvement, cost rank, and zone delta, then ranks candidates. Supports constraints: `cameraCannotMoveIds`, `noNewCamera`, `maxCostCategory`. Core rule: AI proposes — simulation verifies.
- Rationale: A single recommendation hides tradeoffs. Counterfactual search surfaces the decision space: the cheapest fix may not be the most effective, and the best fix may violate constraints. Ranking by score makes tradeoffs visible. Every candidate's score is backed by a real simulation, not a heuristic estimate.
- Consequence: `computeCounterfactualSearch()` returns `CounterfactualSearchResult` with up to 20 candidates, each with verified deltas, cost category, and rank. The old single-recommendation path is preserved for backward compatibility. UI can switch to the ranking view when operators need to explore options.
- Key files:
  - `packages/core/src/schema/security-scene.ts` — `counterfactualResultSchema`, `counterfactualSearchResultSchema`
  - `packages/simulation/src/counterfactual-search.ts` — `computeCounterfactualSearch()`, generators, scoring
- Alternatives rejected: Using the placement oracle for all counterfactuals (placement only handles new cameras, not obstruction moves or re-aiming), ranking by heuristic without simulation (violates "AI proposes — simulation verifies"), single fix at a time (hides tradeoffs).

## D-290 — Assumption sensitivity analysis for input-criticality ranking

- Date: 2026-06-01
- Status: Accepted
- Context: Operators had no way to know which inputs most affected simulation results. A coverage failure might be robust or might flip with a 10% person-height change. The engine needed to expose which assumptions drive the conclusion.
- Decision: Add `computeAssumptionSensitivity()` that varies person height (±20%), night penalty on/off, interior light level, exterior lux, backlight intensity, and glare intensity, then reports `coverageDeltaPct`, `qualityDelta`, `zoneStatusChanges`, and a classified sensitivity level (critical/high/medium/low/none) per assumption. Results are sorted by severity.
- Rationale: Security professionals need to know which assumptions are load-bearing. A zone that fails only under specific assumptions might be acceptable; one that fails under all assumptions is a real gap. Sensitivity analysis makes this visible.
- Consequence: `computeAssumptionSensitivity()` returns `AssumptionSensitivity[]` sorted by severity. Results can be displayed in a sensitivity panel showing which inputs matter most. No UI panel exists yet.
- Key files:
  - `packages/core/src/schema/security-scene.ts` — `assumptionSensitivitySchema`
  - `packages/simulation/src/assumption-sensitivity.ts` — `computeAssumptionSensitivity()`, classifiers
- Alternatives rejected: Monte Carlo over all inputs simultaneously (expensive, hard to isolate), operator-declared sensitivity (misses unexpected dependencies), single parameter sweeps without classification (too much data without actionable signal).

## D-XXX | 2026-06-01 | Slice monolithic Zustand store into domain slices; extract page orchestration into hooks

- Date: 2026-06-01
- Status: Accepted
- Context: `studio-store.ts` was a 6763-line single Zustand `create()` block handling ~60 concern areas (scene CRUD, simulation, layout, workflow, governance, telemetry, persistence, AI provider selection, compare, fix sandbox, etc.). `page.tsx` was a 444-line orchestrator with 20+ inline handler functions and 3 useEffect blocks coordinating initialization, URL deep-linking, and error boundaries. The audit identified this as the weakest architectural point — "app architecture is getting obese."
- Decision: Extract 6 domain slices under `store/slices/` (`scene`, `simulation`, `layout`, `workflow`, `governance`, `telemetry`) each owning a cohesive subset of state + actions. Each slice uses `(set: any, get: any)` pattern internally to avoid circular dependencies. `studio-store.ts` becomes a thin composition (~130 lines) that re-exports all shared types and composes the store via `create()`. `page.tsx` orchestration is extracted into `hooks/use-studio-navigation.ts` (all handler functions) and `hooks/use-studio-bootstrap.ts` (initialization effects, error boundaries, deep-link parsing). The obsolete `navigation-slice.ts` (superseded by workflow-slice) is deleted.
- Rationale: Each slice is independently testable and navigable (scene-slice ~1900 lines vs previously 6763 for everything). The combined type `StudioStoreState = SceneSlice & SimulationSlice & LayoutSlice & WorkflowSlice & GovernanceSlice & TelemetrySlice` preserves full external type safety. Page.tsx drops from 444 to ~30 lines. Component selectors and external imports remain unchanged — no consumer migration needed.
- Consequence: Slice creators MUST use `(set: any, get: any)` to avoid circular deps. Cross-slice state is accessed via runtime `get()` calls. Module-level initialization in slice files must be SSR-safe (guarded by `typeof window !== "undefined"` or using proper default objects instead of `{} as Type`). The composition is strict — no overlapping field names between slices (verified by script). Build passes with 0 errors. Refactoring is purely additive: every existing behavior, type export, and API surface is preserved.
- Key files:
  - `apps/studio/src/store/studio-store.ts` — composition point (~134 lines, down from 6763)
  - `apps/studio/src/store/slices/scene-slice.ts` — scene, nodes, selection, history, tools, map state
  - `apps/studio/src/store/slices/simulation-slice.ts` — simulation result, temporal, counterfactuals, path replay
  - `apps/studio/src/store/slices/layout-slice.ts` — view modes, docks, panels, visibility, themes
  - `apps/studio/src/store/slices/workflow-slice.ts` — product area, workflows, site intake, navigation
  - `apps/studio/src/store/slices/governance-slice.ts` — branches, governance, access, organizations, save/load
  - `apps/studio/src/store/slices/telemetry-slice.ts` — runtime events, camera events, AI telemetry, evidence
  - `apps/studio/src/hooks/use-studio-navigation.ts` — handler functions extracted from page.tsx
  - `apps/studio/src/hooks/use-studio-bootstrap.ts` — initialization effects extracted from page.tsx
  - `apps/studio/src/app/page.tsx` — ~30 lines, down from 444
- Alternatives rejected: Keep monolithic file (audit finding confirmed the obesity risk), split into more granular slices (6 is the sweet spot; more would increase composition boilerplate), use Redux or Jotai instead of Zustand slices (Zustand slice pattern requires zero new dependencies and preserves all existing selectors), use React Context (no selector optimization, re-render issues).

---

## D-291 — Extract `@sentineltwin/agents` package; add LocalProvider, SceneUnderstandingAgent, tool calling

- Date: 2026-06-01
- Status: Accepted
- Context: The AI agent pipeline (~85% complete) lived entirely inside `apps/studio/src/agents/` with no shared package, making reuse impossible for CLI, server, or other consumers. Three missing components were documented in architecture: LocalProvider for air-gapped deployments, SceneUnderstandingAgent for scene comprehension, and tool calling support. The provider abstraction lacked image input support.
- Decision: Create `packages/agents/` as `@sentineltwin/agents` with:
  1. **Full provider abstraction** — `ModelProvider` interface with `complete`, `completeStreaming`, `completeStructured`, and optional `completeWithTools` methods. Three cloud providers (OpenAI, Gemini, Qwen) plus new `LocalProvider` (Ollama-compatible local inference).
  2. **All agent implementations** — `CommandAgent`, `CounterfactualAgent`, `ReportAgent`, `CoordinatorAgent` + `ConversationMemory`, `SceneUnderstandingAgent` (new) for structured scene analysis.
  3. **Infrastructure** — `AgentConfig`, `TokenTracker`, `RateLimiter`, `retryWithFallback`, `provider-selection.ts`, `prompt-registry.ts`, `model-eval.ts` framework.
  4. **Tool calling** — `completeWithTools()` method on `ModelProvider` interface, implemented in all four providers. `ToolDefinition`, `ToolCall`, `ToolCallResult` types added.
  5. **Image input** — `ImageInput` type added to `ModelPrompt` for future VLM support.
  6. **New prompt entries** — `scene_understanding` entry in prompt registry (5 total entries).
  7. **Backward compatibility** — All existing `apps/studio/src/agents/` files replaced with re-exports from `@sentineltwin/agents`. Studio `tsconfig.json` and `package.json` updated to reference the new package.
- Rationale: Agent code must be reusable across the monorepo (CLI, server, future consumers). Local inference is required for air-gapped deployments and offline development. SceneUnderstandingAgent fills the documented gap between the VLM pipeline and structured analysis output. Tool calling is the standard pattern for agentic workflows — having it in the interface enables future RouterAgent and OptimizationAgent implementations without breaking existing consumers.
- Consequence: `@sentineltwin/agents` is now a proper Turborepo package with its own build, typecheck, and dependency graph. Studio imports remain backward-compatible through re-export files. The package depends on `@sentineltwin/core` (SceneOperation schemas) and `zod`. All 34 agent tests pass. 840/856 total studio tests pass (16 pre-existing failures outside blast radius).
- Key files:
  - `packages/agents/package.json`, `packages/agents/tsconfig.json` — package scaffolding
  - `packages/agents/src/providers/ModelProvider.ts` — interface with image input + tool calling
  - `packages/agents/src/providers/LocalProvider.ts` — new Ollama-compatible provider
  - `packages/agents/src/scene-understanding-agent.ts` — new agent
  - `packages/agents/src/counterfactual-agent.ts`, `report-agent.ts` — extracted from app
  - `packages/agents/src/coordinator.ts`, `provider-selection.ts`, `prompt-registry.ts`, `model-eval.ts` — framework components
  - `packages/agents/src/index.ts` — barrel exports
  - `apps/studio/src/agents/*.ts` — replaced with re-exports (backward compat)
  - `apps/studio/tsconfig.json` — added `@sentineltwin/agents` path alias
  - `apps/studio/package.json` — added `@sentineltwin/agents` dependency
- Alternatives rejected: Keep agents in app (blocks reuse), extract only providers without agents (incomplete abstraction — agents are tightly coupled to providers), add LocalProvider to app only (package extraction was the goal), use OpenAI-specific tool calling without abstraction (would break Gemini and Qwen parity), skip SceneUnderstandingAgent (architecture doc lists it as V0.2+ — implementing baseline now reduces later friction).

## D-292 | 2026-06-01 | Harmonize workspace interactions and make blindspot warnings resilient

- Date: 2026-06-01
- Status: Accepted
- Context: Workspace object interaction had duplicated pointer behavior across cameras, sensors, and zones, and blindspot warnings used a single fragile split-based label parse.
- Decision: Standardize selection/click/context behavior in `WorkspaceCanvas.tsx` through a shared local handler path (`makeWorkspaceNodeHandlers`), centralize cursor control, and derive selection from `selectedNodeIds` sets. Replace direct description splitting with obstruction lookup that uses parsed label matching plus fallback heuristics.
- Rationale: The UI interaction surface now has one reliable contract for range-select, select, and context actions, reducing behavior drift across nodes. Heuristic warning matching keeps the warning layer stable while preserving compatibility with existing simulation outputs.
- Alternatives rejected: Keep component-by-component cursor and pointer logic (high regression risk in event ordering), keep direct `" is obstructing"` split as the only matcher (highly brittle across copy/pipeline changes).
- Consequence: Operator interactions for cameras/sensors/critical zones are more consistent with fewer duplicate handlers, and obstruction warnings are less likely to disappear due to message format differences. The long-term fix remains adding explicit obstruction IDs to blindspot issue payloads.

## D-293 - Editor geometry edit helpers should fail safe for malformed geometry/state

- Date: 2026-06-01
- Status: Accepted
- Context: In editor authoring paths, several workspace geometry helpers assumed valid points and wall geometry; malformed coordinates or scene dimensions caused silent `NaN` propagation and brittle edge cases during wall creation, snapping, and nearest-wall checks.
- Decision: Harden `apps/studio/src/components/workspace/editing/editor-geometry.ts` with deterministic input validation and explicit no-op/fallback contracts for malformed geometry: introduce shared `WallSegment` typing, guard all numeric inputs, sanitize/normalize finite points, clamp safely, and return explicit sentinel values (`Infinity`, `[]`, `null`) on invalid state.
- Rationale: Scene-editing utility functions are foundational to all wall and path interactions. A single bad point from UI/state drift should not cascade into unstable editing behavior; defensive geometry utilities preserve operator trust and make failures diagnosable.
- Consequence: Geometry helpers now reject invalid points deterministically, avoid undefined behavior under bad state, and keep tests aligned to failure semantics with added cases in `apps/studio/src/components/workspace/editing/__tests__/editor-geometry.test.ts`.
- Alternatives rejected: Skip guards and rely on callers for input hygiene (insufficient for long-lived interactive UIs), convert to throwing exceptions on invalid input (too disruptive for interactive workflows without clear recovery paths).
- Key files:
  - `apps/studio/src/components/workspace/editing/editor-geometry.ts` — hardened geometry helpers, typed wall segment path, finite-point guardrails
  - `apps/studio/src/components/workspace/editing/__tests__/editor-geometry.test.ts` — expanded failure-path coverage for clamp/snap/shift/path and wall projection

## D-294 - Shared scene rendering and interaction safety for 3D authoring

- Date: 2026-06-01
- Status: Accepted
- Context: The shared 3D scene renderer (`SharedScene.tsx`) accepted malformed geometry/state directly, which could cascade into render artifacts during scene editing and live simulation overlays.
- Decision: Add defensive geometry sanitization, node-selection hook consolidation, lifecycle-aware resource cleanup, and explicit lighting preset extensibility in `apps/studio/src/components/workspace/SharedScene.tsx`. Add helper-level tests for sanitation paths in `apps/studio/src/components/workspace/__tests__/SharedScene.test.ts`.
- Rationale: Scene rendering is the operator trust layer for scene creation. Any malformed values should be contained with explicit fallbacks and deterministic behavior rather than NaN propagation.
- Consequence: Walls/doors/windows/obstructions/paths/privacy zones/heatmaps now skip or normalize malformed payloads; selection state reads are consolidated through reusable selectors; textures and ephemeral path geometries clean up deterministically.
- Key files:
  - `apps/studio/src/components/workspace/SharedScene.tsx`
  - `apps/studio/src/components/workspace/__tests__/SharedScene.test.ts`

## D-297 | 2026-06-02 | User workspace creation lifecycle hardening — stop booting from demo, auto-persist on approval, wire TopBar creation to product router

**Decision:** Fix six structural issues in the workspace creation lifecycle:

1. **Stop booting the app with the retail demo as the active scene** — `scene-slice.ts` now initializes with `createBlankSecurityScene()` instead of the retail shop demo. The demo is seeded into a new `referenceScenes` array in the governance slice.

2. **Auto-persist on draft approval** — `approveIntakeSession` in `use-studio-navigation.ts` now calls `saveSceneToStorage()` after `setScene()`, so approved workspaces immediately appear in "Your Workspaces" without requiring a manual save action.

3. **Wire TopBar create/scan to product navigation** — The Create button and "New Site Twin" / "Scan a Site" dropdown items now call `navigateProductView("manual_builder")` / `navigateProductView("scan_site")` instead of mounting orphaned modals without `onBuild`/`onCompile` handlers.

4. **Unify page.tsx and use-studio-navigation.ts** — `page.tsx` now delegates all handler logic to `useStudioNavigation()`. The hook is the single canonical orchestration provider.

5. **Add canonical `activateWorkspaceFromDraft` action** — A new store action in governance-slice that promotes the draft, saves as workspace, persists evidence, clears the session, and navigates to the correct mode — all in one call.

6. **Separate reference demos from user workspaces** — Added `referenceScenes: SecurityScene[]` to the governance slice, seeded with `createSmallRetailShopScene()`. Reference sites view updated to read from `referenceScenes` instead of `savedProjects`. Added `duplicateReferenceToWorkspace` action.

**Rationale:**
- The app should present a clean "Create your first site twin" experience, not a pre-loaded demo as the active workspace.
- Users should not need to discover a hidden "Save" menu item after approving a draft — persistence should be automatic.
- The TopBar's "Create" and "Scan" modals were effectively broken: they showed UI but never routed through the draft-review pipeline because `onBuild`/`onCompile` were not passed.
- Having two copies of the same orchestration logic (`page.tsx` and `use-studio-navigation.ts`) is a maintenance risk.
- Demos and user workspaces are fundamentally different product concepts and should not share the same data model.

**Alternatives rejected:**
- Incremental fix (just add `onBuild` to TopBar): rejected per principle that the whole create→draft→review→approve→persist pipeline should work end-to-end, not be patched in one place.
- Keep demo in both `savedProjects` and `referenceScenes` for backward compat: rejected because it perpetuates the data-model entanglement. The `source === "demo"` filter in downstream components will still work for user-duplicated workspaces.

**Key files:**
- `apps/studio/src/store/slices/core/scene-slice.ts` — initial scene changed from small-retail-shop to blank
- `apps/studio/src/store/slices/enterprise/governance-slice.ts` — added `referenceScenes`, `activateWorkspaceFromDraft`, `saveSceneAsWorkspace`, `duplicateReferenceToWorkspace`, `addReferenceScene`, `loadReferenceScene`
- `apps/studio/src/hooks/use-studio-navigation.ts` — canonical handler provider; approval now calls `saveSceneToStorage()`
- `apps/studio/src/app/page.tsx` — delegates to `useStudioNavigation()`
- `apps/studio/src/components/layout/TopBar.tsx` — create/scan now navigate to product views
- `apps/studio/src/components/product/ReferenceSitesView.tsx` — reads from `referenceScenes` instead of `savedProjects`

## D-298 | 2026-06-02 | Empty-state routing — delete ad-hoc dashboard hero, route first-time users to SiteIntakeHub

**Decision:** First-time user entry flows now route through the canonical SiteIntakeHub instead of rendering an ad-hoc welcome hero on the dashboard.

1. **Delete the conditional welcome hero in `StudioDashboardHome.tsx`** — removed the `hydrated && savedProjects.length === 0 && scene.cameras.length === 0 && !showWorkspaceLibrary` conditional opener plus the `<div className="border-b border-[#1e2130] bg-gradient-to-b from-[#0e1422] to-[#0a0e18]">` hero block. All icon imports (Plus, FileUp, ScanSearch, ShieldCheck, LayoutDashboard) remain in use elsewhere in the file.

2. **Add first-time auto-redirect in `ProductViewRouter.tsx`** — when `productView === "product_home"` and `savedProjects.length === 0` and `scene.cameras.length === 0`, navigate to `"site_intake"` once on first mount. Implemented with `useRef` (not `useState`) to avoid `react-hooks/set-state-in-effect` and the extra render. Respects explicit user navigation back to `product_home`.

**Rationale:**
- The hero was a marketing voice on a cockpit surface — it duplicated the canonical "QUICK START" subpanel in `QuickStartSection.tsx`, hid the dashboard scaffolding (project list, recent activity, coverage KPIs), and made the empty state feel like a setup wizard. The SentinelTwin design contract explicitly bans setup-wizard tone.
- The SiteIntakeHub is the canonical first full-product entry screen per the design pack (§22). Routing there ensures the empty state is a real product surface, not a marketing one.
- `useRef` (not `useState`) for the one-shot flag is first-principles: state changes trigger re-renders, refs don't. The redirect only needs to fire once per component lifetime, not drive UI.
- `FirstRunGuide` and `ProjectStartLauncher` are preserved because they serve the editor (first time inside the studio, not first time in the product) and the job-first intake respectively — different surfaces, different contexts.

**Alternatives rejected:**
- Keep the hero and route to intake separately: rejected — two ways to do the same thing, drift risk.
- Add a `<Navigate to="site_intake" />` declarative redirect: rejected — needs route-level abstraction we don't have; effect-based redirect with `useRef` is the canonical pattern for cross-store coordinated routing.
- Use `useState` for the redirect flag: rejected — causes an extra render and triggers `react-hooks/set-state-in-effect` lint rule.

**Key files:**
- `apps/studio/src/components/launcher/StudioDashboardHome.tsx` — hero removed (was lines 1257–1316 + closing `)}` on line 1503 in pre-edit numbering)
- `apps/studio/src/components/product/ProductViewRouter.tsx` — auto-redirect at lines 110–123, `useState` → `useRef` in import on line 3

## D-299 | 2026-06-02 | Coverage KPI subtitle must not claim a comparison the store cannot compute

**Decision:** `CoverageMetricsCards.tsx` Coverage card subtitle no longer shows static "vs last run" text. It now shows the real `lastRunDetail` ("Computed simulation") when a run exists, or the existing "Run baseline simulation" CTA when pending.

**Rationale:**
- The previous text claimed a comparison ("vs last run") that no code computed. The store has no `simulationHistory` / `previousRun` field, so the delta was not just unshown — it was nonexistent. Showing "vs last run" without a delta is a trust bug: it tells the user a value is changing when nothing is.
- First-principles: don't claim what you can't deliver. Either show a real delta or admit the state. The "Computed simulation" detail is honest because the caller (`StudioDashboardHome.tsx:911`) actually produces it from a real `computedAt` timestamp.
- Long-term answer is a `simulationHistory` field on `scene.simulation` so the dashboard can show a real delta. Logged in `OPEN_QUESTIONS.md` as a follow-up. The immediate fix is to stop the lie.

**Alternatives rejected:**
- Compute a fake delta from `lastRun` vs now: rejected — time is not delta.
- Add a "First run / Baseline set" toggle: rejected — adds complexity for a transient state; the LAST RUN card already shows the timestamp, so the Coverage card can reuse `lastRunDetail`.
- Hide the subtitle entirely: rejected — useful real-time signal ("Computed simulation") is worth showing; just don't claim a comparison.

**Key files:**
- `apps/studio/src/components/launcher/CoverageMetricsCards.tsx` — line 74 subtitle now uses `lastRunDetail ?? `Updated ${displayRunLabel}``, with `suppressHydrationWarning` for SSR safety


## D-300 | 2026-06-12 | Simulation execution moves off the main thread via a dedicated Web Worker with deterministic fallback

**Decision:** `runSimulation` (and the fix-sandbox recompute) no longer call the engine directly. They route through a canonical runner, `apps/studio/src/lib/simulation-runner.ts`, which prefers a dedicated module Web Worker (`apps/studio/src/workers/simulation.worker.ts`) and falls back to the existing `simulateStudioAsync` cooperative-yield main-thread path when workers are unavailable (SSR, tests, bootstrap failure). The worker also computes the 24h temporal profile in the same run, so `buildSimulationState` no longer recomputes `computeTemporalProfile` synchronously on the main thread after every simulation.

**Rationale:**
- Non-negotiable rule 3 made the simulation layer worker-safe from day one, but nothing ever actually ran it in a worker. Every recompute (BVH raycasting + 96-snapshot temporal profile) blocked the R3F frame loop and editor interactions.
- The temporal profile recompute after every run was the largest hidden main-thread cost; moving it into the same worker round-trip removes it without adding a second pipeline.
- One execution pipeline: all store entry points run through `runStudioSimulation`. No parallel simulation paths, per the no-duplicate-pipelines rule.
- Next 16 / Turbopack natively bundle `new Worker(new URL(...), { type: "module" })` (verified against the bundled Next docs and a production build).

**Verification:** Production build succeeds with the worker chunk; runtime-verified in the browser by instrumenting `Worker.prototype.postMessage` and observing the scene payload posted on Recompute (Tier 4). Fallback path covered by `src/lib/__tests__/simulation-runner.test.ts` (same deterministic result as the sync engine). Execution path (`web worker` vs `main thread`) is recorded in the runtime incident trail for observability.

**Key files:**
- `apps/studio/src/lib/simulation-runner.ts` — canonical runner, worker lifecycle, fallback
- `apps/studio/src/lib/simulation-run-core.ts` — shared pure payload types + temporal helper (no DOM/React)
- `apps/studio/src/workers/simulation.worker.ts` — worker entry
- `apps/studio/src/store/slices/core/simulation-slice.ts` — `runSimulation` + sandbox path now use the runner; `buildSimulationState` accepts a precomputed temporal profile

**Revisit when:** simulation cancellation/progress streaming is needed (worker protocol already has request ids), or when the engine moves to `packages/simulation` worker exports for other shells.

## D-301 | 2026-06-12 | Security Analytics Dashboard is a first-class view mode backed by a pure derivation model

**Decision:** A new `analytics` ViewMode renders `AnalyticsDashboardView`, an interactive command-center dashboard. All numbers come from `buildSecurityAnalyticsModel` (`apps/studio/src/lib/security-analytics.ts`), a pure, headless derivation over canonical store state: simulation result, temporal profile, evidence ledger, and snapshots. No new state, no parallel truth.

**Rationale:**
- Analytics were scattered across bottom-panel tabs (Metrics, Novel, Temporal, Redundancy, Provenance); there was no single surface that answers "how secure is this site, and what should I do next?" at a glance.
- Every dashboard element drills into the canonical surface that explains it: KPI cards open the relevant bottom tab, the 24h chart click scrubs `setTemporalScrub` (scene follows), camera leaderboard rows open Camera View with the camera selected, occlusion offenders select the obstruction and open counterfactuals.
- The model is a pure function with direct tests against the real engine output, so dashboard truth cannot drift from simulation truth.
- Truth labeling follows the existing trust idiom ("Truth: Simulated · deterministic engine output").

**Implementation notes:**
- `setViewMode` previously let the preset layout patch overwrite the requested mode (worked only because the six legacy modes mapped 1:1 to presets). It now honors the requested mode explicitly; analytics reuses the `coverage` dock layout. Initial boot honors `?mode=` for analytics too.
- View key `7`, ViewModeBar secondary option, ViewSettingsModal main-view entry, Help/Shortcuts copy all updated.

**Verification:** 6 model tests in `src/lib/__tests__/security-analytics.test.ts` (engine-backed), runtime-verified in production build with the retail reference scene (KPIs, 24h night-dip chart, DORI bands, leaderboard, drill-through to Camera View observed in browser, Tier 4).

**Revisit when:** the report/export surface should embed the same analytics model, or when org-level multi-site analytics arrive (model is already UI-free and portable).

## D-302 | 2026-06-12 | Drag-to-aim camera placement with live POV preview ("what will this camera see")

**Decision:** Camera placement is now a drag-to-aim interaction: pointerdown anchors the camera, dragging steers the yaw with a live FOV wedge on the floor, pointerup commits (plain click keeps the preset/default yaw). While the camera tool is active, a picture-in-picture `PlacementPreviewPanel` renders the canonical scene from the hover/aim pose — the user sees exactly what the camera would see before it exists. Aim state is canonical editor state (`editor.placementAim` in the scene slice), so the 3D wedge, HUD label, and preview panel can never disagree.

**Companion fixes in the same blast radius:**
- **Selection no longer swallows placement clicks.** Camera frustums/markers/walls/obstructions used to `stopPropagation` on pointerdown even while a placement tool was active — frustum cones alone can blanket the entire floor, making placement nearly impossible on a populated scene. `makeWorkspaceNodeHandlers`, `makeSceneNodeHandlers`, and the obstruction click handler now yield to active placement tools (select/measure/comment keep selection behavior).
- **Preset pickers default to collapsed** — the expanded grid covered most of the canvas at narrow widths, blocking the very placement it configures.
- Orbit rotate is disabled while the camera tool is active so left-drag aims instead of orbiting (pan/zoom unaffected).
- QA hook: `?qa=1` exposes the store on `window.__sentinelStudioStore` for scripted browser verification.

**Verification (Tier 4):** Store-instrumented browser run on the production build: pointerdown set `placementAim` anchor [6,4]; drag updated yaw to 84°; pointerup created the camera at [6, 2.8, 4] with `yawDeg: 84`, selected it, and emitted "Camera placed facing 84°". Screenshot evidence of the aim label, FOV wedge, and the preview panel in AIMING state. Aim-yaw math has direct unit coverage round-tripped against `getYawPitchDirection` (`aim-yaw.test.ts`).

**Key files:** `workspace-canvas-utils.ts` (`computeAimYawDeg`, thresholds), `WorkspaceCanvas.tsx` (aim lifecycle, `AimFovWedge`), `PlacementPreviewPanel.tsx`, `SharedScene.tsx` + handler gates, `scene-slice.ts` (`placementAim`, `setPlacementAim`).

## D-303 | 2026-06-12 | Obstruction object library with custom dimensions

**Decision:** Obstruction placement now goes through a canonical object library (`src/lib/obstruction-presets.ts`): Shelf, Counter, Cupboard, Pillar, Glass Display Case, Partition, Vehicle, Tree/Planter, and Custom Object with user-entered width/depth/height. Each preset maps onto the existing `ObstructionNode` contract — dimensions use the canonical `[width, depth, height]` order, materials/visionTransmission/glare/IR flags feed the deterministic engine directly. A store-backed `ObstructionPresetPicker` mirrors the camera preset picker idiom; the placement ghost shows the true preset footprint; placement centers the node at `height/2`.

**Verification (Tier 4):** Browser-verified on the production build: placing with the Glass Display preset created a node with dims [1.5, 0.6, 1.2], material `glass`, visionTransmission 0.7, y=0.6, and triggered an automatic worker recompute. Catalog validity is regression-tested against the Zod schema (`obstruction-presets.test.ts`).

**Also in this pass:** Analytics dashboard animation polish — KPI entrance stagger + count-up values, chart path draw-in (framer-motion `pathLength`), DORI band grow-in, hover/tap micro-interactions.
