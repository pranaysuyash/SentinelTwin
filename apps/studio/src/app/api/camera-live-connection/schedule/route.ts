import { runSubscriptionCycle } from "@/lib/subscription-scheduler";
import { corsJson, corsNoContent } from "@/lib/api-cors";
import { API_METHODS } from "@/lib/api-response";

import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const result = await runSubscriptionCycle();
    return corsJson({ ok: true, ...result }, request, undefined, { methods: ["POST", "OPTIONS"] });
  } catch (err) {
    return corsJson({ ok: false, error: String(err) }, request, { status: 500 }, { methods: ["POST", "OPTIONS"] });
  }
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["POST", "OPTIONS"] });
}