# SentinelTwin Camera Studio — Full Camera Suite Product Spec

**Purpose:** Define the complete Camera Studio / Camera Coverage Testbed experience for SentinelTwin V0.1 and beyond.

**Core product principle:**
SentinelTwin is not a CCTV cone viewer. It is a live security simulation workspace where every change to cameras, lights, obstructions, zones, paths, and assumptions recomputes security outcomes.

The existing docs already define the V0.1 spine as:

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

That is the correct foundation. 

---

# 1. Does the current mockup cover the docs?

## Mostly yes, but not fully.

The latest UI mockup covers a lot of the documented Camera Testbed requirements:

```txt
✅ Main Studio workspace
✅ Small Retail Shop demo loaded by default
✅ Scene tools
✅ Camera selection
✅ Camera cones
✅ Coverage heatmap
✅ DORI-style quality legend
✅ Critical zone overlay
✅ Obstruction / blocked-view warning
✅ Right-side camera inspector
✅ Position / rotation / FOV / resolution controls
✅ Day / night mode entry point
✅ Camera failure entry point
✅ Run simulation
✅ Save snapshot
✅ Compare
✅ Generate report
✅ Metrics panel
✅ Issues panel
✅ Timeline tab
✅ Before / After tab
✅ Report Lite tab
✅ Scenario path panel
✅ Mini-map
✅ Environment / assumptions panel
```

That maps well to the project brief’s requirement that V0.1 prove camera placement, FOV/resolution changes, camera on/off, movable obstructions, lights, day/night mode, raycast visibility, heatmap, camera view mode, path replay, snapshots, and report-lite. 

But the mockup is still not the **full Camera Suite** yet.

The big missing areas are:

```txt
❌ Camera Feed View / Camera Wall
❌ Dedicated camera preset library
❌ Target-type testing panel
❌ Redundancy / single-point failure matrix
❌ Camera offline impact analysis
❌ Lens/FOV tradeoff simulator
❌ Mounting constraints and snap behavior
❌ Camera quality breakdown explanation
❌ Privacy zone coverage warnings
❌ Debug/raycast developer mode
❌ AI command / “find cheapest fix” command bar
❌ Camera comparison mode
❌ Camera spec/import workflow
❌ Coverage uncertainty and assumptions visibility per result
❌ Exportable SecurityScene JSON flow
```

So the current design is a strong **Camera Coverage Workspace**, but the full product should become a **Camera Studio Suite** with multiple modes.

---

# 2. Product definition

## Name

```txt
SentinelTwin Studio
Camera Coverage Testbed
```

## Alternate internal name

```txt
Camera Studio
```

## What this module does

Camera Studio lets a security planner:

```txt
1. Load or create a SecurityScene.
2. Place cameras, lights, obstructions, paths, and critical zones.
3. Simulate camera coverage and blind spots.
4. Classify visibility by security outcome:
   none / detection / observation / recognition / identification.
5. Test day, night, IR, lighting, camera failure, obstruction movement, and path replay.
6. Compare before/after fixes.
7. Generate report-lite outputs for a client or internal audit.
```

## What it must not be

```txt
Not a generic 3D scene editor.
Not a camera-cone toy.
Not an AI image demo.
Not a tool for bypassing cameras.
Not a forensic certainty engine.
```

The language should remain defensive: authorized coverage audit, hardening, risk reduction, and coverage failure analysis. The origin docs explicitly position SentinelTwin for authorized security auditing and warn against “avoid cameras” / bypass framing. 

---

# 3. Main screen architecture

## Screen 1: Camera Studio Workspace

The first screen should open directly into the loaded testbed:

```txt
SentinelTwin Studio / Small Retail Shop Demo / Coverage Mode
```

No landing page.
No project dashboard first.
No “AI wow” onboarding.

The workspace layout:

