import { NextResponse } from "next/server";
import { z } from "zod";

import { corsJson, type CorsOptions } from "@/lib/api-cors";

type ApiIssue = {
  path: string;
  message: string;
};

type ApiMetadata = {
  requestId: string;
  apiVersion: string;
  timestamp: string;
};

export type ApiResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      response: ReturnType<typeof NextResponse.json>;
    };

export const API_METHODS = ["GET", "POST", "OPTIONS"] as const;
export const DEFAULT_API_VERSION = process.env.SENTINELTWIN_API_VERSION ?? "1";

function buildRequestMetadata(
  request?: Request,
  requestId?: string,
  apiVersion = DEFAULT_API_VERSION,
): ApiMetadata {
  return {
    requestId: requestId ?? request?.headers.get("x-request-id") ?? crypto.randomUUID(),
    apiVersion,
    timestamp: new Date().toISOString(),
  };
}

export function apiJson<T extends Record<string, unknown>>(
  request: Request | undefined,
  body: T,
  init?: ResponseInit,
  options?: CorsOptions,
  metadata?: {
    requestId?: string;
    apiVersion?: string;
  },
) {
  const envelope = buildRequestMetadata(request, metadata?.requestId, metadata?.apiVersion);
  return corsJson(
    {
      ...body,
      requestId: envelope.requestId,
      apiVersion: envelope.apiVersion,
      timestamp: envelope.timestamp,
    },
    request,
    init,
    options,
  );
}

export function formatValidationIssues(error: z.ZodError): ApiIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export async function parseValidatedJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
  options: {
    validationErrorMessage?: string;
    parseErrorMessage?: string;
    methods?: CorsOptions["methods"];
    requestId?: string;
    apiVersion?: string;
  } = {},
): Promise<ApiResult<z.infer<T>>> {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return {
        ok: false,
        response: apiJson(
          request,
          {
            ok: false,
            error: options.validationErrorMessage ?? "Invalid request payload.",
            errorCode: "validation_error",
            issues: formatValidationIssues(parsed.error),
          },
          { status: 400 },
          {
            methods: options.methods ?? API_METHODS,
          },
          {
            requestId: options.requestId,
            apiVersion: options.apiVersion,
          },
        ),
      };
    }

    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      response: apiJson(
        request,
        {
          ok: false,
          error: options.parseErrorMessage ?? "Failed to parse request payload.",
          errorCode: "parse_error",
        },
        { status: 400 },
        {
          methods: options.methods ?? API_METHODS,
        },
        {
          requestId: options.requestId,
          apiVersion: options.apiVersion,
        },
      ),
    };
  }
}
