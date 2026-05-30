"use client";

import type { OutcomeIssueCard, SecurityOutcomeSummary } from "@/lib/security-outcome/security-outcome-model";
import { ExplainBadge } from "@/components/shared/ExplainBadge";

export function NightReadinessReview({ summary, issues }: { summary: SecurityOutcomeSummary; issues: OutcomeIssueCard[] }) {
  const nightIssues = issues.filter((issue) => issue.category === "night");
  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Night / Environment Review</h3>
        <ExplainBadge text="Evaluates whether coverage quality holds when lighting conditions change. Night readiness is estimated from IR and light configuration." />
      </div>
      <div className="mt-1 text-[10px] text-[#d7deed]">Night readiness: <span className={summary.nightReadiness === "fails" ? "text-red-300" : summary.nightReadiness === "weak" ? "text-amber-300" : summary.nightReadiness === "good" ? "text-emerald-300" : "text-[#8ea0bf]"}>{summary.nightReadiness}</span></div>
      <div className="mt-2 space-y-1">
        {nightIssues.length === 0 ? <div className="text-[10px] text-[#7384a5]">No night-specific degradations reported.</div> : null}
        {nightIssues.map((issue) => <div key={issue.id} className="text-[10px] text-amber-300">{issue.productExplanation}</div>)}
      </div>
      {summary.nightReadiness === "unknown" ? (
        <div className="mt-2 text-[10px] text-[#7384a5]">Night readiness was not explicitly tested. Run simulation with night assumptions to evaluate.</div>
      ) : null}
    </section>
  );
}
