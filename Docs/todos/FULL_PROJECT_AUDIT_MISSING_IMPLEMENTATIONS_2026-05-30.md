# SentinelTwin Full Project Audit — Missing Implementations

**Date:** 2026-05-30  
**Scope:** Repository-wide implementation gaps and blockers, prioritized for execution  
**Method:** Current code/docs inspection + live type/build evidence (`npx tsc --noEmit` in `apps/studio`)

## Implementation Update — 2026-05-30
- ✅ `#1 Live Camera Contract Convergence`: type/build contract now stabilized (`tsc` and `build` pass) and event-subscription fields are propagated through route/session paths.
- ✅ `#2 Build Stability`: added executable gate script + CI workflow:
  - `tools/studio-quality-gate.sh`
  - `.github/workflows/studio-quality-gate.yml`
- ✅ `#3 Shared Governance Persistence` (foundational backend layer): added new persisted control-plane route + history:
  - `src/app/api/workspace-control-plane/route.ts`
  - `src/lib/workspace-control-plane-history.ts`
- ✅ `#5 Live Fusion Maturity` (foundational lifecycle layer): added session health/renewal API:
  - `src/app/api/camera-live-session-health/route.ts`
- ✅ `#7 Deployment Productization` (implementation baseline): added deployment profiles + validator:
  - `apps/studio/deploy/profiles/*.json`
  - `apps/studio/scripts/validate-deploy-profile.mjs`
- ✅ `#8 Trust Hardening`: extended trust-audit manifest to include report visibility policy and control-plane route checks.

## Severity Legend
- `P0` Critical blocker: blocks build, release, or core runtime contract
- `P1` High: core product capability gap or high user-risk behavior
- `P2` Medium: important but non-blocking capability gap
- `P3` Low: polish/operational hardening

## 1) Live Camera Contract Convergence
- Severity: `P0`
- Subsystem: `apps/studio/src/lib/camera-live-connection.ts`, `apps/studio/src/app/api/camera-live-connection/route.ts`, session/archive models
- Evidence:
  - `npx tsc --noEmit` fails on missing `eventSubscriptionUri`, `eventSubscriptionReference`, `eventSubscriptionExpiresAt` in live-connection record contract.
  - Record contract drift between probe response payload and session/archive persistence.
- Missing implementation:
  - Single canonical record schema across probe response, archive history, session registry, and API route heartbeat path.
  - Full propagation of event-subscription fields through every action (`bind`, `refresh`, `heartbeat`, `disconnect`) and every persistence path.
- Owner-ready tasks:
  1. Define one canonical `CameraLiveConnectionRecord` type in `lib/camera-live-connection.ts` and reuse it by import in route, registry, and history modules.
  2. Remove duplicated inline record-shape literals and replace with typed constructors.
  3. Ensure `route.ts` heartbeat path includes all required fields (ONVIF + event-subscription) before archiving.
  4. Add regression tests per action path asserting full record field presence.
- Acceptance criteria:
  - `cd apps/studio && npx tsc --noEmit` passes.
  - `cd apps/studio && npm run build` passes without contract/type errors.
  - Route tests for camera-live-connection pass and verify all required record fields.

## 2) Build Stability Under Parallel Edits
- Severity: `P0`
- Subsystem: cross-cutting (recent duplicates/syntax conflicts)
- Evidence:
  - Multiple merge-drift issues were found and fixed in-session (`duplicate function declarations`, malformed JSX, duplicate object keys).
- Missing implementation:
  - A guardrail process that catches parallel-drift syntactic/type conflicts early.
- Owner-ready tasks:
  1. Add a CI/pre-merge gate requiring `npx tsc --noEmit` and `npm run build` in `apps/studio`.
  2. Add a lightweight local script to run contract checks before branch handoff.
- Acceptance criteria:
  - No duplicate-declaration or parse errors in default branch.
  - All parallel merges pass type/build gates before landing.

## 3) Shared Workspace Governance (Multi-Operator Persistence)
- Severity: `P1`
- Subsystem: workspace access/governance/identity conflict
- Evidence:
  - Current docs mark collaboration as mostly local and backend-safe shared membership as pending.
- Missing implementation:
  - Persistent, multi-operator source of truth for membership, approvals, and branch lifecycle.
- Owner-ready tasks:
  1. Define backend contract for workspace members/roles/policies and approval transitions.
  2. Replace local-only archive-first state transitions with server-backed persistence + reconciliation.
  3. Add conflict replay parity tests for server state vs local archive state.
- Acceptance criteria:
  - Membership/approval changes survive across users/sessions/devices.
  - Identity conflict replay produces deterministic results against server-backed snapshots.

