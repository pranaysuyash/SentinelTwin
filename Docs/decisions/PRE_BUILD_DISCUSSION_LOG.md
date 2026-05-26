# Pre-Build Discussion — Resolved Topics and Open Decisions

**Updated:** 2026-05-26
**Purpose:** Capture every topic discussed before coding resumed so nothing is lost in chat.
Topics are either resolved (decision made, documented), parked (exploration thread added),
or pending (need answer before the relevant build phase starts).

---

## Resolved: Build our own simulation first, external forks come later (D-010)

**What was decided:** Build and prove SentinelTwin's own simulation pipeline — schema,
coverage engine, adversarial path, camera view, report — before introducing Pascal or
any other external editor repo. External forks are introduced only when we know exactly
what we need from them and have verified they provide it.

**Why:** The simulation core is entirely our own work. Introducing Pascal before understanding
our own pipeline creates unnecessary constraint on our design. The correct sequence:
build → test → understand what the editor needs to provide → then evaluate Pascal.

**Status:** Done. D-010 in DECISION_LOG.md. PHASE_0_SETUP.md updated. Pascal fork
(D-001) still stands as the plan for the editor layer, deferred to the right moment.

---

## Resolved: Adversarial path is a core primitive, not a later phase (D-011)

**What was decided:** Adversarial path simulation is treated as a core simulation primitive,
built immediately after basic coverage works. Not a Phase 4+ feature.

**Why:** Coverage heatmaps exist in JVSG and System Surveyor. The adversarial path — showing
the actual minimum-exposure route updating live as objects change — does not exist anywhere.
It is the differentiating feature. Delaying it means the most novel piece is the last thing built.

**Status:** Done. D-011 in DECISION_LOG.md.

---

## Resolved: Novel algorithms documented (NOVEL_ALGORITHMS.md)

Ten original algorithmic ideas — none from external references, all derived from the
geometry already in the simulation engine. Full specs in NOVEL_ALGORITHMS.md.

Build priority:
1. Occlusion Blame Attribution — which obstruction causes what fraction of zone failure
2. Blind Spot Topology Analysis — connected blind region analysis, entry-to-target corridors
3. Adversarial K-Robustness — minimum cameras that can fail before a route opens
4. Coverage Fragility Field — stability of coverage near DORI thresholds
5. Camera Placement Oracle — marginal coverage gain heatmap on mountable surfaces

**Status:** Documented. Implementation priority in NOVEL_ALGORITHMS.md.

---

## Resolved: Product framing — hackathon is a milestone, not the product boundary

**What was decided:** SentinelTwin is a long-term commercial product. The hackathon is a
forcing function and first public milestone. Architecture decisions are made for the
long-term product, not for the smallest demo.

Implication: don't cut scope for hackathon reasons. Build in dependency order for the
product spine, not demo minimalism.

**Status:** Done. AGENTS.md, CLAUDE.md, and PRODUCT_THESIS.md updated.

---

## Resolved: Market scope — not India-first exclusively

**What was clarified:** The India content (small retail shop story, CP Plus/TVT camera
presets, freemium pricing angle) was added to PRODUCT_VALUE_POSITIONING.md as one
primary market story among several. Not the only market. Not a restriction on ambition.

The India story is authentic and the demo scene should use it. But SentinelTwin's
market is global — professional installers, security agencies, compliance, enterprise.

**Status:** PRODUCT_VALUE_POSITIONING.md updated with India story and Evidence Twin
framing as additive sections, not replacements.

---

## Resolved: GSAP is not pre-emptively removed — decision pending at first use

**What was clarified:** GSAP was incorrectly marked as "blocked" in an earlier session.
GSAP has a licensing decision pending: buy Club GSAP (~$99/yr) OR replace with
motion/anime.js. This decision happens at first animation implementation.

Old docs that reference GSAP (Project Brief, ChatGPT transcripts) are historical context.
New scaffolding should not add gsap until the license decision is made.
OPEN_SOURCE_LICENSING.md has the full analysis.