```txt
┌──────────────────────────────────────────────────────────────────────┐
│ Top Bar: Scene / Mode / Run / Night / Failure / Snapshot / Report    │
├───────────────┬──────────────────────────────────────┬───────────────┤
│ Scene Tools   │ Main 3D Coverage Canvas               │ Inspector     │
│ Layers        │ Camera cones, heatmap, zones, path     │ Selected node │
│ Mini-map      │ Camera labels, blocked-view warnings   │ Properties    │
├───────────────┴──────────────────────┬───────────────┴───────────────┤
│ Metrics / Issues / Timeline / Compare / Report Lite                  │
├───────────────────────────────────────┬───────────────────────────────┤
│ Snapshots                             │ Assumptions / Report Summary  │
└───────────────────────────────────────┴───────────────────────────────┘
```

---

# 4. Top bar

## Purpose

The top bar controls simulation state, global modes, and key outputs.

## Elements

### Left identity block

```txt
SentinelTwin Studio
Camera Coverage Testbed
```

### Scene selector

```txt
Small Retail Shop Demo ▼
```

Dropdown contents:

```txt
Small Retail Shop Demo
Warehouse Bay
Apartment Lobby
School Corridor
Import SecurityScene JSON
Create Blank Test Scene
```

### Simulation status

```txt
Simulated
Dirty / Needs Recompute
Running...
Up to date
Error
```

### Environment mode

```txt
Day Mode ▼
Night Mode
Dusk
Custom Lighting
```

### Primary actions

```txt
Run Simulation
Night Mode
Camera Failure
Save Snapshot
Compare
Generate Report
```

### Optional top bar actions

```txt
Camera Wall
Export Scene
Command
Debug
```

## Top bar behavior

When any editable scene object changes:

```txt
Status changes from “Simulated” → “Needs Recompute”
Heatmap dims slightly
Run Simulation button becomes emphasized
Report panel marks previous report as stale
```

After recompute:

```txt
Status → “Up to date”
Metrics update
Issues update
Report summary refreshes
```

---

# 5. Left panel: Scene Tools

## Purpose

Tools for editing the security scene.

## Tool list

```txt
Select
Camera
Obstruction
Light
Path
Zone
Door / Window
Wall
Measure
Comment
```

## Tool details

### Select

Used for selecting existing objects.

Controls:

```txt
Click object to select
Shift-click multi-select
Drag selected object
Keyboard nudge
```

### Camera

Used to place new cameras.

Modes:

```txt
Place camera
Duplicate selected camera
Aim camera at point
Snap to wall
Snap to ceiling
Snap to corner
```

### Obstruction

Used to add/edit objects that can block vision.

Object presets:

```txt
Shelf
Cupboard
Counter
Pillar
Storage Boxes
Vehicle
Partition
Glass Display
Curtain
Gate
Tree
Other
```

### Light

Light presets:

```txt
Ceiling Light
Wall Light
Flood Light
Street Light
Emergency Light
IR Flood
```

### Path

Used for scenario replay.

Path types:

```txt
Person path
Vehicle path
Guard patrol path
Incident replay path
```

### Zone

Zone types:

```txt
Critical zone
Privacy zone
Entry zone
Restricted zone
Target zone
```

### Door / Window

Editable access and visibility objects.

Door states:

```txt
Open
Closed
Locked
Restricted
```

Window states:

```txt
Closed glass
Open
Grill
Curtain
Reflective / glare risk
```

### Measure

Measurement tools:

```txt
Distance
Height
Camera-to-target distance
Angle from camera center
Zone area
Path length
```

### Comment

Audit annotations:

```txt
Client note
Installer note
Risk note
Assumption note
Follow-up task
```

---

# 6. Left panel: Scene Layers

## Purpose

Layer visibility and debugging control.

## Default layers

```txt
Cameras
Camera Cones
Obstructions
Lights
Critical Zones
Privacy Zones
Paths
Heatmap
Grid
Walls & Floors
Labels
```

## Advanced layers

```txt
Vision Colliders
Physics Colliders
Raycasts
Occlusion Hits
Camera Frustum Bounds
Path Sample Points
Quality Contours
```

## Layer row controls

Each row should support:

```txt
Visible / hidden
Lock / unlock
Solo layer
Opacity
```

