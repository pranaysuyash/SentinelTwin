"use client";

import { MapPin } from "lucide-react";
import { PathMap } from "@/components/map/PathMap";
import { QUALITY_RANK } from "@/lib/quality-display";
import { useStudioStore } from "@/store/studio-store";

export function ScenarioPathPanel() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const runSimulation = useStudioStore((s) => s.runSimulation);
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
  const noSimulationYet = !result;

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
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4a5568]">Scenario / Path</div>
          <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Active Scenario</div>
        </div>
        <MapPin className="h-3 w-3 text-[#4a5568]" />
      </div>

      <div className="flex min-h-0 flex-1 gap-2 px-2.5 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            {hasActivePath ? null : (
              <div className="mb-2 rounded-lg border border-dashed border-[#26324a] bg-[#0a0d14] px-2.5 py-2 text-[9px] text-[#72809a]">
                No path created. Add a path to summarize route visibility and replay behavior.
              </div>
            )}
            {noSimulationYet ? (
              <div className="mb-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-2.5 py-2 text-[9px] text-amber-200">
                No simulation yet. Run the simulation to calculate path quality and visibility.
              </div>
            ) : null}

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
            {pathResult ? (
              <button
                type="button"
                onClick={() => setBottomTab("timeline")}
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-blue-500/25 bg-blue-500/8 px-2 py-1 text-[9px] font-medium text-blue-200 transition-colors hover:bg-blue-500/15"
              >
                Path Visibility Timeline
                <span className="text-[8px] text-blue-100/70">open</span>
              </button>
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
            {noSimulationYet ? (
              <button
                type="button"
                onClick={runSimulation}
                disabled={simulationRunning}
                className="mt-2 h-7 w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {simulationRunning ? "Running simulation..." : "Run Simulation"}
              </button>
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

          {activePath && (
            <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2 text-[9px] text-[#8c9bb4]">
              <div className="mb-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Current issue</div>
              {pathResult ? (
                <div className="space-y-1">
                  <div className="text-[#c7d0e4]">
                    {visiblePct === null
                      ? "Route summary is pending simulation."
                      : visiblePct >= 80
                        ? "Route stays visible for most of the walk."
                        : visiblePct >= 50
                          ? "Visibility drops in one or more segments."
                          : "Route has a significant visibility loss."}
                  </div>
                  <div className="text-[#72809a]">
                    Best camera {pathResult.visibilityByCamera && Object.entries(pathResult.visibilityByCamera).length > 0
                      ? Object.entries(pathResult.visibilityByCamera)
                        .sort((a, b) => {
                          const diff = (QUALITY_RANK[b[1]?.maxQuality ?? "none"] ?? 0) - (QUALITY_RANK[a[1]?.maxQuality ?? "none"] ?? 0);
                          if (diff !== 0) return diff;
                          return (b[1]?.visibleS ?? 0) - (a[1]?.visibleS ?? 0);
                        })[0]?.[0] ?? "unavailable"
                      : "unavailable"}
                  </div>
                </div>
              ) : (
                <div className="text-[#72809a]">Run simulation to populate route visibility details.</div>
              )}
            </div>
          )}
        </div>

        <PathMap />
      </div>
    </div>
  );
}
