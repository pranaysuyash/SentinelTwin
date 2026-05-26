"use client";

import { DonutChart } from "@/components/shared/DonutChart";
import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";

const QUALITY_LABEL: Record<string, string> = {
  identification: "IDENT",
  recognition: "RECOG",
  observation: "OBS",
  detection: "DETECT",
  none: "—",
};

const QUALITY_COLOR: Record<string, string> = {
  identification: "text-blue-300",
  recognition: "text-green-300",
  observation: "text-yellow-300",
  detection: "text-orange-300",
  none: "text-[#4a5568]",
};

export function CameraStatusSummaryPanel() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const selectNode = useStudioStore((s) => s.selectNode);

  const activeCams = scene.cameras.filter((c) => c.status === "on").length;
  const offlineCams = scene.cameras.filter((c) => c.status !== "on").length;
  const coveragePct = result?.totalCoveragePct ?? 0;
  const zonesPass = result?.criticalZoneResults.filter((z) => z.status === "pass").length ?? 0;
  const zonesTotal = result?.criticalZoneResults.length ?? 0;

  const coverageColor =
    coveragePct > 80 ? "#22c55e" : coveragePct > 60 ? "#f97316" : "#ef4444";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Camera Status Table */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden border-r border-[#1e2130]">
        <div className="flex items-center gap-2 border-b border-[#1e2130] px-3 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#5a6478]">
            Camera Status Summary
          </span>
          <span className="ml-auto text-[9px] text-[#3a4158]">
            {activeCams} active · {offlineCams} offline
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead className="sticky top-0 bg-[#0b0f17]">
              <tr>
                {["Tag", "Status", "Quality", "Coverage", "FOV", "Mount"].map((h) => (
                  <th
                    key={h}
                    className="py-1 px-2 text-left text-[8px] font-semibold uppercase tracking-wider text-[#3a4158] border-b border-[#1e2130]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scene.cameras.map((cam) => {
                const camResult = result?.cameraResults.find((r) => r.cameraId === cam.id);
                // Derive best quality across all zones
                const qualityValues = Object.values(camResult?.qualityByZone ?? {});
                const QUALITY_RANK: Record<string, number> = { none: 0, detection: 1, observation: 2, recognition: 3, identification: 4 };
                const quality = qualityValues.reduce<string>((best, q) => (QUALITY_RANK[q] ?? 0) > (QUALITY_RANK[best] ?? 0) ? q : best, "none");
                const coverage = camResult ? `${camResult.coveragePct.toFixed(0)}%` : "—";
                const isActive = cam.status === "on";
                const isSelected = cam.id === selectedId;

                return (
                  <tr
                    key={cam.id}
                    onClick={() => selectNode(cam.id)}
                    className={cn(
                      "cursor-pointer border-b border-[#181b26] transition-colors",
                      isSelected
                        ? "bg-blue-500/8"
                        : "hover:bg-[#0e1219]",
                    )}
                  >
                    <td className="py-1.5 px-2">
                      <span className={cn(
                        "font-medium",
                        isSelected ? "text-blue-300" : "text-[#c7d0e4]",
                      )}>
                        {cam.name}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[8px] font-semibold",
                          isActive
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isActive ? "bg-emerald-400" : "bg-red-400",
                          )}
                        />
                        {isActive ? "LIVE" : "OFFLINE"}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={cn("font-medium", QUALITY_COLOR[quality])}>
                        {QUALITY_LABEL[quality]}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-[#c7d0e4]">{coverage}</td>
                    <td className="py-1.5 px-2 text-[#8090a8]">{cam.fovHorizontalDeg}°</td>
                    <td className="py-1.5 px-2 text-[#8090a8] capitalize">{cam.mountType}</td>
                  </tr>
                );
              })}
              {scene.cameras.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[10px] text-[#3a4158]">
                    No cameras in scene
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Coverage Summary */}
      <div className="flex w-[220px] flex-shrink-0 flex-col gap-2 p-2.5 overflow-y-auto">
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#5a6478]">
          Coverage of Total Floorspace
        </div>

        {result ? (
          <>
            <div className="flex items-center justify-center py-1">
              <DonutChart
                value={coveragePct}
                size={72}
                strokeWidth={7}
                color={coverageColor}
                label={`${Math.round(coveragePct)}%`}
                sublabel="Walkable"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5 text-center">
                <div className="text-[15px] font-bold text-green-300">{activeCams}</div>
                <div className="text-[8px] uppercase tracking-wide text-[#4a5568]">Active</div>
              </div>
              <div className="rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5 text-center">
                <div className="text-[15px] font-bold text-red-300">{offlineCams}</div>
                <div className="text-[8px] uppercase tracking-wide text-[#4a5568]">Offline</div>
              </div>
              <div className="rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5 text-center">
                <div className="text-[15px] font-bold text-blue-300">{zonesPass}</div>
                <div className="text-[8px] uppercase tracking-wide text-[#4a5568]">Zones ✓</div>
              </div>
              <div className="rounded-lg border border-[#1f2536] bg-[#111521] px-2 py-1.5 text-center">
                <div className="text-[15px] font-bold text-[#c7d0e4]">{zonesTotal}</div>
                <div className="text-[8px] uppercase tracking-wide text-[#4a5568]">Total Zones</div>
              </div>
            </div>

            {result.criticalZoneResults.map((z) => (
              <div
                key={z.zoneId}
                className={cn(
                  "rounded-lg border px-2 py-1.5",
                  z.status === "pass"
                    ? "border-emerald-500/20 bg-emerald-500/8"
                    : "border-red-500/20 bg-red-500/8",
                )}
              >
                <div className="text-[9px] font-medium text-[#c7d0e4]">{z.label}</div>
                <div
                  className={cn(
                    "text-[8px] font-semibold",
                    z.status === "pass" ? "text-emerald-300" : "text-red-300",
                  )}
                >
                  {z.actualQuality.toUpperCase()} · {z.status === "pass" ? "PASS" : "FAIL"}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[10px] text-[#3a4158]">
            Run simulation to see metrics
          </div>
        )}
      </div>
    </div>
  );
}
