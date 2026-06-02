"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { GovernanceArchiveRecord } from "@/lib/governance-archive";
import type { WorkspaceMembershipArchiveRecord } from "@/lib/workspace-membership-types";
import type { WorkspaceIdentityConflictArchiveRecord } from "@/lib/workspace-identity-conflict-types";
import type { SupportDeliveryArchiveRecord } from "@/lib/support-delivery";
import type { SensorIngestArchiveRecord } from "@/lib/sensor-ingest-history";
import type { CameraMetadataArchiveRecord } from "@/lib/camera-metadata-ingest-history";
import type { CameraLiveConnectionArchiveRecord } from "@/lib/camera-live-connection-history";
import type { OperationalEvidenceArchiveHistoryRecord } from "@/lib/operational-evidence-archive-history";
import { useStudioStore } from "@/store/studio-store";

export type DashboardArchiveLoadState = "idle" | "loading" | "ready" | "error";
export type DashboardArchiveLoadKey =
  | "governance"
  | "workspaceMembership"
  | "workspaceIdentityConflict"
  | "supportDelivery"
  | "sensorIngest"
  | "cameraMetadata"
  | "cameraLiveConnection";

export type DashboardArchiveLoadStateMap = Record<DashboardArchiveLoadKey, DashboardArchiveLoadState>;

export type UseDashboardArchivesReturn = {
  governanceArchiveHistory: GovernanceArchiveRecord[];
  workspaceMembershipArchiveHistory: WorkspaceMembershipArchiveRecord[];
  workspaceIdentityConflictHistory: WorkspaceIdentityConflictArchiveRecord[];
  supportDeliveryHistory: SupportDeliveryArchiveRecord[];
  sensorIngestHistory: SensorIngestArchiveRecord[];
  cameraMetadataHistory: CameraMetadataArchiveRecord[];
  cameraLiveConnectionHistory: CameraLiveConnectionArchiveRecord[];
  operationalEvidenceArchiveHistory: OperationalEvidenceArchiveHistoryRecord[];
  archiveLoadState: DashboardArchiveLoadStateMap;
  isArchiveLoading: boolean;
  hasArchiveLoadFailures: boolean;
  archiveLoadFailureCount: number;
  archiveLoadFailureSources: DashboardArchiveLoadKey[];
  archiveLoadInProgressSources: DashboardArchiveLoadKey[];
  archiveLoadFailureLabels: string[];
  archiveLoadInProgressLabels: string[];
};

const ARCHIVE_LABELS: Record<DashboardArchiveLoadKey, string> = {
  governance: "Governance",
  workspaceMembership: "Workspace Membership",
  workspaceIdentityConflict: "Workspace Identity",
  supportDelivery: "Support Delivery",
  sensorIngest: "Sensor Ingest",
  cameraMetadata: "Camera Metadata",
  cameraLiveConnection: "Camera Live Connection",
};

const EMPTY_OBJECT: DashboardArchiveLoadStateMap = {
  governance: "idle",
  workspaceMembership: "idle",
  workspaceIdentityConflict: "idle",
  supportDelivery: "idle",
  sensorIngest: "idle",
  cameraMetadata: "idle",
  cameraLiveConnection: "idle",
};

