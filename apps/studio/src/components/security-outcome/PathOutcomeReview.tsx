"use client";

import type { SecurityOutcomeModel, PathFinding } from "@/lib/security-outcome/security-outcome-model";
import { qualityLabel } from "@/lib/security-outcome/security-outcome-model";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function PathOutcomeReview({
  pathOutcome,
  pathFindings,
}: {
  pathOutcome: SecurityOutcomeModel["pathOutcome"];
  pathFindings: PathFinding[];
}) {
  const activeResult = pathOutcome ?? null;

  return (
    <section className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-3`}>
      <div className="flex items-center gap-2">
        <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted3`}>Path / Incident Replay Outcome</h3>
        <ExplainBadge text="Route visibility: how much of the subject's path remains visible to cameras and where coverage is lost." />
      </div>

      {pathFindings.length === 0 && !activeResult ? (
        <div className="mt-2 space-y-1">
          <div className={`text-[10px] UI_SURFACES.textSoftDim`}>No incident path defined yet.</div>
          <div className={`text-[10px] UI_SURFACES.textSoftMuted`}>Add a route from entry to critical zone to test whether the subject remains visible throughout.</div>
        </div>
      ) : null}

      {activeResult ? (
        <div className={`mt-2 rounded-lg border UI_SURFACES.borderThin UI_SURFACES.bgDeep p-2`}>
          <div className={`text-[11px] font-medium UI_SURFACES.textBright`}>{activeResult.pathLabel}</div>
          <div className={`mt-1 text-[10px] UI_SURFACES.textNear`}>
            Duration: {activeResult.totalDurationS.toFixed(1)}s · Visible: {activeResult.visibleDurationS.toFixed(1)}s · Lost: {activeResult.lostDurationS.toFixed(1)}s
          </div>
        </div>
      ) : null}

      {pathFindings.length > 0 ? (
        <div className="mt-2 space-y-2">
          {pathFindings.map((finding) => (
            <div key={finding.pathId} className={`rounded-lg border UI_SURFACES.borderThin UI_SURFACES.bgDeep p-2`}>
              <div className={`text-[11px] font-medium UI_SURFACES.textBright`}>{finding.label}</div>
              <div className={`mt-1 text-[10px] UI_SURFACES.textMuted3`}>
                Visible for: {finding.visiblePct}% of route · Lost segments: {finding.lostSegments} · Best quality: {qualityLabel(finding.bestQuality)}
              </div>
              {finding.lostSegmentLabels.length > 0 ? (
                <div className="mt-1 text-[10px] text-amber-300">
                  Lost behind: {finding.lostSegmentLabels.join(", ")}
                </div>
              ) : null}
              {finding.worstMomentSummary ? (
                <div className="mt-1 text-[10px] text-red-300">{finding.worstMomentSummary}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className={`mt-2 text-[10px] UI_SURFACES.textSoftDim`}>Defensive coverage-failure analysis only; no evasion guidance.</div>
    </section>
  );
}
