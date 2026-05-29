# SentinelTwin Full Vision Gap Inventory

**Date:** 2026-05-29  
**Purpose:** Capture the full product spine SentinelTwin should have, distinguish what is real vs placeholder/demo/planned, and select the next platform slice without collapsing into MVP thinking.

This document is intentionally broader than the current implementation state. It is the bridge between:
- the live studio we can already run,
- the roadmap already written in the origin/context docs,
- the open research threads,
- and the product we actually want: a security intelligence platform with memory, evidence, and temporal reasoning.

## 1) What Is Real Today

The repo is not empty or fake. The core simulation spine is real:
- canonical `SecurityScene` data model
- deterministic coverage engine
- camera frustums, heatmap, path replay, compare, camera wall, camera view
- manual-assisted scan intake
- AI draft preview/compile flow
- provenance graph and provenance-aware reports
- launcher/dashboard shell with visible modes and maturity labels

That means the current product is already past “toy demo.” The gap is not whether there is a product at all. The gap is that the product is still mostly the **simulation spine** rather than the full **operational security twin**.

## 2) What Full Vision Actually Means

SentinelTwin should become a **security intelligence OS** for physical spaces.

The full system should answer all of these questions, not just “where are the blind spots?”

- What does the site look like?
- What changed?
- Who changed it?
- What evidence supports that change?
- What happened over time?
- What does the simulation say?
- What assumptions are we making?
- What did the live cameras actually see?
- What did the operator accept, reject, or override?
- What should happen next?

The platform should make these answers live in one canonical graph, not in separate feature silos.

## 3) Canonical Product Spine

The full product should have these layers, in this order:

1. Input surfaces
2. Scene compilers
3. Canonical scene graph
4. Evidence / provenance memory
5. Deterministic simulation
6. Temporal operational twin
7. Live sensor and camera fusion
8. Human review, collaboration, and governance
9. Reporting, export, and compliance evidence
10. Distribution, deployment, and market-specific packaging

Every input mode should compile into the same truth model. Every report should read from the same truth model. Every future AI feature should propose changes to that truth model, not replace it.

## 4) Gap Inventory by Layer

### 4.1 Input Surfaces

**Should exist**
- Scan a site
- Describe a site
- Upload floor plan
- Import SecurityScene JSON
- Open manual studio/editor
- Future live camera verification / real feed alignment

**Current state**
- Scan exists as manual-assisted intake.
- Text-to-scene exists as preview-first AI draft work.
- Floor-plan import exists.
- JSON import/export exists.
- Studio/editor exists.

**What is still missing**
- A truly first-class “start here” system that makes all input modes feel equally native.
- A complete guided scan input flow for real phone capture with a stronger capture/review/compile loop.
- A proper operational intake for live feeds and evidence, not just scene construction.

### 4.2 Scene Compilers

**Should exist**
- Manual edits -> canonical scene graph
- Scan session -> canonical scene graph
- Text prompt -> canonical scene graph
- Floor plan image / CAD / IFC -> canonical scene graph
- Live evidence -> scene annotations and deltas

**Current state**
- Manual edits compile into the scene graph.
- Scan sessions compile into the scene graph.
- AI drafts compile into the scene graph.
- Floor-plan import compiles into the scene graph.

**What is still missing**
- A unified compiler abstraction that makes all sources feel like one pipeline.
- Stronger guarantees around confidence, provenance, and correction history for every compiler.
- Richer structural imports such as IFC/BIM-level sources for pre-construction work.

### 4.3 Canonical Scene Graph

**Should exist**
- One source of truth for walls, doors, windows, cameras, lights, obstructions, zones, paths, sensors, and assumptions
- Stable identifiers for all nodes
- Versioned node history
- Source and confidence metadata

**Current state**
- The schema is already canonical.
- The store already derives a provenance graph from the scene.
- Sensors are represented in the schema boundary, but the UX is camera-first.

**What is still missing**
- Rich node versioning semantics beyond simple scene snapshots.
- First-class linkages between node changes and the evidence that caused them.
- Better editor affordances for future non-camera sensor tools.

### 4.4 Evidence / Provenance Memory

**Should exist**
- Append-only event ledger
- Scene edits, scan sessions, AI drafts, imports, snapshots, simulations, and report generation all emit events
- Every event stores source, timestamp, actor, affected nodes, before/after delta, confidence, and downstream impact
- Events reconstruct the scene over time

**Current state**
- Provenance graph exists and is visible.
- Reports carry provenance summaries.
- Deep links can target selected provenance nodes and edges.
- The visible evidence ledger now also captures scan-session starts, AI draft proposals, scan-session compiles, scene edits, snapshots, simulations, and duplicate-node actions in the provenance surface.