async function fetchArchive<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Archive request failed: ${response.status}`);
  }
  const payload = await response.json() as { history?: T[] };
  return payload.history ?? [];
}

function archiveLoadStateToBoolean(value: DashboardArchiveLoadState): boolean {
  return value === "loading";
}

function archiveLoadStateToFailure(value: DashboardArchiveLoadState): boolean {
  return value === "error";
}

export function useDashboardArchives(): UseDashboardArchivesReturn {
  const operationalEvidenceArchiveHistory = useStudioStore((state) => state.operationalEvidenceArchiveHistory);
  const [governanceArchiveHistory, setGovernanceArchiveHistory] = useState<GovernanceArchiveRecord[]>([]);
  const [workspaceMembershipArchiveHistory, setWorkspaceMembershipArchiveHistory] = useState<WorkspaceMembershipArchiveRecord[]>([]);
  const [workspaceIdentityConflictHistory, setWorkspaceIdentityConflictHistory] = useState<WorkspaceIdentityConflictArchiveRecord[]>([]);
  const [supportDeliveryHistory, setSupportDeliveryHistory] = useState<SupportDeliveryArchiveRecord[]>([]);
  const [sensorIngestHistory, setSensorIngestHistory] = useState<SensorIngestArchiveRecord[]>([]);
  const [cameraMetadataHistory, setCameraMetadataHistory] = useState<CameraMetadataArchiveRecord[]>([]);
  const [cameraLiveConnectionHistory, setCameraLiveConnectionHistory] = useState<CameraLiveConnectionArchiveRecord[]>([]);
  const [archiveLoadState, setArchiveLoadState] = useState<DashboardArchiveLoadStateMap>(EMPTY_OBJECT);

  const setKeyState = useCallback((key: DashboardArchiveLoadKey, nextState: DashboardArchiveLoadState) => {
    setArchiveLoadState((current) => ({ ...current, [key]: nextState }));
  }, []);

  const loadArchive = useCallback(
    async <T,>(key: DashboardArchiveLoadKey, url: string, setValue: (values: T[]) => void) => {
      setKeyState(key, "loading");
      try {
        const values = await fetchArchive<T>(url);
        setValue(values);
        setKeyState(key, "ready");
      } catch {
        setValue([]);
        setKeyState(key, "error");
      }
    },
    [setKeyState],
  );

  const reloadArchives = useCallback(async () => {
    await Promise.allSettled([
      loadArchive<GovernanceArchiveRecord>("governance", "/api/governance-archive", setGovernanceArchiveHistory),
      loadArchive<WorkspaceMembershipArchiveRecord>("workspaceMembership", "/api/workspace-membership-archive", setWorkspaceMembershipArchiveHistory),
      loadArchive<WorkspaceIdentityConflictArchiveRecord>("workspaceIdentityConflict", "/api/workspace-identity-conflict", setWorkspaceIdentityConflictHistory),
      loadArchive<SupportDeliveryArchiveRecord>("supportDelivery", "/api/support-delivery", setSupportDeliveryHistory),
      loadArchive<SensorIngestArchiveRecord>("sensorIngest", "/api/sensor-ingest", setSensorIngestHistory),
      loadArchive<CameraMetadataArchiveRecord>("cameraMetadata", "/api/camera-metadata-ingest", setCameraMetadataHistory),
      loadArchive<CameraLiveConnectionArchiveRecord>("cameraLiveConnection", "/api/camera-live-connection", setCameraLiveConnectionHistory),
    ]);
  }, [loadArchive]);

  useEffect(() => {
    void reloadArchives();
  }, [reloadArchives]);

  const isArchiveLoading = useMemo(
    () => Object.values(archiveLoadState).some(archiveLoadStateToBoolean),
    [archiveLoadState],
  );

  const archiveLoadFailureCount = useMemo(
    () => Object.values(archiveLoadState).filter(archiveLoadStateToFailure).length,
    [archiveLoadState],
  );

  const hasArchiveLoadFailures = archiveLoadFailureCount > 0;

  const archiveLoadFailureSources = useMemo(
    () =>
      Object.entries(archiveLoadState)
        .filter(([, status]) => status === "error")
        .map(([key]) => key as DashboardArchiveLoadKey),
    [archiveLoadState],
  );

  const archiveLoadInProgressSources = useMemo(
    () =>
      Object.entries(archiveLoadState)
        .filter(([, status]) => status === "loading")
        .map(([key]) => key as DashboardArchiveLoadKey),
    [archiveLoadState],
  );

  const archiveLoadFailureLabels = archiveLoadFailureSources.map((source) => ARCHIVE_LABELS[source]);
  const archiveLoadInProgressLabels = archiveLoadInProgressSources.map((source) => ARCHIVE_LABELS[source]);

  return {
    governanceArchiveHistory,
    workspaceMembershipArchiveHistory,
    workspaceIdentityConflictHistory,
    supportDeliveryHistory,
    sensorIngestHistory,
    cameraMetadataHistory,
    cameraLiveConnectionHistory,
    operationalEvidenceArchiveHistory,
    archiveLoadState,
    isArchiveLoading,
    hasArchiveLoadFailures,
    archiveLoadFailureCount,
    archiveLoadFailureSources,
    archiveLoadInProgressSources,
    archiveLoadFailureLabels,
    archiveLoadInProgressLabels,
  };
}
