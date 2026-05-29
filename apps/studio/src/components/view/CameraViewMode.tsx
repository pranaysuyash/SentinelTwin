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
import { ReplayActor, CameraPositionIndicator, CameraViewFloorAim } from "@/components/view/camera-view-scene";
import {
  alignmentQualityLabel,
  formatSecondsShort,
  type VerificationAlignmentMethod,
  type VerificationSourceType,
  type VerificationViewMode,
  type VideoFrameCandidate,
} from "@/components/view/camera-verification-utils";
import { computeOperationalEvidenceFusionSummary, computeSensorFusionSummary } from "@/lib/sensor-fusion";
import type { CameraNode, DoriQuality } from "@/schema/security-scene";
import { CanvasLoadingOverlay } from "@/components/shared/CanvasLoadingOverlay";
import { formatCameraTag } from "@/components/view/camera-view-utils";

function OfflineFeed({ camera: cam }: { camera: CameraNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#070a10]">
      <div className="rounded-full border border-red-500/20 bg-red-500/10 p-4">
        <VideoOff className="h-8 w-8 text-red-400/60" />
      </div>
      <div className="text-center">
        <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-red-300/60">Camera Offline</div>
        <div className="mt-1 text-[10px] text-[#4a5568]">{cam.name}</div>
      </div>
      <div className="absolute inset-x-0 top-0 px-3 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          <span className="text-[9px] font-bold tracking-wide text-white/60">{formatCameraTag(cam.name)} · {cam.name}</span>
          <CircleSmall className="ml-auto h-3 w-3 text-red-300" />
        </div>
      </div>
    </div>
  );
}

function evaluateAlignmentSample({
  canvas,
  image,
  offsetX,
  offsetY,
  scale,
  mode,
  split,
  opacity,
}: {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  offsetX: number;
  offsetY: number;
  scale: number;
  mode: VerificationViewMode;
  split: number;
  opacity: number;
}) {
  const sampleWidth = 96;
  const sampleHeight = 54;

  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = sampleWidth;
  renderCanvas.height = sampleHeight;
  const renderCtx = renderCanvas.getContext("2d", { willReadFrequently: true });
  if (!renderCtx) return null;

  const referenceCanvas = document.createElement("canvas");
  referenceCanvas.width = sampleWidth;
  referenceCanvas.height = sampleHeight;
  const refCtx = referenceCanvas.getContext("2d", { willReadFrequently: true });
  if (!refCtx) return null;

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = sampleWidth;
  overlayCanvas.height = sampleHeight;
  const overlayCtx = overlayCanvas.getContext("2d");
  if (!overlayCtx) return null;

  renderCtx.clearRect(0, 0, sampleWidth, sampleHeight);
  renderCtx.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);

  refCtx.clearRect(0, 0, sampleWidth, sampleHeight);
  const dx = Math.round((offsetX / Math.max(1, canvas.clientWidth)) * sampleWidth);
  const dy = Math.round((offsetY / Math.max(1, canvas.clientHeight)) * sampleHeight);
  const safeScale = Math.min(1.6, Math.max(0.5, scale));
  const scaledWidth = sampleWidth * safeScale;
  const scaledHeight = sampleHeight * safeScale;
  const centeredX = dx + (sampleWidth - scaledWidth) / 2;
  const centeredY = dy + (sampleHeight - scaledHeight) / 2;
  refCtx.drawImage(image, centeredX, centeredY, scaledWidth, scaledHeight);

  if (mode === "split") {
    const splitX = Math.round((split / 100) * sampleWidth);
    refCtx.clearRect(splitX, 0, sampleWidth - splitX, sampleHeight);
    renderCtx.clearRect(splitX, 0, sampleWidth - splitX, sampleHeight);
  }

  const renderPixels = renderCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  const refPixels = refCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  const heat = overlayCtx.createImageData(sampleWidth, sampleHeight);
  let diffSum = 0;
  let samples = 0;

  for (let i = 0; i < renderPixels.data.length; i += 4) {
    const dr = Math.abs(renderPixels.data[i] - refPixels.data[i]);
    const dg = Math.abs(renderPixels.data[i + 1] - refPixels.data[i + 1]);
    const db = Math.abs(renderPixels.data[i + 2] - refPixels.data[i + 2]);
    const diff = (dr + dg + db) / (3 * 255);
    diffSum += diff;
    samples += 1;

    const level = Math.min(255, Math.round(diff * 320));
    heat.data[i] = level;
    heat.data[i + 1] = 40;
    heat.data[i + 2] = 255 - Math.round(level * 0.55);
    heat.data[i + 3] = Math.round(diff * 190);
  }

  overlayCtx.putImageData(heat, 0, 0);
  const mismatch = samples > 0 ? diffSum / samples : 1;
  const opacityWeight = 0.6 + opacity * 0.4;
  const adjustedMismatch = Math.min(1, mismatch * opacityWeight);
  const score = Math.max(0, Math.min(100, (1 - adjustedMismatch) * 100));

  return {
    score,
    heatmapUrl: overlayCanvas.toDataURL("image/png"),
  };
}

