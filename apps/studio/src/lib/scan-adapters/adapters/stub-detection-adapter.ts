import type { ObjectDetectionAdapter, DetectionResult } from "@/lib/scan-adapters/types";
import type { PhotoArtifact, ScanArtifact, ScanCandidate, ScanCaptureSession, ScanCandidateKind } from "@/lib/scan-artifacts";
import { createScanCandidateFromArtifact, addCandidateWarning } from "@/lib/scan-artifacts";
import { getStubProfileForRole, addJitter } from "@/lib/scan-adapters/adapters/stub-profiles";

export class StubObjectDetectionAdapter implements ObjectDetectionAdapter {
  id = "stub-object-detection";
  name = "Stub Object Detection";
  description = "Produces plausible candidates from photo metadata and role hints. No real ML backend.";

  async detect(
    artifact: ScanArtifact,
    session: ScanCaptureSession,
  ): Promise<DetectionResult> {
    const candidates: ScanCandidate[] = [];
    const warnings: string[] = [];

    if (artifact.kind !== "photo") {
      return { candidates, artifacts: [], confidence: 0, warnings: ["Only photo artifacts are supported"] };
    }

    const role = "role" in artifact ? (artifact as unknown as PhotoArtifact).role : undefined;
    const profile = getStubProfileForRole(role);

    for (const obj of profile.dominantObjects) {
      const jitteredConf = Math.min(0.95, Math.max(0.15, obj.confidence + (Math.random() - 0.5) * 0.15));
      const jitteredPos: [number, number] = [
        addJitter(obj.positionHint[0], 0.08),
        addJitter(obj.positionHint[1], 0.08),
      ];

      let candidate = createScanCandidateFromArtifact(
        obj.kind as ScanCandidateKind,
        jitteredPos,
        artifact.id,
        Math.round(jitteredConf * 100) / 100,
        "model_detection",
      );

      if (jitteredConf < 0.4) {
        candidate = addCandidateWarning(candidate, {
          code: "LOW_CONFIDENCE",
          message: `Low confidence detection (${Math.round(jitteredConf * 100)}%). Review before accepting.`,
          severity: "warning",
        });
      }

      candidates.push(candidate);
    }

    const avgConfidence = candidates.length > 0
      ? Math.round((candidates.reduce((s, c) => s + c.confidence, 0) / candidates.length) * 100) / 100
      : 0;

    if (candidates.length === 0) {
      warnings.push("No objects detected in this photo.");
    }

    return {
      candidates,
      artifacts: [],
      confidence: avgConfidence,
      warnings,
    };
  }
}
