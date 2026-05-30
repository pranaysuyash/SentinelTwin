import { describe, expect, test } from "bun:test";

import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildSceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import {
  applyArchiveHandoffLinkState,
  buildArchiveHandoffLink,
  parseArchiveHandoffLink,
} from "@/lib/archive-handoff-link";
import { buildOperationalEvidenceArchive } from "@/lib/operational-evidence-archive";
import { createDefaultWorkspaceAccessState } from "@/lib/workspace-access";
import { createDefaultWorkspaceAccountProfile } from "@/lib/workspace-catalog";
import { createDefaultWorkspaceGovernance } from "@/lib/workspace-governance";
import { simulateStudio } from "@/simulation/simulate-studio";

describe("archive handoff link", () => {
  test("builds and parses an archive handoff URL with the requested restore branch", () => {
    const simulationResult = simulateStudio(smallRetailShopScene);
    const archive = buildOperationalEvidenceArchive({
      scene: smallRetailShopScene,
      simulationResult,
      sceneIntelligenceGraph: buildSceneIntelligenceGraph(smallRetailShopScene, {
        simulationResult,
        revisionDepth: 3,
        snapshotCount: 1,
      }),
      operationalEvidenceEvents: [],
      workspaceAccess: createDefaultWorkspaceAccessState(),
      workspaceAccount: {
        accountName: "North Region Security",
        ownerName: "Pranay",
        planTier: "enterprise",
        quotas: { maxWorkspaces: 10, maxMembers: 5, maxStorageBytes: 1000 },
        entitlements: {
          sharedWorkspaces: true,
          publishedWorkspaces: true,
          archiveRecovery: true, reportExports: true, scanIntake: true, liveEvidence: true, ownershipTransfer: true,
          invites: true,
        },
      },
      workspaceGovernance: createDefaultWorkspaceGovernance(),
      notes: ["handoff"],
    });

    const url = buildArchiveHandoffLink(
      "https://sentineltwin.local/studio",
      "?project=retail&existing=keep",
      {
        archive,
        restoreBranch: "published",
      },
      "#debug",
    );

    expect(url).toContain("archivePayload=");
    expect(url).toContain("archiveRestoreBranch=published");
    expect(url).toContain("project=retail");
    expect(url).toContain("existing=keep");
    expect(url.endsWith("#debug")).toBe(true);

    const parsed = parseArchiveHandoffLink(new URL(url).search);
    expect(parsed?.restoreBranch).toBe("published");
    expect(parsed?.archive.scene.id).toBe(smallRetailShopScene.id);
    expect(parsed?.archive.notes).toContain("handoff");
  });

  test("drops archive handoff fields when the state is empty", () => {
    const params = new URLSearchParams("keep=1&archivePayload=old&archiveRestoreBranch=recovered");
    applyArchiveHandoffLinkState(params, {
      archive: null,
      restoreBranch: null,
    });

    expect(params.toString()).toBe("keep=1");
  });
});
