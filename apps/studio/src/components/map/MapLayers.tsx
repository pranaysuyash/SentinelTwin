"use client";

import {
  memo,
  type PointerEvent,
} from "react";
import {
  type CameraNode,
  type CoverageCellResult,
  type CriticalZoneNode,
  type ObstructionNode,
  type PrivacyZoneNode,
  type ScenarioPath,
  type SimulationResult,
  type SecurityScene,
} from "@/schema/security-scene";
import { type MapProjection } from "@/components/map/MapProjection";
import {
  obstacleRectPoints,
  formatSvgPoint,
  polygonCentroid,
  polygonToSvgPoints,
  estimateCoverageCellSize,
  type MapLayerFlags,
} from "./map-geometry";
import { samplePathQuality, pointOnPathAtProgress } from "./path-quality";
import {
  MAP_COLORS,
  doorColor,
  lightStatusColor,
  priorityStrokeColor,
  qualityColor,
  wallStrokeColor,
  windowStrokeColor,
} from "./map-colors";
import { getCameraColorForId } from "@/lib/camera-colors";
import { useStudioStore } from "@/store/studio-store";

type MapMode = "mini" | "path" | "overview" | "picker";

type MapLayersProps = {
  scene: SecurityScene;
  result: SimulationResult | null;
  projection: MapProjection;
  mode: MapMode;
  layers: MapLayerFlags;
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  activePathId?: string | null;
  paths?: ScenarioPath[];
  selectedPathSegmentPathId?: string | null;
  selectedPathSegmentIndex?: number | null;
  replayActor?: [number, number] | null;
  onNodeSelect?: (id: string | null) => void;
  onNodeHover?: (id: string | null) => void;
  onPathSegmentSelect?: (pathId: string, segmentIndex: number) => void;
  activePathForReplay?: ScenarioPath | null;
  coverageOpacity?: number;
  showNodeLabels?: boolean;
  showReplayPath?: boolean;
};

function zoneStatusFill(level: string) {
  if (level === "pass") {
    return "rgba(34,197,94,0.2)";
  }

  if (level === "partial") {
    return "rgba(234,179,8,0.2)";
  }

  return "rgba(239,68,68,0.2)";
}

function styleForWall(material: string) {
  return {
    stroke: wallStrokeColor(material),
    strokeWidth: 1.6,
    strokeOpacity: 0.94,
    strokeDasharray: material === "glass" ? "3 2" : material === "grill" ? "4 2" : "none",
  };
}

function styleForWindow(state: string) {
  return {
    stroke: windowStrokeColor(state),
    strokeWidth: 1.3,
    strokeDasharray: state === "grill" ? "4 3" : state === "reflective" ? "2 2" : state === "curtain" ? "10 4" : "none",
  };
}

function statusForDoor(state: string) {
  return {
    stroke: doorColor(state),
    strokeWidth: 1.4,
    strokeDasharray: state === "open" ? "2 3" : state === "restricted" ? "1 2" : "none",
    opacity: state === "open" ? 0.72 : 0.82,
  };
}

function makeNodeHandlers(
  id: string,
  onNodeSelect?: (id: string | null) => void,
  onNodeHover?: (id: string | null) => void,
) {
  return {
    style: { cursor: "pointer" as const },
    onPointerDown: (event: PointerEvent<SVGElement>) => {
      event.stopPropagation();
      onNodeSelect?.(id);
    },
    onPointerEnter: () => {
      onNodeHover?.(id);
    },
    onPointerLeave: () => {
      onNodeHover?.(null);
    },
  };
}

function makeFovPolygon(
  point: [number, number],
  yawDeg: number,
  range: number,
  fovDeg: number,
  projection: MapProjection,
): string {
  const base = (yawDeg * Math.PI) / 180;
  const half = Math.min(fovDeg, 130) * Math.PI / 180 / 2;
  const left = projection.sceneToSvg([
    point[0] + range * Math.sin(base - half),
    point[1] + range * Math.cos(base - half),
  ]);
  const right = projection.sceneToSvg([
    point[0] + range * Math.sin(base + half),
    point[1] + range * Math.cos(base + half),
  ]);
  const origin = projection.sceneToSvg(point);
  return `${formatSvgPoint(origin)} ${formatSvgPoint(left)} ${formatSvgPoint(right)}`;
}

