# Rendering Pipeline

**Status:** Design — 2026-05-25

> ⚠️ **Runtime drift:** See [`07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md`](./07_RENDERING_PIPELINE_ADDENDUM_2026-05-29.md) for the actual deployed versions (Next.js 16.2.6, Three.js 0.184.x) and any deviations from this design reference.

---

## Stack

```
Next.js 16.2.6 (App Router)
React 19
React Three Fiber (R3F)
@react-three/drei
Three.js 0.184.x
Zustand (from Pascal fork)
three-mesh-bvh
@react-three/rapier (optional physics layer)
Framer Motion (replay timelines and transitions)  ← resolved D-018: GSAP replaced
Tailwind CSS v4
shadcn/ui
WebGPU (via Pascal's foundation, fallback to WebGL)
```

---

## Scene Structure

Pascal uses a scene registry pattern: nodes in Zustand → React components → Three.js Object3Ds.
SentinelTwin extends this with security-specific renderers.

```
<SentinelTwinCanvas>
  ├── <PascalSceneRenderer>           — walls, slabs, doors, windows (from Pascal)
  │   ├── <WallRenderer>
  │   ├── <SlabRenderer>
  │   └── ...
  ├── <SecuritySceneRenderer>         — SentinelTwin additions
  │   ├── <CameraNodeRenderer>        — camera body + frustum cone
  │   ├── <SecurityLightRenderer>     — light fixture + range indicator
  │   ├── <ObstructionRenderer>       — shelf/cupboard/etc geometry
  │   ├── <CriticalZoneRenderer>      — zone polygon overlay
  │   └── <EntryPointRenderer>
  ├── <SimulationOverlayRenderer>     — driven by SimulationResult
  │   ├── <CoverageHeatmap>           — instanced mesh over floor grid
  │   ├── <BlindspotHighlight>        — highlighted blind zones
  │   ├── <AdversarialPathViz>        — glowing route line
  │   └── <CameraFrustumDebug>        — raycast debug visualization
  ├── <PathReplayRenderer>            — animated actor
  │   ├── <PersonActor>
  │   └── <VehicleActor>
  └── <CameraFeedPanel>               — picture-in-picture camera views
```

---

## Coverage Heatmap

The heatmap is an `InstancedMesh` spanning the floor grid.
Each instance = one grid cell. Color = DORI quality.

```typescript
const QUALITY_COLORS = {
  none:           [0.13, 0.13, 0.13, 0.7],   // dark gray, semi-transparent
  detection:      [1.00, 0.27, 0.27, 0.6],   // red
  observation:    [1.00, 0.55, 0.00, 0.6],   // orange
  recognition:    [1.00, 0.87, 0.00, 0.6],   // yellow
  identification: [0.27, 0.80, 0.27, 0.6],   // green
};
```

The heatmap is a separate render pass above the floor, slightly elevated (0.01m) to avoid
z-fighting. Alpha blending means the floor texture is visible through it.

Update cycle: when `simulationDirty` is true and user releases mouse, CoverageSystem runs,
writes grid results to a shared array, CoverageHeatmap component reads it and updates
`instancedMesh.instanceColor`.

Performance: 40×40 = 1,600 instances. Negligible GPU cost.

---

## Camera Frustum Visualization

Each camera renders a semi-transparent cone showing its FOV.

Three frustum modes:
- **Cone:** simple wireframe or semi-transparent solid cone, shows FOV shape
- **Coverage frustum:** colored by coverage quality within the cone
- **Debug:** shows individual raycasts as lines (dev mode only)

The frustum is NOT Three.js `PerspectiveCamera`. It is a geometry computed from the
camera node's yaw/pitch/FOV and rendered as a custom `THREE.Geometry`.

```typescript
function buildFrustumGeometry(
  fovH: number,
  fovV: number,
  range: number,
): THREE.BufferGeometry {
  // Build cone geometry manually
  // Near plane: small square at camera origin
  // Far plane: rectangle at range distance, sized by tan(fovH/2) * range
  // Connect with 4 quad faces + near/far end caps
}
```

---

## Camera Feed View (PIP)

The camera-feed panel renders the simulated camera's first-person view.

Implementation: A secondary `<Canvas>` component in R3F, rendering the same scene from a
`THREE.PerspectiveCamera` locked to the simulated camera's position and orientation.

### Deterministic PTZ replay feed synthesis

For replay and verification modes, camera feed poses are not sampled from live telemetry.
Instead, they are deterministically synthesized from `CameraNode.viewMotion` at the
current replay timestamp:

- `fixed` -> static yaw/pitch from `camera.yawDeg`/`pitchDeg`.
- `preset_cycle`, `sweep_h`, `sweep_v`, `tracking` with 2+ waypoints -> waypoint interpolation with hold/transition timing and speed constraints.
- Sweep-only modes without waypoints -> periodic sinusoidal sweep (`±45°` yaw, `±30°` pitch).

The sampled pose is then applied as an optional override to both
`CameraRigLive` (single camera view) and `CameraRigFixed` (camera wall tiles),
while the stored `CameraNode` orientation remains unchanged.

