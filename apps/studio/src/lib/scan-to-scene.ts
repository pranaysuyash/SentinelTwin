import { createCameraNode, createCriticalZoneNode, createDoorNode, createEntryPointNode, createObstructionNode, createScenarioPathNode, createSecurityLightNode, createWallNode, createWindowNode } from "@/lib/node-factory";
import { selectHighestPriorityCriticalZone } from "@/lib/critical-zone-selection";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { safeParseSecurityScene } from "@/schema/security-scene";
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
import type { SiteCompilerResult, SiteCompilerWarning } from "@/lib/site-compiler";
import { compileScanToSiteResult } from "@/lib/site-compiler";

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
  | "critical_zone"
  | "path_point";

export type ScanCandidateStatus = "pending" | "accepted" | "edited" | "rejected";

export type ScanCandidate = {
  id: string;
  kind: ScanCandidateKind;
  label: string;
  point: [number, number];
  confidence: number;
  manual: boolean;
  status: ScanCandidateStatus;
  sourcePhotoId: string;
  note?: string;
  widthHintM?: number;
  depthHintM?: number;
  heightHintM?: number;
  source: "manual" | "scan";
};

export type ScanSession = {
  id: string;
  roomName: string;
  widthM: number;
  depthM: number;
  heightM: number;
  cameraMountType: "wall" | "ceiling";
  lightMountType: "ceiling" | "wall";
  criticalZoneNightRequired: boolean;
  imageDataUrl: string | null;
  imageName: string | null;
  imageWidthPx: number | null;
  imageHeightPx: number | null;
  imageId: string;
  photos: Array<{
    id: string;
    name: string;
    dataUrl: string;
    widthPx: number;
    heightPx: number;
  }>;
  activePhotoId: string | null;
  scaleReferenceM: number;
  candidates: ScanCandidate[];
  createdAt: number;
  updatedAt: number;
};

export type ScanCompilationProvenance = {
  source: "scan";
  totalCandidates: number;
  acceptedCandidates: number;
  rejectedCandidates: number;
  averageConfidence: number;
  confidenceLevel: "high" | "medium" | "low";
  sourceCounts: Record<ScanCandidate["source"], number>;
  summary: string;
};

export type ScanCompilationWarningCode =
  | "NO_CAMERA"
  | "NO_CRITICAL_ZONE"
  | "NO_ENTRY"
  | "NO_OBSTRUCTION"
  | "NO_WALL"
  | "NO_PATH";

export type ScanCompilationWarning = {
  code: ScanCompilationWarningCode;
  message: string;
};

