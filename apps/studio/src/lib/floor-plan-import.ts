/**
 * Floor Plan Import Module
 *
 * Client-side floor plan image processing for wall detection and room extraction.
 * Uses Canvas API for pixel-level analysis. No server upload required.
 *
 * The approach is heuristic-based (edge detection + contour tracing) rather than ML,
 * making it fast and dependency-free for common floor plan layouts.
 */
import type { SecurityScene, DoorNode, WindowNode, WallNode } from "@/schema/security-scene";

export interface WallSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
  detected: boolean;
}

export interface DoorOpening {
  position: { x: number; y: number };
  widthM: number;
  orientation: "horizontal" | "vertical";
}

export interface WindowOpening {
  position: { x: number; y: number };
  widthM: number;
  orientation: "horizontal" | "vertical";
}

export interface FloorPlanResult {
  imageWidth: number;
  imageHeight: number;
  walls: WallSegment[];
  doors: DoorOpening[];
  windows: WindowOpening[];
  roomDimensions: { widthM: number; depthM: number; heightM: number };
  scalePixelsPerMeter: number;
  confidence: number; // 0-1 estimate of detection quality
}

export interface FloorPlanDiagnostics {
  wallCount: number;
  horizontalWallCount: number;
  verticalWallCount: number;
  diagonalWallCount: number;
  shortWallCount: number;
  duplicateWallPairs: number;
  unsnappedDoorCount: number;
  unsnappedWindowCount: number;
  boundsCoverageRatio: number;
}

export interface FloorPlanConfig {
  /** Pixels per meter scale factor. Auto-detected if not provided. */
  scalePixelsPerMeter?: number;
  /** Room height in meters (default: 3). */
  roomHeightM?: number;
  /** Edge detection threshold (0-255, default: 40). Lower = more sensitive. */
  edgeThreshold?: number;
  /** Minimum wall length in pixels to consider (default: 20). */
  minWallLengthPx?: number;
}

const DEFAULT_CONFIG: Required<FloorPlanConfig> = {
  scalePixelsPerMeter: 50,
  roomHeightM: 3,
  edgeThreshold: 40,
  minWallLengthPx: 20,
};

/**
 * Process a floor plan image and extract wall/room geometry.
 */
export async function extractFloorPlan(
  imageData: ImageData,
  config?: FloorPlanConfig,
): Promise<FloorPlanResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { width, height, data } = imageData;

  // Step 1: Convert to grayscale
  const gray = grayscale(data, width, height);

  // Step 2: Detect edges using simple gradient method
  const gradient = detectEdges(gray, width, height, cfg.edgeThreshold);

  // Step 3: Trace wall contours from edges
  const wallSegments = traceWalls(gradient, width, height, cfg.minWallLengthPx);

  // Step 4: Detect openings (doors/windows) from wall gaps
  const { doors, windows } = detectOpenings(wallSegments);

  // Step 5: Extract room dimensions from wall bounding box
  const dimensions = extractDimensions(wallSegments, cfg.scalePixelsPerMeter, cfg.roomHeightM);

  // Step 6: Calculate confidence based on wall completeness
  const confidence = calculateConfidence(wallSegments, width, height);

  return {
    imageWidth: width,
    imageHeight: height,
    walls: wallSegments,
    doors,
    windows,
    roomDimensions: dimensions,
    scalePixelsPerMeter: cfg.scalePixelsPerMeter,
    confidence,
  };
}

/**
 * Convert extracted floor-plan geometry into a valid SecurityScene skeleton.
 * This keeps the import path deterministic and editable inside Studio.
 */
