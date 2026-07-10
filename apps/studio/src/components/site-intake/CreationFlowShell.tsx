"use client";

import React from "react";
import {
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  TriangleAlert,
  XCircle,
  Info,
  ScanSearch,
  Sparkles,
  Image as ImageIcon,
  FileUp,
  Square,
  Camera,
  Check,
  Layers,
} from "lucide-react";
import type {
  SiteIntakeSession,
  SiteTwinDraft,
  SiteIntakeSource,
  SiteIntakeStage,
  ActionableWarning,
} from "@/lib/site-compiler";
import { SITE_SOURCE_MATURITY } from "@/lib/site-compiler";
import type { SiteDraftApprovalResult } from "@/lib/site-draft-approval";
import { renderConfidence, CONFIDENCE_BAND_LABEL } from "@/lib/confidence-display";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export type CreationFlowStepIndex = 0 | 1 | 2 | 3;

export interface CreationFlowStep {
  id: string;
  label: string;
  description: string;
}

export const CREATION_FLOW_STEPS: readonly CreationFlowStep[] = [
  { id: "source", label: "1. Choose Source", description: "Select ingestion path" },
  { id: "capture", label: "2. Capture & Build", description: "Photo scan, AI, or import" },
  { id: "review", label: "3. Review Draft", description: "Verify entities & warnings" },
  { id: "activate", label: "4. Activate & Handoff", description: "Promote to canonical scene" },
] as const;

const SOURCE_ICONS: Record<SiteIntakeSource, React.ReactNode> = {
  scan: <ScanSearch className="h-3.5 w-3.5" />,
  ai_prompt: <Sparkles className="h-3.5 w-3.5" />,
  floor_plan: <ImageIcon className="h-3.5 w-3.5" />,
  json: <FileUp className="h-3.5 w-3.5" />,
  manual: <Square className="h-3.5 w-3.5" />,
  camera_evidence: <Camera className="h-3.5 w-3.5" />,
};

export interface CreationFlowShellProps {
  /** Explicit step index (0..3) or derived from activeStage. */
  stepIndex?: CreationFlowStepIndex;
  /** Canonical stage from SiteIntakeSession. */
  activeStage?: SiteIntakeStage;
  /** Active intake source if selected. */
  source?: SiteIntakeSource;
  /** Active intake session if one exists. */
  session?: SiteIntakeSession | null;
  /** Compiled site twin draft if generated. */
  draft?: SiteTwinDraft | null;
  /** Approval result if approval/activation was attempted or completed. */
  approvalResult?: SiteDraftApprovalResult | null;
  /** Title of the current flow or shell. Defaults to "Site Intake & Twin Creation". */
  title?: string;
  /** Subtitle or instructions for the current step. */
  subtitle?: string;
  /** Callback when user clicks exit / return to studio or dashboard. */
  onExit?: () => void;
  /** Optional callback when user clicks back to previous step. */
  onBack?: () => void;
  /** Main content slot for the step (e.g. source selector cards, review panel, wizard). */
  children: React.ReactNode;
  /** Optional custom header actions or right-side slot. */
  headerActions?: React.ReactNode;
  /** Optional bottom footer or status bar slot. */
  footer?: React.ReactNode;
}

/**
 * Derives the 0..3 step index from the canonical SiteIntakeStage if stepIndex is not explicitly passed.
 */
export function deriveCreationFlowStepIndex(stage?: SiteIntakeStage, draft?: SiteTwinDraft | null, approvalResult?: SiteDraftApprovalResult | null): CreationFlowStepIndex {
  if (approvalResult?.success) return 3;
  if (!stage) return draft ? 2 : 0;
  switch (stage) {
    case "choose_source":
      return 0;
    case "capture_or_upload":
    case "mark_or_generate":
      return 1;
    case "review":
    case "compile":
    case "validated":
      return 2;
    case "handoff":
    case "activated":
      return 3;
    default:
      return 0;
  }
}

/**
 * CreationFlowShell — Canonical motto_v3 aligned container for Site Twin creation.
 *
 * Implements the canonical intake state contract:
 *   IntakeSession -> SiteTwinDraft -> SiteDraftApprovalResult -> active scene
 *
 * Provides standardized header rhythm, 4-stage lifecycle stepper, integrated provenance
 * and confidence banner, and responsive content formatting across Studio creation flows.
 */
