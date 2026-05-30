"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  ImageUp,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Shuffle,
  TriangleAlert,
} from "lucide-react";

import { SurfaceButton } from "@/components/shared/SurfaceButton";
import { useStudioStore } from "@/store/studio-store";
import { ReconstructionPipeline, assessSceneReconstructionReadiness } from "@/lib/reconstruction-pipeline";
import { createCapturePhoto } from "@/schema/reconstruction-pipeline";
import type { ReconstructionStage, StageResult, ReconstructionSession, CapturePhoto, RoomMeasurement } from "@/schema/reconstruction-pipeline";
import { RECONSTRUCTION_STAGE_LABELS } from "@/schema/reconstruction-pipeline";
import { runReconstruction } from "@/lib/scan-reconstruction-runner";
import { createScanCaptureSession, createPhotoArtifact } from "@/lib/scan-artifacts";
import type { ScanCaptureSession, ScanCandidate } from "@/lib/scan-artifacts";
import { ReconstructionCandidatePanel } from "@/components/reconstruction/ReconstructionCandidatePanel";
import type { SiteTwinDraft } from "@/lib/site-compiler";
import { compileReconstructionToSiteTwinDraft } from "@/lib/scan-reconstruction";

interface GuidedCaptureAssistantProps {
  onClose?: () => void;
}

type CaptureStep = "prep" | "capture" | "review" | "process" | "review_candidates" | "result" | "compile";

const CAPTURE_COACHING_TIPS = [
  {
    tip: "Capture the room from each corner",
    detail: "Work around the perimeter, overlapping photos by 30-40%.",
    icon: "360",
  },
  {
    tip: "Keep the camera level",
    detail: "Avoid tilting. Hold the phone parallel to walls for best results.",
    icon: "level",
  },
  {
    tip: "Include a reference object",
    detail: "Photo a door (standard ~2m) or known-width object for scale anchoring.",
    icon: "ruler",
  },
  {
    tip: "Avoid direct light sources",
    detail: "Bright lights into the lens wash out depth information.",
    icon: "sun",
  },
];

