import type {
  CameraNode,
  ConfidenceBand,
  ConfidenceLevel,
  DoriQuality,
  PathVisibilityResult,
  SecurityScene,
  SimulationResult,
  ZoneResult,
} from "@sentineltwin/core";
import { qualityToScore } from "@sentineltwin/core";
import { estimateCameraConfidence, getCalibration } from "./calibration";

/**
 * Derive an overall confidence band for the full simulation result.
 *
 * Factors:
 * 1. Camera source provenance — how reliable are the camera specs?
 * 2. Scene geometry validity — is the floor plan trusted?
 * 3. Calibration presence — are calibration constants available?
 * 4. Lighting assumption confidence — are light levels measured or guessed?
 * 5. Source provenance — where did the scene come from?
 */
export function computeOverallConfidence(
  scene: Pick<SecurityScene, "cameras" | "windows" | "obstructions" | "assumptions" | "source" | "geometryValidity" | "calibrationConstants">,
): ConfidenceBand {
  const reasonCodes: string[] = [];
  const sensitiveTo: string[] = [];
  let lowestConfidence: ConfidenceLevel = "high";

  const calibration = getCalibration(scene);

  // Factor 1: Camera source provenance
  for (const camera of scene.cameras) {
    const camConf = estimateCameraConfidence(camera);
    if (confidenceRank(camConf) < confidenceRank(lowestConfidence)) {
      lowestConfidence = camConf;
    }
  }

  if (scene.cameras.length === 0) {
    lowestConfidence = "none";
    reasonCodes.push("NO_CAMERAS");
    sensitiveTo.push("cameras");
  } else if (scene.cameras.some(c => c.source === "ai" || c.source === "import")) {
    reasonCodes.push("AI_OR_IMPORTED_CAMERAS");
    sensitiveTo.push("camera_positions");
    sensitiveTo.push("camera_fov");
  }

  // Factor 2: Scene geometry validity
  if (scene.geometryValidity === "invalid") {
    lowestConfidence = "none";
    reasonCodes.push("INVALID_GEOMETRY");
    sensitiveTo.push("wall_positions");
    sensitiveTo.push("floor_plan_scale");
  } else if (scene.geometryValidity === "suspect") {
    if (confidenceRank("low") < confidenceRank(lowestConfidence)) {
      lowestConfidence = "low";
    }
    reasonCodes.push("SUSPECT_GEOMETRY");
    sensitiveTo.push("wall_positions");
  }

  // Factor 3: Calibration presence
  if (!scene.calibrationConstants) {
    if (confidenceRank("medium") < confidenceRank(lowestConfidence)) {
      lowestConfidence = "medium";
    }
    reasonCodes.push("DEFAULT_CALIBRATION");
    sensitiveTo.push("camera_presets");
    sensitiveTo.push("lux_thresholds");
  } else if (calibration.version === "0.1.0") {
    reasonCodes.push("CALIBRATION_PRELIMINARY");
    sensitiveTo.push("calibration_constants");
  } else {
    reasonCodes.push("CALIBRATION_APPLIED");
  }

  // Factor 4: Lighting assumptions
  if (scene.assumptions.exteriorLightLux == null) {
    if (confidenceRank("medium") < confidenceRank(lowestConfidence)) {
      lowestConfidence = "medium";
    }
    reasonCodes.push("LIGHTING_ASSUMED");
    sensitiveTo.push("exterior_light_lux");
  }

  if (scene.assumptions.nightPenaltyMode === "none" && scene.assumptions.timeOfDay === "night") {
    if (confidenceRank("low") < confidenceRank(lowestConfidence)) {
      lowestConfidence = "low";
    }
    reasonCodes.push("NIGHT_PENALTY_DISABLED");
  }

  // Factor 5: Source provenance
  if (scene.source === "ai" || scene.source === "scan") {
    if (confidenceRank("medium") < confidenceRank(lowestConfidence)) {
      lowestConfidence = "medium";
    }
    reasonCodes.push(`SOURCE_${scene.source.toUpperCase()}`);
    sensitiveTo.push("scene_source_accuracy");
  }

  return {
    level: lowestConfidence,
    source: "simulation",
    reasonCodes,
    sensitiveTo,
  };
}

/**
 * Compute per-zone confidence bands.
 */
