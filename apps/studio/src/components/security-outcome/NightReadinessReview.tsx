import type { OutcomeIssueCard, SecurityOutcomeSummary } from "@/lib/security-outcome/security-outcome-model";

export function NightReadinessReview({ summary, issues }: { summary: SecurityOutcomeSummary; issues: OutcomeIssueCard[] }) {
  const nightIssues = issues.filter((issue) => issue.category === "night");
  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Night / Environment Review</h3>
      <div className="mt-1 text-[10px] text-[#d7deed]">Night readiness: {summary.nightReadiness}</div>
      <div className="mt-2 space-y-1">
        {nightIssues.length === 0 ? <div className="text-[10px] text-[#7384a5]">No night-specific degradations reported.</div> : null}
        {nightIssues.map((issue) => <div key={issue.id} className="text-[10px] text-amber-300">{issue.description}</div>)}
      </div>
    </section>
  );
}
