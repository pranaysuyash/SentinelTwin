# Phase 4 — Adversarial Path Simulation

**Status:** Not started
**Blocking:** Phase 1 (coverage engine) must be complete. Phase 2 recommended.
**Agent:** Claude Code (or any agent)
**Read first:** Docs/architecture/04_ADVERSARIAL_PATH_SIMULATION.md

---

## Goal

Build the adversarial path simulation: find the path from entry to target that minimizes
detection exposure. Visualize it in 3D. Wire it to the coverage loop so fixing coverage
changes the adversarial path.

---

## Task 4.1 — Nav Graph Builder

In `packages/simulation/src/adversarial/buildNavGraph.ts`:

```typescript
function buildNavGraph(
  scene: SecurityScene,
  coverageResult: SimulationResult,
  config: AdversarialConfig,
): NavGraph
```

Creates a grid of `NavNode` objects (same resolution as coverage grid).
Marks nodes as inaccessible if inside walls or solid obstructions.
Assigns `detectionProbability` to each accessible node from `coverageResult`.
Builds edges between adjacent accessible nodes (8-directional: N/S/E/W + diagonals).

**Tests:**
- Node inside wall: inaccessible
- Node outside walls but behind camera: high detection probability
- Node in camera blindspot: low detection probability

---

## Task 4.2 — Dijkstra Minimum-Exposure Pathfinder

In `packages/simulation/src/adversarial/findMinExposurePath.ts`:

```typescript
function findMinExposurePath(
  graph: NavGraph,
  entryNodeId: string,
  targetNodeId: string,
  config: AdversarialConfig,
): AdversarialPath | null
```

Standard Dijkstra with exposure cost as edge weight.
Edge cost = `targetNode.detectionProbability × movementCost + distanceCost × speedWeight`.

Priority queue: use a min-heap. Do not use array.sort() — O(n log n) is too slow for 6400 nodes.

**Performance target:** < 10ms for 80×80 nav graph (6,400 nodes, 8 edges each).

**Tests:**
- Path in open room: finds shortest path avoiding high-detection areas
- Path blocked by wall: routes around wall
- No path exists (room fully covered): returns null with reason
- Multiple entry points: find worst case (lowest exposure)

---

## Task 4.3 — Build AdversarialPath Result

In `packages/simulation/src/adversarial/adversarialResult.ts`:

From Dijkstra result, build:
- `waypoints`: full list with timestamps, quality at each point, cover used
- `totalExposureScore`: aggregate
- `detectionQualityExposure`: seconds at each quality level
- `blindspotsExploited`: which obstruction IDs provided cover
- `criticalZonesReached`: which protected zones were breached
- `targetReached`: boolean

**Done when:** Given demo scene, returns a plausible route + summary metrics.

---

## Task 4.4 — Wire Adversarial into SimulationResult

Extend `computeCoverage()` to optionally compute adversarial path:

```typescript
function computeCoverage(
  scene: SecurityScene,
  options?: CoverageOptions & { includeAdversarial?: boolean; adversarialConfig?: AdversarialConfig },
): SimulationResult
```

When `includeAdversarial: true`, runs nav graph + Dijkstra and populates
`simulation.adversarialPath`.

Note: adversarial is expensive. Do NOT include it in the default recompute loop.
Only compute when user explicitly clicks "Run Threat Analysis."

---

## Task 4.5 — Adversarial Path Visualization

In `packages/viewer/src/overlays/AdversarialPathViz.tsx`:

Renders the adversarial path as a glowing line over the floor:
- Detection quality segment: RED glow
- Observation quality: ORANGE
- Detection quality: YELLOW
- Below detection: GREEN (effectively invisible)

Add `THREE.Line` with the path waypoints as vertices.
Use `LineMaterial` from three/addons for glow effect.

Optionally: animated marker moving along the path to show the actor moving.

**Done when:** After "Run Threat Analysis", a colored path appears on the floor showing the adversarial route.

---

## Task 4.6 — Threat Analysis Panel

In `apps/editor/src/panels/ThreatAnalysisPanel.tsx`:

[Run Threat Analysis] button.
Shows loading (path computation may take a moment on complex scenes).
Shows result:
```
Adversarial Analysis
━━━━━━━━━━━━━━━━━━━━
Entry: Front Door → Target: Cash Counter

Route found (0.3s)
Total exposure: HIGH RISK (score: 8.2)

Timeline:
0:00  Enter front door — Detection only
0:04  Behind Shelf 1 — Undetected
0:09  Cross to counter — Observation (Camera 2)
0:14  Reach Cash Counter Zone ✓

Cover used: Shelf 1, Cupboard
Cameras evaded: Camera 1 (blocked by Shelf 1)

→ Fix: Rotate Camera 1 left 20° to cover Shelf 1 gap
   (Verified: new exposure score 2.1 — LOW RISK)
```

When user makes changes, [Re-run] button appears.

---

## Phase 4 Done Criteria

- [ ] 4.1: Nav graph builder, accessibility and detection probability correct
- [ ] 4.2: Dijkstra < 10ms, path avoids high-detection areas
- [ ] 4.3: AdversarialPath result has full timeline and metrics
- [ ] 4.4: Adversarial integrated into computeCoverage with opt-in flag
- [ ] 4.5: Path visualized as colored glow line in 3D scene
- [ ] 4.6: Threat analysis panel with full output and "Fix" suggestion

**Next phase:** `Docs/todos/PHASE_5_PATH_REPLAY_DEMO.md`
