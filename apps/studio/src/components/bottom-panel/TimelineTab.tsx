"use client";

import { Pause, Play, SkipBack } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import type { SimulationResult } from "@/schema/security-scene";

type TimelineEvent = SimulationResult["pathResults"][number]["timeline"][number];

const QUALITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  identification: { bg: "bg-green-900/40",  text: "text-green-300",  dot: "bg-green-400"  },
  recognition:    { bg: "bg-blue-900/40",   text: "text-blue-300",   dot: "bg-blue-400"   },
  observation:    { bg: "bg-yellow-900/40", text: "text-yellow-300", dot: "bg-yellow-400" },
  detection:      { bg: "bg-orange-900/40", text: "text-orange-300", dot: "bg-orange-400" },
  none:           { bg: "bg-red-900/40",    text: "text-red-400",    dot: "bg-red-500"    },
};

const QUALITY_BAR_COLORS: Record<string, string> = {
  identification: "#4ade80",
  recognition:    "#60a5fa",
  observation:    "#facc15",
  detection:      "#fb923c",
  none:           "#ef4444",
};

function QualityBadge({ quality }: { quality: string }) {
  const c = QUALITY_COLORS[quality] ?? QUALITY_COLORS.none!;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {quality}
    </span>
  );
}

// Builds a flat event list from all pathResults for the timeline table
function buildTimelineRows(result: SimulationResult, cameraNames: Record<string, string>) {
  const rows: Array<{
    timeS: number;
    pathLabel: string;
    segmentIdx: number;
    event: string;
    quality: string;
    cameraId: string | undefined;
    reason: string | undefined;
  }> = [];

  for (const pr of result.pathResults) {
    pr.timeline.forEach((evt: TimelineEvent, i: number) => {
      rows.push({
        timeS: evt.timeS,
        pathLabel: pr.pathId,
        segmentIdx: i + 1,
        event: evt.event,
        quality: evt.quality ?? (evt.event === "lost" ? "none" : "detection"),
        cameraId: evt.cameraId,
        reason: evt.reason,
      });
    });
  }

  rows.sort((a, b) => a.timeS - b.timeS);
  return rows;
}

// Build quality-over-time bar data from timeline events
function buildQualityBars(result: SimulationResult) {
  if (result.pathResults.length === 0) return [];

  // Collect all events across paths, bucket into 20 time slots
  const maxT = Math.max(...result.pathResults.map((pr) => pr.totalDurationS), 1);
  const SLOTS = 20;
  const slotW = maxT / SLOTS;

  // For each slot, find dominant quality
  const slots: string[] = [];
  for (let s = 0; s < SLOTS; s++) {
    const tStart = s * slotW;
    const tEnd   = tStart + slotW;

    const RANK: Record<string, number> = { none: 0, detection: 1, observation: 2, recognition: 3, identification: 4 };
    let best = "none";

    for (const pr of result.pathResults) {
      // Find last event before tEnd
      const evtsBefore = pr.timeline.filter((e) => e.timeS <= tEnd);
      if (evtsBefore.length > 0) {
        const last = evtsBefore[evtsBefore.length - 1]!;
        const q = last.quality ?? (last.event === "visible" ? "detection" : "none");
        if ((RANK[q] ?? 0) > (RANK[best] ?? 0)) best = q;
      }
    }

    // If we're in the path time range, push; else skip
    if (tStart < maxT) slots.push(best);
  }

  return slots.map((q, i) => ({ q, pct: ((i + 1) / SLOTS) * 100 }));
}

