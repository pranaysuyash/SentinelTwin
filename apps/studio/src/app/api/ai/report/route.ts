import { NextRequest } from "next/server";
import { z } from "zod";

import { generateReport } from "@/agents/ReportAgent";
import { createModelProvider, describeAiProviderSelection, providerKeyAvailable, type AiProviderSelection } from "@/agents/provider-selection";
import { apiJson, API_METHODS, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

const selectionSchema = z.object({
  providerId: z.enum(["openai", "gemini", "qwen"]),
  model: z.string().min(1),
});

const reportRequestSchema = z.object({
  selection: selectionSchema,
  localOnlyMode: z.boolean(),
  simulationSummary: z.string().min(1),
  sceneSummary: z.string().min(1),
});

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["POST", "OPTIONS"] });
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, reportRequestSchema, {
    validationErrorMessage: "Invalid report payload.",
    parseErrorMessage: "Failed to parse report payload.",
    methods: ["POST", "OPTIONS"],
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const selection = parsed.data.selection as AiProviderSelection;
    const summary = describeAiProviderSelection(selection);

    if (parsed.data.localOnlyMode) {
      return apiJson(
        request,
        {
          ok: false,
          errorCode: "LOCAL_ONLY_MODE",
          error: "Local-only mode blocks cloud-backed report generation.",
        },
        { status: 403 },
        { methods: ["POST", "OPTIONS"] },
      );
    }

    if (!providerKeyAvailable(selection.providerId)) {
      return apiJson(
        request,
        {
          ok: false,
          errorCode: "PROVIDER_KEY_MISSING",
          error: `${summary.providerName} API key not configured.`,
        },
        { status: 400 },
        { methods: ["POST", "OPTIONS"] },
      );
    }

    const provider = createModelProvider(selection);
    const report = await generateReport(parsed.data.simulationSummary, parsed.data.sceneSummary, provider);
    return apiJson(
      request,
      { ok: true, report },
      undefined,
      { methods: ["POST", "OPTIONS"] },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiJson(
      request,
      {
        ok: false,
        errorCode: "REPORT_FAILED",
        error: message,
      },
      { status: 500 },
      { methods: ["POST", "OPTIONS"] },
    );
  }
}
