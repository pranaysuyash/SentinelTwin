"use client";

import type { OutcomeRecommendationCard } from "@/lib/security-outcome/security-outcome-model";
import { CAUSE_CATEGORY_PRODUCT_LABELS } from "@/lib/security-outcome/security-outcome-model";
import { formatVerificationLabel, formatVerificationTone } from "@/lib/security-outcome/security-outcome-copy";
import { applyRecommendation, previewRecommendation } from "@/lib/security-outcome/security-outcome-actions";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

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
    <div className={`rounded-lg border UI_SURFACES.borderThin UI_SURFACES.bgDeep p-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-medium UI_SURFACES.textBright`}>{recommendation.description}</div>
          <div className={`mt-1 text-[10px] UI_SURFACES.textMuted3`}>
            Cost: {recommendation.costCategory}
          </div>
        </div>
        {recommendation.scorecardDelta ? (
          <div className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
            recommendation.scorecardDelta.estimatedChange === "improvement"
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border border-slate-500/30 bg-slate-500/10 text-slate-300"
          }`}>
            {recommendation.scorecardDelta.description}
          </div>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
        <span className={formatVerificationTone(recommendation.verificationLabel)}>
          {formatVerificationLabel(recommendation.verificationLabel)}
        </span>
        {recommendation.fixesFinding ? (
          <span className={`UI_SURFACES.textSoftMuted`}>
            Fixes: {CAUSE_CATEGORY_PRODUCT_LABELS[recommendation.fixesFinding]}
          </span>
        ) : null}
      </div>
      {recommendation.beforeAfterSummary && (
        <div className={`mt-1 rounded border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2 py-1 text-[10px] UI_SURFACES.textSoftMuted`}>
          {recommendation.beforeAfterSummary}
        </div>
      )}
      <div className="mt-2 flex gap-1 text-[10px]">
        {recommendation.verificationLabel === "verified_by_simulation" ? (
          <>
            <button type="button" onClick={doPreview} className={`rounded border UI_SURFACES.borderElevated px-2 py-1 UI_SURFACES.textBlueMuted UI_SURFACES.hoverBg`}>Preview Fix</button>
            <button type="button" onClick={() => store.setBottomTab("beforeafter")} className={`rounded border UI_SURFACES.borderElevated px-2 py-1 UI_SURFACES.textBlueMuted UI_SURFACES.hoverBg`}>Compare Fix</button>
            <button type="button" onClick={doApply} className="rounded border border-emerald-500/30 px-2 py-1 text-emerald-300 hover:bg-emerald-500/10">Apply Fix</button>
          </>
        ) : recommendation.verificationLabel === "requires_user_input" ? (
          <span className={`UI_SURFACES.textSoftDim`}>Requires manual action (add camera or light)</span>
        ) : (
          <>
            <button type="button" onClick={doPreview} className={`rounded border UI_SURFACES.borderElevated px-2 py-1 UI_SURFACES.textBlueMuted UI_SURFACES.hoverBg`}>Try This Fix</button>
            <button type="button" onClick={doApply} className={`rounded border UI_SURFACES.borderElevated px-2 py-1 UI_SURFACES.textBlueMuted UI_SURFACES.hoverBg`}>Apply</button>
          </>
        )}
      </div>
    </div>
  );
}
