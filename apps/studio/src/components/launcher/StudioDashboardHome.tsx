"use client";

import { useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

import {
  ArrowRight,
  Camera,
  FileUp,
  FolderOpen,
  LayoutDashboard,
  Layers3,
  Map as MapIcon,
  Monitor,
  Play,
  Plus,
  Radar,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { PRODUCT_FEATURE_STATUS_LAST_VERIFIED, type ProductFeatureEntry, type ProductFeatureStatus } from "@/lib/product-feature-status";
import { getSceneSourceMeta } from "@/lib/scene-source";
import { SecurityOutcomePanel } from "@/components/security-outcome/SecurityOutcomePanel";
import type { BottomTab, SavedProjectRecord, ViewMode, WorkspacePreset } from "@/store/studio-store";
import type { SecurityScene, SecurityIssue, SimulationResult, DoriQuality, ScenarioPath, CameraNode, ObstructionNode, SecurityLightNode } from "@/schema/security-scene";

type LaunchMode = {
  label: string;
  description: string;
  viewMode: ViewMode;
  preset: WorkspacePreset;
  accent: "blue" | "green" | "amber" | "violet" | "slate";
};

type ProjectSort = "recent" | "name" | "coverage";
type StarterTone = "blank" | "import" | "scan" | "ai";
const LAUNCH_MODES: LaunchMode[] = [
  { label: "Coverage", description: "Open the main analysis workspace.", viewMode: "camera_view", preset: "coverage", accent: "blue" },
  { label: "Camera View", description: "Inspect one camera in full canvas.", viewMode: "camera_view", preset: "coverage", accent: "green" },
  { label: "Camera Wall", description: "Review live feeds and statuses.", viewMode: "wall", preset: "camera_wall", accent: "amber" },
  { label: "Path Replay", description: "Replay the active route over the scene.", viewMode: "replay", preset: "replay", accent: "violet" },
  { label: "Compare", description: "See baseline versus proposed fixes.", viewMode: "compare", preset: "compare", accent: "slate" },
  { label: "Report Lite", description: "Open the evidence and export path.", viewMode: "report", preset: "report", accent: "blue" },
];

const NAV_ITEMS = [
  { label: "Studio", detail: "Launch", active: true as const },
  { label: "Projects", detail: "Local workspaces", active: false as const },
  { label: "Demo Sites", detail: "Retail / Office / Warehouse", active: false as const },
  { label: "Reports", detail: "Evidence exports", active: false as const },
  { label: "Docs", detail: "Architecture notes", active: false as const },
  { label: "Settings", detail: "Studio preferences", active: false as const },
] as const;

const SOURCE_LABELS: Record<SecurityScene["source"], string> = {
  manual: "Draft",
  ai: "AI Draft",
  scan: "Scan",
  import: "Import",
  preset: "Preset",
  demo: "Demo",
};

const ISSUE_SEVERITY_ORDER: Record<SecurityIssue["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function issueSeverityLabel(severity: SecurityIssue["severity"]) {
  switch (severity) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
    default:
      return "Low";
  }
}

const QUALITY_COLOR: Record<DoriQuality, string> = {
  none: "#7f1d1d",
  detection: "#f59e0b",
  observation: "#fbbf24",
  recognition: "#22c55e",
  identification: "#38bdf8",
  overview: "#38bdf8",
  outline: "#60a5fa",
  discern: "#4ade80",
  perceive: "#22c55e",
  characterize: "#0ea5e9",
  validate: "#2563eb",
  scrutinize: "#1d4ed8",
};

const ACCENT_CLASS: Record<LaunchMode["accent"], string> = {
  blue: "from-sky-400/20 to-sky-500/5 text-sky-200 border-sky-400/25",
  green: "from-emerald-400/20 to-emerald-500/5 text-emerald-200 border-emerald-400/25",
  amber: "from-amber-400/20 to-amber-500/5 text-amber-200 border-amber-400/25",
  violet: "from-violet-400/20 to-violet-500/5 text-violet-200 border-violet-400/25",
  slate: "from-slate-300/20 to-slate-500/5 text-slate-200 border-slate-300/20",
};

const STARTER_PREVIEW_CLASS: Record<StarterTone, string> = {
  blank: "from-sky-500/18 via-sky-500/8 to-transparent",
  import: "from-cyan-500/18 via-cyan-500/8 to-transparent",
  scan: "from-emerald-500/18 via-emerald-500/8 to-transparent",
  ai: "from-violet-500/18 via-violet-500/8 to-transparent",
};

type StudioDashboardHomeProps = {
  scene: SecurityScene;
  result: SimulationResult | null;
  simulationDirty: boolean;
  savedScenes: SecurityScene[];
  savedProjects: SavedProjectRecord[];
  currentRunLabel: string | null;
  onOpenStudio: () => void;
  onOpenCoverageWorkspace: () => void;
  onOpenCameraWall: () => void;
  onOpenPathReplay: () => void;
  onOpenCompareFixes: () => void;
  onOpenIssues: () => void;
  onRunSimulation: () => void;
  onCreateScene: () => void;
  onImportFloorPlan: () => void;
  onImportScene: () => void;
  onScanSite: () => void;
  onAiDraft: () => void;
  onVerifyFootagePlanned: () => void;
  onGuidedScanPlanned: () => void;
  onOpenReport: () => void;
  onOpenScene?: (scene: SecurityScene) => void;
  onUpdateProjectMetadata: (sceneId: string, patch: Partial<Pick<SavedProjectRecord, "folder" | "tags" | "pinned" | "lastOpenedAt">>) => void;
  onOpenMode: (viewMode: ViewMode, preset: WorkspacePreset, bottomTab?: BottomTab) => void;
  featureStatus: ProductFeatureEntry[];
};

type ScenePreviewProps = {
  scene: SecurityScene;
  result: SimulationResult | null;
  compact?: boolean;
  showLabels?: boolean;
  hydrated?: boolean;
};

function formatTime(ts: number | null | undefined) {
  if (!ts) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(ts));
}

function qualityToTone(quality: DoriQuality) {
  return QUALITY_COLOR[quality] ?? QUALITY_COLOR.none;
}

function coverageTone(pct: number) {
  if (pct >= 80) return "text-emerald-300";
  if (pct >= 60) return "text-amber-300";
  return "text-red-300";
}

