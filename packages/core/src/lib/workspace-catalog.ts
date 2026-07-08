import { type OrganizationEntitlements, type OrganizationQuotas, createDefaultOrganization } from "../schema/organization";
import type { SecurityScene } from "../schema/security-scene";

export type WorkspaceVisibility = "private" | "shared" | "published";

export type SavedProjectRecord = {
  workspaceOrganization: string;
  workspaceOwner: string;
  workspaceVisibility: WorkspaceVisibility;
  pinned: boolean;
  scene: { id: string };
};

export type WorkspaceCatalogScope = "personal" | "shared" | "published" | "organization";

export type WorkspaceCatalogSummary = {
  activeSceneId: string | null;
  primaryOrganization: string;
  primaryOwner: string;
  primaryVisibility: SavedProjectRecord["workspaceVisibility"] | null;
  scopeLabel: string;
  scopeDetail: string;
  workspaceCount: number;
  organizationCount: number;
  ownerCount: number;
  pinnedCount: number;
  counts: {
    private: number;
    shared: number;
    published: number;
  };
  topOrganizations: Array<{ name: string; count: number }>;
  topOwners: Array<{ name: string; count: number }>;
  capabilities: {
    sharedWorkspaces: boolean;
    publishedWorkspaces: boolean;
    archiveRecovery: boolean;
    reportExports: boolean;
    scanIntake: boolean;
    liveEvidence: boolean;
  };
  notes: string[];
};

export type WorkspaceAccountSummary = {
  activeSceneId: string | null;
  accountName: string;
  ownerName: string;
  planLabel: string;
  planDetail: string;
  scopeLabel: string;
  scopeDetail: string;
  workspaceCount: number;
  softQuotaLabel: string;
  softQuotaExceeded: boolean;
  quotas: {
    private: number;
    shared: number;
    published: number;
    organizations: number;
    owners: number;
    pinned: number;
  };
  entitlements: {
    sharedWorkspaces: boolean;
    publishedWorkspaces: boolean;
    archiveRecovery: boolean;
    reportExports: boolean;
    scanIntake: boolean;
    liveEvidence: boolean;
    ownershipTransfer: boolean;
    invites: boolean;
  };
  notes: string[];
};

export type WorkspaceAccountPlanTier = "free" | "pro" | "enterprise";

export type WorkspaceAccountProfile = {
  accountName: string;
  ownerName: string;
  planTier: WorkspaceAccountPlanTier;
  quotas: OrganizationQuotas;
  entitlements: OrganizationEntitlements;
};

