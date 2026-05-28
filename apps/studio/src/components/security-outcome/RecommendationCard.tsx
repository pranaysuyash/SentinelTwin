"use client";

import type { OutcomeRecommendationCard } from "@/lib/security-outcome/security-outcome-model";
import { applyRecommendation, previewRecommendation } from "@/lib/security-outcome/security-outcome-actions";
import { useStudioStore } from "@/store/studio-store";

export function RecommendationCard({ recommendation }: { recommendation: OutcomeRecommendationCard }) {
  const store = useStudioStore();

  const doPreview = () => {
    previewRecommendation(store, recommendation);
    store.setBottomTab("beforeafter");
  };

  const doApply = () => {
    applyRecommendation(store, recommendation);
    store.saveSnapshot(`Fix applied: ${recommendation.type}`);
  };

  return (
    <div className="rounded-lg border border-[#232a3d] bg-[#0f1420] p-2">
      <div className="text-[11px] font-medium text-[#deebff]">{recommendation.description}</div>
      <div className="mt-1 text-[10px] text-[#8ea0bf]">
        Impact: {recommendation.estimatedImpact} · Cost: {recommendation.costCategory} · Verified: {recommendation.verified ? "Yes" : "No"}
      </div>
      <div className="mt-2 flex gap-1 text-[10px]">
        <button onClick={doPreview} className="rounded border border-[#2d3750] px-2 py-1 text-[#bcd3ff] hover:bg-[#1a2233]">Preview Fix</button>
        <button onClick={() => store.setBottomTab("beforeafter")} className="rounded border border-[#2d3750] px-2 py-1 text-[#bcd3ff] hover:bg-[#1a2233]">Compare Fix</button>
        <button onClick={doApply} className="rounded border border-emerald-500/30 px-2 py-1 text-emerald-300 hover:bg-emerald-500/10">Apply Fix</button>
      </div>
    </div>
  );
}
