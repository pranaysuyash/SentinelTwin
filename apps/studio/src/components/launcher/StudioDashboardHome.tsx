"use client";

import { startTransition, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import {
  ArrowRight,
  Camera,
  ChevronDown,
  Compass,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  FolderOpen,
  LayoutDashboard,
  Layers3,
  Map as MapIcon,
  Play,
  Plus,
  Radar,
  ScanSearch,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Zap,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { getSceneSourceMeta } from "@/lib/scene-source";
import { summarizeWorkspaceAccount, summarizeWorkspaceCatalog } from "@/lib/workspace-catalog";
import { formatWorkspaceBranchLabel, searchWorkspaceMemory, type WorkspaceSearchHit } from "@/lib/workspace-search";
import type { GovernanceArchiveRecord } from "@/lib/governance-archive";
import type { WorkspaceMembershipArchiveRecord } from "@/lib/workspace-membership-types";
import type { WorkspaceIdentityConflictArchiveRecord } from "@/lib/workspace-identity-conflict-types";
import type { SupportDeliveryArchiveRecord } from "@/lib/support-delivery";
import type { SensorIngestArchiveRecord } from "@/lib/sensor-ingest-history";
import type { CameraMetadataArchiveRecord } from "@/lib/camera-metadata-ingest-history";
import type { CameraLiveConnectionArchiveRecord } from "@/lib/camera-live-connection-history";
import type { BottomTab, SavedProjectRecord, TimelineFocusRequest, ViewMode, WorkspacePreset } from "@/store/studio-store";
import { useStudioStore } from "@/store/studio-store";
import { OrganizationManagerPanel } from "@/components/launcher/OrganizationManagerPanel";
import type { SecurityScene, SecurityIssue, SimulationResult, DoriQuality, ScenarioPath, CameraNode, ObstructionNode, SecurityLightNode } from "@/schema/security-scene";
import type { OrganizationList } from "@/schema/organization";
import { MiniStat } from "@/components/shared/MiniStat";
import { QUALITY_COLOR, QUALITY_TEXT_COLOR } from "@/lib/quality-display";
import { QualityBadge } from "@/components/shared/QualityBadge";
import { selectSecurityOutcomeFromStore } from "@/lib/security-outcome/security-outcome-selectors";

type ProjectSort = "recent" | "name" | "coverage";
type ProjectSourceFilter = "All" | SecurityScene["source"];
type StarterTone = "blank" | "import" | "scan" | "ai";
const NAV_ITEMS = [
  { key: "home", label: "Home", detail: "" },
  { key: "projects", label: "Projects", detail: "" },
  { key: "reference_sites", label: "Demo Sites", detail: "" },
  { key: "report", label: "Reports", detail: "" },
  { key: "docs", label: "Docs", detail: "" },
  { key: "settings", label: "Settings", detail: "" },
] as const;

const WORKSPACE_MODE_ITEMS = [
  { key: "coverage", label: "Coverage", detail: "Map & Analysis" },
  { key: "camera_view", label: "Camera View", detail: "Single Camera" },
  { key: "camera_wall", label: "Camera Wall", detail: "Multi Camera" },
  { key: "path_replay", label: "Path Replay", detail: "Route Analysis" },
  { key: "compare", label: "Compare", detail: "Before / After" },
  { key: "report_lite", label: "Report Lite", detail: "Quick Report" },
] as const;

type DashboardSectionId =
  | "overview"
  | "preview"
  | "metrics"
  | "workspaces"
  | "recent"
  | "create"
  | "library"
  | "securityStatus"
  | "issues"
  | "assumptions";

const DASHBOARD_SECTION_ITEMS: { id: DashboardSectionId; label: string; group: string }[] = [
  { id: "overview", label: "Current site twin", group: "Main" },
  { id: "preview", label: "Map preview", group: "Main" },
  { id: "metrics", label: "Summary metrics", group: "Main" },
  { id: "workspaces", label: "Workspace shortcuts", group: "Main" },
  { id: "recent", label: "Recent site twins", group: "Main" },
  { id: "create", label: "Create and import", group: "Main" },
  { id: "library", label: "Workspace library", group: "Main" },
  { id: "securityStatus", label: "Security status", group: "Side panel" },
  { id: "issues", label: "Open issues", group: "Side panel" },
  { id: "assumptions", label: "Simulation assumptions", group: "Side panel" },
];

const DEFAULT_DASHBOARD_VISIBILITY: Record<DashboardSectionId, boolean> = {
  overview: true,
  preview: true,
  metrics: false,
  workspaces: false,
  recent: true,
  create: true,
  library: false,
  securityStatus: true,
  issues: true,
  assumptions: true,
};

const SOURCE_LABELS: Record<SecurityScene["source"], string> = {
  manual: "Draft",
  ai: "Layout Draft",
  scan: "Scan",
  import: "Import",
  preset: "Preset",
  demo: "Reference",
};

const ISSUE_SEVERITY_ORDER: Record<SecurityIssue["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type IssueSeverity = keyof typeof ISSUE_SEVERITY_ORDER;

function getDemoWorkspaceTitle(scene: SecurityScene, index: number) {
  if (scene.source !== "demo") return scene.name;
  const coverage = scene.simulation?.totalCoveragePct ?? 0;
  const haystack = scene.name.toLowerCase();
  if (haystack.includes("obstruction") || coverage === 77) return "Demo: Obstruction Stress Test";
  if (haystack.includes("rotated") || coverage === 80) return "Demo: Camera Rotation Test";
  if (haystack.includes("night") || coverage === 81) return "Demo: Night Lighting Test";
  if (index === 1) return "Demo: Obstruction Stress Test";
  if (index === 2) return "Demo: Camera Rotation Test";
  if (index === 3) return "Demo: Night Lighting Test";
  return "Demo: Retail Baseline";
}

function getDemoWorkspaceDetail(scene: SecurityScene, fallbackDetail: string, index: number) {
  if (scene.source !== "demo") return fallbackDetail;
  const title = getDemoWorkspaceTitle(scene, index);
  if (title.includes("Obstruction")) return "Shelf or fixture obstruction changes recognition coverage and issue count.";
  if (title.includes("Rotation")) return "Small camera aim changes shift the floor risk map.";
  if (title.includes("Night")) return "Lighting and shadows change which cells remain useful evidence.";
  return "Reference retail layout with cameras, zones, paths, lights, and coverage scores.";
}

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

function issueSeverityTone(severity: SecurityIssue["severity"]) {
  switch (severity) {
    case "critical":
      return "text-red-300";
    case "high":
      return "text-orange-300";
    case "medium":
      return "text-amber-300";
    default:
      return "text-sky-300";
  }
}

const DORI_QUALITY_ORDER: Record<DoriQuality, number> = {
  none: 0,
  detection: 1,
  observation: 2,
  recognition: 3,
  identification: 4,
  overview: 5,
  outline: 6,
  discern: 7,
  perceive: 8,
  characterize: 9,
  validate: 10,
  scrutinize: 11,
};

function formatDoriStandard(standard: "dori_2014" | "oodpcvs_2025" | (string & {})) {
  return standard === "oodpcvs_2025" ? "OODPCVS (7-level)" : "Simplified PPM";
}

function qualityToLabel(quality: DoriQuality) {
  if (quality === "identification") return "Identification";
  if (quality === "recognition") return "Recognition";
  return quality === "observation"
    ? "Observation"
    : quality === "detection"
      ? "Detection"
      : quality[0]!.toUpperCase() + quality.slice(1);
}

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
  simulationRunning: boolean;
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
  onStartProject: () => void;
  onOpenAdvancedWorkflows?: () => void;
  onCreateScene: () => void;
  onImportFloorPlan: () => void;
  onImportScene: () => void;
  onScanSite: () => void;
  onGuidedScanAssistant?: () => void;
  onAiDraft: () => void;
  onOpenDemoScene?: () => void;
  onOpenReport: () => void;
  onOpenScene?: (scene: SecurityScene) => void;
  onOpenSiteIntake?: () => void;
  onOpenReferenceSites?: () => void;
  onOpenSettings?: () => void;
  onUpdateProjectMetadata: (sceneId: string, patch: Partial<Pick<SavedProjectRecord, "folder" | "tags" | "pinned" | "workspaceOrganization" | "workspaceOwner" | "workspaceVisibility" | "lastOpenedAt">>) => void;
  onDuplicateProject: (sceneId: string) => SavedProjectRecord | null;
  onRenameProject: (sceneId: string, nextName: string) => SavedProjectRecord | null;
  onOpenMode: (viewMode: ViewMode, preset: WorkspacePreset, bottomTab?: BottomTab) => void;
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

function formatTimelineQueryDate(ts: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

function formatWorkspaceMemoryFocusQuery(ts: number, branchLabel?: string | null) {
  const after = `after:${formatTimelineQueryDate(ts)}`;
  return branchLabel ? `branch:${branchLabel} ${after}` : after;
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
    countLabel(scene.paths.length, "path"),
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
  const activePathId = useStudioStore((s) => s.activePathId);
  const activePath = activePathId ? (scene.paths.find((path) => path.id === activePathId) ?? null) : null;
  const activePathStart = activePath ? toPoint(activePath.points[0].position) : null;
  const activePathEnd = activePath ? toPoint(activePath.points[activePath.points.length - 1].position) : null;
  const heatmapCells = result?.coverageCells ?? [];
  const heatmapStep = Math.max(1, Math.ceil(heatmapCells.length / (compact ? 150 : 240)));
  const cellSize = Math.max(2.6, scale * (compact ? 0.26 : 0.22));
  const activePathPoints = pathPolyline(activePath ?? undefined, toPoint);

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
            <div className="mt-1 text-[11px] text-[color:var(--st-muted)]">Preparing site twin · Run simulation for coverage data</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative overflow-hidden rounded-[28px] border border-[color:var(--st-border)] bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.11),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.09),transparent_30%),linear-gradient(180deg,rgba(11,14,21,0.98),rgba(11,14,21,0.86))]",
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
          <div className="contents">
            <polyline points={activePathPoints} fill="none" stroke="rgba(34,197,94,0.9)" strokeWidth="3" strokeDasharray="6 6" />
            {activePathStart ? (
              <circle cx={activePathStart[0]} cy={activePathStart[1]} r="6.5" fill="rgba(34,197,94,0.95)" />
            ) : null}
            {activePathEnd ? (
              <circle cx={activePathEnd[0]} cy={activePathEnd[1]} r="6.5" fill="rgba(248,113,113,0.95)" />
            ) : null}
          </div>
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
            Scene loaded
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
        "group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-[transform,border-color,box-shadow,background-color] duration-200 hover:-translate-y-0.5",
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

function HideSectionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-[color:var(--st-border)] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-[color:var(--st-muted)] transition-colors hover:border-sky-400/35 hover:text-white"
      aria-label={`Hide ${label}`}
      title={`Hide ${label}`}
    >
      <EyeOff className="h-3 w-3" />
      Hide
    </button>
  );
}

