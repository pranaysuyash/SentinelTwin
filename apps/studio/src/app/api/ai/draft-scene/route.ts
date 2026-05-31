import { NextRequest } from "next/server";
import { z } from "zod";

import { createModelProvider, describeAiProviderSelection, providerKeyAvailable, type AiProviderSelection } from "@/agents/provider-selection";
import { corsJson, corsNoContent } from "@/lib/api-cors";
import { draftSceneFromPrompt, draftSceneFromPromptWithModel } from "@/lib/ai-layout-draft";

const selectionSchema = z.object({
  providerId: z.enum(["openai", "gemini", "qwen"]),
  model: z.string().min(1),
});

const draftRequestSchema = z.object({
  prompt: z.string().min(1),
  selection: selectionSchema,
  localOnlyMode: z.boolean(),
});

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["POST", "OPTIONS"] });
}

export async function POST(request: NextRequest) {
  try {
    const body = draftRequestSchema.parse(await request.json());
    const selection = body.selection as AiProviderSelection;
    const summary = describeAiProviderSelection(selection);

    if (body.localOnlyMode || !providerKeyAvailable(selection.providerId)) {
      const draft = draftSceneFromPrompt(body.prompt);
      return corsJson({
        ok: true,
        mode: "heuristic",
        reason: body.localOnlyMode
          ? "Local-only policy enforced heuristic draft mode."
          : `${summary.envKey} missing. Heuristic draft mode used.`,
        draft,
      }, request, undefined, { methods: ["POST", "OPTIONS"] });
    }

    const provider = createModelProvider(selection);
    const draft = await draftSceneFromPromptWithModel(body.prompt, provider);
    return corsJson({ ok: true, mode: "model", draft }, request, undefined, { methods: ["POST", "OPTIONS"] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return corsJson({
      ok: false,
      code: "DRAFT_FAILED",
      error: message,
    }, request, { status: 500 }, { methods: ["POST", "OPTIONS"] });
  }
}
