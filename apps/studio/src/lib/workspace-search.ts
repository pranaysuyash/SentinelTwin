import type { BottomTab, SavedProjectRecord } from "@/store/studio-store";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import type { CameraLiveConnectionArchiveRecord } from "@/lib/camera-live-connection-history";
import type { CameraMetadataArchiveRecord } from "@/lib/camera-metadata-ingest-history";
import type { GovernanceArchiveRecord } from "@/lib/governance-archive";
import type { SensorIngestArchiveRecord } from "@/lib/sensor-ingest-history";
import type { SupportDeliveryArchiveRecord } from "@/lib/support-delivery";
import type { OperationalEvidenceArchiveHistoryRecord } from "@/lib/operational-evidence-archive-history";
import type { WorkspaceIdentityConflictArchiveRecord } from "@/lib/workspace-identity-conflict-types";
import type { WorkspaceMembershipArchiveRecord } from "@/lib/workspace-membership-types";

export type WorkspaceSearchHitKind = "workspace" | "evidence" | "report" | "archive";

export type WorkspaceSearchHit = {
  id: string;
  kind: WorkspaceSearchHitKind;
  title: string;
  summary: string;
  details: string;
  sceneId: string;
  sceneName: string;
  sourceLabel: string;
  actionLabel: string;
  targetSummary: string;
  branchLabel?: string | null;
  timelineEventId?: string | null;
  routeTab?: BottomTab;
  score: number;
  timestamp: number;
};

type ArchiveSearchInput = {
  governanceArchiveHistory?: GovernanceArchiveSearchRecord[];
  workspaceMembershipArchiveHistory?: WorkspaceMembershipArchiveRecord[];
  workspaceIdentityConflictHistory?: WorkspaceIdentityConflictArchiveRecord[];
  supportDeliveryHistory?: SupportDeliveryArchiveRecord[];
  operationalEvidenceArchiveHistory?: OperationalEvidenceArchiveHistoryRecord[];
  sensorIngestHistory?: SensorIngestArchiveRecord[];
  cameraMetadataHistory?: CameraMetadataArchiveRecord[];
  cameraLiveConnectionHistory?: CameraLiveConnectionArchiveRecord[];
};

export type WorkspaceSearchInput = {
  currentScene: SecurityScene;
  currentResult: SimulationResult | null;
  savedProjects: SavedProjectRecord[];
  archives?: ArchiveSearchInput;
  maxResults?: number;
};

type GovernanceTrailSummarySearchRecord = {
  latestEvent?: {
    id?: string;
    branchLabel?: string | null;
    lifecycleStage?: string | null;
  } | null;
  recentEvents?: Array<{
    id?: string;
    branchLabel?: string | null;
    lifecycleStage?: string | null;
  }>;
};

type GovernanceArchiveSearchRecord = GovernanceArchiveRecord & {
  governanceTrail?: GovernanceTrailSummarySearchRecord | null;
};

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreText(haystack: string, query: string) {
  if (!query) return 1;
  const normalizedHaystack = normalize(haystack);
  const tokens = normalize(query).split(" ").filter((token) => token.length > 1);
  if (tokens.length === 0) return normalizedHaystack.includes(normalize(query)) ? 1 : 0;
  let score = normalizedHaystack.includes(normalize(query)) ? 5 : 0;
  for (const token of tokens) {
    if (normalizedHaystack.includes(token)) {
      score += 1;
    }
  }
  return score;
}

function sceneSourceLabel(scene: SecurityScene) {
  switch (scene.source) {
    case "manual":
      return "Draft";
    case "ai":
      return "AI Draft";
    case "scan":
      return "Scan";
    case "import":
      return "Import";
    case "preset":
      return "Preset";
    case "demo":
      return "Reference baseline";
    default:
      return scene.source;
  }
}

