# SentinelTwin Full Product Completion Plan

**Status:** Source of truth — 2026-05-30
**Purpose:** One document that maps the entire SentinelTwin product from current repo state to full completion. Prevents agents from stopping at camera/demo surfaces. Distinguishes real, partial, scaffolded, and missing. Provides actionable backlog items, not aspirations.
**Supersedes:** `FULL_VISION_GAP_INVENTORY.md` (for execution planning), `CURRENT_STATUS.md` (for product-level state), `CAMERASTUDIO_GAP_ANALYSIS.md` (for feature gaps).

---

## 1. Full SentinelTwin Product Definition

SentinelTwin is a **security intelligence platform** for physical sites. It is not a CCTV planner, not a camera placement tool, and not a demo scene viewer.

The product answers these questions for every site it twins:

1. What does the site look like?
2. What changed?
3. Who changed it?
4. What evidence supports that change?
5. What happened over time?
6. What does the simulation say?
7. What assumptions are we making?
8. What did the live cameras actually see?
9. What did the operator accept, reject, or override?
10. What should happen next?

These answers live in one canonical graph. Every input mode compiles into the same truth model. Every report reads from the same truth model. Every AI feature proposes changes to that truth model, not replaces it.

**Core loop:** `Edit scene -> recompute coverage -> show security impact -> explain what changed -> recommend fixes -> evidence remembers the chain`

**Rule:** AI proposes. Simulation verifies. Evidence remembers.

---

## 2. Product Principles

P1. **SecurityScene is the single source of truth.** All agents, all AI models, all UI panels, all simulation stages read and write one schema. No parallel scene representations.

P2. **AI proposes. Simulation verifies.** No AI model returns security recommendations directly to the user. All recommendations are proposed as structured operations on SecurityScene, tested by the simulation engine, and presented with verified delta metrics.

P3. **Evidence remembers.** Every operation — edit, scan, import, simulation, report — emits an event into an append-only evidence ledger. The ledger reconstructs site history over time.

P4. **Deterministic geometry, not AI inference, computes security truth.** Raycasting, DORI/OODPCVS scoring, heatmap, path visibility, and adversarial paths are deterministic Three.js computation. AI explains results. AI does not compute them.

P5. **Defensive framing only.** Output language: "authorized incident replay," "coverage failure analysis," "hardening recommendations." Never: "avoid cameras," "bypass security," "optimal evasion."

P6. **Open source — Apache 2.0.** All dependencies must be MIT, Apache 2.0, or BSD. No GPL, AGPL, CC BY-NC, or BSL.

P7. **Standards-compliant simulation.** Coverage quality uses IEC 62676-4:2025 OODPCVS by default. DORI (2014) supported as legacy. All reports reference the standard used.

P8. **No fake claims.** Every visible claim is labeled as computed, inferred, simulated, imported, or placeholder. No hardcoded deltas, no decorative data, no dead buttons.

P9. **Model-agnostic but provider-governed.** Switch between OpenAI, Gemini, Qwen via config. Explicit provider health, cost, latency, and fallback visibility in the product.

P10. **Documentation is how we build.** Every decision, design, finding, and gap is written down before or alongside implementation.

---

## 3. Full Platform Layers

The complete product has these layers, in dependency order:

```
L1  Input Surfaces
    Scan / Describe / Upload floor plan / Import JSON / Open editor / Live feed alignment

L2  Scene Compilers
    Manual edits -> SecurityScene
    Scan session -> SecurityScene
    Text prompt -> SecurityScene
    Floor plan / CAD / IFC -> SecurityScene
    Live evidence -> scene annotations and deltas

L3  Canonical Scene Graph (SecurityScene)
    One schema for walls, doors, windows, cameras, lights, obstructions, zones, paths,
    sensors, and assumptions. Stable IDs, versioned history, source and confidence metadata.

L4  Evidence / Provenance Memory
    Append-only event ledger. Scene edits, scan sessions, AI drafts, imports, snapshots,
    simulations, and report generation all emit events. Events reconstruct the scene over time.

L5  Deterministic Simulation
    Coverage computation, DORI/OODPCVS quality, path exposure, temporal 24h profile,
    fragility, redundancy, counterfactuals, camera failure impact.

L6  Temporal Operational Twin
    Site history over time. Change timeline. Before/after states. Incident replay.
    Scenario branching. Point-in-time reconstruction.

L7  Live Sensor and Camera Fusion
    Live camera verification. ONVIF metadata ingestion. Camera health. Access control evidence.
    Motion/presence data. Sensor overlay on the twin.

L8  Human Review, Collaboration, and Governance
    Review queues. Accept/reject/annotate. Role-aware permissions. Scenario approval.
    Audit history. Branching/merging. Team collaboration.

L9  Reports, Compliance, and Stakeholder Artifacts
    Coverage reports. Before/after comparisons. Evidence-backed narrative.
    Standards references. Privacy/compliance overlays. Audience-specific exports.
    Exportable artifacts for operators, auditors, insurers, installers, privacy reviewers.

L10 Distribution, Deployment, and Market Packaging
    Local-only. Self-hosted. Cloud-backed AI. Market-specific templates.
    India/SEA/retail/NDAA/GDPR packaging.
```

---

## 4. What Is Real Today (Verified in Code)

These systems exist, are wired, compute real data, and pass tests:

### L1 — Input Surfaces
- Manual-assisted scan intake (ScanSiteWizard) — photo upload, marker placement, candidate review, compile to SecurityScene
- AI Layout Draft — prompt-to-scene with model-backed structured output + deterministic fallback
- Floor-plan import — image upload, geometry extraction, calibration, correction, compile to SecurityScene
- JSON import/export — full SecurityScene round-trip with Zod validation
- Blank scene creation — canonical factory, room dimensions, wall generation
- Scene templates — 5 built-in templates (retail, office, warehouse, classroom, parking)
- SiteIntakeHub — unified source selection surface with maturity labels
- SiteDraftReview — compiled-draft review with confidence scoring and warnings

