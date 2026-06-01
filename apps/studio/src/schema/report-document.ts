import { z } from "zod";
import { securitySceneSchema, simulationResultSchema } from "./security-scene";

export const reportAudienceSchema = z.enum([
  "operator",
  "auditor",
  "insurer",
  "installer",
  "privacy_reviewer",
  "consultant",
  "facilities_director",
  "operations_manager",
]);

export const reportVisibilitySchema = z.enum([
  "internal",
  "shared",
  "privacy_safe"
]);

export const reportStatusSchema = z.enum([
  "draft",
  "reviewed",
  "published"
]);

export const reportVisualArtifactSchema = z.enum([
  "heatmap",
  "cones",
  "view"
]);

export const reportSectionSchema = z.enum([
  "site_overview",
  "provenance",
  "assumptions",
  "coverage_results",
  "privacy_review",
  "summary",
  "truth_ladder",
  "operational_evidence",
  "causal_trace",
  "zone_analysis",
  "camera_analysis",
  "temporal_twin",
  "recommendations",
  "privacy_masking"
]);

export const reportDocumentSchema = z.object({
  id: z.string().startsWith("report_"),
  title: z.string(),
  sceneId: z.string(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),

  audience: reportAudienceSchema,
  visibility: reportVisibilitySchema,
  status: reportStatusSchema,

  sections: z.array(reportSectionSchema),
  visualArtifacts: z.array(reportVisualArtifactSchema),

  sceneSnapshot: securitySceneSchema.optional(),
  simulationSnapshot: simulationResultSchema.optional(),

  securityOutcomeSnapshot: z.any().optional(),
  siteTwinDraftSnapshot: z.any().optional(),

  evidenceBundleUri: z.string().optional(),
  evidenceBundleJson: z.any().optional(),

  forensicGuarantees: z.boolean().default(false),
  truthChecksPassed: z.boolean().default(false),

  pdfExportUri: z.string().optional(),
  htmlExportUri: z.string().optional(),
});

export type ReportDocument = z.infer<typeof reportDocumentSchema>;
export type ReportAudience = z.infer<typeof reportAudienceSchema>;
export type ReportVisibility = z.infer<typeof reportVisibilitySchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type ReportSection = z.infer<typeof reportSectionSchema>;
export type ReportVisualArtifact = z.infer<typeof reportVisualArtifactSchema>;
