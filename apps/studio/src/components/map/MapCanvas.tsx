"use client";

import { useCallback, useMemo, useRef, useState, type PointerEvent } from "react";
import type { WheelEvent } from "react";

import {
  type MapLayerFlags,
  createLayerFlags,
} from "@/components/map/map-geometry";
import {
  createMapProjection,
  inferSceneBounds,
  type MapProjection,
} from "@/components/map/MapProjection";
import type { ScenarioPath, SecurityScene, SimulationResult } from "@/schema/security-scene";
import { MapLayers } from "@/components/map/MapLayers";

type MapMode = "mini" | "path" | "overview" | "picker";

type MapViewportTarget = "minimap" | "pathMap";

export type MapCanvasProps = {
  scene: SecurityScene;
  result: SimulationResult | null;
  mode: MapMode;
  width: number;
  height: number;
  className?: string;
  layers?: MapLayerFlags;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  activePathId?: string | null;
  paths?: ScenarioPath[];
  selectedPathSegmentPathId?: string | null;
  selectedPathSegmentIndex?: number | null;
  onNodeSelect?: (id: string | null) => void;
  onNodeHover?: (id: string | null) => void;
  onPathSegmentSelect?: (pathId: string, segmentIndex: number) => void;
  onMapClick?: (scenePoint: [number, number]) => void;
  onMapDoubleClick?: (scenePoint: [number, number]) => void;
  mapTarget: MapViewportTarget;
  zoom: number;
  pan: [number, number];
  onSetZoom: (target: MapViewportTarget, zoom: number) => void;
  onSetPan: (target: MapViewportTarget, pan: [number, number]) => void;
  onFit?: (target: MapViewportTarget) => void;
  replayActor?: [number, number] | null;
  coverageOpacity?: number;
  showGrid?: boolean;
  activePathForReplay?: ScenarioPath | null;
  showNodeLabels?: boolean;
};

function extractProjectionPoints(scene: SecurityScene, paths?: ScenarioPath[]): Array<[number, number]> {
  const points: Array<[number, number]> = [
    [0, 0],
    [scene.dimensions.width, 0],
    [scene.dimensions.width, scene.dimensions.depth],
    [0, scene.dimensions.depth],
  ];

  for (const wall of scene.walls) {
    points.push(wall.start, wall.end);
  }

  for (const camera of scene.cameras) {
    points.push([camera.position[0], camera.position[2]]);
  }

  for (const light of scene.securityLights) {
    points.push([light.position[0], light.position[2]]);
  }

  for (const zone of scene.criticalZones) {
    points.push(...zone.polygon);
  }

  for (const zone of scene.privacyZones) {
    points.push(...zone.polygon);
  }

  for (const obstruction of scene.obstructions) {
    points.push([obstruction.position[0], obstruction.position[2]]);
  }

  for (const door of scene.doors) {
    points.push([door.position[0], door.position[2]]);
  }

  for (const win of scene.windows) {
    points.push([win.position[0], win.position[2]]);
  }

  for (const entry of scene.entryPoints) {
    points.push(entry.position);
  }

  for (const path of paths ?? scene.paths) {
    for (const point of path.points) {
      points.push(point.position);
    }
  }

  return points;
}

function scenePointFromEvent(projection: MapProjection, event: PointerEvent<SVGSVGElement>): [number, number] {
  const rect = event.currentTarget.getBoundingClientRect();
  const scene = projection.svgToScene({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });
  return [scene[0], scene[1]];
}

function mapId(mode: MapMode) {
  if (mode === "mini") return "minimap";
  if (mode === "path") return "pathmap";
  return mode;
}