### L2 — Scene Compilers
- Manual edits compile into SecurityScene via the store
- Scan sessions compile via `scan-to-scene.ts` with deterministic node mapping
- AI drafts compile via `ai-layout-draft.ts` with Zod validation before apply
- Floor-plan import compiles via `floor-plan-import.ts` with structural validation
- Site compiler abstraction (`site-compiler.ts`) normalizes all sources into a canonical `SiteTwinDraft`

### L3 — Canonical Scene Graph
- `security-scene.ts` — complete Zod schemas + TypeScript types for all node types:
  Camera, ObstructionNode, SecurityLightNode, WallNode, DoorNode, WindowNode,
  CriticalZoneNode, PrivacyZoneNode, EntryPointNode, ScenarioPath, SensorNode
- All nodes carry `source`, `reviewStatus`, `sourceTrace`, `geometryValidity` metadata
- Camera nodes carry live-connection state, session state, and ONVIF auth metadata
- Sensor nodes exist in the schema boundary with dedicated tools and inspector
- `parseSecurityScene`, `safeParseSecurityScene`, `cloneSecurityScene` utilities
- SceneSnapshot schema for versioning

### L4 — Evidence / Provenance Memory
- Provenance graph derived from the scene and visible in the Provenance tab
- Operational evidence ledger: scene edits, scan sessions, AI drafts, snapshots,
  simulations, duplicate actions, counterfactuals, publish events all emit events
- Events carry source, timestamp, actor, affected nodes, before/after summary,
  confidence, lifecycle branch labels
- Append-only journal-backed persistence with merge batches
- Evidence ledger searchable/filterable by scene, node, note, event type, lifecycle stage, branch
- Exportable evidence archive with journal payload preservation
- Deep links target specific provenance nodes, edges, and checkpoint timestamps

### L5 — Deterministic Simulation
- `coverage.ts` — BVH-accelerated raycasting, DORI/OODPCVS scoring, material penalties,
  lighting model, door/window occlusion, PPM thresholds, camera evaluations with reason codes
- `adversarial-path.ts` — Dijkstra minimum-exposure pathfinding with defensive aliases
- `temporal.ts` — 24-hour security profile engine (96 snapshots, change-timeline optimization,
  vulnerability windows, safest periods, schedule support)
- `coverage-fragility.ts` — per-cell distance-to-DORI-threshold score
- `k-robustness.ts` — K-robustness analysis with critical failure sets
- `placement-oracle.ts` — best-candidate camera placement scoring
- `coverage-entropy.ts` — normalized Shannon entropy over coverage distribution
- `coverage-uncertainty.ts` — installation-position/yaw/pitch/spec variation sampling
- `coverage-posture.ts` — crouching/seated/child/standing target-height profiles
- `blind-spot-fingerprint.ts`, `blind-spot-topology.ts` — blind-region analysis
- `occlusion-blame.ts` — per-obstruction blame fraction analysis
- `temporal-anomaly.ts` — temporal anomaly detection
- `coverage-time-budget.ts` — path time budget computation
- `vision-collider-mesh.ts` — three-layer vision/physics/visual collider model
- `mount-model.ts` — camera mount snap calculations
- `path-analysis.ts`, `path-quality.ts` — path visibility and quality over time
- Camera failure offline-impact analysis with degraded-scene recomputation
- Obstruction counterfactual simulation with verified deltas
- Golden simulation claims test suite: door/window behavior, night+IR recovery,
  obstruction counterfactual, privacy flagging, redundancy preservation
- Performance: ~10.8ms average on 40x28 grid with 2 cameras
- Zero React/DOM imports confirmed

### L6 — Temporal Operational Twin
- Temporal replay scrubber with point-in-time reconstruction and restore actions
- Temporal operational twin summary: scene-event counts, reconstructable checkpoints,
  published checkpoints, branch heads, checkpoint age, current-vs-checkpoint deltas
- Event-centered timeline builder plus state-at-time-T resolver
- Published checkpoint compare-and-restore surface
- Node-level evidence history metadata and node-specific evidence trail
- Branch-comparison panel with common-ancestor and delta summaries
- Merge-readiness guidance (fast-forward vs diverged)
- Restore-to-branch actions from branch comparison (draft/recovered/published)
- `Publish current scene` action promoting to published branch
- Share links preserve exact checkpoint identity plus provenance focus
- Compare/report share links round-trip snapshot pairs through studio bootstrap

### Store and State Management
- Full Zustand store: all CRUD operations, import/export with validation,
  snapshots, layer visibility, environment modes, active tool tracking,
  minimap/path-map viewport state, simulation state, heatmap modes
- Scene intelligence graph derived and rebuilt on edits/snapshots/undo/import
- Editor state machine for placement/transform/validation
- Shared selection model with multi-select, drag-select, grouped operations
- Provider governance state (provider selection, local-only policy, health)
- AI action telemetry with prompt lineage tracking
- Runtime incident recording with stack traces
- Workspace preset system, saved layouts, custom view settings

### Studio Shell and Editor
- StudioShell with full mode routing: Map, Camera View, Camera Wall, Path Replay, Compare, Report
- 3D workspace with instanced-mesh heatmap, camera frustums, wall segments,
  obstruction boxes, critical zone overlays, path lines, adversarial path,
  entry labels, light markers, environment themes
