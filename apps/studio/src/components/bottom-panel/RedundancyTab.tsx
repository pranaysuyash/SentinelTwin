"use client";

import { QUALITY_ABBR, QUALITY_COLOR } from "@/lib/quality-display";
import { useStudioStore } from "@/store/studio-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return { ring: "#22c55e", text: "#4ade80" };
  if (score >= 50) return { ring: "#eab308", text: "#facc15" };
  return { ring: "#ef4444", text: "#f87171" };
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RedundancyTab() {
  const result     = useStudioStore((s) => s.simulationResult);
  const scene      = useStudioStore((s) => s.scene);
  const selectNode = useStudioStore((s) => s.selectNode);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center text-[#3a4158] text-[11px]">
        Run simulation to see redundancy matrix
      </div>
    );
  }

  const { cameras }       = scene;
  const { criticalZones } = scene;

  // Index simulation results for O(1) lookups
  const zoneResultMap = Object.fromEntries(
    result.criticalZoneResults.map((zr) => [zr.zoneId, zr]),
  );
  const camResultMap = Object.fromEntries(
    result.cameraResults.map((cr) => [cr.cameraId, cr]),
  );

  // ── Derived stats ───────────────────────────────────────────────────────────

  const spofZones = criticalZones.filter((z) => {
    const zr = zoneResultMap[z.id];
    return zr && zr.redundancyCameraCount === 1;
  });
  const uncoveredZones = criticalZones.filter((z) => {
    const zr = zoneResultMap[z.id];
    return !zr || zr.coveringCameras.length === 0;
  });
  const redundantZones = criticalZones.filter((z) => {
    const zr = zoneResultMap[z.id];
    return zr && zr.redundancyCameraCount >= 2;
  });

  const redundancyScore =
    criticalZones.length > 0
      ? Math.round((redundantZones.length / criticalZones.length) * 100)
      : 0;

  const { ring, text: scoreText } = scoreColor(redundancyScore);

  // Show SPOF sidebar only when there are single-point-of-failure zones
  const showSpofSidebar = spofZones.length > 0 || uncoveredZones.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-[#1e2130] bg-[#090c12] px-3 py-1">

        {/* Redundancy score ring */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2"
            style={{ borderColor: ring }}
          >
            <span className="font-mono text-[10px] font-bold" style={{ color: scoreText }}>
              {redundancyScore}
            </span>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-[#c7d0e4] leading-tight">Redundancy</div>
            <div className="text-[8px] text-[#4a5568]">% zones with 2+ cameras</div>
          </div>
        </div>

        <div className="h-5 w-px bg-[#1e2130]" />

        {/* Stat chips */}
        {([
          { label: "SPOF",       value: spofZones.length,      color: spofZones.length > 0      ? "text-red-400"     : "text-[#3a4158]" },
          { label: "Redundant",  value: redundantZones.length,  color: redundantZones.length > 0 ? "text-green-400"   : "text-[#3a4158]" },
          { label: "Uncovered",  value: uncoveredZones.length,  color: uncoveredZones.length > 0 ? "text-red-400"     : "text-[#3a4158]" },
          { label: "Cameras",    value: cameras.filter((c) => c.status === "on").length, color: "text-blue-300" },
          { label: "Zones",      value: criticalZones.length,   color: "text-[#c7d0e4]" },
        ] as const).map(({ label, value, color }) => (
          <div key={label} className="flex items-baseline gap-1">
            <span className={`font-mono text-[11px] font-bold ${color}`}>{value}</span>
            <span className="text-[8px] uppercase tracking-wide text-[#3a4158]">{label}</span>
          </div>
        ))}

        {/* Legend */}
        <div className="ml-auto flex items-center gap-2">
          {(["identification", "recognition", "observation", "detection"] as const).map((q) => (
            <div key={q} className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                style={{ backgroundColor: QUALITY_COLOR[q] }}
              />
              <span className="text-[7px] text-[#4a5568] capitalize">{QUALITY_ABBR[q]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm bg-[#1f2536]" />
            <span className="text-[7px] text-[#4a5568]">None</span>
          </div>
        </div>
      </div>

      {/* ── Content: matrix + SPOF sidebar ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Matrix scroll container */}
        <div className="flex-1 overflow-auto">
          {criticalZones.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[10px] text-[#3a4158]">
              Add critical zones to see the matrix
            </div>
          ) : (
            <table
              className="w-full border-collapse text-[9px]"
              style={{ minWidth: criticalZones.length * 60 + 150 }}
            >
              {/* Column headers: zone names */}
              <thead className="sticky top-0 z-10 bg-[#090c12]">
                <tr>
                  <th className="min-w-[130px] border-b border-r border-[#1e2130] px-2.5 py-1.5 text-left text-[8px] font-medium uppercase tracking-wider text-[#3a4158]">
                    Camera
                  </th>
                  {criticalZones.map((zone) => {
                    const zr = zoneResultMap[zone.id];
                    const coverCount = zr?.redundancyCameraCount ?? 0;
                    const isSPOF      = coverCount === 1;
                    const isUncovered = coverCount === 0;
                    return (
                      <th
                        key={zone.id}
                        className="min-w-[52px] max-w-[80px] border-b border-r border-[#1e2130] px-1 py-1"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className="max-w-[60px] truncate text-[8px] font-medium"
                            style={{
                              color: isUncovered ? "#ef4444"
                                   : isSPOF      ? "#f87171"
                                   : "#8090a8",
                            }}
                            title={zone.label}
                          >
                            {zone.label.length > 7 ? zone.label.slice(0, 6) + "…" : zone.label}
                          </span>
                          {isUncovered && (
                            <span className="text-[6px] font-bold uppercase tracking-wider text-red-500">NO CAM</span>
                          )}
                          {isSPOF && !isUncovered && (
                            <span className="text-[6px] font-bold uppercase tracking-wider text-red-400">SPOF</span>
                          )}
                          {coverCount >= 2 && (
                            <span className="text-[6px] font-semibold text-green-500">×{coverCount}</span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="min-w-[44px] border-b border-r border-[#1e2130] px-1.5 py-1 text-center text-[8px] font-medium uppercase tracking-wider text-[#3a4158]">
                    Solo
                  </th>
                  <th className="min-w-[48px] border-b border-[#1e2130] px-1.5 py-1 text-center text-[8px] font-medium uppercase tracking-wider text-[#3a4158]">
                    Cover
                  </th>
                </tr>
              </thead>

              {/* Camera rows */}
              <tbody>
                {cameras.map((camera) => {
                  const cr         = camResultMap[camera.id];
                  const isOffline  = camera.status !== "on";

                  // How many zones only THIS camera covers (sole provider)
                  const soloZones = criticalZones.filter((z) => {
                    const zr = zoneResultMap[z.id];
                    return zr && zr.coveringCameras.length === 1 && zr.coveringCameras[0] === camera.id;
                  });

                  return (
                    <tr
                      key={camera.id}
                      className="border-t border-[#181b26] transition-colors hover:bg-[#0d0f17]"
                    >
                      {/* Camera name cell */}
                      <td className="border-r border-[#1a1d26] px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => selectNode(camera.id)}
                          className="flex w-full items-center gap-1.5 text-left"
                        >
                          <span
                            className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isOffline ? "bg-red-500" : "bg-green-400"}`}
                          />
                          <span
                            className={`max-w-[100px] truncate text-[9px] font-medium ${isOffline ? "line-through text-[#4a5568]" : "text-[#c7d0e4]"}`}
                          >
                            {camera.name}
                          </span>
                        </button>
                      </td>

                      {/* Quality cells per zone */}
                      {criticalZones.map((zone) => {
                        const quality  = cr?.qualityByZone?.[zone.id];
                        const hasData  = quality && quality !== "none";
                        const meetsReq = cr?.criticalZonesCovered.includes(zone.id) ?? false;

                        if (!hasData) {
                          // Camera doesn't reach this zone
                          return (
                            <td
                              key={zone.id}
                              className="border-r border-[#1a1d26] px-1 py-1.5 text-center"
                            >
                              <div className="flex items-center justify-center">
                                <span className="flex h-5 w-5 items-center justify-center rounded bg-[#0b0e15] text-[7px] text-[#1e2536]">
                                  —
                                </span>
                              </div>
                            </td>
                          );
                        }

                        const color = QUALITY_COLOR[quality] ?? "#4a5568";
                        const abbr  = QUALITY_ABBR[quality] ?? "??";

                        return (
                          <td
                            key={zone.id}
                            className="border-r border-[#1a1d26] px-1 py-1.5 text-center"
                          >
                            <div className="flex items-center justify-center">
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded text-[7px] font-bold"
                                style={{
                                  backgroundColor: `${color}1a`,
                                  color,
                                  border: `1px solid ${color}55`,
                                  // Fade cells that don't meet zone requirement
                                  opacity: meetsReq ? 1 : 0.4,
                                }}
                                title={`${quality}${!meetsReq ? " (below requirement)" : " ✓"}`}
                              >
                                {abbr}
                              </span>
                            </div>
                          </td>
                        );
                      })}

                      {/* Solo-cover zone count */}
                      <td className="border-r border-[#1a1d26] px-1.5 py-1.5 text-center">
                        {soloZones.length > 0 ? (
                          <span className="font-mono text-[10px] font-bold text-red-400">
                            {soloZones.length}
                          </span>
                        ) : (
                          <span className="text-[9px] text-[#2a3246]">—</span>
                        )}
                      </td>

                      {/* Scene coverage % */}
                      <td className="px-1.5 py-1.5 text-center">
                        <span
                          className={`font-mono text-[10px] font-semibold ${
                            !cr          ? "text-[#3a4158]"
                            : cr.coveragePct >= 30 ? "text-emerald-300"
                            :                  "text-[#8090a8]"
                          }`}
                        >
                          {cr ? `${cr.coveragePct.toFixed(0)}%` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── SPOF sidebar ────────────────────────────────────────────── */}
        {showSpofSidebar && (
          <div className="flex w-[144px] flex-shrink-0 flex-col overflow-hidden border-l border-[#1e2130]">
            <div className="flex-shrink-0 border-b border-[#1e2130] px-2.5 py-1">
              <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-red-400">
                Vulnerable Zones
              </span>
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto px-2 py-1.5">
              {/* Uncovered first (worst) */}
              {uncoveredZones.map((zone) => (
                <div
                  key={zone.id}
                  className="rounded-lg border border-red-700/40 bg-red-900/15 p-1.5"
                >
                  <div className="text-[9px] font-semibold text-red-300 truncate">{zone.label}</div>
                  <div className="mt-0.5 text-[7px] font-bold uppercase tracking-wider text-red-500">
                    No camera
                  </div>
                </div>
              ))}

              {/* SPOF zones */}
              {spofZones.map((zone) => {
                const zr       = zoneResultMap[zone.id];
                const soleId   = zr?.coveringCameras[0];
                const soleName = cameras.find((c) => c.id === soleId)?.name ?? soleId ?? "—";
                return (
                  <div
                    key={zone.id}
                    className="rounded-lg border border-red-900/30 bg-red-900/10 p-1.5"
                  >
                    <div className="text-[9px] font-medium text-red-300 truncate">{zone.label}</div>
                    <div className="mt-0.5 text-[7px] text-[#4a5568] truncate">
                      Only: <span className="text-[#8090a8]">{soleName}</span>
                    </div>
                    {zr && (
                      <div className="mt-0.5 flex items-center gap-1">
                        <span
                          className="rounded px-1 py-0.5 text-[6px] font-bold uppercase"
                          style={{
                            backgroundColor: `${QUALITY_COLOR[zr.actualQuality] ?? "#4a5568"}22`,
                            color: QUALITY_COLOR[zr.actualQuality] ?? "#4a5568",
                          }}
                        >
                          {zr.actualQuality}
                        </span>
                        <span className="text-[6px] text-[#3a4158]">actual</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Redundant zones (positive signal) */}
              {redundantZones.length > 0 && (
                <div className="border-t border-[#1e2130] pt-1.5">
                  <div className="mb-1 text-[7px] font-semibold uppercase tracking-wider text-green-500">
                    Protected ({redundantZones.length})
                  </div>
                  {redundantZones.map((zone) => {
                    const zr = zoneResultMap[zone.id];
                    return (
                      <div key={zone.id} className="flex items-center justify-between gap-1 py-0.5">
                        <span className="truncate text-[8px] text-[#68738a]">{zone.label}</span>
                        <span className="flex-shrink-0 text-[7px] font-semibold text-green-500">
                          ×{zr?.redundancyCameraCount ?? 0}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
