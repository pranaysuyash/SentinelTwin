import { createCameraNode, createCriticalZoneNode, createDoorNode, createEntryPointNode, createObstructionNode, createSecurityLightNode, createWallNode, createWindowNode } from "@/lib/node-factory";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import type {
  CameraNode,
  CriticalZoneNode,
  DoorNode,
  EntryPointNode,
  ObstructionNode,
  SecurityLightNode,
  SecurityScene,
  WallNode,
  WindowNode,
} from "@/schema/security-scene";

export type ScanCandidateKind =
  | "wall"
  | "door"
  | "window"
  | "camera"
  | "light"
  | "cupboard"
  | "counter"
  | "shelf"
  | "obstruction"
  | "entry_point"
  | "critical_zone";

export type ScanCandidateStatus = "pending" | "accepted" | "edited" | "rejected";

export type ScanCandidate = {
  id: string;
  kind: ScanCandidateKind;
  label: string;
  point: [number, number];
  confidence: number;
  status: ScanCandidateStatus;
  note?: string;
  widthHintM?: number;
  depthHintM?: number;
  source: "manual" | "scan";
};

export type ScanSession = {
  id: string;
  roomName: string;
  widthM: number;
  depthM: number;
  heightM: number;
  imageDataUrl: string | null;
  imageName: string | null;
  scaleReferenceM: number;
  candidates: ScanCandidate[];
  createdAt: number;
  updatedAt: number;
};

export const SCAN_CANDIDATE_TYPES: Array<{ kind: ScanCandidateKind; label: string; description: string }> = [
  { kind: "wall", label: "Wall", description: "Confirm a room edge or perimeter segment." },
  { kind: "door", label: "Door", description: "Mark an entrance, exit, or internal door." },
  { kind: "window", label: "Window", description: "Mark glazing or view-through openings." },
  { kind: "camera", label: "Camera", description: "Mark an existing camera in the scene." },
  { kind: "light", label: "Light", description: "Mark an ambient or security light." },
  { kind: "counter", label: "Cash Counter", description: "Mark the point-of-sale counter or desk." },
  { kind: "cupboard", label: "Cupboard", description: "Mark a cupboard or closed storage block." },
  { kind: "shelf", label: "Shelf", description: "Mark a shelf or merchandising unit." },
  { kind: "obstruction", label: "Generic Obstruction", description: "Mark any other blocking object." },
  { kind: "entry_point", label: "Entry Point", description: "Mark the main access point." },
  { kind: "critical_zone", label: "Critical Zone", description: "Mark a zone that needs coverage." },
];

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizePoint(point: [number, number], widthM: number, depthM: number): [number, number, number] {
  return [
    clamp(point[0] * widthM, 0.35, Math.max(0.35, widthM - 0.35)),
    0,
    clamp(point[1] * depthM, 0.35, Math.max(0.35, depthM - 0.35)),
  ];
}

function nearestWallSide(point: [number, number]) {
  const distances = [
    { side: "south" as const, value: point[1] },
    { side: "north" as const, value: 1 - point[1] },
    { side: "west" as const, value: point[0] },
    { side: "east" as const, value: 1 - point[0] },
  ];

  return distances.sort((a, b) => a.value - b.value)[0]?.side ?? "south";
}

function snapToWall(point: [number, number], widthM: number, depthM: number, offsetM = 0.12): [number, number, number] {
  const x = clamp(point[0] * widthM, 0.35, Math.max(0.35, widthM - 0.35));
  const z = clamp(point[1] * depthM, 0.35, Math.max(0.35, depthM - 0.35));
  switch (nearestWallSide(point)) {
    case "north":
      return [x, 0, Math.max(0.35, depthM - offsetM)];
    case "east":
      return [Math.max(0.35, widthM - offsetM), 0, z];
    case "west":
      return [offsetM, 0, z];
    case "south":
    default:
      return [x, 0, offsetM];
  }
}

function scanCandidateLabel(candidate: ScanCandidate) {
  return candidate.label.trim() || candidate.kind.replace(/_/g, " ");
}

function obstructionTypeFor(candidate: ScanCandidate): ObstructionNode["obstructionType"] {
  switch (candidate.kind) {
    case "counter":
      return "counter";
    case "cupboard":
      return "cupboard";
    case "shelf":
      return "shelf";
    case "obstruction":
    default:
      return "other";
  }
}

