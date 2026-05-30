import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextRequest } from "next/server";

import { GET, POST } from "../route";

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as unknown as NextRequest
);

const originalStoreDir = process.env.SENTINELTWIN_SUPPORT_DELIVERY_STORE_DIR;
const testStoreDir = mkdtempSync(join(tmpdir(), "sentineltwin-support-delivery-"));

process.env.SENTINELTWIN_SUPPORT_DELIVERY_STORE_DIR = testStoreDir;

afterAll(() => {
  rmSync(testStoreDir, { recursive: true, force: true });
  if (typeof originalStoreDir === "undefined") {
    delete process.env.SENTINELTWIN_SUPPORT_DELIVERY_STORE_DIR;
  } else {
    process.env.SENTINELTWIN_SUPPORT_DELIVERY_STORE_DIR = originalStoreDir;
  }
});

describe("support-delivery route", () => {
  test("queues a routed support payload and persists delivery history", async () => {
    const response = await POST(
      createNextRequest("http://localhost/api/support-delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "debug-panel",
          submittedAt: 1710000003000,
          supportIngest: {
            ok: true,
            source: "debug-panel",
            receivedAt: "2024-03-09T16:00:00.000Z",
            sceneId: "scene-1",
            sceneName: "Shop Floor",
            summary: "2 alert candidates routed from 1 runtime incident and 1 external log capture.",
            routing: {
              title: "Automated alerting",
              summary: "2 alert candidates · 2 high priority · 0 warnings.",
              alertCount: 2,
              highPriorityCount: 2,
              latestAlert: {
                id: "external:external-1",
                timestamp: 1710000000500,
                source: "external_log",
                severity: "error",
                title: "Console error",
                details: "TypeError: boom",
                category: "external_log",
                path: null,
                stack: null,
              },
              recentAlerts: [],
              recommendation: "Review the latest high-priority alert, attach external logs, and export the support bundle before escalation.",
              statusLabel: "attention",
            },
            counts: {
              runtimeIncidents: 1,
              externalLogs: 1,
              telemetryEvents: 0,
            },
            submittedAt: 1710000000000,
            storedAt: 1710000001000,
          },
          destinations: [
            { label: "Local relay", mode: "archive" },
            { label: "Webhook relay", endpoint: null, mode: "webhook" },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("debug-panel");
    expect(payload.historyCount).toBe(1);
    expect(payload.sceneId).toBe("scene-1");
    expect(payload.deliveredCount).toBe(0);
    expect(payload.queuedCount).toBe(2);
    expect(payload.failedCount).toBe(0);
    expect(payload.archiveStatus).toBe("local cache");
    expect(payload.summary).toContain("delivery target");

    const historyResponse = await GET(createNextRequest("http://localhost/api/support-delivery"));
    expect(historyResponse.status).toBe(200);
    const historyPayload = await historyResponse.json();
    expect(historyPayload.ok).toBe(true);
    expect(historyPayload.historyCount).toBe(1);
    expect(historyPayload.latestSubmission?.sceneId).toBe("scene-1");
  });

  test("rejects invalid payloads", async () => {
    const response = await POST(
      createNextRequest("http://localhost/api/support-delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destinations: [{ label: "" }] }),
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Invalid support delivery payload");
  });

  test("delivers to a configured webhook endpoint", async () => {
    const originalStoreDir = process.env.SENTINELTWIN_SUPPORT_DELIVERY_STORE_DIR;
    const deliveryStoreDir = mkdtempSync(join(tmpdir(), "sentineltwin-support-delivery-remote-"));
    process.env.SENTINELTWIN_SUPPORT_DELIVERY_STORE_DIR = deliveryStoreDir;

    const receivedBodies: string[] = [];
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => {
        receivedBodies.push(Buffer.concat(chunks).toString("utf8"));
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
      });
    });

    try {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Webhook test server did not expose a numeric port.");
      }

      const response = await POST(
        createNextRequest("http://localhost/api/support-delivery", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: "debug-panel",
            submittedAt: 1710000003000,
            supportIngest: {
              ok: true,
              source: "debug-panel",
              receivedAt: "2024-03-09T16:00:00.000Z",
              sceneId: "scene-1",
              sceneName: "Shop Floor",
              summary: "2 alert candidates routed from 1 runtime incident and 1 external log capture.",
              routing: {
                title: "Automated alerting",
                summary: "2 alert candidates · 2 high priority · 0 warnings.",
                alertCount: 2,
                highPriorityCount: 2,
                latestAlert: {
                  id: "external:external-1",
                  timestamp: 1710000000500,
                  source: "external_log",
                  severity: "error",
                  title: "Console error",
                  details: "TypeError: boom",
                  category: "external_log",
                  path: null,
                  stack: null,
                },
                recentAlerts: [],
                recommendation: "Review the latest high-priority alert, attach external logs, and export the support bundle before escalation.",
                statusLabel: "attention",
              },
              counts: {
                runtimeIncidents: 1,
                externalLogs: 1,
                telemetryEvents: 0,
              },
              submittedAt: 1710000000000,
              storedAt: 1710000001000,
            },
            destinations: [
              { label: "Local relay", mode: "archive" },
              { label: "Remote webhook", endpoint: `http://127.0.0.1:${address.port}/webhook`, mode: "webhook" },
            ],
          }),
        }),
      );

      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.ok).toBe(true);
      expect(payload.deliveredCount).toBe(1);
      expect(payload.queuedCount).toBe(1);
      expect(payload.failedCount).toBe(0);
      expect(payload.archiveStatus).toBe("server archive");

      expect(receivedBodies).toHaveLength(1);
      const deliveredPayload = JSON.parse(receivedBodies[0] ?? "{}");
      expect(deliveredPayload.source).toBe("debug-panel");
      expect(deliveredPayload.supportIngest.sceneId).toBe("scene-1");
      expect(deliveredPayload.deliveredAt).toBeTypeOf("number");
    } finally {
      server.close();
      rmSync(deliveryStoreDir, { recursive: true, force: true });
      if (typeof originalStoreDir === "undefined") {
        delete process.env.SENTINELTWIN_SUPPORT_DELIVERY_STORE_DIR;
      } else {
        process.env.SENTINELTWIN_SUPPORT_DELIVERY_STORE_DIR = originalStoreDir;
      }
    }
  });
});