**What is still missing**
- The actual memory system under the graph.
- A temporal event stream that can replay the site’s life, not just summarize the current scene.
- Evidence-backed operations for future live sensor data.

### 4.5 Deterministic Simulation

**Should exist**
- Coverage computation
- DORI / OODPCVS quality classification
- Path exposure analysis
- Night/day model
- Fragility / uncertainty metrics
- Counterfactual analysis
- Camera failure and obstruction impact

**Current state**
- This is the strongest existing layer.
- Simulation is already live, deterministic, and central to the product.

**What is still missing**
- More surfaces that explain simulation results in product language rather than only expert language.
- Stronger temporal behavior across changing site conditions.
- Better support for real sensor evidence feeding back into simulation assumptions.

### 4.6 Temporal Operational Twin

**Should exist**
- Site history over time
- Change timeline
- “Before / after” scene states
- Incident replay
- Report history
- Scenario branching

**Current state**
- Snapshotting exists.
- Replay exists for path and camera interaction.
- Compare exists.
- Scene Intelligence now provides a temporal replay scrubber with point-in-time reconstruction and restore actions over the operational evidence trail.
- Scene Intelligence now also shows a temporal operational twin summary with current-scene vs latest-checkpoint and latest-published-checkpoint deltas, checkpoint age, published age, and reconstructable branch heads.
- The operational evidence layer now also exposes a canonical event-centered timeline builder plus a state-at-time-T resolver, so the point-in-time story is backed by a reusable temporal object rather than only ad hoc UI sorting, and publish checkpoints remain explicit rather than flattened into generic snapshots.
- The canonical scene graph now carries node-level evidence history metadata for selected entities, so version history is visible on the graph node itself instead of only in the ledger.
- The report handoff now also carries the same temporal operational twin summary, so the exported artifact can describe what the system knew at the latest checkpoint and latest published checkpoint instead of only the current simulation snapshot.

**What is still missing**
- A fully event-sourced operational timeline for the site’s life, including richer causal annotations and branch semantics.
- A consistent node-by-node “state at time T” reconstruction path that can replay more than checkpoint-backed scene snapshots.

### 4.7 Live Sensor and Camera Fusion

**Should exist**
- Live camera verification
- ONVIF-based metadata ingestion
- Camera health / offline / dirty lens / night state
- Access control and alarm evidence
- Motion / presence / occupancy data
- Sensor overlay on the twin

**Current state**
- Future live-camera verification is documented.
- The schema can carry sensors.
- The editor now exposes a dedicated sensor tool, sensor inspector, and sensor inventory tab, and both the camera inspector analytics tab and live camera feed now show a nearest-sensor `Sensor Fusion` preview; sensor live triggers, heartbeats, faults, restores, pasted metadata intake, an external feed bridge, a camera live binding stream, and a camera metadata ingest bridge now all flow into the canonical evidence trail, Scene Intelligence now shows that sensor evidence in the provenance surface, the debug panel reuses the same parser for pasted live metadata, and `/api/sensor-ingest` now gives that intake a history-backed backend-shaped boundary, while the camera live-connection probe/archive route now gives live binding a canonical backend round-trip, understands JSON/NDJSON plus ONVIF-style XML responses, tries SOAP-first for ONVIF binds, supports session refreshes, and now also exposes an active session lease registry with expiry timestamps, a transport-session handle, and captured auth challenge/transport response metadata, with the remaining open seam still being true device-protocol session management rather than the probe boundary itself.
- Camera live binding now also emits a durable event stream that appears in the live camera overlays and Scene Intelligence timeline, so the camera connection state is no longer hidden inside the inspector alone.
- Camera metadata ingest now also emits a durable event stream that appears in the live camera overlays and Scene Intelligence timeline, so camera health state is no longer hidden inside the inspector alone.
- Sensor edits now also write sensor-specific provenance events into the operational ledger, so the visible sensor layer has an audit trail even before ONVIF/live ingestion exists.
- The debug panel now exposes a runtime health summary plus a runtime journey trace with import/scan/AI/render/save/publish path health cards, and it now surfaces a runtime incident log, a performance trace list, a support bundle summary card, a paste-based external log capture lane, and an automated alerting summary so runtime truth, failure evidence, timing evidence, support handoff context, local log capture, and alert candidates are visible without leaving the studio shell.

**What is still missing**
- Real device-protocol session management for live cameras, beyond the current probe/archive, operator-bound live connection, session-refresh, and active-lease registry layers.
- ONVIF metadata ingestion and mapping to scene events, beyond the current URL-based sensor, camera metadata, camera connection, and live-connection probe bridges.
- A trustworthy operating model for multi-sensor evidence and a deeper incident bundle that combines runtime logs, live metadata, and automated alerting.