For V0.1, visible/hidden is enough.

---

# 7. Mini-map

## Purpose

Give 2D spatial orientation while the main view is 3D.

## Mini-map should show

```txt
Walls
Doors/windows
Cameras
Camera FOV wedges
Critical zones
Current viewport rectangle
Active path
Selected object
```

## Controls

```txt
Zoom out
Zoom in
Fit view
2D / 3D toggle
```

---

# 8. Center canvas: Main 3D Coverage View

## Purpose

This is the core product surface.

It must show:

```txt
Scene geometry
Camera objects
Camera cones
Coverage heatmap
Critical zones
Obstructions
Blocked view warnings
Path replay
Camera labels
Quality legend
```

## Required overlays

### Camera cones

Show each camera’s:

```txt
FOV volume
Center ray
FOV boundary lines
Range boundary
Blocked rays optional
```

Selected camera cone should be brighter.

### Heatmap

Quality categories should use security outcome language:

```txt
Identification
Recognition
Observation
Detection
No Coverage
```

Do not use only “Excellent / Good / Poor.” Those are not security outcomes.

### Critical zone overlay

Example:

```txt
Cash Counter
Recognition Required
Status: Fails
```

Zone colors:

```txt
Pass = green outline
Partial = amber outline
Fail = red outline
Unknown/stale = gray outline
```

### Obstruction warning

Example:

```txt
CUPBOARD
Blocking Camera 1 view
```

The user should immediately see why the simulation failed.

### Path overlay

Show:

```txt
Start marker
Path line
End marker
Current actor position during replay
Visibility color along path
```

### Camera labels

```txt
CAM 1
CAM 2
CAM 3
```

Should include status:

```txt
Active
Offline
Dirty
Blocked
```

### Coverage legend

Docked over canvas, collapsible.

Should include thresholds:

```txt
Identification: 250+ PPM
Recognition: 125–250 PPM
Observation: 62.5–125 PPM
Detection: 25–62.5 PPM
No Coverage: <25 PPM
```

The coverage docs define the simplified DORI PPM thresholds and the pixel-density logic, so the UI should expose these values, at least in the legend or assumptions panel. 

---

# 9. Canvas controls

## Navigation

```txt
Orbit
Pan
Zoom
Fit scene
Top-down 2D
Perspective 3D
Camera view
Split view
```

## Transform controls

For selected objects:

```txt
Move X/Z
Move height Y
Rotate yaw
Tilt pitch
Scale dimensions
Snap to wall
Snap to floor
Snap to ceiling
```

## Camera-specific handles

For selected camera:

```txt
Rotate yaw handle
Pitch/tilt handle
FOV widen/narrow handle
Aim-at-target control
Mount height drag handle
Range handle
```

## Keyboard shortcuts

```txt
V Select
C Camera
B Obstruction
L Light
P Path
Z Zone
D Door / Window
W Wall
M Measure
T Comment

R Run simulation
N Night mode
F Camera failure scenario
S Save snapshot
1 Map view
2 Camera view
3 Camera wall
```

---

# 10. Right inspector

The inspector changes based on selected object.

## 10.1 Camera inspector

Tabs:

```txt
Properties
View
Status
Analytics
Failures
```

### Properties tab

Fields:

```txt
Name
Camera type
Mount type
Position X/Y/Z
Mount height
Yaw
Pitch
Roll
Horizontal FOV
Vertical FOV
Resolution
Aspect ratio
Lens type
Focal length
Preset
PTZ yes/no
```

Actions:

```txt
Aim at zone
Aim at path
Snap to wall
Snap to ceiling
Duplicate camera
Delete camera
Go to camera view
```

### View tab

Shows simulated camera feed preview.

Controls:

```txt
Show bounding markers
Show DORI labels
Show path actor
Show timestamp overlay
Show night/IR effect
Show dirty lens effect
Show resolution degradation
```

View modes:

```txt
Normal
IR grayscale
Thermal approximation
Dirty lens
Low light
Overexposed / backlit
```

### Status tab

