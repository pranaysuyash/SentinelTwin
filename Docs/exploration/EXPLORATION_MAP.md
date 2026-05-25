# Exploration Map — SentinelTwin

**This is a living document. Append findings. Never replace.**
**Last updated:** 2026-05-25 (major industry/TAM research added)

---

## Active Research Threads

### Thread 1: Pascal Editor Integration
**Status:** Decision made (fork). Details in architecture/02.
**Key finding:** Pascal's MIT license, identical stack (R3F, Zustand, Next.js), and flat dictionary
node store pattern are exactly what SentinelTwin needs.
**Open:** Which Pascal systems can we reuse directly? Read WallSystem before writing CameraSystem.
**Next:** Fork the repo and verify build. Read source of 5 key files (per PASCAL_EDITOR_DEEP_DIVE.md).

---

### Thread 2: Coverage Engine Design
**Status:** Designed. Details in architecture/03.
**Key finding:** three-mesh-bvh is mandatory from day one. Instanced mesh for heatmap.
**Open:** Benchmark 40×40 grid × 4 cameras. Target <16ms. Log in OPEN_QUESTIONS.md Q-002.
**Next:** Build prototype coverage engine in isolation. Measure raycast performance.

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
**Status:** Candidates identified. Bakeoff not yet run. Details in AI_MODEL_PIPELINE.md.
**Open:** All stage selections for V0.2+ are pending bakeoff results.
**Next:** Build bakeoff harness at experiments/ before V0.2 starts.

---

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

### Thread 10: NDAA Replacement Market — NEW, HIGH PRIORITY
**Status:** Research complete. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 2.
**Key finding:** NDAA Section 889 + FCC Covered List forces replacement of Hikvision/Dahua cameras
(38% of global supply) from US federal market. $1.2B military replacement program by 2027.
Australia, Japan also implementing bans. Late 2025/early 2026 saw FCC enforcement escalation.
**Why it matters:** Every NDAA replacement project is a coverage re-audit opportunity.
"Verify your replacement camera layout produces equivalent coverage before you go live."
**GTM angle:** Position specifically for NDAA replacement verification. Time-bounded, clear buyer.
**Decision needed:** Should this be an explicit product positioning point or just a side benefit?
Add to OPEN_QUESTIONS.md.

---

### Thread 11: Insurance Risk as Distribution Channel — NEW
**Status:** Research complete. Details in ADJACENT_SPACE_TAM_INDUSTRY.md section 3.
**Key finding:** Insurance models are beginning to incentivize camera compliance upgrades.
Insurers are starting to ask for camera coverage documentation as part of commercial property coverage.
**Opportunity:** Insurance company as distribution partner.
"All our commercial property customers with coverage >$X must submit a SentinelTwin audit annually."
This is a compliance mandate channel — not discretionary purchase.
**Decision needed:** How early to pursue insurance partnership vs focus on direct GTM?
**Open:** Which insurance companies are most progressive on camera surveillance requirements?
Research needed.

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
   a decision (buy Club GSAP ~$99/yr OR replace with motion/anime.js). Decision pending.
   Do NOT remove GSAP references from exploration docs — keep exploring. Make the decision
   at first-use time when the animation requirements are clearer.
5. **Multi-agent Codex narrative** — For the hackathon, showing Codex/AI as a parallel
   software engineering team is a stronger story than "AI helped me write code."
   Each agent owns a defined deliverable with tests + docs. This pattern should be in
   a hackathon-specific demo script doc.
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

## Completed Research