export function createSceneFromFloorPlan(
  name: string,
  result: FloorPlanResult,
): SecurityScene {
  const normalized = normalizeFloorPlanResult(result);
  const now = Date.now();
  let seq = 0;
  const uid = (prefix: string) => `${prefix}_${(now + seq++).toString(36)}`;

  const pxToMetersX = (x: number) => x / normalized.scalePixelsPerMeter;
  const pxToMetersZ = (y: number) => y / normalized.scalePixelsPerMeter;
  const roomHeight = normalized.roomDimensions.heightM;

  const bounds = getWallBounds(normalized.walls);
  const minX = bounds?.minX ?? 0;
  const minY = bounds?.minY ?? 0;
  const shiftX = (x: number) => Math.max(0, pxToMetersX(x - minX));
  const shiftZ = (y: number) => Math.max(0, pxToMetersZ(y - minY));

  const walls: WallNode[] = normalized.walls.length > 0
    ? normalized.walls.map((wall, index) => ({
      id: uid("wall"),
      nodeType: "wall",
      label: `Imported Wall ${index + 1}`,
      start: [shiftX(wall.start.x), shiftZ(wall.start.y)],
      end: [shiftX(wall.end.x), shiftZ(wall.end.y)],
      heightM: roomHeight,
      thicknessM: 0.18,
      material: "solid",
      visionTransmission: 0,
      source: "import",
      reviewStatus: "unreviewed",
      sourceTrace: "heuristic-import-v1",
      geometryValidity: "valid",
    }))
    : createFallbackRectWalls(uid, normalized.roomDimensions.widthM, normalized.roomDimensions.depthM, roomHeight);

  const doors: DoorNode[] = normalized.doors.map((door, index) => ({
    id: uid("door"),
    nodeType: "door",
    label: `Imported Door ${index + 1}`,
    position: [shiftX(door.position.x), 0, shiftZ(door.position.y)],
    dimensions: [door.widthM, 2.1, 0.1],
    state: "closed",
    source: "import",
    reviewStatus: "unreviewed",
    sourceTrace: "heuristic-import-v1",
    geometryValidity: "valid",
  }));

  const windows: WindowNode[] = normalized.windows.map((window, index) => ({
    id: uid("window"),
    nodeType: "window",
    label: `Imported Window ${index + 1}`,
    position: [shiftX(window.position.x), 1.2, shiftZ(window.position.y)],
    dimensions: [window.widthM, 1.4, 0.1],
    state: "closed_glass",
    visionTransmission: 0.85,
    source: "import",
    reviewStatus: "unreviewed",
    sourceTrace: "heuristic-import-v1",
    geometryValidity: "valid",
  }));

  // Entry points at each detected door
  const entryPoints = normalized.doors.map((door, index) => ({
    id: uid("ep"),
    nodeType: "entry_point" as const,
    label: `Entry ${index + 1}`,
    position: [shiftX(door.position.x), shiftZ(door.position.y)] as [number, number],
    source: "manual" as const,
    reviewStatus: "unreviewed" as const,
    sourceTrace: "",
    geometryValidity: "valid" as const,
  }));

  // Fallback entry point at room center-front if no doors detected
  if (entryPoints.length === 0) {
    entryPoints.push({
      id: uid("ep"),
      nodeType: "entry_point" as const,
      label: "Main Entry",
      position: [normalized.roomDimensions.widthM / 2, 0.5] as [number, number],
      source: "manual" as const,
      reviewStatus: "unreviewed" as const,
      sourceTrace: "",
      geometryValidity: "valid" as const,
    });
  }

  return {
    id: uid("scene"),
    name,
    createdAt: now,
    updatedAt: now,
    units: "meters",
    dimensions: {
      width: normalized.roomDimensions.widthM,
      depth: normalized.roomDimensions.depthM,
      height: roomHeight,
    },
    walls,
    doors,
    windows,
    cameras: [],
    securityLights: [],
    obstructions: [],
    criticalZones: [],
    privacyZones: [],
    sensors: [],
    entryPoints,
    paths: [],
    assumptions: {
      wallHeightM: roomHeight,
      personHeightM: 1.75,
      vehicleHeightM: 1.5,
      timeOfDay: "day",
      interiorLightLevel: "normal",
      nightPenaltyMode: "simple",
      doriStandard: "oodpcvs_2025",
      pixelsPerMeter: { detection: 25, observation: 62.5, recognition: 125, identification: 250 },
      showAssumptionsPanel: false,
    },
    source: "import",
    reviewStatus: "unreviewed",
    sourceTrace: "heuristic-import-v1",
    geometryValidity: "valid",
    version: "0.1.0",
    snapshots: [],
    scenarios: [],
    changeLog: [],
  };
}

/**
 * Recalibrate extracted floor-plan scale from known real-world room dimensions.
 * Geometry stays in pixel-space; scale + derived meter dimensions are updated.
 */
