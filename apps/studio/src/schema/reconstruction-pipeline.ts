import { z } from "zod";
import type { SecurityScene } from "@/schema/security-scene";

export const capturePhotoSchema = z.object({
  id: z.string(),
  dataUrl: z.string().optional(),
  fileName: z.string(),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  timestamp: z.number(),
  deviceOrientation: z.enum(["portrait", "landscape"]).optional(),
  estimatedFocalLengthMm: z.number().positive().optional(),
});
export type CapturePhoto = z.infer<typeof capturePhotoSchema>;

export const roomMeasurementSchema = z.object({
  estimatedWidthM: z.number().positive().optional(),
  estimatedDepthM: z.number().positive().optional(),
  estimatedHeightM: z.number().positive().default(3),
  knownWidthM: z.number().positive().optional(),
  knownDepthM: z.number().positive().optional(),
  knownReferenceLabel: z.string().max(80).optional(),
});
export type RoomMeasurement = z.infer<typeof roomMeasurementSchema>;

export const reconstructionStageSchema = z.enum([
  "capture",
  "depth_estimation",
  "segmentation",
  "correspondence",
  "structural_extraction",
  "scale_anchoring",
  "quality_gate",
  "compile",
]);
export type ReconstructionStage = z.infer<typeof reconstructionStageSchema>;

export const stageStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "fallback",
]);
export type StageStatus = z.infer<typeof stageStatusSchema>;

export const extractedElementSchema = z.object({
  id: z.string(),
  elementType: z.enum(["wall", "door", "window", "camera", "obstruction", "light", "entry_point", "zone"]),
  confidence: z.number().min(0).max(1),
  boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  position3d: z.tuple([z.number(), z.number(), z.number()]).optional(),
  sourceTrace: z.string(),
  labels: z.array(z.string()).default([]),
  correctionApplied: z.boolean().default(false),
});
export type ExtractedElement = z.infer<typeof extractedElementSchema>;

export const stageResultSchema = z.object({
  stage: reconstructionStageSchema,
  status: stageStatusSchema,
  durationMs: z.number().int().nonnegative(),
  error: z.string().optional(),
  extractedElements: z.array(extractedElementSchema).default([]),
  outputData: z.record(z.unknown()).default({}),
  confidence: z.number().min(0).max(1).optional(),
});
export type StageResult = z.infer<typeof stageResultSchema>;

export const reconstructionSessionSchema = z.object({
  id: z.string(),
  startedAt: z.number(),
  completedAt: z.number().optional(),
  photos: z.array(capturePhotoSchema),
  measurements: roomMeasurementSchema,
  stageResults: z.array(stageResultSchema),
  overallConfidence: z.number().min(0).max(1).optional(),
  compiledScene: z.unknown().optional(),
  fallbackTriggered: z.boolean().default(false),
  errors: z.array(z.string()).default([]),
});
export type ReconstructionSession = z.infer<typeof reconstructionSessionSchema>;

export const reconstructionPipelineConfigSchema = z.object({
  enableDepthEstimation: z.boolean().default(true),
  enableSegmentation: z.boolean().default(true),
  enableCorrespondence: z.boolean().default(true),
  enableStructuralExtraction: z.boolean().default(true),
  minConfidenceForAutoAccept: z.number().min(0).max(1).default(0.7),
  minConfidenceForFallback: z.number().min(0).max(1).default(0.4),
  modelEndpointUrl: z.string().optional(),
});
export type ReconstructionPipelineConfig = z.infer<typeof reconstructionPipelineConfigSchema>;

export function createDefaultPipelineConfig(): ReconstructionPipelineConfig {
  return {
    enableDepthEstimation: false,
    enableSegmentation: false,
    enableCorrespondence: false,
    enableStructuralExtraction: false,
    minConfidenceForAutoAccept: 0.7,
    minConfidenceForFallback: 0.4,
    modelEndpointUrl: undefined,
  };
}

export function createCapturePhoto(fileName: string, dataUrl?: string): CapturePhoto {
  return {
    id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    dataUrl,
    fileName,
    timestamp: Date.now(),
  };
}

export const RECONSTRUCTION_STAGE_LABELS: Record<ReconstructionStage, string> = {
  capture: "Photo Capture",
  depth_estimation: "Depth Estimation",
  segmentation: "Object Segmentation",
  correspondence: "Multi-Photo Correspondence",
  structural_extraction: "Structure Extraction",
  scale_anchoring: "Scale Anchoring",
  quality_gate: "Quality Gate",
  compile: "Scene Compilation",
};

export const RECONSTRUCTION_STAGE_ORDER: ReconstructionStage[] = [
  "capture",
  "depth_estimation",
  "segmentation",
  "correspondence",
  "structural_extraction",
  "scale_anchoring",
  "quality_gate",
  "compile",
];