export function computeZoneConfidence(
  scene: Pick<SecurityScene, "cameras" | "criticalZones" | "geometryValidity" | "assumptions">,
  zoneResults: ZoneResult[],
): Record<string, ConfidenceBand> {
  const result: Record<string, ConfidenceBand> = {};

  for (const zone of zoneResults) {
    const reasonCodes: string[] = [];
    const sensitiveTo: string[] = [];
    let level: ConfidenceLevel = "high";

    // Zone sampling confidence
    if (zone.status === "fail") {
      reasonCodes.push("ZONE_FAILS_REQUIREMENT");
    }

    // Camera coverage confidence
    if (zone.coveringCameras.length === 0) {
      level = "none";
      reasonCodes.push("NO_COVERING_CAMERAS");
      sensitiveTo.push("camera_count");
    } else {
      const coveringCameraNodes = scene.cameras.filter(c => zone.coveringCameras.includes(c.id));
      for (const camera of coveringCameraNodes) {
        const camConf = estimateCameraConfidence(camera);
        if (confidenceRank(camConf) < confidenceRank(level)) {
          level = camConf;
        }
      }
    }

    // Geometry sensitivity
    if (scene.geometryValidity === "suspect") {
      sensitiveTo.push("zone_geometry_accuracy");
      if (confidenceRank("medium") < confidenceRank(level)) {
        level = "medium";
      }
      reasonCodes.push("GEOMETRY_SUSPECT");
    }

    // Lighting sensitivity for night-required zones
    const zoneDef = scene.criticalZones.find(z => z.id === zone.zoneId);
    if (zoneDef?.nightRequired && scene.assumptions.nightPenaltyMode === "none") {
      if (confidenceRank("low") < confidenceRank(level)) {
        level = "low";
      }
      reasonCodes.push("NIGHT_REQUIRED_BUT_NO_NIGHT_PENALTY");
      sensitiveTo.push("night_penalty_mode");
    }

    result[zone.zoneId] = { level, source: "simulation", reasonCodes, sensitiveTo };
  }

  return result;
}

/**
 * Compute per-path confidence bands.
 */
export function computePathConfidence(
  scene: Pick<SecurityScene, "paths" | "geometryValidity">,
  pathResults: PathVisibilityResult[],
): Record<string, ConfidenceBand> {
  const result: Record<string, ConfidenceBand> = {};

  for (const path of pathResults) {
    const reasonCodes: string[] = [];
    const sensitiveTo: string[] = [];
    let level: ConfidenceLevel = "high";

    // Path geometry sensitivity
    if (scene.geometryValidity === "suspect") {
      sensitiveTo.push("path_geometry_accuracy");
      level = "medium";
      reasonCodes.push("GEOMETRY_SUSPECT");
    }

    // Path with no visibility
    if (path.visibleDurationS === 0) {
      reasonCodes.push("NO_VISIBILITY_ON_PATH");
    }

    result[path.pathId] = { level, source: "simulation", reasonCodes, sensitiveTo };
  }

  return result;
}

function confidenceRank(level: ConfidenceLevel): number {
  const ranks: Record<ConfidenceLevel, number> = {
    verified: 5,
    high: 4,
    medium: 3,
    low: 2,
    none: 1,
  };
  return ranks[level] ?? 0;
}

/**
 * Compute per-cell confidence from covering cameras' provenance.
 *
 * A cell's confidence is the minimum confidence among its covering cameras,
 * factoring in geometry reliability. Cells with no covering cameras get
 * "none" confidence.
 */
export function computeCellConfidence(
  cell: { coveringCameras: string[]; privacyRestricted?: boolean },
  cameras: CameraNode[],
  geometryValidity: SecurityScene["geometryValidity"],
): ConfidenceBand {
  const reasonCodes: string[] = [];
  const sensitiveTo: string[] = [];
  let level: ConfidenceLevel = cell.coveringCameras.length > 0 ? "high" : "none";

  if (cell.coveringCameras.length === 0) {
    reasonCodes.push("NO_COVERING_CAMERAS");
    sensitiveTo.push("camera_count");
  } else {
    for (const cameraId of cell.coveringCameras) {
      const camera = cameras.find(c => c.id === cameraId);
      if (!camera) continue;
      const camConf = estimateCameraConfidence(camera);
      if (confidenceRank(camConf) < confidenceRank(level)) {
        level = camConf;
      }
    }
    if (level === "low" || level === "none") {
      reasonCodes.push("LOW_CONFIDENCE_CAMERAS");
    }
    sensitiveTo.push("camera_positions");
    sensitiveTo.push("camera_specs");
  }

  if (cell.privacyRestricted) {
    if (confidenceRank("medium") < confidenceRank(level)) {
      level = "medium";
    }
    reasonCodes.push("PRIVACY_RESTRICTED");
  }

  if (geometryValidity === "suspect") {
    if (confidenceRank("medium") < confidenceRank(level)) {
      level = "medium";
    }
    reasonCodes.push("GEOMETRY_SUSPECT");
    sensitiveTo.push("geometry_accuracy");
  }

  return { level, source: "simulation", reasonCodes, sensitiveTo };
}

/**
 * Build a human-readable confidence summary sentence.
 */
export function formatConfidenceSummary(
  overallConfidence: ConfidenceBand,
  zones: ZoneResult[],
): string {
  const level = overallConfidence.level;
  const failZoneCount = zones.filter(z => z.status !== "pass").length;

  const levelLabels: Record<ConfidenceLevel, string> = {
    verified: "Verified against real footage or manufacturer specifications.",
    high: "High confidence within stated assumptions.",
    medium: "Medium confidence. Results are sensitive to assumed inputs.",
    low: "Low confidence. Results may change significantly with better input data.",
    none: "No confidence estimate possible — insufficient or unreliable inputs.",
  };

  const zoneNote = failZoneCount > 0
    ? ` ${failZoneCount} zone(s) fail — their confidence may be lower than overall.`
    : "";

  const sensitivityNote = overallConfidence.sensitiveTo.length > 0
    ? ` Most sensitive to: ${overallConfidence.sensitiveTo.join(", ")}.`
    : "";

  return `${levelLabels[level]}${zoneNote}${sensitivityNote}`;
}
