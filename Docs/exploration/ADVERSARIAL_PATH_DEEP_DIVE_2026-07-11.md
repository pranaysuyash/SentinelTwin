# Adversarial Path Simulation — Deep Dive

**Thread:** 156  
**Date:** 2026-07-11  
**Status:** Documentation complete  

---

## 1. System Overview

The adversarial path simulation finds the **lowest-exposure route** from an entry point to a critical zone through walkable space. It models how an intruder would navigate a scene while minimizing detection probability, revealing coverage gaps that a purely geometric analysis would miss.

**Core algorithm:** A* search with exposure-weighted costs  
**Key equation:** `cost = stepDistance + EXPOSURE_MULTIPLIER × stepDistance × detectionProbability`  
**EXPOSURE_MULTIPLIER:** 4 (empirically calibrated from small-retail scenes)

---

## 2. Core Algorithm (`adversarial-path.ts`)

### 2.1 A* Search with Exposure Cost

The algorithm uses A* pathfinding where cell traversal cost combines **physical distance** with **detection probability**:

```
candidateCost = currentCost + stepDistance + EXPOSURE_MULTIPLIER × stepDistance × exposure
```

| Component | Description |
|-----------|-------------|
| `stepDistance` | Euclidean distance between adjacent grid cells |
| `exposure` | Detection probability at the destination cell (0–1) |
| `EXPOSURE_MULTIPLIER` | 4× weight — penalizes exposure heavily |

**Effect:** The algorithm prefers longer but stealthier routes through low-coverage areas over shorter paths through high-coverage zones.

### 2.2 Heuristic Function

Uses **octile distance** (admissible on 8-directional grids):
```
octileDistance = min(dx, dz) × √2 + |dx - dz|
```

This biases search toward the goal rather than exploring uniformly.

### 2.3 Navigation Grid

Built from the coverage grid (`buildCoverageGrid` at 4 cells/meter):

| Property | Value |
|----------|-------|
| Cell size | 0.25m (4 cells/meter) |
| Directions | 8 (cardinal + diagonal) |
| Walkability | Excludes solid obstructions |
| Node lookup | O(1) via `Map<string, NavNode>` |

### 2.4 Entry Point Selection

Multiple entry sources are considered:
1. **Explicit entry points** (`scene.entryPoints`)
2. **Open gates** (state = "open" or "closed" without access control)
3. **Fallback** — center of scene's far edge

The entry closest to the target zone is selected to minimize path computation.

### 2.5 Target Zone Selection

Uses `selectAdversarialTargetZone()` with options for:
- Default: highest-priority zone
- Custom selection via `CriticalZoneSelectionOptions`

---

## 3. Cost Model Details

### 3.1 Detection Probability

Each cell's detection probability is derived from its coverage quality:

| Quality Level | Detection Probability |
|---------------|----------------------|
| `none` | 0.0 |
| `detection` | ~0.2 |
| `observation` | ~0.4 |
| `recognition` | ~0.7 |
| `identification` | ~0.95 |

Higher quality = higher detection probability = higher traversal cost.

### 3.2 Exposure Multiplier Calibration

`EXPOSURE_MULTIPLIER = 4` was calibrated from:
- Small retail scenes (6–8m rooms)
- 3–4 cameras per scene
- Balance between distance minimization and exposure avoidance

**Tuning guidance:**
- Higher values → favor longer, stealthier routes
- Lower values → favor shorter paths through visible areas
- Adjust per deployment if scene scale differs significantly

### 3.3 Walkability Constraints

Cells are non-walkable when:
- Occupied by solid obstructions (material ≠ "glass", "grill", "partial")
- Outside scene boundaries
- Inside obstruction bounding boxes (rotated)

---

## 4. Output Structure

### 4.1 AdversarialPathResult

```typescript
{
  waypoints: AdversarialWaypoint[];      // Ordered path points
  totalExposureScore: number;            // Cumulative cost (lower = stealthier)
  totalDurationS: number;                // Estimated time (incl. breach penalties)
  detectionQualityExposure: Record<...>; // Distance per quality tier
  maxDetectionProbability: number;       // Worst detection risk along route
  coverageGapsUsed: string[];            // Obstructions the path passes through
  camerasWithoutCoverageOnRoute: string[];
  criticalZonesReachableAlongRoute: string[];
  criticalZoneReachable: boolean;
  accessControlBarriers: BarrierInfo[];  // Doors/gates with breach time
  failureReason?: string;                // If no path exists
}
```

