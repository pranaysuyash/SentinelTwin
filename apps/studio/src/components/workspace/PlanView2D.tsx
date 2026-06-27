"use client";

import { useEffect, useRef, useState } from "react";

import { MapCanvas } from "@/components/map/MapCanvas";
import { createLayerFlags } from "@/components/map/map-geometry";
import { useStudioStore } from "@/store/studio-store";

/**
 * True-2D architectural plan view for the workspace (canvasMode `plan_2d`).
 *
 * Renders the canonical SecurityScene through the existing SVG map subsystem
 * (MapCanvas / MapLayers / MapProjection — the same layers that power the
 * minimap and path map, per D-002: no parallel scene representation) with the
 * architectural detail pass enabled: walls at real thickness, door swing
 * arcs, wall-aligned glazing lines, camera FOV wedges, zone fills, and the
 * coverage heatmap. Selection routes into the canonical store so the
 * inspector works exactly as in 3D. Placement tools remain a 3D/2.5D
 * workflow for now — the plan view is a review/selection surface.
 */
export function PlanView2D() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const layerVisibility = useStudioStore((s) => s.layerVisibility);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const hoveredMapNodeId = useStudioStore((s) => s.hoveredMapNodeId);
  const selectNode = useStudioStore((s) => s.selectNode);
  const clearSelection = useStudioStore((s) => s.clearSelection);
  const setHoveredMapNodeId = useStudioStore((s) => s.setHoveredMapNodeId);
  const activePathId = useStudioStore((s) => s.activePathId);
  const viewport = useStudioStore((s) => s.mapState.planView) ?? { zoom: 1, pan: [0, 0] as [number, number] };
  const setMapZoom = useStudioStore((s) => s.setMapZoom);
  const setMapPan = useStudioStore((s) => s.setMapPan);
  const fitMap = useStudioStore((s) => s.fitMap);
  const canvasViewResetTick = useStudioStore((s) => s.canvasViewResetTick);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The shared "Reset canvas view" control also re-fits the plan viewport.
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

  return (
    <div ref={containerRef} className="relative h-full w-full" data-plan-view-2d>
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
            if (id) selectNode(id);
            else clearSelection();
          }}
          onNodeHover={setHoveredMapNodeId}
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
        />
      ) : null}
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-[#242c40] bg-[#0c111c]/85 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[#7686a4]">
        2D Plan · select to inspect · drag to pan · scroll to zoom
      </div>
    </div>
  );
}
