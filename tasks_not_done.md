# SentinelTwin - Tasks Not Done

This document consolidates all the incomplete tasks, known blockers, and pending issues identified during the readiness audits and codebase reviews. We will keep adding to this list as new tasks are identified.

## 1. Build & Typecheck Stability (P0)
*   [ ] **Fix React Hook Purity/State Issues:** Resolve synchronous `setState` inside `useEffect` and conditional hook ordering.
    *   `apps/studio/src/components/bottom-panel/SceneIntelligenceTab.tsx` (Synchronous `setState` in effect)
    *   `apps/studio/src/components/scan-to-scene/ScanSiteWizard.tsx` (Synchronous `setState` in effect)
    *   `apps/studio/src/components/view/CameraWallView.tsx` (Conditional call of `useMemo` hook)
*   [ ] **Fix Typing & Hook Dependency Issues:**
    *   `apps/studio/src/report/__tests__/report-engine.test.ts` (Unexpected `any` usage)
    *   `apps/studio/src/components/view/PathReplayView.tsx` (Missing dependencies in `useCallback` hook)
*   [ ] **CI/Pre-merge Gate:** Add a CI/pre-merge gate in `apps/studio` requiring `npx tsc --noEmit` and `npm run build`.
*   [ ] **Local Contract Script:** Add a lightweight local script for contract checks before branch handoff.

## 2. Live Camera & Sensor Contract (P0/P1)
*   [ ] **Define Canonical Record Type (P0):** Create one `CameraLiveConnectionRecord` type in `lib/camera-live-connection.ts` and reuse it in route, registry, and history modules.
*   [ ] **Refactor Constructors (P0):** Replace duplicated inline record-shape literals with typed constructors.
*   [ ] **Ensure Heartbeat Data (P0):** Update `route.ts` heartbeat path to include all required fields (ONVIF + event-subscription) before archiving.
*   [ ] **Add Regression Tests (P0):** Add tests per action path (`bind`, `refresh`, `heartbeat`, `disconnect`) asserting full record field presence.
*   [ ] **Subscription Scheduler (P1):** Implement a subscription renewal scheduler and expiry handling.
*   [ ] **Event-Stream Continuity (P1):** Add an event-stream continuity model with a backoff/reconnect strategy.
*   [ ] **Health Visualization (P1):** Surface subscription/session health in the inspector, debug panel, and reports.
*   [ ] **Fix Camera Model Quality (P2):** Resolve hardcoded 16:9 fallback for resolution width in the camera schema/simulation.

## 3. Shared Governance & Collaboration (P1)
*   [ ] **Backend Contract Definition:** Define backend contracts for workspace members, roles, policies, and approval transitions.
*   [ ] **Server-Backed Persistence:** Replace local-only archive-first state transitions with server-backed persistence + reconciliation.
*   [ ] **Parity Tests:** Add conflict replay parity tests for server state vs. local archive state.
*   [ ] **Org/Account Model:** Define a canonical organization and account model for local and remote workspaces.
*   [ ] **Plan & Entitlement Semantics:** Implement plan, quota, and entitlement logic (without a full billing backend).
*   [ ] **Workspace Transfer:** Support invite, transfer, and ownership workflows for shared workspaces.
*   [ ] **Remote Workspace Directory:** Unify local and remote projects in a central, remote-aware catalog.
*   [ ] **D-020: Security Evidence Twin Framing:** Resolve the product framing for "Evidence Twin" versus "Simulated Twin" before report layer expansion.
*   [ ] **D-022: Multi-sensor Scope:** Finalize the multi-sensor data model extension before V1 freeze.

## 4. Temporal Twin & Evidence (P1)
*   [ ] **Extend Checkpoints:** Include live camera/session and sensor ingest provenance continuity in temporal checkpoints.
*   [ ] **Cross-Surface Integrity Checks:** Add integrity checks across timeline, report, compare, and published branch restore.
*   [ ] **Temporal Memory System:** Build the underlying memory system for replaying a site's full operational history.
*   [ ] **Node Versioning & Evidence Linkage:** Implement rich node versioning and first-class links between changes and causing evidence.

