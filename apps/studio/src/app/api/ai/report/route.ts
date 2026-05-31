import { NextRequest } from "next/server";
import { z } from "zod";

import { generateReport } from "@/agents/ReportAgent";
import { createModelProvider, describeAiProviderSelection, providerKeyAvailable, type AiProviderSelection } from "@/agents/provider-selection";
import { corsJson, corsNoContent } from "@/lib/api-cors";

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
  try {
    const body = reportRequestSchema.parse(await request.json());
    const selection = body.selection as AiProviderSelection;
    const summary = describeAiProviderSelection(selection);

    if (body.localOnlyMode) {
      return corsJson({
        ok: false,
        code: "LOCAL_ONLY_MODE",
        error: "Local-only mode blocks cloud-backed report generation.",
      }, request, { status: 403 }, { methods: ["POST", "OPTIONS"] });
    }

    if (!providerKeyAvailable(selection.providerId)) {
      return corsJson({
        ok: false,
        code: "PROVIDER_KEY_MISSING",
        error: `${summary.providerName} API key not configured.`,
      }, request, { status: 400 }, { methods: ["POST", "OPTIONS"] });
    }

    const provider = createModelProvider(selection);
    const report = await generateReport(body.simulationSummary, body.sceneSummary, provider);
    return corsJson({ ok: true, report }, request, undefined, { methods: ["POST", "OPTIONS"] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return corsJson({
      ok: false,
      code: "REPORT_FAILED",
      error: message,
    }, request, { status: 500 }, { methods: ["POST", "OPTIONS"] });
  }
}