- Direct manipulation: move/rotate/height/resize handles, yaw ring arc, snap-aware transforms
- Tool rail: Select, Camera, Wall, Door/Window, Light, Obstruction, Zone, Path, Sensor
- Keyboard shortcuts for all tools and view modes
- Right-click contextual object menu with object-specific actions
- Right-dock inspector with multi-tab panels for all node types
- Camera failures tab with counterfactual controls
- Camera mount snap actions (wall/ceiling/pole)
- Bulk camera editor mode
- Scene editing feedback channel for placement/transform validation
- Undo/redo with history tracking

### View Modes
- **Map View**: full 3D workspace with heatmap, frustums, overlays, layer controls
- **Camera View**: full-canvas single-camera POV with live HUD, DORI overlay, replay actor, mode filters
- **Camera Wall**: adaptive multi-camera grid with 1-6 feeds, status counters, zone-quality summaries
- **Path Replay**: full-canvas replay with actor animation, camera frustums, segment context
- **Compare**: side-by-side before/after 3D panels with delta cards, snapshot selectors, visual evidence capture
- **Report Lite**: report workspace with executive summary, audience modes, export actions

### Reports and Exports
- Report engine with provenance sections, evidence appendix, temporal twin summary
- HTML, Markdown, JSON, and text export formats
- Audience-specific framing: operator, auditor, insurer, installer, privacy reviewer
- Report catalog presets and visibility selectors
- Compare exports with evidence trail and before/after counts
- Dedicated JSON evidence bundle for handoff artifacts
- Copy/Export/Print actions in report toolbar
- Privacy review sections in report and issue surfaces

### Governance

- Governance tab with role selection, review-required policy, request/approve/reject actions
- Action gate with allow/blocked status per operation
- Shared-workspace access surface with member routing
- Approval trail backed by operational evidence ledger
- Workspace membership archive queue and sync reconciliation
- Approval route resolution and archive
- Identity conflict resolution and archive with replay
- Remote governance handoff queue

### Organization and Account Model

- Canonical `Organization` and `Account` Zod schemas with `PlanTier`, `OrganizationRole`, quotas, and entitlements
- Multi-organization CRUD with localStorage persistence: create, read, update, delete organizations
- Organization membership management with role-based access (owner, admin, member, guest)
- Active organization selector and per-org profile switching
- OrganizationManager class (`lib/organization-store.ts`) with full test coverage (20 tests)
- Entitlement checking: `checkEntitlement()` returns allowed/reason per action
- Quota enforcement: `checkQuota()` validates resource limits before operations
- Plan upgrade path: `upgradeOrganizationPlan()` with canonical free/pro/enterprise profiles
- Plan-specific quotas: free (3 workspaces, 1 member), pro (12 workspaces, 5 members), enterprise (50 workspaces, 50 members)
- Plan-specific entitlements: free (archive, report), pro (sharing, scan, evidence, invites), enterprise (all including publish)
- Launcher integration: OrganizationManagerPanel modal with org creation, editing, org switching, and removal
- Workspace metadata editor: organization picker dropdown sourced from the org manager
- Left panel: active org display with plan badge and "Manage Organizations" entry point
- All data derived: no hardcoded org names, no fake billing surfaces, no placeholder entitlements

### Diagnostics and Debug
- Debug tab with overlay controls, simulation stats, camera-failure chips
- Provider governance dashboard: active provider, model, health, fallback order
- Provider health dashboard, prompt registry, model eval suite
- Measured AI action telemetry with prompt lineage and trend comparison
- Runtime health summary, journey trace, incident log, performance traces
- Support bundle export with scene, simulation, graph, evidence, governance, runtime truth
- External log capture lane, automated alerting summary
- Runtime truth download, incident bundle download
- Trust-audit surface registry with regression tests
- Operational evidence archive export/upload/merge-preflight/restore

### Launcher and Dashboard
- StudioDashboardHome with live preview, risk status, quick-start dock, project browser
- Project start launcher with job-first intent selection
- Workspace memory search across scene, saved workspaces, evidence, reports, archives
- Scene starter gallery with origin badges
- Workspace catalog with org/owner/visibility metadata
- Workspace account summary with plan/quota/entitlement posture
- Saved workspace cards with thumbnails, duplicate, rename actions
- Source filter row for project browser

---

## 5. What Is Partial

These systems exist and are wired, but lack depth, production quality, or completeness for the full product vision:

### Scan-to-Scene Reconstruction
- **What exists:** Manual-assisted photo intake with marker placement, candidate review, and deterministic compile. Guided scan assistant over the existing wizard. Provenance logging of scan sessions.
- **What is partial:** No phone-guided LiDAR capture. No automatic segmentation. No depth estimation. No multi-photo correspondence. No sparse reconstruction. The scan flow is manual-assisted, not reconstruction-grade. RoomPlan, SAM 2, Depth Anything V2, VGGT, and SpatialLM are documented research anchors but not integrated.

### AI Layout Draft
- **What exists:** Prompt-to-scene with model-backed structured output + deterministic fallback. JSON view/edit with validation. Workspace comparison before apply. Provenance logging. Provider health/telemetry visibility.
- **What is partial:** Deeper spatial intent fidelity is missing. Path-level planning quality is limited. Enrichment is prompt-aware but not scene-aware. The draft is an approximate layout requiring manual refinement.

### Floor-Plan Import
- **What exists:** Image upload, geometry extraction, scale calibration, correction controls (merge duplicates, snap openings, exclude false positives, drag markers), structural auto-fix, validation diagnostics.
- **What is partial:** Extraction quality is prototype-grade. Advanced correction depth is limited. No CAD/IFC/BIM-level import. The extractor produces usable but rough geometry that needs manual cleanup.

### Footage Verification
- **What exists:** Camera View verification workflow with reference-frame upload, overlay/split comparison, opacity/alignment controls, alignment quality score, difference heat overlay, defensive non-forensic disclaimer. Reference-frame snapshots write into the evidence ledger.
- **What is partial:** Static reference-frame alignment is not product-grade footage verification. No real-time video comparison. No automated frame extraction from live feeds. No forensic-grade pixel matching.

