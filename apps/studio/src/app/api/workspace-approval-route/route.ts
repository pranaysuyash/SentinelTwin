import { NextResponse } from "next/server";

import { appendWorkspaceApprovalRouteHistory, loadWorkspaceApprovalRouteHistory, WorkspaceApprovalRouteRequestSchema, summarizeWorkspaceApprovalRoute } from "@/lib/workspace-approval-route";

export async function GET() {
  const history = loadWorkspaceApprovalRouteHistory();
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
    const parsed = WorkspaceApprovalRouteRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid workspace approval route payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const summary = await summarizeWorkspaceApprovalRoute(parsed.data);
    const storedAt = Date.now();
    const history = appendWorkspaceApprovalRouteHistory({
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
        error: "Failed to parse workspace approval route payload.",
      },
      { status: 400 },
    );
  }
}
