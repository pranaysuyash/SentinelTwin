import type { ScaleAnchoringAdapter, ScaleAnchor, DepthEstimate } from "@/lib/scan-adapters/types";
import type { ScanArtifact, ScanCaptureSession } from "@/lib/scan-artifacts";

const ANCHOR_PRIORS: Array<{ label: string; valueM: number; matchLabels: string[] }> = [
  { label: "Standard door width", valueM: 0.9, matchLabels: ["door", "entry", "entrance"] },
  { label: "Standard counter height", valueM: 1.1, matchLabels: ["counter", "desk", "table"] },
  { label: "Standard shelf height", valueM: 1.8, matchLabels: ["shelf", "rack", "display"] },
  { label: "Standard ceiling height", valueM: 3.0, matchLabels: ["ceiling"] },
  { label: "Standard person height", valueM: 1.75, matchLabels: ["person", "human", "staff"] },
];

export class StubScaleAnchoringAdapter implements ScaleAnchoringAdapter {
  id = "stub-scale-anchoring";
  name = "Stub Scale Anchoring";
  description = "Suggests scale anchors based on candidate types and photo context.";

  async suggestAnchors(
    artifact: ScanArtifact,
    session: ScanCaptureSession,
  ): Promise<ScaleAnchor[]> {
    const candidates = session.candidates.filter(
      (c) => c.sourceArtifactIds.includes(artifact.id),
    );

    const anchors: ScaleAnchor[] = [];

    for (const prior of ANCHOR_PRIORS) {
      const match = candidates.some((c) =>
        prior.matchLabels.some((label) => c.label.toLowerCase().includes(label)),
      );
      if (match) {
        anchors.push({
          label: prior.label,
          valueM: prior.valueM,
          source: "estimated",
          confidence: 0.65,
          sourceArtifactId: artifact.id,
        });
        if (anchors.length >= 2) break;
      }
    }

    if (session.knownMeasurements.length > 0) {
      for (const m of session.knownMeasurements) {
        anchors.push({
          label: m.label,
          valueM: m.valueM,
          source: m.source === "user" ? "user" : "estimated",
          confidence: m.source === "user" ? 0.9 : 0.6,
          sourceArtifactId: artifact.id,
        });
      }
    }

    return anchors;
  }

  async refineWithAnchor(
    depth: DepthEstimate,
    anchor: ScaleAnchor,
  ): Promise<{ adjustedDepth: DepthEstimate; scalingFactor: number }> {
    const scalingFactor = anchor.valueM > 0
      ? Math.round((1 / anchor.valueM) * 100) / 100
      : 1;

    const adjustedDepth: DepthEstimate = {
      ...depth,
      depthMinM: Math.round(depth.depthMinM * scalingFactor * 100) / 100,
      depthMaxM: Math.round(depth.depthMaxM * scalingFactor * 100) / 100,
    };

    return { adjustedDepth, scalingFactor };
  }
}
