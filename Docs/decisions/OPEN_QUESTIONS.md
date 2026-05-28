# Open Questions

**Priority:** P0 = must resolve before V0.1. P1 = must resolve before V0.2. P2 = later.
**Update this when questions are resolved. Link to relevant decision, doc, or experiment.**

---

## P0 — Must Resolve Before V0.1 Code

### Q-001: Pascal fork — what is the cleanest way to extend AnyNode?
Pascal's `AnyNode` is a discriminated union. Where exactly is it defined? Is it a single type
alias we can extend, or scattered across multiple files? Need to read Pascal source before
designing extension.
**Where to look:** `pascalorg/editor` packages/core/src/types/
**Outcome needed:** Specific file and line to extend, or a pattern decision.

### Q-002: Vision collider mesh building — how do we merge all objects for BVH?
The coverage engine needs a single merged mesh of all vision colliders for BVH raycasting.
This mesh must update when any obstruction/wall changes (dirty tracking).
**Decision needed:** Rebuild full merged mesh on every dirty node update? Or build per-node BVH
and composite at query time?
**Recommendation:** Full rebuild on change is simpler. BVH build time is fast (<5ms for typical scenes).
Rebuild when `simulationDirty` is set.

### Q-003: How should SimulationResult interact with Zustand store?
SimulationResult is derived (computed), not canonical. But it needs to trigger React re-renders
when updated (to update heatmap, inspector panels, metrics).
**Options:** Store in Zustand (triggers re-renders automatically) vs useRef + manual notification
vs React context.
**Recommendation:** Store in Zustand alongside the scene. Clear it (set null) when simulationDirty.
Set it (SimulationResult) after computation completes. Zustand subscription handles re-renders.

### Q-004: Heatmap z-fighting with floor plane?
The heatmap instanced mesh floats just above the floor (0.01m). Will this z-fight in practice,
especially at grazing camera angles?
**Solution candidate:** Use `depthOffset` or `polygonOffset` in Three.js material. Test empirically.

### Q-005: What does "camera view" look like when subject is in IR/night mode?
The camera feed panel needs to show a realistic night/IR effect. What shader or post-processing
achieves this without a full shader program in V0.1?
**V0.1 option:** CSS filter: `grayscale(100%) brightness(80%) contrast(130%)` on the feed canvas.
Add a slight noise texture via a CSS animation or SVG feTurbulence filter.
**Adequate for demo?** Yes, if the effect is clearly "night camera" and not just gray.

---

## P1 — Must Resolve Before V0.2

### Q-006: Scene understanding model bakeoff — which model to run first?
Qwen2.5-VL vs Gemini 2.5 Flash for "extract walls, doors, cameras, obstructions from floor plan photo."
**Bakeoff harness:** experiments/scene_understanding/
**Test images needed:** 10 floor plan photos (retail, warehouse, corridor, lobby)
**Scoring criteria:** accuracy of object detection, JSON output quality, latency, cost
**2026-05-26 update:** HF-backed practical shortlist and workflow artifacts are now documented in
`Docs/experiments/V0_2_FLOORPLAN_UNDERSTANDING_BAKEOFF_PLAN.md` and scaffolded under
`experiments/scene_understanding/`. Next step is harness implementation and pilot run.

### Q-007: How do we handle user correction of AI-extracted scene?
When the scene understanding agent extracts objects from a photo, it will make mistakes.
The user must be able to: confirm, delete, move, or relabel each extracted object.
**UI pattern:** Object-by-object review panel with confidence badge. Objects with confidence < 0.7
are pre-highlighted for review. User clicks confirm or corrects.
**Open:** What does this confirmation flow look like? Need UX design pass.

### Q-008: How does SAM 3 run in the browser or backend?
SAM 3 is Meta's latest segmentation model. Is it available as a hosted API or must we self-host?
If self-hosted, what are the GPU requirements? Is a Hugging Face Space fast enough for demo use?
**Research needed:** Check HuggingFace model page and Meta's SAM 3 repo for deployment options.

