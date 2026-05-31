import type {
  SceneInputHash,
  SecurityScene,
} from "@sentineltwin/core";

// Simplified digest for deterministic stability comparison.
// In production, replace with actual crypto.subtle.digest("SHA-256", ...).
// This approach is deterministic, fast, and sufficient for stale-result prevention.

/**
 * Deterministically serialize the canonical scene inputs into a stable string.
 *
 * Only geometry + assumptions that affect simulation output are included:
 * - walls (position, dimensions, material, visionTransmission)
 * - doors (position, dimensions, state)
 * - windows (position, dimensions, state, visionTransmission)
 * - cameras (position, orientation, FOV, range, resolution, status, nightMode, clarity)
 * - securityLights (position, status, brightness, range, coneDeg, yawDeg, pitchDeg)
 * - obstructions (position, rotation, dimensions, material, visionTransmission)
 * - criticalZones (polygon, height, requiredQuality, targetType, nightRequired)
 * - privacyZones (polygon, restriction)
 * - assumptions (all fields)
 * - timeSchedule (if present)
 */
export function serializeSceneInputs(scene: Pick<SecurityScene, "walls" | "doors" | "windows" | "cameras" | "securityLights" | "obstructions" | "criticalZones" | "privacyZones" | "assumptions" | "timeSchedule">): string {
  const parts: string[] = [];

  parts.push("walls");
  for (const w of scene.walls) {
    parts.push(`${w.start[0]},${w.start[1]},${w.end[0]},${w.end[1]},${w.heightM},${w.thicknessM},${w.material},${w.visionTransmission}`);
  }

  parts.push("doors");
  for (const d of scene.doors) {
    parts.push(`${d.position[0]},${d.position[1]},${d.position[2]},${d.dimensions[0]},${d.dimensions[1]},${d.dimensions[2]},${d.state}`);
  }

  parts.push("windows");
  for (const w of scene.windows) {
    parts.push(`${w.position[0]},${w.position[1]},${w.position[2]},${w.dimensions[0]},${w.dimensions[1]},${w.dimensions[2]},${w.state},${w.visionTransmission}`);
  }

  parts.push("cameras");
  for (const c of scene.cameras) {
    parts.push(`${c.id},${c.position[0]},${c.position[1]},${c.position[2]},${c.yawDeg},${c.pitchDeg},${c.rollDeg},${c.fovHorizontalDeg},${c.fovVerticalDeg},${c.rangeM},${c.resolutionMP},${c.mountType},${c.status},${c.nightMode},${c.irRangeM},${c.clarity},${c.lensType}`);
  }

  parts.push("lights");
  for (const l of scene.securityLights) {
    parts.push(`${l.position[0]},${l.position[1]},${l.position[2]},${l.status},${l.brightness},${l.rangeM},${l.coneDeg ?? 360},${l.yawDeg ?? 0},${l.pitchDeg ?? 0},${l.emergencyPower}`);
  }

  parts.push("obstructions");
  for (const o of scene.obstructions) {
    parts.push(`${o.position[0]},${o.position[1]},${o.position[2]},${o.rotationYDeg},${o.dimensions[0]},${o.dimensions[1]},${o.dimensions[2]},${o.material},${o.visionTransmission},${o.glareRisk},${o.movable}`);
  }

  parts.push("zones");
  for (const z of scene.criticalZones) {
    const polyStr = z.polygon.map(p => `${p[0]}:${p[1]}`).join("|");
    parts.push(`${polyStr},${z.heightM},${z.requiredQuality},${z.targetType},${z.nightRequired},${z.redundancyRequired},${z.priority}`);
  }

  parts.push("privacy");
  for (const p of scene.privacyZones) {
    const polyStr = p.polygon.map(pt => `${pt[0]}:${pt[1]}`).join("|");
    parts.push(`${polyStr},${p.restriction}`);
  }

  parts.push("assumptions");
  const a = scene.assumptions;
  parts.push(`${a.wallHeightM},${a.personHeightM},${a.vehicleHeightM},${a.timeOfDay},${a.exteriorLightLux ?? ""},${a.interiorLightLevel},${a.nightPenaltyMode},${a.doriStandard},${a.pixelsPerMeter.detection},${a.pixelsPerMeter.observation},${a.pixelsPerMeter.recognition},${a.pixelsPerMeter.identification},${a.backlightIntensity},${a.glareIntensity},${a.overexposedZones},${a.sceneComplexity},${a.operatorExperience},${a.taskCriticality}`);

  if (scene.timeSchedule) {
    parts.push("timeSchedule");
    const ts = scene.timeSchedule;
    if (ts.location) {
      parts.push(`${ts.location.latitude},${ts.location.longitude},${ts.location.timezone}`);
    }
  }

  return parts.join("|");
}

/**
 * Compute a deterministic scene hash for stale-result prevention.
 *
 * This is NOT a cryptographic hash — it is a fast deterministic string
 * that changes when any simulation-relevant input changes.
 *
 * In production, wrap with crypto.subtle.digest("SHA-256", ...) or
 * use a stable string hash for cache key generation.
 */
export function computeSceneHash(scene: Pick<SecurityScene, "walls" | "doors" | "windows" | "cameras" | "securityLights" | "obstructions" | "criticalZones" | "privacyZones" | "assumptions" | "timeSchedule">): string {
  const serialized = serializeSceneInputs(scene);

  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }

  return Math.abs(hash).toString(36).padStart(8, "0") + "-" + serialized.length.toString(36);
}

/**
 * Compute a full SceneInputHash record.
 */
export function computeSceneInputHash(scene: Pick<SecurityScene, "walls" | "doors" | "windows" | "cameras" | "securityLights" | "obstructions" | "criticalZones" | "privacyZones" | "assumptions" | "timeSchedule">): SceneInputHash {
  return {
    hash: computeSceneHash(scene),
    includeFields: [
      "walls",
      "doors",
      "windows",
      "cameras",
      "securityLights",
      "obstructions",
      "criticalZones",
      "privacyZones",
      "assumptions",
      "timeSchedule",
    ],
    algo: "v1",
    computedAt: Date.now(),
  };
}

/**
 * Check whether two scene hashes match — for stale-result detection.
 */
export function isSceneHashMatch(a: string, b: string): boolean {
  const aKey = a.split("-")[0];
  const bKey = b.split("-")[0];
  return aKey === bKey;
}
