"use client";

import { TriangleAlert, Info, XCircle, Eye, Play } from "lucide-react";
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

  const hasBlockers = result.warnings.some((w: SiteCompilerWarning) => w.severity === "blocking");

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-dim)]">
              Site Intake · {result.source}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Review Site Twin Draft
            </h1>
            <p className="mt-1 max-w-xl text-[13px] leading-5 text-[color:var(--text-muted)]">
              Source: {result.provenance.label} · {result.warnings.length} warning{result.warnings.length !== 1 ? "s" : ""}
              {result.confidence != null ? ` · ${Math.round(result.confidence * 100)}% confidence` : ""}
            </p>
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
                    {result.scene.dimensions.width}m × {result.scene.dimensions.depth}m
                  </div>
                </div>
              </div>
            </div>

            {result.provenance.notes.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Provenance Notes</div>
                <ul className="mt-2 space-y-1 text-[12px] text-[color:var(--text-muted)]">
                  {result.provenance.notes.map((note: string, i: number) => (
                    <li key={i} /* stable display list */ className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 flex-none rounded-full bg-[color:var(--text-dim)]" />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="flex w-[340px] flex-none flex-col gap-4">
            <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Entities</div>
              <div className="mt-3 space-y-2 text-[13px]">
                <EntityCount label="Walls" count={result.scene.walls.length} />
                <EntityCount label="Cameras" count={result.scene.cameras.length} />
                <EntityCount label="Lights" count={result.scene.securityLights.length} />
                <EntityCount label="Zones" count={result.scene.criticalZones.length} />
                <EntityCount label="Entries" count={result.scene.entryPoints.length} />
                <EntityCount label="Paths" count={result.scene.paths.length} />
                <EntityCount label="Obstructions" count={result.scene.obstructions.length} />
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">Source</div>
              <div className="mt-2 space-y-1 text-[12px] text-[color:var(--text-muted)]">
                <div>Mode: <span className="text-white">{result.source}</span></div>
                <div>Label: <span className="text-white">{result.provenance.label}</span></div>
                {result.confidence != null ? (
                  <div>Confidence: <span className="text-white">{Math.round(result.confidence * 100)}%</span></div>
                ) : null}
              </div>
            </div>

            {result.warnings.length > 0 ? (
              <div className="rounded-2xl border border-[color:var(--border)] bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                  Warnings ({result.warnings.length})
                </div>
                <div className="mt-2 space-y-2">
                  {result.warnings.map((warning: SiteCompilerWarning, i: number) => (
                    <div key={i} /* stable display list */ className="flex items-start gap-2 text-[11px]">
                      {severityIcon[warning.severity]}
                      <div>
                        <span className={`font-semibold ${severityLabel[warning.severity]}`}>
                          {warning.code}
                        </span>
                        <span className="ml-1 text-[color:var(--text-muted)]">{warning.message}</span>
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
            {onRunBaselineSimulation ? (
              <button
                type="button"
                onClick={onRunBaselineSimulation}
                className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-white/[0.03] px-4 py-2 text-xs text-[color:var(--text-muted)] transition-colors hover:border-sky-400/25 hover:bg-white/[0.05] hover:text-white"
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
              {hasBlockers ? "Blocked by warnings" : "Open in Studio"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityCount({ label, count }: { label: string; count: number }) {
  const color = count === 0 ? "text-[color:var(--text-dim)]" : "text-white";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[color:var(--text-muted)]">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{count}</span>
    </div>
  );
}
