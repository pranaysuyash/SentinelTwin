import { getOrganizationManager } from "@/lib/organization-store";
import type { OrganizationEntitlements, OrganizationQuotas } from "@/schema/organization";

export type EntitlementGuardResult = {
  allowed: boolean;
  reason: string;
};

export function guardSharedWorkspace(): EntitlementGuardResult {
  const mgr = getOrganizationManager();
  return mgr.checkEntitlement("sharedWorkspaces");
}

export function guardPublishedWorkspace(): EntitlementGuardResult {
  const mgr = getOrganizationManager();
  return mgr.checkEntitlement("publishedWorkspaces");
}

export function guardScanIntake(): EntitlementGuardResult {
  const mgr = getOrganizationManager();
  return mgr.checkEntitlement("scanIntake");
}

export function guardLiveEvidence(): EntitlementGuardResult {
  const mgr = getOrganizationManager();
  return mgr.checkEntitlement("liveEvidence");
}

export function guardOwnershipTransfer(): EntitlementGuardResult {
  const mgr = getOrganizationManager();
  return mgr.checkEntitlement("ownershipTransfer");
}

export function guardInvite(): EntitlementGuardResult {
  const mgr = getOrganizationManager();
  return mgr.checkEntitlement("invites");
}

export function guardWorkspaceCountQuota(currentCount: number): EntitlementGuardResult {
  const mgr = getOrganizationManager();
  return mgr.checkQuota("maxWorkspaces", currentCount);
}

export function guardMemberCountQuota(currentCount: number): EntitlementGuardResult {
  const mgr = getOrganizationManager();
  return mgr.checkQuota("maxMembers", currentCount);
}

export function guardVisibilityChange(currentVisibility: string, targetVisibility: string): EntitlementGuardResult {
  if (currentVisibility === targetVisibility) return { allowed: true, reason: "No change in visibility." };

  const upgradeRank: Record<string, number> = { private: 0, shared: 1, published: 2 };

  const currentRank = upgradeRank[currentVisibility] ?? 0;
  const targetRank = upgradeRank[targetVisibility] ?? 0;

  if (targetRank <= currentRank) {
    return { allowed: true, reason: `Downgrade from ${currentVisibility} to ${targetVisibility} is always allowed.` };
  }

  if (targetVisibility === "shared") {
    const mgr = getOrganizationManager();
    const org = mgr.getActiveOrganization();
    if (!org) return { allowed: false, reason: "No active organization. Select an organization before sharing." };
    return guardSharedWorkspace();
  }

  if (targetVisibility === "published") {
    const mgr = getOrganizationManager();
    const org = mgr.getActiveOrganization();
    if (!org) return { allowed: false, reason: "No active organization. Select an organization before publishing." };
    return guardPublishedWorkspace();
  }

  return { allowed: true, reason: `Visibility change to ${targetVisibility} is permitted.` };
}