### Live Camera/Sensor Connection
- **What exists:** ONVIF SOAP client with device-info parsing, authenticated Basic/Digest challenge-response probes, event-subscription endpoint probing, subscription lease renewal on heartbeat. Camera metadata ingest (JSON/NDJSON/XML). Sensor live triggers, heartbeats, faults, restores. External feed bridge. Live connection event stream and camera metadata event stream in the evidence ledger. Active session lease registry.
- **What is partial:** Multi-step device-protocol session management beyond probe/archive. Longer-lived event-stream continuity. ONVIF Profile M richness beyond notification-envelope ingest. Real operating model for multi-sensor evidence.

### Multi-User Collaboration
- **What exists:** Local governance control plane with role selection, review requests, approval/rejection, annotations. Shared-workspace access surface with member routing. Membership archive, sync reconciliation, approval-route archive, identity-conflict resolution. All backed by the evidence ledger.
- **What is partial:** Collaboration is single-operator with local scaffolding for shared workflows. No backend RBAC/ABAC. No real shared-workspace sync. No change-approval workflows for shared environments. No draft/review/published branch semantics beyond the local model.

### Compliance Reporting
- **What exists:** Audience-specific report framing (operator/auditor/insurer/installer/privacy reviewer). Report catalog presets. Visibility selectors. Provenance/evidence in exports. Standards-oriented language.
- **What is partial:** No policy-driven redaction or visibility controls. No standards-specific export templates. No compliance-specific reporting modes distinct from general-purpose handoff.

### Temporal Simulation Depth
- **What exists:** 24-hour profile engine with 96 snapshots, schedule support, vulnerability windows, anomaly detection. Time-scrubbing into the 3D scene. Temporal twin summary in reports.
- **What is partial:** No seasonal/location-aware lighting (suncalc.js). No guard patrol integration. No occupancy-based camera obstruction multiplier. No door lock schedules.

---

## 6. What Is Scaffolded

These surfaces exist as UI, API routes, or data structures but are not connected to real behavior or are stubbed behind local-only implementations:

- **Billing and invites:** Canonical org/account model exists locally. No remote billing, no invites, no ownership transfer backend.
- **Workspace catalog:** Local workspace catalog summary renders. No remote workspace directory, no cross-device catalog.
- **Provider model eval:** Model eval suite exercises fixtures against the current provider. No broader eval harness for draft quality, scan extraction, or report quality.
- **Support delivery queue:** `/api/support-delivery` route exists. No real external fan-out/delivery pipeline.
- **Remote governance handoff:** `/api/governance-archive` exists. No real remote approval service.
- **Workspace membership handoff:** `/api/workspace-membership-archive` exists. No real backend identity service.
- **Sensor ingest route:** `/api/sensor-ingest` accepts pasted metadata. No real device protocol behind it.
- **Camera live connection probe:** Route accepts JSON/NDJSON/XML. No persistent connection to real devices.
- **Workspace account summary:** Derived local bridge with plan posture and soft quota. No canonical billing or entitlement backend.
- **Public share links:** Browser-native share buttons exist with clipboard fallback. No remote distribution story. No cross-device archive publish/reopen.
- **Trust audit CI harness:** `auditTrustSurfaces` runs in tests. Not yet in CI pipeline.

---

## 7. What Is Missing

These do not exist in any form and must be built:

### Trusted Site Twin Creation (First Implementation Dependency)
- Guided phone capture with LiDAR/structured-light coaching overlays
- Automatic segmentation (SAM 2 or equivalent) for tap-to-object extraction
- Depth estimation (Depth Anything V2 or equivalent) as a prior
- Multi-photo correspondence and sparse reconstruction (VGGT or equivalent)
- Structural extraction from geometry into walls/doors/windows (SpatialLM or equivalent)
- Confidence scoring per-extracted-element with human correction loop
- Scale anchoring from user measurements, not just AI inference

### Real Scan/Reconstruction Pipeline
- Integration of research anchors into a unified capture->reconstruction->compile pipeline
- Quality gates at each stage with explicit fallback to manual-assisted when confidence is low
- Device-specific capture coaching (Apple RoomPlan reference)

### Floor-Plan/CAD/IFC/BIM Import
- CAD file parsing (DXF/DWG)
- IFC/BIM-level structural import for pre-construction work
- Richer semantic extraction beyond wall/door/window detection

### Live Feed Verification
- Real-time video frame extraction from RTSP/MJPEG/ONVIF streams
- Automated temporal alignment between simulated and real footage
- Pixel-level comparison with uncertainty quantification
- Forensic-grade provenance for verification results

### Full ONVIF Profile M Integration
- Broader analytics metadata semantics
- Event-stream semantics beyond notification topics
- Full device management lifecycle

### Backend Persistence and Collaboration
- Server-side scene/evidence storage
- Real user authentication and session management
- Shared workspace sync with conflict resolution
- Change-approval workflows for shared environments
- Branch/merge semantics for collaborative editing
- Role-aware RBAC/ABAC across users and services

### Billing/Invites/Ownership Transfer

- Remote billing and payment processing
- Remote invite workflows (local invite modeling exists in org member CRUD but no email/notification delivery)
- Ownership transfer workflows for shared workspaces
- Remote workspace directory/catalog beyond local storage

### Compliance-Specific Reporting
- Policy-driven redaction and visibility controls for external sharing
- Standards-specific export templates (IEC 62676-4:2025, GDPR, NDAA)
- Compliance-specific reporting modes distinct from general-purpose handoff
- Report catalog with standards defaults, audience defaults, and share-policy annotations per preset

