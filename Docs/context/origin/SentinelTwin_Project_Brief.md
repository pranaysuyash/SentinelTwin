# SentinelTwin — AI Security Digital Twin / Camera Coverage Testbed

**Working project doc for hackathon exploration, AI feedback, architecture planning, and agent task splitting.**

---

## 0. One-line Summary

**SentinelTwin is an AI security digital twin that lets security agencies, CCTV installers, facility managers, and site owners test camera coverage, blind spots, lighting, obstructions, camera placement, incident paths, and practical fixes inside an interactive Three.js simulation.**

---

## 1. Core Thesis

Most security camera setups are installed with a false sense of coverage.

A camera may technically “see” an area, but the footage may not be useful for:

- detecting a person,
- observing activity,
- recognizing a person,
- identifying a face,
- reading a license plate,
- proving what happened during an incident,
- covering a critical zone at night,
- remaining useful if one camera fails,
- avoiding privacy-sensitive areas,
- handling obstructions like shelves, pillars, cupboards, vehicles, gates, windows, glare, or low light.

Existing CCTV planning tools often focus on static camera field-of-view and lens calculations. SentinelTwin should go further:

> **Not just “where does the camera point?” but “what security outcome does this setup actually achieve?”**

The eventual product should support:

- manually created security scenes,
- AI-generated floor plans,
- uploaded floor plans / blueprints,
- guided camera/photo scans,
- imported GLB/OBJ/RoomPlan/Polycam/Kiri/Scaniverse-style captures,
- existing camera screenshots/videos,
- incident replay,
- counterfactual fixes,
- client-ready audit reports.

But the first build should start with a strong **Camera Testbed**.

---

## 2. Current Recommended Strategy

### Build V0.1 first: Camera Coverage Testbed

Before floor-plan parsing, guided scan reconstruction, AI video analysis, or 3D capture import, the project needs a solid engine:

```txt
scene
→ cameras
→ objects
→ lights
→ target/path
→ visibility calculation
→ blindspots
→ camera views
→ before/after deltas
→ report summary
```

If this core simulation loop works, every later input method can plug into it.

### Why V0.1 should be the Camera Testbed

Because it proves the core product value:

- move camera → coverage changes,
- change FOV → coverage changes,
- change resolution → quality changes,
- switch day/night → quality changes,
- turn light on/off → quality changes,
- move cupboard/shelf → blindspot changes,
- turn a camera off → redundancy failure appears,
- replay path → subject is visible/lost/recognized/blocked,
- save before/after → client recommendation becomes concrete.

This is the spine of SentinelTwin.

---

## 3. Product Vision

### Long-term vision

**SentinelTwin becomes a Figma-like security simulation system for physical spaces.**

A user can:

1. create or import a site,
2. place/edit cameras, lights, objects, doors, windows, and zones,
3. simulate coverage and blind spots,
4. test “what if” changes,
5. replay defensive incident paths,
6. verify against real camera recordings,
7. generate client-ready audit reports.

### Important positioning

This is not a tool for helping criminals avoid cameras.

The product is for:

- authorized security auditing,
- CCTV design,
- facility hardening,
- post-incident coverage analysis,
- client proposal generation,
- blindspot reduction,
- risk mitigation.

Use defensive language:

- “authorized incident replay,”
- “coverage failure analysis,”
- “hardening recommendations,”
- “security audit,”
- “risk reduction.”

Avoid language like:

- “robber route optimization,”
- “avoid cameras,”
- “bypass security.”

---

## 4. Target Users

### Primary users

- CCTV installers
- Security agencies
- Facility managers
- Retail store owners
- Apartment/security managers
- Warehouse managers
- School/campus administrators
- Event venue operators
- Hotel/security teams
- Factory/site safety teams

### Secondary users

- Insurance/risk auditors
- Smart building consultants
- Physical security consultants
- Construction/site planners
- Real-estate/property managers
- AI/CV/security researchers

---

## 5. Main Use Cases

### 5.1 New Setup Design

User wants to plan cameras before installation.

Input:

- room/site layout,
- critical zones,
- camera budget,
- camera presets/specs,
- day/night requirements.

Output:

- suggested placements,
- coverage map,
- blindspots,
- weak zones,
- camera count,
- report/proposal.

### 5.2 Existing Setup Audit

User has cameras already installed.

Input:

- approximate layout,
- camera locations,
- model/specs,
- screenshots/video later,
- critical zones.

Output:

- blindspots,
- weak recognition/identification zones,
- camera overlap,
- camera failure impact,
- practical fixes.

### 5.3 Counterfactual Fix Testing

User asks:

- “Camera cannot move; what else can change?”
- “What if this shelf moves?”
- “What if we add a light?”
- “What if we change FOV?”
- “What if this window is raised?”
- “What if Camera 1 turns off?”
- “What if this door is open at night?”

