"use client";

import { formatOutcomeStatusLabel } from "@/lib/security-outcome/security-outcome-copy";
import type { SecurityOutcomeSummary } from "@/lib/security-outcome/security-outcome-model";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

function statusTone(status: SecurityOutcomeSummary["status"]) {
  if (status === "pass") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "high_risk") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (status === "needs_attention") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (status === "incomplete") return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  return "border-blue-500/30 bg-blue-500/10 text-blue-200";
}

export function OutcomeSummaryCard({ summary }: { summary: SecurityOutcomeSummary }) {
  return (
    <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${statusTone(summary.status)}`}>
          {formatOutcomeStatusLabel(summary.status)}
        </div>
        <div className={`text-[10px] ${UI_SURFACES.textMuted3}`}>{summary.coveragePct != null ? `${Math.round(summary.coveragePct)}% coverage` : "No coverage data"}</div>
      </div>
      <div className={`mt-2 text-[11px] font-medium ${UI_SURFACES.textNear}`}>{summary.headline}</div>
      {summary.summary !== summary.headline && (
        <div className={`mt-1 text-[10px] ${UI_SURFACES.textSoftMuted}`}>{summary.summary}</div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1`}>
          <div className={`${UI_SURFACES.textSoftMid}`}>Critical Zones</div>
          <div className={`${UI_SURFACES.textBody}`}>{summary.criticalZonesPassing}/{summary.criticalZonesTotal} passing</div>
        </div>
        <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1`}>
          <div className={`${UI_SURFACES.textSoftMid}`}>Issues</div>
          <div className={`${UI_SURFACES.textBody}`}>{summary.issueCount}</div>
        </div>
        <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1`}>
          <div className={`${UI_SURFACES.textSoftMid}`}>Night Readiness</div>
          <div className={`${UI_SURFACES.textBody} capitalize`}>{summary.nightReadiness}</div>
        </div>
        <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1`}>
          <div className={`${UI_SURFACES.textSoftMid}`}>Redundancy</div>
          <div className={`${UI_SURFACES.textBody} capitalize`}>{summary.redundancyStatus.replace(/_/g, " ")}</div>
        </div>
        {summary.recognitionAreaPct != null ? (
          <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1`}>
            <div className={`${UI_SURFACES.textSoftMid}`}>Recognition Area</div>
            <div className={`${UI_SURFACES.textBody}`}>{Math.round(summary.recognitionAreaPct)}%</div>
          </div>
        ) : null}
        {summary.identificationAreaPct != null ? (
          <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1`}>
            <div className={`${UI_SURFACES.textSoftMid}`}>Identification Area</div>
            <div className={`${UI_SURFACES.textBody}`}>{Math.round(summary.identificationAreaPct)}%</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