function pathStroke(pathId: string, activePathId?: string | null) {
  const isActive = activePathId != null && pathId === activePathId;
  return {
    stroke: isActive ? "#8b5cf6" : "#64748b",
    strokeWidth: isActive ? 2.2 : 1.4,
    opacity: isActive ? 0.98 : 0.55,
    dash: isActive ? "none" : "6 4",
    markerOpacity: isActive ? 1 : 0.9,
    segmentBoost: isActive ? 0 : -1,
  };
}

function mapNodeLabel(nodeId: string, nodes: Map<string, string>): string {
  return nodes.get(nodeId) ?? nodeId;
}

function nodeActive(id: string, selectedNodeId?: string | null, hoveredNodeId?: string | null) {
  return selectedNodeId === id || hoveredNodeId === id;
}

const CoverageCellsLayer = memo(function CoverageCellsLayer({
  cells,
  projection,
  cellSize,
  cellHalf,
  isMini,
  coverageOpacity,
}: {
  cells: CoverageCellResult[];
  projection: MapProjection;
  cellSize: number;
  cellHalf: number;
  isMini: boolean;
  coverageOpacity?: number;
}) {
  if (cells.length === 0) return null;
  return (
    <g>
      {cells.map((cell) => {
        if (cell.quality === "none" && isMini) return null;
        const { x, y } = projection.sceneToSvg([cell.x, cell.z]);
        return (
          <rect
            key={`${cell.x}-${cell.z}`}
            x={x - projection.lengthToSvg(cellHalf)}
            y={y - projection.lengthToSvg(cellHalf)}
            width={projection.lengthToSvg(cellSize)}
            height={projection.lengthToSvg(cellSize)}
            fill={qualityColor(cell.quality)}
            opacity={coverageOpacity ?? 0.35}
            stroke="none"
          />
        );
      })}
    </g>
  );
});

