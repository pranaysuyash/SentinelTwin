import {
  type SecurityScene,
  type WallNode,
  type DoorNode,
  type WindowNode,
  type ObstructionNode,
  type CriticalZoneNode,
  type EntryPointNode,
} from "@/schema/security-scene";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

export interface BakeoffLineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  z?: number;
  class_?: string;
  confidence?: number;
}

export interface BakeoffCriticalZone {
  polygon: number[];
  zone_type?: string;
  confidence?: number;
}

export interface BakeoffPrediction {
  image_id: string;
  walls: BakeoffLineSegment[];
  doors: BakeoffLineSegment[];
  windows: BakeoffLineSegment[];
  obstructions: BakeoffLineSegment[];
  critical_zones: BakeoffCriticalZone[];
  ambiguities?: string[];
  parse_error?: string | null;
  timing_ms?: number;
}

export interface ScaleReference {
  knownDimensionM: number;
  axisHint: "width" | "depth";
}

const OBSTRUCTION_TYPE_MAP: Record<string, ObstructionNode["obstructionType"]> = {
  shelf: "shelf",
  rack: "shelf",
  counter: "counter",
  desk: "counter",
  pillar: "pillar",
  partition: "partition",
  cupboard: "cupboard",
  storage_boxes: "storage_boxes",
  glass_display: "glass_display",
  other: "other",
};

const ZONE_TYPE_MAP: Record<string, CriticalZoneNode["targetType"]> = {
  cash_register: "cash_counter_activity",
  safe: "person_detection",
  server_room: "person_detection",
  entry: "door_entry_exit",
  storage: "person_detection",
  aisle_choke: "person_detection",
};

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function parsePolygon(poly: number[]): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < poly.length; i += 2) {
    pts.push([clamp01(poly[i]), clamp01(poly[i + 1])]);
  }
  return pts;
}

