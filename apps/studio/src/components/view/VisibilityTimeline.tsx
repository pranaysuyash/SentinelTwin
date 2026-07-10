"use client";

import { type KeyboardEvent, type MouseEvent, useCallback, useMemo } from "react";

import { cn } from "@/lib/cn";
import { QUALITY_ABBR, QUALITY_COLOR } from "@/lib/quality-display";
import { UI_TONES } from "@/lib/design-tokens";
import type { DoriQuality } from "@/schema/security-scene";
import type { PathVisibilityResult } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";
import {
  clampPathDuration,
  orderCamerasForReplayPlayback,
  sortTimelineEvents,
} from "@/components/view/camera-view-utils";

// ── Quality colors ──
const MIN_TIMELINE_BAR_WIDTH_PCT = 0.5;

type TimelineQuality = DoriQuality | "none";
type TimelineSegment = {
  leftPct: number;
  widthPct: number;
  quality: TimelineQuality;
  timeS: number;
};

type TimelineRow = {
  camId: string;
  camData: PathVisibilityResult["visibilityByCamera"][string] | undefined;
  segments: TimelineSegment[];
};

// ── Props ──

interface VisibilityTimelineProps {
  pathResult: PathVisibilityResult | null;
  currentTime: number;
  onSeek?: (time: number) => void;
}

// ── Component ──

