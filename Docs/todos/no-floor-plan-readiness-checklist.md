# No-Floor-Plan Readiness Checklist (Dimension A)

Date: 2026-06-01

This checklist turns the Dimension-A thread into an operational contract for draft intake readiness.
It is explicitly aligned to the `scan` pipeline and the canonical `SiteTwinDraftReadiness` model.

## Readiness contract (canonical)

Every draft now carries:
- `readiness.level` in
  - `deploy-ready` (can run baseline simulation and recommendations can be published),
  - `review-required` (simulation can run but recommendations remain advisory),
  - `insufficient` (missing prerequisites or blockers).
- `readiness.canSimulate` and `readiness.canRecommend` booleans.
- Split warning classes: blocking vs advisory + summary text.

## Stage-A gate checklist

### A1 Intake bootstrap
- [x] Draft session creation writes structured readiness from compiler warnings.
- [x] Source artifacts and provenance notes are preserved in draft context.
- [x] Scan scene and AI/floor-plan/manual/JSON flows expose a unified draft contract.

### A2 Geometry confidence model
- [x] Session/compile pipeline emits canonical confidence-graded warnings.
- [x] Readiness policy is no longer only advisory comments in UI; it is emitted from compiler output.
- [x] Readiness is carried from `scan` compile into draft creation and UI (review/approve path).

### A3 Scenario arbitration
- [x] Explicit approval remains allowed for advisory mode (`review-required`) while still blocking on hard prerequisites.
- [x] UI exposes readiness status and recommendation mode at review time.
- [x] Role-aware policy matrix (consultant vs facilities director) is implemented.
- [x] Scenario-level escalation for temporary emergency/perimeter workflows is implemented with advisory-warning signaling and governance escalation hints.

### A4 Simulation-first output
- [x] Baseline simulation remains gated by readiness (`canSimulate`).
- [x] Review-required drafts still allow simulation and capture of deterministic findings.
- [x] Public-facing recommendation severity language has a v1 framing pass.

### A5 Temporary operations mode
- [x] Scan intake now persists explicit operational mode (`permanent` / `temporary_event`) plus context into `SecurityScene.assumptions` and provenance notes.

### A6 Temporary/permanent split
- [x] Scene-level split now encodes operational mode/context via durable scenario envelope with explicit teardown workflow and mandatory rollback checks.

### A7 Evidence export and decision hardening
- [x] Approval/evidence trail now logs readiness signal with confidence class and source.
- [x] Role-specific output language split now includes consultant, facilities director, and operations manager report targeting.
- [x] Public/commercial legal wording finalized with role-specific distribution boundaries and legal-boundary copy in report exports.

### A8 Scale path hardening
- [x] No-floor scale now uses adaptive simulation envelope; sampling is area-aware and no longer fixed at 4 cells/m.

### A9 Decision lock
- [x] Scope locked for no-floor-plan Dimension A stage matrix through temporary-event scenario envelope and operational teardown contract.

## Policy rulebook for this thread

1. Never present hard recommendations when `readiness.level === "insufficient"`.
2. Present deterministic simulation findings for `review-required` but label as advisory.
3. Keep `deploy-ready` as the only state where recommendation output can be auto-marked as production-safe.
4. Tie every future A-stage task back to this checklist before release notes.
