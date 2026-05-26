"use client";

import { GitCompare } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";

export function BeforeAfterTab() {
  const snapshots = useStudioStore((s) => s.snapshots);

  if (snapshots.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <GitCompare className="w-8 h-8 text-[#1e2130]" />
        <div>
          <div className="text-[11px] text-[#4a5568] font-medium">No comparison available</div>
          <div className="text-[9px] text-[#3a4158] mt-1">
            Save at least 2 snapshots to compare before/after states.
          </div>
        </div>
      </div>
    );
  }

  const before = snapshots[snapshots.length - 2]!;
  const after  = snapshots[snapshots.length - 1]!;

  const beforeCov = before.simulation?.totalCoveragePct ?? 0;
  const afterCov  = after.simulation?.totalCoveragePct  ?? 0;
  const delta     = afterCov - beforeCov;

  return (
    <div className="h-full flex overflow-hidden px-3 py-2 gap-4">
      {([
        { label: "BEFORE", snap: before, cov: beforeCov },
        { label: "AFTER",  snap: after,  cov: afterCov  },
      ] as const).map(({ label, snap, cov }) => (
        <div key={label} className="flex-1 flex flex-col border border-[#1e2130] rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#1e2130] bg-[#0d0f17]">
            <span className="text-[9px] font-semibold tracking-widest text-[#4a5568]">{label}</span>
            <span className="text-[9px] text-[#68738a]">{snap.label}</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-[32px] font-bold text-white">
                {Math.round(cov)}%
              </div>
              <div className="text-[9px] text-[#4a5568]">Total Coverage</div>
              <div className="mt-2 text-[9px] text-[#68738a]">
                Issues: {snap.simulation?.issues.length ?? 0}{" "}
                Zones: {snap.simulation?.criticalZoneResults.filter((z) => z.status === "pass").length ?? 0}/
                {snap.simulation?.criticalZoneResults.length ?? 0}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-col items-center justify-center min-w-[80px]">
        <div className={`text-[24px] font-bold ${delta >= 0 ? "text-green-400" : "text-red-400"}`}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
        </div>
        <div className="text-[9px] text-[#4a5568] mt-0.5">Coverage</div>
      </div>
    </div>
  );
}
