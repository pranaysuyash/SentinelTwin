"use client";

import type { SimulationResult } from "@/schema/security-scene";
import { qualityLabel } from "@/lib/security-outcome/security-outcome-model";
import { ExplainBadge } from "@/components/shared/ExplainBadge";

export function RedundancyReview({ cameraResults }: { cameraResults: SimulationResult["cameraResults"] }) {
  const entries = cameraResults.flatMap((camera) => (camera.offlineImpactDetail ?? []).map((detail) => ({ cameraId: camera.cameraId, detail })));

  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Redundancy / Failure Review</h3>
        <ExplainBadge text="Shows which zones lose required quality when a single camera goes offline. Single points of failure are highlighted." />
      </div>
      <div className="mt-2 space-y-2">
        {entries.length === 0 ? <div className="text-[10px] text-[#7384a5]">No camera-offline degradation detected. All zones have redundant coverage.</div> : null}
        {entries.map(({ cameraId, detail }) => (
          <div key={`${cameraId}_${detail.zoneId}`} className="rounded-lg border border-[#232a3d] bg-[#0f1420] p-2">
            <div className="text-[10px] text-[#deebff]">{detail.label}</div>
            <div className="mt-1 text-[10px] text-[#8ea0bf]">
              If <span className="text-amber-300">{cameraId}</span> goes offline: {qualityLabel(detail.beforeQuality)} &rarr; <span className={detail.afterQuality === "none" ? "text-red-300" : "text-amber-300"}>{qualityLabel(detail.afterQuality)}</span>
            </div>
            <div className="mt-1 text-[10px] text-[#7384a5]">{detail.reason}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
