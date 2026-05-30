import type { DepthEstimationAdapter, DepthEstimate } from "@/lib/scan-adapters/types";
import type { ScanArtifact, ScanCaptureSession } from "@/lib/scan-artifacts";

const ROLE_DEPTH_PROFILES: Record<string, { minM: number; maxM: number; confidence: number }> = {
  overview: { minM: 0.5, maxM: 12, confidence: 0.55 },
  front_wall: { minM: 0.3, maxM: 10, confidence: 0.6 },
  right_wall: { minM: 0.3, maxM: 8, confidence: 0.55 },
  left_wall: { minM: 0.3, maxM: 8, confidence: 0.55 },
  rear_wall: { minM: 0.3, maxM: 10, confidence: 0.6 },
  critical_zones: { minM: 0.2, maxM: 4, confidence: 0.7 },
  existing_cameras: { minM: 0.5, maxM: 6, confidence: 0.5 },
  entry_points: { minM: 0.2, maxM: 5, confidence: 0.65 },
};

const DEFAULT_DEPTH: { minM: number; maxM: number; confidence: number } = {
  minM: 0.3, maxM: 8, confidence: 0.4,
};

let stubCounter = 0;

export class StubDepthEstimationAdapter implements DepthEstimationAdapter {
  id = "stub-depth-estimation";
  name = "Stub Depth Estimation";
  description = "Produces plausible depth ranges from photo role hints. No real ML backend.";

  async estimateDepth(artifact: ScanArtifact): Promise<DepthEstimate> {
    stubCounter += 1;

    if (artifact.kind !== "photo") {
      return {
        depthArtifact: {
          id: `depth_${stubCounter}`,
          kind: "depth_map",
          linkedCandidateIds: [],
          depthMinM: 0.5,
          depthMaxM: 10,
          modelId: this.id,
        },
        depthMinM: 0.5,
        depthMaxM: 10,
        modelUsed: this.id,
      };
    }

    const role = "role" in artifact ? (artifact as any).role as string | undefined : undefined;
    const profile = role && role in ROLE_DEPTH_PROFILES
      ? ROLE_DEPTH_PROFILES[role]
      : DEFAULT_DEPTH;

    const jitter = (v: number) => Math.round((v + (Math.random() - 0.5) * v * 0.1) * 100) / 100;
    const depthMinM = Math.max(0.1, jitter(profile.minM));
    const depthMaxM = Math.max(depthMinM + 0.5, jitter(profile.maxM));

    return {
      depthArtifact: {
        id: `depth_${stubCounter}`,
        kind: "depth_map",
        sourceFileName: artifact.sourceFileName,
        linkedCandidateIds: [],
        capturedAt: artifact.capturedAt,
        depthMinM,
        depthMaxM,
        modelId: this.id,
        confidence: profile.confidence,
      },
      depthMinM,
      depthMaxM,
      modelUsed: this.id,
    };
  }
}
