import type {
  ObjectDetectionAdapter,
  StructuralExtractionAdapter,
  DetectionResult,
  StructuralExtractionResult,
  StructuralElement,
} from "@/lib/scan-adapters/types";
import type { ScanArtifact, ScanCaptureSession, ScanCandidate } from "@/lib/scan-artifacts";
import { createScanCandidateFromArtifact } from "@/lib/scan-artifacts";
import { runVlmPipeline } from "./orchestrator";
import { StubTier1Provider, createModelTier1Provider } from "./tier1-local-gate";
import { StubTier2Provider, createModelTier2Provider } from "./tier2-cloud-pass";
import type { Tier1Provider } from "./tier1-local-gate";
import type { Tier2Provider } from "./tier2-cloud-pass";
import type { ModelProvider } from "@/agents/providers/ModelProvider";

const adapterCounters = { t1: 0, t2: 0 };

export function createVlmObjectDetectionAdapter(provider?: ModelProvider | null): VlmObjectDetectionAdapter {
  return new VlmObjectDetectionAdapter(
    createModelTier1Provider(provider),
    createModelTier2Provider(provider),
  );
}

export function createVlmStructuralExtractionAdapter(provider?: ModelProvider | null): VlmStructuralExtractionAdapter {
  return new VlmStructuralExtractionAdapter(
    createModelTier1Provider(provider),
    createModelTier2Provider(provider),
  );
}

function makeCandidate(
  kind: ScanCandidate["kind"],
  label: string,
  imagePoint: [number, number],
  sourceArtifactId: string,
  confidence: number,
  boundingBox?: [number, number, number, number],
): ScanCandidate {
  const candidate = createScanCandidateFromArtifact(kind, imagePoint, sourceArtifactId, confidence);
  candidate.label = label;
  if (boundingBox) candidate.boundingBox = boundingBox;
  return candidate;
}

// ── VLM-backed Object Detection Adapter ──

export class VlmObjectDetectionAdapter implements ObjectDetectionAdapter {
  id = "vlm-detection";
  name = "VLM Object Detection";
  description = "Uses two-tier VLM pipeline (local gate + cloud pass) for object detection from floor plan / site photos.";

  private tier1Provider: Tier1Provider;
  private tier2Provider: Tier2Provider;

  constructor(tier1Provider?: Tier1Provider, tier2Provider?: Tier2Provider) {
    this.tier1Provider = tier1Provider ?? new StubTier1Provider();
    this.tier2Provider = tier2Provider ?? new StubTier2Provider();
  }

  async detect(
    artifact: ScanArtifact,
    _session: ScanCaptureSession,
  ): Promise<DetectionResult> {
    adapterCounters.t1++;

    if (!artifact.dataUrl) {
      return {
        candidates: [],
        artifacts: [],
        confidence: 0,
        warnings: ["No image data available for VLM detection"],
      };
    }

    const result = await runVlmPipeline(
      artifact.dataUrl,
      artifact.sourceFileName ?? `photo_${adapterCounters.t1}`,
      {
        tier1Provider: this.tier1Provider,
        tier2Provider: this.tier2Provider,
      },
    );

    if (!result.passed || !result.semanticContext.tier2) {
      return {
        candidates: [],
        artifacts: [],
        confidence: 0,
        warnings: result.error ? [result.error] : ["VLM pipeline did not produce Tier 2 output"],
      };
    }

    const tier2 = result.semanticContext.tier2;
    const candidates: ScanCandidate[] = [];

    for (const door of tier2.doors) {
      candidates.push(
        makeCandidate("door", "Door", [
          door.position[0],
          door.position[1],
        ], artifact.id, door.confidence),
      );
    }

    for (const window of tier2.windows) {
      candidates.push(
        makeCandidate("window", "Window", [
          window.position[0],
          window.position[1],
        ], artifact.id, window.confidence),
      );
    }

    for (const obs of tier2.obstructions) {
      const kindMap: Record<string, ScanCandidate["kind"]> = {
        pillar: "pillar",
        counter: "counter",
        cupboard: "cupboard",
        shelf: "shelf",
        furniture: "obstruction",
        other: "obstruction",
      };
      candidates.push(
        makeCandidate(
          kindMap[obs.kind] ?? "obstruction",
          obs.label ?? obs.kind,
          [obs.position[0], obs.position[1]],
          artifact.id,
          obs.confidence,
        ),
      );
    }

    for (const zone of tier2.criticalZones) {
      const centroid = zone.polygon.reduce<[number, number]>(
        ([sx, sy], [px, py]) => [sx + px / zone.polygon.length, sy + py / zone.polygon.length],
        [0, 0],
      );
      candidates.push(
        makeCandidate("critical_zone", zone.label, centroid, artifact.id, zone.confidence),
      );
    }

    return {
      candidates,
      artifacts: [],
      confidence: tier2.confidence,
      warnings: tier2.warnings,
    };
  }
}