### Distribution and Market Packaging
- Production deployment packaging beyond the current dev app shell
- Self-hosted option with configuration management
- Cloud-backed AI option with real API gateway
- Market-specific templates (India/SEA/retail/NDAA/GDPR)
- Installer/onboarding experience for non-technical operators

### Extensibility and SDK
- Versioned SDK or plugin surface for partners
- Stable extension points for report exports, archives, imports, and workflow hooks
- Webhooks, event callbacks, and embed-friendly outputs
- Permission scopes for partner apps

### Full Observability
- System-level observability backbone (not just local summary cards)
- Distributed trace and log correlation across async paths
- Durable alert routing and incident correlation
- Stricter crash reproduction pairing support artifacts with exact runtime path

### Accessibility
- Full keyboard/screen-reader/reduced-motion coverage across all high-complexity panels
- ARIA compliance across the studio shell

---

## 8. Dependency Order

The platform layers have hard dependencies. Building out of order creates waste:

```
L1  Input Surfaces                    ──> must exist before any scene
L2  Scene Compilers                   ──> must compile into L3
L3  Canonical Scene Graph             ──> single source of truth, must be stable first
L4  Evidence / Provenance Memory      ──> must capture before L5-L10 can be trusted
L5  Deterministic Simulation          ──> must be correct before L6-L10 can cite numbers
L6  Temporal Operational Twin         ──> builds on L4+L5
L7  Live Sensor/Camera Fusion         ──> feeds L4, requires L3+L4+L5
L8  Governance/Collaboration          ──> builds on L4+L6, requires backend
L9  Reports/Compliance                ──> reads from L4+L5+L6
L10 Distribution/Packaging            ──> wraps everything above
```

**First implementation dependency: Trusted Site Twin Creation (L1+L2)**

Before the platform can be a security intelligence system, it must be able to create trusted twins of real sites. The current manual-assisted scan is the starting point, but the product needs guided capture, automatic segmentation, depth estimation, and multi-photo reconstruction to produce twins that operators trust without manual correction of every element.

---

## 9. Area-by-Area Backlog

### Area 1: Trusted Site Twin Creation
**Maturity: PARTIAL** (manual-assisted scan works, reconstruction does not exist)

| ID | Task | Depends On |
|----|------|------------|
| A1-01 | Integrate depth estimation (Depth Anything V2) as a per-photo depth prior in the scan wizard | Camera capture pipeline |
| A1-02 | Integrate promptable segmentation (SAM 2) for tap-to-object extraction in scan review | Segmentation model hosting |
| A1-03 | Add multi-photo correspondence pipeline (VGGT or equivalent) for sparse 3D reconstruction | Depth pipeline (A1-01) |
| A1-04 | Add structural extraction from reconstructed geometry into SecurityScene walls/doors/windows (SpatialLM or equivalent) | Multi-photo pipeline (A1-03) |
| A1-05 | Add guided capture coaching overlays (RoomPlan reference UX) in the scan wizard | Mobile capture API |
| A1-06 | Add per-element confidence scoring with human correction loop in scan review | Segmentation (A1-02) |
| A1-07 | Add scale anchoring from user measurements into the reconstruction pipeline | Depth pipeline (A1-01) |
| A1-08 | Add quality gates at each reconstruction stage with explicit fallback to manual-assisted | A1-01 through A1-07 |

### Area 2: Security Outcome Intelligence
**Maturity: REAL** (simulation engine is the strongest layer)

| ID | Task | Depends On |
|----|------|------------|
| A2-01 | Add seasonal/location-aware lighting via suncalc.js to temporal simulation | Temporal engine |
| A2-02 | Add occupancy-based camera obstruction multiplier to temporal model | Temporal engine |
| A2-03 | Add guard patrol integration to temporal model | Temporal engine |
| A2-04 | Add door lock schedule support to temporal model | Temporal engine |
| A2-05 | Surface more simulation results in product language (not only expert language) in the Metrics/Issues/Outcome panels | Simulation engine |

### Area 3: Complete Scene Editing
**Maturity: REAL** (editor workbench is wired and functional)

| ID | Task | Depends On |
|----|------|------------|
| A3-01 | Add per-handle validation messaging for transform edits | Editor state machine |
| A3-02 | Add editor fixture coverage for placement and snap behaviors | Editor workbench |
| A3-03 | Add non-camera sensor tools as first-class editing workflows (not just schema boundary) | SensorNode schema |

### Area 4: Real Scan/Reconstruction
**Maturity: MISSING** (research anchors identified, no integration)
Covered by Area 1 tasks A1-01 through A1-08.

### Area 5: Floor-Plan/CAD/IFC Import
**Maturity: PARTIAL** (image-based floor-plan import works)

| ID | Task | Depends On |
|----|------|------------|
| A5-01 | Improve extraction quality to production grade | Floor-plan extractor |
| A5-02 | Add DXF/DWG CAD file parsing | CAD parser library |
| A5-03 | Add IFC/BIM-level structural import for pre-construction | IFC parser library |
| A5-04 | Add richer semantic extraction beyond wall/door/window | IFC parser (A5-03) |

### Area 6: Footage Verification
**Maturity: PARTIAL** (static reference-frame alignment exists)

| ID | Task | Depends On |
|----|------|------------|
| A6-01 | Add real-time video frame extraction from RTSP/MJPEG/ONVIF | Live feed pipeline (Area 7) |
| A6-02 | Add automated temporal alignment between simulated and real footage | Video extraction (A6-01) |
| A6-03 | Add pixel-level comparison with uncertainty quantification | Temporal alignment (A6-02) |
| A6-04 | Add forensic-grade provenance for verification results | Evidence ledger (L4) |

### Area 7: Sensor/Live Evidence Fusion
**Maturity: PARTIAL** (ONVIF probe + metadata ingest exists)

