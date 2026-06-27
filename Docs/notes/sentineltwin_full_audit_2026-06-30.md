# SentinelTwin Full Audit — 2026-06-30

**Evidence tier:** Tier 1, static inspection of the live repo, current docs, and key route/component files.  
**Purpose:** answer, as concretely as possible, what is built, what is partial, what is scaffolded, and what is still missing.

## Short Verdict

SentinelTwin is not a hollow prototype. The core studio is real:

- canonical `SecurityScene` data model
- deterministic simulation / coverage engine
- the full studio shell with map, camera view, camera wall, path replay, compare, report, and analytics modes
- a substantial intake surface for manual scan, floor-plan import, JSON import, AI draft, and reference/demo scenes
- report, provenance, governance, and temporal/replay surfaces

What is still weak is not “the whole app”; it is the product’s outer systems:

- trusted site creation from real capture
- production-grade floor-plan extraction
- forensic/live camera verification
- long-lived live camera/sensor session management
- backend collaboration and persistence
- production deployment / packaging
- several import adapters that are still explicit boundaries or stubs

## What Is Built

### 1) Top-Level Routing / Pages

Current live entrypoints:

- `/` renders the product router and can land users in `product_home`, `site_intake`, `reference_sites`, `settings`, `ai_layout_draft`, and the studio deep links.
- `/studio` renders the studio shell directly.
- API routes exist for ingest, governance, AI command/report/draft/counterfactuals, health, reconstruction, support, and trust-audit boundaries.

Built behavior:

- first-time users are redirected into intake when no workspace/cameras exist
- the product home is a real launcher, not a static marketing page
- the studio route is a real application shell

### 2) Studio Shell

The shell is real and fairly mature:

- top bar
- view mode bar
- command bar
- left panel / right inspector / bottom analysis drawer
- view settings modal
- first-run guide
- shortcuts modal
- autosave recovery banner
- focus mode / full-canvas review surfaces

This is not a dead frame around a single canvas. It is a real multi-surface workspace.

### 3) Core Workspace Modes

These modes exist and are wired:

- `Map View`
- `Camera View`
- `Camera Wall`
- `Path Replay`
- `Compare`
- `Report`
- `Analytics`

What is real here:

- map mode edits and reviews the scene
- camera view shows a full-canvas camera POV with overlays and replay context
- camera wall shows multi-feed review with live feed support where URLs are available
- path replay has a shared replay clock and actor-driven route analysis
- compare shows before/after scene state and exportable evidence
- report summarizes outcome / evidence / assumptions / exports
- analytics surfaces KPI, temporal, and resilience-style summaries

### 4) Intake / Creation Flows

Real, but uneven in maturity:

- `Scan Site` manual-assisted intake
- `Upload Floor Plan`
- `Import Site Twin` JSON
- `Build Manually`
- `Describe with AI`
- `Verify from Footage`
- `Reference Sites`
- `Settings`

What is built:

- intake cards are honest about maturity
- a draft-review step exists for scene creation/import
- manual scan compiles into SecurityScene
- floor-plan import exists with calibration/correction controls
- AI draft exists with model-backed output and fallback
- reference/demo scenes can be loaded into the workspace

### 5) Analysis / Review Surfaces

These are built and mostly meaningful:

- `Security Outcome`
- `Metrics`
- `Issues`
- `Sensors`
- `Redundancy`
- `Fix Options`
- `Route Exposure`
- `Advanced Risk Signals`
- `Scenario Comparison`
- `Budget`
- `Report Lite`
- `Assumptions`
- `Governance`
- `Evidence Trail`
- `Timeline`
- `24H Profile`
- `Before / After`
- `Help`
- `Diagnostics`

The key point: the bottom panel is not just decorative tabs. It is a real analysis stack with multiple working modules.

### 6) Governance / Local Collaboration Model

Built:

- local governance control plane
- member routing / approval posture
- archive and conflict surfaces
- branch lifecycle semantics in the local model
- workspace catalog / organization / account summaries

This is useful, but still local-first scaffolding rather than full backend collaboration.

### 7) Temporal / Provenance

Built:

- evidence-ledger style event recording
- scene snapshots
- temporal summary surfaces
- point-in-time reconstruction and replay concepts
- provenance-aware report handoff
- truth labels / claim-source framing on multiple surfaces

This is one of the stronger parts of the product.

## What Is Partial

### 1) Guided Scan / Trusted Site Creation

What exists:

- manual-assisted photo marking
- candidate review
- compile-to-scene
- scan quality gates
- draft review

What is partial:

- no full guided phone capture experience with strong reconstruction guidance
- no true multi-photo reconstruction pipeline
- no production-grade segmentation/depth correspondence loop
- reconstruction still depends on user correction and review

### 2) Floor-Plan Import

What exists:

- upload flow
- heuristic extraction
- calibration
- exclusion / correction controls
- marker drag correction
- structural auto-fix actions

What is partial:

- extraction quality is prototype-grade
- CAD / IFC / BIM import is not implemented
- the UX still has trust-friction around raw counts, scale changes, and “what exactly changed”

### 3) Camera View / Footage Verification

What exists:

- live camera POV
- DORI overlays
- replay-aware overlays
- reference-frame verification assist
- split/overlay comparison and alignment controls
- evidence snapshots are recorded

