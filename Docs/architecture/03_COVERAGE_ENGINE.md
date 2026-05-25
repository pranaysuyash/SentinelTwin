# Coverage Engine

**Status:** Design — 2026-05-25
**This is the simulation heart of SentinelTwin.**
All coverage numbers, DORI labels, heatmap colors, zone pass/fail status, and path timelines
derive from this engine. It must be deterministic, fast, and testable in isolation.

---

## Architecture Rules

1. **No React dependencies.** The coverage engine lives in `packages/simulation/`. It can run in a Web Worker and must never import React, R3F, or Zustand.
2. **Pure functions.** `computeCoverage(scene: SecurityScene, options: CoverageOptions) → SimulationResult` is a pure function. Same input = same output. No side effects.
3. **Input is SecurityScene. Output is SimulationResult.** Nothing else.
4. **Three-mesh-bvh is mandatory.** Without BVH acceleration, complex scenes will stutter. Add it from day one.
5. **Incremental computation later, correctness first.** V0.1 recomputes everything on change. V0.2+ can cache per-camera and invalidate selectively.

---

## Stage 1: Grid Sampling

The coverage grid samples the floor plane at regular intervals.

```typescript
type CoverageOptions = {
  gridResolution: number;   // cells per meter, default 2 (gives 0.5m cell size)
  maxRange: number;         // max camera range to consider, default 50m
  sampleHeight: number;     // height at which we check coverage, default personHeightM * 0.7 (head)
};
```

For a 10m × 10m room with gridResolution=2: 20×20 = 400 cells.
For a 20m × 20m room: 40×40 = 1,600 cells.
For 4 cameras: 6,400 raycasts. With BVH, this is <5ms on modern hardware.

Each grid cell:
```typescript
type GridCell = {
  x: number;                        // world x
  z: number;                        // world z
  coverageByCamera: Map<string, CellCoverage>;
  finalQuality: DORIQuality;         // best quality across all cameras
  coveringCameras: string[];
};

type CellCoverage = {
  quality: DORIQuality;
  pixelsPerMeter: number;
  blocked: boolean;
  blockingObject?: string;           // id of obstruction that blocked the ray
  distance: number;
  anglePenalty: number;
  lightingPenalty: number;
  materialPenalty: number;
};
```

---

## Stage 2: Per-Camera FOV Test

For each (camera, cell) pair, first test if the cell is inside the camera's FOV cone.

```typescript
function isInFOV(
  camera: CameraNode,
  cellPosition: Vector3,
): { inFOV: boolean; horizontalAngle: number; verticalAngle: number } {
  // 1. Get direction vector from camera to cell
  const direction = cellPosition.clone().sub(cameraPosition).normalize();

  // 2. Get camera forward vector (from yaw/pitch)
  const cameraForward = getForwardVector(camera.yawDeg, camera.pitchDeg);

  // 3. Horizontal angle (yaw plane only)
  const horizontalAngle = angleBetweenInPlane(direction, cameraForward, "horizontal");

  // 4. Vertical angle (pitch plane)
  const verticalAngle = angleBetweenInPlane(direction, cameraForward, "vertical");

  const inFOV =
    Math.abs(horizontalAngle) <= camera.fovHorizontalDeg / 2 &&
    Math.abs(verticalAngle) <= camera.fovVerticalDeg / 2;

  return { inFOV, horizontalAngle, verticalAngle };
}
```

If not in FOV → `quality: "none"`, skip raycast.

---

## Stage 3: Raycast Occlusion

For cells within FOV, raycast from camera position to cell center.

```typescript
function checkOcclusion(
  raycaster: THREE.Raycaster,
  cameraPosition: Vector3,
  cellCenter: Vector3,
  scene: THREE.Scene,
  bvhMesh: THREE.Mesh,  // merged vision collider mesh with BVH
): OcclusionResult {
  const direction = cellCenter.clone().sub(cameraPosition).normalize();
  const distance = cameraPosition.distanceTo(cellCenter);

  raycaster.set(cameraPosition, direction);
  const hits = raycaster.intersectObject(bvhMesh, false);

  if (hits.length === 0) {
    return { blocked: false };
  }

  // First hit before the cell?
  const firstHit = hits[0];
  if (firstHit.distance < distance - 0.05) {  // 5cm tolerance
    return {
      blocked: true,
      blockingObjectId: firstHit.object.userData.nodeId,
      material: firstHit.object.userData.material,
      visionTransmission: firstHit.object.userData.visionTransmission,
    };
  }

  return { blocked: false };
}
```