function sceneSummary(scene: SecurityScene) {
  return [
    `${scene.dimensions.width}m × ${scene.dimensions.depth}m`,
    countLabel(scene.cameras.length, "camera"),
    countLabel(scene.securityLights.length, "light"),
    countLabel(scene.obstructions.length, "obstruction"),
    countLabel(scene.criticalZones.length, "critical zone"),
  ].join(" · ");
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function criticalZoneStatusMap(result: SimulationResult | null) {
  return new Map(result?.criticalZoneResults.map((zone) => [zone.zoneId, zone]) ?? []);
}

function pathPolyline(path: ScenarioPath | undefined, scalePoint: (point: [number, number]) => [number, number]) {
  if (!path || path.points.length < 2) return "";
  return path.points
    .map((point) => scalePoint(point.position))
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

function anglePoint(origin: [number, number], angleDeg: number, distance: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return [origin[0] + Math.cos(radians) * distance, origin[1] + Math.sin(radians) * distance] as [number, number];
}

function ScenePreview({ scene, result, compact = false, showLabels = true, hydrated = true }: ScenePreviewProps) {
  const width = compact ? 860 : 1280;
  const height = compact ? 560 : 760;
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
  const activePath = scene.paths[0];
  const heatmapCells = result?.coverageCells ?? [];
  const heatmapStep = Math.max(1, Math.ceil(heatmapCells.length / (compact ? 150 : 240)));
  const cellSize = Math.max(2.6, scale * (compact ? 0.26 : 0.22));
  const activePathPoints = pathPolyline(activePath, toPoint);

  if (!hydrated) {
    return (
      <div className={cn(
        "relative overflow-hidden rounded-[28px] border border-[color:var(--st-border)] bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.11),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.09),transparent_30%),linear-gradient(180deg,rgba(11,14,21,0.98),rgba(11,14,21,0.86))]",
        compact ? "min-h-[340px]" : "min-h-[520px]",
      )}>
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-white/8 bg-black/30 px-4 py-3 text-center">
            <div className="text-xs uppercase tracking-[0.22em] text-[color:var(--st-muted)]">Loading preview</div>
            <div className="mt-1 text-sm font-medium text-white">{scene.name}</div>
            <div className="mt-1 text-[11px] text-[color:var(--st-muted)]">Hydrating scene geometry</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-[28px] border border-[color:var(--st-border)] bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.11),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.09),transparent_30%),linear-gradient(180deg,rgba(11,14,21,0.98),rgba(11,14,21,0.86))]",
      compact ? "min-h-[340px]" : "min-h-[520px]",
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

        {heatmapCells.filter((_, index) => index % heatmapStep === 0).map((cell, index) => {
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
          <>
            <polyline points={activePathPoints} fill="none" stroke="rgba(34,197,94,0.9)" strokeWidth="3" strokeDasharray="6 6" />
            <circle cx={toPoint(activePath.points[0].position)[0]} cy={toPoint(activePath.points[0].position)[1]} r="6.5" fill="rgba(34,197,94,0.95)" />
            <circle cx={toPoint(activePath.points[activePath.points.length - 1].position)[0]} cy={toPoint(activePath.points[activePath.points.length - 1].position)[1]} r="6.5" fill="rgba(248,113,113,0.95)" />
          </>
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

function WorkspaceMiniPreview({ scene, result, hydrated = true }: ScenePreviewProps) {
  const width = 320;
  const height = 156;
  const padding = 12;
  const scale = Math.min((width - padding * 2) / scene.dimensions.width, (height - padding * 2) / scene.dimensions.depth);
  const sceneWidth = scene.dimensions.width * scale;
  const sceneHeight = scene.dimensions.depth * scale;
  const offsetX = (width - sceneWidth) / 2;
  const offsetY = (height - sceneHeight) / 2;
  const toPoint = (point: [number, number]) => [offsetX + point[0] * scale, offsetY + point[1] * scale] as [number, number];
  const zoneResults = criticalZoneStatusMap(result);

  if (!hydrated) {
    return (
      <div className="relative h-[108px] overflow-hidden rounded-[16px] border border-white/8 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,248,0.12),transparent_40%),linear-gradient(180deg,rgba(8,12,18,0.92),rgba(8,12,18,0.7))]">
        <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full border border-white/8 bg-black/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">
            Preview loading
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[108px] overflow-hidden rounded-[16px] border border-white/8 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,248,0.12),transparent_40%),linear-gradient(180deg,rgba(8,12,18,0.92),rgba(8,12,18,0.7))]">
      {scene.source === "manual" ? (
        <div className="absolute right-2 top-2 z-10 rounded-full border border-amber-400/20 bg-amber-500/14 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-100">
          Draft
        </div>
      ) : null}
      <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:32px_32px]" />
      <svg suppressHydrationWarning viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full">
        <rect x={offsetX} y={offsetY} width={sceneWidth} height={sceneHeight} rx="16" fill="rgba(10,14,20,0.95)" stroke="rgba(148,163,184,0.14)" />

        {scene.criticalZones.map((zone) => {
          const zoneResult = zoneResults.get(zone.id);
          const tone =
            zoneResult?.status === "pass"
              ? "rgba(34,197,94,0.15)"
              : zoneResult?.status === "partial"
                ? "rgba(245,158,11,0.15)"
                : "rgba(239,68,68,0.15)";
          const outline =
            zoneResult?.status === "pass"
              ? "rgba(74,222,128,0.62)"
              : zoneResult?.status === "partial"
                ? "rgba(251,191,36,0.62)"
                : "rgba(248,113,113,0.68)";
          const points = zone.polygon.map((point) => toPoint(point)).map(([x, y]) => `${x},${y}`).join(" ");
          return <polygon key={zone.id} points={points} fill={tone} stroke={outline} strokeWidth="1.6" />;
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
              stroke={wall.material === "glass" ? "rgba(96,165,250,0.72)" : "rgba(226,232,240,0.88)"}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        })}

        {scene.obstructions.slice(0, 6).map((obstruction) => {
          const [x, y] = toPoint([obstruction.position[0], obstruction.position[2]]);
          const w = Math.max(10, obstruction.dimensions[0] * scale);
          const h = Math.max(9, obstruction.dimensions[2] * scale);
          return (
            <rect
              key={obstruction.id}
              x={x - w / 2}
              y={y - h / 2}
              width={w}
              height={h}
              rx="6"
              fill="rgba(148,163,184,0.32)"
              stroke={obstruction.movable ? "rgba(251,191,36,0.52)" : "rgba(226,232,240,0.18)"}
              strokeWidth="1.2"
            />
          );
        })}

        {scene.cameras.map((camera) => {
          const origin = toPoint([camera.position[0], camera.position[2]]);
          const range = camera.rangeM * scale;
          const left = anglePoint(origin, camera.yawDeg - camera.fovHorizontalDeg / 2, range);
          const right = anglePoint(origin, camera.yawDeg + camera.fovHorizontalDeg / 2, range);
          const poly = `${origin[0]},${origin[1]} ${left[0]},${left[1]} ${right[0]},${right[1]}`;
          return (
            <g key={camera.id}>
              <polygon points={poly} fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.4)" strokeWidth="1.1" />
              <circle cx={origin[0]} cy={origin[1]} r={4.5} fill="rgba(59,130,246,0.95)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" />
            </g>
          );
        })}

        <text x={offsetX + 10} y={offsetY + 18} fill="rgba(226,232,240,0.9)" fontSize="11" fontWeight="700">
          {scene.name}
        </text>
        <text x={offsetX + 10} y={offsetY + 32} fill="rgba(148,163,184,0.88)" fontSize="9">
          {countLabel(scene.cameras.length, "camera")} · {countLabel(scene.criticalZones.length, "zone")}
        </text>
      </svg>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  description,
  onClick,
  variant = "secondary",
  className,
}: {
  icon?: ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5",
        variant === "primary"
          ? "border-sky-400/30 bg-sky-500/12 text-sky-50 shadow-[0_12px_36px_rgba(14,165,233,0.10)] hover:border-sky-300/45 hover:bg-sky-500/16"
          : variant === "ghost"
            ? "border-transparent bg-transparent text-[color:var(--st-text)] hover:border-[color:var(--st-border)] hover:bg-white/[0.03]"
            : "border-[color:var(--st-border)] bg-[color:var(--st-panel)] text-[color:var(--st-text)] hover:border-[rgba(79,183,255,0.35)] hover:bg-[color:var(--st-panel-2)]",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon ? <span className="text-[color:var(--st-accent)]">{icon}</span> : null}
          <span>{label}</span>
        </div>
        {description ? <div className="mt-1 text-[11px] leading-4 text-[color:var(--st-muted)]">{description}</div> : null}
      </div>
      <ArrowRight className="h-4 w-4 flex-none text-[color:var(--st-accent)] transition-transform duration-200 group-hover:translate-x-1" />
    </button>
  );
}

