import { appendSensorIngestHistory, loadSensorIngestHistory } from "@/lib/sensor-ingest-history";
import { SensorLiveIngestRequestSchema, summarizeSensorLiveFeed } from "@/lib/sensor-live-ingest";
import { corsJson, corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = loadSensorIngestHistory();
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
    const parsed = SensorLiveIngestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return corsJson(
        {
          ok: false,
          error: "Invalid sensor ingest payload.",
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

    const summary = await summarizeSensorLiveFeed(parsed.data);
    const storedAt = Date.now();
    const history = appendSensorIngestHistory({
      ...parsed.data,
      ...summary,
      submittedAt: parsed.data.submittedAt ?? storedAt,
      storedAt,
      raw: parsed.data.raw.trim(),
      sensors: parsed.data.sensors,
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
        error: "Failed to parse sensor ingest payload.",
      },
      request,
      { status: 400 },
      { methods: ["GET", "POST", "OPTIONS"] },
    );
  }
}
