# Data Model — SecurityScene

**Status:** Design draft — 2026-05-25
**This is the most important file in the repo.** All layers read and write this schema.
Schema changes require updating: TypeScript types, Zod schemas, simulation engine, AI system prompts, report templates.

---

## Design Principles

1. **Single source of truth.** No layer maintains its own scene representation.
2. **Flat dictionary storage.** Inherit Pascal's `nodes: Record<id, AnyNode>` pattern for O(1) access.
3. **Three-layer entities.** Every physical object has: visual mesh, physics collider, vision collider.
4. **Typed IDs.** All IDs use type prefixes: `cam_`, `light_`, `wall_`, `zone_`, `path_`, etc.
5. **Simulation is derived, not stored.** `SimulationResult` is computed on demand, cached, not canonical.
6. **Snapshots are first-class.** Before/after comparison requires serializable snapshots.
7. **Source tracking.** Every node records how it was created: manual, AI, scan, import, preset.
8. **Assumptions are explicit.** All simulation assumptions visible and editable. Never hidden defaults.

---

## Core Node Types

### CameraNode

```typescript
type CameraNode = {
  id: string;                    // "cam_abc123"
  nodeType: "camera";
  name: string;                  // "Camera 1"
  parentId?: string;             // level it belongs to

  // Position & orientation
  position: [number, number, number];  // [x, y, z] in meters
  yawDeg: number;                // horizontal rotation (0 = north)
  pitchDeg: number;              // vertical tilt (-90 = straight down)
  rollDeg?: number;              // rarely used

  // Mount
  mountType: "wall" | "ceiling" | "pole" | "corner" | "desk";
  mountHeightM: number;          // height from floor level

  // Optics
  fovHorizontalDeg: number;      // 60–180 typical
  fovVerticalDeg: number;        // computed from aspect if not set
  resolutionMP: number;          // megapixels (2, 4, 8, 12...)
  resolutionWidth?: number;      // pixels
  resolutionHeight?: number;     // pixels
  lensType: "fixed" | "varifocal" | "fisheye" | "panoramic";
  focalLengthMm?: number;

  // Status & capability
  status: "on" | "off" | "blocked" | "dirty" | "malfunctioning";
  nightMode: "none" | "ir" | "low_light" | "thermal";
  irRangeM: number;              // effective IR range in darkness
  thermalCapable: boolean;
  ptz: boolean;
  clarity: "poor" | "average" | "good" | "excellent";

  // Presets
  presetId?: string;             // references camera preset library

  // Meta
  source: "manual" | "ai" | "scan" | "import" | "preset";
  notes?: string;
  tags?: string[];
};
```

### SecurityLightNode

```typescript
type SecurityLightNode = {
  id: string;                    // "light_abc123"
  nodeType: "security_light";
  name: string;

  lightType: "ceiling" | "wall" | "flood" | "street" | "emergency" | "ir_flood";
  position: [number, number, number];
  yawDeg?: number;
  pitchDeg?: number;

  status: "on" | "off" | "failed";
  brightness: "dim" | "low" | "medium" | "high" | "very_high";
  rangeM: number;
  coneDeg?: number;               // beam spread angle

  colorTemperatureK?: number;     // 2700K warm → 6500K cool
  emergencyPower: boolean;        // stays on in power failure

  // Simulation effects
  illuminatesNightCoverage: boolean;
  glareRisk: "none" | "low" | "medium" | "high";

  source: "manual" | "ai" | "import";
};
```

### ObstructionNode