| ID | Task | Depends On |
|----|------|------------|
| A7-01 | Implement persistent multi-step ONVIF session management beyond probe/archive | ONVIF SOAP client |
| A7-02 | Add longer-lived event-stream continuity for live cameras | Session management (A7-01) |
| A7-03 | Expand ONVIF Profile M metadata semantics beyond notification envelopes | ONVIF Profile M spec |
| A7-04 | Build trustworthy multi-sensor evidence operating model | Sensor ingest pipeline |
| A7-05 | Add BACnet/MQTT integration points for broader building systems | Protocol adapters |

### Area 8: Temporal Operational Twin
**Maturity: REAL** (temporal replay, evidence trail, and point-in-time reconstruction work)

Remaining work is deepening:
| ID | Task | Depends On |
|----|------|------------|
| A8-01 | Add richer public share-link contract for external consumers | Share link infrastructure |
| A8-02 | Add durable cross-device archive link and publish contract | Archive pipeline |
| A8-03 | Add federated temporal search across archived workspaces | Search infrastructure (Area 12) |

### Area 9: Counterfactual Optimization
**Maturity: REAL** (counterfactual simulation, placement oracle, and issue fix loop work)

| ID | Task | Depends On |
|----|------|------------|
| A9-01 | Add multi-camera counterfactual optimization (not just single-obstruction) | Simulation engine |
| A9-02 | Add budget-constrained optimization ("best coverage improvement under $X") | Counterfactual engine |
| A9-03 | Add constraint-based optimization ("camera cannot move, what else can change?") | Counterfactual engine |

### Area 10: Reports/Compliance/Stakeholder Artifacts
**Maturity: PARTIAL** (report engine and audience modes work, compliance depth is missing)

| ID | Task | Depends On |
|----|------|------------|
| A10-01 | Add policy-driven redaction and visibility controls for external sharing | Report pipeline |
| A10-02 | Add standards-specific export templates (IEC 62676-4:2025, GDPR, NDAA) | Report templates |
| A10-03 | Add compliance-specific reporting modes distinct from general-purpose handoff | Report engine |
| A10-04 | Add report catalog with standards defaults, audience defaults, and share-policy annotations | Report catalog |

### Area 11: Collaboration/Governance/Backend Persistence
**Maturity: PARTIAL** (local governance scaffolding + canonical org model exist)

| ID | Task | Depends On |
|----|------|------------|
| A11-01 | Design and implement server-side scene/evidence storage API | Backend infrastructure |
| A11-02 | Add real user authentication and session management | Auth provider |
| A11-03 | Implement shared workspace sync with conflict resolution | Storage API (A11-01) |
| A11-04 | Build change-approval workflows for shared environments | Auth (A11-02), sync (A11-03) |
| A11-05 | Implement branch/merge semantics for collaborative editing | Sync (A11-03) |
| A11-06 | Build role-aware RBAC/ABAC across users and services | Auth (A11-02) |
| A11-07 | ✅ Implement canonical org/account model with teams and membership | *Completed* — `schema/organization.ts`, `lib/organization-store.ts`, `OrganizationManagerPanel`, 20 tests |
| A11-08 | ✅ Add plan, billing, quota, and entitlement semantics | *Completed* — free/pro/enterprise plans with entitlements and quota enforcement locally |
| A11-09 | Add invite, transfer, and ownership workflows | Org model (A11-07) — invite modeling exists in member CRUD, no remote delivery |
| A11-10 | Build remote workspace directory/catalog | Storage (A11-01), org (A11-07) |

### Area 12: Workspace Retrieval and Memory Search
**Maturity: PARTIAL** (local workspace memory search exists)

| ID | Task | Depends On |
|----|------|------------|
| A12-01 | Add federated search across archived workspaces, reports, and recovery archives | Storage API (A11-01) |
| A12-02 | Add cross-referenced search across governance/identity/evidence archives | Storage API (A11-01) |
| A12-03 | Add search-by-time and search-by-branch navigation | Temporal twin (Area 8) |
| A12-04 | Add richer public handoff model for branch-aware result cards | Archive pipeline |

### Area 13: Distribution/Product Hardening
**Maturity: MISSING** (dev app shell only)

| ID | Task | Depends On |
|----|------|------------|
| A13-01 | Production deployment packaging (Docker, build optimization, env config) | Build pipeline |
| A13-02 | Self-hosted option with configuration management | Packaging (A13-01) |
| A13-03 | Cloud-backed AI option with real API gateway | AI provider (L5), backend (A11-01) |
| A13-04 | Market-specific templates (India/SEA/retail/NDAA/GDPR) | Scene templates |
| A13-05 | Installer/onboarding experience for non-technical operators | Packaging (A13-01) |
| A13-06 | Full accessibility audit and remediation | UI shell |
| A13-07 | Trust audit CI harness in the pipeline | Test infrastructure |

---

## 10. Acceptance Criteria Per Area

### Area 1 (Trusted Site Twin Creation)
- A real phone capture session produces a SecurityScene with >80% of walls/doors/windows extracted automatically
- Each extracted element carries a confidence score and source trace
- The operator can correct any misidentified element before compile
- The compiled scene passes Zod validation and auto-runs simulation
- Provenance records the full capture-to-compile chain

### Area 2 (Security Outcome Intelligence)
- Temporal simulation accounts for seasonal lighting, occupancy, and schedules
- All simulation results surface in operator-friendly language, not just engineer metrics
- Golden test suite passes for all temporal scenarios

### Area 3 (Complete Scene Editing)
- Every tool produces valid SecurityScene nodes through the canonical store
- Transform edits validate and provide feedback in real time
- Editor fixture tests cover placement and snap behaviors