```typescript
<CameraFeedCanvas
  cameraNode={selectedCamera}
  width={320}
  height={240}
  overlayMode="realistic"   // adds noise, timestamp, IR grayscale etc.
/>
```

The feed canvas renders independently from the main canvas. Performance: 2 active canvases
on a typical laptop GPU is fine. 4 (camera wall) needs testing.

**Overlay effects for realism:**
- Timestamp overlay (CSS, not rendered in Three.js)
- Camera name label
- Night mode: grayscale conversion + grain filter (CSS filter or R3F post-processing)
- IR mode: tint + lower contrast
- Thermal: false-color palette shader
- Dirty lens: blur effect
- Bounding box: marker around detected person (manually placed based on path position)

---

## Path Replay Animation

Person/vehicle replay uses **Framer Motion** for timeline control (see D-018 — replaced GSAP).

```typescript
import { animate, spring } from "framer-motion";

// Animate actor along path
const animationControl = animate(
  actorRef.current.position,
  { x: targetX, z: targetZ },
  { duration: segmentDuration / playbackSpeed, ease: "linear" }
);

// Timeline mode uses AnimationPlaybackControls
// Controls: animationControl.play(), .pause(), .seek() via Framer Motion time
// For multi-segment replay, chain with motion.Value timeline or a sequence
```

During replay:
- Coverage heatmap shows per-camera visibility dynamically
- Timeline panel shows current visibility events
- Camera feed panel shows actor in active cameras
- "Lost behind Shelf 1" label appears when actor enters blindspot

---

## Before/After Comparison Mode

Split screen: left = snapshot A, right = snapshot B.

Implementation: Two canvases side by side, each loading a different SceneSnapshot.
A shared divider line can be dragged to give more screen space to either side.

Alternatively: a diff overlay mode where only changed elements are highlighted.
Cells that improved: green glow. Cells that degraded: red glow.

```
┌───────────────┬───────────────┐
│  BEFORE       │  AFTER        │
│  Shelf 1 here │  Shelf moved  │
│  [heatmap]    │  [heatmap]    │
│               │               │
│  Blindspot    │  Coverage     │
│  31%          │  12%          │
└───────────────┴───────────────┘
        Drag divider ◄──►
```

---

## UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Top bar: SentinelTwin logo | Scene name | Mode | Save | Settings │
├──────────────┬──────────────────────────────────────┬────────────┤
│              │                                      │            │
│ Object Tray  │    3D Scene Canvas                   │ Inspector  │
│              │    + Security Overlays                │            │
│ [Cameras]    │                                      │ (selection │
│ [Lights]     │                                      │  dependent)│
│ [Objects]    │                                      │            │
│ [Zones]      │                                      │            │
│ [Paths]      │                                      │            │
│              │                                      │            │
├──────────────┴──────────────────────────────────────┴────────────┤
│ Bottom Panel: Metrics | Timeline | Before/After | Threats | AI   │
└──────────────────────────────────────────────────────────────────┘
```

### Camera Wall Mode (toggleable)

```
┌──────────────────────────────────────────────────────────────────┐
│ ┌────────────────────┐  ┌────────────────────┐                   │
│ │ Camera 1 feed      │  │ Camera 2 feed       │                   │
│ │ [00:14:23] CAM-01  │  │ [00:14:23] CAM-02  │                   │
│ │                    │  │                    │                   │
│ └────────────────────┘  └────────────────────┘                   │
│ ┌────────────────────┐  ┌────────────────────┐                   │
│ │ Camera 3 feed      │  │ 3D Map view        │                   │
│ │ [00:14:23] CAM-03  │  │ + heatmap          │                   │
│ │                    │  │ + path overlay     │                   │
│ └────────────────────┘  └────────────────────┘                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Physics Integration (Rapier — Optional)

Physics is NOT core to the security simulation. It's an enhancement for:
- Drag-and-drop collision with walls (prevent objects from overlapping)
- Door/gate open/close animations
- Person path collisions

When Rapier is enabled, each node gets a physics collider in addition to its vision collider.
These are separate objects with different shapes (a glass wall has identical physics/vision
colliders for movement, but different transmission for vision).

The physics collider is NOT used for camera raycasting. The vision collider mesh is used.

---

## WebGPU Strategy

Pascal Editor uses WebGPU-oriented rendering. SentinelTwin inherits this.

V0.1: Standard WebGL fallback acceptable. Most machines support WebGPU in Chrome now.

Future WebGPU compute shaders could accelerate:
- Coverage grid computation (replace Three.js raycasting with GPU compute)
- Adversarial path graph on very large scenes (warehouse, campus)
- Heatmap generation for high-resolution grids (100×100+)

Do NOT build for WebGPU compute in V0.1. Profile first.

---

## Debug Mode

Toggleable in the 3D scene via keyboard shortcut or settings panel:

```
[D] Show coverage sample grid points
[R] Show raycasts as lines
[O] Show occlusion hit markers
[F] Show camera frustum bounds (wireframe)
[B] Show BVH bounding boxes
[P] Show path sample points
[T] Show recompute timer
[V] Show vision colliders (separate from visual mesh)
```

The debug overlay is invaluable for building and makes the simulation visually credible
to technical reviewers.