export type ScanCompileOptions = {
  autoCreateEntryToZonePath?: boolean;
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
  { kind: "path_point", label: "Path Point", description: "Mark ordered points for a replay path." },
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

function roomCenterPoint(session: ScanSession): [number, number] {
  return [session.widthM / 2, session.depthM / 2];
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

function wallMountPosition(point: [number, number], widthM: number, depthM: number, heightM: number) {
  const [x, , z] = snapToWall(point, widthM, depthM);
  return [x, Math.max(2.4, heightM - 0.2), z] as [number, number, number];
}

function ceilingMountPosition(point: [number, number], widthM: number, depthM: number, heightM: number) {
  const [x, , z] = normalizePoint(point, widthM, depthM);
  return [x, Math.max(2.4, heightM - 0.2), z] as [number, number, number];
}

function yawTowardPoint(from: [number, number, number], target: [number, number]) {
  const dx = target[0] - from[0];
  const dz = target[1] - from[2];
  return Math.round((Math.atan2(dx, dz) * 180) / Math.PI);
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

function confidenceLevelFromAverage(averageConfidence: number, acceptanceRate: number): ScanCompilationProvenance["confidenceLevel"] {
  if (averageConfidence >= 0.8 && acceptanceRate >= 0.75) return "high";
  if (averageConfidence >= 0.65 || acceptanceRate >= 0.5) return "medium";
  return "low";
}

export function summarizeScanProvenance(session: ScanSession): ScanCompilationProvenance {
  const accepted = session.candidates.filter((candidate) => candidate.status === "accepted" || candidate.status === "edited");
  const rejected = session.candidates.filter((candidate) => candidate.status === "rejected");
  const confidenceValues = accepted.map((candidate) => candidate.confidence);
  const averageConfidence = confidenceValues.length > 0
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
    : 0;
  const sourceCounts = session.candidates.reduce<Record<ScanCandidate["source"], number>>(
    (counts, candidate) => {
      counts[candidate.source] = (counts[candidate.source] ?? 0) + 1;
      return counts;
    },
    { manual: 0, scan: 0 },
  );
  const acceptanceRate = session.candidates.length > 0 ? accepted.length / session.candidates.length : 0;
  const confidenceLevel = confidenceLevelFromAverage(averageConfidence, acceptanceRate);

  return {
    source: "scan",
    totalCandidates: session.candidates.length,
    acceptedCandidates: accepted.length,
    rejectedCandidates: rejected.length,
    averageConfidence,
    confidenceLevel,
    sourceCounts,
    summary: `Manual-assisted scan compiled ${accepted.length}/${session.candidates.length} accepted candidates at ${Math.round(averageConfidence * 100)}% average confidence.`,
  };
}

function createCandidateNode(
  session: ScanSession,
  candidate: ScanCandidate,
): CameraNode | DoorNode | WindowNode | SecurityLightNode | ObstructionNode | EntryPointNode | CriticalZoneNode | WallNode | null {
  const accepted = candidate.status === "accepted" || candidate.status === "edited";
  if (!accepted) return null;

  const worldPoint = normalizePoint(candidate.point, session.widthM, session.depthM);
  const roomCenter = roomCenterPoint(session);
  const zoneFocus = session.candidates.find((entry) => entry.status !== "rejected" && (entry.kind === "critical_zone" || entry.kind === "counter")) ?? null;
  const zoneCenter = zoneFocus ? normalizePoint(zoneFocus.point, session.widthM, session.depthM) : null;
  const targetPoint: [number, number] = zoneCenter ? [zoneCenter[0], zoneCenter[2]] : roomCenter;

  switch (candidate.kind) {
    case "camera": {
      const cameraPosition =
        session.cameraMountType === "ceiling"
          ? ceilingMountPosition(candidate.point, session.widthM, session.depthM, session.heightM)
          : wallMountPosition(candidate.point, session.widthM, session.depthM, session.heightM);
      const camera = createCameraNode(cameraPosition);
      camera.name = scanCandidateLabel(candidate);
      camera.pitchDeg = session.cameraMountType === "ceiling" ? -18 : -15;
      camera.yawDeg = yawTowardPoint(cameraPosition, targetPoint);
      camera.mountType = session.cameraMountType;
      camera.mountHeightM = cameraPosition[1];
      camera.fovHorizontalDeg = 90;
      camera.fovVerticalDeg = 60;
      camera.rangeM = 20;
      camera.resolutionMP = 4;
      camera.lensType = "fixed";
      camera.status = "on";
      camera.nightMode = "ir";
      camera.irRangeM = 15;
      camera.thermalCapable = false;
      camera.ptz = false;
      camera.source = "scan";
      camera.clarity = candidate.confidence > 0.8 ? "good" : "average";
      return camera;
    }
    case "light": {
      const lightPosition =
        session.lightMountType === "wall"
          ? wallMountPosition(candidate.point, session.widthM, session.depthM, session.heightM)
          : ceilingMountPosition(candidate.point, session.widthM, session.depthM, session.heightM);
      const light = createSecurityLightNode(lightPosition);
      light.name = scanCandidateLabel(candidate);
      light.lightType = session.lightMountType;
      light.yawDeg = yawTowardPoint(lightPosition, targetPoint);
      light.pitchDeg = session.lightMountType === "wall" ? -35 : -12;
      light.glareRisk = "low";
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
      obstruction.dimensions = candidate.kind === "cupboard"
        ? [1.2, 2.0, 0.5]
        : candidate.kind === "shelf"
          ? [2.0, 1.8, 0.45]
          : candidate.kind === "counter"
            ? [2.0, 1.1, 0.7]
            : [candidate.widthHintM ?? 1.2, candidate.heightHintM ?? 1.2, candidate.depthHintM ?? 0.7];
      obstruction.visionTransmission = 0;
      obstruction.material = "solid";
      obstruction.movable = candidate.kind !== "obstruction";
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
      zone.requiredQuality = "recognition";
      zone.targetType = candidate.label.toLowerCase().includes("counter") ? "cash_counter_activity" : "person_detection";
      zone.priority = "high";
      zone.nightRequired = session.criticalZoneNightRequired;
      return zone;
    }
    case "wall": {
      return null;
    }
    case "path_point": {
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
    cameraMountType: "wall",
    lightMountType: "ceiling",
    criticalZoneNightRequired: true,
    imageDataUrl: null,
    imageName: null,
    imageWidthPx: null,
    imageHeightPx: null,
    imageId: makeId("photo"),
    photos: [],
    activePhotoId: null,
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
    path_point: "Path Point",
  };

  return {
    id: makeId("candidate"),
    kind,
    label: `${labels[kind]} ${index + 1}`,
    point,
    confidence: 0.72,
    manual: true,
    status: "accepted",
    sourcePhotoId: "",
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

function buildPathFromCandidates(session: ScanSession) {
  const points = session.candidates
    .filter((candidate) => (candidate.status === "accepted" || candidate.status === "edited") && candidate.kind === "path_point")
    .map((candidate) => ({
      position: [
        clamp(candidate.point[0] * session.widthM, 0.2, Math.max(0.2, session.widthM - 0.2)),
        clamp(candidate.point[1] * session.depthM, 0.2, Math.max(0.2, session.depthM - 0.2)),
      ] as [number, number],
    }));
  if (points.length < 2) return null;
  const path = createScenarioPathNode(points);
  path.label = "Scan Path";
  path.intent = "authorized";
  path.timeOfDay = "day";
  return path;
}

function entryPointDistance(a: EntryPointNode, b: EntryPointNode): number {
  return Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]);
}

function mergeEntryPoints(
  explicitEntries: EntryPointNode[],
  doorDerivedEntries: EntryPointNode[],
): EntryPointNode[] {
  const duplicateThresholdM = 0.5;
  const retainedDoorEntries = explicitEntries.length > 0
    ? doorDerivedEntries.filter((doorEntry) => !explicitEntries.some((explicitEntry) => entryPointDistance(explicitEntry, doorEntry) <= duplicateThresholdM))
    : doorDerivedEntries;

  const merged: EntryPointNode[] = [];
  for (const entry of [...explicitEntries, ...retainedDoorEntries]) {
    if (merged.some((existing) => entryPointDistance(existing, entry) <= 0.05)) continue;
    merged.push(entry);
  }
  return merged;
}

export function compileScanSessionToScene(
  session: ScanSession,
  options: ScanCompileOptions = {},
): { scene: SecurityScene; provenance: ScanCompilationProvenance; warnings: ScanCompilationWarning[] } {
  const provenance = summarizeScanProvenance(session);
  const scene = createBlankSecurityScene();
  const explicitEntryPoints: EntryPointNode[] = [];
  const doorEntryPoints: EntryPointNode[] = [];
  scene.name = session.roomName;
  scene.dimensions = {
    width: session.widthM,
    depth: session.depthM,
    height: session.heightM,
  };
  scene.source = "scan";
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
  scene.changeLog = [
    ...scene.changeLog,
    `Provenance: ${provenance.summary}`,
    `Provenance confidence: ${provenance.confidenceLevel}`,
  ];

  for (const candidate of session.candidates) {
    const node = createCandidateNode(session, candidate);
    if (!node) continue;

    switch (node.nodeType) {
      case "door":
        scene.doors.push(node);
        doorEntryPoints.push(createEntryPointNode([node.position[0], node.position[2]]));
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
        explicitEntryPoints.push(node);
        break;
      case "wall":
        scene.walls.push(node);
        break;
    }
  }

  scene.entryPoints = mergeEntryPoints(explicitEntryPoints, doorEntryPoints);

  const pathFromCandidates = buildPathFromCandidates(session);
  if (pathFromCandidates) {
    scene.paths.push(pathFromCandidates);
  } else if (options.autoCreateEntryToZonePath && scene.entryPoints.length > 0 && scene.criticalZones.length > 0) {
    const entry = scene.entryPoints[0];
    const zone = selectHighestPriorityCriticalZone(scene);
    if (entry && zone) {
      const centerX = zone.polygon.reduce((sum, p) => sum + p[0], 0) / zone.polygon.length;
      const centerZ = zone.polygon.reduce((sum, p) => sum + p[1], 0) / zone.polygon.length;
      scene.paths.push(createScenarioPathNode([{ position: entry.position }, { position: [centerX, centerZ] }]));
    }
  }

  const warnings: ScanCompilationWarning[] = [];
  if (scene.cameras.length === 0) warnings.push({ code: "NO_CAMERA", message: "No camera marker accepted; add at least one camera for coverage simulation." });
  if (scene.criticalZones.length === 0) warnings.push({ code: "NO_CRITICAL_ZONE", message: "No high-value/critical zone marker accepted; add one to evaluate outcome quality." });
  if (scene.entryPoints.length === 0) warnings.push({ code: "NO_ENTRY", message: "No door or entry marker accepted; path replay and entry risk analysis will be limited." });
  if (scene.obstructions.length === 0) warnings.push({ code: "NO_OBSTRUCTION", message: "No obstruction marker accepted; blindspot exploration may be unrealistic." });
  if (session.candidates.filter((candidate) => candidate.kind === "wall" && candidate.status !== "rejected").length === 0) {
    warnings.push({ code: "NO_WALL", message: "No wall markers accepted; using the room dimensions to build a rectangular shell." });
  }
  if (scene.paths.length === 0) warnings.push({ code: "NO_PATH", message: "No path points created; add path points or enable auto entry-to-zone path." });

  const parsed = safeParseSecurityScene(scene);
  if (!parsed.success) {
    throw new Error(`Compiled scan scene failed schema validation: ${parsed.error.issues[0]?.message ?? "unknown error"}`);
  }

  return { scene: parsed.data, provenance, warnings };
}

export function compileScanSessionToCompilerResult(
  session: ScanSession,
  options: ScanCompileOptions = {},
): SiteCompilerResult {
  const { scene, warnings: scanWarnings } = compileScanSessionToScene(session, options);
  const compilerWarnings: SiteCompilerWarning[] = [
    ...scanWarnings.map((w): SiteCompilerWarning => ({
      code: w.code,
      message: w.message,
      severity: w.code === "NO_CAMERA" ? "blocking" : "warning",
    })),
    ...scene.cameras.length === 0 ? [] : [],
    ...scene.criticalZones.length === 0 ? [{ code: "NO_CRITICAL_ZONE", message: "No critical zones marked. Add zones for coverage evaluation.", severity: "warning" as const }] : [],
  ];
  return compileScanToSiteResult(scene, ["Scan candidates compiled via scan-to-scene pipeline."], compilerWarnings);
}
