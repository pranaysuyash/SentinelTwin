import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { NextRequest } from "next/server";

import { GET, POST } from "../route";

const createNextRequest = (url: string, init?: RequestInit): NextRequest => (
  new Request(url, init) as any as unknown as any
);

function createTempRoot() {
  return mkdtempSync(join(tmpdir(), "sentineltwin-workspace-membership-archive-"));
}

describe("workspace-membership-archive route", () => {
  const originalStoreDir = process.env.SENTINELTWIN_WORKSPACE_MEMBERSHIP_ARCHIVE_STORE_DIR;
  let tempRoot = "";

  beforeEach(() => {
    tempRoot = createTempRoot();
    process.env.SENTINELTWIN_WORKSPACE_MEMBERSHIP_ARCHIVE_STORE_DIR = tempRoot;
  });

  afterEach(() => {
    process.env.SENTINELTWIN_WORKSPACE_MEMBERSHIP_ARCHIVE_STORE_DIR = originalStoreDir;
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  });

  test("queues a workspace membership handoff and persists archive history", async () => {
    const response = await POST(createNextRequest("http://localhost/api/workspace-membership-archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "debug-panel",
        submittedAt: 1_725_000_000_000,
        sceneId: "scene-membership",
        sceneName: "Membership Scene",
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
          requestedAt: 1_725_000_000_000,
          requestedBy: "operator",
          reviewedAt: null,
          reviewedBy: null,
          publishedAt: null,
          publishedBy: null,
          reviewNotes: ["Membership routed for approval."],
        },
        approvalRoute: {
          routeStatus: "review_required",
          routeSyncMode: "archive_backed",
          routeSyncLabel: "Archive-backed replay",
          routeSyncReason: "Approval routing is replayed against an archived membership snapshot so shared-identity handoffs can be compared or delivered.",
          routeLabel: "Route approval to reviewer",
          routeReason: "Approval should route through reviewer before publish.",
          targetReviewerLabel: "reviewer",
          activeMemberLabel: "Reviewer · reviewer",
          archivedMemberLabel: "Reviewer · reviewer",
          currentPolicyLabel: "Shared workspace",
          archivedPolicyLabel: "Shared workspace",
          drift: null,
          hasPrivacyExposure: false,
        },
        destinations: [{ label: "Local relay", mode: "archive" }],
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.archiveStatus).toBe("local cache");
    expect(body.historyCount).toBe(1);
    expect(body.activeMemberLabel).toContain("Reviewer");
    expect(body.summary).toContain("shared workspace membership");
    expect(body.workspaceAccessState.members).toHaveLength(2);
    expect(body.workspaceGovernanceState.activeRole).toBe("reviewer");
    expect(body.approvalRoute.routeStatus).toBe("review_required");
    expect(body.approvalRoute.routeSyncMode).toBe("archive_backed");

    const archive = await GET(createNextRequest("http://localhost/api/workspace-membership-archive"));
    const archiveBody = await archive.json();
    expect(archiveBody.historyCount).toBe(1);
    expect(archiveBody.latestSubmission.sceneId).toBe("scene-membership");
    expect(archiveBody.latestSubmission.approvalRoute.routeStatus).toBe("review_required");
    expect(readFileSync(join(tempRoot, ".workspace-membership-archive", "workspace-membership-archive-history.json"), "utf8")).toContain("scene-membership");
  });

  test("delivers workspace membership handoffs to a configured webhook endpoint", async () => {
    const received: unknown[] = [];
    const server = Bun.serve({
      port: 0,
      fetch: async (req) => {
        received.push(await req.json());
        return new Response("ok");
      },
    });

    try {
      const response = await POST(createNextRequest("http://localhost/api/workspace-membership-archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "debug-panel",
          submittedAt: 1_725_000_001_000,
          sceneId: "scene-membership-webhook",
          sceneName: "Membership Webhook Scene",
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
            publishedAt: 1_725_000_001_000,
            publishedBy: "admin",
            reviewNotes: [],
          },
          approvalRoute: {
            routeStatus: "open_publish",
            routeSyncMode: "local_only",
            routeSyncLabel: "Local-only routing",
            routeSyncReason: "Approval routing is computed only from the live workspace state and has no archived membership snapshot yet.",
            routeLabel: "Open publish route",
            routeReason: "Publish can route directly because the workspace is open and aligned.",
            targetReviewerLabel: "admin",
            activeMemberLabel: "Admin · admin",
            archivedMemberLabel: "Admin · admin",
            currentPolicyLabel: "Single-user workspace",
            archivedPolicyLabel: "Single-user workspace",
            drift: null,
            hasPrivacyExposure: false,
          },
          destinations: [{ label: "Remote membership webhook", endpoint: `http://127.0.0.1:${server.port}`, mode: "webhook" }],
        }),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.archiveStatus).toBe("server archive");
      expect(body.deliveredCount).toBe(1);
      expect(body.queuedCount).toBe(0);
      expect(body.approvalRoute.routeStatus).toBe("open_publish");
      expect(body.approvalRoute.routeSyncMode).toBe("local_only");
      expect(received).toHaveLength(1);
      expect((received[0] as { workspaceAccess?: { activeMemberId?: string }; approvalRoute?: { routeStatus?: string } }).workspaceAccess?.activeMemberId).toBe("member_admin");
      expect((received[0] as { approvalRoute?: { routeStatus?: string } }).approvalRoute?.routeStatus).toBe("open_publish");
    } finally {
      server.stop(true);
    }
  });
});
