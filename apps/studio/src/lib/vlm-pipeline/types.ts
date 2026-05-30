import { z } from "zod";

// ── Tier 1: Local gate output ──

export const imageQualitySchema = z.object({
  isBlurry: z.boolean(),
  blurScore: z.number().min(0).max(1),
  lowLight: z.boolean(),
  overexposed: z.boolean(),
  resolutionSufficient: z.boolean(),
  qualityScore: z.number().min(0).max(1),
});
export type ImageQuality = z.infer<typeof imageQualitySchema>;

export const sceneTypeSchema = z.enum([
  "retail",
  "warehouse",
  "office",
  "residential",
  "industrial",
  "outdoor",
  "unknown",
]);
export type SceneType = z.infer<typeof sceneTypeSchema>;

export const coarseRoomSchema = z.object({
  index: z.number().int().nonnegative(),
  label: z.string(),
  boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});
export type CoarseRoom = z.infer<typeof coarseRoomSchema>;

export const ocrTextSchema = z.object({
  text: z.string(),
  boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  confidence: z.number().min(0).max(1),
});
export type OcrText = z.infer<typeof ocrTextSchema>;

export const tier1OutputSchema = z.object({
  imageQuality: imageQualitySchema,
  sceneType: sceneTypeSchema,
  sceneTypeConfidence: z.number().min(0).max(1),
  roomCount: z.number().int().nonnegative(),
  rooms: z.array(coarseRoomSchema),
  ocrTexts: z.array(ocrTextSchema),
  overallConfidence: z.number().min(0).max(1),
  ambiguityFlags: z.array(z.string()),
});
export type Tier1Output = z.infer<typeof tier1OutputSchema>;

// ── Gate decision ──

export const gateActionSchema = z.enum([
  "reject_blurry",
  "human_review",
  "proceed_to_tier2",
]);
export type GateAction = z.infer<typeof gateActionSchema>;

export const gateDecisionSchema = z.object({
  action: gateActionSchema,
  reason: z.string(),
  qualityThreshold: z.number().default(0.4),
});
export type GateDecision = z.infer<typeof gateDecisionSchema>;

// ── Tier 2: Cloud pass output ──

export const wallCoordinateSchema = z.object({
  start: z.tuple([z.number(), z.number()]),
  end: z.tuple([z.number(), z.number()]),
  label: z.string().optional(),
  confidence: z.number().min(0).max(1),
});
export type WallCoordinate = z.infer<typeof wallCoordinateSchema>;

export const openingDetectionSchema = z.object({
  kind: z.enum(["door", "window"]),
  position: z.tuple([z.number(), z.number()]),
  widthM: z.number().positive(),
  heightM: z.number().positive().optional(),
  orientation: z.enum(["horizontal", "vertical"]),
  confidence: z.number().min(0).max(1),
});
export type OpeningDetection = z.infer<typeof openingDetectionSchema>;

export const obstructionDetectionSchema = z.object({
  kind: z.enum(["pillar", "counter", "cupboard", "shelf", "furniture", "other"]),
  position: z.tuple([z.number(), z.number()]),
  dimensions: z.tuple([z.number(), z.number(), z.number()]).optional(),
  label: z.string().optional(),
  confidence: z.number().min(0).max(1),
});
export type ObstructionDetection = z.infer<typeof obstructionDetectionSchema>;

export const criticalZoneSchema = z.object({
  label: z.string(),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
  confidence: z.number().min(0).max(1),
});
export type CriticalZoneDetection = z.infer<typeof criticalZoneSchema>;

export const adjacencyGraphSchema = z.object({
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    relation: z.enum(["adjacent", "connects_via_door", "connects_via_opening"]),
    confidence: z.number().min(0).max(1),
  })),
});
export type AdjacencyGraph = z.infer<typeof adjacencyGraphSchema>;

export const tier2OutputSchema = z.object({
  walls: z.array(wallCoordinateSchema),
  doors: z.array(openingDetectionSchema),
  windows: z.array(openingDetectionSchema),
  obstructions: z.array(obstructionDetectionSchema),
  criticalZones: z.array(criticalZoneSchema),
  adjacencyGraph: adjacencyGraphSchema.optional(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});
export type Tier2Output = z.infer<typeof tier2OutputSchema>;

// ── Post-processing validation ──

export const validationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "blocking"]),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const postProcessingOutputSchema = z.object({
  adjustedWalls: z.array(wallCoordinateSchema),
  adjustedDoors: z.array(openingDetectionSchema),
  adjustedWindows: z.array(openingDetectionSchema),
  adjustedObstructions: z.array(obstructionDetectionSchema),
  adjustedCriticalZones: z.array(criticalZoneSchema),
  confidence: z.number().min(0).max(1),
  validationIssues: z.array(validationIssueSchema),
  overallPass: z.boolean(),
});
export type PostProcessingOutput = z.infer<typeof postProcessingOutputSchema>;

// ── SemanticContext: the formal handoff between Tier 1 and Tier 2 ──

export const semanticContextSchema = z.object({
  sourceImageInfo: z.object({
    widthPx: z.number().int().positive(),
    heightPx: z.number().int().positive(),
    fileName: z.string(),
  }),
  tier1: tier1OutputSchema,
  gateDecision: gateDecisionSchema,
  tier2: tier2OutputSchema.optional(),
  postProcessing: postProcessingOutputSchema.optional(),
  pipelineMetadata: z.object({
    startedAt: z.number(),
    tier1CompletedAt: z.number().optional(),
    tier2CompletedAt: z.number().optional(),
    completedAt: z.number().optional(),
    modelIds: z.array(z.string()),
    totalCost: z.number().optional(),
  }),
});
export type SemanticContext = z.infer<typeof semanticContextSchema>;

// ── Pipeline config ──

export const vlmPipelineConfigSchema = z.object({
  qualityThreshold: z.number().min(0).max(1).default(0.4),
  tier1Enabled: z.boolean().default(true),
  tier2Enabled: z.boolean().default(true),
  autoAcceptThreshold: z.number().min(0).max(1).default(0.7),
  forceTier2: z.boolean().default(false),
  tier1ModelId: z.string().default("stub-tier1"),
  tier2ModelId: z.string().default("gpt-4o"),
});
export type VlmPipelineConfig = z.infer<typeof vlmPipelineConfigSchema>;

export const DEFAULT_VLM_PIPELINE_CONFIG: VlmPipelineConfig = {
  qualityThreshold: 0.4,
  tier1Enabled: true,
  tier2Enabled: true,
  autoAcceptThreshold: 0.7,
  forceTier2: false,
  tier1ModelId: "stub-tier1",
  tier2ModelId: "gpt-4o",
};

// ── Final adapter-friendly output ──

export const vlmPipelineResultSchema = z.object({
  semanticContext: semanticContextSchema,
  passed: z.boolean(),
  error: z.string().optional(),
});
export type VlmPipelineResult = z.infer<typeof vlmPipelineResultSchema>;
