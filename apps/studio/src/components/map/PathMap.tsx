"use client";

import { Edit3, Play } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

import { CoverageRibbon } from "@/components/map/CoverageRibbon";
import { MapCanvas } from "@/components/map/MapCanvas";
import { pathLengthM, pointOnPathAtProgress } from "@/components/map/map-utils";
import { useStudioStore } from "@/store/studio-store";
import type { DoriQuality, ScenarioPath } from "@/schema/security-scene";

type PathMapProps = {
  width?: number;
  height?: number;
};

const QUALITY_COLORS: Record<DoriQuality, string> = {
  identification: "#3b82f6",
  recognition: "#22c55e",
  observation: "#eab308",
  detection: "#f97316",
  none: "#ef4444",
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
  const mapState = useStudioStore((s) => s.mapState.pathMap);
  const setMapZoom = useStudioStore((s) => s.setMapZoom);
  const setMapPan = useStudioStore((s) => s.setMapPan);
  const fitMap = useStudioStore((s) => s.fitMap);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const setPathReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);
  const setPathReplayProgress = useStudioStore((s) => s.setPathReplayProgress);

  const activePath = useMemo(() => scene.paths.find((path) => path.id === activePathId) ?? scene.paths[0] ?? null, [scene.paths, activePathId]);

  useEffect(() => {
    if (scene.paths.length === 0 && activePathId !== null) {
      setActivePathId(null);
      return;
    }

    if (!activePathId && scene.paths.length > 0) {
      setActivePathId(scene.paths[0]!.id);
    }

    if (activePathId && !scene.paths.some((path) => path.id === activePathId) && scene.paths.length > 0) {
      setActivePathId(scene.paths[0]!.id);
    }
  }, [activePathId, scene.paths, setActivePathId]);

  const pathResult = useMemo(() => {
    if (!activePath) return null;
    return result?.pathResults.find((entry) => entry.pathId === activePath.id) ?? null;
  }, [activePath, result?.pathResults]);

  const pathLength = activePath ? pathLengthM(activePath) : 0;
  const estSeconds = activePath ? pathLength / activePath.speedMps : 0;
  const visiblePct = pathResult && pathResult.totalDurationS > 0
    ? Math.round((pathResult.visibleDurationS / pathResult.totalDurationS) * 100)
    : null;

  const replayActor = useMemo(() => {
    if (!activePath) return null;
    return pointOnPathAtProgress(activePath, pathReplay.progress);
  }, [activePath, pathReplay.progress]);

  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  return (
    <div className="w-[194px] flex-shrink-0 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Path Map</span>
      </div>

      <div className="flex items-center justify-between gap-1 text-[10px]">
        <select
          className="min-w-0 flex-1 rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[11px] text-[#c7d0e4]"
          value={activePath?.id ?? ""}
          onChange={(event) => {
            const id = event.target.value;
            setActivePathId(id || null);
            setPathReplayProgress(0);
          }}
        >
          {scene.paths.length === 0 ? (
            <option value="">No paths</option>
          ) : (
            scene.paths.map((path) => (
              <option key={path.id} value={path.id}>{path.label}</option>
            ))
          )}
        </select>

        <button
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
        onNodeSelect={setSelected}
        onNodeHover={setHovered}
        onPathSegmentSelect={(pathId, index) => {
          if (!activePath) return;
          if (pathId === activePath.id) {
            setSelectedSegment(`${pathId}:${index}`);
          }
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

      {selectedSegment ? (
        <div className="mt-1.5 text-[8px] text-[#7f8ca6]">
          Segment: <span className="font-mono text-[#c7d0e4]">{selectedSegment}</span>
        </div>
      ) : null}

      <div className="mt-2 flex h-3 items-center gap-2 text-[8px]">
        <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[#9ea8bf]">
          {activePath?.actorType}
        </span>
        <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[#9ea8bf]">
          {activePath ? activePath.intent.replace("_", " ") : "No path"}
        </span>
        <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1 text-[#9ea8bf]">
          {activePath ? `${activePath.speedMps.toFixed(1)} m/s` : "0 m/s"}
        </span>
      </div>

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
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-[#556076]">Visible</div>
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Coverage Ribbon</span>
          <span className="text-[9px] text-[#8f9bb1]">{pathResult?.timeline.length ?? 0} events</span>
        </div>

        <CoverageRibbon path={activePath} coverageCells={result?.coverageCells ?? []} stepM={0.25} />

        {pathResult ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[8px] text-[#7f8ca6]">
            {pathResult.timeline.slice(0, 3).map((event, index) => (
              <span key={`${event.event}-${index}`} className="rounded border border-[#2c3347] px-1 py-0.5">
                {event.event}: {event.quality ?? "none"}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex gap-1.5">
        <button
          className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-[#24283a] bg-[#111521] text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
        >
          <Edit3 className="h-3 w-3" />
          Edit Path
        </button>
        <button
          onClick={() => {
            if (!activePath) return;
            setPathReplayProgress(0);
            setPathReplayPlaying(true);
          }}
          className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-green-800/35 bg-green-900/20 text-[10px] font-medium text-green-300 transition-colors hover:bg-green-900/30"
          disabled={!activePath}
        >
          <Play className="h-3 w-3" />
          Play Path
        </button>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-3 text-[8px] text-[#7f8ca6]">
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
          <span>End</span>
        </div>
      </div>

      <div className="mt-2 text-[8px] text-[#6f7b94]">
        {activePath ? (
          <div className="space-y-0.5">
            <p>Coverage quality legend</p>
            <div className="flex gap-2">
              {(Object.keys(QUALITY_COLORS) as DoriQuality[]).map((quality) => (
                <span
                  key={quality}
                  className="inline-flex items-center gap-1"
                  title={quality}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ backgroundColor: QUALITY_COLORS[quality] }}
                  />
                  {quality}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
