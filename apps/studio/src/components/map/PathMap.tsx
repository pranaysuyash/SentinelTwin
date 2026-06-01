"use client";

import { Edit3, Play } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { CoverageRibbon } from "@/components/map/CoverageRibbon";
import { MapCanvas } from "@/components/map/MapCanvas";
import {
  clampPathDuration,
  clampReplayProgress,
  getPathReplayDurationS,
  findLatestTimelineEventAtOrBeforeTime,
  findNextTimelineEventAfterTime,
  sortTimelineEvents,
} from "@/components/view/camera-view-utils";
import { MAP_COLORS, qualityColor } from "@/components/map/map-colors";
import { pathLengthM, pointOnPathAtProgress, samplePathQuality } from "@/components/map/path-quality";
import { QUALITY_LABEL, QUALITY_RANK } from "@/lib/quality-display";
import type { DoriQuality, ScenarioPath } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

type PathMapProps = {
  width?: number;
  height?: number;
};

function mapLayerFlagsFromStore(layerVis: Record<string, boolean>) {
  return {
    walls: layerVis.walls_floors,
    doors: layerVis.walls_floors,
    windows: layerVis.walls_floors,
    cameras: layerVis.cameras,
    cameraCones: layerVis.camera_cones,
    obstructions: layerVis.obstructions,
    lights: layerVis.lights,
    criticalZones: layerVis.critical_zones,
    privacyZones: layerVis.privacy_zones,
    paths: layerVis.paths,
    coverage: layerVis.heatmap,
    labels: layerVis.labels,
  };
}

