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
  ReviewStatus,
  SceneSource,
} from "@/schema/security-scene";
import { getDefaultQualityForTarget } from "@/lib/target-quality-requirements";

type CounterState = {
  cam: number;
  obs: number;
  light: number;
  wall: number;
  door: number;
  window: number;
  criticalZone: number;
  privacyZone: number;
  entry: number;
  path: number;
  sensor: number;
};

function createCounterState(): CounterState {
  return { cam: 0, obs: 0, light: 0, wall: 0, door: 0, window: 0, criticalZone: 0, privacyZone: 0, entry: 0, path: 0, sensor: 0 };
}

const counters: CounterState = createCounterState();

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function resetNodeCounters(): void {
  Object.assign(counters, createCounterState());
}

// ── Common options shape used by all factory functions ──

type NodeFactoryOptions = {
  reviewStatus?: ReviewStatus;
  sourceTrace?: string;
};

type CameraFactoryOptions = NodeFactoryOptions & {
  name?: string;
  presetId?: string;
  viewMotion?: CameraNode["viewMotion"];
  yawDeg?: number;
  pitchDeg?: number;
  rollDeg?: number;
  mountType?: CameraNode["mountType"];
  mountHeightM?: number;
  fovHorizontalDeg?: number;
  fovVerticalDeg?: number;
  rangeM?: number;
  resolutionMP?: number;
  lensType?: CameraNode["lensType"];
  status?: CameraNode["status"];
  nightMode?: CameraNode["nightMode"];
  irRangeM?: number;
  thermalCapable?: boolean;
  ptz?: boolean;
  clarity?: CameraNode["clarity"];
  source?: SceneSource;
};

type ObstructionFactoryOptions = NodeFactoryOptions & {
  rotationYDeg?: number;
  dimensions?: [number, number, number];
  material?: ObstructionNode["material"];
  visionTransmission?: number;
  glareRisk?: boolean;
  nightIRReflective?: boolean;
  movable?: boolean;
  movableByAI?: boolean;
  source?: SceneSource;
};

type LightFactoryOptions = NodeFactoryOptions & {
  name?: string;
  lightType?: SecurityLightNode["lightType"];
  status?: SecurityLightNode["status"];
  brightness?: SecurityLightNode["brightness"];
  rangeM?: number;
  emergencyPower?: boolean;
  illuminatesNightCoverage?: boolean;
  glareRisk?: SecurityLightNode["glareRisk"];
  source?: SceneSource;
};

type SensorFactoryOptions = NodeFactoryOptions & {
  state?: SensorNode["state"];
  coverageMode?: SensorNode["coverageMode"];
  source?: SceneSource;
};

type WallFactoryOptions = NodeFactoryOptions & {
  wallHeightM?: number;
  thicknessM?: number;
  material?: WallNode["material"];
  visionTransmission?: number;
  source?: SceneSource;
};

type DoorFactoryOptions = NodeFactoryOptions & {
  dimensions?: [number, number, number];
  state?: DoorNode["state"];
  source?: SceneSource;
};

type WindowFactoryOptions = NodeFactoryOptions & {
  dimensions?: [number, number, number];
  state?: WindowNode["state"];
  visionTransmission?: number;
  sillHeightM?: number;
  source?: SceneSource;
};

type CriticalZoneFactoryOptions = NodeFactoryOptions & {
  heightM?: number;
  priority?: CriticalZoneNode["priority"];
  requiredQuality?: CriticalZoneNode["requiredQuality"];
  nightRequired?: boolean;
  redundancyRequired?: boolean;
  privacyZone?: boolean;
  source?: SceneSource;
};

type PrivacyZoneFactoryOptions = NodeFactoryOptions & {
  restriction?: PrivacyZoneNode["restriction"];
  regulation?: string;
  source?: SceneSource;
};

type EntryPointFactoryOptions = NodeFactoryOptions & {
  source?: SceneSource;
};

type PathFactoryOptions = NodeFactoryOptions & {
  label?: string;
  actorType?: ScenarioPath["actorType"];
  speedMps?: number;
  heightM?: number;
  widthM?: number;
  timeOfDay?: ScenarioPath["timeOfDay"];
  intent?: ScenarioPath["intent"];
  labelDetail?: string;
  source?: SceneSource;
};

// ── Factory functions ──

