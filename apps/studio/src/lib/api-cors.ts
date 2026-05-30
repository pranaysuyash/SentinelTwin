import { NextResponse } from "next/server";

type CorsOptions = {
  methods?: string[];
  allowedHeaders?: string[];
  exposeHeaders?: string[];
  maxAgeSeconds?: number;
};

const DEFAULT_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Requested-With",
  "Accept",
  "Origin",
];

const DEFAULT_ALLOWED_METHODS = ["GET", "POST", "OPTIONS"];
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const SAME_ORIGIN_SENTINELS = new Set(["self", "same-origin", "same_origin"]);

function getConfiguredAllowedOrigins() {
  const raw = process.env.SENTINELTWIN_API_ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isLoopbackOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    return LOOPBACK_HOSTNAMES.has(parsed.hostname);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string) {
  if (origin === "null") {
    return process.env.NODE_ENV !== "production" && process.env.SENTINELTWIN_API_ALLOW_NULL_ORIGIN !== "false";
  }

  const configuredAllowedOrigins = getConfiguredAllowedOrigins();
  if (configuredAllowedOrigins.includes(origin)) {
    return true;
  }

  if (process.env.NODE_ENV !== "production" && isLoopbackOrigin(origin)) {
    return true;
  }

  return false;
}

function resolveCorsOrigin(request?: Request) {
  if (!request) return null;
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }

  const configuredAllowedOrigins = getConfiguredAllowedOrigins();
  if (configuredAllowedOrigins.some((entry) => SAME_ORIGIN_SENTINELS.has(entry.toLowerCase()))) {
    try {
      if (new URL(origin).origin === new URL(request.url).origin) {
        return origin;
      }
    } catch {
      return null;
    }
  }

  if (!isAllowedOrigin(origin)) return null;
  return origin;
}

export function applyCorsHeaders(headers: Headers, request?: Request, options: CorsOptions = {}) {
  const origin = resolveCorsOrigin(request);
  if (!origin) return;

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", headers.get("Vary") ? `${headers.get("Vary")}, Origin` : "Origin");
  headers.set("Access-Control-Allow-Methods", (options.methods ?? DEFAULT_ALLOWED_METHODS).join(", "));
  headers.set("Access-Control-Allow-Headers", (options.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS).join(", "));
  headers.set("Access-Control-Max-Age", String(options.maxAgeSeconds ?? 86_400));

  const exposeHeaders = options.exposeHeaders ?? [];
  if (exposeHeaders.length > 0) {
    headers.set("Access-Control-Expose-Headers", exposeHeaders.join(", "));
  }
}

export function corsJson(
  body: unknown,
  request?: Request,
  init?: ResponseInit,
  options?: CorsOptions,
) {
  const response = NextResponse.json(body, init);
  applyCorsHeaders(response.headers, request, options);
  return response;
}

export function corsNoContent(request?: Request, options?: CorsOptions) {
  const response = new NextResponse(null, { status: 204 });
  applyCorsHeaders(response.headers, request, options);
  return response;
}
