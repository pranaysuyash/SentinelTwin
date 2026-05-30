import { describe, expect, test } from "bun:test";
import type { NextRequest } from "next/server";

import { GET } from "../route";

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as unknown as NextRequest
);

describe("truth-audit route", () => {
  test("returns the current trust audit report", async () => {
    const response = await GET(createNextRequest("http://localhost/api/truth-audit"));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.surfaces.length).toBeGreaterThan(0);
    expect(payload.formatted).toContain("Trust audit for");
    expect(payload.formatted).toContain("Governance control plane");
    expect(payload.formatted).toContain("Debug diagnostics bundle");
  });
});