function createCandidateNode(
  session: ScanSession,
  candidate: ScanCandidate,
): CameraNode | DoorNode | WindowNode | SecurityLightNode | ObstructionNode | EntryPointNode | CriticalZoneNode | WallNode | null {
  const accepted = candidate.status === "accepted" || candidate.status === "edited";
  if (!accepted) return null;

  const worldPoint = normalizePoint(candidate.point, session.widthM, session.depthM);

  switch (candidate.kind) {
    case "camera": {
      const camera = createCameraNode([worldPoint[0], Math.max(2.4, session.heightM - 0.25), worldPoint[2]]);
      camera.name = scanCandidateLabel(candidate);
      camera.pitchDeg = -25;
      camera.yawDeg = nearestWallSide(candidate.point) === "south" ? 180 : nearestWallSide(candidate.point) === "north" ? 0 : nearestWallSide(candidate.point) === "west" ? 90 : -90;
      camera.mountHeightM = Math.max(2.4, session.heightM - 0.25);
      camera.source = "scan";
      camera.clarity = candidate.confidence > 0.8 ? "good" : "average";
      return camera;
    }
    case "light": {
      const light = createSecurityLightNode([worldPoint[0], Math.max(2.7, session.heightM - 0.18), worldPoint[2]]);
      light.name = scanCandidateLabel(candidate);
      light.source = "scan";
      return light;
    }
    case "door": {
      const door = createDoorNode(snapToWall(candidate.point, session.widthM, session.depthM));
      door.label = scanCandidateLabel(candidate);
      door.source = "scan";
      return door;
    }
    case "window": {
      const windowNode = createWindowNode(snapToWall(candidate.point, session.widthM, session.depthM, 0.18));
      windowNode.label = scanCandidateLabel(candidate);
      windowNode.source = "scan";
      return windowNode;
    }
    case "counter":
    case "cupboard":
    case "shelf":
    case "obstruction": {
      const obstruction = createObstructionNode(worldPoint, obstructionTypeFor(candidate));
      obstruction.label = scanCandidateLabel(candidate);
      obstruction.dimensions = [
        candidate.widthHintM ?? (candidate.kind === "counter" ? 2.2 : candidate.kind === "shelf" ? 1.4 : 1.1),
        1.1,
        candidate.depthHintM ?? (candidate.kind === "counter" ? 0.8 : candidate.kind === "cupboard" ? 0.65 : 0.5),
      ];
      obstruction.visionTransmission = candidate.kind === "obstruction" ? 0.15 : 0;
      obstruction.source = "scan";
      return obstruction;
    }
    case "entry_point": {
      const entry = createEntryPointNode([worldPoint[0], worldPoint[2]]);
      entry.label = scanCandidateLabel(candidate);
      return entry;
    }
    case "critical_zone": {
      const zoneWidth = candidate.widthHintM ?? Math.max(1.6, session.widthM * 0.18);
      const zoneDepth = candidate.depthHintM ?? Math.max(1.2, session.depthM * 0.16);
      const halfWidth = zoneWidth / 2;
      const halfDepth = zoneDepth / 2;
      const x = worldPoint[0];
      const z = worldPoint[2];
      const zone = createCriticalZoneNode([
        [clamp(x - halfWidth, 0.15, session.widthM - 0.15), clamp(z - halfDepth, 0.15, session.depthM - 0.15)],
        [clamp(x + halfWidth, 0.15, session.widthM - 0.15), clamp(z - halfDepth, 0.15, session.depthM - 0.15)],
        [clamp(x + halfWidth, 0.15, session.widthM - 0.15), clamp(z + halfDepth, 0.15, session.depthM - 0.15)],
        [clamp(x - halfWidth, 0.15, session.widthM - 0.15), clamp(z + halfDepth, 0.15, session.depthM - 0.15)],
      ]);
      zone.label = scanCandidateLabel(candidate);
      zone.requiredQuality = candidate.label.toLowerCase().includes("counter") ? "identification" : "recognition";
      zone.targetType = candidate.label.toLowerCase().includes("counter") ? "cash_counter_activity" : "person_detection";
      return zone;
    }
    case "wall": {
      return null;
    }
  }
}

