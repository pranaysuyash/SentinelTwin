import {
  appendWorkspaceIdentityConflictHistory,
  loadWorkspaceIdentityConflictHistory,
} from "@/lib/workspace-identity-conflict-storage";
import {
  summarizeWorkspaceIdentityConflict,
  WorkspaceIdentityConflictRequestSchema,
} from "@/lib/workspace-identity-conflict";
import { normalizeWorkspaceAccessState } from "@/lib/workspace-access";
import { normalizeWorkspaceGovernance } from "@/lib/workspace-governance";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = await loadWorkspaceIdentityConflictHistory();
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
  const parsed = await parseValidatedJsonBody(request, WorkspaceIdentityConflictRequestSchema, {
    validationErrorMessage: "Invalid workspace identity conflict payload.",
    parseErrorMessage: "Failed to parse workspace identity conflict payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const summary = await summarizeWorkspaceIdentityConflict({
      ...parsed.data,
      workspaceAccessState: normalizeWorkspaceAccessState(parsed.data.workspaceAccessState),
      workspaceGovernanceState: normalizeWorkspaceGovernance(parsed.data.workspaceGovernanceState),
      archivedWorkspaceAccessState: parsed.data.archivedWorkspaceAccessState
        ? normalizeWorkspaceAccessState(parsed.data.archivedWorkspaceAccessState)
        : parsed.data.archivedWorkspaceAccessState,
    });
    const storedAt = Date.now();
    const history = await appendWorkspaceIdentityConflictHistory({
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
        error: "Failed to parse workspace identity conflict payload.",
        errorCode: "internal_error",
      },
      { status: 500 },
      { methods: API_METHODS },
    );
  }
}
