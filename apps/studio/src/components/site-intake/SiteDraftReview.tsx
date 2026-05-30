"use client";

import {
  TriangleAlert, Info, XCircle, Eye, Play,
  CheckCircle2, ArrowRight, Plus, RotateCcw,
  Camera, ShieldAlert, Route,
} from "lucide-react";
import type { SiteIntakeSession, ActionableWarning, SiteTwinDraft, SuggestedNextAction } from "@/lib/site-compiler";
import { canRunBaselineSimulation, compileToSiteTwinDraft } from "@/lib/site-compiler";

const severityIcon: Record<ActionableWarning["severity"], React.ReactNode> = {
  blocking: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  warning: <TriangleAlert className="h-3.5 w-3.5 text-amber-400" />,
  info: <Info className="h-3.5 w-3.5 text-sky-400" />,
};

const severityLabel: Record<ActionableWarning["severity"], string> = {
  blocking: "text-red-300",
  warning: "text-amber-300",
  info: "text-sky-300",
};

const actionIcons: Record<SuggestedNextAction["action"], React.ReactNode> = {
  edit: <RotateCcw className="h-3.5 w-3.5" />,
  approve: <CheckCircle2 className="h-3.5 w-3.5" />,
  run_baseline: <Play className="h-3.5 w-3.5" />,
  add_camera: <Camera className="h-3.5 w-3.5" />,
  add_zone: <ShieldAlert className="h-3.5 w-3.5" />,
  add_path: <Route className="h-3.5 w-3.5" />,
  open_studio: <ArrowRight className="h-3.5 w-3.5" />,
};

type SiteDraftReviewProps = {
  session: SiteIntakeSession;
  onApprove: () => void;
  onReject: () => void;
  onEdit?: () => void;
  onRunBaselineSimulation?: () => void;
};