export function recalibrateFloorPlanResult(
  result: FloorPlanResult,
  calibration: { widthM?: number; depthM?: number; heightM?: number },
): FloorPlanResult {
  const normalized = normalizeFloorPlanResult(result);
  const bounds = getWallBounds(normalized.walls);
  const pixelWidth = bounds ? Math.max(1, bounds.maxX - bounds.minX) : Math.max(1, result.imageWidth);
  const pixelDepth = bounds ? Math.max(1, bounds.maxY - bounds.minY) : Math.max(1, result.imageHeight);

  const widthM = calibration.widthM ?? result.roomDimensions.widthM;
  const depthM = calibration.depthM ?? result.roomDimensions.depthM;
  const heightM = calibration.heightM ?? result.roomDimensions.heightM;

  const widthScale = widthM > 0 ? pixelWidth / widthM : result.scalePixelsPerMeter;
  const depthScale = depthM > 0 ? pixelDepth / depthM : result.scalePixelsPerMeter;
  const nextScale = Number(((widthScale + depthScale) / 2).toFixed(2));

  return normalizeFloorPlanResult({
    ...normalized,
    scalePixelsPerMeter: nextScale,
    roomDimensions: {
      widthM: Number(widthM.toFixed(2)),
      depthM: Number(depthM.toFixed(2)),
      heightM: Number(heightM.toFixed(2)),
    },
  });
}

export function normalizeFloorPlanResult(result: FloorPlanResult): FloorPlanResult {
  const normalizedWalls = mergeCollinearWalls(result.walls);
  const normalizedDoors = snapOpeningsToWalls(result.doors, normalizedWalls, result.scalePixelsPerMeter);
  const normalizedWindows = snapOpeningsToWalls(result.windows, normalizedWalls, result.scalePixelsPerMeter);
  const nextDimensions = extractDimensions(normalizedWalls, result.scalePixelsPerMeter, result.roomDimensions.heightM);
  const nextConfidence = calculateConfidence(normalizedWalls, result.imageWidth, result.imageHeight);

  return {
    ...result,
    walls: normalizedWalls,
    doors: normalizedDoors,
    windows: normalizedWindows,
    roomDimensions: {
      widthM: nextDimensions.widthM,
      depthM: nextDimensions.depthM,
      heightM: result.roomDimensions.heightM,
    },
    confidence: nextConfidence,
  };
}

/**
 * Validate a floor plan result for reasonableness.
 */
export function validateFloorPlan(result: FloorPlanResult): {
  valid: boolean;
  warnings: string[];
  diagnostics: FloorPlanDiagnostics;
} {
  const warnings: string[] = [];
  const diagnostics = getFloorPlanDiagnostics(result);

  if (result.walls.length < 4) {
    warnings.push("Fewer than 4 walls detected — room may be incomplete.");
  }
  if (diagnostics.duplicateWallPairs > 0) {
    warnings.push(`${diagnostics.duplicateWallPairs} near-duplicate wall pair${diagnostics.duplicateWallPairs === 1 ? "" : "s"} detected — run normalization or prune duplicates before creating the scene.`);
  }
  if (diagnostics.unsnappedDoorCount + diagnostics.unsnappedWindowCount > 0) {
    warnings.push(`${diagnostics.unsnappedDoorCount + diagnostics.unsnappedWindowCount} door/window marker${diagnostics.unsnappedDoorCount + diagnostics.unsnappedWindowCount === 1 ? " is" : "s are"} not close enough to a matching wall — drag or exclude before import.`);
  }
  if (diagnostics.shortWallCount > Math.max(2, result.walls.length * 0.25)) {
    warnings.push("Many short wall fragments detected — merge or exclude noisy fragments before import.");
  }
  if (result.roomDimensions.widthM < 1 || result.roomDimensions.depthM < 1) {
    warnings.push("Room dimensions are unreasonably small (< 1m).");
  }
  if (result.roomDimensions.widthM > 100 || result.roomDimensions.depthM > 100) {
    warnings.push("Room dimensions are very large (> 100m). Check scale setting.");
  }
  if (result.confidence < 0.3) {
    warnings.push("Low detection confidence. Consider manual adjustment.");
  }

  return {
    valid: warnings.length === 0 || warnings.every((w) => !w.includes("incomplete")),
    warnings,
    diagnostics,
  };
}

