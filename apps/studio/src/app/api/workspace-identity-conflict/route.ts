import { NextResponse } from "next/server";

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

export async function GET() {
  const history = await loadWorkspaceIdentityConflictHistory();
  return NextResponse.json({
    ok: true,
    history,
    historyCount: history.length,
    latestSubmission: history[0] ?? null,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = WorkspaceIdentityConflictRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid workspace identity conflict payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
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

    return NextResponse.json({
      ...summary,
      storedAt,
      historyCount: history.length,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to parse workspace identity conflict payload.",
      },
      { status: 400 },
    );
  }
}
