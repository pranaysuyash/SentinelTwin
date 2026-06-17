import { appendWorkspaceApprovalRouteHistory, loadWorkspaceApprovalRouteHistory, WorkspaceApprovalRouteRequestSchema, summarizeWorkspaceApprovalRoute } from "@/lib/workspace-approval-route";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = loadWorkspaceApprovalRouteHistory();
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
  const parsed = await parseValidatedJsonBody(request, WorkspaceApprovalRouteRequestSchema, {
    validationErrorMessage: "Invalid workspace approval route payload.",
    parseErrorMessage: "Failed to parse workspace approval route payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const summary = await summarizeWorkspaceApprovalRoute(parsed.data);
    const storedAt = Date.now();
    const history = appendWorkspaceApprovalRouteHistory({
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
  } catch {
    return apiJson(
      request,
      {
        ok: false,
        error: "Failed to parse workspace approval route payload.",
        errorCode: "internal_error",
      },
      { status: 500 },
      { methods: API_METHODS },
    );
  }
}
