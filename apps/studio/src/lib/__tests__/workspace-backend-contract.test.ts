import { describe, expect, test } from "bun:test";
import { createWorkspaceBackendContract, createApprovalTransition, canUserPublish, canUserInvite, canUserDelete, getEffectiveRole } from "@/lib/workspace-backend-contract";

describe("workspace backend contract parity", () => {
  test("creates contract with owner member", () => {
    const contract = createWorkspaceBackendContract("ws-1", "Test", "user-1", "u@t.com", "U");
    expect(contract.members).toHaveLength(1);
    expect(contract.members[0].role).toBe("owner");
  });

  test("owner has all permissions", () => {
    const c = createWorkspaceBackendContract("ws-2", "T", "u1", "u@t.com", "U");
    const owner = c.members[0];
    expect(canUserPublish(owner, c.policy)).toBe(true);
    expect(canUserInvite(owner, c.policy)).toBe(true);
    expect(canUserDelete(owner, c.policy)).toBe(true);
  });

  test("viewer has no permissions", () => {
    const c = createWorkspaceBackendContract("ws-3", "T", "u1", "u@t.com", "U");
    const v = { ...c.members[0], role: "viewer" as const };
    expect(canUserPublish(v, c.policy)).toBe(false);
    expect(canUserInvite(v, c.policy)).toBe(false);
    expect(canUserDelete(v, c.policy)).toBe(false);
  });

  test("null member returns viewer role", () => {
    expect(getEffectiveRole(null)).toBe("viewer");
  });

  test("creates approval transition with pending status", () => {
    const t = createApprovalTransition("ws-1", "user-1", "Test transition");
    expect(t.status).toBe("pending");
    expect(t.workspaceId).toBe("ws-1");
    expect(t.requestedBy).toBe("user-1");
  });

  test("approval transition has unique id", () => {
    const a = createApprovalTransition("ws-1", "u1", "A");
    const b = createApprovalTransition("ws-1", "u1", "B");
    expect(a.id).not.toBe(b.id);
  });
});