### 4.8 Human Review, Collaboration, and Governance

**Should exist**
- Review queues
- Accept / reject / annotate flows
- Role-aware permissions
- Scenario approval
- Audit history
- Branching / merging of drafts
- Team collaboration

**Current state**
- Manual-assisted review exists for scan and AI draft flows.
- The product is mostly still single-operator oriented.
- The governance control plane now shows a live action gate for edit/annotate/request-review/approve/reject/publish/restore decisions, along with member routing and approval posture, so the local RBAC/ABAC policy is visible in-product rather than hidden in store helpers.

**What is still missing**
- Collaboration semantics beyond local review.
- Change approval workflows for shared environments.
- A cleaner model for draft branches, reviewed branches, and published states.
- A backend-safe shared membership model that can persist the same routing and approval policy across multiple operators instead of only local state.

### 4.9 Reporting, Export, and Compliance Evidence

**Should exist**
- Coverage reports
- Before/after comparisons
- Evidence-backed narrative
- Standards references
- Privacy/compliance overlays
- Exportable artifacts for stakeholders

**Current state**
- Reports exist and carry provenance.
- Comparison/export is already useful.

**What is still missing**
- Stronger compliance-specific reporting modes.
- Evidence ledger integration so a report can cite the exact site history behind it.
- More explicit audience modes: operator, auditor, insurer, installer, privacy reviewer.

### 4.10 Distribution, Deployment, and Market Packaging

**Should exist**
- Local-only operation
- Self-hosted option
- Cloud-backed AI option
- Market-specific templates
- India / SEA / retail / NDAA / GDPR packaging

**Current state**
- Local-only policy exists in the product.
- Market wedges are documented in exploration and decisions.

**What is still missing**
- Real deployment packaging beyond the current app shell.
- Productized compliance and market bundles.
- More deliberate vertical modes.

### 4.11 Trust Hardening and Placeholder Elimination

**Should exist**
- Every visible claim is labeled as computed, inferred, simulated, imported, or placeholder.
- No fake metrics, no hardcoded deltas, no decorative data drift.
- No dead buttons or affordances that imply functionality the app does not have.
- Hydration-safe placeholders are deterministic and explicitly temporary.
- Trust-sensitive surfaces have regression tests so UI honesty does not drift over time.
- Derived values carry their source and confidence, not just the final number.

**Current state**
- The worst trust bugs are being removed one by one.
- The launcher and help surfaces already moved away from several obvious stubs.
- Simulation, provenance, and scan flows are now wired to real data instead of hardcoded copy in the core paths.

**What is still missing**
- A systematic placeholder audit that tracks every visible fake or fallback surface.
- A canonical “truth label” convention for UI claims across the app.
- A test harness that fails when a visible metric, badge, or CTA becomes detached from the source data.

### 4.12 Platform Operability and Recovery

**Should exist**
- Crash-safe autosave
- Import/export and version recovery
- Search across scenes, evidence, reports, and drafts
- Offline-first local workflows with optional sync
- Accessibility for keyboard, screen reader, and reduced-motion users
- Reproducible builds and clear runtime diagnostics
- Permissions and role-aware editing for collaborative usage

**Current state**
- Many local workflows are already present.
- Import/export and saved layouts/projects are wired.
- Keyboard shortcuts, panel help, and recovery guidance exist in the shell.

**What is still missing**
- A formal recovery and backup story for evidence/timeline data (the debug archive path now restores the latest archived checkpoint into draft/recovered/published targets, preserves the journal payload in archive round-trips, and can merge conflict-free diverged local branches, but the full sync story is still open).
- Stronger accessibility and keyboard coverage across all high-complexity panels.
- A system-level observability story for errors, timeline drift, and AI / scan failures.

### 4.13 AI Model Operations and Provider Governance

**Should exist**
- Provider registry with explicit capabilities, latency, cost, and fallback behavior
- Prompt/version tracking for reproducibility
- Structured-output validation and repair flow for every model-backed authoring step
- Evaluation harness for draft quality, scan extraction, and report quality
- Human override and fallback transparency when models are unavailable or uncertain
- Per-stage model selection rules with deterministic defaults

**Current state**
- Provider selection and local-only policy are user-visible and store-backed.
- Model-backed draft generation already falls back to deterministic local drafting when unavailable.
- Structured output is already used in the AI draft path and validated before apply.
- The debug panel now shows a provider-governance dashboard with active provider, active model, local-only policy, cloud availability, and explicit fallback order.
- The debug panel now also exposes a visible Provider Health Dashboard, a canonical Prompt Registry, and a Model Eval Suite that runs canonical structured-output fixtures for command parsing, counterfactuals, report generation, and AI layout drafting, and it now persists a local run history with stage-budget and trend comparison.