export function getFloorPlanDiagnostics(result: FloorPlanResult): FloorPlanDiagnostics {
  const horizontalWalls = result.walls.filter((wall) => Math.abs(wall.start.y - wall.end.y) < 3);
  const verticalWalls = result.walls.filter((wall) => Math.abs(wall.start.x - wall.end.x) < 3);
  const diagonalWallCount = result.walls.length - horizontalWalls.length - verticalWalls.length;
  const shortWallCount = result.walls.filter((wall) => wallLengthPx(wall) < Math.max(12, result.scalePixelsPerMeter * 0.35)).length;
  const duplicateWallPairs = countNearDuplicateWalls(result.walls);
  const unsnappedDoorCount = result.doors.filter((door) => !isOpeningNearMatchingWall(door, result.walls)).length;
  const unsnappedWindowCount = result.windows.filter((window) => !isOpeningNearMatchingWall(window, result.walls)).length;
  const bounds = getWallBounds(result.walls);
  const boundsArea = bounds ? Math.max(0, bounds.maxX - bounds.minX) * Math.max(0, bounds.maxY - bounds.minY) : 0;
  const imageArea = Math.max(1, result.imageWidth * result.imageHeight);

  return {
    wallCount: result.walls.length,
    horizontalWallCount: horizontalWalls.length,
    verticalWallCount: verticalWalls.length,
    diagonalWallCount,
    shortWallCount,
    duplicateWallPairs,
    unsnappedDoorCount,
    unsnappedWindowCount,
    boundsCoverageRatio: Number(Math.min(1, boundsArea / imageArea).toFixed(2)),
  };
}

// ── Image Processing Internals ──

function grayscale(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    gray[i] = Math.round(0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]);
  }
  return gray;
}

function detectEdges(
  gray: Uint8Array,
  width: number,
  height: number,
  threshold: number,
): Uint8Array {
  const edges = new Uint8Array(width * height);

  // Simple Sobel-like gradient detection
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      const gx =
        -gray[idx - width - 1] - 2 * gray[idx - 1] - gray[idx + width - 1] +
        gray[idx - width + 1] + 2 * gray[idx + 1] + gray[idx + width + 1];

      const gy =
        -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
        gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];

      const magnitude = Math.abs(gx) + Math.abs(gy);
      edges[idx] = magnitude > threshold ? 255 : 0;
    }
  }

  return edges;
}

function traceWalls(
  edges: Uint8Array,
  width: number,
  height: number,
  minLength: number,
): WallSegment[] {
  const segments: WallSegment[] = [];
  const visited = new Uint8Array(width * height);

  // Scan for edge pixels and trace horizontal/vertical lines
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || edges[idx] === 0) continue;

      // Try horizontal trace
      const hEnd = traceHorizontal(edges, visited, width, height, x, y);
      if (hEnd > x + minLength) {
        segments.push({
          start: { x, y },
          end: { x: hEnd, y },
          detected: true,
        });
        continue;
      }

      // Try vertical trace
      const vEnd = traceVertical(edges, visited, width, height, x, y);
      if (vEnd > y + minLength) {
        segments.push({
          start: { x, y },
          end: { x, y: vEnd },
          detected: true,
        });
      }
    }
  }

  return segments;
}

function traceHorizontal(
  edges: Uint8Array,
  visited: Uint8Array,
  width: number,
  _height: number,
  startX: number,
  y: number,
): number {
  let x = startX;
  while (x < width && edges[y * width + x] > 0) {
    visited[y * width + x] = 1;
    x++;
  }
  return x - 1;
}

function traceVertical(
  edges: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  x: number,
  startY: number,
): number {
  let y = startY;
  while (y < height && edges[y * width + x] > 0) {
    visited[y * width + x] = 1;
    y++;
  }
  return y - 1;
}

function detectOpenings(
  walls: WallSegment[],
): { doors: DoorOpening[]; windows: WindowOpening[] } {
  const doors: DoorOpening[] = [];
  const windows: WindowOpening[] = [];

  // Detect gaps in wall segments that could be doors/windows
  // Group walls by orientation and find gaps between segments
  const horizontalWalls = walls.filter((w) => w.start.y === w.end.y);
  const verticalWalls = walls.filter((w) => w.start.x === w.end.x);

  // Check horizontal gaps (potential doors on horizontal walls)
  for (const wall of horizontalWalls) {
    const minX = Math.min(wall.start.x, wall.end.x);
    const maxX = Math.max(wall.start.x, wall.end.x);
    // If wall is relatively short (not full room width), it might bracket an opening
    const span = maxX - minX;
    if (span > 10 && span < 80) {
      doors.push({
        position: { x: (minX + maxX) / 2, y: wall.start.y },
        widthM: 0.9, // Standard door width
        orientation: "horizontal",
      });
    }
  }

  // Check vertical gaps
  for (const wall of verticalWalls) {
    const minY = Math.min(wall.start.y, wall.end.y);
    const maxY = Math.max(wall.start.y, wall.end.y);
    const span = maxY - minY;
    if (span > 10 && span < 80) {
      doors.push({
        position: { x: wall.start.x, y: (minY + maxY) / 2 },
        widthM: 0.9,
        orientation: "vertical",
      });
    }
  }

  return { doors: snapOpeningsToWalls(doors, walls, 50), windows: snapOpeningsToWalls(windows, walls, 50) };
}

