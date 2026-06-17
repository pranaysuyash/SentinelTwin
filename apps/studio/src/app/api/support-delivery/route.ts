import {
  appendSupportDeliveryHistory,
  loadSupportDeliveryHistory,
  SupportDeliveryRequestSchema,
  summarizeSupportDelivery,
} from "@/lib/support-delivery";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = loadSupportDeliveryHistory();
  return apiJson(
    request,
    {
      ok: true,
      history,
      historyCount: history.length,
      latestSubmission: history[0] ?? null,
    },
    undefined,
    { methods: API_METHODS },
  );
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: API_METHODS });
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, SupportDeliveryRequestSchema, {
    validationErrorMessage: "Invalid support delivery payload.",
    parseErrorMessage: "Failed to parse support delivery payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const summary = await summarizeSupportDelivery(parsed.data);
    const storedAt = Date.now();
    const history = appendSupportDeliveryHistory({
      ...summary,
      submittedAt: parsed.data.submittedAt ?? storedAt,
      storedAt,
    });

    return apiJson(
      request,
      {
        ok: true,
        ...summary,
        storedAt,
        historyCount: history.length,
      },
      undefined,
      { methods: API_METHODS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process support delivery payload.";
    return apiJson(
      request,
      {
        ok: false,
        error: message,
        errorCode: "internal_error",
      },
      { status: 500 },
      { methods: API_METHODS },
    );
  }
}
