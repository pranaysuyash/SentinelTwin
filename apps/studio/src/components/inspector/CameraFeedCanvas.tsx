"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import * as THREE from "three";
import { cn } from "@/lib/cn";

import "@/lib/three-compat";
import type { CameraNode, DoriQuality, SecurityScene } from "@/schema/security-scene";
import { computeOperationalEvidenceFusionSummary, computeSensorFusionSummary } from "@/lib/sensor-fusion";
import { samplePathQuality } from "@/components/map/path-quality";
import { qualityToScore } from "@sentineltwin/core";
import { useStudioStore } from "@/store/studio-store";
import { PathActor, CoverageSegmentPath, SceneEnvironmentSetup, SceneShadowCaster } from "@/components/workspace/SharedScene";
import { CameraFeedPostProcessing } from "@/components/view/CameraFeedPostProcessing";
import { CameraRigLive, SceneFeedGeometry } from "@/components/view/SceneFeedCanvas";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
type FeedViewMode = "normal" | "ir" | "low_light" | "thermal";
type FeedOverlayOptions = {
  doriLabels: boolean;
  pathActor: boolean;
  zones: boolean;
  timestamp: boolean;
  boundingBox: boolean;
  grid: boolean;
};

const DEFAULT_FEED_OVERLAY_OPTIONS: FeedOverlayOptions = {
  doriLabels: true,
  pathActor: false,
  zones: true,
  timestamp: true,
  boundingBox: false,
  grid: false,
};

const FEED_MODE_LABELS: Record<FeedViewMode, string> = {
  normal: "Normal",
  ir: "IR",
  low_light: "Low Light",
  thermal: "Thermal",
};

const DORI_2014_RANGES: Record<Exclude<DoriQuality, "none" | "overview" | "outline" | "discern" | "perceive" | "characterize" | "validate" | "scrutinize">, string> = {
  detection: "25-62.5 PPM",
  observation: "62.5-125 PPM",
  recognition: "125-250 PPM",
  identification: "250+ PPM",
};

const OODPCVS_RANGES: Record<Exclude<DoriQuality, "none" | "detection" | "observation" | "recognition" | "identification">, string> = {
  overview: "25-50 PPM",
  outline: "50-62.5 PPM",
  discern: "62.5-100 PPM",
  perceive: "100-125 PPM",
  characterize: "125-250 PPM",
  validate: "250-500 PPM",
  scrutinize: "500+ PPM",
};

function qualityRangeLabel(quality: DoriQuality, doriStandard: SecurityScene["assumptions"]["doriStandard"]) {
  if (quality === "none") return "<25 PPM";
  if (doriStandard === "oodpcvs_2025") {
    return OODPCVS_RANGES[quality as keyof typeof OODPCVS_RANGES] ?? "25+ PPM";
  }
  return DORI_2014_RANGES[quality as keyof typeof DORI_2014_RANGES] ?? "25+ PPM";
}

function getReplaySegmentState(points: [number, number][], progress: number) {
  if (points.length < 2) {
    return { currentIndex: 0, segmentProgress: 0 };
  }

  const clamped = Math.max(0, Math.min(1, progress));
  const segmentLengths = points.slice(1).map((point, index) => {
    const prev = points[index]!;
    return Math.hypot(point[0] - prev[0], point[1] - prev[1]);
  });
  const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0);
  if (totalLength <= 0) return { currentIndex: 0, segmentProgress: 0 };

  let remaining = totalLength * clamped;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index]!;
    if (index === segmentLengths.length - 1 || remaining <= length) {
      return {
        currentIndex: index,
        segmentProgress: length > 0 ? remaining / length : 0,
      };
    }
    remaining -= length;
  }

  return { currentIndex: segmentLengths.length - 1, segmentProgress: 1 };
}

