# Scan-to-Scene Pipeline — Deep Dive

**Date:** 2026-07-11  
**Thread:** 164  
**Status:** Documentation complete

---

## Executive Summary

SentinelTwin's scan-to-scene pipeline converts **phone photos** into **editable SecurityScene** objects through a multi-stage process: capture → annotate → compile → review → activate. The system supports 6 intake paths (manual marking, guided capture, floor plan import, IFC/BIM, JSON import, AI draft) that converge on a common `SiteCompilerResult` → `SiteTwinDraft` → `SecurityScene` flow.

**Core principle:** Candidate confirmation is required. No automatic segmentation/depth reconstruction reaches the scene without user review.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    6 INTAKE PATHS                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Manual       │  │  Guided      │  │  Floor Plan  │             │
│  │  Assisted     │  │  Capture     │  │  Import      │             │
│  │              │  │  Assistant   │  │              │             │
│  │  Photo mark  │  │  Step-by-    │  │  Image →     │             │
│  │  12 types    │  │  step with   │  │  wall/door/  │             │
│  │  Manual      │  │  AI cand.    │  │  window      │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                 │                       │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐             │
│  │  IFC/BIM     │  │  JSON Import │  │  AI Layout   │             │
│  │  Import      │  │  (Site Twin) │  │  Draft       │             │
│  │              │  │              │  │              │             │
│  │  STEP ASCII  │  │  Full scene  │  │  LLM-proposed│             │
│  │  parser      │  │  restoration │  │  scene       │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                 │                       │
│         ▼                 ▼                 ▼                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Site Compiler (site-compiler.ts)                │   │
│  │                                                             │   │
│  │  SiteCompilerResult → SiteTwinDraft → SiteDraftReview       │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Site Draft Review                               │   │
│  │                                                             │   │
│  │  Maturity labels · Warning review · Assumption disclosure   │   │
│  │  "Approve as Canonical Twin"                                │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Active SecurityScene                            │   │
│  │                                                             │   │
│  │  Editable in studio · Simulation-ready · Report-generating │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Path 1: Manual-Assisted Scan

**File:** `apps/studio/src/lib/scan-to-scene.ts` (~830 lines)

### Scan Session Structure

```typescript
interface ScanSession {
  id: string;
  roomName: string;
  widthM: number;          // Room width in meters
  depthM: number;          // Room depth in meters
  heightM: number;         // Ceiling height
  cameraMountType: "wall" | "ceiling";
  lightMountType: "ceiling" | "wall";
  criticalZoneNightRequired: boolean;
  operationalMode: "permanent" | "temporary_event";
  photos: Photo[];
  candidates: ScanCandidate[];
  scaleReferenceM: number; // Default: 0.9m (door width)
}
```

### 12 Candidate Types

| Kind | Label | Description | Default Dimensions |
|------|-------|-------------|-------------------|
| `wall` | Wall | Room edge/perimeter | Room boundaries |
| `door` | Door | Entrance/exit | 0.9m × 2.1m |
| `window` | Window | Glazing/view-through | 1.2m × 1.0m |
| `camera` | Camera | Existing camera | 4MP, 90° FOV, 20m range |
| `light` | Light | Ambient/security light | Ceiling/wall mount |
| `counter` | Cash Counter | Point-of-sale | 2.0m × 1.1m × 0.7m |
| `cupboard` | Cupboard | Closed storage | 1.2m × 2.0m × 0.5m |
| `shelf` | Shelf | Merchandising unit | 2.0m × 1.8m × 0.45m |
| `obstruction` | Generic Obstruction | Any blocking object | Variable |
| `entry_point` | Entry Point | Main access point | Point on floor |
| `critical_zone` | Critical Zone | Zone needing coverage | 1.6m × 1.2m polygon |
| `path_point` | Path Point | Ordered replay path | Sequential points |

### Candidate Workflow

```
Photo uploaded → User clicks point → Candidate created (status: "accepted")
  → User can: edit label, adjust position, reject, add notes
  → On compile: accepted/edited candidates become SecurityScene nodes
```

### Compilation: `compileScanSessionToScene()`