## 5. Reporting & Productization (P2)
*   [ ] **Audience Templates:** Add audience-mode templates (auditor, insurer, etc.) with field-level redaction and visibility policies.
*   [ ] **Standards/Citation Blocks:** Add standards/citation blocks with traceable evidence links.
*   [ ] **Deployment Matrices:** Define deployment matrices (local-only, self-hosted, cloud-assisted).
*   [ ] **Env Configs & Checklists:** Provide reproducible environment configurations and release checklists.
*   [ ] **Update README Instructions:** Update `apps/studio/README.md` to reflect `pnpm` and `bun` commands.
*   [ ] **Create Deployment Manifest:** Add `vercel.json` and a production-ready `Dockerfile` + `docker-compose.yml`.
*   [ ] **Wire Submission URL:** Finalize the deployment target and configure the submission URL.
*   [ ] **Report Catalog Persistence:** Build a persisted catalog for reports with audience defaults and presets.
*   [ ] **Section-to-Simulation Drill-through:** Add deep links from report sections back into live simulation results.
*   [ ] **Floor-Plan Import Bridge (Tier 2):** 
    *   [ ] **D-021: Text-to-scene scope:** Define the final V0.2 scope for prompt-to-scene fidelity.
    *   [ ] **Integrate Tier 2 Cloud Pass:** Implement the GPT-4o/Gemini 2.5 pass for precise geometry extraction from floor plans.
    *   [ ] **Model Experimentation (Future):** Explore GGUF Qwen3.5-4B, SAM3, and PaddleOCR integration.
    *   [ ] **Fine-tuning:** Fine-tune local models on CubiCasa5K for room classification.
*   [ ] **Release Automation:** 
    *   Establish SemVer scheme and `CHANGELOG.md`.
    *   Create GitHub Release workflow (tag -> build -> notes).
*   [ ] **Environment Hardening:** 
    *   Implement `.env.example` and startup validation.
    *   Configure production CSP headers and subpath asset prefixing in `next.config.js`.
    *   Implement health check endpoint (`/api/health`).


## 6. Trust & Quality (P2)
*   [ ] **Truth-Label Audit:** Add truth-label audit checks for major UI surfaces.
*   [ ] **Metric Metadata:** Ensure all derived metrics display source and confidence metadata.
*   [ ] **Audit Related Components:** Scan other UI components for hook anti-patterns.
*   [ ] **Verify Issues Tab Fix Actions:** Confirm that "Apply Fix" / "Test Fix" buttons are fully functional for all issue types.
*   [ ] **Truth Badge Rollout:** Complete `TruthBadge` rollout across all remaining bottom panel data cards.
*   [ ] **CI Trust Audit:** Implement a test harness that runs `auditTrustSurfaces` in CI.
*   [ ] **Harden Tool Interaction:** Perform a tool-by-tool audit (wall, door, window, measure, comment) for placement, properties, and undo/redo.
*   [ ] **Calibrate Simulation Assumptions:** Audit and document lighting penalty constants (e.g., `0.12`, `0.32`) in `coverage.ts`.


## 7. Novel Algorithms & Analysis (P2/P3)
*   [ ] **Novel Algorithm 1: Coverage Fragility Field:** Implement fragility field calculation and heatmap visualization.
*   [ ] **Novel Algorithm 3: Adversarial K-Robustness:** Implement k-robustness analysis (SPOF detection for paths).
*   [ ] **Novel Algorithm 4: Camera Placement Oracle:** Implement the suggestion engine for optimal next camera placement.
*   [ ] **Novel Algorithm 5: Temporal Security Profile Anomaly Detection:** Implement anomaly detection within the 24h temporal profile.

