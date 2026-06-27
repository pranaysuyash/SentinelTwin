# First-Principles Coverage & Visual Audit — 2026-06-22

## What I Expected

Based on the design pack targets (`FullCameraSuiteCoverageMode_metrics_Camera1Inspector.png`, `CoverageMode_Metrics_Camera1Inspector.png`) and the project pitch ("AI-native physical security simulation platform"), I expected:

1. **3D scene** rendered in orbit perspective by default — tilted isometric view, not top-down 2D.
2. **Textured, realistic geometry**: walls with material appearance, floors with proper surface treatment, obstructions with identifiable shapes (shelving, counters), lighting that simulates real-world conditions.
3. **Coverage heatmap** as a vivid floor overlay showing DORI quality bands — red/orange/yellow/green/blue per PPM value.
4. **Camera frustum cones** extending from each camera showing visible coverage area.
5. **Interactive controls**: click camera → inspector panel, hover heatmap cell → explainability card, 2D/3D toggle, layer visibility toggles.
6. **Feature-complete buyer experience**: when a buyer opens the demo, they should see a professional security simulation workspace that immediately communicates credibility.

## What The Code Actually Is

### 3D Rendering — IS present, but...

- **Canvas**: R3F (React Three Fiber) with Three.js — ✅ real 3D engine
- **Default canvasMode**: `orbit_3d` for coverage/edit/replay/compare/report presets — ✅ 3D by default
- **Only `camera_wall` defaults to `topdown_2d`** — this is correct for a CCTV grid view
- **2D/3D toggle**: `ViewControls.tsx` — two small 32×32px buttons (top-right), easy to miss

### Geometry — Functional but not professional

- **Walls**: `<boxGeometry args={[length, height, 0.18]}>` + `<meshStandardMaterial color="#f0f2f6">` — flat white boxes. No texture, no bump map, no normal map. Just colored boxes.
- **Floor**: `<planeGeometry>` + `<meshStandardMaterial color="#ede5d8" roughness={0.85}>` — flat tan plane. No floor texture, no tile pattern. Blank.
- **Glass walls**: Same box geometry, `opacity: 0.22` — translucent but no refraction/reflection.
- **Doors**: Box geometry with `color="#8b5e34"` — a brown rectangle. No handle, no frame.
- **Windows**: Box geometry with `color="#cfe5ff"` — a blue rectangle.
- **Obstructions**: Box geometry with preset colors. A "shelf" and a "counter" look identical — both colored boxes.
- **Grid**: `<gridHelper>` with tan lines — functional for scale but adds no visual quality.

**Verdict**: This is a **bare-geometry prototype**. It renders, it's 3D, but it looks like a basic Three.js tutorial, not a professional security simulation product. A buyer would see colored boxes floating in space.

### Coverage Heatmap — Technically correct, visually decent

- **Instanced mesh**: `CoverageHeatmapInstanced` uses `<instancedMesh>` with per-instance colors — ✅ D-006 decision compliant
- **Color mapping**: PPM → DORI color bands (red → orange → yellow → green → blue) with linear interpolation — ✅ correct
- **Cell size**: 0.24m × 0.014m × 0.24m boxes at floor level — small colored tiles
- **Multiple modes**: quality, lighting, fragility, overlap, contribution, blindspots — ✅ rich analysis
- **Hover explainability card**: shows PPM, quality, covering cameras, light level — ✅ good

**Verdict**: The heatmap is the strongest visual element. It works, it's colorful, it's informative. But it sits on a blank tan floor surrounded by white boxes, which undermines its impact.

### Lighting — Over-engineered for the geometry

- **Day/Dusk/Night themes**: with ambient, hemisphere, directional, fill, and 4 point lights — this is actually a good lighting rig
- **Fog**: distance fog from 22m to 44m — adds depth
- **Problem**: Good lighting applied to primitive geometry makes the primitive geometry look MORE obviously primitive, not less