### 4.2 Waypoint Properties

Each waypoint includes:
- `position: [x, z]` — 2D coordinates
- `timeS: number` — cumulative time
- `detectionQuality: DORI` — quality tier at this point
- `detectionProbability: number` — 0–1 detection risk
- `exposedToCamera: string` — first covering camera ID

---

## 5. Access Control Barriers

### 5.1 Barrier Detection

Doors and gates with access control within **1.5m** of any waypoint are flagged as barriers:

| Control Type | Default Breach Time |
|--------------|-------------------|
| `none` | 0s |
| `pin` | 5s |
| `card` | 15s |
| `biometric` | 30s |
| `guard_post` | 120s |

Custom `breachTimeS` overrides default if provided.

### 5.2 Breach Time Penalty

Total breach time is added to `totalDurationS`:
```
totalDurationS = waypoints.length × cellSize + Σ breachTimeS
```

---

## 6. Coverage Gap Detection

### 6.1 Obstruction Analysis

The path identifies obstructions it passes through:
- Solid obstructions (visionTransmission = 0) that overlap waypoints
- Rotated bounding box intersection test
- Labels collected for reporting

### 6.2 Camera Coverage Gaps

Cameras that never cover any waypoint along the route are flagged:
```
camerasWithoutCoverageOnRoute = cameras.filter(
  cam → !waypoints.some(wp → wp.exposedToCamera === cam.id)
)
```

### 6.3 Critical Zone Reachability

Zones where any waypoint falls inside their polygon:
```
criticalZonesReachableAlongRoute = zones.filter(
  zone → waypoints.some(wp → pointInPolygon(wp.position, zone.polygon))
)
```

---

## 7. Integration Points

### 7.1 Simulation Engine (`simulate-studio.ts`)

Called after geometric coverage:
```typescript
const adversarialPath = computeAdversarialPath(scene, coverageCells);
```

Result included in `SimulationResult.adversarialPath`.

### 7.2 Posture Score (`posture-score.ts`)

**Adversarial path resistance** contributes **25%** to the 0–850 posture score:

```typescript
function computeAdversarialPathResistance(sim) {
  const exposureFactor = clamp01(totalExposure);
  const detectionRate = detectedSteps / totalSteps;
  return clamp01(exposureFactor * 0.5 + detectionRate * 0.5);
}
```

Higher exposure score → higher resistance → better posture.

### 7.3 K-Robustness (`k-robustness.ts`)

Tests camera subsets by:
1. Disabling k cameras
2. Re-running adversarial path
3. Checking if `totalExposureScore < 3.0` (viable route threshold)

Returns minimum k where no viable adversarial route exists.

### 7.4 Temporal Simulation (`temporal.ts`)

Adversarial exposure is tracked per hourly snapshot:
- Guard patrol deterrence reduces exposure during active rounds
- Vulnerability windows flagged when `exposureScore > 5`
- Temporal anomaly detection catches sudden exposure spikes ≥2.5

### 7.5 Counterfactual Search (`counterfactual-search.ts`)

Plans track adversarial exposure delta:
```typescript
adversarialExposureDelta = result.adversarialPath.totalExposureScore 
                         - baseline.adversarialPath.totalExposureScore
```

### 7.6 Director's Cut (`directors-cut.ts`)

Builds a camera-switching sequence following the adversarial path:
- Picks best-framed camera at each waypoint
- Collapses adjacent same-camera waypoints into segments
- Tracks "no coverage" duration

---

## 8. UI Components

### 8.1 Threat Analysis Panel (`ThreatAnalysisPanel.tsx`)

Displays:
- **Route Exposure** score
- **Route Duration** (including breach time)
- **Cameras Missing Route** count
- **Waypoints** count
- **Strongest Detection** probability
- **Uncovered Sections** (coverage gaps)
- **Critical Zones Reachable** alert
- **Route Visibility Ribbon** — color-coded quality band

### 8.2 Path Replay View (`PathReplayView.tsx`)

