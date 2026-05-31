import { safeParseSecurityScene, type SecurityScene } from "@/schema/security-scene";
import { bakeoffToSecurityScene } from "@/lib/bakeoff-bridge";
import type { BakeoffPrediction } from "@/lib/bakeoff-bridge";

type ImportSceneDraftResult =
  | { success: true; scene: SecurityScene; source: "json" }
  | { success: false; error: string };

function isBakeoffLikeScene(input: unknown): input is BakeoffPrediction {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Record<string, unknown>;
  return (
    typeof candidate.image_id === "string"
    && Array.isArray(candidate.walls)
    && Array.isArray(candidate.doors)
    && Array.isArray(candidate.windows)
    && Array.isArray(candidate.obstructions)
    && Array.isArray(candidate.critical_zones)
  );
}

export function parseImportSceneDraft(input: unknown): ImportSceneDraftResult {
  if (isBakeoffLikeScene(input)) {
    const scene = bakeoffToSecurityScene(input, { knownDimensionM: 8, axisHint: "width" }, input.image_id);
    return { success: true, scene, source: "json" };
  }

  const parsed = safeParseSecurityScene(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Scene import failed validation",
    };
  }
  return { success: true, scene: parsed.data, source: "json" };
}
