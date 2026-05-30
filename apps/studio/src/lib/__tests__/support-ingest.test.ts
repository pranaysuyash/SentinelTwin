import { describe, expect, test } from "bun:test";

import { SupportIngestRequestSchema, summarizeSupportIngest } from "@/lib/support-ingest";

describe("support ingest", () => {
  test("preserves AI telemetry prompt lineage fields", () => {
    const request = SupportIngestRequestSchema.parse({
      source: "debug-panel",
      sceneId: "scene-1",
      sceneName: "Telemetry Scene",
      runtimeIncidents: [],
      externalLogEntries: [],
      aiActionTelemetry: [
        {
          id: "telemetry-1",
          stage: "ai_draft",
          providerId: "openai",
          providerLabel: "OpenAI · gpt-4o",
          model: "gpt-4o",
          promptId: "model_layout_draft",
          promptVersion: "v1",
          promptTitle: "Model Layout Draft",
          promptAgent: "AI Layout Draft",
          promptStage: "draft",
          promptOutputSchema: "SecurityScene blueprint",
          localOnlyMode: false,
          cloudAvailable: true,
          timestamp: 1710000000000,
          durationMs: 120,
          estimatedPromptTokens: 120,
          estimatedCompletionTokens: 240,
          estimatedTotalTokens: 360,
          tokenSource: "estimated",
          status: "success",
          note: null,
        },
      ],
    });

    expect(request.aiActionTelemetry[0]?.promptId).toBe("model_layout_draft");
    expect(request.aiActionTelemetry[0]?.promptOutputSchema).toContain("SecurityScene");

    const summary = summarizeSupportIngest(request);
    expect(summary.counts.telemetryEvents).toBe(1);
    expect(summary.sceneId).toBe("scene-1");
  });
});
