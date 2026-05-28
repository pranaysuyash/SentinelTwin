"use client";

import { ChevronDown, ChevronRight, MapPinned, MonitorSmartphone } from "lucide-react";
import { useState } from "react";

import { ScenarioPathPanel } from "@/components/bottom-panel/ScenarioPathPanel";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { CameraInspector } from "@/components/inspector/CameraInspector";
import { AssumptionsPanel } from "@/components/panels/AssumptionsPanel";
import { IssuesTab } from "@/components/bottom-panel/IssuesTab";
import { SecurityOutcomePanel } from "@/components/security-outcome/SecurityOutcomePanel";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";

function SectionToggle({
  title,
  summary,
  open,
  onToggle,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-2 rounded-lg border border-[#1f2536] bg-[#0b0f17] px-2 py-1 transition-colors hover:border-[#31405a]">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-md border border-[#24283a] bg-[#111521] text-[#7f8aa3]">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-semibold text-[#d7deed]">{title}</div>
          <div className="truncate text-[10px] uppercase tracking-[0.14em] text-[#64738f]">{summary}</div>
        </div>
      </button>
      <ExplainBadge text="Expand to inspect and edit this section. Collapsing preserves context while reducing panel noise." />
    </div>
  );
}

export function ContextRightPanel() {
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const viewMode = useStudioStore((s) => s.viewMode);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
  const rightPanelMode = useStudioStore((s) => s.rightPanelMode);
  const setRightPanelMode = useStudioStore((s) => s.setRightPanelMode);
  const selectedNode = scene.cameras.find((entry) => entry.id === selectedNodeId)
    ?? scene.walls.find((entry) => entry.id === selectedNodeId)
    ?? scene.doors.find((entry) => entry.id === selectedNodeId)
    ?? scene.windows.find((entry) => entry.id === selectedNodeId)
    ?? scene.obstructions.find((entry) => entry.id === selectedNodeId)
    ?? scene.securityLights.find((entry) => entry.id === selectedNodeId)
    ?? scene.criticalZones.find((entry) => entry.id === selectedNodeId)
    ?? scene.privacyZones.find((entry) => entry.id === selectedNodeId)
    ?? scene.paths.find((entry) => entry.id === selectedNodeId)
    ?? scene.entryPoints.find((entry) => entry.id === selectedNodeId)
    ?? null;
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [pathOpen, setPathOpen] = useState(viewMode === "replay");
  const pathOpenEffective = viewMode === "replay" ? true : pathOpen;
  const assumptionsSummary = `${scene.assumptions.doriStandard === "oodpcvs_2025" ? "IEC 62676-4:2025" : "DORI 2014"} · ${scene.assumptions.timeOfDay} · ${scene.assumptions.interiorLightLevel}`;

  return (
    <div className="relative z-[120] flex h-full min-w-0 min-h-0 flex-col overflow-visible bg-[#0c0f16]">
      <div className="flex items-center gap-2 border-b border-[#1e2130] bg-[#0b0f17] px-2.5 py-1">
        <div className="flex h-5 w-5 items-center justify-center rounded-md border border-blue-500/20 bg-blue-500/12">
          <MonitorSmartphone className="h-3 w-3 text-blue-400" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-white">Context Inspector</div>
          <div className="truncate text-[10px] uppercase tracking-[0.14em] text-[#64738f]">
            {workspacePreset.replace(/_/g, " ")} · {viewMode.replace(/_/g, " ")}
          </div>
        </div>
        <div className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-0.5 text-[10px] text-[#9fb1d1]">
          <MapPinned className="h-2.5 w-2.5" />
          <span className={cn("truncate", selectedNodeId ? "text-[#c7d0e4]" : "text-[#6c768f]")}>
            {selectedNodeId ?? "Scene overview"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 border-b border-[#1e2130] px-2 py-1">
        {([
          ["inspector", "Inspector"],
          ["security_status", "Security Status"],
          ["issues", "Issues"],
          ["recommendations", "Recommendations"],
          ["assumptions", "Assumptions"],
          ["camera_controls", "Camera Controls"],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setRightPanelMode(mode)}
            className={cn("rounded px-2 py-1 text-[10px]", rightPanelMode === mode ? "bg-[#1a2233] text-white" : "text-[#92a5c8]")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rightPanelMode === "security_status" && <div className="h-full"><SecurityOutcomePanel compact /></div>}
        {rightPanelMode === "issues" && <div className="h-full"><IssuesTab /></div>}
        {rightPanelMode === "recommendations" && <div className="h-full"><SecurityOutcomePanel compact /></div>}
        {rightPanelMode === "assumptions" && <div className="h-full"><AssumptionsPanel /></div>}
        {rightPanelMode === "camera_controls" && <div className="h-full overflow-y-auto"><CameraInspector /></div>}
        {rightPanelMode === "inspector" && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
            <div className="shrink-0">
              <SectionToggle
                title="Selection Inspector"
                summary={selectedNode ? (selectedNode as { name?: string; label?: string }).name ?? (selectedNode as { label?: string }).label ?? selectedNode.id : "Scene overview"}
                open={inspectorOpen}
                onToggle={() => setInspectorOpen((current) => !current)}
              />
              {inspectorOpen ? (
                <div className="mt-2 min-h-0 overflow-hidden">
                  <InspectorPanel showHeader={false} />
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2 text-[10px] text-[#8192b0]">
                  Object properties hidden. Expand when you need detailed editing controls.
                </div>
              )}
            </div>

            <div className="shrink-0">
              <SectionToggle
                title="Simulation Assumptions"
                summary={assumptionsSummary}
                open={assumptionsOpen}
                onToggle={() => setAssumptionsOpen((current) => !current)}
              />
              {assumptionsOpen ? (
                <div className="mt-2 overflow-hidden">
                  <AssumptionsPanel />
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2 text-[10px] text-[#8192b0]">
                  Assumptions stay tucked away until you need to tune the model.
                </div>
              )}
            </div>

            <div className="shrink-0">
              <SectionToggle
                title="Scenario / Path"
                summary={viewMode === "replay" ? "Replay workspace active" : "Path replay and editing"}
                open={pathOpenEffective}
                onToggle={() => setPathOpen((current) => !current)}
              />
              {pathOpenEffective ? (
                <div className="mt-2 overflow-hidden">
                  <ScenarioPathPanel />
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2 text-[10px] text-[#8192b0]">
                  Path controls are hidden. Expand them for replay and scenario editing.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
