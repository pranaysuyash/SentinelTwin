"use client";

import { selectSecurityOutcomeFromStore } from "@/lib/security-outcome/security-outcome-selectors";
import { useStudioStore } from "@/store/studio-store";
import { AssumptionDisclosure } from "./AssumptionDisclosure";
import { CameraResponsibilityPanel } from "./CameraResponsibilityPanel";
import { CriticalZoneReview } from "./CriticalZoneReview";
import { IssueStack } from "./IssueStack";
import { NightReadinessReview } from "./NightReadinessReview";
import { OutcomeEmptyState } from "./OutcomeEmptyState";
import { OutcomeSummaryCard } from "./OutcomeSummaryCard";
import { PathOutcomeReview } from "./PathOutcomeReview";
import { RecommendationReview } from "./RecommendationReview";
import { RecommendationCard } from "./RecommendationCard";
import { PrivacyReview } from "./PrivacyReview";
import { RedundancyReview } from "./RedundancyReview";
import { RedundancyMatrixPanel } from "@/components/bottom-panel/RedundancyMatrixPanel";

export function SecurityOutcomePanel({ compact = false }: { compact?: boolean }) {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);
  const model = selectSecurityOutcomeFromStore({ scene, simulationResult: result, activePathId });

  if (!result) {
    return <OutcomeEmptyState />;
  }

  return (
    <div className="space-y-3 p-3 text-[#ced7e8]">
      <OutcomeSummaryCard summary={model.summary} />
      {model.summary.primaryRisk && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px]">
          <span className="font-semibold text-amber-300">Primary risk: </span>
          <span className="text-amber-200">{model.summary.primaryRisk}</span>
        </div>
      )}
      {model.summary.recommendedNextAction && (
        <div className="rounded-lg border border-[#1f2536] bg-[#0b0f17] px-3 py-2 text-[10px]">
          <span className="font-semibold text-[#8ea0bf]">Next action: </span>
          <span className="text-[#d7deed]">{model.summary.recommendedNextAction}</span>
        </div>
      )}
      <IssueStack issues={model.topIssues} compact={compact} />
      {compact ? (
        <div className="rounded-lg border border-[#1f2536] bg-[#0b0f17] px-3 py-2 text-[10px] text-[#9fb1cf]">
          <div className="font-semibold uppercase tracking-[0.16em] text-[#d8e1f3]">Quick Risk Review</div>
          <div className="mt-1">Critical zones: {model.summary.criticalZonesPassing}/{model.summary.criticalZonesTotal} passing</div>
          <div>Redundancy: {model.summary.redundancyStatus.replace(/_/g, " ")}</div>
          <div>Night readiness: {model.summary.nightReadiness}</div>
          <div className="mt-1 text-[#7e90b2]">
            Use full Security Outcome mode for camera responsibility, recommendation apply/preview, and path evidence details.
          </div>
        </div>
      ) : null}
      {compact && model.recommendations[0] ? (
        <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Recommended Next Step</h3>
          <div className="mt-2">
            <RecommendationCard recommendation={model.recommendations[0]} />
          </div>
        </section>
      ) : null}
      <AssumptionDisclosure assumptions={scene.assumptions} model={model} />
      <PrivacyReview result={result} privacyZonesCount={scene.privacyZones.length} privacyFindings={model.privacyFindings} compact={compact} />
      {!compact ? (
        <>
          <CriticalZoneReview zones={model.failedZones} />
          <RecommendationReview recommendations={model.recommendations} />
          <CameraResponsibilityPanel cameraFindings={model.cameraFindings} />
          <RedundancyReview cameraResults={result.cameraResults} />
          <RedundancyMatrixPanel />
          <NightReadinessReview summary={model.summary} issues={model.allIssues} />
          <PathOutcomeReview pathOutcome={model.pathOutcome} pathFindings={model.pathFindings} />
        </>
      ) : null}
    </div>
  );
}
