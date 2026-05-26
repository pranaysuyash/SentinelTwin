"use client";

import { Minus, Plus, RefreshCcw } from "lucide-react";
import { useMemo } from "react";

import { MapCanvas } from "@/components/map/MapCanvas";
import { pointOnPathAtProgress } from "@/components/map/map-utils";
import { useStudioStore } from "@/store/studio-store";

type MiniMapProps = {
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

function nodeLabel(scene: ReturnType<typeof useStudioStore.getState>, id: string | null): string | null {
  if (!id) return null;
  const candidates = [
    ...scene.scene.walls,
    ...scene.scene.doors,
    ...scene.scene.windows,
    ...scene.scene.cameras,
    ...scene.scene.securityLights,
    ...scene.scene.obstructions,
    ...scene.scene.criticalZones,
    ...scene.scene.privacyZones,
    ...scene.scene.entryPoints,
    ...scene.scene.paths,
  ];

  const match = candidates.find((item: { id: string; label?: string; name?: string }) => item.id === id);
  return match ? (match.label ?? match.name ?? id) : id;
}

export function MiniMap({
  width = 154,
  height = 112,
}: MiniMapProps) {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const selected = useStudioStore((s) => s.selectedNodeId);
  const setSelected = useStudioStore((s) => s.selectNode);
  const layerVis = useStudioStore((s) => s.layerVisibility);
  const setZoom = useStudioStore((s) => s.setMapZoom);
  const setPan = useStudioStore((s) => s.setMapPan);
  const fitMap = useStudioStore((s) => s.fitMap);
  const mapState = useStudioStore((s) => s.mapState.minimap);
  const hovered = useStudioStore((s) => s.hoveredMapNodeId);
  const setHovered = useStudioStore((s) => s.setHoveredMapNodeId);
  const activePathId = useStudioStore((s) => s.activePathId);
  const setReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);
  const setReplayProgress = useStudioStore((s) => s.setPathReplayProgress);
  const pathReplay = useStudioStore((s) => s.pathReplay);

  const tooltipText = useMemo(() => nodeLabel(useStudioStore.getState(), hovered), [hovered]);
  const activePath = scene.paths.find((path) => path.id === activePathId) ?? scene.paths[0] ?? null;
  const replayActor = useMemo(() => {
    if (!activePath) return null;
    return pointOnPathAtProgress(activePath, pathReplay.progress);
  }, [activePath, pathReplay.progress]);

  const isReplayActive = pathReplay.playing || pathReplay.progress > 0;

  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <MapCanvas
        scene={scene}
        result={result}
        mode="mini"
        width={width}
        height={height}
        className="mb-2"
        layers={mapLayerFlagsFromStore(layerVis)}
        selectedNodeId={selected}
        hoveredNodeId={hovered}
        activePathId={activePathId}
        paths={scene.paths}
        onNodeSelect={(next) => {
          setSelected(next);
        }}
        onNodeHover={(next) => {
          setHovered(next);
        }}
        mapTarget="minimap"
        zoom={mapState.zoom}
        pan={mapState.pan}
        onSetZoom={setZoom}
        onSetPan={setPan}
        onFit={fitMap}
        replayActor={isReplayActive ? replayActor : null}
      />

      {tooltipText ? <div className="mb-1 text-[10px] text-[#94a3b8]">{tooltipText}</div> : null}

      <div className="mt-2 flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-[#556076]">
        <span>Coverage</span>
        <span>{scene.dimensions.width}m x {scene.dimensions.depth}m</span>
      </div>

      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setZoom("minimap", mapState.zoom * 0.9);
              setReplayProgress(0);
            }}
            className="flex h-5 w-5 items-center justify-center rounded-md border border-[#1f2536] text-[#556076] transition-colors hover:border-[#2b3246] hover:text-white"
            title="Zoom out"
            aria-label="Zoom out minimap"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => {
              setZoom("minimap", mapState.zoom * 1.1);
            }}
            className="flex h-5 w-5 items-center justify-center rounded-md border border-[#1f2536] text-[#556076] transition-colors hover:border-[#2b3246] hover:text-white"
            title="Zoom in"
            aria-label="Zoom in minimap"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => {
              fitMap("minimap");
            }}
            className="h-5 rounded-md border border-[#1f2536] px-1.5 text-[9px] font-medium text-[#7f8ca6] transition-colors hover:border-[#2b3246] hover:text-white"
            title="Fit map"
            aria-label="Fit minimap"
          >
            Fit
          </button>
        </div>
        <button
          onClick={() => {
            fitMap("minimap");
          }}
          className="h-5 rounded-md border border-[#1f2536] px-1.5 text-[9px] font-medium text-[#7f8ca6] transition-colors hover:border-[#2b3246] hover:text-white"
          title="Reset map view"
        >
          2D
        </button>
      </div>

      {isReplayActive ? (
        <div className="mt-1.5 flex items-center justify-between text-[8px] text-[#556076]">
          <span>Replay actor visible</span>
          <button
            onClick={() => {
              setReplayPlaying(false);
              setReplayProgress(0);
            }}
            className="inline-flex items-center gap-1 text-[#7c8ca7]"
            title="Stop replay"
          >
            <RefreshCcw className="h-3 w-3" />
            reset
          </button>
        </div>
      ) : null}
    </div>
  );
}