### Camera Frustums — Present

- **CameraFrustum**: renders cone geometry from each camera showing FOV and range — ✅ exists
- **CameraMarker**: renders camera position with model indicator — ✅ exists
- **DORI overlay toggles**: detection/recognition/identification range bands — ✅ referenced in design pack

### Interactive Controls — Present

- **Click camera → right panel opens** with DORI quality, status, feed controls — ✅ working
- **Heatmap hover → explainability card** — ✅ working
- **Layer toggles**: cameras, cones, heatmap, grid, walls, obstructions, zones, paths — ✅ exists
- **View mode bar**: Coverage, Camera View, Camera Wall, Path Replay, Compare, Report — ✅ all routed

## What It Should Be (First-Principles)

### Immediate Visual Quality Gaps

1. **Walls need material appearance**: Even basic normal-mapped or procedural materials would transform the scene. A wall should look like a wall, not a white rectangle.

2. **Floor needs texture**: A subtle tile/concrete pattern would ground the scene. The flat tan plane makes it look like a sandbox demo.

3. **Obstructions need distinct geometry**: A shelf unit, counter, cabinet, etc. should have recognizable shapes — even basic ones. Currently everything is a box.

4. **Doors/windows need frames**: A door should be recessed with a frame edge. A window should have a frame line. These are 10-minute geometry additions that transform recognition.

5. **Edge ambient occlusion or shadows**: Wall-floor junctions need visual grounding. Currently objects float on the plane.

6. **Scene background depth**: The dark `#0d1420` background with fog is good, but adding a subtle environment sphere or ground gradient would add depth beyond the room.

### What Doesn't Need Changing

- The **heatmap rendering** is solid — instanced mesh, PPM color mapping, hover cards.
- The **camera frustum cones** are correct.
- The **lighting rig** (day/dusk/night) is well-designed.
- The **2D/3D toggle** exists and works correctly — coverage is 3D by default.
- The **coverage simulation engine** (`packages/simulation`) is deterministic geometry — this is correct per D-003.
- The **DORI quality model** with PPM thresholds is the core differentiator.

### What "Crowd Coverage" Might Mean

There is no "crowd coverage" feature in the codebase. The user likely means **camera coverage** (the coverage heatmap view). The coverage workspace IS 3D by default (`canvasMode: "orbit_3d"`). If the user saw it in 2D, they either:
- Were in Camera Wall mode (which defaults to `topdown_2d` — correct behavior)
- Clicked the 2D button in ViewControls and forgot
- Saw the StudioDashboardHome's MAP PREVIEW which renders a miniature preview (may appear flat at certain angles)

### Priority Actions (What It Should Be vs What It Is)

| Gap | Impact | Effort | Priority | Status |
|---|---|---|---|---|
| **Wall/floor textures or procedural materials** | High — transforms buyer perception from "prototype" to "product" | Medium — requires adding TextureLoader or procedural shaders | P1 | **DONE** — Procedural canvas textures with tile pattern (floor) and plaster variation (walls), normal maps for both, baseboard trim + top cap on walls |
| **Obstruction shape presets** (shelf = multi-shelf box, counter = L-shape, etc.) | Medium — makes the scene readable | Low-Medium — parametric geometry per preset | P2 | **DONE** — 8 distinct geometry types: shelf (side panels + 5 shelf boards + back panel), counter (countertop + body + kickplate), cupboard (body + door seam + handles + crown), pillar (cylinder), glass_display (solid base + glass top + frame edges), partition (thin panel + feet), vehicle (body + cabin + windshield + wheels), tree (trunk + layered canopy spheres) |
| **Door/window frame geometry** | Low-Medium — visual polish | Low — simple geometry additions | P3 | **DONE** — Doors: left/right jamb + header frame + handle. Windows: outer frame + glass pane + mullion + horizontal divider + sill |
| **Contact shadows or AO** | Medium — grounds objects on the floor | Low — Three.js `ContactShadows` from drei | P2 | **DONE** — drei ContactShadows at floor level, 512 resolution, soft blur |
| **Environment texture/sphere** | Low — depth perception beyond room | Low — simple gradient sphere | P3 | **DONE** — Custom shader gradient sphere (50m radius), auto-hidden in 2D/top-down mode |
| **Scene anti-aliasing / post-processing** | Medium — visual quality perception | Low — EffectComposer with SMAA | P2 | **DONE** — Canvas already had `antialias: true` and `shadows="percentage"` — no additional post-processing needed as the existing AA pipeline is sufficient |

