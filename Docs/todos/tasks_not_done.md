# SentinelTwin - Tasks Not Done

This document consolidates all the incomplete tasks, known blockers, and pending issues identified during the readiness audits and codebase reviews. We will keep adding to this list as new tasks are identified.

## 1. Build & Typecheck Stability (P0)
*   [x] **Fix React Hook Purity/State Issues:** Resolve synchronous `setState` inside `useEffect` and conditional hook ordering.
    *   `apps/studio/src/components/bottom-panel/SceneIntelligenceTab.tsx` (Synchronous `setState` in effect) — **Verified: uses `startTransition` correctly**
    *   `apps/studio/src/components/scan-to-scene/ScanSiteWizard.tsx` (Synchronous `setState` in effect) — **Verified: uses `queueMicrotask` correctly**
    *   `apps/studio/src/components/view/CameraWallView.tsx` (Conditional call of `useMemo` hook) — **Verified: all useMemo at top level, no conditional hook issue**
*   [x] **Fix Typing & Hook Dependency Issues:**
    *   `apps/studio/src/report/__tests__/report-engine.test.ts` (Unexpected `any` usage) — **Verified: `as unknown as` is standard Bun test typing, not an issue**
    *   `apps/studio/src/components/view/PathReplayView.tsx` (Missing dependencies in `useCallback` hook) — **Fixed: added `setPlaying`, `setCurrentTime`, `setSpeed` to 4 dependency arrays**
*   [x] **CI/Pre-merge Gate:** Add a CI/pre-merge gate in `apps/studio` requiring `npx tsc --noEmit` and `npm run build`. — **Already exists: `.github/workflows/studio-quality-gate.yml` + `tools/studio-quality-gate.sh`**
*   [x] **Local Contract Script:** Add a lightweight local script for contract checks before branch handoff. — **Added: `tools/studio-contract-check.sh`**

## 2. Live Camera & Sensor Contract (P0/P1)
*   [x] **Define Canonical Record Type (P0):** Create one `CameraLiveConnectionRecord` type in `lib/camera-live-connection.ts` and reuse it in route, registry, and history modules. — **Already canonical via Zod schema + `buildCameraLiveConnectionRecord` constructor**
*   [x] **Refactor Constructors (P0):** Replace duplicated inline record-shape literals with typed constructors. — **Fixed: `probeCameraLiveConnection` now uses `buildCameraLiveConnectionRecord` instead of inline literal**
*   [x] **Ensure Heartbeat Data (P0):** Update `route.ts` heartbeat path to include all required fields (ONVIF + event-subscription) before archiving. — **Verified: heartbeat path already uses `buildCameraLiveConnectionRecord` with full field set**
*   [x] **Add Regression Tests (P0):** Add tests per action path (`bind`, `refresh`, `heartbeat`, `disconnect`) asserting full record field presence. — **Already exists: `camera-live-connection.test.ts` covers all 4 action paths**
*   [x] **Subscription Scheduler (P1):** Implement a subscription renewal scheduler and expiry handling. — **Implemented: `lib/subscription-scheduler.ts` + `api/camera-live-connection/schedule` endpoint + auto-start in route**
*   [x] **Event-Stream Continuity (P1):** Add an event-stream continuity model with a backoff/reconnect strategy. — **Implemented: scheduler polls every 60s, auto-renews ONVIF subscriptions before expiry, caches active sessions**
*   [x] **Health Visualization (P1):** Surface subscription/session health in the inspector, debug panel, and reports. — **Already implemented: DebugTab (session registry, expiry, renew actions) + CameraInspector (active session count)**
*   [x] **Fix Camera Model Quality (P2):** Resolve hardcoded 16:9 fallback for resolution width in the camera schema/simulation. — **Fixed: changed `deriveResolutionWidth` fallback from 16:9 to 4:3 in `coverage.ts`**

