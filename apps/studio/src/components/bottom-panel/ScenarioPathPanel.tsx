"use client";

import { MapPin } from "lucide-react";

import { TruthBadge } from "@/components/shared/TruthBadge";
import { PathMap } from "@/components/map/PathMap";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { clampPathDuration } from "@/components/view/camera-view-utils";
import { QUALITY_RANK } from "@/lib/quality-display";
import { pathLength } from "@/components/workspace/editing/editor-geometry";
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

  const activePath = scene.paths.find((item) => item.id === activePathId) ?? null;
  const pathResult = activePath ? result?.pathResults.find((entry) => entry.pathId === activePath.id) : null;
  const safePathDurationS = clampPathDuration(pathResult?.totalDurationS);
  const activePathLengthM = activePath ? pathLength(activePath.points.map((point) => point.position)) : 0;
  const activePathEstimatedSeconds = activePath && activePath.speedMps > 0 ? activePathLengthM / activePath.speedMps : 0;
  const visiblePct = pathResult && safePathDurationS > 0
    ? Math.round((pathResult.visibleDurationS / safePathDurationS) * 100)
    : null;
  const bestCamera =
    pathResult?.visibilityByCamera && Object.entries(pathResult.visibilityByCamera).length > 0
      ? Object.entries(pathResult.visibilityByCamera)
          .sort((a, b) => {
            const diff = (QUALITY_RANK[b[1]?.maxQuality ?? "none"] ?? 0) - (QUALITY_RANK[a[1]?.maxQuality ?? "none"] ?? 0);
            if (diff !== 0) return diff;
            return (b[1]?.visibleS ?? 0) - (a[1]?.visibleS ?? 0);
          })[0]?.[0] ?? "unavailable"
      : "unavailable";
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

  const pathStartLabel = activePath?.points[0]?.action?.replaceAll("_", " ") ?? "Start";
  const pathEndLabel = activePath?.points.at(-1)?.action?.replaceAll("_", " ") ?? activePath?.labelDetail ?? "End";
  const activeIntent = activePath?.intent.replaceAll("_", " ") ?? "Scenario";
  const activeActor = activePath?.actorType.replaceAll("_", " ") ?? "Unknown";
  const activeTimeOfDay = activePath?.timeOfDay ?? "day";

  return (
    <div className="flex h-[208px] flex-shrink-0 flex-col border-t border-[#1e2130] bg-[#0d1017]">
      <div className="flex h-8 items-center justify-between border-b border-[#1e2130] px-3">
        <div className="flex items-center gap-2">
          <TruthBadge label="simulated" />
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4a5568]">Scenario / Path</div>
            <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Route analysis surface</div>
          </div>
        </div>
        <MapPin className="h-3 w-3 text-[#4a5568]" />
      </div>

      <div className="flex min-h-0 flex-1 gap-2 px-2.5 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            {!activePath ? (
              <div className="rounded-lg border border-dashed border-[#26324a] bg-[#0a0d14] px-2.5 py-2 text-[9px] text-[#72809a]">
                No path selected. Use the map picker to choose a route, then replay or edit it here.
              </div>
            ) : (
              <>
                {noSimulationYet ? (
                  <div className="mb-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-2.5 py-2 text-[9px] text-amber-200">
                    No simulation yet. Run the simulation to calculate route quality and visibility.
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Active Path</div>
                    <div className="truncate text-[12px] font-semibold text-[#d7deed]">{activePath.label}</div>
                    <div className="mt-0.5 text-[9px] text-[#8c9bb4]">
                      {activePath.labelDetail ?? `${activeActor} · ${activeIntent}`}
                    </div>
                  </div>
                  <div className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-right">
                    <div className="text-[8px] uppercase tracking-[0.16em] text-[#556076]">Actor</div>
                    <div className="text-[9px] font-medium text-[#c7d0e4]">{activeActor}</div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[9px] text-[#9ea8bf]">
                    {activeIntent}
                  </span>
                  <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[9px] text-[#9ea8bf]">
                    {activeActor}
                  </span>
                  <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[9px] text-[#9ea8bf]">
                    {activePath.speedMps.toFixed(1)} m/s
                  </span>
                  <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[9px] text-[#9ea8bf]">
                    {activeTimeOfDay}
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-[9px]">
                  <Metric label="Path Length" value={`${activePathLengthM.toFixed(1)}m`} />
                  <Metric label="Est. Time" value={activePathEstimatedSeconds > 0 ? `${activePathEstimatedSeconds.toFixed(1)}s` : "--"} />
                  <Metric
                    label="Visible"
                    value={visiblePct === null ? "--" : `${visiblePct}%`}
                    tone={
                      visiblePct === null
                        ? "text-[#d7deed]"
                        : visiblePct >= 80
                          ? "text-emerald-300"
                          : visiblePct >= 50
                            ? "text-amber-300"
                            : "text-rose-300"
                    }
                  />
                </div>

                <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0a0d14] px-2.5 py-2">
                  <div className="mb-1.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Route Summary</div>
                  <div className="flex items-center gap-2 text-[9px]">
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/8 px-1.5 py-0.5 text-emerald-200">
                      {pathStartLabel}
                    </span>
                    <span className="text-[#4a5568]">- Path -</span>
                    <span className="rounded-md border border-sky-500/20 bg-sky-500/8 px-1.5 py-0.5 text-sky-200">
                      {pathEndLabel}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[9px] text-[#9ea8bf]">
                      {activePath.points.length} waypoints
                    </span>
                    <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[9px] text-[#9ea8bf]">
                      {bestCamera === "unavailable" ? "no dominant camera" : `best: ${bestCamera}`}
                    </span>
                  </div>
                </div>
              </>
            )}

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
                disabled={!activePath}
                onClick={startPathEditing}
                className="h-7 rounded-lg border border-[#24283a] bg-[#111521] px-2 text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Edit Path
              </button>
              <button
                type="button"
                disabled={!activePath}
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

          {activePath ? (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Waypoints" value={activePath.points.length} />
              <Stat label="Path Duration" value={pathResult && safePathDurationS > 0 ? `${safePathDurationS.toFixed(1)}s` : "--"} />
              <Stat
                label="Visible"
                value={visiblePct === null ? "--" : `${visiblePct}%`}
                tone={
                  visiblePct === null
                    ? "text-[#d7deed]"
                    : visiblePct >= 80
                      ? "text-emerald-300"
                      : visiblePct >= 50
                        ? "text-amber-300"
                        : "text-rose-300"
                }
              />
            </div>
          ) : null}

          {!activePath && noSimulationYet ? (
            <RunSimulationPrompt
              className="rounded-xl border border-[#1f2536] bg-[#0b0f17] px-3 py-3"
              message="Run the shared simulation to populate route visibility details."
            />
          ) : null}
        </div>

        <PathMap />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "text-[#d7deed]",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-[#24283a] bg-[#111521] px-2 py-1.5">
      <div className="uppercase tracking-[0.16em] text-[#556076]">{label}</div>
      <div className={`mt-0.5 font-mono ${tone}`}>{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "text-[#d7deed]",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className={`text-[13px] font-semibold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[#556076]">{label}</div>
    </div>
  );
}
