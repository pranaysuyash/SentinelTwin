import type { SimulationResult } from "@/schema/security-scene";

export function RedundancyReview({ cameraResults }: { cameraResults: SimulationResult["cameraResults"] }) {
  const entries = cameraResults.flatMap((camera) => (camera.offlineImpactDetail ?? []).map((detail) => ({ cameraId: camera.cameraId, detail })));

  return (
    <section className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea0bf]">Redundancy / Failure Review</h3>
      <div className="mt-2 space-y-2">
        {entries.length === 0 ? <div className="text-[10px] text-[#7384a5]">No camera-offline degradation detected.</div> : null}
        {entries.map(({ cameraId, detail }, index) => (
          <div key={`${cameraId}_${detail.zoneId}_${index}`} className="rounded-lg border border-[#232a3d] bg-[#0f1420] p-2 text-[10px] text-[#d7deed]">
            {detail.label} depends on {cameraId}: {detail.beforeQuality} &rarr; {detail.afterQuality} ({detail.reason})
          </div>
        ))}
      </div>
    </section>
  );
}
