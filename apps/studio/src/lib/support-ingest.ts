import { z } from "zod";

import { summarizeIncidentAlerts } from "@/lib/incident-alerts";

const RuntimeIncidentSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  category: z.enum(["user_error", "data_validation_error", "provider_failure", "runtime_failure", "performance_trace"]),
  severity: z.enum(["info", "warning", "error"]),
  title: z.string().min(1),
  details: z.string().min(1),
  stack: z.string().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  source: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  action: z.string().nullable().optional(),
});

const ExternalLogEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  source: z.enum(["paste", "file"]),
  title: z.string().min(1),
  details: z.string().min(1),
  raw: z.string().min(1),
  lineCount: z.number().int().nonnegative(),
  severity: z.enum(["info", "warning", "error"]),
});

const AiActionTelemetrySchema = z.object({
  id: z.string().min(1),
  stage: z.enum(["command_parse", "counterfactual", "report_generation", "ai_draft"]),
  providerId: z.string().min(1),
  providerLabel: z.string().min(1),
  model: z.string().min(1),
  promptId: z.string().min(1).nullable().optional(),
  promptVersion: z.string().min(1).nullable().optional(),
  promptTitle: z.string().min(1).nullable().optional(),
  promptAgent: z.string().min(1).nullable().optional(),
  promptStage: z.enum(["command", "counterfactual", "report", "draft"]).nullable().optional(),
  promptOutputSchema: z.string().min(1).nullable().optional(),
  localOnlyMode: z.boolean(),
  cloudAvailable: z.boolean(),
  timestamp: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  estimatedPromptTokens: z.number().int().nonnegative(),
  estimatedCompletionTokens: z.number().int().nonnegative(),
  estimatedTotalTokens: z.number().int().nonnegative(),
  tokenSource: z.enum(["estimated", "usage"]),
  status: z.enum(["success", "error"]),
  note: z.string().nullable().optional(),
});

export const SupportIngestRequestSchema = z.object({
  source: z.string().min(1).default("debug-panel"),
  sceneId: z.string().min(1).optional(),
  sceneName: z.string().min(1).optional(),
  submittedAt: z.number().int().nonnegative().optional(),
  runtimeIncidents: z.array(RuntimeIncidentSchema).default([]),
  externalLogEntries: z.array(ExternalLogEntrySchema).default([]),
  aiActionTelemetry: z.array(AiActionTelemetrySchema).default([]),
});

export type SupportIngestRequest = z.infer<typeof SupportIngestRequestSchema>;

export type SupportIngestResponse = {
  ok: true;
  source: string;
  receivedAt: string;
  sceneId: string | null;
  sceneName: string | null;
  summary: string;
  routing: ReturnType<typeof summarizeIncidentAlerts>;
  counts: {
    runtimeIncidents: number;
    externalLogs: number;
    telemetryEvents: number;
  };
};

export function summarizeSupportIngest(request: SupportIngestRequest): SupportIngestResponse {
  const routing = summarizeIncidentAlerts({
    runtimeIncidents: request.runtimeIncidents,
    externalLogEntries: request.externalLogEntries,
  });

  return {
    ok: true,
    source: request.source,
    receivedAt: new Date(request.submittedAt ?? Date.now()).toISOString(),
    sceneId: request.sceneId ?? null,
    sceneName: request.sceneName ?? null,
    summary: routing.recentAlerts.length > 0
      ? `${routing.alertCount} alert candidate${routing.alertCount === 1 ? "" : "s"} routed from ${request.runtimeIncidents.length} runtime incident${request.runtimeIncidents.length === 1 ? "" : "s"} and ${request.externalLogEntries.length} external log capture${request.externalLogEntries.length === 1 ? "" : "s"}.`
      : "No alert candidates were routed from the submitted support payload.",
    routing,
    counts: {
      runtimeIncidents: request.runtimeIncidents.length,
      externalLogs: request.externalLogEntries.length,
      telemetryEvents: request.aiActionTelemetry.length,
    },
  };
}
