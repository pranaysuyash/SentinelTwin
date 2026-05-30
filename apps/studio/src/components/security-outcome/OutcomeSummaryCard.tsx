"use client";

import { formatOutcomeStatusLabel } from "@/lib/security-outcome/security-outcome-copy";
import type { SecurityOutcomeSummary } from "@/lib/security-outcome/security-outcome-model";

function statusTone(status: SecurityOutcomeSummary["status"]) {
  if (status === "pass") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "high_risk") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (status === "needs_attention") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (status === "incomplete") return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  return "border-blue-500/30 bg-blue-500/10 text-blue-200";
}

export function OutcomeSummaryCard({ summary }: { summary: SecurityOutcomeSummary }) {
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${statusTone(summary.status)}`}>
          {formatOutcomeStatusLabel(summary.status)}
        </div>
        <div className="text-[10px] text-[#8ea5cc]">{summary.coveragePct != null ? `${Math.round(summary.coveragePct)}% coverage` : "No coverage data"}</div>
      </div>
      <div className="mt-2 text-[11px] font-medium text-[#d7deed]">{summary.headline}</div>
      {summary.summary !== summary.headline && (
        <div className="mt-1 text-[10px] text-[#9fb1cf]">{summary.summary}</div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1">
          <div className="text-[#6a748b]">Critical Zones</div>
          <div className="text-[#c7d0e4]">{summary.criticalZonesPassing}/{summary.criticalZonesTotal} passing</div>
        </div>
        <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1">
          <div className="text-[#6a748b]">Issues</div>
          <div className="text-[#c7d0e4]">{summary.issueCount}</div>
        </div>
        <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1">
          <div className="text-[#6a748b]">Night Readiness</div>
          <div className="text-[#c7d0e4] capitalize">{summary.nightReadiness}</div>
        </div>
        <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1">
          <div className="text-[#6a748b]">Redundancy</div>
          <div className="text-[#c7d0e4] capitalize">{summary.redundancyStatus.replace(/_/g, " ")}</div>
        </div>
        {summary.recognitionAreaPct != null ? (
          <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1">
            <div className="text-[#6a748b]">Recognition Area</div>
            <div className="text-[#c7d0e4]">{Math.round(summary.recognitionAreaPct)}%</div>
          </div>
        ) : null}
        {summary.identificationAreaPct != null ? (
          <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1">
            <div className="text-[#6a748b]">Identification Area</div>
            <div className="text-[#c7d0e4]">{Math.round(summary.identificationAreaPct)}%</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