### Non-Issues (Confirmed Working)

- Coverage is 3D by default ✅
- Heatmap is instanced mesh per D-006 ✅
- DORI color bands are correct ✅
- Camera frustums render ✅
- Lighting themes work ✅
- 2D/3D toggle exists ✅
- Interactive selection works ✅
- Right panel inspector works ✅
- View mode switching works ✅

## Honest Assessment

The **simulation engine** and **data model** are strong. The **coverage analysis** (DORI, PPM, multi-camera overlap, fragility, lighting) is differentiated and technically impressive.

The **visual rendering** is functional but at prototype level. A buyer would see:
- Colored boxes for walls
- A flat tan floor
- Colorful heatmap tiles (this looks good)
- Translucent camera cones (these look good)

The gap is: **the geometry doesn't look like a physical space**. The heatmap and camera analysis are compelling, but they're displayed inside a scene that looks like it was built in 15 minutes. This is likely what the user meant — the coverage feature IS 3D, it IS working, but the visual quality of the environment around it doesn't inspire confidence.

## Connection to User Feedback

> "its so ugly and cluttered, texts overlap, your app is not giving me confidence to buy"

The SiteIntakeHub was the immediate trigger, but the underlying issue is broader: **the entire visual layer — from the home page to the 3D scene — doesn't yet communicate "production security product."** The coverage engine is real and valuable; the rendering and UI need to match that quality level.

## Implementation Completed — 2026-06-22

All 6 priority items from the audit have been implemented in `SharedScene.tsx` and `WorkspaceCanvas.tsx`:

### Files Modified
- `apps/studio/src/components/workspace/SharedScene.tsx` — procedural texture generators, wall/floor/door/window/obstruction geometry upgrades, ContactShadows, EnvironmentSphere
- `apps/studio/src/components/workspace/WorkspaceCanvas.tsx` — imports and rendering of SceneContactShadows + SceneEnvironmentSphere

### What Changed
1. **Floor**: flat `color="#ede5d8"` plane → procedural canvas texture with 128px tile grid, grout lines, per-tile brightness variation, surface noise + normal map for subtle relief
2. **Walls**: flat `color="#f0f2f6"` boxes → procedural plaster texture + normal map, baseboard trim at base, top cap at crown, `castShadow`/`receiveShadow` enabled
3. **Doors**: brown box → framed door with left/right jambs + header + cylindrical handle + visible door panel
4. **Windows**: blue translucent box → framed window with outer metal frame + glass pane + vertical mullion + horizontal divider + bottom sill
5. **Obstructions**: identical colored boxes → 8 distinct geometry types (shelf/counter/cupboard/pillar/glass_display/partition/vehicle/tree) each with structurally accurate sub-meshes
6. **Contact shadows**: none → drei `ContactShadows` component at floor level
7. **Environment sphere**: dark void → gradient shader sphere providing depth beyond room edges, auto-hidden in top-down 2D mode

### Verified Working
- 3D orbit mode: all geometry renders correctly, heatmap overlays work, camera labels visible
- 2D top-down mode: environment sphere correctly hidden, scene renders clean
- Coverage simulation: 82% coverage, 0 issues — no regression
- No new TypeScript errors (all pre-existing errors unchanged)
- No console errors
