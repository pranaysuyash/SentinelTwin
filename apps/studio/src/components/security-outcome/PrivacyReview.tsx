"use client";

import type { SimulationResult } from "@/schema/security-scene";
import type { PrivacyFinding } from "@/lib/security-outcome/security-outcome-model";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function PrivacyReview({
  result,
  privacyZonesCount,
  privacyFindings,
  compact = false,
}: {
  result: SimulationResult;
  privacyZonesCount: number;
  privacyFindings: PrivacyFinding[];
  compact?: boolean;
}) {
  const privacyIssues = result.issues.filter((issue) => issue.category === "privacy");
  const restrictedCells = result.coverageCells.filter((cell) => cell.privacyRestricted).length;

  return (
    <section className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-3`}>
      <div className="flex items-center gap-2">
        <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted3`}>Privacy Review</h3>
        <ExplainBadge text="Shows where camera coverage intersects privacy-restricted areas and what the simulation flagged." />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
        <div className={`rounded-lg border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-1.5`}>
          <div className={`UI_SURFACES.textSoftMid`}>Privacy Zones</div>
          <div className={`UI_SURFACES.textBody`}>{privacyZonesCount}</div>
        </div>
        <div className={`rounded-lg border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-1.5`}>
          <div className={`UI_SURFACES.textSoftMid`}>Restricted Cells</div>
          <div className={`UI_SURFACES.textBody`}>{restrictedCells}</div>
        </div>
        <div className={`rounded-lg border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-1.5`}>
          <div className={`UI_SURFACES.textSoftMid`}>Privacy Issues</div>
          <div className={`UI_SURFACES.textBody`}>{privacyIssues.length}</div>
        </div>
      </div>

      {privacyFindings.length === 0 ? (
        <div className={`mt-2 text-[10px] UI_SURFACES.textSoftDim`}>
          No privacy-specific visibility issues were detected in the current simulation.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {privacyFindings.slice(0, compact ? 1 : privacyFindings.length).map((finding) => (
            <div key={`${finding.zoneId}_${finding.cameras.join(",")}`} className={`rounded-lg border UI_SURFACES.borderThin UI_SURFACES.bgDeep p-2 text-[10px] UI_SURFACES.textNear`}>
              <div className={`font-medium UI_SURFACES.textBright`}>{finding.label}</div>
              <div className={`mt-1 UI_SURFACES.textSoftDim`}>{finding.issue}</div>
              <div className={`mt-1 UI_SURFACES.textMuted3`}>Cameras: {finding.cameras.join(", ") || "None"}</div>
            </div>
          ))}
          {compact && privacyFindings.length > 1 ? (
            <div className={`text-[9px] UI_SURFACES.textSoftDim`}>+{privacyFindings.length - 1} more privacy issue{privacyFindings.length - 1 !== 1 ? "s" : ""}</div>
          ) : null}
        </div>
      )}
    </section>
  );
}