**What is still missing**
- A first-class persistent prompt/version registry for future model stages beyond the four canonical prompt definitions now visible in Debug.
- Richer cost/latency telemetry, stage-specific thresholds, and longer-horizon trend analysis beyond the current measured per-run trail now visible in Debug, the command bar, and the AI draft launcher.
- Richer telemetry may still move beyond the current point-of-use summaries into a broader operational dashboard or settings surface once the measured metrics mature.

### 4.14 Observability, Diagnostics, and Runtime Truth

**Should exist**
- Centralized event/error log with timestamps and stack traces
- Performance trace visibility for slow scans, simulations, and report generation
- Health indicators for import, scan, AI, render, and save paths
- Reproducible bug-report bundle with the exact scene, evidence, and config state
- Session-level diagnostic export for support and QA
- Clear distinction between user error, data validation error, provider failure, and runtime failure

**Current state**
- Debug surfaces exist.
- Error fallbacks exist.
- Tests and typecheck provide some safety.
- The debug panel now exports a support-ready diagnostic bundle with scene, simulation, graph, evidence, and runtime truth fields.

**What is still missing**
- A unified runtime diagnostics surface.
- Telemetry that can explain slow or failed user journeys.
- A support-ready crash/incident bundle with stack traces, performance slices, remote/external log capture, and automated alert routing beyond the local journey trace, in-product incident log, support bundle summary card, paste-based local capture lane, in-product alert summary, the `/api/support-ingest` route, the persisted support-ingest history, the `/api/support-delivery` queue, the Debug-panel remote webhook input, and any real remote fan-out/delivery pipeline beyond the local studio shell.

### 4.15 Permissions, Roles, and Governance

**Should exist**
- Role-aware access control for operator, reviewer, auditor, installer, insurer, privacy reviewer, and admin
- Publish/review/approve permissions
- Comment and annotation flows for reviews
- Change-approval workflows for shared scenes
- Scoped visibility for sensitive evidence and compliance reports
- Audit trail for permission changes and approvals

**Current state**
- The app now supports a local governance control plane with role selection, review requests, approval/rejection actions, annotation notes, a review-required/open-publish policy, a shared-workspace access surface with active member routing and single-user/shared mode toggles, and a visible per-member routing matrix that shows publish/review/restore posture for every workspace member.
- The Governance tab now also exposes a workspace membership handoff queue backed by `/api/workspace-membership-archive`, so the active member, team roster, routing policy, approval route, and drift against the latest archived snapshot can be archived as a canonical backend-identity record before shared identity services exist.
- The Governance tab now also exposes a `Sync Membership Snapshot` action that can reconcile the live workspace against the latest archived membership snapshot and emit a reconciliation event into the evidence ledger.
- The Governance tab now also exposes a `Resolve Approval Route` action backed by `/api/workspace-approval-route`, so the resolved route, fan-out status, and approval context can be archived alongside the workspace identity snapshot before any real remote approval service exists.
- The Governance tab now also exposes a workspace identity conflict resolution/archive backed by `/api/workspace-identity-conflict`, so drift against the latest archived membership snapshot can be archived and translated into a canonical remote-shared-identity policy recommendation before a real backend identity service exists.
- The provenance and evidence layers already provide a foundation for auditability.

**What is still missing**
- Actual backend RBAC/ABAC semantics across users and services.
- Shared-workspace sync/conflict semantics and remote approval routing, beyond the now-visible local approval trail in the Governance tab, the remote governance handoff queue, the workspace membership handoff queue, the sync action, the explicit approval-route archive, the workspace identity conflict resolution/archive, and their evidence-backed snapshot/diff history.
- Multi-user collaboration with permissions, accountability, and durable cross-service identity.

### 4.16 Integrations and External Interfaces

**Should exist**
- Stable export contracts for reports, scene JSON, and evidence bundles
- Import adapters for VMS/BMS/access-control ecosystems
- ONVIF / BACnet / MQTT / REST integration points where relevant
- Webhook/event hooks for external workflow systems
- Plugin or SDK surface for partners and integrators