Output:

- before/after comparison,
- blindspot delta,
- coverage quality delta,
- recommendation.

### 5.4 Defensive Incident Replay

User draws or describes a path:

- entry door → cash counter → storage room,
- gate → parking → lobby,
- corridor → stairwell,
- warehouse bay → rack area.

System shows:

- which cameras saw the subject,
- when the subject was lost,
- whether visibility was detection/observation/recognition/identification,
- whether low light or obstruction caused failure,
- recommended fixes.

### 5.5 Future: Real Camera Verification

Later, user clicks a camera in the plan and attaches a real recording/screenshot.

System compares expected vs actual view:

- does the camera match simulated angle?
- are expected landmarks visible?
- is a shelf/cupboard blocking the view?
- is camera too high/low/blurred/dirty/dark?
- does the real feed match the planned coverage?

---

## 6. Product Roadmap

### V0.1 — Camera Coverage Testbed

Focus: manual/procedural scene + cameras + coverage engine.

Must prove:

- place cameras,
- move/rotate/tilt cameras,
- change FOV/resolution/clarity,
- toggle camera on/off,
- add/move obstructions,
- add/move lights,
- day/night mode,
- raycast-based visibility,
- blindspot heatmap,
- camera view mode,
- person/path replay,
- before/after snapshots,
- report-lite summary.

### V0.2 — AI Layout Draft + 2D Plan Editor

Focus: prompt-to-plan.

User prompt:

> “Create a 10m x 7m electronics shop with front entrance, two shelves, cash counter, back storage, and two cameras.”

Output:

- editable 2D plan,
- draggable cameras,
- objects/zones,
- convert to 3D scene.

### V0.3 — Floor Plan Upload

Focus: image/PDF blueprint import.

Features:

- upload floor plan,
- set scale,
- manually/AI-detect walls/doors/windows,
- correct detected geometry,
- convert to SecurityScene.

### V0.4 — Guided Camera Scan

Focus: no floor plan.

Flow:

- point at wall,
- tap/select wall,
- segment/classify,
- set known measurement,
- add doors/windows/cupboards/cameras,
- build approximate Three.js scene.

### V0.5 — Real Camera Snapshot/Video Verification

Focus:

- attach screenshot/video to camera,
- understand visible objects,
- compare to simulated view,
- estimate camera mismatch/obstructions,
- produce verification report.

### V1.0 — Security Digital Twin Product Demo

Combines:

- AI layout / floor plan / guided scan,
- 2D + 3D editing,
- coverage simulation,
- counterfactuals,
- incident replay,
- report export.

---

## 7. V0.1 Camera Testbed: Core Feature Set

### 7.1 Scene

A procedural 3D environment with:

- floor,
- walls,
- doors,
- windows,
- shelves/cupboards/counters/pillars,
- lights,
- cameras,
- critical zones,
- paths,
- person/vehicle actors.

The scene should be generated from JSON.

### 7.2 Cameras

Cameras should be first-class interactive objects.

Editable properties:

```txt
position
mount height
mount type: wall / ceiling / pole / corner
yaw
pitch
roll optional
FOV horizontal
FOV vertical
resolution MP
clarity
status: on / off / blocked / dirty
night mode: none / IR / low-light / thermal
IR/night range
fixed/PTZ
```

Interactions:

- drag camera,
- snap to wall,
- move up/down,
- rotate yaw,
- tilt pitch,
- aim at zone/object/path,
- view through camera,
- toggle on/off,
- change FOV,
- change resolution,
- change night mode.

### 7.3 Lights

Lights should affect night quality.

Types:

- ceiling light,
- wall light,
- flood light,
- street light,
- emergency light.

Editable properties:

```txt
position
height
direction
range
brightness
status on/off
cone angle
night active yes/no
```

V0.1 approximation:

- night + no light + no IR = degrade quality,
- night + IR within range = partial recovery,
- night + good light = improve quality,
- thermal = strong detection but weaker identification.

### 7.4 Obstructions / Objects

Objects that can block or modify visibility:

- cupboard,
- shelf,
- counter,
- pillar,
- tree,
- parked vehicle,
- partition,
- gate,
- glass display,
- curtain,
- signboard,
- storage boxes.

Editable properties:

```txt
position
rotation
width
depth
height
material: solid / glass / grill / mesh / curtain / reflective / partial
movable yes/no
blocksVision yes/no
```

Important distinction:

- physics collider,
- vision collider,
- visual mesh.

Example:

- glass wall blocks people but may not fully block camera,
- grill partially blocks,
- cupboard fully blocks,
- curtain partially blocks and degrades clarity.

### 7.5 Doors / Windows

Doors:

```txt
open/closed
swing direction
width
height
entry/exit point yes/no
restricted yes/no
```

