import { NextRequest } from "next/server";
import { z } from "zod";

import { parseCommandDetailed, type SceneContextSummary } from "@sentineltwin/agents";
import { createModelProvider, describeAiProviderSelection, providerKeyAvailable, type AiProviderSelection } from "@/agents/provider-selection";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";
import type { SecurityScene } from "@/schema/security-scene";

const selectionSchema = z.object({
  providerId: z.enum(["openai", "gemini", "qwen"]),
  model: z.string().min(1),
});

const sceneContextSchema = z.object({
  cameraNames: z.array(z.string()),
  obstructionLabels: z.array(z.string()),
  lightNames: z.array(z.string()),
  zoneLabels: z.array(z.string()),
  activeCameraCount: z.number(),
  currentTimeOfDay: z.enum(["day", "night", "dusk", "dawn"]),
  dimensions: z.object({
    width: z.number(),
    depth: z.number(),
    height: z.number(),
  }),
});

const commandRequestSchema = z.object({
  userText: z.string().min(1),
  selection: selectionSchema,
  localOnlyMode: z.boolean(),
  sceneContext: sceneContextSchema,
  scene: z.unknown().optional(),
});

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["POST", "OPTIONS"] });
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, commandRequestSchema, {
    validationErrorMessage: "Invalid command payload.",
    parseErrorMessage: "Failed to parse command payload.",
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
          error: "Local-only mode blocks cloud-backed parsing.",
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
    const result = await parseCommandDetailed(
      parsed.data.userText,
      parsed.data.sceneContext as SceneContextSummary,
      provider,
      parsed.data.scene as SecurityScene | undefined,
    );

    return apiJson(
      request,
      {
        ok: true,
        result,
      },
      undefined,
      { methods: ["POST", "OPTIONS"] },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiJson(
      request,
      {
        ok: false,
        errorCode: "COMMAND_PARSE_FAILED",
        error: message,
      },
      { status: 500 },
      { methods: ["POST", "OPTIONS"] },
    );
  }
}
