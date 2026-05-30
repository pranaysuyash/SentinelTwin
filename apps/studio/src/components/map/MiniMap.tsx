"use client";

import { ChevronDown, ChevronUp, Layers, Map, Minus, Plus, RefreshCcw, X } from "lucide-react";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { MapCanvas } from "@/components/map/MapCanvas";
import { MAP_COLORS } from "@/components/map/map-colors";
import { pointOnPathAtProgress } from "@/components/map/path-quality";
import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import { type LayerId, useStudioStore } from "@/store/studio-store";

type MiniMapProps = {
  width?: number;
  height?: number;
};

const EXPANDED_LEFT_DOCK_WIDTH = 360;
const EXPANDED_MAP_HEIGHT = 188;

type MiniMapMode = "collapsed" | "compact" | "expanded";
type LabelDensity = "off" | "sparse" | "dense";

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

function nodeLabel(scene: SecurityScene, id: string | null): string | null {
  if (!id) return null;

  const candidates = [
    ...scene.walls,
    ...scene.doors,
    ...scene.windows,
    ...scene.cameras,
    ...scene.securityLights,
    ...scene.obstructions,
    ...scene.criticalZones,
    ...scene.privacyZones,
    ...scene.entryPoints,
    ...scene.paths,
  ];

  const match = candidates.find((item) => item.id === id) as { id: string; label?: string; name?: string } | undefined;
  return match ? (match.label ?? match.name ?? id) : id;
}

function severityLabel(result: { status: string } | null | undefined) {
  if (!result) return "Clear";
  if (result.status === "fail") return "Poor";
  if (result.status === "partial") return "Mixed";
  return "Clear";
}

function layerLabel(layerKey: keyof ReturnType<typeof mapLayerFlagsFromStore>) {
  switch (layerKey) {
    case "walls":
      return "Walls";
    case "doors":
      return "Doors";
    case "windows":
      return "Windows";
    case "cameras":
      return "Cameras";
    case "cameraCones":
      return "Camera FOV";
    case "obstructions":
      return "Obstructions";
    case "lights":
      return "Lights";
    case "criticalZones":
      return "Critical Zones";
    case "privacyZones":
      return "Privacy Zones";
    case "paths":
      return "Paths";
    case "coverage":
      return "Coverage";
    case "labels":
      return "Labels";
    default:
      return layerKey;
  }
}

function mapLayerKeyToStoreId(layerKey: keyof ReturnType<typeof mapLayerFlagsFromStore>): LayerId {
  if (layerKey === "cameraCones") return "camera_cones";
  if (layerKey === "criticalZones") return "critical_zones";
  if (layerKey === "privacyZones") return "privacy_zones";
  if (layerKey === "walls") return "walls_floors";
  return layerKey as LayerId;
}

function legendSwatch({
  color,
  label,
  detail,
}: {
  color: string;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#1f2536] bg-[#0d121b] px-2 py-1.5">
      <span className="h-2.5 w-2.5 rounded-sm border border-white/15" style={{ backgroundColor: color }} />
      <div className="min-w-0">
        <div className="text-[9px] font-medium text-[#d5dbea]">{label}</div>
        {detail ? <div className="text-[8px] text-[#6d7690]">{detail}</div> : null}
      </div>
    </div>
  );
}

function scaleBarLabel(scene: SecurityScene) {
  return scene.dimensions.width >= 14 ? 10 : 5;
}

function ScaleBar({ label }: { label: number }) {
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2 py-2">
      <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-[#556076]">
        <span>Scale</span>
        <span>{label}m</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-[#93c5fd] via-[#60a5fa] to-[#3b82f6]" style={{ width: `${Math.max(42, label * 8)}px` }} />
        <span className="text-[8px] text-[#7f8ca6]">approx.</span>
      </div>
    </div>
  );
}

function NorthIndicator() {
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2 py-2 text-center">
      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">North</div>
      <div className="mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-[#243146] bg-[#0c1320]">
        <ChevronUp className="h-4 w-4 text-[#93c5fd]" />
      </div>
    </div>
  );
}

