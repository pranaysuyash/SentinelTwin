import type { ObstructionNode, SecurityIssue } from "@/schema/security-scene";

export const DEFAULT_SCENE_DIMENSION_FLOOR = 0.5;

export type SceneDimensions = {
  width: number;
  depth: number;
};

export type PointerMouseEvent = {
  nativeEvent: {
    button?: number;
  };
};

export function isPrimaryMouseEvent(event: PointerMouseEvent): boolean {
  return event.nativeEvent.button === 0;
}

/** Minimum drag distance (meters) before a camera placement drag counts as aiming. */
export const AIM_DRAG_THRESHOLD_M = 0.25;

/** Default camera yaw used when a camera is placed with a plain click (matches the factory default). */
export const DEFAULT_PLACEMENT_YAW_DEG = 180;

/**
 * Yaw (degrees, 0–359) that points a camera from `anchor` toward `target`
 * on the floor plane, matching the engine convention in
 * `getYawPitchDirection` (yaw 0 faces -Z, 90 faces +X).
 */
export function computeAimYawDeg(anchor: [number, number], target: [number, number]): number {
  const dx = target[0] - anchor[0];
  const dz = target[1] - anchor[1];
  if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return DEFAULT_PLACEMENT_YAW_DEG;
  const yaw = Math.atan2(dx, -dz) * (180 / Math.PI);
  return Math.round(((yaw % 360) + 360) % 360) % 360;
}

export function sanitizeSceneDimensions(width: number, depth: number, fallback: number = DEFAULT_SCENE_DIMENSION_FLOOR): [number, number] {
  const safeWidth = Number.isFinite(width) ? width : fallback;
  const safeDepth = Number.isFinite(depth) ? depth : fallback;
  return [Math.max(safeWidth, fallback), Math.max(safeDepth, fallback)];
}

function normalizeObstructionLabel(value: string): string {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function findObstructionForBlindspotIssue(issue: SecurityIssue, obstructions: ObstructionNode[]) {
  const description = normalizeObstructionLabel(issue.description ?? "");
  const labelByPrefix = (() => {
    const isPhraseMatch = description.match(/^\s*(.+?)\s+is\s+obstructing\b/i)?.[1];
    if (isPhraseMatch) return isPhraseMatch;
    const verbPhraseMatch = description.match(/^\s*(.+?)\s+(?:is\s+)?(?:blocks|blocking|obstructed|obstructing|occluding)\b/i)?.[1];
    if (verbPhraseMatch) return verbPhraseMatch;
    return description.match(/^\s*(?:obstruction|obstacle)\s*:\s*(.+?)(?:\s+(?:near|by|on|at)\s+.*)?$/i)?.[1];
  })() ?? "";
  const normalizedByPrefix = normalizeObstructionLabel(labelByPrefix);

  const directMatch = normalizedByPrefix && normalizedByPrefix.length > 2
    ? obstructions.find((obstruction) => normalizeObstructionLabel(obstruction.label) === normalizedByPrefix) ?? null
    : null;
  if (directMatch) return directMatch;

  const fuzzyMatch = normalizedByPrefix.length > 0 ? obstructions.find((obstruction) => {
    const normalizedObstruction = normalizeObstructionLabel(obstruction.label);
    return normalizedObstruction && (
      description.includes(normalizedObstruction)
      || (normalizedByPrefix.length > 2 && normalizedObstruction.includes(normalizedByPrefix))
    );
  }) ?? null : null;
  if (fuzzyMatch) return fuzzyMatch;

  const fallback = normalizedByPrefix.length > 2
    ? obstructions.find((obstruction) => {
      const normalizedObstruction = normalizeObstructionLabel(obstruction.label);
      const normalizedObstructionTokens = normalizedObstruction.split(" ");
      const hasSharedToken = normalizedObstructionTokens.some((token) => token.length > 2 && normalizedByPrefix.includes(token));
      return hasSharedToken;
    }) ?? null
    : null;

  return fallback;
}
