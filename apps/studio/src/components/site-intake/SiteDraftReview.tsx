"use client";

import { TriangleAlert, Info, XCircle } from "lucide-react";
import type { SiteIntakeSession, SiteCompilerWarning } from "@/lib/site-compiler";

const severityIcon: Record<SiteCompilerWarning["severity"], React.ReactNode> = {
  blocking: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  warning: <TriangleAlert className="h-3.5 w-3.5 text-amber-400" />,
  info: <Info className="h-3.5 w-3.5 text-sky-400" />,
};

const severityLabel: Record<SiteCompilerWarning["severity"], string> = {
  blocking: "text-red-300",
  warning: "text-amber-300",
  info: "text-sky-300",
};

type SiteDraftReviewProps = {
  session: SiteIntakeSession;
  onApprove: () => void;
  onReject: () => void;
  onEdit?: () => void;
};

export function SiteDraftReview({ session, onApprove, onReject, onEdit }: SiteDraftReviewProps) {
  const result = session.result;

  if (!result) {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-[color:var(--text-muted)]">No compiled result available.</div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-dim)]">
              Site Intake
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Review Scene Draft
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-[color:var(--text-muted)]">
              Review the compiled scene before sending it to the editor. The scene includes provenance
              tracking and confidence scoring from how it was built.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Source</div>
            <div className="mt-1 text-sm font-semibold text-white">{result.source}</div>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Confidence</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {result.confidence != null ? `${Math.round(result.confidence * 100)}%` : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Stage</div>
            <div className="mt-1 text-sm font-semibold text-white">{session.stage}</div>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Warnings</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {result.warnings.length}
              {result.warnings.some((w: SiteCompilerWarning) => w.severity === "blocking") ? (
                <span className="ml-2 text-[10px] text-red-400">Has blockers</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Scene Entities</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <span className="text-[color:var(--text-dim)]">Walls </span>
              <span className="text-white">{result.scene.walls.length}</span>
            </div>
            <div>
              <span className="text-[color:var(--text-dim)]">Cameras </span>
              <span className="text-white">{result.scene.cameras.length}</span>
            </div>
            <div>
              <span className="text-[color:var(--text-dim)]">Lights </span>
              <span className="text-white">{result.scene.securityLights.length}</span>
            </div>
            <div>
              <span className="text-[color:var(--text-dim)]">Zones </span>
              <span className="text-white">{result.scene.criticalZones.length}</span>
            </div>
            <div>
              <span className="text-[color:var(--text-dim)]">Entries </span>
              <span className="text-white">{result.scene.entryPoints.length}</span>
            </div>
            <div>
              <span className="text-[color:var(--text-dim)]">Paths </span>
              <span className="text-white">{result.scene.paths.length}</span>
            </div>
          </div>
        </div>

        {result.warnings.length > 0 ? (
          <div className="mt-6 space-y-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
              Warnings ({result.warnings.length})
            </div>
            {result.warnings.map((warning: SiteCompilerWarning, index: number) => (
              <div
                key={index}
                className={`flex items-start gap-2 rounded-xl border p-3 text-[11px] ${
                  warning.severity === "blocking"
                    ? "border-red-400/20 bg-red-500/8"
                    : warning.severity === "warning"
                      ? "border-amber-400/20 bg-amber-500/8"
                      : "border-sky-400/20 bg-sky-500/8"
                }`}
              >
                {severityIcon[warning.severity]}
                <div>
                  <span className={`font-semibold ${severityLabel[warning.severity]}`}>
                    {warning.code}
                  </span>
                  <span className="ml-2 text-[color:var(--text-muted)]">{warning.message}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {result.provenance ? (
          <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Provenance</div>
            <div className="mt-2 space-y-1 text-[12px] text-[color:var(--text-muted)]">
              <p>Source: <span className="text-white">{result.provenance.label}</span></p>
              {result.provenance.confidence != null ? (
                <p>Confidence: <span className="text-white">{Math.round(result.provenance.confidence * 100)}%</span></p>
              ) : null}
              {result.provenance.notes.length > 0 ? (
                <ul className="ml-4 list-disc text-[color:var(--text-muted)]">
                  {result.provenance.notes.map((note: string, i: number) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-end gap-3 border-t border-[color:var(--border)] pt-6">
          <button
            type="button"
            onClick={onReject}
            className="rounded-xl border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-red-400/25 hover:bg-red-500/8 hover:text-red-200"
          >
            Discard
          </button>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-sky-400/25 hover:bg-white/[0.05] hover:text-white"
            >
              Edit Scene
            </button>
          ) : null}
          <button
            type="button"
            onClick={onApprove}
            disabled={result.warnings.some((w: SiteCompilerWarning) => w.severity === "blocking")}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900/60 disabled:text-emerald-300/50"
          >
            {result.warnings.some((w: SiteCompilerWarning) => w.severity === "blocking")
              ? "Blocked by warnings"
              : "Approve & Enter Studio"}
          </button>
        </div>
      </div>
    </div>
  );
}
