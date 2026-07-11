"use client";

import { Camera, CircleCheck, CircleX, Copy, Crosshair, Eye, Loader2, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CameraFeedCanvas } from "@/components/inspector/CameraFeedCanvas";
import { CameraSpecImport } from "@/components/inspector/CameraSpecImport";
import {
  Field,
  NumberInput,
  PropSelect,
  SelectInput,
  SummaryStat,
  TextInput,
  ToggleField,
} from "@/components/inspector/inspector-controls";
import { Badge } from "@/components/shared/Badge";
import { SectionCard } from "@/components/shared/SectionCard";
import { cn } from "@/lib/cn";
import type { CameraLiveConnectionProbeResponse } from "@/lib/camera-live-connection";
import type { CameraLiveConnectionArchiveRecord } from "@/lib/camera-live-connection-history";
import type { CameraMetadataIngestResponse } from "@/lib/camera-metadata-live-ingest";
import { QUALITY_COLOR, QUALITY_LABEL } from "@/lib/quality-display";
import { buildCameraDriftReport } from "@/lib/camera-drift";
import { buildObservedVsPlannedReport } from "@/lib/observed-vs-planned";
import { buildLiveOperationalHealth } from "@/lib/security-analytics";
import type { CameraNode, CameraMotionWaypoint, DoriQuality, SimulationAssumptions } from "@/schema/security-scene";
import { qualityToScore } from "@sentineltwin/core";
import { type InspectorTab, useStudioStore } from "@/store/studio-store";
import { computeOperationalEvidenceFusionSummary } from "@/lib/sensor-fusion";
import {
  applyCameraPreset,
  CAMERA_PRESETS,
  describeCameraPreset,
  findBestCameraPreset,
  getCameraPreset,
  type CameraPresetId,
} from "@/components/workspace/camera-preset-utils";
import { validateCameraInstallability } from "@/lib/installability-validator";
import type { InstallabilityResult } from "@/lib/installability-validator";
import { InstallabilityBadge } from "@/components/inspector/InstallabilityBadge";
import { snapCameraToMount, type CameraMountSnapMode } from "./camera-mount-snap";
import { LensFovTradeoffSimulator } from "@/components/inspector/LensFovTradeoffSimulator";

// ── Constants ────────────────────────────────────────────────────────────────

const CAMERA_STATUS_OPTIONS = [
  { value: "none", label: "Off" },
  { value: "ir", label: "IR" },
  { value: "low_light", label: "Starlight" },
] as const;

const CLARITY_OPTIONS = [
  { value: "poor", label: "Poor" },
  { value: "average", label: "Average" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Clear" },
] as const;

const MOUNT_OPTIONS = [
  { value: "ceiling", label: "Ceiling" },
  { value: "wall", label: "Wall" },
  { value: "pole", label: "Pole" },
  { value: "corner", label: "Corner" },
] as const;

const RESOLUTION_OPTIONS = [
  { value: "4_2688x1520", label: "4MP (2688×1520)" },
  { value: "4_1920x1080", label: "4MP (1920×1080)" },
  { value: "2_1920x1080", label: "2MP (1920×1080)" },
  { value: "8_3840x2160", label: "8MP (3840×2160)" },
] as const;

const LENS_OPTIONS = [
  { value: "2.8", label: "Fixed 2.8mm" },
  { value: "4", label: "Fixed 4mm" },
  { value: "6", label: "Fixed 6mm" },
  { value: "8", label: "Fixed 8mm" },
] as const;

const LIVE_CONNECTION_MODE_OPTIONS = [
  { value: "rtsp", label: "RTSP" },
  { value: "mjpeg", label: "MJPEG" },
  { value: "http", label: "HTTP" },
  { value: "onvif", label: "ONVIF" },
  { value: "proxy", label: "Proxy" },
] as const;

const LIVE_CONNECTION_STATUS_OPTIONS = [
  { value: "connected", label: "Connected" },
  { value: "connecting", label: "Connecting" },
  { value: "disconnected", label: "Disconnected" },
  { value: "error", label: "Error" },
] as const;

const VIEW_MOTION_MODE_OPTIONS = [
  { value: "fixed", label: "Fixed" },
  { value: "sweep_h", label: "Horizontal sweep" },
  { value: "sweep_v", label: "Vertical sweep" },
  { value: "preset_cycle", label: "Preset cycle" },
  { value: "tracking", label: "Tracking" },
] as const;

const WAYPOINT_EASING_OPTIONS = [
  { value: "", label: "None" },
  { value: "linear", label: "Linear" },
  { value: "ease_in", label: "Ease in" },
  { value: "ease_out", label: "Ease out" },
  { value: "ease_in_out", label: "Ease in/out" },
] as const;

type CameraViewMode = "normal" | "ir" | "low_light" | "thermal";

const VIEW_MODES: Array<{ value: CameraViewMode; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "ir", label: "IR (B/W)" },
  { value: "low_light", label: "Low Light" },
  { value: "thermal", label: "Thermal" },
];

type ViewToggleKey = "overlays" | "dori" | "path" | "zones" | "timestamp" | "boundingBox" | "grid";
type ViewToggleState = Record<ViewToggleKey, boolean>;

import type { CameraMetadataArchiveRecord } from "@/lib/camera-metadata-ingest-history";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compute DORI effective ranges in metres for a camera, using the scene's PPM thresholds. */
function computeDoriRanges(camera: CameraNode, scenePpm: SimulationAssumptions["pixelsPerMeter"]) {
  const resW = camera.resolutionWidth ?? (camera.resolutionMP >= 8 ? 3840 : camera.resolutionMP >= 4 ? 2688 : 1920);
  const tanHalfFov = Math.tan((camera.fovHorizontalDeg / 2) * (Math.PI / 180));
  const cap = camera.rangeM;
  const det   = Math.min(resW / (2 * scenePpm.detection      * tanHalfFov), cap);
  const obs   = Math.min(resW / (2 * scenePpm.observation    * tanHalfFov), cap);
  const recog = Math.min(resW / (2 * scenePpm.recognition    * tanHalfFov), cap);
  const ident = Math.min(resW / (2 * scenePpm.identification * tanHalfFov), cap);
  return { det, obs, recog, ident };
}

function qualityRangeLabel(quality: DoriQuality, doriStandard: SimulationAssumptions["doriStandard"]) {
  if (quality === "none") return "<25 PPM";
  if (doriStandard === "oodpcvs_2025") {
    const ranges: Partial<Record<DoriQuality, string>> = {
      overview: "25-50 PPM",
      outline: "50-62.5 PPM",
      discern: "62.5-100 PPM",
      perceive: "100-125 PPM",
      characterize: "125-250 PPM",
      validate: "250-500 PPM",
      scrutinize: "500+ PPM",
    };
    return ranges[quality] ?? "25+ PPM";
  }
  const ranges: Partial<Record<DoriQuality, string>> = {
    detection: "25-62.5 PPM",
    observation: "62.5-125 PPM",
    recognition: "125-250 PPM",
    identification: "250+ PPM",
  };
  return ranges[quality] ?? "25+ PPM";
}

// ── Component ────────────────────────────────────────────────────────────────