export function createCameraNode(
  position: [number, number, number],
  options?: CameraFactoryOptions,
): CameraNode {
  counters.cam += 1;
  return {
    id: makeId("cam"),
    nodeType: "camera",
    name: options?.name ?? `Camera ${counters.cam}`,
    position,
    yawDeg: options?.yawDeg ?? 180,
    pitchDeg: options?.pitchDeg ?? -20,
    rollDeg: options?.rollDeg ?? 0,
    mountType: options?.mountType ?? "ceiling",
    mountHeightM: options?.mountHeightM ?? 2.8,
    fovHorizontalDeg: options?.fovHorizontalDeg ?? 90,
    fovVerticalDeg: options?.fovVerticalDeg ?? 50,
    rangeM: options?.rangeM ?? 12,
    resolutionMP: options?.resolutionMP ?? 4,
    lensType: options?.lensType ?? "fixed",
    presetId: options?.presetId,
    viewMotion: options?.viewMotion ?? { movementMode: "fixed", dwellSeconds: 0, waypoints: [] },
    status: options?.status ?? "on",
    nightMode: options?.nightMode ?? "none",
    irRangeM: options?.irRangeM ?? 15,
    thermalCapable: options?.thermalCapable ?? false,
    ptz: options?.ptz ?? false,
    clarity: options?.clarity ?? "good",
    liveConnectionStatus: "disconnected",
    liveSessionState: "idle",
    liveSessionExpiresAt: undefined,
    transportSessionState: "idle",
    probeCount: 0,
    protocolProfile: "onvif_device",
    authMode: "none",
    authState: "unauthenticated",
    authRealm: undefined,
    authSessionId: undefined,
    authSessionExpiresAt: undefined,
    transportResponseStatus: undefined,
    transportResponseStatusText: undefined,
    authChallengeHeader: undefined,
    authChallengeScheme: undefined,
    authChallengeRealm: undefined,
    ndaaCompliant: true,
    privacyMaskingEnabled: false,
    tags: [],
    lprCapable: false,
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createCameraNode",
    geometryValidity: "valid",
  };
}

export function createObstructionNode(
  position: [number, number, number],
  obstructionType: ObstructionNode["obstructionType"] = "other",
  options?: ObstructionFactoryOptions,
): ObstructionNode {
  counters.obs += 1;
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
    id: makeId("obs"),
    nodeType: "obstruction",
    label: labelMap[obstructionType] ?? "Obstruction",
    position,
    rotationYDeg: options?.rotationYDeg ?? 0,
    dimensions: options?.dimensions ?? [1, 0.5, 2],
    material: options?.material ?? "solid",
    visionTransmission: options?.visionTransmission ?? 0,
    glareRisk: options?.glareRisk ?? false,
    nightIRReflective: options?.nightIRReflective ?? false,
    movable: options?.movable ?? true,
    movableByAI: options?.movableByAI ?? true,
    obstructionType,
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createObstructionNode",
    geometryValidity: "valid",
  };
}

export function createSecurityLightNode(
  position: [number, number, number],
  options?: LightFactoryOptions,
): SecurityLightNode {
  counters.light += 1;
  return {
    id: makeId("light"),
    nodeType: "security_light",
    name: options?.name ?? `Light ${counters.light}`,
    lightType: options?.lightType ?? "ceiling",
    position,
    status: options?.status ?? "on",
    brightness: options?.brightness ?? "medium",
    rangeM: options?.rangeM ?? 6,
    emergencyPower: options?.emergencyPower ?? false,
    illuminatesNightCoverage: options?.illuminatesNightCoverage ?? true,
    glareRisk: options?.glareRisk ?? "none",
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createSecurityLightNode",
    geometryValidity: "valid",
  };
}

export function createSensorNode(
  position: [number, number, number],
  sensorType: SensorNode["sensorType"] = "motion",
  options?: SensorFactoryOptions,
): SensorNode {
  counters.sensor += 1;

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
    id: makeId("sensor"),
    nodeType: "sensor",
    label: `${labelMap[sensorType]} ${counters.sensor}`,
    sensorType,
    position,
    state: options?.state ?? "active",
    coverageMode: options?.coverageMode ?? "detection",
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createSensorNode",
    geometryValidity: "valid",
  };
}