export function MapLayers({
  scene,
  result,
  projection,
  mode,
  layers,
  selectedNodeId,
  hoveredNodeId,
  activePathId,
  paths,
  selectedPathSegmentPathId,
  selectedPathSegmentIndex,
  replayActor,
  onNodeSelect,
  onNodeHover,
  onPathSegmentSelect,
  activePathForReplay,
  coverageOpacity,
  showNodeLabels,
  showReplayPath,
}: MapLayersProps) {
  const adversaryShadowOn = useStudioStore((s) => s.overlayFilters.adversaryShadow);
  const cells = result?.coverageCells ?? [];
  const criticalById = new Map(result?.criticalZoneResults?.map((entry) => [entry.zoneId, entry]));
  const nodeLabelLookup = new Map<string, string>();

  for (const wall of scene.walls) {
    nodeLabelLookup.set(wall.id, wall.label);
  }

  for (const door of scene.doors) {
    nodeLabelLookup.set(door.id, door.label);
  }

  for (const win of scene.windows) {
    nodeLabelLookup.set(win.id, win.label);
  }

  for (const cam of scene.cameras) {
    nodeLabelLookup.set(cam.id, cam.name);
  }

  for (const light of scene.securityLights) {
    nodeLabelLookup.set(light.id, light.name);
  }

  for (const obs of scene.obstructions) {
    nodeLabelLookup.set(obs.id, obs.label);
  }

  for (const zone of scene.criticalZones) {
    nodeLabelLookup.set(zone.id, zone.label);
  }

  for (const zone of scene.privacyZones) {
    nodeLabelLookup.set(zone.id, zone.label);
  }

  for (const e of scene.entryPoints) {
    nodeLabelLookup.set(e.id, e.label);
  }

  for (const path of scene.paths) {
    nodeLabelLookup.set(path.id, path.label);
  }

  const pathList = paths ?? scene.paths;
  const replayPath = activePathForReplay ?? pathList.find((path) => path.id === activePathId) ?? null;
  const replayPathSamples = replayPath ? samplePathQuality(replayPath, cells, 0.3) : [];
  const isMini = mode === "mini";
  const cellSize = estimateCoverageCellSize(cells);
  const cellHalf = Math.max(0.01, cellSize / 2);

  return (
    <g>
      <title>
        {selectedNodeId ? mapNodeLabel(selectedNodeId, nodeLabelLookup) : "Map"}
      </title>

      {layers.coverage && (
        <g>
          {cells.map((cell) => {
            if (cell.quality === "none" && isMini) return null;

            const { x, y } = projection.sceneToSvg([cell.x, cell.z]);
            return (
                <rect
                  key={`${cell.x}-${cell.z}`}
                  x={x - projection.lengthToSvg(cellHalf)}
                  y={y - projection.lengthToSvg(cellHalf)}
                  width={projection.lengthToSvg(cellSize)}
                  height={projection.lengthToSvg(cellSize)}
                fill={qualityColor(cell.quality)}
                  opacity={coverageOpacity ?? 0.35}
                  stroke="none"
                />
            );
          })}
        </g>
      )}

      {layers.walls && (
        <g>
          {scene.walls.map((wall) => {
            const a = projection.sceneToSvg(wall.start);
            const b = projection.sceneToSvg(wall.end);
            const style = styleForWall(wall.material);
            const isSelected = nodeActive(wall.id, selectedNodeId, hoveredNodeId);
            return (
              <line
                key={wall.id}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                {...makeNodeHandlers(wall.id, onNodeSelect, onNodeHover)}
                stroke={style.stroke}
                strokeWidth={isSelected ? style.strokeWidth + 0.7 : style.strokeWidth}
                strokeOpacity={isSelected ? 1 : style.strokeOpacity}
                strokeDasharray={style.strokeDasharray}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      )}

      {layers.doors && (
        <g>
          {scene.doors.map((door) => {
            const [x, y, z] = door.position;
            const startScene = [x - Math.max(0.05, door.dimensions[0] * 0.5), y, z - Math.max(0.05, door.dimensions[2] * 0.3)] as [number, number, number];
            const endScene = [x + Math.max(0.05, door.dimensions[0] * 0.5), y, z + Math.max(0.05, door.dimensions[2] * 0.3)] as [number, number, number];
            const p1 = projection.sceneToSvg([startScene[0], startScene[2]]);
            const p2 = projection.sceneToSvg([endScene[0], endScene[2]]);
            const style = statusForDoor(door.state);
            const isSelected = nodeActive(door.id, selectedNodeId, hoveredNodeId);
            return (
              <g key={door.id}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  {...makeNodeHandlers(door.id, onNodeSelect, onNodeHover)}
                  stroke={style.stroke}
                  strokeWidth={isSelected ? style.strokeWidth + 0.8 : style.strokeWidth}
                  strokeDasharray={style.strokeDasharray}
                  strokeOpacity={style.opacity}
                  strokeLinecap="round"
                />
                {isSelected ? (
                  <circle
                    cx={(p1.x + p2.x) / 2}
                    cy={(p1.y + p2.y) / 2}
                    r={3}
                    fill="none"
                    stroke="#fde68a"
                    strokeWidth={1.2}
                    strokeDasharray="2 2"
                    opacity={0.8}
                  />
                ) : null}
              </g>
            );
          })}
        </g>
      )}

      {layers.windows && (
        <g>
          {scene.windows.map((windowNode) => {
            const [x, , z] = windowNode.position;
            const wHalf = Math.max(0.1, windowNode.dimensions[0] * 0.55);
            const p1 = projection.sceneToSvg([x - wHalf, z]);
            const p2 = projection.sceneToSvg([x + wHalf, z]);
            const style = styleForWindow(windowNode.state);
            const isSelected = nodeActive(windowNode.id, selectedNodeId, hoveredNodeId);
            return (
              <line
                key={windowNode.id}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                {...makeNodeHandlers(windowNode.id, onNodeSelect, onNodeHover)}
                stroke={style.stroke}
                strokeWidth={isSelected ? Number(style.strokeWidth) + 0.6 : Number(style.strokeWidth)}
                strokeDasharray={style.strokeDasharray}
                strokeOpacity={0.93}
              />
            );
          })}
        </g>
      )}

      {layers.criticalZones && (
        <g>
          {scene.criticalZones.map((zone: CriticalZoneNode) => {
            const resultEntry = criticalById.get(zone.id);
            const fill = zoneStatusFill(resultEntry?.status ?? "none");
            const polygon = polygonToSvgPoints(zone.polygon, (point) => projection.sceneToSvg(point));
            const centroid = projection.sceneToSvg(polygonCentroid(zone.polygon));
            const isSelected = nodeActive(zone.id, selectedNodeId, hoveredNodeId);

            return (
              <g key={zone.id}>
                <polygon
                  points={polygon}
                  fill={fill}
                  stroke={priorityStrokeColor(zone.priority)}
                  strokeWidth={isSelected ? 1.9 : 1.3}
                  strokeOpacity={0.95}
                  fillOpacity={isSelected ? 0.9 : 0.75}
                  {...makeNodeHandlers(zone.id, onNodeSelect, onNodeHover)}
                />
                {showNodeLabels ? (
                  <text
                    x={centroid.x}
                    y={centroid.y}
                    fill="#f8fafc"
                    fontSize={8}
                    stroke="#020617"
                    strokeWidth={2}
                    paintOrder="stroke"
                    opacity={0.95}
                    style={{ pointerEvents: "none" }}
                  >
                    {zone.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      )}

      {layers.privacyZones && (
        <g>
          <defs>
            <pattern
              id={`privacy-hatch-${mode}`}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <path d="M 0 0 L 0 6" stroke="#fda4af" strokeWidth={1} />
            </pattern>
            <circle id={`privacy-lock-${mode}`} cx="0" cy="0" r="2.8" fill="#fecdd3" />
          </defs>

          {scene.privacyZones.map((zone: PrivacyZoneNode) => {
            const polygon = polygonToSvgPoints(zone.polygon, (point) => projection.sceneToSvg(point));
            const centroid = projection.sceneToSvg(polygonCentroid(zone.polygon));
            const isSelected = nodeActive(zone.id, selectedNodeId, hoveredNodeId);

            return (
              <g key={zone.id}>
                <polygon
                  points={polygon}
                  fill={`url(#privacy-hatch-${mode})`}
                  fillOpacity={isSelected ? 0.58 : 0.42}
                  stroke="#fecdd3"
                  strokeWidth={isSelected ? 1.8 : 1.25}
                  {...makeNodeHandlers(zone.id, onNodeSelect, onNodeHover)}
                />
                <g transform={`translate(${centroid.x} ${centroid.y})`}>
                  <circle
                    r={4.2}
                    fill="rgba(236,72,153,0.28)"
                    stroke="#fca5a5"
                    strokeWidth={1}
                    onPointerDown={() => onNodeSelect?.(zone.id)}
                  />
                  <rect
                    x={-2.2}
                    y={-1.8}
                    width={4.4}
                    height={2.8}
                    rx={1}
                    fill="#fecdd3"
                    opacity={0.5}
                  />
                  <path
                    d="M -1.4 0 L 1.4 0 M -0.6 0 L -0.6 -1.3 M 0.6 0 L 0.6 -1.3"
                    stroke="#7f1d1d"
                    strokeWidth={0.75}
                    fill="none"
                  />
                </g>
              </g>
            );
          })}
        </g>
      )}

      {layers.lights && (
        <g>
          {scene.securityLights.map((light) => {
            const point = projection.sceneToSvg([light.position[0], light.position[2]]);
            const statusColor = lightStatusColor(light.status);
            const radius = projection.lengthToSvg(0.22);
            const coneDeg = light.coneDeg ?? 0;
            const hasCone = coneDeg > 0;
            const isSelected = nodeActive(light.id, selectedNodeId, hoveredNodeId);

            return (
              <g key={light.id}>
                {hasCone ? (
                  <polygon
                    points={makeFovPolygon(
                      [light.position[0], light.position[2]],
                      light.yawDeg ?? 0,
                      Math.min(5, light.rangeM),
                      coneDeg,
                      projection,
                    )}
                    fill={statusColor}
                    fillOpacity={0.1}
                    stroke="none"
                  />
                ) : null}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                  fill={statusColor}
                  opacity={isSelected ? 1 : light.status === "off" ? 0.4 : 0.86}
                  {...makeNodeHandlers(light.id, onNodeSelect, onNodeHover)}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={projection.lengthToSvg(Math.min(4.2, light.rangeM))}
                  fill="none"
                  stroke={statusColor}
                  strokeOpacity={0.18}
                  strokeWidth={1}
                />
              </g>
            );
          })}
        </g>
      )}

      {layers.obstructions && (
        <g>
          {scene.obstructions.map((obs: ObstructionNode) => {
            const corners = obstacleRectPoints(
              [obs.position[0], obs.position[2]],
              obs.dimensions[0],
              obs.dimensions[2],
              obs.rotationYDeg,
            );
            const points = corners
              .map(([x, y]) => projection.sceneToSvg([x, y]))
              .map((p) => `${p.x},${p.y}`)
              .join(" ");
            const isSelected = nodeActive(obs.id, selectedNodeId, hoveredNodeId);

            const fill = obs.material === "glass"
              ? "rgba(125,211,252,0.28)"
              : obs.material === "partial"
                ? "rgba(148,163,184,0.22)"
                : "rgba(148,163,184,0.35)";

            return (
              <polygon
                key={obs.id}
                points={points}
                fill={fill}
                stroke={isSelected ? "#fbbf24" : "#94a3b8"}
                strokeWidth={isSelected ? 1.9 : 1.2}
                strokeLinejoin="round"
                {...makeNodeHandlers(obs.id, onNodeSelect, onNodeHover)}
              />
            );
          })}
        </g>
      )}

      {layers.cameraCones && (
        <g>
          {scene.cameras.map((camera) => {
            const hasCone = camera.status === "on" || camera.status === "blocked" || camera.status === "dirty";
            if (!hasCone) {
              return null;
            }

            const color = getCameraColorForId(camera.id);
            const isSuggested = camera.tags?.includes("suggested");
            return (
              <polygon
                key={`${camera.id}-fov`}
                points={makeFovPolygon(
                  [camera.position[0], camera.position[2]],
                  camera.yawDeg,
                  Math.min(8, camera.rangeM),
                  camera.fovHorizontalDeg,
                  projection,
                )}
                fill={color}
                fillOpacity={camera.status === "on" ? (isSuggested ? 0.04 : 0.08) : 0.04}
                stroke={color}
                strokeWidth={isSuggested ? 0.7 : 0.7}
                strokeOpacity={camera.status === "on" ? (isSuggested ? 0.25 : 0.45) : 0.2}
                strokeDasharray={isSuggested ? "2 3" : undefined}
              />
            );
          })}
        </g>
      )}

      {layers.cameras && (
        <g>
          {scene.cameras.map((camera: CameraNode) => {
            const point = projection.sceneToSvg([camera.position[0], camera.position[2]]);
            const isSelected = nodeActive(camera.id, selectedNodeId, hoveredNodeId);
            const isHovered = hoveredNodeId === camera.id;
            const color = getCameraColorForId(camera.id);
            const yaw = (camera.yawDeg * Math.PI) / 180;
            const dir = projection.sceneToSvg([
              camera.position[0] + Math.sin(yaw) * 0.8,
              camera.position[2] + Math.cos(yaw) * 0.8,
            ]);

            const isOff = camera.status === "off";
            const isSuggested = camera.tags?.includes("suggested");

            return (
              <g key={camera.id}>
                <line
                  x1={point.x}
                  y1={point.y}
                  x2={dir.x}
                  y2={dir.y}
                  stroke={color}
                  strokeWidth={isHovered ? 1.4 : 1}
                  opacity={isOff ? 0.45 : (isHovered ? 1 : isSuggested ? 0.5 : 0.88)}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={Math.max(2.3, projection.lengthToSvg(isHovered ? 0.28 : 0.22))}
                  fill={color}
                  opacity={isOff ? 0.35 : (isHovered ? 1 : isSuggested ? 0.5 : 0.94)}
                  stroke={isSelected ? "#f8fafc" : "transparent"}
                  strokeWidth={isHovered ? 1.4 : 1}
                  {...makeNodeHandlers(camera.id, onNodeSelect, onNodeHover)}
                />
                {(isSelected || isHovered) ? (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={projection.lengthToSvg(0.2) + (isHovered ? 7 : 4)}
                    fill="none"
                    stroke={isHovered ? "#e0e7ff" : "#c7d2fe"}
                    strokeWidth={isHovered ? 1.4 : 1}
                    strokeDasharray={isHovered ? "1 2" : "2 2"}
                  />
                ) : null}
                {isSuggested && !isHovered && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={projection.lengthToSvg(0.2) + 5}
                    fill="none"
                    stroke={color}
                    strokeWidth={0.7}
                    strokeDasharray="2 3"
                    opacity={0.5}
                  />
                )}
                {(isSelected || isHovered) && (
                  <text
                    x={point.x + 7}
                    y={point.y - 7}
                    fontSize="9"
                    fontWeight="700"
                    fill={isHovered ? "#e0e7ff" : "#cbd5e1"}
                    stroke="#020617"
                    strokeWidth="2.4"
                    paintOrder="stroke"
                    pointerEvents="none"
                  >
                    {camera.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      )}

      {layers.paths && (
        <g>
          {pathList.map((path) => {
            const isActive = activePathId != null && path.id === activePathId;
            const selectedSegment = selectedPathSegmentPathId === path.id ? selectedPathSegmentIndex ?? null : null;
            const activeQualityPath = isActive && replayPath?.id === path.id && replayPathSamples.length > 1;

            return (
              <g key={path.id}>
                {activeQualityPath ? (
                  replayPathSamples.slice(1).map((sample, index) => {
                    const prev = replayPathSamples[index]!;
                    const a = projection.sceneToSvg(prev.position);
                    const b = projection.sceneToSvg(sample.position);
                    const isSelectedSegment = selectedSegment === index;

                    return (
                      <line
                        key={`${path.id}-qseg-${sample.position[0].toFixed(2)}-${sample.position[1].toFixed(2)}`}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={isSelectedSegment ? MAP_COLORS.selection : qualityColor(prev.quality)}
                        strokeWidth={isSelectedSegment ? 3.4 : 2.2}
                        strokeLinecap="round"
                        opacity={isSelectedSegment ? 1 : 0.95}
                        onPointerDown={() => onPathSegmentSelect?.(path.id, index)}
                        onPointerEnter={() => onNodeHover?.(path.id)}
                        onPointerLeave={() => onNodeHover?.(null)}
                      />
                    );
                  })
                ) : (
                  path.points.slice(1).map((point, index) => {
                    const prev = path.points[index]!.position;
                    const a = projection.sceneToSvg(prev);
                    const b = projection.sceneToSvg(point.position);
                    const style = pathStroke(path.id, activePathId);
                    const isSelectedSegment = selectedSegment === index;

                    return (
                      <line
                        key={`${path.id}-seg-${index}`}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={isSelectedSegment ? MAP_COLORS.selection : style.stroke}
                        strokeWidth={style.strokeWidth + (isSelectedSegment ? 1.3 : 0)}
                        strokeDasharray={style.dash}
                        strokeLinecap="round"
                        opacity={isSelectedSegment ? 1 : style.opacity}
                        onPointerDown={() => onPathSegmentSelect?.(path.id, index)}
                        onPointerEnter={() => onNodeHover?.(path.id)}
                        onPointerLeave={() => onNodeHover?.(null)}
                      />
                    );
                  })
                )}

                {isActive ? (
                  <g>
                    {path.points.map((point, index) => {
                      const p = projection.sceneToSvg(point.position);
                      if (index === 0) {
                        return <circle key={`${path.id}-start`} cx={p.x} cy={p.y} r={4.2} fill="#22c55e" />;
                      }

                      if (index === path.points.length - 1) {
                        return (
                          <g key={`${path.id}-end`}>
                            <circle cx={p.x} cy={p.y} r={4.6} fill="none" stroke="#f59e0b" strokeWidth={1.8} />
                            <circle cx={p.x} cy={p.y} r={1.8} fill="#f59e0b" />
                          </g>
                        );
                      }

                      if (path.points.length > 0 && index % 2 === 1) {
                        return <circle key={`${path.id}-mid-${index}`} cx={p.x} cy={p.y} r={1.3} fill="#a78bfa" opacity={0.5} />;
                      }

                      return null;
                    })}
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      )}

      {result?.adversarialPath && (layers.paths || adversaryShadowOn) ? (
        <g>
          {result.adversarialPath.waypoints.slice(1).map((wp, index) => {
            const prev = result.adversarialPath?.waypoints[index]?.position ?? [0, 0];
            const a = projection.sceneToSvg([prev[0], prev[1]]);
            const b = projection.sceneToSvg([wp.position[0], wp.position[1]]);
            const ghosted = adversaryShadowOn && !layers.paths;
            return (
              <line
                key={`adv-${wp.position[0].toFixed(2)}-${wp.position[1].toFixed(2)}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={ghosted ? "#ef4444" : qualityColor(wp.detectionQuality)}
                strokeWidth={ghosted ? 1.2 : 1.5}
                strokeLinecap="round"
                opacity={ghosted ? 0.35 : 0.85}
                strokeDasharray={ghosted ? "4 3" : undefined}
              />
            );
          })}
        </g>
      ) : null}

      {scene.entryPoints.map((entry) => {
        const p = projection.sceneToSvg(entry.position);
        const isSelected = nodeActive(entry.id, selectedNodeId, hoveredNodeId);
        return (
          <g key={entry.id}>
            <polygon
              points={
                `${formatSvgPoint({ x: p.x, y: p.y - 3.8 })} `
                + `${formatSvgPoint({ x: p.x - 3, y: p.y + 3.2 })} `
                + `${formatSvgPoint({ x: p.x + 3, y: p.y + 3.2 })}`
              }
              fill={isSelected ? "#bfdbfe" : "#93c5fd"}
              stroke={isSelected ? "#f8fafc" : "#e2e8f0"}
              strokeWidth={0.9}
              {...makeNodeHandlers(entry.id, onNodeSelect, onNodeHover)}
            />
            {showNodeLabels ? (
              <text
                x={p.x}
                y={p.y + 8}
                fill="#cbd5e1"
                fontSize={8}
                opacity={0.9}
                textAnchor="middle"
                style={{ pointerEvents: "none" }}
              >
                {entry.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {replayActor ? (
        <g>
          {(() => {
            const actor = projection.sceneToSvg(replayActor);
            return (
              <>
                <circle cx={actor.x} cy={actor.y} r={4.4} fill="#fb923c" opacity={0.95} />
                <circle cx={actor.x} cy={actor.y} r={1.8} fill="#fdba74" />
              </>
            );
          })()}
        </g>
      ) : null}

      {mode === "mini" && activePathForReplay ? (
        <g>
          {(() => {
            const actor = pointOnPathAtProgress(activePathForReplay, 0.55);
            const pos = projection.sceneToSvg(actor);
            return <circle cx={pos.x} cy={pos.y} r={3.2} fill="#f97316" opacity={0.52} />;
          })()}
        </g>
      ) : null}

      {showReplayPath && activePathForReplay ? (() => {
        const actor = pointOnPathAtProgress(activePathForReplay, Math.max(0, Math.min(1, 0.35)));
        const pos = projection.sceneToSvg(actor);
        return <circle cx={pos.x} cy={pos.y} r={3.8} fill="#fb923c" opacity={0.2} />;
      })() : null}
    </g>
  );
}