function workflowStatusTone(status: ProductFeatureStatus) {
  if (status === "Available") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  if (status === "Preview") return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  return "border-slate-400/20 bg-slate-500/10 text-slate-200";
}

function findFeatureEntryByName(featureStatus: ProductFeatureEntry[], featureName: string) {
  return featureStatus.find((entry) => entry.feature.toLowerCase() === featureName.toLowerCase()) ?? null;
}

function featureStatusValue(entry: ProductFeatureEntry | null, fallback: ProductFeatureStatus) {
  return entry?.status ?? fallback;
}

function featureDetailValue(entry: ProductFeatureEntry | null, fallback: string) {
  return entry?.detail ?? fallback;
}

function WorkflowCard({
  title,
  description,
  status,
  onClick,
}: {
  title: string;
  description: string;
  status: ProductFeatureStatus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(79,183,255,0.35)] hover:bg-[color:var(--st-panel-2)]"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white">{title}</div>
        <span className={cn("rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em]", workflowStatusTone(status))}>
          {status}
        </span>
      </div>
      <div className="mt-1 text-[11px] leading-4 text-[color:var(--st-muted)]">{description}</div>
    </button>
  );
}

function SceneStarterCard({
  icon,
  title,
  description,
  hint,
  badge,
  tone,
  onClick,
  variant = "secondary",
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  hint: string;
  badge: string;
  tone: StarterTone;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-h-[136px] flex-col justify-between rounded-[24px] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(0,0,0,0.18)]",
        variant === "primary"
          ? "border-sky-400/30 bg-sky-500/12 text-sky-50 shadow-[0_12px_36px_rgba(14,165,233,0.12)] hover:border-sky-300/45 hover:bg-sky-500/16"
          : "border-[color:var(--st-border)] bg-white/[0.03] text-[color:var(--st-text)] hover:border-[rgba(79,183,255,0.35)] hover:bg-[color:var(--st-panel-2)]",
      )}
    >
      <div className={cn("mb-3 overflow-hidden rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-2", STARTER_PREVIEW_CLASS[tone])}>
        <div className="flex h-[46px] items-end justify-between gap-2">
          <div className="flex items-end gap-1">
            <span className="h-3.5 w-8 rounded-md border border-white/12 bg-white/8" />
            <span className="h-5 w-3 rounded-md border border-white/12 bg-white/8" />
            <span className="h-2.5 w-5 rounded-md border border-white/12 bg-white/8" />
          </div>
          <div className="flex items-end gap-1.5">
            {tone === "blank" ? <span className="h-7 w-7 rounded-full border border-dashed border-sky-300/40 bg-sky-500/10" /> : null}
            {tone === "import" ? <span className="h-7 w-7 rounded-lg border border-cyan-300/30 bg-cyan-500/10" /> : null}
            {tone === "scan" ? <span className="h-6 w-10 rounded-md border border-emerald-300/30 bg-emerald-500/10" /> : null}
            {tone === "ai" ? <span className="h-7 w-7 rounded-full border border-violet-300/30 bg-violet-500/10" /> : null}
          </div>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
            <span className="text-[color:var(--st-accent)]">{icon}</span>
            <span>{badge}</span>
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight">{title}</div>
          <div className="mt-1 text-[11px] leading-4 text-[color:var(--st-muted)]">{description}</div>
        </div>
        <ArrowRight className="h-4 w-4 flex-none text-[color:var(--st-accent)] transition-transform duration-200 group-hover:translate-x-1" />
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
          {hint}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--st-muted)]">Start</span>
      </div>
    </button>
  );
}

function WorkspaceSeedCard({
  icon,
  title,
  description,
  badge,
  tone,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  badge: string;
  tone: StarterTone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[92px] flex-col justify-between rounded-[20px] border border-[color:var(--st-border)] bg-white/[0.03] p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(79,183,255,0.35)] hover:bg-[color:var(--st-panel-2)]"
    >
      <div className={cn("mb-2 overflow-hidden rounded-[14px] border border-white/8 p-2", STARTER_PREVIEW_CLASS[tone])}>
        <div className="flex h-[34px] items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-8 rounded-md border border-white/10 bg-white/8" />
            <span className="h-5 w-5 rounded-md border border-white/10 bg-white/8" />
          </div>
          <span className="rounded-full border border-white/10 bg-black/12 px-2 py-0.5 text-[9px] text-[color:var(--st-text)]/80">
            {badge}
          </span>
        </div>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">
            <span className="text-[color:var(--st-accent)]">{icon}</span>
            <span>{badge}</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-white">{title}</div>
        </div>
        <ArrowRight className="h-4 w-4 flex-none text-[color:var(--st-accent)] transition-transform duration-200 group-hover:translate-x-1" />
      </div>
      <div className="mt-2 text-[11px] leading-4 text-[color:var(--st-muted)]">{description}</div>
    </button>
  );
}

function MiniStat({
  label,
  value,
  accent = "text-white",
  detail,
}: {
  label: string;
  value: string;
  accent?: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--st-border)] bg-white/[0.025] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--st-muted)]">{label}</div>
      <div suppressHydrationWarning className={cn("mt-1 text-2xl font-semibold tracking-tight", accent)}>{value}</div>
      {detail ? <div className="mt-1 text-[11px] text-[color:var(--st-muted)]">{detail}</div> : null}
    </div>
  );
}

