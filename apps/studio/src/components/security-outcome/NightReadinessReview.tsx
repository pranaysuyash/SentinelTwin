"use client";

import type { OutcomeIssueCard, SecurityOutcomeSummary } from "@/lib/security-outcome/security-outcome-model";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function NightReadinessReview({ summary, issues }: { summary: SecurityOutcomeSummary; issues: OutcomeIssueCard[] }) {
  const nightIssues = issues.filter((issue) => issue.category === "night");
  return (
    <section className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-3`}>
      <div className="flex items-center gap-2">
        <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted3`}>Night / Environment Review</h3>
        <ExplainBadge text="Evaluates whether coverage quality holds when lighting conditions change. Night readiness is estimated from IR and light configuration." />
      </div>
      <div className={`mt-1 text-[10px] UI_SURFACES.textNear`}>Night readiness: <span className={summary.nightReadiness === "fails" ? "text-red-300" : summary.nightReadiness === "weak" ? "text-amber-300" : summary.nightReadiness === "good" ? "text-emerald-300" : "UI_SURFACES.textMuted3"}>{summary.nightReadiness}</span></div>
      <div className="mt-2 space-y-1">
        {nightIssues.length === 0 ? <div className={`text-[10px] UI_SURFACES.textSoftDim`}>No night-specific degradations reported.</div> : null}
        {nightIssues.map((issue) => <div key={issue.id} className="text-[10px] text-amber-300">{issue.productExplanation}</div>)}
      </div>
      {summary.nightReadiness === "unknown" ? (
        <div className={`mt-2 text-[10px] UI_SURFACES.textSoftDim`}>Night readiness was not explicitly tested. Run simulation with night assumptions to evaluate.</div>
      ) : null}
    </section>
  );
}