Camera state:

```txt
Active
Off
Blocked
Dirty
Malfunctioning
Wrong angle
```

Operational fields:

```txt
Power group
Network status
Maintenance note
Last checked
```

For V0.1 these can be simulated states.

### Analytics tab

Per-camera metrics:

```txt
Coverage %
Identification-quality area
Recognition-quality area
Critical zones covered
Critical zones failed
Average target distance
Worst blocked zone
Path visible seconds
Offline impact
```

### Failures tab

Failure simulations:

```txt
Turn this camera off
Mark lens dirty
Mark view blocked
Reduce clarity
Reduce resolution
Change FOV
Disable night mode
```

Output:

```txt
If Camera 1 goes offline:
- Cash Counter falls from Recognition → Detection
- Critical zones passing: 1/2 → 0/2
- Path lost time increases by 3.2s
```

The docs explicitly call out redundancy analysis and camera offline impact, including the example that cash counter may lose recognition-quality coverage if Camera 1 goes offline. 

---

## 10.2 Obstruction inspector

Fields:

```txt
Label
Type
Position
Rotation
Width
Depth
Height
Material
Vision transmission
Movable
Movable by recommendation engine
Glare risk
IR reflective
```

Actions:

```txt
Test without this
Move to wall
Mark as glass
Mark as solid
Show blocked rays
Show cameras affected
```

Impact summary:

```txt
Blocks Camera 1 to Cash Counter
Affected cells: 18%
Critical zones affected: Cash Counter
Path lost time caused: 2.4s
```

---

## 10.3 Light inspector

Fields:

```txt
Light type
Position
Height
Direction
Brightness
Range
Cone angle
Status
Emergency power
IR flood yes/no
Glare risk
```

Actions:

```txt
Toggle on/off
Test night impact
Show illuminated cells
Show glare risk
```

Impact summary:

```txt
Night recognition near counter improves from Detection → Observation
```

---

## 10.4 Critical zone inspector

Fields:

```txt
Label
Priority
Required quality
Target type
Night required
Redundancy required
Privacy zone yes/no
Polygon points
Height
```

Simulation result:

```txt
Current quality
Coverage status
Covering cameras
Redundancy count
Failure reasons
```

Example:

```txt
Cash Counter
Required: Recognition
Current: Observation
Status: Fails
Reason: Shelf occlusion + distance from Camera 2
```

This maps directly to the project brief’s critical-zone requirement model. 

---

## 10.5 Path inspector

Fields:

```txt
Path label
Actor type
Speed
Height
Time of day
Intent: authorized / incident replay / test scenario
Start
End
Waypoints
```

Simulation result:

```txt
Total duration
Visible duration
Lost duration
Best camera
Worst segment
Quality over time
```

Actions:

```txt
Play path
Edit path
Reverse path
Duplicate path
Convert to incident replay
Show camera views during replay
```

---

# 11. Bottom panel

The bottom panel should be the analytical brain of the Camera Studio.

Tabs:

```txt
Metrics
Issues
Timeline
Before / After
Report Lite
Debug
Command
```

---

## 11.1 Metrics tab

Cards:

```txt
Overall coverage
Blindspot %
Critical zones passing
Cameras active/offline
Average quality
Worst area quality
Path visible time
Recognition-quality area
Identification-quality area
```

Example:

```txt
Overall Coverage: 68%
Critical Zones: 0 / 1 passing
Cameras: 2 active
Average Walkable Quality: Observation
Worst Area: Detection near cupboard
```

## 11.2 Issues tab

Issue list:

```txt
Critical: Cash Counter fails recognition requirement
High: Cupboard blocks Camera 1
Medium: Camera 2 too far for face recognition
Medium: Night mode reduces counter quality
Low: No redundant camera for counter
```

Each issue should include:

```txt
Severity
Affected object/zone
Cause
Evidence
Suggested fixes
Apply/test button
```

Example action buttons:

```txt
Test moving cupboard
Rotate Camera 2
Add light
Add camera
Mark as accepted risk
```

---

