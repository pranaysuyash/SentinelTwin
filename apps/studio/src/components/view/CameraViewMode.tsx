"use client";

import Image from "next/image";
import { PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { ArrowLeft, CircleSmall, VideoOff } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { useStudioStore } from "@/store/studio-store";
import "@/lib/three-compat";
import { ENVIRONMENT_THEMES } from "@/components/workspace/SharedScene";
import { QUALITY_RANK } from "@/lib/quality-display";
import { CameraRigLive, SceneFeedGeometry } from "@/components/view/SceneFeedCanvas";
import { CameraControlStrip } from "@/components/view/CameraControlStrip";
import { LiveFeedHUD } from "@/components/view/camera-live-feed-hud";
import { VerificationPanel as SharedVerificationPanel } from "@/components/view/camera-verification-panel";
import { CameraHeader, CameraModeFilter, CameraPathVisibilityOverlay, BottomControlStrip, DoriInsightCard, ReplayStatusOverlay, type CameraFeedMode, type OverlayFlags } from "@/components/view/camera-view-chrome";
import { FootageVerificationOverlay } from "@/components/view/camera-verification-overlay";
import { ReplayActor } from "@/components/view/camera-view-scene";
import { CameraPositionIndicator } from "@/components/view/camera-position-indicator";
import { CameraViewFloorAim } from "@/components/view/camera-view-floor-aim";
import { useCameraVerificationWorkflow } from "@/components/view/camera-verification-workflow";
import { alignmentQualityLabel } from "@/components/view/camera-verification-utils";
import { computeOperationalEvidenceFusionSummary, computeSensorFusionSummary } from "@/lib/sensor-fusion";
import type { CameraNode, DoriQuality } from "@/schema/security-scene";
import { CanvasLoadingOverlay } from "@/components/shared/CanvasLoadingOverlay";
import { formatCameraTag } from "@/components/view/camera-view-utils";

function OfflineFeed({ camera: cam }: { camera: CameraNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#070a10]">
      <div className="rounded-full border border-red-500/20 bg-red-500/10 p-4">
        <VideoOff className="size-8 text-red-400/60" />
      </div>
      <div className="text-center">
        <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-red-300/60">Camera Offline</div>
        <div className="mt-1 text-[10px] text-[#4a5568]">{cam.name}</div>
      </div>
      <div className="absolute inset-x-0 top-0 px-3 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-red-400" />
          <span className="text-[9px] font-bold tracking-wide text-white/60">{formatCameraTag(cam.name)} · {cam.name}</span>
          <CircleSmall className="ml-auto size-3 text-red-300" />
        </div>
      </div>
    </div>
  );
}

export function CameraViewMode() {
  const scene = useStudioStore((s) => s.scene);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const selectedCameraId = useStudioStore((s) => s.selectedCameraId);
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

  const camera = scene.cameras.find((c) => c.id === selectedId)
    ?? scene.cameras.find((c) => c.id === selectedCameraId)
    ?? null;
  const frameRootRef = useRef<HTMLDivElement | null>(null);
  const verification = useCameraVerificationWorkflow({
    camera,
    frameRootRef,
    cameraVerificationSnapshots,
    cameraViewVerificationIntent,
    setCameraViewVerificationIntent,
    upsertCameraVerificationSnapshot,
    removeCameraVerificationSnapshot,
  });
  const cameraId = camera?.id ?? null;
  const cameraIndex = useMemo(() => scene.cameras.findIndex((c) => c.id === camera?.id), [camera?.id, scene.cameras]);
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
  const canvasFilter =
    feedMode === "normal"
      ? "brightness(0.82) contrast(1.08) saturate(0.92)"
      : feedMode === "ir_bw"
        ? "brightness(0.72) contrast(1.18) saturate(0.18)"
        : feedMode === "low_light"
          ? "brightness(0.65) contrast(1.1) saturate(0.8)"
          : "brightness(0.78) contrast(1.22) saturate(1.1) sepia(0.08)";
  const pathTimeS = activePathResult && activePathResult.totalDurationS > 0
    ? pathReplay.progress * activePathResult.totalDurationS
    : 0;
  const replayActorVisible = Boolean(activePath && activePathResult && (pathReplay.playing || pathReplay.progress > 0));
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
    let bestCameraNameEntry: { cameraId: string; quality: string } | null = null;
    for (const entry of result?.cameraResults ?? []) {
      const candidate = {
        cameraId: entry.cameraId,
        quality: entry.qualityByZone[selectedCriticalZone.id] ?? "none",
      };
      if (!bestCameraNameEntry || QUALITY_RANK[candidate.quality as DoriQuality] > QUALITY_RANK[bestCameraNameEntry.quality as DoriQuality]) {
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
  }, [camera, camResult, result, scene.cameras, selectedCriticalZone, zoneResult?.status]);

  const activeTimelineEvent = useMemo(() => {
    if (!activePathResult?.timeline?.length) return null;
    const events = activePathResult.timeline.filter((event) => event.timeS <= pathTimeS);
    return events[events.length - 1] ?? activePathResult.timeline[0] ?? null;
  }, [activePathResult, pathTimeS]);
  const cameraPosition = useMemo<[number, number, number]>(
    () => (camera ? [camera.position[0], camera.position[1], camera.position[2]] : [0, 0, 0]),
    [camera],
  );
  const sceneId = useStudioStore((s) => s.scene.id);
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

  const replayQualityLabel = activeTimelineEvent?.quality
    ? activeTimelineEvent.quality.toUpperCase()
    : visibilityForCurrentCamera?.maxQuality
      ? visibilityForCurrentCamera.maxQuality.toUpperCase()
      : undefined;

  const replaySegmentLabel = activeTimelineEvent?.reason
    ?? (activePath ? `${activePath.label} active replay` : undefined);

  if (!camera) {
    return (
      <div className="flex h-full items-center justify-center bg-[#07090d]">
        <div className="text-center text-[#4a5568]">
          <p className="text-[11px]">No camera selected</p>
          <button
            type="button"
            onClick={() => {
              setWorkspacePreset("edit");
              setViewMode("map");
            }}
            className="mt-3 text-[10px] text-blue-400 hover:underline"
          >
            Back to Map View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={frameRootRef} className="relative h-full w-full overflow-hidden bg-[#07090d]">
      {camera.status === "on" ? (
        <>
          <CameraHeader
            camera={camera}
            index={cameraIndex < 0 ? 0 : cameraIndex}
            total={scene.cameras.length}
            cameras={scene.cameras}
            onPrevious={() => {
              const nextIndex = Math.max(0, (cameraIndex < 0 ? 0 : cameraIndex) - 1);
              const nextCamera = scene.cameras[nextIndex];
              if (nextCamera) {
                setSelectedCameraId(nextCamera.id);
                selectNode(nextCamera.id);
              }
            }}
            onNext={() => {
              const nextIndex = Math.min(scene.cameras.length - 1, (cameraIndex < 0 ? 0 : cameraIndex) + 1);
              const nextCamera = scene.cameras[nextIndex];
              if (nextCamera) {
                setSelectedCameraId(nextCamera.id);
                selectNode(nextCamera.id);
              }
            }}
            onSelect={(id) => {
              setSelectedCameraId(id);
              selectNode(id);
            }}
          />
          <Canvas
            camera={{
              position: camera.position,
              fov: Math.min(camera.fovHorizontalDeg, 100),
              near: 0.1,
              far: 60,
            }}
            shadows="percentage"
            gl={{ antialias: true, alpha: false }}
            style={{ width: "100%", height: "100%", filter: canvasFilter }}
          >
            <PerspectiveCamera
              makeDefault
              position={camera.position}
              fov={Math.min(camera.fovHorizontalDeg, 100)}
              near={0.1}
              far={60}
            />
            <color attach="background" args={[theme.background]} />
            <Suspense fallback={<CanvasLoadingOverlay label="Loading camera view" />}>
              <SceneFeedGeometry theme={theme} showPrivacyZones />
            </Suspense>
            <CameraRigLive camera={camera} />
            <CameraViewFloorAim camera={camera} />
            <CameraPositionIndicator camera={camera} />
            {replayActorVisible && activePath ? (
              <ReplayActor path={activePath} progress={pathReplay.progress} />
            ) : null}
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
          <CameraModeFilter mode={feedMode} />
          <CameraControlStrip camera={camera!} zones={scene.criticalZones} />
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
          />
          {activePath && activePathResult ? (
            <ReplayStatusOverlay
              pathLabel={activePath.label}
              timeS={pathTimeS}
              speed={pathReplay.speed}
              qualityLabel={replayQualityLabel}
              segmentLabel={replaySegmentLabel}
              progressPct={pathReplay.progress}
            />
          ) : null}
          {activePathResult && visibilityForCurrentCamera ? (
            <CameraPathVisibilityOverlay
              cameraName={camera.name}
              visibleSeconds={visibilityForCurrentCamera.visibleS}
              totalSeconds={activePathResult.totalDurationS}
              maxQuality={visibilityForCurrentCamera.maxQuality}
            />
          ) : null}
          {selectedCriticalZone ? (
            zoneAnalysis ? (
              <DoriInsightCard
                camera={camera}
                zoneLabel={selectedCriticalZone.label}
                targetType={selectedCriticalZone.targetType}
                currentQuality={zoneAnalysis.currentQuality}
                requiredQuality={zoneResult?.requiredQuality ?? selectedCriticalZone.requiredQuality}
                zoneStatus={zoneResult?.status ?? "unknown"}
                bestCameraName={zoneAnalysis.bestCameraName}
                distanceM={zoneAnalysis.distanceM}
                angleDeg={zoneAnalysis.angleDeg}
                lightingLabel={envMode === "night" ? "Night" : envMode === "dusk" ? "Dusk" : "Day"}
                reasonLine={zoneAnalysis.reasonLine}
              />
            ) : null
          ) : (
            <div className="absolute right-3 top-24 z-30 w-56 rounded-xl border border-dashed border-[#243146] bg-[#0b0f17]/92 px-3 py-2.5 shadow-[0_12px_34px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[#7dd3fc]">DORI OVERLAY</div>
              <div className="mt-1 text-[10px] font-semibold text-white">Select a critical zone</div>
              <div className="mt-1 text-[9px] text-[#9ab0ce]">
                Click a zone on the map to inspect its distance, angle, and required quality for the current camera.
              </div>
            </div>
          )}
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
          <BottomControlStrip mode={feedMode} onModeChange={setFeedMode} flags={flags} onFlagsChange={setFlags} onBackToMap={() => { setWorkspacePreset("edit"); setViewMode("map"); }} />
        </>
      ) : (
        <div className="relative h-full w-full">
          <OfflineFeed camera={camera} />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setWorkspacePreset("edit");
          setViewMode("map");
        }}
        className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-lg border border-[#2a3246] bg-[#0e1320]/90 px-3 py-1.5 text-[10px] font-medium text-[#c7d0e4] backdrop-blur-sm transition-colors hover:border-[#3a4a66] hover:text-white"
      >
        <ArrowLeft className="size-3" />
        Back to Map View
      </button>
    </div>
  );
}