**Status:** AGENTS.md updated (removed hard "blocked" rule, replaced with "pending
decision at first use"). OPEN_SOURCE_LICENSING.md is the canonical reference.

---

## Resolved: Reference repos are references, not foundations

**What was clarified:** Pascal, GenRecon, Trellis.2, Pixal3D are references — proof that
certain capabilities are possible, not foundational dependencies.

- Pascal: fork candidate for editor layer, after simulation is proven (D-010)
- GenRecon: capture pipeline upgrade candidate for V0.4, code not yet released
- Trellis.2 (Microsoft): generative 3D prior used by GenRecon, potentially usable
  for object-level 3D from SAM masks (Thread 28 in EXPLORATION_MAP)
- Pixal3D: concurrent related work, similar conditioning, monitor for code release

Our simulation algorithms, scene compiler, and security intelligence are all original.

**Status:** EXPLORATION_MAP Threads 21, 22, 28 document these properly.

---

## Resolved: Simulation dependency rule corrected

**What was fixed:** Earlier CLAUDE.md said `packages/simulation` must have zero dependencies.
This was wrong — it should mean zero React/R3F/DOM dependencies, but `three` and
`three-mesh-bvh` are pure geometry libraries and must be allowed.

**Status:** CLAUDE.md rule 3 updated. PHASE_0_SETUP.md updated.

---

## Parked: Text-to-scene as a product input mode (Q-016, D-021)

**Discussion:** Text-to-scene ("create a 10m × 7m shop with two shelves and two cameras")
is not just a hackathon shortcut. It's a first-class input mode for users with no floor plan.

Specific questions: prompt UX, validation of implausible coordinates, correction flow,
composition with the manual editor.

**Status:** Q-016 in OPEN_QUESTIONS.md. D-021 in pending decisions. Experiment planned
at experiments/scene_generation/. Not a V0.1 blocker.

---

## Parked: Data security and local-first architecture (Q-018, D-019, Thread 23)

**Discussion:** Security agencies won't upload client facility layouts to a cloud service.
AI model calls currently require sending SecurityScene JSON externally. This is a
day-one sales blocker for the professional market.

Options explored: client-side only (WebLLM/Ollama), tiered (free = local, pro = cloud),
self-hosted enterprise deployment, selective data sending (send only deltas, not full scene).

Thread 59 (WebLLM feasibility): 1-3B models at 30-50 tokens/sec with WebGPU are viable
for command parsing. IndexedDB caching makes subsequent loads fast.

**Status:** Thread 23, Thread 59 in EXPLORATION_MAP. Q-018, D-019 in OPEN_QUESTIONS and
DECISION_LOG. Must resolve before building any data persistence or AI call layer.

---

## Parked: Security Evidence Twin as product mode (Q-020 ref, Thread 24, D-020)

**Discussion:** Two framings for the product:
- A: "Live security simulation — test coverage, find blindspots." (planning software)
- B: "Security Evidence Twin — can you prove your setup met the required standard?"
  (compliance/audit/legal software)

These aren't mutually exclusive. The report layer should be designed with Framing B
in mind from day one: every output references the standard used, shows assumptions,
timestamps, exports in formats professionals can attach to compliance documentation.

**Status:** Thread 24 in EXPLORATION_MAP. D-020 in pending decisions. Does not change
V0.1 scope — changes how the report layer is designed.

---

## Parked: Multi-sensor physical security scope (Q-019, D-022, Thread 25)

**Discussion:** Cameras are one layer. PIR detectors, door/window contacts, access control
readers, audio detection — all interact with camera coverage. A motion trigger in a
camera blindspot is a compounded security gap.

Recommendation: keep camera-only for V0.1. But design the SecurityScene schema with
`SensorNode` base type extensibility so cameras are one variant of a sensor — adds almost
nothing now, prevents a breaking change later.

**Status:** Thread 25, Q-019, D-022. Not a V0.1 change.

---

## Parked: Simulation uncertainty and trust signals (Q-017, Thread 26)

**Discussion:** "78% coverage" is a model output under assumptions, not a measurement.
The product should communicate uncertainty explicitly — fragility indicators, persistent
assumptions panel, calibration mode.

**Status:** Thread 26, Q-017. Algorithm 4 (Monte Carlo Coverage Uncertainty) and
Algorithm 1 (Coverage Fragility Field) address this technically. The UX design is open.

---

## Parked: Build demo script as acceptance test (DEMO_SCRIPT.md)

**What was created:** Docs/product/DEMO_SCRIPT.md — 7-step demo walkthrough of the
small retail shop that maps to every component needed. This is the V0.1 acceptance test.
When all 7 steps work end-to-end, V0.1 is complete.

**Status:** Done. DEMO_SCRIPT.md on disk.

---

## Open: What does Occlusion Blame Attribution fold into?

**Discussion:** Occlusion Blame Attribution (NOVEL_ALGORITHMS.md Algorithm 6) is the
lowest effort, highest value novel algorithm. It directly answers "why did this zone fail?"
It can be surfaced in:
- The Failures tab of the camera inspector (currently a stub)
- The Issues tab (add "responsible obstructions" to each issue)
- A new "Why Failed?" explainer per critical zone in the inspector

**Status:** Not yet decided where it lives in the UI. Should be decided before sprint 1.

---

## Open: GSAP or motion for path replay animation?

**Discussion:** Path replay animation is coming in Sprint 1. The GSAP licensing decision
can no longer be deferred once animation work starts.

Options:
- Club GSAP (~$99/yr) — the standard for professional timeline animation, GSAP's
  `.to()` / `.timeline()` API is extremely clean for path playback
- `motion` (Framer Motion) — MIT, already a possible dependency, simpler for React
  component animations but less powerful for synchronized multi-track timelines
- `anime.js` — MIT, lightweight, good for timeline sequencing

The path replay needs: actor position update per frame, simultaneous timeline scrub,
per-camera quality update, speed control (0.5x/1x/2x), follow-actor camera lock.

**Status:** D-018. Decide before Sprint 1 animation work begins.

---

## What the reference image (Image 2) tells us about next build priorities

Image 2 (CameraView_TimelinePathReplay_Camera1InspectorViewtab.png) shows the target
state for Camera Studio after the current implementation. Full analysis in
CURRENT_IMPLEMENTATION_STATE.md. Summary of what needs building:

**Sprint 1 — Core demo loop:**
- Canvas view mode tabs: Map View | Camera View | Camera Wall | Path Replay
- Full-canvas Camera View rendering
- Path replay animation with actor
- LIVE MODE overlay

**Sprint 2 — DORI intelligence on feeds:**
- DORI overlays on Camera View (zone status, quality, distance, PPM)
- Enhanced Timeline with per-camera DORI quality table + animated playback
- Inspector View tab: DORI Overlay section + VIEW MODE toggles

**Sprint 3 — Camera Wall + canvas controls:**
- Camera Wall mode (4-panel)
- Canvas overlay controls bar
- Actor in camera feed

**Sprint 4 — Wire remaining stubs:**
- Tool canvas placement
- Failures tab
- "Test Without This" counterfactual
- Top bar: Night Mode, Camera Failure as real scene state changes

---

## What was confirmed working from code audit

Everything listed as built in CURRENT_IMPLEMENTATION_STATE.md. Key surprises:
- BottomRow is more complete than expected: full Assumptions panel, Report Summary, Environment
- ScenarioPathPanel is solid: coverage ribbon, path stats, SVG path map
- MetricsTab has DonutChart with proper DORI breakdown
- BeforeAfterTab works with delta coverage from snapshots
- Inspector is fully wired (Phase 2 wiring was already done)
- CameraFeedCanvas renders correctly but is minimal (no DORI, no actor)
- use-simulation hook has auto-recompute with debounce — "every edit updates risk map" is working