**Current state**
- Import/export is present for scenes and reports, and report exports now include an operational evidence appendix so the handoff artifact can carry the ledger counts and recent evidence trail.
- The Report Lite preview now mirrors the same operational evidence appendix, so the on-screen handoff story and exported artifacts are aligned.
- Compare exports now also carry the evidence trail and before/after evidence counts, so the comparison artifact is ledger-aware instead of simulation-only.
- The compact report summary strip now includes an evidence-trail line, so the first glance report card surfaces ledger state before the full handoff view opens.
- The report and compare surfaces now also export a dedicated JSON evidence bundle, carrying the scene, report data, compare context, and evidence trail as a reusable handoff artifact.
- The support bundle now also includes the canonical report evidence bundle and the live approval route summary, so support exports carry the same scene/report/evidence package and current governance routing context as the operator-facing report export.
- The support bundle now also carries the recent sensor ingest archive, so live metadata handoff travels with the diagnostic/report evidence package instead of living only behind the sensor ingest route.
- The debug panel now exposes a dedicated `Download Evidence Bundle` action, so the canonical report evidence package can be exported directly from the support/control plane.
- Integration targets are well researched in exploration docs.

**What is still missing**
- Actual adapter layer.
- Versioned integration contracts.
- A partner-facing extension model.

### 4.17 Recovery, Sync, and Backup

**Should exist**
- Autosave and restore checkpoints across scene, evidence, and report states
- Exportable archive bundles for offline recovery
- Recovery to published, draft, or recovered branches
- Conflict resolution for synced or shared workspaces
- Verified backups with integrity checks

**Current state**
- Scene snapshots and restore checkpoints exist.
- Local storage persistence exists for key workspace data.
- A downloadable operational evidence archive now exists and can restore the scene, ledger, and governance state into the workspace.

**What is still missing**
- Branch-aware recovery beyond single-scene checkpoint restore (the debug archive path now restores the latest archived checkpoint, preserves the journal payload, and can merge conflict-free diverged local branches).
- Sync/conflict semantics for archived or collaborative branches.
- Shared-workspace conflict resolution and merge policy for future collaborative workflows.

### 4.18 Workspace Retrieval and Memory Search

**Should exist**
- Search across the current scene, saved workspaces, evidence trail, report snapshots, drafts, and recovery archives from one canonical query surface
- Result cards that route into the right workspace, timeline, report, or recovery branch
- Search ranking that understands scene source, evidence recency, and report state

**Current state**
- The launcher now exposes a workspace memory search surface that can query the current scene, saved workspaces, evidence trail, report snapshot, and archive histories from one query.
- The launcher now also labels start-project cards with explicit maturity states, so the user can distinguish complete, available, preview, and planned flows before entering Studio.
- Launcher hits now seed a timeline focus target, and branch-bearing archive results can jump into the Scene Intelligence checkpoint view instead of only opening the surrounding tab.
- Workspace-memory result cards now expose explicit target metadata in the launcher, so branch-aware archive hits and report snapshots read like concrete navigation routes instead of opaque search snippets.

**What is still missing**
- Federated search across archived workspaces, reports, and recovery archives beyond the current workspace scope.
- Cross-referenced memory search across governance archives, identity-conflict archives, and operational evidence archives, including richer time/branch pivots for every hit type.
- Search-by-time and search-by-branch navigation that can jump directly into a historical branch or recovered archive state across the full archive set.
- A richer public handoff model for the branch-aware result cards, so the same target metadata can be consumed outside the current launcher shell and across devices or org boundaries.

### 4.19 Temporal Query and Branch Navigation

**Should exist**
- Search and navigation that can jump to an exact checkpoint, branch head, or time window
- Timeline filters for event kind, actor, source, confidence, and affected node
- Shareable deep links for `scene`, `branch`, `checkpoint`, and `evidence` states
- Cross-view pivots from the timeline into the report, simulation, and governance surfaces

**Current state**
- The provenance surface can already inspect selected nodes, selected edges, branch lineage, checkpoint previews, and restore targets.
- The launcher memory search can already route archive hits into the right tab for the current workspace and archive histories, and branch-bearing archive hits can now jump into the timeline with branch/time focus.
- The evidence search box now understands `branch:`, `after:`, `before:`, and `time:` tokens, so operators can jump through time and branch history from the same timeline surface.
- Launcher search hits can seed a checkpoint timestamp so the timeline opens near the selected evidence point instead of only showing the ledger list.
- Timeline entries now use a canonical share-link helper so the selected checkpoint timestamp, provenance node/edge, and branch/time query tokens can be copied or opened through the same link contract, and the app bootstrap can restore that state from the URL.
- Launcher workspace-memory hits now expose explicit target metadata in the card itself, so branch-aware routes are visible before the user opens the timeline or report surface.

**What is still missing**
- A richer public share-link contract for external consumers, cross-device handoff, and branch/time embeds outside the current app shell.
- Branch-aware result cards that can carry richer target metadata into the timeline or report view outside the launcher shell.
- A durable cross-device archive link and publish contract for external consumers beyond the current in-app archive handoff bootstrap.

