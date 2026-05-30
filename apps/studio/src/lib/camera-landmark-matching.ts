import type { CameraEvidenceArtifact, CameraNode } from "@/schema/security-scene";

export type LandmarkMatch = NonNullable<CameraEvidenceArtifact["binding"]>["landmarkMatches"][number];

export function computeLandmarkAlignmentConfidence(
  camera: CameraNode,
  matches: LandmarkMatch[]
): number {
  if (!matches || matches.length < 3) {
    return 0;
  }

  const baseConfidence = Math.min(0.9, matches.length * 0.15);

  return baseConfidence;
}
