import { NextRequest } from "next/server";
import { z } from "zod";

import { parseCommandDetailed, type SceneContextSummary } from "@sentineltwin/agents";
import { createModelProvider, describeAiProviderSelection, providerKeyAvailable, type AiProviderSelection } from "@/agents/provider-selection";
import { corsJson, corsNoContent } from "@/lib/api-cors";
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
  try {
    const body = commandRequestSchema.parse(await request.json());
    const selection = body.selection as AiProviderSelection;
    const summary = describeAiProviderSelection(selection);

    if (body.localOnlyMode) {
      return corsJson({
        ok: false,
        code: "LOCAL_ONLY_MODE",
        error: "Local-only mode blocks cloud-backed parsing.",
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
    const result = await parseCommandDetailed(
      body.userText,
      body.sceneContext as SceneContextSummary,
      provider,
      body.scene as SecurityScene | undefined,
    );

    return corsJson({
      ok: true,
      result,
    }, request, undefined, { methods: ["POST", "OPTIONS"] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return corsJson({
      ok: false,
      code: "COMMAND_PARSE_FAILED",
      error: message,
    }, request, { status: 500 }, { methods: ["POST", "OPTIONS"] });
  }
}
