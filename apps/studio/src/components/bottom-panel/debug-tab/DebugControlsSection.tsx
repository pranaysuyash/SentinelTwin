"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";
import type { OperationalEvidenceArchive } from "@/lib/operational-evidence-archive";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";
import type { OverlayDensity } from "@/store/slices/core/layout-slice";
import { OVERLAY_DENSITY_OPTIONS, Section, PillButton } from "./shared";

export interface DebugControlsSectionProps {
  showDebugOverlays: boolean;
  setShowDebugOverlays: (v: boolean) => void;
  autoRecompute: boolean;
  toggleAutoRecompute: () => void;
  overlayDensity: OverlayDensity;
  setOverlayDensity: (density: OverlayDensity) => void;
  archiveRestoreBranch: "draft" | "recovered" | "published";
  setArchiveRestoreBranch: (v: "draft" | "recovered" | "published") => void;
  downloadDiagnosticBundle: () => void;
  downloadRuntimeTruthBundle: () => void;
  downloadSupportBundle: () => void;
  downloadIncidentBundle: () => void;
  downloadReportEvidenceBundle: () => void;
  downloadOperationalEvidenceArchive: () => void;
  shareArchiveHandoffLink: () => void;
  copyArchiveHandoffLink: () => void;
  openArchiveHandoffLink: () => void;
  applyPendingArchive: () => void;
  clearPendingArchive: () => void;
  restoreLatestArchiveCheckpoint: () => void;
  publishCurrentScene: () => void;
  runTrustAudit: () => void;
  trustAuditLoading: boolean;
  runModelEval: () => void;
  modelEvalLoading: boolean;
  clearModelEvalHistory: () => void;
  captureExternalLog: () => void;
  clearExternalLogEntries: () => void;
  sendSupportBundleToIngest: () => void;
  supportIngestLoading: boolean;
  handleArchiveFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  pendingArchive: OperationalEvidenceArchive | null;
  pendingArchiveComparison: { readiness: { status: string; recommendation: string } | null } | null;
  pendingArchiveError: string | null;
  pendingArchiveActionLabel: string;
}

