import { NextResponse } from "next/server";

import { appendCameraMetadataHistory, loadCameraMetadataHistory } from "@/lib/camera-metadata-ingest-history";
import { CameraMetadataIngestRequestSchema, summarizeCameraMetadataLiveFeed } from "@/lib/camera-metadata-live-ingest";

export async function GET() {
  const history = loadCameraMetadataHistory();
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
    const parsed = CameraMetadataIngestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid camera metadata ingest payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const summary = await summarizeCameraMetadataLiveFeed(parsed.data);
    const storedAt = Date.now();
    const history = appendCameraMetadataHistory({
      ok: true,
      ...parsed.data,
      ...summary,
      submittedAt: parsed.data.submittedAt ?? storedAt,
      storedAt,
      raw: parsed.data.raw.trim(),
      cameras: parsed.data.cameras,
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
        error: "Failed to parse camera metadata ingest payload.",
      },
      { status: 400 },
    );
  }
}
