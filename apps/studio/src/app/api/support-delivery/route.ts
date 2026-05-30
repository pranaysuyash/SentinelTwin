import {
  appendSupportDeliveryHistory,
  loadSupportDeliveryHistory,
  SupportDeliveryRequestSchema,
  summarizeSupportDelivery,
} from "@/lib/support-delivery";
import { corsJson, corsNoContent } from "@/lib/api-cors";

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const history = loadSupportDeliveryHistory();
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
    const parsed = SupportDeliveryRequestSchema.safeParse(body);

    if (!parsed.success) {
      return corsJson(
        {
          ok: false,
          error: "Invalid support delivery payload.",
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

    const summary = await summarizeSupportDelivery(parsed.data);
    const storedAt = Date.now();
    const history = appendSupportDeliveryHistory({
      ...summary,
      submittedAt: parsed.data.submittedAt ?? storedAt,
      storedAt,
    });

    return corsJson({
      ...summary,
      storedAt,
      historyCount: history.length,
    }, request, undefined, { methods: ["GET", "POST", "OPTIONS"] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process support delivery payload.";
    return corsJson(
      {
        ok: false,
        error: message,
      },
      request,
      { status: 400 },
      { methods: ["GET", "POST", "OPTIONS"] },
    );
  }
}
