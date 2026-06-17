import { appendSensorIngestHistory, loadSensorIngestHistory } from "@/lib/sensor-ingest-history";
import { SensorLiveIngestRequestSchema, summarizeSensorLiveFeed } from "@/lib/sensor-live-ingest";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = loadSensorIngestHistory();
  return apiJson(request, {
    ok: true,
    history,
    historyCount: history.length,
    latestSubmission: history[0] ?? null,
  }, undefined, { methods: API_METHODS });
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: API_METHODS });
}

export async function POST(request: NextRequest) {
  const parsed = await parseValidatedJsonBody(request, SensorLiveIngestRequestSchema, {
    validationErrorMessage: "Invalid sensor ingest payload.",
    parseErrorMessage: "Failed to parse sensor ingest payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
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
  return apiJson(request, {
    ...summary,
    storedAt,
    historyCount: history.length,
  }, undefined, { methods: API_METHODS });
}