```typescript
function compileScanSessionToScene(session, options) {
  // 1. Create blank scene with room dimensions
  const scene = createBlankSecurityScene();
  scene.dimensions = { width: session.widthM, depth: session.depthM, height: session.heightM };
  
  // 2. Apply walls (4 walls from room dimensions)
  scene.walls = applyWalls(scene, session);
  
  // 3. Convert each accepted candidate to a SecurityScene node
  for (const candidate of session.candidates) {
    const node = createCandidateNode(session, candidate);
    // Switch on nodeType → push to appropriate collection
  }
  
  // 4. Merge entry points (explicit + door-derived)
  scene.entryPoints = mergeEntryPoints(explicitEntryPoints, doorEntryPoints);
  
  // 5. Build path from path_point candidates
  scene.paths = buildPathFromCandidates(session);
  
  // 6. Generate warnings
  const warnings = [];
  if (scene.cameras.length === 0) warnings.push({ code: "NO_CAMERA", severity: "blocking" });
  if (scene.criticalZones.length === 0) warnings.push({ code: "NO_CRITICAL_ZONE", severity: "warning" });
  // ...
  
  // 7. Assess readiness
  const readiness = assessScanDraftReadiness(session, warnings);
  
  return { scene, provenance, warnings, readiness };
}
```

### Positioning Logic

**Wall snapping:** Candidates near walls are snapped to wall positions:
```typescript
function snapToWall(point, widthM, depthM, offsetM = 0.12) {
  const side = nearestWallSide(point); // closest wall
  switch (side) {
    case "north": return [x, 0, depthM - offsetM];
    case "east":  return [widthM - offsetM, 0, z];
    case "west":  return [offsetM, 0, z];
    case "south": return [x, 0, offsetM];
  }
}
```

**Camera mounting:** Wall-mount cameras snap to wall + height; ceiling-mount cameras stay at point + height:
```typescript
function wallMountPosition(point, widthM, depthM, heightM) {
  const [x, , z] = snapToWall(point, widthM, depthM);
  return [x, Math.max(2.4, heightM - 0.2), z];
}
```

**Camera aiming:** Cameras auto-aim toward the nearest critical zone or room center:
```typescript
function yawTowardPoint(from, target) {
  const dx = target[0] - from[0];
  const dz = target[1] - from[2];
  return Math.round(Math.atan2(dx, dz) * (180 / Math.PI));
}
```

---

## Path 2: Guided Capture Assistant

**File:** `apps/studio/src/components/scan-to-scene/GuidedCaptureAssistant.tsx` (~600 lines)

### 13-Step Capture Sequence

| Step | Label | Required | Purpose |
|------|-------|----------|---------|
| 1 | Room Overview | ✅ | Establish spatial context from entrance |
| 2 | Front Wall | ✅ | Capture front wall straight-on |
| 3 | Right Wall | ✅ | Capture right side wall |
| 4 | Left Wall | ✅ | Capture left side wall |
| 5 | Rear Wall | ✅ | Capture rear wall facing entrance |
| 6 | Critical Zones | ✅ | Close-ups of high-value areas |
| 7 | Existing Cameras | ❌ | Mount and model identification |
| 8 | Major Obstructions | ❌ | Shelving, pillars, partitions |
| 9 | Entry Points | ✅ | All doors, gates, access points |
| 10 | Ceiling | ❌ | Light fixtures, ceiling-mount cameras |
| 11 | Reference Measurement | ✅ | Known dimension for scale anchoring |
| 12 | Room Dimensions | ✅ | Width/depth/height entry |
| 13 | Review & Compile | ✅ | Final review and compilation |

### Reconstruction Pipeline Integration

The guided capture feeds into a 8-stage reconstruction pipeline:

```
capture → depth_estimation → segmentation → correspondence → 
structural_extraction → scale_anchoring → quality_gate → compile
```

**Current state:** Most stages are stubs (50ms delay, synthetic output). Real ML endpoints (Depth Anything V2, SAM 3, VGGT, SpatialLM) are planned but not yet connected.

---

## Path 3: Floor Plan Import

**File:** `apps/studio/src/lib/floor-plan-import.ts` (~500 lines)

### Extraction Pipeline

```
Floor Plan Image → Wall Detection → Door/Window Detection → 
Obstruction Detection → Scale Calibration → SecurityScene
```

### Source Profiles

| Profile | Description | Extraction Method |
|---------|-------------|-------------------|
| `blueprint` | Architectural blueprint | Edge detection + line merging |
| `sketch` | Hand-drawn sketch | Contour detection |
| `photo` | Photo of paper plan | Perspective correction + edge detection |
| `digital` | Digital export (PDF/SVG) | Direct geometry extraction |