function ViewportIndicator({ zoom, pan }: { zoom: number; pan: [number, number] }) {
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2 py-2">
      <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Viewport</div>
      <div className="mt-1 text-[10px] font-semibold text-[#d7deed]">{zoom.toFixed(2)}x</div>
      <div className="text-[8px] text-[#7f8ca6]">pan {pan[0].toFixed(0)}, {pan[1].toFixed(0)}</div>
    </div>
  );
}

function MiniMapCollapsed({
  onExpand,
  coveragePct,
}: {
  onExpand: () => void;
  coveragePct: number;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex h-12 w-full items-center justify-between rounded-xl border border-[#1f2536] bg-[#0b0f17] px-3 text-left transition-colors hover:border-[#31405a]"
      title="Expand minimap"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#243146] bg-[#111521]">
          <Map className="h-3.5 w-3.5 text-[#93c5fd]" />
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">MiniMap - Collapsed</div>
          <div className="text-[10px] text-[#9aa6bf]">Tap to expand</div>
        </div>
      </div>
      <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-medium text-emerald-300">
        {coveragePct}%
      </div>
    </button>
  );
}

function MiniMapHoverPreview({
  scene,
  result,
  selectedLabel,
  coveragePct,
  totalCritical,
  passedCritical,
}: {
  scene: SecurityScene;
  result: SimulationResult | null;
  selectedLabel: string | null;
  coveragePct: number;
  totalCritical: number;
  passedCritical: number;
}) {
  const setFocusScenePointRequest = useStudioStore((s) => s.setFocusScenePointRequest);
  const selectNode = useStudioStore((s) => s.selectNode);
  const setHovered = useStudioStore((s) => s.setHoveredMapNodeId);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const hoveredNodeId = useStudioStore((s) => s.hoveredMapNodeId);
  const activePathId = useStudioStore((s) => s.activePathId);
  const mapZoom = useStudioStore((s) => s.mapState.minimap.zoom);
  const mapPanX = useStudioStore((s) => s.mapState.minimap.pan[0]);
  const mapPanY = useStudioStore((s) => s.mapState.minimap.pan[1]);
  const setZoom = useStudioStore((s) => s.setMapZoom);
  const setPan = useStudioStore((s) => s.setMapPan);
  const fitMap = useStudioStore((s) => s.fitMap);
  const layerVis = useStudioStore((s) => s.layerVisibility);
  const focusPoint = useStudioStore((s) => s.focusScenePointHighlight?.point ?? null);
  const mapState = useMemo(
    () => ({
      zoom: mapZoom,
      pan: [mapPanX, mapPanY] as [number, number],
    }),
    [mapPanX, mapPanY, mapZoom],
  );
  return (
    <div className="mb-2 rounded-xl border border-[#243146] bg-[#0b1220] p-2 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Hover Preview</div>
          <div className="text-[10px] text-[#9aa6bf]">Quick readout for navigation</div>
        </div>
        <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-medium text-emerald-300">
          Live
        </div>
      </div>

      <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2">
        <div className="overflow-hidden rounded-lg border border-[#243146] bg-[#09101a]">
          <MapCanvas
            scene={scene}
            result={result}
            mode="mini"
            width={100}
            height={72}
            layers={mapLayerFlagsFromStore(layerVis)}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            activePathId={activePathId}
            paths={scene.paths}
            onNodeSelect={selectNode}
            onNodeHover={setHovered}
            onMapClick={(point) => {
              selectNode(null);
              setFocusScenePointRequest({ point, source: "minimap" });
            }}
            onMapDoubleClick={(point) => {
              fitMap("minimap");
              setFocusScenePointRequest({ point, source: "minimap" });
            }}
            mapTarget="minimap"
            zoom={mapState.zoom}
            pan={mapState.pan}
            onSetZoom={setZoom}
            onSetPan={setPan}
            onFit={fitMap}
            replayActor={null}
            focusPoint={focusPoint}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1">
            <span className="text-[9px] text-[#8aa0c2]">Coverage</span>
            <span className="text-[11px] font-semibold text-emerald-300">{coveragePct}%</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1">
            <span className="text-[9px] text-[#8aa0c2]">Critical Zones</span>
            <span className="text-[11px] font-semibold text-violet-300">
              {passedCritical} / {totalCritical}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1">
            <span className="text-[9px] text-[#8aa0c2]">Selected</span>
            <span className="text-[11px] font-semibold text-[#d7deed]">{selectedLabel ?? "None"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMapCompact({
  scene,
  result,
  selected,
  selectedLabel,
  tooltipText,
  coveragePct,
  totalCritical,
  passedCritical,
  failedCritical,
  mapWidth,
  mapHeight,
  mapLayers,
  selectedNodeId,
  hoveredNodeId,
  activePathId,
  mapState,
  onSetZoom,
  onSetPan,
  onFit,
  onNodeSelect,
  onNodeHover,
  onMapClick,
  onMapDoubleClick,
  replayActor,
  isReplayActive,
  onExpand,
}: {
  scene: SecurityScene;
  result: SimulationResult | null;
  selected: string | null;
  selectedLabel: string | null;
  tooltipText: string | null;
  coveragePct: number;
  totalCritical: number;
  passedCritical: number;
  failedCritical: { status: string } | null;
  mapWidth: number;
  mapHeight: number;
  mapLayers: ReturnType<typeof mapLayerFlagsFromStore>;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  activePathId: string | null;
  mapState: { zoom: number; pan: [number, number] };
  onSetZoom: (target: "minimap" | "pathMap", zoom: number) => void;
  onSetPan: (target: "minimap" | "pathMap", pan: [number, number]) => void;
  onFit: (target: "minimap" | "pathMap") => void;
  onNodeSelect: (id: string | null) => void;
  onNodeHover: (id: string | null) => void;
  onMapClick: (point: [number, number]) => void;
  onMapDoubleClick: (point: [number, number]) => void;
  replayActor: [number, number] | null;
  isReplayActive: boolean;
  onExpand: () => void;
}) {
  void selected;
  void coveragePct;
  void totalCritical;
  void passedCritical;
  void failedCritical;
  void selectedNodeId;
  void hoveredNodeId;
  void activePathId;
  void mapState;
  void onSetZoom;
  void onSetPan;
  void onFit;
  void onNodeSelect;
  void onNodeHover;
  void onMapClick;
  void onMapDoubleClick;
  const focusPoint = useStudioStore((s) => s.focusScenePointHighlight?.point ?? null);
  return (
    <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">MiniMap - Compact</div>
          <div className="mt-0.5 text-[10px] text-[#8f9bb1]">Compact navigation + status</div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExpand}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 text-[9px] font-medium text-[#7f8aa3] transition-colors hover:border-[#32384d] hover:text-white"
            title="Expand drawer"
          >
            <ChevronUp className="h-3 w-3" />
            Expand
          </button>
        </div>
      </div>

      <MapCanvas
        scene={scene}
        result={result}
        mode="mini"
        width={mapWidth}
        height={mapHeight}
        className="mb-2"
        layers={mapLayers}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        activePathId={activePathId}
        paths={scene.paths}
        onNodeSelect={onNodeSelect}
        onNodeHover={onNodeHover}
        onMapClick={onMapClick}
        onMapDoubleClick={onMapDoubleClick}
        mapTarget="minimap"
        zoom={mapState.zoom}
        pan={mapState.pan}
        onSetZoom={onSetZoom}
        onSetPan={onSetPan}
        onFit={onFit}
        replayActor={isReplayActive ? replayActor : null}
        focusPoint={focusPoint}
      />

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Coverage</div>
          <div className="text-[11px] font-semibold text-emerald-300">{coveragePct}%</div>
        </div>
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Critical</div>
          <div className="text-[11px] font-semibold text-violet-300">{passedCritical}/{totalCritical}</div>
        </div>
        <div className="rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1">
          <div className="text-[8px] uppercase tracking-[0.16em] text-[#6f7b94]">Worst</div>
          <div className={`text-[11px] font-semibold ${severityLabel(failedCritical) === "Poor" ? "text-rose-300" : severityLabel(failedCritical) === "Mixed" ? "text-amber-300" : "text-emerald-300"}`}>
            {severityLabel(failedCritical)}
          </div>
        </div>
      </div>

      {selectedLabel ? (
        <div className="mt-2 rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1 text-[9px] text-[#9aa6bf]">
          Selected: <span className="text-[#d7deed]">{selectedLabel}</span>
        </div>
      ) : null}

      {tooltipText ? (
        <div className="mt-1.5 text-[8px] text-[#556076]">{tooltipText}</div>
      ) : null}
    </div>
  );
}

function MiniMapExpanded({
  scene,
  result,
  selected,
  selectedLabel,
  tooltipText,
  coveragePct,
  totalCritical,
  passedCritical,
  failedCritical,
  mapWidth,
  mapHeight,
  mapLayers,
  selectedNodeId,
  hoveredNodeId,
  activePathId,
  mapState,
  onSetZoom,
  onSetPan,
  onFit,
  onNodeSelect,
  onNodeHover,
  onMapClick,
  onMapDoubleClick,
  replayActor,
  isReplayActive,
  onCollapse,
  labelDensity,
  setLabelDensity,
}: {
  scene: SecurityScene;
  result: SimulationResult | null;
  selected: string | null;
  selectedLabel: string | null;
  tooltipText: string | null;
  coveragePct: number;
  totalCritical: number;
  passedCritical: number;
  failedCritical: { status: string } | null;
  mapWidth: number;
  mapHeight: number;
  mapLayers: ReturnType<typeof mapLayerFlagsFromStore>;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  activePathId: string | null;
  mapState: { zoom: number; pan: [number, number] };
  onSetZoom: (target: "minimap" | "pathMap", zoom: number) => void;
  onSetPan: (target: "minimap" | "pathMap", pan: [number, number]) => void;
  onFit: (target: "minimap" | "pathMap") => void;
  onNodeSelect: (id: string | null) => void;
  onNodeHover: (id: string | null) => void;
  onMapClick: (point: [number, number]) => void;
  onMapDoubleClick: (point: [number, number]) => void;
  replayActor: [number, number] | null;
  isReplayActive: boolean;
  onCollapse: () => void;
  labelDensity: LabelDensity;
  setLabelDensity: (density: LabelDensity) => void;
}) {
  void selected;
  void coveragePct;
  void totalCritical;
  void passedCritical;
  void failedCritical;
  void selectedNodeId;
  void hoveredNodeId;
  void activePathId;
  void mapState;
  void onSetZoom;
  void onSetPan;
  void onFit;
  void onNodeSelect;
  void onNodeHover;
  void onMapClick;
  void onMapDoubleClick;
  const focusPoint = useStudioStore((s) => s.focusScenePointHighlight?.point ?? null);
  const labelMode = labelDensity !== "off";
  return (
    <div className="rounded-2xl border border-[#1f2536] bg-[#0b0f17] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">MiniMap - Expanded</div>
          <div className="mt-0.5 text-[10px] text-[#8f9bb1]">Navigation drawer</div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 text-[9px] font-medium text-[#7f8aa3] transition-colors hover:border-[#32384d] hover:text-white"
            title="Collapse drawer"
          >
            <ChevronDown className="h-3 w-3" />
            Collapse
          </button>
          <button
            type="button"
            onClick={() => setLabelDensity(labelDensity === "off" ? "sparse" : labelDensity === "sparse" ? "dense" : "off")}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 text-[9px] font-medium text-[#7f8aa3] transition-colors hover:border-[#32384d] hover:text-white"
            title="Cycle label density"
          >
            <Layers className="h-3 w-3" />
            {labelDensity}
          </button>
        </div>
      </div>

      <MapCanvas
        scene={scene}
        result={result}
        mode="mini"
        width={mapWidth}
        height={mapHeight}
        className="mb-3"
        layers={mapLayers}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        activePathId={activePathId}
        paths={scene.paths}
        onNodeSelect={onNodeSelect}
        onNodeHover={onNodeHover}
        onMapClick={onMapClick}
        onMapDoubleClick={onMapDoubleClick}
        mapTarget="minimap"
        zoom={mapState.zoom}
        pan={mapState.pan}
        onSetZoom={onSetZoom}
        onSetPan={onSetPan}
        onFit={onFit}
        replayActor={isReplayActive ? replayActor : null}
        showNodeLabels={labelMode}
        focusPoint={focusPoint}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px]">
        <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[8px] text-[#7f8ca6]">
            <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1">Drag to pan</span>
            <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1">Wheel to zoom</span>
            <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1">Click objects to select</span>
            <span className="rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-1">Click empty map to focus 3D</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => onSetZoom("minimap", mapState.zoom * 0.9)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#1f2536] bg-[#111521] text-[#556076] transition-colors hover:border-[#2b3246] hover:text-white"
              aria-label="Zoom out minimap"
              title="Zoom out"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              onClick={() => onSetZoom("minimap", mapState.zoom * 1.1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#1f2536] bg-[#111521] text-[#556076] transition-colors hover:border-[#2b3246] hover:text-white"
              aria-label="Zoom in minimap"
              title="Zoom in"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={() => onFit("minimap")}
              className="h-7 rounded-md border border-[#1f2536] bg-[#111521] px-2 text-[9px] font-medium text-[#7f8ca6] transition-colors hover:border-[#2b3246] hover:text-white"
              aria-label="Fit minimap"
            >
              Fit
            </button>
            <button
              onClick={() => {
                useStudioStore.getState().setViewMode("map");
                onFit("minimap");
              }}
              className="h-7 rounded-md border border-[#1f2536] bg-[#111521] px-2 text-[9px] font-medium text-[#7f8ca6] transition-colors hover:border-[#2b3246] hover:text-white"
              title="Switch to 2D top view"
            >
              2D Top View
            </button>
            <button
              onClick={() => {
                useStudioStore.getState().setPathReplayPlaying(false);
                useStudioStore.getState().setPathReplayProgress(0);
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#1f2536] bg-[#111521] px-2 text-[9px] font-medium text-[#7f8ca6] transition-colors hover:border-[#2b3246] hover:text-white"
              title="Reset replay"
            >
              <RefreshCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2">
            <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-[#556076]">Layers</div>
            <div className="space-y-1">
              {Object.keys(mapLayers).map((layerKey) => {
                const typedKey = layerKey as keyof ReturnType<typeof mapLayerFlagsFromStore>;
                const storeKey = mapLayerKeyToStoreId(typedKey);
                const visible = useStudioStore.getState().layerVisibility[storeKey];

                return (
                  <button
                    key={layerKey}
                    type="button"
                    onClick={() => {
                      useStudioStore.getState().toggleLayer(storeKey);
                    }}
                    className="flex h-7 w-full items-center justify-between rounded-lg border border-[#20283c] bg-[#111521] px-2 text-left text-[10px] text-[#b9c3d6] transition-colors hover:border-[#31405a] hover:text-white"
                  >
                    <span className="truncate">{layerLabel(typedKey)}</span>
                    <span className={`h-2.5 w-2.5 rounded-full border ${visible ? "border-emerald-400 bg-emerald-400/80" : "border-[#4b5568] bg-transparent"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2">
              <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-[#556076]">Legend</div>
              <div className="grid gap-1.5">
                {legendSwatch({ color: "#2563eb", label: "Cameras", detail: "Active sensor points" })}
                {legendSwatch({ color: "rgba(37,99,235,0.35)", label: "Camera FOV", detail: "Visible cone" })}
                {legendSwatch({ color: MAP_COLORS.quality.recognition, label: "Coverage", detail: "DORI heatmap" })}
                {legendSwatch({ color: "#f59e0b", label: "Critical zones", detail: "Priority areas" })}
                {legendSwatch({ color: "#f43f5e", label: "Privacy zones", detail: "Restricted areas" })}
                {legendSwatch({ color: MAP_COLORS.pathActive, label: "Paths", detail: "Scenario route" })}
                {legendSwatch({ color: MAP_COLORS.selection, label: "Selected", detail: "Current node" })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ScaleBar label={scaleBarLabel(scene)} />
              <NorthIndicator />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ViewportIndicator zoom={mapState.zoom} pan={mapState.pan} />
              <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2 py-2">
                <div className="text-[8px] uppercase tracking-[0.18em] text-[#556076]">Labels</div>
                <div className="mt-1 text-[10px] font-semibold text-[#d7deed]">{labelDensity}</div>
                <div className="text-[8px] text-[#7f8ca6]">off · sparse · dense</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedLabel ? (
        <div className="mt-2 rounded-lg border border-[#243146] bg-[#0c1320] px-2 py-1 text-[9px] text-[#9aa6bf]">
          Selected: <span className="text-[#d7deed]">{selectedLabel}</span>
        </div>
      ) : null}

      {tooltipText ? (
        <div className="mt-1.5 text-[8px] text-[#556076]">{tooltipText}</div>
      ) : null}
    </div>
  );
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
  const mapZoom = useStudioStore((s) => s.mapState.minimap.zoom);
  const mapPanX = useStudioStore((s) => s.mapState.minimap.pan[0]);
  const mapPanY = useStudioStore((s) => s.mapState.minimap.pan[1]);
  const hovered = useStudioStore((s) => s.hoveredMapNodeId);
  const setHovered = useStudioStore((s) => s.setHoveredMapNodeId);
  const activePathId = useStudioStore((s) => s.activePathId);
  const setReplayPlaying = useStudioStore((s) => s.setPathReplayPlaying);
  const setReplayProgress = useStudioStore((s) => s.setPathReplayProgress);
  const pathReplay = useStudioStore((s) => s.pathReplay);
  const setFocusScenePointRequest = useStudioStore((s) => s.setFocusScenePointRequest);
  const leftDockSizePx = useStudioStore((s) => s.leftDockSizePx);
  const setDockSize = useStudioStore((s) => s.setDockSize);
  const leftDockCollapsed = useStudioStore((s) => s.leftDockCollapsed);
  const setDockCollapsed = useStudioStore((s) => s.setDockCollapsed);

  const [mode, setMode] = useState<MiniMapMode>("compact");
  const [hoveredPreview, setHoveredPreview] = useState(false);
  const [labelDensity, setLabelDensity] = useState<LabelDensity>("sparse");
  const restoreWidthRef = useRef(leftDockSizePx);

  const tooltipText = nodeLabel(scene, hovered);
  const selectedLabel = nodeLabel(scene, selected);
  const activePath = scene.paths.find((path) => path.id === activePathId) ?? null;
  const replayActor = useMemo(() => {
    if (!activePath) return null;
    return pointOnPathAtProgress(activePath, pathReplay.progress);
  }, [activePath, pathReplay.progress]);
  const mapState = useMemo(
    () => ({
      zoom: mapZoom,
      pan: [mapPanX, mapPanY] as [number, number],
    }),
    [mapPanX, mapPanY, mapZoom],
  );

  const isReplayActive = pathReplay.playing || pathReplay.progress > 0;
  const totalCritical = result?.criticalZoneResults.length ?? 0;
  const passedCritical = result?.criticalZoneResults.filter((zone) => zone.status === "pass").length ?? 0;
  const failedCritical = result?.criticalZoneResults.find((zone) => zone.status === "fail")
    ?? result?.criticalZoneResults.find((zone) => zone.status === "partial")
    ?? null;
  const coveragePct = result ? Math.round(result.totalCoveragePct) : 0;
  const mapLayers = mapLayerFlagsFromStore(layerVis);

  const expandDrawer = () => {
    restoreWidthRef.current = leftDockSizePx;
    setDockSize("left", EXPANDED_LEFT_DOCK_WIDTH);
    setMode("expanded");
    setHoveredPreview(false);
  };

  const collapseDrawer = () => {
    setDockSize("left", restoreWidthRef.current);
    setMode("compact");
    setHoveredPreview(false);
  };

  useEffect(() => {
    if (mode !== "expanded") return undefined;
    return () => {
      setDockSize("left", restoreWidthRef.current);
    };
  }, [mode, setDockSize]);

  useEffect(() => {
    startTransition(() => {
      if (leftDockCollapsed) {
        setMode("collapsed");
        setHoveredPreview(false);
        return;
      }
      setMode((current) => (current === "collapsed" ? "compact" : current));
    });
  }, [leftDockCollapsed]);

  const mapWidth = mode === "expanded" ? Math.max(248, leftDockSizePx - 28) : width;
  const mapHeight = mode === "expanded" ? EXPANDED_MAP_HEIGHT : height;

  const onMapClick = (point: [number, number]) => {
    setSelected(null);
    setFocusScenePointRequest({ point, source: "minimap" });
  };

  const onMapDoubleClick = (point: [number, number]) => {
    fitMap("minimap");
    setFocusScenePointRequest({ point, source: "minimap" });
  };

  const showHoverPreview = hoveredPreview && mode !== "expanded";

  return (
    <div
      className={
        mode === "expanded"
          ? "rounded-2xl border border-[#1f2536] bg-[#0b0f17] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
          : "rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
      }
      onMouseEnter={() => setHoveredPreview(true)}
      onMouseLeave={() => setHoveredPreview(false)}
    >
      {mode === "collapsed" ? (
        <MiniMapCollapsed onExpand={expandDrawer} coveragePct={coveragePct} />
      ) : mode === "expanded" ? (
        <MiniMapExpanded
          scene={scene}
          result={result}
          selected={selected}
          selectedLabel={selectedLabel}
          tooltipText={tooltipText}
          coveragePct={coveragePct}
          totalCritical={totalCritical}
          passedCritical={passedCritical}
          failedCritical={failedCritical}
          mapWidth={mapWidth}
          mapHeight={mapHeight}
          mapLayers={mapLayers}
          selectedNodeId={selected}
          hoveredNodeId={hovered}
          activePathId={activePathId}
          mapState={mapState}
          onSetZoom={setZoom}
          onSetPan={setPan}
          onFit={fitMap}
          onNodeSelect={setSelected}
          onNodeHover={setHovered}
          onMapClick={onMapClick}
          onMapDoubleClick={onMapDoubleClick}
          replayActor={isReplayActive ? replayActor : null}
          isReplayActive={isReplayActive}
          onCollapse={collapseDrawer}
          labelDensity={labelDensity}
          setLabelDensity={setLabelDensity}
        />
      ) : (
        <MiniMapCompact
          scene={scene}
          result={result}
          selected={selected}
          selectedLabel={selectedLabel}
          tooltipText={tooltipText}
          coveragePct={coveragePct}
          totalCritical={totalCritical}
          passedCritical={passedCritical}
          failedCritical={failedCritical}
          mapWidth={mapWidth}
          mapHeight={mapHeight}
          mapLayers={mapLayers}
          selectedNodeId={selected}
          hoveredNodeId={hovered}
          activePathId={activePathId}
          mapState={mapState}
          onSetZoom={setZoom}
          onSetPan={setPan}
          onFit={fitMap}
          onNodeSelect={setSelected}
          onNodeHover={setHovered}
          onMapClick={onMapClick}
          onMapDoubleClick={onMapDoubleClick}
          replayActor={isReplayActive ? replayActor : null}
          isReplayActive={isReplayActive}
          onExpand={expandDrawer}
        />
      )}

      {showHoverPreview ? (
        <MiniMapHoverPreview
          scene={scene}
          result={result}
          selectedLabel={selectedLabel}
          coveragePct={coveragePct}
          totalCritical={totalCritical}
          passedCritical={passedCritical}
        />
      ) : null}

      {mode === "compact" ? (
        <div className="mt-2 flex items-center justify-between text-[8px] text-[#556076]">
          <div className="flex items-center gap-2">
            <span>{tooltipText ?? "Hover objects to preview"}</span>
            {selectedLabel ? <span className="text-[#8aa0c2]">Selected: {selectedLabel}</span> : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setReplayPlaying(false);
              setReplayProgress(0);
            }}
            className="inline-flex items-center gap-1 text-[#7c8ca7]"
            title="Reset replay"
          >
            <RefreshCcw className="h-3 w-3" />
            reset
          </button>
        </div>
      ) : null}

      {mode !== "collapsed" ? (
        <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">Quick Controls</div>
            <button
              type="button"
              onClick={() => {
                setDockCollapsed("left", true);
                setMode("collapsed");
                setHoveredPreview(false);
              }}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 text-[9px] font-medium text-[#7f8aa3] transition-colors hover:border-[#32384d] hover:text-white"
            >
              <X className="h-3 w-3" />
              Collapse to Icon
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setZoom("minimap", mapState.zoom * 0.9)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#1f2536] bg-[#111521] text-[#556076] transition-colors hover:border-[#2b3246] hover:text-white"
              aria-label="Zoom out minimap"
              title="Zoom out"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              onClick={() => setZoom("minimap", mapState.zoom * 1.1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#1f2536] bg-[#111521] text-[#556076] transition-colors hover:border-[#2b3246] hover:text-white"
              aria-label="Zoom in minimap"
              title="Zoom in"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={() => fitMap("minimap")}
              className="h-7 rounded-md border border-[#1f2536] bg-[#111521] px-2 text-[9px] font-medium text-[#7f8ca6] transition-colors hover:border-[#2b3246] hover:text-white"
              aria-label="Fit minimap"
            >
              Fit
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