What is partial:

- static reference-frame alignment is not product-grade live verification
- there is no real-time video comparison pipeline
- there is no forensic-grade pixel matching or automated frame extraction pipeline

### 4) Live Camera / Sensor Fusion

What exists:

- camera metadata ingest
- sensor ingest
- camera live connection route
- ONVIF-style probing / lease renewal paths
- sensor events in the evidence trail

What is partial:

- persistent session management is still shallow
- long-lived event-stream continuity is still open
- broader ONVIF Profile M semantics are not fully modeled

### 5) AI Draft / Provider Layer

What exists:

- prompt-to-scene draft flow
- provider selection / local-only policy
- model eval fixtures
- provider governance surfaces

What is partial:

- the draft is still approximate layout generation, not a strong spatial authoring system
- provider paths still include fallback/stub behavior in the wider model stack

### 6) Reporting

What exists:

- report lite
- compare exports
- evidence/provenance sections
- audience mode concepts
- truth labels

What is partial:

- standards-specific export depth is not complete
- policy-driven redaction / visibility controls are not fully finished
- the report stack is useful, but not yet a full compliance publishing system

### 7) UI Trust / Claim Hygiene

What exists:

- truth labels
- explicit maturity labels in launcher surfaces
- truth-audit checks in tests/docs

What is partial:

- some panels still rely on static or placeholder-like elements
- some counts/summary chips are helpful but can still be over-read as final truth

## What Is Scaffolded

These parts exist, but mostly as local-only infrastructure, adapters, or route boundaries rather than complete product systems:

- org/account model
- workspace catalog
- support delivery queue
- remote governance archive / membership archive
- workspace approval route archive
- model eval harness for current provider fixtures
- public/share-link plumbing
- some report/catalog persistence surfaces

Adapter boundaries that are explicitly scaffolded:

- CAD / IFC import adapter
- PDF vector extraction adapter
- GLB / OBJ visual mesh adapter
- scan adapter registry and its stub-backed fallback paths

In short: the plumbing is there, but not the real external integration.

## What Is Missing

These are not meaningfully built yet:

- guided capture reconstruction as a true product workflow
- production CAD / IFC / BIM import
- live stream frame extraction and temporal alignment
- forensic-grade verification
- backend collaboration with real multi-user sync / auth / RBAC
- remote billing / invites / ownership transfer
- production deployment packaging
- self-hosted/cloud packaging story with operational bootstrap
- SDK/extensibility layer
- full observability / distributed runtime truth

## Minutely Broken or Risky Areas

These are the spots I would treat as “attention required,” even if the app is broadly functioning:

1. **Route continuity is stateful**
   - `/` can land in different product views based on current workspace state.
   - That is intentional, but it can surprise users and needs to stay explicit.

2. **Floor-plan import trust is still fragile**
   - Raw candidate counts, calibration changes, and correction semantics are easy to misread.
   - This is a UX trust issue, not just a parsing issue.

3. **Verification is not forensic**
   - The footage workflow is useful, but the product should not be described as live-video verification in the strict sense.

4. **Live-device continuity is not mature**
   - Probe/metadata support exists, but persistent event-stream/session continuity is still weak.

5. **Some “backend” surfaces are local mirrors**
   - Governance archive, membership archive, workspace catalog, and support delivery should be treated as scaffolds, not remote systems.

6. **Import adapters are explicit boundaries**
   - CAD/IFC, PDF vector, and GLB/OBJ are not real pipelines yet.

7. **Report depth is still incomplete**
   - The report stack is real, but not yet a full compliance-grade publishing system.

## Feature-by-Feature Snapshot

| Area | Status | Notes |
|---|---|---|
| Root launcher / product home | Real | Multi-entry launcher with maturity labels and recent workspace state |
| Studio shell | Real | Full workspace frame with top/left/right/bottom chrome |
| Map / Camera / Wall / Replay / Compare / Report / Analytics | Real | All routed and usable |
| Manual-assisted scan | Partial | Built, but not full reconstruction |
| Floor-plan import | Partial | Built, but prototype-grade extraction |
| AI layout draft | Partial | Built, but spatial intent remains rough |
| Camera verification | Partial | Alignment assist, not forensic verification |
| Live camera / sensor ingest | Partial | Probe and ledger support exist, continuity is still open |
| Governance / collaboration | Scaffolded | Local control plane; backend persistence missing |
| Reports | Partial | Useful handoff; compliance/export depth missing |
| Org/account/billing | Scaffolded | Local model exists; remote system missing |
| Deployment / packaging | Missing | Still dev-app oriented |
| CAD / IFC / BIM import | Missing | Boundary only |
| SDK / extensibility | Missing | No real public extension model yet |

## Best Next Discussion Order

If we want to turn this into the next build plan, I’d discuss in this order:

1. trusted site creation / floor-plan trust
2. camera verification / live evidence
3. collaboration / backend persistence
4. reporting / compliance
5. packaging / deployment

That sequence matches the actual product dependency chain better than feature-by-feature polish.

## Notes

- This audit is intentionally stricter than the “current implementation state” doc from earlier in the month.
- I treated the live tree and the newest notes as more authoritative than older roadmap language.
- I did not run runtime/browser verification in this pass.
- I did not modify any existing code or the other untracked notes.

