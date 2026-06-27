import { describe, expect, test, beforeEach } from "bun:test";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

import { db } from "@/lib/backend-database";
import { getOrganizationManager, resetOrganizationManagerForTesting } from "@/lib/organization-store";
import { createWorkspaceInvite, isWorkspaceInviteExpired } from "@/schema/workspace-invite";
import { GET as inviteGet, POST as invitePost } from "@/app/api/workspace-invite/route";
import { GET as transferGet, POST as transferPost } from "@/app/api/ownership-transfer/route";

function jsonRequest(method: "GET" | "POST", url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function setupProOrg() {
  resetOrganizationManagerForTesting();
  const mgr = getOrganizationManager();
  mgr.seedLocalOrgsIfEmpty();
  mgr.addOrganization("Pro Org", "test-user", "pro");
  const proOrg = mgr.getOrganizations().find((o) => o.plan === "pro")!;
  mgr.setActiveOrganization(proOrg.id);
  return proOrg;
}

describe("workspace governance routes", () => {
  beforeEach(() => {
    setupProOrg();
    // clear the in-memory FS-backed collections managed by BackendDatabase
    const collections = [
      "users", "workspaces", "members", "scenes", "drafts", "reports",
      "audit_logs", "comments", "conflicts", "invites", "ownership_transfers",
    ];
    for (const name of collections) {
      const path = join(db["dataDir"], `${name}.json`);
      if (existsSync(path)) {
        rmSync(path);
      }
    }
    // re-init empty collections
    for (const name of collections) {
      db["initCollection"](name);
    }
  });

  test("invite route creates a pending invite", async () => {
    const req = jsonRequest("POST", "http://localhost/api/workspace-invite", {
      action: "create",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      organizationId: "22222222-2222-2222-2222-222222222222",
      inviterId: "owner-user",
      inviteeEmail: "new@example.com",
      role: "operator",
    });

    const res = await invitePost(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invite.status).toBe("pending");
    expect(body.invite.workspaceId).toBe("11111111-1111-1111-1111-111111111111");
    expect(body.invite.role).toBe("operator");
  });

  test("invite route accepts an existing pending invite", async () => {
    const invite = createWorkspaceInvite(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "owner-user",
      "new@example.com",
      "operator",
    );
    db.createInvite(invite);

    const req = jsonRequest("POST", "http://localhost/api/workspace-invite", {
      action: "accept",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      organizationId: "22222222-2222-2222-2222-222222222222",
      inviteId: invite.id,
    });

    const res = await invitePost(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invite.status).toBe("accepted");
  });

  test("invite route rejects accepting a non-pending invite", async () => {
    const invite = createWorkspaceInvite(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "owner-user",
      "new@example.com",
      "operator",
    );
    invite.status = "accepted";
    db.createInvite(invite);

    const req = jsonRequest("POST", "http://localhost/api/workspace-invite", {
      action: "accept",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      organizationId: "22222222-2222-2222-2222-222222222222",
      inviteId: invite.id,
    });

    const res = await invitePost(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("invalid_state");
  });

  test("invite GET lists invites for workspace", async () => {
    const invite = createWorkspaceInvite(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "owner-user",
      "new@example.com",
      "operator",
    );
    db.createInvite(invite);

    const req = new Request(
      "http://localhost/api/workspace-invite?workspaceId=11111111-1111-1111-1111-111111111111&organizationId=22222222-2222-2222-2222-222222222222",
    );

    const res = await inviteGet(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.invites).toHaveLength(1);
    expect(body.invites[0].id).toBe(invite.id);
  });

  test("ownership transfer route creates a requested transfer", async () => {
    const req = jsonRequest("POST", "http://localhost/api/ownership-transfer", {
      action: "request",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      fromOwnerId: "old-owner",
      toOwnerId: "new-owner",
    });

    const res = await transferPost(req as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.transfer.status).toBe("requested");
    expect(body.transfer.fromOwnerId).toBe("old-owner");
    expect(body.transfer.toOwnerId).toBe("new-owner");
  });

  test("ownership transfer route blocks duplicate in-progress transfer", async () => {
    const req1 = jsonRequest("POST", "http://localhost/api/ownership-transfer", {
      action: "request",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      fromOwnerId: "old-owner",
      toOwnerId: "new-owner",
    });
    const req2 = jsonRequest("POST", "http://localhost/api/ownership-transfer", {
      action: "request",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      fromOwnerId: "old-owner",
      toOwnerId: "new-owner",
    });

    await transferPost(req1 as unknown as import("next/server").NextRequest);
    const res2 = await transferPost(req2 as unknown as import("next/server").NextRequest);
    const body = await res2.json();

    expect(res2.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("duplicate_transfer");
  });

  test("ownership transfer route completes an existing transfer", async () => {
    const createReq = jsonRequest("POST", "http://localhost/api/ownership-transfer", {
      action: "request",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      fromOwnerId: "old-owner",
      toOwnerId: "new-owner",
    });

    const createRes = await transferPost(createReq as unknown as import("next/server").NextRequest);
    const created = await createRes.json();

    const completeReq = jsonRequest("POST", "http://localhost/api/ownership-transfer", {
      action: "complete",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      transferId: created.transfer.id,
    });

    const res = await transferPost(completeReq as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.transfer.status).toBe("completed");
    expect(body.transfer.completedAt).toBeTypeOf("number");
  });

  test("ownership transfer GET returns active transfer", async () => {
    const req = jsonRequest("POST", "http://localhost/api/ownership-transfer", {
      action: "request",
      workspaceId: "11111111-1111-1111-1111-111111111111",
      fromOwnerId: "old-owner",
      toOwnerId: "new-owner",
    });

    await transferPost(req as unknown as import("next/server").NextRequest);

    const getReq = new Request("http://localhost/api/ownership-transfer?workspaceId=11111111-1111-1111-1111-111111111111");
    const res = await transferGet(getReq as unknown as import("next/server").NextRequest);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.transfer).not.toBeNull();
    expect(body.transfer.status).toBe("requested");
  });
});