### Area 5 (Floor-Plan/CAD Import)
- DXF/DWG files import with >90% structural accuracy on standard floor plans
- IFC files extract walls, doors, windows, and semantic metadata
- Import produces valid SecurityScene with confidence scores

### Area 6 (Footage Verification)
- Live feed frames are extracted and temporally aligned with simulated views
- Pixel-level comparison produces a quantitative alignment score with uncertainty bounds
- Verification results carry forensic-grade provenance in the evidence ledger

### Area 7 (Sensor/Live Evidence Fusion)
- ONVIF sessions persist across heartbeat renewal without manual re-probe
- Event streams flow continuously from real devices into the evidence ledger
- Multi-sensor evidence is visible in the temporal twin

### Area 10 (Reports/Compliance)
- Reports can be generated with audience-specific redaction and visibility controls
- Compliance-specific templates reference the correct standard and produce exportable artifacts
- Every export carries the evidence trail that supports its claims

### Area 11 (Collaboration/Backend)
- Multiple operators can edit a shared workspace with conflict detection and resolution
- Approval workflows gate publish actions
- Branch/merge semantics are enforced and visible in the provenance surface

---

## 11. Test Strategy Per Area

### Area 1 (Trusted Site Twin Creation)
- Unit tests: depth prior, segmentation, reconstruction, structural extraction (mock model outputs)
- Integration tests: end-to-end capture session -> SecurityScene compile -> Zod validation
- Regression tests: confidence scoring, element extraction accuracy, fallback-to-manual paths

### Area 2 (Security Outcome Intelligence)
- Unit tests: temporal engine with seasonal/schedule/occupancy inputs
- Golden test suite: extended to cover all temporal scenarios
- Regression tests: simulation results match expected values within tolerance

### Area 3 (Complete Scene Editing)
- Editor fixture tests: placement, snap, validation behaviors
- Store tests: CRUD operations produce valid SecurityScene state
- Visual regression tests: before/after screenshots for tool interactions

### Area 5 (Floor-Plan/CAD Import)
- Unit tests: CAD/IFC parser output -> SecurityScene compile
- Integration tests: import file -> review -> compile -> simulation
- Regression tests: extraction accuracy on standard floor plans

### Area 6 (Footage Verification)
- Unit tests: temporal alignment, pixel comparison, uncertainty quantification
- Integration tests: live feed extraction -> comparison -> provenance chain
- Regression tests: verification score stability across lighting conditions

### Area 7 (Sensor/Live Evidence Fusion)
- Unit tests: ONVIF session management, event-stream parsing, metadata mapping
- Integration tests: device connection -> event stream -> evidence ledger
- Regression tests: heartbeat renewal, session continuity, multi-sensor fusion

### Area 10 (Reports/Compliance)
- Unit tests: redaction logic, audience framing, standards referencing
- Integration tests: scene + evidence -> report export -> artifact validation
- Regression tests: report content matches simulation truth, no placeholder drift

### Area 11 (Collaboration/Backend)
- Unit tests: conflict detection, resolution strategies, branch/merge logic
- Integration tests: multi-user edit -> sync -> conflict resolution -> provenance
- E2E tests: approval workflow -> publish gate -> evidence trail

---

## 12. Truth/Maturity Language Rules

Every surface in the product must use one of these maturity labels, and agents must not promote a surface to a higher label without the corresponding evidence:

| Label | Meaning | Example |
|-------|---------|---------|
| **Real** | Computes real data from real inputs. Wired end-to-end. Tested. | Simulation engine, coverage heatmap, provenance ledger |
| **Partial** | Exists and is wired, but lacks depth or production quality for the full product vision. | Manual-assisted scan, floor-plan import, footage verification assist |
| **Scaffolded** | UI/API/data structure exists but is not connected to real behavior or is stubbed behind local-only implementation. | Org/account model, workspace catalog, support delivery queue |
| **Missing** | Does not exist in any form. Must be built. | Guided reconstruction, backend persistence, market packaging |

**Additional truth modifiers:**

| Modifier | Meaning |
|----------|---------|
| `simulated` | Data computed by the deterministic simulation engine |
| `inferred` | Data derived from AI or heuristic inference, not directly measured |
| `real` | Data from a live sensor, feed, or verified external source |
| `placeholder` | Temporary data for layout/preview, not representing actual computation |

**The `TruthBadge` component must appear on every data card that presents derived values.**

---

## 13. What Must Not Be Called Complete

The following statements are **forbidden** in any agent output, PR description, commit message, or documentation:

1. **"Camera coverage engine is the product."** The coverage engine is one subsystem. The product is a security intelligence platform.

2. **"Studio shell is the product."** The studio is one workspace. The product spans intake, audit, replay, compare, governance, reporting, deployment, and extensibility.

3. **"Manual-assisted scan is full scan reconstruction."** Manual-assisted scan is a first step. Full reconstruction requires guided capture, segmentation, depth, and multi-photo correspondence.

4. **"Static reference-frame alignment is product-grade footage verification."** The current verification assist is operator-helpful but not forensic-grade. Product-grade verification requires live feed extraction, temporal alignment, and pixel-level comparison.

5. **"Local governance scaffolding is backend collaboration."** The current governance tab is a local control plane. Backend collaboration requires server-side storage, authentication, sync, and RBAC.

6. **"Report-lite is complete stakeholder reporting."** Report Lite is a quick handoff. Complete stakeholder reporting requires audience-specific compliance modes, redaction, and standards-specific templates.

7. **"A seeded demo scene is proof of real site creation."** The demo scene proves the simulation spine works. Real site creation requires trusted site twin creation from actual site capture.

8. **"The product is complete when all reference-image features are matched."** Reference-image parity is visual parity, not product completion.

9. **"Any single view mode or analysis tab is sufficient."** No single mode is the product. The product is the sum of all layers working together through the canonical truth model.