export function GuidedCaptureAssistant({ onClose }: GuidedCaptureAssistantProps) {
  const [step, setStep] = useState<CaptureStep>("prep");
  const [photos, setPhotos] = useState<CapturePhoto[]>([]);
  const [measurements, setMeasurements] = useState<RoomMeasurement>({
    estimatedHeightM: 3,
  });
  const [widthInput, setWidthInput] = useState("");
  const [depthInput, setDepthInput] = useState("");
  const [heightInput, setHeightInput] = useState("3");
  const [knownRefInput, setKnownRefInput] = useState("");
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [session, setSession] = useState<ReconstructionSession | null>(null);
  const [stageProgress, setStageProgress] = useState<Record<ReconstructionStage, StageResult["status"]>>({} as Record<ReconstructionStage, StageResult["status"]>);
  const [coachingOpen, setCoachingOpen] = useState(true);
  const [readiness, setReadiness] = useState<{ ready: boolean; confidence: number; gaps: string[]; recommendations: string[] } | null>(null);
  const [scanSession, setScanSession] = useState<ScanCaptureSession | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recordEvent = useStudioStore((s) => s.recordOperationalEvidenceEvent);
  const setScene = useStudioStore((s) => s.setScene);

  const handleAddPhotos = useCallback((files: FileList) => {
    const newPhotos: CapturePhoto[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const photo = createCapturePhoto(file.name, dataUrl);
        setPhotos((prev) => [...prev, photo]);
      };
      reader.readAsDataURL(file);
      newPhotos.push(createCapturePhoto(file.name));
    }
  }, []);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleAddPhotos(event.target.files);
      event.target.value = "";
    }
  }, [handleAddPhotos]);

  const removePhoto = useCallback((photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, []);

  const updateMeasurements = useCallback(() => {
    setMeasurements({
      estimatedHeightM: parseFloat(heightInput) || 3,
      estimatedWidthM: parseFloat(widthInput) || undefined,
      estimatedDepthM: parseFloat(depthInput) || undefined,
      knownWidthM: undefined,
      knownDepthM: undefined,
      knownReferenceLabel: knownRefInput.trim() || undefined,
    });
  }, [widthInput, depthInput, heightInput, knownRefInput]);

  const runNewPipeline = useCallback(async (
    currentPhotos: CapturePhoto[],
    widthVal: string,
    depthVal: string,
    heightVal: string,
    refVal: string,
  ) => {
    setReviewLoading(true);
    try {
      const newSession = createScanCaptureSession("Guided Capture", "ai_assisted");
      newSession.roomDimensions = {
        widthM: parseFloat(widthVal) || undefined,
        depthM: parseFloat(depthVal) || undefined,
        heightM: parseFloat(heightVal) || 3,
      };
      if (refVal.trim()) {
        newSession.knownMeasurements.push({
          label: refVal.trim(),
          valueM: 0.9,
          source: "user",
        });
      }
      for (const photo of currentPhotos) {
        const artifact = createPhotoArtifact(
          photo.dataUrl ?? "",
          photo.fileName,
          photo.widthPx ?? 640,
          photo.heightPx ?? 480,
        );
        newSession.photos.push(artifact);
        newSession.artifacts.push(artifact);
      }
      const result = await runReconstruction(newSession);
      if (result.ok) {
        setScanSession(result.data.session);
        setStep("review_candidates");
      } else {
        setStep("result");
      }
    } finally {
      setReviewLoading(false);
    }
  }, []);

  const handleCandidateCompile = useCallback((draft: SiteTwinDraft) => {
    setScene(draft.scene);
    setStep("result");
  }, [setScene]);

  const runPipeline = useCallback(async () => {
    if (photos.length === 0) return;

    updateMeasurements();
    setPipelineRunning(true);
    setStep("process");

    recordEvent({
      kind: "scan_session_started",
      title: "Guided reconstruction started",
      details: `Starting pipeline with ${photos.length} photos.`,
      actor: "user",
      source: "scan",
      sceneId: "reconstruction",
      sceneName: `Reconstruction (${photos.length} photos)`,
      revisionDepth: 0,
      affectedNodeIds: [],
      confidence: 0.8,
      beforeSummary: "Pipeline not yet run.",
      afterSummary: "Pipeline started.",
      notes: ["Guided capture reconstruction triggered from the scan assistant."],
    });

    const pipeline = new ReconstructionPipeline(
      photos,
      {
        estimatedWidthM: parseFloat(widthInput) || undefined,
        estimatedDepthM: parseFloat(depthInput) || undefined,
        estimatedHeightM: parseFloat(heightInput) || 3,
        knownWidthM: undefined,
        knownDepthM: undefined,
        knownReferenceLabel: knownRefInput.trim() || undefined,
      },
    );

    pipeline.onStage((stage, result) => {
      setStageProgress((prev) => ({ ...prev, [stage]: result.status }));
    });

    const result = await pipeline.run();
    setSession(result);
    setPipelineRunning(false);

    const qualityGate = result.stageResults.find((r) => r.stage === "quality_gate");
    const recommendation = (qualityGate?.outputData as Record<string, unknown>)?.recommendation ?? "review_before_accept";

    const assessmentResult = result.compiledScene
      ? await assessSceneReconstructionReadiness(result.compiledScene as Parameters<typeof assessSceneReconstructionReadiness>[0])
      : null;
    setReadiness(assessmentResult);

    if (result.compiledScene) {
      setScene(result.compiledScene as Parameters<typeof setScene>[0]);
    }

    runNewPipeline(photos, widthInput, depthInput, heightInput, knownRefInput);
  }, [photos, widthInput, depthInput, heightInput, knownRefInput, recordEvent, setScene, updateMeasurements]);

  const acceptScene = useCallback(() => {
    if (session?.compiledScene) {
      setScene(session.compiledScene as Parameters<typeof setScene>[0]);
      recordEvent({
        kind: "scan_compiled",
        title: "Reconstruction accepted",
        details: "Guided capture reconstruction accepted and applied to workspace.",
        actor: "user",
        source: "scan",
        sceneId: "reconstruction",
        sceneName: `Reconstruction (${photos.length} photos)`,
        revisionDepth: 0,
        affectedNodeIds: [],
        confidence: session.overallConfidence ?? 0.5,
        beforeSummary: "Reconstruction accepted.",
        afterSummary: "Scene applied to workspace.",
        notes: [],
      });
    }
    onClose?.();
  }, [session, setScene, onClose, recordEvent, photos.length]);

  const resetCapture = useCallback(() => {
    setStep("capture");
    setSession(null);
    setStageProgress({} as Record<ReconstructionStage, StageResult["status"]>);
    setPipelineRunning(false);
  }, []);

  const stageOrder: ReconstructionStage[] = ["capture", "depth_estimation", "segmentation", "correspondence", "structural_extraction", "scale_anchoring", "quality_gate", "compile"];

  const stageLabel = stageOrder.find((s) => stageProgress[s] === "running") ?? null;
  const completedStageCount = Object.values(stageProgress).filter((s) => s === "completed" || s === "skipped").length;

  // readiness is computed inside runPipeline after the session completes

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/12 text-emerald-200">
              <ScanSearch className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--text-dim)]">Guided Capture Assistant</div>
              <div className="text-xs text-[color:var(--text-muted)]">Structured capture with depth, segmentation, and reconstruction pipeline</div>
            </div>
          </div>
          {onClose ? (
            <button type="button" onClick={onClose} className="rounded-lg border border-[#2a3347] bg-[#101827] px-3 py-1.5 text-xs text-[#9bb0cf] hover:bg-[#1a2333]">
              Close
            </button>
          ) : null}
        </div>

        {/* Progress bar */}
        {step !== "prep" && step !== "capture" ? (
          <div className="mt-4 flex items-center gap-1">
            {stageOrder.map((s, i) => {
              const status = stageProgress[s];
              const isActive = status === "running";
              const isDone = status === "completed" || status === "skipped";
              const isFailed = status === "failed" || status === "fallback";
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      isFailed ? "bg-red-500/40" : isDone ? "bg-emerald-500/40" : isActive ? "bg-sky-500/60" : "bg-[#1f2637]"
                    }`}
                  />
                  {i < stageOrder.length - 1 ? (
                    <div className={`h-0.5 flex-1 ${isDone ? "bg-emerald-500/30" : "bg-[#1f2637]"}`} />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Step: Capture Prep */}
        {step === "prep" ? (
          <div className="mt-8">
            <div className="rounded-2xl border border-sky-400/15 bg-sky-500/8 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Camera className="h-4 w-4 text-sky-300" />
                Capture Preparation
              </div>
              <div className="mt-2 text-xs text-[color:var(--text-muted)]">
                The guided assistant uses photos of your site to reconstruct a SecurityScene.
                For best results, capture the entire perimeter with overlapping photos.
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {CAPTURE_COACHING_TIPS.map((tip, i) => (
                <div key={i} className="rounded-xl border border-[#1f2637] bg-[#0e1726] p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/12 text-[10px] font-bold text-emerald-200">
                      {i + 1}
                    </span>
                    <span className="text-xs font-semibold text-white">{tip.tip}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-[color:var(--text-muted)]">{tip.detail}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-[#1f2637] bg-[#0e1726] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Room Dimensions (Optional)</div>
              <div className="mt-2 text-[10px] text-[color:var(--text-muted)]">Providing known dimensions improves scale accuracy.</div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[color:var(--text-muted)]">Width (m)</label>
                  <input
                    value={widthInput}
                    onChange={(event) => setWidthInput(event.target.value)}
                    placeholder="e.g. 10"
                    className="mt-1 w-full rounded-lg border border-[#2a3347] bg-[#101827] px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[color:var(--text-muted)]">Depth (m)</label>
                  <input
                    value={depthInput}
                    onChange={(event) => setDepthInput(event.target.value)}
                    placeholder="e.g. 8"
                    className="mt-1 w-full rounded-lg border border-[#2a3347] bg-[#101827] px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[color:var(--text-muted)]">Height (m)</label>
                  <input
                    value={heightInput}
                    onChange={(event) => setHeightInput(event.target.value)}
                    placeholder="e.g. 3"
                    className="mt-1 w-full rounded-lg border border-[#2a3347] bg-[#101827] px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-[10px] text-[color:var(--text-muted)]">Known Reference (e.g. door width, counter length)</label>
                <input
                  value={knownRefInput}
                  onChange={(event) => setKnownRefInput(event.target.value)}
                  placeholder="e.g. door=2m"
                  className="mt-1 w-full rounded-lg border border-[#2a3347] bg-[#101827] px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              {onClose ? (
                <button type="button" onClick={onClose} className="rounded-lg border border-[#2a3347] px-4 py-2 text-xs text-[#9bb0cf]">
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setStep("capture")}
                className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30"
              >
                <Camera className="mr-1.5 inline h-3.5 w-3.5" />
                Start Capture
              </button>
            </div>
          </div>
        ) : null}

        {/* Step: Capture */}
        {step === "capture" ? (
          <div className="mt-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Camera className="h-4 w-4 text-emerald-300" />
                  Capture Photos ({photos.length})
                  {photos.length < 3 ? (
                    <span className="text-[10px] text-amber-300">At least 3 recommended</span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  Upload photos from your device. The pipeline uses them for reconstruction.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCoachingOpen(!coachingOpen)}
                className="rounded-lg border border-[#2a3347] px-2 py-1 text-[10px] text-[#9bb0cf]"
              >
                {coachingOpen ? "Hide Tips" : "Show Tips"}
              </button>
            </div>

            {coachingOpen ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {CAPTURE_COACHING_TIPS.map((tip, i) => (
                  <div key={i} className="rounded-xl border border-sky-400/10 bg-sky-500/6 px-2 py-2 text-[10px] text-[color:var(--text-muted)]">
                    <span className="font-semibold text-sky-200">{tip.tip}</span>
                    <span className="block mt-0.5">{tip.detail}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#2a3347] bg-[#0e1726]/60 px-6 py-8 text-[color:var(--text-muted)] hover:border-sky-400/30 hover:bg-[#0e1726]/80"
              >
                <ImageUp className="h-8 w-8 text-sky-300" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">Upload photos</div>
                  <div className="mt-0.5 text-xs">JPEG, PNG, WebP — minimum 3 recommended</div>
                </div>
              </button>
            </div>

            {photos.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-[#1f2637] bg-black/30">
                    {photo.dataUrl ? (
                      <img src={photo.dataUrl} alt={photo.fileName} className="h-20 w-full object-cover" />
                    ) : (
                      <div className="flex h-20 items-center justify-center text-[9px] text-[color:var(--text-muted)]">
                        Loading...
                      </div>
                    )}
                    <div className="truncate px-1.5 py-1 text-[8px] text-[color:var(--text-muted)]">{photo.fileName}</div>
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="absolute right-1 top-1 rounded-md bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <RotateCcw className="h-3 w-3 rotate-45 text-red-300" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setStep("prep")}
                className="flex items-center gap-1 text-xs text-[color:var(--text-muted)] hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to prep
              </button>
              <div className="flex gap-2">
                {photos.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotos([]);
                    }}
                    className="rounded-lg border border-[#2a3347] px-3 py-1.5 text-xs text-[#9bb0cf]"
                  >
                    Clear all
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={runPipeline}
                  disabled={photos.length === 0}
                  className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ScanSearch className="mr-1.5 inline h-3.5 w-3.5" />
                  Run Reconstruction ({photos.length} photos)
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Step: Processing */}
        {step === "process" ? (
          <div className="mt-8">
            <div className="flex items-center gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/8 px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
              <div>
                <div className="text-sm font-semibold text-white">
                  {stageLabel ? RECONSTRUCTION_STAGE_LABELS[stageLabel] : "Processing..."}
                </div>
                <div className="text-xs text-[color:var(--text-muted)]">
                  Stage {completedStageCount + 1} of {stageOrder.length}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {stageOrder.map((s) => {
                const status = stageProgress[s];
                const isActive = status === "running";
                const isDone = status === "completed" || status === "skipped";
                const isFailed = status === "failed" || status === "fallback";
                return (
                  <div key={s} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                    isActive ? "border-sky-400/25 bg-sky-500/8" : isDone ? "border-emerald-400/15 bg-emerald-500/6" : isFailed ? "border-red-400/15 bg-red-500/6" : "border-[#1f2637] bg-[#0e1726]/60"
                  }`}>
                    {isActive ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
                    ) : isDone ? (
                      <Check className="h-3.5 w-3.5 text-emerald-300" />
                    ) : isFailed ? (
                      <TriangleAlert className="h-3.5 w-3.5 text-red-300" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-[#2a3347]" />
                    )}
                    <span className={`text-xs ${isActive ? "text-white font-semibold" : "text-[color:var(--text-muted)]"}`}>
                      {RECONSTRUCTION_STAGE_LABELS[s]}
                    </span>
                    {status === "skipped" ? (
                      <span className="ml-auto text-[9px] text-[color:var(--text-dim)]">Skipped</span>
                    ) : status === "fallback" ? (
                      <span className="ml-auto text-[9px] text-amber-300">Fallback</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Step: Review Candidates */}
        {step === "review_candidates" && scanSession ? (
          <div className="mt-4 -mx-2" style={{ height: "calc(100vh - 280px)" }}>
            {reviewLoading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/8 px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                <div>
                  <div className="text-sm font-semibold text-white">Generating candidates...</div>
                  <div className="text-xs text-[color:var(--text-muted)]">Running object detection and depth estimation on {photos.length} photos.</div>
                </div>
              </div>
            ) : (
              <ReconstructionCandidatePanel
                session={scanSession}
                onSessionUpdate={setScanSession}
                onCompileToDraft={(draft) => {
                  handleCandidateCompile(draft);
                  setStep("result");
                }}
                onClose={() => setStep("result")}
                runLabel={`${photos.length} photos captured`}
              />
            )}
          </div>
        ) : null}

        {/* Step: Result */}
        {step === "result" ? (
          <div className="mt-8">
            {session?.overallConfidence != null && session.overallConfidence >= 0.6 ? (
              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/8 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                  <Check className="h-4 w-4 text-emerald-300" />
                  Reconstruction Complete
                </div>
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  Confidence: {Math.round(session.overallConfidence * 100)}% · {photos.length} photos · {completedStageCount}/{stageOrder.length} stages
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-400/15 bg-amber-500/8 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                  <TriangleAlert className="h-4 w-4 text-amber-300" />
                  Reconstruction Needs Review
                </div>
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  Confidence: {Math.round((session?.overallConfidence ?? 0) * 100)}% · Manual correction recommended before use.
                </div>
              </div>
            )}

            {readiness ? (
              <div className="mt-3 rounded-xl border border-[#1f2637] bg-[#0e1726] p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Scene Readiness</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`text-sm font-bold ${readiness.ready ? "text-emerald-300" : "text-amber-300"}`}>
                    {readiness.ready ? "Ready" : "Needs Work"}
                  </span>
                  <span className="text-xs text-[color:var(--text-muted)]">
                    Confidence: {Math.round(readiness.confidence * 100)}%
                  </span>
                </div>
                {readiness.gaps.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {readiness.gaps.map((gap, i) => (
                      <li key={i} className="flex items-start gap-2 text-[10px] text-amber-200">
                        <span className="mt-0.5 text-amber-400">•</span>
                        {gap}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {session && session.stageResults.filter((r) => r.status === "failed" || r.status === "fallback").length > 0 ? (
              <div className="mt-3 rounded-xl border border-red-400/15 bg-red-500/8 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-200">Pipeline Notes</div>
                {session!.stageResults.filter((r) => r.status === "failed" || r.status === "fallback").map((r) => (
                  <div key={r.stage} className="mt-1 text-[10px] text-[color:var(--text-muted)]">
                    {RECONSTRUCTION_STAGE_LABELS[r.stage]}: {r.error ?? r.status}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={resetCapture}
                className="flex items-center gap-1 text-xs text-[color:var(--text-muted)] hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retake photos
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetCapture}
                  className="rounded-lg border border-[#2a3347] px-4 py-2 text-xs text-[#9bb0cf]"
                >
                  Re-run Pipeline
                </button>
                <button
                  type="button"
                  onClick={acceptScene}
                  className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30"
                >
                  <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5" />
                  Accept Scene
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