Windows:

```txt
height from floor
width
glass/grill/open
raised/lowered
possible entry/visibility path
```

### 7.6 Critical Zones

Critical zones are regions that require specific coverage quality.

Examples:

- cash counter,
- locker,
- server room,
- storage door,
- main entry,
- parking gate,
- reception desk,
- staircase,
- corridor turn.

Properties:

```txt
polygon
priority: low / medium / high
required quality: detection / observation / recognition / identification
night required: yes/no
privacy zone: yes/no
```

System should report:

```txt
Cash Counter
Required: Recognition
Current: Observation
Status: Fails requirement
```

### 7.7 Target Types

Different security tasks require different quality.

Target presets:

- person detection,
- face recognition,
- face identification,
- vehicle detection,
- license plate recognition,
- package/object detection,
- cash counter activity,
- door entry/exit.

The testbed should let user select a target type and update required scoring.

### 7.8 Scenario Presets

One-click scenario presets:

- daytime entry,
- night entry,
- camera failure,
- light failure,
- person behind shelf,
- vehicle at gate,
- door left open,
- cash counter approach,
- storage room access.

### 7.9 Failure Modes

Must support:

- camera offline,
- camera dirty/blurred,
- camera blocked,
- camera wrong angle,
- light off,
- power failure zone,
- door open/closed,
- shelf moved,
- vehicle parked,
- night mode,
- glare/backlight risk.

### 7.10 Camera Feed View

View modes:

- Map View,
- Camera 1 View,
- Camera 2 View,
- Camera Wall,
- Before/After Split.

Camera wall layout:

```txt
┌─────────────┬─────────────┐
│ Camera 1    │ Camera 2    │
├─────────────┼─────────────┤
│ Camera 3    │ 3D Map      │
└─────────────┴─────────────┘
```

Camera-feed overlays:

- timestamp,
- camera name,
- grayscale IR/night view,
- thermal palette later,
- noise/blur/dirty-lens effect,
- subject bounding marker,
- “lost behind shelf,”
- “detection only,”
- “recognition weak.”

---

## 8. V0.1 Screens / Layout

### 8.1 Main Workspace

```txt
┌──────────────────────────────────────────────┐
│ Top bar: Project / Mode / View / Save        │
├──────────────┬───────────────────┬───────────┤
│ Object Tray  │ 3D Scene           │ Inspector │
│              │ + overlays         │           │
├──────────────┴───────────────────┴───────────┤
│ Metrics / Timeline / Command Bar             │
└──────────────────────────────────────────────┘
```

### 8.2 Left Object Tray

Objects:

- camera,
- light,
- wall,
- door,
- window,
- shelf,
- cupboard,
- counter,
- pillar,
- person path,
- vehicle path,
- critical zone,
- privacy zone.

### 8.3 Center 3D Canvas

Features:

- procedural scene,
- camera cones,
- blindspot heatmap,
- path replay,
- ray/debug overlay,
- camera view switching,
- transform controls.

### 8.4 Right Inspector

Changes depending on selected object.

Camera inspector:

```txt
Camera 1
Status: On / Off
Mount: Wall
Height: 2.8m
Position: x/z
Yaw: 45°
Pitch: -18°
FOV: 90°
Resolution: 4MP
Clarity: Good
Night: IR
IR Range: 20m
[View from Camera]
[Show Cone]
[Show Blocked Rays]
```

Object inspector:

```txt
Cupboard 1
Role: Obstruction
Movable: Yes
Width/Depth/Height
Material: Solid
Blocks Camera: Yes
[Test without this]
[Move to wall]
```

Zone inspector:

```txt
Cash Counter Zone
Priority: High
Required: Recognition
Night required: Yes
Current: Observation
Status: Fails
```

### 8.5 Bottom Panel

Tabs:

- Metrics,
- Timeline,
- Before/After,
- Debug,
- AI Command.

Example metrics:

```txt
Total coverage: 78%
Blindspot: 22%
Critical zone pass: 2/4
Entry path visible: 6.4s / 12s
Identification-quality area: 31%
Worst issue: shelf blocks Camera 1 near counter
```

---

## 9. Simulation Model

### 9.1 Basic Visibility Algorithm

For each camera and each sampled point/path point:

```txt
1. Is camera on?
2. Is point inside horizontal/vertical FOV?
3. Is point within camera range?
4. Raycast camera → point.
5. If ray hits wall/solid obstruction first, mark blocked.
6. Estimate quality using distance, FOV, resolution, clarity, angle, lighting.
7. Apply day/night/IR/thermal/material penalties.
8. Classify as none/detection/observation/recognition/identification.
```

### 9.2 Coverage Quality Categories

Use estimated categories:

```txt
None
Detection
Observation
Recognition
Identification
```

