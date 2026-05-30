import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextRequest } from "next/server";

import { GET, POST } from "../route";

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as any as unknown as any
);

const originalStoreDir = process.env.SENTINELTWIN_GOVERNANCE_ARCHIVE_STORE_DIR;
const testStoreDir = mkdtempSync(join(tmpdir(), "sentineltwin-governance-archive-"));

process.env.SENTINELTWIN_GOVERNANCE_ARCHIVE_STORE_DIR = testStoreDir;

afterAll(() => {
  rmSync(testStoreDir, { recursive: true, force: true });
  if (typeof originalStoreDir === "undefined") {
    delete process.env.SENTINELTWIN_GOVERNANCE_ARCHIVE_STORE_DIR;
  } else {
    process.env.SENTINELTWIN_GOVERNANCE_ARCHIVE_STORE_DIR = originalStoreDir;
  }
});

describe("governance-archive route", () => {
  test("queues a governance handoff and persists archive history", async () => {
    const response = await POST(
      createNextRequest("http://localhost/api/governance-archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "debug-panel",
          submittedAt: 1710000003000,
          sceneId: "scene-1",
          sceneName: "Shop Floor",
          workspaceAccessSummary: {
            activeMemberLabel: "Reviewer · reviewer",
            modeLabel: "Shared workspace",
            teamSize: 4,
            reviewRouteLabel: "reviewer, privacy reviewer, admin",
            publishRouteLabel: "Publish requires review",
          },
          workspaceGovernanceSummary: {
            roleLabel: "Reviewer",
            approvalModeLabel: "Review required",
            sceneStatusLabel: "Review requested",
            canPublish: false,
            needsApproval: true,
            reviewAgeLabel: "5 min ago",
            reviewerLabel: "Reviewer",
          },
          governanceTrail: {
            totalEvents: 3,
            requestCount: 1,
            approvalCount: 1,
            rejectionCount: 0,
            annotationCount: 1,
            roleChangeCount: 0,
            policyChangeCount: 0,
            latestEvent: {
              id: "scene_review_approved:scene-1:def456",
              kind: "scene_review_approved",
              title: "Review approved",
              details: "Looks good to publish.",
              timestamp: 1710000002500,
              branchLabel: "review",
              lifecycleStage: "review",
            },
            recentEvents: [
              {
                id: "scene_review_requested:scene-1:abc123",
                kind: "scene_review_requested",
                title: "Review requested",
                details: "Requested approval before publish.",
                timestamp: 1710000000500,
                branchLabel: "review",
                lifecycleStage: "review",
              },
            ],
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
    expect(payload.summary).toContain("governance target");

    const historyResponse = await GET(createNextRequest("http://localhost/api/governance-archive"));
    expect(historyResponse.status).toBe(200);
    const historyPayload = await historyResponse.json();
    expect(historyPayload.ok).toBe(true);
    expect(historyPayload.historyCount).toBe(1);
    expect(historyPayload.latestSubmission?.sceneId).toBe("scene-1");
  });

  test("delivers governance handoffs to a configured webhook endpoint", async () => {
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
        createNextRequest("http://localhost/api/governance-archive", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: "debug-panel",
            submittedAt: 1710000003000,
            sceneId: "scene-1",
            sceneName: "Shop Floor",
            workspaceAccessSummary: {
              activeMemberLabel: "Reviewer · reviewer",
              modeLabel: "Shared workspace",
              teamSize: 4,
              reviewRouteLabel: "reviewer, privacy reviewer, admin",
              publishRouteLabel: "Publish requires review",
            },
            workspaceGovernanceSummary: {
              roleLabel: "Reviewer",
              approvalModeLabel: "Review required",
              sceneStatusLabel: "Review requested",
              canPublish: false,
              needsApproval: true,
              reviewAgeLabel: "5 min ago",
              reviewerLabel: "Reviewer",
            },
            governanceTrail: {
              totalEvents: 3,
              requestCount: 1,
              approvalCount: 1,
              rejectionCount: 0,
              annotationCount: 1,
              roleChangeCount: 0,
              policyChangeCount: 0,
              latestEvent: {
                id: "scene_review_approved:scene-1:def456",
                kind: "scene_review_approved",
                title: "Review approved",
                details: "Looks good to publish.",
                timestamp: 1710000002500,
                branchLabel: "review",
                lifecycleStage: "review",
              },
              recentEvents: [],
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
      expect(deliveredPayload.sceneId).toBe("scene-1");
      expect(deliveredPayload.governanceTrail.totalEvents).toBe(3);
      expect(deliveredPayload.deliveredAt).toBeTypeOf("number");
    } finally {
      server.close();
    }
  });
});
