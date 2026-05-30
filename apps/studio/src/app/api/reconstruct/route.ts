import { NextRequest } from "next/server";
import { corsJson, corsNoContent } from "@/lib/api-cors";
import { reconstructionSessionSchema, capturePhotoSchema, roomMeasurementSchema, type CapturePhoto } from "@/schema/reconstruction-pipeline";
import { ReconstructionPipeline } from "@/lib/reconstruction-pipeline";

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function GET(request: NextRequest) {
  return corsJson({
    ok: true,
    status: "available",
    description: "Real site twin reconstruction pipeline. POST photos and measurements to run a reconstruction session.",
    stages: [
      "capture",
      "depth_estimation",
      "segmentation",
      "correspondence",
      "structural_extraction",
      "scale_anchoring",
      "quality_gate",
      "compile",
    ],
    modelEndpoints: {
      depthEstimation: "Depth Anything V2 (expected endpoint)",
      segmentation: "SAM 3 (expected endpoint)",
      correspondence: "VGGT (expected endpoint)",
      structuralExtraction: "SpatialLM (expected endpoint)",
    },
    integrationNote: "Model endpoints are not yet connected. Pipeline runs in deterministic heuristic mode by default.",
  }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const photosRaw = Array.isArray(body.photos) ? body.photos : [];
    const measurementsRaw = body.measurements ?? {};
    const configRaw = body.config ?? {};

    const measurementsResult = roomMeasurementSchema.safeParse(measurementsRaw);
    if (!measurementsResult.success) {
      return corsJson({
        ok: false,
        error: `Invalid measurements: ${measurementsResult.error.issues[0]?.message ?? "validation failed"}`,
        issues: measurementsResult.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }, request, { status: 400 }, { methods: ["GET", "POST", "OPTIONS"] });
    }

    const photos = photosRaw
      .map((raw: unknown) => capturePhotoSchema.safeParse(raw))
      .filter((r: { success: boolean }) => r.success)
      .map((r: { data: unknown }) => (r as { success: true; data: unknown }).data);

    if (photos.length === 0) {
      return corsJson({
        ok: false,
        error: "At least one valid photo is required.",
      }, request, { status: 400 }, { methods: ["GET", "POST", "OPTIONS"] });
    }

    const enableModels = configRaw.enableModels === true;
    const pipeline = new ReconstructionPipeline(
      photos as CapturePhoto[],
      measurementsResult.data,
      {
        enableDepthEstimation: enableModels,
        enableSegmentation: enableModels,
        enableCorrespondence: enableModels,
        enableStructuralExtraction: enableModels,
        minConfidenceForAutoAccept: configRaw.minConfidenceForAutoAccept ?? 0.7,
        minConfidenceForFallback: configRaw.minConfidenceForFallback ?? 0.4,
        modelEndpointUrl: configRaw.modelEndpointUrl,
      },
    );

    const session = await pipeline.run();
    const compileResult = session.stageResults.find((r) => r.stage === "compile");
    const qualityGateResult = session.stageResults.find((r) => r.stage === "quality_gate");

    return corsJson({
      ok: true,
      sessionId: session.id,
      completedAt: session.completedAt,
      durationMs: session.completedAt ? session.completedAt - session.startedAt : null,
      overallConfidence: session.overallConfidence ?? null,
      fallbackTriggered: session.fallbackTriggered,
      errors: session.errors,
      stageResults: session.stageResults.map((r) => ({
        stage: r.stage,
        status: r.status,
        durationMs: r.durationMs,
        confidence: r.confidence ?? null,
        error: r.error ?? null,
        elementCount: r.extractedElements.length,
      })),
      qualityRecommendation: (qualityGateResult?.outputData as Record<string, unknown>)?.recommendation ?? "review_before_accept",
      compiledSceneId: (compileResult?.outputData as Record<string, unknown>)?.sceneId ?? null,
      compiledScene: compileResult?.outputData?.compiledSnapshot ?? null,
      photosAccepted: photos.length,
      integrationNote: "Pipeline runs in deterministic mode. Model endpoints for depth estimation (Depth Anything V2), segmentation (SAM 3), correspondence (VGGT), and structural extraction (SpatialLM) are not yet connected.",
    }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return corsJson({
      ok: false,
      error: `Reconstruction pipeline error: ${message}`,
    }, request, { status: 500 }, { methods: ["GET", "POST", "OPTIONS"] });
  }
}
