import { NextRequest } from "next/server";

import { apiJson } from "@/lib/api-response";
import { corsNoContent } from "@/lib/api-cors";

const healthMethods = ["GET", "OPTIONS"] as const;

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: healthMethods });
}

export async function GET(request: NextRequest) {
  return apiJson(
    request,
    {
      ok: true,
      status: "ok",
      version: "0.1.0",
      uptime: process.uptime(),
      serverTimestampMs: Date.now(),
    },
    undefined,
    { methods: healthMethods },
  );
}
