import { describe, expect, test } from "bun:test";

import {
  OrganizationManager,
  resetOrganizationManagerForTesting,
} from "@/lib/organization-store";
import {
  createDefaultOrganization,
  checkOrganizationEntitlement,
  checkOrganizationQuota,
  upgradeOrganizationPlan,
} from "@/schema/organization";

describe("OrganizationManager", () => {
  test("creates a fresh manager with seeded default org", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const orgs = mgr.getOrganizations();
    expect(orgs.length).toBeGreaterThanOrEqual(1);
    expect(orgs[0].name).toBe("Personal Workspace");
    expect(orgs[0].plan).toBe("free");
    expect(orgs[0].members.length).toBe(1);
    expect(orgs[0].members[0].role).toBe("owner");
    expect(orgs[0].members[0].name).toBe("You");
  });

  test("does not re-seed when orgs already exist", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const count = mgr.getOrganizations().length;
    mgr.seedLocalOrgsIfEmpty();
    expect(mgr.getOrganizations().length).toBe(count);
  });

  test("adds a new organization", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const org = mgr.addOrganization("North Region Security", "pranay", "pro");
    expect(org.name).toBe("North Region Security");
    expect(org.plan).toBe("pro");
    expect(org.ownerId).toBe("pranay");
    expect(org.members.length).toBe(1);

    const orgs = mgr.getOrganizations();
    expect(orgs.length).toBe(2);
    expect(orgs.some((o) => o.name === "North Region Security")).toBe(true);
  });

  test("updates an organization", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const original = mgr.getOrganizations()[0];

    const result = mgr.updateOrganization(original.id, { name: "Renamed Workspace", plan: "enterprise" });
    expect(result.success).toBe(true);

    const updated = mgr.getOrganization(original.id);
    expect(updated?.name).toBe("Renamed Workspace");
    expect(updated?.plan).toBe("enterprise");
  });

  test("returns error for update of non-existent org", () => {
    const mgr = new OrganizationManager();
    const result = mgr.updateOrganization("nonexistent", { name: "test" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  test("removes an organization and switches active org", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const firstId = mgr.getOrganizations()[0].id;
    mgr.addOrganization("Second Org", "user", "pro");
    const secondId = mgr.getOrganizations().find((o) => o.id !== firstId)!.id;
    mgr.setActiveOrganization(secondId);

    const result = mgr.removeOrganization(firstId);
    expect(result.success).toBe(true);
    expect(mgr.getOrganizations().length).toBe(1);
    expect(mgr.getActiveOrganizationId()).toBe(secondId);
  });

  test("removes the active org and falls back to first available", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const id = mgr.getOrganizations()[0].id;
    mgr.addOrganization("Fallback Org", "user", "free");
    mgr.setActiveOrganization(id);

    mgr.removeOrganization(id);
    const activeId = mgr.getActiveOrganizationId();
    expect(activeId).toBe(mgr.getOrganizations()[0].id);
    expect(mgr.getOrganization(activeId!)?.name).toBe("Fallback Org");
  });

  test("sets and changes active organization", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const firstId = mgr.getOrganizations()[0].id;
    mgr.addOrganization("Primary Org", "user", "enterprise");

    const newOrg = mgr.getOrganizations().find((o) => o.id !== firstId)!;
    const result = mgr.setActiveOrganization(newOrg.id);
    expect(result.success).toBe(true);
    expect(mgr.getActiveOrganizationId()).toBe(newOrg.id);
    expect(mgr.getActiveOrganization()?.name).toBe("Primary Org");
  });

  test("returns error for setting non-existent active org", () => {
    const mgr = new OrganizationManager();
    const result = mgr.setActiveOrganization("nonexistent");
    expect(result.success).toBe(false);
  });

  test("adds and removes members on a pro org with capacity", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const proOrg = mgr.addOrganization("Team Org", "local-user", "pro");
    const orgId = proOrg.id;

    const addResult = mgr.addMember(orgId, { id: "alice", name: "Alice", role: "admin" });
    expect(addResult.success).toBe(true);

    const org = mgr.getOrganization(orgId);
    expect(org?.members.length).toBe(2);
    expect(org?.members.some((m) => m.name === "Alice")).toBe(true);

    const removeResult = mgr.removeMember(orgId, "alice");
    expect(removeResult.success).toBe(true);
    expect(mgr.getOrganization(orgId)?.members.length).toBe(1);
  });

  test("prevents adding members beyond quota on free plan", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const freeOrg = mgr.getOrganizations()[0];
    const orgId = freeOrg.id;

    const result = mgr.addMember(orgId, { id: "alice", name: "Alice", role: "member" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Member limit");
  });

  test("prevents removing the owner", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const orgId = mgr.getOrganizations()[0].id;
    const ownerId = mgr.getOrganization(orgId)!.members.find((m) => m.role === "owner")!.id;

    const result = mgr.removeMember(orgId, ownerId);
    expect(result.success).toBe(false);
    expect(result.error).toContain("owner");
  });

  test("checks entitlements against the active org", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();

    const freeOrg = mgr.getOrganizations()[0];
    mgr.setActiveOrganization(freeOrg.id);

    const sharedCheck = mgr.checkEntitlement("sharedWorkspaces");
    expect(sharedCheck.allowed).toBe(false);
    expect(sharedCheck.reason).toContain("does not include");

    const archiveCheck = mgr.checkEntitlement("archiveRecovery");
    expect(archiveCheck.allowed).toBe(true);
  });

  test("checks entitlements against a specific org", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const proOrg = mgr.addOrganization("Pro Org", "user", "pro");

    const check = mgr.checkEntitlement("sharedWorkspaces", proOrg.id);
    expect(check.allowed).toBe(true);
  });

  test("checks quotas against the active org", () => {
    const mgr = new OrganizationManager();
    mgr.seedLocalOrgsIfEmpty();
    const freeOrg = mgr.getOrganizations()[0];

    const withinQuota = mgr.checkQuota("maxWorkspaces", 1, freeOrg.id);
    expect(withinQuota.allowed).toBe(true);

    const exceededQuota = mgr.checkQuota("maxWorkspaces", 999, freeOrg.id);
    expect(exceededQuota.allowed).toBe(false);
  });

  test("returns error for entitlement check with no active org", () => {
    const mgr = new OrganizationManager();
    const check = mgr.checkEntitlement("reportExports");
    expect(check.allowed).toBe(false);
  });
});

