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
**2026-05-30 update:** Pre-fork reuse audit indicates a staged path while fork is parked: reuse non-graph Pascal utilities directly, route graph-dependent helpers through an adapter boundary, and defer AnyNode/store-loop integration until fork phase. This lowers immediate integration risk without contradicting D-001.

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
**2026-05-29 update:** The harness is now executable and the dev split has pilot results. Current practical ranking is Gemini 2.5 Flash first, GPT-4.1 second, Florence-2 as the strongest local hybrid baseline. MiniCPM-V local paths are blocked by checkpoint/model-class mismatch in this environment, and the Qwen local path is a deployment bottleneck because the first cold-start is extremely slow. The visual fill repair stage raised critical-zone recall to 0.6 on the synthetic dev split for the successful candidates, so the next implementation pass should harden that repair logic and test it on noisier real-world plans rather than adding more backbone models.

### Q-007: How do we handle user correction of AI-extracted scene?
When the scene understanding agent extracts objects from a photo, it will make mistakes.
The user must be able to: confirm, delete, move, or relabel each extracted object.
**UI pattern:** Object-by-object review panel with confidence badge. Objects with confidence < 0.7
are pre-highlighted for review. User clicks confirm or corrects.
**Update:** The manual-assisted scan flow now exposes a visible review queue, confidence badges, and direct Accept / Review / Reject actions per candidate, so the correction path is explicit rather than hidden behind a generic status dropdown.
**Open:** What does the fuller confirmation flow look like for future AI-extracted scene modes beyond the current manual-assisted scan intake? Need UX design pass.

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
**Update:** The existing camera-metadata ingest boundary now maps ONVIF notification envelopes into canonical operational evidence events, so the remaining question is the broader Profile M field set and how those richer analytics objects should extend the same ingest model rather than whether live ONVIF evidence can land in the ledger at all.

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
**Update 2:** The model-backed draft path now compiles an explicit scene blueprint with concrete camera, light, obstruction, zone, entry, and path placements when the provider supports structured output. The launcher now also exposes an editable raw `SecurityScene` JSON preview with schema validation before apply. What remains open is whether we should promote that into a dedicated text-to-scene authoring mode, or keep the current preview-first blueprint contract as the primary UX.

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
**This boundary is now enforced in-product via Local-only mode; the remaining decision is deployment strategy for cloud-backed AI, not whether local-only operation is possible.**
**Related decision:** D-019. Thread 23 in EXPLORATION_MAP.md.
**Update:** Local-only mode is now a store-backed, user-visible policy toggle in View Settings and is enforced by the AI command bar, AI draft launcher, counterfactual proposals, and report generation. The remaining decision is deployment strategy for cloud-backed AI, not whether the product can operate in a local-only posture.

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
**Update:** The studio now has a canonical `sensors` array on `SecurityScene`, reports its count in the report header, and surfaces a nearest-sensor `Sensor Fusion` preview in the camera inspector. The editor and simulation workflow remain camera-first, so the open question is now about product scope and editing UX for the future sensor toolset and live fusion layer, not about whether the schema can carry sensors at all.

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
**Update:** The app now imports a local `three-compat` shim before every R3F canvas entry point, and the compatibility behavior is regression-tested at the source level. The runtime warning should be treated as mitigated in-product unless a future dependency upgrade changes the situation.

