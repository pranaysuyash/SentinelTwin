import type { SegmentationAdapter, SegmentationResult } from "@/lib/scan-adapters/types";
import type { ScanArtifact, ScanCaptureSession } from "@/lib/scan-artifacts";

let segCounter = 0;

function normalizedPoint(
  point: [number, number],
  widthPx: number,
  heightPx: number,
): [number, number, number, number] {
  const cx = point[0] * widthPx;
  const cy = point[1] * heightPx;
  const size = Math.min(widthPx, heightPx) * 0.15;
  return [
    Math.max(0, cx - size / 2),
    Math.max(0, cy - size / 2),
    Math.min(widthPx, cx + size / 2),
    Math.min(heightPx, cy + size / 2),
  ];
}

export class StubSegmentationAdapter implements SegmentationAdapter {
  id = "stub-segmentation";
  name = "Stub Segmentation";
  description = "Produces plausible segmentation masks from point, box, or text prompts. No real ML backend.";

  async segment(
    artifact: ScanArtifact,
    point: [number, number],
  ): Promise<SegmentationResult> {
    segCounter += 1;

    const widthPx = "widthPx" in artifact && typeof (artifact as any).widthPx === "number"
      ? (artifact as any).widthPx
      : 640;
    const heightPx = "heightPx" in artifact && typeof (artifact as any).heightPx === "number"
      ? (artifact as any).heightPx
      : 480;

    const box = normalizedPoint(point, widthPx, heightPx);

    return {
      maskArtifact: {
        id: `mask_seg_${segCounter}`,
        kind: "mask",
        sourceFileName: artifact.sourceFileName,
        linkedCandidateIds: [],
        capturedAt: artifact.capturedAt,
        modelId: this.id,
        classLabel: "segmented_object",
        classConfidence: 0.65 + Math.random() * 0.2,
      },
      boundingBox: box,
      confidence: 0.65 + Math.random() * 0.2,
    };
  }

  async segmentBox(
    artifact: ScanArtifact,
    box: [number, number, number, number],
  ): Promise<SegmentationResult> {
    segCounter += 1;

    return {
      maskArtifact: {
        id: `mask_segbox_${segCounter}`,
        kind: "mask",
        sourceFileName: artifact.sourceFileName,
        linkedCandidateIds: [],
        capturedAt: artifact.capturedAt,
        modelId: this.id,
        classLabel: "box_segmented",
        classConfidence: 0.7,
      },
      boundingBox: box,
      confidence: 0.7,
    };
  }

  async segmentPrompt(
    artifact: ScanArtifact,
    textPrompt: string,
  ): Promise<SegmentationResult> {
    segCounter += 1;

    const promptLower = textPrompt.toLowerCase();
    let classLabel = "unknown";
    let confidence = 0.5;

    if (promptLower.includes("camera") || promptLower.includes("cam")) {
      classLabel = "camera";
      confidence = 0.6;
    } else if (promptLower.includes("door")) {
      classLabel = "door";
      confidence = 0.65;
    } else if (promptLower.includes("window")) {
      classLabel = "window";
      confidence = 0.6;
    } else if (promptLower.includes("counter") || promptLower.includes("desk")) {
      classLabel = "counter";
      confidence = 0.55;
    } else if (promptLower.includes("shelf") || promptLower.includes("rack")) {
      classLabel = "shelf";
      confidence = 0.5;
    } else if (promptLower.includes("person") || promptLower.includes("human")) {
      classLabel = "person";
      confidence = 0.7;
    }

    const widthPx = "widthPx" in artifact && typeof (artifact as any).widthPx === "number"
      ? (artifact as any).widthPx
      : 640;
    const heightPx = "heightPx" in artifact && typeof (artifact as any).heightPx === "number"
      ? (artifact as any).heightPx
      : 480;

    const box: [number, number, number, number] = [
      widthPx * 0.2,
      heightPx * 0.2,
      widthPx * 0.6,
      heightPx * 0.7,
    ];

    return {
      maskArtifact: {
        id: `mask_prompt_${segCounter}`,
        kind: "mask",
        sourceFileName: artifact.sourceFileName,
        linkedCandidateIds: [],
        capturedAt: artifact.capturedAt,
        modelId: this.id,
        classLabel,
        classConfidence: confidence,
      },
      boundingBox: box,
      confidence,
    };
  }
}