function archiveTimestamp(record: { storedAt?: number; submittedAt?: number; receivedAt?: string; timestamp?: number }) {
  if (typeof record.storedAt === "number") return record.storedAt;
  if (typeof record.submittedAt === "number") return record.submittedAt;
  if (typeof record.timestamp === "number") return record.timestamp;
  if (typeof record.receivedAt === "string") {
    const parsed = Date.parse(record.receivedAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function normalizeBranchLabel(branchLabel: string | null | undefined) {
  const normalized = branchLabel?.trim().toLowerCase() ?? null;
  return normalized && normalized.length > 0 ? normalized : null;
}

export function formatWorkspaceBranchLabel(branchLabel: string) {
  return branchLabel.replace(/_/g, " ");
}

function governanceArchiveBranchLabel(record: GovernanceArchiveRecord) {
  const trail = record.governanceTrail;
  const latestBranch = normalizeBranchLabel(trail?.latestEvent?.branchLabel ?? trail?.latestEvent?.lifecycleStage);
  if (latestBranch) return latestBranch;

  for (const event of trail?.recentEvents ?? []) {
    const branch = normalizeBranchLabel(event.branchLabel ?? event.lifecycleStage);
    if (branch) return branch;
  }

  return null;
}

function workspaceMembershipArchiveBranchLabel(record: WorkspaceMembershipArchiveRecord) {
  switch (record.workspaceGovernanceState.sceneStatus) {
    case "review_requested":
      return "review";
    case "approved":
    case "published":
      return "published";
    case "rejected":
      return "review";
    case "recovered":
      return "recovered";
    case "draft":
    default:
      return "draft";
  }
}

function workspaceIdentityConflictArchiveBranchLabel(record: WorkspaceIdentityConflictArchiveRecord) {
  switch (record.resolutionStatus) {
    case "route_for_review":
      return "review";
    case "ready_for_publish":
      return "published";
    case "reconcile_before_route":
    case "archive_pending":
    default:
      return "draft";
  }
}

function addArchiveHit(
  hits: WorkspaceSearchHit[],
  input: {
    id: string;
    title: string;
    summary: string;
    details: string;
    sceneId: string;
    sceneName: string;
    sourceLabel: string;
    actionLabel: string;
    targetSummary: string;
    branchLabel?: string | null;
    timelineEventId?: string | null;
    routeTab?: BottomTab;
    score: number;
    timestamp: number;
  },
) {
  hits.push({
    ...input,
    kind: "archive",
  });
}

function targetSummaryForHit(input: {
  kind: WorkspaceSearchHitKind;
  branchLabel?: string | null;
  timelineEventId?: string | null;
  routeTab?: BottomTab;
}) {
  if (input.kind === "workspace") return "Open workspace";
  if (input.kind === "report") return "Open report snapshot";
  if (input.kind === "evidence") return input.timelineEventId ? "Timeline checkpoint" : "Timeline evidence";
  if (input.routeTab === "timeline" && input.branchLabel && input.timelineEventId) return "Timeline branch + exact checkpoint";
  if (input.routeTab === "timeline" && input.branchLabel) return "Timeline branch";
  if (input.routeTab === "timeline") return "Timeline history";
  if (input.routeTab === "governance") return "Governance review";
  if (input.routeTab === "debug") return "Recovery / debug";
  if (input.routeTab === "sensors") return "Sensor observability";
  return "Open workspace";
}

export function searchWorkspaceMemory(query: string, input: WorkspaceSearchInput): WorkspaceSearchHit[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const hits: WorkspaceSearchHit[] = [];
  const searchScene = (scene: SecurityScene, sourceLabel: string, timestamp: number) => {
    const haystack = [
      scene.name,
      scene.source,
      sourceLabel,
      `${scene.dimensions.width} ${scene.dimensions.depth} ${scene.dimensions.height}`,
      `${scene.cameras.length} cameras`,
      `${scene.securityLights.length} lights`,
      `${scene.obstructions.length} obstructions`,
      `${scene.criticalZones.length} zones`,
      `${scene.paths.length} paths`,
      ...(scene.changeLog ?? []).slice(-12),
    ].join(" ");

    const score = scoreText(haystack, normalizedQuery);
    if (score <= 0) return;

      hits.push({
        id: `workspace:${scene.id}`,
        kind: "workspace",
        title: scene.name,
        summary: `${sourceLabel} workspace · ${scene.cameras.length} cameras · ${scene.criticalZones.length} zones`,
        details: `${scene.dimensions.width}m × ${scene.dimensions.depth}m · ${scene.obstructions.length} obstructions · ${scene.changeLog.length} events`,
        sceneId: scene.id,
        sceneName: scene.name,
        sourceLabel,
        actionLabel: "Open workspace",
        targetSummary: targetSummaryForHit({ kind: "workspace" }),
        branchLabel: null,
        timelineEventId: null,
        score,
        timestamp,
      });
  };

  searchScene(input.currentScene, sceneSourceLabel(input.currentScene), input.currentScene.updatedAt ?? input.currentScene.createdAt ?? Date.now());
  for (const project of input.savedProjects) {
    searchScene(project.scene, sceneSourceLabel(project.scene), project.updatedAt);
  }

  for (const entry of input.currentScene.changeLog.slice(-24)) {
    const score = scoreText(entry, normalizedQuery);
    if (score <= 0) continue;
      hits.push({
        id: `evidence:${entry}`,
        kind: "evidence",
        title: entry,
        summary: "Scene change evidence",
        details: "Matches the current operational evidence trail.",
        sceneId: input.currentScene.id,
        sceneName: input.currentScene.name,
        sourceLabel: "Operational evidence",
        actionLabel: "Open timeline",
        targetSummary: targetSummaryForHit({ kind: "evidence", timelineEventId: null }),
        branchLabel: null,
        timelineEventId: null,
        score: score + 1,
        timestamp: input.currentScene.updatedAt ?? input.currentScene.createdAt ?? Date.now(),
      });
  }

  if (input.currentResult) {
    const reportSummary = [
      `Coverage ${Math.round(input.currentResult.totalCoveragePct)}%`,
      `${input.currentResult.criticalZoneResults.length} zones`,
      `${input.currentResult.issues.length} issues`,
      `${input.currentResult.recommendations.length} recommendations`,
      input.currentResult.pathResults.length > 0 ? `${input.currentResult.pathResults.length} paths` : "",
    ].filter(Boolean).join(" · ");
    const reportDetails = [
      `Blindspot ${Math.round(input.currentResult.blindspotPct)}%`,
      `Recognition ${Math.round(input.currentResult.recognitionAreaPct)}%`,
      `Identification ${Math.round(input.currentResult.identificationAreaPct)}%`,
      `Worst area ${input.currentResult.worstAreaQuality}`,
    ].join(" · ");
    const reportHaystack = [
      reportSummary,
      reportDetails,
      ...(input.currentResult.issues.map((issue) => issue.description)),
      ...(input.currentResult.recommendations.map((rec) => rec.description)),
    ].join(" ");
    const score = scoreText(reportHaystack, normalizedQuery);
    if (score > 0) {
      hits.push({
        id: `report:${input.currentScene.id}`,
        kind: "report",
        title: "Current report snapshot",
        summary: reportSummary,
        details: reportDetails,
        sceneId: input.currentScene.id,
        sceneName: input.currentScene.name,
        sourceLabel: "Simulation report",
        actionLabel: "Open report",
        targetSummary: targetSummaryForHit({ kind: "report" }),
        branchLabel: null,
        score: score + 1,
        timestamp: input.currentScene.updatedAt ?? input.currentScene.createdAt ?? Date.now(),
      });
    }
  }

  const archives = input.archives;
  if (archives) {
    for (const record of archives.governanceArchiveHistory ?? []) {
      const haystack = [
        record.sceneName,
        record.sceneId,
        record.summary,
        record.archiveStatus,
        record.historyId,
        ...(record.destinations ?? []).map((destination) => `${destination.label} ${destination.mode} ${destination.status} ${destination.message}`),
      ].filter(Boolean).join(" ");
      const score = scoreText(haystack, normalizedQuery);
      if (score > 0) {
        const branchLabel = governanceArchiveBranchLabel(record);
        addArchiveHit(hits, {
          id: `archive:governance:${record.historyId}`,
          title: record.sceneName,
          summary: `${record.archiveStatus} · ${record.deliveredCount} delivered · ${record.failedCount} failed`,
          details: record.summary,
          sceneId: record.sceneId,
          sceneName: record.sceneName,
          sourceLabel: "Governance archive",
          actionLabel: branchLabel ? "Jump to branch" : "Open governance",
          targetSummary: targetSummaryForHit({
            kind: "archive",
            branchLabel,
            timelineEventId: record.governanceTrail?.latestEvent?.id ?? null,
            routeTab: branchLabel ? "timeline" : "governance",
          }),
          branchLabel,
          timelineEventId: record.governanceTrail?.latestEvent?.id ?? null,
          routeTab: branchLabel ? "timeline" : "governance",
          score: score + 1,
          timestamp: archiveTimestamp(record),
        });
      }
    }

    for (const record of archives.workspaceMembershipArchiveHistory ?? []) {
      const haystack = [
        record.sceneName,
        record.sceneId,
        record.summary,
        record.archiveStatus,
        record.activeMemberLabel,
        record.policyMode,
        record.approvalRoute?.routeLabel,
        record.approvalRoute?.routeReason,
        ...(record.destinations ?? []).map((destination) => `${destination.label} ${destination.mode} ${destination.status} ${destination.message}`),
      ].filter(Boolean).join(" ");
      const score = scoreText(haystack, normalizedQuery);
      if (score > 0) {
        const branchLabel = workspaceMembershipArchiveBranchLabel(record);
        addArchiveHit(hits, {
          id: `archive:membership:${record.historyId}`,
          title: record.sceneName,
          summary: `${record.activeMemberLabel} · ${record.policyMode} · ${record.archiveStatus}`,
          details: record.summary,
          sceneId: record.sceneId,
          sceneName: record.sceneName,
          sourceLabel: "Workspace membership archive",
          actionLabel: "Jump to branch",
          targetSummary: targetSummaryForHit({
            kind: "archive",
            branchLabel,
            routeTab: "timeline",
          }),
          branchLabel,
          timelineEventId: null,
          routeTab: "timeline",
          score: score + 1,
          timestamp: archiveTimestamp(record),
        });
      }
    }

    for (const record of archives.workspaceIdentityConflictHistory ?? []) {
      const haystack = [
        record.sceneName,
        record.sceneId,
        record.summary,
        record.archiveStatus,
        record.resolutionLabel,
        record.resolutionReason,
        record.recommendedAction,
        record.conflictDiff?.title,
        record.conflictDiff?.subtitle,
        ...(record.destinations ?? []).map((destination) => `${destination.label} ${destination.mode} ${destination.status} ${destination.message}`),
      ].filter(Boolean).join(" ");
      const score = scoreText(haystack, normalizedQuery);
      if (score > 0) {
        const branchLabel = workspaceIdentityConflictArchiveBranchLabel(record);
        addArchiveHit(hits, {
          id: `archive:identity:${record.historyId}`,
          title: record.sceneName,
          summary: `${record.resolutionLabel} · ${record.archiveStatus}`,
          details: record.summary,
          sceneId: record.sceneId,
          sceneName: record.sceneName,
          sourceLabel: "Identity conflict archive",
          actionLabel: "Jump to branch",
          targetSummary: targetSummaryForHit({
            kind: "archive",
            branchLabel,
            routeTab: "timeline",
          }),
          branchLabel,
          timelineEventId: null,
          routeTab: "timeline",
          score: score + 1,
          timestamp: archiveTimestamp(record),
        });
      }
    }

    for (const record of archives.supportDeliveryHistory ?? []) {
      const haystack = [
        record.sceneName,
        record.sceneId,
        record.summary,
        record.archiveStatus,
        record.historyId,
        ...(record.destinations ?? []).map((destination) => `${destination.label} ${destination.mode} ${destination.status} ${destination.message}`),
      ].filter(Boolean).join(" ");
      const score = scoreText(haystack, normalizedQuery);
      if (score > 0) {
        addArchiveHit(hits, {
          id: `archive:support:${record.historyId}`,
          title: record.sceneName ?? "Support delivery archive",
          summary: `${record.archiveStatus} · ${record.deliveredCount} delivered · ${record.failedCount} failed`,
          details: record.summary,
          sceneId: record.sceneId ?? input.currentScene.id,
          sceneName: record.sceneName ?? input.currentScene.name,
          sourceLabel: "Support archive",
          actionLabel: "Open debug",
          targetSummary: targetSummaryForHit({ kind: "archive", routeTab: "debug" }),
          branchLabel: null,
          timelineEventId: null,
          routeTab: "debug",
          score: score + 1,
          timestamp: archiveTimestamp(record),
        });
      }
    }

    for (const record of archives.operationalEvidenceArchiveHistory ?? []) {
      const archive = record.archive;
      const latestEvent = archive.operationalEvidenceEvents.at(-1) ?? null;
      const branchLabel = latestEvent?.branchLabel ?? latestEvent?.lifecycleStage ?? null;
      const haystack = [
        archive.scene.name,
        archive.scene.id,
        archive.scene.source,
        record.historyId,
        latestEvent?.title,
        latestEvent?.details,
        latestEvent?.kind,
        latestEvent?.branchLabel,
        latestEvent?.lifecycleStage,
        ...(archive.notes ?? []),
      ].filter(Boolean).join(" ");
      const score = scoreText(haystack, normalizedQuery);
      if (score > 0) {
        addArchiveHit(hits, {
          id: `archive:operational:${record.historyId}`,
          title: archive.scene.name,
          summary: `${record.restoreBranch} · ${archive.operationalEvidenceEvents.length} evidence events`,
          details: latestEvent ? latestEvent.details : "Operational evidence archive restored from a recovered scene snapshot.",
          sceneId: archive.scene.id,
          sceneName: archive.scene.name,
          sourceLabel: "Operational evidence archive",
          actionLabel: "Jump to checkpoint",
          targetSummary: targetSummaryForHit({
            kind: "archive",
            branchLabel,
            timelineEventId: latestEvent?.id ?? null,
            routeTab: "timeline",
          }),
          branchLabel,
          timelineEventId: latestEvent?.id ?? null,
          routeTab: "timeline",
          score: score + 1,
          timestamp: record.storedAt,
        });
      }
    }

    for (const record of archives.sensorIngestHistory ?? []) {
      const haystack = [
        record.sceneName,
        record.sceneId,
        record.summary,
        record.feedLabel,
        record.feedUrl,
        record.raw,
        record.ingestMode,
      ].filter(Boolean).join(" ");
      const score = scoreText(haystack, normalizedQuery);
      if (score > 0) {
        addArchiveHit(hits, {
          id: `archive:sensor:${record.receivedAt}`,
          title: record.sceneName ?? "Sensor ingest archive",
          summary: `${record.ingestMode} · ${record.sourceCount} sources`,
          details: record.summary,
          sceneId: record.sceneId ?? input.currentScene.id,
          sceneName: record.sceneName ?? input.currentScene.name,
          sourceLabel: "Sensor archive",
          actionLabel: "Open sensors",
          targetSummary: targetSummaryForHit({ kind: "archive", routeTab: "sensors" }),
          branchLabel: null,
          timelineEventId: null,
          routeTab: "sensors",
          score: score + 1,
          timestamp: archiveTimestamp(record),
        });
      }
    }

    for (const record of archives.cameraMetadataHistory ?? []) {
      const haystack = [
        record.sceneName,
        record.sceneId,
        record.summary,
        record.feedLabel,
        record.feedUrl,
        record.raw,
        record.ingestMode,
      ].filter(Boolean).join(" ");
      const score = scoreText(haystack, normalizedQuery);
      if (score > 0) {
        addArchiveHit(hits, {
          id: `archive:camera-metadata:${record.receivedAt}`,
          title: record.sceneName ?? "Camera metadata archive",
          summary: `${record.ingestMode} · ${record.sourceCount} sources`,
          details: record.summary,
          sceneId: record.sceneId ?? input.currentScene.id,
          sceneName: record.sceneName ?? input.currentScene.name,
          sourceLabel: "Camera metadata archive",
          actionLabel: "Open debug",
          targetSummary: targetSummaryForHit({ kind: "archive", routeTab: "debug" }),
          branchLabel: null,
          timelineEventId: null,
          routeTab: "debug",
          score: score + 1,
          timestamp: archiveTimestamp(record),
        });
      }
    }

    for (const record of archives.cameraLiveConnectionHistory ?? []) {
      const haystack = [
        record.sceneName,
        record.sceneId,
        record.summary,
        record.feedLabel,
        record.liveFeedUrl,
        record.endpointUrl,
        record.raw,
        record.protocol,
        record.action,
        record.record.authMode,
        record.record.authState,
        record.record.liveConnectionStatus,
      ].filter(Boolean).join(" ");
      const score = scoreText(haystack, normalizedQuery);
      if (score > 0) {
        addArchiveHit(hits, {
          id: `archive:camera-live:${record.receivedAt}`,
          title: record.sceneName ?? "Camera live connection archive",
          summary: `${record.action} · ${record.record.liveConnectionStatus} · ${record.record.authMode}`,
          details: record.summary,
          sceneId: record.sceneId ?? input.currentScene.id,
          sceneName: record.sceneName ?? input.currentScene.name,
          sourceLabel: "Camera live archive",
          actionLabel: "Open debug",
          targetSummary: targetSummaryForHit({ kind: "archive", routeTab: "debug" }),
          branchLabel: null,
          timelineEventId: null,
          routeTab: "debug",
          score: score + 1,
          timestamp: archiveTimestamp(record),
        });
      }
    }
  }

  return hits
    .sort((a, b) => b.score - a.score || b.timestamp - a.timestamp)
    .slice(0, input.maxResults ?? 10);
}
