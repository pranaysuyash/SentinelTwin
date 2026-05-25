# Competitive Landscape

**Status:** Reference — 2026-05-25
**Purpose:** Know what exists. Know where SentinelTwin is genuinely different.

---

## Existing CCTV Planning Tools

### Axis Site Designer
- Axis Camera's official camera placement tool
- Features: FOV visualization, camera placement, coverage areas, lens calculator
- Differentiation vs SentinelTwin: static FOV only, no simulation, no counterfactual, no adversarial, no temporal, no AI
- What it proves: the market wants camera placement tools

### JVSG IP Video System Design Tool
- Professional CCTV planning software (desktop, paid)
- Features: camera placement, DORI calculations, 2D/3D views, field of view, lens/distance calculator
- Strong: proper DORI PPM calculations, professional grade
- Differentiation vs SentinelTwin: still static (no live recompute), no counterfactual testing, no adversarial paths, no temporal, no AI commands, no report generation, desktop-only, expensive license
- What it proves: professionals care about DORI — we should match their rigor

### IPVM (IP Video Market)
- Industry research + professional camera testing data
- DORI calculators, camera comparison tools
- Web-based calculators
- Differentiation vs SentinelTwin: calculators only, not an interactive editor

### Genetec Security Center / Milestone XProtect
- Full VMS (Video Management Software)
- Live feeds, recording, analytics, access control integration
- No simulation/planning layer
- Very different product: operations vs planning
- SentinelTwin is a planning/audit tool; VMS is an operations tool. Not competitors.

### OnSSI / Salient / other VMS platforms
- Same category as Genetec/Milestone
- Operations, not planning/simulation

---

## Spatial Tools (Design, Not Security)

### Planner 5D
- AI floor plan import → 3D editing
- Interior design focus, not security
- Proves: floor plan → 3D is expected by users

### Maket.ai / Drafted AI
- AI-generated floor plans from text prompts
- Architecture/design focus
- Proves: prompt → spatial layout is feasible and valued

### Arcada (open source)
- Web-based floor plan editor
- React/Pixi, walls, furniture, doors, measurements
- Proves: browser-based floor plan editor is buildable

### FluidCAD
- Parametric CAD in JavaScript
- Proves: parametric spatial editing in browser is feasible

### These are NOT competitors. They prove the base layer exists.
SentinelTwin builds the security intelligence layer that none of these provide.

---

## 3D Capture / Reconstruction

### Polycam / Kiri Engine / Scaniverse
- Phone-based 3D scanning
- Outputs GLB/OBJ/point cloud
- Used for reality capture, not security analysis
- Future V0.4+: import their outputs as scene starting point

### RoomPlan (Apple ARKit)
- iPhone-based room scanning → floor plan
- Outputs USD/USDZ
- Very clean results for simple indoor spaces
- Future integration candidate

### Matterport
- Professional 3D scanning, walkthrough tours
- Very high quality
- Outputs OBJ/point cloud
- Enterprise pricing
- Could be a future scan import source

**Lesson from all of these:** Spatial capture is becoming accessible. SentinelTwin's job is
to turn captured spaces into security intelligence. We are not a capture tool.

---

## Where SentinelTwin Is Genuinely Different

| Capability | Axis Site Designer | JVSG | Any VMS | SentinelTwin |
|---|---|---|---|---|
| DORI quality calculation | Basic | Yes | No | Yes |
| Live coverage recompute | No | No | No | Yes |
| Counterfactual testing | No | No | No | Yes |
| "Camera can't move, what else?" | No | No | No | Yes |
| Adversarial path simulation | No | No | No | Yes |
| 24h temporal security profile | No | No | No | Yes |
| AI command layer | No | No | No | Yes |
| Before/after comparison | No | Basic | No | Yes |
| Verified recommendations | No | No | No | Yes |
| Web-based | Yes (limited) | No | Varies | Yes |
| Open-source foundation | No | No | No | Yes (Pascal fork) |
| Report generation | Basic | Good | No | Yes |

---

## The Positioning Statement

SentinelTwin doesn't compete with JVSG for "best CCTV design tool for professionals."
JVSG wins there with years of features and brand recognition.

SentinelTwin competes on a different axis: **intelligence and interactivity**.

The pitch is:
> "JVSG shows you where your cameras point. SentinelTwin shows you what a motivated actor
> would do to avoid them, and how to fix it."

That is a different product category. The buyer is the same (security agencies, facility managers)
but the job-to-be-done is different (hardening a setup vs planning a setup).

Secondary pitch for new market: small/medium businesses who can't afford JVSG, don't have
CAD files, and need a tool that works from a phone photo or rough sketch.
