import { NextRequest } from "next/server";
import { z } from "zod";

import { createModelProvider, describeAiProviderSelection, providerKeyAvailable, type AiProviderSelection } from "@/agents/provider-selection";
import { apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";
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
  const parsed = await parseValidatedJsonBody(request, draftRequestSchema, {
    validationErrorMessage: "Invalid draft scene payload.",
    parseErrorMessage: "Failed to parse draft scene payload.",
    methods: ["POST", "OPTIONS"],
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const selection = parsed.data.selection as AiProviderSelection;
    const summary = describeAiProviderSelection(selection);

    if (parsed.data.localOnlyMode || !providerKeyAvailable(selection.providerId)) {
      const draft = draftSceneFromPrompt(parsed.data.prompt);
      return apiJson(
        request,
        {
          ok: true,
          mode: "heuristic",
          reason: parsed.data.localOnlyMode
            ? "Local-only policy enforced heuristic draft mode."
            : `${summary.envKey} missing. Heuristic draft mode used.`,
          draft,
        },
        undefined,
        { methods: ["POST", "OPTIONS"] },
      );
    }

    const provider = createModelProvider(selection);
    const draft = await draftSceneFromPromptWithModel(parsed.data.prompt, provider);
    return apiJson(
      request,
      { ok: true, mode: "model", draft },
      undefined,
      { methods: ["POST", "OPTIONS"] },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiJson(
      request,
      {
        ok: false,
        errorCode: "DRAFT_FAILED",
        error: message,
      },
      { status: 500 },
      { methods: ["POST", "OPTIONS"] },
    );
  }
}
