# Full Vision Workstream Map

**Date:** 2026-05-30
**Purpose:** Align SentinelTwin work to the whole product vision, not just the camera studio slice. This map lists the repo's explicit not-started/stubbed platform workstreams and the parallel threads spawned to work them.

## Explicit Not-Started Phase Docs

- Phase 1: Coverage Engine
- Phase 12: Deployment & Packaging
- Phase 13: Persistent Identity & Governance
- Phase 14: AI Agent Pipeline
- Phase 16: Cross-Device Sync
- Phase 17: SDK & Extensibility
- Phase 18: Platform Polish

## Current Parallel Threads

- Coverage engine and simulation core
  - Agent: completed and closed
  - Scope: coverage-engine phase 1 gap closed; follow-up is docs alignment only.

- Deployment and packaging
  - Agent: completed and closed
  - Scope: deployment profiles, build/package validation, release tooling.

- Persistent identity and governance
  - Agent: completed and closed
  - Scope: identity model, RBAC/ABAC, approval routing, governance persistence.

- AI agent pipeline
  - Agent: completed and closed
  - Scope: provider abstraction, orchestration, structured outputs, tool calling.

- Cross-device sync
  - Agent: completed and closed
  - Scope: sync primitives, conflict resolution, offline queueing, storage providers.

- SDK and extensibility
  - Agent: completed and closed
  - Scope: public API surface, package exports, docs, and publishability.

- Platform polish
  - Agent: completed and closed
  - Scope: accessibility, performance, error recovery, loading states, hardening.

- Remaining stubbed-surface inventory
  - Agent: completed and closed
  - Scope: deduplicated list of remaining non-phase stubbed surfaces and ownership boundaries. Follow-on work moved into the broader implementation lanes below.

- Report and handoff
  - Agent: completed and closed
  - Scope: report/compliance evidence handoff, exports, and buyer-facing summaries. Follow-on task: report drill-through, redaction, and template depth.

- Report drill-through follow-on
  - Agent: `019e7947-f0a0-75c2-9715-2ed86359683b`
  - Scope: buyer-facing drill-through, redaction/visibility, and report template depth.

- Sensors and live evidence
  - Agent: `019e790f-ed73-7580-be17-9c7f5dd13d6a`
  - Scope: live sensor / camera metadata evidence flow and archive history.

- Intake and scene compilation
  - Agent: completed and closed
  - Scope: guided scan, text-to-scene maturation, and floor-plan / compiler flows. Follow-on task: production floor-plan parsing and stronger guided-scan evidence capture.

- Intake / floor-plan follow-on
  - Agent: completed and closed
  - Scope: stronger floor-plan parsing, guided-scan evidence capture, and compiler maturation.

- Evidence memory and recovery
  - Agent: completed and closed
  - Scope: temporal evidence, branch/time navigation, archive restore, and recovery replay. Follow-on task: archive restore cursor preservation and branch/time round-trip fidelity.

- Governance and collaboration follow-through
  - Agent: `019e7947-de70-75e2-bcdc-461dca33b942`
  - Scope: backend-owned identity, durable approval routing, cross-operator replay, and shared-workspace semantics.

- Observability and runtime truth
  - Agent: `019e7947-d0b3-7701-a635-749189e214e9`
  - Scope: runtime health, surface truth audits, launch-path verification, and cross-surface claim consistency.

- Archive cursor fidelity follow-up
  - Agent: queued
  - Scope: branch/time round-trip fidelity, restore cursor preservation, and archive handoff completeness.

- Report catalog and standards templates
  - Agent: queued
  - Scope: persisted presets, audience-specific template depth, and standards-aware export presets.

## Notes

- The launcher file is intentionally excluded from these threads because it is actively owned elsewhere.
- The workstreams above are disjoint by design and should stay additive.
- As results return, update this map with the changed files and any new sub-workstreams that emerge.
