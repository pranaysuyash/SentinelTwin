import type { SceneIntelligenceGraph } from "@/lib/scene-intelligence-graph";
import { safeParseSecurityScene, type SecurityScene, type SimulationResult } from "@/schema/security-scene";

import {
  buildOperationalEvidenceEvent,
  normalizeOperationalEvidenceEvents,
  type OperationalEvidenceEvent,
} from "@/lib/operational-evidence";
import {
  normalizeOperationalEvidenceJournal,
  reconstructOperationalEvidenceJournal,
  type OperationalEvidenceJournal,
} from "@/lib/operational-evidence-journal";
import { createDefaultWorkspaceAccessState, normalizeWorkspaceAccessState, type WorkspaceAccessState } from "@/lib/workspace-access";
import {
  createDefaultWorkspaceAccountProfile,
  normalizeWorkspaceAccountProfile,
  type WorkspaceAccountProfile,
} from "@/lib/workspace-catalog";
import type { WorkspaceGovernanceState } from "@/lib/workspace-governance";

export type OperationalEvidenceArchiveVersion = "1";

export type ArchiveRestoreEventContext = {
  archiveExportedAt?: string;
  archiveRestoreBranch?: "draft" | "recovered" | "published";
};

export type OperationalEvidenceArchive = {
  version: OperationalEvidenceArchiveVersion;
  exportedAt: string;
  source: "studio";
  scene: SecurityScene;
  simulationResult: SimulationResult | null;
  sceneIntelligenceGraphSummary: SceneIntelligenceGraph["summary"];
  operationalEvidenceEvents: OperationalEvidenceEvent[];
  operationalEvidenceJournal?: OperationalEvidenceJournal | null;
  workspaceGovernance: WorkspaceGovernanceState;
  workspaceAccess: WorkspaceAccessState;
  workspaceAccount: WorkspaceAccountProfile;
  notes: string[];
};

export type OperationalEvidenceArchiveInput = {
  scene: SecurityScene;
  simulationResult: SimulationResult | null;
  sceneIntelligenceGraph: SceneIntelligenceGraph;
  operationalEvidenceEvents: OperationalEvidenceEvent[];
  operationalEvidenceJournal?: OperationalEvidenceJournal | null;
  workspaceGovernance: WorkspaceGovernanceState;
  workspaceAccess: WorkspaceAccessState;
  workspaceAccount: WorkspaceAccountProfile;
  notes?: string[];
};

export function buildOperationalEvidenceArchive(input: OperationalEvidenceArchiveInput): OperationalEvidenceArchive {
  return {
    version: "1",
    exportedAt: new Date().toISOString(),
    source: "studio",
    scene: structuredClone(input.scene),
    simulationResult: input.simulationResult ? structuredClone(input.simulationResult) : null,
    sceneIntelligenceGraphSummary: structuredClone(input.sceneIntelligenceGraph.summary),
    operationalEvidenceEvents: normalizeOperationalEvidenceEvents(input.operationalEvidenceEvents),
    operationalEvidenceJournal: input.operationalEvidenceJournal ? normalizeOperationalEvidenceJournal(input.operationalEvidenceJournal) : undefined,
    workspaceGovernance: structuredClone(input.workspaceGovernance),
    workspaceAccess: structuredClone(input.workspaceAccess),
    workspaceAccount: structuredClone(input.workspaceAccount),
    notes: input.notes?.length ? [...input.notes] : [
      "Operational evidence archive exported from the SentinelTwin studio workspace.",
      "Use this archive to recover the current scene, evidence chain, access policy, and governance state.",
    ],
  };
}

export function stringifyOperationalEvidenceArchive(archive: OperationalEvidenceArchive) {
  return JSON.stringify(archive, null, 2);
}

