import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GET, POST } from "../route";

const originalStoreDir = process.env.SENTINELTWIN_WORKSPACE_IDENTITY_CONFLICT_STORE_DIR;
const testStoreDir = mkdtempSync(join(tmpdir(), "sentineltwin-workspace-identity-conflict-"));

process.env.SENTINELTWIN_WORKSPACE_IDENTITY_CONFLICT_STORE_DIR = testStoreDir;

afterAll(() => {
  rmSync(testStoreDir, { recursive: true, force: true });
  if (typeof originalStoreDir === "undefined") {
    delete process.env.SENTINELTWIN_WORKSPACE_IDENTITY_CONFLICT_STORE_DIR;
  } else {
    process.env.SENTINELTWIN_WORKSPACE_IDENTITY_CONFLICT_STORE_DIR = originalStoreDir;
  }
});

describe("workspace-identity-conflict route", () => {
  test("archives the workspace identity conflict state and persists history", async () => {
    const response = await POST(new Request("http://localhost/api/workspace-identity-conflict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "governance-panel",
        submittedAt: 1_725_000_004_000,
        sceneId: "scene-conflict",
        sceneName: "Conflict Scene",
        hasPrivacyExposure: false,
        workspaceAccessState: {
          activeMemberId: "member_reviewer",
          members: [
            {
              id: "member_reviewer",
              displayName: "Reviewer",
              role: "reviewer",
              clearance: "restricted",
              tags: ["review"],
              canPublish: true,
              canReview: true,
              canRestore: true,
            },
          ],
          policy: {
            mode: "shared",
            publishRequiresApproval: true,
            privacySensitiveRequiresReviewer: true,
            requiredReviewerRoles: ["reviewer", "admin"],
          },
        },
        workspaceGovernanceState: {
          activeRole: "reviewer",
          approvalMode: "review_required",
          sceneStatus: "draft",
          requestedAt: null,
          requestedBy: null,
          reviewedAt: null,
          reviewedBy: null,
          publishedAt: null,
          publishedBy: null,
          reviewNotes: [],
        },
        archivedWorkspaceAccessState: {
          activeMemberId: "member_operator",
          members: [
            {
              id: "member_operator",
              displayName: "Operator",
              role: "operator",
              clearance: "standard",
              tags: ["field"],
              canPublish: true,
              canReview: false,
              canRestore: true,
            },
          ],
          policy: {
            mode: "single_user",
            publishRequiresApproval: true,
            privacySensitiveRequiresReviewer: true,
            requiredReviewerRoles: ["reviewer", "admin"],
          },
        },
        destinations: [{ label: "Local relay", mode: "archive" }],
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.historyCount).toBe(1);
    expect(body.conflictStatus).toBe("reconcile_needed");
    expect(body.resolutionStatus).toBe("reconcile_before_route");
    expect(body.summary).toContain("Reconcile membership before routing approval");

    const history = await GET();
    const payload = await history.json();
    expect(payload.historyCount).toBe(1);
    expect(payload.latestSubmission.conflictStatus).toBe("reconcile_needed");
    expect(payload.latestSubmission.resolutionStatus).toBe("reconcile_before_route");
  });

  test("delivers conflict archives to a configured webhook endpoint", async () => {
    const receivedBodies: unknown[] = [];
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => {
        receivedBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
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

      const response = await POST(new Request("http://localhost/api/workspace-identity-conflict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "governance-panel",
          submittedAt: 1_725_000_005_000,
          sceneId: "scene-conflict-webhook",
          sceneName: "Conflict Webhook Scene",
          hasPrivacyExposure: false,
          workspaceAccessState: {
            activeMemberId: "member_admin",
            members: [
              {
                id: "member_admin",
                displayName: "Admin",
                role: "admin",
                clearance: "restricted",
                tags: ["owner"],
                canPublish: true,
                canReview: true,
                canRestore: true,
              },
            ],
            policy: {
              mode: "single_user",
              publishRequiresApproval: false,
              privacySensitiveRequiresReviewer: false,
              requiredReviewerRoles: ["admin"],
            },
          },
          workspaceGovernanceState: {
            activeRole: "admin",
            approvalMode: "open",
            sceneStatus: "published",
            requestedAt: null,
            requestedBy: null,
            reviewedAt: null,
            reviewedBy: null,
            publishedAt: 1_725_000_005_000,
            publishedBy: "admin",
            reviewNotes: [],
          },
          destinations: [{ label: "Remote identity webhook", endpoint: `http://127.0.0.1:${address.port}/webhook`, mode: "webhook" }],
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.archiveStatus).toBe("server archive");
      expect(body.deliveredCount).toBe(1);
      expect(body.conflictStatus).toBe("archive_pending");
      expect(body.resolutionStatus).toBe("archive_pending");
      expect(receivedBodies).toHaveLength(1);
      expect((receivedBodies[0] as { conflictStatus?: string }).conflictStatus).toBe("archive_pending");
      expect((receivedBodies[0] as { resolutionStatus?: string }).resolutionStatus).toBe("archive_pending");
      expect((receivedBodies[0] as { recommendedAction?: string }).recommendedAction).toBe("Create an archived membership snapshot.");
    } finally {
      server.close();
    }
  });
});
