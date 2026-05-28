import type { SimulationResult } from "@/schema/security-scene";
import { qualityLabel } from "@/lib/security-outcome/security-outcome-copy";
import { ExplainBadge } from "@/components/shared/ExplainBadge";

export function CriticalZoneReview({ zones }: { zones: SimulationResult["criticalZoneResults"] }) {
  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Critical Zone Review</h3>
        <ExplainBadge text="Compares each critical zone requirement against achieved quality and failure reasons." />
      </div>
      <div className="mt-2 space-y-2">
        {zones.map((zone) => (
          <div key={zone.zoneId} className="rounded-lg border border-[#232a3d] bg-[#0f1420] p-2">
            <div className="text-[11px] font-medium text-[#deebff]">{zone.label}</div>
            <div className="mt-1 text-[10px] text-[#8ea0bf]">
              Required: {qualityLabel(zone.requiredQuality)} · Actual: {qualityLabel(zone.actualQuality)} · {zone.status.toUpperCase()}
            </div>
            <div className="mt-1 text-[10px] text-[#7384a5]">Covered by: {zone.coveringCameras.join(", ") || "None"}</div>
            {zone.failureReasons.length > 0 ? <div className="mt-1 text-[10px] text-amber-300">{zone.failureReasons.join(" · ")}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