export function CreationFlowShell({
  stepIndex,
  activeStage,
  source,
  session,
  draft,
  approvalResult,
  title = "Site Intake & Twin Creation",
  subtitle,
  onExit,
  onBack,
  children,
  headerActions,
  footer,
}: CreationFlowShellProps) {
  const currentStep = stepIndex ?? deriveCreationFlowStepIndex(activeStage, draft, approvalResult);
  const activeSource = source ?? session?.source ?? draft?.source;
  const activeDraft = draft ?? session?.draft;

  // Derive confidence rendering if draft is present
  const confidenceData = activeDraft
    ? renderConfidence({
        confidence: activeDraft.confidence,
        unresolvedWarningCount: activeDraft.warnings?.length ?? 0,
        sourceDetail: `${activeDraft.source} source`,
      })
    : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#050a12] text-white">
      {/* ── Top bar & Stepper ──────────────────────────────────────────────── */}
      <header className={`flex flex-none flex-col border-b ${UI_SURFACES.borderFaint} bg-[#080e18]`}>
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 ring-1 ring-sky-500/20">
              <ShieldCheck className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold tracking-wide text-white">SentinelTwin</span>
                <span className="rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">
                  Site Creation Shell
                </span>
                {activeSource && (
                  <span className={`inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium ${UI_SURFACES.textBody}`}>
                    {SOURCE_ICONS[activeSource]}
                    <span>{SITE_SOURCE_MATURITY[activeSource]?.label ?? activeSource}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onBack && currentStep > 0 && (
              <button
                type="button"
                onClick={onBack}
                className={`rounded-lg border ${UI_SURFACES.borderFaint} bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorder} hover:text-white`}
              >
                ← Back
              </button>
            )}
            {headerActions}
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className={`flex items-center gap-2 rounded-lg border ${UI_SURFACES.borderFaint} bg-[#0d1624] px-3.5 py-1.5 text-[12px] font-medium ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorder} hover:text-white`}
              >
                <span>Return to Studio</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stepper bar */}
        <div className="flex items-center justify-between border-t border-[#141a28] bg-[#060c14] px-6 py-2.5">
          <div className="flex items-center gap-2 text-[12px]">
            {CREATION_FLOW_STEPS.map((step, idx) => {
              const isComplete = idx < currentStep;
              const isActive = idx === currentStep;
              return (
                <React.Fragment key={step.id}>
                  <div
                    className={[
                      "flex items-center gap-2 rounded-full px-3 py-1 transition-all",
                      isActive
                        ? "border border-sky-500/30 bg-sky-500/15 font-medium text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.15)]"
                        : isComplete
                          ? "bg-emerald-500/10 font-medium text-emerald-400"
                          : "${UI_SURFACES.textMuted}",
                    ].join(" ")}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
                      {isComplete ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <span className={isActive ? "text-sky-300 font-bold" : "${UI_SURFACES.textMuted}"}>{idx + 1}</span>
                      )}
                    </span>
                    <span>{step.label.replace(/^\d+\.\s*/, "")}</span>
                  </div>
                  {idx < CREATION_FLOW_STEPS.length - 1 && (
                    <div className={[
                      "h-px w-6 transition-colors",
                      idx < currentStep ? "bg-emerald-500/40" : "${UI_SURFACES.borderFaint}",
                    ].join(" ")} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="text-[11px] text-[#6b7a99]">
            {CREATION_FLOW_STEPS[currentStep]?.description}
          </div>
        </div>
      </header>

      {/* ── Canonical Intake & Provenance Banner ───────────────────────────── */}
      {(activeDraft || approvalResult) && (
        <div className={`border-b ${UI_SURFACES.borderFaint} bg-[#08111e]/80 px-6 py-3 backdrop-blur-md`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-[12px]">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-sky-400" />
                <span className="font-semibold text-white">
                  {activeDraft?.scene.name || "Untitled Site Twin"}
                </span>
                <span className={`${UI_SURFACES.textMuted}`}>({activeDraft?.id ?? session?.id})</span>
              </div>

              <span className="text-[#2a3040]">·</span>

              {/* Confidence badge */}
              {confidenceData && (
                <div className="flex items-center gap-1.5">
                  <span className={`${UI_SURFACES.textMuted3}`}>Confidence:</span>
                  <span className={[
                    "font-semibold",
                    confidenceData.band === "high"
                      ? "text-emerald-400"
                      : confidenceData.band === "medium"
                        ? "text-amber-400"
                        : "text-rose-400",
                  ].join(" ")}>
                    {Math.round((activeDraft?.confidence ?? 0) * 100)}% ({CONFIDENCE_BAND_LABEL[confidenceData.band]})
                  </span>
                </div>
              )}

              {/* Entity counts summary */}
              {activeDraft && (
                <>
                  <span className="text-[#2a3040]">·</span>
                  <div className={`flex items-center gap-2 ${UI_SURFACES.textMuted3}`}>
                    <span><strong className="text-white">{activeDraft.entityCounts.walls}</strong> walls</span>
                    <span><strong className="text-white">{activeDraft.entityCounts.cameras}</strong> cameras</span>
                    <span><strong className="text-white">{activeDraft.entityCounts.criticalZones}</strong> zones</span>
                  </div>
                </>
              )}
            </div>

            {/* Readiness status / Warnings */}
            <div className="flex items-center gap-3 text-[12px]">
              {activeDraft && (
                <div className="flex items-center gap-2">
                  <span className={`${UI_SURFACES.textMuted3}`}>Readiness:</span>
                  <span className={[
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                    activeDraft.readiness.level === "deploy-ready"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : activeDraft.readiness.level === "review-required"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-300",
                  ].join(" ")}>
                    {activeDraft.readiness.level.replace("-", " ")}
                  </span>
                </div>
              )}

              {activeDraft && activeDraft.warnings.length > 0 && (
                <div className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-amber-300">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  <span>{activeDraft.warnings.length} warning{activeDraft.warnings.length !== 1 ? "s" : ""}</span>
                </div>
              )}

              {approvalResult && (
                <div className={[
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 font-medium",
                  approvalResult.success
                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/15 text-rose-300",
                ].join(" ")}>
                  {approvalResult.success ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Approved &amp; Activated</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-rose-400" />
                      <span>Approval Blocked: {approvalResult.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {subtitle && !activeDraft && (
          <div className={`border-b ${UI_SURFACES.borderFaint} bg-[#070d16] px-8 py-3 text-[13px] ${UI_SURFACES.textSoftBright}`}>
            {subtitle}
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {children}
        </div>
      </main>

      {/* ── Optional Footer ────────────────────────────────────────────────── */}
      {footer && (
        <footer className={`flex-none border-t ${UI_SURFACES.borderFaint} bg-[#080e18] px-6 py-3`}>
          {footer}
        </footer>
      )}
    </div>
  );
}
