import { NextResponse } from "next/server";

import { appendCameraLiveConnectionHistory, loadCameraLiveConnectionHistory } from "@/lib/camera-live-connection-history";
import { CameraLiveConnectionProbeRequestSchema, probeCameraLiveConnection } from "@/lib/camera-live-connection";

export async function GET() {
  const history = loadCameraLiveConnectionHistory();
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
    const parsed = CameraLiveConnectionProbeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid camera live connection payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const summary = await probeCameraLiveConnection(parsed.data);
    const storedAt = Date.now();
    const history = appendCameraLiveConnectionHistory({
      ok: true,
      ...summary,
      submittedAt: parsed.data.submittedAt ?? storedAt,
      storedAt,
      raw: parsed.data.raw.trim(),
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
        error: "Failed to parse camera live connection payload.",
      },
      { status: 400 },
    );
  }
}
