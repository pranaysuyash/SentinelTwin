"use client";

import { MapPin } from "lucide-react";
import { useMemo } from "react";

import { TruthBadge } from "@/components/shared/TruthBadge";
import { PathMap } from "@/components/map/PathMap";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { clampPathDuration } from "@/components/view/camera-view-utils";
import { QUALITY_RANK } from "@/lib/quality-display";
import type { CameraNode } from "@/schema/security-scene";
import { pathLength } from "@/components/workspace/editing/editor-geometry";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

const STATUS_COLOR: Record<CameraNode["status"], { bg: string; text: string; label: string }> = {
  on:             { bg: "bg-emerald-500/15", text: "text-emerald-300", label: "Online" },
  off:            { bg: "bg-zinc-500/15",    text: "text-zinc-400",    label: "Offline" },
  blocked:        { bg: "bg-rose-500/15",    text: "text-rose-300",    label: "Blocked" },
  dirty:          { bg: "bg-amber-500/15",   text: "text-amber-300",   label: "Dirty" },
  malfunctioning: { bg: "bg-red-500/15",     text: "text-red-300",     label: "Malfunction" },
};

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
    <div className={`{flex h-[208px] flex-shrink-0 flex-col border-t ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeep}}`}>
      <div className={`{flex h-8 items-center justify-between border-b ${UI_SURFACES.borderPanel} px-3}`}>
        <div className="flex items-center gap-2">
          <TruthBadge label="simulated" />
          <div>
            <div className={`text-[9px] font-semibold uppercase tracking-[0.22em] ${UI_SURFACES.textMuted}`}>Scenario / Path</div>
            <div className={`text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Route analysis surface</div>
          </div>
        </div>
        <MapPin className={`h-3 w-3 ${UI_SURFACES.textMuted}`} />
      </div>

      <div className="flex min-h-0 flex-1 gap-2 px-2.5 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
            {!activePath ? (
              <div className={`rounded-lg border border-dashed border-[#26324a] ${UI_SURFACES.panelDeepAlt} px-2.5 py-2 text-[9px] text-[#72809a]`}>
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
                    <div className={`text-[8px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Active Path</div>
                    <div className={`truncate text-[12px] font-semibold ${UI_SURFACES.textNear}`}>{activePath.label}</div>
                    <div className="mt-0.5 text-[9px] text-[#8c9bb4]">
                      {activePath.labelDetail ?? `${activeActor} · ${activeIntent}`}
                    </div>
                  </div>
                  <div className={`rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1 text-right`}>
                    <div className={`text-[8px] uppercase tracking-[0.16em] ${UI_SURFACES.textDimMid}`}>Actor</div>
                    <div className={`text-[9px] font-medium ${UI_SURFACES.textBody}`}>{activeActor}</div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-1.5 py-1 text-[9px] ${UI_SURFACES.textSoftMuted}`}>
                    {activeIntent}
                  </span>
                  <span className={`rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-1.5 py-1 text-[9px] ${UI_SURFACES.textSoftMuted}`}>
                    {activeActor}
                  </span>
                  <span className={`rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-1.5 py-1 text-[9px] ${UI_SURFACES.textSoftMuted}`}>
                    {activePath.speedMps.toFixed(1)} m/s
                  </span>
                  <span className={`rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-1.5 py-1 text-[9px] ${UI_SURFACES.textSoftMuted}`}>
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
                        ? "${UI_SURFACES.textNear}"
                        : visiblePct >= 80
                          ? "text-emerald-300"
                          : visiblePct >= 50
                            ? "text-amber-300"
                            : "text-rose-300"
                    }
                  />
                </div>

                <div className={`mt-2 rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panelDeepAlt} px-2.5 py-2`}>
                  <div className={`mb-1.5 text-[8px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Route Summary</div>
                  <div className="flex items-center gap-2 text-[9px]">
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/8 px-1.5 py-0.5 text-emerald-200">
                      {pathStartLabel}
                    </span>
                    <span className={`${UI_SURFACES.textMuted}`}>- Path -</span>
                    <span className="rounded-md border border-sky-500/20 bg-sky-500/8 px-1.5 py-0.5 text-sky-200">
                      {pathEndLabel}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className={`rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-1.5 py-1 text-[9px] ${UI_SURFACES.textSoftMuted}`}>
                      {activePath.points.length} waypoints
                    </span>
                    <span className={`rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-1.5 py-1 text-[9px] ${UI_SURFACES.textSoftMuted}`}>
                      {bestCamera === "unavailable" ? "no dominant camera" : `best: ${bestCamera}`}
                    </span>
                  </div>
                </div>

                {pathResult && <RouteCameraHealthStrip />}
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
                className={`h-7 rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 text-[10px] font-medium ${UI_SURFACES.textBody} transition-colors ${UI_SURFACES.hoverBorderSubtle} hover:text-white disabled:cursor-not-allowed disabled:opacity-40`}
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
                    ? "${UI_SURFACES.textNear}"
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
              className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-3 py-3`}
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
  tone = "${UI_SURFACES.textNear}",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className={`rounded-lg border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1.5`}>
      <div className={`uppercase tracking-[0.16em] ${UI_SURFACES.textDimMid}`}>{label}</div>
      <div className={`mt-0.5 font-mono ${tone}`}>{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "${UI_SURFACES.textNear}",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}>
      <div className={`text-[13px] font-semibold ${tone}`}>{value}</div>
      <div className={`mt-0.5 text-[8px] uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>{label}</div>
    </div>
  );
}

function RouteCameraHealthStrip() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);

  const routeCameras = useMemo(() => {
    const pathResult = result?.pathResults.find((r) => r.pathId === activePathId);
    if (!pathResult?.visibilityByCamera) return [];

    const cameraMap = new Map(scene.cameras.map((c) => [c.id, c]));

    return Object.entries(pathResult.visibilityByCamera)
      .map(([camId, vis]) => {
        const cam = cameraMap.get(camId);
        if (!cam) return null;
        return { cam, visibleS: vis.visibleS, maxQuality: vis.maxQuality };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.visibleS - a.visibleS);
  }, [scene.cameras, result, activePathId]);

  if (routeCameras.length === 0) return null;

  const degradedCount = routeCameras.filter((c) => c.cam.status !== "on").length;

  return (
    <div className={`mt-2 rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panelDeepAlt} px-2.5 py-2`}>
      <div className="mb-1.5 flex items-center justify-between">
        <div className={`text-[8px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>
          Route Camera Health
        </div>
        {degradedCount > 0 && (
          <span className="rounded-md border border-amber-500/20 bg-amber-500/8 px-1.5 py-0.5 text-[8px] text-amber-200">
            {degradedCount} degraded
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {routeCameras.map(({ cam, visibleS, maxQuality }) => {
          const st = STATUS_COLOR[cam.status];
          return (
            <div
              key={cam.id}
              className={`flex items-center gap-1.5 rounded-md border ${UI_SURFACES.borderThin} ${st.bg} px-1.5 py-1`}
              title={`${cam.name}: ${st.label} · ${cam.clarity} clarity · ${visibleS.toFixed(1)}s visible · best ${maxQuality}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${cam.status === "on" ? "bg-emerald-400" : cam.status === "off" ? "bg-zinc-500" : "bg-amber-400"}`} />
              <span className={`text-[9px] font-medium ${st.text}`}>
                {cam.name.length > 14 ? cam.name.slice(0, 12) + "…" : cam.name}
              </span>
              <span className={`text-[8px] ${UI_SURFACES.textDimMid}`}>{maxQuality}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