## 11.3 Timeline tab

Purpose: path replay + visibility over time.

Rows:

```txt
Time
Actor position
Camera 1 quality
Camera 2 quality
Combined quality
Event
```

Example:

```txt
0.0s Entry door        Camera 1: Observation     Camera 2: None
2.1s Aisle            Camera 1: Detection        Camera 2: None
4.3s Behind cupboard  Camera 1: Lost             Camera 2: Detection
7.9s Counter          Camera 1: Blocked          Camera 2: Observation
```

Controls:

```txt
Play
Pause
Scrub
Speed 0.5x / 1x / 2x
Show camera views
Export timeline
```

---

## 11.4 Before / After tab

Purpose: compare fixes.

Snapshot examples:

```txt
Baseline
Moved Cupboard
Camera 2 Rotated
Night Mode
Added Light
Camera 1 Offline
```

Comparison metrics:

```txt
Blindspot: 31% → 12%
Cash Counter: Observation → Recognition
Path visible time: 4.2s → 8.7s
Critical zones passing: 0/1 → 1/1
Recognition-quality area: 18% → 41%
```

Actions:

```txt
Set as baseline
Compare selected
Restore snapshot
Duplicate snapshot
Generate report from comparison
```

The project brief explicitly lists before/after snapshots as a V0.1 requirement, including these kinds of metric deltas. 

---

## 11.5 Report Lite tab

Sections:

```txt
Site overview
Camera setup
Coverage summary
Critical zone results
Blindspot findings
Scenario replay
Before/after fixes
Recommendations
Assumptions and limitations
```

Example report text:

```txt
Camera 1 provides detection-level coverage of the main entry, but recognition-quality visibility near the cash counter is limited due to cupboard occlusion and camera angle. Moving the cupboard or adjusting Camera 2 improves the estimated recognition-quality area around the counter.
```

Report actions:

```txt
Copy summary
Export Markdown
Export JSON
Generate client PDF later
```

---

## 11.6 Debug tab

V0.1 needs this for credibility and development.

Debug toggles:

```txt
Show coverage grid
Show raycasts
Show occlusion hits
Show camera frustum bounds
Show path sample points
Show recompute time
Show vision colliders
Show physics colliders
Show raw PPM values
Show BVH rebuild time
```

The project brief explicitly calls for debug/developer toggles like raycasts, occlusion hits, colliders, and recompute time. 

---

## 11.7 Command tab

Natural language command bar:

```txt
Ask SentinelTwin...
```

Supported commands:

```txt
Move Camera 1 to the front-left corner.
Rotate Camera 2 toward the cash counter.
Tilt Camera 1 down by 10 degrees.
Increase Camera 1 FOV to 120 degrees.
Turn off Camera 2.
Switch to night mode.
Move Shelf 1 to the right wall.
Show the worst blind spot.
Find the cheapest fix without moving cameras.
Simulate a person entering from the front door at night.
What happens if Camera 1 is offline?
Generate a client report.
```

Rule:

```txt
AI proposes structured scene edits.
Simulation verifies them.
Only verified deltas are shown.
```

This is core to the repo’s decision that AI proposes and simulation verifies, rather than AI inventing security numbers. 

---

# 12. Camera view modes

The full Camera Studio needs multiple view modes.

## 12.1 Map View

Default 3D/2D scene view.

Shows:

```txt
Scene geometry
Heatmap
Camera cones
Zones
Paths
Obstructions
```

## 12.2 Single Camera View

Locks viewport to selected camera.

Overlays:

```txt
Timestamp
Camera name
DORI label at target
Path actor marker
Bounding box around subject
Lost/blocked label
Noise/blur/IR effect
```

Controls:

```txt
Back to map
Switch camera
Show expected view
Show degraded view
Show target detail
```

## 12.3 Camera Wall

Grid layout:

```txt
┌─────────────┬─────────────┐
│ Camera 1    │ Camera 2    │
├─────────────┼─────────────┤
│ Camera 3    │ 3D Map      │
└─────────────┴─────────────┘
```