function mergeCollinearWalls(walls: WallSegment[]): WallSegment[] {
  if (walls.length <= 1) return walls;

  const horizontal = walls
    .filter((wall) => Math.abs(wall.start.y - wall.end.y) < 3)
    .map((wall) => ({
      y: Math.round((wall.start.y + wall.end.y) / 2),
      startX: Math.min(wall.start.x, wall.end.x),
      endX: Math.max(wall.start.x, wall.end.x),
      detected: wall.detected,
    }));
  const vertical = walls
    .filter((wall) => Math.abs(wall.start.x - wall.end.x) < 3)
    .map((wall) => ({
      x: Math.round((wall.start.x + wall.end.x) / 2),
      startY: Math.min(wall.start.y, wall.end.y),
      endY: Math.max(wall.start.y, wall.end.y),
      detected: wall.detected,
    }));
  const diagonal = walls.filter((wall) => Math.abs(wall.start.x - wall.end.x) >= 3 && Math.abs(wall.start.y - wall.end.y) >= 3);

  const mergedHorizontal = mergeIntervals(horizontal, "y", "startX", "endX").map((segment) => ({
    start: { x: segment.start, y: segment.anchor },
    end: { x: segment.end, y: segment.anchor },
    detected: segment.detected,
  }));
  const mergedVertical = mergeIntervals(vertical, "x", "startY", "endY").map((segment) => ({
    start: { x: segment.anchor, y: segment.start },
    end: { x: segment.anchor, y: segment.end },
    detected: segment.detected,
  }));

  return [...mergedHorizontal, ...mergedVertical, ...diagonal];
}

function mergeIntervals<
  T extends { detected: boolean },
>(
  segments: T[],
  anchorKey: keyof T & string,
  startKey: keyof T & string,
  endKey: keyof T & string,
): Array<{ anchor: number; start: number; end: number; detected: boolean }> {
  const groups = new Map<number, T[]>();
  for (const segment of segments) {
    const anchor = Number(segment[anchorKey]);
    if (!groups.has(anchor)) groups.set(anchor, []);
    groups.get(anchor)!.push(segment);
  }

  const merged: Array<{ anchor: number; start: number; end: number; detected: boolean }> = [];
  for (const [anchor, group] of groups.entries()) {
    const sorted = [...group].sort((a, b) => Number(a[startKey]) - Number(b[startKey]));
    const tolerance = 10;
    let currentStart = Number(sorted[0][startKey]);
    let currentEnd = Number(sorted[0][endKey]);
    let currentDetected = sorted[0].detected;

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      const nextStart = Number(next[startKey]);
      const nextEnd = Number(next[endKey]);
      if (nextStart <= currentEnd + tolerance) {
        currentEnd = Math.max(currentEnd, nextEnd);
        currentDetected = currentDetected || next.detected;
      } else {
        merged.push({ anchor, start: currentStart, end: currentEnd, detected: currentDetected });
        currentStart = nextStart;
        currentEnd = nextEnd;
        currentDetected = next.detected;
      }
    }

    merged.push({ anchor, start: currentStart, end: currentEnd, detected: currentDetected });
  }

  return merged;
}