Do not overclaim forensic certainty. Use wording:

- “estimated recognition-quality,”
- “likely detection only,”
- “identification not expected under current assumptions.”

### 9.3 Simplified Quality Formula

A simple scoring model can combine:

```txt
distance score
resolution score
FOV penalty
clarity penalty
lighting penalty
angle penalty
occlusion/material penalty
```

Possible rough flow:

```txt
baseDetail = resolutionMP / distance²
fovPenalty = narrower FOV improves detail, wider FOV reduces detail
lightingPenalty = day/night/IR/light conditions
clarityPenalty = dirty/blurred/compressed feed
anglePenalty = steep angles reduce face/plate usefulness
materialPenalty = glass/glare/grill/partial obstruction
```

Then map numeric score to category.

### 9.4 DORI-like Zones

V0.1 can use simplified DORI-like labels. Later, add more standards-based calculation.

Important statement:

> DORI-style labels are estimated planning indicators, not legal guarantees.

### 9.5 Night / IR / Thermal Approximation

Simplified rules:

```txt
Day: normal quality.
Night + no light + no IR: degrade 2 levels.
Night + IR in range: degrade 1 level.
Night + good light: normal/slight degradation.
Thermal: strong detection, weak identification unless specified.
Dirty/blurred camera: degrade 1–2 levels.
Backlight/glare: degrade face/plate recognition.
```

### 9.6 Redundancy Analysis

Add modes:

- normal,
- Camera 1 offline,
- Camera 2 offline,
- all lights off,
- night only,
- power failure zone,
- obstruction added.

Output example:

```txt
Cash counter loses all recognition-quality coverage if Camera 1 goes offline.
```

---

## 10. Procedural Asset Strategy

### Principle

Use procedural geometry as simulation truth.

```txt
procedural blocks = collision / occlusion / visibility truth
pretty assets = optional visual layer
```

### Procedural objects

Generate:

- walls,
- floors,
- doors,
- windows,
- shelves,
- cupboards,
- counters,
- pillars,
- cameras,
- lights,
- person silhouette,
- vehicle placeholder.

Each object should produce:

```ts
{
  visualMesh,
  colliderMesh,
  visionCollider,
  metadata
}
```

### Why procedural-first is better

For simulation, clean cuboids/planes are more reliable than beautiful but messy meshes.

A generated/CC0 mesh may look good but can break raycasting and measurement. Therefore:

- use cuboids/planes/cylinders for simulation,
- optionally attach decorative low-poly mesh.

### CC0 / free asset sources to explore

- Poly Haven — CC0 textures, HDRIs, models
- ambientCG — CC0 PBR materials
- Quaternius — CC0/free low-poly models
- Kenney — free prototype/game assets

Use assets only for polish:

- camera body,
- person silhouette,
- light fixture,
- shelf/counter visual,
- icons/UI.

---

## 11. Physics Strategy

### Recommendation

Use physics only where it changes outcomes.

Core coverage simulation is raycasting/geometry, not physics.

### Best browser/R3F physics option

**Rapier + @react-three/rapier**

Useful for:

- person/vehicle movement constraints,
- collision with walls/objects,
- draggable object collision,
- doors/gates,
- sensors,
- later crowd/queue prototypes.

### Do not overuse physics in V0.1

Avoid:

- ragdolls,
- soft bodies,
- realistic vehicles,
- destructible scenes,
- complex crowds.

### Physics vs vision colliders

Important distinction:

- physics collider: blocks movement,
- vision collider: blocks camera rays,
- visual mesh: what the user sees.

Example:

```txt
Glass wall:
- blocks person movement
- may not block camera fully
- may add glare penalty

Grill:
- blocks person movement
- partially blocks/degrades vision

Cupboard:
- blocks movement
- blocks camera fully
```

---

## 12. Rendering / Animation / Performance Strategy

### Core stack

```txt
Next.js
TypeScript
React
Three.js
@react-three/fiber
@react-three/drei
Zustand
GSAP
Tailwind / shadcn/ui
three-mesh-bvh if needed
@react-three/rapier optional
```

### GSAP

Use GSAP for:

- replay timelines,
- camera flythroughs,
- camera switching,
- before/after transitions,
- FOV cone animation,
- report/demo animations.

Do not use GSAP for continuous simulation math.

### WebGPU

Do not depend on WebGPU in V0.1.

Use standard R3F/WebGL first.

Later WebGPU can help with:

- huge coverage grids,
- many cameras,
- GPU heatmaps,
- point clouds,
- Gaussian splats,
- compute-heavy visibility.

### WASM

Use WASM when useful:

- Rapier physics,
- geometry kernels,
- heavy pathfinding,
- large coverage computation,
- point cloud processing later.

Do not add custom WASM early unless needed.

### Performance plan

Start with:

```txt
coverage grid: 40x40
recompute on mouse-up, not every drag frame
preview cone while dragging
full heatmap after release
debounce recompute
```

Then improve:

```txt
web worker for coverage
three-mesh-bvh acceleration
WebGPU/WASM later
```

---

## 13. Data Model

### 13.1 SecurityScene

```ts
type SecurityScene = {
  id: string;
  name: string;
  units: "meters" | "feet";
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
  walls: WallObject[];
  doors: DoorObject[];
  windows: WindowObject[];
  cameras: CameraObject[];
  lights: LightObject[];
  obstructions: ObstructionObject[];
  zones: CriticalZone[];
  paths: ScenarioPath[];
  scenarios: Scenario[];
  snapshots: SceneSnapshot[];
  assumptions: SimulationAssumptions;
  simulation?: SimulationResult;
};
```

### 13.2 CameraObject

```ts
type CameraObject = {
  id: string;
  name: string;
  position: [number, number, number];
  yawDeg: number;
  pitchDeg: number;
  rollDeg?: number;
  mountType: "wall" | "ceiling" | "pole" | "corner";
  status: "on" | "off" | "blocked" | "dirty";
  fovHorizontalDeg: number;
  fovVerticalDeg: number;
  resolutionMP: number;
  clarity: "poor" | "average" | "good";
  nightMode: "none" | "ir" | "low_light" | "thermal";
  nightRangeM: number;
  ptz: boolean;
  presetId?: string;
};
```

### 13.3 LightObject

```ts
type LightObject = {
  id: string;
  type: "ceiling" | "wall" | "flood" | "street" | "emergency";
  position: [number, number, number];
  yawDeg?: number;
  pitchDeg?: number;
  status: "on" | "off";
  brightness: "low" | "medium" | "high";
  rangeM: number;
  coneDeg?: number;
};
```

### 13.4 ObstructionObject

```ts
type ObstructionObject = {
  id: string;
  label: string;
  position: [number, number, number];
  rotationYDeg: number;
  dimensions: [number, number, number];
  material:
    | "solid"
    | "glass"
    | "grill"
    | "mesh"
    | "curtain"
    | "reflective"
    | "partial";
  movable: boolean;
  blocksVision: boolean;
};
```

### 13.5 CriticalZone

```ts
type CriticalZone = {
  id: string;
  label: string;
  polygon: [number, number][];
  priority: "low" | "medium" | "high";
  requiredQuality:
    | "detection"
    | "observation"
    | "recognition"
    | "identification";
  targetType:
    | "person"
    | "face"
    | "vehicle"
    | "license_plate"
    | "package"
    | "activity";
  nightRequired: boolean;
  privacyZone?: boolean;
};
```

### 13.6 ScenarioPath

```ts
type ScenarioPath = {
  id: string;
  label: string;
  actorType: "person" | "vehicle" | "guard";
  points: [number, number][];
  speedMps: number;
  timeOfDay: "day" | "night";
};
```

### 13.7 SimulationResult

```ts
type SimulationResult = {
  totalCoveragePct: number;
  blindspotPct: number;
  criticalZoneResults: ZoneResult[];
  cameraResults: CameraResult[];
  pathResults: PathVisibilityResult[];
  issues: SecurityIssue[];
  recommendations: Recommendation[];
};
```

---

## 14. AI / Model-Agnostic Pipeline

### Principle

Do not build SentinelTwin as one model call.

Build it as:

```txt
specialized CV models
+ deterministic geometry
+ scene graph
+ simulation engine
+ reasoning/reporting model
```

### Stages

```txt
Input
→ scene understanding
→ segmentation
→ depth/reconstruction
→ semantic block extraction
→ security simulation
→ counterfactual testing
→ report/explanation
```

### Candidate models/packages by stage

#### Scene understanding / object localization

Explore:

- Gemini 2.5 Flash/Pro,
- Qwen2.5-VL / Qwen-VL family,
- MiniCPM-V / MiniCPM-o,
- InternVL,
- Llama multimodal models,
- Florence-2,
- Molmo / pointing models.

Use for:

- identifying doors/windows/cameras/cupboards/counters,
- JSON object extraction,
- image/video understanding,
- command interpretation.

#### Segmentation

Explore:

- SAM 3 / SAM 3.1,
- SAM 2,
- Grounded-SAM,
- Florence-2 + SAM,
- YOLO/RF-DETR + SAM.

Use for:

- tap object → mask,
- select shelf/cupboard,
- track object/person in video,
- isolate obstructions.

#### Depth

Explore:

- Depth Anything V2,
- Video Depth Anything,
- UniDepth,
- Apple Depth Pro,
- ZoeDepth,
- Metric3D.

Use for:

- approximate depth,
- object distance,
- wall/floor interpretation,
- guided scan support.

