import { NextResponse } from "next/server";

import {
  appendSupportDeliveryHistory,
  loadSupportDeliveryHistory,
  SupportDeliveryRequestSchema,
  summarizeSupportDelivery,
} from "@/lib/support-delivery";

export async function GET() {
  const history = loadSupportDeliveryHistory();
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
    const parsed = SupportDeliveryRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid support delivery payload.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const summary = await summarizeSupportDelivery(parsed.data);
    const storedAt = Date.now();
    const history = appendSupportDeliveryHistory({
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
    const message = error instanceof Error ? error.message : "Failed to process support delivery payload.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
