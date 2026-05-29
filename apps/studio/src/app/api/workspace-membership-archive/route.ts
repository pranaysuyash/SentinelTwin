import { NextResponse } from "next/server";

import {
  appendWorkspaceMembershipArchiveHistory,
  loadWorkspaceMembershipArchiveHistory,
  WorkspaceMembershipArchiveRequestSchema,
  summarizeWorkspaceMembershipArchive,
} from "@/lib/workspace-membership-archive";

export async function GET() {
  const history = loadWorkspaceMembershipArchiveHistory();
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
    const parsed = WorkspaceMembershipArchiveRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid workspace membership archive payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const summary = await summarizeWorkspaceMembershipArchive(parsed.data);
    const storedAt = Date.now();
    const history = appendWorkspaceMembershipArchiveHistory({
      ...summary,
      submittedAt: parsed.data.submittedAt ?? storedAt,
      storedAt,
    });

    return NextResponse.json({
      ...summary,
      storedAt,
      historyCount: history.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process workspace membership archive payload.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