// ── VLM-backed Structural Extraction Adapter ──

export class VlmStructuralExtractionAdapter implements StructuralExtractionAdapter {
  id = "vlm-structural";
  name = "VLM Structural Extraction";
  description = "Uses Tier 2 VLM output to produce wall elements, room dimensions, and adjacency.";

  private tier1Provider: Tier1Provider;
  private tier2Provider: Tier2Provider;

  constructor(tier1Provider?: Tier1Provider, tier2Provider?: Tier2Provider) {
    this.tier1Provider = tier1Provider ?? new StubTier1Provider();
    this.tier2Provider = tier2Provider ?? new StubTier2Provider();
  }

  async extractStructures(
    artifacts: ScanArtifact[],
    _session: ScanCaptureSession,
  ): Promise<StructuralExtractionResult> {
    adapterCounters.t2++;

    const photoArtifact = artifacts.find((a) => a.kind === "photo" && a.dataUrl);
    if (!photoArtifact) {
      return {
        elements: [],
        confidence: 0,
        warnings: ["No photo artifact available for structural extraction"],
      };
    }

    const result = await runVlmPipeline(
      photoArtifact.dataUrl!,
      photoArtifact.sourceFileName ?? `struct_${adapterCounters.t2}`,
      {
        tier1Provider: this.tier1Provider,
        tier2Provider: this.tier2Provider,
      },
    );

    if (!result.passed || !result.semanticContext.tier2) {
      return {
        elements: [],
        confidence: 0,
        warnings: result.error ? [result.error] : ["VLM pipeline did not produce Tier 2 output"],
      };
    }

    const tier2 = result.semanticContext.tier2;
    const elements: StructuralElement[] = [];
    const sourceArtifactIds = [photoArtifact.id];

    for (const wall of tier2.walls) {
      elements.push({
        kind: "wall",
        estimatedPosition: [(wall.start[0] + wall.end[0]) / 2, 0, (wall.start[1] + wall.end[1]) / 2],
        estimatedDimensions: [
          Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]),
          3,
          0.18,
        ],
        confidence: wall.confidence ?? 0.5,
        sourceArtifactIds,
      });
    }

    for (const door of tier2.doors) {
      elements.push({
        kind: "door",
        imagePoint: [door.position[0], door.position[1]],
        confidence: door.confidence,
        sourceArtifactIds,
      });
    }

    for (const window of tier2.windows) {
      elements.push({
        kind: "window",
        imagePoint: [window.position[0], window.position[1]],
        confidence: window.confidence,
        sourceArtifactIds,
      });
    }

    const avgConfidence =
      elements.length > 0
        ? elements.reduce((s, e) => s + e.confidence, 0) / elements.length
        : 0;

    return {
      elements,
      confidence: Math.round(avgConfidence * 100) / 100,
      warnings: tier2.warnings,
    };
  }
}
