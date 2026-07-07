"use client";

import Image from "next/image";
import { PerspectiveCamera, PerformanceMonitor, AdaptiveDpr } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Camera as CameraIcon, CircleSmall, VideoOff } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useStudioStore } from "@/store/studio-store";
import "@/lib/three-compat";
import { ENVIRONMENT_THEMES, SceneEnvironmentSetup, SceneShadowCaster } from "@/components/workspace/SharedScene";
import { CameraFeedPostProcessing } from "@/components/view/CameraFeedPostProcessing";
import { QUALITY_RANK } from "@/lib/quality-display";
import { CameraRigLive, SceneFeedGeometry } from "@/components/view/SceneFeedCanvas";
import { CameraControlStrip } from "@/components/view/CameraControlStrip";
import { DoriBandArcs } from "@/components/view/DoriBandArcs";
import { LiveFeedHUD } from "@/components/view/camera-live-feed-hud";
import { VerificationPanel as SharedVerificationPanel } from "@/components/view/camera-verification-panel";
import { CameraHeader, CameraModeFilter, CameraPathVisibilityOverlay, BottomControlStrip, DoriInsightCard, ReplayStatusOverlay, type CameraFeedMode, type OverlayFlags } from "@/components/view/camera-view-chrome";
import { FootageVerificationOverlay } from "@/components/view/camera-verification-overlay";
import { ReplayActor } from "@/components/view/camera-view-scene";
import { CameraPositionIndicator } from "@/components/view/camera-position-indicator";
import { CameraViewFloorAim } from "@/components/view/camera-view-floor-aim";
import { useCameraVerificationWorkflow } from "@/components/view/camera-verification-workflow";
import { alignmentQualityLabel } from "@/components/view/camera-verification-utils";
import { TYPE_SCALE, UI_TONES } from "@/lib/design-tokens";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";
import {
  SINGLE_PERF_MONITOR_ITERATIONS,
  SINGLE_PERF_MONITOR_MS,
  SINGLE_PERF_DPR_STEP,
  SINGLE_PERF_FLIPFLOPS,
  singlePerformanceBounds,
  computeSingleCanvasDpr,
} from "@/lib/adaptive-dpr-budget";
import { computeOperationalEvidenceFusionSummary, computeSensorFusionSummary } from "@/lib/sensor-fusion";
import type { CameraNode, DoriQuality } from "@/schema/security-scene";
import { CanvasLoadingOverlay } from "@/components/shared/CanvasLoadingOverlay";
import { useReplayClock } from "@/hooks/use-replay-clock";
import { STUDIO_SHORTCUT_EVENTS } from "@/lib/studio-shortcuts";
import {
  buildReplayStateByCameraAtTime,
  clampPathDuration,
  clampReplayProgress,
  findLatestTimelineEventForCameraAtTime,
  formatCameraTag,
  orderCamerasForReplayPlayback,
  sampleCameraReplayPose,
} from "@/components/view/camera-view-utils";

const CAMERA_SURFACES = {
  page: UI_SURFACES.page,
  panel: UI_SURFACES.panelSoft,
  border: UI_SURFACES.border,
  muted: UI_SURFACES.textMuted,
  muted2: UI_SURFACES.textMuted3,
  muted3: UI_SURFACES.textMuted4,
};

function OfflineFeed({ camera: cam }: { camera: CameraNode }) {
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-3 ${CAMERA_SURFACES.page}`}>
      <div className={`rounded-full border ${UI_TONES.danger.border} ${UI_TONES.danger.bg} p-4`}>
        <VideoOff className="size-8 text-rose-400/60" />
      </div>
      <div className="text-center">
        <div className={`font-semibold uppercase tracking-[0.2em] ${TYPE_SCALE.label.class} text-rose-300/60`}>Camera Offline</div>
        <div className={`mt-1 ${TYPE_SCALE.micro.class} ${CAMERA_SURFACES.muted}`}>{cam.name}</div>
      </div>
      <div className="absolute inset-x-0 top-0 px-3 pt-3">
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${UI_TONES.danger.dot}`} />
          <span className={`font-bold tracking-wide text-white/60 ${TYPE_SCALE.micro.class}`}>{formatCameraTag(cam.name)} · {cam.name}</span>
          <CircleSmall className={`ml-auto size-3 ${UI_TONES.danger.text}`} />
        </div>
      </div>
    </div>
  );
}