function snapOpeningsToWalls<T extends DoorOpening | WindowOpening>(
  openings: T[],
  walls: WallSegment[],
  scalePixelsPerMeter: number,
): T[] {
  if (openings.length === 0 || walls.length === 0) return openings;

  const horizontalWalls = walls.filter((wall) => Math.abs(wall.start.y - wall.end.y) < 3);
  const verticalWalls = walls.filter((wall) => Math.abs(wall.start.x - wall.end.x) < 3);

  return openings.map((opening) => {
    const candidates = opening.orientation === "horizontal" ? horizontalWalls : verticalWalls;
    if (candidates.length === 0) return opening;

    const bestWall = candidates.reduce<{ wall: WallSegment; distance: number } | null>((best, wall) => {
      const anchor = opening.orientation === "horizontal"
        ? (wall.start.y + wall.end.y) / 2
        : (wall.start.x + wall.end.x) / 2;
      const distance = opening.orientation === "horizontal"
        ? Math.abs(opening.position.y - anchor)
        : Math.abs(opening.position.x - anchor);
      if (!best || distance < best.distance) return { wall, distance };
      return best;
    }, null);

    if (!bestWall || bestWall.distance > 40) return opening;

    if (opening.orientation === "horizontal") {
      const y = Math.round((bestWall.wall.start.y + bestWall.wall.end.y) / 2);
      const minX = Math.min(bestWall.wall.start.x, bestWall.wall.end.x);
      const maxX = Math.max(bestWall.wall.start.x, bestWall.wall.end.x);
      const halfWidthPx = Math.max(4, Math.round((opening.widthM * scalePixelsPerMeter) / 2));
      const x = clamp(opening.position.x, minX + halfWidthPx, maxX - halfWidthPx);
      return { ...opening, position: { x, y } };
    }

    const x = Math.round((bestWall.wall.start.x + bestWall.wall.end.x) / 2);
    const minY = Math.min(bestWall.wall.start.y, bestWall.wall.end.y);
    const maxY = Math.max(bestWall.wall.start.y, bestWall.wall.end.y);
    const halfWidthPx = Math.max(4, Math.round((opening.widthM * scalePixelsPerMeter) / 2));
    const y = clamp(opening.position.y, minY + halfWidthPx, maxY - halfWidthPx);
    return { ...opening, position: { x, y } };
  });
}

function isOpeningNearMatchingWall(opening: DoorOpening | WindowOpening, walls: WallSegment[]): boolean {
  const candidates = walls.filter((wall) => opening.orientation === "horizontal"
    ? Math.abs(wall.start.y - wall.end.y) < 3
    : Math.abs(wall.start.x - wall.end.x) < 3);
  if (candidates.length === 0) return false;

  return candidates.some((wall) => {
    if (opening.orientation === "horizontal") {
      const anchor = (wall.start.y + wall.end.y) / 2;
      const minX = Math.min(wall.start.x, wall.end.x);
      const maxX = Math.max(wall.start.x, wall.end.x);
      return Math.abs(opening.position.y - anchor) <= 40 && opening.position.x >= minX - 8 && opening.position.x <= maxX + 8;
    }
    const anchor = (wall.start.x + wall.end.x) / 2;
    const minY = Math.min(wall.start.y, wall.end.y);
    const maxY = Math.max(wall.start.y, wall.end.y);
    return Math.abs(opening.position.x - anchor) <= 40 && opening.position.y >= minY - 8 && opening.position.y <= maxY + 8;
  });
}

function countNearDuplicateWalls(walls: WallSegment[]): number {
  let duplicatePairs = 0;
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      if (areNearDuplicateWalls(walls[i], walls[j])) duplicatePairs++;
    }
  }
  return duplicatePairs;
}

function areNearDuplicateWalls(a: WallSegment, b: WallSegment): boolean {
  const aHorizontal = Math.abs(a.start.y - a.end.y) < 3;
  const bHorizontal = Math.abs(b.start.y - b.end.y) < 3;
  const aVertical = Math.abs(a.start.x - a.end.x) < 3;
  const bVertical = Math.abs(b.start.x - b.end.x) < 3;
  if (aHorizontal !== bHorizontal || aVertical !== bVertical) return false;

  if (aHorizontal && bHorizontal) {
    const anchorDistance = Math.abs(a.start.y - b.start.y);
    return anchorDistance <= 6 && intervalsOverlapRatio(
      [Math.min(a.start.x, a.end.x), Math.max(a.start.x, a.end.x)],
      [Math.min(b.start.x, b.end.x), Math.max(b.start.x, b.end.x)],
    ) > 0.8;
  }

  if (aVertical && bVertical) {
    const anchorDistance = Math.abs(a.start.x - b.start.x);
    return anchorDistance <= 6 && intervalsOverlapRatio(
      [Math.min(a.start.y, a.end.y), Math.max(a.start.y, a.end.y)],
      [Math.min(b.start.y, b.end.y), Math.max(b.start.y, b.end.y)],
    ) > 0.8;
  }

  return false;
}

