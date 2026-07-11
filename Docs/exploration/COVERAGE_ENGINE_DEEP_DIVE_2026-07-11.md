# Coverage Engine Algorithm — Deep Dive (2026-07-11)

## Overview

The coverage engine is the deterministic geometry-based visibility and quality engine that computes per-cell camera coverage, occlusion, DORI/OODPCVS quality scoring, and heatmap rendering. It is the mathematical core of SentinelTwin — every simulation result flows from this engine.

**Core principle:** Coverage Engine is deterministic geometry, not AI. Raycasting, DORI/OODPCVS scoring, heatmap, path visibility = deterministic Three.js. AI explains results. AI does not compute them.

---

## 6-Stage Deterministic Pipeline

```
SecurityScene → Grid Sampling → FOV Test → Occlusion Raycast → PPM Computation → Quality Scoring → Aggregation → SimulationResult
```

### Stage 1: Grid Sampling (`packages/simulation/src/grid.ts`)

Uniform grid at configurable resolution (default: **4 cells/meter** = 0.25m cell size).

```typescript
function buildCoverageGrid(scene: SecurityScene, cellsPerMeter = 4) {
  const cellSize = 1 / cellsPerMeter;
  const cols = Math.round(scene.dimensions.width * cellsPerMeter);
  const rows = Math.round(scene.dimensions.depth * cellsPerMeter);
  // For each cell: check walkability (not inside closed door/obstruction)
  // Mark privacyRestricted zones, coverageIncluded = walkable && !privacyRestricted
}
```

- **10m × 10m room**: 40×40 = 1,600 cells
- **20m × 20m room**: 80×80 = 6,400 cells
- **Performance cap**: 160K cells max (`MAX_SIMULATION_CELL_BUDGET`)
- **Adaptive grid option** (`adaptive-grid.ts`): 2× density near critical zones, 1.5× near entry points

### Stage 2: FOV Test (`packages/simulation/src/coverage.ts`)

For each (camera, cell) pair, compute angular displacement and reject if outside FOV:

```typescript
function evaluateCameraAgainstCell(...) {
  // 1. Compute direction from camera to cell
  const direction = target.clone().sub(origin).normalize();
  
  // 2. Compute yaw/pitch angles
  const targetYaw = Math.atan2(direction.x, -direction.z);
  const targetPitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
  
  // 3. Check against FOV bounds
  if (Math.abs(hAngle) > camera.fovHorizontalDeg / 2) → OUT_OF_FOV
  if (Math.abs(vAngle) > camera.fovVerticalDeg / 2) → OUT_OF_FOV
}
```

### Stage 3: Occlusion Raycast (`packages/simulation/src/vision-collider-mesh.ts`)

**BVH-accelerated raycasting** using `three-mesh-bvh`:

```typescript
// 1. Merge all scene geometry into single mesh
const geometries = [
  ...walls.map(buildWallGeometry),
  ...obstructions.map(buildObstructionGeometry),
  ...doors.filter(d => d.state !== "open").map(buildDoorGeometry),
  ...windows.filter(w => w.state !== "open").map(buildWindowGeometry),
  ...fenceSegments.filter(f => f.integrityState !== "breached").map(buildFenceGeometry),
];
const merged = mergeGeometries(geometries, true);
merged.computeBoundsTree(); // BVH acceleration

// 2. Raycast from camera to cell
const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true; // Single-ray optimization
raycaster.set(origin, direction);
const hits = raycaster.intersectObject(mesh, false);

// 3. Process first hit
for (const hit of hits) {
  if (hit.distance >= distance - 0.05) break; // 5cm tolerance
  const source = getVisionColliderSource(mesh, hit.faceIndex);
  if (source.visionTransmission > 0.05) {
    // Partial occlusion (glass, grill) — apply transmission penalty
    return { blocked: false, materialPenalty: source.visionTransmission };
  }
  return { blocked: true }; // Solid occlusion
}
```

**Performance**: O(log n) per ray via BVH

### Stage 4: PPM Computation

Pixels Per Meter computed from camera resolution and distance:

```typescript
function computePpm(
  resolutionMP: number,
  fovHorizontalDeg: number,
  distanceM: number,
): number {
  const resolutionWidthPx = Math.sqrt(resolutionMP * 1_000_000 * (16 / 9));
  const fovRad = (fovHorizontalDeg * Math.PI) / 180;
  const halfWidthM = distanceM * Math.tan(fovRad / 2);
  const pixelsPerMeter = resolutionWidthPx / (2 * halfWidthM);
  return pixelsPerMeter;
}
```

### Stage 5: Quality Scoring

**DORI (2014, 4 levels)** or **OODPCVS (2025, 11 levels)** based on PPM thresholds:

| Quality Level | DORI PPM | OODPCVS PPM |
|---------------|----------|-------------|
| Identification | ≥250 | ≥250 |
| Recognition | ≥125 | ≥125 |
| Observation | ≥62.5 | ≥62.5 |
| Detection | ≥25 | ≥25 |

### Stage 6: Aggregation

