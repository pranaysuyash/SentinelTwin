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
  This is the feature that makes security professionals stop and say "I've never seen this."
- Delaying it to Phase 6 means the most novel and defensible piece of the product
  is the last thing built and least likely to be ready when it matters.
- The algorithm is well-designed (Dijkstra with exposure cost, <10ms on 6,400 nodes).
  The coverage engine is a prerequisite. Nothing else is.

**Implication:** Build phases should treat adversarial path as Phase 2 after coverage engine,
not Phase 4+. Update PHASE docs accordingly.

---

## Future Decisions Pending

| ID | Question | Decision criteria |
|---|---|---|
| D-012 | When to move coverage engine to Web Worker? | Benchmark first. If >16ms on a 40×40 grid + 4 cameras on test hardware, move. |
| D-013 | Rapier: when to add? | Profile first build without it. Add if drag-and-drop quality is unacceptable. |
| D-014 | Camera wall: 4 Canvas or render-to-texture? | Test with 4 Camera nodes. If >30fps degradation, switch to RTT. |
| D-015 | Scene understanding model (V0.2)? | Run bakeoff in experiments/scene_understanding/ |
| D-016 | Segmentation model for scan mode (V0.2)? | Run bakeoff in experiments/segmentation/ |
| D-017 | Coverage entropy metric: surface in V0.1 or defer? | Show to target user for feedback first. |
| D-018 | GSAP vs motion (Framer Motion)? | Decide at first animation implementation. See OPEN_SOURCE_LICENSING.md. |
| D-019 | Local-first vs server-side compute? | See Thread 23 in EXPLORATION_MAP.md. Must resolve before building any data persistence. |
| D-020 | Security Evidence Twin as product mode or primary frame? | See Thread 24 in EXPLORATION_MAP.md. Product decision, not technical. |
| D-021 | Text-to-scene as primary input or secondary? | See Q-016 in OPEN_QUESTIONS.md. Experiment first. |
| D-022 | Multi-sensor scope: camera-only or full physical security? | See Thread 25 in EXPLORATION_MAP.md. Affects data model. Decide before V1 design. |