function intervalsOverlapRatio(a: [number, number], b: [number, number]): number {
  const overlap = Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));
  const shortest = Math.max(1, Math.min(a[1] - a[0], b[1] - b[0]));
  return overlap / shortest;
}

function wallLengthPx(wall: WallSegment): number {
  return Math.sqrt((wall.end.x - wall.start.x) ** 2 + (wall.end.y - wall.start.y) ** 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getWallBounds(walls: WallSegment[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (walls.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const wall of walls) {
    minX = Math.min(minX, wall.start.x, wall.end.x);
    minY = Math.min(minY, wall.start.y, wall.end.y);
    maxX = Math.max(maxX, wall.start.x, wall.end.x);
    maxY = Math.max(maxY, wall.start.y, wall.end.y);
  }
  return { minX, minY, maxX, maxY };
}

function createFallbackRectWalls(
  uid: (prefix: string) => string,
  widthM: number,
  depthM: number,
  heightM: number,
): WallNode[] {
  return [
    { id: uid("wall"), nodeType: "wall", label: "South Wall", start: [0, 0], end: [widthM, 0], heightM, thicknessM: 0.18, material: "solid", visionTransmission: 0, source: "import", reviewStatus: "unreviewed", sourceTrace: "heuristic-import-v1", geometryValidity: "valid" },
    { id: uid("wall"), nodeType: "wall", label: "North Wall", start: [0, depthM], end: [widthM, depthM], heightM, thicknessM: 0.18, material: "solid", visionTransmission: 0, source: "import", reviewStatus: "unreviewed", sourceTrace: "heuristic-import-v1", geometryValidity: "valid" },
    { id: uid("wall"), nodeType: "wall", label: "East Wall", start: [widthM, 0], end: [widthM, depthM], heightM, thicknessM: 0.18, material: "solid", visionTransmission: 0, source: "import", reviewStatus: "unreviewed", sourceTrace: "heuristic-import-v1", geometryValidity: "valid" },
    { id: uid("wall"), nodeType: "wall", label: "West Wall", start: [0, 0], end: [0, depthM], heightM, thicknessM: 0.18, material: "solid", visionTransmission: 0, source: "import", reviewStatus: "unreviewed", sourceTrace: "heuristic-import-v1", geometryValidity: "valid" },
  ];
}

function extractDimensions(
  walls: WallSegment[],
  scalePixelsPerMeter: number,
  roomHeightM: number,
): { widthM: number; depthM: number; heightM: number } {
  if (walls.length === 0) {
    return { widthM: 10, depthM: 8, heightM: roomHeightM };
  }

  // Find bounding box of all wall endpoints
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const wall of walls) {
    minX = Math.min(minX, wall.start.x, wall.end.x);
    maxX = Math.max(maxX, wall.start.x, wall.end.x);
    minY = Math.min(minY, wall.start.y, wall.end.y);
    maxY = Math.max(maxY, wall.start.y, wall.end.y);
  }

  const widthPx = maxX - minX;
  const depthPx = maxY - minY;

  return {
    widthM: Math.max(1, Math.round((widthPx / scalePixelsPerMeter) * 10) / 10),
    depthM: Math.max(1, Math.round((depthPx / scalePixelsPerMeter) * 10) / 10),
    heightM: roomHeightM,
  };
}

function calculateConfidence(
  walls: WallSegment[],
  width: number,
  height: number,
): number {
  if (walls.length === 0) return 0;

  // Estimate based on:
  // - Number of wall segments relative to expected (4 for rectangle)
  // - Total wall coverage relative to perimeter
  const perimeter = 2 * (width + height);
  const totalWallLength = walls.reduce(
    (sum, w) => sum + Math.sqrt(
      (w.end.x - w.start.x) ** 2 + (w.end.y - w.start.y) ** 2,
    ),
    0,
  );

  const wallCoverageRatio = Math.min(1, totalWallLength / (perimeter * 0.5));
  const segmentCountScore = Math.min(1, walls.length / 8);

  return Math.round((wallCoverageRatio * 0.6 + segmentCountScore * 0.4) * 100) / 100;
}

// ── Canvas Helper ──

/**
 * Load an image file into ImageData for processing.
 */
export function loadImageToData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        // Limit size for performance
        const maxDim = 1024;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const scale = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(imageData);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