export function SiteDraftReview({ session, onApprove, onReject, onEdit, onRunBaselineSimulation }: SiteDraftReviewProps) {
  const result = session.result;

  if (!result) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-[color:var(--text-muted)]">No compiled result available.</div>
      </div>
    );
  }

  const draft = session.draft ?? compileToSiteTwinDraft(result);
  const hasBlockers = draft.warnings.some((w) => w.severity === "blocking");
  const canBaseline = canRunBaselineSimulation(draft);
  const confidencePct = Math.round(draft.confidence * 100);
  const confidenceColor = draft.confidenceLabel === "high" ? "text-emerald-300" : draft.confidenceLabel === "medium" ? "text-amber-300" : "text-red-300";

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-dim)]">
              <span>Site Twin Review</span>
              <span className="text-[color:var(--border)]">·</span>
              <span className="text-white">{draft.provenance.sourceLabel}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              {draft.scene.name || "Untitled Site Twin"}
            </h1>
            <div className="mt-1 flex items-center gap-3 text-[13px] leading-5 text-[color:var(--text-muted)]">
              <span>{draft.warnings.length} warning{draft.warnings.length !== 1 ? "s" : ""}</span>
              <span className="text-[color:var(--border)]">·</span>
              <span className={confidenceColor}>{confidencePct}% confidence ({draft.confidenceLabel})</span>
              <span className="text-[color:var(--border)]">·</span>
              <span>{draft.entityCounts.walls}w {draft.entityCounts.cameras}c {draft.entityCounts.criticalZones}z {draft.entityCounts.entryPoints}e</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-1 gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Scene Preview</div>
              <div className="mt-3 flex aspect-video items-center justify-center rounded-xl border border-dashed border-[color:var(--border)] bg-white/[0.02]">
                <div className="text-center">
                  <Eye className="mx-auto h-8 w-8 text-[color:var(--text-dim)]" />
                  <div className="mt-2 text-[11px] text-[color:var(--text-dim)]">Scene canvas preview</div>
                  <div className="mt-1 text-[10px] text-[color:var(--text-dim)]">
                    {draft.scene.dimensions.width}m × {draft.scene.dimensions.depth}m
                  </div>
                </div>
              </div>
            </div>

            {draft.assumptions.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Assumptions</div>
                <div className="mt-2 space-y-2">
                  {draft.assumptions.map((assumption, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px]">
                      <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${
                        assumption.source === "user" ? "bg-sky-500/10 text-sky-300" :
                        assumption.source === "model" ? "bg-violet-500/10 text-violet-300" :
                        assumption.source === "estimated" ? "bg-amber-500/10 text-amber-300" :
                        "bg-white/[0.05] text-[color:var(--text-dim)]"
                      }`}>{assumption.source}</span>
                      <div>
                        <span className="text-white">{assumption.label}:</span>
                        <span className="ml-1 text-[color:var(--text-muted)]">{assumption.value}</span>
                        {assumption.confidence != null ? (
                          <span className="ml-1 text-[10px] text-[color:var(--text-dim)]">({Math.round(assumption.confidence * 100)}%)</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.missingPrerequisites.length > 0 ? (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300">Missing Prerequisites</div>
                <div className="mt-2 space-y-2">
                  {draft.missingPrerequisites.map((prereq, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px]">
                      <span className="mt-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-amber-200">
                        {prereq.requiredFor.replace("_", " ")}
                      </span>
                      <span className="text-amber-100">{prereq.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.provenance.notes.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Provenance</div>
                <ul className="mt-2 space-y-1 text-[12px] text-[color:var(--text-muted)]">
                  {draft.provenance.notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 flex-none rounded-full bg-[color:var(--text-dim)]" />
                      {note}
                    </li>
                  ))}
                  {draft.provenance.sourceArtifacts.map((artifact, i) => (
                    <li key={`a${i}`} className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 flex-none rounded-full bg-sky-500" />
                      <span className="text-sky-300">{artifact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="flex w-[360px] flex-none flex-col gap-4">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Entities</div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                <EntityCount label="Walls" count={draft.entityCounts.walls} />
                <EntityCount label="Doors" count={draft.entityCounts.doors} />
                <EntityCount label="Windows" count={draft.entityCounts.windows} />
                <EntityCount label="Cameras" count={draft.entityCounts.cameras} highlight />
                <EntityCount label="Lights" count={draft.entityCounts.lights} />
                <EntityCount label="Obstructions" count={draft.entityCounts.obstructions} />
                <EntityCount label="Critical Zones" count={draft.entityCounts.criticalZones} highlight />
                <EntityCount label="Privacy Zones" count={draft.entityCounts.privacyZones} />
                <EntityCount label="Entry Points" count={draft.entityCounts.entryPoints} />
                <EntityCount label="Paths" count={draft.entityCounts.paths} />
                <EntityCount label="Sensors" count={draft.entityCounts.sensors} />
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Source</div>
              <div className="mt-2 space-y-1 text-[12px] text-[color:var(--text-muted)]">
                <div>Mode: <span className="text-white">{draft.source}</span></div>
                <div>Label: <span className="text-white">{draft.provenance.sourceLabel}</span></div>
                <div>Confidence: <span className={confidenceColor}>{confidencePct}% ({draft.confidenceLabel})</span></div>
                <div>Baseline sim: <span className={canBaseline ? "text-emerald-300" : "text-amber-300"}>{canBaseline ? "Ready" : "Not ready"}</span></div>
              </div>
            </div>

            {draft.warnings.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                  Warnings ({draft.warnings.length})
                </div>
                <div className="mt-2 space-y-3">
                  {draft.warnings.map((warning, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      {severityIcon[warning.severity]}
                      <div className="min-w-0">
                        <span className={`font-semibold ${severityLabel[warning.severity]}`}>
                          {warning.code}
                        </span>
                        <div className="mt-0.5 text-[color:var(--text-muted)]">{warning.message}</div>
                        {warning.suggestedAction ? (
                          <div className="mt-1 text-[10px] text-sky-300">
                            Action: {warning.suggestedAction}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.suggestedNextActions.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Next Actions</div>
                <div className="mt-2 space-y-2">
                  {draft.suggestedNextActions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <span className="mt-0.5 text-[color:var(--text-dim)]">{actionIcons[action.action]}</span>
                      <div>
                        <span className={action.enabled ? "text-white" : "text-[color:var(--text-dim)]"}>
                          {action.label}
                        </span>
                        {action.reason ? (
                          <div className="mt-0.5 text-[10px] text-[color:var(--text-muted)]">{action.reason}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-[color:var(--border)] pt-5">
          <div className="flex items-center gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-xl border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-sky-400/25 hover:bg-white/[0.05] hover:text-white"
              >
                Back to Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={onReject}
              className="rounded-xl border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-red-400/25 hover:bg-red-500/8 hover:text-red-200"
            >
              Discard
            </button>
          </div>
          <div className="flex items-center gap-2">
            {onRunBaselineSimulation && canBaseline ? (
              <button
                type="button"
                onClick={onRunBaselineSimulation}
                className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs text-sky-300 transition-colors hover:bg-sky-500/16"
              >
                <Play className="h-3 w-3" />
                Run Baseline Simulation
              </button>
            ) : null}
            <button
              type="button"
              onClick={onApprove}
              disabled={hasBlockers}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900/60 disabled:text-emerald-300/50"
            >
              {hasBlockers ? "Blocked — fix warnings first" : "Approve & Open in Studio"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityCount({ label, count, highlight }: { label: string; count: number; highlight?: boolean }) {
  const color = count === 0 ? "text-[color:var(--text-dim)]" : highlight ? "text-sky-300" : "text-white";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--text-muted)]">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{count}</span>
    </div>
  );
}