Use cases:

```txt
Replay incident path
See which camera captures what
Identify when subject is lost
Show client why coverage failed
```

## 12.4 Before / After Split View

Split canvas:

```txt
Left: Baseline
Right: Proposed Fix
```

Synchronized camera orbit.

Shows:

```txt
Heatmap delta
Path delta
Critical zone status delta
Issue delta
```

## 12.5 Failure View

Scene state set to a failure scenario:

```txt
Camera 1 offline
Night only
Light failure
Dirty lens
Obstruction moved
Door open/closed
```

Shows affected zones and lost coverage.

---

# 13. Full camera controls

## 13.1 Placement controls

```txt
Add camera
Duplicate camera
Delete camera
Move camera
Set mount height
Snap to wall
Snap to ceiling
Snap to pole
Snap to corner
Aim at point
Aim at zone
Aim along path
```

## 13.2 Orientation controls

```txt
Yaw
Pitch
Roll
Look-at target
Reset orientation
Fine nudge
```

## 13.3 Lens controls

```txt
Horizontal FOV
Vertical FOV
Aspect ratio
Resolution MP
Resolution width/height
Lens type
Focal length
Digital zoom approximation
Fisheye mode
PTZ mode
```

## 13.4 Image quality controls

```txt
Clarity
Compression
Dirty lens
Motion blur
Low light noise
Backlight
Glare
IR reflection
Thermal mode
```

## 13.5 Operational controls

```txt
Status: active/off/blocked/dirty/malfunctioning
Power group
Night mode
IR range
Maintenance note
Camera preset
```

## 13.6 Analysis controls

```txt
Show cone
Show blocked rays
Show camera-only coverage
Show overlap
Show zones covered
Show offline impact
Show weakest target
```

---

# 14. Camera preset library

This should exist early because users think in camera types.

## Presets

```txt
2MP Indoor Dome
4MP Wide Dome
8MP Bullet
PTZ Outdoor
Thermal Perimeter
Low-Light Camera
Fisheye 360
License Plate Camera
```

## Preset fields

```txt
Name
Resolution
Horizontal FOV
Vertical FOV
IR range
Night mode
Lens type
Mount type
Recommended use
Limitations
```

## Preset UX

When adding a camera:

```txt
Choose preset
Place camera
Aim at zone
Run simulation
```

## Example preset card

```txt
4MP Indoor Dome
FOV: 90°
IR: 20m
Best for: indoor room/counter coverage
Limitation: weak identification beyond long distance
```

---

# 15. Target-type testing

The full suite should allow the planner to switch what they are testing.

## Target types

```txt
Person detection
Face recognition
Face identification
Vehicle detection
License plate recognition
Package detection
Cash counter activity
Door entry/exit
Perimeter breach
```

## UX location

Could appear in:

```txt
Top bar: Target: Face Recognition ▼
or
Critical Zone inspector
or
Metrics panel
```

## Behavior

Changing target type changes:

```txt
Required quality
PPM thresholds
Angle penalty
Lighting sensitivity
Report wording
Pass/fail status
```

Example:

```txt
Camera 2 may pass “person detection”
but fail “face recognition”
and completely fail “license plate recognition.”
```

This is important because the docs emphasize that being visible is not the same as being useful evidence. 

---

# 16. Scenario presets

## Presets

```txt
Daytime Entry
Night Entry
Camera 1 Failure
Camera 2 Failure
Light Failure
Person Behind Shelf
Vehicle at Gate
Door Left Open
Cash Counter Approach
Storage Room Access
Dirty Lens
Backlight at Entrance
IR Beyond Range
```

## Scenario panel behavior

Each scenario applies state changes:

```txt
Night Entry:
- timeOfDay = night
- path = entry → cash counter
- night penalties enabled

Camera Failure:
- selected camera status = off
- recompute redundancy impact

Light Failure:
- selected light status = off
- recompute night quality
```

---

# 17. Redundancy / failure matrix

This is one of the strongest professional features.

## Matrix

Rows:

```txt
Critical zones
Paths
Entry points
```

Columns:

```txt
Normal
Camera 1 off
Camera 2 off
All lights off
Night mode
Dirty lens
Obstruction moved
```

Example:

```txt
Cash Counter
Normal: Observation / Fail
Camera 1 off: Detection / Fail
Camera 2 off: None / Fail
Night: Detection / Fail
After fix: Recognition / Pass
```

## Why it matters

It answers:

```txt
Is this setup robust, or does one failure break coverage?
```

---

# 18. Counterfactual fix tools

The suite should support manual and AI-assisted fixes.

## Manual counterfactuals

```txt
Move object
Rotate camera
Add camera
Add light
Change FOV
Change resolution
Change night mode
Open/close door
Change material
```

## Assisted counterfactuals

Buttons:

```txt
Find cheapest fix
Improve this zone
Fix without moving cameras
Fix without adding cameras
Improve night coverage
Improve redundancy
```

## Output format

```txt
Suggested fix:
Move Cupboard 0.8m to right wall

Verified delta:
Cash Counter: Observation → Recognition
Blindspot: 31% → 12%
Path visible time: 4.2s → 8.7s
New camera required: No
```

---

# 19. Assumptions and uncertainty

This must be visible and editable.

## Assumptions panel

```txt
DORI model: Simplified PPM
PPM thresholds: 25 / 62.5 / 125 / 250
Person height: 1.7m
Wall height: 3.0m
Lighting model: Simplified
Glass handling: Partial transmission
Night mode: Off
Grid resolution: 0.25m
```

## Result language

Use:

```txt
estimated recognition-quality
likely detection only
under current assumptions
planning indicator
not a forensic guarantee
```

Avoid:

```txt
guaranteed identification
will identify
certified compliant
legally sufficient
```

The project brief explicitly says DORI-style labels are estimated planning indicators, not legal guarantees. 

---

# 20. Reports and exports

## V0.1 exports

```txt
SecurityScene JSON
SimulationResult JSON
Report Lite Markdown
Snapshot comparison JSON
Screenshot/export image
```

## Later exports

```txt
PDF audit report
Client proposal
Annotated floor plan
Camera schedule
Installation notes
Compliance appendix
```

## Report Lite fields

```txt
Scene name
Site dimensions
Camera count
Critical zones
Coverage summary
Key issues
Worst blindspots
Path replay summary
Before/after comparison
Recommendations
Assumptions
Limitations
```

---

# 21. Full Camera Studio navigation model

The Camera Studio could have internal modes, not separate pages:

```txt
Coverage
Camera View
Path Replay
Failures
Compare
Report
Debug
```

## Coverage mode

Primary heatmap and zone analysis.

## Camera View mode

Single camera or camera wall.

## Path Replay mode

Animate subject/vehicle/guard path.

## Failures mode

Test camera/light/power/obstruction failure.

## Compare mode

Before/after snapshots.

## Report mode

Client-ready explanation.

## Debug mode

Raycasts, colliders, sample grid, BVH stats.

---

# 22. V0.1 must-have vs full-suite roadmap

## V0.1 must-have

```txt
Load Small Retail Shop
Render scene
Select Camera 1
Edit camera position/yaw/pitch/FOV/resolution
Toggle camera status
Toggle day/night
Move cupboard/shelf
Add/toggle light
Show camera cones
Show heatmap
Show DORI quality legend
Show critical zone pass/fail
Replay one path
Show timeline summary
Save snapshots
Compare before/after
Show report-lite
Show assumptions
Export SecurityScene JSON
```

## V0.1 nice-to-have

```txt
Single camera view
Camera wall
Debug raycasts
AI command bar
Target type switcher
Redundancy matrix
Camera preset library
Measurement tools
```

## V0.2+

```txt
Floor plan import
AI text-to-scene
AI command execution
Guided scene correction
Camera spec sheet parsing
More demo scenes
Privacy zone compliance hints
```

## V0.5+

```txt
Real camera screenshot/video verification
Plan vs actual camera view comparison
Camera mismatch detection
Actual footage quality assessment
Incident evidence timeline
```

