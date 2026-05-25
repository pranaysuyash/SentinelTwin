# Pascal Editor Integration

**Status:** Decision made — 2026-05-25
**Decision:** Fork `pascalorg/editor` (MIT). See DECISION_LOG.md entry D-001.

---

## What Pascal Editor Is

Pascal Editor is an open-source browser-based 3D architectural editor:
- GitHub: `pascalorg/editor` (MIT license)
- Stack: React 19, Next.js, React Three Fiber, Zustand, WebGPU
- 11,000+ GitHub stars as of April 2026
- Published packages: `@pascal-app/core`, `@pascal-app/viewer`

Pascal provides a production-quality spatial editing foundation that would take months to build:
walls, slabs, ceilings, roofs, doors, windows, zones, levels, multi-floor support, furniture
placement, 2D/3D synchronized view, orbit controls, undo/redo, IndexedDB persistence,
JSON import/export, CSG (Constructive Solid Geometry) for door/window cutouts.

## Pascal's Architecture (What We Inherit)

### Core Package (`@pascal-app/core`)

**Flat dictionary node store (Zustand):**
```typescript
useScene.getState() = {
  nodes: Record<id, AnyNode>,    // all nodes, O(1) lookup
  rootNodeIds: string[],         // top-level sites
  dirtyNodes: Set<string>,       // nodes needing geometry update
  createNode(node, parentId),
  updateNode(id, updates),
  deleteNode(id),
}
```

**Node hierarchy:**
`Site → Building → Level → Wall / Slab / Zone / Items (doors, windows, furniture)`

**Systems (run in useFrame, process dirty nodes):**
- `WallSystem` — generates wall geometry with mitering + CSG cutouts
- `SlabSystem` — floor geometry from polygon definitions
- `CeilingSystem`, `RoofSystem`, `ItemSystem`

**Spatial grid manager:** collision detection, placement validation

**Zod schemas:** runtime type validation for all nodes

**Zundo middleware:** 50-step undo/redo history

### Viewer Package (`@pascal-app/viewer`)

- R3F rendering components: walls, slabs, zones, items
- Default camera setup with orbit controls
- Post-processing: ambient occlusion, bloom, anti-aliasing
- Level display modes: stacked / exploded / solo
- Scene registry: bidirectional `id ↔ THREE.Object3D` map

### Editor App

- Tools: SelectTool, WallTool, ZoneTool, ItemTool, SlabTool
- Selection manager: hierarchical navigation
- Zone visibility control

---

## Why Fork Instead of Depend-On

**Option A: Depend on `@pascal-app/core` and `@pascal-app/viewer` as npm packages**
- Pros: stays in sync with upstream, less maintenance
- Cons: can't mutate node types, can't change rendering pipeline, can't add security-specific systems, can't modify the Zustand store shape without conflicts

**Option B: Fork the full repo**
- Pros: full ownership, can extend AnyNode union, can add security systems, can modify rendering
- Cons: diverges from upstream, must maintain fork

**Decision: Fork.** SentinelTwin will mutate Pascal's data model deeply enough that a dependency relationship creates more friction than a fork. MIT license explicitly allows this.

Every divergence from Pascal upstream must be documented in `Docs/decisions/DECISION_LOG.md`.

---

## Extension Plan

### Step 1: Add Security Node Types to AnyNode

Pascal's `AnyNode` is a discriminated union. We extend it:

```typescript
// Pascal's existing union:
type AnyNode = SiteNode | BuildingNode | LevelNode | WallNode | SlabNode | ...

// SentinelTwin extends it with:
type AnySecurityNode = AnyNode
  | CameraNode
  | SecurityLightNode
  | ObstructionNode
  | CriticalZoneNode
  | PrivacyZoneNode
  | EntryPointNode
  | PersonPathNode
  | VehiclePathNode
  | GuardPatrolNode
```

### Step 2: Add Security Systems

Systems are the computational engines in Pascal. We add:

```typescript
// packages/core/src/systems/
CameraSystem        — generates camera frustum geometry, updates on dirty
CoverageSystem      — runs coverage grid on scene change
PathSystem          — animates person/vehicle along path
QualitySystem       — maps coverage scores to DORI categories
AdversarialSystem   — computes adversarial path (expensive, on-demand only)
TemporalSystem      — runs 24h temporal profile (on-demand)
```

### Step 3: Add Security Tools to Editor

```typescript
// apps/editor/src/tools/
CameraTool          — place, rotate, tilt cameras
SecurityLightTool   — place security lights
ObstructionTool     — place/edit obstructions
CriticalZoneTool    — draw critical zones (polygon)
PathTool            — draw scenario paths
GuardPatrolTool     — draw guard patrol routes
```

### Step 4: Add Security Viewer Overlays

```typescript
// packages/viewer/src/security/
CoverageHeatmap     — floor heatmap (instanced mesh, color per DORI level)
CameraFrustum       — frustum cone visualization
CameraFeedView      — secondary canvas showing camera's POV
BlindspotOverlay    — highlighted blind zones
PathReplay          — animated actor along path
AdversarialPathViz  — highlighted adversarial route
TemporalGraph       — 24h risk profile chart
```

### Step 5: Add Security Inspector Panels

Extend Pascal's inspector for security node selection:
- Camera inspector: all camera properties + [View from Camera] + [Show Cone] + [Show Blocked Rays]
- Light inspector: brightness, range, on/off, emergency power
- Zone inspector: required quality, target type, current status, pass/fail
- Obstruction inspector: material, movable, [Test Without This], vision transmission

---

## Rendering Architecture (Pascal Extended)

Pascal uses a **scene registry** pattern:
```
nodes in Zustand store
  → React components via NodeRenderer
    → Three.js Object3Ds registered in sceneRegistry
      → Systems update geometry each frame for dirty nodes
```

SentinelTwin follows the same pattern. The coverage heatmap is a special case: it's an
instanced mesh across the floor grid, updated by CoverageSystem when any camera, light, or
obstruction changes.

### Coverage Heatmap Rendering

Three approaches compared:

| Approach | Visual Quality | Performance | Setup |
|---|---|---|---|
| Color floor mesh tiles | Low | Fast | Simple |
| Instanced mesh grid | Good | Very fast | Moderate |
| Canvas texture on floor | Excellent | Fast | Moderate |

**Decision: Instanced mesh grid** for V0.1 — best balance. Each grid cell is an instance with
per-cell color driven by coverage quality. `InstancedMesh` with 40×40 = 1,600 instances is
trivially fast for a GPU.

### Camera Feed View

The camera-feed panel shows Camera 1's first-person view alongside the 3D scene.
Implementation: secondary `<Canvas>` component in R3F with its own renderer, locked to the
simulated camera's position and orientation. Not a portal or render target.

Multiple camera views (camera wall mode): four-panel layout, each a separate Canvas.
Performance implication: 4 active Canvas elements. Need to test on target hardware.
If too heavy, switch to render-to-texture approach.

---

## Files to Track as Fork Divergences

When we diverge from Pascal upstream, log here:

| Pascal file | Our version | Why different | Date |
|---|---|---|---|
| packages/core/src/types/nodes.ts | Extended AnyNode union | Added security nodes | TBD |
| packages/core/src/store/useScene.ts | Extended store | Added simulation, snapshots, assumptions | TBD |
| packages/viewer/src/NodeRenderer.tsx | Extended dispatch | Added security node renderers | TBD |

---

## Pascal Upstream Monitoring

Periodically check `pascalorg/editor` for improvements we can backport:
- Performance improvements to WallSystem / rendering
- New spatial query utilities
- Bug fixes in CSG or geometry generation
- New item types that could serve as security object bases

Log in `Docs/exploration/EXPLORATION_MAP.md` if significant upstream changes appear.