function FeedArtifacts({
  camera,
  clarity,
  pathState,
  pathLabel,
  pathProgress,
  sensorFusion,
  operationalFusion,
  showOperationalFusionSummary: showOperationalFusionSummaryFlag,
  overlayOptions,
}: {
  camera: CameraNode;
  clarity: CameraNode["clarity"];
  pathState: { currentIndex: number; segmentProgress: number } | null;
  pathLabel?: string | null;
  pathProgress?: number;
  sensorFusion: {
    totalCount: number;
    activeCount: number;
    nearestSensorLabel: string;
    nearestSensorState: string;
    nearestSensorCoverage: string;
    nearestDistanceM: number | null;
  };
  operationalFusion?: ReturnType<typeof computeOperationalEvidenceFusionSummary> | null;
  showOperationalFusionSummary: boolean;
  overlayOptions: FeedOverlayOptions;
}) {
  const cameraStatus = String(camera.status);
  const problematicStatuses = new Set(["dirty", "blocked", "malfunctioning"]);
  const isProblematic = cameraStatus !== "on" || clarity === "poor" || problematicStatuses.has(cameraStatus);

  const badgeLabel =
    cameraStatus === "off"
      ? "Offline"
      : cameraStatus === "blocked"
        ? "Blocked"
        : cameraStatus === "malfunctioning"
          ? "Malfunctioning"
          : clarity === "poor" || cameraStatus === "dirty"
            ? "Dirty Lens"
            : null;

  const overlayOpacity = clarity === "poor" || cameraStatus === "dirty"
    ? 0.45
    : clarity === "average"
      ? 0.24
      : 0.12;

  const timestamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.02), rgba(0,0,0,0.02) 2px, transparent 2px, transparent 4px)",
          opacity: overlayOpacity,
          mixBlendMode: "soft-light",
        }}
      />

      {overlayOptions.grid ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(96,165,250,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.15) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
            mixBlendMode: "screen",
          }}
        />
      ) : null}

      {isProblematic ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/12 via-transparent to-red-950/10" />
      ) : null}

      {overlayOptions.doriLabels && badgeLabel ? (
        <div className="absolute left-3 top-20 z-10 rounded-lg border border-amber-400/25 bg-black/65 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-amber-200">
          {badgeLabel}
        </div>
      ) : null}

      {overlayOptions.pathActor && pathState ? (
        <div className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-lg border border-sky-400/20 bg-black/60 px-2.5 py-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-sky-200">
          <div>Actor replay active</div>
          <div className="mt-0.5 max-w-[160px] truncate text-[7px] font-medium tracking-[0.1em] text-sky-100/80">
            {pathLabel ?? "Selected path"} · {Math.round((pathProgress ?? 0) * 100)}% complete
          </div>
        </div>
      ) : null}

      {overlayOptions.boundingBox ? (
        <div
          className="pointer-events-none absolute inset-[18%_22%] rounded-2xl border border-red-400/50 bg-red-500/8 shadow-[0_0_0_1px_rgba(248,113,113,0.14)]"
          aria-hidden="true"
        />
      ) : null}

      {overlayOptions.timestamp ? (
        <div className={`pointer-events-none absolute left-3 bottom-3 z-10 rounded-lg border UI_SURFACES.borderElevated bg-black/65 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] UI_SURFACES.textBody`}>
          {timestamp}
        </div>
      ) : null}

      {showOperationalFusionSummaryFlag && operationalFusion ? (
        <div className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-lg border border-cyan-400/20 bg-black/68 px-2.5 py-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
          <div className="text-[8px] uppercase tracking-[0.18em] text-cyan-300/90">Operational Fusion</div>
          <div className="mt-1 text-[9px] font-semibold normal-case tracking-normal text-white">{operationalFusion?.operationalHealthLabel}</div>
          <div className="mt-1 space-y-0.5 text-[8px] font-medium uppercase tracking-[0.12em] text-cyan-100/75">
            <div>Metadata: {operationalFusion?.cameraMetadataEvent ? `${operationalFusion.cameraMetadataEvent.status ?? "unknown"} · ${operationalFusion.cameraMetadataEvent.clarity ?? "unknown"}` : "none"}</div>
            <div>Connection: {operationalFusion?.cameraLiveConnectionEvent ? `${operationalFusion.cameraLiveConnectionEvent.liveConnectionStatus ?? "unknown"} · ${operationalFusion.cameraLiveConnectionEvent.transportSessionState ?? "transport?"}${operationalFusion.cameraLiveConnectionEvent.transportResponseStatus == null ? "" : ` · ${operationalFusion.cameraLiveConnectionEvent.transportResponseStatus}${operationalFusion.cameraLiveConnectionEvent.transportResponseStatusText ? ` ${operationalFusion.cameraLiveConnectionEvent.transportResponseStatusText}` : ""}`}` : "none"}</div>
            <div>Auth: {operationalFusion?.cameraLiveConnectionEvent ? `${operationalFusion.cameraLiveConnectionEvent.authState ?? "unknown"} · ${operationalFusion.cameraLiveConnectionEvent.authMode ?? "unknown"}${operationalFusion.cameraLiveConnectionEvent.authChallengeScheme ? ` · ${operationalFusion.cameraLiveConnectionEvent.authChallengeScheme}` : ""}` : "none"}</div>
            <div>
              Auth session: {operationalFusion?.cameraLiveConnectionEvent?.authSessionId ?? "none"}
              {operationalFusion?.cameraLiveConnectionEvent?.authSessionExpiresAt == null
                ? ""
                : ` · expires ${new Date(operationalFusion?.cameraLiveConnectionEvent?.authSessionExpiresAt ?? 0).toLocaleTimeString()}`}
            </div>
            <div>Challenge: {operationalFusion?.cameraLiveConnectionEvent?.authChallengeHeader ?? "none"}</div>
            <div>Events: {operationalFusion?.cameraLiveConnectionEvent?.eventSubscriptionUri ?? "none"}</div>
            <div>Sensors: {sensorFusion.activeCount} / {sensorFusion.totalCount}</div>
            <div>Nearest: {sensorFusion.nearestSensorLabel}</div>
          </div>
        </div>
      ) : null}

    </>
  );
}

