"use client";

import { selectSecurityOutcomeFromStore } from "@/lib/security-outcome/security-outcome-selectors";
import { CAUSE_CATEGORY_PRODUCT_LABELS, type CauseCategory } from "@/lib/security-outcome/security-outcome-model";
import { buildSecurityNarrativeModel } from "@/lib/security-outcome/security-narrative";
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
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

function causeSeverityTone(severity: string) {
  if (severity === "critical") return "border-red-500/25 bg-red-500/8 text-red-200";
  if (severity === "high") return "border-amber-500/25 bg-amber-500/8 text-amber-200";
  if (severity === "medium") return "border-blue-500/25 bg-blue-500/8 text-blue-200";
  return "border-slate-500/25 bg-slate-500/8 text-slate-300";
}

function scorecardColor(score: number) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 50) return "text-amber-300";
  return "text-red-300";
}

export function SecurityOutcomePanel({ compact = false }: { compact?: boolean }) {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);
  const model = selectSecurityOutcomeFromStore({ scene, simulationResult: result, activePathId });
  const narrative = buildSecurityNarrativeModel(model, result, scene);

  if (!result) {
    return <OutcomeEmptyState />;
  }

  return (
    <div className="space-y-3 p-3 ${UI_SURFACES.textBody2}">
      <OutcomeSummaryCard summary={model.summary} />
      {!compact ? (
        <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-3`}>
          <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted3}`}>Security Scorecard</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${scorecardColor(model.scorecard.overall)}`}>{model.scorecard.overall}</span>
            <span className={`text-[10px] ${UI_SURFACES.textMuted3}`}>/ 100 · {model.scorecard.overallLabel}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px]">
            {([
              ["Coverage", model.scorecard.dimensions.coverage.score, model.scorecard.dimensions.coverage.label],
              ["Zones", model.scorecard.dimensions.zoneCompliance.score, model.scorecard.dimensions.zoneCompliance.label],
              ["Redundancy", model.scorecard.dimensions.redundancy.score, model.scorecard.dimensions.redundancy.label],
              ["Night", model.scorecard.dimensions.nightReadiness.score, model.scorecard.dimensions.nightReadiness.label],
              ["Paths", model.scorecard.dimensions.pathVisibility.score, model.scorecard.dimensions.pathVisibility.label],
              ["Privacy", model.scorecard.dimensions.privacy.score, model.scorecard.dimensions.privacy.label],
            ] as [string, number, string][]).map(([label, score, detail]) => (
              <div key={label} className={`rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1`}>
                <div className="${UI_SURFACES.textSoftMid}">{label}</div>
                <div className={`font-semibold ${scorecardColor(score)}`}>{score}
                  <span className="${UI_SURFACES.textSoftMid}"> · {detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {model.summary.primaryRisk && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px]">
          <span className="font-semibold text-amber-300">Primary risk: </span>
          <span className="text-amber-200">{model.summary.primaryRisk}</span>
        </div>
      )}
      {model.summary.recommendedNextAction && (
        <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-3 py-2 text-[10px]`}>
          <span className={`font-semibold ${UI_SURFACES.textMuted3}`}>Next action: </span>
          <span className={`${UI_SURFACES.textNear}`}>{model.summary.recommendedNextAction}</span>
        </div>
      )}
      {!compact ? (
        <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-3 text-[10px]`}>
          <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted3}`}>Narrative Snapshot</h3>
          <div className={`mt-2 space-y-1 ${UI_SURFACES.textSoftMuted}`}>
            <div><span className="${UI_SURFACES.textBody3}">Critical issue:</span> {narrative.criticalIssue}</div>
            <div><span className="${UI_SURFACES.textBody3}">Primary cause:</span> {narrative.primaryCause}</div>
            <div><span className="${UI_SURFACES.textBody3}">Impact:</span> {narrative.impact}</div>
          </div>
        </div>
      ) : null}
      <IssueStack issues={model.topIssues} compact={compact} />
      {!compact && model.causeTaxonomy.length > 0 ? (
        <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-3`}>
          <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted3}`}>Cause Analysis</h3>
          <div className="mt-2 space-y-1.5">
            {model.causeTaxonomy.map((cause) => (
              <div key={cause.category} className={`rounded border px-2 py-1.5 text-[10px] ${causeSeverityTone(cause.severity)}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{CAUSE_CATEGORY_PRODUCT_LABELS[cause.category]}</span>
                  <span className="text-[8px] uppercase opacity-70">{cause.severity}</span>
                </div>
                <div className={`mt-0.5 ${UI_SURFACES.textSoftMuted}`}>{cause.productExplanation}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {compact ? (
        <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-3 py-2 text-[10px] ${UI_SURFACES.textSoftMuted}`}>
          <div className="font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textBody3}">Quick Risk Review</div>
          <div className="mt-1">Critical zones: {model.summary.criticalZonesPassing}/{model.summary.criticalZonesTotal} passing</div>
          <div>Redundancy: {model.summary.redundancyStatus.replace(/_/g, " ")}</div>
          <div>Night readiness: {model.summary.nightReadiness}</div>
          <div className="mt-1 ${UI_SURFACES.textMuted5}">
            Use full Security Outcome mode for camera responsibility, recommendation apply/preview, and path evidence details.
          </div>
        </div>
      ) : null}
      {compact && model.recommendations[0] ? (
        <section className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-3`}>
          <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted3}`}>Recommended Next Step</h3>
          <div className="mt-2">
            <RecommendationCard recommendation={model.recommendations[0]} />
          </div>
        </section>
      ) : null}
      <AssumptionDisclosure assumptions={scene.assumptions} model={model} />
      <PrivacyReview result={result} privacyZonesCount={scene.privacyZones.length} privacyFindings={model.privacyFindings} compact={compact} />
      {!compact ? (
        <>
          <CriticalZoneReview zones={model.zoneFindings} />
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
