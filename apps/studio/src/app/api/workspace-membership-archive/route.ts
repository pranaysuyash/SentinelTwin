import {
  appendWorkspaceMembershipArchiveHistory,
  loadWorkspaceMembershipArchiveHistory,
  WorkspaceMembershipArchiveRequestSchema,
  summarizeWorkspaceMembershipArchive,
} from "@/lib/workspace-membership-archive";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = loadWorkspaceMembershipArchiveHistory();
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
  const parsed = await parseValidatedJsonBody(request, WorkspaceMembershipArchiveRequestSchema, {
    validationErrorMessage: "Invalid workspace membership archive payload.",
    parseErrorMessage: "Failed to process workspace membership archive payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const summary = await summarizeWorkspaceMembershipArchive(parsed.data);
    const storedAt = Date.now();
    const history = appendWorkspaceMembershipArchiveHistory({
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
    const message = error instanceof Error ? error.message : "Failed to process workspace membership archive payload.";
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
