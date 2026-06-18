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
import { createBlankSecurityScene } from "@/lib/scene-skeleton";

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

export type FloorPlanSourceProfile = "architectural" | "hand_drawn" | "low_res_scan";

export interface FloorPlanResult {
  imageWidth: number;
  imageHeight: number;
  walls: WallSegment[];
  doors: DoorOpening[];
  windows: WindowOpening[];
  roomDimensions: { widthM: number; depthM: number; heightM: number };
  scalePixelsPerMeter: number;
  rawWallSegmentCount?: number;
  confidence: number; // 0-1 estimate of detection quality
  manualCalibration?: { widthM: number; depthM: number; heightM: number } | null;
  sourceProfile?: FloorPlanSourceProfile;
  sourceHint?: string;
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

export type FloorPlanSceneType = "retail" | "warehouse" | "office" | "residential" | "industrial" | "unknown";
export type FloorPlanSemanticConfidence = "high" | "medium" | "low_clutter";
export type FloorPlanGateAction = "rescan_required" | "human_review" | "cloud_geometry_required" | "proceed_to_tier2";

export interface FloorPlanSemanticContext {
  sceneType: FloorPlanSceneType;
  ocrText: string[];
  roomCount: number;
  zones: string[];
  confidence: FloorPlanSemanticConfidence;
  qualityScore: number;
  ambiguityFlags: string[];
}

export interface FloorPlanGateDecision {
  action: FloorPlanGateAction;
  reason: string;
  qualityThreshold: number;
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
const DEFAULT_TIER1_QUALITY_THRESHOLD = 0.45;
const NOISE_CLEANUP_COMPONENT_TOLERANCE_PX = 12;
const NOISE_COMPONENT_KEEP_SPAN_PX = 42;

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

  // Step 3: Trace wall contours from edges, then clean noisy fragments for stable shells.
  const wallCandidates = traceWalls(gradient, width, height, cfg.minWallLengthPx);
  const wallSegments = removeNoisyWallComponents(wallCandidates, width, height, cfg.scalePixelsPerMeter);

  // Step 4: Detect openings (doors/windows) from wall gaps
  const { doors, windows } = detectOpenings(wallSegments);

  // Step 5: Extract room dimensions from wall bounding box
  const dimensions = extractDimensions(wallSegments, cfg.scalePixelsPerMeter, cfg.roomHeightM);

  const baseResult: FloorPlanResult = {
    imageWidth: width,
    imageHeight: height,
    walls: wallSegments,
    doors,
    windows,
    rawWallSegmentCount: wallCandidates.length,
    roomDimensions: dimensions,
    scalePixelsPerMeter: cfg.scalePixelsPerMeter,
    confidence: 0,
    manualCalibration: null,
  };

