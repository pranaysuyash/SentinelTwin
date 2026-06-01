"use client";

import { useMemo } from "react";

import { cn } from "@/lib/cn";
import type {
  CameraNode,
  ObstructionNode,
  SecurityLightNode,
  SecurityScene,
  SimulationResult,
} from "@/schema/security-scene";
import { QUALITY_COLOR } from "@/lib/quality-display";

export type ScenePreviewProps = {
  scene: SecurityScene;
  result: SimulationResult | null;
  activePathId?: string | null;
  compact?: boolean;
  showLabels?: boolean;
  hydrated?: boolean;
};

function sceneSummary(scene: SecurityScene) {
  return [
    `${scene.dimensions.width}m \u00d7 ${scene.dimensions.depth}m`,
    countLabel(scene.cameras.length, "camera"),
    countLabel(scene.securityLights.length, "light"),
    countLabel(scene.obstructions.length, "obstruction"),
    countLabel(scene.criticalZones.length, "critical zone"),
    countLabel(scene.paths.length, "path"),
  ].join(" \u00b7 ");
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function criticalZoneStatusMap(result: SimulationResult | null) {
  return new Map(result?.criticalZoneResults.map((zone) => [zone.zoneId, zone]) ?? []);
}

function qualityToTone(quality: SecurityScene["criticalZones"][number]["requiredQuality"]) {
  return QUALITY_COLOR[quality] ?? QUALITY_COLOR.none;
}

function anglePoint(origin: [number, number], angleDeg: number, distance: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return [origin[0] + Math.cos(radians) * distance, origin[1] + Math.sin(radians) * distance] as [number, number];
}

function pathPolyline(path: SecurityScene["paths"][number] | undefined, scalePoint: (point: [number, number]) => [number, number]) {
  if (!path || path.points.length < 2) return "";
  return path.points
    .map((point) => scalePoint(point.position))
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

export function ScenePreview({ scene, result, activePathId = null, compact = false, showLabels = true, hydrated = true }: ScenePreviewProps) {
  const width = compact ? 860 : 1280;
  const height = compact ? 460 : 620;
  const padding = compact ? 34 : 46;
  const scale = Math.min(
    (width - padding * 2) / scene.dimensions.width,
    (height - padding * 2) / scene.dimensions.depth,
  );
  const sceneWidth = scene.dimensions.width * scale;
  const sceneHeight = scene.dimensions.depth * scale;
  const offsetX = (width - sceneWidth) / 2;
  const offsetY = (height - sceneHeight) / 2;
  const toPoint = (point: [number, number]) => [offsetX + point[0] * scale, offsetY + point[1] * scale] as [number, number];
  const zoneResults = criticalZoneStatusMap(result);
  const activePath = activePathId ? (scene.paths.find((path) => path.id === activePathId) ?? null) : null;
  const activePathStart = activePath ? toPoint(activePath.points[0].position) : null;
  const activePathEnd = activePath ? toPoint(activePath.points[activePath.points.length - 1].position) : null;
  const heatmapCells = result?.coverageCells ?? [];
  const heatmapStep = Math.max(1, Math.ceil(heatmapCells.length / (compact ? 150 : 240)));
  const cellSize = Math.max(2.6, scale * (compact ? 0.26 : 0.22));
  const activePathPoints = pathPolyline(activePath ?? undefined, toPoint);
  const downsampledHeatmapCells = useMemo(
    () => heatmapCells.filter((_, index) => index % heatmapStep === 0),
    [heatmapCells, heatmapStep],
  );

  if (!hydrated) {
    return (
      <div className={cn(
        "relative overflow-hidden rounded-[28px] border border-[color:var(--st-border)] bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.11),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.09),transparent_30%),linear-gradient(180deg,rgba(11,14,21,0.98),rgba(11,14,21,0.86))]",
        compact ? "min-h-[290px]" : "min-h-[340px]",
      )}>
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3 text-center">
            <div className="text-xs uppercase tracking-[0.22em] text-[color:var(--st-muted)]">Site Twin Preview</div>
            <div className="mt-1 text-sm font-medium text-white">{scene.name}</div>
            <div className="mt-1 text-[11px] text-[color:var(--st-muted)]">Preparing site twin \u00b7 Run simulation for coverage data</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-[28px] border border-[color:var(--st-border)] bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.11),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.09),transparent_30%),linear-gradient(180deg,rgba(11,14,21,0.98),rgba(11,14,21,0.86))",
      compact ? "min-h-[290px]" : "min-h-[340px]",
    )}>
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
      <svg suppressHydrationWarning viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="coverageGlow" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(59,130,246,0.18)" />
            <stop offset="100%" stopColor="rgba(34,197,94,0.14)" />
          </linearGradient>
          <filter id="softBlur">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        <rect x={offsetX} y={offsetY} width={sceneWidth} height={sceneHeight} rx="28" fill="rgba(10,14,20,0.92)" stroke="rgba(148,163,184,0.12)" />
        <rect x={offsetX} y={offsetY} width={sceneWidth} height={sceneHeight} rx="28" fill="url(#coverageGlow)" opacity="0.38" />

        {downsampledHeatmapCells.map((cell, index) => {
          const [x, y] = toPoint([cell.x, cell.z]);
          const baseOpacity = cell.privacyRestricted ? 0.12 : 0.28;
          const opacity = cell.fragility != null ? Math.max(0.12, 0.42 - cell.fragility * 0.28) : baseOpacity;
          const fill =
            cell.quality === "none"
              ? "rgba(239,68,68,0.22)"
              : qualityToTone(cell.quality);
          return (
            <rect
              key={`${cell.x}-${cell.z}-${index}`}
              x={x - cellSize / 2}
              y={y - cellSize / 2}
              width={cellSize}
              height={cellSize}
              rx={cellSize / 5}
              fill={fill}
              opacity={opacity}
            />
          );
        })}

        {scene.walls.map((wall) => {
          const [x1, y1] = toPoint(wall.start);
          const [x2, y2] = toPoint(wall.end);
          return (
            <line
              key={wall.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={wall.material === "glass" ? "rgba(96,165,250,0.75)" : "rgba(226,232,240,0.88)"}
              strokeWidth={compact ? 3.2 : 4.2}
              strokeLinecap="round"
            />
          );
        })}

        {scene.doors.map((door) => {
          const [x, y] = toPoint([door.position[0], door.position[2]]);
          return <rect key={door.id} x={x - 10} y={y - 6} width="20" height="12" rx="4" fill="rgba(56,189,248,0.8)" />;
        })}

        {scene.windows.map((windowNode) => {
          const [x, y] = toPoint([windowNode.position[0], windowNode.position[2]]);
          return <rect key={windowNode.id} x={x - 12} y={y - 4} width="24" height="8" rx="3" fill="rgba(96,165,250,0.76)" />;
        })}

        {scene.privacyZones.map((zone) => {
          const points = zone.polygon.map((point) => toPoint(point)).map(([x, y]) => `${x},${y}`).join(" ");
          return <polygon key={zone.id} points={points} fill="rgba(239,68,68,0.07)" stroke="rgba(248,113,113,0.55)" strokeDasharray="8 6" strokeWidth="2" />;
        })}

        {scene.criticalZones.map((zone) => {
          const zoneResult = zoneResults.get(zone.id);
          const tone =
            zoneResult?.status === "pass"
              ? "rgba(34,197,94,0.18)"
              : zoneResult?.status === "partial"
                ? "rgba(245,158,11,0.18)"
                : "rgba(239,68,68,0.18)";
          const outline =
            zoneResult?.status === "pass"
              ? "rgba(74,222,128,0.65)"
              : zoneResult?.status === "partial"
                ? "rgba(251,191,36,0.65)"
                : "rgba(248,113,113,0.72)";
          const points = zone.polygon.map((point) => toPoint(point)).map(([x, y]) => `${x},${y}`).join(" ");
          return <polygon key={zone.id} points={points} fill={tone} stroke={outline} strokeWidth="2.4" />;
        })}

        {scene.obstructions.map((obstruction: ObstructionNode) => {
          const [x, y] = toPoint([obstruction.position[0], obstruction.position[2]]);
          const w = Math.max(12, obstruction.dimensions[0] * scale);
          const h = Math.max(10, obstruction.dimensions[2] * scale);
          return (
            <rect
              key={obstruction.id}
              x={x - w / 2}
              y={y - h / 2}
              width={w}
              height={h}
              rx="8"
              fill="rgba(148,163,184,0.34)"
              stroke={obstruction.movable ? "rgba(251,191,36,0.55)" : "rgba(226,232,240,0.24)"}
              strokeWidth="1.5"
            />
          );
        })}

        {scene.securityLights.map((light: SecurityLightNode) => {
          const [x, y] = toPoint([light.position[0], light.position[2]]);
          return (
            <circle
              key={light.id}
              cx={x}
              cy={y}
              r={compact ? 7 : 8.5}
              fill={light.status === "on" ? "rgba(251,191,36,0.95)" : "rgba(107,114,128,0.6)"}
              stroke="rgba(255,255,255,0.24)"
              strokeWidth="1.2"
            />
          );
        })}

        {scene.cameras.map((camera: CameraNode) => {
          const origin = toPoint([camera.position[0], camera.position[2]]);
          const range = camera.rangeM * scale;
          const left = anglePoint(origin, camera.yawDeg - camera.fovHorizontalDeg / 2, range);
          const right = anglePoint(origin, camera.yawDeg + camera.fovHorizontalDeg / 2, range);
          const poly = `${origin[0]},${origin[1]} ${left[0]},${left[1]} ${right[0]},${right[1]}`;
          return (
            <g key={camera.id}>
              <polygon points={poly} fill="rgba(59,130,246,0.11)" stroke="rgba(59,130,246,0.48)" strokeWidth="1.6" />
              <circle cx={origin[0]} cy={origin[1]} r={compact ? 6 : 7.5} fill="rgba(59,130,246,0.96)" stroke="rgba(255,255,255,0.24)" strokeWidth="1.1" />
            </g>
          );
        })}

        {activePathPoints ? (
          <g>
            <polyline points={activePathPoints} fill="none" stroke="rgba(34,197,94,0.9)" strokeWidth="3" strokeDasharray="6 6" />
            {activePathStart ? (
              <circle cx={activePathStart[0]} cy={activePathStart[1]} r="6.5" fill="rgba(34,197,94,0.95)" />
            ) : null}
            {activePathEnd ? (
              <circle cx={activePathEnd[0]} cy={activePathEnd[1]} r="6.5" fill="rgba(248,113,113,0.95)" />
            ) : null}
          </g>
        ) : null}

        {showLabels ? (
          <>
            <text x={offsetX + 18} y={offsetY + 26} fill="rgba(226,232,240,0.86)" fontSize={compact ? 13 : 15} fontWeight="700">
              {scene.name}
            </text>
            <text x={offsetX + 18} y={offsetY + 46} fill="rgba(148,163,184,0.88)" fontSize={compact ? 10 : 12}>
              {sceneSummary(scene)}
            </text>
            <text x={offsetX + sceneWidth - 18} y={offsetY + 26} textAnchor="end" fill="rgba(148,163,184,0.78)" fontSize={compact ? 10 : 11}>
              Coverage preview
            </text>
          </>
        ) : null}
      </svg>
    </div>
  );
}
