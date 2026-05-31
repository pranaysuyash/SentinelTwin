"use client";

import type { SecurityScene, SimulationResult } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";
import { simulateStudio } from "@sentineltwin/simulation";

type StatusBarNode = {
  nodeType?: string;
  name?: string;
  label?: string;
  id: string;
};

const VIEW_MODE_LABELS: Record<string, string> = {
  map: "Coverage - Map & Analysis",
  wall: "Camera Wall - Multi Camera",
  replay: "Path Replay - Route Analysis",
  camera_view: "Camera View - Single Camera",
  compare: "Compare - Before / After",
  report: "Report Lite - Quick Report",
};

function formatRunText(timestamp: number | null, durationMs: number | null) {
  if (!timestamp || durationMs === null) {
    return null;
  }

  return `Today, ${new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })} (${(durationMs / 1000).toFixed(1)}s)`;
}

function getNodeLabel(node: StatusBarNode) {
  return node.name ?? node.label ?? node.id;
}

function findSceneNode(scene: SecurityScene, selectedNodeId: string | null, selectedCameraId: string | null, selectedNodeIds: string[]) {
  const ids = selectedNodeIds.length > 0 ? selectedNodeIds : [selectedNodeId ?? selectedCameraId].filter(Boolean) as string[];
  const primaryId = ids[0] ?? null;
  if (!primaryId) return null;

  return scene.cameras.find((entry) => entry.id === primaryId)
    ?? scene.walls.find((entry) => entry.id === primaryId)
    ?? scene.doors.find((entry) => entry.id === primaryId)
    ?? scene.windows.find((entry) => entry.id === primaryId)
    ?? scene.obstructions.find((entry) => entry.id === primaryId)
    ?? scene.securityLights.find((entry) => entry.id === primaryId)
    ?? scene.criticalZones.find((entry) => entry.id === primaryId)
    ?? scene.privacyZones.find((entry) => entry.id === primaryId)
    ?? scene.paths.find((entry) => entry.id === primaryId)
    ?? scene.entryPoints.find((entry) => entry.id === primaryId)
    ?? null;
}

function describeSelection(scene: SecurityScene, selectedNodeId: string | null, selectedCameraId: string | null, selectedNodeIds: string[]) {
  if (selectedNodeIds.length > 1) {
    return `${selectedNodeIds.length} selected`;
  }

  const selectedNode = findSceneNode(scene, selectedNodeId, selectedCameraId, selectedNodeIds);
  if (!selectedNode) return "Scene overview";

  const label = getNodeLabel(selectedNode as StatusBarNode);
  switch (selectedNode.nodeType) {
    case "camera":
      return `Camera: ${label}`;
    case "critical_zone":
      return `Zone: ${label}`;
    case "security_light":
      return `Light: ${label}`;
    case "obstruction":
      return `Obstruction: ${label}`;
    case "path":
      return `Path: ${label}`;
    case "door":
      return `Door: ${label}`;
    case "window":
      return `Window: ${label}`;
    case "entry_point":
      return `Entry: ${label}`;
    case "wall":
      return `Wall: ${label}`;
    case "privacy_zone":
      return `Privacy zone: ${label}`;
    default:
      return `Selection: ${label}`;
  }
}

function formatCoverageSummary(result: SimulationResult | null) {
  if (!result) {
    return "Coverage: Pending · Issues: Pending";
  }

  return `Coverage: ${result.totalCoveragePct.toFixed(0)}% · Issues: ${result.issues.length}`;
}

function formatViewModeLabel(viewMode: string) {
  return VIEW_MODE_LABELS[viewMode] ?? viewMode.replace(/_/g, " ");
}

function formatWorkflowLabel(workflowId: string) {
  switch (workflowId) {
    case "audit":
      return "Audit";
    case "design":
      return "Design";
    case "scan":
      return "Scan";
    case "floor_plan":
      return "Floor Plan";
    case "ai_draft":
      return "AI Draft";
    case "verify_footage":
      return "Verify Footage";
    case "report":
      return "Report";
    case "reference":
      return "Reference Baseline";
    case "demo":
      return "Reference Baseline";
    default:
      return "Idle";
  }
}

