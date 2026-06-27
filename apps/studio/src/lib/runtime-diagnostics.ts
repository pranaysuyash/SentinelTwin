import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import type { OperationalEvidenceEvent } from "@/lib/operational-evidence";
import type { CameraLiveConnectionArchiveRecord } from "@/lib/camera-live-connection-history";
import type { SensorIngestArchiveRecord } from "@/lib/sensor-ingest-history";
import type { CameraLiveSessionRecord } from "@/lib/camera-live-session-registry";

export type RuntimeDiagnostic = {
  id: string;
  category: "simulation" | "camera" | "sensor" | "evidence" | "storage" | "network" | "ai" | "system";
  label: string;
  status: "ok" | "warning" | "error" | "unknown";
  message: string;
  detail: string | null;
  timestamp: number;
  durationMs: number | null;
};

export type RuntimeDiagnosticsReport = {
  timestamp: number;
  diagnostics: RuntimeDiagnostic[];
  summary: {
    total: number;
    ok: number;
    warning: number;
    error: number;
    unknown: number;
    healthScore: number;
  };
};

export function buildRuntimeDiagnostics(
  scene: SecurityScene | null,
  result: SimulationResult | null,
  simulationDirty: boolean,
  simulationRunning: boolean,
  events: OperationalEvidenceEvent[],
  cameraLiveConnectionHistory: CameraLiveConnectionArchiveRecord[],
  sensorIngestHistory: SensorIngestArchiveRecord[],
  cameraLiveSessionRegistry: CameraLiveSessionRecord[],
): RuntimeDiagnosticsReport {
  const diagnostics: RuntimeDiagnostic[] = [];
  const now = Date.now();

  diagnostics.push({
    id: "sim_last_run",
    category: "simulation",
    label: "Last Simulation",
    status: result ? "ok" : simulationDirty ? "warning" : "unknown",
    message: result ? `Completed at ${new Date(result.computedAt).toLocaleTimeString()}` : simulationDirty ? "Scene changed since last run" : "No simulation data",
    detail: result ? `Coverage: ${result.totalCoveragePct.toFixed(1)}%, Issues: ${result.issues.length}` : null,
    timestamp: result?.computedAt ?? 0,
    durationMs: null,
  });

  diagnostics.push({
    id: "sim_running",
    category: "simulation",
    label: "Simulation Running",
    status: simulationRunning ? "warning" : "ok",
    message: simulationRunning ? "Simulation in progress" : "Idle",
    detail: null,
    timestamp: now,
    durationMs: null,
  });

  const activeSessions = cameraLiveSessionRegistry.filter((s) => s.status === "active");
  const expiringSessions = activeSessions.filter((s) => s.sessionExpiresAt != null && s.sessionExpiresAt - now < 5 * 60 * 1000);
  diagnostics.push({
    id: "camera_sessions",
    category: "camera",
    label: "Camera Sessions",
    status: expiringSessions.length > 0 ? "warning" : activeSessions.length > 0 ? "ok" : "unknown",
    message: `${activeSessions.length} active, ${expiringSessions.length} expiring soon`,
    detail: expiringSessions.length > 0 ? expiringSessions.map((s) => `${s.cameraName} expires ${new Date(s.sessionExpiresAt!).toLocaleTimeString()}`).join("; ") : null,
    timestamp: now,
    durationMs: null,
  });

  diagnostics.push({
    id: "camera_history",
    category: "camera",
    label: "Camera Connection History",
    status: cameraLiveConnectionHistory.length > 0 ? "ok" : "unknown",
    message: `${cameraLiveConnectionHistory.length} records`,
    detail: null,
    timestamp: now,
    durationMs: null,
  });

  diagnostics.push({
    id: "sensor_history",
    category: "sensor",
    label: "Sensor Ingest History",
    status: sensorIngestHistory.length > 0 ? "ok" : "unknown",
    message: `${sensorIngestHistory.length} records`,
    detail: null,
    timestamp: now,
    durationMs: null,
  });

  diagnostics.push({
    id: "evidence_events",
    category: "evidence",
    label: "Operational Evidence",
    status: events.length > 0 ? "ok" : "unknown",
    message: `${events.length} events`,
    detail: `Last event: ${events.length > 0 ? new Date(events[events.length - 1].timestamp).toLocaleTimeString() : "none"}`,
    timestamp: now,
    durationMs: null,
  });

  const sceneNodeCount = scene
    ? scene.walls.length + scene.doors.length + scene.windows.length + scene.cameras.length
      + scene.securityLights.length + scene.obstructions.length + scene.sensors.length
      + scene.criticalZones.length + scene.privacyZones.length + scene.paths.length
    : 0;
  diagnostics.push({
    id: "scene_nodes",
    category: "system",
    label: "Scene Nodes",
    status: sceneNodeCount > 0 ? "ok" : "warning",
    message: `${sceneNodeCount} nodes`,
    detail: scene ? `Cameras: ${scene.cameras.length}, Walls: ${scene.walls.length}, Zones: ${scene.criticalZones.length + scene.privacyZones.length}` : null,
    timestamp: now,
    durationMs: null,
  });

  const ok = diagnostics.filter((d) => d.status === "ok").length;
  const warning = diagnostics.filter((d) => d.status === "warning").length;
  const error = diagnostics.filter((d) => d.status === "error").length;
  const unknown = diagnostics.filter((d) => d.status === "unknown").length;
  const healthScore = diagnostics.length > 0 ? Math.round((ok / diagnostics.length) * 100) : 0;

  return {
    timestamp: now,
    diagnostics,
    summary: { total: diagnostics.length, ok, warning, error, unknown, healthScore },
  };
}
