import { NextResponse } from "next/server";

import {
  appendWorkspaceIdentityConflictHistory,
  loadWorkspaceIdentityConflictHistory,
  summarizeWorkspaceIdentityConflict,
  WorkspaceIdentityConflictRequestSchema,
} from "@/lib/workspace-identity-conflict";

export async function GET() {
  const history = loadWorkspaceIdentityConflictHistory();
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

    const summary = await summarizeWorkspaceIdentityConflict(parsed.data);
    const storedAt = Date.now();
    const history = appendWorkspaceIdentityConflictHistory({
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
