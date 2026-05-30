import { describe, expect, test } from "bun:test";

import { createBlankSecurityScene } from "@/lib/scene-skeleton";
import { summarizeWorkspaceAccount, summarizeWorkspaceCatalog } from "@/lib/workspace-catalog";
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

  test("summarizes the local workspace account bridge", () => {
    const scene = createBlankSecurityScene();
    scene.id = "scene_account";

    const summary = summarizeWorkspaceAccount(
      [
        makeProject({
          scene,
          workspaceOrganization: "North Region Security",
          workspaceOwner: "Pranay",
          workspaceVisibility: "shared",
          pinned: true,
        }),
      ],
      scene.id,
    );

    expect(summary.activeSceneId).toBe(scene.id);
    expect(summary.planLabel).toBe("Pro workspace account");
    expect(summary.planDetail).toContain("local-first collaboration bridge");
    expect(summary.accountName).toBe("North Region Security");
    expect(summary.ownerName).toBe("Pranay");
    expect(summary.softQuotaLabel).toBe("1/12 workspaces");
    expect(summary.softQuotaExceeded).toBe(false);
    expect(summary.quotas.shared).toBe(1);
    expect(summary.quotas.published).toBe(0);
    expect(summary.entitlements.sharedWorkspaces).toBe(true);
    expect(summary.entitlements.publishedWorkspaces).toBe(false);
    expect(summary.entitlements.ownershipTransfer).toBe(false);
    expect(summary.notes.some((note) => note.includes("account bridge toward the canonical org/account model"))).toBe(true);
  });
});