function CameraFeedScene({
  camera,
  pathState,
  selectedPathWaypoints,
  selectedPathPositions,
  overlayOptions,
}: {
  camera: CameraNode;
  pathState: { currentIndex: number; segmentProgress: number } | null;
  selectedPathWaypoints: Array<{ position: [number, number]; detectionQuality: DoriQuality }>;
  selectedPathPositions: [number, number][];
  overlayOptions: FeedOverlayOptions;
}) {
  return (
    <>
      <CameraRigLive camera={camera} />
      <SceneFeedGeometry theme={undefined} showPrivacyZones={overlayOptions.zones} />

      {selectedPathPositions.length > 0 && pathState && overlayOptions.pathActor ? (
        <>
          <CoverageSegmentPath waypoints={selectedPathWaypoints} />
          <PathActor
            waypoints={selectedPathPositions}
            currentIndex={pathState.currentIndex}
            progress={pathState.segmentProgress}
          />
        </>
      ) : null}
    </>
  );
}

export function CameraFeedCanvas({
  cameraId,
  overlayOptions = DEFAULT_FEED_OVERLAY_OPTIONS,
}: {
  cameraId: string;
  overlayOptions?: Partial<FeedOverlayOptions>;
}) {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const activePathId = useStudioStore((s) => s.activePathId);
  const sceneId = useStudioStore((s) => s.scene.id);
  const allSensorEvents = useStudioStore((s) => s.sensorEvents);
  const allCameraMetadataEvents = useStudioStore((s) => s.cameraMetadataEvents);
  const allCameraLiveConnectionEvents = useStudioStore((s) => s.cameraLiveConnectionEvents);
  const camera = scene.cameras.find((entry) => entry.id === cameraId);
  const [viewMode, setViewMode] = useState<FeedViewMode>("normal");
  const overlayFlags = { ...DEFAULT_FEED_OVERLAY_OPTIONS, ...overlayOptions };
  const sensorEvents = useMemo(
    () => allSensorEvents.filter((event) => event.sceneId === sceneId),
    [allSensorEvents, sceneId],
  );
  const cameraMetadataEvents = useMemo(
    () => allCameraMetadataEvents.filter((event) => event.sceneId === sceneId),
    [allCameraMetadataEvents, sceneId],
  );
  const cameraLiveConnectionEvents = useMemo(
    () => allCameraLiveConnectionEvents.filter((event) => event.sceneId === sceneId),
    [allCameraLiveConnectionEvents, sceneId],
  );
  const operationalFusion = useMemo(
    () => (camera ? computeOperationalEvidenceFusionSummary(camera, scene.sensors, cameraMetadataEvents, cameraLiveConnectionEvents) : null),
    [camera, cameraLiveConnectionEvents, cameraMetadataEvents, scene.sensors],
  );
  const showOperationalFusionSummary = Boolean(
    operationalFusion
      && (operationalFusion.operationalHealth !== "unknown"
        || operationalFusion.sensorFusion.totalCount > 0
        || operationalFusion.cameraMetadataEvent
        || operationalFusion.cameraLiveConnectionEvent),
  );

  const selectedPath = activePathId ? (scene.paths.find((path) => path.id === activePathId) ?? null) : null;
  const pathPoints = useMemo(
    () => selectedPath?.points.map((point) => point.position) ?? [],
    [selectedPath],
  );
  const pathWaypoints = useMemo(
    () => {
      if (!selectedPath || result?.coverageCells?.length === 0) {
        return (selectedPath?.points ?? []).map((point) => ({
          position: point.position,
          detectionQuality: "none" as DoriQuality,
        }));
      }

      return samplePathQuality(selectedPath, result?.coverageCells ?? [], 0.25).map((sample) => ({
        position: sample.position,
        detectionQuality: sample.quality,
      }));
    },
    [selectedPath, result?.coverageCells],
  );

  if (!camera) return null;

  const isNight = scene.assumptions.timeOfDay === "night";
  const pathState = selectedPath ? getReplaySegmentState(pathPoints, pathReplay.progress) : null;
  const targetZone = scene.criticalZones.find((zone) => zone.id === selectedNodeId) ?? null;
  const cameraResult = result?.cameraResults.find((entry) => entry.cameraId === camera.id) ?? null;
  const targetQuality = targetZone ? (cameraResult?.qualityByZone[targetZone.id] ?? "none") : "none";
  const targetZoneResult = targetZone
    ? result?.criticalZoneResults.find((entry) => entry.zoneId === targetZone.id) ?? null
    : null;
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
  const targetDistanceM = targetPoint
    ? Math.hypot(camera.position[0] - targetPoint[0], camera.position[2] - targetPoint[1])
    : null;
  const targetBearingDeg = targetPoint
    ? ((Math.atan2(targetPoint[0] - camera.position[0], targetPoint[1] - camera.position[2]) * 180) / Math.PI)
    : null;
  const angleFromCenterDeg = targetBearingDeg == null
    ? null
    : Math.abs((((targetBearingDeg - camera.yawDeg) % 360) + 540) % 360 - 180);
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
    : camera.name;
  const sensorFusion = computeSensorFusionSummary(camera.position, scene.sensors);
  const nearestSensorLabel = sensorFusion.nearestSensor ? sensorFusion.nearestSensor.label : "None";
  const nearestSensorState = sensorFusion.nearestSensor ? sensorFusion.nearestSensor.state.replace(/_/g, " ") : "—";
  const nearestSensorCoverage = sensorFusion.nearestSensor ? sensorFusion.nearestSensor.coverageMode.replace(/_/g, " ") : "—";
  const latestSensorEvent = sensorFusion.nearestSensor
    ? sensorEvents.find((event) => event.sensorId === sensorFusion.nearestSensor?.id) ?? sensorEvents[0] ?? null
    : sensorEvents[0] ?? null;
  const latestCameraMetadataEvent = cameraMetadataEvents.find((event) => event.cameraId === camera.id) ?? null;
  const latestCameraLiveConnectionEvent = cameraLiveConnectionEvents.find((event) => event.cameraId === camera.id) ?? null;

  const canvasFilterClass = [
    viewMode === "normal" ? "" : viewMode === "ir" ? "grayscale-[0.95] brightness-[0.85] contrast-[1.25]" : viewMode === "low_light" ? "brightness-[0.72] contrast-[1.18] saturate-[0.85]" : "sepia-[0.8] saturate-[1.6] hue-rotate-[300deg] brightness-[0.82] contrast-[1.1]",
    camera.status === "dirty" || camera.clarity === "poor" ? "saturate-[0.78] contrast-[1.14]" : "",
    camera.status === "blocked" || camera.status === "malfunctioning" || camera.status === "off" ? "grayscale-[0.7] brightness-[0.72]" : "",
  ].join(" ");

  return (
    <div className={`relative w-full overflow-hidden rounded-lg border UI_SURFACES.borderSubtle`} style={{ aspectRatio: "16 / 9" }}>
      <div className={cn("absolute inset-0", canvasFilterClass)}>
        <Canvas
          camera={{ position: camera.position, fov: camera.fovHorizontalDeg, near: 0.1, far: 50 }}
          shadows
          gl={{ preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        >
          <SceneEnvironmentSetup tier="medium" />
          <SceneShadowCaster
            tier="medium"
            maxDimension={Math.max(scene.dimensions.width, scene.dimensions.depth)}
          />
          <CameraFeedPostProcessing mode={viewMode === "ir" ? "ir_bw" : viewMode === "low_light" ? "low_light" : viewMode === "thermal" ? "thermal" : "normal"} />
          <CameraFeedScene
            camera={camera}
            pathState={pathState}
            selectedPathWaypoints={pathWaypoints}
            selectedPathPositions={pathPoints}
            overlayOptions={overlayFlags}
          />
        </Canvas>
      </div>

      <FeedArtifacts
        camera={camera}
        clarity={camera.clarity}
        pathState={pathState}
        pathLabel={selectedPath?.label ?? null}
        pathProgress={pathReplay.progress}
        sensorFusion={{
          totalCount: sensorFusion.totalCount,
          activeCount: sensorFusion.activeCount,
          nearestSensorLabel,
          nearestSensorState,
          nearestSensorCoverage,
          nearestDistanceM: sensorFusion.nearestDistanceM,
        }}
        operationalFusion={operationalFusion}
        showOperationalFusionSummary={showOperationalFusionSummary}
        overlayOptions={overlayFlags}
      />

      {latestSensorEvent ? (
        <div className="absolute left-2 bottom-16 z-10 rounded-lg border border-cyan-400/20 bg-black/72 px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.18em] text-cyan-300/90">Latest Sensor Event</div>
          <div className="mt-0.5 text-[10px] font-semibold text-white">{latestSensorEvent.sensorLabel}</div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-cyan-100/75">
            {latestSensorEvent.kind} · {latestSensorEvent.resultingState ?? "—"} · {latestSensorEvent.nearestCameraName ?? "No camera"} · {latestSensorEvent.nearestDistanceM == null ? "—" : `${latestSensorEvent.nearestDistanceM.toFixed(1)}m`}
          </div>
        </div>
      ) : null}

      {latestCameraMetadataEvent ? (
        <div className="absolute left-2 bottom-32 z-10 rounded-lg border border-emerald-400/20 bg-black/72 px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.18em] text-emerald-300/90">Latest Camera Metadata</div>
          <div className="mt-0.5 text-[10px] font-semibold text-white">{latestCameraMetadataEvent.cameraName}</div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-emerald-100/75">
            {latestCameraMetadataEvent.status ?? "—"} · {latestCameraMetadataEvent.clarity ?? "—"} · {latestCameraMetadataEvent.nightMode ?? "—"} · {latestCameraMetadataEvent.feedMode ?? latestCameraMetadataEvent.ingestMode}
          </div>
        </div>
      ) : null}

      {latestCameraLiveConnectionEvent ? (
        <div className="absolute left-2 bottom-48 z-10 rounded-lg border border-cyan-400/20 bg-black/72 px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.18em] text-cyan-300/90">Live Camera Connection</div>
          <div className="mt-0.5 text-[10px] font-semibold text-white">{latestCameraLiveConnectionEvent.cameraName}</div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-cyan-100/75">
            {latestCameraLiveConnectionEvent.liveConnectionStatus ?? "—"} · {latestCameraLiveConnectionEvent.liveConnectionMode ?? "—"} · {latestCameraLiveConnectionEvent.liveFeedLabel ?? latestCameraLiveConnectionEvent.liveFeedUrl ?? "—"}
          </div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-cyan-100/75">
            Events {latestCameraLiveConnectionEvent.eventSubscriptionUri ?? "—"}{latestCameraLiveConnectionEvent.eventSubscriptionReference ? ` · ref ${latestCameraLiveConnectionEvent.eventSubscriptionReference}` : ""}{latestCameraLiveConnectionEvent.eventSubscriptionExpiresAt == null ? "" : ` · expires ${new Date(latestCameraLiveConnectionEvent.eventSubscriptionExpiresAt).toLocaleTimeString()}`}
          </div>
        </div>
      ) : null}

      <div className={`absolute left-2 top-2 z-10 flex items-center gap-1 rounded-lg border UI_SURFACES.border bg-black/50 p-1`}>
        {(Object.keys(FEED_MODE_LABELS) as FeedViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={cn(
              "rounded-md px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] transition-colors",
              viewMode === mode ? "bg-blue-500/25 text-blue-200" : "UI_SURFACES.textMuted5 UI_SURFACES.hoverText",
            )}
          >
            {FEED_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {isNight && (
        <div
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{
            background: "rgba(0,0,0,0.55)",
            mixBlendMode: "multiply",
            filter: "grayscale(0.8)",
          }}
        />
      )}

      {overlayFlags.doriLabels && targetZone ? (
        <div className={`absolute right-2 top-2 z-10 rounded-xl border UI_SURFACES.border bg-black/70 px-2.5 py-2`}>
          <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#8ab4ff]">DORI Overlay</div>
          <div className="text-[11px] font-semibold text-white">
            {targetZone.label}
          </div>
          <div className={`mt-1 text-[9px] UI_SURFACES.textBody`}>
            {targetZoneResult?.status === "pass"
              ? "PASS"
              : targetZoneResult?.status === "partial"
                ? "PARTIAL"
                : targetZoneResult?.status === "fail"
                  ? "FAIL"
                  : "UNKNOWN"}
          </div>
          <div className="mt-1 text-[10px] font-semibold text-amber-300">
            {targetQuality.toUpperCase()} <span className={`text-[9px] font-normal UI_SURFACES.textSoftBright`}>/ {qualityRangeLabel(targetQuality, scene.assumptions.doriStandard)}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2 text-[8px] UI_SURFACES.textSoftMuted">
            <div>
              <div className={`uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Target Type</div>
              <div className={`mt-0.5 UI_SURFACES.textNear`}>{targetZone.targetType.replace(/_/g, " ")}</div>
            </div>
            <div>
              <div className={`uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Distance</div>
              <div className={`mt-0.5 UI_SURFACES.textNear`}>{targetDistanceM != null ? `${targetDistanceM.toFixed(1)}m` : "—"}</div>
            </div>
            <div>
              <div className={`uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Angle</div>
              <div className={`mt-0.5 UI_SURFACES.textNear`}>{angleFromCenterDeg != null ? `${angleFromCenterDeg.toFixed(1)}°` : "—"}</div>
            </div>
            <div>
              <div className={`uppercase tracking-[0.16em] UI_SURFACES.textDimMid`}>Best Camera</div>
              <div className={`mt-0.5 UI_SURFACES.textNear`}>{bestCameraName}</div>
            </div>
          </div>
          <div className={`mt-2 text-[8px] uppercase tracking-[0.18em] UI_SURFACES.textDimMid`}>
            Lighting: {scene.assumptions.timeOfDay === "night" ? "Night" : scene.assumptions.timeOfDay === "custom" ? "Custom" : "Day"}
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1">
        <div className="text-[8px] font-mono text-green-400">
          {camera.name} • {camera.resolutionMP}MP
        </div>
        <div className="text-[7px] font-mono UI_SURFACES.textSoftMid">
          FOV {camera.fovHorizontalDeg}° • {isNight ? "NIGHT" : "DAY"}
        </div>
      </div>
    </div>
  );
}