Animated playback of the adversarial path:
- Actor moves along waypoints at configured speed
- Camera switches follow Director's Cut sequence
- Coverage failure path shown when no user path exists

### 8.3 Workspace Canvas (`WorkspaceCanvas.tsx`)

3D visualization:
- `CoverageSegmentPath` renders waypoint line
- Adversary shadow mode (ghosted path)
- Path sample point markers

### 8.4 Map Layers (`MapLayers.tsx`)

2D top-down view:
- Path segments between waypoints
- Waypoint dots with quality colors

---

## 9. Test Coverage

### 9.1 Test File: `adversarial-path.test.ts`

| Test | Coverage |
|------|----------|
| Returns path from entry to critical zone | ✓ |
| totalExposureScore > 0 | ✓ |
| totalDurationS > 0 | ✓ |
| maxDetectionProbability in [0, 1] | ✓ |
| Unreachable zone returns failure | ✓ |
| detectionQualityExposure has all quality levels | ✓ |
| coverageGapsUsed includes solid obstructions | ✓ |
| Returns undefined when no entries/zones | ✓ |
| Waypoints include position, time, quality, camera | ✓ |

---

## 10. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **A\* over Dijkstra** | Heuristic-guided search is faster for goal-directed pathfinding |
| **EXPOSURE_MULTIPLIER = 4** | Empirically balanced for retail scenes |
| **Octile heuristic** | Admissible on 8-directional grid, never overestimates |
| **1.5m barrier snap radius** | Doors/gates near path are "on the route" |
| **VIABLE_EXPOSURE_THRESHOLD = 3.0** | Below this, a route is considered practical |
| **4 cells/meter grid** | Balance between resolution and performance |
| **MinHeap for priority queue** | O(log n) insert/extract for A* open set |

---

## 11. Performance Characteristics

| Metric | Value |
|--------|-------|
| Grid resolution | 4 cells/meter (0.25m cells) |
| Time complexity | O(V log V) — A* with binary heap |
| Space complexity | O(V) — node map + distance map |
| Typical runtime | <50ms for 6×6m room |
| Worst case | Large scenes with many cells |

---

## 12. File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `packages/simulation/src/adversarial-path.ts` | 420 | Core A* algorithm |
| `packages/simulation/src/__tests__/adversarial-path.test.ts` | 220 | Unit tests (9 cases) |
| `packages/simulation/src/posture-score.ts` | 170 | Adversarial resistance factor |
| `packages/simulation/src/k-robustness.ts` | 65 | Camera subset testing |
| `packages/core/src/schema/security-scene.ts` | 1700+ | Schema definitions |
| `apps/studio/src/components/bottom-panel/ThreatAnalysisPanel.tsx` | 180 | Threat analysis UI |
| `apps/studio/src/components/view/PathReplayView.tsx` | 1050+ | Path replay animation |
| `apps/studio/src/lib/directors-cut.ts` | 130 | Camera switching sequence |
| `apps/studio/src/store/slices/core/replay-slice.ts` | 45 | Replay state |
| `apps/studio/src/hooks/use-replay-clock.ts` | 65 | Shared replay clock |
| `apps/studio/src/components/layout/PathReplayClock.tsx` | 75 | RAF playback loop |
| `apps/studio/src/components/workspace/WorkspaceCanvas.tsx` | 1050+ | 3D path visualization |

---

## 13. Limitations & Future Work

### Current Limitations

1. **Static adversary model** — No adaptive pathfinding based on camera movement
2. **Single target zone** — Only one critical zone targeted per computation
3. **No temporal awareness** — Doesn't consider guard patrol timing in path cost
4. **Binary walkability** — Cells are either walkable or not (no difficulty gradient)

### Potential Enhancements

1. **Dynamic A\*** — Re-route when cameras move (PTZ tracking)
2. **Multi-target paths** — Find paths covering multiple critical zones
3. **Temporal cost layer** — Factor in guard patrol schedules
4. **Probabilistic walkability** — Difficulty gradient based on obstruction type
5. **Adversary profiles** — Different risk tolerances (reckless vs cautious)

---

*Document generated by Buffy (SentinelTwin AI agent)*  
*Thread 156 — Adversarial Path Simulation*
