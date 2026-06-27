# D-020: Security Evidence Twin Framing

**Status:** Resolved
**Date:** 2026-07-04

## Decision

The product uses **"Evidence Twin"** as the canonical framing for the temporal/replay surface. "Simulated Twin" is a subset — the simulation engine produces one type of evidence (computed coverage), but the Evidence Twin encompasses all operational evidence: sensor events, camera metadata, live connection records, published checkpoints, and simulation results.

## Rationale

1. **Evidence Twin is the superset.** Every simulation run produces evidence. Every sensor trigger produces evidence. Every camera metadata change produces evidence. The Evidence Twin is the unified timeline of all evidence types.
2. **Simulated Twin is a subset.** It refers specifically to the simulation engine's output (coverage heatmaps, DORI quality, path visibility). This is one evidence source among many.
3. **Buyer language.** Security buyers understand "evidence" (incident replay, audit trail, compliance proof). "Simulated Twin" is internal engineering language.
4. **Report framing.** Audit reports reference "Operational Evidence" as a section. The temporal twin summary is called `OperationalEvidenceTemporalTwinSummary` in code.

## Implications

- All UI surfaces should use "Evidence" language, not "Simulation" language, for the timeline/replay surface.
- The simulation engine output is labeled "Simulated" via `TruthBadge` — this is correct (it's a truth label, not a product name).
- The `TemporalProfileView` and `SceneIntelligenceTab` are Evidence Twin surfaces.
- No code changes needed — the framing is already consistent.
