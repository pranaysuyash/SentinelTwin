"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MapCanvas } from "@/components/map/MapCanvas";
import { createLayerFlags } from "@/components/map/map-geometry";
import {
  createCameraNode,
  createDoorNode,
  createObstructionNode,
  createSecurityLightNode,
  createSensorNode,
} from "@/lib/node-factory";
import { TOOL_LABELS } from "@/lib/tool-constants";
import { useStudioStore, useFilteredScene } from "@/store/studio-store";
import { PlanContextMenu } from "./PlanContextMenu";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

/**
 * True-2D architectural plan view for the workspace (canvasMode `plan_2d`).
 *
 * Renders the canonical SecurityScene through the existing SVG map subsystem
 * (MapCanvas / MapLayers / MapProjection — the same layers that power the
 * minimap and path map, per D-002: no parallel scene representation) with the
 * architectural detail pass enabled: walls at real thickness, door swing
 * arcs, wall-aligned glazing lines, camera FOV wedges, zone fills, and the
 * coverage heatmap. Selection routes into the canonical store so the
 * inspector works exactly as in 3D.
 *
 * Per D-323: Supports full tool placement (cameras, lights, obstructions, doors,
 * sensors, comments), interactive cursor coordinates, and right-click context menu
 * for inspection, duplication, and counterfactual testing.
 */
export function PlanView2D() {
  const scene = useFilteredScene();
  const result = useStudioStore((s) => s.simulationResult);
  const layerVisibility = useStudioStore((s) => s.layerVisibility);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const hoveredMapNodeId = useStudioStore((s) => s.hoveredMapNodeId);
  const selectNode = useStudioStore((s) => s.selectNode);
  const clearSelection = useStudioStore((s) => s.clearSelection);
  const setHoveredMapNodeId = useStudioStore((s) => s.setHoveredMapNodeId);
  const activePathId = useStudioStore((s) => s.activePathId);
  const activeTool = useStudioStore((s) => s.activeTool);
  const addNode = useStudioStore((s) => s.addNode);
  const addComment = useStudioStore((s) => s.addComment);
  const viewport = useStudioStore((s) => s.mapState.planView) ?? { zoom: 1, pan: [0, 0] as [number, number] };
  const setMapZoom = useStudioStore((s) => s.setMapZoom);
  const setMapPan = useStudioStore((s) => s.setMapPan);
  const fitMap = useStudioStore((s) => s.fitMap);
  const canvasViewResetTick = useStudioStore((s) => s.canvasViewResetTick);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [hoverPoint, setHoverPoint] = useState<[number, number] | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    scenePoint: [number, number];
    targetNodeId: string | null;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize((prev) => {
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        return prev.width === width && prev.height === height ? prev : { width, height };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (canvasViewResetTick > 0) fitMap("planView");
  }, [canvasViewResetTick, fitMap]);

  const layers = createLayerFlags({
    walls: layerVisibility.walls_floors,
    doors: layerVisibility.walls_floors,
    windows: layerVisibility.walls_floors,
    cameras: layerVisibility.cameras,
    cameraCones: layerVisibility.camera_cones,
    obstructions: layerVisibility.obstructions,
    lights: layerVisibility.lights,
    criticalZones: layerVisibility.critical_zones,
    privacyZones: layerVisibility.privacy_zones,
    paths: layerVisibility.paths,
    coverage: layerVisibility.heatmap,
    labels: layerVisibility.labels,
  });

  const handleMapClick = useCallback(
    (scenePoint: [number, number]) => {
      const [x, z] = scenePoint;
      if (activeTool === "camera") {
        const node = createCameraNode([x, 2.8, z]);
        addNode(node);
        selectNode(node.id);
      } else if (activeTool === "light") {
        const node = createSecurityLightNode([x, 2.8, z]);
        addNode(node);
        selectNode(node.id);
      } else if (activeTool === "obstruction") {
        const node = createObstructionNode([x, 1.0, z], "shelf");
        addNode(node);
        selectNode(node.id);
      } else if (activeTool === "door_window") {
        const node = createDoorNode([x, 0, z]);
        addNode(node);
        selectNode(node.id);
      } else if (activeTool === "sensor") {
        const node = createSensorNode([x, 1.2, z], "motion");
        addNode(node);
        selectNode(node.id);
      } else if (activeTool === "comment") {
        addComment([x, 1.5, z], "New annotation", "Operator", null);
      } else if (activeTool === "select") {
        clearSelection();
      }
    },
    [activeTool, addNode, selectNode, addComment, clearSelection],
  );

  const handleMapContextMenu = useCallback(
    (scenePoint: [number, number], event: React.MouseEvent) => {
      setContextMenu({
        position: { x: event.clientX, y: event.clientY },
        scenePoint,
        targetNodeId: hoveredMapNodeId ?? selectedNodeId ?? null,
      });
    },
    [hoveredMapNodeId, selectedNodeId],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" data-plan-view-2d>
      {size.width > 4 && size.height > 4 ? (
        <MapCanvas
          scene={scene}
          result={result}
          mode="overview"
          width={size.width}
          height={size.height}
          layers={layers}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredMapNodeId}
          activePathId={activePathId}
          onNodeSelect={(id) => {
            if (activeTool !== "select") {
              if (hoverPoint) handleMapClick(hoverPoint);
              return;
            }
            if (id) selectNode(id);
            else clearSelection();
          }}
          onNodeHover={setHoveredMapNodeId}
          onMapClick={handleMapClick}
          onMapMove={setHoverPoint}
          onMapContextMenu={handleMapContextMenu}
          mapTarget="planView"
          zoom={viewport.zoom}
          pan={viewport.pan}
          onSetZoom={setMapZoom}
          onSetPan={setMapPan}
          onFit={fitMap}
          showGrid={layerVisibility.grid}
          showNodeLabels={layerVisibility.labels}
          architectural
          coverageOpacity={0.3}
          focusPoint={activeTool !== "select" ? hoverPoint : null}
        />
      ) : null}

      {activeTool !== "select" && hoverPoint ? (
        <div className="pointer-events-none absolute top-3 right-3 flex items-center gap-2 rounded-lg border border-sky-500/30 UI_SURFACES.panelDeepAlt/95 px-3 py-1.5 text-[10px] font-mono text-sky-300 shadow-xl backdrop-blur-md">
          <span className="font-sans font-semibold uppercase tracking-wider text-sky-400">
            {TOOL_LABELS[activeTool] ?? "Place"}
          </span>
          <span className={`UI_SURFACES.textSoftMid`}>·</span>
          <span>Click map to place at [{hoverPoint[0].toFixed(1)}, {hoverPoint[1].toFixed(1)}]</span>
        </div>
      ) : null}

      {hoverPoint ? (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded-md border UI_SURFACES.borderDeep UI_SURFACES.bgDeep/85 px-2 py-1 text-[9px] font-mono UI_SURFACES.textMuted4">
          X: {hoverPoint[0].toFixed(2)}m · Z: {hoverPoint[1].toFixed(2)}m
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border UI_SURFACES.borderDeep UI_SURFACES.bgDeep/85 px-2 py-1 text-[9px] uppercase tracking-[0.14em] UI_SURFACES.textSoftDim">
        2D Plan · {activeTool === "select" ? "select to inspect · right-click for actions" : `placing ${TOOL_LABELS[activeTool] ?? activeTool}`} · drag to pan · scroll to zoom
      </div>

      {contextMenu ? (
        <PlanContextMenu
          position={contextMenu.position}
          scenePoint={contextMenu.scenePoint}
          targetNodeId={contextMenu.targetNodeId}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  );
}