#### Multi-photo / video reconstruction

Explore:

- VGGT,
- DUSt3R,
- MASt3R,
- MASt3R-SLAM,
- COLMAP,
- Open3D.

Use later for:

- photos/video → camera poses/depth/point cloud,
- rough reconstruction,
- plane extraction.

#### Point cloud → semantic room structure

Explore:

- SpatialLM,
- Open3D plane fitting,
- Trimesh,
- Shapely.

Use for:

- walls,
- doors/windows,
- object boxes,
- semantic room graph.

#### 3D asset generation

Explore later:

- SAM 3D Objects,
- TripoSR,
- Hunyuan3D,
- TRELLIS-style models,
- stock GLB/CC0 libraries.

Use for visual polish only.

#### Reasoning/reporting

Use any strong LLM:

- OpenAI reasoning model,
- Gemini Pro/Flash,
- Qwen,
- Claude,
- local models where appropriate.

Use for:

- explaining coverage failures,
- generating recommendations,
- parsing commands,
- report writing,
- agent orchestration.

### Important AI rule

AI proposes. Simulation verifies.

Example:

```txt
AI proposes: move shelf 0.8m right.
Simulator tests: coverage improves from 61% to 78%.
AI explains verified result.
```

This prevents hallucinated security advice.

---

## 15. Multi-Agent Architecture

Agents should not be decorative. Each should own a real job.

### Blueprint Agent

Parses layouts, detects walls/rooms/doors/windows.

### Scene Agent

Handles objects, obstructions, lights, furniture, site features.

### Camera Spec Agent

Extracts specs:

- resolution,
- FOV,
- lens,
- IR range,
- thermal capability,
- PTZ/fixed.

### Coverage Agent

Computes:

- camera cones,
- visibility,
- occlusion,
- blindspots,
- overlap.

### Quality/DORI Agent

Maps coverage into estimated:

- detection,
- observation,
- recognition,
- identification.

### Counterfactual Agent

Tests:

- move object,
- rotate camera,
- change lens,
- add light,
- add camera,
- change door/window state.

### Incident Replay Agent

Simulates defensive routes and generates timeline.

### Optimization Agent

Finds practical low-cost fixes.

### Report Agent

Creates client-ready explanation.

### Voice/Command Agent

Turns natural language into structured scene edits.

---

## 16. Natural Language Command Examples

The command layer should support:

```txt
Move Camera 1 to the front-left corner.
Rotate Camera 2 toward the cash counter.
Tilt Camera 1 down by 10 degrees.
Increase Camera 1 FOV to 120 degrees.
Turn off Camera 2.
Switch to night mode.
Add a shelf between the entry and counter.
Move Shelf 1 to the right wall.
Add a light above the main entry.
Show the worst blind spot.
Find the cheapest fix without moving cameras.
Simulate a person entering from the front door at night.
What happens if Camera 1 is offline?
Show me camera views during the replay.
Generate a client report.
```

Each command should map to structured operations on `SecurityScene`.

---

## 17. Before/After Snapshots

V0.1 should support snapshot comparison.

Examples:

- Current setup,
- After moving shelf,
- After adding light,
- After rotating Camera 2,
- After adding one camera,
- Night mode,
- Camera 1 offline.

Comparison metrics:

```txt
Blindspot: 31% → 12%
Cash counter quality: Observation → Recognition
Visible path time: 4.2s → 8.7s
Identification-quality area: 18% → 41%
Critical zones passing: 2/4 → 4/4
```

---

## 18. Report-Lite Panel

Even V0.1 should have a report preview.

Sections:

```txt
1. Site Overview
2. Camera Setup
3. Coverage Summary
4. Critical Zone Results
5. Blindspot Findings
6. Scenario Replay
7. Before/After Fixes
8. Recommendations
9. Assumptions and Limitations
```

Example language:

```txt
Camera 1 provides detection-level coverage of the main entry, but recognition-quality visibility near the cash counter is limited due to shelf occlusion and camera angle. Moving Shelf 1 to the right wall reduces the estimated blind zone from 31% to 12%.
```

---

## 19. Debug / Developer Mode

Add toggles:

```txt
Show coverage grid
Show raycasts
Show occlusion hits
Show camera frustum bounds
Show path sample points
Show recompute time
Show object colliders
Show vision colliders
```

This helps build and makes the simulation credible.

---

## 20. Initial Demo Scenes

### 20.1 Small Retail Shop

Objects:

- front entrance,
- cash counter,
- two shelves,
- back storage room,
- two cameras,
- one cupboard causing blindspot,
- one light.

Demo story:

- owner thinks shop is covered,
- camera loses subject near cash counter,
- shelf/cupboard move improves coverage,
- night mode reveals weak recognition,
- add light improves quality.

### 20.2 Apartment Lobby

