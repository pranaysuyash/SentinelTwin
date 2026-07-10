"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Check,
  X,
  Eye,
  EyeOff,
  Shield,
  Camera,
  DoorOpen,
  Lightbulb,
  Square,
  Target,
  ArrowRight,
  TriangleAlert,
  ScanSearch,
} from "lucide-react";
import type { ScanCandidate, ScanCaptureSession, ScanCandidateWarning } from "@/lib/scan-artifacts";
import { updateCandidateInSession } from "@/lib/scan-artifacts";
import { captureModeLabel } from "@/lib/scan-artifacts";
import { compileReconstructionToSiteTwinDraft, estimateOverallConfidence } from "@/lib/scan-reconstruction";
import type { SiteTwinDraft } from "@/lib/site-compiler";
import { SurfaceButton } from "@/components/shared/SurfaceButton";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

type Props = {
  session: ScanCaptureSession;
  onSessionUpdate: (session: ScanCaptureSession) => void;
  onCompileToDraft: (draft: SiteTwinDraft) => void;
  onClose?: () => void;
  runLabel?: string;
};

const KIND_ICONS: Record<string, React.ReactNode> = {
  camera: <Camera className="h-3.5 w-3.5" />,
  door: <DoorOpen className="h-3.5 w-3.5" />,
  window: <DoorOpen className="h-3.5 w-3.5" />,
  light: <Lightbulb className="h-3.5 w-3.5" />,
  counter: <Square className="h-3.5 w-3.5" />,
  cupboard: <Square className="h-3.5 w-3.5" />,
  shelf: <Square className="h-3.5 w-3.5" />,
  obstruction: <Square className="h-3.5 w-3.5" />,
  pillar: <Square className="h-3.5 w-3.5" />,
  entry_point: <DoorOpen className="h-3.5 w-3.5" />,
  critical_zone: <Target className="h-3.5 w-3.5" />,
  wall: <Shield className="h-3.5 w-3.5" />,
  path_point: <ArrowRight className="h-3.5 w-3.5" />,
};

const KIND_COLORS: Record<string, string> = {
  camera: "text-sky-300 bg-sky-500/12 border-sky-500/20",
  door: "text-amber-300 bg-amber-500/12 border-amber-500/20",
  window: "text-amber-300 bg-amber-500/12 border-amber-500/20",
  light: "text-yellow-300 bg-yellow-500/12 border-yellow-500/20",
  counter: "text-emerald-300 bg-emerald-500/12 border-emerald-500/20",
  cupboard: "text-emerald-300 bg-emerald-500/12 border-emerald-500/20",
  shelf: "text-emerald-300 bg-emerald-500/12 border-emerald-500/20",
  obstruction: "text-orange-300 bg-orange-500/12 border-orange-500/20",
  pillar: "text-orange-300 bg-orange-500/12 border-orange-500/20",
  entry_point: "text-amber-300 bg-amber-500/12 border-amber-500/20",
  critical_zone: "text-red-300 bg-red-500/12 border-red-500/20",
  wall: "text-indigo-300 bg-indigo-500/12 border-indigo-500/20",
  path_point: "text-purple-300 bg-purple-500/12 border-purple-500/20",
};

const SEVERITY_BADGES: Record<ScanCandidateWarning["severity"], { label: string; className: string }> = {
  info: { label: "i", className: "text-sky-300 bg-sky-500/12" },
  warning: { label: "!", className: "text-amber-300 bg-amber-500/12" },
  blocking: { label: "!!", className: "text-red-300 bg-red-500/12" },
};

function sourceLabel(source: ScanCandidate["source"]): string {
  switch (source) {
    case "model_detection": return "AI";
    case "segmentation": return "Seg";
    case "structural_extraction": return "Struct";
    case "manual": return "Manual";
  }
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-emerald-300";
  if (confidence >= 0.5) return "text-amber-300";
  return "text-red-300";
}

