import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextRequest } from "next/server";

import { GET, POST } from "../route";

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as unknown as NextRequest
);

const originalStoreDir = process.env.SENTINELTWIN_SUPPORT_INGEST_STORE_DIR;
const testStoreDir = mkdtempSync(join(tmpdir(), "sentineltwin-support-ingest-"));

process.env.SENTINELTWIN_SUPPORT_INGEST_STORE_DIR = testStoreDir;

function cleanupStoreDir() {
  rmSync(testStoreDir, { recursive: true, force: true });
  if (typeof originalStoreDir === "undefined") {
    delete process.env.SENTINELTWIN_SUPPORT_INGEST_STORE_DIR;
  } else {
    process.env.SENTINELTWIN_SUPPORT_INGEST_STORE_DIR = originalStoreDir;
  }
}

afterAll(() => {
  cleanupStoreDir();
});

describe("support-ingest route", () => {
  test("summarizes a submitted support payload into alert routing", async () => {
    const response = await POST(
      createNextRequest("http://localhost/api/support-ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "debug-panel",
          sceneId: "scene-1",
          sceneName: "Shop Floor",
          submittedAt: 1710000000000,
          runtimeIncidents: [
            {
              id: "incident-1",
              timestamp: 1710000000000,
              category: "runtime_failure",
              severity: "error",
              title: "Crash",
              details: "Boom",
              stack: "stack",
              durationMs: 12,
              source: "test",
              path: "/studio",
              action: "run",
            },
          ],
          externalLogEntries: [
            {
              id: "external-1",
              timestamp: 1710000000500,
              source: "paste",
              title: "Console error",
              details: "TypeError: boom",
              raw: "TypeError: boom",
              lineCount: 1,
              severity: "error",
            },
          ],
          aiActionTelemetry: [],
        }),
      }),
    );

    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("debug-panel");
    expect(payload.sceneId).toBe("scene-1");
    expect(payload.receivedAt).toBe("2024-03-09T16:00:00.000Z");
    expect(payload.storedAt).toBeGreaterThan(0);
    expect(payload.historyCount).toBe(1);
    expect(payload.counts.runtimeIncidents).toBe(1);
    expect(payload.counts.externalLogs).toBe(1);
    expect(payload.counts.telemetryEvents).toBe(0);
    expect(payload.routing.alertCount).toBe(2);
    expect(payload.routing.statusLabel).toBe("attention");
    expect(payload.summary).toContain("alert candidate");

    const historyResponse = await GET(createNextRequest("http://localhost/api/support-ingest"));
    expect(historyResponse.status).toBe(200);
    const historyPayload = await historyResponse.json();
    expect(historyPayload.ok).toBe(true);
    expect(historyPayload.historyCount).toBe(1);
    expect(historyPayload.history[0]?.sceneId).toBe("scene-1");
  });

  test("rejects invalid payloads", async () => {
    const response = await POST(
      createNextRequest("http://localhost/api/support-ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runtimeIncidents: [{ invalid: true }] }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Invalid support ingest payload");
  });
});
