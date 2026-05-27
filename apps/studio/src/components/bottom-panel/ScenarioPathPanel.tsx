"use client";

import { MapPin } from "lucide-react";
import { PathMap } from "@/components/map/PathMap";
import { useStudioStore } from "@/store/studio-store";

export function ScenarioPathPanel() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);
  const setActivePathId = useStudioStore((s) => s.setActivePathId);
  const setPathReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);
  const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setWorkspacePreset = useStudioStore((s) => s.setWorkspacePreset);
  const setBottomTab = useStudioStore((s) => s.setBottomTab);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);

  const activePath = scene.paths.find((path) => path.id === activePathId) ?? null;
  const pathResult = activePath ? result?.pathResults.find((entry) => entry.pathId === activePath.id) : null;
  const visiblePct = pathResult && pathResult.totalDurationS > 0
    ? Math.round((pathResult.visibleDurationS / pathResult.totalDurationS) * 100)
    : null;
  const hasActivePath = Boolean(activePath);

  const startReplay = () => {
    if (!activePath) return;
    setActivePathId(activePath.id);
    setPathReplayProgress(0);
    setPathReplayPlaying(true);
    setWorkspacePreset("replay");
    setViewMode("replay");
    setBottomTab("timeline");
  };

  const startPathEditing = () => {
    if (!activePath) return;
    setActivePathId(activePath.id);
    setPathReplayPlaying(false);
    setWorkspacePreset("edit");
    setViewMode("map");
    setBottomTab("timeline");
    setActiveTool("path");
  };

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
            <select
              className="flex h-8 w-full items-center justify-between rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
              value={activePathId ?? ""}
              onChange={(event) => {
                const next = event.target.value || null;
                setActivePathId(next);
                setPathReplayPlaying(false);
                setPathReplayProgress(0);
              }}
              aria-label="Select active path"
            >
              <option value="">No path selected</option>
              {scene.paths.map((path) => (
                <option key={path.id} value={path.id}>
                  {path.label}
                </option>
              ))}
            </select>
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
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!hasActivePath}
                onClick={startPathEditing}
                className="h-7 rounded-lg border border-[#24283a] bg-[#111521] px-2 text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Edit Path
              </button>
              <button
                type="button"
                disabled={!hasActivePath}
                onClick={startReplay}
                className="h-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Play Path
              </button>
            </div>
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