### Q-022: What is the canonical event schema for Operational Evidence Memory?
The new platform spine is a temporal ledger, but the exact event shape still needs to be nailed down before implementation.
**Questions to answer:**
- What are the canonical event types: scene edit, scan session step, AI draft proposal, human correction, snapshot, simulation run, report export, live sensor event?
- Which fields are mandatory for every event: actor, source, timestamp, affected node IDs, before/after delta, confidence, provenance links?
- Should event payloads store enough data to fully reconstruct state, or should they only reference immutable snapshots and derived nodes?
- How do we map the event stream back into the timeline UI without mixing derived summaries into canonical history?
**Related decision:** D-149 in `Docs/decisions/DECISION_LOG.md`.
**Update:** The first operational memory pass now exists in-product as a visible event ledger for scene edits, scene loads, snapshots, simulation runs, counterfactuals, duplicate-node actions, scan-session compiles, and AI draft proposals. It now also shows event-kind counts, before/after scene summaries, reconstructable checkpoints for events with snapshots, lifecycle branch labels for draft / recovered / published history, branch-head filters/navigation, branch-lineage previews, a branch-comparison panel, merge-readiness guidance, explicit restore-to-branch actions, a selected-checkpoint point-in-time reconstruction preview, append-only journal-backed persistence with merge batches, a visible journal batch view in the debug panel, and an exportable recovery archive that preserves the journal payload itself while restoring the scene, ledger, governance state, and shared-workspace access state back into Studio. The remaining question is how to model point-in-time reconstruction, backend sync, and publication semantics without losing the simplicity of the current scene model.
**Update 2:** The same ledger now also preserves live-camera negotiation metadata, including transport response status/text and auth challenge header/scheme/realm, so the event schema is already carrying richer device-session evidence even though the canonical point-in-time/publication model still needs to be fully settled.
**Update 3:** The temporal twin now also distinguishes published checkpoints from reconstructable checkpoints, including current-vs-published deltas and published age in the live/report surfaces, so publication semantics are becoming explicit in-product rather than remaining implied by generic snapshots.
**Update 4:** Operational evidence imports now validate through a canonical runtime schema, including nested scene snapshots, so the remaining question is no longer whether the ledger can validate imported history but how much deeper the point-in-time semantics should go beyond snapshot-backed reconstruction.
**Update 5:** The ledger now has a canonical zod event schema plus a companion input schema, and build-time validation canonicalizes empty titles/details while rejecting malformed snapshots, so the remaining question is now the deeper point-in-time/publication semantics and backend sync rather than the base event shape.
**Update 6:** The temporal twin now resolves published checkpoints through a canonical publication helper, so publication semantics are now explicit in the core ledger model and the remaining question is the backend sync/publication policy rather than the lookup shape itself.