function topEntries(source: Map<string, number>) {
  return [...source.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

function pickWorkspaceScope(projects: SavedProjectRecord[]) {
  const counts = {
    private: 0,
    shared: 0,
    published: 0,
  };

  for (const project of projects) {
    counts[project.workspaceVisibility] += 1;
  }

  if (counts.published > 0) return "published" satisfies WorkspaceCatalogScope;
  if (counts.shared > 0) return "shared" satisfies WorkspaceCatalogScope;
  if (projects.length > 1) return "organization" satisfies WorkspaceCatalogScope;
  return "personal" satisfies WorkspaceCatalogScope;
}

export function createDefaultWorkspaceAccountProfile(summary?: Pick<WorkspaceCatalogSummary, "primaryOrganization" | "primaryOwner" | "capabilities" | "workspaceCount">): WorkspaceAccountProfile {
  const sharedEnabled = Boolean(summary?.capabilities.sharedWorkspaces);
  const publishedEnabled = Boolean(summary?.capabilities.publishedWorkspaces);
  const accountName = summary?.primaryOrganization ?? "Personal Workspace";
  const ownerName = summary?.primaryOwner ?? "You";
  
  const defaultOrg = createDefaultOrganization(ownerName, accountName);

  if (publishedEnabled) {
    defaultOrg.plan = "enterprise";
    defaultOrg.entitlements.publishedWorkspaces = true;
    defaultOrg.entitlements.sharedWorkspaces = true;
    defaultOrg.entitlements.invites = true;
    defaultOrg.quotas.maxWorkspaces = 16;
  } else if (sharedEnabled) {
    defaultOrg.plan = "pro";
    defaultOrg.entitlements.sharedWorkspaces = true;
    defaultOrg.entitlements.invites = true;
    defaultOrg.quotas.maxWorkspaces = 12;
  } else {
    defaultOrg.plan = "free";
    defaultOrg.quotas.maxWorkspaces = Math.max(6, summary?.workspaceCount ?? 1);
  }

  return {
    accountName: defaultOrg.name,
    ownerName: defaultOrg.ownerId,
    planTier: defaultOrg.plan,
    quotas: defaultOrg.quotas,
    entitlements: defaultOrg.entitlements,
  };
}

export function normalizeWorkspaceAccountProfile(raw: unknown, summary?: Pick<WorkspaceCatalogSummary, "primaryOrganization" | "primaryOwner" | "capabilities" | "workspaceCount">): WorkspaceAccountProfile {
  if (!raw || typeof raw !== "object") return createDefaultWorkspaceAccountProfile(summary);
  const candidate = raw as Partial<WorkspaceAccountProfile>;
  const fallback = createDefaultWorkspaceAccountProfile(summary);
  
  const planTier = candidate.planTier === "free" || candidate.planTier === "pro" || candidate.planTier === "enterprise"
    ? candidate.planTier
    : fallback.planTier;

  return {
    accountName: typeof candidate.accountName === "string" && candidate.accountName.trim() ? candidate.accountName.trim() : fallback.accountName,
    ownerName: typeof candidate.ownerName === "string" && candidate.ownerName.trim() ? candidate.ownerName.trim() : fallback.ownerName,
    planTier,
    quotas: candidate.quotas && typeof candidate.quotas === "object" ? { ...fallback.quotas, ...candidate.quotas } : fallback.quotas,
    entitlements: candidate.entitlements && typeof candidate.entitlements === "object" ? { ...fallback.entitlements, ...candidate.entitlements } : fallback.entitlements,
  };
}

export function summarizeWorkspaceCatalog(savedProjects: SavedProjectRecord[], activeSceneId?: string | null): WorkspaceCatalogSummary {
  const activeProject = savedProjects.find((project) => project.scene.id === activeSceneId) ?? savedProjects[0] ?? null;
  const organizationCounts = new Map<string, number>();
  const ownerCounts = new Map<string, number>();
  const counts = {
    private: 0,
    shared: 0,
    published: 0,
  };
  let pinnedCount = 0;

  for (const project of savedProjects) {
    organizationCounts.set(project.workspaceOrganization, (organizationCounts.get(project.workspaceOrganization) ?? 0) + 1);
    ownerCounts.set(project.workspaceOwner, (ownerCounts.get(project.workspaceOwner) ?? 0) + 1);
    counts[project.workspaceVisibility] += 1;
    if (project.pinned) pinnedCount += 1;
  }

  const topOrganizations = topEntries(organizationCounts);
  const topOwners = topEntries(ownerCounts);
  const scope = pickWorkspaceScope(savedProjects);
  const primaryOrganization = activeProject?.workspaceOrganization
    ?? topOrganizations[0]?.name
    ?? "Personal Workspace";
  const primaryOwner = activeProject?.workspaceOwner
    ?? topOwners[0]?.name
    ?? "You";
  const primaryVisibility = activeProject?.workspaceVisibility ?? null;
  const workspaceCount = savedProjects.length;
  const organizationCount = organizationCounts.size;
  const ownerCount = ownerCounts.size;
  const scopeLabel =
    scope === "published"
      ? "Published catalog"
      : scope === "shared"
        ? "Shared catalog"
        : scope === "organization"
          ? "Organization catalog"
          : "Personal catalog";
  const scopeDetail =
    scope === "personal"
      ? "Local-first personal workspace boundary"
      : scope === "shared"
        ? "Local-first shared workspace boundary"
        : scope === "published"
          ? "Local-first published workspace boundary"
          : "Local-first organization catalog bridge";

  return {
    activeSceneId: activeProject?.scene.id ?? activeSceneId ?? null,
    primaryOrganization,
    primaryOwner,
    primaryVisibility,
    scopeLabel,
    scopeDetail,
    workspaceCount,
    organizationCount,
    ownerCount,
    pinnedCount,
    counts,
    topOrganizations,
    topOwners,
    capabilities: {
      sharedWorkspaces: counts.shared > 0 || organizationCount > 1,
      publishedWorkspaces: counts.published > 0,
      archiveRecovery: workspaceCount > 0,
      reportExports: workspaceCount > 0,
      scanIntake: workspaceCount > 0,
      liveEvidence: counts.shared + counts.published > 0 || workspaceCount > 0,
    },
    notes: [
      "Local-first catalog bridge toward the canonical org/account boundary.",
      "Plan, billing, invites, and ownership transfer remain open.",
    ],
  };
}

export function summarizeWorkspaceAccount(savedProjects: SavedProjectRecord[], activeSceneId?: string | null, profile?: WorkspaceAccountProfile | null): WorkspaceAccountSummary {
  const catalog = summarizeWorkspaceCatalog(savedProjects, activeSceneId);
  const accountProfile = profile ?? createDefaultWorkspaceAccountProfile(catalog);
  const planLabel =
    accountProfile.planTier === "enterprise"
      ? "Enterprise workspace account"
      : accountProfile.planTier === "pro"
        ? "Pro workspace account"
        : "Free workspace account";
  const planDetail =
    accountProfile.planTier === "enterprise"
      ? "Enterprise workspace posture with local-first catalog visibility."
      : accountProfile.planTier === "pro"
        ? "Pro workspace posture with local-first collaboration bridge."
        : "Free workspace posture with local-only evidence and recovery.";
  const softQuotaLabel = `${catalog.workspaceCount}/${accountProfile.quotas.maxWorkspaces} workspaces`;

  return {
    activeSceneId: catalog.activeSceneId,
    accountName: accountProfile.accountName || catalog.primaryOrganization,
    ownerName: accountProfile.ownerName || catalog.primaryOwner,
    planLabel,
    planDetail,
    scopeLabel: catalog.scopeLabel,
    scopeDetail: catalog.scopeDetail,
    workspaceCount: catalog.workspaceCount,
    softQuotaLabel,
    softQuotaExceeded: catalog.workspaceCount > accountProfile.quotas.maxWorkspaces,
    quotas: {
      private: catalog.counts.private,
      shared: catalog.counts.shared,
      published: catalog.counts.published,
      organizations: catalog.organizationCount,
      owners: catalog.ownerCount,
      pinned: catalog.pinnedCount,
    },
    entitlements: {
      sharedWorkspaces: accountProfile.entitlements.sharedWorkspaces && catalog.capabilities.sharedWorkspaces,
      publishedWorkspaces: accountProfile.entitlements.publishedWorkspaces && catalog.capabilities.publishedWorkspaces,
      archiveRecovery: catalog.capabilities.archiveRecovery,
      reportExports: catalog.capabilities.reportExports,
      scanIntake: catalog.capabilities.scanIntake,
      liveEvidence: catalog.capabilities.liveEvidence,
      ownershipTransfer: accountProfile.entitlements.ownershipTransfer,
      invites: accountProfile.entitlements.invites,
    },
    notes: [
      "Local-first account bridge toward the canonical org/account model.",
      `Plan tier: ${accountProfile.planTier}.`,
      "Billing, invites, and ownership transfer remain open.",
    ],
  };
}

export function getDemoWorkspaceTitle(scene: SecurityScene, index: number): string {
  if (scene.source === "demo" && scene.name.toLowerCase().includes("retail")) return "Retail Store Reference";
  if (scene.source === "demo" && scene.name.toLowerCase().includes("office")) return "Office Lobby Reference";
  if (scene.source === "demo" && scene.name.toLowerCase().includes("warehouse")) return "Warehouse Reference";
  return scene.name || `Workspace ${index + 1}`;
}

export function getDemoWorkspaceDetail(scene: SecurityScene, defaultDetail: string, index: number): string {
  if (scene.source === "demo" && scene.name.toLowerCase().includes("retail")) return "Small retail shop with 5 cameras, 1 critical zone, and 1 entry point. Configured for coverage analysis.";
  if (scene.source === "demo" && scene.name.toLowerCase().includes("office")) return "Office lobby with 3 cameras, reception desk zone, and glass wall obstructions.";
  if (scene.source === "demo" && scene.name.toLowerCase().includes("warehouse")) return "Warehouse layout with 8 cameras, high-rack obstructions, and 3 critical zones.";
  return defaultDetail;
}