### Integration with SceneBuilderWizard

The `SceneBuilderWizard` component provides the UI for floor plan import, including:
- Image upload and preview
- Scale calibration (draw reference line)
- Wall/door/window annotation
- Extraction config per source profile
- Compilation to SiteTwinDraft

---

## Path 4: IFC/BIM Import

**File:** `packages/core/src/lib/ifc-structural-parser.ts` (~300 lines)

### 3-Pass Parser

```
IFC STEP ASCII → Tokenize → Pass 1: Cartesian Points → 
Pass 2: Building Storeys → Pass 3: Walls/Doors/Windows
```

### Material Detection

| Keyword | Material | Vision Transmission |
|---------|----------|-------------------|
| "glass", "glaz" | glass | 0.85 |
| "grill", "mesh" | grill | 0.50 |
| "partition" | partial | 0.20 |
| (default) | solid | 0 |

---

## Site Compiler

**File:** `apps/studio/src/lib/site-compiler.ts` (~930 lines)

### SiteCompilerResult

```typescript
interface SiteCompilerResult {
  scene: SecurityScene;
  source: SiteIntakeSource;  // "scan" | "floor_plan" | "ifc_bim" | "json_import" | "ai_draft"
  warnings: SiteCompilerWarning[];
  readiness?: SiteTwinDraftReadiness;
  metadata: {
    compilationTimeMs: number;
    nodeCount: number;
    sourceArtifacts: string[];
  };
}
```

### SiteTwinDraft

```typescript
interface SiteTwinDraft {
  id: string;
  name: string;
  scene: SecurityScene;
  source: SiteIntakeSource;
  maturity: SiteSourceMaturity;  // maturity label + description
  readiness: SiteTwinDraftReadiness;
  warnings: ActionableWarning[];
  assumptions: DraftAssumption[];
  suggestedActions: SuggestedNextAction[];
  canSimulate: boolean;
  result?: SiteCompilerResult;
}
```

### Source Maturity Labels

| Source | Maturity | Description |
|--------|----------|-------------|
| `scan` | "Draft-gated" | "Manual-assisted photo marking. No automatic segmentation or depth yet." |
| `floor_plan` | "Best-effort" | "Best-effort wall/opening extraction from floor plan image." |
| `ifc_bim` | "Structural" | "IFC/STEP structural geometry extracted from BIM model." |
| `json_import` | "Direct" | "Full scene restoration from exported JSON." |
| `ai_draft` | "AI-generated" | "Layout draft generated by AI. Review required before trust." |

### Readiness Levels

| Level | Meaning | Can Simulate | Can Recommend |
|-------|---------|-------------|---------------|
| `deploy-ready` | Scene meets policy | ✅ | ✅ |
| `review-required` | Warnings or medium confidence | ✅ | ❌ |
| `insufficient` | Blocking missing inputs or low confidence | ✅ | ❌ |

---

## Site Draft Review

**File:** `apps/studio/src/components/site-intake/SiteDraftReview.tsx` (~400 lines)

### Review Flow

```
SiteTwinDraft → Display maturity label → Show warnings → 
Show assumptions → Show suggested actions → 
"Approve as Canonical Twin" → promoteToActiveScene()
```

### Truth Audit Integration

The draft review enforces truth labeling:
- "Automatic segmentation/depth reconstruction is still rolling out; candidate confirmation is required."
- "Draft-gated" maturity label
- "Review required before trust"
- "No product-grade video/stream verification yet"

---

## Scan Artifacts System

**File:** `apps/studio/src/lib/scan-artifacts.ts` (~550 lines)

### Artifact Types

| Kind | Purpose | Metadata |
|------|---------|----------|
| `photo` | Source photograph | EXIF, role, dimensions |
| `depth_map` | Monocular depth estimate | min/max depth, model ID |
| `mask` | Segmentation mask | class label, confidence |
| `point_cloud` | 3D point cloud | vertices, normals |
| `camera_pose` | Estimated camera pose | rotation, translation |

### Candidate Warnings