function ProjectMetadataEditor({
  project,
  onUpdateProjectMetadata,
}: {
  project: SavedProjectRecord;
  onUpdateProjectMetadata: StudioDashboardHomeProps["onUpdateProjectMetadata"];
}) {
  const [folderDraft, setFolderDraft] = useState(project.folder);
  const [tagDraft, setTagDraft] = useState(project.tags.join(", "));

  const applyFolderDraft = () => {
    onUpdateProjectMetadata(project.scene.id, { folder: folderDraft.trim() || "Unsorted" });
  };

  const applyTagDraft = () => {
    const tags = tagDraft
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    onUpdateProjectMetadata(project.scene.id, { tags });
  };

  const togglePinned = () => {
    onUpdateProjectMetadata(project.scene.id, { pinned: !project.pinned });
  };

  const selectedProjectScene = project.scene;
  const selectedProjectCoverage = selectedProjectScene.simulation?.totalCoveragePct ?? null;
  const selectedProjectIssues = [...(selectedProjectScene.simulation?.issues ?? [])].sort(
    (a, b) => ISSUE_SEVERITY_ORDER[a.severity] - ISSUE_SEVERITY_ORDER[b.severity],
  );

  return (
    <div className="mt-4 rounded-[28px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
        <Settings2 className="h-3.5 w-3.5 text-sky-300" />
        Selected Workspace
      </div>
      <div className="mt-3 rounded-[22px] border border-[color:var(--st-border)] bg-white/[0.025] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">{selectedProjectScene.name}</div>
            <div className="mt-1 text-[11px] text-[color:var(--st-muted)]">
              {sourceLabel(selectedProjectScene)} · Last updated {formatTime(project.updatedAt)}
            </div>
            <div className="mt-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em]",
                  sourceBadgeTone(selectedProjectScene.source),
                )}
              >
                {selectedProjectScene.source === "demo"
                  ? "Reference Demo"
                  : selectedProjectScene.source === "manual"
                    ? "Draft Workspace"
                    : "Your Workspace"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={togglePinned}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
              project.pinned
                ? "border-amber-400/30 bg-amber-500/12 text-amber-100"
                : "border-[color:var(--st-border)] bg-white/[0.03] text-[color:var(--st-muted)] hover:bg-white/[0.05]",
            )}
          >
            {project.pinned ? "Unpin" : "Pin"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
            Folder: {folderDraft}
          </span>
          {project.tags.length > 0 ? (
            project.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
                #{tag}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
              No tags
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <MiniStat
            label="Coverage"
            value={selectedProjectCoverage != null ? `${Math.round(selectedProjectCoverage)}%` : "—"}
            accent={selectedProjectCoverage != null ? coverageTone(selectedProjectCoverage) : "text-white"}
            detail="Saved workspace snapshot"
          />
          <MiniStat
            label="Issues"
            value={`${selectedProjectIssues.length}`}
            accent={selectedProjectIssues.length > 0 ? "text-amber-300" : "text-emerald-300"}
            detail={selectedProjectIssues[0] ? selectedProjectIssues[0].description : "No saved issues"}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <MiniStat label="Cameras" value={`${selectedProjectScene.cameras.length}`} accent="text-sky-200" detail="Saved scene cameras" />
          <MiniStat label="Zones" value={`${selectedProjectScene.criticalZones.length}`} accent="text-sky-200" detail="Critical zones tracked" />
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border border-[color:var(--st-border)] bg-white/[0.025] p-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">Project metadata</div>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-[11px] text-[color:var(--st-muted)]">Folder</span>
            <input
              value={folderDraft}
              onChange={(event) => setFolderDraft(event.target.value)}
              onBlur={applyFolderDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyFolderDraft();
                }
              }}
              className="mt-1 w-full rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[color:var(--st-muted)] focus:border-sky-400/35 focus:bg-white/[0.04]"
              placeholder="Unsorted"
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-[color:var(--st-muted)]">Tags</span>
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onBlur={applyTagDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyTagDraft();
                }
              }}
              className="mt-1 w-full rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[color:var(--st-muted)] focus:border-sky-400/35 focus:bg-white/[0.04]"
              placeholder="retail, client, north"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function sourceLabel(scene: SecurityScene) {
  return SOURCE_LABELS[scene.source] ?? getSceneSourceMeta(scene.source).shortLabel;
}

function sourceBadgeTone(source: SecurityScene["source"]) {
  switch (source) {
    case "demo":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    case "manual":
      return "border-amber-400/20 bg-amber-500/10 text-amber-100";
    case "scan":
      return "border-cyan-400/20 bg-cyan-500/10 text-cyan-200";
    case "import":
      return "border-sky-400/20 bg-sky-500/10 text-sky-200";
    case "ai":
      return "border-violet-400/20 bg-violet-500/10 text-violet-200";
    case "preset":
      return "border-indigo-400/20 bg-indigo-500/10 text-indigo-200";
    default:
      return "border-slate-400/20 bg-slate-500/10 text-slate-200";
  }
}