### Q-023: What role and approval model should govern draft, recovered, and published scenes?
The product now has visible branch labels, branch-lineage previews, a branch-comparison panel, merge-readiness guidance, explicit restore-to-branch actions, a publish action, a local Governance tab, and an operational evidence archive restore path with local branch merge support plus a shared-workspace access surface, but the backend identity, sync, and conflict model are still undefined.
**Questions to answer:**
- Which backend identity model should own the active member selection and reviewer routing?
- Should publication require explicit approval when a scene is shared or compliance-bound?
- How should comments, annotations, approvals, and routing decisions be represented in the evidence ledger?
- What is the minimal RBAC/ABAC model that supports operators, reviewers, auditors, installers, insurers, and privacy reviewers across backend services?
**Related decisions:** D-149, D-150, D-151, D-152, D-154 in `Docs/decisions/DECISION_LOG.md`.
**Update:** The Governance tab now also exposes a visible approval trail backed by the operational evidence ledger, so requests, approvals, rejections, annotations, role changes, and policy changes are auditable in-product. The open question now narrows to backend identity, remote approval routing, and cross-service conflict handling rather than basic auditability.
**Update 2:** The Governance tab now also exposes a remote governance handoff queue backed by `/api/governance-archive`, so the approval trail can be dispatched into a canonical archive before any real remote approval service exists. The remaining open question is the identity model and cross-service approval routing semantics, not whether the product can queue and archive governance actions locally.
**Update 3:** The Governance tab now also exposes a workspace membership handoff queue backed by `/api/workspace-membership-archive`, so the active member, team roster, routing policy, and drift against the latest archived snapshot can be archived in a canonical backend-identity record before any real shared identity service exists. The remaining open question is now the remote identity-backed approval routing and conflict model, not whether the app can capture shared membership locally.
**Update 4:** The Governance tab now also exposes a `Sync Membership Snapshot` action that reconciles the live workspace against the latest archived membership snapshot and records the drift state in the operational evidence ledger, so the remaining open question narrows further to remote identity-backed routing across services rather than basic local reconciliation.
**Update 5:** The Governance tab now also exposes a `Resolve Approval Route` action that compares the live workspace against the latest archived membership snapshot and records a `workspace_approval_routed` evidence event, so the remaining open question narrows further to how remote identity-backed approval routing should fan out across services rather than whether the product can model the route itself.
**Update 6:** The Governance tab now also exposes a `/api/workspace-approval-route` archive boundary that persists the resolved route, fan-out attempts, and route history, so the remaining open question is now the remote identity/conflict model around that route rather than whether the route can be archived or replayed locally.
**Update 7:** The Governance tab now also exposes a `/api/workspace-identity-conflict` archive boundary that persists the live vs archived membership drift, approval-route context, and delivery attempts, so the remaining open question is now the true backend shared-identity service and cross-service conflict policy rather than whether the product can model the conflict boundary locally.
**Update 8:** The same evidence ledger now also preserves live-camera negotiation metadata, including transport response status/text and auth challenge header/scheme/realm, so the canonical event stream is carrying device-session evidence alongside scene and governance history. The remaining question is still the backend publication and point-in-time semantics, not whether the ledger can record the negotiation detail locally.
**Update 8:** The same boundary now returns an explicit resolution status, resolution label, reason, and recommended action, so the remaining question shifts further toward how that policy recommendation should fan out across future backend services rather than whether the product can compute one locally.
**Update 9:** The Governance tab now records identity conflict resolution itself as a first-class evidence event, so the remaining question is now purely about remote backend identity and cross-service replay rather than whether the local governance trail can distinguish resolution from generic membership sync.
**Update 10:** The Governance tab now also exposes a selectable conflict diff/replay view that compares the live workspace against the latest archived membership snapshot, recomputes the selected conflict against current workspace state, and lets the operator inspect older archived conflicts in place, so the remaining question is now specifically about remote replay/fan-out semantics rather than whether the local archive can be inspected as a diff.
**Update 11:** The shared approval route now carries a stable route key plus route-scope and active-member eligibility metadata, and the archive loaders normalize older route records into that canonical contract, so the remaining question is now narrower: which backend service should own the persisted route identity and how should cross-service replication/versioning work when multiple operators disagree.
**Update 12:** The local governance route now distinguishes privacy-sensitive scenes from high/critical-priority scenes, preferring privacy reviewer routing for the former and admin-only routing for the latter, so the remaining question is even narrower: how that local policy should be owned and replicated by a durable backend identity service across operators and services.
**Update 13:** The route summary is now schema-first and archive-validated, so the remaining question is no longer the route shape itself but the backend identity and replication owner for persisted route records.

### Q-024: What should the provider/model governance layer expose?
The app has a provider selection and local-only policy, but the long-term AI control plane still needs a formal governance model.
**Questions to answer:**
- How do we record provider choice, prompt version, and output schema for each AI action?
- What is the canonical fallback order when a provider fails or is unavailable?
- How should we surface latency, cost, and confidence per model stage to the user?
- How should richer measured cost/latency telemetry, thresholds, and trend history be surfaced now that provider health, estimated budget classes, and the first measured AI action trail are visible in the Debug panel, command bar, and AI draft launcher?
**Related decisions:** D-058, D-059, D-127, D-128, D-168, D-169, D-170 in `Docs/decisions/DECISION_LOG.md`.
**Update:** The Debug panel now exposes a visible Model Eval Suite that exercises the current provider/model against canonical structured-output fixtures for command parsing, counterfactuals, report generation, and AI layout drafting. It also persists a local eval history with stage-budget and trend comparison, and now adds a provider-health dashboard plus a canonical prompt registry. The command bar and AI draft launcher now mirror the provider-health summary, and all three surfaces now show estimated cost/latency policy classes plus a live measured AI action trail, while the prompt registry and provider governance surfaces now each persist a history trail from manual snapshots and selection/policy changes. The measured AI telemetry trail now also compares recent runs against a longer-horizon policy baseline, and the policy itself is now persisted and editable, so the remaining open design question has shifted from basic threshold entry to whether future telemetry should expose stage-specific policy profiles, org-level presets, or richer trend controls.

