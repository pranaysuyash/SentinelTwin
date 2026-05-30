"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";

import { formatSecondsShort, type CameraVerificationSnapshot, type VerificationAlignmentMethod, type VerificationSourceType, type VerificationViewMode, type VideoFrameCandidate } from "@/components/view/camera-verification-utils";
import type { CameraNode } from "@/schema/security-scene";
import type { OperationalEvidenceEventInput } from "@/lib/operational-evidence";

type CameraViewVerificationIntent = {
  source: "launcher_preview" | "other";
  openPanel: boolean;
} | null;

type CameraVerificationSnapshotMap = Record<string, CameraVerificationSnapshot[]>;

type EvaluateAlignmentSampleArgs = {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  offsetX: number;
  offsetY: number;
  scale: number;
  mode: VerificationViewMode;
  split: number;
  opacity: number;
};

type ExtractVideoFrameResult = {
  dataUrl: string;
  durationS: number;
  sampleTimeS: number;
};

type ExtractVideoCandidatesResult = {
  durationS: number;
  candidates: VideoFrameCandidate[];
  bestCandidateId: string;
};

type UseCameraVerificationWorkflowArgs = {
  camera: CameraNode | null;
  sceneId: string;
  sceneName: string;
  sceneSource: CameraNode["source"];
  sceneRevisionDepth: number;
  frameRootRef: RefObject<HTMLDivElement | null>;
  cameraVerificationSnapshots: CameraVerificationSnapshotMap;
  cameraViewVerificationIntent: CameraViewVerificationIntent;
  setCameraViewVerificationIntent: (value: CameraViewVerificationIntent) => void;
  upsertCameraVerificationSnapshot: (cameraId: string, snapshot: CameraVerificationSnapshot) => void;
  removeCameraVerificationSnapshot: (cameraId: string, snapshotId: string) => void;
  recordOperationalEvidenceEvent: (event: OperationalEvidenceEventInput) => void;
};

type UseCameraVerificationWorkflowResult = {
  verificationEnabled: boolean;
  verificationImageUrl: string | null;
  verificationFileName: string | null;
  verificationMode: VerificationViewMode;
  verificationOpacity: number;
  verificationSplit: number;
  verificationOffsetX: number;
  verificationOffsetY: number;
  verificationScale: number;
  verificationAlignmentMethod: VerificationAlignmentMethod | null;
  verificationAutoAlignDelta: number | null;
  alignmentQualityScore: number | null;
  alignmentHeatmapUrl: string | null;
  showDifferenceHeatOverlay: boolean;
  verificationSourceType: VerificationSourceType;
  verificationVideoDurationS: number | null;
  verificationSampleTimeS: number | null;
  verificationVideoFile: File | null;
  verificationVideoCandidates: VideoFrameCandidate[];
  verificationSelectedCandidateId: string | null;
  verificationBestCandidateId: string | null;
  verificationExtracting: boolean;
  verificationError: string | null;
  snapshotsForCamera: CameraVerificationSnapshot[];
  canResample: boolean;
  canAutoAlign: boolean;
  setVerificationEnabled: (next: boolean) => void;
  setVerificationMode: (mode: VerificationViewMode) => void;
  setVerificationOpacity: (value: number) => void;
  setVerificationSplit: (value: number) => void;
  setVerificationOffsetX: (value: number) => void;
  setVerificationOffsetY: (value: number) => void;
  setVerificationScale: (value: number) => void;
  setShowDifferenceHeatOverlay: (next: boolean) => void;
  setVerificationSampleTimeS: (value: number | null) => void;
  setVerificationAlignmentMethod: (value: VerificationAlignmentMethod | null) => void;
  setVerificationAutoAlignDelta: (value: number | null) => void;
  setVerificationSelectedCandidateId: (value: string | null) => void;
  applyVideoCandidate: (candidate: VideoFrameCandidate, fileName: string) => void;
  extractFromCurrentVideo: (timeS?: number) => void;
  autoAlignVerification: () => void;
  handleUpload: (file: File) => void;
  handleSaveSnapshot: () => void;
  handleLoadSnapshot: (snapshotId: string) => void;
  handleDeleteSnapshot: (snapshotId: string) => void;
  handleNudge: (dx: number, dy: number) => void;
  handleResetAlign: () => void;
  handleClear: () => void;
};

