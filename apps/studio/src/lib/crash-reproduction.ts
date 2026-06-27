import type { SecurityScene } from "@/schema/security-scene";
import type { OperationalEvidenceEvent } from "@/lib/operational-evidence";
import type { CameraLiveConnectionArchiveRecord } from "@/lib/camera-live-connection-history";
import type { SensorIngestArchiveRecord } from "@/lib/sensor-ingest-history";
import type { CameraLiveSessionRecord } from "@/lib/camera-live-session-registry";

export type CrashReproductionBundle = {
  id: string;
  capturedAt: number;
  scene: SecurityScene | null;
  operationalEvidenceEvents: OperationalEvidenceEvent[];
  cameraLiveConnectionHistory: CameraLiveConnectionArchiveRecord[];
  sensorIngestHistory: SensorIngestArchiveRecord[];
  cameraLiveSessionRegistry: CameraLiveSessionRecord[];
  errorMessage: string;
  errorStack: string | null;
  userAgent: string;
  route: string;
  viewMode: string | null;
  activeTool: string | null;
};

export function captureCrashReproductionBundle(
  error: Error | string,
  scene: SecurityScene | null,
  events: OperationalEvidenceEvent[],
  cameraHistory: CameraLiveConnectionArchiveRecord[],
  sensorHistory: SensorIngestArchiveRecord[],
  sessionRegistry: CameraLiveSessionRecord[],
  route: string,
  viewMode: string | null,
  activeTool: string | null,
): CrashReproductionBundle {
  const errorMessage = typeof error === "string" ? error : error.message;
  const errorStack = typeof error === "string" ? null : error.stack ?? null;

  return {
    id: `crash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    capturedAt: Date.now(),
    scene: scene ? JSON.parse(JSON.stringify(scene)) : null,
    operationalEvidenceEvents: events,
    cameraLiveConnectionHistory: cameraHistory,
    sensorIngestHistory: sensorHistory,
    cameraLiveSessionRegistry: sessionRegistry,
    errorMessage,
    errorStack,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    route,
    viewMode,
    activeTool,
  };
}

export function formatCrashReproductionBundle(bundle: CrashReproductionBundle): string {
  const lines: string[] = [];
  lines.push(`# Crash Reproduction Bundle: ${bundle.id}`);
  lines.push(`Captured: ${new Date(bundle.capturedAt).toISOString()}`);
  lines.push(`Error: ${bundle.errorMessage}`);
  if (bundle.errorStack) lines.push(`Stack: ${bundle.errorStack}`);
  lines.push(`Route: ${bundle.route}`);
  lines.push(`View: ${bundle.viewMode ?? "unknown"}`);
  lines.push(`Tool: ${bundle.activeTool ?? "unknown"}`);
  lines.push(`User Agent: ${bundle.userAgent}`);
  lines.push(`Scene: ${bundle.scene?.name ?? "none"} (${bundle.scene?.id ?? "none"})`);
  lines.push(`Evidence Events: ${bundle.operationalEvidenceEvents.length}`);
  lines.push(`Camera History: ${bundle.cameraLiveConnectionHistory.length}`);
  lines.push(`Sensor History: ${bundle.sensorIngestHistory.length}`);
  lines.push(`Session Registry: ${bundle.cameraLiveSessionRegistry.length}`);
  return lines.join("\n");
}

export function exportCrashReproductionBundle(bundle: CrashReproductionBundle): string {
  return JSON.stringify(bundle, null, 2);
}
