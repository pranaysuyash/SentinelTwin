import { describe, expect, test } from "bun:test";

import { smallRetailShopScene } from "@/demo-scenes/small-retail-shop";
import { buildSceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import { buildOperationalEvidenceEvent, safeParseOperationalEvidenceEvent } from "@/lib/operational-evidence";
import {
  buildOperationalEvidenceArchive,
  createArchiveRestoreEvent,
  normalizeOperationalEvidenceArchive,
  stringifyOperationalEvidenceArchive,
} from "@/lib/operational-evidence-archive";
import {
  loadOperationalEvidenceJournalFromRaw,
  serializeOperationalEvidenceJournal,
} from "@/lib/operational-evidence-journal";
import { createDefaultWorkspaceAccessState } from "@/lib/workspace-access";
import { createDefaultWorkspaceAccountProfile } from "@/lib/workspace-catalog";
import { createDefaultWorkspaceGovernance } from "@/lib/workspace-governance";
import { simulateStudio } from "@sentineltwin/simulation";

describe("operational evidence archive", () => {
  test("round-trips the current scene, evidence ledger, and governance state", () => {
    const simulationResult = simulateStudio(smallRetailShopScene);
    const graph = buildSceneIntelligenceGraph(smallRetailShopScene, {
      simulationResult,
      revisionDepth: 3,
      snapshotCount: 1,
    });
    const archive = buildOperationalEvidenceArchive({
      scene: smallRetailShopScene,
      simulationResult,
      sceneIntelligenceGraph: graph,
      operationalEvidenceEvents: [],
      workspaceAccess: createDefaultWorkspaceAccessState(),
      workspaceAccount: {
        ...createDefaultWorkspaceAccountProfile({
          primaryOrganization: "North Region Security",
          primaryOwner: "Pranay",
          capabilities: {
            sharedWorkspaces: true,
            publishedWorkspaces: true,
            archiveRecovery: true,
            reportExports: true,
            scanIntake: true,
            liveEvidence: true,
          },
          workspaceCount: 2,
        }),
        accountName: "North Region Security",
        ownerName: "Pranay",
      },
      workspaceGovernance: { ...createDefaultWorkspaceGovernance(), sceneStatus: "published" },
    });

    const restored = normalizeOperationalEvidenceArchive(JSON.parse(stringifyOperationalEvidenceArchive(archive)));

    expect(restored?.version).toBe("1");
    expect(restored?.scene.id).toBe(smallRetailShopScene.id);
    expect(restored?.workspaceGovernance.sceneStatus).toBe("published");
    expect(restored?.workspaceAccount.accountName).toBe("North Region Security");
    expect(restored?.workspaceAccount.ownerName).toBe("Pranay");
    expect(restored?.workspaceAccount.planTier).toBe("enterprise");
    expect(restored?.sceneIntelligenceGraphSummary.nodeCount).toBe(graph.summary.nodeCount);
  });

  test("exports and restores the operational evidence journal alongside flattened events", () => {
    const first = buildOperationalEvidenceEvent({
      kind: "scene_created",
      title: "Scene created",
      details: "Created the scene.",
      actor: "user",
      source: "manual",
      sceneId: smallRetailShopScene.id,
      sceneName: smallRetailShopScene.name,
      revisionDepth: 1,
      affectedNodeIds: [],
      confidence: 0.95,
    });
    const second = buildOperationalEvidenceEvent({
      kind: "scene_updated",
      title: "Scene updated",
      details: "Updated the scene.",
      actor: "user",
      source: "manual",
      sceneId: smallRetailShopScene.id,
      sceneName: smallRetailShopScene.name,
      revisionDepth: 2,
      affectedNodeIds: [],
      confidence: 0.95,
      timestamp: first.timestamp + 1,
    });
    const journalRaw = serializeOperationalEvidenceJournal(null, [first]);
    const extendedJournalRaw = serializeOperationalEvidenceJournal(journalRaw, [first, second]);
    const operationalEvidenceJournal = loadOperationalEvidenceJournalFromRaw(extendedJournalRaw);
    if (!operationalEvidenceJournal) {
      throw new Error("Expected an operational evidence journal to normalize");
    }

    const archive = buildOperationalEvidenceArchive({
      scene: smallRetailShopScene,
      simulationResult: null,
      sceneIntelligenceGraph: buildSceneIntelligenceGraph(smallRetailShopScene, {
        simulationResult: null,
        revisionDepth: 0,
        snapshotCount: 0,
      }),
      operationalEvidenceEvents: [first, second],
      operationalEvidenceJournal,
      workspaceAccess: createDefaultWorkspaceAccessState(),
      workspaceAccount: createDefaultWorkspaceAccountProfile({
        primaryOrganization: "North Region Security",
        primaryOwner: "Pranay",
        capabilities: {
          sharedWorkspaces: true,
          publishedWorkspaces: false,
          archiveRecovery: true,
          reportExports: true,
          scanIntake: true,
          liveEvidence: false,
        },
        workspaceCount: 1,
      }),
      workspaceGovernance: createDefaultWorkspaceGovernance(),
    });

    const restored = normalizeOperationalEvidenceArchive(JSON.parse(stringifyOperationalEvidenceArchive(archive)));

    expect(restored?.operationalEvidenceJournal?.entries).toHaveLength(2);
    expect(restored?.operationalEvidenceEvents).toHaveLength(2);
    expect(restored?.operationalEvidenceJournal?.entries[0]?.kind).toBe("append");
    expect(restored?.operationalEvidenceJournal?.entries[1]?.kind).toBe("append");
  });

  test("builds a restore event for a recovered archive branch", () => {
    const archive = buildOperationalEvidenceArchive({
      scene: smallRetailShopScene,
      simulationResult: null,
      sceneIntelligenceGraph: buildSceneIntelligenceGraph(smallRetailShopScene, {
        simulationResult: null,
        revisionDepth: 0,
        snapshotCount: 0,
      }),
      operationalEvidenceEvents: [],
      workspaceAccess: createDefaultWorkspaceAccessState(),
      workspaceAccount: createDefaultWorkspaceAccountProfile({
        primaryOrganization: "North Region Security",
        primaryOwner: "Pranay",
        capabilities: {
          sharedWorkspaces: true,
          publishedWorkspaces: false,
          archiveRecovery: true,
          reportExports: true,
          scanIntake: true,
          liveEvidence: false,
        },
        workspaceCount: 1,
      }),
      workspaceGovernance: createDefaultWorkspaceGovernance(),
    });

    const restoreEvent = createArchiveRestoreEvent(archive, smallRetailShopScene, "seed_event", {
      archiveExportedAt: "2026-05-30T10:15:00.000Z",
      archiveRestoreBranch: "published",
    });
    const persisted = safeParseOperationalEvidenceEvent(JSON.parse(JSON.stringify(restoreEvent)));

    expect(restoreEvent.kind).toBe("scene_reverted");
    expect(restoreEvent.branchLabel).toBe("recovered");
    expect(restoreEvent.parentEventId).toBe("seed_event");
    expect(restoreEvent.sceneSnapshot?.id).toBe(smallRetailShopScene.id);
    expect(restoreEvent.archiveExportedAt).toBe("2026-05-30T10:15:00.000Z");
    expect(restoreEvent.archiveRestoreBranch).toBe("published");
    expect(persisted?.archiveExportedAt).toBe("2026-05-30T10:15:00.000Z");
    expect(persisted?.archiveRestoreBranch).toBe("published");
  });
});