function CandidateCard({
  candidate,
  onAccept,
  onReject,
  onEdit,
}: {
  candidate: ScanCandidate;
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
}) {
  const isAccepted = candidate.status === "accepted" || candidate.status === "edited";
  const isRejected = candidate.status === "rejected";
  const isPending = !isAccepted && !isRejected;

  return (
    <div
      className={`rounded-xl border p-3 transition-[border-color,opacity] ${
        isAccepted
          ? "border-emerald-500/25 bg-emerald-500/6"
          : isRejected
            ? "border-red-500/15 bg-red-500/4 opacity-50"
            : "${UI_SURFACES.borderSubtle} ${UI_SURFACES.hoverBgDark} hover:${UI_SURFACES.borderDark}"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${KIND_COLORS[candidate.kind] ?? "text-gray-300 bg-gray-500/12 border-gray-500/20"}`}>
            {KIND_ICONS[candidate.kind] ?? <Square className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate">
                {candidate.label || candidate.kind.replace(/_/g, " ")}
              </span>
              <span className={`text-[10px] font-medium ${confidenceColor(candidate.confidence)}`}>
                {Math.round(candidate.confidence * 100)}%
              </span>
              <span className={`rounded ${UI_SURFACES.borderSubtle} px-1 py-[1px] text-[9px] font-medium uppercase tracking-wide text-[color:var(--text-dim)]`}>
                {sourceLabel(candidate.source)}
              </span>
            </div>
            <div className="mt-0.5 text-[10px] text-[color:var(--text-muted)]">
              {candidate.estimatedPosition
                ? `pos: [${candidate.estimatedPosition.map((v) => v.toFixed(1)).join(", ")}]`
                : `img: [${candidate.imagePoint[0].toFixed(2)}, ${candidate.imagePoint[1].toFixed(2)}]`}
              {candidate.estimatedDimensions
                ? ` dim: [${candidate.estimatedDimensions.map((v) => v.toFixed(1)).join("×")}]`
                : ""}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isPending ? (
            <>
              <button
                type="button"
                onClick={onAccept}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/25"
                title="Accept candidate"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={onReject}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/12 text-red-300 hover:bg-red-500/25"
                title="Reject candidate"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : isAccepted ? (
            <button
              type="button"
              onClick={onReject}
              className="flex h-6 items-center gap-1 rounded-md bg-red-500/8 px-2 text-[10px] text-red-300 hover:bg-red-500/20"
            >
              <X className="h-3 w-3" /> Reject
            </button>
          ) : (
            <button
              type="button"
              onClick={onAccept}
              className="flex h-6 items-center gap-1 rounded-md bg-emerald-500/8 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/20"
            >
              <Check className="h-3 w-3" /> Restore
            </button>
          )}
        </div>
      </div>

      {candidate.warnings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {candidate.warnings.map((w) => (
            <span
              key={w.code}
              className={`flex items-center gap-1 rounded px-1.5 py-[1px] text-[9px] font-medium ${SEVERITY_BADGES[w.severity].className}`}
              title={w.message}
            >
              {SEVERITY_BADGES[w.severity].label} {w.message}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const CANDIDATE_GROUP_ORDER: string[] = [
  "camera",
  "critical_zone",
  "entry_point",
  "door",
  "window",
  "light",
  "counter",
  "cupboard",
  "shelf",
  "obstruction",
  "pillar",
  "wall",
  "path_point",
];

function sortCandidates(candidates: ScanCandidate[]): ScanCandidate[] {
  const order = new Map(CANDIDATE_GROUP_ORDER.map((k, i) => [k, i]));
  return [...candidates].sort(
    (a, b) => (order.get(a.kind) ?? 99) - (order.get(b.kind) ?? 99),
  );
}

export function ReconstructionCandidatePanel({
  session,
  onSessionUpdate,
  onCompileToDraft,
  onClose,
  runLabel,
}: Props) {
  const [compiling, setCompiling] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  const visibleCandidates = useMemo(
    () => sortCandidates(
      session.candidates.filter((c) => showRejected || c.status !== "rejected"),
    ),
    [session.candidates, showRejected],
  );

  const pendingCount = useMemo(
    () => session.candidates.filter((c) => c.status === "pending").length,
    [session.candidates],
  );

  const acceptedCount = useMemo(
    () => session.candidates.filter((c) => c.status === "accepted" || c.status === "edited").length,
    [session.candidates],
  );

  const rejectedCount = useMemo(
    () => session.candidates.filter((c) => c.status === "rejected").length,
    [session.candidates],
  );

  const handleAccept = useCallback(
    (candidateId: string) => {
      onSessionUpdate(updateCandidateInSession(session, candidateId, { status: "accepted" }));
    },
    [session, onSessionUpdate],
  );

  const handleReject = useCallback(
    (candidateId: string) => {
      onSessionUpdate(updateCandidateInSession(session, candidateId, { status: "rejected" }));
    },
    [session, onSessionUpdate],
  );

  const handleAcceptAll = useCallback(() => {
    let updated = session;
    for (const c of session.candidates.filter((c) => c.status === "pending")) {
      updated = updateCandidateInSession(updated, c.id, { status: "accepted" });
    }
    onSessionUpdate(updated);
  }, [session, onSessionUpdate]);

  const handleRejectAllPending = useCallback(() => {
    let updated = session;
    for (const c of session.candidates.filter((c) => c.status === "pending")) {
      updated = updateCandidateInSession(updated, c.id, { status: "rejected" });
    }
    onSessionUpdate(updated);
  }, [session, onSessionUpdate]);

  const handleCompile = useCallback(() => {
    setCompiling(true);
    try {
      const draft = compileReconstructionToSiteTwinDraft(session);
      onCompileToDraft(draft);
    } finally {
      setCompiling(false);
    }
  }, [session, onCompileToDraft]);

  const overallConfidence = useMemo(() => estimateOverallConfidence(session), [session]);
  const canCompile = acceptedCount > 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
              <ScanSearch className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Reconstruction Candidates</div>
              <div className="text-[10px] text-[color:var(--text-muted)]">
                {captureModeLabel(session.captureMode)} &middot; {session.photos.length} photo{session.photos.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg border ${UI_SURFACES.borderDark} ${UI_SURFACES.card} px-2.5 py-1 text-[11px] ${UI_SURFACES.textMuted4} ${UI_SURFACES.hoverBg}`}
            >
              Close
            </button>
          ) : null}
        </div>

        {/* Summary bar */}
        <div className={`flex items-center gap-3 rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.hoverBgDark} px-3 py-2`}>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-emerald-300 font-medium">{acceptedCount}</span>
            <span className="text-[color:var(--text-muted)]">accepted</span>
          </div>
          <div className={`h-4 w-px ${UI_SURFACES.borderSubtle}`} />
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-amber-300 font-medium">{pendingCount}</span>
            <span className="text-[color:var(--text-muted)]">pending</span>
          </div>
          <div className={`h-4 w-px ${UI_SURFACES.borderSubtle}`} />
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-red-300 font-medium">{rejectedCount}</span>
            <span className="text-[color:var(--text-muted)]">rejected</span>
          </div>
          <div className={`h-4 w-px ${UI_SURFACES.borderSubtle}`} />
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className={`font-medium ${confidenceColor(overallConfidence)}`}>
              {Math.round(overallConfidence * 100)}%
            </span>
            <span className="text-[color:var(--text-muted)]">confidence</span>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => setShowRejected((v) => !v)}
              className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] transition-colors ${
                showRejected ? "${UI_SURFACES.borderSubtle} text-[color:var(--text-muted)]" : "text-[color:var(--text-dim)] hover:text-[color:var(--text-muted)]"
              }`}
            >
              {showRejected ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showRejected ? "Hide rejected" : `${rejectedCount} rejected`}
            </button>
          </div>
        </div>

        {/* Batch actions */}
        {pendingCount > 0 ? (
          <div className="flex items-center gap-2">
            <SurfaceButton
              onClick={handleAcceptAll}
              disabled={pendingCount === 0}
              className="h-7 gap-1 rounded-md border-emerald-500/30 bg-emerald-500/12 px-2 py-1 text-[10px] text-emerald-100 hover:border-emerald-400/40 hover:bg-emerald-500/18"
            >
              <Check className="h-3 w-3" />
              Accept All ({pendingCount})
            </SurfaceButton>
            <SurfaceButton
              onClick={handleRejectAllPending}
              disabled={pendingCount === 0}
              className="h-7 gap-1 rounded-md border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-100 hover:border-amber-400/40 hover:bg-amber-500/16"
            >
              <X className="h-3 w-3" />
              Reject All ({pendingCount})
            </SurfaceButton>
          </div>
        ) : null}

        {/* Candidates grouped by kind */}
        {visibleCandidates.length === 0 ? (
          <div className={`flex flex-col items-center gap-2 rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.hoverBgDark} p-6`}>
            <TriangleAlert className="h-6 w-6 text-amber-400" />
            <div className="text-xs text-[color:var(--text-muted)]">
              {session.candidates.length === 0
                ? "No candidates available. Run object detection to generate candidates."
                : "All candidates have been reviewed."}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onAccept={() => handleAccept(candidate.id)}
                onReject={() => handleReject(candidate.id)}
                onEdit={() => {}}
              />
            ))}
          </div>
        )}

        {/* Session warnings */}
        {session.warnings.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-dim)]">
              Session Warnings
            </div>
            {session.warnings.map((w) => (
              <div
                key={w.code}
                className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] ${
                  w.severity === "blocking"
                    ? "border-red-500/15 bg-red-500/6 text-red-200"
                    : w.severity === "warning"
                      ? "border-amber-500/15 bg-amber-500/6 text-amber-200"
                      : "border-sky-500/15 bg-sky-500/6 text-sky-200"
                }`}
              >
                <TriangleAlert className="mt-[1px] h-3 w-3 shrink-0" />
                <div>
                  {w.message}
                  {w.suggestedAction ? (
                    <span className="block mt-0.5 text-[9px] opacity-70">
                      Suggestion: {w.suggestedAction}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Compile footer */}
      <div className={`mt-auto border-t ${UI_SURFACES.borderSubtle} ${UI_SURFACES.bgDeep} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-[color:var(--text-muted)]">
            {runLabel ? (
              <span>{runLabel}</span>
            ) : (
              <span>
                {acceptedCount} accepted candidate{acceptedCount !== 1 ? "s" : ""} will be compiled into a SiteTwinDraft.
              </span>
            )}
          </div>
          <SurfaceButton
            onClick={handleCompile}
            disabled={!canCompile || compiling}
            className="h-7 rounded-md border-sky-500/30 bg-sky-500/12 px-2.5 py-1 text-[10px] text-sky-100 hover:border-sky-400/40 hover:bg-sky-500/18"
          >
            {compiling ? "Compiling..." : `Compile to Draft (${acceptedCount})`}
          </SurfaceButton>
        </div>
      </div>
    </div>
  );
}