export function DebugControlsSection({
  showDebugOverlays,
  setShowDebugOverlays,
  autoRecompute,
  toggleAutoRecompute,
  overlayDensity,
  setOverlayDensity,
  archiveRestoreBranch,
  setArchiveRestoreBranch,
  downloadDiagnosticBundle,
  downloadRuntimeTruthBundle,
  downloadSupportBundle,
  downloadIncidentBundle,
  downloadReportEvidenceBundle,
  downloadOperationalEvidenceArchive,
  shareArchiveHandoffLink,
  copyArchiveHandoffLink,
  openArchiveHandoffLink,
  applyPendingArchive,
  clearPendingArchive,
  restoreLatestArchiveCheckpoint,
  publishCurrentScene,
  runTrustAudit,
  trustAuditLoading,
  runModelEval,
  modelEvalLoading,
  clearModelEvalHistory,
  captureExternalLog,
  clearExternalLogEntries,
  sendSupportBundleToIngest,
  supportIngestLoading,
  handleArchiveFileChange,
  pendingArchive,
  pendingArchiveComparison,
  pendingArchiveError,
  pendingArchiveActionLabel,
}: DebugControlsSectionProps) {
  const archiveInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Section title="Debug Controls" icon={<Sparkles className="h-3 w-3 text-emerald-400" />}>
      <div className="flex flex-wrap gap-1.5">
        <PillButton active={showDebugOverlays} onClick={() => setShowDebugOverlays(!showDebugOverlays)}>
          Debug Overlays {showDebugOverlays ? "On" : "Off"}
        </PillButton>
        <PillButton active={autoRecompute} onClick={toggleAutoRecompute}>
          Auto Recompute {autoRecompute ? "On" : "Off"}
        </PillButton>
        <PillButton active={false} onClick={downloadDiagnosticBundle}>
          Download Bundle
        </PillButton>
        <PillButton active={false} onClick={downloadRuntimeTruthBundle}>
          Download Runtime Truth
        </PillButton>
        <PillButton active={false} onClick={downloadIncidentBundle}>
          Download Incident Bundle
        </PillButton>
        <PillButton active={false} onClick={downloadSupportBundle}>
          Download Support Bundle
        </PillButton>
        <PillButton active={false} onClick={downloadReportEvidenceBundle}>
          Download Evidence Bundle
        </PillButton>
        <PillButton active={false} onClick={downloadOperationalEvidenceArchive}>
          Download Archive
        </PillButton>
        <PillButton active={false} onClick={shareArchiveHandoffLink}>
          Share Archive
        </PillButton>
        <PillButton active={false} onClick={copyArchiveHandoffLink}>
          Copy Archive Link
        </PillButton>
        <PillButton active={false} onClick={openArchiveHandoffLink}>
          Open Archive Link
        </PillButton>
        <PillButton active={false} onClick={() => archiveInputRef.current?.click()}>
          Restore Archive
        </PillButton>
        <PillButton active={false} onClick={applyPendingArchive}>
          Apply Archive
        </PillButton>
        <PillButton active={false} onClick={runTrustAudit}>
          {trustAuditLoading ? "Running Audit..." : "Run Trust Audit"}
        </PillButton>
        <PillButton active={false} onClick={runModelEval}>
          {modelEvalLoading ? "Running Eval..." : "Run Eval Suite"}
        </PillButton>
        <PillButton active={false} onClick={clearModelEvalHistory}>
          Clear Eval History
        </PillButton>
        <PillButton active={false} onClick={captureExternalLog}>
          Capture External Log
        </PillButton>
        <PillButton active={false} onClick={clearExternalLogEntries}>
          Clear External Logs
        </PillButton>
        <PillButton active={false} onClick={sendSupportBundleToIngest}>
          {supportIngestLoading ? "Sending Ingest..." : "Send to Ingest"}
        </PillButton>
        <PillButton active={false} onClick={restoreLatestArchiveCheckpoint}>
          Restore Latest Checkpoint
        </PillButton>
        <PillButton active={false} onClick={() => publishCurrentScene()}>
          Publish Scene
        </PillButton>
      </div>
      <input
        ref={archiveInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleArchiveFileChange}
      />
      {pendingArchive ? (
        <div className={`{mt-2 rounded-md border UI_SURFACES.borderPanel UI_SURFACES.bgDeep px-3 py-2}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className={`text-[9px] font-semibold uppercase tracking-[0.14em] UI_SURFACES.textMuted7`}>Archive Merge Preflight</div>
              <div className={`mt-1 text-[10px] UI_SURFACES.textSoftDim`}>
                {pendingArchive.scene.name || "Untitled Scene"} · {pendingArchive.scene.source} · exported {pendingArchive.exportedAt}
              </div>
            </div>
            <div className={`text-[10px] UI_SURFACES.textBody2`}>
              {pendingArchiveComparison?.readiness?.status ?? "pending"}
            </div>
          </div>
          {pendingArchiveComparison?.readiness ? (
            <>
              <div className={`{mt-2 rounded-md border UI_SURFACES.borderPanel UI_SURFACES.panel px-3 py-2 text-[10px] UI_SURFACES.textBody2}`}>
                {pendingArchiveComparison.readiness.recommendation}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <PillButton active={false} onClick={applyPendingArchive}>
                  {pendingArchiveComparison.readiness.status === "unrelated" || pendingArchiveComparison.readiness.status === "fast_forward_right"
                    ? "Archive Blocked"
                    : pendingArchiveActionLabel}
                </PillButton>
                <PillButton active={false} onClick={clearPendingArchive}>
                  Clear Archive
                </PillButton>
              </div>
            </>
          ) : null}
          {pendingArchiveError ? (
            <div className="mt-2 text-[10px] text-rose-300">{pendingArchiveError}</div>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2">
        <div className={`mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textDimMid`}>Overlay Density</div>
        <div className="flex gap-1">
          {OVERLAY_DENSITY_OPTIONS.map((option) => (
            <PillButton
              key={option.value}
              active={overlayDensity === option.value}
              onClick={() => setOverlayDensity(option.value)}
            >
              {option.label}
            </PillButton>
          ))}
        </div>
      </div>

      <div className="mt-2">
        <div className={`mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textDimMid`}>Archive Branch</div>
        <div className="flex gap-1">
          {(["draft", "recovered", "published"] as const).map((branch) => (
            <PillButton
              key={branch}
              active={archiveRestoreBranch === branch}
              onClick={() => setArchiveRestoreBranch(branch)}
            >
              {branch}
            </PillButton>
          ))}
        </div>
      </div>
    </Section>
  );
}
