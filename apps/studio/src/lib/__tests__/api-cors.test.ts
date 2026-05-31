import { describe, expect, test } from "bun:test";

import { corsJson, corsNoContent } from "@/lib/api-cors";

describe("api cors helpers", () => {
  test("allow same-origin requests when configured with same-origin sentinel", () => {
    const originalAllowedOrigins = process.env.SENTINELTWIN_API_ALLOWED_ORIGINS;
    process.env.SENTINELTWIN_API_ALLOWED_ORIGINS = "same-origin";
    try {
      const request = new Request("https://studio.example.com/api/workspace-approval-route", {
        headers: {
          origin: "https://studio.example.com",
        },
      });

      const response = corsJson({ ok: true }, request, { status: 200 }, { methods: ["GET", "POST", "OPTIONS"] });

      expect(response.headers.get("access-control-allow-origin")).toBe("https://studio.example.com");
    } finally {
      if (typeof originalAllowedOrigins === "undefined") {
        delete process.env.SENTINELTWIN_API_ALLOWED_ORIGINS;
      } else {
        process.env.SENTINELTWIN_API_ALLOWED_ORIGINS = originalAllowedOrigins;
      }
    }
  });

  test("allow loopback origins in development-style requests", async () => {
    const request = new Request("http://localhost/api/workspace-approval-route", {
      headers: {
        origin: "http://127.0.0.1:3001",
      },
    });

    const response = corsJson({ ok: true }, request, { status: 200 }, { methods: ["GET", "POST", "OPTIONS"] });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:3001");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(response.headers.get("vary")).toContain("Origin");
  });

  test("return a preflight response with CORS headers", () => {
    const request = new Request("http://localhost/api/workspace-approval-route", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    const response = corsNoContent(request, { methods: ["GET", "POST", "OPTIONS"] });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
  });
});