```typescript
type ObstructionNode = {
  id: string;                    // "obs_abc123"
  nodeType: "obstruction";
  label: string;                 // "Shelf 1", "Cupboard near counter"

  position: [number, number, number];
  rotationYDeg: number;
  dimensions: [number, number, number];   // [width, depth, height] in meters

  material: ObstructionMaterial;

  // Vision properties
  visionTransmission: number;     // 0 = full block, 1 = full pass
  glareRisk: boolean;
  nightIRReflective: boolean;

  // Physics
  movable: boolean;
  movableByAI: boolean;           // can AI counterfactual engine suggest moving this?
  weightKg?: number;

  // Metadata
  obstructionType: ObstructionType;
  source: "manual" | "ai" | "scan" | "import";
};

type ObstructionMaterial =
  | "solid"        // visionTransmission: 0
  | "glass"        // visionTransmission: 0.9, glareRisk: true
  | "grill"        // visionTransmission: 0.5
  | "mesh"         // visionTransmission: 0.6
  | "curtain"      // visionTransmission: 0.2, varies by night
  | "reflective"   // visionTransmission: 0.1, glareRisk: true
  | "partial"      // custom visionTransmission

type ObstructionType =
  | "shelf" | "cupboard" | "counter" | "pillar" | "partition"
  | "vehicle" | "tree" | "gate" | "signboard" | "storage_boxes"
  | "glass_display" | "curtain" | "other"
```

### CriticalZoneNode

```typescript
type CriticalZoneNode = {
  id: string;                    // "zone_abc123"
  nodeType: "critical_zone";
  label: string;                 // "Cash Counter", "Main Entry"

  polygon: [number, number][];   // floor-plan polygon in [x, z] meters
  heightM?: number;              // zone height (default: 2m)

  priority: "low" | "medium" | "high" | "critical";

  // Coverage requirements
  requiredQuality: DORIQuality;
  targetType: SecurityTarget;
  nightRequired: boolean;
  redundancyRequired: boolean;   // must have 2+ cameras covering this zone

  // Status (derived from simulation)
  currentQuality?: DORIQuality;   // computed
  coverageStatus?: "pass" | "fail" | "partial" | "unknown";
  coveringCameras?: string[];     // camera IDs

  privacyZone?: boolean;          // must NOT be covered
};

type DORIQuality = "none" | "detection" | "observation" | "recognition" | "identification";

type SecurityTarget =
  | "person_detection"
  | "face_recognition"
  | "face_identification"
  | "vehicle_detection"
  | "license_plate"
  | "package_detection"
  | "cash_counter_activity"
  | "door_entry_exit"
  | "perimeter_breach"
```

### ScenarioPath

```typescript
type ScenarioPath = {
  id: string;                    // "path_abc123"
  label: string;                 // "Front Entry to Counter"

  actorType: "person" | "vehicle" | "guard" | "crowd";
  points: PathPoint[];

  speedMps: number;              // movement speed
  heightM: number;               // actor height (person = 1.7m)
  widthM?: number;               // actor width

  // Scenario context
  timeOfDay: "day" | "night" | "dusk" | "dawn";
  intent: "authorized" | "suspicious" | "incident_replay";
  label_detail?: string;         // "Theft incident 2024-11-15 01:12"
};

type PathPoint = {
  position: [number, number];    // [x, z] floor coordinates
  timestamp?: number;            // seconds from start
  action?: "enter" | "wait" | "run" | "crouch" | "exit";
};
```

### SimulationAssumptions

```typescript
type SimulationAssumptions = {
  wallHeightM: number;           // default 3.0
  personHeightM: number;         // default 1.7
  vehicleHeightM: number;        // default 1.5

  timeOfDay: "day" | "night" | "custom";
  exteriorLightLux?: number;     // if custom
  interiorLightLevel: "dark" | "dim" | "normal" | "bright";

  nightPenaltyMode: "none" | "simple" | "detailed";
  // simple: flat 2-level degradation
  // detailed: per-light-source calculation

  doriStandard: "simplified" | "iec62676";
  pixelsPerMeter: {
    detection: number;           // default 25 PPM
    observation: number;         // default 62.5 PPM
    recognition: number;         // default 125 PPM
    identification: number;      // default 250 PPM
  };

  showAssumptionsPanel: boolean; // always-visible transparency setting
};
```

### SimulationResult (Derived — Not Canonical)

