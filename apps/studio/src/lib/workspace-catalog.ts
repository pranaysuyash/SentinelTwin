import type { SavedProjectRecord } from "@/store/studio-store";

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