export function normalizeOperationalEvidenceArchive(raw: unknown): OperationalEvidenceArchive | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<OperationalEvidenceArchive> & {
    scene?: unknown;
    simulationResult?: unknown;
    operationalEvidenceEvents?: unknown;
    operationalEvidenceJournal?: unknown;
    workspaceGovernance?: unknown;
    workspaceAccess?: unknown;
    workspaceAccount?: unknown;
    sceneIntelligenceGraphSummary?: unknown;
    notes?: unknown;
  };

  if (candidate.version !== "1" || candidate.source !== "studio" || typeof candidate.exportedAt !== "string") {
    return null;
  }

  const scene = safeParseSecurityScene(candidate.scene);
  if (!scene.success) return null;

  const operationalEvidenceEvents = normalizeOperationalEvidenceEvents(candidate.operationalEvidenceEvents);
  if (operationalEvidenceEvents.length === 0 && Array.isArray(candidate.operationalEvidenceEvents) && candidate.operationalEvidenceEvents.length > 0) {
    return null;
  }

  const operationalEvidenceJournal = candidate.operationalEvidenceJournal
    ? normalizeOperationalEvidenceJournal(candidate.operationalEvidenceJournal)
    : null;
  const journalEvents = operationalEvidenceJournal ? reconstructOperationalEvidenceJournal(operationalEvidenceJournal) : [];

  const evidenceEvents = operationalEvidenceEvents.length > 0
    ? operationalEvidenceEvents
    : journalEvents;
  if (evidenceEvents.length === 0 && Array.isArray(candidate.operationalEvidenceEvents) && candidate.operationalEvidenceEvents.length > 0) {
    return null;
  }

  if (!candidate.workspaceGovernance || typeof candidate.workspaceGovernance !== "object") {
    return null;
  }

  const notes = Array.isArray(candidate.notes) ? candidate.notes.filter((note): note is string => typeof note === "string") : [];
  const archive: OperationalEvidenceArchive = {
    version: "1",
    exportedAt: candidate.exportedAt,
    source: "studio",
    scene: scene.data,
    simulationResult: candidate.simulationResult && typeof candidate.simulationResult === "object"
      ? structuredClone(candidate.simulationResult as SimulationResult)
      : null,
    sceneIntelligenceGraphSummary: candidate.sceneIntelligenceGraphSummary && typeof candidate.sceneIntelligenceGraphSummary === "object"
      ? structuredClone(candidate.sceneIntelligenceGraphSummary as SceneIntelligenceGraph["summary"])
        : {
          nodeCount: scene.data.cameras.length + scene.data.obstructions.length + scene.data.criticalZones.length,
          edgeCount: 0,
          entityCount: scene.data.cameras.length + scene.data.obstructions.length + scene.data.criticalZones.length,
          revisionDepth: scene.data.changeLog.length,
          snapshotCount: scene.data.snapshots.length,
          sourceCounts: { [scene.data.source]: scene.data.cameras.length + scene.data.obstructions.length + scene.data.criticalZones.length },
          coverageLinkCount: 0,
          failedZoneCount: 0,
          sceneSourceLabel: scene.data.source,
          cameraCount: scene.data.cameras.length,
          zoneCount: scene.data.criticalZones.length + scene.data.privacyZones.length,
          sourceCount: 1,
        },
    operationalEvidenceEvents: evidenceEvents,
    operationalEvidenceJournal: operationalEvidenceJournal ?? undefined,
    workspaceGovernance: structuredClone(candidate.workspaceGovernance as WorkspaceGovernanceState),
    workspaceAccess: candidate.workspaceAccess && typeof candidate.workspaceAccess === "object"
      ? normalizeWorkspaceAccessState(candidate.workspaceAccess)
      : createDefaultWorkspaceAccessState(),
    workspaceAccount: candidate.workspaceAccount && typeof candidate.workspaceAccount === "object"
      ? normalizeWorkspaceAccountProfile(candidate.workspaceAccount, {
        primaryOrganization: scene.data.source === "demo" ? "SentinelTwin Reference" : "Personal Workspace",
        primaryOwner: scene.data.source === "demo" ? "SentinelTwin" : "You",
        capabilities: {
          sharedWorkspaces: scene.data.source !== "manual",
          publishedWorkspaces: scene.data.source === "demo",
          archiveRecovery: true,
          reportExports: true,
          scanIntake: true,
          liveEvidence: false,
        },
        workspaceCount: scene.data.snapshots.length,
      })
      : createDefaultWorkspaceAccountProfile({
        primaryOrganization: scene.data.source === "demo" ? "SentinelTwin Reference" : "Personal Workspace",
        primaryOwner: scene.data.source === "demo" ? "SentinelTwin" : "You",
        capabilities: {
          sharedWorkspaces: scene.data.source !== "manual",
          publishedWorkspaces: scene.data.source === "demo",
          archiveRecovery: true,
          reportExports: true,
          scanIntake: true,
          liveEvidence: false,
        },
        workspaceCount: scene.data.snapshots.length,
      }),
    notes,
  };

  return archive;
}

export function createArchiveRestoreEvent(
  archive: OperationalEvidenceArchive,
  restoredScene: SecurityScene,
  parentEventId?: string,
  context?: ArchiveRestoreEventContext,
) {
  const archiveExportedAt = context?.archiveExportedAt ?? archive.exportedAt;
  const archiveRestoreBranch = context?.archiveRestoreBranch ?? "recovered";
  return buildOperationalEvidenceEvent({
    kind: "scene_reverted",
    title: "Operational archive restored",
    details: archiveExportedAt
      ? `Restored the workspace from an exported operational evidence archive created at ${archiveExportedAt}.`
      : "Restored the workspace from an exported operational evidence archive.",
    actor: "user",
    source: restoredScene.source,
    sceneId: restoredScene.id,
    sceneName: restoredScene.name,
    revisionDepth: archive.operationalEvidenceEvents.length,
    affectedNodeIds: [],
    confidence: 0.98,
    parentEventId,
    branchLabel: "recovered",
    lifecycleStage: "recovered",
    archiveExportedAt,
    archiveRestoreBranch,
    beforeSummary: `${restoredScene.name || "Untitled Scene"} restored from archive`,
    afterSummary: `${restoredScene.name || "Untitled Scene"} restored from archive`,
    sceneSnapshot: structuredClone(restoredScene),
    notes: [
      `Archive import rewired the workspace to the ${archiveRestoreBranch} branch.`,
      `Archive export time: ${archiveExportedAt}.`,
    ],
  });
}
