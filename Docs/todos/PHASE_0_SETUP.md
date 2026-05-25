# Phase 0 — Repository and Pipeline Foundation

**Status:** Not started
**Blocking:** Everything
**Agent:** Claude Code (or any agent)
**Read first:** CLAUDE.md, Docs/decisions/DECISION_LOG.md (especially D-010), Docs/architecture/00–03

---

## Important: Build Order Change (D-010)

Per DECISION_LOG.md D-010: we build and prove our own simulation pipeline before
introducing Pascal or any external editor fork. The Pascal fork tasks that were here
previously are deferred until the pipeline is proven.

The first build is a focused, standalone Next.js + R3F app containing:
- SecurityScene schema + Zod validation
- Demo scene JSON (small retail shop)
- Minimal 3D render (floor, walls as boxes, cameras as spheres)
- Coverage engine (raycasting, DORI scoring, heatmap)
- Adversarial path simulation (Dijkstra, minimum exposure route)
- Camera view panel
- Before/after snapshots
- Report-lite

No Pascal. No Turborepo complexity. No external editor fork.
When the above is working and we understand what we need from a spatial editor,
we evaluate Pascal integration. That decision lives in DECISION_LOG.md D-001 (pending).

---

## Task 0.1 — Create the standalone Next.js + R3F app

```bash
mkdir -p apps/studio
cd apps/studio
bun create next-app . --typescript --tailwind --app
bun add three @react-three/fiber @react-three/drei zustand zod
bun add -d @types/three
```

Structure:
```
apps/studio/
  src/
    schema/          ← SecurityScene types + Zod
    simulation/      ← coverage engine, adversarial path (no React)
    store/           ← Zustand scene store
    components/      ← R3F canvas, panels, inspector
    demo-scenes/     ← small_retail_shop.json
```

**Critical package rule:** `src/simulation/` must have zero React imports.
It receives plain data, returns plain data. It can import three and three-mesh-bvh
for geometry and raycasting — these are pure geometry libraries, not UI dependencies.
It must not import React, R3F, Zustand, or any browser/DOM API.

**Done when:** `bun dev` runs without errors. Browser shows a blank canvas.

---

## Task 0.2 — SecurityScene schema + Zod validation

Build TypeScript types and Zod schemas from `Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md`.

Types to create:
- `CameraNode`
- `SecurityLightNode`
- `ObstructionNode`
- `CriticalZoneNode`
- `WallNode`, `DoorNode`, `WindowNode`
- `ScenarioPath`
- `SimulationAssumptions`
- `SimulationResult` (and sub-types: `CellCoverage`, `ZoneResult`, `PathResult`, `AdversarialPath`)
- `SceneSnapshot`
- `SecurityScene` (top-level)

Each type has:
1. A TypeScript interface or type alias
2. A matching Zod schema for runtime validation
3. A `parse()` or `safeParse()` wrapper

**Done when:** All types compile. All Zod schemas validate correctly shaped objects.
Invalid objects (missing required fields, wrong types) produce clear error messages.

---

## Task 0.3 — Zustand scene store

Single store managing the entire scene state.

```typescript
type SceneStore = {
  scene: SecurityScene | null;

  // CRUD
  addNode: (node: AnySecurityNode) => void;
  updateNode: (id: string, patch: Partial<AnySecurityNode>) => void;
  removeNode: (id: string) => void;

  // Simulation state
  simulationDirty: boolean;
  markDirty: () => void;
  setSimulationResult: (result: SimulationResult) => void;

  // Persistence
  importScene: (json: unknown) => { success: boolean; error?: string };
  exportScene: () => SecurityScene;

  // Snapshots
  saveSnapshot: (label: string) => void;
  snapshots: SceneSnapshot[];
};
```

**Done when:** Can programmatically add a CameraNode, read it back, update it, delete it.
`importScene()` validates input against Zod schema and rejects invalid JSON with a clear error.

---

## Task 0.4 — Demo scene JSON

Build `apps/studio/src/demo-scenes/small_retail_shop.json`.

Scene spec (from project brief section 20.1):
- Room: 10m × 7m × 3m height
- Front entrance: door, 1m wide, center of south wall
- Cash counter: 2m × 0.8m × 1.0m, near north wall center
- Shelf 1: 2m × 0.5m × 1.8m, center-west, parallel to west wall
- Shelf 2: 2m × 0.5m × 1.8m, center-east, parallel to east wall
- Cupboard: 1m × 0.5m × 2m, partially blocking Camera 1 sightline to counter
- Back storage room: door in north-east wall section
- Camera 1: ceiling dome, position [2.0, 2.8, 1.5], FOV 110°, 4MP, aimed toward entry
- Camera 2: wall mount, position [8.0, 2.5, 5.5], FOV 90°, 4MP, aimed toward counter
- Light 1: ceiling, position [5.0, 2.9, 3.5], status on
- Critical zone: Cash Counter, required recognition quality

Use coordinates that make geometric sense. Measure twice.
The cupboard must actually partially block Camera 1's view of the counter — verify this
is the case before marking done.

Validate against SecurityScene Zod schema: `importScene()` must succeed.

**Done when:** `importScene(small_retail_shop)` succeeds with no validation errors.

---

## Task 0.5 — Minimal 3D render

Wire the demo scene to render in R3F canvas. Correctness over beauty.

- Floor: `PlaneGeometry` at y=0, covers scene dimensions
- Walls: `BoxGeometry` for each wall segment, correct position and size
- Obstructions: colored `BoxGeometry` per obstruction node (shelf = brown, cupboard = dark brown)
- Cameras: small `SphereGeometry` at camera position, cone wireframe showing FOV direction
- Critical zones: transparent `PlaneGeometry` slightly above floor, colored by priority
- Lights: small sphere at light position

No textures needed. No shadows needed. No material quality. Just geometry in the right place.

**Done when:** Demo scene loads and renders. Every node in the JSON has a visible 3D representation.
No TypeScript errors. No console errors.

---

## Task 0.6 — Install three-mesh-bvh

```bash
bun add three-mesh-bvh
```

Verify import works in `src/simulation/`:
```typescript
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
THREE.Mesh.prototype.raycast = acceleratedRaycast;
```

This must be installed from day one per D-004. Do not build any raycasting without it.

**Done when:** Import compiles. No runtime errors on module load.

---

## Phase 0 Done Criteria

- [ ] 0.1: Next.js + R3F app runs in browser
- [ ] 0.2: SecurityScene types + Zod schemas complete, all validate correctly
- [ ] 0.3: Zustand store with CRUD, import, export, snapshots
- [ ] 0.4: Demo scene JSON valid, loads via `importScene()`
- [ ] 0.5: Demo scene renders in 3D — all nodes visible, correct positions
- [ ] 0.6: three-mesh-bvh installed and importable

**Next phase:** `Docs/todos/PHASE_1_COVERAGE_ENGINE.md`
