"use client";

import type { FailedZoneDetail } from "@/lib/security-outcome/security-outcome-model";
import { qualityLabel } from "@/lib/security-outcome/security-outcome-model";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { useStudioStore } from "@/store/studio-store";
import { focusIssueZone } from "@/lib/security-outcome/security-outcome-actions";

function priorityTone(priority: FailedZoneDetail["priority"]) {
  if (priority === "critical" || priority === "high") return "text-red-300";
  if (priority === "medium") return "text-amber-300";
  return "text-slate-400";
}

function statusTone(status: FailedZoneDetail["status"]) {
  if (status === "pass") return "text-emerald-300";
  if (status === "fail") return "text-red-300";
  return "text-amber-300";
}

export function CriticalZoneReview({ zones }: { zones: FailedZoneDetail[] }) {
  const store = useStudioStore();

  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Critical Zone Review</h3>
        <ExplainBadge text="Compares each critical zone requirement against achieved quality. Product-language explanations show why each zone fails." />
      </div>
      <div className="mt-2 space-y-2">
        {zones.map((zone) => (
          <div key={zone.zoneId} className="rounded-lg border border-[#232a3d] bg-[#0f1420] p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium text-[#deebff]">{zone.label}</div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] uppercase font-semibold ${priorityTone(zone.priority)}`}>{zone.priority}</span>
                <span className={`text-[9px] uppercase font-semibold ${statusTone(zone.status)}`}>{zone.status}</span>
              </div>
            </div>
            <div className="mt-1 text-[10px] text-[#8ea0bf]">
              Required: {qualityLabel(zone.requiredQuality)} · Actual: {qualityLabel(zone.actualQuality)} · Target: {zone.targetType.replace(/_/g, " ")}
            </div>
            <div className="mt-1 text-[10px] text-[#7384a5]">
              Covered by: {zone.coveringCameras.length > 0 ? zone.coveringCameras.join(", ") : "None"}
            </div>
            {zone.productFailureReasons.length > 0 ? (
              <div className="mt-2 space-y-1">
                {zone.productFailureReasons.map((reason, idx) => (
                  <div key={idx} className="text-[10px] text-amber-300">{reason}</div>
                ))}
              </div>
            ) : null}
            {zone.causeSummary ? (
              <div className="mt-1 text-[10px] text-[#9fb1cf] italic">{zone.causeSummary}</div>
            ) : null}
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => focusIssueZone(store, zone.zoneId)}
                className="rounded border border-[#2a3045] bg-[#111521] px-1.5 py-0.5 text-[8px] text-[#9db7e1] hover:text-white"
              >
                Focus in Scene
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