### Q-009: What scale reference do we require for floor plan import?
When a user uploads a floor plan image, we need to know the real-world scale to position objects
correctly. Options:
1. User inputs one known dimension (door width = 0.9m → compute scale)
2. User drags a scale bar and inputs its length
3. We try to read scale from embedded metadata (DXF, SVG)
4. We auto-detect based on standard door widths in the image
**V0.2 plan:** Option 1 (simplest). User says "this door is 0.9m." Scale computed automatically.
Option 4 as a nice-to-have enhancement.

---

## P2 — Later

### Q-010: How do we handle multi-floor scenes in V0.2?
Pascal supports multi-floor with level nodes. Does our coverage engine handle it? Do camera cones
extend across floors (e.g., camera on floor 1 looking down into an atrium)?
**Current assumption:** V0.1 is single-floor only. Multi-floor deferred.
**Complication:** Mezzanines, atriums, split-level retail — relevant for some use cases.

### Q-011: What does ONVIF Profile M metadata look like for V2+ integration?
When real cameras are connected (V2+), ONVIF Profile M provides object classification,
geolocation, vehicle, license plate, face, and body metadata from analytics.
**Research needed before V2 design:** Read ONVIF Profile M spec. Understand data format.
How does this metadata map to our coverage quality labels?

### Q-012: Is the coverage entropy metric useful or confusing?
Coverage entropy captures "how fragile is the coverage" — cells near their DORI threshold
are fragile (one dirty lens or slight rotation puts them below threshold).
**Question:** Does a security professional find this useful, or is it information overload?
**Research needed:** Show concept to target users before building.
**Update:** Implemented in the live Novel Algorithms panel and report handoff as a normalized
Shannon entropy over the coverage-cell quality distribution. The remaining question is UX
interpretability, not engine availability.

### Q-013: How do we handle the `ScanNode` in Pascal's architecture?
The Pascal architecture article mentions a `Scan` node type for "3D reference scans from
reality capture devices." What is this? Can we use it to attach captured scan meshes as
visual background while maintaining clean simulation blocks?
**Research needed:** Read Pascal source for ScanNode implementation.

### Q-014: Privacy compliance overlay — what regulations matter?
GDPR (EU), PDPA (India/Thailand), POPIA (South Africa), CCPA (California) all have provisions
about camera surveillance and privacy zones. What do they actually require?
**Research needed before building privacy zone feature:** Consult a summary of major regulations.
Build the feature to flag zones, not to guarantee compliance.

### Q-015: Can AI generate SecurityScene JSON directly from text description?
"Create a 12m × 8m shop with front entry, two shelves, cash counter, and two cameras."
→ GPT-4o with SecurityScene JSON schema in system prompt → JSON output → load as scene.
**Open:** How accurate is GPT-4o at placing objects with realistic coordinates?
Will it place a 2m shelf at a reasonable position, or hallucinate impossible geometry?
**Experiment:** Test this in experiments/scene_generation/ before committing to the feature.
**Update:** The current AI draft flow already generates editable `SecurityScene` drafts from prompt text and now enriches obvious shop prompts with entry points, lighting, and a basic entry-to-counter path. Direct prompt-to-final JSON generation remains the open next step.
**Update 2:** The model-backed draft path now compiles an explicit scene blueprint with concrete camera, light, obstruction, zone, entry, and path placements when the provider supports structured output. What remains open is whether we should expose the full raw `SecurityScene` JSON surface directly to users, or keep the current blueprint abstraction as the final prompt-to-scene contract.

---

## P2 — Later

