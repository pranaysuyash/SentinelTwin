import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/workspace-control-plane/route";

describe("workspace-control-plane route", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "workspace-control-plane-"));
    process.env.SENTINELTWIN_WORKSPACE_CONTROL_PLANE_STORE_DIR = tempRoot;
  });

  afterEach(() => {
    delete process.env.SENTINELTWIN_WORKSPACE_CONTROL_PLANE_STORE_DIR;
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("archives a control-plane snapshot", async () => {
    const response = await POST(new NextRequest("http://localhost/api/workspace-control-plane", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "governance-tab",
        sceneId: "scene-1",
        sceneName: "Retail",
        access: { activeMemberId: "member_operator", members: [], policy: { mode: "single_user", publishRequiresApproval: true, privacySensitiveRequiresReviewer: true, requiredReviewerRoles: ["reviewer"] } },
        governance: { activeRole: "operator", approvalMode: "review_required", sceneStatus: "draft", requestedAt: null, requestedBy: null, reviewedAt: null, reviewedBy: null, publishedAt: null, publishedBy: null, reviewNotes: [] },
        account: { accountName: "Local", ownerName: "You", planTier: "free", quotas: { maxWorkspaces: 6, maxMembers: 3, maxStorageBytes: 1024 }, entitlements: { sharedWorkspaces: false, publishedWorkspaces: false, archiveRecovery: true, reportExports: true, scanIntake: true, liveEvidence: true, ownershipTransfer: false, invites: false } },
      }),
    }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; synced: boolean; sceneStatus: string; requestId: string; apiVersion: string; timestamp: string; errorCode?: string };
    expect(body.ok).toBe(true);
    expect(body.errorCode).toBeUndefined();
    expect(typeof body.requestId).toBe("string");
    expect(body.requestId).toBeTruthy();
    expect(body.apiVersion).toBe("1");
    expect(body.timestamp).toBeTruthy();
    expect(body.synced).toBe(true);
    expect(body.sceneStatus).toBe("draft");
  });

  test("lists archived control-plane snapshots", async () => {
    await POST(new NextRequest("http://localhost/api/workspace-control-plane", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "governance-tab", sceneId: "scene-1", sceneName: "Retail", access: {}, governance: {}, account: {} }),
    }));

    const response = await GET(new NextRequest("http://localhost/api/workspace-control-plane"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; requestId: string; apiVersion: string; timestamp: string; errorCode?: string };
    expect(body.ok).toBe(true);
    expect(body.errorCode).toBeUndefined();
    expect(typeof body.requestId).toBe("string");
    expect(body.requestId).toBeTruthy();
    expect(body.apiVersion).toBe("1");
    expect(body.timestamp).toBeTruthy();
  });

  test("returns validation metadata for malformed control-plane payloads", async () => {
    const response = await POST(new NextRequest("http://localhost/api/workspace-control-plane", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
    const body = await response.json() as { ok: boolean; errorCode: string; issues?: unknown[] };
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("validation_error");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues?.length).toBeGreaterThan(0);
  });
});