function waitForMediaEvent(target: HTMLMediaElement, eventName: keyof HTMLMediaElementEventMap) {
  return new Promise<void>((resolve, reject) => {
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Failed while waiting for video ${eventName}`));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onSuccess as EventListener);
      target.removeEventListener("error", onError as EventListener);
    };

    target.addEventListener(eventName, onSuccess as EventListener, { once: true });
    target.addEventListener("error", onError as EventListener, { once: true });
  });
}

async function extractVideoFrameDataUrl(file: File, sampleTimeSeconds?: number) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await waitForMediaEvent(video, "loadedmetadata");
    const durationS = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const sampleTimeS = durationS > 0
      ? Math.min(durationS, Math.max(0, sampleTimeSeconds ?? durationS * 0.5))
      : 0;

    if (durationS > 0) {
      video.currentTime = sampleTimeS;
      await waitForMediaEvent(video, "seeked");
    } else {
      await waitForMediaEvent(video, "loadeddata");
    }

    const width = Math.max(1, video.videoWidth || 1280);
    const height = Math.max(1, video.videoHeight || 720);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to create frame extraction canvas");
    }
    ctx.drawImage(video, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      durationS,
      sampleTimeS,
    };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}

function estimateFrameQuality(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const sample = ctx.getImageData(0, 0, width, height).data;
  let luminanceSum = 0;
  let luminanceSqSum = 0;
  let count = 0;

  for (let i = 0; i < sample.length; i += 4) {
    const y = sample[i]! * 0.299 + sample[i + 1]! * 0.587 + sample[i + 2]! * 0.114;
    luminanceSum += y;
    luminanceSqSum += y * y;
    count += 1;
  }

  if (count === 0) return 0;
  const mean = luminanceSum / count;
  const variance = Math.max(0, luminanceSqSum / count - mean * mean);
  return Math.sqrt(variance);
}

async function extractVideoFrameCandidates(file: File, candidateCount = 5) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await waitForMediaEvent(video, "loadedmetadata");
    const durationS = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const width = Math.max(1, video.videoWidth || 1280);
    const height = Math.max(1, video.videoHeight || 720);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Unable to create candidate extraction canvas");
    }

    const targetCount = Math.max(1, Math.floor(candidateCount));
    const candidates: VideoFrameCandidate[] = [];

    if (durationS <= 0) {
      await waitForMediaEvent(video, "loadeddata");
      ctx.drawImage(video, 0, 0, width, height);
      const qualityScore = estimateFrameQuality(ctx, width, height);
      candidates.push({
        id: `video_candidate_0`,
        timeS: 0,
        dataUrl: canvas.toDataURL("image/png"),
        qualityScore,
      });
      return { durationS, candidates, bestCandidateId: candidates[0]!.id };
    }

    for (let index = 0; index < targetCount; index += 1) {
      const ratio = targetCount === 1 ? 0.5 : (index + 1) / (targetCount + 1);
      const timeS = Math.min(durationS, Math.max(0, durationS * ratio));
      video.currentTime = timeS;
      await waitForMediaEvent(video, "seeked");

      ctx.drawImage(video, 0, 0, width, height);
      const qualityScore = estimateFrameQuality(ctx, width, height);
      candidates.push({
        id: `video_candidate_${index}`,
        timeS,
        dataUrl: canvas.toDataURL("image/png"),
        qualityScore,
      });
    }

    const best = candidates.reduce((acc, candidate) => (candidate.qualityScore > acc.qualityScore ? candidate : acc), candidates[0]!);
    return {
      durationS,
      candidates,
      bestCandidateId: best.id,
    };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
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
  const [verificationEnabled, setVerificationEnabled] = useState(false);
  const [verificationImageUrl, setVerificationImageUrl] = useState<string | null>(null);
  const [verificationFileName, setVerificationFileName] = useState<string | null>(null);
  const [verificationMode, setVerificationMode] = useState<VerificationViewMode>("overlay");
  const [verificationOpacity, setVerificationOpacity] = useState(0.42);
  const [verificationSplit, setVerificationSplit] = useState(50);
  const [verificationOffsetX, setVerificationOffsetX] = useState(0);
  const [verificationOffsetY, setVerificationOffsetY] = useState(0);
  const [verificationScale, setVerificationScale] = useState(1);
  const [verificationAlignmentMethod, setVerificationAlignmentMethod] = useState<VerificationAlignmentMethod | null>(null);
  const [verificationAutoAlignDelta, setVerificationAutoAlignDelta] = useState<number | null>(null);
  const [alignmentQualityScore, setAlignmentQualityScore] = useState<number | null>(null);
  const [alignmentHeatmapUrl, setAlignmentHeatmapUrl] = useState<string | null>(null);
  const [showDifferenceHeatOverlay, setShowDifferenceHeatOverlay] = useState(false);
  const [verificationSourceType, setVerificationSourceType] = useState<VerificationSourceType>("image");
  const [verificationVideoDurationS, setVerificationVideoDurationS] = useState<number | null>(null);
  const [verificationSampleTimeS, setVerificationSampleTimeS] = useState<number | null>(null);
  const [verificationVideoFile, setVerificationVideoFile] = useState<File | null>(null);
  const [verificationVideoCandidates, setVerificationVideoCandidates] = useState<VideoFrameCandidate[]>([]);
  const [verificationSelectedCandidateId, setVerificationSelectedCandidateId] = useState<string | null>(null);
  const [verificationBestCandidateId, setVerificationBestCandidateId] = useState<string | null>(null);
  const [verificationExtracting, setVerificationExtracting] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const frameRootRef = useRef<HTMLDivElement | null>(null);
  const snapshotsForCamera = camera ? (cameraVerificationSnapshots[camera.id] ?? []) : [];
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
    const bestCameraName = result?.cameraResults
      .map((entry) => ({
        cameraId: entry.cameraId,
        quality: entry.qualityByZone[selectedCriticalZone.id] ?? "none",
      }))
      .sort((a, b) => QUALITY_RANK[b.quality as DoriQuality] - QUALITY_RANK[a.quality as DoriQuality])[0];

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
      bestCameraName: bestCameraName ? (scene.cameras.find((entry) => entry.id === bestCameraName.cameraId)?.name ?? bestCameraName.cameraId) : camera.name,
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

  const extractFromCurrentVideo = (timeS?: number) => {
    if (!verificationVideoFile) return;
    setVerificationExtracting(true);
    setVerificationError(null);
    void extractVideoFrameDataUrl(verificationVideoFile, timeS)
      .then((frame) => {
        setVerificationSourceType("video");
        setVerificationVideoDurationS(frame.durationS);
        setVerificationSampleTimeS(frame.sampleTimeS);
        setVerificationImageUrl(frame.dataUrl);
        setVerificationFileName(`${verificationVideoFile.name} @ ${formatSecondsShort(frame.sampleTimeS)}`);
        setVerificationScale(1);
        setVerificationAlignmentMethod(null);
        setVerificationAutoAlignDelta(null);
        setVerificationSelectedCandidateId(null);
        setVerificationEnabled(true);
      })
      .catch((error) => {
        setVerificationError(error instanceof Error ? error.message : "Video frame extraction failed");
      })
      .finally(() => {
        setVerificationExtracting(false);
      });
  };

  const applyVideoCandidate = (candidate: VideoFrameCandidate, fileName: string) => {
    setVerificationSourceType("video");
    setVerificationSampleTimeS(candidate.timeS);
    setVerificationImageUrl(candidate.dataUrl);
    setVerificationFileName(`${fileName} @ ${formatSecondsShort(candidate.timeS)}`);
    setVerificationScale(1);
    setVerificationAlignmentMethod(null);
    setVerificationAutoAlignDelta(null);
    setVerificationEnabled(true);
  };

  const autoAlignVerification = useCallback(() => {
    if (!verificationEnabled || !verificationImageUrl) return;

    const host = frameRootRef.current;
    const canvas = host?.querySelector("canvas");
    if (!canvas) return;

    setVerificationExtracting(true);
    setVerificationError(null);

    const image = new window.Image();
    image.decoding = "async";

    image.onload = () => {
      let bestX = verificationOffsetX;
      let bestY = verificationOffsetY;
      let bestScale = verificationScale;
      let bestScore = -1;
      const startScore = alignmentQualityScore;

      const phases = [
        { step: 16, radius: 96, scaleStep: 0.06, scaleRadius: 0.18 },
        { step: 6, radius: 24, scaleStep: 0.03, scaleRadius: 0.08 },
        { step: 2, radius: 8, scaleStep: 0.01, scaleRadius: 0.03 },
      ];

      for (const phase of phases) {
        const centerX = bestX;
        const centerY = bestY;
        const centerScale = bestScale;
        for (let dx = -phase.radius; dx <= phase.radius; dx += phase.step) {
          for (let dy = -phase.radius; dy <= phase.radius; dy += phase.step) {
            for (let ds = -phase.scaleRadius; ds <= phase.scaleRadius; ds += phase.scaleStep) {
              const candidateX = centerX + dx;
              const candidateY = centerY + dy;
              const candidateScale = Math.min(1.3, Math.max(0.7, centerScale + ds));
              const sample = evaluateAlignmentSample({
                canvas,
                image,
                offsetX: candidateX,
                offsetY: candidateY,
                scale: candidateScale,
                mode: verificationMode,
                split: verificationSplit,
                opacity: verificationOpacity,
              });
              if (!sample) continue;
              if (sample.score > bestScore) {
                bestScore = sample.score;
                bestX = candidateX;
                bestY = candidateY;
                bestScale = candidateScale;
              }
            }
          }
        }
      }

      setVerificationOffsetX(bestX);
      setVerificationOffsetY(bestY);
      setVerificationScale(bestScale);

      const finalSample = evaluateAlignmentSample({
        canvas,
        image,
        offsetX: bestX,
        offsetY: bestY,
        scale: bestScale,
        mode: verificationMode,
        split: verificationSplit,
        opacity: verificationOpacity,
      });
      if (finalSample) {
        setAlignmentQualityScore(finalSample.score);
        setAlignmentHeatmapUrl(finalSample.heatmapUrl);
        const delta = startScore !== null ? finalSample.score - startScore : 0;
        setVerificationAlignmentMethod("auto");
        setVerificationAutoAlignDelta(delta);
      }
      setVerificationExtracting(false);
    };

    image.onerror = () => {
      setVerificationError("Unable to auto-align reference frame");
      setVerificationExtracting(false);
    };

    image.src = verificationImageUrl;
  }, [
    alignmentQualityScore,
    verificationEnabled,
    verificationImageUrl,
    verificationMode,
    verificationOffsetX,
    verificationOffsetY,
    verificationScale,
    verificationOpacity,
    verificationSplit,
  ]);

  useEffect(() => {
    return () => {
      if (verificationImageUrl && verificationImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(verificationImageUrl);
      }
    };
  }, [verificationImageUrl]);

  useEffect(() => {
    if (camera?.id) {
      setSelectedCameraId(camera.id);
    }
  }, [camera?.id, setSelectedCameraId]);

  useEffect(() => {
    if (!cameraViewVerificationIntent?.openPanel) return;
    queueMicrotask(() => {
      setVerificationEnabled(true);
      setCameraViewVerificationIntent(null);
    });
  }, [cameraViewVerificationIntent, setCameraViewVerificationIntent]);

  useEffect(() => {
    if (!verificationEnabled || !verificationImageUrl || !camera) return;

    const host = frameRootRef.current;
    const canvas = host?.querySelector("canvas");
    if (!canvas) return;

    let canceled = false;
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => {
      if (canceled) return;
      const sample = evaluateAlignmentSample({
        canvas,
        image,
        offsetX: verificationOffsetX,
        offsetY: verificationOffsetY,
        scale: verificationScale,
        mode: verificationMode,
        split: verificationSplit,
        opacity: verificationOpacity,
      });
      if (!sample) return;
      setAlignmentQualityScore(sample.score);
      setAlignmentHeatmapUrl(sample.heatmapUrl);
    };
    image.src = verificationImageUrl;

    return () => {
      canceled = true;
    };
  }, [
    camera,
    verificationEnabled,
    verificationImageUrl,
    verificationMode,
    verificationOpacity,
    verificationSplit,
    verificationOffsetX,
    verificationOffsetY,
    verificationScale,
  ]);

  if (!camera) {
    return (
      <div className="flex h-full items-center justify-center bg-[#07090d]">
        <div className="text-center text-[#4a5568]">
          <p className="text-[11px]">No camera selected</p>
          <button
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
          {verificationEnabled && verificationImageUrl ? (
            <FootageVerificationOverlay
              imageUrl={verificationImageUrl}
              mode={verificationMode}
              opacity={verificationOpacity}
              split={verificationSplit}
              offsetX={verificationOffsetX}
              offsetY={verificationOffsetY}
              scale={verificationScale}
            />
          ) : null}
          {verificationEnabled && showDifferenceHeatOverlay && alignmentHeatmapUrl ? (
            <div className="pointer-events-none absolute inset-0">
              <Image
                src={alignmentHeatmapUrl}
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
            enabled={verificationEnabled}
            mode={verificationMode}
            opacity={verificationOpacity}
            split={verificationSplit}
            offsetX={verificationOffsetX}
            offsetY={verificationOffsetY}
            fileName={verificationFileName}
            alignmentScore={alignmentQualityScore}
            alignmentLabel={alignmentQualityScore !== null ? alignmentQualityLabel(alignmentQualityScore) : null}
            alignmentMethod={verificationAlignmentMethod}
            autoAlignDelta={verificationAutoAlignDelta}
            scale={verificationScale}
            sourceType={verificationSourceType}
            videoDurationS={verificationVideoDurationS}
            sampleTimeS={verificationSampleTimeS}
            extractionInProgress={verificationExtracting}
            errorMessage={verificationError}
            canResample={verificationSourceType === "video" && verificationVideoFile !== null}
            canAutoAlign={Boolean(verificationEnabled && verificationImageUrl && !verificationExtracting)}
            videoCandidates={verificationVideoCandidates}
            selectedCandidateId={verificationSelectedCandidateId}
            bestCandidateId={verificationBestCandidateId}
            onSelectVideoCandidate={(candidateId) => {
              if (!verificationVideoFile) return;
              const candidate = verificationVideoCandidates.find((entry) => entry.id === candidateId);
              if (!candidate) return;
              setVerificationSelectedCandidateId(candidateId);
              applyVideoCandidate(candidate, verificationVideoFile.name);
            }}
            onAutoPickBestFrame={() => {
              if (!verificationBestCandidateId || !verificationVideoFile) return;
              const best = verificationVideoCandidates.find((entry) => entry.id === verificationBestCandidateId);
              if (!best) return;
              setVerificationSelectedCandidateId(best.id);
              applyVideoCandidate(best, verificationVideoFile.name);
            }}
            onSampleTimeChange={(value) => {
              setVerificationSampleTimeS(value);
            }}
            onResampleVideoFrame={() => {
              extractFromCurrentVideo(verificationSampleTimeS ?? undefined);
            }}
            showHeatOverlay={showDifferenceHeatOverlay}
            snapshots={snapshotsForCamera}
            onToggle={setVerificationEnabled}
            onUpload={(file) => {
              setVerificationError(null);
              if (file.type.startsWith("video/")) {
                setVerificationVideoFile(file);
                setVerificationSampleTimeS(null);
                setVerificationScale(1);
                setVerificationAlignmentMethod(null);
                setVerificationAutoAlignDelta(null);
                setVerificationExtracting(true);
                void extractVideoFrameCandidates(file)
                  .then((result) => {
                    setVerificationSourceType("video");
                    setVerificationVideoDurationS(result.durationS);
                    setVerificationVideoCandidates(result.candidates);
                    setVerificationBestCandidateId(result.bestCandidateId);

                    const preferred = result.candidates.find((entry) => entry.id === result.bestCandidateId) ?? result.candidates[0] ?? null;
                    if (preferred) {
                      setVerificationSelectedCandidateId(preferred.id);
                      applyVideoCandidate(preferred, file.name);
                    }
                  })
                  .catch((error) => {
                    setVerificationError(error instanceof Error ? error.message : "Video frame extraction failed");
                    setVerificationVideoCandidates([]);
                    setVerificationBestCandidateId(null);
                    setVerificationSelectedCandidateId(null);
                  })
                  .finally(() => {
                    setVerificationExtracting(false);
                  });
                return;
              }

              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result !== "string") return;
                setVerificationSourceType("image");
                setVerificationVideoDurationS(null);
                setVerificationSampleTimeS(null);
                setVerificationVideoFile(null);
                setVerificationVideoCandidates([]);
                setVerificationBestCandidateId(null);
                setVerificationSelectedCandidateId(null);
                setVerificationScale(1);
                setVerificationAlignmentMethod(null);
                setVerificationAutoAlignDelta(null);
                setVerificationImageUrl(reader.result);
                setVerificationFileName(file.name);
                setVerificationEnabled(true);
              };
              reader.onerror = () => {
                setVerificationError("Unable to read image file");
              };
              reader.readAsDataURL(file);
            }}
            onSaveSnapshot={() => {
              if (!camera || !verificationImageUrl || !verificationFileName) return;
              upsertCameraVerificationSnapshot(camera.id, {
                id: `verification_snapshot_${Date.now()}`,
                fileName: verificationFileName,
                imageUrl: verificationImageUrl,
                mode: verificationMode,
                sourceType: verificationSourceType,
                sampleTimeS: verificationSampleTimeS,
                videoDurationS: verificationVideoDurationS,
                candidateCount: verificationVideoCandidates.length,
                bestCandidateId: verificationBestCandidateId,
                selectedCandidateId: verificationSelectedCandidateId,
                alignmentMethod: verificationAlignmentMethod,
                autoAlignDelta: verificationAutoAlignDelta,
                opacity: verificationOpacity,
                split: verificationSplit,
                offsetX: verificationOffsetX,
                offsetY: verificationOffsetY,
                scale: verificationScale,
                alignmentScore: alignmentQualityScore,
                createdAt: Date.now(),
              });
            }}
            onLoadSnapshot={(snapshotId) => {
              if (!camera) return;
              const snapshot = (cameraVerificationSnapshots[camera.id] ?? []).find((entry) => entry.id === snapshotId);
              if (!snapshot) return;
              setVerificationEnabled(true);
              setVerificationImageUrl(snapshot.imageUrl);
              setVerificationFileName(snapshot.fileName);
              setVerificationMode(snapshot.mode);
              setVerificationSourceType(snapshot.sourceType ?? "image");
              setVerificationSampleTimeS(snapshot.sampleTimeS ?? null);
              setVerificationVideoDurationS(snapshot.videoDurationS ?? null);
              setVerificationBestCandidateId(snapshot.bestCandidateId ?? null);
              setVerificationSelectedCandidateId(snapshot.selectedCandidateId ?? null);
              setVerificationAlignmentMethod(snapshot.alignmentMethod ?? null);
              setVerificationAutoAlignDelta(snapshot.autoAlignDelta ?? null);
              setVerificationVideoCandidates([]);
              setVerificationVideoFile(null);
              setVerificationOpacity(snapshot.opacity);
              setVerificationSplit(snapshot.split);
              setVerificationOffsetX(snapshot.offsetX);
              setVerificationOffsetY(snapshot.offsetY);
              setVerificationScale(snapshot.scale ?? 1);
              setAlignmentQualityScore(snapshot.alignmentScore);
            }}
            onDeleteSnapshot={(snapshotId) => {
              if (!camera) return;
              removeCameraVerificationSnapshot(camera.id, snapshotId);
            }}
            onModeChange={setVerificationMode}
            onOpacityChange={setVerificationOpacity}
            onSplitChange={setVerificationSplit}
            onOffsetXChange={(value) => {
              setVerificationAlignmentMethod("manual");
              setVerificationAutoAlignDelta(null);
              setVerificationOffsetX(value);
            }}
            onOffsetYChange={(value) => {
              setVerificationAlignmentMethod("manual");
              setVerificationAutoAlignDelta(null);
              setVerificationOffsetY(value);
            }}
            onScaleChange={(value) => {
              setVerificationAlignmentMethod("manual");
              setVerificationAutoAlignDelta(null);
              setVerificationScale(value);
            }}
            onToggleHeatOverlay={setShowDifferenceHeatOverlay}
            onNudge={(dx, dy) => {
              setVerificationAlignmentMethod("manual");
              setVerificationAutoAlignDelta(null);
              setVerificationOffsetX((value) => value + dx);
              setVerificationOffsetY((value) => value + dy);
            }}
            onAutoAlign={autoAlignVerification}
            onResetAlign={() => {
              setVerificationAlignmentMethod("manual");
              setVerificationAutoAlignDelta(null);
              setVerificationOffsetX(0);
              setVerificationOffsetY(0);
              setVerificationScale(1);
            }}
            onClear={() => {
              if (verificationImageUrl && verificationImageUrl.startsWith("blob:")) {
                URL.revokeObjectURL(verificationImageUrl);
              }
              setVerificationImageUrl(null);
              setVerificationFileName(null);
              setVerificationEnabled(false);
              setVerificationSourceType("image");
              setVerificationVideoDurationS(null);
              setVerificationSampleTimeS(null);
              setVerificationVideoFile(null);
              setVerificationVideoCandidates([]);
              setVerificationBestCandidateId(null);
              setVerificationSelectedCandidateId(null);
              setVerificationAlignmentMethod(null);
              setVerificationAutoAlignDelta(null);
              setVerificationScale(1);
              setVerificationError(null);
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
        onClick={() => {
          setWorkspacePreset("edit");
          setViewMode("map");
        }}
        className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-lg border border-[#2a3246] bg-[#0e1320]/90 px-3 py-1.5 text-[10px] font-medium text-[#c7d0e4] backdrop-blur-sm transition-colors hover:border-[#3a4a66] hover:text-white"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Map View
      </button>
    </div>
  );
}
