import { describe, expect, test } from "bun:test";

import { GET } from "../route";

describe("truth-audit route", () => {
  test("returns the current trust audit report", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.surfaces.length).toBeGreaterThan(0);
    expect(payload.formatted).toContain("Trust audit for");
    expect(payload.formatted).toContain("Governance control plane");
    expect(payload.formatted).toContain("Debug diagnostics bundle");
  });
});