export function createWallNode(
  start: [number, number],
  end: [number, number],
  options?: WallFactoryOptions,
): WallNode {
  counters.wall += 1;
  const wallHeightM = options?.wallHeightM ?? 3;
  const thicknessM = options?.thicknessM ?? 0.18;
  const material = options?.material ?? "solid";

  return {
    id: makeId("wall"),
    nodeType: "wall",
    label: `Wall ${counters.wall}`,
    start,
    end,
    heightM: wallHeightM,
    thicknessM,
    material,
    visionTransmission: options?.visionTransmission ?? 0,
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createWallNode",
    geometryValidity: "valid",
  };
}

export function createDoorNode(
  position: [number, number, number],
  wallId?: string,
  options?: DoorFactoryOptions,
): DoorNode {
  counters.door += 1;

  return {
    id: makeId("door"),
    nodeType: "door",
    label: `Door ${counters.door}`,
    position,
    dimensions: options?.dimensions ?? [0.9, 2.1, 0.08],
    state: options?.state ?? "closed",
    wallId,
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createDoorNode",
    geometryValidity: "valid",
  };
}

export function createWindowNode(
  position: [number, number, number],
  wallId?: string,
  options?: WindowFactoryOptions,
): WindowNode {
  counters.window += 1;
  const sillHeightM = options?.sillHeightM ?? 1.4;

  return {
    id: makeId("window"),
    nodeType: "window",
    label: `Window ${counters.window}`,
    position: [position[0], sillHeightM, position[2]],
    dimensions: options?.dimensions ?? [1.2, 1.0, 0.06],
    state: options?.state ?? "closed_glass",
    visionTransmission: options?.visionTransmission ?? 0.65,
    wallId,
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createWindowNode",
    geometryValidity: "valid",
  };
}

export function createCriticalZoneNode(
  polygon: [number, number][],
  targetType: CriticalZoneNode["targetType"] = "person_detection",
  options?: CriticalZoneFactoryOptions,
): CriticalZoneNode {
  if (polygon.length < 3) {
    throw new Error("Critical zone requires at least 3 points.");
  }

  counters.criticalZone += 1;

  return {
    id: makeId("zone"),
    nodeType: "critical_zone",
    label: `Critical Zone ${counters.criticalZone}`,
    polygon,
    heightM: options?.heightM ?? 2,
    priority: options?.priority ?? "high",
    requiredQuality: options?.requiredQuality ?? getDefaultQualityForTarget(targetType),
    targetType,
    nightRequired: options?.nightRequired ?? true,
    redundancyRequired: options?.redundancyRequired ?? false,
    privacyZone: options?.privacyZone ?? false,
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createCriticalZoneNode",
    geometryValidity: "valid",
  };
}

export function createPrivacyZoneNode(
  polygon: [number, number][],
  options?: PrivacyZoneFactoryOptions,
): PrivacyZoneNode {
  if (polygon.length < 3) {
    throw new Error("Privacy zone requires at least 3 points.");
  }

  counters.privacyZone += 1;

  return {
    id: makeId("privacy"),
    nodeType: "privacy_zone",
    label: `Privacy Zone ${counters.privacyZone}`,
    polygon,
    restriction: options?.restriction ?? "restricted_view",
    regulation: options?.regulation ?? "manual",
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createPrivacyZoneNode",
    geometryValidity: "valid",
  };
}

export function createEntryPointNode(
  position: [number, number],
  options?: EntryPointFactoryOptions,
): EntryPointNode {
  counters.entry += 1;

  return {
    id: makeId("entry"),
    nodeType: "entry_point",
    label: `Entry ${counters.entry}`,
    position,
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createEntryPointNode",
    geometryValidity: "valid",
  };
}

export function createScenarioPathNode(
  points: PathPoint[],
  options?: PathFactoryOptions,
): ScenarioPath {
  if (points.length < 2) {
    throw new Error("Path requires at least two points.");
  }

  counters.path += 1;

  return {
    id: makeId("path"),
    nodeType: "path",
    label: options?.label ?? `Path ${counters.path}`,
    actorType: options?.actorType ?? "person",
    points,
    speedMps: options?.speedMps ?? 1.2,
    heightM: options?.heightM ?? 1.75,
    widthM: options?.widthM,
    timeOfDay: options?.timeOfDay ?? "day",
    intent: options?.intent ?? "authorized",
    labelDetail: options?.labelDetail,
    source: options?.source ?? "manual",
    reviewStatus: options?.reviewStatus ?? "unreviewed",
    sourceTrace: options?.sourceTrace ?? "factory:createScenarioPathNode",
    geometryValidity: "valid",
  };
}
