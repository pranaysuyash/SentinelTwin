import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NextRequest } from "next/server";

import { GET, POST } from "../route";

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as unknown as NextRequest
);
const expectEnvelopeMetadata = (payload: Record<string, unknown>) => {
  expect(typeof payload.requestId).toBe("string");
  expect(payload.requestId).toBeTruthy();
  expect(payload.apiVersion).toBe("1");
  expect(payload.timestamp).toBeTruthy();
  expect(typeof payload.timestamp).toBe("string");
};

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
    const response = await POST(createNextRequest("http://localhost/api/workspace-identity-conflict", {
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
    expectEnvelopeMetadata(body);
    expect(body.ok).toBe(true);
    expect(body.historyCount).toBe(1);
    expect(body.conflictStatus).toBe("reconcile_needed");
    expect(body.resolutionStatus).toBe("reconcile_before_route");
    expect(body.summary).toContain("Reconcile membership before routing approval");
    expect(body.conflictDiff.title).toBe("Conflict Diff");
    expect(body.conflictDiff.rows.some((row: { label: string }) => row.label === "Active member")).toBe(true);

    const history = await GET(createNextRequest("http://localhost/api/workspace-identity-conflict"));
    const payload = await history.json();
    expectEnvelopeMetadata(payload);
    expect(payload.historyCount).toBe(1);
    expect(payload.latestSubmission.conflictStatus).toBe("reconcile_needed");
    expect(payload.latestSubmission.resolutionStatus).toBe("reconcile_before_route");
    expect(payload.latestSubmission.conflictDiff.title).toBe("Conflict Diff");
  });

  test("delivers conflict archives to a configured webhook endpoint", async () => {
    const receivedRequests: Array<{ url: string; method: string; body: unknown }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const bodyText = typeof init?.body === "string"
        ? init.body
        : input instanceof Request
          ? await input.clone().text()
          : "";
      receivedRequests.push({
        url,
        method,
        body: bodyText ? JSON.parse(bodyText) : null,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const response = await POST(createNextRequest("http://localhost/api/workspace-identity-conflict", {
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
          destinations: [{ label: "Remote identity webhook", endpoint: "http://example.com/webhook", mode: "webhook" }],
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.archiveStatus).toBe("server archive");
      expect(body.deliveredCount).toBe(1);
      expect(body.conflictStatus).toBe("archive_pending");
      expect(body.resolutionStatus).toBe("archive_pending");
      expect(receivedRequests).toHaveLength(1);
      expect(receivedRequests[0]?.url).toBe("http://example.com/webhook");
      expect(receivedRequests[0]?.method).toBe("POST");
      expect((receivedRequests[0]?.body as { conflictStatus?: string } | null)?.conflictStatus).toBe("archive_pending");
      expect((receivedRequests[0]?.body as { resolutionStatus?: string } | null)?.resolutionStatus).toBe("archive_pending");
      expect((receivedRequests[0]?.body as { recommendedAction?: string } | null)?.recommendedAction).toBe("Create an archived membership snapshot.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects invalid payloads", async () => {
    const response = await POST(createNextRequest("http://localhost/api/workspace-identity-conflict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceAccessState: { members: [{ id: "member_admin" }] } }),
    }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.errorCode).toBe("validation_error");
    expect(payload.error).toContain("Invalid workspace identity conflict payload");
  });
});