  return {
    ...baseResult,
    confidence: calculateReviewedImportConfidence(baseResult),
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
  const diagnostics = getFloorPlanDiagnostics(normalized);
  const sourceProfile = normalized.sourceProfile ?? "architectural";
  const sourceHint = normalized.sourceHint ?? "Source profile not provided. Detector defaults were used.";
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
      sourceTrace: `heuristic-import-v1:${sourceProfile}`,
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
    sourceTrace: `heuristic-import-v1:${sourceProfile}`,
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
    sourceTrace: `heuristic-import-v1:${sourceProfile}`,
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

  const baseScene = createBlankSecurityScene();
  baseScene.id = uid("scene");
  baseScene.name = name;
  baseScene.dimensions = {
    width: normalized.roomDimensions.widthM,
    depth: normalized.roomDimensions.depthM,
    height: roomHeight,
  };
  baseScene.source = "import";
  baseScene.sourceTrace = `heuristic-import-v1:${sourceProfile}`;
  baseScene.geometryValidity = "valid";
  baseScene.reviewStatus = "unreviewed";

  return {
    ...baseScene,
    createdAt: now,
    updatedAt: now,
    walls,
    doors,
    windows,
    entryPoints,
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
      backlightIntensity: "none" as const,
      glareIntensity: "none" as const,
      overexposedZones: false,
      sceneComplexity: "moderate" as const,
      operatorExperience: "trained" as const,
      taskCriticality: "standard" as const,
    },
    version: "0.1.0",
    changeLog: [
      `Floor plan import: ${normalized.walls.length} walls, ${normalized.doors.length} doors, ${normalized.windows.length} windows at ${Math.round(normalized.confidence * 100)}% confidence.`,
      `Floor plan diagnostics: ${diagnostics.duplicateWallPairs} duplicate wall pair${diagnostics.duplicateWallPairs === 1 ? "" : "s"}, ${diagnostics.unsnappedDoorCount + diagnostics.unsnappedWindowCount} off-wall opening${diagnostics.unsnappedDoorCount + diagnostics.unsnappedWindowCount === 1 ? "" : "s"}, ${diagnostics.shortWallCount} short fragment${diagnostics.shortWallCount === 1 ? "" : "s"}, ${Math.round(diagnostics.boundsCoverageRatio * 100)}% bounds coverage.`,
      `Source profile: ${sourceProfile} · ${sourceHint}`,
      ...(normalized.walls.length === 4 && normalized.doors.length === 0 && normalized.windows.length === 0
        ? ["Floor plan fallback shell preserved because the import produced a bare room outline."]
        : []),
    ],
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
    manualCalibration: {
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
  const nextDimensions = result.manualCalibration
    ? {
        widthM: Number(result.manualCalibration.widthM.toFixed(2)),
        depthM: Number(result.manualCalibration.depthM.toFixed(2)),
        heightM: Number(result.manualCalibration.heightM.toFixed(2)),
      }
    : extractDimensions(normalizedWalls, result.scalePixelsPerMeter, result.roomDimensions.heightM);

  const normalizedResultBase: FloorPlanResult = {
    ...result,
    walls: normalizedWalls,
    doors: normalizedDoors,
    windows: normalizedWindows,
    rawWallSegmentCount: result.rawWallSegmentCount ?? Math.max(result.walls.length, normalizedWalls.length),
    roomDimensions: {
      widthM: nextDimensions.widthM,
      depthM: nextDimensions.depthM,
      heightM: result.manualCalibration?.heightM ?? result.roomDimensions.heightM,
    },
    manualCalibration: result.manualCalibration ?? null,
    confidence: 0,
  };

  return {
    ...normalizedResultBase,
    confidence: calculateReviewedImportConfidence(normalizedResultBase),
  };
}

function calculateReviewedImportConfidence(
  result: Pick<FloorPlanResult, "walls" | "doors" | "windows" | "imageWidth" | "imageHeight" | "scalePixelsPerMeter">,
): number {
  const structuralConfidence = calculateConfidence(result.walls, result.imageWidth, result.imageHeight);
  const diagnostics = getFloorPlanDiagnostics({
    ...result,
    confidence: structuralConfidence,
    roomDimensions: { widthM: 1, depthM: 1, heightM: 3 },
  });
  const fragmentRatio = diagnostics.wallCount > 0 ? diagnostics.shortWallCount / diagnostics.wallCount : 1;
  const duplicatePenalty = Math.min(0.35, diagnostics.duplicateWallPairs * 0.04);
  const offWallPenalty = Math.min(0.25, (diagnostics.unsnappedDoorCount + diagnostics.unsnappedWindowCount) * 0.05);
  const fragmentPenalty = Math.min(0.3, fragmentRatio * 0.55);
  const coveragePenalty = diagnostics.boundsCoverageRatio > 0.82
    ? Math.min(0.18, (diagnostics.boundsCoverageRatio - 0.82) * 0.75)
    : 0;

  return clampUnit(
    Number((structuralConfidence - duplicatePenalty - offWallPenalty - fragmentPenalty - coveragePenalty).toFixed(2)),
  );
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

export function deriveFloorPlanSemanticContext(
  result: FloorPlanResult,
  diagnosticsInput?: FloorPlanDiagnostics,
): FloorPlanSemanticContext {
  const diagnostics = diagnosticsInput ?? getFloorPlanDiagnostics(result);
  const wallCount = Math.max(1, diagnostics.wallCount);
  const areaM2 = result.roomDimensions.widthM * result.roomDimensions.depthM;
  const orthogonalRatio = (diagnostics.horizontalWallCount + diagnostics.verticalWallCount) / wallCount;
  const duplicatePenalty = Math.min(0.2, diagnostics.duplicateWallPairs * 0.05);
  const fragmentPenalty = Math.min(0.2, (diagnostics.shortWallCount / wallCount) * 0.35);
  const offWallPenalty = Math.min(0.15, (diagnostics.unsnappedDoorCount + diagnostics.unsnappedWindowCount) * 0.05);
  const qualityScore = clampUnit(
    Number((
      result.confidence * 0.55 +
      diagnostics.boundsCoverageRatio * 0.25 +
      orthogonalRatio * 0.2 -
      duplicatePenalty -
      fragmentPenalty -
      offWallPenalty
    ).toFixed(2)),
  );
  const sceneType = inferSceneType(result, diagnostics, areaM2);
  const roomCount = Math.max(1, Math.round(Math.max(1, diagnostics.wallCount) / 4));
  const zones = inferZoneHints(result, diagnostics);
  const confidence =
    qualityScore < DEFAULT_TIER1_QUALITY_THRESHOLD ||
    result.confidence < 0.35 ||
    diagnostics.shortWallCount > Math.max(2, diagnostics.wallCount * 0.35)
      ? "low_clutter"
      : qualityScore >= 0.75 && result.confidence >= 0.65
        ? "high"
        : "medium";

  const ambiguityFlags: string[] = [];
  if (sceneType === "unknown") ambiguityFlags.push("unknown_scene_type");
  if (diagnostics.duplicateWallPairs > 0) ambiguityFlags.push("duplicate_walls");
  if (diagnostics.shortWallCount > Math.max(2, diagnostics.wallCount * 0.25)) ambiguityFlags.push("wall_fragmentation");
  if (diagnostics.unsnappedDoorCount + diagnostics.unsnappedWindowCount > 0) ambiguityFlags.push("openings_off_wall");
  if (result.confidence < 0.45) ambiguityFlags.push("low_detection_confidence");

  return {
    sceneType,
    ocrText: [],
    roomCount,
    zones,
    confidence,
    qualityScore,
    ambiguityFlags,
  };
}

export function evaluateFloorPlanTierGate(
  context: FloorPlanSemanticContext,
  options?: { qualityThreshold?: number },
): FloorPlanGateDecision {
  const qualityThreshold = options?.qualityThreshold ?? DEFAULT_TIER1_QUALITY_THRESHOLD;
  if (context.qualityScore < qualityThreshold) {
    return {
      action: "rescan_required",
      reason: `Tier 1 quality score ${context.qualityScore.toFixed(2)} is below ${qualityThreshold.toFixed(2)}.`,
      qualityThreshold,
    };
  }
  if (context.sceneType === "unknown") {
    return {
      action: "human_review",
      reason: "Tier 1 could not confidently classify the scene type.",
      qualityThreshold,
    };
  }
  if (context.confidence === "low_clutter") {
    return {
      action: "cloud_geometry_required",
      reason: "Tier 1 confidence is low_clutter, so cloud geometry extraction should be forced.",
      qualityThreshold,
    };
  }
  return {
    action: "proceed_to_tier2",
    reason: "Tier 1 quality and confidence are sufficient to continue with normal Tier 2 processing.",
    qualityThreshold,
  };
}

export function getFloorPlanTierGateWarning(decision: FloorPlanGateDecision): string | null {
  switch (decision.action) {
    case "rescan_required":
      return "Tier 1 gate blocked this import: image quality is too low. Upload a clearer floor plan to continue.";
    case "human_review":
      return "Tier 1 gate flagged this floor plan for manual review before scene creation.";
    case "cloud_geometry_required":
      return "Tier 1 gate recommends forced cloud geometry extraction for this floor plan.";
    case "proceed_to_tier2":
    default:
      return null;
  }
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

function inferSceneType(
  result: FloorPlanResult,
  diagnostics: FloorPlanDiagnostics,
  areaM2: number,
): FloorPlanSceneType {
  const openingCount = result.doors.length + result.windows.length;
  if (areaM2 >= 180 && diagnostics.wallCount <= 8) return "warehouse";
  if (openingCount >= 4 && areaM2 >= 60 && areaM2 <= 220) return "retail";
  if (areaM2 <= 80 && diagnostics.wallCount >= 4) return "office";
  if (areaM2 <= 45 && openingCount <= 2) return "residential";
  if (areaM2 > 220 && diagnostics.diagonalWallCount > 2) return "industrial";
  return "unknown";
}

function inferZoneHints(result: FloorPlanResult, diagnostics: FloorPlanDiagnostics): string[] {
  const zones = new Set<string>();
  if (result.doors.length > 0) zones.add("entry_flow");
  if (result.windows.length > 0) zones.add("window_perimeter");
  if (diagnostics.wallCount >= 8) zones.add("partitioned_layout");
  if (diagnostics.wallCount <= 5) zones.add("open_floor");
  if (zones.size === 0) zones.add("general_floor");
  return [...zones];
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

function removeNoisyWallComponents(
  walls: WallSegment[],
  _imageWidth: number,
  _imageHeight: number,
  scalePixelsPerMeter: number,
): WallSegment[] {
  if (walls.length === 0) return walls;

  const candidateWallIndexes = walls
    .map((wall, index) => ({ wall, index, lengthPx: wallLengthPx(wall) }))
    .filter(({ lengthPx }) => lengthPx >= Math.max(12, scalePixelsPerMeter * 0.2));

  if (candidateWallIndexes.length <= 1) return candidateWallIndexes.map((entry) => entry.wall);

  const candidates = candidateWallIndexes.map(({ wall }) => wall);
  const adjacency: number[][] = new Array(candidates.length).fill(0).map(() => []);
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      if (!areWallsEndpointConnected(candidates[i], candidates[j], NOISE_CLEANUP_COMPONENT_TOLERANCE_PX)) continue;
      adjacency[i].push(j);
      adjacency[j].push(i);
    }
  }

  const visited = new Array<boolean>(candidates.length).fill(false);
  const kept: WallSegment[] = [];
  const minKeepSpan = Math.max(scalePixelsPerMeter * 0.6, NOISE_COMPONENT_KEEP_SPAN_PX);

  for (let i = 0; i < candidates.length; i += 1) {
    if (visited[i]) continue;

    const stack = [i];
    const component: number[] = [];
    visited[i] = true;

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) continue;
      component.push(current);
      for (const neighbor of adjacency[current]) {
        if (!visited[neighbor]) {
          visited[neighbor] = true;
          stack.push(neighbor);
        }
      }
    }

    const componentPoints: { x: number; y: number }[] = [];
    let totalLength = 0;
    for (const componentIndex of component) {
      const wall = candidates[componentIndex];
      totalLength += wallLengthPx(wall);
      componentPoints.push(wall.start, wall.end);
    }

    const spanX = Math.max(...componentPoints.map((point) => point.x)) - Math.min(...componentPoints.map((point) => point.x));
    const spanY = Math.max(...componentPoints.map((point) => point.y)) - Math.min(...componentPoints.map((point) => point.y));
    const shouldKeep = component.length >= 2 || spanX >= minKeepSpan || spanY >= minKeepSpan || totalLength >= totalLengthThreshold(scalePixelsPerMeter);

    if (shouldKeep) {
      for (const componentIndex of component) {
        kept.push(candidates[componentIndex]);
      }
    }
  }

  return kept;
}

function totalLengthThreshold(scalePixelsPerMeter: number): number {
  return Math.max(90, scalePixelsPerMeter * 1.4);
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

function areWallsEndpointConnected(
  a: WallSegment,
  b: WallSegment,
  tolerancePx: number,
): boolean {
  const endpointsA = [a.start, a.end];
  const endpointsB = [b.start, b.end];
  for (const p of endpointsA) {
    for (const q of endpointsB) {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      if (Math.hypot(dx, dy) <= tolerancePx) return true;
    }
  }
  return false;
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

function clampUnit(value: number) {
  return clamp(value, 0, 1);
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