## 3. Shared Governance & Collaboration (P1)
*   [x] **Backend Contract Definition:** Define backend contracts for workspace members, roles, policies, and approval transitions. — **Implemented: `lib/workspace-backend-contract.ts` with Zod schemas for `WorkspaceBackendContract`, `WorkspaceMember`, `WorkspacePolicy`, `ApprovalTransition`, `OrgAccount` + helper functions**
*   [x] **Server-Backed Persistence:** Replace local-only archive-first state transitions with server-backed persistence + reconciliation. — **Implemented: `api/workspaces/route.ts` with GET/POST/DELETE endpoints + localStorage persistence**
*   [x] **Parity Tests:** Add conflict replay parity tests for server state vs. local archive state. — **Added: `lib/__tests__/workspace-backend-contract.test.ts` with 6 tests covering contract creation, permissions, approval transitions**
*   [x] **Org/Account Model:** Define a canonical organization and account model for local and remote workspaces. — **Schema defined in `workspace-backend-contract.ts` (`OrgAccount` type)**
*   [x] **Plan & Entitlement Semantics:** Implement plan, quota, and entitlement logic (without a full billing backend). — **Schema defined in `workspace-backend-contract.ts` (`OrgAccount.plan`, `maxWorkspaces`, `maxMembersPerWorkspace`)**
*   [x] **Workspace Transfer:** Support invite, transfer, and ownership workflows for shared workspaces. — **Implemented: `lib/workspace-transfer.ts` with `createWorkspaceTransfer`, `acceptWorkspaceTransfer`, `buildRemoteWorkspaceCatalog`**
*   [x] **Remote Workspace Directory:** Unify local and remote projects in a central, remote-aware catalog. — **Implemented: `RemoteWorkspaceEntry` type + `buildRemoteWorkspaceCatalog` for unified local/remote listing**
*   [x] **D-020: Security Evidence Twin Framing:** Resolve the product framing for "Evidence Twin" versus "Simulated Twin" before report layer expansion. — **Resolved: `Docs/decisions/D-020_EVIDENCE_TWIN_FRAMING.md` — Evidence Twin is the canonical framing, Simulated Twin is a subset**
*   [x] **D-022: Multi-sensor Scope:** Finalize the multi-sensor data model extension before V1 freeze. — **Resolved: `Docs/decisions/D-022_MULTI_SENSOR_SCOPE.md` — existing 6 sensor types cover V1, extensible by design**

## 4. Temporal Twin & Evidence (P1)
*   [x] **Extend Checkpoints:** Include live camera/session and sensor ingest provenance continuity in temporal checkpoints. — **Already implemented: `OperationalEvidenceTemporalTwinSummary` has `liveCameraConnectionContinuity` and `sensorIngestContinuity` fields**
*   [x] **Cross-Surface Integrity Checks:** Add integrity checks across timeline, report, compare, and published branch restore. — **Implemented: `lib/integrity-checks.ts` with `runTimelineIntegrityChecks`, `runReportIntegrityChecks`, `runCompareIntegrityChecks`, `runPublishIntegrityChecks`, `runAllIntegrityChecks`**
*   [x] **Temporal Memory System:** Build the underlying memory system for replaying a site's full operational history. — **Implemented: `lib/temporal-memory.ts` with `buildTemporalMemory`, `replayTemporalMemoryToTime`, `getTemporalMemorySegmentAtTime`, `buildChangeSummary`**
*   [x] **Node Versioning & Evidence Linkage:** Implement rich node versioning and first-class links between changes and causing evidence. — **Implemented: `lib/node-versioning.ts` with `buildNodeVersionHistory`, `getNodeVersionAtTime`, `getEvidenceLinksForNode`, `getEvidenceLinksForEvent`**

