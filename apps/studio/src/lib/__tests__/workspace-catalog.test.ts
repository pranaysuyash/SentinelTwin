import { describe, expect, test } from "bun:test";

import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { summarizeWorkspaceCatalog } from "@/lib/workspace-catalog";
import type { SavedProjectRecord } from "@/store/studio-store";

function makeProject(overrides: Partial<SavedProjectRecord>): SavedProjectRecord {
  const scene = overrides.scene ?? createBlankSecurityScene();
  return {
    scene,
    folder: overrides.folder ?? "Unsorted",
    tags: overrides.tags ?? [],
    pinned: overrides.pinned ?? false,
    workspaceOrganization: overrides.workspaceOrganization ?? "Personal Workspace",
    workspaceOwner: overrides.workspaceOwner ?? "You",
    workspaceVisibility: overrides.workspaceVisibility ?? "private",
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    lastOpenedAt: overrides.lastOpenedAt ?? null,
  };
}

describe("workspace catalog", () => {
  test("summarizes the local catalog boundary and scope", () => {
    const primaryScene = createBlankSecurityScene();
    primaryScene.id = "scene_primary";
    const secondaryScene = createBlankSecurityScene();
    secondaryScene.id = "scene_secondary";

    const summary = summarizeWorkspaceCatalog(
      [
        makeProject({
          scene: primaryScene,
          workspaceOrganization: "North Region Security",
          workspaceOwner: "Pranay",
          workspaceVisibility: "shared",
          pinned: true,
        }),
        makeProject({
          scene: secondaryScene,
          workspaceOrganization: "North Region Security",
          workspaceOwner: "Pranay",
          workspaceVisibility: "published",
        }),
      ],
      primaryScene.id,
    );

    expect(summary.activeSceneId).toBe(primaryScene.id);
    expect(summary.scopeLabel).toBe("Published catalog");
    expect(summary.scopeDetail).toContain("Local-first published workspace boundary");
    expect(summary.primaryOrganization).toBe("North Region Security");
    expect(summary.primaryOwner).toBe("Pranay");
    expect(summary.primaryVisibility).toBe("shared");
    expect(summary.workspaceCount).toBe(2);
    expect(summary.organizationCount).toBe(1);
    expect(summary.ownerCount).toBe(1);
    expect(summary.pinnedCount).toBe(1);
    expect(summary.counts.shared).toBe(1);
    expect(summary.counts.published).toBe(1);
    expect(summary.capabilities.sharedWorkspaces).toBe(true);
    expect(summary.capabilities.publishedWorkspaces).toBe(true);
    expect(summary.capabilities.archiveRecovery).toBe(true);
    expect(summary.notes.some((note) => note.includes("canonical org/account boundary"))).toBe(true);
  });
});