## 4) Temporal Operational Twin Completion (Beyond Current Summary Surfaces)
- Severity: `P1`
- Subsystem: operational evidence timeline + temporal reasoning
- Evidence:
  - Temporal tooling is strong, but docs still identify deeper operational continuity work and evidence-grade replay expansion.
- Missing implementation:
  - End-to-end operational replay tied to external/live evidence and publication lifecycle, not only internal scene/evidence events.
- Owner-ready tasks:
  1. Extend temporal checkpoints to include live camera/session and sensor ingest provenance continuity.
  2. Add cross-surface replay integrity checks (timeline, report, compare, published branch restore).
- Acceptance criteria:
  - A given checkpoint replay produces consistent state across timeline/report/compare/publish surfaces.
  - Replay includes live-evidence context where available.

## 5) Live Sensor + Camera Fusion Maturity
- Severity: `P1`
- Subsystem: sensor ingest, camera metadata ingest, ONVIF/session lifecycle
- Evidence:
  - Core ingestion is present; docs note remaining seam in subscription renewal/event streaming/session continuity.
- Missing implementation:
  - Durable event subscription lifecycle and long-running session management.
- Owner-ready tasks:
  1. Implement subscription renewal scheduler and expiry handling.
  2. Add event-stream continuity model and backoff/reconnect strategy.
  3. Surface subscription/session health in inspector/debug/report.
- Acceptance criteria:
  - Live session remains healthy across renewal windows.
  - Expired subscriptions are recovered automatically or explicitly flagged with actionable remediation.

## 6) Compliance-Grade Reporting Modes
- Severity: `P2`
- Subsystem: report generation/export
- Evidence:
  - Reports exist and are provenance-aware; docs mark stronger compliance/audience modes as pending.
- Missing implementation:
  - Explicit templates/modes for operator, auditor, insurer, installer, privacy reviewer.
- Owner-ready tasks:
  1. Add audience-mode templates and field-level redaction/visibility policies.
  2. Add standards/citation blocks with traceable evidence links.
- Acceptance criteria:
  - Reports render correctly per audience mode.
  - Privacy and compliance constraints are enforced in each mode.

## 7) Deployment/Packaging Productization
- Severity: `P2`
- Subsystem: deploy/runtime packaging
- Evidence:
  - Local-first core works; full packaging for self-hosted/cloud/vertical bundles remains open per docs.
- Missing implementation:
  - Production deployment profiles and environment hardening.
- Owner-ready tasks:
  1. Define deployment matrices (local-only, self-hosted, cloud-assisted).
  2. Provide reproducible environment configs and release checklists.
- Acceptance criteria:
  - Each deployment profile has a tested bootstrap path and documented operational SLO checks.

## 8) Trust-Hardening Completion
- Severity: `P2`
- Subsystem: UI claims, placeholders, provenance fidelity
- Evidence:
  - Substantial progress exists; docs still identify remaining trust-hardening work.
- Missing implementation:
  - Full elimination of claim-source ambiguity and placeholder drift.
- Owner-ready tasks:
  1. Add truth-label audit checks for major UI surfaces.
  2. Ensure all derived metrics display source/confidence metadata.
- Acceptance criteria:
  - No user-facing claim appears without traceable source category.
  - Placeholder states are explicit and non-deceptive.

## 9) Goal4-Specific Residual Closure Risks (Contextual)
- Severity: `P1`
- Subsystem: root/dashboard/mode contract
- Evidence:
  - Goal4 implementation is largely present; parallel edits introduced unrelated build churn that can mask true goal4 regressions.
- Missing implementation:
  - Stable, repeatable proof run for goal4 acceptance surfaces after build/type stabilization.
- Owner-ready tasks:
  1. Re-run goal4-focused test suites after P0 live-contract stabilization.
  2. Re-verify root route contract (`/`, `/studio`) and mode labels/copy contract.
- Acceptance criteria:
  - Goal4-focused tests pass.
  - Root and mode contract remains aligned with `goal4.md` without regression.

## Execution Order (Recommended)
1. P0-1: Live camera contract convergence (`tsc/build` unblock).
2. P0-2: Build stability guardrails (`tsc/build` enforced pre-merge).
3. P1: Shared governance persistence + live fusion lifecycle continuity.
4. P1/P2: Temporal continuity + compliance-grade reporting modes.
5. P2: Deployment packaging + trust-hardening completion.
6. P1 contextual: re-run and close goal4 acceptance after P0 stabilization.

## Immediate Next Commands
```bash
cd apps/studio && npx tsc --noEmit
cd apps/studio && npm run build
cd apps/studio && bun test
```