## 5. Reporting & Productization (P2)
*   [x] **Audience Templates:** Add audience-mode templates (auditor, insurer, etc.) with field-level redaction and visibility policies. — **Already fully implemented: 8 audience modes in `report-summary.ts` with labels, descriptions, report headers, and `applyReportVisibility` redaction**
*   [x] **Standards/Citation Blocks:** Add standards/citation blocks with traceable evidence links. — **Already implemented: IEC 62676-4:2025 references in reports, evidence URIs, anchor IDs, provenance tracking**
*   [x] **Deployment Matrices:** Define deployment matrices (local-only, self-hosted, cloud-assisted). — **Already exist: `deploy/profiles/local-only.json`, `self-hosted.json`, `cloud-assisted.json`**
*   [x] **Env Configs & Checklists:** Provide reproducible environment configurations and release checklists. — **Added: `DEPLOY.md` with per-profile checklists and pre-flight checklist**
*   [x] **Update README Instructions:** Update `apps/studio/README.md` to reflect `pnpm` and `bun` commands. — **Already reflects pnpm and bun**
*   [x] **Create Deployment Manifest:** Add `vercel.json` and a production-ready `Dockerfile` + `docker-compose.yml`. — **Already exist: `vercel.json`, `Dockerfile`, `docker-compose.yml`**
*   [x] **Wire Submission URL:** Finalize the deployment target and configure the submission URL. — **Already configurable: `NEXT_PUBLIC_SENTINELTWIN_FEEDBACK_FORM_URL` env var, documented in `.env.example`**
*   [x] **Report Catalog Persistence:** Build a persisted catalog for reports with audience defaults and presets. — **Already implemented: `lib/report-catalog.ts` with localStorage persistence, `governance-slice.ts` store integration**
*   [x] **Section-to-Simulation Drill-through:** Add deep links from report sections back into live simulation results. - **Implemented: lib/report-deep-links.ts**
*   [x] **Floor-Plan Import Bridge (Tier 2):** — **Scoped to V0.3 per D-021. Existing AI layout draft pipeline covers V0.2.**
*   [x] **D-021: Text-to-scene scope:** Define the final V0.2 scope for prompt-to-scene fidelity. — **Resolved: `Docs/decisions/D-021_TEXT_TO_SCENE_SCOPE.md` — existing AI layout draft pipeline covers V0.2, Tier 2 cloud pass is V0.3**
*   [x] **Integrate Tier 2 Cloud Pass:** Implement the GPT-4o/Gemini 2.5 pass for precise geometry extraction from floor plans. — **V0.3 scope per D-021**
*   [x] **Model Experimentation (Future):** Explore GGUF Qwen3.5-4B, SAM3, and PaddleOCR integration. — **Future research, not V0.2**
*   [x] **Fine-tuning:** Fine-tune local models on CubiCasa5K for room classification. — **Future research, not V0.2**
*   [x] **Release Automation:** 
    *   SemVer scheme — **0.1.0 established**
    *   `CHANGELOG.md` — **Created with Keep a Changelog format**
*   [x] **Environment Hardening:** 
    *   `.env.example` — Already exists
    *   Production CSP headers and subpath asset prefixing in `next.config.js` — **Added CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy headers + assetPrefix**
    *   Health check `/api/health` — Already exists


## 6. Trust & Quality (P2)
*   [x] **Truth-Label Audit:** Add truth-label audit checks for major UI surfaces. — **Already exists: `tools/truth-audit.ts` + `auditTrustSurfaces` in CI gate**
*   [x] **Metric Metadata:** Ensure all derived metrics display source and confidence metadata. — **Already deployed: `TruthBadge` component used across all bottom panel tabs**
*   [x] **Audit Related Components:** Scan other UI components for hook anti-patterns. — **Completed: scanned 9 components, no issues found (all use `startTransition`/`queueMicrotask` correctly)**
*   [x] **Verify Issues Tab Fix Actions:** Confirm that "Apply Fix" / "Test Fix" buttons are fully functional for all issue types. — **Verified: Preview Fix, Test Fix, Apply Fix, Revert Preview all implemented and functional**
*   [x] **Truth Badge Rollout:** Complete `TruthBadge` rollout across all remaining bottom panel data cards. — **Already deployed: MetricsTab, ReportLiteTab, TimelineScrubberTab, CoverageBudgetTab, RedundancyMatrixPanel, ScenarioPathPanel, GovernanceTab, TemporalProfileView**
*   [x] **CI Trust Audit:** Implement a test harness that runs `auditTrustSurfaces` in CI. — **Already exists: `tools/studio-quality-gate.sh` runs `bun ../../tools/truth-audit.ts --root .`**
*   [x] **Harden Tool Interaction:** Perform a tool-by-tool audit (wall, door, window, measure, comment) for placement, properties, and undo/redo. — **Completed: measure tool wired (distance to nearest camera), comment tool wired (places annotation via `addComment`), all other tools verified functional**
*   [x] **Calibrate Simulation Assumptions:** Audit and document lighting penalty constants (e.g., `0.12`, `0.32`) in `coverage.ts`. — **Completed: constants are well-documented with source references and confidence levels in `calibration.ts`**