| Code | Severity | Meaning |
|------|----------|---------|
| `LOW_CONFIDENCE` | warning | Confidence < 0.6 |
| `DIMENSIONS_ESTIMATED` | info | Dimensions not measured |
| `POSITION_ESTIMATED` | info | Position inferred, not marked |
| `NO_MASK` | info | No segmentation mask |
| `NO_DEPTH_REFERENCE` | info | No depth map reference |
| `FAR_FROM_CAMERA` | warning | Candidate > 5m from camera |
| `NOT_ALIGNED_TO_WALL` | info | Not snapped to wall |
| `SINGLE_PHOTO_ONLY` | warning | Multi-photo unavailable |
| `DEPTH_OUTLIER` | warning | Depth estimate inconsistent |

---

## Scan Adapters Registry

**File:** `apps/studio/src/lib/scan-adapters/registry.ts` (~170 lines)

### Adapter Types

| Type | Stub | Real (Planned) |
|------|------|----------------|
| Object Detection | `stub-detection-adapter` | YOLO/DETR |
| Segmentation | `stub-segmentation-adapter` | SAM 3 (ONNX) |
| Depth Estimation | `stub-depth-estimation` | Depth Anything V2 |
| Scale Anchoring | Built-in | LiDAR/known objects |
| Correspondence | Built-in | VGGT |
| Structural Extraction | Built-in | SpatialLM |

### Adapter Interface

```typescript
interface DetectionAdapter {
  id: string;
  detect(session: ScanCaptureSession, artifacts: ScanArtifact[]): Promise<ScanCandidate[]>;
}

interface SegmentationAdapter {
  id: string;
  segment(artifacts: ScanArtifact[], candidates: ScanCandidate[]): Promise<MaskArtifact[]>;
}

interface DepthEstimationAdapter {
  id: string;
  estimateDepth(artifacts: ScanArtifact[]): Promise<DepthMapArtifact[]>;
}
```

---

## File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `apps/studio/src/lib/scan-to-scene.ts` | 830 | Core scan compilation (12 candidate types → SecurityScene) |
| `apps/studio/src/lib/scan-artifacts.ts` | 550 | Artifact/candidate types, warnings, capture steps |
| `apps/studio/src/lib/scan-reconstruction.ts` | 700 | Reconstruction pipeline integration |
| `apps/studio/src/lib/reconstruction-pipeline.ts` | 380 | 8-stage reconstruction engine |
| `apps/studio/src/lib/site-compiler.ts` | 930 | Site compiler, SiteTwinDraft, readiness |
| `apps/studio/src/lib/floor-plan-import.ts` | 500 | Floor plan image → scene extraction |
| `apps/studio/src/lib/site-draft-approval.ts` | 100 | Draft approval and scene promotion |
| `packages/core/src/lib/ifc-structural-parser.ts` | 300 | IFC/STEP ASCII parser |
| `apps/studio/src/components/scan-to-scene/ScanSiteWizard.tsx` | 600 | Manual scan UI |
| `apps/studio/src/components/scan-to-scene/GuidedCaptureAssistant.tsx` | 600 | Guided capture UI |
| `apps/studio/src/components/scan-to-scene/SceneBuilderWizard.tsx` | 400 | Scene builder UI |
| `apps/studio/src/components/site-intake/SiteIntakeHub.tsx` | 400 | Intake hub (6 paths) |
| `apps/studio/src/components/site-intake/SiteDraftReview.tsx` | 400 | Draft review UI |
| `apps/studio/src/lib/scan-adapters/registry.ts` | 170 | Adapter registry |
| `apps/studio/src/lib/scan-adapters/adapters/sam2-adapter.ts` | 120 | SAM2 segmentation adapter |
| `apps/studio/src/schema/reconstruction-pipeline.ts` | 150 | Reconstruction schema |

---

## Gaps & Future Work

| Gap | Impact | Priority |
|-----|--------|----------|
| No real ML segmentation | All candidates manual or stub | High |
| No real depth estimation | No 3D reconstruction from photos | High |
| No multi-photo correspondence | Single-photo only for most users | Medium |
| No LiDAR scale anchoring | Scale relies on manual reference | Medium |
| No video frame extraction | Photos only, no video intake | Low |
| No AR-guided capture | No phone AR overlay for guided marking | Low |

---

## Related Exploration Threads

- Thread 158: IFC/BIM Import Pipeline (Path 4)
- Thread 161: Governance & Audit Trail (truth labels, maturity)
- Thread 160: Rendering Pipeline (3D scene from compiled nodes)
