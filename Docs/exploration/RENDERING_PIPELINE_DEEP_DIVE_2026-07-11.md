# Rendering Pipeline — Deep Dive (2026-07-11)

## Overview

The rendering pipeline is how SentinelTwin visualizes the 3D security scene, coverage overlays, camera cones, DORI quality arcs, heatmap rendering, blind spot highlights, and path replay animation. It uses React Three Fiber (R3F) with WebGL, with an adaptive performance system that scales quality based on GPU capability.

---

## 4 Canvas Modes

| Mode | Component | Canvas Count | DPR Range | Purpose |
|------|-----------|-------------|-----------|---------|
| **Map View** | `WorkspaceCanvas.tsx` | 1 | [1, 2] | Full 3D workspace with orbit controls |
| **Camera View** | `CameraViewMode.tsx` | 1 | [0.85, 1.5] | Single-camera POV with post-processing |
| **Camera Wall** | `CameraWallView.tsx` | 4–16 | [0.5, 1.25] | Multi-tile grid with live feed support |
| **Path Replay** | `PathReplayView.tsx` | 1 | [0.85, 1.5] | Animated actor with visibility timeline |

---

## 3 Quality Tiers (`r3f-rendering.ts`)

```typescript
high:   { IBL: 0.7, shadows: 2048, AA: true,  GPU: "high-performance" }
medium: { IBL: 0.55, shadows: 1024, AA: true, GPU: "default" }
low:    { IBL: 0.4, shadows: none, AA: false, GPU: "low-power" }
```

- **RoomEnvironment** procedural IBL (zero network, PMREMGenerator)
- **ACES Filmic** tone mapping everywhere, sRGB output
- **PCF shadow maps** capped at 2048×2048
- **Shadow caster**: single directional light per canvas, auto-sized to scene dimensions

---

## Adaptive DPR Budget (`adaptive-dpr-budget.ts`)

```
PerformanceMonitor samples FPS over 300ms windows (12 iterations)
  → DPR step: 0.05 (prevents popping)
  → Flip-flop threshold: 5 before fallback
  → Wall dense: [0.5, 1.0], Wall normal: [0.75, 1.25]
  → Single canvas: [0.85, 1.5]
```

### Wall Multi-Tile Budget
- Target FPS: 45
- Decline threshold: 35 FPS
- Incline threshold: 55 FPS
- Max draw calls per tile: 120
- Max GPU memory per tile: 80 MB

### Single Canvas Budget
- Target FPS: 50
- Decline threshold: 40 FPS
- Incline threshold: 58 FPS

---

## Shared Scene Components (`SharedScene.tsx` — 1,600+ lines)

| Component | What It Renders |
|-----------|----------------|
| `SceneFloor` | Textured plane + grid helper, PBR materials |
| `SceneWalls` | Box geometry, glass/solid materials, baseboard trim |
| `SceneDoors` | Frame + panel + handle, open/closed/locked states |
| `SceneWindows` | Glass pane with mullions, curtain/reflective states |
| `SceneObstructions` | 8 type-specific geometries (shelf, counter, pillar, vehicle, tree...) |
| `ScenePrivacyZones` | Shape geometry with restriction-colored fills |
| `PathActor` | Capsule-based human figure, RAF-animated along waypoints |
| `CoverageTileFloor` | Instanced mesh for 0.25m coverage tiles |
| `CoverageHeatmapInstanced` | 6-mode heatmap (quality/lighting/fragility/overlap/contribution/blindspots) |
| `CoverageSegmentPath` | DORI-quality-colored path segments |
| `CrowdChokepointOverlay` | Occlusion probability rings |

### Obstruction Type-Specific Geometries

| Type | Geometry |
|------|----------|
| shelf | Side panels + back panel + shelf boards |
| counter | Countertop + body + kickplate recess |
| cupboard | Main body + door seam + handles + crown |
| pillar | Cylinder geometry |
| glass_display | Base cabinet + glass top + frame edges |
| partition | Thin panel + feet |
| vehicle | Body + cabin + windshield + wheels |
| tree | Trunk + layered sphere canopy |

---

## DORI Band Arcs (`DoriBandArcs.tsx`)

Computes distance for each DORI threshold from camera resolution + FOV:

```typescript
distance = resolutionWidthPx / (2 * targetPpm * tan(fovRad / 2))
```

| Quality | PPM Threshold | Example Distance (2MP, 110° FOV) |
|---------|---------------|-----------------------------------|
| Identification | 250 PPM | ~5m |
| Recognition | 125 PPM | ~10m |
| Observation | 62.5 PPM | ~20m |
| Detection | 25 PPM | ~50m |

Renders concentric ring meshes at floor level, color-coded: blue → green → yellow → amber.

---

## Heatmap Rendering (6 Modes)

All use **instanced mesh** with vertex colors for 6,400+ cells at 60fps.

| Mode | Color Mapping | Purpose |
|------|---------------|---------|
| **quality** | PPM-based: red→orange→yellow→green→blue | DORI quality at each cell |
| **lighting** | Shadow/light level: dark→blue→amber→yellow | Illumination quality |
| **fragility** | Near-threshold: green→amber→red | Coverage stability |
| **overlap** | Camera count: red(1)→yellow(2)→green(3+) | Redundancy |
| **contribution** | Single-camera dependency | Single-point-of-failure |
| **blindspots** | Binary: red(uncovered)→green(covered) | Uncovered regions |

---

## Path Replay Animation (`PathReplayView.tsx` — 1,500+ lines)

1. **RAF-driven playback** at 0.5×/1×/2×/4× speed
2. **Legalized waypoints**: collision detection against obstructions, walkability grid snap
3. **Coverage quality bands** on scrub bar (segment-colored by DORI quality)
4. **Current visibility panel**: visible/lost camera state at current time
5. **Visibility timeline**: per-camera visible/lost events
6. **Camera cones** rendered during replay with color per camera ID
7. **Collision markers**: orange ring at raw position, green ring at corrected position
8. **PathActor**: animated capsule-based human figure with shadow

---

## Camera Wall (`CameraWallView.tsx` — 900+ lines)

- **4 layout modes**: quad (2×2), overview (3×2), dense (4×4), auto (adaptive)
- Each tile is an **independent R3F canvas** with `frameloop="demand"`
- **Live feed support**: `<video>` element for bound RTSP/HLS streams
- **Dense mode performance guard**: warns about 16-canvas GPU cost
- **Wall overview panel**: mini 3D map with heatmap overlay
- **Route context**: best camera, weak-route count, risk indicator

---

## Camera View (`CameraViewMode.tsx` — 600+ lines)

- Single-camera POV with perspective camera matching camera specs
- **Post-processing filters**: normal, IR/B&W, low-light, enhanced
- **DORI arcs** overlay showing quality bands
- **Camera position indicator** with floor aim ray
- **Verification overlay**: side-by-side comparison with real footage
- **Replay actor** visible during path replay

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `apps/studio/src/lib/r3f-rendering.ts` | 3 quality tiers, IBL setup, shadow caster | 200 |
| `apps/studio/src/lib/adaptive-dpr-budget.ts` | DPR budget for wall + single canvas | 120 |
| `apps/studio/src/components/workspace/SharedScene.tsx` | All shared 3D scene components | 1,600+ |
| `apps/studio/src/components/view/DoriBandArcs.tsx` | DORI quality arc overlays | 80 |
| `apps/studio/src/components/view/CameraViewMode.tsx` | Single-camera POV canvas | 600+ |
| `apps/studio/src/components/view/CameraWallView.tsx` | Multi-tile camera wall | 900+ |
| `apps/studio/src/components/view/PathReplayView.tsx` | Path replay animation | 1,500+ |
| `apps/studio/src/components/workspace/WorkspaceCanvas.tsx` | Main map workspace canvas | 1,100+ |
| `apps/studio/src/lib/three-compat.ts` | Three.js compatibility patches | 50 |
| `apps/studio/src/lib/scene-appearance.ts` | Environment themes + material resolution | 200 |
| `apps/studio/src/lib/pbr-materials.ts` | PBR material factory | 150 |
| `Docs/architecture/07_RENDERING_PIPELINE.md` | Architecture documentation | 200 |

---

## Related Exploration Threads

- Thread 160: Rendering Pipeline (this document's index in EXPLORATION_MAP.md)
- `3D_REALISTIC_RENDERING_ROADMAP_2026-07-04.md` — Rendering quality roadmap
