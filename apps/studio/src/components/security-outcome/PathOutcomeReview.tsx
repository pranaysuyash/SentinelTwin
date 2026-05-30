"use client";

import type { SecurityOutcomeModel, PathFinding } from "@/lib/security-outcome/security-outcome-model";
import { qualityLabel } from "@/lib/security-outcome/security-outcome-model";
import { ExplainBadge } from "@/components/shared/ExplainBadge";

export function PathOutcomeReview({
  pathOutcome,
  pathFindings,
}: {
  pathOutcome: SecurityOutcomeModel["pathOutcome"];
  pathFindings: PathFinding[];
}) {
  const activeResult = pathOutcome ?? null;

  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Path / Incident Replay Outcome</h3>
        <ExplainBadge text="Route visibility: how much of the subject's path remains visible to cameras and where coverage is lost." />
      </div>

      {pathFindings.length === 0 && !activeResult ? (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] text-[#7384a5]">No incident path defined yet.</div>
          <div className="text-[10px] text-[#9fb1cf]">Add a route from entry to critical zone to test whether the subject remains visible throughout.</div>
        </div>
      ) : null}

      {activeResult ? (
        <div className="mt-2 rounded-lg border border-[#232a3d] bg-[#0f1420] p-2">
          <div className="text-[11px] font-medium text-[#deebff]">{activeResult.pathLabel}</div>
          <div className="mt-1 text-[10px] text-[#d7deed]">
            Duration: {activeResult.totalDurationS.toFixed(1)}s · Visible: {activeResult.visibleDurationS.toFixed(1)}s · Lost: {activeResult.lostDurationS.toFixed(1)}s
          </div>
        </div>
      ) : null}

      {pathFindings.length > 0 ? (
        <div className="mt-2 space-y-2">
          {pathFindings.map((finding) => (
            <div key={finding.pathId} className="rounded-lg border border-[#232a3d] bg-[#0f1420] p-2">
              <div className="text-[11px] font-medium text-[#deebff]">{finding.label}</div>
              <div className="mt-1 text-[10px] text-[#8ea0bf]">
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

      <div className="mt-2 text-[10px] text-[#7384a5]">Defensive coverage-failure analysis only; no evasion guidance.</div>
    </section>
  );
}