export function CameraInspector() {
  const camera = useStudioStore((s) => s.getSelectedCamera());
  const cameraId = camera?.id ?? null;
  const scene = useStudioStore((s) => s.scene);
  const inspectorTab = useStudioStore((s) => s.inspectorTab);
  const setTab = useStudioStore((s) => s.setInspectorTab);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const result = useStudioStore((s) => s.simulationResult);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const runSimulation = useStudioStore((s) => s.runSimulation);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const updateNode = useStudioStore((s) => s.updateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const duplicateNode = useStudioStore((s) => s.duplicateNode);
  const addSnapshot = useStudioStore((s) => s.addSnapshot);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setCameraPresetId = useStudioStore((s) => s.setCameraPresetId);
  const cameraPresetId = useStudioStore((s) => s.cameraPresetId);
  const snapshots = useStudioStore((s) => s.snapshots);
  const operationalEvidenceEvents = useStudioStore((s) => s.operationalEvidenceEvents);
  const allCameraMetadataEvents = useStudioStore((s) => s.cameraMetadataEvents);
  const recordCameraMetadataEvent = useStudioStore((s) => s.recordCameraMetadataEvent);
  const recordCameraLiveConnectionEvent = useStudioStore((s) => s.recordCameraLiveConnectionEvent);
  const recordOperationalEvidenceEvent = useStudioStore((s) => s.recordOperationalEvidenceEvent);
  const [viewMode, setViewModeState] = useState<CameraViewMode>("normal");
  const [viewToggles, setViewToggles] = useState<ViewToggleState>({
    overlays: true, dori: true, path: false, zones: true, timestamp: true, boundingBox: false, grid: false,
  });
  const [snapshotNote, setSnapshotNote] = useState("");
  const [cameraMetadataUrl, setCameraMetadataUrl] = useState("");
  const [showLensFovSimulator, setShowLensFovSimulator] = useState(false);
  const [cameraMetadataLabel, setCameraMetadataLabel] = useState("ONVIF relay");
  const [cameraMetadataRaw, setCameraMetadataRaw] = useState("");
  const [cameraMetadataStatus, setCameraMetadataStatus] = useState<string | null>(null);
  const [cameraMetadataError, setCameraMetadataError] = useState<string | null>(null);
  const [cameraMetadataLoading, setCameraMetadataLoading] = useState(false);
  const [cameraMetadataHistory, setCameraMetadataHistory] = useState<CameraMetadataArchiveRecord[]>([]);
  const [cameraLiveConnectionHistory, setCameraLiveConnectionHistory] = useState<CameraLiveConnectionArchiveRecord[]>([]);
  const [cameraLiveSessionRegistry, setCameraLiveSessionRegistry] = useState<Array<{
    sessionId: string;
    status: "active" | "closed" | "expired";
    cameraId: string;
    cameraName: string;
    liveSessionState: "idle" | "probing" | "connected" | "error" | null;
    liveSessionExpiresAt: number | null;
    sessionExpiresAt: number | null;
    transportSessionId: string | null;
    transportSessionState: "idle" | "negotiating" | "active" | "closing" | "error" | null;
    transportResponseStatus: number | null;
    transportResponseStatusText: string | null;
    lastHeartbeatAt: number | null;
    probeCount: number;
    protocolProfile: "onvif_device" | "rtsp_session" | "mjpeg_stream" | "http_poll" | "proxy" | null;
    authMode: "none" | "basic" | "digest" | "token" | "cookie" | "onvif_digest" | "proxy_passthrough";
    authState: "unauthenticated" | "authenticating" | "authenticated" | "failed";
    authRealm: string | null;
    authSessionId: string | null;
    authSessionExpiresAt: number | null;
    authChallengeHeader: string | null;
    authChallengeScheme: "basic" | "digest" | "bearer" | "token" | null;
    authChallengeRealm: string | null;
    eventSubscriptionUri: string | null;
    eventSubscriptionReference: string | null;
    eventSubscriptionExpiresAt: number | null;
    lastAction: "bind" | "refresh" | "heartbeat" | "disconnect";
  }>>([]);
  const sceneId = useStudioStore((s) => s.scene.id);
  const cameraMetadataEvents = useMemo(
    () => allCameraMetadataEvents.filter((event) => event.sceneId === sceneId),
    [allCameraMetadataEvents, sceneId],
  );
  const allCameraLiveConnectionEvents = useStudioStore((s) => s.cameraLiveConnectionEvents);
  const cameraLiveConnectionEvents = useMemo(
    () => allCameraLiveConnectionEvents.filter((event) => event.sceneId === sceneId),
    [allCameraLiveConnectionEvents, sceneId],
  );
  const inspectionFusionSummary = useMemo(
    () => (camera ? computeOperationalEvidenceFusionSummary(camera, scene.sensors, cameraMetadataEvents, cameraLiveConnectionEvents) : null),
    [camera, cameraLiveConnectionEvents, cameraMetadataEvents, scene.sensors],
  );
  const fusionSummary = inspectionFusionSummary;
  const [liveConnectionUrl, setLiveConnectionUrl] = useState(camera?.liveFeedUrl ?? "");
  const [liveConnectionLabel, setLiveConnectionLabel] = useState(camera?.liveFeedLabel ?? "Primary live feed");
  const [liveConnectionMode, setLiveConnectionMode] = useState<CameraNode["liveConnectionMode"]>(camera?.liveConnectionMode ?? "onvif");
  const [liveConnectionStatus, setLiveConnectionStatus] = useState<CameraNode["liveConnectionStatus"]>(camera?.liveConnectionStatus ?? "disconnected");
  const [liveConnectionOnvifUsername, setLiveConnectionOnvifUsername] = useState(camera?.onvifUsername ?? "");
  const [liveConnectionOnvifPassword, setLiveConnectionOnvifPassword] = useState(camera?.onvifPassword ?? "");
  const [liveConnectionNotes, setLiveConnectionNotes] = useState("");
  const [liveConnectionStatusMessage, setLiveConnectionStatusMessage] = useState<string | null>(null);
  const [liveConnectionError, setLiveConnectionError] = useState<string | null>(null);
  const [liveConnectionLoading, setLiveConnectionLoading] = useState(false);

  const refreshCameraMetadataHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/camera-metadata-ingest", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { history?: CameraMetadataArchiveRecord[] };
      if (Array.isArray(payload.history)) {
        setCameraMetadataHistory(payload.history);
      }
    } catch {
      // Ignore history refresh failures; the ingest bridge still works.
    }
  }, []);

  useEffect(() => {
    void refreshCameraMetadataHistory();
  }, [refreshCameraMetadataHistory]);

  const refreshCameraLiveConnectionHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/camera-live-connection", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { history?: CameraLiveConnectionArchiveRecord[]; activeSessions?: typeof cameraLiveSessionRegistry };
      if (Array.isArray(payload.history)) {
        setCameraLiveConnectionHistory(payload.history.filter((entry) => entry.record.cameraId === cameraId));
      }
      if (Array.isArray(payload.activeSessions)) {
        setCameraLiveSessionRegistry(payload.activeSessions.filter((entry) => entry.cameraId === cameraId));
      }
    } catch {
      // Ignore history refresh failures; the bind/probe route still works.
    }
  }, [cameraId]);

  useEffect(() => {
    void refreshCameraLiveConnectionHistory();
  }, [refreshCameraLiveConnectionHistory]);

  // Re-initialize local connection state when the operator switches cameras
  useEffect(() => {
    setLiveConnectionUrl(camera?.liveFeedUrl ?? "");
    setLiveConnectionLabel(camera?.liveFeedLabel ?? "Primary live feed");
    setLiveConnectionMode(camera?.liveConnectionMode ?? "onvif");
    setLiveConnectionStatus(camera?.liveConnectionStatus ?? "disconnected");
    setLiveConnectionOnvifUsername(camera?.onvifUsername ?? "");
    setLiveConnectionOnvifPassword(camera?.onvifPassword ?? "");
    setLiveConnectionNotes("");
    setLiveConnectionStatusMessage(null);
    setLiveConnectionError(null);
    setLiveConnectionLoading(false);
  }, [cameraId]);

  const placementPreset = getCameraPreset(cameraPresetId);
  const bestPreset = camera ? findBestCameraPreset(camera) : null;
  const recCount = camera ? (result?.recommendations ?? []).filter(
    (r) => !r.affectedNodeId || r.affectedNodeId === camera.id,
  ).length : 0;

  const tabs: { id: InspectorTab; label: string; badge?: number }[] = [
    { id: "properties", label: "Properties", badge: recCount > 0 ? recCount : undefined },
    { id: "view", label: "View" },
    { id: "status", label: "Status" },
    { id: "analytics", label: "Analytics" },
    { id: "failures", label: "Failures" },
  ];

  const camResult = camera ? result?.cameraResults.find((entry) => entry.cameraId === camera.id) : null;

  // Per-camera Observed vs Planned: drift entry for this camera + live health
  const cameraOvpReport = useMemo(() => {
    if (!camera) return null;
    const liveHealth = buildLiveOperationalHealth(scene, operationalEvidenceEvents);
    const baseline = snapshots[0];
    const driftReport = buildCameraDriftReport(
      scene.cameras,
      baseline?.scene.cameras ?? null,
      baseline ? { label: baseline.label ?? "Baseline", timestamp: baseline.createdAt } : null,
    );
    const ovp = buildObservedVsPlannedReport(driftReport, liveHealth);
    const thisDrift = driftReport.entries.find((e) => e.cameraId === camera.id) ?? null;
    return { ovp, thisDrift };
  }, [camera, scene, snapshots, operationalEvidenceEvents]);

  const targetZone = scene.criticalZones.find((zone) => zone.id === selectedNodeId) ?? null;
  const targetZoneResult = targetZone
    ? result?.criticalZoneResults.find((entry) => entry.zoneId === targetZone.id) ?? null
    : null;
  const targetQuality = targetZone ? (camResult?.qualityByZone[targetZone.id] ?? "none") : "none";
  const targetCentroid = targetZone
    ? targetZone.polygon.reduce(
      (acc, [x, z]) => {
        acc[0] += x;
        acc[1] += z;
        return acc;
      },
      [0, 0] as [number, number],
    )
    : null;
  const targetPoint = targetCentroid && targetZone
    ? [targetCentroid[0] / targetZone.polygon.length, targetCentroid[1] / targetZone.polygon.length]
    : null;
  const targetDistanceM = camera && targetPoint
    ? Math.hypot(camera.position[0] - targetPoint[0], camera.position[2] - targetPoint[1])
    : null;
  const targetBearingDeg = camera && targetPoint
    ? ((Math.atan2(targetPoint[0] - camera.position[0], targetPoint[1] - camera.position[2]) * 180) / Math.PI)
    : null;
  const angleFromCenterDeg = camera && targetBearingDeg !== null
    ? Math.abs((((targetBearingDeg - camera.yawDeg) % 360) + 540) % 360 - 180)
    : null;
  const bestCameraForTarget = targetZone && result
    ? result.cameraResults
        .map((entry) => ({
          cameraId: entry.cameraId,
          quality: entry.qualityByZone[targetZone.id] ?? "none",
        }))
        .sort((a, b) => qualityToScore(b.quality) - qualityToScore(a.quality))[0]
    : null;
  const bestCameraName = bestCameraForTarget
    ? (scene.cameras.find((entry) => entry.id === bestCameraForTarget.cameraId)?.name ?? bestCameraForTarget.cameraId)
    : (camera?.name ?? "Camera");
  const targetDoriRanges = camera ? computeDoriRanges(camera, scene.assumptions.pixelsPerMeter) : null;
  const safeTargetDoriRanges = targetDoriRanges ?? { det: 0, obs: 0, recog: 0, ident: 0 };
  const cameraViewMotion = camera?.viewMotion ?? {
    movementMode: "fixed",
    dwellSeconds: 0,
    waypoints: [],
  };

  const setViewMotion = (patch: Partial<CameraNode["viewMotion"]>) => {
    if (!camera) return;
    const nextMovementMode = patch.movementMode ?? cameraViewMotion.movementMode;
    const nextDwellSeconds = Math.max(0, patch.dwellSeconds ?? cameraViewMotion.dwellSeconds);
    const nextWaypoints = patch.waypoints ?? cameraViewMotion.waypoints;
    const nextPatrolRouteId = patch.patrolRouteId ?? cameraViewMotion.patrolRouteId;
    const nextPatrolSpeed = patch.patrolSpeedDegPerS ?? cameraViewMotion.patrolSpeedDegPerS;

    updateNode(camera.id, {
      viewMotion: {
        movementMode: nextMovementMode,
        dwellSeconds: Number.isFinite(nextDwellSeconds) ? nextDwellSeconds : 0,
        patrolRouteId: nextPatrolRouteId,
        patrolSpeedDegPerS: nextPatrolSpeed,
        waypoints: nextWaypoints,
      },
    });
  };

  const setWaypoint = (
    index: number,
    patch: Partial<CameraNode["viewMotion"]["waypoints"][number]>,
  ) => {
    if (!camera) return;
    const nextWaypoints = [...(cameraViewMotion.waypoints ?? [])];
    const existing = nextWaypoints[index];
    if (!existing) return;
    nextWaypoints[index] = {
      ...existing,
      ...patch,
      holdSeconds: patch.holdSeconds === undefined ? existing.holdSeconds : Math.max(0, patch.holdSeconds),
    };
    setViewMotion({ waypoints: nextWaypoints });
  };

  const addWaypoint = () => {
    if (!camera) return;
    const nextWaypoints = [...(cameraViewMotion.waypoints ?? [])];
    nextWaypoints.push({
      yawDeg: camera.yawDeg,
      pitchDeg: camera.pitchDeg,
      holdSeconds: 2,
      easing: "linear",
    });
    setViewMotion({ waypoints: nextWaypoints });
  };

  const removeWaypoint = (index: number) => {
    const nextWaypoints = [...(cameraViewMotion.waypoints ?? [])];
    nextWaypoints.splice(index, 1);
    setViewMotion({ waypoints: nextWaypoints });
  };

  const feedOverlayOptions = {
    doriLabels: viewToggles.overlays && viewToggles.dori,
    pathActor: viewToggles.overlays && viewToggles.path,
    zones: viewToggles.overlays && viewToggles.zones,
    timestamp: viewToggles.overlays && viewToggles.timestamp,
    boundingBox: viewToggles.overlays && viewToggles.boundingBox,
    grid: viewToggles.overlays && viewToggles.grid,
  };
  const offlineImpact = camResult?.offlineImpact ?? [];
  const openRedundancyMatrix = useCallback(() => {
    setBottomTab("redundancy");
  }, [setBottomTab]);
  const updateCameraFailure = useCallback((patch: Partial<CameraNode>) => {
    if (!camera) return;
    updateNode(camera.id, patch);
    openRedundancyMatrix();
  }, [camera, openRedundancyMatrix, updateNode]);
  const resolutionKey = camera ? `${camera.resolutionMP}_${camera.resolutionWidth ?? 2688}x${camera.resolutionHeight ?? 1520}` : "";
  const typeKey = camera ? (camera.mountType === "ceiling" ? `${camera.resolutionMP}mp_dome` : `${camera.resolutionMP}mp_bullet`) : "";
  const viewModeLabel =
    viewMode === "normal" ? "Normal" : viewMode === "ir" ? "IR (B/W)" : viewMode === "low_light" ? "Low Light" : "Thermal";
  const targetLightingLabel =
    scene.assumptions.timeOfDay === "night"
      ? "Night"
      : scene.assumptions.timeOfDay === "custom"
        ? "Custom"
        : "Day";
  const targetPpmEstimate = targetZone ? qualityRangeLabel(targetQuality, scene.assumptions.doriStandard) : "—";
  const hasPoleTarget = scene.obstructions.some((obstruction) => obstruction.obstructionType === "pillar" || obstruction.label.toLowerCase().includes("pillar"));
  const activeSensorCount = scene.sensors.filter((sensor) => sensor.state === "active").length;
  const nearestSensor = camera && scene.sensors.length > 0
    ? scene.sensors.reduce<{ sensor: typeof scene.sensors[number] | null; distanceM: number | null }>((best, sensor) => {
        const distanceM = Math.hypot(
          camera.position[0] - sensor.position[0],
          camera.position[1] - sensor.position[1],
          camera.position[2] - sensor.position[2],
        );
        if (best.sensor === null || distanceM < (best.distanceM ?? Number.POSITIVE_INFINITY)) {
          return { sensor, distanceM };
        }
        return best;
      }, { sensor: null, distanceM: null })
    : { sensor: null, distanceM: null };
  const nearestSensorLabel = nearestSensor.sensor ? nearestSensor.sensor.label : "None";
  const nearestSensorState = nearestSensor.sensor ? nearestSensor.sensor.state.replace(/_/g, " ") : "—";
  const nearestSensorCoverage = nearestSensor.sensor ? nearestSensor.sensor.coverageMode.replace(/_/g, " ") : "—";

  // ── Installability validation ──────────────────────────────────────────
  const installabilityResult: InstallabilityResult | null = useMemo(
    () => (camera ? validateCameraInstallability(camera, scene) : null),
    [camera, scene],
  );

  const updatePosition = (next: [number, number, number]) => updateNode(camera!.id, { position: next });

  const updateHeight = (nextHeight: number) => {
    updateNode(camera!.id, {
      mountHeightM: nextHeight,
      position: [camera!.position[0], nextHeight, camera!.position[2]] as [number, number, number],
    });
  };

  const aimAtZone = () => {
    if (!targetZone) return;
    const centroid = targetZone.polygon.reduce(
      (acc, [x, z]) => { acc.x += x; acc.z += z; return acc; },
      { x: 0, z: 0 },
    );
    const n = targetZone.polygon.length || 1;
    const dx = centroid.x / n - camera!.position[0];
    const dz = centroid.z / n - camera!.position[2];
    updateNode(camera!.id, { yawDeg: Math.round(Math.atan2(dx, dz) * (180 / Math.PI)), pitchDeg: -30 });
  };

  const saveInspectionSnapshot = () => {
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const label = snapshotNote.trim().length > 0
      ? `${snapshotNote.trim()} (${stamp})`
      : `View snapshot ${stamp}`;
    addSnapshot(label, result ?? scene.simulation!);
    setSnapshotNote("");
  };

  const setViewToggle = (key: ViewToggleKey) => {
    setViewToggles((current) => ({ ...current, [key]: !current[key] }));
  };

  const snapToMount = (mode: CameraMountSnapMode) => {
    const patch = snapCameraToMount(camera!, scene, mode);
    if (!patch) return;
    updateNode(camera!.id, patch);
  };

  const openInCameraWall = () => {
    setWorkspacePreset("camera_wall");
    setViewMode("wall");
  };

  const ingestCameraMetadata = async (mode: "paste" | "external") => {
    const trimmedRaw = cameraMetadataRaw.trim();
    const trimmedUrl = cameraMetadataUrl.trim();

    if (mode === "paste" && trimmedRaw.length === 0) {
      setCameraMetadataError("Paste JSON or NDJSON camera metadata before applying it.");
      return;
    }

    if (mode === "external" && trimmedUrl.length === 0) {
      setCameraMetadataError("Provide an external feed URL before pulling camera metadata.");
      return;
    }

    setCameraMetadataLoading(true);
    setCameraMetadataError(null);
    setCameraMetadataStatus(null);

    try {
      const response = await fetch("/api/camera-metadata-ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "camera-inspector",
          ingestMode: mode,
          feedUrl: mode === "external" ? trimmedUrl : undefined,
          feedLabel: cameraMetadataLabel.trim() || undefined,
          sceneName: scene.name,
          submittedAt: Date.now(),
          raw: mode === "paste" ? trimmedRaw : "",
          cameras: scene.cameras.map((entry) => ({
            id: entry.id,
            name: entry.name,
            status: entry.status,
            clarity: entry.clarity,
            nightMode: entry.nightMode,
          })),
        }),
      });

      const body = await response.json() as {
        ok?: boolean;
        summary?: string;
        records?: CameraMetadataIngestResponse["records"];
        evidenceEvents?: CameraMetadataIngestResponse["evidenceEvents"];
        error?: string;
        issues?: Array<{ path: string; message: string }>;
      };

      if (!response.ok || body.ok === false) {
        const issueSummary = body.issues?.map((issue) => issue.message).join(" ");
        throw new Error(body.error ?? issueSummary ?? "Failed to ingest camera metadata.");
      }

      body.records?.forEach((record) => {
        const cameraBeforeUpdate = useStudioStore.getState().scene.cameras.find((entry) => entry.id === record.cameraId) ?? null;
        const patch: Partial<CameraNode> = {};
        if (record.status) patch.status = record.status;
        if (record.clarity) patch.clarity = record.clarity;
        if (record.nightMode) patch.nightMode = record.nightMode;
        if (record.notes) patch.notes = record.notes;
        if (Object.keys(patch).length > 0) {
          updateNode(record.cameraId, patch);
        }
        recordCameraMetadataEvent({
          cameraId: record.cameraId,
          cameraName: record.cameraName,
          previousStatus: cameraBeforeUpdate?.status ?? null,
          previousClarity: cameraBeforeUpdate?.clarity ?? null,
          previousNightMode: cameraBeforeUpdate?.nightMode ?? null,
          previousFeedMode: null,
          previousNotes: cameraBeforeUpdate?.notes ?? null,
          status: record.status,
          clarity: record.clarity,
          nightMode: record.nightMode,
          feedMode: record.feedMode,
          ingestMode: mode,
          feedUrl: mode === "external" ? trimmedUrl : null,
          feedLabel: cameraMetadataLabel.trim() || null,
          summary: body.summary ?? `Camera metadata archived for ${record.cameraName}.`,
          notes: record.notes,
        });
      });
      body.evidenceEvents?.forEach((event) => {
        recordOperationalEvidenceEvent(event);
      });

      const preferredRecord = body.records?.find((record) => record.cameraId === camera!.id) ?? body.records?.[0] ?? null;
      if (preferredRecord?.feedMode) {
        setViewModeState(preferredRecord.feedMode);
      }

      setCameraMetadataStatus(body.summary ?? "Camera metadata archived.");
      setCameraMetadataRaw("");
      await refreshCameraMetadataHistory();
    } catch (error) {
      setCameraMetadataError(error instanceof Error ? error.message : "Failed to ingest camera metadata.");
    } finally {
      setCameraMetadataLoading(false);
    }
  };

  const submitLiveConnection = useCallback(async (action: "bind" | "refresh" | "heartbeat" | "disconnect") => {
    if (!camera) return;
    if ((action === "bind" || action === "refresh") && !liveConnectionUrl.trim()) {
      setLiveConnectionError("Enter a live feed URL before binding the camera.");
      return;
    }

    setLiveConnectionLoading(true);
    try {
      const cameraBeforeUpdate = useStudioStore.getState().scene.cameras.find((entry) => entry.id === camera!.id) ?? camera!;
      const effectiveLiveFeedUrl = liveConnectionUrl.trim() || cameraBeforeUpdate?.liveFeedUrl || undefined;
      const response = await fetch("/api/camera-live-connection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source: "camera-inspector",
          action,
          protocol: liveConnectionMode ?? "onvif",
          endpointUrl: action === "disconnect" ? effectiveLiveFeedUrl : effectiveLiveFeedUrl,
          liveFeedUrl: effectiveLiveFeedUrl,
          feedLabel: liveConnectionLabel.trim() || undefined,
          cameraId: camera!.id,
          cameraName: camera!.name,
          sceneId: scene.id,
          sceneName: scene.name,
          submittedAt: Date.now(),
          liveSessionId: cameraBeforeUpdate?.liveSessionId ?? undefined,
          liveSessionStartedAt: cameraBeforeUpdate?.liveSessionStartedAt ?? undefined,
          liveSessionConfirmedAt: cameraBeforeUpdate?.liveSessionConfirmedAt ?? undefined,
          transportSessionId: cameraBeforeUpdate?.transportSessionId ?? undefined,
          authMode: cameraBeforeUpdate?.authMode ?? undefined,
          authState: cameraBeforeUpdate?.authState ?? undefined,
          authRealm: cameraBeforeUpdate?.authRealm ?? undefined,
          onvifUsername: (liveConnectionOnvifUsername.trim() || cameraBeforeUpdate?.onvifUsername) ?? undefined,
          onvifPassword: (liveConnectionOnvifPassword || cameraBeforeUpdate?.onvifPassword) ?? undefined,
          authSessionId: cameraBeforeUpdate?.authSessionId ?? undefined,
          authSessionExpiresAt: cameraBeforeUpdate?.authSessionExpiresAt ?? undefined,
          raw: action === "disconnect" || action === "heartbeat" ? "" : "",
          notes: liveConnectionNotes.trim() || undefined,
        }),
      });
      const body = await response.json() as CameraLiveConnectionProbeResponse & { ok?: boolean; error?: string; issues?: Array<{ path: string; message: string }> };
      if (!response.ok) {
        const issueSummary = body.issues?.map((issue) => issue.message).join(" ");
        throw new Error(body.error ?? issueSummary ?? `Failed to ${action} live camera.`);
      }

      updateNode(camera!.id, {
        liveFeedUrl: body.record.liveFeedUrl ?? undefined,
        liveFeedLabel: body.record.liveFeedLabel ?? undefined,
        liveConnectionMode: body.record.liveConnectionMode ?? undefined,
        liveConnectionStatus: body.record.liveConnectionStatus,
        liveConnectionUpdatedAt: body.record.timestamp,
        liveSessionId: body.record.liveSessionId ?? undefined,
        liveSessionState: body.record.liveSessionState ?? undefined,
        liveSessionStartedAt: body.record.liveSessionStartedAt ?? undefined,
        liveSessionConfirmedAt: body.record.liveSessionConfirmedAt ?? undefined,
        liveSessionExpiresAt: body.record.liveSessionExpiresAt ?? undefined,
        transportSessionId: body.record.transportSessionId ?? undefined,
        transportSessionState: body.record.transportSessionState ?? undefined,
        lastHeartbeatAt: body.record.lastHeartbeatAt ?? undefined,
        probeCount: body.record.probeCount ?? undefined,
        protocolProfile: body.record.protocolProfile ?? undefined,
        authMode: body.record.authMode ?? undefined,
        authState: body.record.authState ?? undefined,
        authRealm: body.record.authRealm ?? undefined,
        onvifUsername: liveConnectionOnvifUsername.trim() || undefined,
        onvifPassword: liveConnectionOnvifPassword || undefined,
        authSessionId: body.record.authSessionId ?? undefined,
        authSessionExpiresAt: body.record.authSessionExpiresAt ?? undefined,
        transportResponseStatus: body.record.transportResponseStatus ?? undefined,
        transportResponseStatusText: body.record.transportResponseStatusText ?? undefined,
        authChallengeHeader: body.record.authChallengeHeader ?? undefined,
        authChallengeScheme: body.record.authChallengeScheme ?? undefined,
        authChallengeRealm: body.record.authChallengeRealm ?? undefined,
        eventSubscriptionUri: body.record.eventSubscriptionUri ?? undefined,
        eventSubscriptionReference: body.record.eventSubscriptionReference ?? undefined,
        eventSubscriptionExpiresAt: body.record.eventSubscriptionExpiresAt ?? undefined,
      });
      recordCameraLiveConnectionEvent({
        cameraId: camera!.id,
        cameraName: camera!.name,
        previousLiveFeedUrl: cameraBeforeUpdate?.liveFeedUrl ?? null,
        previousLiveFeedLabel: cameraBeforeUpdate?.liveFeedLabel ?? null,
        previousLiveConnectionMode: cameraBeforeUpdate?.liveConnectionMode ?? null,
        previousLiveConnectionStatus: cameraBeforeUpdate?.liveConnectionStatus ?? null,
        previousAuthMode: cameraBeforeUpdate?.authMode ?? null,
        previousAuthState: cameraBeforeUpdate?.authState ?? null,
        previousAuthRealm: cameraBeforeUpdate?.authRealm ?? null,
        previousAuthSessionId: cameraBeforeUpdate?.authSessionId ?? null,
        previousAuthSessionExpiresAt: cameraBeforeUpdate?.authSessionExpiresAt ?? null,
        previousTransportResponseStatus: cameraBeforeUpdate?.transportResponseStatus ?? null,
        previousTransportResponseStatusText: cameraBeforeUpdate?.transportResponseStatusText ?? null,
        previousAuthChallengeHeader: cameraBeforeUpdate?.authChallengeHeader ?? null,
        previousAuthChallengeScheme: cameraBeforeUpdate?.authChallengeScheme ?? null,
        previousAuthChallengeRealm: cameraBeforeUpdate?.authChallengeRealm ?? null,
        previousEventSubscriptionUri: cameraBeforeUpdate?.eventSubscriptionUri ?? null,
        previousEventSubscriptionReference: cameraBeforeUpdate?.eventSubscriptionReference ?? null,
        previousEventSubscriptionExpiresAt: cameraBeforeUpdate?.eventSubscriptionExpiresAt ?? null,
        previousLiveSessionId: cameraBeforeUpdate?.liveSessionId ?? null,
        previousLiveSessionState: cameraBeforeUpdate?.liveSessionState ?? null,
        previousLiveSessionStartedAt: cameraBeforeUpdate?.liveSessionStartedAt ?? null,
        previousLiveSessionConfirmedAt: cameraBeforeUpdate?.liveSessionConfirmedAt ?? null,
        previousLiveSessionExpiresAt: cameraBeforeUpdate?.liveSessionExpiresAt ?? null,
        liveFeedUrl: body.record.liveFeedUrl,
        liveFeedLabel: body.record.liveFeedLabel,
        liveConnectionMode: body.record.liveConnectionMode,
        liveConnectionStatus: body.record.liveConnectionStatus,
        liveSessionId: body.record.liveSessionId,
        liveSessionState: body.record.liveSessionState,
        liveSessionStartedAt: body.record.liveSessionStartedAt,
        liveSessionConfirmedAt: body.record.liveSessionConfirmedAt,
        liveSessionExpiresAt: body.record.liveSessionExpiresAt,
        transportSessionId: body.record.transportSessionId,
        transportSessionState: body.record.transportSessionState,
        lastHeartbeatAt: body.record.lastHeartbeatAt,
        probeCount: body.record.probeCount,
        protocolProfile: body.record.protocolProfile,
        authMode: body.record.authMode,
        authState: body.record.authState,
        authRealm: body.record.authRealm,
        onvifUsername: liveConnectionOnvifUsername.trim() || undefined,
        onvifPassword: liveConnectionOnvifPassword || undefined,
        authSessionId: body.record.authSessionId,
        authSessionExpiresAt: body.record.authSessionExpiresAt,
        transportResponseStatus: body.record.transportResponseStatus ?? null,
        transportResponseStatusText: body.record.transportResponseStatusText ?? null,
        authChallengeHeader: body.record.authChallengeHeader ?? null,
        authChallengeScheme: body.record.authChallengeScheme ?? null,
        authChallengeRealm: body.record.authChallengeRealm ?? null,
        eventSubscriptionUri: body.record.eventSubscriptionUri ?? null,
        eventSubscriptionReference: body.record.eventSubscriptionReference ?? null,
        eventSubscriptionExpiresAt: body.record.eventSubscriptionExpiresAt ?? null,
        ingestMode: action === "disconnect" ? "manual" : "external",
        summary: body.summary ?? (action === "disconnect"
          ? `Live camera connection cleared for ${camera!.name}.`
          : action === "heartbeat"
            ? `Live camera heartbeat renewed for ${camera!.name}.`
          : action === "refresh"
            ? `Live camera session refreshed for ${camera!.name}.`
            : `Live camera connection bound for ${camera!.name}.`),
        notes: body.record.notes ?? (liveConnectionNotes.trim() || null),
      });
      setLiveConnectionMode(body.record.liveConnectionMode ?? (liveConnectionMode ?? "onvif"));
      if (body.record.liveFeedUrl) setLiveConnectionUrl(body.record.liveFeedUrl);
      if (body.record.liveFeedLabel) setLiveConnectionLabel(body.record.liveFeedLabel);
      setLiveConnectionStatus(body.record.liveConnectionStatus);
      if (body.record.liveConnectionStatus === "connected") {
        setLiveConnectionStatusMessage(body.summary ?? (action === "refresh" || action === "heartbeat" ? "Live camera session refreshed." : "Live camera binding archived."));
        setLiveConnectionError(null);
      } else if (body.record.liveConnectionStatus === "connecting") {
        setLiveConnectionStatusMessage(body.summary ?? "The live camera probe is negotiating authentication.");
        setLiveConnectionError(null);
      } else {
        setLiveConnectionStatusMessage(null);
        setLiveConnectionError(body.summary ?? "The live camera probe did not confirm a usable connection.");
      }
      if (action === "disconnect") {
        setLiveConnectionUrl("");
        setLiveConnectionLabel("Primary live feed");
        setLiveConnectionMode("onvif");
        setLiveConnectionNotes("");
      } else {
        setLiveConnectionNotes(body.record.notes ?? liveConnectionNotes);
      }
      void refreshCameraLiveConnectionHistory();
    } catch (error) {
      setLiveConnectionError(error instanceof Error ? error.message : `Failed to ${action} live camera.`);
    } finally {
      setLiveConnectionLoading(false);
    }
  }, [
    camera,
    scene.id,
    scene.name,
    liveConnectionLabel,
    liveConnectionMode,
    liveConnectionOnvifPassword,
    liveConnectionOnvifUsername,
    liveConnectionNotes,
    liveConnectionUrl,
    recordCameraLiveConnectionEvent,
    refreshCameraLiveConnectionHistory,
    updateNode,
  ]);

  const bindLiveConnection = useCallback(() => submitLiveConnection("bind"), [submitLiveConnection]);
  const refreshLiveConnection = useCallback(() => submitLiveConnection("refresh"), [submitLiveConnection]);
  const heartbeatLiveConnection = useCallback(() => submitLiveConnection("heartbeat"), [submitLiveConnection]);
  const disconnectLiveConnection = useCallback(() => submitLiveConnection("disconnect"), [submitLiveConnection]);

  useEffect(() => {
    if (!camera || camera.liveConnectionStatus !== "connected") return undefined;

    const heartbeat = window.setInterval(() => {
      if (liveConnectionLoading) return;
      void heartbeatLiveConnection();
    }, 45_000);

    return () => window.clearInterval(heartbeat);
    // Intentional: keep the live connection as a lease that renews while the operator is watching it.
  }, [camera, liveConnectionLoading, heartbeatLiveConnection]);

  if (!camera) return null;

  return (
    <>
      <div className={`{border-b UI_SURFACES.borderPanel px-3 py-3}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/12">
              <Camera className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-white">{camera.name}</span>
                {installabilityResult && (
                  <InstallabilityBadge result={installabilityResult} />
                )}
              </div>
              <div className={`text-[9px] uppercase tracking-[0.18em] UI_SURFACES.textDimMid`}>{camera.mountType} mount · {camera.resolutionMP}MP</div>
            </div>
          </div>
          <Badge variant={camera.status === "on" ? "green" : "red"} dot>
            {camera.status === "on" ? "Active" : camera.status}
          </Badge>
        </div>
      </div>

      <div className={`{flex items-end justify-between border-b UI_SURFACES.borderPanel px-2 pt-1.5}`}>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                "-mb-px relative rounded-t-lg border-b-2 px-2 py-1.5 text-[10px] font-medium transition-colors",
                inspectorTab === tab.id
                  ? "border-green-500 text-green-300"
                  : "border-transparent UI_SURFACES.textDimMid UI_SURFACES.hoverTextSoft",
              )}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[7px] font-bold text-white">
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowLensFovSimulator(true)}
          title="FOV Lab — compare lens focal length vs. DORI detection ranges"
          className="mb-0.5 ml-2 flex shrink-0 items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/8 px-2 py-1 text-[9px] text-cyan-300 transition-colors hover:bg-cyan-500/15"
        >
          <Eye className="h-3 w-3" />
          FOV Lab
          <span className="text-[8px] text-amber-400" title="Feature exclusive to SentinelTwin">★</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2.5">
        {inspectorTab === "properties" && (
          <div>
            <div className="mb-2.5 px-3 pt-3">
              <TextInput
                label="Camera Name"
                value={camera.name}
                onChange={(value) => updateNode(camera.id, { name: value })}
              />
            </div>

            <div className="mb-2.5">
              <CameraFeedCanvas cameraId={camera.id} />
            </div>

            <SectionCard title="Move & Rotate" helpText="Use the same manipulation model everywhere: keyboard nudges, on-canvas handles, and the right-click menu all patch the selected camera through the canonical store." helpTitle="Camera transform help" truthLabel="placeholder">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Keyboard</div>
                  <div className={`mt-2 space-y-2 text-[9px] leading-relaxed UI_SURFACES.textSoftDim`}>
                    <div>
                      <span className={`rounded border UI_SURFACES.borderThin UI_SURFACES.panel px-1.5 py-0.5 font-mono text-[8px] UI_SURFACES.textBody2`}>Arrow keys</span>
                      <span className="ml-2">Nudge the selected camera or object in the plane.</span>
                    </div>
                    <div>
                      <span className={`rounded border UI_SURFACES.borderThin UI_SURFACES.panel px-1.5 py-0.5 font-mono text-[8px] UI_SURFACES.textBody2`}>PageUp / PageDown</span>
                      <span className="ml-2">Raise or lower the selected camera or object.</span>
                    </div>
                    <div>
                      <span className={`rounded border UI_SURFACES.borderThin UI_SURFACES.panel px-1.5 py-0.5 font-mono text-[8px] UI_SURFACES.textBody2`}>Q / E</span>
                      <span className="ml-2">Rotate the selected camera or object left and right.</span>
                    </div>
                  </div>
                </div>
                <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2.5`}>
                  <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Mouse</div>
                  <div className={`mt-2 space-y-2 text-[9px] leading-relaxed UI_SURFACES.textSoftDim`}>
                    <div>Drag the blue handle to move, the orange handle to change height, the pitch nub to tilt, and the green ring to yaw.</div>
                    <div>Right-click the camera for snap, aim, open-view, duplicate, and delete actions.</div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Live Camera Binding" helpText="Connect this planned camera to live feed evidence. Use it to compare the site twin against the real device without making the simulation depend on the feed." helpTitle="Live camera binding help" truthLabel="live">
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Live feed URL</div>
                    <input
                      aria-label="Live feed URL"
                      value={liveConnectionUrl}
                      onChange={(event) => setLiveConnectionUrl(event.target.value)}
                      placeholder="rtsp://camera.example.com/live"
                      className={`mt-1 w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                    />
                  </div>
                  <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Feed label</div>
                    <input
                      aria-label="Live feed label"
                      value={liveConnectionLabel}
                      onChange={(event) => setLiveConnectionLabel(event.target.value)}
                      placeholder="Front entrance live stream"
                      className={`mt-1 w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                    />
                  </div>
                  <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>ONVIF username</div>
                    <input
                      aria-label="ONVIF username"
                      value={liveConnectionOnvifUsername}
                      onChange={(event) => setLiveConnectionOnvifUsername(event.target.value)}
                      placeholder="camera operator"
                      className={`mt-1 w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                    />
                  </div>
                  <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>ONVIF password</div>
                    <input
                      aria-label="ONVIF password"
                      type="password"
                      value={liveConnectionOnvifPassword}
                      onChange={(event) => setLiveConnectionOnvifPassword(event.target.value)}
                      placeholder="••••••••"
                      className={`mt-1 w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                    />
                  </div>
                  <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Connection mode</div>
                    <select
                      aria-label="Connection mode"
                      value={liveConnectionMode ?? "onvif"}
                      onChange={(event) => setLiveConnectionMode(event.target.value as CameraNode["liveConnectionMode"])}
                      className={`mt-1 w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                    >
                      {LIVE_CONNECTION_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Connection status</div>
                    <select
                      aria-label="Connection status"
                      value={liveConnectionStatus ?? "disconnected"}
                      onChange={(event) => setLiveConnectionStatus(event.target.value as CameraNode["liveConnectionStatus"])}
                      className={`mt-1 w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                    >
                      {LIVE_CONNECTION_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Connection notes</div>
                      <div className={`mt-0.5 text-[9px] UI_SURFACES.textSoftDim`}>
                        Bind the live camera connection through the canonical store so the camera glass, Scene Intelligence, and evidence trail stay aligned.
                      </div>
                    </div>
                    <div className={`text-[9px] UI_SURFACES.textDimMid`}>{cameraLiveConnectionEvents.length} records</div>
                  </div>
                  <textarea
                    aria-label="Connection notes"
                    value={liveConnectionNotes}
                    onChange={(event) => setLiveConnectionNotes(event.target.value)}
                    placeholder="Notes about the remote camera, relay, or ONVIF proxy."
                    rows={3}
                    className={`mt-2 w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={bindLiveConnection}
                    disabled={liveConnectionLoading}
                    className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-medium text-cyan-200 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {liveConnectionLoading ? "Binding..." : "Bind Live Camera"}
                  </button>
                  <button
                    type="button"
                    onClick={refreshLiveConnection}
                    disabled={liveConnectionLoading || !liveConnectionUrl.trim()}
                    className="rounded-xl border UI_SURFACES.borderElevated bg-cyan-500/8 px-3 py-1.5 text-[10px] font-medium text-cyan-100 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {liveConnectionLoading ? "Refreshing..." : "Refresh Session"}
                  </button>
                  <button
                    type="button"
                    onClick={heartbeatLiveConnection}
                    disabled={liveConnectionLoading}
                    className="rounded-xl border UI_SURFACES.borderElevated bg-cyan-500/8 px-3 py-1.5 text-[10px] font-medium text-cyan-100 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/12 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {liveConnectionLoading ? "Renewing..." : "Heartbeat Session"}
                  </button>
                  <button
                    type="button"
                    onClick={disconnectLiveConnection}
                    disabled={liveConnectionLoading}
                    className={`rounded-xl border UI_SURFACES.hoverBorder UI_SURFACES.panel px-3 py-1.5 text-[10px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.textDim hover:UI_SURFACES.card disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {liveConnectionLoading ? "Clearing..." : "Clear Binding"}
                  </button>
                </div>

                {liveConnectionStatusMessage ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-[9px] text-emerald-200">
                    {liveConnectionStatusMessage}
                  </div>
                ) : null}
                {liveConnectionError ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-[9px] text-red-200">
                    {liveConnectionError}
                  </div>
                ) : null}

                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/8 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[8px] uppercase tracking-[0.16em] text-cyan-200">Current session lease</div>
                      <div className={`mt-0.5 text-[9px] UI_SURFACES.textSoftDim`}>
                        The active registry entry shows the current lease, its auth profile, its state, and when it expires.
                      </div>
                    </div>
                    <div className="text-[9px] text-cyan-100">{cameraLiveSessionRegistry.length} active</div>
                  </div>
                  {cameraLiveSessionRegistry.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {cameraLiveSessionRegistry.slice(0, 2).map((entry) => (
                        <div key={entry.sessionId} className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className={`truncate text-[11px] font-semibold UI_SURFACES.textBody4`}>
                                {entry.cameraName}
                              </div>
                              <div className={`mt-0.5 text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>
                                {entry.status} · {entry.lastAction} · {entry.liveSessionState ?? "unknown"} · {entry.transportSessionState ?? "transport?"}{entry.transportResponseStatus == null ? "" : ` · ${entry.transportResponseStatus}${entry.transportResponseStatusText ? ` ${entry.transportResponseStatusText}` : ""}`}
                              </div>
                            </div>
                            <div className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.panel px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] UI_SURFACES.textMuted5`}>
                              {entry.sessionId.slice(-8)}
                            </div>
                          </div>
                          <div className={`mt-1 text-[9px] leading-relaxed UI_SURFACES.textSoftDim`}>
                            Expires {entry.liveSessionExpiresAt == null ? "—" : new Date(entry.liveSessionExpiresAt).toLocaleTimeString()}
                          </div>
                          <div className={`mt-0.5 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                            Registry {entry.sessionExpiresAt == null ? "—" : new Date(entry.sessionExpiresAt).toLocaleTimeString()}
                          </div>
                          <div className={`mt-0.5 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                            Auth {entry.authState ?? "unauthenticated"} · {entry.authMode ?? "none"}{entry.authRealm ? ` · realm ${entry.authRealm}` : ""}{entry.authSessionId ? ` · session ${entry.authSessionId.slice(-8)}` : ""}{entry.authSessionExpiresAt == null ? "" : ` · expires ${new Date(entry.authSessionExpiresAt).toLocaleTimeString()}`}{entry.authChallengeHeader ? ` · challenge ${entry.authChallengeHeader}` : ""}{entry.transportResponseStatus == null ? "" : ` · response ${entry.transportResponseStatus}${entry.transportResponseStatusText ? ` ${entry.transportResponseStatusText}` : ""}`}
                          </div>
                          <div className={`mt-0.5 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                            Events {entry.eventSubscriptionUri ? entry.eventSubscriptionUri : "—"}{entry.eventSubscriptionReference ? ` · ref ${entry.eventSubscriptionReference}` : ""}{entry.eventSubscriptionExpiresAt == null ? "" : ` · expires ${new Date(entry.eventSubscriptionExpiresAt).toLocaleTimeString()}`}
                          </div>
                          <div className={`mt-0.5 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                            Transport {entry.transportSessionId ? entry.transportSessionId.slice(-8) : "—"} · {entry.protocolProfile ?? "unknown"} · probes {entry.probeCount}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`mt-2 text-[9px] UI_SURFACES.textSoftMid`}>No active live session lease is currently registered.</div>
                  )}
                </div>

                <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Connection archive</div>
                      <div className={`mt-0.5 text-[9px] UI_SURFACES.textSoftDim`}>
                        Backend archive records for live camera probe, refresh, heartbeat, and disconnect actions.
                      </div>
                    </div>
                    <div className={`text-[9px] UI_SURFACES.textDimMid`}>{cameraLiveConnectionHistory.length} records</div>
                  </div>
                  {cameraLiveConnectionHistory.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {cameraLiveConnectionHistory.slice(0, 3).map((entry) => (
                        <div key={`${entry.storedAt}-${entry.record.cameraId}-${entry.action}`} className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className={`truncate text-[11px] font-semibold UI_SURFACES.textBody4`}>
                                {entry.record.liveFeedLabel ?? entry.record.cameraName}
                              </div>
                              <div className={`mt-0.5 text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>
                                {entry.action === "bind" ? "Bind probe" : entry.action === "refresh" ? "Refresh session" : "Disconnect"} · {entry.protocol.toUpperCase()}
                              </div>
                            </div>
                            <div className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.panel px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] UI_SURFACES.textMuted5`}>
                              {entry.record.liveConnectionStatus}
                            </div>
                          </div>
                          <div className={`mt-1 text-[9px] leading-relaxed UI_SURFACES.textSoftDim`}>
                            {entry.summary}
                          </div>
                          <div className={`mt-1 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                            Session {entry.record.liveSessionState ?? "unknown"}{entry.record.liveSessionId ? ` · ${entry.record.liveSessionId}` : ""}
                          </div>
                          <div className={`mt-0.5 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                            Auth {entry.record.authState ?? "unauthenticated"} · {entry.record.authMode ?? "none"}{entry.record.authSessionId ? ` · ${entry.record.authSessionId.slice(-8)}` : ""}{entry.record.authSessionExpiresAt == null ? "" : ` · expires ${new Date(entry.record.authSessionExpiresAt).toLocaleTimeString()}`}
                          </div>
                          <div className={`mt-0.5 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                            Events {entry.record.eventSubscriptionUri ? entry.record.eventSubscriptionUri : "—"}{entry.record.eventSubscriptionReference ? ` · ref ${entry.record.eventSubscriptionReference}` : ""}{entry.record.eventSubscriptionExpiresAt == null ? "" : ` · expires ${new Date(entry.record.eventSubscriptionExpiresAt).toLocaleTimeString()}`}
                          </div>
                          <div className={`mt-0.5 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                            Expires {entry.record.liveSessionExpiresAt == null ? "—" : new Date(entry.record.liveSessionExpiresAt).toLocaleTimeString()}
                          </div>
                          <div className={`mt-0.5 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                            Transport {entry.record.transportSessionId ? entry.record.transportSessionId.slice(-8) : "—"} · {entry.record.protocolProfile ?? "unknown"} · {entry.record.lastHeartbeatAt == null ? "no heartbeat" : new Date(entry.record.lastHeartbeatAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`mt-2 text-[9px] UI_SURFACES.textSoftMid`}>No connection archive records yet. Bind, refresh, or disconnect a camera to create the first backend probe record.</div>
                  )}
                </div>

                {cameraLiveConnectionEvents.length > 0 ? (
                  <div className="space-y-2">
                    {cameraLiveConnectionEvents.slice(0, 3).map((entry) => (
                      <div key={entry.id} className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className={`truncate text-[11px] font-semibold UI_SURFACES.textBody4`}>
                              {entry.liveFeedLabel ?? entry.cameraName}
                            </div>
                            <div className={`mt-0.5 text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>
                              {entry.liveConnectionStatus ?? "disconnected"} · {entry.liveConnectionMode ?? "unknown"} · {entry.ingestMode === "external" ? "External" : "Manual"} · {entry.transportSessionState ?? "transport?"}
                            </div>
                          </div>
                          <div className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.card px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] UI_SURFACES.textMuted5`}>
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                        <div className={`mt-1 text-[9px] leading-relaxed UI_SURFACES.textSoftDim`}>
                          {entry.summary}
                        </div>
                        <div className={`mt-1 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                          Session {entry.liveSessionState ?? "unknown"}{entry.liveSessionId ? ` · ${entry.liveSessionId}` : ""}
                        </div>
                        <div className={`mt-0.5 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                          Expires {entry.liveSessionExpiresAt == null ? "—" : new Date(entry.liveSessionExpiresAt).toLocaleTimeString()}
                        </div>
                        <div className={`mt-0.5 text-[8px] uppercase tracking-[0.14em] UI_SURFACES.textDimMid`}>
                          Transport {entry.transportSessionId ? entry.transportSessionId.slice(-8) : "—"} · {entry.protocolProfile ?? "unknown"} · {entry.lastHeartbeatAt == null ? "no heartbeat" : new Date(entry.lastHeartbeatAt).toLocaleTimeString()}{entry.transportResponseStatus == null ? "" : ` · ${entry.transportResponseStatus}${entry.transportResponseStatusText ? ` ${entry.transportResponseStatusText}` : ""}`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`text-[9px] UI_SURFACES.textSoftMid`}>No live camera binding has been archived yet.</div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Camera Metadata Bridge" helpText="Bring camera health, clarity, night mode, and feed status into the evidence trail. This helps explain whether a coverage issue is a design problem or an operational camera problem." helpTitle="Camera metadata help" truthLabel="imported">
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>External feed URL</div>
                    <input
                      value={cameraMetadataUrl}
                      onChange={(event) => setCameraMetadataUrl(event.target.value)}
                      placeholder="https://camera-feed.example.com/metadata"
                      className={`mt-1 w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                    />
                  </div>
                  <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Feed label</div>
                    <input
                      value={cameraMetadataLabel}
                      onChange={(event) => setCameraMetadataLabel(event.target.value)}
                      placeholder="ONVIF relay"
                      className={`mt-1 w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                    />
                  </div>
                </div>

                <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Paste metadata</div>
                      <div className={`mt-0.5 text-[9px] UI_SURFACES.textSoftDim`}>
                        Paste JSON or NDJSON camera records. Matching scene cameras update through the canonical store.
                      </div>
                    </div>
                    <div className={`text-[9px] UI_SURFACES.textDimMid`}>{scene.cameras.length} cameras in scene</div>
                  </div>
                  <textarea
                    value={cameraMetadataRaw}
                    onChange={(event) => setCameraMetadataRaw(event.target.value)}
                    placeholder='[{"cameraName":"Front Entrance","status":"malfunctioning","clarity":"poor"}]'
                    rows={5}
                    className={`mt-2 w-full rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void ingestCameraMetadata("paste")}
                    disabled={cameraMetadataLoading}
                    className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[10px] font-medium text-blue-200 transition-colors hover:border-blue-400/40 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cameraMetadataLoading ? "Applying..." : "Apply Pasted Metadata"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void ingestCameraMetadata("external")}
                    disabled={cameraMetadataLoading}
                    className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-3 py-1.5 text-[10px] font-medium UI_SURFACES.textBody2 transition-colors UI_SURFACES.hoverBorderBright hover:UI_SURFACES.card disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {cameraMetadataLoading ? "Pulling..." : "Pull External Feed"}
                  </button>
                </div>

                {cameraMetadataStatus ? (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-2 text-[9px] text-emerald-200">
                    {cameraMetadataStatus}
                  </div>
                ) : null}

                {cameraMetadataError ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-2.5 py-2 text-[9px] text-red-200">
                    {cameraMetadataError}
                  </div>
                ) : null}

                <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className={`text-[9px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textMuted`}>Ingest archive</div>
                    <div className={`text-[9px] UI_SURFACES.textDimMid`}>{cameraMetadataHistory.length} records</div>
                  </div>
                  {cameraMetadataHistory.length > 0 ? (
                    <div className="space-y-2">
                      {cameraMetadataHistory.slice(0, 3).map((entry) => (
                        <div key={`${entry.storedAt}-${entry.receivedAt}-${entry.feedUrl ?? entry.source}`} className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card p-2`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className={`truncate text-[11px] font-semibold UI_SURFACES.textBody4`}>
                                {entry.feedLabel ?? entry.source}
                              </div>
                              <div className={`mt-0.5 text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>
                                {entry.ingestMode === "external" ? "External feed" : "Pasted metadata"} · {entry.sceneName ?? "Scene"}
                              </div>
                            </div>
                            <div className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.panel px-1.5 py-0.5 text-[8px] uppercase tracking-[0.12em] UI_SURFACES.textMuted5`}>
                              {entry.records.length} matched
                            </div>
                          </div>
                          <div className={`mt-1 text-[9px] leading-relaxed UI_SURFACES.textSoftDim`}>
                            {entry.summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`text-[9px] UI_SURFACES.textSoftMid`}>No camera metadata has been archived yet.</div>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Camera Spec Import" helpText="Paste manufacturer specs to update field of view, resolution, IR range, and mounting values. Review the parsed values before trusting them in an audit." helpTitle="Camera specs help" truthLabel="imported">
              <div className="space-y-2">
                <div className={`text-[9px] leading-relaxed UI_SURFACES.textSoftMid`}>
                  Paste a spec sheet snippet or JSON payload, then let the inspector stamp the parsed optics values back onto this camera through the canonical store.
                </div>
                <CameraSpecImport camera={camera} updateNode={updateNode} />
              </div>
            </SectionCard>

            <SectionCard title="Placement Presets" truthLabel="computed">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1.5`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Tool rail</div>
                    <div className={`mt-0.5 text-[10px] font-medium UI_SURFACES.textBody2`}>
                      {placementPreset ? placementPreset.label : "Custom camera"}
                    </div>
                  </div>
                  <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1.5`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Best fit</div>
                    <div className={`mt-0.5 text-[10px] font-medium UI_SURFACES.textBody2`}>
                      {bestPreset ? bestPreset.label : "None"}
                    </div>
                  </div>
                </div>

                <div className={`text-[9px] leading-relaxed UI_SURFACES.textSoftMid`}>
                  Pick a placement preset for the next camera, or stamp one onto this camera so the inspector and editor stay on the same optics profile.
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {CAMERA_PRESETS.map((preset) => {
                    const isPlacementPreset = placementPreset?.id === preset.id;
                    const isBestPreset = bestPreset?.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setCameraPresetId(preset.id);
                          updateNode(camera.id, applyCameraPreset(preset));
                        }}
                        className={cn(
                          "rounded-xl border px-2.5 py-2 text-left transition-colors",
                          isPlacementPreset
                            ? "border-blue-400/50 bg-blue-500/10"
                            : "UI_SURFACES.borderSubtle UI_SURFACES.panel UI_SURFACES.hoverBorderBright hover:UI_SURFACES.card",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className={`truncate text-[11px] font-semibold UI_SURFACES.textBody4`}>{preset.label}</div>
                            <div className={`mt-0.5 text-[9px] leading-relaxed UI_SURFACES.textSoftDim`}>{describeCameraPreset(preset)}</div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {isPlacementPreset ? (
                              <span className="rounded-full border border-blue-400/25 bg-blue-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-blue-200">
                                Tool
                              </span>
                            ) : null}
                            {isBestPreset ? (
                              <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                                Best
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.card px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] UI_SURFACES.textMuted5`}>
                            {preset.mountType}
                          </span>
                          <span className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.card px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] UI_SURFACES.textMuted5`}>
                            {preset.ptz ? "PTZ" : "Fixed"}
                          </span>
                          <span className={`rounded-full border UI_SURFACES.borderSubtle UI_SURFACES.card px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] UI_SURFACES.textMuted5`}>
                            {preset.nightMode === "ir" ? "IR" : preset.nightMode === "low_light" ? "Low light" : preset.nightMode}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Camera Motion" helpText="Define how this camera moves so replay and coverage use time-aware behavior." helpTitle="Camera motion help" truthLabel="simulated">
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <PropSelect
                    label="Movement mode"
                    value={cameraViewMotion.movementMode}
                    options={VIEW_MOTION_MODE_OPTIONS}
                    onChange={(value) => setViewMotion({ movementMode: value as CameraNode["viewMotion"]["movementMode"] })}
                  />
                  <NumberInput
                    label="Dwell seconds"
                    value={cameraViewMotion.dwellSeconds ?? 0}
                    min={0}
                    step={0.25}
                    unit="s"
                    onChange={(value) => setViewMotion({ dwellSeconds: Math.max(0, value) })}
                  />
                </div>

                <div className={`flex items-center justify-between gap-2 border-b UI_SURFACES.borderFaint pb-2`}>
                  <span className={`text-[10px] UI_SURFACES.textSoftMid`}>Preset ID</span>
                  <select
                    value={camera.presetId ?? ""}
                    onChange={(event) => {
                      const selectedPresetId = (event.target.value || null) as CameraPresetId | null;
                      const selectedPreset = selectedPresetId ? getCameraPreset(selectedPresetId) : null;
                      setCameraPresetId(selectedPresetId);
                      if (selectedPreset) {
                        updateNode(camera.id, applyCameraPreset(selectedPreset));
                      } else {
                        updateNode(camera.id, { presetId: undefined });
                      }
                    }}
                    className={`rounded-md border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-1 text-[10px] font-medium UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                  >
                    <option value="">Custom / no preset</option>
                    {CAMERA_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className={`border-b UI_SURFACES.borderFaint pb-2 last:border-b-0 last:pb-0`}>
                    <label className="mb-1 flex items-center justify-between gap-3">
                      <span className={`text-[10px] UI_SURFACES.textSoftMid`}>Patrol route ID</span>
                      <input
                        type="text"
                        value={cameraViewMotion.patrolRouteId ?? ""}
                        onChange={(event) => setViewMotion({ patrolRouteId: event.target.value || undefined })}
                        placeholder="optional"
                        className={`h-7 w-44 rounded-md border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-1 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50`}
                      />
                    </label>
                  </div>
                  <NumberInput
                    label="Patrol speed"
                    value={cameraViewMotion.patrolSpeedDegPerS ?? 0}
                    min={0.1}
                    step={1}
                    unit="deg/s"
                    onChange={(value) => setViewMotion({ patrolSpeedDegPerS: value })}
                  />
                </div>

                {cameraViewMotion.movementMode !== "fixed" ? (
                  <div className={`space-y-2 rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1.5`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className={`text-[10px] font-semibold UI_SURFACES.textBody4`}>Patrol waypoints</div>
                        <div className={`text-[8px] UI_SURFACES.textDimMid`}>Optional timeline points for sweep or tracking paths</div>
                      </div>
                      <button
                        type="button"
                        onClick={addWaypoint}
                        className="rounded-md border border-blue-500/20 bg-blue-500/12 px-2 py-1 text-[9px] font-semibold text-blue-200 transition-colors hover:border-blue-400/35 hover:bg-blue-500/20"
                      >
                        + Add waypoint
                      </button>
                    </div>

                    {cameraViewMotion.waypoints.length > 0 ? (
                      <div className="space-y-2">
                        {cameraViewMotion.waypoints.map((waypoint, index) => (
                          <div key={`${waypoint.yawDeg}-${waypoint.pitchDeg}-${index}`} className={`space-y-2 rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[9px] font-semibold UI_SURFACES.textSoftDim`}>Waypoint {index + 1}</span>
                              <button
                                type="button"
                                onClick={() => removeWaypoint(index)}
                                className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[8px] font-semibold text-red-200 transition-colors hover:border-red-400/35 hover:bg-red-500/20"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-4">
                              <NumberInput label="Yaw" value={waypoint.yawDeg} step={1} unit="°" onChange={(value) => setWaypoint(index, { yawDeg: value })} />
                              <NumberInput label="Pitch" value={waypoint.pitchDeg} step={1} unit="°" onChange={(value) => setWaypoint(index, { pitchDeg: value })} />
                              <NumberInput label="Hold" value={waypoint.holdSeconds} min={0} step={0.25} unit="s" onChange={(value) => setWaypoint(index, { holdSeconds: value })} />
                              <label className={`flex items-center justify-between gap-1 rounded-md border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1`}>
                                <span className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Easing</span>
                                <select
                                  value={waypoint.easing ?? ""}
                                  onChange={(event) => {
                                    const nextEasing = event.target.value as CameraMotionWaypoint["easing"] | "";
                                    setWaypoint(index, {
                                      easing: nextEasing === "" ? undefined : nextEasing,
                                    });
                                  }}
                                  className={`rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-1.5 py-0.5 text-[9px] font-medium UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
                                >
                                  {WAYPOINT_EASING_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`text-[9px] UI_SURFACES.textSoftMid`}>No waypoints defined. Add points only for sweep / patrol logic.</div>
                    )}
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <div className={`flex items-center justify-between gap-3 border-b UI_SURFACES.borderFaint py-1.5`}>
              <span className={`text-[10px] UI_SURFACES.textSoftMid`}>Type</span>
              <select
                value={typeKey}
                onChange={(e) => {
                  const [mp, shape] = e.target.value.split("_");
                  updateNode(camera.id, {
                    resolutionMP: parseInt(mp ?? "4"),
                    mountType: shape === "dome" ? "ceiling" : "wall",
                  });
                }}
                className={`rounded-md border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-1 text-[10px] font-medium UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors UI_SURFACES.hoverBorderSubtle`}
              >
                <option value="4mp_dome">4MP Indoor Dome</option>
                <option value="2mp_dome">2MP Indoor Dome</option>
                <option value="4mp_bullet">4MP Bullet</option>
                <option value="2mp_bullet">2MP Bullet</option>
                <option value="8mp_dome">8MP Indoor Dome</option>
              </select>
            </div>

            <PropSelect
              label="Mount"
              value={camera.mountType}
              options={MOUNT_OPTIONS}
              onChange={(v) => updateNode(camera.id, { mountType: v as CameraNode["mountType"] })}
            />

            <SectionCard title="Mount Snap" helpText="Snap this camera to a realistic wall, ceiling, or pole mount so coverage results reflect where the device can actually be installed." helpTitle="Mount snap help" truthLabel="computed">
              <div className="space-y-2">
                <div className={`text-[10px] leading-relaxed UI_SURFACES.textSoftMid`}>
                  Snap this camera to a wall, ceiling, or pole-like mount target, then re-aim it toward the room interior.
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    {
                      mode: "wall" as const,
                      label: "Wall",
                      helper: scene.walls.length > 0 ? "Nearest wall" : "No walls",
                      disabled: scene.walls.length === 0,
                    },
                    {
                      mode: "ceiling" as const,
                      label: "Ceiling",
                      helper: "Ceiling plane",
                      disabled: false,
                    },
                    {
                      mode: "pole" as const,
                      label: "Pole",
                      helper: hasPoleTarget ? "Nearest pillar" : "No pillar",
                      disabled: !hasPoleTarget,
                    },
                  ] satisfies Array<{ mode: CameraMountSnapMode; label: string; helper: string; disabled: boolean }>).map((item) => (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => snapToMount(item.mode)}
                      disabled={item.disabled}
                      className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2.5 py-2 text-left transition-colors UI_SURFACES.hoverBorderBright hover:UI_SURFACES.card disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <div className={`text-[11px] font-semibold UI_SURFACES.textBody4`}>{item.label}</div>
                      <div className={`mt-0.5 text-[9px] UI_SURFACES.textSoftDim`}>{item.helper}</div>
                    </button>
                  ))}
                </div>
                <div className={`text-[9px] UI_SURFACES.textMuted`}>
                  Wall snapping uses room walls, ceiling snapping uses the ceiling plane, and pole snapping prefers the nearest pillar-like obstruction.
                </div>
              </div>
            </SectionCard>

            <div className={`border-b UI_SURFACES.borderFaint py-1.5`}>
              <div className={`mb-1.5 text-[10px] UI_SURFACES.textSoftMid`}>Position (m)</div>
              <div className="grid grid-cols-3 gap-1.5">
                <NumberInput label="X" value={camera.position[0]} step={0.1} unit="m" onChange={(value) => updatePosition([value, camera.position[1], camera.position[2]])} />
                <NumberInput label="Y" value={camera.position[1]} min={0.5} max={4} step={0.1} unit="m" onChange={updateHeight} />
                <NumberInput label="Z" value={camera.position[2]} step={0.1} unit="m" onChange={(value) => updatePosition([camera.position[0], camera.position[1], value])} />
              </div>
            </div>

            <div className={`border-b UI_SURFACES.borderFaint py-1.5`}>
              <div className={`mb-1.5 text-[10px] UI_SURFACES.textSoftMid`}>Rotation (°)</div>
              <div className="grid grid-cols-3 gap-1.5">
                <NumberInput label="Yaw"   value={camera.yawDeg}   min={-180} max={180} step={1} unit="°" onChange={(value) => updateNode(camera.id, { yawDeg: value })} />
                <NumberInput label="Pitch" value={camera.pitchDeg} min={-90}  max={0}   step={1} unit="°" onChange={(value) => updateNode(camera.id, { pitchDeg: value })} />
                <NumberInput label="Roll"  value={camera.rollDeg}  min={-180} max={180} step={1} unit="°" onChange={(value) => updateNode(camera.id, { rollDeg: value })} />
              </div>
            </div>

            <div className={`border-b UI_SURFACES.borderFaint py-1.5`}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className={`text-[10px] UI_SURFACES.textSoftMid`}>FOV (Horizontal)</span>
                <span className={`font-mono text-[11px] UI_SURFACES.textBody2`}>{camera.fovHorizontalDeg}°</span>
              </div>
              <input
                type="range" min={30} max={180} step={1}
                value={camera.fovHorizontalDeg}
                onChange={(e) => updateNode(camera.id, { fovHorizontalDeg: Number(e.target.value) })}
                className="w-full accent-blue-400"
              />
            </div>

            <PropSelect
              label="Resolution"
              value={RESOLUTION_OPTIONS.find((o) => o.value.startsWith(`${camera.resolutionMP}_`)) ? resolutionKey : RESOLUTION_OPTIONS[0].value}
              options={RESOLUTION_OPTIONS}
              onChange={(v) => {
                const [mp, dims] = v.split("_");
                const [w, h] = (dims ?? "2688x1520").split("x");
                updateNode(camera.id, {
                  resolutionMP: parseInt(mp ?? "4"),
                  resolutionWidth: parseInt(w ?? "2688"),
                  resolutionHeight: parseInt(h ?? "1520"),
                });
              }}
            />

            <PropSelect
              label="Lens"
              value={String(camera.focalLengthMm ?? 2.8)}
              options={LENS_OPTIONS}
              onChange={(v) => updateNode(camera.id, { focalLengthMm: parseFloat(v) })}
            />
            <button
              type="button"
              onClick={() => setShowLensFovSimulator(true)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded border border-cyan-500/20 bg-cyan-500/8 px-2 py-1 text-[9px] text-cyan-300 hover:bg-cyan-500/15 transition-colors"
            >
              <Eye className="h-3 w-3" />
              Lens / FOV Simulator
            </button>

            <div className={`border-b UI_SURFACES.borderFaint py-1.5`}>
              <div className={`mb-1.5 text-[10px] UI_SURFACES.textSoftMid`}>Height</div>
              <NumberInput label="Height" value={camera.mountHeightM} min={0.5} max={4} step={0.1} unit="m" onChange={updateHeight} />
            </div>

            <PropSelect
              label="Night Mode"
              value={camera.nightMode === "low_light" ? "low_light" : camera.nightMode}
              options={CAMERA_STATUS_OPTIONS}
              onChange={(v) => updateNode(camera.id, { nightMode: v as CameraNode["nightMode"] })}
            />

            <PropSelect
              label="Image Clarity"
              value={camera.clarity}
              options={CLARITY_OPTIONS}
              onChange={(v) => updateNode(camera.id, { clarity: v as CameraNode["clarity"] })}
            />

            <Field label="IR Range" value={camera.irRangeM > 0 ? camera.irRangeM : "None"} unit={camera.irRangeM > 0 ? "m" : undefined} />
            <Field label="PTZ" value={camera.ptz ? "Yes" : "No"} />
            <Field label="Thermal" value={camera.thermalCapable ? "Yes" : "No"} />

            <div className={`border-b UI_SURFACES.borderFaint py-1.5`}>
              <div className={`mb-1.5 text-[10px] UI_SURFACES.textSoftMid`}>LPR / ALPR</div>
              <div className="space-y-1.5">
                <ToggleField
                  label="LPR Capable"
                  value={camera.lprCapable ?? false}
                  trueLabel="Yes"
                  falseLabel="No"
                  onChange={(v) => updateNode(camera.id, { lprCapable: v, lprConfig: v ? (camera.lprConfig ?? { readRangeM: 10, maxSpeedKph: 30, mountAngle: "front_on" }) : undefined })}
                />
                {camera.lprCapable && camera.lprConfig && (
                  <>
                    <NumberInput label="Read Range" value={camera.lprConfig.readRangeM} min={1} step={1} unit="m" onChange={(v) => updateNode(camera.id, { lprConfig: { ...camera.lprConfig!, readRangeM: v } })} />
                    <NumberInput label="Max Speed" value={camera.lprConfig.maxSpeedKph} min={0} step={5} unit="kph" onChange={(v) => updateNode(camera.id, { lprConfig: { ...camera.lprConfig!, maxSpeedKph: v } })} />
                    <SelectInput
                      label="Mount Angle"
                      value={camera.lprConfig.mountAngle}
                      options={[
                        { value: "front_on", label: "Front-on" },
                        { value: "side_on", label: "Side-on" },
                        { value: "angled", label: "Angled" },
                      ]}
                      onChange={(v) => updateNode(camera.id, { lprConfig: { ...camera.lprConfig!, mountAngle: v as "front_on" | "side_on" | "angled" } })}
                    />
                  </>
                )}
              </div>
            </div>

            <div className={`border-b UI_SURFACES.borderFaint py-1.5`}>
              <div className={`mb-1.5 text-[10px] UI_SURFACES.textSoftMid`}>Compliance & Privacy</div>
              <div className="space-y-1.5">
                <ToggleField
                  label="NDAA Compliant"
                  value={camera.ndaaCompliant ?? true}
                  trueLabel="Yes"
                  falseLabel="No"
                  onChange={(v) => updateNode(camera.id, { ndaaCompliant: v })}
                />
                <ToggleField
                  label="Privacy Masking Active"
                  value={camera.privacyMaskingEnabled ?? false}
                  trueLabel="On"
                  falseLabel="Off"
                  onChange={(v) => updateNode(camera.id, { privacyMaskingEnabled: v })}
                />
              </div>
            </div>

            {/* ── Installability section ── */}
            {installabilityResult && (
              <SectionCard title="Installability" truthLabel="computed">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] UI_SURFACES.textSoftMid`}>Overall</span>
                    <InstallabilityBadge result={installabilityResult} />
                  </div>

                  {/* Individual checks */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { key: "mountSurfaceValid" as const, label: "Mount surface" },
                      { key: "mountHeightValid" as const, label: "Height" },
                      { key: "angleValid" as const, label: "Pitch angle" },
                      { key: "obstructionClearance" as const, label: "Obstruction clearance" },
                      { key: "ladderAccessible" as const, label: "Ladder access" },
                      { key: "cableReachable" as const, label: "Cable routing" },
                    ] as const).map(({ key, label }) => (
                      <div
                        key={key}
                        className={cn(
                          "rounded-lg border px-2 py-1.5",
                          installabilityResult[key]
                            ? "border-emerald-500/15 bg-emerald-500/5"
                            : "border-red-500/15 bg-red-500/5",
                        )}
                      >
                        <div className="flex items-center gap-1">
                          {installabilityResult[key]
                            ? <CircleCheck className="h-2.5 w-2.5 text-emerald-400" />
                            : <CircleX className="h-2.5 w-2.5 text-red-400" />
                          }
                          <span className={cn(
                            "text-[9px]",
                            installabilityResult[key] ? "text-emerald-200" : "text-red-200",
                          )}>
                            {label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Warnings */}
                  {installabilityResult.warnings.length > 0 && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-2 py-1.5">
                      <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-amber-400">
                        Warnings
                      </div>
                      <ul className="space-y-0.5">
                        {installabilityResult.warnings.map((w, index) => (
                          <li key={`w-${index}`} className="flex items-start gap-1 text-[8px] UI_SURFACES.textGray">
                            <span className="mt-0.5 text-amber-400">•</span>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggestions */}
                  {installabilityResult.suggestions.length > 0 && (
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/8 px-2 py-1.5">
                      <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-blue-400">
                        Suggestions
                      </div>
                      <ul className="space-y-0.5">
                        {installabilityResult.suggestions.map((s, index) => (
                          <li key={`s-${index}`} className="flex items-start gap-1 text-[8px] UI_SURFACES.textGray">
                            <span className="mt-0.5 text-blue-400">→</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {(() => {
              const dori = computeDoriRanges(camera, scene.assumptions.pixelsPerMeter);
              return (
                <div className={`mt-2.5 rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
                  <div className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] UI_SURFACES.textMuted`}>DORI</div>
                  <div className="space-y-1">
                    {([
                      { label: "Detect", value: dori.det,   color: "text-orange-300" },
                      { label: "Recog",  value: dori.recog, color: "text-yellow-300" },
                      { label: "Ident",  value: dori.ident, color: "text-emerald-300" },
                    ] as const).map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] UI_SURFACES.textSoftMid`}>{label}</span>
                        <div className="flex items-center gap-1">
                          <span className={`font-mono text-[11px] font-semibold ${color}`}>{value.toFixed(1)}</span>
                          <span className={`text-[8px] UI_SURFACES.textDimMid`}>m</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-2 flex items-center justify-between border-t UI_SURFACES.borderSubtle pt-2`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] UI_SURFACES.textSoftMid`}>Target</span>
                      <span className={`rounded UI_SURFACES.hoverBgSubtle px-1.5 py-0.5 text-[9px] font-medium UI_SURFACES.textBody`}>Face</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("view")}
                      className={`flex items-center gap-1 rounded-md border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-1 text-[9px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText`}
                    >
                      Export Frame
                    </button>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const recs = result?.recommendations.filter((r) =>
                !r.affectedNodeId || r.affectedNodeId === camera.id,
              ) ?? [];
              if (recs.length === 0) return null;
              const COST_COLOR: Record<string, string> = {
                free: "text-green-300", low: "text-emerald-300", medium: "text-yellow-300", high: "text-red-300",
              };
              return (
                <div className="mt-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5">
                  <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-400">
                    <span className="h-1 w-1 rounded-full bg-blue-400" />
                    Recommended Next Steps
                  </div>
                  <div className="space-y-2">
                    {recs.slice(0, 3).map((rec) => (
                      <div key={rec.description} className="flex items-start gap-2">
                        <span className={`mt-0.5 flex-shrink-0 text-[7px] font-bold ${COST_COLOR[rec.costCategory] ?? "UI_SURFACES.textMuted5"}`}>
                          {rec.costCategory.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className={`text-[9px] leading-tight UI_SURFACES.textBody`}>{rec.description}</div>
                          {rec.estimatedImpact && <div className={`mt-0.5 text-[8px] UI_SURFACES.textDimMid`}>{rec.estimatedImpact}</div>}
                        </div>
                        {rec.verified && <span className="ml-auto flex-shrink-0 rounded bg-green-900/30 px-1 py-0.5 text-[7px] font-semibold text-green-400">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {inspectorTab === "analytics" && (
          <div className="space-y-2.5">
            <SectionCard title="Coverage Performance" helpText="Shows how much usable coverage this camera contributes under the current assumptions and which critical zones pass or fail." helpTitle="Coverage performance help" truthLabel={camResult ? "simulated" : "placeholder"}>
              <div className="grid grid-cols-3 gap-1.5">
                <SummaryStat label="Coverage"   value={camResult ? `${camResult.coveragePct.toFixed(1)}%` : "--"} accent="text-emerald-300" />
                <SummaryStat label="Zones Pass" value={camResult ? `${camResult.criticalZonesCovered.length}` : "--"} accent="text-blue-300" />
                <SummaryStat label="Zones Fail" value={camResult ? `${camResult.criticalZonesFailed.length}` : "--"} accent="text-amber-300" />
              </div>
            </SectionCard>
            <SectionCard title="Operational Fusion" helpText="Combines planned camera coverage with live metadata, connection health, and nearby sensor signals so the operator can separate design risk from device health risk." helpTitle="Operational fusion help" truthLabel="inferred">
              <div className="grid grid-cols-2 gap-1.5">
                <SummaryStat label="Health" value={fusionSummary?.operationalHealthLabel ?? "Unknown"} accent="text-cyan-300" />
                <SummaryStat label="Metadata" value={fusionSummary?.cameraMetadataEvent ? `${fusionSummary.cameraMetadataEvent.status ?? "unknown"} · ${fusionSummary.cameraMetadataEvent.clarity ?? "unknown"}` : "none"} accent="text-emerald-300" />
                <SummaryStat label="Connection" value={fusionSummary?.cameraLiveConnectionEvent ? `${fusionSummary.cameraLiveConnectionEvent.liveConnectionStatus ?? "unknown"} · ${fusionSummary.cameraLiveConnectionEvent.transportSessionState ?? "transport?"}` : "none"} accent="text-blue-300" />
                <SummaryStat label="Sensors" value={fusionSummary ? `${fusionSummary.sensorFusion.activeCount} / ${fusionSummary.sensorFusion.totalCount}` : "--"} accent="text-amber-300" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px] UI_SURFACES.textSoftMuted">
                <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1.5`}>
                  <div className={`uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Nearest sensor</div>
                  <div className={`mt-1 UI_SURFACES.textBody2`}>{fusionSummary?.sensorFusion.nearestSensor?.label ?? "None"}</div>
                </div>
                <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1.5`}>
                  <div className={`uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Health detail</div>
                  <div className={`mt-1 UI_SURFACES.textBody2`}>{fusionSummary?.operationalHealthDetail ?? "Unavailable"}</div>
                </div>
              </div>
            </SectionCard>
            {cameraOvpReport && (
              <SectionCard title="Observed vs Planned" helpText="Compares this camera's current physical state to the last verified baseline. Drift means the camera has moved or been re-aimed since baseline. Live faults mean the camera is not reporting healthy right now." helpTitle="Observed vs Planned help" truthLabel="inferred">
                {!snapshots[0] ? (
                  <div className={`text-[10px] UI_SURFACES.textSoftMid`}>No baseline snapshot yet. Take a snapshot to enable drift detection for this camera.</div>
                ) : cameraOvpReport.thisDrift ? (
                  <div className={`rounded-lg border px-2.5 py-2 text-[11px] ${cameraOvpReport.thisDrift.severity === "major" ? "border-rose-400/25 bg-rose-500/10 text-rose-100" : "border-amber-400/20 bg-amber-500/8 text-amber-100"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold capitalize">{cameraOvpReport.thisDrift.severity} drift</span>
                      <span className="text-[10px] uppercase tracking-[0.1em]">{cameraOvpReport.ovp.summary.statusLabel}</span>
                    </div>
                    <div className="mt-1 text-[10px] opacity-80">{cameraOvpReport.thisDrift.detail}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
                    <CircleCheck className="h-3.5 w-3.5" />
                    On plan — no drift detected against baseline
                  </div>
                )}
              </SectionCard>
            )}

            <SectionCard title="Sensor Fusion" helpText="Shows nearby non-camera sensors that may confirm activity when camera coverage is weak. This is a preview of multi-sensor evidence, not a replacement for camera verification." helpTitle="Sensor fusion help" truthLabel="inferred">
              <div className="grid grid-cols-2 gap-1.5">
                <SummaryStat label="Sensors" value={`${scene.sensors.length}`} accent="text-cyan-300" />
                <SummaryStat label="Active" value={`${activeSensorCount}`} accent="text-emerald-300" />
                <SummaryStat label="Nearest" value={nearestSensorLabel} accent="text-blue-300" />
                <SummaryStat
                  label="Distance"
                  value={nearestSensor.distanceM != null ? `${nearestSensor.distanceM.toFixed(1)}m` : "—"}
                  accent="text-amber-300"
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px] UI_SURFACES.textSoftMuted">
                <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1.5`}>
                  <div className={`uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Nearest sensor state</div>
                  <div className={`mt-1 UI_SURFACES.textBody2`}>{nearestSensorState}</div>
                </div>
                <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1.5`}>
                  <div className={`uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Coverage mode</div>
                  <div className={`mt-1 UI_SURFACES.textBody2`}>{nearestSensorCoverage}</div>
                </div>
              </div>
              <div className={`mt-2 text-[10px] leading-relaxed UI_SURFACES.textSoftMid`}>
                Sensors are schema-backed and live in the same scene graph as cameras. This preview makes the nearest sensor to the selected camera visible while full live fusion remains the next platform step.
              </div>
            </SectionCard>
            <SectionCard title="Verified Notes" truthLabel="simulated">
              {offlineImpact.length > 0 ? (
                <div className="space-y-2">
                  {offlineImpact.map((message, index) => (
                    <div key={`msg-${index}`} /* stable order */ className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-2 py-2 text-[10px] text-amber-200">{message}</div>
                  ))}
                </div>
              ) : (
                <div className={`text-[10px] UI_SURFACES.textSoftMid`}>No single-point failure warnings are active for this camera in the current run.</div>
              )}
            </SectionCard>
          </div>
        )}

        {inspectorTab === "status" && (
          <div className="space-y-2.5">
            <SectionCard title="Operational Status" truthLabel="live">
              <ToggleField
                label="Status"
                value={camera.status === "on"}
                trueLabel="On" falseLabel="Off"
                onChange={(value) => updateNode(camera.id, { status: value ? "on" : "off" })}
              />
              <SelectInput label="Night Mode" value={camera.nightMode === "low_light" ? "low_light" : camera.nightMode} options={[...CAMERA_STATUS_OPTIONS]} onChange={(value) => updateNode(camera.id, { nightMode: value as CameraNode["nightMode"] })} />
              <SelectInput label="Image Clarity" value={camera.clarity} options={[...CLARITY_OPTIONS]} onChange={(value) => updateNode(camera.id, { clarity: value as CameraNode["clarity"] })} />
              <Field label="PTZ" value={camera.ptz ? "Enabled" : "No"} />
              <Field label="Thermal" value={camera.thermalCapable ? "Capable" : "No"} />
              {camera.irRangeM > 0 ? <Field label="IR Range" value={camera.irRangeM} unit="m" /> : null}
            </SectionCard>
          </div>
        )}

        {inspectorTab === "view" && (
          <div className="space-y-2.5">
            <div className="grid gap-2 sm:grid-cols-2">
              <SectionCard title="View Mode" truthLabel="placeholder">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] UI_SURFACES.textSoftMid`}>Current Feed</span>
                    <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                      {viewModeLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {VIEW_MODES.map((entry) => (
                      <button
                        key={entry.value}
                        type="button"
                        onClick={() => setViewModeState(entry.value)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors",
                          viewMode === entry.value
                            ? "border-cyan-500/80 bg-cyan-500/10 text-cyan-200"
                            : "UI_SURFACES.hoverBorder UI_SURFACES.textSoftDim UI_SURFACES.textBody",
                        )}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>
                  <div className={`text-[9px] leading-relaxed UI_SURFACES.textSoftMid`}>
                    The live preview follows the selected camera, and the overlay stack below controls what gets drawn on top of the feed.
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Target Info" truthLabel="computed">
                <div className="space-y-1">
                  <Field label="Target Type" value={targetZone?.targetType.replace(/_/g, " ") ?? "—"} />
                  <Field label="Distance" value={targetDistanceM != null ? `${targetDistanceM.toFixed(1)}m` : "—"} />
                  <Field label="PPM est." value={targetPpmEstimate} />
                  <Field label="Angle from center" value={angleFromCenterDeg != null ? `${angleFromCenterDeg.toFixed(1)}°` : "—"} />
                  <Field label="Lighting" value={targetLightingLabel} />
                </div>
              </SectionCard>
            </div>

            <SectionCard title="DORI Overlay (At Target)" helpText="Translates camera detail at the selected target into usable evidence quality. The key question is whether this camera can detect, observe, recognize, or identify what the zone requires." helpTitle="Evidence quality help" truthLabel="simulated">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <SummaryStat label="Target" value={targetZone?.label ?? "None"} accent="text-blue-300" />
                  <SummaryStat
                    label="Status"
                    value={
                      targetZoneResult?.status === "pass"
                        ? "Pass"
                        : targetZoneResult?.status === "partial"
                          ? "Partial"
                          : targetZoneResult?.status === "fail"
                            ? "Fail"
                            : "Unknown"
                    }
                    accent={targetZoneResult?.status === "pass" ? "text-emerald-300" : targetZoneResult?.status === "fail" ? "text-red-300" : "text-amber-300"}
                  />
                  <SummaryStat value={targetQuality.toUpperCase()} label={`Quality / ${targetZone ? "Required" : "Target"}`} accent="text-amber-300" />
                  <SummaryStat label="Best Camera" value={bestCameraName} accent="text-cyan-300" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1.5`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Target Type</div>
                    <div className={`mt-1 UI_SURFACES.textBody2`}>{targetZone?.targetType.replace(/_/g, " ") ?? "—"}</div>
                  </div>
                  <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1.5`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Distance</div>
                    <div className={`mt-1 UI_SURFACES.textBody2`}>{targetDistanceM != null ? `${targetDistanceM.toFixed(1)}m` : "—"}</div>
                  </div>
                  <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card px-2 py-1.5`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Angle</div>
                    <div className={`mt-1 UI_SURFACES.textBody2`}>{angleFromCenterDeg != null ? `${angleFromCenterDeg.toFixed(1)}°` : "—"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px] UI_SURFACES.textSoftMuted">
                  <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2 py-1.5`}>
                    <div className={`uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>DORI band</div>
                    <div className={`mt-1 UI_SURFACES.textBody2`}>{targetZone ? qualityRangeLabel(targetQuality, scene.assumptions.doriStandard) : "No target selected"}</div>
                  </div>
                  <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2 py-1.5`}>
                    <div className={`uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Lighting</div>
                    <div className={`mt-1 UI_SURFACES.textBody2`}>
                      {scene.assumptions.timeOfDay === "night" ? "Night" : scene.assumptions.timeOfDay === "custom" ? "Custom" : "Day"}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[9px] font-semibold UI_SURFACES.textMuted3">Range checkpoints</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <SummaryStat label="Detect" value={`${targetDoriRanges!.det.toFixed(1)}m`} accent="text-orange-300" />
                    <SummaryStat label="Recog" value={`${targetDoriRanges!.recog.toFixed(1)}m`} accent="text-yellow-300" />
                    <SummaryStat label="Ident" value={`${targetDoriRanges!.ident.toFixed(1)}m`} accent="text-emerald-300" />
                    <SummaryStat label="Best" value={bestCameraName} accent="text-blue-300" />
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="View Options" helpText="Choose which review overlays appear in the simulated camera view. These controls change what you see, not the underlying site twin." helpTitle="View options help" truthLabel="placeholder">
              <div className="space-y-1">
                <ToggleField label="Overlay Stack" value={viewToggles.overlays} trueLabel="Show" falseLabel="Hide" onChange={(value) => setViewToggles((current) => ({ ...current, overlays: value }))} />
                <ToggleField label="Show DORI Labels" value={viewToggles.dori} trueLabel="Show" falseLabel="Hide" onChange={() => setViewToggle("dori")} />
                <ToggleField label="Show Path Actor" value={viewToggles.path} trueLabel="Show" falseLabel="Hide" onChange={() => setViewToggle("path")} />
                <ToggleField label="Show Zones" value={viewToggles.zones} trueLabel="Show" falseLabel="Hide" onChange={() => setViewToggle("zones")} />
                <ToggleField label="Show Timestamp" value={viewToggles.timestamp} trueLabel="Show" falseLabel="Hide" onChange={() => setViewToggle("timestamp")} />
                <ToggleField label="Show Bounding Box" value={viewToggles.boundingBox} trueLabel="Show" falseLabel="Hide" onChange={() => setViewToggle("boundingBox")} />
                <ToggleField label="Show Grid" value={viewToggles.grid} trueLabel="Show" falseLabel="Hide" onChange={() => setViewToggle("grid")} />
              </div>
            </SectionCard>

            <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2.5`}>
              <div className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] UI_SURFACES.textMuted`}>Live Camera Feed</div>
              <CameraFeedCanvas cameraId={camera.id} overlayOptions={feedOverlayOptions} />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <SectionCard title="View Metrics" helpText="Quick camera facts for the current simulated feed: status, lens width, resolution, range, and measured zone coverage." helpTitle="View metrics help" truthLabel="simulated">
                <div className="space-y-1">
                  <Field label="Camera" value={camera.name} />
                  <Field label="Status" value={camera.status === "on" ? "Online" : "Offline"} />
                  <Field label="Mode" value={viewMode === "normal" ? "Normal" : viewMode === "ir" ? "IR (B/W)" : viewMode === "low_light" ? "Low Light" : "Thermal"} />
                  <Field label="FOV" value={`${camera.fovHorizontalDeg}°`} />
                  <Field label="Resolution" value={`${camera.resolutionMP}MP`} />
                  <Field label="Range" value={`${camera.rangeM}m`} />
                  {camResult ? <Field label="Coverage" value={`${camResult.coveragePct.toFixed(1)}%`} /> : null}
                  {camResult ? <Field label="Critical zones passed" value={camResult.criticalZonesCovered.length} /> : null}
                  {camResult ? <Field label="Critical zones failed" value={camResult.criticalZonesFailed.length} /> : null}
                </div>
              </SectionCard>

              <SectionCard title="DORI Profile" helpText="Shows how evidence quality changes by distance and zone. Use it to decide whether a wide shot needs a second, tighter camera." helpTitle="DORI profile help" truthLabel="simulated">
                {(() => {
                  const sortedZoneEntries = (Object.entries(camResult?.qualityByZone ?? {}) as [string, DoriQuality][])
                    .map(([zoneId, quality]) => ({
                      name: scene.criticalZones.find((entry) => entry.id === zoneId)?.label ?? zoneId,
                      quality,
                    }))
                    .filter((entry) => entry.quality !== undefined);
                  const doriRows = [
                    ["identification", safeTargetDoriRanges.ident, QUALITY_COLOR.identification],
                    ["recognition", safeTargetDoriRanges.recog, QUALITY_COLOR.recognition],
                    ["observation", safeTargetDoriRanges.obs, QUALITY_COLOR.observation],
                    ["detection", safeTargetDoriRanges.det, QUALITY_COLOR.detection],
                  ] as const;
                  return (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="text-[9px] font-semibold UI_SURFACES.textMuted3">Zone quality checkpoints</div>
                        {sortedZoneEntries.length > 0 ? (
                          <div className="space-y-1">
                            {sortedZoneEntries.slice(0, 2).map((entry) => (
                              <div key={entry.name} className={`rounded-md border UI_SURFACES.borderDeep UI_SURFACES.card px-2 py-1.5`}>
                                <div className="flex items-center justify-between gap-2 text-[10px]">
                                  <span className={`truncate UI_SURFACES.textBody`}>{entry.name}</span>
                                  <span className="font-semibold UI_SURFACES.textInfoLight">{QUALITY_LABEL[entry.quality]}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={`text-[9px] UI_SURFACES.textMuted`}>No active critical-zone quality samples yet.</div>
                        )}
                      </div>
                      <div className="space-y-1">
                        {doriRows.map(([label, value, color]) => (
                          <div key={label} className="flex items-center justify-between gap-2 text-[10px]">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
                              <span className={`UI_SURFACES.textBody2 capitalize`}>{label}</span>
                            </div>
                            <span className="font-mono text-[10px] UI_SURFACES.textSoftMuted">{value.toFixed(1)}m</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </SectionCard>
            </div>

            <div className={`space-y-2 rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2.5`}>
              <div className={`text-[9px] font-semibold uppercase tracking-[0.2em] UI_SURFACES.textMuted`}>Report Snapshot</div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <input
                  aria-label="Snapshot note"
                  value={snapshotNote}
                  onChange={(event) => setSnapshotNote(event.target.value)}
                  placeholder="e.g. before wall shift"
                  className={`rounded-lg border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-1.5 text-[10px] UI_SURFACES.textBody2 outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50`}
                />
                <button
                  type="button" onClick={saveInspectionSnapshot}
                  disabled={!result && !scene.simulation}
                  className="rounded-lg border border-emerald-600/50 bg-emerald-700/10 px-2 py-1.5 text-[9px] font-medium text-emerald-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Take Snapshot
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={openInCameraWall} className={`rounded-lg border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-2 text-[10px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText`}>
                Open in Camera Wall
              </button>
              <button
                type="button"
                onClick={() => {
                  const store = useStudioStore.getState();
                  store.setWorkspacePreset("coverage");
                  store.setViewMode("camera_view");
                }}
                className={`rounded-lg border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-2 text-[10px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText`}
              >
                Enter Full Camera View
              </button>
            </div>
          </div>
        )}

        {inspectorTab === "failures" && (() => {
          const coveragePct = camResult?.coveragePct ?? 0;
          const zonesCovered = camResult?.criticalZonesCovered ?? [];
          const otherResults = (result?.cameraResults ?? []).filter((r) => r.cameraId !== camera.id);
          const nonRedundantZones = zonesCovered.filter(
            (zoneId) => !otherResults.some((o) => o.criticalZonesCovered.includes(zoneId))
          );
          const critScore = Math.min(10, Math.round((coveragePct / 12) + nonRedundantZones.length * 2));
          const critLabel = critScore >= 8 ? "Critical" : critScore >= 5 ? "Important" : "Redundant";
          const critColor = critScore >= 8 ? "text-red-400" : critScore >= 5 ? "text-amber-400" : "text-green-400";
          const critBorderColor = critScore >= 8 ? "#f87171" : critScore >= 5 ? "#fbbf24" : "#4ade80";
          const pathSegmentCount = (result?.pathResults ?? []).flatMap((pr) =>
            pr.timeline.filter((t) => t.cameraId === camera.id)
          ).length;
          const isOffline = camera.status !== "on";
          const isDirty = camera.clarity === "poor";
          const isNightDisabled = camera.nightMode === "none";
          const isSimulatingFailure = isOffline || isDirty || isNightDisabled;

          return (
            <div className="space-y-2.5">
              {camResult && (
                <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2.5`}>
                  <div className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] UI_SURFACES.textMuted`}>Camera Criticality</div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: critBorderColor }}>
                      <span className={`text-[15px] font-bold ${critColor}`}>{critScore}</span>
                    </div>
                    <div>
                      <div className={`text-[12px] font-semibold ${critColor}`}>{critLabel}</div>
                      <div className={`mt-0.5 text-[9px] UI_SURFACES.textMuted`}>
                        {coveragePct.toFixed(1)}% scene · {nonRedundantZones.length} sole-coverage zone{nonRedundantZones.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className={`font-mono text-[13px] font-bold UI_SURFACES.textBody`}>{pathSegmentCount}</div>
                      <div className={`text-[8px] UI_SURFACES.textMuted`}>path events</div>
                    </div>
                  </div>
                </div>
              )}

              <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2.5`}>
                <div className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] UI_SURFACES.textMuted`}>Simulate Failure</div>
                <div className="space-y-2">
                  {[
                    { label: "Camera Offline",       sub: "Power cut / network loss",      isActive: isOffline,       onToggle: () => updateCameraFailure({ status: isOffline ? "on" : "off" }), activeColor: "bg-red-500/60" },
                    { label: "Dirty / Blocked Lens", sub: "Spray paint, grease, mud",       isActive: isDirty,         onToggle: () => updateCameraFailure({ clarity: isDirty ? "good" : "poor" }), activeColor: "bg-amber-500/60" },
                    { label: "Night Vision Disabled", sub: "IR cut / low-light mode off",   isActive: isNightDisabled, onToggle: () => updateCameraFailure({ nightMode: isNightDisabled ? "ir" : "none" }), activeColor: "bg-amber-500/60" },
                  ].map(({ label, sub, isActive, onToggle, activeColor }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <div>
                        <div className={`text-[10px] UI_SURFACES.textBody`}>{label}</div>
                        <div className={`text-[8px] UI_SURFACES.textMuted`}>{sub}</div>
                      </div>
                      <button
                        type="button" onClick={onToggle}
                        className={cn("flex h-5 w-9 flex-shrink-0 items-center rounded-full px-0.5 transition-colors", isActive ? activeColor : "UI_SURFACES.borderDark")}
                      >
                        <span className={cn("block h-4 w-4 rounded-full bg-white shadow transition-transform", isActive ? "translate-x-4" : "translate-x-0")} />
                      </button>
                    </div>
                  ))}
                </div>
                {isSimulatingFailure && (
                  <div className="mt-2.5 flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-500/8 px-2 py-1.5">
                    <span className="text-[9px] text-amber-300">Failure active — re-run simulation to see impact</span>
                    <button
                      type="button"
                      onClick={() => updateCameraFailure({ status: "on", clarity: "good", nightMode: "ir" })}
                      className="ml-2 flex-shrink-0 rounded border border-amber-500/30 px-1.5 py-0.5 text-[8px] font-medium text-amber-300 transition-colors hover:bg-amber-500/15"
                    >
                      Restore
                    </button>
                  </div>
                )}
                {!isSimulatingFailure && <div className={`mt-2.5 text-[8px] UI_SURFACES.textDim`}>Toggle failures above, then re-run simulation to compute impact.</div>}
              </div>

              {zonesCovered.length > 0 && (
                <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2.5`}>
                  <div className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] UI_SURFACES.textMuted`}>Zone Coverage ({zonesCovered.length})</div>
                  <div className="space-y-1">
                    {zonesCovered.map((zoneId) => {
                      const hasBackup = otherResults.some((o) => o.criticalZonesCovered.includes(zoneId));
                      const zoneName = scene.criticalZones.find((z) => z.id === zoneId)?.label ?? zoneId;
                      return (
                        <div key={zoneId} className="flex items-center justify-between gap-2">
                          <span className={`truncate text-[10px] UI_SURFACES.textMuted5`}>{zoneName}</span>
                          <span className={cn("flex-shrink-0 rounded px-1.5 py-0.5 text-[7px] font-semibold", hasBackup ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400")}>
                            {hasBackup ? "Redundant" : "No Backup"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pathSegmentCount > 0 && (
                <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2.5`}>
                  <div className={`mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] UI_SURFACES.textMuted`}>Route Exposure Responsibility</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[17px] font-bold text-orange-300">{pathSegmentCount}</span>
                    <span className={`text-[9px] UI_SURFACES.textMuted`}>detection event{pathSegmentCount !== 1 ? "s" : ""} rely on this camera</span>
                  </div>
                  <div className={`mt-1 text-[8px] UI_SURFACES.textDim`}>If offline, {pathSegmentCount} path detection{pathSegmentCount !== 1 ? "s" : ""} would be lost.</div>
                </div>
              )}

              {offlineImpact.length > 0 && (
                <div className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-2.5`}>
                  <div className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] UI_SURFACES.textMuted`}>Impact Notes</div>
                  <div className="space-y-1.5">
                    {offlineImpact.map((message, index) => (
                      <div key={`msg-${index}`} /* stable order */ className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-2 py-1.5 text-[9px] text-amber-200">{message}</div>
                    ))}
                  </div>
                </div>
              )}

              {!camResult && (
                <div className={`rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.card p-3 text-[10px] leading-relaxed UI_SURFACES.textSoftMid`}>
                  <div className="mb-2">
                    Run the shared simulation to populate failure impact analysis for this camera.
                  </div>
                  <button
                    type="button"
                    onClick={runSimulation}
                    disabled={simulationRunning}
                    className={`inline-flex items-center gap-1.5 rounded-md border UI_SURFACES.borderThin UI_SURFACES.panel px-2.5 py-1.5 text-[9px] font-medium text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {simulationRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                    {simulationRunning ? "Running..." : "Run Simulation"}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div className={`{space-y-2 border-t UI_SURFACES.borderPanel px-3 py-3}`}>
        <div className="flex gap-2">
          <button
            type="button" onClick={aimAtZone} disabled={!targetZone}
            className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border UI_SURFACES.borderThin UI_SURFACES.card text-[10px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Crosshair className="h-3 w-3" />
            Aim at Zone
          </button>
          <button
            type="button"
            onClick={() => { setTab("view"); const store = useStudioStore.getState(); store.setWorkspacePreset("coverage"); store.setViewMode("camera_view"); }}
            className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border UI_SURFACES.borderThin UI_SURFACES.card text-[10px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText`}
          >
            <Eye className="h-3 w-3" />
            Go To Camera View
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => removeNode(camera.id)} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-900/45 bg-red-950/15 text-[10px] font-medium text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/30">
            <Trash2 className="h-3 w-3" />
            Delete Camera
          </button>
          <button
            type="button" onClick={() => duplicateNode(camera.id)}
            className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border UI_SURFACES.borderThin UI_SURFACES.card text-[10px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText`}
          >
            <Copy className="h-3 w-3" />
            Duplicate
          </button>
        </div>
      </div>

      {/* Lens/FOV Tradeoff Simulator Modal */}
      {showLensFovSimulator && camera && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className={`relative max-h-[90vh] w-[820px] overflow-y-auto rounded-2xl border UI_SURFACES.borderSubtle UI_SURFACES.panel shadow-2xl shadow-black/50`}>
            <LensFovTradeoffSimulator camera={camera} onClose={() => setShowLensFovSimulator(false)} />
          </div>
        </div>
      )}
    </>
  );
}
