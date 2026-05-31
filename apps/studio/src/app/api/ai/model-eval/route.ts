import { NextRequest } from "next/server";
import { z } from "zod";

import { runModelEvalSuite } from "@/agents/model-eval";
import { createModelProvider, type AiProviderSelection } from "@/agents/provider-selection";
import { corsJson, corsNoContent } from "@/lib/api-cors";

const selectionSchema = z.object({
  providerId: z.enum(["openai", "gemini", "qwen"]),
  model: z.string().min(1),
});

const requestSchema = z.object({
  selection: selectionSchema,
  localOnlyMode: z.boolean(),
});

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["POST", "OPTIONS"] });
}

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json());
    const selection = body.selection as AiProviderSelection;
    const provider = createModelProvider(selection);
    const report = await runModelEvalSuite(provider, selection, body.localOnlyMode);
    return corsJson({ ok: true, report }, request, undefined, { methods: ["POST", "OPTIONS"] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return corsJson({
      ok: false,
      code: "MODEL_EVAL_FAILED",
      error: message,
    }, request, { status: 500 }, { methods: ["POST", "OPTIONS"] });
  }
}