---

# 23. What I would add beyond the docs

The docs already cover the main system. I would add these features to make Camera Studio feel like a serious suite:

## 23.1 Camera Coverage Budgeting

A small panel:

```txt
Current setup cost estimate
Suggested fix cost estimate
“Fix without adding hardware”
“Fix with one extra camera”
```

Why: security agencies care about practical recommendations, not just ideal layouts.

## 23.2 Installability checks

For each proposed camera placement:

```txt
Mountable surface?
Height realistic?
Power/network possible?
Outdoor/indoor suitable?
FOV blocked by door/shelf/signage?
```

## 23.3 Camera naming and schedule

Generated camera schedule:

```txt
Cam ID
Location
Mount type
Height
FOV
Resolution
Target zone
Purpose
Notes
```

Useful for installers and reports.

## 23.4 Coverage confidence badges

Example:

```txt
High confidence: geometry known, camera specs known
Medium confidence: approximate camera specs
Low confidence: unknown lighting/material assumptions
```

This handles uncertainty better than a hidden disclaimer.

## 23.5 “Why failed?” explainer

For any failed zone, show a causal chain:

```txt
Cash Counter fails recognition because:
1. Camera 1 ray is blocked by Cupboard.
2. Camera 2 sees the zone but distance reduces PPM to observation level.
3. Night mode is off, so night scenario degrades further.
```

## 23.6 Fix sandbox

A right-side mode:

```txt
Try changes without modifying baseline
```

User can test:

```txt
Move shelf
Add camera
Rotate camera
Add light
```

Then either:

```txt
Apply to scene
Discard
Save as snapshot
```

## 23.7 “Coverage by camera” isolation

Toggle:

```txt
All cameras
Camera 1 only
Camera 2 only
Overlap only
No redundancy
```

This is very useful for understanding dependency.

## 23.8 Installer mode vs auditor mode

Two modes using same engine:

```txt
Installer mode:
- camera placement
- mounting
- wiring notes
- lens/FOV
- quote/report

Auditor mode:
- current setup
- failures
- blindspots
- before/after
- compliance/assumptions
```

V0.1 can just have the data model ready.

---

# 24. Recommended final Camera Studio screen map

```txt
Screen 1: Camera Studio Workspace
- default Small Retail Shop loaded
- coverage heatmap visible

Mode: Coverage
- edit cameras
- see heatmap
- inspect zones

Mode: Camera View
- selected camera feed
- camera wall

Mode: Path Replay
- path timeline
- visibility by camera

Mode: Failures
- camera off
- light off
- dirty lens
- night mode
- obstruction moved

Mode: Compare
- before/after snapshots

Mode: Report Lite
- generated audit summary

Mode: Debug
- grid/rays/colliders/recompute time

Modal: Add Camera
- preset library
- mount type
- place/aim

Modal: Edit Assumptions
- DORI thresholds
- person height
- wall height
- lighting
- material handling

Modal: Export
- SecurityScene JSON
- SimulationResult JSON
- Report Markdown
```

---

# 25. Final judgment

The current mockup covers the **visible shell** of the Camera Studio well.

But the **full Camera Suite** should explicitly include:

```txt
1. Coverage mode
2. Camera inspector
3. Camera feed / camera wall
4. Target-type testing
5. Critical-zone requirements
6. DORI/PPM quality scoring
7. Obstruction/material model
8. Lighting/night/IR model
9. Failure and redundancy analysis
10. Path replay timeline
11. Before/after snapshots
12. Counterfactual fix testing
13. Assumptions and uncertainty panel
14. Report-lite
15. Debug/raycast mode
16. Exportable SecurityScene and SimulationResult
17. Optional AI command layer
```

That is the full Camera Studio.

The shortest product definition:

> **Camera Studio is the live SentinelTwin workspace where every camera, light, obstruction, zone, path, and assumption is editable — and every edit recomputes camera coverage, evidence quality, blindspots, failure impact, and client-ready recommendations.**