**BVH setup:** At scene load or when geometry changes, merge all vision collider meshes into
one `THREE.Mesh` and call `mesh.computeBoundsTree()` (three-mesh-bvh). The raycaster then
hits only the BVH, not the full scene graph.

**Material transmission:** If the hit object has `visionTransmission > 0` (glass, grill),
don't mark as fully blocked. Instead, apply a transmission penalty to the quality score.

---

## Stage 4: DORI Quality Scoring

DORI (Detection / Observation / Recognition / Identification) maps to pixel density at target.

### PPM (Pixels Per Meter) Standard (IEC 62676-4 simplified)

```typescript
const DORI_THRESHOLDS = {
  identification: 250,  // PPM — can identify individual from footage
  recognition:    125,  // PPM — can recognize known person
  observation:    62.5, // PPM — can observe general activity
  detection:      25,   // PPM — can detect presence/movement
};
```

### Pixel Density Formula

```typescript
function computePixelDensity(
  camera: CameraNode,
  distanceM: number,
  horizontalAngle: number,  // angle from camera center
  verticalAngle: number,
): number {
  if (distanceM <= 0) return Infinity;

  // Sensor resolution in pixels
  const sensorWidthPx = camera.resolutionWidth ?? Math.sqrt(camera.resolutionMP * 1_000_000 * (16/9));
  const sensorHeightPx = camera.resolutionHeight ?? sensorWidthPx * (9/16);

  // FOV-based pixel density at distance
  // Width of scene at distance in meters = 2 * distance * tan(fovH / 2)
  const sceneWidthAtDistance = 2 * distanceM * Math.tan(toRadians(camera.fovHorizontalDeg / 2));

  // Pixels per meter at this distance
  const rawPPM = sensorWidthPx / sceneWidthAtDistance;

  return rawPPM;
}
```

### Quality Penalties

After computing raw PPM, apply penalties:

```typescript
type QualityPenalties = {
  anglePenalty: number;        // steep horizontal/vertical angle reduces face usefulness
  lightingPenalty: number;     // night + no IR + no light
  clarityPenalty: number;      // dirty/blurred/compressed camera
  materialPenalty: number;     // glass/grill/curtain transmission penalty
  backlightPenalty: number;    // backlight from window behind subject
};

function applyPenalties(rawPPM: number, penalties: QualityPenalties): number {
  let ppm = rawPPM;

  // Angle penalty: steep angles reduce face/plate recognition utility
  // Angle > 45° from center = 0.7x, > 60° = 0.5x
  if (penalties.anglePenalty > 60) ppm *= 0.5;
  else if (penalties.anglePenalty > 45) ppm *= 0.7;

  // Lighting penalty
  ppm *= (1 - penalties.lightingPenalty);

  // Clarity penalty (dirty lens, compression artifacts)
  const clarityMultiplier = { poor: 0.4, average: 0.7, good: 0.9, excellent: 1.0 };
  ppm *= clarityMultiplier[camera.clarity];

  // Material transmission (glass/grill between camera and subject)
  ppm *= penalties.materialPenalty; // 0-1

  // Backlight (subject backlit = face recognition fails regardless of PPM)
  if (penalties.backlightPenalty > 0.8) ppm = Math.min(ppm, DORI_THRESHOLDS.observation);

  return ppm;
}
```

### Night/IR/Thermal Penalties

```typescript
function computeLightingPenalty(
  camera: CameraNode,
  cell: GridCell,
  lights: SecurityLightNode[],
  assumptions: SimulationAssumptions,
): number {
  if (assumptions.timeOfDay === "day") return 0;

  // Is cell illuminated by any active light?
  const illuminatedBy = lights.filter(
    light => light.status === "on" && distanceTo(light, cell) < light.rangeM
  );

  if (illuminatedBy.length > 0) {
    // Well-lit at night — slight degradation
    return 0.1;
  }

  // Cell is dark
  if (camera.nightMode === "none") return 0.9;      // degraded 2 quality levels

  if (camera.nightMode === "ir") {
    const distanceToCamera = distanceTo(camera, cell);
    if (distanceToCamera < camera.irRangeM) return 0.3;   // IR in range
    return 0.85;                                           // beyond IR range
  }

  if (camera.nightMode === "low_light") return 0.2;  // good at night
  if (camera.nightMode === "thermal") return 0.05;   // thermal ignores lighting

  return 0.7;
}
```