### Q-025: What is the first-class guided capture backend for scan-first?
RoomPlan, manual-assisted mobile capture, and later sparse reconstruction all point at the same product wedge, but the implementation path still needs an explicit backend choice.
**Questions to answer:**
- Should the first official guided capture path target RoomPlan on Apple devices, or should the product stay provider-agnostic with RoomPlan as one capture backend?
- Where do we store and display scale anchors so relative depth and reconstruction stay honest?
- Which outputs count as draft evidence versus publishable evidence in the branch-aware ledger?
- Should sparse reconstruction results be written as separate candidate branches or as a derived snapshot on the same scene branch?
**Related threads:** 21 in `Docs/exploration/EXPLORATION_MAP.md`, plus the operational evidence and branch-recovery work in `Docs/todos/FULL_VISION_GAP_INVENTORY.md`.

### Q-026: What is the canonical organization, account, and billing model?
The app now has local shared-workspace routing and archive-backed membership state, but the product still lacks a canonical org/account boundary.
Update: saved workspaces now also carry local organization, owner, and visibility metadata in the launcher and metadata editor, and the launcher now also shows local catalog and account summaries for that bridge, but this is still a launcher-level bridge rather than the canonical org/account model.
**Questions to answer:**
- Is the primary top-level unit an organization, a team, or a workspace?
- How do plan, quota, and entitlements map onto workspaces and users?
- What is the ownership-transfer model for shared workspaces and archived projects?
- How do invites and role inheritance work across local and remote collaborators?
**Related threads:** shared-workspace access, governance, and retrieval work in `Docs/todos/FULL_VISION_GAP_INVENTORY.md`.

### Q-027: How should search-by-time and search-by-branch navigation work?
The launcher can already search current workspace, evidence, reports, and archive histories, but the user still needs a time-aware way to move through the ledger.
Update: the timeline can now carry a canonical checkpoint share link with provenance node/edge focus plus branch/time query tokens, so the remaining question is the remote/cross-device contract rather than the basic in-app link format.
Update: launcher search cards now show explicit target metadata for archive/report hits, so the remaining product question is how that same branch-aware routing contract should extend beyond the launcher shell.
Update: the debug recovery panel now also exposes a browser-openable operational evidence archive handoff link, so the remaining question is the durable public cross-device archive contract rather than whether an archive can be reopened in the app at all.
**Questions to answer:**
- What does a branch-aware result card need to show to be trustworthy?
- Should the default timeline search prioritize recent evidence, latest checkpoints, or branch heads?
- How should shareable deep links identify a checkpoint, branch, or time window?
- Should timeline navigation be inside Scene Intelligence, the launcher, or both?
**Related threads:** 4.18 and 4.19 in `Docs/todos/FULL_VISION_GAP_INVENTORY.md`.
**Update:** The evidence timeline now understands `branch:`, `after:`, `before:`, and `time:` query tokens, launcher hits can seed a checkpoint timestamp, Scene Intelligence deep links preserve exact checkpoint identity plus provenance node/edge focus, and compare/report share links can round-trip seeded snapshot pairs through the bootstrap, so the remaining question is richer cross-view pivot behavior for other surfaces rather than basic time/branch filtering or checkpoint restoration semantics itself.

### Q-028: What should the partner SDK / plugin surface expose?
The platform now has multiple canonical archive and delivery seams, but there is no formal extension model yet.
**Questions to answer:**
- Which public contracts are versioned: scene JSON, archive bundles, report exports, webhook payloads, or all of them?
- What capability scopes should partner apps request?
- Should plugins embed into the launcher, the report workflow, or an admin console?
- What is the minimum stable extension surface for integrations without opening the core model to drift?
**Related threads:** 4.16 and 4.21 in `Docs/todos/FULL_VISION_GAP_INVENTORY.md`.

