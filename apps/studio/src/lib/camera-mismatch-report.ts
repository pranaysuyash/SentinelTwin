import type { CameraEvidenceArtifact, CameraNode, MismatchReport, SceneUpdateSuggestion } from "@/schema/security-scene";

export function generateMismatchReport(
  camera: CameraNode,
  evidence: CameraEvidenceArtifact,
  alignmentScore: number
): MismatchReport | null {
  if (alignmentScore > 90) return null;

  const mismatchTypes: MismatchReport["mismatchTypes"] = [];
  const suggestions: SceneUpdateSuggestion[] = [];

  if (alignmentScore < 50) {
    mismatchTypes.push("angle");
    suggestions.push({
      id: `sugg_yaw_${Date.now()}`,
      type: "adjust_yaw",
      cameraId: camera.id,
      description: "Adjust camera yaw to match the reference frame.",
      reviewStatus: "unreviewed",
    });
  }

  if (alignmentScore >= 50 && alignmentScore < 80) {
    mismatchTypes.push("fov");
    suggestions.push({
      id: `sugg_fov_${Date.now()}`,
      type: "adjust_fov",
      cameraId: camera.id,
      description: "Adjust camera FOV to match the reference frame zoom level.",
      reviewStatus: "unreviewed",
    });
  }

  const severity = alignmentScore < 30 ? "critical" : alignmentScore < 60 ? "high" : alignmentScore < 80 ? "medium" : "low";

  return {
    id: `mismatch_${Date.now()}`,
    cameraId: camera.id,
    evidenceId: evidence.id,
    severity,
    mismatchTypes,
    description: `Alignment score is ${Math.round(alignmentScore)}%. Mismatches detected.`,
    suggestions,
  };
}
