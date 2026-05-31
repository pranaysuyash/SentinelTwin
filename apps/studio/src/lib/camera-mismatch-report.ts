import type { CameraEvidenceArtifact, CameraNode, MismatchReport, SceneUpdateSuggestion } from "@/schema/security-scene";

export function generateMismatchReport(
  camera: CameraNode,
  evidence: CameraEvidenceArtifact,
  alignmentScore: number
): MismatchReport | null {
  const bindingAlignmentScore = typeof evidence.binding?.transformConfidence === "number"
    ? evidence.binding.transformConfidence * 100
    : null;
  const effectiveAlignmentScore = bindingAlignmentScore ?? alignmentScore;

  if (effectiveAlignmentScore > 90) return null;

  const mismatchTypes: MismatchReport["mismatchTypes"] = [];
  const suggestions: SceneUpdateSuggestion[] = [];

  if (effectiveAlignmentScore < 50) {
    mismatchTypes.push("angle");
    suggestions.push({
      id: `sugg_yaw_${Date.now()}`,
      type: "adjust_yaw",
      cameraId: camera.id,
      description: "Adjust camera yaw to match the reference frame.",
      reviewStatus: "unreviewed",
    });
  }

  if (effectiveAlignmentScore >= 50 && effectiveAlignmentScore < 80) {
    mismatchTypes.push("fov");
    suggestions.push({
      id: `sugg_fov_${Date.now()}`,
      type: "adjust_fov",
      cameraId: camera.id,
      description: "Adjust camera FOV to match the reference frame zoom level.",
      reviewStatus: "unreviewed",
    });
  }

  const severity = effectiveAlignmentScore < 30 ? "critical" : effectiveAlignmentScore < 60 ? "high" : effectiveAlignmentScore < 80 ? "medium" : "low";

  return {
    id: `mismatch_${Date.now()}`,
    cameraId: camera.id,
    evidenceId: evidence.id,
    severity,
    mismatchTypes,
    description: `Alignment score is ${Math.round(effectiveAlignmentScore)}%. Mismatches detected.`,
    suggestions,
  };
}