Objects:

- entrance,
- lift,
- staircase,
- reception desk,
- pillar,
- cameras.

Scenario:

- person enters at night and moves to staircase,
- pillar causes blindspot.

### 20.3 Warehouse Bay

Objects:

- loading shutter,
- racks,
- vehicle path,
- storage zone,
- high-mounted cameras.

Scenario:

- vehicle blocks camera view,
- thermal/low-light test.

### 20.4 School Corridor

Objects:

- long corridor,
- classroom doors,
- stair turn,
- blind corner,
- cameras.

Scenario:

- camera sees corridor but misses stair turn.

---

## 21. Suggested V0.1 Build Order

### Phase 1: Scene + Object System

- Create `SecurityScene` JSON schema.
- Render floor/walls/objects from JSON.
- Add object selection and inspector.
- Add procedural object factory.

### Phase 2: Camera System

- Add camera objects.
- Add camera cones/frustums.
- Add yaw/pitch/FOV controls.
- Add camera view mode.

### Phase 3: Coverage Engine

- Add floor sampling grid.
- Check FOV inclusion.
- Raycast camera → grid/path point.
- Mark visible/blocked/blind.
- Render heatmap.

### Phase 4: Quality Model

- Add resolution/FOV/distance scoring.
- Add day/night/clarity penalties.
- Add estimated quality categories.

### Phase 5: Interactions

- Drag/move/rotate cameras.
- Move obstructions.
- Toggle camera/lights.
- Recompute coverage.

### Phase 6: Replay

- Add path drawing or preset path.
- Animate person along path.
- Show timeline and camera visibility.

### Phase 7: Before/After + Report

- Save snapshots.
- Compare metrics.
- Generate report-lite.

### Phase 8: Polish

- GSAP replay timeline.
- Camera wall.
- UI styling.
- Demo script.

---

## 22. V0.1 Demo Script

### Setup

Load **Small Retail Shop**.

Scene includes:

- front door,
- cash counter,
- shelf/cupboard,
- two cameras,
- light.

### Step 1

Show initial coverage.

Narration:

> “This shop appears covered by two cameras.”

### Step 2

Switch to Camera 1 view.

Show:

- entry visible,
- cash counter partially blocked.

### Step 3

Run path replay:

```txt
Front Entry → Cash Counter → Storage Door
```

Timeline:

```txt
Camera 1: detected → blocked → lost
Camera 2: no view → observed
```

### Step 4

Turn on night mode.

Result:

```txt
Recognition near cash counter drops to observation/detection only.
```

### Step 5

Ask:

```txt
Camera 1 cannot move. What can we change?
```

System suggests:

- move Shelf 1,
- add light near counter,
- rotate Camera 2.

### Step 6

Apply move shelf.

Coverage improves.

### Step 7

Add/turn on light.

Night recognition improves.

### Step 8

Show before/after metrics:

```txt
Blindspot: 31% → 12%
Path visible time: 4.2s → 8.7s
Cash counter: Observation → Recognition estimate
```

### Step 9

Generate report-lite.

Closing line:

> “SentinelTwin found the coverage failure before the client discovered it after an incident.”

---

## 23. Future Features

### AI-generated layout

Prompt-to-plan:

```txt
Create a 10m x 7m electronics shop with front entry, two shelves, right-side cash counter, back storage, one side window, and two cameras.
```

AI outputs structured JSON, not just an image.

### Floor plan upload

- upload plan,
- set scale,
- detect/correct walls,
- convert to scene.

### Guided camera scan

- user taps walls/doors/objects,
- AI segments/classifies,
- approximate scene built live.

### Real camera verification

- attach camera screenshot/video,
- compare expected vs actual view,
- detect mismatch/obstruction/blur.

### Video generation / simulation export

Three options:

1. deterministic Three.js rendered simulation,
2. AI-generated cinematic explanation,
3. real video-to-scene understanding.

### Import external scans

Potential future inputs:

- Polycam/Kiri/Scaniverse GLB/OBJ,
- RoomPlan,
- Metaroom,
- RealityScan,
- Gaussian splats,
- DroneDeploy-style site captures.

Important:

```txt
scan/mesh/splat = visual reference
SecurityScene = simulation truth
```

---

## 24. Competitive / Reference Landscape

These references are not necessarily competitors; they prove pieces are possible.

### Reality capture / scanning

- Kiri Engine
- RealityScan
- Trnio
- Polycam
- Scaniverse
- Metaroom by Amrax
- DroneDeploy
- RoomPlan / ARKit / ARCore

Lesson:

> Capturing spaces is becoming accessible. SentinelTwin should transform captured spaces into security intelligence.

### AI spatial design / floor plans

- Maket.ai
- Drafted AI
- Planner 5D
- AI floor plan tools

Lesson:

