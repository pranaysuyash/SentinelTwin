import type { OutcomeRecommendationCard } from "@/lib/security-outcome/security-outcome-model";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { RecommendationCard } from "./RecommendationCard";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function RecommendationReview({ recommendations }: { recommendations: OutcomeRecommendationCard[] }) {
  return (
    <section className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-3`}>
      <div className="flex items-center gap-2">
        <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted3`}>Recommendation Review</h3>
        <ExplainBadge text="Recommended mitigations with estimated impact and preview/apply actions." />
      </div>
      <div className="mt-2 space-y-2">
        {recommendations.length === 0 ? <div className={`text-[10px] UI_SURFACES.textSoftDim`}>No recommendations available.</div> : null}
        {recommendations.map((rec) => <RecommendationCard key={rec.id} recommendation={rec} />)}
      </div>
    </section>
  );
}