---

## 14. Recommended Execution Sequence for Future Agents

This sequence respects dependency order and avoids building on missing foundations:

### Phase A: Site Twin Trust Foundation (L1+L2)
**Goal:** The product can create trusted twins from real site capture, not just manual-assisted intake.
1. A1-01: Depth estimation integration in scan wizard
2. A1-02: Promptable segmentation in scan review
3. A1-06: Per-element confidence scoring with correction loop
4. A1-07: Scale anchoring from user measurements
5. A1-03: Multi-photo correspondence pipeline
6. A1-04: Structural extraction into SecurityScene
7. A1-05: Guided capture coaching overlays
8. A1-08: Quality gates with fallback

### Phase B: Temporal and Simulation Depth (L5+L6)
**Goal:** Simulation is comprehensive across time, seasons, and operating conditions.
1. A2-01: Seasonal/location-aware lighting
2. A2-02: Occupancy-based obstruction multiplier
3. A2-03: Guard patrol integration
4. A2-04: Door lock schedules
5. A9-01: Multi-camera counterfactual optimization
6. A9-02: Budget-constrained optimization
7. A9-03: Constraint-based optimization

### Phase C: Live Evidence Fusion (L7)
**Goal:** Real devices feed the evidence ledger.
1. A7-01: Persistent ONVIF session management
2. A7-02: Longer-lived event-stream continuity
3. A7-03: ONVIF Profile M expansion
4. A6-01: Real-time video frame extraction
5. A6-02: Automated temporal alignment
6. A6-03: Pixel-level comparison with uncertainty
7. A6-04: Forensic-grade verification provenance

### Phase D: Reports and Compliance (L9)
**Goal:** Every export is audience-appropriate, standards-compliant, and evidence-backed.
1. A10-01: Policy-driven redaction/visibility controls
2. A10-02: Standards-specific export templates
3. A10-03: Compliance-specific reporting modes
4. A10-04: Report catalog with standards defaults

### Phase E: Backend and Collaboration (L8)
**Goal:** Multiple operators can collaborate with real governance.
- ✅ A11-07: Org/account model — completed with multi-org CRUD, membership, plan tiers, entitlements, and quota enforcement locally
- ✅ A11-08: Billing/quota/entitlement — completed locally with free/pro/enterprise plans, quota checks, and entitlement gates
1. A11-01: Server-side scene/evidence storage
2. A11-02: User authentication and sessions
3. A11-03: Shared workspace sync with conflict resolution
4. A11-04: Change-approval workflows
5. A11-05: Branch/merge semantics
6. A11-06: Role-aware RBAC/ABAC
7. A11-09: Invite/transfer/ownership (member CRUD exists, remote delivery needed)
8. A11-10: Remote workspace catalog

### Phase F: Import Depth (L1/L2)
**Goal:** The product can import from professional tools.
1. A5-01: Production-grade floor-plan extraction
2. A5-02: DXF/DWG import
3. A5-03: IFC/BIM import
4. A5-04: Richer semantic extraction

### Phase G: Distribution and Hardening (L10)
**Goal:** The product is deployable, accessible, and packaged for real users.
1. A13-01: Production deployment packaging
2. A13-02: Self-hosted configuration
3. A13-06: Full accessibility audit and remediation
4. A13-07: Trust audit CI harness
5. A13-03: Cloud-backed AI gateway
6. A13-04: Market-specific templates
7. A13-05: Installer/onboarding experience

### Continuous (Parallel to All Phases)
- Editor hardening (A3-01, A3-02, A3-03)
- Workspace retrieval improvements (A12-01 through A12-04)
- Simulation surface language improvements (A2-05)
- Trust-audit coverage expansion
- Test coverage maintenance

---

## Appendix A: Source Documents

This plan synthesizes from:
- `Docs/todos/FULL_VISION_GAP_INVENTORY.md` — full-vision gap analysis
- `Docs/todos/CURRENT_IMPLEMENTATION_STATE.md` — verified implementation baseline
- `CURRENT_STATUS.md` — repo status snapshot
- `Docs/architecture/00_ARCHITECTURE_OVERVIEW.md` — system architecture
- `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md` — SecurityScene schema
- `Docs/architecture/03_COVERAGE_ENGINE.md` — simulation engine design
- `Docs/architecture/05_AI_AGENT_ARCHITECTURE.md` — AI pipeline design
- `Docs/product/PRODUCT_VALUE_POSITIONING.md` — value proposition
- `Docs/product/PRODUCT_THESIS.md` — core thesis
- `Docs/decisions/DECISION_LOG.md` — architecture decisions
- `Docs/decisions/OPEN_QUESTIONS.md` — open questions
- `Docs/exploration/EXPLORATION_MAP.md` — research anchors
- `Docs/exploration/STANDARDS_COMPLIANCE_REGULATORY.md` — standards compliance
- Direct code audit of `apps/studio/src/` (schema, store, simulation, report, components)

## Appendix B: Key Metrics (Current Verified State)

| Metric | Value |
|--------|-------|
| Simulation files | 23 modules |
| Test suite | 398+ tests passing |
| Simulation performance | ~10.8ms (40x28 grid, 2 cameras) |
| TypeScript errors | 0 |
| Bottom-panel tabs | 20 |
| View components | 21 |
| Schema node types | 12+ (Camera, Wall, Door, Window, Light, Obstruction, Zone, PrivacyZone, EntryPoint, Path, Sensor, + metadata) |
| Scene sources | 6 (manual, ai, scan, import, preset, demo) |
| Report export formats | 4 (HTML, Markdown, JSON, text) |
| Audience modes | 5 (operator, auditor, insurer, installer, privacy reviewer) |
| Trust audit surfaces | 18 |