### Q-030: How should public handoff and cross-device distribution work?
The app can already copy and open timeline links, and the debug panel can now open an archive handoff URL into merge preflight, but the product still lacks a public share-target contract for different devices and consumers.
Update: the archive recovery controls now also offer a browser share-sheet action with copy/open fallbacks, so the remaining question is the durable public share policy and cross-device distribution model rather than whether the app can invoke a share target at all.
**Questions to answer:**
- Should the default public handoff use browser-native share targets when available, or should it stay copy/open only?
- Which artifacts are safe to publish as links, files, or both?
- How should the product distinguish local-only recovery archives from shareable recovery artifacts?
- What is the minimal public handoff policy for reports, checkpoints, and recovery bundles?
**Related threads:** 4.19, 4.21, and 4.22 in `Docs/todos/FULL_VISION_GAP_INVENTORY.md`.

### Q-031: What is the canonical observability and crash-response model?
The app already has local runtime health, support bundles, incident bundles, external log capture, and alert summaries, but it still lacks a system-level observability backbone.
**Questions to answer:**
- Which signals are canonical: logs, traces, metrics, alerts, or all of them?
- Should the first external observability backend be OpenTelemetry-compatible, Sentry-like, or a custom local-first pipeline?
- What is the minimum correlation contract between runtime incidents, support bundles, and scene/evidence state?
- How much of the observability stack should stay local-first versus remote-backed?
**Related threads:** 4.12 and 4.14 in `Docs/todos/FULL_VISION_GAP_INVENTORY.md`.

### Q-032: Which compliance reporting modes should be first-class?
The report exports already carry provenance and evidence summaries, but the product still lacks audience-specific compliance modes.
**Questions to answer:**
- Which audiences need dedicated report modes first: operator, auditor, insurer, installer, privacy reviewer, or regulator?
- What redaction or visibility controls are required for each audience?
- Should compliance exports preserve the same provenance link contract as the general report export?
- How should standards references and evidence lineage be shown in each mode?
**Related threads:** 4.9, 4.24, and 4.10 in `Docs/todos/FULL_VISION_GAP_INVENTORY.md`.
**Update:** Report Lite now exposes explicit audience modes for operator, auditor, insurer, installer, and privacy reviewer, and it also offers report catalog presets plus internal/shared/privacy-safe visibility selectors. The remaining question is the redaction/visibility policy depth and whether a regulator-facing mode should be distinct from privacy review.
## Contextual 3D interaction UI

- **Priority:** Medium
- **Question:** Should SentinelTwin surface object-specific actions through a right-click context menu, a radial menu, or a compact floating action sheet in the 3D workspace?
- **Needed to answer:** A quick interaction prototype or wireframe that compares discoverability, speed, and visual fit against the existing inspector and transform handles.

### Q-029: How do we keep rendering architecture docs in lockstep with runtime stack reality?

The current rendering architecture doc still references older stack details (for example `Next.js 15`, `Three r168+`, and `GSAP`) while runtime package truth has moved to `next@16.2.6`, `three@0.184.x`, and `framer-motion`-centric replay surfaces.

**Questions to answer:**
- What is the canonical source of truth for runtime rendering stack (package manifests, lockfile, or generated snapshot)?
- Should we add a lightweight doc-health check that flags architecture docs when declared versions/libs diverge from runtime manifests?
- Which owner is responsible for updating `Docs/architecture/07_RENDERING_PIPELINE.md` during rendering-stack changes?

**Related evidence:** `Docs/decisions/R3F_DREI_FULL_AUDIT_2026-05-29.md`.

---

### Q-030: Target Orientation Penalty Thresholds
**Status:** Open
**Priority:** Medium
**Context:** We implemented a penalty for path targets facing away from the camera (clamping quality to `observation` if >90° offset).
**What's needed:** Validate with security domain experts if 90° is the correct threshold for losing `recognition`/`identification` quality. Should there be a softer falloff or a strict cutoff?
