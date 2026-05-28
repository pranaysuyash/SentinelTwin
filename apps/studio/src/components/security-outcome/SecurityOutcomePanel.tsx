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
      <IssueStack issues={model.topIssues} compact={compact} />
      <AssumptionDisclosure assumptions={scene.assumptions} />
      <PrivacyReview result={result} privacyZonesCount={scene.privacyZones.length} compact={compact} />
      {!compact ? (
        <>
          <CriticalZoneReview zones={result.criticalZoneResults} />
          <RecommendationReview recommendations={model.recommendations} />
          <CameraResponsibilityPanel cameraResults={result.cameraResults} />
          <RedundancyReview cameraResults={result.cameraResults} />
          <RedundancyMatrixPanel />
          <NightReadinessReview summary={model.summary} issues={model.allIssues} />
          <PathOutcomeReview pathOutcome={model.pathOutcome} pathResults={result.pathResults} />
        </>
      ) : null}
    </div>
  );
}
