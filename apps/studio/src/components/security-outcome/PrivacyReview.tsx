"use client";

import type { SimulationResult } from "@/schema/security-scene";
import { ExplainBadge } from "@/components/shared/ExplainBadge";

export function PrivacyReview({
  result,
  privacyZonesCount,
  compact = false,
}: {
  result: SimulationResult;
  privacyZonesCount: number;
  compact?: boolean;
}) {
  const privacyIssues = result.issues.filter((issue) => issue.category === "privacy");
  const restrictedCells = result.coverageCells.filter((cell) => cell.privacyRestricted).length;

  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Privacy Review</h3>
        <ExplainBadge text="Shows where the modeled camera coverage intersects privacy-restricted areas and what the simulation flagged." />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
        <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1.5">
          <div className="text-[#6a748b]">Privacy Zones</div>
          <div className="text-[#c7d0e4]">{privacyZonesCount}</div>
        </div>
        <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1.5">
          <div className="text-[#6a748b]">Restricted Cells</div>
          <div className="text-[#c7d0e4]">{restrictedCells}</div>
        </div>
        <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1.5">
          <div className="text-[#6a748b]">Privacy Issues</div>
          <div className="text-[#c7d0e4]">{privacyIssues.length}</div>
        </div>
      </div>

      {privacyIssues.length === 0 ? (
        <div className="mt-2 text-[10px] text-[#7384a5]">
          No privacy-specific visibility issues were detected in the current simulation.
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {privacyIssues.slice(0, compact ? 1 : privacyIssues.length).map((issue, index) => (
            <div key={`${issue.category}_${index}`} className="rounded-lg border border-[#232a3d] bg-[#0f1420] p-2 text-[10px] text-[#d7deed]">
              <div className="font-medium text-[#deebff]">{issue.description}</div>
              <div className="mt-1 text-[#7384a5]">
                Affected zones: {issue.affectedZones.join(", ") || "None"} · Cameras: {issue.affectedCameras.join(", ") || "None"}
              </div>
            </div>
          ))}
          {compact && privacyIssues.length > 1 ? (
            <div className="text-[9px] text-[#7384a5]">+{privacyIssues.length - 1} more privacy issue{privacyIssues.length - 1 !== 1 ? "s" : ""}</div>
          ) : null}
        </div>
      )}
    </section>
  );
}
