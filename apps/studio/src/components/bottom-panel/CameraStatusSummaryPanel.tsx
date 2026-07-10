"use client";

import { DonutChart } from "@/components/shared/DonutChart";
import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { TruthBadge } from "@/components/shared/TruthBadge";
import { cn } from "@/lib/cn";
import { QUALITY_RANK, QUALITY_SHORT_LABEL, QUALITY_TEXT_COLOR } from "@/lib/quality-display";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

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
      <div className={`{flex flex-1 min-w-0 flex-col overflow-hidden border-r ${UI_SURFACES.borderPanel}}`}>
        <div className={`{flex items-center gap-2 border-b ${UI_SURFACES.borderPanel} px-3 py-1.5}`}>
          <TruthBadge label="simulated" />
          <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textMuted7}`}>
            Camera Status Summary
          </span>
          <span className={`ml-auto text-[9px] ${UI_SURFACES.textDim}`}>
            {activeCams} active · {offlineCams} offline
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!result ? (
            <RunSimulationPrompt
              className="h-full px-4 py-6"
              message="Run the shared simulation to populate the camera health table and coverage summary."
            />
          ) : (
            <table className="w-full text-[10px] border-collapse">
            <thead className={`sticky top-0 ${UI_SURFACES.panel}`}>
              <tr>
                {["Tag", "Status", "Quality", "Coverage", "FOV", "Mount"].map((h) => (
                  <th
                    key={h}
                    className={`{py-1 px-2 text-left text-[8px] font-semibold uppercase tracking-wider ${UI_SURFACES.textDim} border-b ${UI_SURFACES.borderPanel}}`}
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
                const qualityValues = Object.values(camResult?.qualityByZone ?? {}) as string[];
                const quality = qualityValues.reduce<string>((best, q) => (QUALITY_RANK[q as keyof typeof QUALITY_RANK] ?? 0) > (QUALITY_RANK[best as keyof typeof QUALITY_RANK] ?? 0) ? q : best, "none");
                const coverage = camResult ? `${camResult.coveragePct.toFixed(0)}%` : "—";
                const isActive = cam.status === "on";
                const isSelected = cam.id === selectedId;

                return (
                  <tr
                    key={cam.id}
                    onClick={() => selectNode(cam.id)}
                    className={cn(
                      "cursor-pointer border-b ${UI_SURFACES.borderFaint} transition-colors",
                      isSelected
                        ? "bg-blue-500/8"
                        : "${UI_SURFACES.hoverBgMuted}",
                    )}
                  >
                    <td className="py-1.5 px-2">
                      <span className={cn(
                        "font-medium",
                        isSelected ? "text-blue-300" : `${UI_SURFACES.textBody}`,
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
                      <span className={cn("font-medium", QUALITY_TEXT_COLOR[quality as keyof typeof QUALITY_TEXT_COLOR])}>
                        {QUALITY_SHORT_LABEL[quality as keyof typeof QUALITY_SHORT_LABEL]}
                      </span>
                    </td>
                    <td className={`py-1.5 px-2 ${UI_SURFACES.textBody}`}>{coverage}</td>
                    <td className={`py-1.5 px-2 ${UI_SURFACES.textMuted5}`}>{cam.fovHorizontalDeg}°</td>
                    <td className={`py-1.5 px-2 ${UI_SURFACES.textMuted5} capitalize`}>{cam.mountType}</td>
                  </tr>
                );
              })}
              {scene.cameras.length === 0 && (
                <tr>
                  <td colSpan={6} className={`py-6 text-center text-[10px] ${UI_SURFACES.textDim}`}>
                    No cameras in scene
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right: Coverage Summary */}
      <div className="flex w-[220px] flex-shrink-0 flex-col gap-2 p-2.5 overflow-y-auto">
        <div className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textMuted7}`}>
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
              <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.card} px-2 py-1.5 text-center`}>
                <div className="text-[15px] font-bold text-green-300">{activeCams}</div>
                <div className={`text-[8px] uppercase tracking-wide ${UI_SURFACES.textMuted}`}>Active</div>
              </div>
              <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.card} px-2 py-1.5 text-center`}>
                <div className="text-[15px] font-bold text-red-300">{offlineCams}</div>
                <div className={`text-[8px] uppercase tracking-wide ${UI_SURFACES.textMuted}`}>Offline</div>
              </div>
              <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.card} px-2 py-1.5 text-center`}>
                <div className="text-[15px] font-bold text-blue-300">{zonesPass}</div>
                <div className={`text-[8px] uppercase tracking-wide ${UI_SURFACES.textMuted}`}>Zones ✓</div>
              </div>
              <div className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.card} px-2 py-1.5 text-center`}>
                <div className={`text-[15px] font-bold ${UI_SURFACES.textBody}`}>{zonesTotal}</div>
                <div className={`text-[8px] uppercase tracking-wide ${UI_SURFACES.textMuted}`}>Total Zones</div>
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
                <div className={`text-[9px] font-medium ${UI_SURFACES.textBody}`}>{z.label}</div>
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
          <div className={`flex flex-1 items-center justify-center text-[10px] ${UI_SURFACES.textDim}`}>
            Run simulation to see metrics
          </div>
        )}
      </div>
    </div>
  );
}
