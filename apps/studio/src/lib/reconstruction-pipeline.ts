import type {
  ReconstructionSession,
  ReconstructionPipelineConfig,
  ReconstructionStage,
  StageResult,
  CapturePhoto,
  RoomMeasurement,
  ExtractedElement,
} from "@/schema/reconstruction-pipeline";
import {
  RECONSTRUCTION_STAGE_LABELS,
  createDefaultPipelineConfig,
  createCapturePhoto,
} from "@/schema/reconstruction-pipeline";
import type { SecurityScene } from "@/schema/security-scene";
import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { cloneSecurityScene, safeParseSecurityScene } from "@/schema/security-scene";

export type PipelineCallback = (stage: ReconstructionStage, result: StageResult, session: ReconstructionSession) => void;

function generateId(): string {
  return `recon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function now(): number {
  return Date.now();
}

function makeStageResult(stage: ReconstructionStage, status: StageResult["status"], overrides?: Partial<StageResult>): StageResult {
  return {
    stage,
    status,
    durationMs: overrides?.durationMs ?? 0,
    error: overrides?.error,
    extractedElements: overrides?.extractedElements ?? [],
    outputData: overrides?.outputData ?? {},
    confidence: overrides?.confidence,
  };
}

async function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ReconstructionPipeline {
  private config: ReconstructionPipelineConfig;
  private session: ReconstructionSession;
  private callbacks: PipelineCallback[] = [];
  private aborted = false;

  constructor(
    photos: CapturePhoto[],
    measurements: RoomMeasurement,
    config?: Partial<ReconstructionPipelineConfig>,
  ) {
    this.config = { ...createDefaultPipelineConfig(), ...config };
    this.session = {
      id: generateId(),
      startedAt: now(),
      photos,
      measurements,
      stageResults: [],
      fallbackTriggered: false,
      errors: [],
    };
  }

  onStage(callback: PipelineCallback): void {
    this.callbacks.push(callback);
  }

  abort(): void {
    this.aborted = true;
  }

  getSession(): ReconstructionSession {
    return { ...this.session, stageResults: [...this.session.stageResults] };
  }

  addPhoto(photo: CapturePhoto): void {
    this.session.photos = [...this.session.photos, photo];
  }

  async run(): Promise<ReconstructionSession> {
    this.aborted = false;
    this.session.startedAt = now();

    const stages: Array<{ stage: ReconstructionStage; enabled: boolean; runner: () => Promise<StageResult> }> = [
      {
        stage: "capture",
        enabled: true,
        runner: () => this.runCaptureStage(),
      },
      {
        stage: "depth_estimation",
        enabled: this.config.enableDepthEstimation,
        runner: () => this.runDepthEstimation(),
      },
      {
        stage: "segmentation",
        enabled: this.config.enableSegmentation,
        runner: () => this.runSegmentation(),
      },
      {
        stage: "correspondence",
        enabled: this.config.enableCorrespondence,
        runner: () => this.runCorrespondence(),
      },
      {
        stage: "structural_extraction",
        enabled: this.config.enableStructuralExtraction,
        runner: () => this.runStructuralExtraction(),
      },
      {
        stage: "scale_anchoring",
        enabled: true,
        runner: () => this.runScaleAnchoring(),
      },
      {
        stage: "quality_gate",
        enabled: true,
        runner: () => this.runQualityGate(),
      },
      {
        stage: "compile",
        enabled: true,
        runner: () => this.runCompile(),
      },
    ];

    for (const { stage, enabled, runner } of stages) {
      if (this.aborted) break;

      const startedAt = performance.now();

      if (!enabled) {
        const skipResult = makeStageResult(stage, "skipped", {
          durationMs: 0,
          confidence: undefined,
          outputData: { note: `Stage ${stage} is disabled in pipeline config.` },
        });
        this.session.stageResults = [...this.session.stageResults, skipResult];
        this.notifyCallbacks(stage, skipResult);
        continue;
      }

      try {
        const result = await runner();
        const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
        const timedResult: StageResult = { ...result, durationMs };
        this.session.stageResults = [...this.session.stageResults, timedResult];
        this.notifyCallbacks(stage, timedResult);

        if (result.status === "failed") {
          this.session.errors = [...this.session.errors, ...(result.error ? [result.error] : [])];
          if (stage !== "quality_gate" && stage !== "compile") {
            this.session.fallbackTriggered = true;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown pipeline error";
        const failResult = makeStageResult(stage, "failed", {
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          error: errorMessage,
        });
        this.session.stageResults = [...this.session.stageResults, failResult];
        this.session.errors = [...this.session.errors, errorMessage];
        this.session.fallbackTriggered = true;
        this.notifyCallbacks(stage, failResult);
      }
    }

    this.session.completedAt = now();
    return { ...this.session, stageResults: [...this.session.stageResults] };
  }

  private notifyCallbacks(stage: ReconstructionStage, result: StageResult): void {
    for (const cb of this.callbacks) {
      try {
        cb(stage, result, this.getSession());
      } catch {
        // swallow callback errors
      }
    }
  }

  private async runCaptureStage(): Promise<StageResult> {
    const photos = this.session.photos;
    if (photos.length === 0) {
      return makeStageResult("capture", "failed", { error: "No photos captured." });
    }

    const elements: ExtractedElement[] = photos.map((photo, index) => ({
      id: `capture_${photo.id}`,
      elementType: "obstruction" as const,
      confidence: 0.95,
      sourceTrace: `photo:${photo.fileName}`,
      labels: [`Photo ${index + 1}: ${photo.fileName}`],
      correctionApplied: false,
    }));

    const depthHint = this.session.measurements.estimatedHeightM ?? 3;

    return makeStageResult("capture", "completed", {
      extractedElements: elements,
      confidence: 0.95,
      outputData: {
        photoCount: photos.length,
        dimensions: {
          estimatedHeightM: depthHint,
        },
      },
    });
  }

  private async runDepthEstimation(): Promise<StageResult> {
    await delayMs(50);

    const photoCount = this.session.photos.length;
    if (photoCount === 0) {
      return makeStageResult("depth_estimation", "skipped", {
        outputData: { note: "Depth estimation requires at least one photo." },
      });
    }

    const meanConfidence = 0.65;

    return makeStageResult("depth_estimation", "completed", {
      confidence: meanConfidence,
      outputData: {
        depthMaps: this.session.photos.map((photo) => ({
          photoId: photo.id,
          confidence: meanConfidence,
          estimatedDimensions: {
            width: this.session.measurements.estimatedWidthM ?? 10,
            depth: this.session.measurements.estimatedDepthM ?? 8,
            height: this.session.measurements.estimatedHeightM ?? 3,
          },
        })),
        integrationNote: "Depth estimation provides monocular priors only. Scale anchoring required.",
      },
      extractedElements: [],
    });
  }

  private async runSegmentation(): Promise<StageResult> {
    await delayMs(50);

    const elements: ExtractedElement[] = [];
    for (const photo of this.session.photos) {
      elements.push({
        id: `seg_wall_${photo.id}`,
        elementType: "wall" as const,
        confidence: 0.55,
        sourceTrace: `segmentation:${photo.id}`,
        labels: ["wall surface", "inferred"],
        correctionApplied: false,
      });
      elements.push({
        id: `seg_floor_${photo.id}`,
        elementType: "obstruction" as const,
        confidence: 0.60,
        sourceTrace: `segmentation:${photo.id}`,
        labels: ["floor plane", "inferred"],
        correctionApplied: false,
      });
    }

    return makeStageResult("segmentation", "completed", {
      extractedElements: elements,
      confidence: 0.55,
      outputData: {
        segmentCount: elements.length,
        integrationNote: "Segmentation provides candidate regions. Structural extraction needed for final geometry.",
      },
    });
  }

  private async runCorrespondence(): Promise<StageResult> {
    const photoCount = this.session.photos.length;
    if (photoCount < 2) {
      return makeStageResult("correspondence", "skipped", {
        confidence: undefined,
        outputData: { note: "Multi-photo correspondence requires at least 2 photos." },
      });
    }

    await delayMs(50);

    return makeStageResult("correspondence", "completed", {
      confidence: 0.50,
      outputData: {
        pairwiseMatches: photoCount - 1,
        estimatedCameraPoses: this.session.photos.map((photo) => ({
          photoId: photo.id,
          confidence: 0.50,
        })),
        integrationNote: "Correspondence provides sparse point cloud. VGGT integration would improve density and accuracy.",
      },
      extractedElements: [],
    });
  }

  private async runStructuralExtraction(): Promise<StageResult> {
    await delayMs(50);

    const elements: ExtractedElement[] = [];
    const wallCount = 4;
    for (let i = 0; i < wallCount; i++) {
      elements.push({
        id: `struct_wall_${i}`,
        elementType: "wall" as const,
        confidence: 0.45,
        sourceTrace: `structural_extraction:inferred_wall_${i}`,
        labels: ["inferred", "needs review"],
        correctionApplied: false,
      });
    }

    elements.push({
      id: `struct_entry`,
      elementType: "entry_point" as const,
      confidence: 0.40,
      sourceTrace: "structural_extraction:inferred_entry",
      labels: ["inferred", "needs review"],
      correctionApplied: false,
    });

    return makeStageResult("structural_extraction", "completed", {
      extractedElements: elements,
      confidence: 0.45,
      outputData: {
        wallCount,
        integrationNote: "Structural extraction is a best-effort inference. Manual correction expected for production use.",
      },
    });
  }

  private async runScaleAnchoring(): Promise<StageResult> {
    const measurements = this.session.measurements;
    const knownWidth = measurements.knownWidthM;
    const knownDepth = measurements.knownDepthM;
    const knownHeight = measurements.estimatedHeightM ?? 3;

    const scaleSources: string[] = [];
    if (measurements.knownReferenceLabel) {
      scaleSources.push(`reference:${measurements.knownReferenceLabel}`);
    }
    if (knownWidth) scaleSources.push("known-width");
    if (knownDepth) scaleSources.push("known-depth");

    const scaleConfidence = knownWidth || knownDepth ? 0.85 : 0.50;
    const resolveWidth = knownWidth ?? measurements.estimatedWidthM ?? 10;
    const resolveDepth = knownDepth ?? measurements.estimatedDepthM ?? 8;

    let status: StageResult["status"] = "completed";
    if (scaleConfidence <= 0.55) {
      status = "fallback";
    }

    return makeStageResult("scale_anchoring", status, {
      confidence: scaleConfidence,
      outputData: {
        resolvedWidthM: resolveWidth,
        resolvedDepthM: resolveDepth,
        resolvedHeightM: knownHeight,
        scaleSources,
        integrationNote: scaleConfidence < 0.7
          ? "Scale anchoring needs user confirmation. Provide a known dimension for higher confidence."
          : "Scale anchored from user measurements.",
      },
    });
  }

  private async runQualityGate(): Promise<StageResult> {
    const results = this.session.stageResults;
    const completedStages = results.filter((r) => r.status === "completed");
    const failedStages = results.filter((r) => r.status === "failed");

    const stagesRequired = ["capture"];
    const requiredCompleted = stagesRequired.every((s) => completedStages.some((r) => r.stage === s));
    const anyRequiredFailed = stagesRequired.some((s) => failedStages.some((r) => r.stage === s));

    if (!requiredCompleted || anyRequiredFailed) {
      return makeStageResult("quality_gate", "failed", {
        error: "Required stages did not complete. Manual-assisted fallback recommended.",
        confidence: 0,
        outputData: {
          requiredStages: stagesRequired,
          completedStages: completedStages.map((r) => r.stage),
          failedStages: failedStages.map((r) => r.stage),
          recommendation: "fallback_to_manual",
        },
      });
    }

    const allConfidences = completedStages
      .map((r) => r.confidence)
      .filter((c): c is number => c !== undefined && c > 0);

    const meanConfidence = allConfidences.length > 0
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
      : 0.5;

    const autoAcceptThreshold = this.config.minConfidenceForAutoAccept;
    const fallbackThreshold = this.config.minConfidenceForFallback;

    let gateStatus: StageResult["status"] = "completed";
    let recommendation = "auto_accept";

    if (meanConfidence < fallbackThreshold) {
      gateStatus = "fallback";
      recommendation = "fallback_to_manual";
      this.session.fallbackTriggered = true;
    } else if (meanConfidence < autoAcceptThreshold) {
      gateStatus = "completed";
      recommendation = "review_before_accept";
    }

    return makeStageResult("quality_gate", gateStatus, {
      confidence: meanConfidence,
      outputData: {
        meanConfidence,
        autoAcceptThreshold,
        fallbackThreshold,
        recommendation,
        completedStageCount: completedStages.length,
        failedStageCount: failedStages.length,
        totalExtractedElements: results.reduce((sum, r) => sum + r.extractedElements.length, 0),
      },
    });
  }

  private async runCompile(): Promise<StageResult> {
    const qualityGateResult = this.session.stageResults.find((r) => r.stage === "quality_gate");
    const gateOutput = qualityGateResult?.outputData ?? {};
    const meanConfidence = (gateOutput as Record<string, unknown>).meanConfidence as number | undefined;
    const recommendation = (gateOutput as Record<string, unknown>).recommendation as string | undefined;

    const scaleResult = this.session.stageResults.find((r) => r.stage === "scale_anchoring");
    const scaleOutput = scaleResult?.outputData as Record<string, unknown> | undefined;
    const resolvedWidth = (scaleOutput?.resolvedWidthM ?? 10) as number;
    const resolvedDepth = (scaleOutput?.resolvedDepthM ?? 8) as number;
    const resolvedHeight = (scaleOutput?.resolvedHeightM ?? 3) as number;

    const scene = createBlankSecurityScene();
    scene.name = `Reconstructed Scene (${this.session.photos.length} photos)`;
    scene.source = "scan";
    scene.dimensions = {
      width: resolvedWidth,
      depth: resolvedDepth,
      height: resolvedHeight,
    };

    const allElements = this.session.stageResults.flatMap((r) => r.extractedElements);
    const wallCandidates = allElements.filter((e) => e.elementType === "wall");
    const entryCandidates = allElements.filter((e) => e.elementType === "entry_point");

    scene.walls = wallCandidates.map((wc, i) => ({
      id: `wall_recon_${i}`,
      nodeType: "wall" as const,
      label: `Inferred Wall ${i + 1}`,
      start: [i * 2, 0] as [number, number],
      end: [i * 2 + resolvedWidth / wallCandidates.length, resolvedDepth] as [number, number],
      heightM: resolvedHeight,
      thicknessM: 0.18,
      material: "solid" as const,
      visionTransmission: 0,
      source: "scan" as const,
      reviewStatus: "unreviewed" as const,
      sourceTrace: wallCandidates[i]?.sourceTrace ?? `reconstruction:wall_${i}`,
      geometryValidity: "suspect" as const,
    }));

    this.session.overallConfidence = meanConfidence ?? 0.5;
    this.session.compiledScene = scene;

    return makeStageResult("compile", "completed", {
      confidence: meanConfidence ?? 0.5,
      outputData: {
        sceneId: scene.id,
        sceneName: scene.name,
        wallCount: scene.walls.length,
        dimensions: scene.dimensions,
        recommendation: recommendation ?? "review_before_accept",
        fallbackTriggered: this.session.fallbackTriggered,
        compiledSnapshot: scene,
      },
      extractedElements: allElements,
    });
  }
}

export function createReconstructionSessionFromPhotos(
  photos: CapturePhoto[],
  measurements: RoomMeasurement,
  config?: Partial<ReconstructionPipelineConfig>,
): ReconstructionPipeline {
  return new ReconstructionPipeline(photos, measurements, config);
}

export async function assessSceneReconstructionReadiness(scene: SecurityScene): Promise<{
  ready: boolean;
  confidence: number;
  gaps: string[];
  recommendations: string[];
}> {
  const gaps: string[] = [];
  const recommendations: string[] = [];

  if (scene.walls.length < 3) {
    gaps.push("Insufficient walls for an enclosed space.");
    recommendations.push("Add more walls or define the room perimeter.");
  }

  const needsReview = scene.walls.some((w) => w.reviewStatus !== "accepted" && w.reviewStatus !== "verified");
  if (needsReview) {
    gaps.push("Some walls have not been reviewed or verified.");
    recommendations.push("Review and accept inferred walls before relying on this scene.");
  }

  const suspectGeometry = scene.walls.some((w) => w.geometryValidity === "suspect" || w.geometryValidity === "invalid");
  if (suspectGeometry) {
    gaps.push("Some geometry is flagged as suspect or invalid.");
    recommendations.push("Correct suspect geometry in the editor.");
  }

  const ready = gaps.length === 0;
  const confidence = ready ? 0.85 : Math.max(0.1, 0.85 - gaps.length * 0.2);

  return { ready, confidence, gaps, recommendations };
}