export function VisibilityTimeline({ pathResult, currentTime, onSeek }: VisibilityTimelineProps) {
  const sceneCameras = useStudioStore((state) => state.scene.cameras);
  const activeSceneCameraId = useStudioStore((state) => state.selectedCameraId);
  const activeNodeId = useStudioStore((state) => state.selectedNodeId);

  // ── All hooks must be before any early return (React rule) ──

  const cameras = useMemo(() => {
    const visibilityCameraIds = Object.keys(pathResult?.visibilityByCamera ?? {});
    if (!visibilityCameraIds.length) return [];
    const visibilityCameraIdSet = new Set(visibilityCameraIds);

    const ordered = orderCamerasForReplayPlayback(
      sceneCameras,
      activeNodeId,
      activeSceneCameraId,
    ).map((camera) => camera.id);
    const orderedSet = new Set(ordered);
    const prioritized = ordered.filter((id) => visibilityCameraIdSet.has(id));
    const fallback = visibilityCameraIds
      .filter((id) => !orderedSet.has(id))
      .sort();

    return [...prioritized, ...fallback];
  }, [activeNodeId, activeSceneCameraId, pathResult?.visibilityByCamera, sceneCameras]);

  const timelineEvents = useMemo(() => {
    if (!pathResult) return [] as PathVisibilityResult["timeline"][number][];
    return sortTimelineEvents(pathResult.timeline);
  }, [pathResult?.timeline]);

  const totalDuration = useMemo(() => {
    const timelineEnd = timelineEvents.at(-1)?.timeS ?? 0;
    const candidateDuration = pathResult?.totalDurationS;
    return Math.max(
      clampPathDuration(candidateDuration),
      clampPathDuration(timelineEnd),
    );
  }, [pathResult?.totalDurationS, timelineEvents]);

  const safeCurrentTime = useMemo(
    () => {
      if (!Number.isFinite(currentTime)) return 0;
      const safe = clampPathDuration(currentTime);
      return totalDuration > 0 ? Math.min(safe, totalDuration) : 0;
    },
    [currentTime, totalDuration],
  );

  const currentTimePercent = useMemo(
    () => (totalDuration > 0 ? (safeCurrentTime / totalDuration) * 100 : 0),
    [safeCurrentTime, totalDuration],
  );

  const cameraRows = useMemo((): TimelineRow[] => {
    if (totalDuration <= 0) return [];
    if (!pathResult || timelineEvents.length === 0) return [];

    return cameras.map((camId) => {
      const camData = pathResult.visibilityByCamera[camId];
      const cameraEvents = timelineEvents.filter((event) => event.cameraId === camId);
      const segments: TimelineSegment[] = [];
      let prevTime = 0;
      let prevQuality: TimelineQuality = "none";

      for (const rawEvent of cameraEvents) {
        const clampedTime = Math.min(clampPathDuration(rawEvent.timeS), totalDuration);
        if (clampedTime < prevTime) continue;

        const segmentDuration = clampedTime - prevTime;
        if (segmentDuration > 0) {
          segments.push({
            leftPct: (prevTime / totalDuration) * 100,
            widthPct: (segmentDuration / totalDuration) * 100,
            quality: prevQuality,
            timeS: prevTime,
          });
        }

        prevTime = clampedTime;

        if (rawEvent.event === "lost") {
          prevQuality = "none";
          continue;
        }

        if (rawEvent.event === "visible" || rawEvent.event === "quality_change") {
          prevQuality = rawEvent.quality ?? prevQuality;
          if (!prevQuality) prevQuality = "none";
          continue;
        }

        prevQuality = rawEvent.quality ?? prevQuality ?? "none";
      }

      if (prevTime < totalDuration) {
        segments.push({
          leftPct: (prevTime / totalDuration) * 100,
          widthPct: ((totalDuration - prevTime) / totalDuration) * 100,
          quality: prevQuality,
          timeS: prevTime,
        });
      }

      const mergedSegments: TimelineSegment[] = [];
      for (const segment of segments) {
        const prev = mergedSegments[mergedSegments.length - 1];
        if (prev && prev.quality === segment.quality) {
          prev.widthPct += segment.widthPct;
          continue;
        }
        mergedSegments.push({ ...segment });
      }

      return {
        camId,
        camData,
        segments: mergedSegments,
      };
    }).filter((row) => row.segments.length > 0);
  }, [cameras, pathResult, timelineEvents, totalDuration]);

  const hasNoTimeline = !pathResult || totalDuration <= 0 || timelineEvents.length === 0 || cameraRows.length === 0;
  const keyboardSeekStep = useMemo(
    () => (totalDuration > 0 ? Math.max(0.5, Math.min(5, totalDuration / 10)) : 1),
    [totalDuration],
  );

  const handleSeek = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const pct = (event.clientX - rect.left) / rect.width;
    const safePct = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 1) : 0;
    const safeTotalDuration = totalDuration > 0 ? totalDuration : 0;
    onSeek(safePct * safeTotalDuration);
  }, [onSeek, totalDuration]);

  const handleSeekKeys = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return;

    const step = keyboardSeekStep;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        event.preventDefault();
        onSeek(Math.max(0, safeCurrentTime - step));
        break;
      case "ArrowRight":
      case "ArrowUp":
        event.preventDefault();
        onSeek(Math.min(totalDuration, safeCurrentTime + step));
        break;
      case "PageDown":
        event.preventDefault();
        onSeek(Math.max(0, safeCurrentTime - step * 4));
        break;
      case "PageUp":
        event.preventDefault();
        onSeek(Math.min(totalDuration, safeCurrentTime + step * 4));
        break;
      case "Home":
        event.preventDefault();
        onSeek(0);
        break;
      case "End":
        event.preventDefault();
        onSeek(totalDuration);
        break;
    }
  }, [keyboardSeekStep, onSeek, safeCurrentTime, totalDuration]);

  if (hasNoTimeline) {
    return (
      <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5`}>
        <div className={`mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textMuted}`}>Camera Visibility</div>
        <p className="text-[10px] text-[#4d566b]">No visibility data available. Run simulation with a defined path.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5`}>
        <div className="mb-2 flex items-center justify-between">
          <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${UI_SURFACES.textDimMid}`}>Camera Visibility</span>
          <div className="flex items-center gap-2 text-[8px] text-[#4d566b]">
            <span className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-sm", UI_TONES.success.dot)} />
            Visible
          </span>
          <span className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-sm", UI_TONES.danger.dot)} />
            Lost
          </span>
        </div>
      </div>

      {/* Playhead indicator */}
      <div className="relative">
        {/* Current time playhead line */}
        <div
          className="absolute top-0 z-10 h-full w-0.5 bg-[#93c5fd] shadow-[0_0_6px_rgba(147,197,253,0.6)]"
          style={{ left: `${currentTimePercent}%`, pointerEvents: "none" }}
          title={`${safeCurrentTime.toFixed(1)}s`}
        />

        {/* Camera rows */}
        <div className="space-y-1">
          {cameraRows.map((row) => {
            const visiblePct = row.camData
              ? Math.max(0, Math.min(100, (row.camData.visibleS / totalDuration) * 100))
              : 0;
            const cameraLabel = row.camId.replace("cam_", "").replace(/_/g, " ");
            return (
              <div key={row.camId} className="flex items-center gap-2">
                {/* Camera label */}
                <div className="w-20 flex-shrink-0 truncate text-[8px] font-medium text-[#8b96ab]" title={row.camId}>
                  {row.camId.replace("cam_", "").replace(/_/g, " ")}
                </div>

                {/* Timeline bar (clickable for seeking) */}
                <div
                  className={`relative h-4 flex-1 cursor-pointer overflow-hidden rounded-md border border-[#202536] ${UI_SURFACES.card} outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#93c5fd]/70`}
                  onClick={handleSeek}
                  onKeyDown={handleSeekKeys}
                  role="slider"
                  tabIndex={0}
                  aria-label={`${cameraLabel} visibility timeline`}
                  aria-valuemin={0}
                  aria-valuemax={totalDuration}
                  aria-valuenow={safeCurrentTime}
                  aria-valuetext={`${safeCurrentTime.toFixed(1)} seconds of ${totalDuration.toFixed(1)} seconds`}
                >
                  {row.segments.map((seg, si) => (
                    <div
                      key={`${row.camId}-${seg.timeS}-${si}`}
                      className="absolute top-0 h-full transition-opacity hover:opacity-80"
                      style={{
                        left: `${seg.leftPct}%`,
                        width: `${Math.max(seg.widthPct, MIN_TIMELINE_BAR_WIDTH_PCT)}%`,
                        backgroundColor: seg.quality === "none"
                          ? "#ef4444"
                          : QUALITY_COLOR[seg.quality as DoriQuality] ?? "#ef4444",
                        opacity: seg.quality === "none" ? 0.35 : 0.7,
                      }}
                      title={`${seg.quality ? QUALITY_ABBR[seg.quality as DoriQuality] ?? seg.quality : "none"} at ${seg.timeS.toFixed(1)}s`}
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
          <span>
            t: <span className="text-[#8bc0ff] font-mono">{safeCurrentTime.toFixed(1)}s</span>
          </span>
        </div>
      )}
    </div>
  );
}
