# Phase 1 — Coverage Engine

**Status:** Completed — 2026-05-30
**Blocking:** Phase 0 must be complete
**Agent:** Claude Code (or any agent)
**Read first:** Docs/architecture/03_COVERAGE_ENGINE.md

---

## Goal

Build a working, tested coverage engine that takes a SecurityScene and produces a SimulationResult.
No UI yet. Pure computation. Must run in isolation without React.

This is the heart of SentinelTwin. Get it right before building any UI on top.

---

## Task 1.1 — Build Grid Sampler

In `packages/simulation/src/coverage/gridSampler.ts`:

```typescript
function buildCoverageGrid(
  sceneDimensions: { width: number; depth: number },
  options: { cellsPerMeter: number; sampleHeight: number }
): GridCell[][]
```

Creates a 2D array of `GridCell` objects covering the scene floor.
Each cell has `x`, `z` position. Quality fields initialized to "none".

**Test:** Grid for 10m × 7m room with 2 cells/meter = 20×14 = 280 cells. Verify dimensions.

---

## Task 1.2 — Build Vision Collider Mesh

In `packages/simulation/src/bvh/buildVisionBVH.ts`:

```typescript
function buildVisionColliderMesh(
  walls: WallNode[],
  obstructions: ObstructionNode[],
): THREE.Mesh  // merged mesh with BVH computed
```

For each wall: create a flat box matching wall endpoints + height.
For each obstruction: create a box matching dimensions, with `visionTransmission` in `userData`.
Merge all geometries into a single `THREE.BufferGeometry`.
Call `mesh.computeBoundsTree()` (three-mesh-bvh).

The merged BVH mesh is what the raycaster intersects.

**Test:** Mesh with 4 walls + 2 obstructions builds without error. BVH is on the mesh.

---

## Task 1.3 — FOV Test

In `packages/simulation/src/coverage/fovTest.ts`:

```typescript
function isInFOV(
  cameraPos: THREE.Vector3,
  cameraForward: THREE.Vector3,
  fovHDeg: number,
  fovVDeg: number,
  targetPos: THREE.Vector3,
): { inFOV: boolean; hAngle: number; vAngle: number }
```

**Tests:**
- Point directly in front of camera: inFOV = true
- Point at exactly fovH/2 degrees horizontal: inFOV = true (edge case)
- Point at fovH/2 + 1 degree: inFOV = false
- Point behind camera (180° away): inFOV = false

---

## Task 1.4 — Raycast Occlusion

In `packages/simulation/src/coverage/raycastOcclusion.ts`:

```typescript
function checkOcclusion(
  raycaster: THREE.Raycaster,
  cameraPos: THREE.Vector3,
  targetPos: THREE.Vector3,
  visionMesh: THREE.Mesh,
): OcclusionResult
```

Sets raycaster origin/direction, intersects visionMesh, checks if first hit is before target.
Returns: `{ blocked: boolean; blockingObjectId?: string; material?: string; visionTransmission?: number }`

**Tests:**
- Camera → open floor cell: not blocked
- Camera → cell behind solid wall: blocked
- Camera → cell behind glass wall: not fully blocked (visionTransmission: 0.9)
- Camera → cell behind grill: not fully blocked (visionTransmission: 0.5)

---

## Task 1.5 — DORI Quality Scoring Formula

In `packages/simulation/src/coverage/qualityScoring.ts`:

```typescript
function computePixelDensity(
  camera: CameraNode,
  distanceM: number,
): number

function applyPenalties(
  ppm: number,
  penalties: QualityPenalties,
): number

function ppmToQuality(ppm: number): DORIQuality
```

Implement the full formula from `Docs/architecture/03_COVERAGE_ENGINE.md`.

**Tests (critical — these numbers must be right):**
- 4MP camera, 90° FOV, at 5m, good clarity, day: what PPM? Verify against DORI thresholds.
- Same camera at 15m: what quality?
- Same camera at 25m: what quality?
- Night mode, no IR, no light: quality drops 2 levels
- Night mode, IR in range: quality drops 1 level
- Night mode, beyond IR range: quality drops 2 levels
- Dirty lens (clarity: poor): PPM × 0.4

Document the test numbers. These become the ground truth for all future regression testing.

---

## Task 1.6 — Lighting Penalty

In `packages/simulation/src/coverage/lightingPenalty.ts`:

```typescript
function computeLightingPenalty(
  camera: CameraNode,
  cellPosition: THREE.Vector3,
  lights: SecurityLightNode[],
  timeOfDay: "day" | "night",
): number  // 0 = no penalty, 1 = total blackout
```

**Tests:**
- Day: penalty = 0 for all cells
- Night, no lights: penalty varies by camera nightMode
- Night, cell illuminated by active light: small penalty
- Night, cell beyond IR range, no light: large penalty

---

## Task 1.7 — Full Coverage Computation

In `packages/simulation/src/coverage/computeCoverage.ts`:

```typescript
function computeCoverage(
  scene: SecurityScene,
  options?: CoverageOptions,
): SimulationResult
```

Main entry point. Runs the full pipeline:
1. Build grid
2. Build vision BVH mesh
3. For each camera × each cell: FOV test → occlusion → quality scoring
4. Aggregate: coverage %, blindspot %, quality distribution
5. Zone results: per critical zone, check if requirements are met
6. Camera results: per camera, list covered zones
7. Issues: identify critical zone failures, redundancy gaps

**Tests (end-to-end — these are the acceptance tests for V0.1):**
- Small retail shop, no changes: verify coverage % is plausible, zones computed
- Move Shelf 1 to blocking position: verify blindspot increases
- Turn Camera 1 off: verify cash counter zone loses coverage
- Night mode: verify quality degrades appropriately
- Glass wall: verify camera sees through with penalty

---

## Task 1.8 — Write Coverage Engine Tests

Create `packages/simulation/src/coverage/__tests__/`:

Tests must cover every scenario listed in `Docs/architecture/03_COVERAGE_ENGINE.md` section
"Test Coverage Requirements."

Use Vitest (Pascal's test runner). Each test imports `computeCoverage` directly.
No React, no R3F, no browser APIs.

**Done when:** `bun test --filter simulation` passes all tests.

---

## Task 1.9 — Performance Benchmark

After tests pass:

```typescript
// benchmark.ts
const scene = loadJSON("small_retail_shop.json");
const start = performance.now();
for (let i = 0; i < 100; i++) {
  computeCoverage(scene);
}
const avg = (performance.now() - start) / 100;
console.log(`Average recompute: ${avg.toFixed(1)}ms`);
```

Target: < 16ms (one frame budget) for small_retail_shop.json.
If > 16ms: profile and optimize. If > 50ms: plan Web Worker migration.

Observed in `apps/studio` test suite on 2026-05-26: `simulateStudio(createSmallRetailShopScene())`
averaged **10.8ms** per run over 10 iterations via `bun test`.

Document results in `Docs/decisions/OPEN_QUESTIONS.md` (Q-002 update).

---

## Phase 1 Done Criteria

- [x] 1.1: Grid sampler works, tests pass
- [x] 1.2: Vision BVH mesh builds correctly
- [x] 1.3: FOV test accurate, edge cases handled
- [x] 1.4: Raycast occlusion correct for solid/glass/grill
- [x] 1.5: DORI quality scoring matches expected PPM values
- [x] 1.6: Lighting penalty correct for day/night/IR
- [x] 1.7: Full `computeCoverage()` produces valid SimulationResult
- [x] 1.8: All acceptance tests pass
- [x] 1.9: Benchmark result documented

**Next phase:** `Docs/todos/PHASE_2_EDITOR_INTEGRATION.md`