export function PathMap({
  width = 194,
  height = 118,
}: PathMapProps) {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const layerVis = useStudioStore((s) => s.layerVisibility);
  const selected = useStudioStore((s) => s.selectedNodeId);
  const setSelected = useStudioStore((s) => s.selectNode);
  const hovered = useStudioStore((s) => s.hoveredMapNodeId);
  const setHovered = useStudioStore((s) => s.setHoveredMapNodeId);
  const activePathId = useStudioStore((s) => s.activePathId);
  const setActivePathId = useStudioStore((s) => s.setActivePathId);
  const mapZoom = useStudioStore((s) => s.mapState.pathMap.zoom);
  const mapPanX = useStudioStore((s) => s.mapState.pathMap.pan[0]);
  const mapPanY = useStudioStore((s) => s.mapState.pathMap.pan[1]);
  const setMapZoom = useStudioStore((s) => s.setMapZoom);
  const setMapPan = useStudioStore((s) => s.setMapPan);
  const fitMap = useStudioStore((s) => s.fitMap);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const setPathReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);
  const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setFocusScenePointRequest = useStudioStore((s) => s.setFocusScenePointRequest);

  const activePath = useMemo(() => scene.paths.find((path) => path.id === activePathId) ?? null, [scene.paths, activePathId]);

  const pathResult = useMemo(() => {
    if (!activePath) return null;
    return result?.pathResults.find((entry) => entry.pathId === activePath.id) ?? null;
  }, [activePath, result?.pathResults]);
  const timelineEvents = useMemo(() => sortTimelineEvents(pathResult?.timeline), [pathResult?.timeline]);
  const safeDurationS = useMemo(() => clampPathDuration(pathResult?.totalDurationS), [pathResult?.totalDurationS]);
  const estimatedDurationS = useMemo(() => clampPathDuration(getPathReplayDurationS(activePath)), [activePath]);
  const safeReplayProgress = clampReplayProgress(pathReplay.progress);
  const safeCurrentTime = safeDurationS > 0 ? safeDurationS * safeReplayProgress : 0;

  const pathLength = activePath ? pathLengthM(activePath) : 0;
  const estSeconds = activePath ? estimatedDurationS : 0;
  const visiblePct = pathResult && safeDurationS > 0
    ? Math.round((pathResult.visibleDurationS / safeDurationS) * 100)
    : null;

  const replayActor = useMemo(() => {
    if (!activePath) return null;
    return pointOnPathAtProgress(activePath, safeReplayProgress);
  }, [activePath, safeReplayProgress]);

  const pathSamples = useMemo(() => {
    if (!activePath) return [];
    return samplePathQuality(activePath, result?.coverageCells ?? [], 0.3);
  }, [activePath, result?.coverageCells]);

  const mapState = useMemo(
    () => ({
      zoom: mapZoom,
      pan: [mapPanX, mapPanY] as [number, number],
    }),
    [mapPanX, mapPanY, mapZoom],
  );

  const currentTime = safeCurrentTime;
  const currentSampleIndex = useMemo(() => {
    if (!pathSamples.length) return -1;
    let winner = 0;
    for (let index = 0; index < pathSamples.length; index += 1) {
      if (pathSamples[index]!.timeS <= currentTime) {
        winner = index;
        continue;
      }
      break;
    }
    return winner;
  }, [currentTime, pathSamples]);

  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const detailIndex = selectedSegmentIndex ?? currentSampleIndex;
  const detailSample = detailIndex >= 0 ? pathSamples[Math.min(detailIndex, Math.max(pathSamples.length - 1, 0))] ?? null : null;
  const currentEvent = findLatestTimelineEventAtOrBeforeTime(timelineEvents, safeCurrentTime);
  const nextEvent = findNextTimelineEventAfterTime(timelineEvents, safeCurrentTime);
  const currentQualityLabel = detailSample ? QUALITY_LABEL[detailSample.quality] : "No path";
  const currentQualityColor = detailSample ? qualityColor(detailSample.quality) : MAP_COLORS.quality.none;

  return (
    <div className="w-[194px] flex-shrink-0 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Path Map - Scenario / Path</span>
        {activePath ? (
          <span className="max-w-[104px] truncate rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-0.5 text-[8px] text-[#9ea8bf]">
            {activePath.label}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-1 text-[10px]">
        <select
          className="min-w-0 flex-1 rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[11px] text-[#c7d0e4]"
          value={activePath?.id ?? ""}
          onChange={(event) => {
            const id = event.target.value;
            setActivePathId(id || null);
            setSelectedSegmentIndex(null);
            setPathReplayPlaying(false);
            setPathReplayProgress(0);
          }}
        >
          {scene.paths.length === 0 ? (
            <option value="">No paths</option>
          ) : (
            <>
              <option value="">Select path</option>
              {scene.paths.map((path) => (
                <option key={path.id} value={path.id}>{path.label}</option>
              ))}
            </>
          )}
        </select>

        <button type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#24283a] bg-[#111521] text-[#c7d0e4]"
          onClick={() => {
            if (!activePath) return;
            fitMap("pathMap");
          }}
          title="Fit path map"
          aria-label="Fit path map"
        >
          Fit
        </button>
      </div>

      <MapCanvas
        scene={scene}
        result={result}
        mode="path"
        width={width}
        height={height}
        className="mt-2"
        layers={mapLayerFlagsFromStore(layerVis)}
        selectedNodeId={selected}
        hoveredNodeId={hovered}
        activePathId={activePath?.id ?? null}
        paths={scene.paths}
        selectedPathSegmentPathId={activePath?.id ?? null}
        selectedPathSegmentIndex={selectedSegmentIndex}
        onNodeSelect={setSelected}
        onNodeHover={setHovered}
        onPathSegmentSelect={(pathId, index) => {
          if (!activePath || pathId !== activePath.id) return;
          setSelectedSegmentIndex(index);
          const sample = pathSamples[index];
          if (safeDurationS > 0 && sample) {
            setPathReplayProgress(clampReplayProgress(sample.timeS / safeDurationS));
          }
        }}
        onMapClick={(point) => {
          setSelectedSegmentIndex(null);
          setFocusScenePointRequest({ point, source: "pathMap" });
        }}
        onMapDoubleClick={(point) => {
          fitMap("pathMap");
          setFocusScenePointRequest({ point, source: "pathMap" });
        }}
        mapTarget="pathMap"
        zoom={mapState.zoom}
        pan={mapState.pan}
        onSetZoom={setMapZoom}
        onSetPan={setMapPan}
        onFit={fitMap}
        replayActor={replayActor}
        activePathForReplay={activePath}
        showGrid
      />

      <CurrentPathStatePanel
        activePath={activePath}
        currentSample={detailSample}
        currentEvent={currentEvent}
        nextEvent={nextEvent}
        currentTime={currentTime}
        currentQualityLabel={currentQualityLabel}
        currentQualityColor={currentQualityColor}
        replayActor={replayActor}
        pathResult={pathResult}
        timelineEvents={timelineEvents}
      />

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="text-[13px] font-semibold text-[#d7deed]">{pathLength.toFixed(1)} m</div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[#556076]">Path Length</div>
        </div>
        <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="text-[13px] font-semibold text-[#d7deed]">{estSeconds.toFixed(1)} sec</div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[#556076]">Est. Time</div>
        </div>
        <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className={`text-[13px] font-semibold ${
            visiblePct === null
              ? "text-[#d7deed]"
              : visiblePct >= 80
                ? "text-emerald-300"
                : visiblePct >= 50
                  ? "text-amber-300"
                  : "text-rose-300"
          }`}>
            {visiblePct === null ? "--" : `${visiblePct}%`}
          </div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[#556076]">Route Visibility</div>
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Coverage Ribbon</span>
          <span className="text-[9px] text-[#8f9bb1]">{timelineEvents.length} events</span>
        </div>

        <CoverageRibbon path={activePath} coverageCells={result?.coverageCells ?? []} stepM={0.25} />
      </div>

      <PathEventsList
        timeline={timelineEvents}
        currentTime={currentTime}
        onSeek={(timeS) => {
          if (!pathResult || safeDurationS <= 0) return;
          setPathReplayProgress(clampReplayProgress(timeS / safeDurationS));
        }}
      />

      <PathSegmentDetails
        path={activePath}
        samples={pathSamples}
        selectedIndex={detailIndex}
      />

      <div className="mt-2 flex gap-1.5">
        <button type="button"
          className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-[#24283a] bg-[#111521] text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
        >
          <Edit3 className="h-3 w-3" />
          Edit Path
        </button>
        <button type="button"
          onClick={() => {
            if (!activePath) return;
            setSelectedSegmentIndex(null);
            setPathReplayProgress(0);
            setPathReplayPlaying(true);
          }}
          className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-green-800/35 bg-green-900/20 text-[10px] font-medium text-green-300 transition-colors hover:bg-green-900/30"
          disabled={!activePath}
        >
          <Play className="h-3 w-3" />
          Play Path
        </button>
        <button type="button"
          onClick={() => setViewMode("replay")}
          className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-sky-800/35 bg-sky-900/20 text-[10px] font-medium text-sky-300 transition-colors hover:bg-sky-900/30"
          disabled={!activePath}
        >
          Open Path Replay
        </button>
      </div>
    </div>
  );
}

function CurrentPathStatePanel({
  activePath,
  currentSample,
  currentEvent,
  nextEvent,
  currentTime,
  currentQualityLabel,
  currentQualityColor,
  replayActor,
  pathResult,
  timelineEvents,
}: {
  activePath: ScenarioPath | null;
  currentSample: ReturnType<typeof samplePathQuality>[number] | null;
  currentEvent: { timeS: number; event: string; quality?: DoriQuality; cameraId?: string; reason?: string } | null;
  nextEvent: { timeS: number; event: string; quality?: DoriQuality; cameraId?: string; reason?: string } | null;
  currentTime: number;
  currentQualityLabel: string;
  currentQualityColor: string;
  replayActor: [number, number] | null;
  pathResult: {
    visibilityByCamera: Record<string, { visibleS: number; maxQuality: DoriQuality }>;
    timeline: { timeS: number; event: string; quality?: DoriQuality; cameraId?: string; reason?: string }[];
  } | null;
  timelineEvents: { timeS: number; event: string; quality?: DoriQuality; cameraId?: string; reason?: string }[];
}) {
  const visibilityState = currentSample?.quality === "none" ? "Lost now" : currentSample ? "Visible now" : "No path";
  const bestCameraNow = currentSample?.coveringCameras.length
    ? currentSample.coveringCameras
        .slice()
        .sort((a, b) => {
          const aData = pathResult?.visibilityByCamera[a];
          const bData = pathResult?.visibilityByCamera[b];
          const rankDiff = (QUALITY_RANK[bData?.maxQuality ?? "none"] ?? 0) - (QUALITY_RANK[aData?.maxQuality ?? "none"] ?? 0);
          if (rankDiff !== 0) return rankDiff;
          return (bData?.visibleS ?? 0) - (aData?.visibleS ?? 0);
        })[0]
    : null;
  const upcomingRiskEvent = timelineEvents.find((event) => event.timeS > currentTime && event.event === "lost") ?? nextEvent;

  return (
    <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Now</div>
          <div className="mt-0.5 text-[10px] text-[#9aa6bf]">
            {activePath ? activePath.label : "No path selected"}
          </div>
        </div>
        <div className="rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em]" style={{ backgroundColor: `${currentQualityColor}22`, color: currentQualityColor }}>
          {currentQualityLabel}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Time</div>
          <div className="text-[11px] font-semibold text-[#dfe5f2]">{currentTime.toFixed(1)}s</div>
        </div>
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Visibility State</div>
          <div className="text-[11px] font-semibold text-[#dfe5f2]">
            {visibilityState}
          </div>
        </div>
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Best Camera</div>
          <div className="text-[11px] font-semibold text-[#dfe5f2]">
            {bestCameraNow ?? "None"}
          </div>
        </div>
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Actor Position</div>
          <div className="text-[11px] font-semibold text-[#dfe5f2]">
            {replayActor ? `${replayActor[0].toFixed(1)}, ${replayActor[1].toFixed(1)}` : "--"}
          </div>
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1.5">
        <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Event</div>
        <div className="text-[10px] font-semibold text-[#dfe5f2]">
          {currentEvent ? `${currentEvent.event}${currentEvent.reason ? ` · ${currentEvent.reason}` : ""}` : "Awaiting replay"}
        </div>
      </div>

      {upcomingRiskEvent ? (
        <div className="mt-2 rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Upcoming Lost / Zone Event</div>
          <div className="text-[10px] font-semibold text-[#dfe5f2]">
            {upcomingRiskEvent.event}
            {upcomingRiskEvent.reason ? ` · ${upcomingRiskEvent.reason}` : ""}
            {" @ "}
            {upcomingRiskEvent.timeS.toFixed(1)}s
          </div>
        </div>
      ) : null}

      {currentSample ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[8px] text-[#7f8ca6]">
          <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[#9ea8bf]">
            {currentSample.quality}
          </span>
          <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[#9ea8bf]">
            {currentSample.coveringCameras.length > 0 ? currentSample.coveringCameras.length : 0} cams
          </span>
        </div>
      ) : null}
    </div>
  );
}

function PathEventsList({
  timeline,
  currentTime,
  onSeek,
}: {
  timeline: { timeS: number; event: string; quality?: DoriQuality; cameraId?: string; reason?: string }[];
  currentTime: number;
  onSeek: (timeS: number) => void;
}) {
  const severityFor = (event: { quality?: DoriQuality; event: string }) => {
    const quality = event.quality ?? (event.event === "lost" ? "none" : "detection");
    if (quality === "none") return "high" as const;
    if (quality === "detection" || quality === "observation" || quality === "outline") return "medium" as const;
    return "low" as const;
  };

  const actionFor = (event: { quality?: DoriQuality; event: string }) => {
    const quality = event.quality ?? (event.event === "lost" ? "none" : "detection");
    if (event.event === "lost" || quality === "none") return "Re-aim or add camera for this segment";
    if (quality === "detection" || quality === "observation" || quality === "outline") return "Tune camera angle / lighting";
    return "Monitor only";
  };

  if (timeline.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-[9px] text-[#6f7b94]">
        No replay events yet.
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Path Events</span>
        <span className="text-[8px] text-[#8f9bb1]">click to seek</span>
      </div>
      <div className="max-h-28 space-y-1 overflow-auto pr-1">
        {timeline.map((event, index) => {
          const active = event.timeS <= currentTime && timeline[index + 1]?.timeS > currentTime;
          const severity = severityFor(event);
          return (
            <button
              key={`${event.event}-${event.timeS}-${index}`}
              type="button"
              onClick={() => onSeek(event.timeS)}
              className={`flex w-full items-center justify-between rounded-lg border px-2 py-1 text-left transition-colors ${
                active
                  ? "border-sky-500/40 bg-sky-500/10"
                  : "border-[#243146] bg-[#0c1320] hover:border-[#2f3c53]"
              }`}
            >
              <div className="min-w-0">
                <div className="text-[9px] font-medium text-[#dfe5f2]">{event.event}</div>
                <div className="text-[8px] text-[#7f8ca6]">
                  {event.reason ?? event.cameraId ?? "No detail"}
                </div>
                <div className={cn(
                  "mt-1 inline-flex rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em]",
                  severity === "high"
                    ? "bg-rose-500/15 text-rose-300"
                    : severity === "medium"
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-emerald-500/15 text-emerald-300",
                )}>
                  {severity}
                </div>
                <div className="mt-1 text-[8px] text-[#9ea8bf]">Action: {actionFor(event)}</div>
              </div>
              <div className="flex flex-col items-end gap-0.5 text-[8px] text-[#9ea8bf]">
                <span>{event.timeS.toFixed(1)}s</span>
                {event.quality ? (
                  <span className="rounded border border-[#2c3347] px-1 py-0.5" style={{ color: qualityColor(event.quality) }}>
                    {event.quality}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PathSegmentDetails({
  path,
  samples,
  selectedIndex,
}: {
  path: ScenarioPath | null;
  samples: ReturnType<typeof samplePathQuality>;
  selectedIndex: number;
}) {
  if (!path || samples.length < 2 || selectedIndex < 0) {
    return (
      <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 text-[9px] text-[#6f7b94]">
        No segment selected.
      </div>
    );
  }

  const start = samples[selectedIndex] ?? samples[0];
  const end = samples[Math.min(selectedIndex + 1, samples.length - 1)] ?? samples[samples.length - 1];

  if (!start || !end) {
    return null;
  }

  return (
    <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Segment Details</span>
        <span className="text-[8px] text-[#8f9bb1]">
          {selectedIndex + 1}/{Math.max(1, samples.length - 1)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">From</div>
          <div className="font-semibold text-[#dfe5f2]">{start.distanceM.toFixed(1)}m</div>
        </div>
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">To</div>
          <div className="font-semibold text-[#dfe5f2]">{end.distanceM.toFixed(1)}m</div>
        </div>
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Quality</div>
          <div className="font-semibold" style={{ color: qualityColor(start.quality) }}>{start.quality}</div>
        </div>
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1.5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Cameras</div>
          <div className="font-semibold text-[#dfe5f2]">{start.coveringCameras.length > 0 ? start.coveringCameras.join(", ") : "None"}</div>
        </div>
      </div>
    </div>
  );
}
