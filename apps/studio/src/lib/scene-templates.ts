import type { SecurityScene } from "@/schema/security-scene";

export interface SceneTemplate {
  id: string;
  name: string;
  description: string;
  category: "retail" | "office" | "industrial" | "education" | "residential";
  suggestedDimensions: { widthM: number; depthM: number; heightM: number };
  suggestedCameras: number;
  icon: string;
  create: (overrides?: { widthM?: number; depthM?: number; heightM?: number }) => SecurityScene;
}

const now = Date.now();
let counter = 0;
const uid = (prefix: string) => `${prefix}_${(now + counter++).toString(36)}`;

function makeBase(name: string, w: number, d: number, h: number): Partial<SecurityScene> {
  return {
    id: uid("scene"),
    name,
    createdAt: now,
    updatedAt: now,
    units: "meters",
    dimensions: { width: w, depth: d, height: h },
    assumptions: {
      wallHeightM: h,
      personHeightM: 1.75,
      vehicleHeightM: 1.5,
      timeOfDay: "day",
      interiorLightLevel: "normal",
      nightPenaltyMode: "simple",
      doriStandard: "oodpcvs_2025",
      pixelsPerMeter: { detection: 25, observation: 62.5, recognition: 125, identification: 250 },
      showAssumptionsPanel: false,
    },
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
    version: "0.1.0",
    snapshots: [],
    scenarios: [],
    changeLog: [],
  };
}

