"use client";

import { Eye, ListRestart, Pause, Play, Route, SkipBack, SkipForward } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { QUALITY_BAR_COLOR, QUALITY_LABEL, QUALITY_RANK, QUALITY_SHORT_LABEL } from "@/lib/quality-display";
import { QualityBadge } from "@/components/shared/QualityBadge";
import { TruthBadge } from "@/components/shared/TruthBadge";
import { distance2D, lerp2D } from "@sentineltwin/core";
import { QUALITY_ORDER } from "@sentineltwin/core";
import { VisibilityTimeline } from "@/components/view/VisibilityTimeline";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import {
  clampPathDuration,
  clampReplayProgress,
  findLatestTimelineEventAtOrBeforeTime,
  sortTimelineEvents,
} from "@/components/view/camera-view-utils";
import type { DoriQuality, ScenarioPath, SimulationResult } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function formatPoint(point?: [number, number] | null) {
  if (!point) return "--";
  return `${point[0].toFixed(1)}, ${point[1].toFixed(1)}`;
}

function samplePathPosition(path: ScenarioPath, timeS: number) {
  if (path.points.length === 0) return null;
  if (path.points.length === 1) return path.points[0]!.position;

  let elapsed = 0;
  for (let index = 0; index < path.points.length - 1; index += 1) {
    const current = path.points[index]!;
    const next = path.points[index + 1]!;
    const segmentLength = distance2D(current.position, next.position);
    const segmentDuration = segmentLength / Math.max(path.speedMps, 0.01);

    if (timeS <= elapsed + segmentDuration) {
      const localT = segmentDuration > 0 ? (timeS - elapsed) / segmentDuration : 0;
      return lerp2D(current.position, next.position, Math.max(0, Math.min(1, localT)));
    }

    elapsed += segmentDuration;
  }

  return path.points[path.points.length - 1]!.position;
}

function buildRows(path: ScenarioPath, timeline: SimulationResult["pathResults"][number]["timeline"] | undefined) {
  const rows: Array<{
    timeS: number;
    position: [number, number] | null;
    event: string;
    quality: DoriQuality;
    severity: "low" | "medium" | "high";
    action: string;
    cameraId?: string;
    reason?: string;
  }> = [];

  if (!timeline) return rows;

  for (const evt of timeline) {
    const normalizedQuality = evt.quality ?? (evt.event === "lost" ? "none" : "detection");
    const severity = normalizedQuality === "none"
      ? "high"
      : normalizedQuality === "detection" || normalizedQuality === "observation" || normalizedQuality === "outline"
        ? "medium"
        : "low";
    const action = evt.event === "lost"
      ? "Re-aim / add camera coverage in this segment"
      : normalizedQuality === "none"
        ? "Investigate occlusion and verify line-of-sight"
        : severity === "medium"
          ? "Tune angle, zoom, or lighting to improve quality"
          : "Maintain current placement";

    rows.push({
      timeS: evt.timeS,
      position: samplePathPosition(path, evt.timeS),
      event: evt.event,
      quality: normalizedQuality,
      severity,
      action,
      cameraId: evt.cameraId,
      reason: evt.reason,
    });
  }

  return rows;
}

function buildQualityRibbon(result: SimulationResult["pathResults"][number] | null, durationS: number) {
  if (!result || durationS <= 0) return [];

  const slots = 20;
  const slotW = durationS / slots;
  const timeline = sortTimelineEvents(result.timeline);

  return Array.from({ length: slots }, (_, index) => {
    const start = index * slotW;
    const end = start + slotW;
    const active = timeline.filter((event) => event.timeS <= end).slice(-1)[0];
    const quality = active?.quality ?? (active?.event === "lost" ? "none" : "detection");
    return { quality, leftPct: (start / durationS) * 100, widthPct: (slotW / durationS) * 100 };
  });
}

function buildCameraSummary(result: SimulationResult["pathResults"][number] | null) {
  if (!result) return [];

  return Object.values(result.visibilityByCamera)
    .sort((a, b) => {
      const qualityDelta = QUALITY_RANK[b.maxQuality] - QUALITY_RANK[a.maxQuality];
      if (qualityDelta !== 0) return qualityDelta;
      return b.visibleS - a.visibleS;
    })
    .slice(0, 4);
}

