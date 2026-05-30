import type {
  CameraNode,
  CriticalZoneNode,
  DoorNode,
  ObstructionNode,
  PathPoint,
  PrivacyZoneNode,
  SensorNode,
  SecurityLightNode,
  ScenarioPath,
  WallNode,
  EntryPointNode,
  WindowNode,
} from "../schema/security-scene.js";
import { getDefaultQualityForTarget } from "./target-quality-requirements.js";

let _camCounter = 0;
let _obsCounter = 0;
let _lightCounter = 0;
let _wallCounter = 0;
let _doorCounter = 0;
let _windowCounter = 0;
let _criticalZoneCounter = 0;
let _privacyZoneCounter = 0;
let _entryCounter = 0;
let _pathCounter = 0;
let _sensorCounter = 0;

function makeId(prefix: string, counter: number) {
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function createCameraNode(position: [number, number, number]): CameraNode {
  _camCounter += 1;
  return {
    id: makeId("cam", _camCounter),
    nodeType: "camera",
    name: `Camera ${_camCounter}`,
    position,
    yawDeg: 180,
    pitchDeg: -20,
    rollDeg: 0,
    mountType: "ceiling",
    mountHeightM: 2.8,
    fovHorizontalDeg: 90,
    fovVerticalDeg: 50,
    rangeM: 12,
    resolutionMP: 4,
    lensType: "fixed",
    status: "on",
    nightMode: "none",
    irRangeM: 15,
    thermalCapable: false,
    ptz: false,
    clarity: "good",
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
    ndaaCompliant: true,
    privacyMaskingEnabled: false,
    tags: [],
  };
}

export function createObstructionNode(
  position: [number, number, number],
  obstructionType: ObstructionNode["obstructionType"] = "other",
): ObstructionNode {
  _obsCounter += 1;
  const labelMap: Record<string, string> = {
    shelf: "Shelf",
    cupboard: "Cupboard",
    counter: "Counter",
    pillar: "Pillar",
    partition: "Partition",
    storage_boxes: "Storage Boxes",
    vehicle: "Vehicle",
    glass_display: "Glass Display",
    tree: "Tree",
    gate: "Gate",
    signboard: "Signboard",
    curtain: "Curtain",
    other: "Obstruction",
  };

  return {
    id: makeId("obs", _obsCounter),
    nodeType: "obstruction",
    label: labelMap[obstructionType] ?? "Obstruction",
    position,
    rotationYDeg: 0,
    dimensions: [1, 0.5, 2],
    material: "solid",
    visionTransmission: 0,
    glareRisk: false,
    nightIRReflective: false,
    movable: true,
    movableByAI: true,
    obstructionType,
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

export function createSecurityLightNode(
  position: [number, number, number],
): SecurityLightNode {
  _lightCounter += 1;
  return {
    id: makeId("light", _lightCounter),
    nodeType: "security_light",
    name: `Light ${_lightCounter}`,
    lightType: "ceiling",
    position,
    status: "on",
    brightness: "medium",
    rangeM: 6,
    emergencyPower: false,
    illuminatesNightCoverage: true,
    glareRisk: "none",
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

export function createSensorNode(
  position: [number, number, number],
  sensorType: SensorNode["sensorType"] = "motion",
): SensorNode {
  _sensorCounter += 1;

  const labelMap: Record<SensorNode["sensorType"], string> = {
    motion: "Motion Sensor",
    door_contact: "Door Contact",
    access_reader: "Access Reader",
    audio: "Audio Sensor",
    vibration: "Vibration Sensor",
    panic_button: "Panic Button",
    smoke_heat: "Smoke / Heat Sensor",
  };

  return {
    id: makeId("sensor", _sensorCounter),
    nodeType: "sensor",
    label: `${labelMap[sensorType]} ${_sensorCounter}`,
    sensorType,
    position,
    state: "active",
    coverageMode: "detection",
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

export function createWallNode(
  start: [number, number],
  end: [number, number],
  options?: {
    wallHeightM?: number;
    thicknessM?: number;
    material?: WallNode["material"];
    visionTransmission?: number;
  },
): WallNode {
  _wallCounter += 1;
  const wallHeightM = options?.wallHeightM ?? 3;
  const thicknessM = options?.thicknessM ?? 0.18;
  const material = options?.material ?? "solid";

  return {
    id: makeId("wall", _wallCounter),
    nodeType: "wall",
    label: `Wall ${_wallCounter}`,
    start,
    end,
    heightM: wallHeightM,
    thicknessM,
    material,
    visionTransmission: options?.visionTransmission ?? 0,
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

export function createDoorNode(
  position: [number, number, number],
  wallId?: string,
): DoorNode {
  void wallId;
  _doorCounter += 1;

  return {
    id: makeId("door", _doorCounter),
    nodeType: "door",
    label: `Door ${_doorCounter}`,
    position,
    dimensions: [0.9, 2.1, 0.08],
    state: "closed",
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

export function createWindowNode(
  position: [number, number, number],
  wallId?: string,
): WindowNode {
  void wallId;
  _windowCounter += 1;

  return {
    id: makeId("window", _windowCounter),
    nodeType: "window",
    label: `Window ${_windowCounter}`,
    position: [position[0], 1.4, position[2]],
    dimensions: [1.2, 1.0, 0.06],
    state: "closed_glass",
    visionTransmission: 0.65,
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

export function createCriticalZoneNode(
  polygon: [number, number][],
  targetType: CriticalZoneNode["targetType"] = "person_detection",
): CriticalZoneNode {
  if (polygon.length < 3) {
    throw new Error("Critical zone requires at least 3 points.");
  }

  _criticalZoneCounter += 1;

  return {
    id: makeId("zone", _criticalZoneCounter),
    nodeType: "critical_zone",
    label: `Critical Zone ${_criticalZoneCounter}`,
    polygon,
    heightM: 2,
    priority: "high",
    requiredQuality: getDefaultQualityForTarget(targetType),
    targetType,
    nightRequired: true,
    redundancyRequired: false,
    privacyZone: false,
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

export function createPrivacyZoneNode(
  polygon: [number, number][],
): PrivacyZoneNode {
  if (polygon.length < 3) {
    throw new Error("Privacy zone requires at least 3 points.");
  }

  _privacyZoneCounter += 1;

  return {
    id: makeId("privacy", _privacyZoneCounter),
    nodeType: "privacy_zone",
    label: `Privacy Zone ${_privacyZoneCounter}`,
    polygon,
    restriction: "restricted_view",
    regulation: "manual",
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

export function createEntryPointNode(position: [number, number]): EntryPointNode {
  _entryCounter += 1;

  return {
    id: makeId("entry", _entryCounter),
    nodeType: "entry_point",
    label: `Entry ${_entryCounter}`,
    position,
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

export function createScenarioPathNode(points: PathPoint[]): ScenarioPath {
  if (points.length < 2) {
    throw new Error("Path requires at least two points.");
  }

  _pathCounter += 1;

  return {
    id: makeId("path", _pathCounter),
    nodeType: "path",
    label: `Path ${_pathCounter}`,
    actorType: "person",
    points,
    speedMps: 1.2,
    heightM: 1.75,
    timeOfDay: "day",
    intent: "authorized",
    source: "manual",
    reviewStatus: "unreviewed",
    sourceTrace: "",
    geometryValidity: "valid",
  };
}

/**
 * Backward compatibility alias: many call sites still import createPathNode.
 */
export const createPathNode = createScenarioPathNode;
