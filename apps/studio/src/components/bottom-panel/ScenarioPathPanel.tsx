"use client";

import { ChevronDown, MapPin } from "lucide-react";

import { PathMap } from "@/components/map/PathMap";
import { useStudioStore } from "@/store/studio-store";

export function ScenarioPathPanel() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);

  const activePath = scene.paths.find((path) => path.id === activePathId) ?? scene.paths[0] ?? null;
  const pathResult = activePath ? result?.pathResults.find((entry) => entry.pathId === activePath.id) : null;
  const visiblePct = pathResult && pathResult.totalDurationS > 0
    ? Math.round((pathResult.visibleDurationS / pathResult.totalDurationS) * 100)
    : null;

  return (
    <div className="flex h-[208px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
      <div className="flex h-8 items-center justify-between border-b border-[#1e2130] px-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4a5568]">Scenario / Path</span>
        <MapPin className="h-3 w-3 text-[#4a5568]" />
      </div>

      <div className="flex min-h-0 flex-1 gap-2 px-2.5 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#556076]">Active Path</div>
            <button className="flex h-8 w-full items-center justify-between rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white">
              <span className="truncate">{activePath?.label ?? "No path defined"}</span>
              <ChevronDown className="h-3 w-3 flex-shrink-0 text-[#556076]" />
            </button>
            {activePath ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[9px] text-[#9ea8bf]">
                  {activePath.actorType}
                </span>
                <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[9px] text-[#9ea8bf]">
                  {activePath.intent.replace("_", " ")}
                </span>
                <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[9px] text-[#9ea8bf]">
                  {activePath.speedMps.toFixed(1)} m/s
                </span>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="text-[13px] font-semibold text-[#d7deed]">{activePath ? activePath.points.length : 0}</div>
              <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[#556076]">Waypoints</div>
            </div>
            <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className="text-[13px] font-semibold text-[#d7deed]">
                {pathResult ? `${pathResult.totalDurationS.toFixed(1)}s` : "--"}
              </div>
              <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[#556076]">Path Duration</div>
            </div>
            <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div className={
                "text-[13px] font-semibold " +
                (visiblePct === null
                  ? "text-[#d7deed]"
                  : visiblePct >= 80
                    ? "text-emerald-300"
                    : visiblePct >= 50
                      ? "text-amber-300"
                      : "text-rose-300")
              }>
                {visiblePct === null ? "--" : `${visiblePct}%`}
              </div>
              <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[#556076]">Visible</div>
            </div>
          </div>
        </div>

        <PathMap />
      </div>
    </div>
  );
}
