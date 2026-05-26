"use client";

import { useMemo } from "react";

import type { PathVisibilityResult } from "@/schema/security-scene";

// ── Quality colors ──

const QUALITY_COLORS: Record<string, string> = {
  identification: "#3b82f6",
  recognition: "#22c55e",
  observation: "#eab308",
  detection: "#f97316",
  none: "#ef4444",
};

const QUALITY_LABELS: Record<string, string> = {
  identification: "ID",
  recognition: "REC",
  observation: "OBS",
  detection: "DET",
  none: "NONE",
};

// ── Props ──

interface VisibilityTimelineProps {
  pathResult: PathVisibilityResult | null;
  currentTime: number;
  onSeek?: (time: number) => void;
}

// ── Component ──

export function VisibilityTimeline({ pathResult, currentTime, onSeek }: VisibilityTimelineProps) {
  // ── All hooks must be before any early return (React rule) ──

  const cameras = useMemo(() =>
    Object.keys(pathResult?.visibilityByCamera ?? {}).sort(),
  [pathResult]);

  const totalDuration = useMemo(() =>
    pathResult?.totalDurationS || 1,
  [pathResult]);

  // Build timeline rows per camera
  const cameraRows = useMemo(() => {
    if (!pathResult || pathResult.timeline.length === 0) return [];

    return cameras.map((camId) => {
      const camData = pathResult.visibilityByCamera[camId];
      const segments: { leftPct: number; widthPct: number; quality: string; timeS: number }[] = [];
      let prevTime = 0;
      let prevQuality: string | null = null;

      for (const event of pathResult.timeline) {
        if (event.cameraId !== camId) continue;
        const segmentDuration = event.timeS - prevTime;
        if (segmentDuration > 0 && prevQuality !== null) {
          segments.push({
            leftPct: (prevTime / totalDuration) * 100,
            widthPct: (segmentDuration / totalDuration) * 100,
            quality: prevQuality,
            timeS: prevTime,
          });
        }
        prevTime = event.timeS;
        prevQuality = event.quality ?? prevQuality;
      }

      // Remaining segment from last event to end
      if (prevTime < totalDuration && prevQuality !== null) {
        segments.push({
          leftPct: (prevTime / totalDuration) * 100,
          widthPct: ((totalDuration - prevTime) / totalDuration) * 100,
          quality: prevQuality,
          timeS: prevTime,
        });
      }

      // Initial segment from time 0 to first event (show as "none" / lost)
      const firstEvent = pathResult.timeline.find((e) => e.cameraId === camId);
      if (firstEvent && firstEvent.timeS > 0) {
        segments.unshift({
          leftPct: 0,
          widthPct: (firstEvent.timeS / totalDuration) * 100,
          quality: "none",
          timeS: 0,
        });
      }

      return { camId, camData, segments };
    });
  }, [cameras, pathResult, totalDuration]);

  if (!pathResult || pathResult.timeline.length === 0) {
    return (
      <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#4a5568]">Camera Visibility</div>
        <p className="text-[10px] text-[#4d566b]">No visibility data available. Run simulation with a defined path.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#556076]">Camera Visibility</span>
        <div className="flex items-center gap-2 text-[8px] text-[#4d566b]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-[#22c55e]" />
            Visible
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-[#ef4444]" />
            Lost
          </span>
        </div>
      </div>

      {/* Playhead indicator */}
      <div className="relative">
        {/* Current time playhead line */}
        <div
          className="absolute top-0 z-10 h-full w-0.5 bg-[#93c5fd] shadow-[0_0_6px_rgba(147,197,253,0.6)]"
          style={{ left: `${(currentTime / totalDuration) * 100}%`, pointerEvents: "none" }}
        />

        {/* Camera rows */}
        <div className="space-y-1">
          {cameraRows.map((row) => {
            const visiblePct = row.camData ? (row.camData.visibleS / totalDuration) * 100 : 0;
            return (
              <div key={row.camId} className="flex items-center gap-2">
                {/* Camera label */}
                <div className="w-20 flex-shrink-0 truncate text-[8px] font-medium text-[#8b96ab]" title={row.camId}>
                  {row.camId.replace("cam_", "").replace(/_/g, " ")}
                </div>

                {/* Timeline bar (clickable for seeking) */}
                <div
                  className="relative h-4 flex-1 cursor-pointer overflow-hidden rounded-md border border-[#202536] bg-[#111521]"
                  onClick={(e) => {
                    if (!onSeek) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    onSeek(pct * totalDuration);
                  }}
                >
                  {row.segments.map((seg, si) => (
                    <div
                      key={si}
                      className="absolute top-0 h-full transition-opacity hover:opacity-80"
                      style={{
                        left: `${seg.leftPct}%`,
                        width: `${Math.max(seg.widthPct, 0.5)}%`,
                        backgroundColor: seg.quality === "none" || !seg.quality
                          ? "#ef4444"
                          : QUALITY_COLORS[seg.quality] ?? "#ef4444",
                        opacity: seg.quality === "none" || !seg.quality ? 0.35 : 0.7,
                      }}
                      title={`${seg.quality ? QUALITY_LABELS[seg.quality] ?? seg.quality : "none"} at ${seg.timeS.toFixed(1)}s`}
                    />
                  ))}
                </div>

                {/* Stats */}
                <div className="w-12 flex-shrink-0 text-right text-[8px] font-mono text-[#5b667c]">
                  {visiblePct.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary bar */}
      {pathResult && (
        <div className="mt-2 flex items-center gap-3 text-[8px] text-[#4d566b]">
          <span>
            Visible: <span className="text-emerald-300 font-mono">{pathResult.visibleDurationS.toFixed(1)}s</span>
          </span>
          <span>
            Lost: <span className="text-red-300 font-mono">{pathResult.lostDurationS.toFixed(1)}s</span>
          </span>
          <span>
            Events: <span className="text-[#8b96ab] font-mono">{pathResult.timeline.length}</span>
          </span>
        </div>
      )}
    </div>
  );
}