export function TimelineTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene  = useStudioStore((s) => s.scene);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const setPathReplayPlaying  = useStudioStore((s) => s.setPathReplayPlaying);
  const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-[#3a4158] text-[11px]">
        Run simulation to see timeline
      </div>
    );
  }

  const hasPaths    = scene.paths.length > 0;
  const hasResults  = result.pathResults.length > 0;
  const maxDuration = Math.max(...result.pathResults.map((pr) => pr.totalDurationS), 1);

  // Camera name lookup
  const cameraNames: Record<string, string> = {};
  for (const cam of scene.cameras) cameraNames[cam.id] = cam.name;

  const rows    = buildTimelineRows(result, cameraNames);
  const barData = buildQualityBars(result);

  const currentT = pathReplay.progress * maxDuration;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Controls row ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1e2130] flex-shrink-0">
        <button
          onClick={() => { setPathReplayPlaying(false); setPathReplayProgress(0); }}
          disabled={!hasPaths}
          className="flex items-center justify-center w-6 h-6 rounded bg-[#1a1d26] hover:bg-[#1e2235] transition-colors disabled:opacity-40"
          title="Reset"
        >
          <SkipBack className="w-3 h-3 text-[#68738a]" />
        </button>
        <button
          onClick={() => hasPaths && setPathReplayPlaying(!pathReplay.playing)}
          disabled={!hasPaths}
          className="flex items-center justify-center w-6 h-6 rounded bg-[#1a1d26] hover:bg-[#1e2235] transition-colors disabled:opacity-40"
          title={pathReplay.playing ? "Pause" : "Play"}
        >
          {pathReplay.playing
            ? <Pause className="w-3 h-3 text-green-400" />
            : <Play  className="w-3 h-3 text-[#68738a]" />}
        </button>

        {/* Scrubber */}
        <div className="flex-1 relative h-4 flex items-center group cursor-pointer"
          onClick={(e) => {
            if (!hasPaths) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            setPathReplayProgress(p);
          }}
        >
          <div className="w-full h-1 bg-[#1a1d26] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500/70 rounded-full transition-all duration-100"
              style={{ width: `${pathReplay.progress * 100}%` }}
            />
          </div>
          {/* Playhead */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-green-400 shadow transition-all duration-100 pointer-events-none"
            style={{ left: `calc(${pathReplay.progress * 100}% - 5px)` }}
          />
        </div>

        <span className="text-[9px] font-mono text-[#4a5568] min-w-[60px] text-right">
          {hasPaths ? `${currentT.toFixed(1)}s / ${maxDuration.toFixed(1)}s` : "No paths"}
        </span>
      </div>

      {/* ── Main content: table + quality-over-time ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Timeline event table */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-[#1e2130]">
          <div className="px-3 py-1 border-b border-[#1e2130] flex items-center justify-between flex-shrink-0">
            <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#4a5568]">
              Adversarial Path Timeline
            </span>
            <span className="text-[8px] text-[#3a4158]">{rows.length} events</span>
          </div>

          {!hasResults ? (
            <div className="flex-1 flex items-center justify-center text-[10px] text-[#3a4158]">
              Add paths and run simulation to see timeline events
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead className="sticky top-0 bg-[#0b0f17] z-10">
                  <tr className="text-[8px] text-[#3a4158] uppercase tracking-wider">
                    <th className="text-left px-2.5 py-1">Time</th>
                    <th className="text-left px-2 py-1">Path</th>
                    <th className="text-center px-2 py-1">Seg</th>
                    <th className="text-center px-2 py-1">Event</th>
                    <th className="text-left px-2 py-1">Quality</th>
                    <th className="text-left px-2 py-1">Camera</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isActive = Math.abs(row.timeS - currentT) < (maxDuration / 20);
                    const camName  = row.cameraId ? (cameraNames[row.cameraId] ?? row.cameraId) : "—";
                    return (
                      <tr
                        key={i}
                        className={`border-t border-[#181b26] transition-colors ${
                          isActive ? "bg-[#111827]" : "hover:bg-[#0d0f17]"
                        }`}
                      >
                        <td className="px-2.5 py-1.5 font-mono text-[#5a6478]">
                          {row.timeS.toFixed(1)}s
                        </td>
                        <td className="px-2 py-1.5 text-[#8090a8] truncate max-w-[80px]">
                          {row.pathLabel.replace("path_", "P")}
                        </td>
                        <td className="px-2 py-1.5 text-center text-[#4a5568]">
                          {row.segmentIdx}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`text-[8px] px-1 rounded font-medium ${
                            row.event === "visible"        ? "text-green-400 bg-green-900/20"
                            : row.event === "lost"         ? "text-red-400 bg-red-900/20"
                            : row.event === "quality_change" ? "text-blue-400 bg-blue-900/20"
                            : "text-[#4a5568]"
                          }`}>
                            {row.event === "quality_change" ? "change" : row.event}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <QualityBadge quality={row.quality} />
                        </td>
                        <td className="px-2 py-1.5 text-[#5a6478] truncate max-w-[80px] text-[9px]">
                          {camName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quality Over Time sidebar */}
        <div className="w-[140px] flex-shrink-0 flex flex-col overflow-hidden">
          <div className="px-2.5 py-1 border-b border-[#1e2130] flex-shrink-0">
            <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#4a5568]">
              Quality / Time
            </span>
          </div>

          <div className="flex-1 overflow-hidden px-2 py-2">
            {barData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[9px] text-[#3a4158]">
                No data
              </div>
            ) : (
              <div className="flex items-end gap-0.5 h-full">
                {barData.map(({ q }, i) => {
                  const color = QUALITY_BAR_COLORS[q] ?? "#ef4444";
                  const playheadSlot = Math.floor(pathReplay.progress * barData.length);
                  const isActive = i === playheadSlot;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm transition-all duration-200"
                      style={{
                        height: `${30 + (Object.keys(QUALITY_BAR_COLORS).indexOf(q)) * 14}%`,
                        backgroundColor: color,
                        opacity: isActive ? 1 : 0.55,
                        minHeight: 4,
                        maxHeight: "90%",
                      }}
                      title={`${q} @ ${((i / barData.length) * maxDuration).toFixed(1)}s`}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="px-2 py-1.5 border-t border-[#1e2130] flex-shrink-0 space-y-0.5">
            {(["identification", "recognition", "observation", "detection"] as const).map((q) => {
              const c = QUALITY_COLORS[q]!;
              return (
                <div key={q} className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${c.dot}`} />
                  <span className={`text-[7px] capitalize ${c.text}`}>{q.slice(0, 5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