```typescript
type SimulationResult = {
  computedAt: number;            // timestamp

  // Floor coverage
  totalCoveragePct: number;
  blindspotPct: number;
  coverageByQuality: {
    detection: number;
    observation: number;
    recognition: number;
    identification: number;
  };

  // Zone results
  criticalZoneResults: ZoneResult[];

  // Camera results
  cameraResults: CameraResult[];

  // Path results
  pathResults: PathVisibilityResult[];

  // Issues
  issues: SecurityIssue[];
  recommendations: Recommendation[];

  // Adversarial path (if computed)
  adversarialPath?: AdversarialPathResult;

  // Temporal (if computed)
  temporalProfile?: TemporalSecurityProfile;
};

type ZoneResult = {
  zoneId: string;
  label: string;
  requiredQuality: DORIQuality;
  actualQuality: DORIQuality;
  coveringCameras: string[];
  redundancyCameraCount: number;
  status: "pass" | "fail" | "partial";
  failureReasons: string[];
};

type CameraResult = {
  cameraId: string;
  coveragePct: number;           // % of floor this camera covers
  qualityByZone: Record<string, DORIQuality>;
  criticalZonesCovered: string[];
  criticalZonesFailed: string[];
  offlineImpact: string[];       // zones that fail if this camera goes offline
};

### CoverageCellResult

```typescript
type CameraCellEvaluation = {
  quality: DORIQuality;
  ppm: number;
  probability: number;
  visible: boolean;              // true when the target is geometrically visible
  blockedBy?: string;            // source label when occluded or partially transmitted
  inFov: boolean;
  withinRange: boolean;
  distanceM: number;
  hAngleDeg: number;
  vAngleDeg: number;
  reasonCodes: string[];         // e.g. OUT_OF_RANGE, OUT_OF_FOV, PARTIAL_MATERIAL
};

type CoverageCellResult = {
  x: number;
  z: number;
  quality: DORIQuality;
  coveringCameras: string[];
  blockedBy: string[];
  ppm: number;
  coverageIncluded: boolean;     // counts toward coverage KPI
  privacyRestricted: boolean;    // true when the cell belongs to a privacy zone
  cameraEvaluations?: Record<string, CameraCellEvaluation>;
};
```

type PathVisibilityResult = {
  pathId: string;
  totalDurationS: number;
  visibleDurationS: number;
  lostDurationS: number;
  visibilityByCamera: Record<string, PathCameraVisibility>;
  timeline: PathTimelineEvent[];
};

type PathCameraVisibility = {
  cameraId: string;
  visibleS: number;
  maxQuality: DORIQuality;
  lostBehind?: string;           // "Shelf 1", "pillar", etc.
};

type PathTimelineEvent = {
  timeS: number;
  event: "visible" | "lost" | "quality_change";
  cameraId?: string;
  quality?: DORIQuality;
  reason?: string;
};

type SecurityIssue = {
  severity: "critical" | "high" | "medium" | "low";
  category: "blindspot" | "quality_fail" | "redundancy" | "night" | "privacy";
  description: string;
  affectedZones: string[];
  affectedCameras: string[];
};

type Recommendation = {
  type: "move_object" | "rotate_camera" | "add_camera" | "add_light" | "change_fov" | "other";
  description: string;
  estimatedImpact: string;
  costCategory: "free" | "low" | "medium" | "high";
  verified: boolean;             // was this tested by the simulation?
  beforeMetrics?: Partial<SimulationResult>;
  afterMetrics?: Partial<SimulationResult>;
};
```

### SceneSnapshot

```typescript
type SceneSnapshot = {
  id: string;
  label: string;                 // "Current Setup", "After Moving Shelf 1"
  createdAt: number;
  scene: SecurityScene;          // full scene state
  simulation?: SimulationResult; // computed state at snapshot time
  notes?: string;
};
```

---

## The Full SecurityScene

```typescript
type SecurityScene = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;

  // Scene settings
  units: "meters" | "feet";
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };

  // Space layer (Pascal-origin node types)
  nodes: Record<string, PascalNode>;    // walls, slabs, doors, windows, zones
  rootNodeIds: string[];
  dirtyNodes: Set<string>;              // nodes pending geometry update

  // Security layer (SentinelTwin additions — stored in nodes too, typed separately for clarity)
  cameras: CameraNode[];
  securityLights: SecurityLightNode[];
  obstructions: ObstructionNode[];
  criticalZones: CriticalZoneNode[];
  privacyZones: PrivacyZoneNode[];
  entryPoints: EntryPointNode[];
  paths: ScenarioPath[];
  guardPatrols: GuardPatrolNode[];

  // Simulation
  assumptions: SimulationAssumptions;
  simulation?: SimulationResult;         // derived, not canonical
  snapshots: SceneSnapshot[];
  scenarios: Scenario[];

  // Provenance
  source: "manual" | "ai_generated" | "floor_plan_import" | "scan_import" | "demo";
  version: string;
};
```

