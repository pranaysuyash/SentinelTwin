/**
 * Installability Validator for SentinelTwin studio.
 *
 * Checks whether a camera can be physically installed at its scene position
 * given geometry, mount type, height, angle, and practical installer constraints.
 */

import { nearestPointOnWall, pointDistance } from "@/components/workspace/editing/editor-geometry";
import type { CameraNode, SecurityScene } from "@/schema/security-scene";

// ── Types ────────────────────────────────────────────────────────────────────

export interface InstallabilityResult {
  mountSurfaceValid: boolean;
  mountHeightValid: boolean;
  angleValid: boolean;
  obstructionClearance: boolean;
  ladderAccessible: boolean;
  cableReachable: boolean;
  overallValid: boolean;
  warnings: string[];
  suggestions: string[];
}

export type MountSurface = "wall" | "ceiling" | "pole" | "free_space";

// ── Constants ────────────────────────────────────────────────────────────────

/** Distance threshold for being "near" a wall (m). */
const WALL_PROXIMITY_M = 0.5;

/** Distance threshold for being "near" the ceiling plane (m). */
const CEILING_PROXIMITY_M = 0.5;

/** Distance threshold for obstruction clearance (m). */
const OBSTRUCTION_CLEARANCE_M = 0.3;

/** Ladder height limits (m). */
const STEP_LADDER_MAX_M = 4;
const EXTENSION_LADDER_MAX_M = 6;

/** Height ranges per mount type. */
const MOUNT_HEIGHT_RANGES: Record<string, { min: number; max: number }> = {
  wall: { min: 0.5, max: 6 },
  pole: { min: 0.5, max: 6 },
  ceiling: { min: 0.5, max: 8 },
  corner: { min: 0.5, max: 6 },
  desk: { min: 0.5, max: 2 },
};