> Prompt-to-plan is possible, but SentinelTwin needs security simulation, not generic architectural design.

### Browser 3D / CAD / graphics

- Arcada-style floor plan editors
- FluidCAD-like parametric JS CAD
- React Three Fiber
- Three.js
- WebGPU
- WebXR
- Gaussian splatting demos

Lesson:

> Web-based 3D spatial tools are now realistic enough for a hackathon-grade product.

### Security/CCTV planning tools

Relevant category references:

- Axis Site Designer,
- JVSG IP Video System Design Tool,
- IPVM calculators,
- CCTV lens/DORI calculators,
- camera vendor planning tools.

Differentiation:

```txt
Existing tools: static camera design/planning.
SentinelTwin: interactive AI security digital twin + counterfactual simulation + incident replay + report.
```

---

## 25. What Not to Build First

Avoid initially:

- real RTSP/ONVIF integration,
- full live CCTV ingestion,
- perfect photoreal reconstruction,
- full Gaussian splat editing,
- real thermal physics,
- full camera database,
- perfect DORI compliance,
- complex crowd simulation,
- advanced WebGPU compute,
- custom WASM kernels,
- full AR mobile scan,
- realistic video generation.

Build the testbed first.

---

## 26. Important Product Principles

### 26.1 Simulation truth over visual beauty

Use clean geometry for calculations.

### 26.2 AI proposes, engine verifies

Do not let LLMs hallucinate security recommendations.

### 26.3 Every edit should recompute risk

The app should feel alive.

### 26.4 Be transparent about assumptions

Always show:

- camera specs,
- wall height,
- person height,
- light assumptions,
- night assumptions,
- quality model limitations.

### 26.5 Defensive use only

Frame as authorized audit/hardening.

### 26.6 V0.1 should feel like a serious tool

Not a toy Three.js demo.

---

## 27. Questions for Other AI Reviewers

Ask other AIs/agents to critique:

1. Is V0.1 correctly scoped around the Camera Testbed?
2. What is the simplest reliable camera quality scoring model?
3. How should FOV/resolution/distance map to detection/recognition/identification estimates?
4. How should lighting and night mode affect quality?
5. What is the best data model for `SecurityScene`?
6. Should 2D plan editor come before or after 3D testbed?
7. What should be computed in Three.js vs Web Worker vs WASM?
8. Is Rapier useful now or later?
9. How should object materials affect vision?
10. What minimum features make the demo impressive?
11. What would security professionals distrust?
12. What claims should be avoided for safety/legal accuracy?
13. Which open-source models are most practical for V0.2/V0.3?
14. What should the report look like for a real client?
15. What is the best hackathon demo story?

---

## 28. AI Agent Task Split for Build

### Agent 1: Scene + Data Model

- define TypeScript schemas,
- procedural room/object factory,
- load/save scene JSON.

### Agent 2: Three.js Viewer

- R3F canvas,
- camera controls,
- walls/objects/lights rendering,
- selection/inspector integration.

### Agent 3: Camera System

- camera object,
- frustum/cone visualization,
- yaw/pitch/FOV controls,
- camera view mode.

### Agent 4: Coverage Engine

- grid sampler,
- FOV test,
- raycast occlusion,
- quality scoring,
- heatmap.

### Agent 5: UI/UX

- workspace shell,
- object tray,
- inspector,
- metrics panel,
- scenario tabs.

### Agent 6: Replay + GSAP

- path actor,
- replay timeline,
- camera wall switching,
- before/after animation.

### Agent 7: Report

- report-lite panel,
- issue/recommendation generation,
- export HTML/JSON.

### Agent 8: AI Commands

- natural language → structured scene edits,
- command validation,
- explain results.

---

## 29. Minimal V0.1 Acceptance Criteria

A working demo should allow:

1. Load a small shop scene.
2. Add or select Camera 1.
3. Move/rotate/tilt Camera 1.
4. Change Camera 1 FOV/resolution.
5. Turn Camera 1 on/off.
6. Move shelf/cupboard.
7. Toggle day/night.
8. Add/toggle light.
9. Show camera cones.
10. Show blindspot heatmap.
11. Switch to Camera 1 view.
12. Replay person path.
13. Show visibility timeline.
14. Save before/after.
15. Show report-lite summary.

If these work, V0.1 is successful.

---

## 30. Final Framing

SentinelTwin is not just a CCTV planner.

It is:

> **A live security simulation environment where cameras, lights, objects, doors, windows, paths, and environmental states become editable variables — and every change updates the risk map.**

V0.1 should be the **Camera Coverage Testbed**.

V1 should become the **AI Security Digital Twin**.

The core interaction:

```txt
Move/change something in the scene
→ recompute visibility
→ show security impact
→ explain what changed
→ recommend practical fixes
```

That is the product.