| Topic | Outcome | Doc |
|---|---|---|
| Pascal Editor architecture | Fork decision made | architecture/02 |
| Coverage engine design | Designed, ready to implement | architecture/03 |
| Adversarial path algorithm | Designed, ready to prototype | architecture/04 |
| DORI standard | PPM thresholds identified (IEC 62676-4 simplified) | architecture/03 |
| Physics library choice | Rapier, optional for V0.1 | architecture/07 |
| Heatmap rendering approach | Instanced mesh | architecture/07 |
| AI model candidates by stage | Table established | architecture/05 |
| Monorepo structure | Turborepo extending Pascal | architecture/08 |
| TAM / market sizing | Full analysis complete | ADJACENT_SPACE_TAM_INDUSTRY.md |
| Competitive landscape | Full analysis complete | COMPETITIVE_LANDSCAPE.md |
| NDAA ban / supply chain | Analysis complete | ADJACENT_SPACE_TAM_INDUSTRY.md |
| GDPR / privacy regulations | Analysis complete | ADJACENT_SPACE_TAM_INDUSTRY.md |
| Retail loss prevention wedge | Analysis complete | ADJACENT_SPACE_TAM_INDUSTRY.md |
| BIM / pre-construction opportunity | Analysis complete | ADJACENT_SPACE_TAM_INDUSTRY.md |
| Insurance distribution channel | Analysis complete | ADJACENT_SPACE_TAM_INDUSTRY.md |

---

## Questions to Research Next

**Technical:**
1. **SpatialLM setup complexity** — Docker image? GPU requirements? Quality on real indoor scenes?
2. **VGGT output format** — Can Open3D consume it directly?
3. **SAM 3 API availability** — hosted or self-hosted?
4. **three-mesh-bvh benchmark** — 40×40 grid × 4 cameras on mid-range laptop
5. **WebGPU coverage compute** — profiling threshold
6. **Pascal ScanNode** — what is it exactly? GLB import?
7. **ONVIF Profile M** — metadata format for V2+ integration
8. **IFC parsing** — ifcopenshell (Python) and web-ifc (JS/WASM) feasibility
9. **Axis DORI calculator** — does their PPM match IEC 62676-4?

**Business / GTM:**
10. **NDAA replacement projects** — who are the main integrators handling the $1.2B military replacement program?
11. **Insurance companies** — which carriers are most advanced on camera coverage documentation requirements?
12. **Physical pentest firms** — which firms do physical security assessments? validate SentinelTwin use case.
13. **GDPR DPA report formats** — what does ICO, CNIL, BfDI each require for camera compliance documentation?
14. **IFC open-source parsers** — quality and completeness of available tools

---

## Ideas to Explore Later (Capture, Don't Lose)

**Product:**
- **Privacy compliance mode** GDPR/PDPA/CCPA-aware overlay + compliance evidence report
- **Multi-site comparison** compare two branches of the same retail chain
- **Insurance audit mode** output formatted for insurance risk assessment
- **Guard patrol optimization** route optimizer with combined camera + patrol coverage view
- **Training simulation** interactive guard familiarization with camera coverage
- **Crowd simulation** camera effectiveness during high-occupancy events
- **AI-generated demo scene** GPT-4o generates SecurityScene JSON from text description
- **Fire/evacuation mode** same spatial model used for emergency egress simulation
- **Drone surveillance** aerial camera type with patrol route and coverage windows
- **Physical pentest integration** pre-engagement simulation, post-test verification

**Integrations:**
- **IFC / BIM import** pre-construction camera placement simulation
- **Revit/ArchiCAD plugin** "Security Analysis" button in architect's tool
- **PSIM integration** feed coverage analysis into Genetec / Milestone
- **NVIDIA Omniverse** Gaussian splat visual layer integration
- **VSaaS platforms** plug SentinelTwin analysis into Arcules, Milestone, Genetec

**GTM / Distribution:**
- **NDAA replacement integrators** partner with firms handling federal camera replacements
- **Insurance partnership** premium discount for SentinelTwin-audited facilities
- **GDPR compliance consultants** DPOs as distribution channel in EU
- **Physical pentest firms** co-marketing + tool integration
- **Security certification bodies** "SentinelTwin Verified" installer credential
- **India retail chains** direct GTM for loss prevention use case

**Research:**
- **NVIDIA Blueprint for physical security** — NVIDIA released a "physical security AI blueprint" in 2024/2025. What is it? Does it overlap with SentinelTwin?
- **Axis Analytics open platform** — Axis sells open analytics APIs for third-party developers. Could SentinelTwin integrate?
- **Digital twin standards** — ISO/IEC 30173 digital twin standard — does SentinelTwin need to be standards-compliant for enterprise sales?
- **AS/NZS 62676 CCTV standard** — Australian/NZ CCTV installation standard that specifies DORI requirements for different site types. Important for AU market given Hikvision ban.