/** Pitch angle ranges per mount type (degrees, negative = downward). */
const MOUNT_PITCH_RANGES: Record<string, { min: number; max: number }> = {
  wall: { min: -60, max: 0 },
  pole: { min: -60, max: 0 },
  ceiling: { min: -90, max: -30 },
  corner: { min: -60, max: 0 },
  desk: { min: -45, max: 0 },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine the most likely mount surface for a camera based on its position
 * in the scene.
 */
export function detectMountSurface(camera: CameraNode, scene: SecurityScene): MountSurface {
  // Check wall proximity via 2D point-to-wall-segment distance.
  const { dist: wallDist } = nearestPointOnWall(
    [camera.position[0], camera.position[2]],
    scene.walls,
  );

  const nearWall = wallDist <= WALL_PROXIMITY_M;

  // Check ceiling proximity: camera Y should be close to the wall height.
  const ceilingHeight = scene.assumptions.wallHeightM;
  const nearCeiling = Math.abs(camera.position[1] - ceilingHeight) <= CEILING_PROXIMITY_M;

  // Check pole proximity.
  const nearPole = scene.obstructions.some((obs) => {
    if (obs.obstructionType !== "pillar" && !obs.label.toLowerCase().includes("pillar")) return false;
    const dist = pointDistance(
      [camera.position[0], camera.position[2]],
      [obs.position[0], obs.position[2]],
    );
    // For a pole, the camera must be within 0.3m horizontally (mounting on it)
    // or consider distance to the pillar's extent.
    const pillarHalfWidth = Math.max(obs.dimensions[0], obs.dimensions[2]) / 2;
    return dist <= pillarHalfWidth + 0.3;
  });

  if (nearCeiling && camera.mountType === "ceiling") return "ceiling";
  if (nearWall && camera.mountType === "wall") return "wall";
  if (nearPole) return "pole";
  if (nearCeiling) return "ceiling";
  if (nearWall) return "wall";

  return "free_space";
}

/**
 * Find the minimum distance from the camera to any obstruction in the scene.
 */
export function nearestObstructionDistance(camera: CameraNode, scene: SecurityScene): number {
  const camPos2D: [number, number] = [camera.position[0], camera.position[2]];

  if (scene.obstructions.length === 0) return Number.POSITIVE_INFINITY;

  return Math.min(
    ...scene.obstructions.map((obs) => {
      const obsPos2D: [number, number] = [obs.position[0], obs.position[2]];
      return pointDistance(camPos2D, obsPos2D);
    }),
  );
}

// ── Core validation ──────────────────────────────────────────────────────────

/**
 * Validate the installability of a single camera within the given scene.
 */
export function validateCameraInstallability(
  camera: CameraNode,
  scene: SecurityScene,
): InstallabilityResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // ── 1. Mount surface detection ─────────────────────────────────────────
  const surface = detectMountSurface(camera, scene);
  const mountSurfaceValid = surface !== "free_space";

  if (!mountSurfaceValid) {
    warnings.push("Camera is floating in free space — no wall, ceiling, or pole nearby.");
    suggestions.push("Move the camera within 0.5m of a wall or ceiling, or mount it on a pillar.");
  }

  // ── 2. Height validation ───────────────────────────────────────────────
  const heightRange = MOUNT_HEIGHT_RANGES[camera.mountType] ?? { min: 0.5, max: 6 };
  const mountHeightValid =
    camera.mountHeightM >= heightRange.min && camera.mountHeightM <= heightRange.max;

  if (!mountHeightValid) {
    warnings.push(
      `Mount height ${camera.mountHeightM.toFixed(1)}m is outside the recommended range for ${camera.mountType} mounts (${heightRange.min}-${heightRange.max}m).`,
    );
    suggestions.push(
      `Adjust mount height to between ${heightRange.min}m and ${heightRange.max}m for ${camera.mountType} installations.`,
    );
  }

  // ── 3. Angle validation ────────────────────────────────────────────────
  const pitchRange = MOUNT_PITCH_RANGES[camera.mountType] ?? { min: -60, max: 0 };
  const angleValid =
    camera.pitchDeg >= pitchRange.min && camera.pitchDeg <= pitchRange.max;

  if (!angleValid) {
    warnings.push(
      `Pitch angle ${camera.pitchDeg}° is outside the practical range for ${camera.mountType} mounts (${pitchRange.min}° to ${pitchRange.max}°).`,
    );
    suggestions.push(
      `Set pitch between ${pitchRange.min}° and ${pitchRange.max}° for effective ${camera.mountType} coverage.`,
    );
  }

  // ── 4. Obstruction clearance ───────────────────────────────────────────
  const obstructionDist = nearestObstructionDistance(camera, scene);
  const obstructionClearance = obstructionDist > OBSTRUCTION_CLEARANCE_M;

  if (!obstructionClearance) {
    warnings.push(
      `Obstruction detected within ${obstructionDist.toFixed(2)}m of the camera — closer than the ${OBSTRUCTION_CLEARANCE_M}m clearance threshold.`,
    );
    suggestions.push(
      `Move the camera at least ${OBSTRUCTION_CLEARANCE_M}m away from nearby obstructions to keep the FOV clear.`,
    );
  }

  // ── 5. Ladder accessibility ────────────────────────────────────────────
  const ladderAccessible = camera.mountHeightM <= EXTENSION_LADDER_MAX_M;

  if (!ladderAccessible) {
    warnings.push(
      `Mount height ${camera.mountHeightM.toFixed(1)}m exceeds extension ladder reach (${EXTENSION_LADDER_MAX_M}m).`,
    );
    suggestions.push(
      `Lower the camera to ${EXTENSION_LADDER_MAX_M}m or less so an installer can reach it with standard equipment.`,
    );
  } else if (camera.mountHeightM > STEP_LADDER_MAX_M) {
    warnings.push(
      `Mount height ${camera.mountHeightM.toFixed(1)}m exceeds step ladder reach (${STEP_LADDER_MAX_M}m); an extension ladder is required.`,
    );
    suggestions.push(
      `Use an extension ladder for installation at ${camera.mountHeightM.toFixed(1)}m, or lower the camera to ${STEP_LADDER_MAX_M}m for step-ladder access.`,
    );
  }

  // ── 6. Cable routing ──────────────────────────────────────────────────
  let cableReachable: boolean;
  switch (surface) {
    case "wall":
    case "ceiling":
      cableReachable = true;
      break;
    case "pole":
      // Pole mounts require conduit — this is a valid but more expensive path.
      cableReachable = true;
      warnings.push(
        "Pole-mounted camera requires conduit for cable routing — verify conduit path feasibility.",
      );
      suggestions.push(
        "Run conduit along the pole to the nearest wall or ceiling junction for cable routing.",
      );
      break;
    default:
      cableReachable = false;
      warnings.push(
        "Camera is not within reach of a wall or ceiling surface — cable routing is not feasible.",
      );
      suggestions.push(
        "Relocate the camera to within 0.5m of a wall or ceiling surface to enable cable routing.",
      );
      break;
  }

  // ── 7. Overall ────────────────────────────────────────────────────────
  const overallValid =
    mountSurfaceValid &&
    mountHeightValid &&
    angleValid &&
    obstructionClearance &&
    ladderAccessible &&
    cableReachable;

  return {
    mountSurfaceValid,
    mountHeightValid,
    angleValid,
    obstructionClearance,
    ladderAccessible,
    cableReachable,
    overallValid,
    warnings,
    suggestions,
  };
}

/**
 * Validate installability for all cameras in the scene at once.
 */
export function validateAllCameras(scene: SecurityScene): Record<string, InstallabilityResult> {
  const results: Record<string, InstallabilityResult> = {};
  for (const camera of scene.cameras) {
    results[camera.id] = validateCameraInstallability(camera, scene);
  }
  return results;
}