export function createScanSession(roomName: string, widthM = 10, depthM = 8, heightM = 3): ScanSession {
  const now = Date.now();
  return {
    id: makeId("scan"),
    roomName: roomName.trim() || "Scan Session",
    widthM,
    depthM,
    heightM,
    imageDataUrl: null,
    imageName: null,
    scaleReferenceM: 0.9,
    candidates: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createScanCandidate(
  kind: ScanCandidateKind,
  point: [number, number],
  index: number,
): ScanCandidate {
  const labels: Record<ScanCandidateKind, string> = {
    wall: "Wall",
    door: "Door",
    window: "Window",
    camera: "Camera",
    light: "Light",
    cupboard: "Cupboard",
    counter: "Cash Counter",
    shelf: "Shelf",
    obstruction: "Obstruction",
    entry_point: "Entry Point",
    critical_zone: "Critical Zone",
  };

  return {
    id: makeId("candidate"),
    kind,
    label: `${labels[kind]} ${index + 1}`,
    point,
    confidence: 0.72,
    status: "accepted",
    source: "manual",
  };
}

export function updateScanCandidate(
  session: ScanSession,
  candidateId: string,
  patch: Partial<ScanCandidate>,
): ScanSession {
  return {
    ...session,
    updatedAt: Date.now(),
    candidates: session.candidates.map((candidate) => (
      candidate.id === candidateId ? { ...candidate, ...patch } : candidate
    )),
  };
}

export function removeScanCandidate(session: ScanSession, candidateId: string): ScanSession {
  return {
    ...session,
    updatedAt: Date.now(),
    candidates: session.candidates.filter((candidate) => candidate.id !== candidateId),
  };
}

function applyWalls(scene: SecurityScene, session: ScanSession) {
  const wallCandidates = session.candidates.filter((candidate) => candidate.kind === "wall" && candidate.status !== "rejected");
  const wallBySide = new Map<"north" | "south" | "east" | "west", ScanCandidate>();
  for (const candidate of wallCandidates) {
    wallBySide.set(nearestWallSide(candidate.point), candidate);
  }

  const wallSpecs = [
    { side: "south" as const, start: [0, 0] as [number, number], end: [session.widthM, 0] as [number, number] },
    { side: "north" as const, start: [0, session.depthM] as [number, number], end: [session.widthM, session.depthM] as [number, number] },
    { side: "east" as const, start: [session.widthM, 0] as [number, number], end: [session.widthM, session.depthM] as [number, number] },
    { side: "west" as const, start: [0, 0] as [number, number], end: [0, session.depthM] as [number, number] },
  ];

  return wallSpecs.map((spec) => {
    const candidate = wallBySide.get(spec.side);
    const wall = createWallNode(spec.start, spec.end, {
      wallHeightM: session.heightM,
      thicknessM: 0.18,
      material: "solid",
      visionTransmission: 0,
    });
    wall.source = "scan";
    wall.label = candidate ? scanCandidateLabel(candidate) : `${spec.side[0].toUpperCase()}${spec.side.slice(1)} Wall`;
    return wall;
  });
}

export function compileScanSessionToScene(session: ScanSession): SecurityScene {
  const scene = createBlankSecurityScene();
  scene.name = session.roomName;
  scene.dimensions = {
    width: session.widthM,
    depth: session.depthM,
    height: session.heightM,
  };
  scene.source = "scan_import";
  scene.updatedAt = Date.now();
  scene.walls = applyWalls(scene, session);
  scene.doors = [];
  scene.windows = [];
  scene.cameras = [];
  scene.securityLights = [];
  scene.obstructions = [];
  scene.criticalZones = [];
  scene.entryPoints = [];
  scene.paths = [];

  for (const candidate of session.candidates) {
    const node = createCandidateNode(session, candidate);
    if (!node) continue;

    switch (node.nodeType) {
      case "door":
        scene.doors.push(node);
        break;
      case "window":
        scene.windows.push(node);
        break;
      case "camera":
        scene.cameras.push(node);
        break;
      case "security_light":
        scene.securityLights.push(node);
        break;
      case "obstruction":
        scene.obstructions.push(node);
        break;
      case "critical_zone":
        scene.criticalZones.push(node);
        break;
      case "entry_point":
        scene.entryPoints.push(node);
        break;
      case "wall":
        scene.walls.push(node);
        break;
    }
  }

  return scene;
}
