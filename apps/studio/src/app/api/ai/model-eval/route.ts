import { NextRequest } from "next/server";
import { z } from "zod";

import { runModelEvalSuite } from "@/agents/model-eval";
import { createModelProvider, type AiProviderSelection } from "@/agents/provider-selection";
import { apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

const selectionSchema = z.object({
  providerId: z.enum(["openai", "gemini", "qwen"]),
  model: z.string().min(1),
});

const requestSchema = z.object({
  selection: selectionSchema,
  localOnlyMode: z.boolean(),
});

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function GET(request: NextRequest) {
  return apiJson(
    request,
    {
      ok: true,
      status: "available",
      description: "Deterministic model-eval suite for AI route contract checks.",
      fixtures: [
        "heuristic_layout_baseline",
        "command_parse",
        "counterfactual_candidates",
        "report_generation",
        "model_layout_draft",
      ],
      localOnlyModeSupported: true,
    },
    undefined,
    { methods: ["GET", "POST", "OPTIONS"] },
  );
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, requestSchema, {
    validationErrorMessage: "Invalid model eval payload.",
    parseErrorMessage: "Failed to parse model eval payload.",
    methods: ["POST", "OPTIONS"],
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const selection = parsed.data.selection as AiProviderSelection;
    const provider = createModelProvider(selection);
    const report = await runModelEvalSuite(provider, selection, parsed.data.localOnlyMode);
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
        errorCode: "MODEL_EVAL_FAILED",
        error: message,
      },
      { status: 500 },
      { methods: ["POST", "OPTIONS"] },
    );
  }
}