function DashboardOpenHint({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: { id: DashboardSectionId; label: string; onClick: () => void }[];
}) {
  return (
    <section className="rounded-[20px] border border-dashed border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-200">{title}</div>
      <div className="mt-1 max-w-2xl text-xs leading-5 text-[color:var(--st-muted)]">{description}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-100 transition-colors hover:border-sky-300/40 hover:bg-sky-500/16"
          >
            <Eye className="h-3 w-3" />
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function LaunchStatusRow({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "amber" | "sky" | "violet";
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: "border-emerald-400/18 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-400/18 bg-amber-500/10 text-amber-100",
    sky: "border-sky-400/18 bg-sky-500/10 text-sky-100",
    violet: "border-violet-400/18 bg-violet-500/10 text-violet-100",
  };

  return (
    <div className={cn("rounded-2xl border px-3 py-2", toneClasses[tone])}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">{label}</div>
        <div className="text-[11px] font-semibold text-white">{value}</div>
      </div>
      <div className="mt-1 text-[11px] leading-4 text-white/75">{detail}</div>
    </div>
  );
}

function SceneStarterCard({
  icon,
  title,
  description,
  hint,
  badge,
  status,
  ctaLabel = "Start",
  tone,
  onClick,
  variant = "secondary",
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  hint: string;
  badge: string;
  status?: string;
  ctaLabel?: string;
  tone: StarterTone;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-h-[136px] flex-col justify-between rounded-[24px] border p-4 text-left transition-[transform,border-color,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(0,0,0,0.18)]",
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
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">
            <span className="text-[color:var(--st-accent)]">{icon}</span>
            <span>{badge}</span>
            {status ? (
              <span className="whitespace-nowrap rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                {status}
              </span>
            ) : null}
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
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--st-muted)]">{ctaLabel}</span>
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
      className="group flex min-h-[92px] flex-col justify-between rounded-[20px] border border-[color:var(--st-border)] bg-white/[0.03] p-3 text-left transition-[transform,border-color,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:border-[rgba(79,183,255,0.35)] hover:bg-[color:var(--st-panel-2)]"
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

function ProjectMetadataEditor({
  project,
  onUpdateProjectMetadata,
  onDuplicateProject,
  onRenameProject,
  onSelectProject,
  organizations,
}: {
  project: SavedProjectRecord;
  onUpdateProjectMetadata: StudioDashboardHomeProps["onUpdateProjectMetadata"];
  onDuplicateProject: StudioDashboardHomeProps["onDuplicateProject"];
  onRenameProject: StudioDashboardHomeProps["onRenameProject"];
  onSelectProject: (sceneId: string) => void;
  organizations: OrganizationList;
}) {
  const [folderDraft, setFolderDraft] = useState(project.folder);
  const [tagDraft, setTagDraft] = useState(project.tags.join(", "));
  const [organizationDraft, setOrganizationDraft] = useState(project.workspaceOrganization);
  const [ownerDraft, setOwnerDraft] = useState(project.workspaceOwner);
  const [visibilityDraft, setVisibilityDraft] = useState<SavedProjectRecord["workspaceVisibility"]>(project.workspaceVisibility);

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

  const applyOrganizationDraft = () => {
    onUpdateProjectMetadata(project.scene.id, { workspaceOrganization: organizationDraft.trim() || "Personal Workspace" });
  };

  const applyOwnerDraft = () => {
    onUpdateProjectMetadata(project.scene.id, { workspaceOwner: ownerDraft.trim() || "You" });
  };

  const applyVisibilityDraft = (nextVisibility: SavedProjectRecord["workspaceVisibility"]) => {
    setVisibilityDraft(nextVisibility);
    onUpdateProjectMetadata(project.scene.id, { workspaceVisibility: nextVisibility });
  };

  const duplicateWorkspace = () => {
    const duplicate = onDuplicateProject(project.scene.id);
    if (duplicate) {
      onSelectProject(duplicate.scene.id);
    }
  };

  const renameWorkspace = () => {
    if (project.scene.source === "demo") return;
    const nextName = window.prompt("Rename workspace", project.scene.name);
    if (nextName == null) return;
    onRenameProject(project.scene.id, nextName);
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
                  ? "Reference baseline"
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
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
            Org: {organizationDraft}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
            Owner: {ownerDraft}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[color:var(--st-muted)]">
            {visibilityDraft}
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
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={duplicateWorkspace}
            className="rounded-full border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-[color:var(--st-muted)] transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            Duplicate Workspace
          </button>
          <button
            type="button"
            onClick={renameWorkspace}
            disabled={project.scene.source === "demo"}
            title={project.scene.source === "demo" ? "Duplicate the reference baseline first to rename it." : "Rename workspace"}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
              project.scene.source === "demo"
                ? "border-[color:var(--st-border)] bg-white/[0.02] text-[color:var(--st-muted)] opacity-60"
                : "border-[color:var(--st-border)] bg-white/[0.03] text-[color:var(--st-muted)] hover:bg-white/[0.05] hover:text-white",
            )}
          >
            Rename Workspace
          </button>
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

          <label className="block">
            <span className="text-[11px] text-[color:var(--st-muted)]">Organization</span>
            <div className="relative mt-1">
              <select
                value={organizationDraft}
                onChange={(event) => {
                  setOrganizationDraft(event.target.value);
                  applyOrganizationDraft();
                }}
                className="w-full appearance-none rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 pr-8 text-sm text-white outline-none transition-colors focus:border-sky-400/35 focus:bg-white/[0.04]"
              >
                {organizations?.length > 0 ? (
                  organizations.map((org) => (
                    <option key={org.id} value={org.name} className="bg-[#0b0f17] text-white">
                      {org.name}
                    </option>
                  ))
                ) : (
                  <option value="Personal Workspace" className="bg-[#0b0f17] text-white">Personal Workspace</option>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--st-muted)]" />
            </div>
          </label>

          <label className="block">
            <span className="text-[11px] text-[color:var(--st-muted)]">Owner</span>
            <input
              value={ownerDraft}
              onChange={(event) => setOwnerDraft(event.target.value)}
              onBlur={applyOwnerDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyOwnerDraft();
                }
              }}
              className="mt-1 w-full rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-[color:var(--st-muted)] focus:border-sky-400/35 focus:bg-white/[0.04]"
              placeholder="You"
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-[color:var(--st-muted)]">Visibility</span>
            <select
              value={visibilityDraft}
              onChange={(event) => applyVisibilityDraft(event.target.value as SavedProjectRecord["workspaceVisibility"])}
              className="mt-1 w-full rounded-2xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-sky-400/35 focus:bg-white/[0.04]"
            >
              <option value="private">Private</option>
              <option value="shared">Shared</option>
              <option value="published">Published</option>
            </select>
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
  simulationRunning,
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
  onOpenAdvancedWorkflows,
  onCreateScene,
  onImportFloorPlan,
  onImportScene,
  onScanSite,
  onGuidedScanAssistant,
  onAiDraft,
  onOpenReport,
  onOpenDemoScene,
  onOpenScene,
  onOpenSiteIntake,
  onOpenReferenceSites,
  onOpenSettings,
  onUpdateProjectMetadata,
  onDuplicateProject,
  onRenameProject,
  onOpenMode,
}: StudioDashboardHomeProps) {
  const [hydrated, setHydrated] = useState(false);
  const [showWorkspaceLibrary, setShowWorkspaceLibrary] = useState(false);
  const [activeLauncherNav, setActiveLauncherNav] = useState<(typeof NAV_ITEMS)[number]["key"]>("home");
  const [activeSource, setActiveSource] = useState<ProjectSourceFilter>("All");
  const [activeFolder, setActiveFolder] = useState<string>("All");
  const [activeTag, setActiveTag] = useState<string>("All");
  const [previewMode, setPreviewMode] = useState<"2d" | "3d">("2d");
  const [footerPanel, setFooterPanel] = useState<"feedback" | "help" | null>(null);
  const [dashboardViewMenuOpen, setDashboardViewMenuOpen] = useState(false);
  const [dashboardVisibility, setDashboardVisibility] = useState(DEFAULT_DASHBOARD_VISIBILITY);
  const isDashboardSectionVisible = (id: DashboardSectionId) => dashboardVisibility[id];
  const setDashboardSectionVisible = (id: DashboardSectionId, visible: boolean) => {
    setDashboardVisibility((current) => ({ ...current, [id]: visible }));
  };
  const hiddenDashboardCount = DASHBOARD_SECTION_ITEMS.filter((item) => !dashboardVisibility[item.id]).length;
  const shownDashboardCount = DASHBOARD_SECTION_ITEMS.length - hiddenDashboardCount;
  const hasMainDashboardPanel = (
    dashboardVisibility.overview
    || dashboardVisibility.preview
    || dashboardVisibility.metrics
    || dashboardVisibility.workspaces
    || dashboardVisibility.recent
    || dashboardVisibility.create
    || (showWorkspaceLibrary && dashboardVisibility.library)
  );
  const openLauncherHome = () => {
    setActiveLauncherNav("home");
    setShowWorkspaceLibrary(false);
    setActiveSource("All");
    setActiveFolder("All");
    setActiveTag("All");
    setDashboardVisibility({
      ...DEFAULT_DASHBOARD_VISIBILITY,
      overview: true,
      preview: true,
      recent: true,
      create: true,
      library: false,
    });
  };
  const openProjectsLibrary = () => {
    setActiveLauncherNav("projects");
    setShowWorkspaceLibrary(true);
    setActiveSource("All");
    setActiveFolder("All");
    setActiveTag("All");
    setDashboardVisibility((current) => ({
      ...current,
      overview: false,
      preview: false,
      metrics: true,
      recent: true,
      create: false,
      library: true,
    }));
  };
  const openDemoLibrary = () => {
    setActiveLauncherNav("reference_sites");
    setShowWorkspaceLibrary(true);
    setActiveSource("demo");
    setActiveFolder("All");
    setActiveTag("All");
    setDashboardVisibility((current) => ({
      ...current,
      overview: false,
      preview: false,
      metrics: true,
      recent: true,
      create: false,
      library: true,
    }));
  };
  const navActionByKey: Record<(typeof NAV_ITEMS)[number]["key"], (() => void) | undefined> = {
    home: openLauncherHome,
    projects: openProjectsLibrary,
    report: () => {
      setActiveLauncherNav("report");
      onOpenReport?.();
    },
    docs: () => {
      setActiveLauncherNav("docs");
      onOpenReport?.();
    },
    reference_sites: openDemoLibrary,
    settings: () => {
      setActiveLauncherNav("settings");
      onOpenSettings?.();
    },
  };
  const modeActionByKey: Record<(typeof WORKSPACE_MODE_ITEMS)[number]["key"], (() => void) | undefined> = {
    coverage: onOpenCoverageWorkspace,
    camera_view: () => onOpenMode("camera_view", "focus"),
    camera_wall: onOpenCameraWall,
    path_replay: onOpenPathReplay,
    compare: onOpenCompareFixes,
    report_lite: onOpenReport,
  };
  const openSiteIntakeFromFooter = onOpenSiteIntake ?? onOpenAdvancedWorkflows ?? onOpenStudio;
  const openReferenceSitesFromFooter = onOpenReferenceSites ?? onOpenDemoScene ?? onOpenStudio;
  const openSettingsFromFooter = onOpenSettings ?? onOpenStudio;
  const coverage = result?.totalCoveragePct ?? scene.simulation?.totalCoveragePct ?? null;
  const displayCoverage = hydrated ? coverage : null;
  const criticalZoneResults = result?.criticalZoneResults ?? scene.simulation?.criticalZoneResults ?? [];
  const criticalZoneResultMap = criticalZoneStatusMap(result ?? scene.simulation ?? null);
  const hasZoneResults = criticalZoneResults.length > 0;
  const topCriticalZone = criticalZoneResults.length > 0 ? criticalZoneResults.reduce((acc, zone) => {
    if (!acc) return zone;
    return DORI_QUALITY_ORDER[zone.actualQuality] < DORI_QUALITY_ORDER[acc.actualQuality] ? zone : acc;
  }, criticalZoneResults[0]) ?? null : null;
  const worstQualityLabel = topCriticalZone ? qualityToLabel(topCriticalZone.actualQuality) : null;
  const worstQualityValue = topCriticalZone?.actualQuality ?? null;
  const outcomeActivePathId = useStudioStore((s) => s.activePathId);
  const canonicalOutcome = selectSecurityOutcomeFromStore({ scene, simulationResult: result, activePathId: outcomeActivePathId });
  const passCount = canonicalOutcome.summary.criticalZonesPassing;
  const totalZones = canonicalOutcome.summary.criticalZonesTotal || scene.criticalZones.length;
  const cameraFailureZones = scene.criticalZones
    .map((zone) => ({
      zone,
      result: criticalZoneResultMap.get(zone.id),
    }))
    .filter((entry) => {
      const mapResult = entry.result;
      return Boolean(
        mapResult
        && entry.zone.redundancyRequired
        && mapResult.redundancyCameraCount < 2,
      );
    });
  const setTimelineFocusRequest = useStudioStore((s) => s.setTimelineFocusRequest);
  const advancedStarterActions = [
    {
      icon: <Plus className="h-4 w-4" />,
      label: "New Blank Site",
      detail: "Available",
      description: "Start from an empty site twin.",
      onClick: onCreateScene,
    },
    {
      icon: <FileUp className="h-4 w-4" />,
      label: "Import Site Twin Data",
      detail: "Available",
      description: "Load an exported site twin file.",
      onClick: onImportScene,
    },
    {
      icon: <ScanSearch className="h-4 w-4" />,
      label: "Scan a Site",
      detail: "Preview / Guided marking",
      description: "Guided photo marking creates an editable site twin draft.",
      onClick: onScanSite,
    },
    {
      icon: <MapIcon className="h-4 w-4" />,
      label: "Import Floor Plan",
      detail: "Preview",
      description: "Upload plan image/PDF to create editable site geometry.",
      onClick: onImportFloorPlan,
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      label: "Guided Scan Assistant",
      detail: "Preview / Guided marking",
      description: "Guided site photo intake with review checkpoints before draft creation.",
      onClick: onGuidedScanAssistant ?? onScanSite,
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      label: "Site Layout Draft",
      detail: "Preview",
      description: "Create a draft site twin from a description, then review before use.",
      onClick: onAiDraft,
    },
  ];
  const redundancyRequiredZones = scene.criticalZones.filter((zone) => zone.redundancyRequired);
  const redundancyCount = redundancyRequiredZones.length;
  const redundancyFailCount = cameraFailureZones.length;
  const redundancyValue = !hasZoneResults
    ? "Needs check"
    : redundancyCount === 0
      ? "Not set"
      : redundancyFailCount > 0
        ? `${redundancyCount - redundancyFailCount}/${redundancyCount}`
        : `${redundancyCount}`;
  const redundancyDetail = !hasZoneResults
    ? "Run simulation to evaluate redundancy"
    : redundancyCount === 0
      ? "No redundancy-required zones"
      : redundancyFailCount > 0
        ? "Some redundancy paths fail if a camera drops"
        : "Redundancy coverage intact";
  const issues = [...(result?.issues ?? scene.simulation?.issues ?? [])].sort((a, b) => ISSUE_SEVERITY_ORDER[a.severity] - ISSUE_SEVERITY_ORDER[b.severity]);
  const displayPassCount = hydrated ? passCount : 0;
  const displayTotalZones = hydrated ? totalZones : scene.criticalZones.length;
  const displayWorstQualityLabel = hydrated ? worstQualityLabel : null;
  const displayWorstQualityValue = hydrated ? worstQualityValue : null;
  const displayIssues = hydrated ? issues : [];
  const displayRedundancyFailCount = hydrated ? redundancyFailCount : 0;
  const displayRedundancyCount = hydrated ? redundancyCount : 0;
  const hasSideDashboardPanel = (
    dashboardVisibility.securityStatus
    || dashboardVisibility.issues
    || dashboardVisibility.assumptions
  );
  const worstIssue = issues[0] ?? canonicalOutcome.summary.worstIssue ?? null;
  const displayWorstIssue = hydrated ? worstIssue : null;
  const displayOutcomeStatus = hydrated ? canonicalOutcome.summary.status.replace(/_/g, " ") : "not run";
  const displayPrimaryRisk = hydrated
    ? (canonicalOutcome.summary.primaryRisk ?? "Run baseline simulation to compute primary risk.")
    : "Run baseline simulation to compute primary risk.";
  const issuesBySeverity: Record<IssueSeverity, SecurityIssue[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const issue of issues) {
    issuesBySeverity[issue.severity].push(issue);
  }
  const topObstructionIssue = issues.find((issue) =>
    issue.description.toLowerCase().includes("block")
    || issue.description.toLowerCase().includes("obstruct")
    || issue.description.toLowerCase().includes("blind spot"),
  );
  const outcomeSummary = useMemo(() => {
    const zoneMap = hydrated ? criticalZoneStatusMap(result ?? scene.simulation ?? null) : new Map();
    return scene.criticalZones.slice(0, 3).map((zone) => {
      const resultEntry = zoneMap.get(zone.id);
      return {
        id: zone.id,
        label: zone.label,
        required: zone.requiredQuality,
        status: resultEntry?.status ?? "not-computed",
        actual: resultEntry?.actualQuality ?? "none",
      };
    });
  }, [hydrated, scene.criticalZones, result, scene.simulation]);
  const sceneAssumptions = scene.assumptions;
  const sceneAssumptionRows = useMemo(
    () => [
      { label: "DORI Model", value: formatDoriStandard(sceneAssumptions.doriStandard) },
      { label: "Person Height", value: `${sceneAssumptions.personHeightM} m` },
      {
        label: sceneAssumptions.timeOfDay === "night" ? "Night Mode" : sceneAssumptions.timeOfDay === "custom" ? "Custom Mode" : "Day Mode",
        value: sceneAssumptions.timeOfDay === "day" ? "Day mode assumptions" : sceneAssumptions.timeOfDay === "night" ? "Night mode assumptions" : "Custom assumptions",
      },
      {
        label: "Grid Resolution",
        value: `${sceneAssumptions.pixelsPerMeter.detection} / ${sceneAssumptions.pixelsPerMeter.observation} / ${sceneAssumptions.pixelsPerMeter.recognition} / ${sceneAssumptions.pixelsPerMeter.identification} PPM`,
      },
      { label: "Glass Handling", value: sceneAssumptions.nightPenaltyMode === "none" ? "Standard" : "Adjusted for reduced transmission" },
    ],
    [sceneAssumptions],
  );
  const [projectQuery, setProjectQuery] = useState("");
  const [projectSort, setProjectSort] = useState<ProjectSort>("recent");
  const [workspaceMemoryQuery, setWorkspaceMemoryQuery] = useState("");
  const [governanceArchiveHistory, setGovernanceArchiveHistory] = useState<GovernanceArchiveRecord[]>([]);
  const [workspaceMembershipArchiveHistory, setWorkspaceMembershipArchiveHistory] = useState<WorkspaceMembershipArchiveRecord[]>([]);
  const [workspaceIdentityConflictHistory, setWorkspaceIdentityConflictHistory] = useState<WorkspaceIdentityConflictArchiveRecord[]>([]);
  const [supportDeliveryHistory, setSupportDeliveryHistory] = useState<SupportDeliveryArchiveRecord[]>([]);
  const [sensorIngestHistory, setSensorIngestHistory] = useState<SensorIngestArchiveRecord[]>([]);
  const [cameraMetadataHistory, setCameraMetadataHistory] = useState<CameraMetadataArchiveRecord[]>([]);
  const [cameraLiveConnectionHistory, setCameraLiveConnectionHistory] = useState<CameraLiveConnectionArchiveRecord[]>([]);
  const operationalEvidenceArchiveHistory = useStudioStore((s) => s.operationalEvidenceArchiveHistory);
  const workspaceAccountProfile = useStudioStore((s) => s.workspaceAccount);
  const setWorkspaceAccountProfile = useStudioStore((s) => s.setWorkspaceAccountProfile);
  const resetWorkspaceAccountProfile = useStudioStore((s) => s.resetWorkspaceAccountProfile);
  const organizations = useStudioStore((s) => s.organizations);
  const activeOrganizationId = useStudioStore((s) => s.activeOrganizationId);
  const setActiveOrganization = useStudioStore((s) => s.setActiveOrganization);
  const [showOrgManager, setShowOrgManager] = useState(false);
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
  const workspaceCatalog = useMemo(
    () => summarizeWorkspaceCatalog(savedProjects, selectedProjectRecord?.scene.id ?? scene.id),
    [savedProjects, scene.id, selectedProjectRecord?.scene.id],
  );
  const workspaceAccountSummary = useMemo(
    () => summarizeWorkspaceAccount(savedProjects, selectedProjectRecord?.scene.id ?? scene.id, workspaceAccountProfile),
    [savedProjects, scene.id, selectedProjectRecord?.scene.id, workspaceAccountProfile],
  );
  const workspaceMemoryResults = useMemo(
    () => searchWorkspaceMemory(workspaceMemoryQuery, {
      currentScene: scene,
      currentResult: result,
      savedProjects,
      archives: {
        governanceArchiveHistory,
        workspaceMembershipArchiveHistory,
        workspaceIdentityConflictHistory,
        supportDeliveryHistory,
        operationalEvidenceArchiveHistory,
        sensorIngestHistory,
        cameraMetadataHistory,
        cameraLiveConnectionHistory,
      },
      maxResults: 8,
    }),
    [
      cameraLiveConnectionHistory,
      cameraMetadataHistory,
      governanceArchiveHistory,
      operationalEvidenceArchiveHistory,
      result,
      scene,
      savedProjects,
      sensorIngestHistory,
      supportDeliveryHistory,
      workspaceIdentityConflictHistory,
      workspaceMembershipArchiveHistory,
      workspaceMemoryQuery,
    ],
  );
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/governance-archive");
        if (response.ok) {
          const payload = await response.json() as { history?: GovernanceArchiveRecord[] };
          setGovernanceArchiveHistory(payload.history ?? []);
        }
      } catch {
        setGovernanceArchiveHistory([]);
      }
      try {
        const response = await fetch("/api/workspace-membership-archive");
        if (response.ok) {
          const payload = await response.json() as { history?: WorkspaceMembershipArchiveRecord[] };
          setWorkspaceMembershipArchiveHistory(payload.history ?? []);
        }
      } catch {
        setWorkspaceMembershipArchiveHistory([]);
      }
      try {
        const response = await fetch("/api/workspace-identity-conflict");
        if (response.ok) {
          const payload = await response.json() as { history?: WorkspaceIdentityConflictArchiveRecord[] };
          setWorkspaceIdentityConflictHistory(payload.history ?? []);
        }
      } catch {
        setWorkspaceIdentityConflictHistory([]);
      }
      try {
        const response = await fetch("/api/support-delivery");
        if (response.ok) {
          const payload = await response.json() as { history?: SupportDeliveryArchiveRecord[] };
          setSupportDeliveryHistory(payload.history ?? []);
        }
      } catch {
        setSupportDeliveryHistory([]);
      }
      try {
        const response = await fetch("/api/sensor-ingest");
        if (response.ok) {
          const payload = await response.json() as { history?: SensorIngestArchiveRecord[] };
          setSensorIngestHistory(payload.history ?? []);
        }
      } catch {
        setSensorIngestHistory([]);
      }
      try {
        const response = await fetch("/api/camera-metadata-ingest");
        if (response.ok) {
          const payload = await response.json() as { history?: CameraMetadataArchiveRecord[] };
          setCameraMetadataHistory(payload.history ?? []);
        }
      } catch {
        setCameraMetadataHistory([]);
      }
      try {
        const response = await fetch("/api/camera-live-connection");
        if (response.ok) {
          const payload = await response.json() as { history?: CameraLiveConnectionArchiveRecord[] };
          setCameraLiveConnectionHistory(payload.history ?? []);
        }
      } catch {
        setCameraLiveConnectionHistory([]);
      }
    })();
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      setHydrated(true);
    });
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    startTransition(() => {
      setShowWorkspaceLibrary(new URLSearchParams(window.location.search).has("library"));
    });
  }, []);
  const folderCounts = useMemo(() => {
    return browserProjects.reduce<Record<string, number>>((acc, project) => {
      acc[project.folder] = (acc[project.folder] ?? 0) + 1;
      return acc;
    }, {});
  }, [browserProjects]);
  const sourceCounts = useMemo(() => {
    return browserProjects.reduce<Record<ProjectSourceFilter, number>>((acc, project) => {
      const source = project.scene.source;
      acc[source] = (acc[source] ?? 0) + 1;
      return acc;
    }, { All: browserProjects.length } as Record<ProjectSourceFilter, number>);
  }, [browserProjects]);
  const tagCounts = useMemo(() => {
    return browserProjects.reduce<Record<string, number>>((acc, project) => {
      project.tags.forEach((tag) => {
        acc[tag] = (acc[tag] ?? 0) + 1;
      });
      return acc;
    }, {});
  }, [browserProjects]);
  const sourceFilters = useMemo(
    () => {
      const sources = Object.keys(sourceCounts).filter((source) => source !== "All") as SecurityScene["source"][];
      return ["All", ...sources.sort((a, b) => sourceCounts[b] - sourceCounts[a] || SOURCE_LABELS[a].localeCompare(SOURCE_LABELS[b]))] as ProjectSourceFilter[];
    },
    [sourceCounts],
  );
  const folderFilters = ["All", ...Object.keys(folderCounts).sort((a, b) => folderCounts[b] - folderCounts[a] || a.localeCompare(b))];
  const filteredProjects = useMemo(
    () => {
      return browserProjects.filter((project) => activeSource === "All" || project.scene.source === activeSource);
    },
    [activeSource, browserProjects],
  );
  const featuredProjects = useMemo(() => {
    return filteredProjects.slice(0, 8);
  }, [filteredProjects]);
  const tagFilters = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b)).slice(0, 8);
  const statusLabel = simulationRunning
    ? "Running"
    : coverage == null
      ? "Baseline required"
      : simulationDirty
        ? "Needs recompute"
        : "Up to date";
  const statusTone = simulationRunning
    ? "border-cyan-400/25 bg-cyan-500/10 text-cyan-200"
    : coverage == null
      ? "border-slate-400/20 bg-slate-500/10 text-slate-200"
      : simulationDirty
        ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
        : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  const displayStatusLabel = hydrated ? statusLabel : "Baseline required";
  const displayStatusTone = hydrated ? statusTone : "border-slate-400/20 bg-slate-500/10 text-slate-200";
  const visibleProjects = browserProjects.filter((project) => {
    const sourceMatch = activeSource === "All" || project.scene.source === activeSource;
    const folderMatch = activeFolder === "All" || project.folder === activeFolder;
    const tagMatch = activeTag === "All" || project.tags.includes(activeTag);
    return sourceMatch && folderMatch && tagMatch;
  });
  const userWorkspaceProjects = visibleProjects.filter((project) => project.scene.source !== "demo");
  const referenceDemoProjects = visibleProjects.filter((project) => project.scene.source === "demo");
  const headerAssumptions = scene.assumptions;
  const lastRun = result?.computedAt ?? scene.simulation?.computedAt ?? null;
  const lastRunLabel = lastRun ? formatTime(lastRun) : "Not yet simulated";
  const lastRunDetail = lastRun ? "Computed simulation" : "Run simulation for coverage data";
  const visibleProjectCount = visibleProjects.length;
  const userWorkspaceCount = userWorkspaceProjects.length;
  const referenceDemoCount = referenceDemoProjects.length;
  const compactRecentProjects =
    visibleProjects.length > 0
      ? visibleProjects.slice(0, 4)
      : [{
        scene,
        folder: "Current",
        tags: [],
        pinned: true,
        workspaceOrganization: "Personal Workspace",
        workspaceOwner: "You",
        workspaceVisibility: "private",
        createdAt: scene.createdAt,
        updatedAt: scene.updatedAt,
        lastOpenedAt: null,
      } satisfies SavedProjectRecord];
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
    <main className="relative h-screen overflow-y-auto overflow-x-hidden bg-[color:var(--st-bg)] text-[color:var(--st-text)]" style={rootStyle}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.12),transparent_30%),radial-gradient(circle_at_80%_8%,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.06),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="relative z-10 flex min-h-full flex-col gap-4 p-4 lg:p-5">
        <header className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[color:var(--st-border)] bg-[rgba(9,14,23,0.94)] px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.34)]">
          <div className="flex min-w-[260px] items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold tracking-tight text-white">SentinelTwin Studio</div>
              <div className="truncate text-[12px] text-[color:var(--st-muted)]">Security Simulation Workspace</div>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenStudio}
              className="inline-flex max-w-[260px] items-center gap-2 rounded-xl border border-[color:var(--st-border)] bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-white transition-colors hover:border-sky-400/30 hover:bg-white/[0.06]"
              title="Current active Site Twin"
              aria-label={`Open current Site Twin in Studio: ${scene.name}`}
            >
              <span className="truncate">{scene.name}</span>
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span suppressHydrationWarning>{displayStatusLabel}</span>
            </span>
            <span suppressHydrationWarning className="hidden text-xs text-[color:var(--st-muted)] lg:inline">
              {currentRunLabel ? currentRunLabel.replace("Last run ", "Last run: Today, ") : "Last run: Never"}
            </span>
            <button
              type="button"
              onClick={onOpenStudio}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-xs text-white transition-colors hover:border-amber-400/30 hover:bg-white/[0.05]"
              title="Current environment profile"
              aria-label="Edit current environment profile in Studio"
            >
              <Sun className="h-3.5 w-3.5 text-amber-300" />
              <span>{headerAssumptions.timeOfDay === "night" ? "Night Mode" : headerAssumptions.timeOfDay === "custom" ? "Custom Mode" : "Day Mode"}</span>
            </button>
          </div>

          <div className="relative flex flex-none flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDashboardViewMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2.5 text-xs font-medium text-white transition-colors hover:border-sky-400/30 hover:bg-white/[0.05]"
              aria-expanded={dashboardViewMenuOpen}
              aria-controls="dashboard-view-menu"
            >
              <Eye className="h-3.5 w-3.5 text-sky-200" />
              Panels
              {shownDashboardCount > 0 ? (
                <span className="rounded-full border border-amber-400/25 bg-amber-500/12 px-1.5 py-0.5 text-[9px] text-amber-100">
                  {shownDashboardCount} open
                </span>
              ) : null}
            </button>
            {dashboardViewMenuOpen ? (
              <div
                id="dashboard-view-menu"
                className="absolute right-0 top-full z-50 mt-2 w-[300px] overflow-hidden rounded-xl border border-[color:var(--st-border)] bg-[#0b111e] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-2 pb-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">Dashboard panels</div>
                    <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">Open only the panels you need for this review.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDashboardVisibility(DEFAULT_DASHBOARD_VISIBILITY)}
                    className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/75 hover:text-white"
                  >
                    Hide all
                  </button>
                </div>
                <div className="max-h-[62vh] overflow-y-auto py-1">
                  {DASHBOARD_SECTION_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDashboardSectionVisible(item.id, !dashboardVisibility[item.id])}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-white">{item.label}</span>
                        <span className="block text-[10px] text-[color:var(--st-muted)]">{item.group}</span>
                      </span>
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px]",
                        dashboardVisibility[item.id]
                          ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-400/20 bg-slate-500/8 text-slate-300",
                      )}>
                        {dashboardVisibility[item.id] ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {dashboardVisibility[item.id] ? "Shown" : "Hidden"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onOpenStudio}
              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white transition-colors hover:border-sky-400/30 hover:bg-white/[0.05]"
            >
              <FolderOpen className="h-3.5 w-3.5 text-sky-200" />
              Open Studio
            </button>
            <button
              type="button"
              onClick={onRunSimulation}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#031a0c] transition-colors hover:bg-emerald-400"
            >
              <Play className="h-3.5 w-3.5" />
              {simulationDirty ? "Refresh Simulation" : "Run Simulation"}
            </button>
            <button
              type="button"
              onClick={onImportScene}
              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white transition-colors hover:border-sky-400/30 hover:bg-white/[0.05]"
            >
              <FileText className="h-3.5 w-3.5 text-sky-200" />
              Import JSON
            </button>
            <button
              type="button"
              onClick={onCreateScene}
              className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white transition-colors hover:border-sky-400/30 hover:bg-white/[0.05]"
            >
              <Plus className="h-3.5 w-3.5 text-sky-200" />
              New Scene
            </button>
          </div>
        </header>

        <div className="grid flex-1 items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)_326px]">
          <aside className="flex flex-col gap-4 rounded-[8px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-3">
            <div>
              <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--st-muted)]">LAUNCHER</div>
              <nav className="mt-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeLauncherNav === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => navActionByKey[item.key]?.()}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-sm transition-colors text-left",
                        isActive
                          ? "bg-emerald-500/15 text-emerald-100 font-medium"
                          : navActionByKey[item.key]
                            ? "text-[color:var(--st-muted)] hover:bg-white/[0.04] hover:text-[color:var(--st-text)]"
                            : "text-[color:var(--st-muted)]/60 cursor-default",
                      )}
                      aria-current={isActive ? "page" : undefined}
                      disabled={!navActionByKey[item.key]}
                    >
                      {item.key === "home" ? <MapIcon className={cn("h-4 w-4", isActive ? "text-emerald-300" : "text-[#aab7d1]")} /> : null}
                      {item.key === "projects" ? <FolderOpen className={cn("h-4 w-4", isActive ? "text-emerald-300" : "text-[#aab7d1]")} /> : null}
                      {item.key === "reference_sites" ? <LayoutDashboard className={cn("h-4 w-4", isActive ? "text-emerald-300" : "text-[#aab7d1]")} /> : null}
                      {item.key === "report" ? <FileText className={cn("h-4 w-4", isActive ? "text-emerald-300" : "text-[#aab7d1]")} /> : null}
                      {item.key === "docs" ? <FileText className={cn("h-4 w-4", isActive ? "text-emerald-300" : "text-[#aab7d1]")} /> : null}
                      {item.key === "settings" ? <Settings2 className={cn("h-4 w-4", isActive ? "text-emerald-300" : "text-[#aab7d1]")} /> : null}
                      <span className="flex-1">
                        <span className="block">{item.label}</span>
                        {item.key === "projects" && isActive ? <span className="block text-[10px] font-normal text-emerald-100/70">Workspace library open</span> : null}
                        {item.key === "reference_sites" && isActive ? <span className="block text-[10px] font-normal text-emerald-100/70">Demo baselines shown</span> : null}
                        {item.detail && !isActive ? <span className="block text-[10px] font-normal text-[color:var(--st-muted)]">{item.detail}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--st-muted)]">WORKSPACE MODES</div>
              <nav className="mt-3 space-y-1">
                {WORKSPACE_MODE_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={modeActionByKey[item.key]}
                    className="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-left text-sm text-[#c5cde0] transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    {item.key === "coverage" ? <MapIcon className="h-4 w-4 text-emerald-300" /> : null}
                    {item.key === "camera_view" ? <Camera className="h-4 w-4 text-[#aab7d1]" /> : null}
                    {item.key === "camera_wall" ? <LayoutDashboard className="h-4 w-4 text-[#aab7d1]" /> : null}
                    {item.key === "path_replay" ? <Play className="h-4 w-4 text-[#aab7d1]" /> : null}
                    {item.key === "compare" ? <Layers3 className="h-4 w-4 text-[#aab7d1]" /> : null}
                    {item.key === "report_lite" ? <FileText className="h-4 w-4 text-[#aab7d1]" /> : null}
                    <span>
                      <span className="block">{item.label}</span>
                      <span className="block text-[11px] text-[color:var(--st-muted)]">{item.detail}</span>
                    </span>
                  </button>
                ))}
              </nav>
            </div>



            <button
              type="button"
              onClick={() => setShowOrgManager(true)}
              className="mt-auto flex items-center gap-2.5 rounded-[8px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5 text-left transition-colors hover:border-sky-400/30 hover:bg-white/[0.04]"
              aria-label="Open organization and account switcher"
            >
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#1a2540] text-[11px] font-bold text-sky-200">
                {workspaceAccountProfile.accountName?.[0]?.toUpperCase() ?? "S"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{workspaceAccountProfile.accountName ?? "Sentinel Operator"}</div>
                <div className="text-[10px] text-[color:var(--st-muted)]">{workspaceAccountProfile.planTier}</div>
              </div>
              <ChevronDown className="h-4 w-4 flex-none text-[color:var(--st-muted)]" />
            </button>
          </aside>

          <div className="flex min-w-0 flex-col gap-4">
            {!hasMainDashboardPanel ? (
              <DashboardOpenHint
                title="Dashboard panels are hidden"
                description="Open the panels that match the current job. This keeps the launcher quiet by default while preserving every implemented dashboard surface."
                actions={[
                  { id: "overview", label: "Current site twin", onClick: () => setDashboardSectionVisible("overview", true) },
                  { id: "preview", label: "Map preview", onClick: () => setDashboardSectionVisible("preview", true) },
                  { id: "metrics", label: "Summary metrics", onClick: () => setDashboardSectionVisible("metrics", true) },
                  { id: "workspaces", label: "Workspace shortcuts", onClick: () => setDashboardSectionVisible("workspaces", true) },
                  { id: "recent", label: "Recent site twins", onClick: () => setDashboardSectionVisible("recent", true) },
                  { id: "create", label: "Create and import", onClick: () => setDashboardSectionVisible("create", true) },
                ]}
              />
            ) : null}
            {hasMainDashboardPanel ? (
            <div className="rounded-[28px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.30)]">
              {isDashboardSectionVisible("overview") ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--st-muted)]">CURRENT SITE TWIN</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="text-2xl font-semibold tracking-tight sm:text-3xl">{scene.name}</div>
                    <button type="button" onClick={onOpenStudio} className="mt-0.5 text-[color:var(--st-muted)] hover:text-white transition-colors">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--st-muted)]">
                    <span className="flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                      {scene.dimensions.width}m × {scene.dimensions.depth}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Camera className="h-3 w-3" />
                      {scene.cameras.length} {scene.cameras.length === 1 ? "Camera" : "Cameras"}
                    </span>
                    {scene.securityLights.length > 0 ? (
                      <span className="flex items-center gap-1">
                        <Sun className="h-3 w-3 text-amber-300" />
                        {scene.securityLights.length} {scene.securityLights.length === 1 ? "Light" : "Lights"}
                      </span>
                    ) : null}
                    {scene.obstructions.length > 0 ? (
                      <span className="flex items-center gap-1">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="2" /></svg>
                        {scene.obstructions.length} Obstructions
                      </span>
                    ) : null}
                    {scene.criticalZones.length > 0 ? (
                      <span className="flex items-center gap-1 text-amber-300/80">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                        {scene.criticalZones.length} Critical {scene.criticalZones.length === 1 ? "Zone" : "Zones"}
                      </span>
                    ) : null}
                    {scene.paths.length > 0 ? (
                      <span className="flex items-center gap-1">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 12c0-4.97 4.03-9 9-9s9 4.03 9 9" /><path strokeLinecap="round" d="M12 21v-9" /></svg>
                        {scene.paths.length} {scene.paths.length === 1 ? "Path" : "Paths"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-none flex-wrap items-center gap-2">
                  <HideSectionButton label="current site twin" onClick={() => setDashboardSectionVisible("overview", false)} />
                  <button
                    type="button"
                    onClick={onOpenStudio}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[color:var(--st-border)] bg-white/[0.03] px-3 py-2 text-[11px] text-[color:var(--st-muted)] transition-colors hover:border-sky-400/30 hover:text-white"
                  >
                    Open Security Twin Studio
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </button>
                </div>
              </div>
              ) : null}

              {isDashboardSectionVisible("preview") ? (
              <div className="mt-4 overflow-hidden rounded-[24px] border border-white/[0.05] bg-black/[0.15]">
                <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--st-muted)]">Map preview</div>
                  <HideSectionButton label="map preview" onClick={() => setDashboardSectionVisible("preview", false)} />
                </div>
                <div className={cn(
                  "relative",
                  previewMode === "3d" ? "[transform:perspective(1800px)_rotateX(8deg)] [transform-origin:center_top]" : "",
                )}>
                  <ScenePreview scene={scene} result={result ?? scene.simulation ?? null} hydrated={hydrated} />
                  <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2 rounded-xl border border-[#2a334a] bg-[#0b111e]/88 px-3 py-1.5 text-[10px] text-[#c7d0e4]">
                    <Compass className="h-3.5 w-3.5 text-cyan-300" />
                    <span className="font-semibold">N</span>
                    <span className="text-[#8ea0bf]">Top view</span>
                  </div>
                  <div className="absolute left-3 top-3 z-20 inline-flex rounded-xl border border-[#2a334a] bg-[#0b111e]/88 p-1">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("2d")}
                      className={cn(
                        "rounded-md px-2 py-1 text-[10px] transition-colors",
                        previewMode === "2d" ? "bg-cyan-500/25 text-cyan-100" : "text-[#91a4c7] hover:text-white",
                      )}
                    >
                      2D
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("3d")}
                      className={cn(
                        "rounded-md px-2 py-1 text-[10px] transition-colors",
                        previewMode === "3d" ? "bg-cyan-500/25 text-cyan-100" : "text-[#91a4c7] hover:text-white",
                      )}
                    >
                      3D
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 z-20 w-[220px] rounded-xl border border-[#2a334a] bg-[#0a111d]/90 px-3 py-2 text-[10px] text-[#c8d3ea]">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#8ea5cc]">Coverage (PPM)</div>
                    <div className="mt-1 grid grid-cols-[12px_1fr] items-center gap-x-2 gap-y-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#38bdf8]" />
                      <span>250+ Identification</span>
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#22c55e]" />
                      <span>125-250 Recognition</span>
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#fbbf24]" />
                      <span>62.5-125 Observation</span>
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#f59e0b]" />
                      <span>25-62.5 Detection</span>
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#ef4444]" />
                      <span>&lt;25 No Coverage</span>
                    </div>
                    {topObstructionIssue ? (
                      <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/12 px-2 py-1 text-amber-100">
                        Obstructed: {topObstructionIssue.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              ) : null}

              {isDashboardSectionVisible("metrics") ? (
              <div className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-6">
                <div className="flex flex-col gap-1 rounded-[16px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
                  <div className="-mx-1 -mt-1 mb-1 flex justify-end">
                    <HideSectionButton label="summary metrics" onClick={() => setDashboardSectionVisible("metrics", false)} />
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">COVERAGE</div>
                  <div className={cn("text-xl font-bold tracking-tight", displayCoverage != null ? coverageTone(displayCoverage) : "text-slate-200")}>
                    {displayCoverage != null ? `${Math.round(displayCoverage)}%` : "Pending"}
                  </div>
                  <div className="text-[10px] text-[color:var(--st-muted)]">{displayCoverage == null ? "Run baseline simulation" : "vs last run"}</div>
                </div>
                <div className="flex flex-col gap-1 rounded-[16px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">CRITICAL ZONES</div>
                  <div className={cn("text-xl font-bold", displayTotalZones > 0 && displayPassCount === displayTotalZones ? "text-emerald-300" : "text-amber-300")}>
                    {displayPassCount}/{displayTotalZones}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[color:var(--st-muted)]">
                    {displayTotalZones > 0 && displayPassCount < displayTotalZones ? <TriangleAlert className="h-3 w-3 text-amber-400" /> : null}
                    Passing
                  </div>
                </div>
                <div className="flex flex-col gap-1 rounded-[16px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">WORST QUALITY</div>
                  <div className={cn("text-xl font-bold", displayWorstQualityValue ? QUALITY_TEXT_COLOR[displayWorstQualityValue] : "text-slate-200")}>
                    {displayWorstQualityLabel ?? "Pending"}
                  </div>
                  <div className="truncate text-[10px] text-[color:var(--st-muted)]">
                    {(displayPrimaryRisk ?? displayWorstIssue?.description ?? "Baseline required").slice(0, 30)}
                  </div>
                </div>
                <div className="flex flex-col gap-1 rounded-[16px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">ISSUES</div>
                  <div className={cn("text-xl font-bold", displayIssues.length > 0 ? "text-amber-300" : "text-emerald-300")}>{displayIssues.length}</div>
                  <div className="text-[10px] text-[color:var(--st-muted)]">Open</div>
                </div>
                <div className="flex flex-col gap-1 rounded-[16px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">REDUNDANCY</div>
                  <div className={cn("text-xl font-bold", displayRedundancyFailCount > 0 ? "text-red-300" : displayRedundancyCount === 0 ? "text-sky-200" : "text-emerald-300")}>
                    {displayRedundancyFailCount > 0 ? "FAILS" : displayRedundancyCount === 0 ? "Not set" : "OK"}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[color:var(--st-muted)]">
                    {displayRedundancyFailCount > 0 ? <TriangleAlert className="h-3 w-3 text-red-400" /> : null}
                    {displayRedundancyFailCount > 0 ? `If CAM 1 offline` : displayRedundancyCount === 0 ? "No redundancy required" : "Coverage intact"}
                  </div>
                </div>
                <div className="flex flex-col gap-1 rounded-[16px] border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">LAST RUN</div>
                  <div className="text-sm font-bold text-sky-200" suppressHydrationWarning>{lastRunLabel}</div>
                  <div className="text-[10px] text-[color:var(--st-muted)]" suppressHydrationWarning>{lastRunDetail}</div>
                </div>
              </div>
              ) : null}

              {isDashboardSectionVisible("workspaces") ? (
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <div className="col-span-2 flex items-center justify-between lg:col-span-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--st-muted)]">Workspace shortcuts</div>
                  <HideSectionButton label="workspace shortcuts" onClick={() => setDashboardSectionVisible("workspaces", false)} />
                </div>
                <button
                  type="button"
                  onClick={onOpenCoverageWorkspace}
                  className="group flex items-center gap-3 rounded-[18px] border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-3.5 text-left transition-[transform,border-color,background-color] hover:border-emerald-400/30 hover:bg-emerald-500/5"
                >
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10">
                    <MapIcon className="h-4.5 w-4.5 h-[18px] w-[18px] text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">Coverage</div>
                    <div className="mt-0.5 text-[11px] text-[color:var(--st-muted)]">Map & full analysis</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onOpenCameraWall}
                  className="group flex items-center gap-3 rounded-[18px] border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-3.5 text-left transition-[transform,border-color,background-color] hover:border-sky-400/30 hover:bg-sky-500/5"
                >
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-sky-400/25 bg-sky-500/10">
                    <Camera className="h-[18px] w-[18px] text-sky-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">Camera Operations</div>
                    <div className="mt-0.5 text-[11px] text-[color:var(--st-muted)]">Multi-camera view</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onOpenPathReplay}
                  className="group flex items-center gap-3 rounded-[18px] border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-3.5 text-left transition-[transform,border-color,background-color] hover:border-violet-400/30 hover:bg-violet-500/5"
                >
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10">
                    <Play className="h-[18px] w-[18px] text-violet-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">Incident Review</div>
                    <div className="mt-0.5 text-[11px] text-[color:var(--st-muted)]">Route visibility over time</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onOpenCompareFixes}
                  className="group flex items-center gap-3 rounded-[18px] border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-3.5 text-left transition-[transform,border-color,background-color] hover:border-amber-400/30 hover:bg-amber-500/5"
                >
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-amber-400/25 bg-amber-500/10">
                    <LayoutDashboard className="h-[18px] w-[18px] text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">Compare Fix</div>
                    <div className="mt-0.5 text-[11px] text-[color:var(--st-muted)]">Before / after analysis</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onOpenReport}
                  className="group flex items-center gap-3 rounded-[18px] border border-[color:var(--st-border)] bg-white/[0.03] px-4 py-3.5 text-left transition-[transform,border-color,background-color] hover:border-cyan-400/30 hover:bg-cyan-500/5"
                >
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10">
                    <FileText className="h-[18px] w-[18px] text-cyan-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white">Audit Report</div>
                    <div className="mt-0.5 text-[11px] text-[color:var(--st-muted)]">Summary & export</div>
                  </div>
                </button>
              </div>
              ) : null}

              {showWorkspaceLibrary && isDashboardSectionVisible("library") ? (
                <SiteTwinSearchBar
                  workspaceMemoryQuery={workspaceMemoryQuery}
                  setWorkspaceMemoryQuery={setWorkspaceMemoryQuery}
                  workspaceMemoryResults={workspaceMemoryResults}
                  setTimelineFocusRequest={setTimelineFocusRequest}
                  onOpenReport={onOpenReport}
                  onOpenMode={onOpenMode}
                  savedProjects={savedProjects}
                  onOpenScene={onOpenScene}
                  onOpenStudio={onOpenStudio}
                  scene={scene}
                />
              ) : null}

              {(isDashboardSectionVisible("recent") || isDashboardSectionVisible("create")) ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
                {isDashboardSectionVisible("recent") ? (
                <div className="rounded-[20px] border border-[color:var(--st-border)] bg-[color:var(--st-panel-2)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--st-muted)]">RECENT SITE TWINS</div>
                    <HideSectionButton label="recent site twins" onClick={() => setDashboardSectionVisible("recent", false)} />
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {compactRecentProjects.map((project) => {
                      const recentScene = project.scene;
                      const recentCoverage = recentScene.simulation?.totalCoveragePct ?? (recentScene.id === scene.id ? coverage : null);
                      const recentIssues = recentScene.simulation?.issues.length ?? (recentScene.id === scene.id ? issues.length : 0);
                      return (
                        <button
                          key={recentScene.id}
                          type="button"
                          onClick={() => onOpenScene?.(recentScene)}
                          className="group rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.02] p-2 text-left transition-colors hover:border-sky-400/25 hover:bg-white/[0.04]"
                        >
                          <div className="h-[72px] overflow-hidden rounded-lg border border-white/8 bg-[#08111d]">
                            <ScenePreview scene={recentScene} result={recentScene.simulation ?? (recentScene.id === scene.id ? result : null)} compact showLabels={false} hydrated={hydrated} />
                          </div>
                          <div className="mt-1.5 truncate text-[11px] font-semibold text-white">{recentScene.name}</div>
                          <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">
                            {recentCoverage != null ? `${Math.round(recentCoverage)}% coverage` : "Pending"}
                          </div>
                          <div className="text-[10px] text-[color:var(--st-muted)]">
                            {recentIssues} issues
                          </div>
                          <div suppressHydrationWarning className="mt-0.5 text-[9px] text-[color:var(--st-muted)]/70">
                            {formatTime(project.updatedAt)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                ) : null}

                {isDashboardSectionVisible("create") ? (
                <div className="rounded-[20px] border border-[color:var(--st-border)] bg-[color:var(--st-panel-2)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--st-muted)]">CREATE / IMPORT SITE TWIN</div>
                    <HideSectionButton label="create and import" onClick={() => setDashboardSectionVisible("create", false)} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-3">
                    <button
                      type="button"
                      onClick={onCreateScene}
                      className="flex flex-col items-center gap-2 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.025] px-3 py-3.5 text-center transition-colors hover:border-sky-400/30 hover:bg-white/[0.04]"
                    >
                      <Plus className="h-5 w-5 text-sky-300" />
                      <div>
                        <div className="text-[12px] font-semibold text-white">Create Site Twin</div>
                        <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">Start from scratch</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={onImportScene}
                      className="flex flex-col items-center gap-2 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.025] px-3 py-3.5 text-center transition-colors hover:border-sky-400/30 hover:bg-white/[0.04]"
                    >
                      <FileUp className="h-5 w-5 text-cyan-300" />
                      <div>
                        <div className="text-[12px] font-semibold text-white">Import Site Twin Data</div>
                        <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">From file</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={onImportFloorPlan}
                      className="flex flex-col items-center gap-2 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.025] px-3 py-3.5 text-center transition-colors hover:border-sky-400/30 hover:bg-white/[0.04]"
                    >
                      <FileUp className="h-5 w-5 text-sky-300" />
                      <div>
                        <div className="text-[12px] font-semibold text-white">Import Floor Plan</div>
                        <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">Trace and review</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={onScanSite}
                      className="flex flex-col items-center gap-2 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.025] px-3 py-3.5 text-center transition-colors hover:border-sky-400/30 hover:bg-white/[0.04]"
                    >
                      <ScanSearch className="h-5 w-5 text-emerald-300" />
                      <div>
                        <div className="text-[12px] font-semibold text-white">Scan a Site</div>
                        <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">Upload site photos</div>
                      </div>
                    </button>
                    {onGuidedScanAssistant ? (
                      <button
                        type="button"
                        onClick={onGuidedScanAssistant}
                        className="flex flex-col items-center gap-2 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.025] px-3 py-3.5 text-center transition-colors hover:border-emerald-400/30 hover:bg-white/[0.04]"
                      >
                        <Radar className="h-5 w-5 text-emerald-300" />
                        <div>
                          <div className="text-[12px] font-semibold text-white">Guided Scan</div>
                          <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">Step-by-step capture</div>
                        </div>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={onAiDraft}
                      className="flex flex-col items-center gap-2 rounded-[14px] border border-[color:var(--st-border)] bg-white/[0.025] px-3 py-3.5 text-center transition-colors hover:border-violet-400/30 hover:bg-white/[0.04]"
                    >
                      <Sparkles className="h-5 w-5 text-violet-300" />
                      <div>
                        <div className="text-[12px] font-semibold text-white">AI Layout Draft</div>
                        <div className="mt-0.5 text-[10px] text-[color:var(--st-muted)]">Generate layout</div>
                      </div>
                    </button>
                  </div>
                </div>
                ) : null}
              </div>
              ) : null}
            </div>
            ) : null}

            {showWorkspaceLibrary && isDashboardSectionVisible("library") ? (
              <WorkspaceLibraryPanel
                scene={scene}
                result={result ?? scene.simulation ?? null}
                hydrated={hydrated}
                savedScenes={savedScenes}
                savedProjects={savedProjects}
                visibleProjects={visibleProjects}
                activeSource={activeSource}
                onOpenStudio={onOpenStudio}
                onOpenCoverageWorkspace={onOpenCoverageWorkspace}
                onOpenReport={onOpenReport}
                onOpenScene={onOpenScene}
                onOpenDemoScene={onOpenDemoScene}
                onCreateScene={onCreateScene}
                onImportFloorPlan={onImportFloorPlan}
                onImportScene={onImportScene}
                onScanSite={onScanSite}
                onGuidedScanAssistant={onGuidedScanAssistant}
                onAiDraft={onAiDraft}
                onUpdateProjectMetadata={onUpdateProjectMetadata}
                onDuplicateProject={onDuplicateProject}
                onRenameProject={onRenameProject}
              />
            ) : null}
        </div>

          <aside className="flex flex-col gap-3">
            {!hasSideDashboardPanel ? (
              <DashboardOpenHint
                title="Side panels are hidden"
                description="Open status, issue, or assumption panels when you need supporting context for the active site twin."
                actions={[
                  { id: "securityStatus", label: "Security status", onClick: () => setDashboardSectionVisible("securityStatus", true) },
                  { id: "issues", label: "Open issues", onClick: () => setDashboardSectionVisible("issues", true) },
                  { id: "assumptions", label: "Assumptions", onClick: () => setDashboardSectionVisible("assumptions", true) },
                ]}
              />
            ) : null}
            {/* Security Status panel */}
            {isDashboardSectionVisible("securityStatus") ? (
            <div className="rounded-[20px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-3.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7dd3fc]">SECURITY STATUS</div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                    Live
                  </span>
                  <HideSectionButton label="security status" onClick={() => setDashboardSectionVisible("securityStatus", false)} />
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-2 rounded-xl border border-[#1a2030] bg-white/[0.02] px-3 py-2">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#8b96ab]">SITE RISK</div>
                  <div className="mt-1 text-[12px] font-semibold text-white">{displayOutcomeStatus}</div>
                  <div className="mt-1 text-[10px] text-[#aab7d1]">{displayPrimaryRisk}</div>
                </div>
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8b96ab]">OUTCOME SUMMARY</div>
                <div className="space-y-1">
                  {outcomeSummary.map((zone) => {
                    const isFail = zone.status === "fail";
                    const isPartial = zone.status === "partial";
                    const isPass = zone.status === "pass";
                    const badgeLabel = isPass
                      ? (displayCoverage != null ? `${Math.round(displayCoverage)}%` : "PASS")
                      : isFail
                        ? qualityToLabel(zone.actual).toUpperCase()
                        : isPartial
                          ? qualityToLabel(zone.actual).toUpperCase()
                          : "NOT RUN";
                    const badgeCls = isPass
                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                      : isFail
                        ? "border-red-400/30 bg-red-500/12 text-red-300"
                        : isPartial
                          ? "border-amber-400/30 bg-amber-500/12 text-amber-300"
                          : "border-slate-400/20 bg-slate-500/8 text-slate-300";
                    const reqLabel = isPass ? "Meets requirement" : isFail ? `Recognition required` : "Minimum requirement";
                    return (
                      <div key={zone.id} className="flex items-center justify-between rounded-xl border border-[#1a2030] bg-white/[0.015] px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-medium text-white">{zone.label}</div>
                          <div className="text-[9px] text-[#8b96ab]">{reqLabel}</div>
                        </div>
                        <span className={cn("ml-2 flex-none rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em]", badgeCls)}>
                          {badgeLabel}
                        </span>
                      </div>
                    );
                  })}
                  {/* Overall Coverage row */}
                  <div className="flex items-center justify-between rounded-xl border border-[#1a2030] bg-white/[0.015] px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-white">Overall Coverage</div>
                      <div className="text-[9px] text-[#8b96ab]">Acceptable</div>
                    </div>
                    <span className={cn(
                      "ml-2 flex-none rounded border px-1.5 py-0.5 text-[8px] font-bold",
                      displayCoverage == null ? "border-slate-400/20 bg-slate-500/8 text-slate-300" :
                      displayCoverage >= 70 ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" :
                      displayCoverage >= 40 ? "border-amber-400/30 bg-amber-500/12 text-amber-300" : "border-red-400/30 bg-red-500/12 text-red-300"
                    )}>
                      {displayCoverage != null ? `${Math.round(displayCoverage)}%` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            ) : null}

            {/* Open Issues panel */}
            {isDashboardSectionVisible("issues") ? (
              <div className="rounded-[20px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                    OPEN ISSUES ({displayIssues.length})
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={onOpenIssues} className="text-[10px] text-sky-300 hover:text-sky-200">
                      View all
                    </button>
                    <HideSectionButton label="open issues" onClick={() => setDashboardSectionVisible("issues", false)} />
                  </div>
                </div>
                {displayIssues.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {displayIssues.slice(0, 4).map((issue, index) => (
                    <button
                      key={`issue-${index}`}
                      type="button"
                      onClick={onOpenIssues}
                      className="group w-full rounded-xl border border-[#1a2030] bg-white/[0.015] p-2.5 text-left transition-colors hover:border-amber-400/20 hover:bg-amber-500/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("h-2 w-2 flex-none rounded-full",
                              issue.severity === "critical" ? "bg-red-400" :
                              issue.severity === "high" ? "bg-orange-400" :
                              issue.severity === "medium" ? "bg-amber-400" : "bg-sky-400"
                            )} />
                            <span className={cn("text-[9px] font-bold uppercase tracking-[0.12em]", issueSeverityTone(issue.severity))}>
                              {issueSeverityLabel(issue.severity)}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] leading-[1.4] text-[#c5cde0]">{issue.description}</div>
                        </div>
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-none text-[color:var(--st-muted)] opacity-40 transition-opacity group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={onOpenIssues}
                    className="w-full rounded-xl border border-dashed border-[color:var(--st-border)] px-3 py-2 text-[10px] text-[#8b96ab] transition-colors hover:text-white"
                  >
                    See all issues &amp; recommendations
                  </button>
                </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-[#1a2030] bg-white/[0.015] px-3 py-2 text-[10px] leading-4 text-[#8b96ab]">
                    No open issues in the latest review. Run a fresh review after changes to confirm the current site state.
                  </div>
                )}
              </div>
            ) : null}

            {/* Simulation Assumptions */}
            {isDashboardSectionVisible("assumptions") ? (
            <div className="rounded-[20px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-3.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b96ab]">SIMULATION ASSUMPTIONS</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={onOpenStudio} className="text-[10px] text-sky-300 hover:text-sky-200">Edit</button>
                  <HideSectionButton label="simulation assumptions" onClick={() => setDashboardSectionVisible("assumptions", false)} />
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#8b96ab]">DORI Model</span>
                  <span className="text-[10px] font-medium text-[#c5cde0]">{formatDoriStandard(sceneAssumptions.doriStandard)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#8b96ab]">Person Height</span>
                  <span className="text-[10px] font-medium text-[#c5cde0]">{sceneAssumptions.personHeightM} m</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#8b96ab]">Lighting</span>
                  <span className="text-[10px] font-medium text-[#c5cde0]">{sceneAssumptions.timeOfDay === "night" ? "Night Mode" : sceneAssumptions.timeOfDay === "custom" ? "Custom" : "Day Mode"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#8b96ab]">Grid Resolution</span>
                  <span className="text-[10px] font-medium text-[#c5cde0]">0.25 m</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#8b96ab]">Glass Handling</span>
                  <span className="text-[10px] font-medium text-[#c5cde0]">{sceneAssumptions.nightPenaltyMode === "none" ? "Standard" : "Adjusted"}</span>
                </div>
              </div>
              <button type="button" onClick={onOpenStudio} className="mt-3 w-full text-center text-[10px] text-[#8b96ab] hover:text-white transition-colors">
                View all assumptions
              </button>
            </div>
            ) : null}
          </aside>
        </div>

        {footerPanel ? (
          <section className="rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-panel)] px-4 py-3 text-[11px] text-[color:var(--st-muted)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">
                  {footerPanel === "feedback" ? "Feedback Handoff" : "Command Center Help"}
                </div>
                <div className="mt-1 max-w-3xl text-xs text-[#c8d4ea]">
                  {footerPanel === "feedback"
                    ? "Capture product feedback from the current site twin, then open Settings or Studio to adjust the relevant workflow."
                    : "Use Create Site Twin for new/imported sites, Security Twin Studio for editing, Audit Reports for exports, and Reference Sites for seeded examples."}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {footerPanel === "feedback" ? (
                  <>
                    <button type="button" onClick={openSettingsFromFooter} className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-1.5 text-sky-100 hover:bg-sky-500/20">Open Settings</button>
                    <button type="button" onClick={onOpenStudio} className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-white/90 hover:bg-white/[0.06]">Open Studio</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={openSiteIntakeFromFooter} className="rounded-lg border border-sky-400/25 bg-sky-500/10 px-3 py-1.5 text-sky-100 hover:bg-sky-500/20">Create Site Twin</button>
                    <button type="button" onClick={openReferenceSitesFromFooter} className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-white/90 hover:bg-white/[0.06]">Reference Sites</button>
                  </>
                )}
                <button type="button" onClick={() => setFooterPanel(null)} className="rounded-lg border border-white/15 px-3 py-1.5 text-white/70 hover:text-white">Close</button>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--st-border)] bg-[color:var(--st-panel)] px-4 py-2.5 text-[11px] text-[color:var(--st-muted)]">
          <div>© 2026 SentinelTwin · Security Simulation Studio · v0.9.0</div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-200">All systems operational</span>
            </span>
            <button type="button" onClick={() => setFooterPanel("feedback")} className="hover:text-white">Give Feedback</button>
            <button
              type="button"
              onClick={() => setFooterPanel("help")}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--st-border)] hover:border-sky-400/30 hover:text-white"
              aria-label="Open command center help"
            >
              ?
            </button>
          </div>
        </footer>
      </div>

      <OrganizationManagerPanel
        open={showOrgManager}
        onClose={() => setShowOrgManager(false)}
      />
    </main>
  );
}

type WorkspaceLibraryPanelProps = {
  scene: SecurityScene;
  result: SimulationResult | null;
  hydrated: boolean;
  savedScenes: SecurityScene[];
  savedProjects: SavedProjectRecord[];
  visibleProjects?: SavedProjectRecord[];
  activeSource?: ProjectSourceFilter;
  onOpenStudio?: () => void;
  onOpenCoverageWorkspace?: () => void;
  onOpenReport?: () => void;
  onOpenScene?: (scene: SecurityScene) => void;
  onOpenDemoScene?: () => void;
  onCreateScene?: () => void;
  onImportFloorPlan?: () => void;
  onImportScene?: () => void;
  onScanSite?: () => void;
  onGuidedScanAssistant?: () => void;
  onAiDraft?: () => void;
  onUpdateProjectMetadata?: StudioDashboardHomeProps["onUpdateProjectMetadata"];
  onDuplicateProject?: (sceneId: string) => void;
  onRenameProject?: (sceneId: string, nextName: string) => void;
};

function WorkspaceLibraryPanel({
  scene,
  result,
  hydrated,
  savedScenes,
  savedProjects,
  visibleProjects,
  activeSource = "All",
  onOpenStudio,
  onOpenCoverageWorkspace,
  onOpenReport,
  onOpenScene,
  onOpenDemoScene,
  onCreateScene,
  onImportFloorPlan,
  onImportScene,
  onScanSite,
  onGuidedScanAssistant,
  onAiDraft,
  onUpdateProjectMetadata,
  onDuplicateProject,
  onRenameProject,
}: WorkspaceLibraryPanelProps) {
  const projectRecords = (visibleProjects ?? savedProjects).slice(0, 8);
  const projects = projectRecords.length > 0
    ? projectRecords.map((entry) => entry.scene)
    : activeSource === "All"
      ? savedScenes.slice(0, 8)
      : [];
  const libraryTitle = activeSource === "demo" ? "Demo Site Twins" : "Project Site Twins";
  const libraryDescription = activeSource === "demo"
    ? "Reference scenarios with different coverage outcomes. Open one to show how edits, camera aim, lighting, and obstructions change the simulation."
    : "Resume a project, compare saved site twins, or start a new intake path from the dashboard.";

  const openScene = (target: SecurityScene) => {
    onOpenScene?.(target);
    onOpenStudio?.();
  };

  return (
    <section className="mt-4 rounded-[24px] border border-[color:var(--st-border)] bg-[color:var(--st-panel)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">{libraryTitle}</div>
          <div className="mt-1 text-xs text-[color:var(--st-muted)]">
            {libraryDescription}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <button type="button" onClick={onCreateScene} className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-sky-100">Create Site Twin</button>
          <button type="button" onClick={onImportScene} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/90">Import Site Twin Data</button>
          <button type="button" onClick={onImportFloorPlan} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/90">Floor Plan</button>
          <button type="button" onClick={onScanSite} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/90">Scan Site</button>
          <button type="button" onClick={onGuidedScanAssistant} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/90">Guided Scan</button>
          <button type="button" onClick={onAiDraft} className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-white/90">Layout Draft</button>
          <button type="button" onClick={onOpenCoverageWorkspace} className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">Open Coverage</button>
          <button type="button" onClick={onOpenReport} className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-amber-100">Open Report</button>
          <button type="button" onClick={onOpenDemoScene} className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-violet-100">Load Demo</button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {projects.length > 0 ? (
            projects.map((projectScene, index) => {
              const coveragePct = projectScene.simulation?.totalCoveragePct ?? null;
              const issueCount = projectScene.simulation?.issues.length ?? 0;
              const displayTitle = getDemoWorkspaceTitle(projectScene, index);
              const displayDetail = getDemoWorkspaceDetail(
                projectScene,
                `${projectScene.cameras.length} cameras · ${projectScene.criticalZones.length} zones`,
                index,
              );
              return (
              <div key={projectScene.id} className="rounded-[16px] border border-[color:var(--st-border)] bg-white/[0.02] p-2">
                <button type="button" onClick={() => openScene(projectScene)} className="w-full text-left">
                  <div className="relative h-24 overflow-hidden rounded-lg border border-white/10 bg-[#0b1322]">
                    <ScenePreview scene={projectScene} result={projectScene.simulation ?? (projectScene.id === scene.id ? result : null)} compact showLabels={false} hydrated={hydrated} />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#050914] to-transparent px-2 py-1.5">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-100">
                        {projectScene.source === "demo" ? "Reference Demo" : SOURCE_LABELS[projectScene.source]}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-white">{displayTitle}</div>
                      <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[color:var(--st-muted)]">{displayDetail}</div>
                    </div>
                    <span className={cn(
                      "flex-none rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                      coveragePct == null ? "border-slate-400/20 bg-slate-500/10 text-slate-200" : coverageTone(coveragePct),
                    )}>
                      {coveragePct != null ? `${Math.round(coveragePct)}%` : "Run"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] text-[color:var(--st-muted)]">
                    <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">{projectScene.cameras.length} cams</span>
                    <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">{projectScene.criticalZones.length} zones</span>
                    <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">{issueCount} issues</span>
                  </div>
                </button>
                <div className="mt-2 flex flex-wrap gap-1 text-[9px]">
                  <button type="button" onClick={() => openScene(projectScene)} className="rounded border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-100">Open Studio</button>
                  <button type="button" onClick={() => onRenameProject?.(projectScene.id, `${projectScene.name} Copy`)} className="rounded border border-white/15 px-1.5 py-0.5 text-white/80">Quick Rename</button>
                  <button type="button" onClick={() => onDuplicateProject?.(projectScene.id)} className="rounded border border-white/15 px-1.5 py-0.5 text-white/80">Duplicate</button>
                  <button type="button" onClick={() => onUpdateProjectMetadata?.(projectScene.id, { lastOpenedAt: Date.now() })} className="rounded border border-white/15 px-1.5 py-0.5 text-white/80">Mark Opened</button>
                </div>
              </div>
              );
            })
          ) : (
            <div className="col-span-full rounded-[16px] border border-dashed border-[color:var(--st-border)] bg-white/[0.02] px-3 py-4 text-xs text-[color:var(--st-muted)]">
              No saved Site Twins yet. Start with Create Site Twin, Scan, Import, or Layout Draft.
            </div>
          )}
      </div>
    </section>
  );
}

type SiteTwinSearchBarProps = {
  workspaceMemoryQuery: string;
  setWorkspaceMemoryQuery: (value: string) => void;
  workspaceMemoryResults: WorkspaceSearchHit[];
  setTimelineFocusRequest: (request: TimelineFocusRequest | null) => void;
  onOpenReport: () => void;
  onOpenMode: (viewMode: ViewMode, preset: WorkspacePreset, bottomTab?: BottomTab) => void;
  savedProjects: SavedProjectRecord[];
  onOpenScene?: (scene: SecurityScene) => void;
  onOpenStudio: () => void;
  scene: SecurityScene;
};

function SiteTwinSearchBar({
  workspaceMemoryQuery,
  setWorkspaceMemoryQuery,
  workspaceMemoryResults,
  setTimelineFocusRequest,
  onOpenReport,
  onOpenMode,
  savedProjects,
  onOpenScene,
  onOpenStudio,
  scene,
}: SiteTwinSearchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const hasQuery = workspaceMemoryQuery.trim().length > 0;
  const openHit = (hit: WorkspaceSearchHit) => {
    if (hit.kind === "report") {
      onOpenReport();
      return;
    }

    if (hit.kind === "evidence" || hit.kind === "archive") {
      if (hit.routeTab) {
        onOpenMode("map", "coverage", hit.routeTab);
      } else {
        onOpenMode("map", "coverage", "timeline");
      }
      setTimelineFocusRequest({
        timestamp: hit.timestamp,
        query: workspaceMemoryQuery.trim() || hit.title,
        branchLabel: hit.branchLabel ?? null,
        eventId: hit.timelineEventId ?? null,
        source: "launcher",
      });
      return;
    }

    if (hit.kind === "workspace") {
      const target = savedProjects.find((project) => project.scene.id === hit.sceneId)?.scene
        ?? (hit.sceneId === scene.id ? scene : null);
      if (target) {
        onOpenScene?.(target);
      }
      onOpenStudio();
    }
  };

  return (
    <section className="mt-4 rounded-[16px] border border-[color:var(--st-border)] bg-[color:var(--st-panel-2)] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--st-muted)]">
          <Radar className="h-3.5 w-3.5 text-sky-300" />
          SITE TWIN MEMORY SEARCH
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-md border border-[color:var(--st-border)] bg-white/[0.03] px-2 py-1 text-[10px] text-[#c9d5eb] hover:border-sky-400/35 hover:text-white"
        >
          {expanded || hasQuery ? "Hide" : "Search"}
        </button>
      </div>
      {expanded || hasQuery ? (
        <div className="mt-2 space-y-1.5">
          <div className="rounded-lg border border-[color:var(--st-border)] bg-white/[0.03] px-2.5 py-2">
            <input
              value={workspaceMemoryQuery}
              onChange={(event) => setWorkspaceMemoryQuery(event.target.value)}
              placeholder="Search Site Twin history, evidence, archives, and reports..."
              className="w-full bg-transparent text-xs text-white placeholder:text-[color:var(--st-muted)] focus:outline-none"
            />
          </div>
          {workspaceMemoryResults.length > 0 ? workspaceMemoryResults.map((hit) => (
            <button
              key={hit.id}
              type="button"
              onClick={() => openHit(hit)}
              className="w-full rounded-xl border border-[color:var(--st-border)] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-sky-400/30 hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-sky-200">
                  {hit.kind}
                </span>
                <span className="truncate text-xs font-semibold text-white">{hit.title}</span>
              </div>
              <div className="mt-1 text-[10px] text-[color:var(--st-muted)]">{hit.summary}</div>
              <div className="mt-1 text-[10px] text-[#9db0cf]">{hit.targetSummary}</div>
            </button>
          )) : hasQuery ? (
            <div className="rounded-xl border border-dashed border-[color:var(--st-border)] px-3 py-2 text-[10px] text-[color:var(--st-muted)]">
              No matching Site Twin memory found for this query.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