export function CameraViewMode() {
  const scene = useStudioStore((s) => s.scene);
  const sceneId = useStudioStore((s) => s.scene.id);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const selectedCameraId = useStudioStore((s) => s.selectedCameraId);
  const historyDepth = useStudioStore((s) => s.historyPast.length);
  const setSelectedCameraId = useStudioStore((s) => s.setSelectedCameraId);
  const selectNode = useStudioStore((s) => s.selectNode);
  const result = useStudioStore((s) => s.simulationResult);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const activePathId = useStudioStore((s) => s.activePathId);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const envMode = useStudioStore((s) => s.environmentMode);
  const cameraViewVerificationIntent = useStudioStore((s) => s.cameraViewVerificationIntent);
  const setCameraViewVerificationIntent = useStudioStore((s) => s.setCameraViewVerificationIntent);
  const cameraVerificationSnapshots = useStudioStore((s) => s.cameraVerificationSnapshots);
  const upsertCameraVerificationSnapshot = useStudioStore((s) => s.upsertCameraVerificationSnapshot);
  const removeCameraVerificationSnapshot = useStudioStore((s) => s.removeCameraVerificationSnapshot);
  const recordOperationalEvidenceEvent = useStudioStore((s) => s.recordOperationalEvidenceEvent);
  const compactViewport = useStudioStore((s) => s.compactViewport);

  const orderedCameras = useMemo(
    () => orderCamerasForReplayPlayback(scene.cameras, selectedCameraId, selectedId),
    [scene.cameras, selectedCameraId, selectedId],
  );
  const playbackOrderCameras = useMemo(
    () => orderCamerasForReplayPlayback(scene.cameras),
    [scene.cameras],
  );
  const replayCameraOrder = useMemo(
    () => new Map(orderedCameras.map((orderedCamera, index) => [orderedCamera.id, index])),
    [orderedCameras],
  );
  const camera = orderedCameras.find((c) => c.id === selectedCameraId)
    ?? orderedCameras.find((c) => c.id === selectedId)
    ?? orderedCameras[0]
    ?? null;
  const frameRootRef = useRef<HTMLDivElement | null>(null);
  const verification = useCameraVerificationWorkflow({
    camera,
    sceneId,
    sceneName: scene.name,
    sceneSource: scene.source,
    sceneRevisionDepth: historyDepth,
    frameRootRef,
    cameraVerificationSnapshots,
    cameraViewVerificationIntent,
    setCameraViewVerificationIntent,
    upsertCameraVerificationSnapshot,
    removeCameraVerificationSnapshot,
    recordOperationalEvidenceEvent,
  });
  const cameraId = camera?.id ?? null;
  const cameraIndex = useMemo(() => {
    if (!camera?.id) {
      return 0;
    }
    const index = playbackOrderCameras.findIndex((c) => c.id === camera.id);
    return index < 0 ? 0 : index;
  }, [camera?.id, playbackOrderCameras]);
  const setCameraByDelta = (delta: -1 | 1) => {
    if (!camera || !playbackOrderCameras.length) return;
    const nextIndex = Math.max(0, Math.min(playbackOrderCameras.length - 1, cameraIndex + delta));
    const nextCamera = playbackOrderCameras[nextIndex];
    if (!nextCamera || nextCamera.id === camera.id) return;
    setSelectedCameraId(nextCamera.id);
    selectNode(nextCamera.id);
  };
  const activePath = useMemo(() => {
    if (!scene.paths.length || !activePathId) return null;
    return scene.paths.find((path) => path.id === activePathId) ?? null;
  }, [activePathId, scene.paths]);
  const activePathResult = useMemo(() => {
    if (!result || !activePath) return null;
    return result.pathResults.find((entry) => entry.pathId === activePath.id) ?? null;
  }, [activePath, result]);
  const theme = ENVIRONMENT_THEMES[envMode] ?? ENVIRONMENT_THEMES.day;
  const [feedMode, setFeedMode] = useState<CameraFeedMode>("normal");
  const [flags, setFlags] = useState<OverlayFlags>({ overlays: true, dori: true, path: false, zones: true, timestamp: true, grid: false });
  const [immersiveMode, setImmersiveMode] = useState(false);
  const toggleImmersiveMode = useCallback(() => {
    setImmersiveMode((value) => !value);
  }, []);
  const canvasFilter =
    feedMode === "normal"
      ? "brightness(0.82) contrast(1.08) saturate(0.92)"
      : feedMode === "ir_bw"
        ? "brightness(0.72) contrast(1.18) saturate(0.18)"
        : feedMode === "low_light"
          ? "brightness(0.65) contrast(1.1) saturate(0.8)"
          : "brightness(0.78) contrast(1.22) saturate(1.1) sepia(0.08)";
  const replayClock = useReplayClock();
  const safeReplayProgress = replayClock.progress;
  const safeReplayDurationS = replayClock.durationS;
  const pathTimeS = replayClock.timeS;
  const replayActorVisible = replayClock.hasContent;
  const visibilityForCurrentCamera = useMemo(() => {
    if (!activePathResult || !camera) return null;
    return activePathResult.visibilityByCamera[camera.id] ?? null;
  }, [activePathResult, camera]);
  const selectedCriticalZone = useMemo(
    () => scene.criticalZones.find((zone) => zone.id === selectedId) ?? null,
    [scene.criticalZones, selectedId],
  );
  const camResult = result?.cameraResults.find((entry) => entry.cameraId === camera?.id) ?? null;
  const zoneResult = selectedCriticalZone ? result?.criticalZoneResults.find((entry) => entry.zoneId === selectedCriticalZone.id) ?? null : null;

  const zoneAnalysis = useMemo(() => {
    if (!camera || !selectedCriticalZone || !camResult) return null;

    const centroid = selectedCriticalZone.polygon.reduce(
      (acc, [x, z]) => {
        acc.x += x;
        acc.z += z;
        return acc;
      },
      { x: 0, z: 0 },
    );
    const count = Math.max(selectedCriticalZone.polygon.length, 1);
    const centroidX = centroid.x / count;
    const centroidZ = centroid.z / count;
    const dx = centroidX - camera.position[0];
    const dz = centroidZ - camera.position[2];
    const distanceM = Math.hypot(dx, dz);
    const bearing = (Math.atan2(dx, dz) * 180) / Math.PI;
    const angleDeg = Math.abs((((bearing - camera.yawDeg) % 360) + 540) % 360 - 180);
    const currentQuality = camResult.qualityByZone[selectedCriticalZone.id] ?? "none";
    const cameraOrder = replayCameraOrder;
    let bestCameraNameEntry: { cameraId: string; quality: string } | null = null;
    for (const entry of result?.cameraResults ?? []) {
      const candidate = {
        cameraId: entry.cameraId,
        quality: entry.qualityByZone[selectedCriticalZone.id] ?? "none",
      };
      const existingOrder = bestCameraNameEntry ? cameraOrder.get(bestCameraNameEntry.cameraId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
      const candidateOrder = cameraOrder.get(candidate.cameraId) ?? Number.MAX_SAFE_INTEGER;
      const bestQualityRank = QUALITY_RANK[bestCameraNameEntry?.quality as DoriQuality] ?? QUALITY_RANK.none;
      const candidateQualityRank = QUALITY_RANK[candidate.quality as DoriQuality] ?? QUALITY_RANK.none;

      if (
        !bestCameraNameEntry
        || candidateQualityRank > bestQualityRank
        || (candidateQualityRank === bestQualityRank && candidateOrder < existingOrder)
      ) {
        bestCameraNameEntry = candidate;
      }
    }

    const reasonLine =
      zoneResult?.status === "fail"
        ? `Blocked or off-angle for ${distanceM.toFixed(1)}m at ${angleDeg.toFixed(0)}°`
        : zoneResult?.status === "partial"
          ? `Distance and angle limit the view to ${currentQuality}`
          : `Camera geometry supports ${currentQuality} around the target`;

    return {
      distanceM,
      angleDeg,
      currentQuality,
      reasonLine,
      bestCameraName: bestCameraNameEntry ? (scene.cameras.find((entry) => entry.id === bestCameraNameEntry.cameraId)?.name ?? bestCameraNameEntry.cameraId) : camera.name,
    };
  }, [camera, camResult, replayCameraOrder, result, scene.cameras, selectedCriticalZone, zoneResult?.status]);

  const activeCameraTimelineEvent = useMemo(() => {
    if (!activePathResult?.timeline?.length || !camera) return null;
    return findLatestTimelineEventForCameraAtTime(activePathResult.timeline, pathTimeS, camera.id);
  }, [activePathResult?.timeline, camera, pathTimeS]);
  const replayStateByCameraId = useMemo(
    () => buildReplayStateByCameraAtTime(activePathResult?.timeline, pathTimeS),
    [activePathResult?.timeline, pathTimeS],
  );
  const activeCameraReplayPose = useMemo(() => {
    if (!camera) return null;
    return sampleCameraReplayPose(camera, pathTimeS);
  }, [camera, pathTimeS]);
  const activeCameraReplayState = camera ? replayStateByCameraId[camera.id] ?? null : null;
  const cameraPosition = useMemo<[number, number, number]>(
    () => (camera ? [camera.position[0], camera.position[1], camera.position[2]] : [0, 0, 0]),
    [camera],
  );
  const allSensorEvents = useStudioStore((s) => s.sensorEvents);
  const allCameraMetadataEvents = useStudioStore((s) => s.cameraMetadataEvents);
  const allCameraLiveConnectionEvents = useStudioStore((s) => s.cameraLiveConnectionEvents);
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
  const sensorFusion = useMemo(
    () => computeSensorFusionSummary(cameraPosition, scene.sensors),
    [cameraPosition, scene.sensors],
  );
  const nearestSensorLabel = sensorFusion.nearestSensor ? sensorFusion.nearestSensor.label : "None";
  const nearestSensorState = sensorFusion.nearestSensor ? sensorFusion.nearestSensor.state.replace(/_/g, " ") : "—";
  const nearestSensorCoverage = sensorFusion.nearestSensor ? sensorFusion.nearestSensor.coverageMode.replace(/_/g, " ") : "—";
  const latestSensorEvent = sensorFusion.nearestSensor
    ? sensorEvents.find((event) => event.sensorId === sensorFusion.nearestSensor?.id) ?? sensorEvents[0] ?? null
    : sensorEvents[0] ?? null;
  const latestCameraMetadataEvent = cameraId
    ? cameraMetadataEvents.find((event) => event.cameraId === cameraId) ?? null
    : null;
  const latestCameraLiveConnectionEvent = cameraId
    ? cameraLiveConnectionEvents.find((event) => event.cameraId === cameraId) ?? null
    : null;
  const operationalFusion = useMemo(
    () => (camera ? computeOperationalEvidenceFusionSummary(camera, scene.sensors, cameraMetadataEvents, cameraLiveConnectionEvents) : null),
    [camera, cameraLiveConnectionEvents, cameraMetadataEvents, scene.sensors],
  );

  useEffect(() => {
    window.addEventListener(STUDIO_SHORTCUT_EVENTS.toggleActiveSurfaceFocus, toggleImmersiveMode);
    return () => {
      window.removeEventListener(STUDIO_SHORTCUT_EVENTS.toggleActiveSurfaceFocus, toggleImmersiveMode);
    };
  }, [toggleImmersiveMode]);

  const replayQualityLabel = activeCameraTimelineEvent?.quality
    ? activeCameraTimelineEvent.quality.toUpperCase()
    : activeCameraReplayState?.quality
      ? activeCameraReplayState.quality.toUpperCase()
    : visibilityForCurrentCamera?.maxQuality
      ? visibilityForCurrentCamera.maxQuality.toUpperCase()
      : undefined;

  const replaySegmentLabel = activeCameraTimelineEvent?.reason
    ?? (activePath ? `${activePath.label} active replay` : undefined);

  if (!camera) {
    const hasCameras = scene.cameras.length > 0;
    const title = hasCameras ? "Select a camera" : "No cameras in scene";
    const subtitle1 = hasCameras
      ? "Choose a camera from the scene to view its simulated feed."
      : "Add a camera to the site twin before opening Camera View.";
    const subtitle2 = hasCameras
      ? "Click a camera in the map view or use the camera selector above."
      : "Use the Map View editor to place cameras in the scene.";
    return (
      <div className={`flex h-full items-center justify-center ${CAMERA_SURFACES.page}`}>
        <div className="max-w-[320px] text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border ${UI_TONES.info.border} ${UI_TONES.info.bg}`}>
            <CameraIcon className="h-7 w-7 text-sky-300" />
          </div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className={`mt-2 text-xs ${CAMERA_SURFACES.muted}`}>{subtitle1}</p>
          <p className={`mt-1 text-xs ${CAMERA_SURFACES.muted}`}>{subtitle2}</p>
          <button
            type="button"
            onClick={() => { setWorkspacePreset("edit"); setViewMode("map"); }}
            className={`mt-4 rounded-xl border ${UI_TONES.info.border} ${UI_TONES.info.bg} px-4 py-2 text-xs font-semibold ${UI_TONES.info.text} transition-colors hover:bg-sky-500/20`}
          >
            {hasCameras ? "Select Camera in Map" : "Open Map View Editor"}
          </button>
        </div>
      </div>
    );
  }

  const leftAddons = (
    <>
      {flags.overlays && flags.path && activePathResult && visibilityForCurrentCamera ? (
        <CameraPathVisibilityOverlay
          cameraName={camera.name}
          visibleSeconds={visibilityForCurrentCamera.visibleS}
          totalSeconds={safeReplayDurationS}
          maxQuality={visibilityForCurrentCamera.maxQuality}
        />
      ) : null}
    </>
  );

  const rightAddons = (
    <>
      {flags.overlays && flags.dori ? (
        selectedCriticalZone ? (
          zoneAnalysis ? (
            <DoriInsightCard
              camera={camera}
              zoneLabel={selectedCriticalZone.label}
              targetType={selectedCriticalZone.targetType}
              currentQuality={activeCameraTimelineEvent?.quality ?? zoneAnalysis.currentQuality}
              requiredQuality={zoneResult?.requiredQuality ?? selectedCriticalZone.requiredQuality}
              zoneStatus={zoneResult?.status ?? "unknown"}
              bestCameraName={zoneAnalysis.bestCameraName}
              distanceM={zoneAnalysis.distanceM}
              angleDeg={zoneAnalysis.angleDeg}
              lightingLabel={envMode === "night" ? "Night" : envMode === "dusk" ? "Dusk" : "Day"}
              reasonLine={activeCameraTimelineEvent?.quality
                ? `${zoneAnalysis.reasonLine}. Replay @ ${pathTimeS.toFixed(1)}s is ${activeCameraTimelineEvent.quality}${activeCameraTimelineEvent.reason ? ` (${activeCameraTimelineEvent.reason})` : ""}.`
                : zoneAnalysis.reasonLine}
              replayTimeS={activeCameraTimelineEvent ? pathTimeS : undefined}
            />
          ) : null
        ) : (
          <div className={`pointer-events-auto w-full rounded-xl border border-dashed ${CAMERA_SURFACES.border} ${CAMERA_SURFACES.panel} px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)]`}>
            <div className={`text-[8px] font-semibold uppercase tracking-[0.22em] ${UI_TONES.info.text}`}>DORI OVERLAY</div>
            <div className={`mt-1 font-semibold text-white ${TYPE_SCALE.caption.class}`}>Select a critical zone</div>
            <div className={`mt-1 ${TYPE_SCALE.micro.class} ${CAMERA_SURFACES.muted3}`}>
              Click a zone on the map to inspect its distance, angle, and required quality for the current camera.
            </div>
          </div>
        )
      ) : null}
      <SharedVerificationPanel
        enabled={verification.verificationEnabled}
        mode={verification.verificationMode}
        opacity={verification.verificationOpacity}
        split={verification.verificationSplit}
        offsetX={verification.verificationOffsetX}
        offsetY={verification.verificationOffsetY}
        fileName={verification.verificationFileName}
        alignmentScore={verification.alignmentQualityScore}
        alignmentLabel={verification.alignmentQualityScore !== null ? alignmentQualityLabel(verification.alignmentQualityScore) : null}
        alignmentMethod={verification.verificationAlignmentMethod}
        autoAlignDelta={verification.verificationAutoAlignDelta}
        scale={verification.verificationScale}
        sourceType={verification.verificationSourceType}
        videoDurationS={verification.verificationVideoDurationS}
        sampleTimeS={verification.verificationSampleTimeS}
        extractionInProgress={verification.verificationExtracting}
        errorMessage={verification.verificationError}
        canResample={verification.canResample}
        canAutoAlign={verification.canAutoAlign}
        videoCandidates={verification.verificationVideoCandidates}
        selectedCandidateId={verification.verificationSelectedCandidateId}
        bestCandidateId={verification.verificationBestCandidateId}
        onSelectVideoCandidate={(candidateId) => {
          if (!verification.verificationVideoFile) return;
          const candidate = verification.verificationVideoCandidates.find((entry) => entry.id === candidateId);
          if (!candidate) return;
          verification.setVerificationSelectedCandidateId(candidateId);
          verification.applyVideoCandidate(candidate, verification.verificationVideoFile.name);
        }}
        onAutoPickBestFrame={() => {
          if (!verification.verificationBestCandidateId || !verification.verificationVideoFile) return;
          const best = verification.verificationVideoCandidates.find((entry) => entry.id === verification.verificationBestCandidateId);
          if (!best) return;
          verification.setVerificationSelectedCandidateId(best.id);
          verification.applyVideoCandidate(best, verification.verificationVideoFile.name);
        }}
        onSampleTimeChange={(value) => {
          verification.setVerificationSampleTimeS(value);
        }}
        onResampleVideoFrame={() => {
          verification.extractFromCurrentVideo(verification.verificationSampleTimeS ?? undefined);
        }}
        showHeatOverlay={verification.showDifferenceHeatOverlay}
        snapshots={verification.snapshotsForCamera}
        onToggle={verification.setVerificationEnabled}
        onUpload={verification.handleUpload}
        onSaveSnapshot={verification.handleSaveSnapshot}
        onLoadSnapshot={verification.handleLoadSnapshot}
        onDeleteSnapshot={verification.handleDeleteSnapshot}
        onModeChange={verification.setVerificationMode}
        onOpacityChange={verification.setVerificationOpacity}
        onSplitChange={verification.setVerificationSplit}
        onOffsetXChange={(value) => {
          verification.setVerificationAlignmentMethod("manual");
          verification.setVerificationAutoAlignDelta(null);
          verification.setVerificationOffsetX(value);
        }}
        onOffsetYChange={(value) => {
          verification.setVerificationAlignmentMethod("manual");
          verification.setVerificationAutoAlignDelta(null);
          verification.setVerificationOffsetY(value);
        }}
        onScaleChange={(value) => {
          verification.setVerificationAlignmentMethod("manual");
          verification.setVerificationAutoAlignDelta(null);
          verification.setVerificationScale(value);
        }}
        onToggleHeatOverlay={verification.setShowDifferenceHeatOverlay}
        onNudge={(dx, dy) => {
          verification.handleNudge(dx, dy);
        }}
        onAutoAlign={verification.autoAlignVerification}
        onResetAlign={() => {
          verification.handleResetAlign();
        }}
        onClear={() => {
          verification.handleClear();
        }}
      />
    </>
  );

  return (
    <div ref={frameRootRef} className={`st-camera-view-safe-zone relative h-full w-full overflow-hidden ${CAMERA_SURFACES.page}`}>
      <style>{`
        .st-camera-view-safe-zone > .absolute.top-3 {
          top: var(--st-full-canvas-safe-top, 4.25rem);
        }
        .st-camera-view-safe-zone > .absolute.top-24 {
          top: calc(var(--st-full-canvas-safe-top, 4.25rem) + 5.25rem);
        }
      `}</style>
      {immersiveMode ? (
        <div className={`absolute left-3 top-3 z-30 rounded-xl border ${UI_TONES.info.border} ${CAMERA_SURFACES.panel} px-3 py-2${compactViewport ? " max-w-[200px]" : ""}`}>
          <div className={`font-semibold uppercase tracking-[0.18em] ${TYPE_SCALE.caption.class} ${UI_TONES.info.text}`}>Camera Focus Mode</div>
          <div className={`font-medium text-white ${TYPE_SCALE.label.class}`}>{camera.name}</div>
          {!compactViewport && (
            <div className={`mt-1 ${TYPE_SCALE.micro.class} ${CAMERA_SURFACES.muted2}`}>{cameraIndex + 1}/{orderedCameras.length} • Press F to exit focus</div>
          )}
          {!compactViewport && (
            <div className={`mt-2 rounded-lg border ${UI_TONES.neutral.border} bg-black/45 px-2 py-1 ${TYPE_SCALE.micro.class} ${CAMERA_SURFACES.muted3}`}>
              Frame, zoom, timeline, and overlays can be tuned after exiting focus mode.
            </div>
          )}
        </div>
      ) : (
        <CameraHeader
          camera={camera}
          index={cameraIndex}
          total={orderedCameras.length}
          cameras={orderedCameras}
          onPrevious={() => {
            setCameraByDelta(-1);
          }}
          onSelect={(id) => {
            setSelectedCameraId(id);
            selectNode(id);
          }}
          onNext={() => {
            setCameraByDelta(1);
          }}
        />
      )}
      {camera.status === "on" ? (
        <>
          <Canvas
            camera={{
              position: camera.position,
              fov: Math.min(camera.fovHorizontalDeg, 100),
              near: 0.1,
              far: 60,
            }}
            shadows
            dpr={computeSingleCanvasDpr(1)}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            style={{ width: "100%", height: "100%", filter: canvasFilter }}
          >
            <SceneEnvironmentSetup tier={envMode === "night" ? "low" : envMode === "dusk" ? "medium" : "high"} />
            <SceneShadowCaster
              tier={envMode === "night" ? "low" : envMode === "dusk" ? "medium" : "high"}
              maxDimension={Math.max(scene.dimensions.width, scene.dimensions.depth)}
            />
            <PerformanceMonitor
              iterations={SINGLE_PERF_MONITOR_ITERATIONS}
              ms={SINGLE_PERF_MONITOR_MS}
              step={SINGLE_PERF_DPR_STEP}
              flipflops={SINGLE_PERF_FLIPFLOPS}
              bounds={singlePerformanceBounds}
            >
              <AdaptiveDpr pixelated />
              <PerspectiveCamera
                makeDefault
                position={camera.position}
                fov={Math.min(camera.fovHorizontalDeg, 100)}
                near={0.1}
                far={60}
              />
              <color attach="background" args={[theme.background]} />
              <CameraFeedPostProcessing mode={feedMode} />
              <Suspense fallback={<CanvasLoadingOverlay label="Loading camera view" />}>
                <SceneFeedGeometry theme={theme} showPrivacyZones />
              </Suspense>
              <CameraRigLive camera={camera} poseOverride={activeCameraReplayPose ?? undefined} />
              <CameraViewFloorAim camera={camera} />
              {flags.dori ? <DoriBandArcs camera={camera} /> : null}
              <CameraPositionIndicator camera={camera} />
              {replayActorVisible && activePath ? (
                <ReplayActor path={activePath} progress={pathReplay.progress} />
              ) : null}
            </PerformanceMonitor>
          </Canvas>
          {verification.verificationEnabled && verification.verificationImageUrl ? (
            <FootageVerificationOverlay
              imageUrl={verification.verificationImageUrl}
              mode={verification.verificationMode}
              opacity={verification.verificationOpacity}
              split={verification.verificationSplit}
              offsetX={verification.verificationOffsetX}
              offsetY={verification.verificationOffsetY}
              scale={verification.verificationScale}
            />
          ) : null}
          {verification.verificationEnabled && verification.showDifferenceHeatOverlay && verification.alignmentHeatmapUrl ? (
            <div className="pointer-events-none absolute inset-0">
              <Image
                src={verification.alignmentHeatmapUrl}
                alt="Alignment mismatch heat overlay"
                fill
                unoptimized
                sizes="100vw"
                className="object-cover opacity-65 mix-blend-screen"
              />
            </div>
          ) : null}
          {immersiveMode ? null : <CameraModeFilter mode={feedMode} />}
          {immersiveMode ? null : <CameraControlStrip camera={camera!} zones={scene.criticalZones} />}
          {immersiveMode ? null : (
            <LiveFeedHUD
              camera={camera}
              mode={feedMode}
              flags={flags}
              ppm={scene.assumptions.pixelsPerMeter}
              simulationAssumptions={scene.assumptions}
              targetType={selectedCriticalZone?.targetType}
              sensorFusion={{
                totalCount: sensorFusion.totalCount,
                activeCount: sensorFusion.activeCount,
                nearestSensorLabel,
                nearestSensorState,
                nearestSensorCoverage,
                nearestDistanceM: sensorFusion.nearestDistanceM,
              }}
              operationalFusion={operationalFusion}
              sensorEvent={latestSensorEvent}
              cameraMetadataEvent={latestCameraMetadataEvent}
              cameraLiveConnectionEvent={latestCameraLiveConnectionEvent}
              leftAddons={leftAddons}
              rightAddons={rightAddons}
            />
          )}
          {immersiveMode ? null : flags.overlays && flags.path && activePath && activePathResult ? (
            <ReplayStatusOverlay
              pathLabel={activePath.label}
              timeS={pathTimeS}
              speed={pathReplay.speed}
              qualityLabel={replayQualityLabel}
              segmentLabel={replaySegmentLabel}
              progressPct={pathReplay.progress}
            />
          ) : null}
          <BottomControlStrip
            mode={feedMode}
            onModeChange={setFeedMode}
            flags={flags}
            onFlagsChange={setFlags}
            onBackToMap={() => {
              setWorkspacePreset("edit");
              setViewMode("map");
            }}
            immersiveMode={immersiveMode}
            onToggleImmersive={toggleImmersiveMode}
          />
        </>
      ) : (
        <div className="relative h-full w-full">
          <OfflineFeed camera={camera} />
        </div>
      )}

    </div>
  );
}
