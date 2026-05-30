# SentinelTwin Full-Vision Product Frame (2026-05-30)

## Evaluation Rule (No Checkpoint Framing)
SentinelTwin must be evaluated against the full product vision, not milestone shorthand.

For every subsystem, classify as:
1. Full-vision requirement
2. Real in code now
3. Partially real / prototype
4. Scaffold / placeholder
5. Missing
6. Next build required

## Vision Anchor
SentinelTwin is a security intelligence and digital-twin platform for physical sites:
- create/import a site,
- model cameras/lights/doors/windows/obstructions/zones/paths/sensors,
- simulate security outcomes deterministically,
- verify assumptions against evidence,
- test counterfactual fixes,
- preserve operational history,
- generate accountable stakeholder reports.

## Current System Truth
- Strongest real subsystem: deterministic simulation + studio editing.
- Product shell is real: dashboard, intake hub, studio modes, compare/report paths.
- Intake automation depth is still uneven: scan/floor-plan/AI/footage are mostly assistive, not production-grade intelligence.
- Collaboration/governance/deployment are mostly local scaffolds without complete backend productization.

## Full-Vision Gap Buckets
### Real
- Canonical SecurityScene schema/store pipeline
- Coverage/path/failure simulation stack
- Studio shell and mode routing
- Report-lite and compare export surfaces

### Partial
- Site intake pipeline cohesion
- Floor-plan extraction quality
- AI draft scene generation quality
- Temporal operational twin completeness
- Sensor/camera fusion depth

### Scaffold / Placeholder
- Footage verification beyond static/reference alignment
- Multi-user governance enforcement without backend identity/org layer
- Live ONVIF/RTSP ingestion lifecycle hardening

### Missing
- Production-grade scan reconstruction pipeline
- Backend org/project/site persistence and collaboration
- Evidence chain-of-custody semantics and immutable audit rails
- Role-specific client-grade report modes and compliance packages
- Deployment/packaging for installer/operator/auditor workflows

## Implementation Priorities (Owner-Ready)
1. Canonical intake pipeline consolidation
- Acceptance: one creation flow orchestrates scan/floor-plan/AI/manual/import; no parallel UX islands with divergent semantics.

2. Truthful capability labeling enforcement
- Acceptance: every preview path is consistently tagged in UI + logs + reports; no overclaim strings.

3. Manual vs guided scan mode separation
- Acceptance: manual CTA opens `mode=manual`; guided CTA opens `mode=guided`; telemetry/evidence labels match.

4. Footage verification phase boundary
- Acceptance: static alignment path isolated as assistive verification; no product-grade claims until video/stream validation stack exists.

5. Evidence-to-report traceability hardening
- Acceptance: report findings include stable references to evidence/provenance events and simulation assumptions used.

6. Deployability baseline
- Acceptance: clean install, typecheck, build, and production startup are deterministic in CI/local.

## Immediate Next Sprint Focus
- Finish build stabilization (`StudioDashboardHome.tsx` syntax integrity + green typecheck/build).
- Complete intake truthfulness pass (copy + mode wiring + event semantics).
- Ship one canonical “Create Site Twin → Compile → Review → Simulate → Compare → Report” guided path.