---

## Zustand Store Shape

Inheriting Pascal's pattern, SentinelTwin's Zustand store extends `useScene`:

```typescript
type SentinelSceneStore = {
  // All nodes in flat dictionary (Pascal pattern)
  nodes: Record<string, AnySecurityNode>;
  rootNodeIds: string[];
  dirtyNodes: Set<string>;

  // CRUD (Pascal pattern)
  createNode: (node: AnySecurityNode, parentId?: string) => void;
  updateNode: (id: string, updates: Partial<AnySecurityNode>) => void;
  deleteNode: (id: string) => void;

  // Simulation cache
  simulation: SimulationResult | null;
  simulationDirty: boolean;
  computeSimulation: () => Promise<void>;

  // Snapshots
  snapshots: SceneSnapshot[];
  saveSnapshot: (label: string) => void;
  compareSnapshots: (aId: string, bId: string) => SnapshotDelta;

  // Assumptions
  assumptions: SimulationAssumptions;
  updateAssumptions: (updates: Partial<SimulationAssumptions>) => void;

  // Scene I/O
  exportScene: () => SecurityScene;
  importScene: (scene: SecurityScene) => void;
};
```

---

## Camera Preset Library

Initial presets (not real brands, tunable):

```typescript
const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: "indoor_dome_2mp",
    name: "2MP Indoor Dome",
    fovHorizontalDeg: 110,
    resolutionMP: 2,
    nightMode: "ir",
    irRangeM: 15,
    clarity: "average",
    useCase: "General indoor coverage",
  },
  {
    id: "wide_dome_4mp",
    name: "4MP Wide Dome",
    fovHorizontalDeg: 130,
    resolutionMP: 4,
    nightMode: "ir",
    irRangeM: 20,
    clarity: "good",
    useCase: "Entry areas, corridors",
  },
  {
    id: "bullet_8mp",
    name: "8MP Bullet",
    fovHorizontalDeg: 60,
    resolutionMP: 8,
    nightMode: "ir",
    irRangeM: 40,
    clarity: "excellent",
    useCase: "Perimeter, parking, long corridors",
  },
  {
    id: "ptz_outdoor",
    name: "PTZ Outdoor",
    fovHorizontalDeg: 90,  // variable
    resolutionMP: 4,
    nightMode: "low_light",
    irRangeM: 50,
    clarity: "good",
    ptz: true,
    useCase: "Wide outdoor areas, patrol",
  },
  {
    id: "thermal_perimeter",
    name: "Thermal Perimeter",
    fovHorizontalDeg: 45,
    resolutionMP: 0.3,
    nightMode: "thermal",
    irRangeM: 200,
    clarity: "average",
    useCase: "Perimeter detection, darkness, fog",
  },
  {
    id: "lowlight_indoor",
    name: "Low-Light Indoor",
    fovHorizontalDeg: 90,
    resolutionMP: 4,
    nightMode: "low_light",
    irRangeM: 25,
    clarity: "good",
    useCase: "Low-light indoor, retail, warehouse",
  },
  {
    id: "lpr_camera",
    name: "License Plate Reader",
    fovHorizontalDeg: 30,
    resolutionMP: 5,
    nightMode: "ir",
    irRangeM: 30,
    clarity: "excellent",
    useCase: "Vehicle gate, parking entry/exit",
  },
];
```

---

## Schema Change Protocol

When the SecurityScene schema changes:

1. Update TypeScript types in `packages/core/src/schema/`
2. Update Zod validation schemas
3. Update simulation engine input/output types in `packages/simulation/`
4. Update AI agent system prompts in `packages/agents/prompts/`
5. Update report templates in `packages/report/`
6. Add migration function if existing JSON scenes need updating
7. Update this document
8. Log the decision in `Docs/decisions/DECISION_LOG.md`

No schema change is complete until all 8 steps are done.
