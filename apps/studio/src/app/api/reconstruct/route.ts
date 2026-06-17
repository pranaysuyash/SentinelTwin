import { NextRequest } from "next/server";
import { z } from "zod";

import { ReconstructionPipeline } from "@/lib/reconstruction-pipeline";
import {
  capturePhotoSchema,
  reconstructionSessionSchema,
  roomMeasurementSchema,
  type CapturePhoto,
} from "@/schema/reconstruction-pipeline";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

const reconstructionRequestSchema = z.object({
  photos: z.array(z.unknown()).default([]),
  measurements: z.unknown().optional(),
  config: z.unknown().optional(),
});

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: API_METHODS });
}

export async function GET(request: NextRequest) {
  return apiJson(
    request,
    {
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
    },
    undefined,
    { methods: API_METHODS },
  );
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, reconstructionRequestSchema, {
    validationErrorMessage: "Invalid reconstruction payload.",
    parseErrorMessage: "Failed to parse reconstruction payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const measurementsResult = roomMeasurementSchema.safeParse(parsed.data.measurements ?? {});
    if (!measurementsResult.success) {
      return apiJson(
        request,
        {
          ok: false,
          error: `Invalid measurements: ${measurementsResult.error.issues[0]?.message ?? "validation failed"}`,
          errorCode: "validation_error",
          issues: measurementsResult.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
        { methods: API_METHODS },
      );
    }

    const photos = parsed.data.photos
      .map((raw: unknown) => capturePhotoSchema.safeParse(raw))
      .filter((result): result is { success: true; data: CapturePhoto } => result.success)
      .map((result) => result.data);

    if (photos.length === 0) {
      return apiJson(
        request,
        {
          ok: false,
          error: "At least one valid photo is required.",
          errorCode: "validation_error",
        },
        { status: 400 },
        { methods: API_METHODS },
      );
    }

    const configRaw = parsed.data.config;
    const requestedConfig = (configRaw && typeof configRaw === "object" && configRaw !== null) ? configRaw as Record<string, unknown> : {};
    const enableModels = requestedConfig.enableModels === true;
    const pipeline = new ReconstructionPipeline(
      photos as CapturePhoto[],
      measurementsResult.data,
      {
        enableDepthEstimation: enableModels,
        enableSegmentation: enableModels,
        enableCorrespondence: enableModels,
        enableStructuralExtraction: enableModels,
        minConfidenceForAutoAccept: typeof requestedConfig.minConfidenceForAutoAccept === "number" ? requestedConfig.minConfidenceForAutoAccept : 0.7,
        minConfidenceForFallback: typeof requestedConfig.minConfidenceForFallback === "number" ? requestedConfig.minConfidenceForFallback : 0.4,
        modelEndpointUrl: typeof requestedConfig.modelEndpointUrl === "string" ? requestedConfig.modelEndpointUrl : undefined,
      },
    );

    const session = await pipeline.run();
    const compileResult = session.stageResults.find((r) => r.stage === "compile");
    const qualityGateResult = session.stageResults.find((r) => r.stage === "quality_gate");

    return apiJson(
      request,
      {
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
      },
      undefined,
      { methods: API_METHODS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiJson(
      request,
      {
        ok: false,
        error: `Reconstruction pipeline error: ${message}`,
        errorCode: "internal_error",
      },
      { status: 500 },
      { methods: API_METHODS },
    );
  }
}