## 8. Platform Infrastructure & Refinement (P1/P2/P3)
*   [ ] **First-Run Guidance (P1):** Implement a guided onboarding tour or step-by-step first-run walkthrough from launcher to simulation.
*   [ ] **Panel Clean-up (P1):** Remove remaining static/stubbed placeholders in Metrics, Issues, and Timeline panels.
*   [ ] **Visual Diff Parity (P1):** Achieve full visual diff parity across all scenarios in Compare Mode.
*   [ ] **AI Layout Draft Upgrade (P1):** Upgrade the AI layout draft into a robust SecurityScene generation workflow with higher spatial intent fidelity.
*   [ ] **Product-Grade Verification (P1):** Move footage verification from "operator assist" to a product-grade workflow against simulated outcomes.
*   [ ] **Project Backend (P2):** Implement a product-grade multi-project backend collaboration layer (replacing local-only storage).
*   [ ] **Multi-Site Dashboard (P2):** Expand the dashboard to support multi-site/multi-client management.
*   [ ] **Clean Stale Strings (P2):** Remove demo-specific hardcoded strings ("small retail shop", "cupboard") from core schemas and default names.
*   [ ] **ONVIF/RTSP Full Integration (P2):** Complete the integration of live ONVIF/RTSP camera feeds.
*   [ ] **Studio Dashboard Home (P1):** (In Progress) Refine the full-screen `StudioDashboardHome` including:
    *   Large scene preview (heatmap, cones, zones).
    *   Right Security Status panel (Outcome, Issues, Assumptions).
    *   6 Metric cards using real simulation data.
    *   Hero action cards for Coverage, Wall, Replay, and Compare.
    *   Recent Workspaces and Quick Start docks.
*   [ ] **Camera View HUD Polish (P1):** Add CCTV-style HUD overlays (Timestamp, DORI card, distance, angle, lighting) and visual filters.
*   [ ] **Path Replay Interactive Controls (P1):** Implement play/pause, speed presets, and quality-over-time scrub timeline.
*   [ ] **Compare Mode Side-by-Side (P1):** Refine side-by-side canvases with metric comparison cards and change lists.
*   [ ] **MiniMap & PathMap States (P1):** Align MiniMap (Collapsed/Compact/Expanded) and PathMap (Summary/Replay) states with the design pack.
*   [ ] **Token Canonicalization (P1):** Ensure identical visual language across all map, canvas, and report layers.
*   [ ] **Unified Runtime Diagnostics (P2):** Create a unified diagnostics surface with journey health indicators.
*   [ ] **Observability Backbone (P2):** Build a system for distributed trace and log correlation.
*   [ ] **Crash-Reproduction Flow (P2):** Pair support artifacts with exact failing runtime paths.
*   [ ] **Structural Imports (IFC/BIM) (P3):** Add support for professional architectural source imports.
*   [ ] **Durable Event Stream Continuity (P3):** Implement authenticated event-stream management (ONVIF WS-Notification).
*   [ ] **Broad ONVIF Profile M Ingest (P3):** Implement broader analytics metadata ingestion.

## 9. Residual Risks & Polish (P1/P2/P3)
*   [ ] **Re-run Goal4 Tests (P1):** Re-run goal4-focused test suites after P0 stabilization.
*   [ ] **Re-verify Mode Contract (P1):** Re-verify root route contract and mode labels/copy contract.
*   [ ] **Update Launcher Tests (P1):** Replace tests for the old "form" launcher with new dashboard component tests.
*   [ ] **Cross-Device Sync (P2):** Implement cross-device synchronization for the launcher/project browser.
*   [ ] **Multi-User Collaboration (P2):** Implement shared project metadata and multi-user collaboration.
*   [ ] **Debug Tab Polish (P3):** Incremental polish of debug toggles and stats.



---
*Note: The product specification features (e.g., Camera Feed/Wall, Redundancy Matrix, Path Replay, Command Bar, DORI logic) and the `bun test` suite are currently passing and implemented.*