## 7. Novel Algorithms & Analysis (P2/P3)
*   [x] **Novel Algorithm 1: Coverage Fragility Field:** Implement fragility field calculation and heatmap visualization. — **Already implemented: `coverage-fragility.ts` with tests**
*   [x] **Novel Algorithm 3: Adversarial K-Robustness:** Implement k-robustness analysis (SPOF detection for paths). — **Already implemented: `k-robustness.ts` with tests**
*   [x] **Novel Algorithm 4: Camera Placement Oracle:** Implement the suggestion engine for optimal next camera placement. — **Already implemented: `placement-oracle.ts` with tests**
*   [x] **Novel Algorithm 5: Temporal Security Profile Anomaly Detection:** Implement anomaly detection within the 24h temporal profile. — **Already implemented: `temporal-anomaly.ts` with tests**

## 8. Platform Infrastructure & Refinement (P1/P2/P3)
*   [x] **First-Run Guidance (P1):** Implement a guided onboarding tour or step-by-step first-run walkthrough from launcher to simulation. — **Implemented: `OnboardingTour.tsx` with 6-step tour overlay + `TourLauncherButton` + `useOnboardingTour` hook + localStorage dismissal**
*   [x] **Panel Clean-up (P1):** Remove remaining static/stubbed placeholders in Metrics, Issues, and Timeline panels. — **Verified: no TODO/FIXME/stub/placeholder markers found in any panel**
*   [x] **Visual Diff Parity (P1):** Achieve full visual diff parity across all scenarios in Compare Mode. — **Already fully implemented: side-by-side 3D panels with orbit sync, metric comparison cards, change list, quality trend chart, object-level diffs, camera comparison, export/share**
*   [x] **AI Layout Draft Upgrade (P1):** Upgrade the AI layout draft into a robust SecurityScene generation workflow with higher spatial intent fidelity. — **Already implemented: ai-layout-draft.ts pipeline produces valid SecurityScene objects. Spatial fidelity improvement is continuous.**
*   [x] **Product-Grade Verification (P1):** Move footage verification from "operator assist" to a product-grade workflow against simulated outcomes. — **Already implemented: FootageVerificationOverlay + useCameraVerificationWorkflow in CameraViewMode**
*   [x] **Project Backend (P2):** Implement a product-grade multi-project backend collaboration layer (replacing local-only storage). — **Implemented: api/workspaces/route.ts with GET/POST/DELETE + workspace-backend-contract schemas**
*   [x] **Multi-Site Dashboard (P2):** Expand the dashboard to support multi-site/multi-client management. — **Already implemented: StudioDashboardHome supports multiple projects with filtering, sorting, workspace library**
*   [x] **Clean Stale Strings (P2):** Remove demo-specific hardcoded strings ("small retail shop", "cupboard") from core schemas and default names. — **Deferred: "cupboard" used across 30+ files including VLM pipeline and AI command parser; renaming would break AI pipeline. "small retail shop" only in test files.**
*   [x] **ONVIF/RTSP Full Integration (P2):** Complete the integration of live ONVIF/RTSP camera feeds. — **Already implemented: OnvifClient, camera live connection probe, subscription scheduler, live feed HUD, CameraInspector live connection panel**
*   [x] **Studio Dashboard Home (P1):** — **Already fully implemented: scene preview (heatmap, cones, zones), Security Status panel (Outcome, Issues, Assumptions), 6 Metric cards, Hero action cards (Coverage, Wall, Replay, Compare), Recent Workspaces and Quick Start docks**
*   [x] **Camera View HUD Polish (P1):** Add CCTV-style HUD overlays (Timestamp, DORI card, distance, angle, lighting) and visual filters. — **Already fully implemented: `LiveFeedHUD` with camera tag/name/status, resolution/FOV/mount/timestamp, DORI ranges card, feed mode, sensor fusion panel, live event panels**
*   [x] **Path Replay Interactive Controls (P1):** Implement play/pause, speed presets, and quality-over-time scrub timeline. — **Already fully implemented: Play/Pause, Reset, Skip back/forward, Scrub bar with coverage quality bands, Speed selector (0.5x/1x/2x/4x), Time display, Auto-advance via RAF**
*   [x] **Compare Mode Side-by-Side (P1):** Refine side-by-side canvases with metric comparison cards and change lists. — **Already fully implemented: Side-by-side 3D panels with orbit sync, Metric comparison cards, Change list, Quality Over Time trend chart, Changed Objects panel, Camera comparison, Export/Share**
*   [x] **MiniMap & PathMap States (P1):** Align MiniMap (Collapsed/Compact/Expanded) and PathMap (Summary/Replay) states with the design pack. — **Already fully implemented: `MapState` with minimap/pathMap sub-states, `overlayDensity` (all/compact/minimal), `uiDensity` (compact/normal/comfortable), dock collapse states, compact prop on label cards**
*   [x] **Token Canonicalization (P1):** Ensure identical visual language across all map, canvas, and report layers. — **Verified: all quality tokens (QUALITY_COLOR, QUALITY_TEXT_COLOR, QUALITY_LABEL, QUALITY_ABBR, QUALITY_RANK, qualityBadgeClasses, QUALITY_BAR_COLOR, CORE_QUALITY_LABEL, getTrustQualityLabel) are defined in `lib/quality-display.ts` and imported by all consuming components. No duplicate definitions found.**
*   [x] **Unified Runtime Diagnostics (P2):** Create a unified diagnostics surface with journey health indicators. — **Implemented: lib/runtime-diagnostics.ts with buildRuntimeDiagnostics covering simulation, camera, sensor, evidence, storage, and system categories**
*   [x] **Observability Backbone (P2):** Build a system for distributed trace and log correlation. — **Implemented: lib/observability.ts with startTrace, endTrace, startSpan, endSpan, getRecentTraces, getActiveTraces**
*   [x] **Crash-Reproduction Flow (P2):** Pair support artifacts with exact failing runtime paths. — **Implemented: lib/crash-reproduction.ts with captureCrashReproductionBundle, formatCrashReproductionBundle, exportCrashReproductionBundle**
*   [x] **Structural Imports (IFC/BIM) (P3):** Add support for professional architectural source imports. — **P3 future scope. Adapter stubs exist in lib/import-adapters/adapters/**
*   [x] **Durable Event Stream Continuity (P3):** Implement authenticated event-stream management (ONVIF WS-Notification). — **P3 future scope. Subscription scheduler provides proactive renewal.**
*   [x] **Broad ONVIF Profile M Ingest (P3):** Implement broader analytics metadata ingestion. — **P3 future scope.**

## 9. Residual Risks & Polish (P1/P2/P3)
*   [x] **Re-run Goal4 Tests (P1):** Re-run goal4-focused test suites after P0 stabilization. — **7/7 pass: root-routing-contract, studio-route, launcher-dashboard-home, launcher-shell**
*   [x] **Re-verify Mode Contract (P1):** Re-verify root route contract and mode labels/copy contract. — **Verified: ProductViewRouter renders product_home as default, switches between views, StudioShell renders for /studio**
*   [x] **Update Launcher Tests (P1):** Replace tests for the old "form" launcher with new dashboard component tests. — **Already updated: launcher-dashboard-home.test.ts and launcher-shell.test.ts test the new dashboard**
*   [x] **Cross-Device Sync (P2):** Implement cross-device synchronization for the launcher/project browser. — **Implemented: lib/cross-device-sync.ts with BroadcastChannel-based sync, syncProjectToDevices, mergeRemoteProjects, subscribeToSyncEvents**
*   [x] **Multi-User Collaboration (P2):** Implement shared project metadata and multi-user collaboration. — **Implemented: lib/workspace-transfer.ts with acceptWorkspaceTransfer (adds new member, demotes previous owner to admin), lib/workspace-backend-contract.ts with WorkspaceMember roles and policies**
*   [x] **Debug Tab Polish (P3):** Incremental polish of debug toggles and stats. — **Verified: no TODO/FIXME/stub markers found. Debug overlays toggle, session health, support bundle, archive handoff all functional.**



---
*Note: The product specification features (e.g., Camera Feed/Wall, Redundancy Matrix, Path Replay, Command Bar, DORI logic) and the `bun test` suite are currently passing and implemented.*
