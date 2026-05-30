import { appendCameraMetadataHistory, loadCameraMetadataHistory } from "@/lib/camera-metadata-ingest-history";
import { CameraMetadataIngestRequestSchema, summarizeCameraMetadataLiveFeed } from "@/lib/camera-metadata-live-ingest";
import { corsJson, corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = loadCameraMetadataHistory();
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
    const parsed = CameraMetadataIngestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return corsJson(
        {
          ok: false,
          error: "Invalid camera metadata ingest payload.",
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

    return corsJson({
      ...summary,
      storedAt,
      historyCount: history.length,
    }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
  } catch {
    return corsJson(
      {
        ok: false,
        error: "Failed to parse camera metadata ingest payload.",
      },
      request,
      { status: 400 },
      { methods: ["GET", "POST", "OPTIONS"] },
    );
  }
}
