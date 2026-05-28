import type { OutcomeRecommendationCard } from "@/lib/security-outcome/security-outcome-model";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { RecommendationCard } from "./RecommendationCard";

export function RecommendationReview({ recommendations }: { recommendations: OutcomeRecommendationCard[] }) {
  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Recommendation Review</h3>
        <ExplainBadge text="Recommended mitigations with estimated impact and preview/apply actions." />
      </div>
      <div className="mt-2 space-y-2">
        {recommendations.length === 0 ? <div className="text-[10px] text-[#7384a5]">No recommendations available.</div> : null}
        {recommendations.map((rec) => <RecommendationCard key={rec.id} recommendation={rec} />)}
      </div>
    </section>
  );
}