### Map PPM to DORIQuality

```typescript
function ppmToQuality(ppm: number, thresholds = DORI_THRESHOLDS): DORIQuality {
  if (ppm >= thresholds.identification) return "identification";
  if (ppm >= thresholds.recognition)    return "recognition";
  if (ppm >= thresholds.observation)    return "observation";
  if (ppm >= thresholds.detection)      return "detection";
  return "none";
}
```

---

## Stage 5: Heatmap Update

After computing coverage for all grid cells, update the instanced mesh:

```typescript
function updateHeatmap(
  grid: GridCell[][],
  instancedMesh: THREE.InstancedMesh,
): void {
  const QUALITY_COLORS: Record<DORIQuality, THREE.Color> = {
    none:           new THREE.Color(0x222222),   // dark
    detection:      new THREE.Color(0xff4444),   // red
    observation:    new THREE.Color(0xff8c00),   // orange
    recognition:    new THREE.Color(0xffdd00),   // yellow
    identification: new THREE.Color(0x44cc44),   // green
  };

  let instanceIdx = 0;
  const dummy = new THREE.Object3D();

  for (const row of grid) {
    for (const cell of row) {
      dummy.position.set(cell.x, HEATMAP_HEIGHT, cell.z);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(instanceIdx, dummy.matrix);
      instancedMesh.setColorAt(instanceIdx, QUALITY_COLORS[cell.finalQuality]);
      instanceIdx++;
    }
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.instanceColor!.needsUpdate = true;
}
```

---

## Stage 6: Path Visibility Timeline

For person/vehicle paths, sample along the path at regular intervals and run coverage for each sample point.

```typescript
function computePathVisibility(
  path: ScenarioPath,
  cameras: CameraNode[],
  visionColliders: THREE.Mesh,
  assumptions: SimulationAssumptions,
): PathVisibilityResult {
  const sampleIntervalM = 0.2;   // sample every 20cm
  const timeline: PathTimelineEvent[] = [];

  for (let t = 0; t <= path.totalLength; t += sampleIntervalM) {
    const position = interpolatePath(path.points, t);
    const timeS = t / path.speedMps;

    for (const camera of cameras) {
      if (camera.status !== "on") continue;

      const { inFOV } = isInFOV(camera, toVector3(position, path.heightM));
      if (!inFOV) continue;

      const occlusion = checkOcclusion(...);
      if (occlusion.blocked && occlusion.visionTransmission < 0.1) continue;

      const ppm = computePixelDensity(camera, distance, ...);
      const quality = ppmToQuality(applyPenalties(ppm, penalties));

      if (quality !== "none") {
        // record visibility event
      }
    }
  }

  return buildPathResult(timeline);
}
```

---

## Performance Strategy

### V0.1
- Grid: 40×40 (2 cells/meter, 20m × 20m scene)
- Recompute: on mouse-up, not during drag
- During drag: show preview cone only, no full heatmap
- BVH: always enabled, built once on scene change
- Worker: NOT in V0.1 (start synchronous, move to worker if it stutters)

### V0.2
- Worker: move computeCoverage to Web Worker via Comlink
- Incremental: per-camera cache, invalidate only cameras whose frustum or blocking objects changed
- Grid resolution: adaptive (finer near cameras, coarser at edges)

### V0.3+
- WebGPU compute shader for coverage grid (huge grid, many cameras)
- GPU-accelerated raycasting for adversarial path sim

---

## Test Coverage Requirements

Every coverage engine change must include tests for:
- Small room, 1 camera, no obstructions — verify coverage % and quality
- Small room, 1 camera, 1 solid obstruction — verify blind spot behind obstruction
- Small room, 1 camera, glass wall — verify coverage with transmission penalty
- Night mode, no lights — verify quality degradation
- Night mode, IR in range — verify partial recovery
- Night mode, beyond IR range — verify full degradation
- Person path visible — verify timeline events
- Person path blocked by shelf — verify lost event and blockingObjectId
- Zone requirement pass/fail — verify status computation
- Camera offline redundancy — verify zone fails when camera goes off

These are the acceptance tests for the coverage engine. All must pass before any coverage-related UI is built.
