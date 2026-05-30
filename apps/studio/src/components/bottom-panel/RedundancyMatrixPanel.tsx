"use client";

import { Loader2, ShieldAlert, Zap } from "lucide-react";

import { useStudioStore } from "@/store/studio-store";
import { cn } from "@/lib/cn";

export function RedundancyMatrixPanel() {
  const result = useStudioStore((s) => s.simulationResult);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const runSimulation = useStudioStore((s) => s.runSimulation);
  const scene = useStudioStore((s) => s.scene);
  const selectNode = useStudioStore((s) => s.selectNode);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const selectedCameraId = useStudioStore((s) => s.selectedCameraId);

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="text-[11px] text-[#3a4158]">
          Run the shared simulation to compute redundancy analysis from the current scene.
        </div>
        <button
          type="button"
          onClick={runSimulation}
          disabled={simulationRunning}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-3 py-2 text-[10px] font-medium text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {simulationRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {simulationRunning ? "Running..." : "Run Simulation"}
        </button>
      </div>
    );
  }

  const cameras = scene.cameras;
  const zones = scene.criticalZones;

  if (cameras.length === 0 || zones.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <ShieldAlert className="h-5 w-5 text-[#3a4158]" />
        <div className="text-[10px] text-[#4a5568]">
          {cameras.length === 0 ? "No cameras in scene" : "No critical zones defined"}
        </div>
      </div>
    );
  }

  // Build matrix: for each camera, which zones would lose coverage if it fails
  const cameraResults = result.cameraResults;
  const focusedCameraId = scene.cameras.some((camera) => camera.id === selectedNodeId)
    ? selectedNodeId
    : selectedCameraId;
  const matrix = cameras.map((cam) => {
    const camResult = cameraResults.find((r) => r.cameraId === cam.id);
    const coveredZones = camResult?.criticalZonesCovered ?? [];
    return {
      cameraId: cam.id,
      cameraName: cam.name,
      isOffline: cam.status !== "on",
      coveragePct: camResult?.coveragePct ?? 0,
      coveredZones,
      // Which zones have this camera as their ONLY coverage?
      soleCoverageZones: coveredZones.filter((zoneId) => {
        const otherCams = cameras.filter((c) => c.id !== cam.id);
        return !otherCams.some((otherCam) => {
          const otherResult = cameraResults.find((r) => r.cameraId === otherCam.id);
          return otherResult?.criticalZonesCovered.includes(zoneId);
        });
      }),
    };
  }).sort((a, b) => {
    if (focusedCameraId && a.cameraId === focusedCameraId) return -1;
    if (focusedCameraId && b.cameraId === focusedCameraId) return 1;
    const soleDelta = b.soleCoverageZones.length - a.soleCoverageZones.length;
    if (soleDelta !== 0) return soleDelta;
    return b.coveragePct - a.coveragePct;
  });

  const criticalityScore = (cam: typeof matrix[number]) => {
    const soleCount = cam.soleCoverageZones.length;
    const coverageWeight = cam.coveragePct / 15;
    return Math.min(10, Math.round(soleCount * 3 + coverageWeight));
  };
  const focusedCamera = focusedCameraId ? matrix.find((cam) => cam.cameraId === focusedCameraId) ?? null : null;
  const focusedCameraResult = focusedCameraId ? cameraResults.find((entry) => entry.cameraId === focusedCameraId) ?? null : null;
  const focusedImpactDetail = focusedCameraResult?.offlineImpactDetail ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Summary bar */}
      <div className="flex items-center gap-3 border-b border-[#1e2130] bg-[#0d1017] px-3 py-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">
          Redundancy Matrix
        </span>
        <span className="text-[9px] text-[#6a748b]">
          {cameras.length} cameras × {zones.length} zones
        </span>
        <span className="ml-auto text-[9px] text-[#4a5568]">
          {matrix.filter((c) => c.soleCoverageZones.length === 0).length} redundant
        </span>
      </div>

      {focusedCamera ? (
        <div className="border-b border-[#1e2130] bg-[#0b0f17] px-3 py-2">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <div className="text-[8px] font-semibold uppercase tracking-[0.2em] text-[#7dd3fc]">
                Selected Camera Impact
              </div>
              <div className="mt-1 text-[11px] font-semibold text-[#e2e8f7]">
                {scene.cameras.find((camera) => camera.id === focusedCamera.cameraId)?.name ?? focusedCamera.cameraName}
                {focusedCamera.isOffline ? <span className="ml-2 rounded bg-red-900/30 px-1.5 py-0.5 text-[8px] font-semibold text-red-300">OFFLINE</span> : null}
              </div>
              <div className="mt-0.5 text-[9px] text-[#6a748b]">
                If this camera fails, these zones lose their only backup.
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#4a5568]">Single-point zones</div>
              <div className="mt-0.5 text-[18px] font-bold text-red-300">{focusedCamera.soleCoverageZones.length}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {focusedImpactDetail.length > 0 ? (
              focusedImpactDetail.map((entry) => (
                <span key={entry.zoneId} className="rounded bg-red-900/35 px-1.5 py-0.5 text-[8px] font-medium text-red-300" title={entry.reason}>
                  {entry.label}
                </span>
              ))
            ) : focusedCamera.soleCoverageZones.length > 0 ? (
              focusedCamera.soleCoverageZones.map((zoneId) => (
                <span key={zoneId} className="rounded bg-red-900/35 px-1.5 py-0.5 text-[8px] font-medium text-red-300">
                  {zones.find((zone) => zone.id === zoneId)?.label ?? zoneId}
                </span>
              ))
            ) : (
              <span className="rounded bg-emerald-900/25 px-1.5 py-0.5 text-[8px] font-medium text-emerald-300">
                No zones would be lost by this camera alone
              </span>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1.5">
          {matrix.map((cam) => {
            const crit = criticalityScore(cam);
            const critLabel = crit >= 7 ? "Critical" : crit >= 4 ? "Important" : "Redundant";
            const critColor = crit >= 7 ? "text-red-400" : crit >= 4 ? "text-amber-400" : "text-green-400";
            const critBorder = crit >= 7 ? "border-red-500/30" : crit >= 4 ? "border-amber-500/30" : "border-green-500/30";
            const critBg = crit >= 7 ? "bg-red-500/8" : crit >= 4 ? "bg-amber-500/8" : "bg-green-500/8";

            return (
              <div
                key={cam.cameraId}
                className={cn(
                  "rounded-lg border p-2.5 transition-colors",
                  focusedCameraId === cam.cameraId ? "ring-1 ring-sky-400/35" : "",
                  cam.isOffline ? "opacity-80" : "",
                  critBorder,
                  critBg,
                )}
              >
                {/* Header row */}
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => selectNode(cam.cameraId)}
                    className={cn(
                      "truncate text-[11px] font-semibold hover:text-blue-400",
                      cam.isOffline ? "text-[#7a869e] line-through" : "text-[#c7d0e4]",
                    )}
                  >
                    {cam.cameraName}
                  </button>
                  <span className={cn("ml-auto text-[9px] font-semibold", critColor)}>
                    {critLabel} ({crit}/10)
                  </span>
                </div>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", cam.isOffline ? "bg-red-500" : "bg-green-400")} />
                  <span className="text-[8px] text-[#6a748b]">{cam.isOffline ? "Offline" : "Online"}</span>
                </div>

                {/* Zone chips */}
                <div className="flex flex-wrap gap-1">
                  {zones.map((zone) => {
                    const isCovered = cam.coveredZones.includes(zone.id);
                    const isSole = cam.soleCoverageZones.includes(zone.id);

                    if (!isCovered) {
                      return (
                        <span
                          key={zone.id}
                          className="rounded bg-[#111521] px-1.5 py-0.5 text-[8px] text-[#3a4158] line-through"
                        >
                          {zone.label}
                        </span>
                      );
                    }

                    return (
                      <span
                        key={zone.id}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[8px] font-medium",
                          isSole
                            ? "bg-red-900/40 text-red-300"
                            : "bg-green-900/30 text-green-400",
                        )}
                        title={isSole ? "Single point of failure — no backup camera covers this zone" : "Redundant — backup camera exists"}
                      >
                        {zone.label}
                        {isSole && " ⚠"}
                      </span>
                    );
                  })}
                </div>

                {/* Stats */}
                <div className="mt-2 flex items-center gap-3 text-[8px] text-[#4a5568]">
                  <span>
                    Coverage: <span className="text-[#8090a8]">{cam.coveragePct.toFixed(1)}%</span>
                  </span>
                  <span>
                    Zones: <span className="text-[#8090a8]">{cam.coveredZones.length}</span>
                  </span>
                  <span>
                    Single-point: <span className="text-red-400">{cam.soleCoverageZones.length}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 border-t border-[#1e2130] px-3 py-1.5 text-[8px] text-[#3a4158]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-green-900/40" /> Redundant
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-red-900/50" /> Single point of failure
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded bg-[#111521]" /> Not covered
        </span>
      </div>
    </div>
  );
}