export function StudioDashboardHome({
  scene,
  result,
  simulationDirty,
  savedScenes,
  savedProjects,
  currentRunLabel,
  onOpenStudio,
  onOpenCoverageWorkspace,
  onOpenCameraWall,
  onOpenPathReplay,
  onOpenCompareFixes,
  onOpenIssues,
  onRunSimulation,
  onCreateScene,
  onImportFloorPlan,
  onImportScene,
  onScanSite,
  onAiDraft,
  onVerifyFootagePlanned,
  onGuidedScanPlanned,
  onOpenReport,
  onOpenScene,
  onUpdateProjectMetadata,
  onOpenMode,
  featureStatus,
}: StudioDashboardHomeProps) {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const coverage = result?.totalCoveragePct ?? scene.simulation?.totalCoveragePct ?? null;
  const passCount = result?.criticalZoneResults.filter((zone) => zone.status === "pass").length ?? (scene.simulation?.criticalZoneResults ?? []).filter((zone) => zone.status === "pass").length;
  const totalZones = result?.criticalZoneResults.length ?? (scene.simulation?.criticalZoneResults ?? []).length ?? scene.criticalZones.length;
  const issues = [...(result?.issues ?? scene.simulation?.issues ?? [])].sort((a, b) => ISSUE_SEVERITY_ORDER[a.severity] - ISSUE_SEVERITY_ORDER[b.severity]);
  const worstIssue = issues[0] ?? null;
  const [projectQuery, setProjectQuery] = useState("");
  const [projectSort, setProjectSort] = useState<ProjectSort>("recent");
  const browserProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    const filtered = savedProjects.filter((project) => {
      if (!query) return true;
      const nextScene = project.scene;
      const haystack = [
        nextScene.name,
        nextScene.source,
        project.folder,
        project.tags.join(" "),
        project.pinned ? "pinned" : "",
        `${nextScene.dimensions.width} ${nextScene.dimensions.depth} ${nextScene.dimensions.height}`,
        `${nextScene.cameras.length} cameras`,
        `${nextScene.obstructions.length} obstructions`,
        `${nextScene.criticalZones.length} zones`,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    return [...filtered].sort((a, b) => {
      const aScene = a.scene;
      const bScene = b.scene;
      switch (projectSort) {
        case "name":
          return aScene.name.localeCompare(bScene.name);
        case "coverage":
          return (bScene.simulation?.totalCoveragePct ?? -1) - (aScene.simulation?.totalCoveragePct ?? -1) || b.updatedAt - a.updatedAt;
        case "recent":
        default:
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt - a.updatedAt;
      }
    });
  }, [projectQuery, projectSort, savedProjects]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProjectRecord = useMemo(() => {
    if (selectedProjectId) {
      const selected = browserProjects.find((project) => project.scene.id === selectedProjectId);
      if (selected) return selected;
    }
    return browserProjects[0] ?? null;
  }, [browserProjects, selectedProjectId]);
  const selectedProjectScene = selectedProjectRecord?.scene ?? scene;
  const folderCounts = useMemo(() => {
    return browserProjects.reduce<Record<string, number>>((acc, project) => {
      acc[project.folder] = (acc[project.folder] ?? 0) + 1;
      return acc;
    }, {});
  }, [browserProjects]);
  const tagCounts = useMemo(() => {
    return browserProjects.reduce<Record<string, number>>((acc, project) => {
      project.tags.forEach((tag) => {
        acc[tag] = (acc[tag] ?? 0) + 1;
      });
      return acc;
    }, {});
  }, [browserProjects]);
  const folderFilters = ["All", ...Object.keys(folderCounts).sort((a, b) => folderCounts[b] - folderCounts[a] || a.localeCompare(b))];
  const tagFilters = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b)).slice(0, 8);
  const [activeFolder, setActiveFolder] = useState<string>("All");
  const [activeTag, setActiveTag] = useState<string>("All");
  const visibleProjects = browserProjects.filter((project) => {
    const folderMatch = activeFolder === "All" || project.folder === activeFolder;
    const tagMatch = activeTag === "All" || project.tags.includes(activeTag);
    return folderMatch && tagMatch;
  });
  const userWorkspaceProjects = visibleProjects.filter((project) => project.scene.source !== "demo");
  const referenceDemoProjects = visibleProjects.filter((project) => project.scene.source === "demo");
  const assumptions = scene.assumptions;
  const lastRun = result?.computedAt ?? scene.simulation?.computedAt ?? null;
  const aiLayoutDraftFeature = findFeatureEntryByName(featureStatus, "AI layout draft");
  const manualScanFeature = findFeatureEntryByName(featureStatus, "Scan Site (manual-assisted)");
  const guidedScanFeature = findFeatureEntryByName(featureStatus, "Guided scan reconstruction");
  const verifyFootageFeature = findFeatureEntryByName(featureStatus, "Real footage verification");
  const visibleProjectCount = visibleProjects.length;
  const userWorkspaceCount = userWorkspaceProjects.length;
  const referenceDemoCount = referenceDemoProjects.length;
  const rootStyle = {
    "--st-bg": "#080b11",
    "--st-panel": "rgba(11, 16, 26, 0.94)",
    "--st-panel-2": "rgba(16, 22, 34, 0.92)",
    "--st-border": "rgba(37, 48, 70, 0.96)",
    "--st-text": "#e6edf7",
    "--st-muted": "#8a96ab",
    "--st-accent": "#5bb6ff",
  } as CSSProperties;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--st-bg)] text-[color:var(--st-text)]" style={rootStyle}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.12),transparent_30%),radial-gradient(circle_at_80%_8%,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.06),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="relative z-10 flex min-h-screen flex-col gap-4 p-4 lg:p-5">
        <header className="grid gap-4 rounded-[28px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] px-4 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-lg lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_auto]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/12 text-emerald-200">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--st-muted)]">SentinelTwin Studio</span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Studio Dashboard Home
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Security Simulation Workspace</h1>
              <p className="mt-1 max-w-2xl text-sm text-[color:var(--st-muted)]">
                Launch directly into the live workspace, inspect the current scene, and jump to coverage, replay, wall, compare, or report views without the launcher feeling like a setup form. The demo scene is the baseline; create, import, or scan your own site from the scene-work entry points below.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white">
                  {scene.name}
                </span>
                <span className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[color:var(--st-muted)]">
                  {SOURCE_LABELS[scene.source]}
                </span>
                <span className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px]",
                  simulationDirty ? "border-amber-400/25 bg-amber-500/10 text-amber-200" : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
                )}>
                  {coverage == null ? "Simulation pending" : simulationDirty ? "Needs recompute" : "Up to date"}
                </span>
                <span className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[color:var(--st-muted)]">
                  {assumptions.timeOfDay === "night" ? "Night Mode" : assumptions.timeOfDay === "custom" ? "Custom" : "Day Mode"}
                </span>
                {currentRunLabel ? (
                  <span
                    suppressHydrationWarning
                    className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[color:var(--st-muted)]"
                  >
                    {currentRunLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-[22px] border border-white/[0.04] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
              <Radar className="h-3.5 w-3.5 text-sky-300" />
              Workspace status
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MiniStat label="Coverage" value={coverage != null ? `${Math.round(coverage)}%` : "—"} accent={coverage != null ? coverageTone(coverage) : "text-white"} detail="Current scene baseline" />
              <MiniStat label="Zones" value={`${passCount}/${totalZones}`} accent={passCount === totalZones ? "text-emerald-300" : "text-amber-300"} detail="Passing critical zones" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MiniStat label="Issues" value={`${issues.length}`} accent={issues.length > 0 ? "text-amber-300" : "text-emerald-300"} detail={worstIssue ? worstIssue.description : "No current issues"} />
              <MiniStat label="Last run" value={formatTime(lastRun)} accent="text-sky-200" detail="Simulation timestamp" />
            </div>
            <button
              type="button"
              onClick={onOpenIssues}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-100 transition-colors hover:border-amber-300/30 hover:bg-amber-500/14"
            >
              <TriangleAlert className="h-3.5 w-3.5" />
              Open Issues
            </button>
          </div>

          <div className="grid gap-2">
            <ActionButton icon={<FolderOpen className="h-4 w-4" />} label="Open Studio" description="Enter the live workspace immediately." onClick={onOpenStudio} variant="primary" />
            <ActionButton icon={<Play className="h-4 w-4" />} label="Run Simulation" description="Refresh coverage and issue results from the current scene." onClick={onRunSimulation} />
            <ActionButton icon={<FileUp className="h-4 w-4" />} label="Import JSON" description="Load a SecurityScene file into the workspace." onClick={onImportScene} />
            <ActionButton icon={<Plus className="h-4 w-4" />} label="New Scene" description="Create a blank scene or a guided template." onClick={onCreateScene} />
          </div>
        </header>

        <div className="grid flex-1 gap-4 xl:grid-cols-[228px_minmax(0,1fr)_388px]">
          <aside className="flex flex-col gap-4 rounded-[28px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[color:var(--st-muted)]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                Security Jobs
              </div>
              <div className="mt-3 space-y-2">
                <WorkflowCard title="Audit Existing Camera Setup" description="Run coverage, inspect failures, and generate report evidence." status="Available" onClick={onOpenCoverageWorkspace} />
                <WorkflowCard title="Design New Camera Layout" description="Create a scene, place cameras, and test before install." status="Available" onClick={onCreateScene} />
                <WorkflowCard title="Import Floor Plan" description="Upload plan, calibrate detections, review warnings, build baseline scene." status="Available" onClick={onImportFloorPlan} />
                <WorkflowCard
                  title="Describe Layout With AI"
                  description={featureDetailValue(aiLayoutDraftFeature, "Generate a draft scene from prompt and refine.")}
                  status={featureStatusValue(aiLayoutDraftFeature, "Preview")}
                  onClick={onAiDraft}
                />
                <WorkflowCard
                  title="Manual-Assisted Scan"
                  description={featureDetailValue(manualScanFeature, "Capture site inputs and compile into scene draft.")}
                  status={featureStatusValue(manualScanFeature, "Preview")}
                  onClick={onScanSite}
                />
                <WorkflowCard
                  title="Guided Scan Reconstruction"
                  description={featureDetailValue(guidedScanFeature, "Capture-driven reconstruction pipeline (not production-ready).")}
                  status={featureStatusValue(guidedScanFeature, "Preview")}
                  onClick={onGuidedScanPlanned}
                />
                <WorkflowCard
                  title="Verify Real Camera Footage"
                  description={featureDetailValue(verifyFootageFeature, "Reference image/video compare with local frame extraction and alignment preview.")}
                  status={featureStatusValue(verifyFootageFeature, "Preview")}
                  onClick={onVerifyFootagePlanned}
                />
                <WorkflowCard title="Open Reference Demo" description="Use the retail baseline to demo the simulation loop." status="Available" onClick={onOpenStudio} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[color:var(--st-muted)]">
                <Plus className="h-3.5 w-3.5 text-emerald-300" />
                Scene Work
              </div>
              <div className="mt-3 space-y-2">
                <ActionButton
                  icon={<Plus className="h-4 w-4" />}
                  label="New Blank Scene"
                  description="Start from an empty scene shell."
                  onClick={onCreateScene}
                  variant="primary"
                />
                <ActionButton
                  icon={<FileUp className="h-4 w-4" />}
                  label="Import SecurityScene JSON"
                  description="Load a canonical scene file."
                  onClick={onImportScene}
                />
                <ActionButton
                  icon={<ScanSearch className="h-4 w-4" />}
                  label="Scan Site Photo"
                  description="Preview: manual-assisted photo intake compiled into SecurityScene."
                  onClick={onScanSite}
                />
                <ActionButton
                  icon={<Sparkles className="h-4 w-4" />}
                  label="AI Layout Draft"
                  description="Generate a prompt-backed draft scene."
                  onClick={onAiDraft}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[color:var(--st-muted)]">
                <LayoutDashboard className="h-3.5 w-3.5 text-sky-300" />
                Navigation
              </div>
              <div className="mt-3 space-y-1.5">
                {NAV_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-center justify-between rounded-2xl border px-3 py-2 text-sm",
                      item.active
                        ? "border-sky-400/25 bg-sky-500/10 text-white"
                        : "border-transparent bg-white/[0.02] text-[color:var(--st-muted)]",
                    )}
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em]">{item.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[color:var(--st-muted)]">
                <Layers3 className="h-3.5 w-3.5 text-emerald-300" />
                Modes
              </div>
              <div className="mt-3 space-y-2">
                {LAUNCH_MODES.map((mode) => (
                  <button
                    key={mode.label}
                    type="button"
                    onClick={() => onOpenMode(mode.viewMode, mode.preset, mode.label === "Report Lite" ? "report" : undefined)}
                    className={cn(
                      "group w-full rounded-2xl border bg-gradient-to-br p-3 text-left transition-all duration-200 hover:-translate-y-0.5",
                      ACCENT_CLASS[mode.accent],
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{mode.label}</div>
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                    <div className="mt-1 text-[11px] leading-4 opacity-80">{mode.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto space-y-2">
              <ActionButton icon={<Monitor className="h-4 w-4" />} label="Open Report" description="Jump to the report/export surface." onClick={onOpenReport} />
            </div>
          </aside>

          <section className="flex min-w-0 flex-col gap-4">
            <div className="rounded-[28px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.30)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
                    <Radar className="h-3.5 w-3.5 text-sky-300" />
                    Current Workspace Preview
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{scene.name}</div>
                  <div className="mt-1 text-sm text-[color:var(--st-muted)]">
                    {sceneSummary(scene)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-200">
                    {coverage != null ? `Coverage ${Math.round(coverage)}%` : "Simulation not run yet"}
                  </span>
                  <span className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[color:var(--st-muted)]">
                    {scene.paths.length} paths
                  </span>
                  <span className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[color:var(--st-muted)]">
                    {scene.updatedAt ? `Updated ${formatTime(scene.updatedAt)}` : "Never updated"}
                  </span>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[24px] border border-white/[0.05] bg-black/[0.15]">
                <ScenePreview scene={scene} result={result ?? scene.simulation ?? null} hydrated={hydrated} />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-4">
                <MiniStat label="Coverage" value={coverage != null ? `${Math.round(coverage)}%` : "—"} accent={coverage != null ? coverageTone(coverage) : "text-white"} detail="Walkable scene score" />
                <MiniStat label="Critical Zones" value={`${passCount}/${totalZones}`} accent={passCount === totalZones ? "text-emerald-300" : "text-amber-300"} detail="Passing zones" />
                <MiniStat label="Worst Issue" value={worstIssue ? issueSeverityLabel(worstIssue.severity) : "None"} accent={worstIssue ? "text-red-300" : "text-emerald-300"} detail={worstIssue ? worstIssue.description : "No failures detected"} />
                <MiniStat label="Last Run" value={formatTime(lastRun)} accent="text-sky-200" detail="Computed simulation" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton icon={<MapIcon className="h-4 w-4" />} label="Open Coverage Workspace" description="Enter the analysis workspace directly." onClick={onOpenCoverageWorkspace} className="min-w-[210px] flex-1" />
                <ActionButton icon={<Camera className="h-4 w-4" />} label="Open Camera Wall" description="Review the live feed grid." onClick={onOpenCameraWall} className="min-w-[210px] flex-1" />
                <ActionButton icon={<Play className="h-4 w-4" />} label="Open Path Replay" description="Inspect the replay actor and route." onClick={onOpenPathReplay} className="min-w-[210px] flex-1" />
                <ActionButton icon={<LayoutDashboard className="h-4 w-4" />} label="Compare Fixes" description="Open the before/after comparison view." onClick={onOpenCompareFixes} className="min-w-[210px] flex-1" />
              </div>

              <div className="mt-4 rounded-[24px] border border-sky-400/15 bg-sky-500/8 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
                  <Sparkles className="h-3.5 w-3.5 text-sky-300" />
                  Scene Starter Gallery
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-5">
                      <SceneStarterCard
                        icon={<Plus className="h-4 w-4" />}
                        badge="Blank"
                        tone="blank"
                        title="New Blank Scene"
                        description="Start from an empty scene shell and build your own shop, lobby, or corridor from scratch."
                        hint="Blank canvas"
                        onClick={onCreateScene}
                        variant="primary"
                  />
                      <SceneStarterCard
                        icon={<FileUp className="h-4 w-4" />}
                        badge="Import"
                        tone="import"
                        title="Import SecurityScene JSON"
                        description="Bring in an existing site definition and continue work from a real workspace file."
                        hint="Import a scene"
                        onClick={onImportScene}
                      />
                      <SceneStarterCard
                        icon={<MapIcon className="h-4 w-4" />}
                        badge="Floor Plan"
                        tone="import"
                        title="Import Floor Plan Workflow"
                        description="Dedicated lane: upload floor plan, review extraction summary/warnings, then commit to scene."
                        hint="Plan-first flow"
                        onClick={onImportFloorPlan}
                      />
                      <SceneStarterCard
                        icon={<ScanSearch className="h-4 w-4" />}
                        badge="Scan"
                        tone="scan"
                        title="Scan Site Photo"
                        description="Preview manual-assisted flow: mark walls/doors/cameras/objects on site photo, then compile into editable scene."
                        hint="Photo-assisted"
                        onClick={onScanSite}
                      />
                      <SceneStarterCard
                        icon={<Sparkles className="h-4 w-4" />}
                        badge="AI"
                        tone="ai"
                        title="AI Layout Draft"
                        description="Generate a draft scene from a prompt, then refine it in Studio."
                        hint="Prompt draft"
                        onClick={onAiDraft}
                      />
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_360px]">
              <div className="rounded-[28px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">Project Browser</div>
                    <div className="mt-1 text-sm text-[color:var(--st-muted)]">
                      Search, pin, and reopen your workspaces first. The demo remains available as the reference baseline below.
                    </div>
                  </div>
                  <div className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[color:var(--st-muted)]">
                    {visibleProjectCount} visible of {savedScenes.length} local workspaces
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="flex-1">
                    <span className="sr-only">Search local workspaces</span>
                    <input
                      value={projectQuery}
                      onChange={(event) => setProjectQuery(event.target.value)}
                      placeholder="Search projects, scene names, folders, tags, or counts..."
                      className="w-full rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[color:var(--st-muted)] focus:border-sky-400/35 focus:bg-white/[0.04]"
                    />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ["recent", "Recent"],
                      ["coverage", "Coverage"],
                      ["name", "Name"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setProjectSort(value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                          projectSort === value
                            ? "border-sky-400/30 bg-sky-500/12 text-sky-100"
                            : "border-[color:var(--st-border)] bg-white/[0.03] text-[color:var(--st-muted)] hover:bg-white/[0.05]",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {folderFilters.slice(0, 10).map((folder) => (
                      <button
                        key={folder}
                        type="button"
                        onClick={() => setActiveFolder(folder)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                          activeFolder === folder
                            ? "border-sky-400/30 bg-sky-500/12 text-sky-100"
                            : "border-[color:var(--st-border)] bg-white/[0.03] text-[color:var(--st-muted)] hover:bg-white/[0.05]",
                        )}
                      >
                        {folder} <span className="text-[10px] opacity-70">({folderCounts[folder] ?? browserProjects.length})</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTag("All")}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                        activeTag === "All"
                          ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-100"
                          : "border-[color:var(--st-border)] bg-white/[0.03] text-[color:var(--st-muted)] hover:bg-white/[0.05]",
                      )}
                    >
                      All tags
                    </button>
                    {tagFilters.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setActiveTag(tag)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                          activeTag === tag
                            ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-100"
                            : "border-[color:var(--st-border)] bg-white/[0.03] text-[color:var(--st-muted)] hover:bg-white/[0.05]",
                        )}
                      >
                        {tag} <span className="text-[10px] opacity-70">({tagCounts[tag] ?? 0})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">Your Workspaces</div>
                      <div className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1 text-[10px] text-[color:var(--st-muted)]">
                        {userWorkspaceCount} visible
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-4">
                      <WorkspaceSeedCard
                        icon={<Plus className="h-3.5 w-3.5" />}
                        badge="Blank"
                        tone="blank"
                        title="Blank Workspace"
                        description="Create a new site from scratch and start placing walls, cameras, and zones."
                        onClick={onCreateScene}
                      />
                      <WorkspaceSeedCard
                        icon={<FileUp className="h-3.5 w-3.5" />}
                        badge="Import"
                        tone="import"
                        title="Import Workspace"
                        description="Bring in an existing SecurityScene JSON workspace and continue editing."
                        onClick={onImportScene}
                      />
                      <WorkspaceSeedCard
                        icon={<ScanSearch className="h-3.5 w-3.5" />}
                        badge="Scan"
                        tone="scan"
                        title="Scan Workspace"
                        description="Reconstruct a site from a photo and turn it into an editable scene."
                        onClick={onScanSite}
                      />
                      <WorkspaceSeedCard
                        icon={<Sparkles className="h-3.5 w-3.5" />}
                        badge="AI"
                        tone="ai"
                        title="AI Draft Workspace"
                        description="Generate a draft layout that you can refine inside Studio."
                        onClick={onAiDraft}
                      />
                    </div>
                    <div className="mt-3 grid gap-2">
                      {userWorkspaceProjects.length > 0 ? (
                        userWorkspaceProjects.map((project) => {
                          const saved = project.scene;
                          const savedCoverage = saved.simulation?.totalCoveragePct ?? null;
                          const savedIssues = saved.simulation?.issues.length ?? 0;
                          const savedZones = saved.simulation?.criticalZoneResults.length ?? saved.criticalZones.length;
                          const selected = saved.id === selectedProjectRecord?.scene.id;
                          const isDraftWorkspace = saved.source === "manual";
                          return (
                            <button
                              key={saved.id}
                              type="button"
                              onClick={() => setSelectedProjectId(saved.id)}
                              className={cn(
                                "rounded-[22px] border px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5",
                                selected
                                  ? isDraftWorkspace
                                    ? "border-amber-400/30 bg-amber-500/10 shadow-[0_12px_28px_rgba(245,158,11,0.08)]"
                                    : "border-sky-400/30 bg-sky-500/10 shadow-[0_12px_28px_rgba(14,165,233,0.08)]"
                                  : isDraftWorkspace
                                    ? "border-amber-400/20 bg-amber-500/[0.045] hover:border-amber-400/35 hover:bg-amber-500/[0.065]"
                                    : "border-[color:var(--st-border)] bg-white/[0.025] hover:border-[rgba(79,183,255,0.28)] hover:bg-white/[0.04]",
                              )}
                            >
                              <WorkspaceMiniPreview scene={saved} result={saved.simulation ?? null} hydrated={hydrated} />
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="truncate text-sm font-semibold text-white">{saved.name}</div>
                                    {saved.id === scene.id ? (
                                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-emerald-200">
                                        Current
                                      </span>
                                    ) : null}
                                    {isDraftWorkspace ? (
                                      <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-amber-100">
                                        Draft
                                      </span>
                                    ) : null}
                                    {project.pinned ? (
                                      <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-amber-100">
                                        Pinned
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-[11px] text-[color:var(--st-muted)]">
                                    {sourceLabel(saved)} · Updated {formatTime(project.updatedAt)} · Folder {project.folder}
                                  </div>
                                </div>
                                <div className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
                                  {savedCoverage != null ? `${Math.round(savedCoverage)}%` : "Pending"}
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white">
                                  {countLabel(saved.cameras.length, "camera")}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white">
                                  {countLabel(saved.obstructions.length, "obstruction")}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white">
                                  {countLabel(savedZones, "zone")}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white">
                                  {countLabel(savedIssues, "issue")}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
                                  Folder: {project.folder}
                                </span>
                                {project.tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
                                    #{tag}
                                  </span>
                                ))}
                                {project.tags.length > 3 ? (
                                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
                                    +{project.tags.length - 3} more
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-[color:var(--st-border)] px-4 py-8 text-sm text-[color:var(--st-muted)]">
                          {projectQuery.trim() ? "No saved user workspaces match this search." : "Create, import, or scan a scene to start your own workspace history."}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#1e2536] bg-[#0a0e16] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">Reference Demo</div>
                        <div className="mt-1 text-[11px] text-[color:var(--st-muted)]">
                          The canonical retail demo stays available as a baseline, but it is no longer the main story.
                        </div>
                      </div>
                      <div className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1 text-[10px] text-[color:var(--st-muted)]">
                        {referenceDemoCount} visible
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {referenceDemoProjects.length > 0 ? (
                        referenceDemoProjects.map((project) => {
                          const saved = project.scene;
                          const selected = saved.id === selectedProjectRecord?.scene.id;
                          const savedCoverage = saved.simulation?.totalCoveragePct ?? null;
                          return (
                            <button
                              key={saved.id}
                              type="button"
                              onClick={() => setSelectedProjectId(saved.id)}
                              className={cn(
                                "rounded-[22px] border px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5",
                                selected
                                  ? "border-emerald-400/30 bg-emerald-500/10 shadow-[0_12px_28px_rgba(16,185,129,0.08)]"
                                  : "border-[#2a3244] bg-white/[0.02] hover:border-[rgba(79,183,255,0.24)] hover:bg-white/[0.035]",
                              )}
                            >
                              <WorkspaceMiniPreview scene={saved} result={saved.simulation ?? null} hydrated={hydrated} />
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="truncate text-sm font-semibold text-white">{saved.name}</div>
                                    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-emerald-200">
                                      Demo
                                    </span>
                                  </div>
                                  <div className="mt-1 text-[11px] text-[color:var(--st-muted)]">
                                    Baseline reference · Updated {formatTime(project.updatedAt)} · {sourceLabel(saved)}
                                  </div>
                                </div>
                                <div className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
                                  {savedCoverage != null ? `${Math.round(savedCoverage)}%` : "Pending"}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-[20px] border border-dashed border-[#243047] px-3 py-4 text-sm text-[color:var(--st-muted)]">
                          No demo baseline visible in the current filter set.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
                  <Settings2 className="h-3.5 w-3.5 text-sky-300" />
                  Selected Workspace
                </div>
                {selectedProjectRecord ? (
                  <>
                    <ProjectMetadataEditor key={selectedProjectRecord.scene.id} project={selectedProjectRecord} onUpdateProjectMetadata={onUpdateProjectMetadata} />
                    <div className="mt-4 space-y-2">
                      <ActionButton
                        icon={<FolderOpen className="h-4 w-4" />}
                        label="Open Workspace"
                        description="Load the selected project into Studio."
                        onClick={() => onOpenScene?.(selectedProjectScene)}
                        variant="primary"
                      />
                      <ActionButton
                        icon={<MapIcon className="h-4 w-4" />}
                        label="Open Coverage"
                        description="Open the selected project in the analysis workspace."
                        onClick={() => {
                          onOpenScene?.(selectedProjectScene);
                          onOpenCoverageWorkspace();
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="mt-3 rounded-[22px] border border-dashed border-[color:var(--st-border)] bg-white/[0.02] p-4 text-sm text-[color:var(--st-muted)]">
                    No saved workspace selected. Save the current scene in Studio to manage folders, tags, and pins here.
                  </div>
                )}

                <div className="mt-4">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
                    <Layers3 className="h-3.5 w-3.5 text-emerald-300" />
                    Scene Work
                  </div>
                  <div className="mt-4 space-y-2">
                    <ActionButton icon={<Plus className="h-4 w-4" />} label="New Blank Scene" description="Start from an empty scene shell." onClick={onCreateScene} />
                    <ActionButton icon={<FileUp className="h-4 w-4" />} label="Import SecurityScene JSON" description="Load a canonical scene file." onClick={onImportScene} />
                    <ActionButton icon={<ScanSearch className="h-4 w-4" />} label="Scan Site Photo" description="Preview: manual-assisted photo intake flow." onClick={onScanSite} />
                    <ActionButton icon={<Sparkles className="h-4 w-4" />} label="AI Layout Draft" description="Generate a prompt-backed draft scene." onClick={onAiDraft} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-4 rounded-[28px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
                <TriangleAlert className="h-3.5 w-3.5 text-amber-300" />
                Security Outcome
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">Open Issues</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">Simulation Assumptions</div>
              <SecurityOutcomePanel compact />
              <button
                type="button"
                onClick={onOpenStudio}
                className="mt-3 w-full rounded-2xl border border-sky-400/25 bg-sky-500/12 px-4 py-3 text-sm font-medium text-sky-100 transition-colors hover:border-sky-300/35 hover:bg-sky-500/16"
              >
                Edit in Studio
              </button>
            </div>

            <details className="rounded-2xl border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
                Product feature status
              </summary>
              <div className="mt-3 space-y-2">
                <div className="text-[11px] text-[color:var(--st-muted)]">Last verified {PRODUCT_FEATURE_STATUS_LAST_VERIFIED}</div>
                {featureStatus.slice(0, 4).map((entry) => (
                  <div key={entry.feature} className="flex items-start gap-2 rounded-2xl border border-white/[0.05] bg-white/[0.03] px-3 py-2">
                    <span className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em]",
                      entry.status === "Available"
                        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                        : entry.status === "Preview"
                          ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
                          : "border-slate-400/20 bg-slate-500/10 text-slate-200",
                    )}>
                      {entry.status}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm">{entry.feature}</div>
                      <div className="text-[11px] text-[color:var(--st-muted)]">{entry.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </aside>
        </div>
      </div>
    </main>
  );
}