### Q-016: Text-to-scene as a legitimate product input mode — design and scope
Text-to-scene ("describe your space, get a SecurityScene") is not only a pipeline convenience.
It is a first-class input mode for users who have no floor plan, no scan, and no CAD file —
which is most small-business and residential users.
**Questions to answer before designing this mode:**
- What is the right prompt UX? Free text? Guided template? Mixed?
- What happens when coordinates are implausible (shelf placed inside wall)?
- Does the user get to see and correct the generated scene before simulation runs?
- Should the AI explain what it generated? ("I placed Camera 1 at the front-left corner,
  aiming toward the counter. Adjust if needed.")
- How does this compose with the manual editor? Can you start text-to-scene and then edit?
**Related decision:** D-021. **Experiment:** experiments/scene_generation/

### Q-017: How does SentinelTwin handle and communicate simulation uncertainty?
The simulation makes many assumptions: camera height, person height, wall height, material
transmission values, night penalty curves. A "78% coverage" output is a model output under
those assumptions, not a measured fact.
**Questions to answer:**
- Where and how do we show assumptions to the user? Always visible or on-demand?
- Should outputs have explicit confidence qualifiers? ("estimated", "under current assumptions")
- What happens when user changes an assumption? Does the simulation rerun automatically?
- Are there scenarios where we should actively warn the user not to trust the number?
  (e.g., outdoor scene with unknown lighting, thermal camera with unverified specs)
- Does this change our report language in a meaningful way?
**This is both a UX question and a product ethics question.** A security manager who treats
"78% coverage" as a hard fact could make a bad decision. We are responsible for that framing.
**Related:** Assumptions panel in architecture docs. SimulationAssumptions type.
**Update:** The product now surfaces assumptions in the report workspace, security outcome rail, and live novelty/report handoff surfaces. The remaining question is how much extra explanation to attach to entropy/uncertainty metrics versus the existing coverage labels.

### Q-018: Local-first vs server-side — data security architecture
A CCTV installer or security agency will not upload their client's facility layout —
a detailed map of a site's security posture, camera positions, and blindspots — to a
cloud service. This is a real sales blocker for the professional market, not an edge case.
**Questions to answer:**
- Does SentinelTwin run entirely client-side (all compute in-browser, nothing leaves device)?
- Or is there an optional server component (for heavy AI calls, report generation)?
- Or self-hosted deployment as the enterprise option?
- What data leaves the device today under the current architecture? (AI model calls send
  SecurityScene JSON to OpenAI/Gemini — this is the site layout)
- Can AI calls be made locally (local LLM) for users who require it?
**This must be resolved before building any data persistence or AI call layer.**
**Related decision:** D-019. Thread 23 in EXPLORATION_MAP.md.

### Q-019: Multi-sensor scope — where does SentinelTwin draw the boundary?
Cameras are one sensor layer. Physical security also includes:
- Motion detectors (PIR, microwave)
- Door/window contact sensors
- Access control readers (card, biometric)
- Audio detection
- Vibration sensors
- Glass break detectors
These interact with camera coverage: a motion trigger in a camera blindspot is a compounded gap.
An access log entry for a door that Camera 3 should cover but doesn't is a verification failure.
**Questions to answer:**
- Does the SecurityScene data model ever include non-camera sensors?
- If yes: when, and what does their simulation model look like?
- If no: is this an explicit product boundary, or something left open for later?
**Related decision:** D-022. Thread 25 in EXPLORATION_MAP.md.

### Q-020: India-first GTM — what does the product need to serve this market first?
Thread 18 and PRODUCT_VALUE_POSITIONING.md identify India/Southeast Asia as the primary
early market. The small retail shop story resonates deeply here. But serving this market
first has specific product implications:
- Price sensitivity → freemium model with very useful free tier
- Camera brands used: Hikvision, CP Plus, Dahua, TVT — different from Western market
- Many NDAA-flagged cameras in active use — different compliance angle
- Low-bandwidth environments — app must work on moderate connections
- Low-CAD-literacy users — text-to-scene and scan modes are more important than
  a sophisticated floor plan editor
- Language: English is sufficient for professionals, but Hindi/regional language UI
  would expand the market significantly
**Questions to answer before targeting this market explicitly:**
- What camera preset library do we need for India market? (CP Plus, TVT, Dahua primarily)
- Does the freemium tier need to be meaningful enough to use standalone, not just a trial?
- Should the demo scene be a small Indian shop by default, not a generic Western retail space?

### Q-021: How should we eliminate the remaining `THREE.Clock` deprecation warning from React Three Fiber?
The studio runtime warning still points into `@react-three/fiber` internals rather than app-local scene code.
**Questions to answer:**
- Is there a newer R3F release that replaces the deprecated `THREE.Clock` usage?
- If not, is there a safe local patch or fork strategy we should use until upstream catches up?
- Should we suppress the warning temporarily in development, or keep it visible as a dependency-health signal?
**Related finding:** Thread 75 in `Docs/exploration/EXPLORATION_MAP.md`.
