# Pascal Editor Deep Dive

**Thread:** Exploration Map Thread 1
**Status:** Decision made — fork. This doc captures what we get from Pascal and the specific extension plan.
**Last updated:** 2026-05-25

---

## What We Get From Pascal

### The Store Pattern (Critical to Understand)

Pascal uses a **flat dictionary** node store, not a tree:

```typescript
nodes: Record<string, AnyNode>
```

All nodes at all levels live in one flat dictionary. Relationships are expressed through
`parentId` references. This gives O(1) node access by ID — important for the coverage engine
which accesses nodes frequently.

The store uses `dirtyNodes: Set<string>` — when any node changes, its ID is added to the dirty set.
Systems run in the R3F `useFrame` loop and process only dirty nodes each frame:

```
useFrame → WallSystem.update(dirtyNodes) → rebuild geometry for dirty walls only
```

This is the pattern we follow for `CameraSystem`, `CoverageSystem`, etc.

### The Geometry Systems Pattern

Each Pascal geometry system follows the same pattern:
1. Check `dirtyNodes` set for nodes of its type
2. Look up node data from store
3. Look up corresponding `THREE.Object3D` from scene registry
4. Recompute geometry, set on Object3D
5. Remove node from dirtyNodes

We build `CameraSystem` (updates frustum geometry when camera node changes),
`CoverageSystem` (rebuilds coverage grid when any camera/obstruction/light changes),
`PathSystem` (updates path actor transform during replay).

### What Pascal's `AnyNode` Union Looks Like

```typescript
type AnyNode =
  | SiteNode
  | BuildingNode
  | LevelNode
  | WallNode       // has position, endpoints, height, material
  | SlabNode       // has polygon, elevation
  | CeilingNode
  | RoofNode
  | ZoneNode       // has polygon, label — we extend this for CriticalZoneNode
  | ItemNode       // generic item (doors, windows, furniture)
  | ScanNode       // reference scan mesh (reality capture)
  | GuideNode      // 2D reference image for tracing
```

**Extension point:** We add to this union:
```typescript
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

### What Pascal's Scene Registry Gives Us

```typescript
sceneRegistry = {
  nodes: Map<id, THREE.Object3D>,    // ID → 3D object
  byType: {
    wall: Set<id>,
    item: Set<id>,
    // ...
  }
}
```

We add:
```typescript
byType: {
  camera: Set<id>,
  security_light: Set<id>,
  obstruction: Set<id>,
  // ...
}
```

The registry means systems can access 3D objects by node ID without traversing the scene graph.
This is important for CoverageSystem which needs to iterate all obstruction meshes efficiently.

### WallSystem — What We Can Learn From It

WallSystem generates wall geometry with:
- Mitering at corners (complex: walls that join at angles need clean joints)
- CSG operations for door and window cutouts
- UV mapping for textures
- Varying wall thicknesses and heights

The mitering logic is non-trivial. We don't need to rewrite this — it comes with Pascal.
What we add is that walls are also vision colliders. Each WallNode should automatically
produce a corresponding vision collider mesh.

**Question Q-001:** Does Pascal's WallSystem expose the generated geometry in a way we can
reuse as a vision collider? Or do we need to build a parallel vision collider for each wall?
**Likely answer:** We can create a simplified flat-box vision collider from wall endpoints + height,
separately from Pascal's mitered visual geometry. The visual mesh has complex geometry; the
vision collider just needs a flat plane between wall endpoints at wall height.

### Multi-Floor Support

Pascal has full multi-floor support via LevelNodes.
Each LevelNode contains walls, slabs, zones, items for that floor.
The viewer shows levels in stacked / exploded / solo modes.

For V0.1 SentinelTwin: single floor only.
For V0.2+: extend to multi-floor coverage (cameras seeing across floors in atriums,
mezzanine levels, etc.)

### The ScanNode — Potentially Useful

Pascal has a `ScanNode` type described as "3D reference scans from reality capture devices,
enabling as-built documentation." We haven't fully investigated this yet.

**Research needed:** What is the ScanNode? Can it store imported GLB meshes?
Could we use it to attach a captured scan mesh as the "visual background" of a space while
maintaining clean simulation blocks as the simulation truth?
If yes, this is the `visual scan layer: pretty / semantic block layer: simulation` architecture
pattern we want.

---

## Fork Strategy — Step by Step

### Step 1: Fork on GitHub
Fork `pascalorg/editor` to `{pranay}/sentineltwin` on GitHub.

### Step 2: Clone and verify
```bash
git clone https://github.com/{pranay}/sentineltwin
cd sentineltwin
bun install
bun dev
# Verify: Pascal Editor loads in browser at localhost:3000
```

### Step 3: Create SentinelTwin packages
In the Turborepo, add new packages alongside Pascal's existing ones:
```
packages/
├── core/               (Pascal's existing — we extend this)
├── viewer/             (Pascal's existing — we extend this)
├── editor [app]/       (Pascal's existing — we replace/extend this)
├── simulation/         (NEW — no React dependency)
├── agents/             (NEW — AI agent pipeline)
└── report/             (NEW — report generation)
```

Do NOT modify Pascal's core and viewer directly in V0.1.
Extend them via inheritance/composition or add parallel security packages.
Only modify Pascal's packages when extension patterns are insufficient.

### Step 4: Add SecurityScene to core
Create `packages/core/src/security/` folder.
Add TypeScript schemas (from Docs/architecture/01_DATA_MODEL_SECURITY_SCENE.md).
Extend the Zustand store with security state.
Extend AnyNode with security node types.

### Step 5: Add security systems
Create `packages/core/src/systems/CameraSystem.ts`, `CoverageSystem.ts`, etc.
Each follows the WallSystem pattern.

### Step 6: Add security renderers to viewer
Create `packages/viewer/src/security/` folder.
Add `CameraNodeRenderer.tsx`, `CoverageHeatmap.tsx`, etc.
Register security node types in NodeRenderer dispatch.

### Step 7: Replace/extend editor app
Either fork `apps/editor` or create `apps/sentineltwin-editor`.
Add security tools (CameraTool, ZoneTool, etc.).
Add security panels (inspector, metrics, timeline).

---

## Potential Divergences to Watch

| Area | Pascal's approach | Our extension | Risk |
|---|---|---|---|
| AnyNode union | Fixed set of nodes | Extended with security nodes | Medium — must ensure Zod schemas updated |
| useScene store | Scene + visual state | + simulation state + snapshots | Low — additive |
| NodeRenderer | Dispatches on pascal types | + security type dispatch | Low — additive |
| WallSystem output | Visual mesh + collider | + vision collider needed | Medium — need to add vision collider pass |
| IndexedDB persistence | Saves all nodes | Must save security nodes too | Low — follows same pattern |
| Undo/redo | 50-step Zundo | Must include security node changes | Low — same pattern |

---

## Useful Pascal Files to Read First

Before writing any security systems, read these Pascal files:
1. `packages/core/src/store/useScene.ts` — understand the store shape and CRUD pattern
2. `packages/core/src/systems/WallSystem.ts` — understand the system pattern
3. `packages/core/src/types/nodes.ts` — see the full AnyNode union
4. `packages/viewer/src/renderers/NodeRenderer.tsx` — see the dispatch pattern
5. `packages/viewer/src/registry/useRegistry.ts` — understand the scene registry

These 5 files contain the complete pattern for everything we need to extend.