export function MapCanvas({
  scene,
  result,
  mode,
  width,
  height,
  className,
  layers,
  selectedNodeId,
  hoveredNodeId,
  activePathId,
  paths,
  selectedPathSegmentPathId,
  selectedPathSegmentIndex,
  onNodeSelect,
  onNodeHover,
  onPathSegmentSelect,
  onMapClick,
  onMapDoubleClick,
  mapTarget,
  zoom,
  pan,
  onSetZoom,
  onSetPan,
  onFit,
  replayActor,
  coverageOpacity,
  showGrid,
  activePathForReplay,
  showNodeLabels,
}: MapCanvasProps) {
  const mapLayers = layers ? { ...createLayerFlags(), ...layers } : createLayerFlags();
  void onFit;
  const [dragging, setDragging] = useState(false);
  const [dragMoved, setDragMoved] = useState(false);
  const dragAnchor = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const projectionPoints = useMemo(() => extractProjectionPoints(scene, paths), [scene, paths]);
  const projection = useMemo(
    () => createMapProjection({
      sceneBounds: inferSceneBounds(
        {
          width: scene.dimensions.width,
          depth: scene.dimensions.depth,
        },
        projectionPoints,
      ),
      width,
      height,
      padding: Math.max(6, Math.min(width, height) * 0.06),
      zoom,
      pan,
    }),
    [scene.dimensions.width, scene.dimensions.depth, projectionPoints, width, height, zoom, pan],
  );

  const handleWheel = useCallback((event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const next = zoom * (event.deltaY < 0 ? 1.12 : 0.9);
    onSetZoom(mapTarget, next);
  }, [mapTarget, onSetZoom, zoom]);

  const handlePointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    setDragging(true);
    setDragMoved(false);
    dragAnchor.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan[0],
      panY: pan[1],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const dx = event.clientX - dragAnchor.current.x;
    const dy = event.clientY - dragAnchor.current.y;
    if (!dragMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
      setDragMoved(true);
    }
    onSetPan(mapTarget, [dragAnchor.current.panX + dx, dragAnchor.current.panY + dy]);
  }, [dragging, dragMoved, mapTarget, onSetPan]);

  const handlePointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, [dragging]);

  const handleClick = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (dragMoved) return;
    const target = event.target as Element | null;
    if (target && target !== event.currentTarget && !(target instanceof SVGElement && target.hasAttribute("data-map-background"))) {
      return;
    }
    const point = scenePointFromEvent(projection, event);

    if (onMapClick) {
      onMapClick(point);
      return;
    }

    onNodeSelect?.(null);
  }, [dragMoved, onMapClick, onNodeSelect, projection]);

  const handleDoubleClick = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const target = event.target as Element | null;
    if (target && target !== event.currentTarget && !(target instanceof SVGElement && target.hasAttribute("data-map-background"))) {
      return;
    }
    const point = scenePointFromEvent(projection, event);
    onMapDoubleClick?.(point);
  }, [onMapDoubleClick, projection]);

  return (
    <div className={`relative ${className ?? ""}`} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        className="block rounded-lg border border-[#1e2130] bg-[#0a0d14]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        role="img"
        aria-label={`${mapId(mode)} map`}
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id={`map-bg-${mode}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c111a" />
            <stop offset="100%" stopColor="#080b11" />
          </linearGradient>
          <pattern id={`map-grid-${mode}`} width={Math.max(18, projection.lengthToSvg(0.5))} height={Math.max(18, projection.lengthToSvg(0.5))} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M 0 0 L 0 2" stroke="#1a2130" strokeWidth="0.75" />
          </pattern>
        </defs>

        <rect data-map-background="true" width={width} height={height} fill={`url(#map-bg-${mode})`} rx={8} />
        <rect x={1} y={1} width={width - 2} height={height - 2} fill="none" stroke="#1d2435" strokeWidth={1} rx={8} />
        {showGrid ? (
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill={`url(#map-grid-${mode})`}
            opacity={0.12}
          />
        ) : null}

        <MapLayers
          scene={scene}
          result={result}
          projection={projection}
          mode={mode}
          layers={mapLayers}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          activePathId={activePathId}
          paths={paths}
          selectedPathSegmentPathId={selectedPathSegmentPathId}
          selectedPathSegmentIndex={selectedPathSegmentIndex}
          activePathForReplay={activePathForReplay}
          replayActor={replayActor}
          onNodeSelect={onNodeSelect}
          onNodeHover={onNodeHover}
          onPathSegmentSelect={onPathSegmentSelect}
          coverageOpacity={coverageOpacity}
          showNodeLabels={showNodeLabels ?? mapLayers.labels}
        />
      </svg>
    </div>
  );
}
