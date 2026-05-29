import { NextResponse } from "next/server";

import {
  appendGovernanceArchiveHistory,
  loadGovernanceArchiveHistory,
  GovernanceArchiveRequestSchema,
  summarizeGovernanceArchive,
} from "@/lib/governance-archive";

export async function GET() {
  const history = loadGovernanceArchiveHistory();
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
    const parsed = GovernanceArchiveRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid governance archive payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const summary = await summarizeGovernanceArchive(parsed.data);
    const storedAt = Date.now();
    const history = appendGovernanceArchiveHistory({
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
    const message = error instanceof Error ? error.message : "Failed to process governance archive payload.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
