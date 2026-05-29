import { NextResponse } from "next/server";

import { appendSupportIngestHistory, loadSupportIngestHistory } from "@/lib/support-ingest-history";
import { SupportIngestRequestSchema, summarizeSupportIngest } from "@/lib/support-ingest";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = SupportIngestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid support ingest payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const summary = summarizeSupportIngest(parsed.data);
    const storedAt = Date.now();
    const history = appendSupportIngestHistory({
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
        error: "Failed to parse support ingest payload.",
      },
      { status: 400 },
    );
  }
}

export async function GET() {
  const history = loadSupportIngestHistory();
  return NextResponse.json({
    ok: true,
    history,
    historyCount: history.length,
    latestSubmission: history[0] ?? null,
  });
}