export function bakeoffToSecurityScene(
  pred: BakeoffPrediction,
  scaleRef: ScaleReference,
  sceneName?: string,
): SecurityScene {
  const base = createBlankSecurityScene();
  const now = Date.now();

  const pxPerUnit = 1 / scaleRef.knownDimensionM;

  const toMetersX = (nx: number) => Math.max(0, nx * scaleRef.knownDimensionM);
  const toMetersZ = (ny: number) => Math.max(0, ny * scaleRef.knownDimensionM);

  let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  for (const w of pred.walls) {
    const x1 = clamp01(w.x1);
    const y1 = clamp01(w.y1);
    const x2 = clamp01(w.x2);
    const y2 = clamp01(w.y2);
    if (!bounds) {
      bounds = { minX: x1, minY: y1, maxX: x1, maxY: y1 };
    }
    bounds.minX = Math.min(bounds.minX, x1, x2);
    bounds.minY = Math.min(bounds.minY, y1, y2);
    bounds.maxX = Math.max(bounds.maxX, x1, x2);
    bounds.maxY = Math.max(bounds.maxY, y1, y2);
  }

  if (!bounds) {
    return {
      ...base,
      name: sceneName ?? `Bakeoff: ${pred.image_id}`,
      source: "ai",
      sourceTrace: `bakeoff-prediction-v1:${pred.image_id}`,
    };
  }

  const roomWidthM = toMetersX(bounds.maxX - bounds.minX);
  const roomDepthM = toMetersZ(bounds.maxY - bounds.minY);

  const shiftX = (nx: number) => toMetersX(clamp01(nx) - bounds!.minX);
  const shiftZ = (ny: number) => toMetersZ(clamp01(ny) - bounds!.minY);

  const walls: WallNode[] = pred.walls.map((w) => {
    const sx = shiftX(w.x1);
    const sz = shiftZ(w.y1);
    const ex = shiftX(w.x2);
    const ez = shiftZ(w.y2);
    return {
      id: makeId("wall"),
      nodeType: "wall",
      label: `Wall ${sx.toFixed(2)},${sz.toFixed(2)} → ${ex.toFixed(2)},${ez.toFixed(2)}`,
      start: [sx, sz] as [number, number],
      end: [ex, ez] as [number, number],
      heightM: 3,
      thicknessM: 0.18,
      material: "solid",
      visionTransmission: 0,
      source: "ai",
      reviewStatus: "unreviewed",
      sourceTrace: `bakeoff-prediction-v1:${pred.image_id}`,
      geometryValidity: "valid",
    };
  });

  const doors: DoorNode[] = pred.doors.map((d) => {
    const mx = shiftX((clamp01(d.x1) + clamp01(d.x2)) / 2);
    const mz = shiftZ((clamp01(d.y1) + clamp01(d.y2)) / 2);
    const dx = Math.abs(clamp01(d.x2) - clamp01(d.x1));
    const dz = Math.abs(clamp01(d.y2) - clamp01(d.y1));
    const widthM = Math.max(0.5, Math.sqrt(dx * dx + dz * dz) * scaleRef.knownDimensionM);
    return {
      id: makeId("door"),
      nodeType: "door",
      label: d.class_ ?? "Door",
      position: [mx, 0, mz] as [number, number, number],
      dimensions: [widthM, 2.1, 0.1] as [number, number, number],
      state: "closed" as const,
      source: "ai",
      reviewStatus: "unreviewed",
      sourceTrace: `bakeoff-prediction-v1:${pred.image_id}`,
      geometryValidity: "valid",
    };
  });

  const windows: WindowNode[] = pred.windows.map((w) => {
    const mx = shiftX((clamp01(w.x1) + clamp01(w.x2)) / 2);
    const mz = shiftZ((clamp01(w.y1) + clamp01(w.y2)) / 2);
    const dx = Math.abs(clamp01(w.x2) - clamp01(w.x1));
    const dz = Math.abs(clamp01(w.y2) - clamp01(w.y1));
    const widthM = Math.max(0.3, Math.sqrt(dx * dx + dz * dz) * scaleRef.knownDimensionM);
    return {
      id: makeId("window"),
      nodeType: "window",
      label: w.class_ ?? "Window",
      position: [mx, 1.2, mz] as [number, number, number],
      dimensions: [widthM, 1.4, 0.1] as [number, number, number],
      state: "closed_glass" as const,
      visionTransmission: 0.85,
      source: "ai",
      reviewStatus: "unreviewed",
      sourceTrace: `bakeoff-prediction-v1:${pred.image_id}`,
      geometryValidity: "valid",
    };
  });

  const obstructions: ObstructionNode[] = pred.obstructions.map((o) => {
    const mx = shiftX((clamp01(o.x1) + clamp01(o.x2)) / 2);
    const mz = shiftZ((clamp01(o.y1) + clamp01(o.y2)) / 2);
    const widthM = Math.abs(clamp01(o.x2) - clamp01(o.x1)) * scaleRef.knownDimensionM;
    const depthM = Math.abs(clamp01(o.y2) - clamp01(o.y1)) * scaleRef.knownDimensionM;
    const obsType = OBSTRUCTION_TYPE_MAP[o.class_ ?? ""] ?? "other";
    return {
      id: makeId("obs"),
      nodeType: "obstruction",
      label: o.class_ ?? "Obstruction",
      position: [mx, 0, mz] as [number, number, number],
      rotationYDeg: 0,
      dimensions: [Math.max(0.3, widthM), 2, Math.max(0.3, depthM)] as [number, number, number],
      material: "solid",
      visionTransmission: 0,
      glareRisk: false,
      nightIRReflective: false,
      movable: false,
      movableByAI: true,
      obstructionType: obsType,
      source: "ai",
      reviewStatus: "unreviewed",
      sourceTrace: `bakeoff-prediction-v1:${pred.image_id}`,
      geometryValidity: "valid",
    };
  });

  const criticalZones: CriticalZoneNode[] = pred.critical_zones.map((z) => {
    const pts = parsePolygon(z.polygon);
    const shifted = pts.map(
      ([nx, nz]) => [shiftX(nx), shiftZ(nz)] as [number, number],
    );
    const targetType = ZONE_TYPE_MAP[z.zone_type ?? ""] ?? "person_detection";
    return {
      id: makeId("zone"),
      nodeType: "critical_zone",
      label: z.zone_type ?? "Critical Zone",
      polygon: shifted,
      heightM: 2,
      priority: "high" as const,
      requiredQuality: "recognition" as const,
      targetType,
      nightRequired: true,
      redundancyRequired: false,
      privacyZone: false,
      source: "ai",
      reviewStatus: "unreviewed",
      sourceTrace: `bakeoff-prediction-v1:${pred.image_id}`,
      geometryValidity: "valid",
    };
  });

  const entryPoints: EntryPointNode[] = doors.map((d) => ({
    id: makeId("entry"),
    nodeType: "entry_point",
    label: `Entry at ${d.position[0].toFixed(2)},${d.position[2].toFixed(2)}`,
    position: [d.position[0], d.position[2]] as [number, number],
    source: "ai",
    reviewStatus: "unreviewed",
    sourceTrace: `bakeoff-prediction-v1:${pred.image_id}`,
    geometryValidity: "valid",
  }));

  return {
    ...base,
    id: makeId("scene"),
    name: sceneName ?? `Bakeoff: ${pred.image_id}`,
    createdAt: now,
    updatedAt: now,
    dimensions: {
      width: Math.max(1, roomWidthM),
      depth: Math.max(1, roomDepthM),
      height: 3,
    },
    walls,
    doors,
    windows,
    obstructions,
    criticalZones,
    entryPoints,
    cameras: [],
    securityLights: [],
    privacyZones: [],
    sensors: [],
    paths: [],
    assumptions: {
      ...base.assumptions,
      wallHeightM: 3,
    },
    source: "ai",
    sourceTrace: `bakeoff-prediction-v1:${pred.image_id}`,
    reviewStatus: "unreviewed",
    geometryValidity: "valid",
    version: "0.1.0",
    snapshots: [],
    scenarios: [],
    changeLog: [`Created from bakeoff prediction ${pred.image_id}`],
  };
}