function rectWalls(w: number, d: number, h: number) {
  return [
    { id: uid("w"), nodeType: "wall" as const, label: "South Wall", start: [0, 0] as [number, number], end: [w, 0] as [number, number], heightM: h, thicknessM: 0.18, material: "solid" as const, visionTransmission: 0, source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
    { id: uid("w"), nodeType: "wall" as const, label: "North Wall", start: [0, d] as [number, number], end: [w, d] as [number, number], heightM: h, thicknessM: 0.18, material: "solid" as const, visionTransmission: 0, source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
    { id: uid("w"), nodeType: "wall" as const, label: "East Wall", start: [w, 0] as [number, number], end: [w, d] as [number, number], heightM: h, thicknessM: 0.18, material: "solid" as const, visionTransmission: 0, source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
    { id: uid("w"), nodeType: "wall" as const, label: "West Wall", start: [0, 0] as [number, number], end: [0, d] as [number, number], heightM: h, thicknessM: 0.18, material: "solid" as const, visionTransmission: 0, source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
  ];
}

// Helper: create a camera with all required schema fields
function cam(
  name: string,
  position: [number, number, number],
  yawDeg: number,
  pitchDeg: number,
  fovH: number,
  fovV: number,
  mountH: number,
) {
  return {
    id: uid("cam"),
    nodeType: "camera" as const,
    name,
    position,
    yawDeg,
    pitchDeg,
    rollDeg: 0,
    mountType: "ceiling" as const,
    mountHeightM: mountH,
    fovHorizontalDeg: fovH,
    fovVerticalDeg: fovV,
    rangeM: 10,
    resolutionMP: 2,
    lensType: "fixed" as const,
    status: "on" as const,
    nightMode: "ir" as const,
    irRangeM: 8,
    thermalCapable: false,
    ptz: false,
    clarity: "good" as const,
    source: "preset" as const,
    reviewStatus: "unreviewed" as const,
    sourceTrace: "",
    geometryValidity: "valid" as const,
    tags: [] as string[],
  };
}

// Helper: create a security light with all required schema fields
function light(name: string, position: [number, number, number], rangeM: number) {
  return {
    id: uid("light"),
    nodeType: "security_light" as const,
    name,
    lightType: "ceiling" as const,
    position,
    status: "on" as const,
    brightness: "high" as const,
    rangeM,
    emergencyPower: false,
    illuminatesNightCoverage: true,
    glareRisk: "none" as const,
    source: "preset" as const,
    reviewStatus: "unreviewed" as const,
    sourceTrace: "",
    geometryValidity: "valid" as const,
  };
}

// Helper: create an obstruction with all required schema fields
function obs(
  label: string,
  position: [number, number, number],
  dimensions: [number, number, number],
  obstructionType: "shelf" | "cupboard" | "counter" | "pillar" | "partition" | "vehicle" | "other",
  visionTransmission = 0,
) {
  return {
    id: uid("obs"),
    nodeType: "obstruction" as const,
    label,
    position,
    rotationYDeg: 0,
    dimensions,
    material: "solid" as const,
    visionTransmission,
    glareRisk: false,
    nightIRReflective: false,
    movable: true,
    movableByAI: true,
    obstructionType,
    source: "preset" as const,
    reviewStatus: "unreviewed" as const,
    sourceTrace: "",
    geometryValidity: "valid" as const,
  };
}

// Helper: create a critical zone with all required schema fields
function zone(
  label: string,
  polygon: [number, number][],
  requiredQuality: "detection" | "observation" | "recognition" | "identification",
  priority: "low" | "medium" | "high" | "critical" = "high",
  targetType: "person_detection" | "face_recognition" | "face_identification" | "cash_counter_activity" | "door_entry_exit" | "vehicle_detection" | "license_plate" | "package_detection" | "perimeter_breach" = "person_detection",
) {
  return {
    id: uid("zone"),
    nodeType: "critical_zone" as const,
    label,
    polygon,
    heightM: 2,
    priority,
    requiredQuality,
    targetType,
    nightRequired: false,
    redundancyRequired: false,
    privacyZone: false,
    source: "manual" as const,
    reviewStatus: "unreviewed" as const,
    sourceTrace: "",
    geometryValidity: "valid" as const,
  };
}

// Helper: create a door with all required schema fields
function door(label: string, position: [number, number, number], w = 0.9) {
  return {
    id: uid("d"),
    nodeType: "door" as const,
    label,
    position,
    dimensions: [w, 2.1, 0.1] as [number, number, number],
    state: "closed" as const,
    source: "preset" as const,
    reviewStatus: "unreviewed" as const,
    sourceTrace: "",
    geometryValidity: "valid" as const,
  };
}

// Helper: create a window with all required schema fields
function win(label: string, position: [number, number, number], dimensions: [number, number, number]) {
  return {
    id: uid("wi"),
    nodeType: "window" as const,
    label,
    position,
    dimensions,
    state: "closed_glass" as const,
    visionTransmission: 0.9,
    source: "preset" as const,
    reviewStatus: "unreviewed" as const,
    sourceTrace: "",
    geometryValidity: "valid" as const,
  };
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: "retail-shop",
    name: "Retail Shop",
    description: "Small retail store with counter, shelves, and entry door",
    category: "retail",
    suggestedDimensions: { widthM: 10, depthM: 8, heightM: 3 },
    suggestedCameras: 3,
    icon: "store",
    create: (overrides) => {
      const w = overrides?.widthM ?? 10;
      const d = overrides?.depthM ?? 8;
      const h = overrides?.heightM ?? 3;
      return {
        ...makeBase("Retail Shop", w, d, h) as SecurityScene,
        walls: rectWalls(w, d, h),
        doors: [door("Entry", [w / 2, 0, 0])],
        windows: [win("Storefront", [w / 2, 1.2, 0], [w - 2, 1.8, 0.1])],
        cameras: [
          cam("Entrance Camera", [w / 2 - 1.5, 2.8, 0.5], 180, -30, 90, 60, 2.8),
          cam("Counter Camera", [w / 2 + 2, 2.8, d / 2], -90, -25, 80, 55, 2.8),
          cam("Back Wall Camera", [w / 2, 2.8, d - 1], 0, -30, 90, 60, 2.8),
        ],
        securityLights: [light("Main Light", [w / 2, h - 0.2, d / 2], 8)],
        obstructions: [
          obs("Counter", [w / 2 + 1.5, 0, d / 2], [2, 1.1, 1], "counter"),
          obs("Shelf Unit", [1.5, 0, d / 2], [1, 2, 0.4], "shelf", 0.3),
        ],
        criticalZones: [
          zone("Entry Zone", [[w / 2 - 1.5, 0.5], [w / 2 + 1.5, 0.5], [w / 2 + 1.5, 2], [w / 2 - 1.5, 2]], "recognition", "high", "door_entry_exit"),
          zone("Counter Zone", [[w / 2 + 0.5, d / 2 - 1], [w / 2 + 3, d / 2 - 1], [w / 2 + 3, d / 2 + 1], [w / 2 + 0.5, d / 2 + 1]], "identification", "critical", "cash_counter_activity"),
          zone("Back Room", [[w / 2 - 2, d - 2], [w / 2 + 2, d - 2], [w / 2 + 2, d - 0.5], [w / 2 - 2, d - 0.5]], "detection", "medium", "person_detection"),
        ],
        entryPoints: [
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Front Door", position: [w / 2, 0] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
        ],
        paths: [],
        privacyZones: [],
      };
    },
  },
  {
    id: "open-office",
    name: "Open Office",
    description: "Open-plan office with desks, meeting area, and entrance",
    category: "office",
    suggestedDimensions: { widthM: 15, depthM: 12, heightM: 3 },
    suggestedCameras: 4,
    icon: "building2",
    create: (overrides) => {
      const w = overrides?.widthM ?? 15;
      const d = overrides?.depthM ?? 12;
      const h = overrides?.heightM ?? 3;
      return {
        ...makeBase("Open Office", w, d, h) as SecurityScene,
        walls: rectWalls(w, d, h),
        doors: [
          door("Main Entry", [w / 2, 0, 0], 1.2),
          door("Rear Exit", [w / 2, d, 0]),
        ],
        windows: [win("South Windows", [w / 2, 1.2, 0], [w - 2, 1.5, 0.1])],
        cameras: [
          cam("Entrance Camera", [w / 2, 2.8, 1], 180, -30, 90, 60, 2.8),
          cam("Main Floor Camera", [w / 4, 2.8, d / 2], 0, -35, 100, 65, 2.8),
          cam("Rear Camera", [3 * w / 4, 2.8, d / 2], 180, -35, 90, 60, 2.8),
          cam("Ceiling Overview", [w / 2, h - 0.5, d / 2], 0, -90, 110, 70, h - 0.5),
        ],
        securityLights: [light("Main Light", [w / 2, h - 0.2, d / 2], 10)],
        obstructions: [
          obs("Reception Desk", [w / 2, 0, 2], [3, 1.2, 0.8], "counter"),
        ],
        criticalZones: [
          zone("Entry Zone", [[w / 2 - 2, 0], [w / 2 + 2, 0], [w / 2 + 2, 3], [w / 2 - 2, 3]], "recognition", "high", "door_entry_exit"),
          zone("Server Room", [[w - 3, d - 3], [w - 1, d - 3], [w - 1, d - 1], [w - 3, d - 1]], "identification", "critical", "person_detection"),
        ],
        entryPoints: [
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Main Entry", position: [w / 2, 0] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Rear Exit", position: [w / 2, d] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
        ],
        paths: [],
        privacyZones: [],
      };
    },
  },
  {
    id: "warehouse",
    name: "Warehouse",
    description: "Industrial warehouse with racking, loading bay, and office",
    category: "industrial",
    suggestedDimensions: { widthM: 30, depthM: 20, heightM: 8 },
    suggestedCameras: 6,
    icon: "warehouse",
    create: (overrides) => {
      const w = overrides?.widthM ?? 30;
      const d = overrides?.depthM ?? 20;
      const h = overrides?.heightM ?? 8;
      return {
        ...makeBase("Warehouse", w, d, h) as SecurityScene,
        walls: rectWalls(w, d, h),
        doors: [
          door("Main Entry", [1.5, 0, 0], 1.2),
          door("Loading Bay", [w / 2, d, 0], 4),
        ],
        windows: [],
        cameras: [
          cam("Entry Camera", [1.5, 4, 1], 180, -30, 90, 60, 4),
          cam("Aisle 1 Camera", [w / 4, 6, d / 2], 0, -40, 80, 55, 6),
          cam("Aisle 2 Camera", [w / 2, 6, d / 4], 90, -35, 80, 55, 6),
          cam("Aisle 3 Camera", [3 * w / 4, 6, d / 2], 180, -40, 80, 55, 6),
          cam("Loading Bay Camera", [w / 2, 6, d - 2], 0, -30, 100, 65, 6),
          cam("Overview Camera", [w / 2, 7, d / 2], 0, -90, 120, 75, 7),
        ],
        securityLights: [],
        obstructions: [
          obs("Racking Row 1", [w / 4, 0, d / 3], [1, 6, 4], "shelf", 0.2),
          obs("Racking Row 2", [w / 4, 0, 2 * d / 3], [1, 6, 4], "shelf", 0.2),
          obs("Racking Row 3", [3 * w / 4, 0, d / 3], [1, 6, 4], "shelf", 0.2),
          obs("Racking Row 4", [3 * w / 4, 0, 2 * d / 3], [1, 6, 4], "shelf", 0.2),
        ],
        criticalZones: [
          zone("Loading Bay", [[w / 2 - 3, d - 3], [w / 2 + 3, d - 3], [w / 2 + 3, d], [w / 2 - 3, d]], "recognition", "high", "door_entry_exit"),
          zone("Entry", [[0, 0], [3, 0], [3, 3], [0, 3]], "recognition", "high", "person_detection"),
        ],
        entryPoints: [
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Main Entry", position: [1.5, 0] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Loading Bay", position: [w / 2, d] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
        ],
        paths: [],
        privacyZones: [],
      };
    },
  },
  {
    id: "classroom",
    name: "School Classroom",
    description: "Standard classroom with desks, whiteboard, and entrance",
    category: "education",
    suggestedDimensions: { widthM: 8, depthM: 10, heightM: 3 },
    suggestedCameras: 2,
    icon: "graduation-cap",
    create: (overrides) => {
      const w = overrides?.widthM ?? 8;
      const d = overrides?.depthM ?? 10;
      const h = overrides?.heightM ?? 3;
      return {
        ...makeBase("Classroom", w, d, h) as SecurityScene,
        walls: rectWalls(w, d, h),
        doors: [door("Entry", [0, d / 2, 0])],
        windows: [win("East Windows", [w, d / 2, 1.2], [0.1, 1.5, d - 4])],
        cameras: [
          cam("Front Camera", [w / 2, 2.6, d - 0.5], 0, -25, 100, 65, 2.6),
          cam("Rear Camera", [w / 2, 2.6, 0.5], 180, -25, 100, 65, 2.6),
        ],
        securityLights: [],
        obstructions: [],
        criticalZones: [
          zone("Entry", [[0, d / 2 - 0.8], [1, d / 2 - 0.8], [1, d / 2 + 0.8], [0, d / 2 + 0.8]], "recognition", "high", "door_entry_exit"),
          zone("Front", [[w / 4, d - 2], [3 * w / 4, d - 2], [3 * w / 4, d], [w / 4, d]], "detection", "medium", "person_detection"),
        ],
        entryPoints: [
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Entry", position: [0, d / 2] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
        ],
        paths: [],
        privacyZones: [],
      };
    },
  },
  {
    id: "parking-garage",
    name: "Parking Garage",
    description: "Covered parking area with vehicle entry and pedestrian access",
    category: "industrial",
    suggestedDimensions: { widthM: 25, depthM: 20, heightM: 3.5 },
    suggestedCameras: 4,
    icon: "parking-circle",
    create: (overrides) => {
      const w = overrides?.widthM ?? 25;
      const d = overrides?.depthM ?? 20;
      const h = overrides?.heightM ?? 3.5;
      return {
        ...makeBase("Parking Garage", w, d, h) as SecurityScene,
        walls: rectWalls(w, d, h),
        doors: [
          door("Vehicle Entry", [w / 2 - 3, 0, 0], 4),
          door("Vehicle Exit", [w / 2 + 3, 0, 0], 4),
          door("Pedestrian Exit", [w / 2, d, 0], 1.2),
        ],
        windows: [],
        cameras: [
          cam("Entry Gate Camera", [w / 2, 3, 1], 180, -20, 80, 55, 3),
          cam("Aisle 1 Camera", [w / 4, 3, d / 2], 0, -35, 90, 60, 3),
          cam("Aisle 2 Camera", [3 * w / 4, 3, d / 2], 180, -35, 90, 60, 3),
          cam("Pedestrian Exit Camera", [w / 2, 3, d - 0.5], 0, -25, 90, 60, 3),
        ],
        securityLights: [],
        obstructions: [
          obs("Column Row 1", [w / 3, 0, d / 2], [0.4, h, 0.4], "pillar"),
          obs("Column Row 2", [2 * w / 3, 0, d / 2], [0.4, h, 0.4], "pillar"),
        ],
        criticalZones: [
          zone("Entry Gate", [[w / 2 - 4, 0], [w / 2 + 4, 0], [w / 2 + 4, 3], [w / 2 - 4, 3]], "recognition", "high", "vehicle_detection"),
          zone("Pedestrian Exit", [[w / 2 - 1, d - 1], [w / 2 + 1, d - 1], [w / 2 + 1, d], [w / 2 - 1, d]], "recognition", "high", "door_entry_exit"),
        ],
        entryPoints: [
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Vehicle Entry", position: [w / 2 - 3, 0] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Pedestrian Exit", position: [w / 2, d] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
        ],
        paths: [],
        privacyZones: [],
      };
    },
  },
  {
    id: "residential-house",
    name: "Residential House",
    description: "Single-family home with living areas, bedrooms, garage, and private outdoor space.",
    category: "residential",
    suggestedDimensions: { widthM: 18, depthM: 22, heightM: 3.5 },
    suggestedCameras: 5,
    icon: "home",
    create: (overrides) => {
      const w = overrides?.widthM ?? 18;
      const d = overrides?.depthM ?? 22;
      const h = overrides?.heightM ?? 3.5;
      return {
        ...makeBase("Residential House", w, d, h) as SecurityScene,
        walls: [
          ...rectWalls(w, d, h),
          // Interior partitions
          { id: uid("w"), nodeType: "wall" as const, label: "Hallway-Living", start: [0, 8] as [number, number], end: [12, 8] as [number, number], heightM: h, thicknessM: 0.12, material: "solid" as const, visionTransmission: 0, source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
          { id: uid("w"), nodeType: "wall" as const, label: "Living-Dining", start: [12, 8] as [number, number], end: [12, 16] as [number, number], heightM: h, thicknessM: 0.12, material: "solid" as const, visionTransmission: 0, source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
          { id: uid("w"), nodeType: "wall" as const, label: "Bedroom Divider", start: [0, 14] as [number, number], end: [10, 14] as [number, number], heightM: h, thicknessM: 0.12, material: "solid" as const, visionTransmission: 0, source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
        ],
        doors: [
          door("Front Door", [w / 2, 0, 0], 1.2),
          door("Back Door", [w / 2, d, 0], 1.0),
          door("Garage Door", [0, 3, 0], 3.0),
        ],
        windows: [
          win("Living Room Window", [w / 4, 1.2, 0], [1.8, 1.5, 0.1]),
          win("Bedroom Window", [3 * w / 4, 1.2, 0], [1.5, 1.5, 0.1]),
          win("Kitchen Window", [w / 4, 1.2, d], [1.5, 1.2, 0.1]),
        ],
        cameras: [
          cam("Front Door Cam", [w / 2, 2.8, 1], 180, 15, 90, 60, 2.8),
          cam("Garage Cam", [4, 2.8, 17], 90, 10, 90, 60, 2.8),
          cam("Back Yard Cam", [w / 2, 2.8, d - 1], 0, 20, 100, 65, 2.8),
          cam("Hallway Cam", [1.5, 2.8, 9], 90, 30, 110, 70, 2.8),
          cam("Living Room Cam", [15, 2.8, 12], 270, 25, 100, 65, 2.8),
        ],
        securityLights: [
          light("Front Porch Light", [w / 2, 2.6, 0], 6),
          light("Back Yard Light", [w / 2, 2.6, d], 6),
          light("Garage Light", [0, 2.8, 3], 4),
          light("Hallway Light", [1.5, 2.8, 9], 3),
        ],
        obstructions: [],
        criticalZones: [
          zone("Front Entry", [[w / 2 - 2, 0], [w / 2 + 2, 0], [w / 2 + 2, 2], [w / 2 - 2, 2]], "recognition", "high", "door_entry_exit"),
          zone("Garage Entry", [[-1, 2], [2, 2], [2, 4], [-1, 4]], "recognition", "high", "door_entry_exit"),
          zone("Back Door", [[w / 2 - 2, d], [w / 2 + 2, d], [w / 2 + 2, d - 2], [w / 2 - 2, d - 2]], "recognition", "high", "door_entry_exit"),
          zone("Living Room", [[12, 10], [w, 10], [w, 16], [12, 16]], "observation", "medium", "person_detection"),
          zone("Main Hallway", [[0, 8], [2, 8], [2, 14], [0, 14]], "detection", "medium", "person_detection"),
        ],
        entryPoints: [
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Front Door", position: [w / 2, 0] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Back Door", position: [w / 2, d] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
          { id: uid("entry"), nodeType: "entry_point" as const, label: "Garage Door", position: [0, 3] as [number, number], source: "manual" as const, reviewStatus: "unreviewed" as const, sourceTrace: "", geometryValidity: "valid" as const },
        ],
        paths: [],
        privacyZones: [],
      };
    },
  },
];

export function getTemplateById(id: string): SceneTemplate | undefined {
  return SCENE_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: SceneTemplate["category"]): SceneTemplate[] {
  return SCENE_TEMPLATES.filter((t) => t.category === category);
}