export function TimelineTab() {
  const result = useStudioStore((s) => s.simulationResult);
  const scene = useStudioStore((s) => s.scene);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const setPathReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);
  const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);
  const setPathReplaySpeed = useStudioStore((s) => s.setPathReplaySpeed);
  const pathReplayFollowActor = useStudioStore((s) => s.pathReplay.followActor);
  const setPathReplayFollowActor = useStudioStore((s) => s.setPathReplayFollowActor);
  const activePathId = useStudioStore((s) => s.activePathId);
  const setActivePathId = useStudioStore((s) => s.setActivePathId);

  const activePath = useMemo(() => {
    if (!scene.paths.length || !activePathId) return null;
    return scene.paths.find((path) => path.id === activePathId) ?? null;
  }, [activePathId, scene.paths]);

  const activePathResult = useMemo(() => {
    if (!result || !activePath) return null;
    return result.pathResults.find((entry) => entry.pathId === activePath.id) ?? null;
  }, [activePath, result]);

  const [subTab, setSubTab] = useState<"timeline" | "events" | "quality" | "edits">("timeline");
  const totalDurationS = clampPathDuration(activePathResult?.totalDurationS);
  const safeReplayProgress = clampReplayProgress(pathReplay.progress);
  const currentTime = totalDurationS > 0 ? totalDurationS * safeReplayProgress : 0;
  const timelineEvents = useMemo(() => sortTimelineEvents(activePathResult?.timeline), [activePathResult?.timeline]);

  useEffect(() => {
    setPathReplayPlaying(false);
    setPathReplayProgress(0);
  }, [activePath?.id, setPathReplayPlaying, setPathReplayProgress]);

  const rows = useMemo(() => (activePath ? buildRows(activePath, timelineEvents) : []), [activePath, timelineEvents]);
  const cameraSummary = useMemo(() => buildCameraSummary(activePathResult), [activePathResult]);
  const qualityRibbon = useMemo(() => buildQualityRibbon(activePathResult, totalDurationS), [activePathResult, totalDurationS]);
  const currentEvent = useMemo(() => {
    if (!timelineEvents.length) return null;
    const found = findLatestTimelineEventAtOrBeforeTime(timelineEvents, currentTime);
    if (!found) return null;
    return rows.find((row) => row.timeS === found.timeS && row.event === found.event && row.quality === found.quality) ?? null;
  }, [currentTime, rows, timelineEvents]);
  const highRiskEvents = useMemo(() => {
    const candidates = rows.filter((row) => row.severity === "high" || row.quality === "none");
    return candidates.slice(0, 6);
  }, [rows]);
  const camerasById = useMemo(() => Object.fromEntries(scene.cameras.map((camera) => [camera.id, camera.name])), [scene.cameras]);
  const editDeltas = useMemo(() => {
    const items = scene.snapshots.filter((snap) => snap.simulation);
    const deltas: Array<{ label: string; coverageDelta: number; blindspotDelta: number; issuesDelta: number }> = [];
    for (let index = 1; index < items.length; index += 1) {
      const prev = items[index - 1]!;
      const next = items[index]!;
      const prevSim = prev.simulation!;
      const nextSim = next.simulation!;
      deltas.push({
        label: `${prev.label} -> ${next.label}`,
        coverageDelta: nextSim.totalCoveragePct - prevSim.totalCoveragePct,
        blindspotDelta: nextSim.blindspotPct - prevSim.blindspotPct,
        issuesDelta: nextSim.issues.length - prevSim.issues.length,
      });
    }
    return deltas.reverse();
  }, [scene.snapshots]);

  const bestCamera = cameraSummary[0];
  const leadCameraName = bestCamera ? (camerasById[bestCamera.cameraId] ?? bestCamera.cameraId) : null;
  const visiblePct = activePathResult && totalDurationS > 0
    ? Math.round((activePathResult.visibleDurationS / totalDurationS) * 100)
    : 0;
  const visibleCameraSummary = cameraSummary.slice(0, 4);
  const focusLabel = pathReplayFollowActor
    ? "Follow actor locked to the live path"
    : leadCameraName
      ? `Lead camera: ${leadCameraName}`
      : "No strong lead camera yet";

  const handleSeek = useCallback((seconds: number) => {
    if (totalDurationS <= 0) return;
    setPathReplayProgress(clampReplayProgress(seconds / totalDurationS));
  }, [setPathReplayProgress, totalDurationS]);

  const handleReset = useCallback(() => {
    setPathReplayPlaying(false);
    setPathReplayProgress(0);
  }, [setPathReplayPlaying, setPathReplayProgress]);

  const handlePlayPause = useCallback(() => {
    if (currentTime >= totalDurationS && totalDurationS > 0) {
      setPathReplayProgress(0);
    }
    setPathReplayPlaying(!pathReplay.playing);
  }, [currentTime, pathReplay.playing, setPathReplayPlaying, setPathReplayProgress, totalDurationS]);

  if (!result || !activePath) {
    return (
      <div className={`flex h-full items-center justify-center text-[11px] ${UI_SURFACES.textDim}`}>
        Add a path and run simulation to see the timeline.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className={`{flex flex-wrap items-center gap-2 border-b ${UI_SURFACES.borderPanel} px-3 py-2}`}>
        <div className="flex items-center gap-1.5">
          <Route className={`h-3.5 w-3.5 ${UI_SURFACES.textAccent}`} />
          <TruthBadge label="simulated" className="mr-1" />
          <select
            value={activePath.id}
            onChange={(event) => setActivePathId(event.target.value)}
            className={`min-w-[190px] rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1 text-[10px] font-medium ${UI_SURFACES.textBody2} outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 transition-colors ${UI_SURFACES.hoverBorderSubtle}`}
          >
            {scene.paths.map((path) => (
              <option key={path.id} value={path.id}>{path.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleReset}
            className={`flex h-6 w-6 items-center justify-center rounded ${UI_SURFACES.chip} transition-colors ${UI_SURFACES.hoverBgDark}`}
            title="Reset"
          >
            <ListRestart className={`h-3 w-3 ${UI_SURFACES.textSoftMid}`} />
          </button>
          <button
            type="button"
            onClick={() => handleSeek(Math.max(0, currentTime - 2))}
            className={`flex h-6 w-6 items-center justify-center rounded ${UI_SURFACES.chip} transition-colors ${UI_SURFACES.hoverBgDark}`}
            title="Skip back 2s"
          >
            <SkipBack className={`h-3 w-3 ${UI_SURFACES.textSoftMid}`} />
          </button>
          <button
            type="button"
            onClick={handlePlayPause}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              pathReplay.playing ? "bg-[#60a5fa] text-white" : "${UI_SURFACES.hoverBg} ${UI_SURFACES.textInfoLight}",
            )}
            title={pathReplay.playing ? "Pause" : "Play"}
          >
            {pathReplay.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => handleSeek(Math.min(totalDurationS, currentTime + 2))}
            className={`flex h-6 w-6 items-center justify-center rounded ${UI_SURFACES.chip} transition-colors ${UI_SURFACES.hoverBgDark}`}
            title="Skip forward 2s"
          >
            <SkipForward className={`h-3 w-3 ${UI_SURFACES.textSoftMid}`} />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className="group relative h-4 flex-1 cursor-pointer"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const raw = (event.clientX - rect.left) / rect.width;
              handleSeek(clampReplayProgress(raw) * totalDurationS);
            }}
          >
            <div className={`h-1.5 w-full overflow-hidden rounded-full ${UI_SURFACES.chip}`}>
              <div
                className="h-full rounded-full bg-green-500/70 transition-all duration-100"
                style={{ width: `${safeReplayProgress * 100}%` }}
              />
            </div>
            {qualityRibbon.length > 0 ? (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                {qualityRibbon.map((slot, index) => (
                  <div
                    key={index}
                    className="absolute top-0 h-full opacity-25 transition-opacity duration-200 group-hover:opacity-35"
                    style={{
                      left: `${slot.leftPct}%`,
                      width: `${Math.max(slot.widthPct, 0.5)}%`,
                      backgroundColor: QUALITY_BAR_COLOR[slot.quality as DoriQuality] ?? QUALITY_BAR_COLOR.none,
                    }}
                  />
                ))}
              </div>
            ) : null}
            <div
              className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-green-400 shadow"
              style={{ left: `calc(${safeReplayProgress * 100}% - 5px)` }}
            />
          </div>

          <div className={`min-w-[96px] text-right font-mono text-[10px] ${UI_SURFACES.textSoftBright}`}>
            {formatTime(currentTime)} / {formatTime(totalDurationS)}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {[0.5, 1, 2, 4].map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setPathReplaySpeed(speed)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors",
                pathReplay.speed === speed ? "${UI_SURFACES.hoverBg} ${UI_SURFACES.textInfoLight}" : `${UI_SURFACES.textMuted} ${UI_SURFACES.hoverBgMuted} ${UI_SURFACES.hoverTextSoft}`,
              )}
            >
              {speed}x
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPathReplayFollowActor(!pathReplayFollowActor)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors",
              pathReplayFollowActor ? "${UI_SURFACES.hoverBg} ${UI_SURFACES.textInfoLight}" : `${UI_SURFACES.textMuted} ${UI_SURFACES.hoverBgMuted} ${UI_SURFACES.hoverTextSoft}`,
            )}
            title="Follow actor"
          >
            <Eye className="h-3 w-3" />
            Follow Actor
          </button>
        </div>
      </div>

        <div className={`{flex items-center gap-3 border-b ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeepAlt} px-3 py-1.5 text-[8px] ${UI_SURFACES.textDimMid}}`}>
          <span>
            Path: <span className={`${UI_SURFACES.textBody}`}>{activePath.label}</span>
          </span>
          <span>
            Visible: <span className="font-mono text-emerald-300">{visiblePct}%</span>
          </span>
          <span>
            Events: <span className={`font-mono ${UI_SURFACES.textSoftBright}`}>{activePathResult?.timeline.length ?? 0}</span>
          </span>
          <span className={cn("rounded border px-1.5 py-0.5 font-medium", pathReplayFollowActor ? "border-sky-500/25 bg-sky-500/10 text-sky-300" : `${UI_SURFACES.borderStrong} ${UI_SURFACES.card} ${UI_SURFACES.textMuted3}`)}>
            {pathReplayFollowActor ? "Follow Actor" : "Free Scrub"}
          </span>
          <span className={`${UI_SURFACES.textSoftMid}`}>
            {focusLabel}
          </span>
          {bestCamera ? (
            <span>
              Best camera: <span className={`${UI_SURFACES.textBody}`}>{camerasById[bestCamera.cameraId] ?? bestCamera.cameraId}</span>
            </span>
          ) : null}
      </div>

      <div className={`{flex items-center gap-0.5 border-b ${UI_SURFACES.borderPanel} px-2 pt-1.5}`}>
        {[
          { id: "timeline" as const, label: "TIMELINE" },
          { id: "events" as const, label: "EVENTS" },
          { id: "quality" as const, label: "QUALITY OVER TIME" },
          { id: "edits" as const, label: "EDIT DELTAS" },
        ].map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              "-mb-px rounded-t-lg border-b-2 px-3 py-1.5 text-[10px] font-medium tracking-[0.06em] transition-colors",
              subTab === tab.id
                ? "border-green-500 text-green-300"
                : "border-transparent ${UI_SURFACES.textDimMid} ${UI_SURFACES.hoverTextSoft}",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`min-h-0 flex-1 overflow-hidden ${UI_SURFACES.panel}`}>
        {subTab === "timeline" && (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className={`{flex items-center gap-2 border-b ${UI_SURFACES.borderPanel} px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] ${UI_SURFACES.textMuted}}`}>
              Coverage Failure Timeline
              <ExplainBadge text="Timeline shows when visibility is gained, lost, or degraded along the selected path." />
            </div>
            <div className={`{grid gap-2 border-b ${UI_SURFACES.borderPanel} px-3 py-2 sm:grid-cols-2 xl:grid-cols-4}`}>
              <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2.5 py-2`}>
                <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textAccent}`}>Replay Focus</div>
                <div className={`mt-1 text-[10px] font-medium ${UI_SURFACES.textBody3}`}>
                  {pathReplayFollowActor ? "Follow Actor enabled" : "Manual scrub enabled"}
                </div>
                <div className={`mt-1 text-[9px] ${UI_SURFACES.textDimMid}`}>
                  {pathReplayFollowActor
                    ? "The playhead stays anchored to the actor route and replay timing."
                    : "Use the playhead to inspect visibility changes frame by frame."}
                </div>
              </div>
              <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2.5 py-2`}>
                <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textAccent}`}>Lead Camera</div>
                <div className={`mt-1 text-[10px] font-medium ${UI_SURFACES.textBody3}`}>{leadCameraName ?? "No lead camera"}</div>
                <div className={`mt-1 text-[9px] ${UI_SURFACES.textDimMid}`}>
                  {bestCamera
                    ? `${bestCamera.visibleS.toFixed(1)}s visible · best quality ${bestCamera.maxQuality.toUpperCase()}`
                    : "No camera reach data available for this path."}
                </div>
              </div>
              <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2.5 py-2`}>
                <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textAccent}`}>Coverage Reach</div>
                <div className={`mt-1 text-[10px] font-medium ${UI_SURFACES.textBody3}`}>
                  {visibleCameraSummary.length} camera{visibleCameraSummary.length === 1 ? "" : "s"} with visibility
                </div>
                <div className={`mt-1 text-[9px] ${UI_SURFACES.textDimMid}`}>
                  Ranked by quality first, then by visible time.
                </div>
              </div>
              <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2.5 py-2`}>
                <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textAccent}`}>Replay Status</div>
                <div className={`mt-1 text-[10px] font-medium ${UI_SURFACES.textBody3}`}>{pathReplay.playing ? "Playing" : "Paused"}</div>
                <div className={`mt-1 text-[9px] ${UI_SURFACES.textDimMid}`}>
                  {formatTime(currentTime)} / {formatTime(totalDurationS)} · {pathReplay.speed.toFixed(1)}x
                </div>
              </div>
              <div className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2.5 py-2 sm:col-span-2 xl:col-span-4`}>
                <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textAccent}`}>Current Event</div>
                {currentEvent ? (
                  <div className={`mt-1 flex flex-wrap items-center gap-1.5 text-[10px] ${UI_SURFACES.textBody3}`}>
                    <span className="font-mono ${UI_SURFACES.textInfoLight}">{currentEvent.timeS.toFixed(1)}s</span>
                    <span>•</span>
                    <span>{currentEvent.cameraId ? camerasById[currentEvent.cameraId] ?? currentEvent.cameraId : "No camera"}</span>
                    <span>•</span>
                    <QualityBadge quality={currentEvent.quality} />
                    <span className={`${UI_SURFACES.textMuted3}`}>{currentEvent.event}</span>
                    {currentEvent.reason ? <span className={`${UI_SURFACES.textDimMid}`}>— {currentEvent.reason}</span> : null}
                  </div>
                ) : (
                  <div className={`mt-1 text-[9px] ${UI_SURFACES.textDimMid}`}>No timeline event has been recorded yet.</div>
                )}
              </div>
            </div>
            <div className={`{grid gap-2 border-b ${UI_SURFACES.borderPanel} px-3 py-2 sm:grid-cols-2 xl:grid-cols-4}`}>
              {visibleCameraSummary.length > 0 ? visibleCameraSummary.map((entry) => (
                <div key={entry.cameraId} className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} px-2.5 py-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`truncate text-[10px] font-medium ${UI_SURFACES.textBody}`}>{camerasById[entry.cameraId] ?? entry.cameraId}</div>
                    <QualityBadge quality={entry.maxQuality} />
                  </div>
                  <div className={`mt-1 text-[9px] ${UI_SURFACES.textDimMid}`}>
                    Visible {entry.visibleS.toFixed(1)}s · Best {entry.maxQuality}
                  </div>
                </div>
              )) : (
                <div className={`px-3 py-2 text-[10px] ${UI_SURFACES.textDimMid}`}>No camera reach data available for this path.</div>
              )}
            </div>
            <div className={`{border-b ${UI_SURFACES.borderPanel} px-3 py-2}`}>
              <div className={`mb-1 text-[8px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textAccent}`}>High-risk jumps</div>
              <div className="flex flex-wrap gap-1.5">
                {highRiskEvents.length > 0 ? highRiskEvents.map((event) => (
                  <button
                    key={`${event.timeS}-${event.cameraId ?? "nocam"}`}
                    type="button"
                    onClick={() => handleSeek(event.timeS)}
                    className="inline-flex items-center gap-1 rounded border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[9px] text-rose-200 transition-colors hover:bg-rose-500/20"
                  >
                    <span className="font-mono">{event.timeS.toFixed(1)}s</span>
                    <span>{event.cameraId ? camerasById[event.cameraId] ?? event.cameraId : "No camera"}</span>
                    <span className="text-rose-100/80">{event.event}</span>
                  </button>
                )) : (
                  <div className={`text-[9px] ${UI_SURFACES.textDimMid}`}>No high-risk events detected for this path replay.</div>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-[10px]">
                <thead className={`sticky top-0 ${UI_SURFACES.panel} text-left text-[8px] uppercase tracking-[0.14em] ${UI_SURFACES.textDimMid}`}>
                  <tr>
                    <th className="px-3 py-2 font-semibold">Time</th>
                    <th className="px-3 py-2 font-semibold">Actor Position</th>
                    <th className="px-3 py-2 font-semibold">Camera</th>
                    <th className="px-3 py-2 font-semibold">Quality</th>
                    <th className="px-3 py-2 font-semibold">Severity</th>
                    <th className="px-3 py-2 font-semibold">Event</th>
                    <th className="px-3 py-2 font-semibold">Action</th>
                    <th className="px-3 py-2 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.timeS}-${row.cameraId ?? "nocam"}`} className={`border-t ${UI_SURFACES.hoverBgSubtle} hover:${UI_SURFACES.card}`}>
                      <td className={`px-3 py-2 font-mono ${UI_SURFACES.textBody}`}>{row.timeS.toFixed(1)}s</td>
                      <td className={`px-3 py-2 font-mono ${UI_SURFACES.textSoftBright}`}>{formatPoint(row.position)}</td>
                      <td className={`px-3 py-2 ${UI_SURFACES.textBody}`}>
                        {row.cameraId ? camerasById[row.cameraId] ?? row.cameraId : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <QualityBadge quality={row.quality} />
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em]",
                          row.severity === "high"
                            ? "bg-rose-500/15 text-rose-300"
                            : row.severity === "medium"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-emerald-500/15 text-emerald-300",
                        )}>
                          {row.severity}
                        </span>
                      </td>
                      <td className={`px-3 py-2 ${UI_SURFACES.textBody}`}>{row.event}</td>
                      <td className="px-3 py-2 ${UI_SURFACES.textMuted4}">{row.action}</td>
                      <td className={`px-3 py-2 ${UI_SURFACES.textDimMid}`}>{row.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {subTab === "events" && (
          <div className="h-full overflow-auto p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={`${row.timeS}-${row.cameraId ?? "nocam"}`} className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5`}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className={`font-mono text-[10px] ${UI_SURFACES.textBody}`}>{row.timeS.toFixed(1)}s</span>
                    <QualityBadge quality={row.quality} />
                  </div>
                  <div className={`text-[10px] ${UI_SURFACES.textSoftBright}`}>
                    {row.cameraId ? camerasById[row.cameraId] ?? row.cameraId : "No camera"} · {row.event}
                  </div>
                  <div className={cn(
                    "mt-1 inline-flex rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em]",
                    row.severity === "high"
                      ? "bg-rose-500/15 text-rose-300"
                      : row.severity === "medium"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-emerald-500/15 text-emerald-300",
                  )}>
                    {row.severity}
                  </div>
                  <div className={`mt-1.5 text-[9px] ${UI_SURFACES.textDimMid}`}>
                    Actor @ {formatPoint(row.position)}
                  </div>
                  <div className="mt-1 text-[8px] ${UI_SURFACES.textMuted4}">Action: {row.action}</div>
                  {row.reason ? (
                    <div className={`mt-2 rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.card} px-2 py-1.5 text-[9px] ${UI_SURFACES.textBody}`}>
                      {row.reason}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === "quality" && (
          <div className="h-full overflow-auto p-3">
            <VisibilityTimeline
              pathResult={activePathResult}
              currentTime={currentTime}
              onSeek={handleSeek}
            />

            <div className={`mt-3 rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5`}>
              <div className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] ${UI_SURFACES.textSoftMid}`}>
                Quality Ladder
                <ExplainBadge text="This ladder keeps the full DORI + IEC 62676-4:2025 OODPCVS order visible in the timeline so sort-based summaries do not flatten the newer standard." />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-6">
                {QUALITY_ORDER.map((quality) => (
                  <div
                    key={quality}
                    className={`rounded-lg border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.card} px-2 py-1.5`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: QUALITY_BAR_COLOR[quality] ?? QUALITY_BAR_COLOR.none }}
                      />
                      <span className={`text-[8px] font-semibold uppercase tracking-[0.12em] ${UI_SURFACES.textSoftBright}`}>
                        {QUALITY_SHORT_LABEL[quality]}
                      </span>
                    </div>
                    <div className={`mt-1 text-[10px] font-medium ${UI_SURFACES.textBody3}`}>{QUALITY_LABEL[quality]}</div>
                    <div className={`mt-0.5 text-[8px] ${UI_SURFACES.textDimMid}`}>Rank {QUALITY_RANK[quality]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {cameraSummary.map((entry) => (
                <div key={entry.cameraId} className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`truncate text-[10px] font-medium ${UI_SURFACES.textBody}`}>
                      {camerasById[entry.cameraId] ?? entry.cameraId}
                    </div>
                    <QualityBadge quality={entry.maxQuality} />
                  </div>
                  <div className={`mt-1.5 text-[9px] ${UI_SURFACES.textDimMid}`}>
                    Visible {entry.visibleS.toFixed(1)}s
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === "edits" && (
          <div className="h-full overflow-auto p-3">
            <div className={`mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] ${UI_SURFACES.textSoftMid}`}>
              Scene Diff Timeline
              <ExplainBadge text="Shows coverage impact between consecutive saved snapshots so you can trace which edits helped or hurt." />
            </div>
            <div className="space-y-2">
              {editDeltas.length === 0 ? <div className="text-[10px] ${UI_SURFACES.textMuted5}">Save snapshots with simulation to populate edit deltas.</div> : null}
              {editDeltas.map((delta) => (
                <div key={delta.label} className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-2.5 text-[10px]`}>
                  <div className={`font-medium ${UI_SURFACES.textBody3}`}>{delta.label}</div>
                  <div className={`mt-1 ${UI_SURFACES.textMuted3}`}>
                    Coverage: <span className={delta.coverageDelta >= 0 ? "text-emerald-300" : "text-red-300"}>{delta.coverageDelta >= 0 ? "+" : ""}{delta.coverageDelta.toFixed(1)}%</span> ·
                    Blindspot: <span className={delta.blindspotDelta <= 0 ? "text-emerald-300" : "text-red-300"}>{delta.blindspotDelta >= 0 ? "+" : ""}{delta.blindspotDelta.toFixed(1)}%</span> ·
                    Issues: <span className={delta.issuesDelta <= 0 ? "text-emerald-300" : "text-red-300"}>{delta.issuesDelta >= 0 ? "+" : ""}{delta.issuesDelta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