### 4.20 Organizations, Accounts, and Workspace Catalog

**Should exist**
- Organization accounts and teams
- Workspace catalog across projects, templates, archives, and shared workspaces
- Role inheritance and membership management across an org boundary
- Billing, plan, quota, and plan-to-feature mapping
- Workspace sharing, invites, and ownership transfer

**Current state**
- Local shared-workspace access, routing, and identity conflict handling exist.
- The launcher can browse local workspaces and reference demos, and the workspace search surface can query archives within the current workspace.
- Saved workspaces now also carry local organization, owner, and visibility metadata, and the launcher/editor surfaces those fields so the workspace catalog starts to read like an org-aware boundary instead of only a flat scene list.

**What is still missing**
- A canonical org/account model rather than only a local workspace membership model.
- Plan, billing, quota, and entitlement semantics.
- Invite, transfer, and ownership workflows for shared workspaces.
- A remote workspace directory or catalog that can unify local, shared, and archived projects.

### 4.21 Extensibility, SDK, and Partner Integrations

**Should exist**
- A versioned SDK or plugin surface for partners and integrators
- Stable extension points for report exports, archives, imports, and workflow hooks
- Webhooks, event callbacks, and embed-friendly outputs
- Public contracts for archive bundles, scene exports, and report packages
- Permission scopes for partner apps and external workflows

**Current state**
- The repo already has canonical archive routes and support/governance delivery queues that expose several integration seams.
- Integration targets are researched in the docs, and the system already has stable internal flows for support, governance, sensor ingest, camera metadata ingest, and archive export.

**What is still missing**
- A formal public SDK or plugin manifest.
- Versioned extension contracts with capability/scopes.
- Partner-facing surfaces for embedding reports, archives, or review workflows.
- An explicit extension policy for third-party integrations and workflow hooks.

### 4.22 Public Handoff, Distribution, and Cross-Device Continuity

**Should exist**
- Browser-native share targets for timeline checkpoints, compare states, and archive handoffs
- Shareable links that can reopen a scene, branch, checkpoint, or archive on another device
- Optional file-based and URL-based publish flows for reports and recovery archives
- Clear visibility into what is safe to share publicly versus what remains local-only
- Recovery handoff contracts that survive outside the current browser session
- A consistent `Share`, `Open`, and `Copy` behavior across timeline, report, and archive surfaces

**Current state**
- Scene Intelligence already has a canonical checkpoint share-link contract, and the app bootstrap can restore the same branch/time/provenance state from the URL.
- The debug recovery panel now also exposes a browser-openable operational evidence archive handoff link, so an exported archive can rehydrate the merge-preflight flow directly from a URL instead of only from a local file picker.
- The archive recovery controls now also support a browser share-sheet action when the device/browser supports the Web Share API, with copy/open fallback behavior for unsupported targets.
- The launcher memory surface already shows explicit destination metadata for archive and report hits, which makes the local navigation intent visible before the user clicks.

**What is still missing**
- A first-class public share-target contract that can use browser-native share surfaces when available and fall back to copy/open behavior when not.
- Stable share policies for public vs internal vs local-only artifacts.
- Cross-device archive publish/reopen semantics that do not depend on a manually pasted URL.
- A remote distribution story for recovery bundles and report artifacts that goes beyond the current browser-local handoff loop.

### 4.23 Observability, Crash Bundles, and Runtime Truth

**Should exist**
- Structured traces, metrics, and logs for import, scan, AI, render, save, publish, and recovery paths
- Explicit runtime journey health for the end-to-end operator flow
- A crash/incident bundle with stack traces, performance slices, and correlated external logs
- Alert routing and escalation summaries that show what happened, what was captured, and what should happen next
- A canonical support export for QA, support, and incident response
- Correlation across scene state, evidence state, and runtime failures

**Current state**
- The debug panel already exposes runtime journey cards, incident logs, performance traces, a support bundle summary card, external log capture, automated alerting summaries, and support/incident exports.
- The diagnostic bundle already carries scene, simulation, graph, evidence, and runtime truth fields, while the support bundle carries the broader handoff payload used by support and QA.
- The in-product trust-audit route now checks the visible trust surfaces so the local shell can detect drift against the manifest.

**What is still missing**
- A true system-level observability backbone instead of just local summary cards and exportable bundles.
- Distributed trace and log correlation across the app’s asynchronous paths.
- Durable alert routing and incident correlation beyond the current support-delivery and local ingest surfaces.
- A stricter crash-reproduction flow that can pair the support artifact with the exact runtime path that failed.