function evaluateAlignmentSample({
  canvas,
  image,
  offsetX,
  offsetY,
  scale,
  mode,
  split,
  opacity,
}: EvaluateAlignmentSampleArgs) {
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

  for (let index = 0; index < renderPixels.data.length; index += 4) {
    const dr = Math.abs(renderPixels.data[index] - refPixels.data[index]);
    const dg = Math.abs(renderPixels.data[index + 1] - refPixels.data[index + 1]);
    const db = Math.abs(renderPixels.data[index + 2] - refPixels.data[index + 2]);
    const diff = (dr + dg + db) / (3 * 255);
    diffSum += diff;
    samples += 1;

    const level = Math.min(255, Math.round(diff * 320));
    heat.data[index] = level;
    heat.data[index + 1] = 40;
    heat.data[index + 2] = 255 - Math.round(level * 0.55);
    heat.data[index + 3] = Math.round(diff * 190);
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

async function extractVideoFrameDataUrl(file: File, sampleTimeSeconds?: number): Promise<ExtractVideoFrameResult> {
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

  for (let index = 0; index < sample.length; index += 4) {
    const y = sample[index]! * 0.299 + sample[index + 1]! * 0.587 + sample[index + 2]! * 0.114;
    luminanceSum += y;
    luminanceSqSum += y * y;
    count += 1;
  }

  if (count === 0) return 0;
  const mean = luminanceSum / count;
  const variance = Math.max(0, luminanceSqSum / count - mean * mean);
  return Math.sqrt(variance);
}

async function extractVideoFrameCandidates(file: File, candidateCount = 5): Promise<ExtractVideoCandidatesResult> {
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
        id: "video_candidate_0",
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

export function useCameraVerificationWorkflow({
  camera,
  sceneId,
  sceneName,
  sceneSource,
  sceneRevisionDepth,
  frameRootRef,
  cameraVerificationSnapshots,
  cameraViewVerificationIntent,
  setCameraViewVerificationIntent,
  upsertCameraVerificationSnapshot,
  removeCameraVerificationSnapshot,
  recordOperationalEvidenceEvent,
}: UseCameraVerificationWorkflowArgs): UseCameraVerificationWorkflowResult {
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

  const snapshotsForCamera = useMemo(
    () => (camera ? (cameraVerificationSnapshots[camera.id] ?? []) : []),
    [camera, cameraVerificationSnapshots],
  );
  const canResample = verificationSourceType === "video" && verificationVideoFile !== null;
  const canAutoAlign = Boolean(verificationEnabled && verificationImageUrl && !verificationExtracting);

  const extractFromCurrentVideo = useCallback((timeS?: number) => {
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
  }, [verificationVideoFile]);

  const applyVideoCandidate = useCallback((candidate: VideoFrameCandidate, fileName: string) => {
    setVerificationSourceType("video");
    setVerificationSampleTimeS(candidate.timeS);
    setVerificationImageUrl(candidate.dataUrl);
    setVerificationFileName(`${fileName} @ ${formatSecondsShort(candidate.timeS)}`);
    setVerificationScale(1);
    setVerificationAlignmentMethod(null);
    setVerificationAutoAlignDelta(null);
    setVerificationEnabled(true);
  }, []);

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
    frameRootRef,
    verificationEnabled,
    verificationImageUrl,
    verificationMode,
    verificationOffsetX,
    verificationOffsetY,
    verificationOpacity,
    verificationScale,
    verificationSplit,
  ]);

  const handleUpload = useCallback((file: File) => {
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
  }, [applyVideoCandidate]);

  const handleSaveSnapshot = useCallback(() => {
    if (!camera || !verificationImageUrl || !verificationFileName) return;
    const bestCandidate = verificationVideoCandidates.find((entry) => entry.id === verificationBestCandidateId) ?? null;
    const savedAt = Date.now();
    const savedSnapshotId = `verification_snapshot_${savedAt}`;
    upsertCameraVerificationSnapshot(camera.id, {
      id: savedSnapshotId,
      fileName: verificationFileName,
      imageUrl: verificationImageUrl,
      mode: verificationMode,
      sourceType: verificationSourceType,
      sampleTimeS: verificationSampleTimeS,
      videoDurationS: verificationVideoDurationS,
      candidateCount: verificationVideoCandidates.length,
      bestCandidateId: verificationBestCandidateId,
      bestCandidateScore: bestCandidate?.qualityScore ?? null,
      selectedCandidateId: verificationSelectedCandidateId,
      alignmentMethod: verificationAlignmentMethod,
      autoAlignDelta: verificationAutoAlignDelta,
      opacity: verificationOpacity,
      split: verificationSplit,
      offsetX: verificationOffsetX,
      offsetY: verificationOffsetY,
      scale: verificationScale,
      alignmentScore: alignmentQualityScore,
      createdAt: savedAt,
    });
    recordOperationalEvidenceEvent({
      kind: "snapshot_saved",
      title: "Camera verification snapshot saved",
      details: `Saved a reference-frame verification snapshot for ${camera.name}.`,
      actor: "user",
      source: sceneSource,
      sceneId,
      sceneName,
      revisionDepth: sceneRevisionDepth,
      affectedNodeIds: [camera.id],
      confidence: alignmentQualityScore === null ? 0.66 : Math.min(0.97, 0.68 + alignmentQualityScore / 200),
      lifecycleStage: "manual",
      branchLabel: "verification",
      notes: [
        `Verification snapshot ${savedSnapshotId} captured from ${verificationSourceType === "video" ? "video" : "image"} input.`,
        verificationAlignmentMethod ? `Alignment method: ${verificationAlignmentMethod}.` : "Alignment method: manual/auto state not captured.",
      ],
    });
  }, [
    alignmentQualityScore,
    camera,
    recordOperationalEvidenceEvent,
    sceneId,
    sceneName,
    sceneRevisionDepth,
    sceneSource,
    upsertCameraVerificationSnapshot,
    verificationAlignmentMethod,
    verificationAutoAlignDelta,
    verificationBestCandidateId,
    verificationVideoCandidates,
    verificationFileName,
    verificationImageUrl,
    verificationMode,
    verificationOffsetX,
    verificationOffsetY,
    verificationOpacity,
    verificationSampleTimeS,
    verificationScale,
    verificationSelectedCandidateId,
    verificationSourceType,
    verificationSplit,
    verificationVideoCandidates.length,
    verificationVideoDurationS,
  ]);

  const handleLoadSnapshot = useCallback((snapshotId: string) => {
    if (!camera) return;
    const snapshot = snapshotsForCamera.find((entry) => entry.id === snapshotId);
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
  }, [camera, snapshotsForCamera]);

  const handleDeleteSnapshot = useCallback((snapshotId: string) => {
    if (!camera) return;
    removeCameraVerificationSnapshot(camera.id, snapshotId);
  }, [camera, removeCameraVerificationSnapshot]);

  const handleNudge = useCallback((dx: number, dy: number) => {
    setVerificationAlignmentMethod("manual");
    setVerificationAutoAlignDelta(null);
    setVerificationOffsetX((value) => value + dx);
    setVerificationOffsetY((value) => value + dy);
  }, []);

  const handleResetAlign = useCallback(() => {
    setVerificationAlignmentMethod("manual");
    setVerificationAutoAlignDelta(null);
    setVerificationOffsetX(0);
    setVerificationOffsetY(0);
    setVerificationScale(1);
  }, []);

  const handleClear = useCallback(() => {
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
  }, [verificationImageUrl]);

  useEffect(() => {
    return () => {
      if (verificationImageUrl && verificationImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(verificationImageUrl);
      }
    };
  }, [verificationImageUrl]);

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
    frameRootRef,
    verificationEnabled,
    verificationImageUrl,
    verificationMode,
    verificationOpacity,
    verificationOffsetX,
    verificationOffsetY,
    verificationScale,
    verificationSplit,
  ]);

  return {
    verificationEnabled,
    verificationImageUrl,
    verificationFileName,
    verificationMode,
    verificationOpacity,
    verificationSplit,
    verificationOffsetX,
    verificationOffsetY,
    verificationScale,
    verificationAlignmentMethod,
    verificationAutoAlignDelta,
    alignmentQualityScore,
    alignmentHeatmapUrl,
    showDifferenceHeatOverlay,
    verificationSourceType,
    verificationVideoDurationS,
    verificationSampleTimeS,
    verificationVideoFile,
    verificationVideoCandidates,
    verificationSelectedCandidateId,
    verificationBestCandidateId,
    verificationExtracting,
    verificationError,
    snapshotsForCamera,
    canResample,
    canAutoAlign,
    setVerificationEnabled,
    setVerificationMode,
    setVerificationOpacity,
    setVerificationSplit,
    setVerificationOffsetX,
    setVerificationOffsetY,
    setVerificationScale,
    setShowDifferenceHeatOverlay,
    setVerificationSampleTimeS,
    setVerificationAlignmentMethod,
    setVerificationAutoAlignDelta,
    setVerificationSelectedCandidateId,
    applyVideoCandidate,
    extractFromCurrentVideo,
    autoAlignVerification,
    handleUpload,
    handleSaveSnapshot,
    handleLoadSnapshot,
    handleDeleteSnapshot,
    handleNudge,
    handleResetAlign,
    handleClear,
  };
}
