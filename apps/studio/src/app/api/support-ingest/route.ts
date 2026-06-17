import { appendSupportIngestHistory, loadSupportIngestHistory } from "@/lib/support-ingest-history";
import { SupportIngestRequestSchema, summarizeSupportIngest } from "@/lib/support-ingest";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = loadSupportIngestHistory();
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
  const parsed = await parseValidatedJsonBody(request, SupportIngestRequestSchema, {
    validationErrorMessage: "Invalid support ingest payload.",
    parseErrorMessage: "Failed to parse support ingest payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const summary = summarizeSupportIngest(parsed.data);
    const storedAt = Date.now();
    const history = appendSupportIngestHistory({
      ...summary,
      submittedAt: parsed.data.submittedAt ?? storedAt,
      storedAt,
    });

    return apiJson(
      request,
      {
        ...summary,
        storedAt,
        historyCount: history.length,
      },
      undefined,
      { methods: API_METHODS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process support ingest payload.";
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
