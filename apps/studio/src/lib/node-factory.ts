import type {
  CameraNode,
  ObstructionNode,
  SecurityLightNode,
} from "@/schema/security-scene";

let _camCounter = 0;
let _obsCounter = 0;
let _lightCounter = 0;

export function createCameraNode(position: [number, number, number]): CameraNode {
  _camCounter++;
  return {
    id: `cam_placed_${Date.now().toString(36)}_${_camCounter}`,
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
    tags: [],
  };
}

export function createObstructionNode(
  position: [number, number, number],
  obstructionType: ObstructionNode["obstructionType"] = "other",
): ObstructionNode {
  _obsCounter++;
  const labelMap: Record<string, string> = {
    shelf: "Shelf",
    cupboard: "Cupboard",
    counter: "Counter",
    pillar: "Pillar",
    partition: "Partition",
    storage_boxes: "Storage Boxes",
    other: "Obstruction",
  };
  return {
    id: `obs_placed_${Date.now().toString(36)}_${_obsCounter}`,
    nodeType: "obstruction",
    label: labelMap[obstructionType] ?? "Obstruction",
    position,
    rotationYDeg: 0,
    dimensions: [1, 2, 0.5],
    material: "solid",
    visionTransmission: 0,
    glareRisk: false,
    nightIRReflective: false,
    movable: true,
    movableByAI: true,
    obstructionType,
    source: "manual",
  };
}

export function createSecurityLightNode(
  position: [number, number, number],
): SecurityLightNode {
  _lightCounter++;
  return {
    id: `light_placed_${Date.now().toString(36)}_${_lightCounter}`,
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
  };
}
