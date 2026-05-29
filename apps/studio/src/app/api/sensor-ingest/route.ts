import { NextResponse } from "next/server";

import { appendSensorIngestHistory, loadSensorIngestHistory } from "@/lib/sensor-ingest-history";
import { SensorLiveIngestRequestSchema, summarizeSensorLiveFeed } from "@/lib/sensor-live-ingest";

export async function GET() {
  const history = loadSensorIngestHistory();
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
    const parsed = SensorLiveIngestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid sensor ingest payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const summary = await summarizeSensorLiveFeed(parsed.data);
    const storedAt = Date.now();
    const history = appendSensorIngestHistory({
      ok: true,
      ...parsed.data,
      ...summary,
      submittedAt: parsed.data.submittedAt ?? storedAt,
      storedAt,
      raw: parsed.data.raw.trim(),
      sensors: parsed.data.sensors,
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
        error: "Failed to parse sensor ingest payload.",
      },
      { status: 400 },
    );
  }
}
