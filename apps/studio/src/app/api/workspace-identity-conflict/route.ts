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
import { corsJson, corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = await loadWorkspaceIdentityConflictHistory();
  return corsJson({
    ok: true,
    history,
    historyCount: history.length,
    latestSubmission: history[0] ?? null,
  }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["GET", "POST", "OPTIONS"] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = WorkspaceIdentityConflictRequestSchema.safeParse(body);

    if (!parsed.success) {
      return corsJson(
        {
          ok: false,
          error: "Invalid workspace identity conflict payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        request,
        { status: 400 },
        { methods: ["GET", "POST", "OPTIONS"] },
      );
    }

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

    return corsJson({
      ...summary,
      storedAt,
      historyCount: history.length,
    }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
  } catch {
    return corsJson(
      {
        ok: false,
        error: "Failed to parse workspace identity conflict payload.",
      },
      request,
      { status: 400 },
      { methods: ["GET", "POST", "OPTIONS"] },
    );
  }
}
