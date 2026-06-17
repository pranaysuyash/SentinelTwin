import { appendCameraMetadataHistory, loadCameraMetadataHistory } from "@/lib/camera-metadata-ingest-history";
import { CameraMetadataIngestRequestSchema, summarizeCameraMetadataLiveFeed } from "@/lib/camera-metadata-live-ingest";
import { API_METHODS, apiJson, parseValidatedJsonBody } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = loadCameraMetadataHistory();
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
  const parsed = await parseValidatedJsonBody(request, CameraMetadataIngestRequestSchema, {
    validationErrorMessage: "Invalid camera metadata ingest payload.",
    parseErrorMessage: "Failed to parse camera metadata ingest payload.",
    methods: API_METHODS,
  });
  if (!parsed.ok) {
    return parsed.response;
  }

  const summary = await summarizeCameraMetadataLiveFeed(parsed.data);
  const storedAt = Date.now();
  const history = appendCameraMetadataHistory({
    ...parsed.data,
    ...summary,
    submittedAt: parsed.data.submittedAt ?? storedAt,
    storedAt,
    raw: parsed.data.raw.trim(),
    cameras: parsed.data.cameras,
  });

  return apiJson(request, {
    ...summary,
    storedAt,
    historyCount: history.length,
  }, undefined, { methods: API_METHODS });
}