export function StatusBar() {
  const running = useStudioStore((s) => s.simulationRunning);
  const result = useStudioStore((s) => s.simulationResult);
  const lastRunMs = useStudioStore((s) => s.lastRunMs);
  const autoRC = useStudioStore((s) => s.autoRecompute);
  const toggleAuto = useStudioStore((s) => s.toggleAutoRecompute);
  const visible = useStudioStore((s) => s.visibleComponents.status_bar);
  const scene = useStudioStore((s) => s.scene);
  const viewMode = useStudioStore((s) => s.viewMode);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const selectedCameraId = useStudioStore((s) => s.selectedCameraId);
  const activeWorkflowId = useStudioStore((s) => s.activeWorkflowId);
  const activeWorkflowStep = useStudioStore((s) => s.activeWorkflowStep);
  const activeWorkflowSteps = useStudioStore((s) => s.activeWorkflowSteps);
  const setSimulationRunning = useStudioStore((s) => s.setSimulationRunning);
  const setSimulationResult = useStudioStore((s) => s.setSimulationResult);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);

  if (!visible) return null;

  const runText = formatRunText(result?.computedAt ?? null, lastRunMs);
  const neverRun = !result?.computedAt;
  const selectionText = describeSelection(scene, selectedNodeId, selectedCameraId, selectedNodeIds);
  const viewModeText = formatViewModeLabel(viewMode);
  const coverageText = formatCoverageSummary(result);
  const workflowTotalSteps = activeWorkflowSteps.length;
  const workflowStepNumber = workflowTotalSteps > 0 ? Math.min(workflowTotalSteps, activeWorkflowStep + 1) : 0;
  const workflowStepLabel = workflowTotalSteps > 0 ? activeWorkflowSteps[workflowStepNumber - 1] : null;
  const workflowText = activeWorkflowId === "idle" || workflowTotalSteps === 0
    ? "Workflow: Idle"
    : `Workflow: ${formatWorkflowLabel(activeWorkflowId)} ${workflowStepNumber}/${workflowTotalSteps}`;

  return (
    <footer className="flex h-6 flex-shrink-0 select-none items-center gap-4 border-t border-[#1e2130] bg-[#0b0c10] px-3">
      {/* Unsaved / stale indicator */}
      {simulationDirty ? (
        <span className="text-[10px] text-amber-400/80 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" />
          Scene changed
        </span>
      ) : null}

      <div className="flex min-w-0 items-center gap-3 text-[10px] text-[#3a4158]">
        <span className="max-w-[22rem] truncate text-[#c7d0e4]" title={scene.name}>
          Scene: {scene.name}
        </span>
        <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-200">Truth: Live</span>
        <span className="whitespace-nowrap">View: {viewModeText}</span>
        <span className="whitespace-nowrap" title={workflowStepLabel ?? undefined}>
          {workflowText}
        </span>
        <span className="max-w-[18rem] truncate text-[#8fa2c3]" title={selectionText}>
          {selectionText}
        </span>
      </div>

      <div className="flex-1" />

      {/* Engine status with dot */}
      <div className="flex items-center gap-3 text-[10px] text-[#3a4158]">
        <span className="whitespace-nowrap" title={coverageText}>
          {coverageText}
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          Engine:
          <span className={running ? "text-amber-400" : "text-green-500"}>
            {running ? "Running" : "Ready"}
          </span>
          <span className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-amber-400" : "bg-green-500"}`} />
        </span>
      </div>

      {/* Last run — clickable to run when stale or never-run */}
      <button type="button"
        onClick={() => {
          if (!running) {
            setSimulationRunning(true);
            const start = performance.now();
            const simResult = simulateStudio(scene as never);
            setSimulationResult(simResult, performance.now() - start);
          }
        }}
        disabled={running}
        className={`text-[10px] transition-colors ${
          neverRun || simulationDirty
            ? "text-amber-500/70 hover:text-amber-400 cursor-pointer"
            : "text-[#3a4158] cursor-default"
        } ${running ? "opacity-50" : ""}`}
        title={
          running
            ? "Simulation in progress"
            : neverRun
              ? "No simulation yet — click to run"
              : simulationDirty
                ? "Scene changed — click to re-run"
                : undefined
        }
      >
        {running ? "Running…" : runText ? `Last Run: ${runText}` : "Click to simulate"}
      </button>

      {/* Auto recompute toggle */}
      <button type="button"
        onClick={toggleAuto}
        className="flex items-center gap-1.5 text-[10px] text-[#4a5568] transition-colors hover:text-white"
      >
        Auto:
        <span className={autoRC ? "text-green-400" : "text-[#4a5568]"}>{autoRC ? "On" : "Off"}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${autoRC ? "bg-green-400" : "bg-[#4a5568]"}`} />
      </button>

      {/* Mode indicator */}
      <span className="flex items-center gap-1.5 text-[10px] text-[#3a4158]">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        Local
      </span>

      <span className="text-[10px] text-[#3a4158]">Scale: 1 m/unit</span>
      <span className="text-[10px] text-[#3a4158]">Grid: 0.25 m</span>
    </footer>
  );
}
