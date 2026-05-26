"use client";

import { ChevronDown, MapPin, Play, Edit3, Timer, Route } from "lucide-react";

import type { DoriQuality } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

const QUALITY_COLORS: Record<DoriQuality, string> = {
  identification: "#3b82f6",
  recognition: "#22c55e",
  observation: "#eab308",
  detection: "#f97316",
  none: "#ef4444",
};

function nearestQuality(
  point: [number, number],
  cells: { x: number; z: number; quality: DoriQuality }[],
): DoriQuality {
  if (cells.length === 0) return "none";

  let best = cells[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const cell of cells) {
    const dx = point[0] - cell.x;
    const dz = point[1] - cell.z;
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cell;
    }
  }

  return best.quality;
}

export function ScenarioPathPanel() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);

  const activePath = scene.paths[0];
  const pathResult = activePath ? result?.pathResults.find((path) => path.pathId === activePath.id) : null;
  const coverageCells = result?.coverageCells ?? [];

  const pathLengthM = activePath
    ? activePath.points.reduce((total, point, index) => {
        if (index === 0) return 0;
        const prev = activePath.points[index - 1]!;
        const dx = point.position[0] - prev.position[0];
        const dz = point.position[1] - prev.position[1];
        return total + Math.sqrt(dx * dx + dz * dz);
      }, 0)
    : 0;

  const estTimeSec = activePath ? pathLengthM / activePath.speedMps : 0;
  const visiblePct = pathResult && pathResult.totalDurationS > 0
    ? Math.round((pathResult.visibleDurationS / pathResult.totalDurationS) * 100)
    : null;

  const sceneW = scene.dimensions.width;
  const sceneH = scene.dimensions.depth;
  const SVG_W = 184;
  const SVG_H = 118;
  const toSvg = (x: number, z: number) => ({
    x: (x / sceneW) * SVG_W,
    y: (z / sceneH) * SVG_H,
  });

  const pointQualities = activePath
    ? activePath.points.map((point) => nearestQuality(point.position, coverageCells))
    : [];

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
            {activePath && (
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
            )}
          </div>

          {activePath && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <div className="text-[13px] font-semibold text-[#d7deed]">{pathLengthM.toFixed(1)} m</div>
                <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[#556076]">Path Length</div>
              </div>
              <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <div className="text-[13px] font-semibold text-[#d7deed]">{estTimeSec.toFixed(1)} sec</div>
                <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[#556076]">Est. Time</div>
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
          )}

          <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Coverage Ribbon</span>
              {pathResult ? <span className="text-[9px] text-[#8f9bb1]">{pathResult.timeline.length} events</span> : <Timer className="h-3 w-3 text-[#4a5568]" />}
            </div>

            {activePath && pointQualities.length > 0 ? (
              <div>
                <div className="flex h-3 overflow-hidden rounded-full border border-[#202536] bg-[#111521]">
                  {pointQualities.map((quality, index) => (
                    <div
                      key={`${quality}-${index}`}
                      className="h-full flex-1"
                      style={{ backgroundColor: QUALITY_COLORS[quality], opacity: quality === "none" ? 0.85 : 0.92 }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex items-center justify-between text-[8px] uppercase tracking-[0.16em] text-[#556076]">
                  <span>Entry</span>
                  <span>Cash Counter</span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-[#556076]">Run simulation to see path visibility distribution.</div>
            )}
          </div>

          <div className="flex gap-1.5">
            <button className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-[#24283a] bg-[#111521] text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white">
              <Edit3 className="h-3 w-3" />
              Edit Path
            </button>
            <button className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-green-800/35 bg-green-900/20 text-[10px] font-medium text-green-300 transition-colors hover:bg-green-900/30">
              <Play className="h-3 w-3" />
              Play Path
            </button>
          </div>
        </div>

        {activePath && (
          <div className="w-[194px] flex-shrink-0 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Path Map</span>
              <Route className="h-3 w-3 text-[#556076]" />
            </div>

            <svg width={SVG_W} height={SVG_H} className="block rounded-lg border border-[#1f2536] bg-[#0d1018]">
              <defs>
                <linearGradient id="pathmap-bg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#121826" />
                  <stop offset="100%" stopColor="#0a0d14" />
                </linearGradient>
              </defs>

              <rect width={SVG_W} height={SVG_H} fill="url(#pathmap-bg)" rx={10} />
              <rect x={1} y={1} width={SVG_W - 2} height={SVG_H - 2} rx={9} fill="none" stroke="#1d2435" strokeWidth={1} />

              {scene.criticalZones.map((zone) => {
                const xs = zone.polygon.map(([x]) => toSvg(x, 0).x);
                const ys = zone.polygon.map(([, z]) => toSvg(0, z).y);
                const minX = Math.min(...xs);
                const minY = Math.min(...ys);
                const maxX = Math.max(...xs);
                const maxY = Math.max(...ys);
                return (
                  <rect
                    key={zone.id}
                    x={minX}
                    y={minY}
                    width={maxX - minX}
                    height={maxY - minY}
                    fill="#eab30812"
                    stroke="#eab308"
                    strokeWidth="1"
                    strokeDasharray="4,2"
                  />
                );
              })}

              {scene.walls.map((wall, index) => {
                const start = toSvg(wall.start[0], wall.start[1]);
                const end = toSvg(wall.end[0], wall.end[1]);
                return (
                  <line
                    key={index}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={wall.material === "glass" ? "#7fb4ff" : "#c6cfdf"}
                    strokeOpacity={wall.material === "glass" ? 0.55 : 0.9}
                    strokeWidth={wall.material === "glass" ? 1.4 : 1.7}
                    strokeLinecap="round"
                  />
                );
              })}

              {activePath.points.map((point, index) => {
                if (index === 0) return null;
                const prev = activePath.points[index - 1]!;
                const start = toSvg(prev.position[0], prev.position[1]);
                const end = toSvg(point.position[0], point.position[1]);
                return (
                  <line
                    key={`segment-${index}`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#7c3aed"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeDasharray="6,4"
                  />
                );
              })}

              {activePath.points.map((point, index) => {
                const svgPoint = toSvg(point.position[0], point.position[1]);
                const isStart = index === 0;
                const isEnd = index === activePath.points.length - 1;
                return (
                  <g key={`node-${index}`}>
                    {isStart ? (
                      <circle cx={svgPoint.x} cy={svgPoint.y} r={4} fill="#22c55e" stroke="#0d1018" strokeWidth={1.2} />
                    ) : isEnd ? (
                      <>
                        <circle cx={svgPoint.x} cy={svgPoint.y} r={4.5} fill="none" stroke="#f59e0b" strokeWidth={1.6} />
                        <circle cx={svgPoint.x} cy={svgPoint.y} r={1.8} fill="#f59e0b" />
                      </>
                    ) : null}
                  </g>
                );
              })}
            </svg>

            <div className="mt-2 flex flex-wrap gap-3 text-[8px] text-[#7f8ca6]">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span>Start</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-px w-4 border-t border-dashed border-violet-400" />
                <span>Path</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border border-amber-400" />
                <span>End (Cash Counter)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