Per-camera results aggregated into zone-level and scene-level metrics:
- `totalCoveragePct`: % of walkable cells with any camera coverage
- `blindspotPct`: 100 - totalCoveragePct
- `recognitionAreaPct`: % of cells at recognition quality or better
- `identificationAreaPct`: % of cells at identification quality

---

## 4-Layer Penalty Model

Each cell's effective PPM is reduced by penalties:

1. **Blind spot penalty** (`mount-model.ts`): Cameras have a minimum blind spot radius based on mount type
   - Ceiling: 0.8m, Wall: 1.2m, Pole: 1.5m, Corner: 1.0m, Floating: 0.3m

2. **Lighting penalty** (`coverage.ts`): Night/dark conditions reduce effective PPM
   - Thermal cameras: 0.92 retention, Low-light: 0.82, IR: 0.68, None: 0.12

3. **Material transmission penalty**: Glass (0.85), Grill (0.50), Partial (0.20)

4. **Lens edge falloff** (`calibration.ts`): Quality degrades toward FOV edges

---

## 7 Camera Calibration Presets (`calibration.ts`)

| Preset | Resolution | FOV | Range | Mount |
|--------|-----------|-----|-------|-------|
| Indoor Dome 2MP | 2MP | 110° | 12m | Ceiling |
| Wide Dome 5MP | 5MP | 108° | 18m | Ceiling |
| Bullet 5MP | 5MP | 85° | 25m | Wall |
| PTZ 8MP | 8MP | 60° | 40m | Pole |
| Thermal 640 | 640×512 | 24° | 50m | Wall |
| Low-light 4MP | 4MP | 95° | 15m | Ceiling |
| LPR 2MP | 2MP | 35° | 30m | Pole |

---

## Heatmap Rendering (`SharedScene.tsx`)

**Instanced mesh** with vertex colors for 6,400+ cells at 60fps.

### 6 Heatmap Modes

| Mode | Color Mapping | Purpose |
|------|---------------|---------|
| **quality** | PPM-based: red→orange→yellow→green→blue | DORI quality at each cell |
| **lighting** | Shadow/light level: dark→blue→amber→yellow | Illumination quality |
| **fragility** | Near-threshold: green→amber→red | Coverage stability |
| **overlap** | Camera count: red(1)→yellow(2)→green(3+) | Redundancy |
| **contribution** | Single-camera dependency | Single-point-of-failure |
| **blindspots** | Binary: red(uncovered)→green(covered) | Uncovered regions |

### Color Stops (Quality Mode)

```typescript
const HEATMAP_COLOR_STOPS = [
  { ppm: 0,              color: "#991b1b" },  // Deep red (no coverage)
  { ppm: DORI.detection,  color: "#f97316" },  // Orange
  { ppm: DORI.observation,color: "#facc15" },  // Yellow
  { ppm: DORI.recognition,color: "#22c55e" },  // Green
  { ppm: DORI.identification, color: "#3b82f6" }, // Blue
];
```

---

## Blind Spot Analysis

### Topology (`blind-spot-topology.ts`)
- Flood-fill algorithm identifies connected blind spot regions
- Classifies regions by severity (critical/high/medium/low)
- Detects entry-linked vs isolated regions

### Fingerprint (`blind-spot-fingerprint.ts`)
- Unique signature for each blind spot pattern
- Enables before/after comparison across scene edits
- Tracks region count, total blind area, affected zones

### Fragility (`coverage-fragility.ts`)
- Detects cells near quality thresholds
- Flags zones that would fail with minor changes (camera misalignment, lens dirt)

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `packages/simulation/src/coverage.ts` | Core coverage computation | 800+ |
| `packages/simulation/src/grid.ts` | Grid sampling | 150 |
| `packages/simulation/src/vision-collider-mesh.ts` | BVH raycasting | 300 |
| `packages/simulation/src/blind-spot-topology.ts` | Connected region classification | 250 |
| `packages/simulation/src/blind-spot-fingerprint.ts` | Pattern fingerprinting | 120 |
| `packages/simulation/src/coverage-entropy.ts` | Quality distribution entropy | 60 |
| `packages/simulation/src/coverage-fragility.ts` | Near-threshold detection | 120 |
| `packages/simulation/src/mount-model.ts` | 5 mount types + blind spots | 110 |
| `packages/simulation/src/calibration.ts` | 7 camera presets | 200 |
| `packages/simulation/src/simulate-studio.ts` | Full orchestrator | 1,000+ |
| `packages/simulation/src/adaptive-grid.ts` | Variable density | 120 |
| `packages/simulation/src/odpcvs.ts` | Multi-factor quality model | 100 |
| `packages/simulation/src/occlusion-blame.ts` | Per-obstruction blame | 80 |
| `apps/studio/src/components/workspace/SharedScene.tsx` | Heatmap rendering | 1,600+ |

---

## Related Exploration Threads

- Thread 2: Coverage Engine Design
- Thread 2b: Simulation Engine Maturity
- Thread 157: Coverage Engine Algorithm (this document's index in EXPLORATION_MAP.md)