### 4.24 Compliance-Specific Reporting Modes

**Should exist**
- Audience-specific reporting surfaces for operators, auditors, insurers, installers, and privacy reviewers
- Compliance overlays and standards-specific framing per export
- Report variants that emphasize evidence lineage, policy posture, and risk explanation for the chosen audience
- Redaction or visibility policies for sensitive evidence when the report is shared externally
- Exportable artifacts that preserve the standard and audience context

**Current state**
- Reports and compare exports already carry provenance and evidence summaries.
- The report surface already includes standards-oriented reporting language and the current product can surface evidence-backed narrative content.
- The trust and evidence layers now make it possible to cite the exact checkpoint and branch state behind a report.

**What is still missing**
- Dedicated compliance report modes for different audiences.
- Policy-driven redaction and visibility controls for external sharing.
- A report catalog that makes standards, audience, and evidence posture explicit before export.
- Compliance-specific export templates that are separate from the general-purpose handoff report.

## 5) What Is Still Demo / Placeholder / Planned

These are the remaining places where the product is honest but not yet fully complete:

- Guided scan reconstruction is planned, not implemented as a first-class native flow.
- Text-to-scene is still more of a preview-first authoring path than a mature authoring system.
- Some model-provider paths remain stubs or fallback-only.
- The AI pipeline still depends on candidate bakeoffs for stage selection.
- Live camera verification is not yet a true real-feed verification system.
- Multi-sensor editing is not yet a real editor workflow, even though the schema can hold sensors.
- Multi-user collaboration, approvals, and branch merge semantics are not yet platform-grade.
- Compliance modes are not yet separate product surfaces.
- The product still explains itself mostly as simulation, not as an operational memory system.
- Recovery is now exportable and restorable as an operational archive, and the debug panel can also preflight an uploaded archive before applying it, restore the latest archived checkpoint with explicit branch targeting, preserve the journal payload through archive round-trips, or merge a conflict-free divergent branch, but shared-workspace sync and conflict resolution are still future work.
- Browser-native public handoff and cross-device distribution are still future work, even though the app can now copy/open archive and timeline links locally.

## 6) Research Anchors Worth Trusting

These are the external sources that matter most for the next build layers:

- Apple RoomPlan: guided interior capture with device sensors and room-scanning cues. RoomCaptureView and RoomCaptureSession are the clearest native reference for a structured guided scan experience on Apple platforms, including coaching overlays, raw captured room data, and multi-room capture sessions. [Apple RoomPlan](https://developer.apple.com/documentation/roomplan/) [RoomCaptureView](https://developer.apple.com/documentation/RoomPlan/RoomCaptureView) [RoomCaptureSession](https://developer.apple.com/documentation/roomplan/roomcapturesession)
- SAM 2: promptable image/video segmentation. This is the most relevant segmentation reference for tap-to-mask workflows and review-before-commit object extraction. The paper explicitly emphasizes promptable segmentation with streaming memory for real-time video processing. [SAM 2 paper](https://arxiv.org/abs/2408.00714)
- Depth Anything V2: strong monocular depth foundation for relative/metric depth assistance. The paper emphasizes finer and more robust depth predictions plus metric-depth fine-tuning, which makes it a useful depth prior but not a substitute for user scale anchors. [Depth Anything V2 paper](https://arxiv.org/abs/2406.09414)
- VGGT: fast feed-forward 3D geometry inference from one or many views. It is a strong later-stage candidate for multi-photo reconstruction because it predicts camera parameters, point maps, depth maps, and 3D point tracks in under one second. [VGGT paper](https://arxiv.org/abs/2503.11651)
- SpatialLM: structured indoor modeling from indoor representations. This is a useful later-stage reference for point-cloud-to-room-structure conversion because it outputs walls, doors, windows, and oriented object boxes with semantic categories. [SpatialLM paper](https://arxiv.org/abs/2506.07491)
- ONVIF Profile M: metadata and events for analytics applications. This is the strongest standards anchor for future live-camera and analytics metadata ingestion, including generic object classification, geolocation metadata, and event interfaces over metadata stream, ONVIF event service, or MQTT. [ONVIF Profile M](https://www.onvif.org/profiles/profile-m/)

### 6.1 What The Research Anchors Mean For The Product

The primary sources point to a clean product decomposition:

- RoomPlan is the capture UX reference, not the simulation truth model.
- SAM 2 is the promptable segmentation layer for tap-to-object workflows.
- Depth Anything V2 is a depth prior and scale assistant, not a replacement for measurement.
- VGGT is the early multi-view geometry candidate for sparse capture and multi-photo reconstruction.
- SpatialLM is the structural extraction bridge from geometry into walls / doors / windows / semantic boxes.
- ONVIF Profile M is the live metadata/event ingestion anchor for the future evidence layer.

That means the product should keep the boundaries explicit:

1. Capture and segmentation propose.
2. Scene compilers normalize into `SecurityScene`.
3. Simulation verifies.
4. Evidence memory records the chain.
5. Live metadata later feeds the same ledger.

## 7) Proposed Implementation Order

The full-vision work should keep moving in layers, not random surface fixes. The current preferred order is:

1. Operational Evidence Memory
2. Branch-aware recovery and point-in-time reconstruction
3. Shared-workspace RBAC/ABAC and approval routing
4. Live sensor and camera fusion
5. Provider/model governance with eval harnesses
6. Observability, crash bundles, and runtime truth
7. Integrations and external interfaces
8. Recovery, sync, and backup
9. Compliance-specific reporting modes
10. Distribution and market packaging

Each slice should land in the same canonical truth model so the product keeps converging instead of fragmenting into parallel systems.

## 8) Chosen Next Platform Slice

**Next slice to build: Shared-workspace RBAC/ABAC and approval routing**

The first ledger pass is now in the app: scene edits, scene loads, snapshot saves, simulation runs, counterfactual runs, and duplicate-node actions write visible evidence entries into the provenance surface, with explicit event-kind counts, before/after scene summaries, reconstructable checkpoints, lineage tracing, branch-head previews, a point-in-time reconstruction preview for selected checkpoints, append-only journal-backed persistence with explicit merge batches, a visible journal batch view in the debug panel, conflict-free merge application for diverged archive branches, archive round-trips that keep the journal payload intact, and a shared-workspace access surface with active member routing plus a canonical workspace membership archive queue that stores full snapshots and drift summaries.

Why this first:
- The provenance graph already exists, but provenance without memory is still a summary.
- The full vision needs a history engine, not another view mode.
- Every future input mode becomes more trustworthy when it emits the same event model.
- Temporal simulation, incident replay, live feeds, and compliance reporting all depend on this spine.

What it should do next:
- Extend the backend identity record into remote approval routing semantics and cross-service conflict handling
- Route publish/review/restore actions by role, clearance, scene attributes, and archived membership drift instead of a single active-role toggle
- Persist shared-workspace permissions and approvals in the same evidence chain as scene edits and recovery
- Add remote sync/conflict semantics for shared branches without losing the local recovery model
- Keep draft/recovered/published state transitions explicit across users, not just locally
- Expose approval routing and member selection in a backend-safe control plane instead of only the local panel, with the approval route visible as its own audited action
- Add deeper append-only persistence and conflict resolution for shared-workspace branch history

Why this remains the right next slice after the research pass:
- RoomPlan makes the guided-capture UX pattern concrete, but it still needs a multi-user authorization and routing model to become SentinelTwin-specific.
- SAM 2 and Depth Anything V2 make scan assistance more realistic, but they only become trustworthy when the evidence chain preserves the source, the correction history, and the acting member.
- VGGT and SpatialLM make sparse reconstruction plausible, but they need the same branch-aware evidence model so reconstruction results can be compared, corrected, and published rather than overwritten.
- ONVIF Profile M makes the future live-evidence path obvious, but that path also needs the same ledger semantics and shared-workspace identity model before external metadata can be merged safely.

## 9) What Not To Build Next

Do not spend the next major slice on:
- another isolated view mode
- another cosmetic launcher refinement
- another importer that does not share the same truth model
- more AI surface area that cannot explain itself through the evidence chain
- live sensor fusion before there is a ledger to hold the evidence

The rule remains:

**AI proposes. Simulation verifies. Evidence remembers.**

## Trust-label coverage note (2026-05-29)

- The highest-visibility summary surfaces now carry explicit truth labels: `Metrics` shows `Truth: Simulated`, `ReportLite` shows `Truth: Computed`, and the footer `StatusBar` shows `Truth: Live`.
- The in-product trust-audit route now checks those labels alongside the launcher/governance/provenance/debug surfaces.
- The remaining placeholder/truth work is broader claim-label coverage across the rest of the visible shell, not these already-labeled surfaces.
- Remaining gap: the operational-fusion card is shared and canonical, but the next macro step is still deeper device-side truth, meaning protocol-backed live session state instead of the modeled session/transport posture we are summarizing today.
- Remaining gap: heartbeat renewal is now explicit, but the deeper device-side truth is still protocol-native session negotiation and authorization, not just a modeled lease with keepalive semantics.
- Remaining gap: auth metadata is now canonical in the live record, but the next step is still real device-side session negotiation and credential handling rather than inferred auth posture from the probe/archive path.
