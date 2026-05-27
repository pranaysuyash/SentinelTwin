import type {
  CameraNode,
  ObstructionNode,
  SecurityLightNode,
  SecurityScene,
  SimulationAssumptions,
  WallNode,
} from "@/schema/security-scene";
import { parseSecurityScene } from "@/schema/security-scene";
import type { CellComputation } from "@/simulation/coverage";

export function createRoomWalls(width: number, depth: number, height = 3): WallNode[] {
  return [
    {
      id: "wall_north",
      nodeType: "wall",
      label: "North Wall",
      start: [0, 0],
      end: [width, 0],
      heightM: height,
      thicknessM: 0.2,
      material: "solid",
      visionTransmission: 0,
      source: "manual",
    },
    {
      id: "wall_east",
      nodeType: "wall",
      label: "East Wall",
      start: [width, 0],
      end: [width, depth],
      heightM: height,
      thicknessM: 0.2,
      material: "solid",
      visionTransmission: 0,
      source: "manual",
    },
    {
      id: "wall_south",
      nodeType: "wall",
      label: "South Wall",
      start: [width, depth],
      end: [0, depth],
      heightM: height,
      thicknessM: 0.2,
      material: "solid",
      visionTransmission: 0,
      source: "manual",
    },
    {
      id: "wall_west",
      nodeType: "wall",
      label: "West Wall",
      start: [0, depth],
      end: [0, 0],
      heightM: height,
      thicknessM: 0.2,
      material: "solid",
      visionTransmission: 0,
      source: "manual",
    },
  ];
}

export function createTestCamera(overrides: Partial<CameraNode> = {}): CameraNode {
  return {
    id: overrides.id ?? "cam_test",
    nodeType: "camera",
    name: overrides.name ?? "Test Camera",
    position: overrides.position ?? [2, 2.5, 2],
    yawDeg: overrides.yawDeg ?? 0,
    pitchDeg: overrides.pitchDeg ?? -35,
    rollDeg: overrides.rollDeg ?? 0,
    mountType: overrides.mountType ?? "ceiling",
    mountHeightM: overrides.mountHeightM ?? 2.5,
    fovHorizontalDeg: overrides.fovHorizontalDeg ?? 90,
    fovVerticalDeg: overrides.fovVerticalDeg ?? 80,
    rangeM: overrides.rangeM ?? 8,
    resolutionMP: overrides.resolutionMP ?? 4,
    resolutionWidth: overrides.resolutionWidth ?? 1920,
    resolutionHeight: overrides.resolutionHeight ?? 1080,
    lensType: overrides.lensType ?? "fixed",
    focalLengthMm: overrides.focalLengthMm ?? 2.8,
    status: overrides.status ?? "on",
    nightMode: overrides.nightMode ?? "none",
    irRangeM: overrides.irRangeM ?? 0,
    thermalCapable: overrides.thermalCapable ?? false,
    ptz: overrides.ptz ?? false,
    clarity: overrides.clarity ?? "excellent",
    source: overrides.source ?? "manual",
    notes: overrides.notes,
    tags: overrides.tags ?? [],
  };
}

export function createTestObstruction(
  overrides: Partial<ObstructionNode> = {},
): ObstructionNode {
  return {
    id: overrides.id ?? "obs_test",
    nodeType: "obstruction",
    label: overrides.label ?? "Test Obstruction",
    position: overrides.position ?? [3, 1, 2],
    rotationYDeg: overrides.rotationYDeg ?? 0,
    dimensions: overrides.dimensions ?? [0.5, 0.5, 2],
    material: overrides.material ?? "solid",
    visionTransmission: overrides.visionTransmission ?? 0,
    glareRisk: overrides.glareRisk ?? false,
    nightIRReflective: overrides.nightIRReflective ?? false,
    movable: overrides.movable ?? false,
    movableByAI: overrides.movableByAI ?? false,
    obstructionType: overrides.obstructionType ?? "partition",
    source: overrides.source ?? "manual",
    weightKg: overrides.weightKg,
  };
}

export function createTestLight(overrides: Partial<SecurityLightNode> = {}): SecurityLightNode {
  return {
    id: overrides.id ?? "light_test",
    nodeType: "security_light",
    name: overrides.name ?? "Test Light",
    lightType: overrides.lightType ?? "ceiling",
    position: overrides.position ?? [2, 2.8, 1],
    yawDeg: overrides.yawDeg,
    pitchDeg: overrides.pitchDeg,
    status: overrides.status ?? "on",
    brightness: overrides.brightness ?? "high",
    rangeM: overrides.rangeM ?? 2,
    coneDeg: overrides.coneDeg ?? 120,
    colorTemperatureK: overrides.colorTemperatureK ?? 4000,
    emergencyPower: overrides.emergencyPower ?? true,
    illuminatesNightCoverage: overrides.illuminatesNightCoverage ?? true,
    glareRisk: overrides.glareRisk ?? "low",
    source: overrides.source ?? "manual",
  };
}

export function createTestScene(
  options: {
    width?: number;
    depth?: number;
    height?: number;
    walls?: WallNode[];
    cameras?: CameraNode[];
    securityLights?: SecurityLightNode[];
    obstructions?: ObstructionNode[];
    assumptions?: Partial<SimulationAssumptions>;
  } = {},
): SecurityScene {
  const width = options.width ?? 4;
  const depth = options.depth ?? 4;
  const height = options.height ?? 3;

  return parseSecurityScene({
    id: "scene_test_room",
    name: "Test Room",
    createdAt: 0,
    updatedAt: 0,
    units: "meters",
    dimensions: {
      width,
      depth,
      height,
    },
    walls: options.walls ?? createRoomWalls(width, depth, height),
    doors: [],
    windows: [],
    cameras: options.cameras ?? [createTestCamera()],
    securityLights: options.securityLights ?? [],
    obstructions: options.obstructions ?? [],
    criticalZones: [],
    privacyZones: [],
    entryPoints: [],
    paths: [],
    assumptions: {
      wallHeightM: 3,
      personHeightM: 1.7,
      vehicleHeightM: 1.5,
      timeOfDay: "day",
      interiorLightLevel: "normal",
      nightPenaltyMode: "detailed",
      doriStandard: "dori_2014",
      pixelsPerMeter: {
        detection: 25,
        observation: 62.5,
        recognition: 125,
        identification: 250,
      },
      showAssumptionsPanel: true,
      ...options.assumptions,
    },
    source: "manual",
    version: "0.1.0",
    snapshots: [],
    scenarios: [],
  });
}

export function findCellNear(cells: CellComputation[], x: number, z: number) {
  const [first, ...rest] = cells;

  if (!first) {
    throw new Error("Expected at least one coverage cell");
  }

  return rest.reduce((best, cell) => {
    const bestDistance = Math.hypot(best.x - x, best.z - z);
    const distance = Math.hypot(cell.x - x, cell.z - z);
    return distance < bestDistance ? cell : best;
  }, first);
}
