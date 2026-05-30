import { describe, expect, test, beforeEach } from "bun:test";

import { getOrganizationManager, resetOrganizationManagerForTesting } from "@/lib/organization-store";
import {
  guardSharedWorkspace,
  guardPublishedWorkspace,
  guardScanIntake,
  guardLiveEvidence,
  guardWorkspaceCountQuota,
  guardVisibilityChange,
} from "@/lib/entitlement-guards";

beforeEach(() => {
  resetOrganizationManagerForTesting();
  const mgr = getOrganizationManager();
  mgr.seedLocalOrgsIfEmpty();
});

describe("entitlement guards", () => {
  test("shared workspace guard denies on free plan", () => {
    const result = guardSharedWorkspace();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("does not include");
  });

  test("published workspace guard denies on free plan", () => {
    const result = guardPublishedWorkspace();
    expect(result.allowed).toBe(false);
  });

  test("scan intake guard denies on free plan", () => {
    const result = guardScanIntake();
    expect(result.allowed).toBe(false);
  });

  test("live evidence guard denies on free plan", () => {
    const result = guardLiveEvidence();
    expect(result.allowed).toBe(false);
  });

  test("workspace count quota guard allows within limit", () => {
    const result = guardWorkspaceCountQuota(0);
    expect(result.allowed).toBe(true);
  });

  test("workspace count quota guard denies when exceeded", () => {
    const result = guardWorkspaceCountQuota(999);
    expect(result.allowed).toBe(false);
  });

  test("visibility change to shared is denied on free plan", () => {
    const result = guardVisibilityChange("private", "shared");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("does not include");
  });

  test("visibility change to published is denied on free plan", () => {
    const result = guardVisibilityChange("private", "published");
    expect(result.allowed).toBe(false);
  });

  test("visibility change to private is always allowed", () => {
    const result = guardVisibilityChange("shared", "private");
    expect(result.allowed).toBe(true);
  });

  test("visibility change downgrade is always allowed", () => {
    const result = guardVisibilityChange("published", "private");
    expect(result.allowed).toBe(true);
  });

  test("visibility change no-op is always allowed", () => {
    const result = guardVisibilityChange("private", "private");
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("No change");
  });

  test("entitlements pass on pro plan", () => {
    const mgr = getOrganizationManager();
    mgr.addOrganization("Pro Org", "user", "pro");
    const proOrg = mgr.getOrganizations().find((o) => o.plan === "pro")!;
    mgr.setActiveOrganization(proOrg.id);

    expect(guardSharedWorkspace().allowed).toBe(true);
    expect(guardScanIntake().allowed).toBe(true);
    expect(guardLiveEvidence().allowed).toBe(true);
  });

  test("entitlements pass on enterprise plan", () => {
    const mgr = getOrganizationManager();
    mgr.addOrganization("Enterprise Org", "user", "enterprise");
    const entOrg = mgr.getOrganizations().find((o) => o.plan === "enterprise")!;
    mgr.setActiveOrganization(entOrg.id);

    expect(guardSharedWorkspace().allowed).toBe(true);
    expect(guardPublishedWorkspace().allowed).toBe(true);
    expect(guardScanIntake().allowed).toBe(true);
    expect(guardLiveEvidence().allowed).toBe(true);
  });
});