describe("organization creation helpers", () => {
  test("createDefaultOrganization creates a free org", () => {
    const org = createDefaultOrganization("user1", "Test Org");
    expect(org.name).toBe("Test Org");
    expect(org.plan).toBe("free");
    expect(org.ownerId).toBe("user1");
    expect(org.entitlements.archiveRecovery).toBe(true);
    expect(org.entitlements.sharedWorkspaces).toBe(false);
    expect(org.quotas.maxWorkspaces).toBe(3);
  });

  test("upgradeOrganizationPlan upgrades free to enterprise", () => {
    const free = createDefaultOrganization("user1", "Upgrade Me");
    const enterprise = upgradeOrganizationPlan(free, "enterprise");
    expect(enterprise.id).toBe(free.id);
    expect(enterprise.plan).toBe("enterprise");
    expect(enterprise.entitlements.sharedWorkspaces).toBe(true);
    expect(enterprise.entitlements.publishedWorkspaces).toBe(true);
    expect(enterprise.quotas.maxWorkspaces).toBe(50);
  });

  test("checkOrganizationEntitlement returns correct value", () => {
    const org = createDefaultOrganization("user1", "Test");
    expect(checkOrganizationEntitlement(org, "reportExports")).toBe(true);
    expect(checkOrganizationEntitlement(org, "sharedWorkspaces")).toBe(false);
    expect(checkOrganizationEntitlement(org, "invites")).toBe(false);
  });

  test("checkOrganizationQuota returns correct value", () => {
    const org = createDefaultOrganization("user1", "Test");
    expect(checkOrganizationQuota(org, "maxWorkspaces", 0)).toBe(true);
    expect(checkOrganizationQuota(org, "maxWorkspaces", 2)).toBe(true);
    expect(checkOrganizationQuota(org, "maxWorkspaces", 3)).toBe(false);
    expect(checkOrganizationQuota(org, "maxWorkspaces", 10)).toBe(false);
  });
});
