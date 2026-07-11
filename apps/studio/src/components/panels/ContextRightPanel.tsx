"use client";

import { ChevronDown, ChevronRight, MapPinned, MonitorSmartphone } from "lucide-react";
import { useState } from "react";

import { ScenarioPathPanel } from "@/components/bottom-panel/ScenarioPathPanel";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { CameraInspector } from "@/components/inspector/CameraInspector";
import { AssumptionsPanel } from "@/components/panels/AssumptionsPanel";
import { IssuesTab } from "@/components/bottom-panel/IssuesTab";
import { SecurityOutcomePanel } from "@/components/security-outcome/SecurityOutcomePanel";
import { GovernanceReviewPanel } from "@/components/panels/GovernanceReviewPanel";
import { BulkCameraEditor } from "@/components/panels/BulkCameraEditor";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

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
    <div className={`flex w-full items-center gap-2 rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2 py-1 transition-colors UI_SURFACES.hoverBorderBright`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <div className={`flex h-5 w-5 items-center justify-center rounded-md border UI_SURFACES.borderThin UI_SURFACES.card UI_SURFACES.textMuted3`}>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[10px] font-semibold UI_SURFACES.textBody`}>{title}</div>
          <div className={`truncate text-[10px] uppercase tracking-[0.14em] UI_SURFACES.textMuted2`}>{summary}</div>
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
  const assumptionsSummary = `${scene.assumptions.doriStandard === "oodpcvs_2025" ? "Latest image standard (IEC 62676-4:2025)" : "Legacy image standard (DORI 2014)"} · ${scene.assumptions.timeOfDay} · ${scene.assumptions.interiorLightLevel} light`;

  return (
    <div className={`relative z-[120] flex h-full min-w-0 min-h-0 flex-col overflow-visible UI_SURFACES.panel`}>
      <div className={`flex items-center gap-2 border-b UI_SURFACES.borderPanel UI_SURFACES.panel px-2.5 py-1`}>
        <div className="flex h-5 w-5 items-center justify-center rounded-md border border-blue-500/20 bg-blue-500/12">
          <MonitorSmartphone className="h-3 w-3 text-blue-400" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-white">Context Inspector</div>
          <div className={`truncate text-[10px] uppercase tracking-[0.14em] UI_SURFACES.textMuted2`}>
            {workspacePreset.replace(/_/g, " ")} · {viewMode.replace(/_/g, " ")}
          </div>
        </div>
        <div className={`ml-auto inline-flex min-w-0 max-w-[42%] items-center gap-1 rounded-md border UI_SURFACES.borderThin UI_SURFACES.card px-1.5 py-0.5 text-[10px] UI_SURFACES.textMuted4`}>
          <MapPinned className="h-2.5 w-2.5" />
          <span className={cn("truncate", selectedNodeId ? `UI_SURFACES.textBody` : `UI_SURFACES.textMuted`)}>
            {selectedNodeId ?? "Scene overview"}
          </span>
        </div>
      </div>
      <div className={`flex min-w-0 items-center gap-1 overflow-x-auto border-b UI_SURFACES.borderPanel px-2 py-1`}>
        {([
          ["inspector", "Inspector"],
          ["security_status", "Security Status"],
          ["issues", "Issues"],
          ["recommendations", "Recommendations"],
          ["assumptions", "Assumptions"],
          ["camera_controls", "Camera Controls"],
          ["bulk_camera", "Bulk Cameras"],
          ["governance", "Governance Review"],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setRightPanelMode(mode)}
            title={label}
            className={cn("flex-shrink-0 whitespace-nowrap rounded px-2 py-1 text-[10px]", rightPanelMode === mode ? "UI_SURFACES.hoverBg text-white" : `UI_SURFACES.textMuted3 UI_SURFACES.hoverBg UI_SURFACES.hoverText`)}
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
        {rightPanelMode === "bulk_camera" && <div className="h-full overflow-y-auto"><BulkCameraEditor /></div>}
        {rightPanelMode === "governance" && <div className="h-full"><GovernanceReviewPanel /></div>}
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
                <div className={`mt-2 rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2.5 py-2 text-[10px] UI_SURFACES.textMuted3`}>
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
                <div className={`mt-2 rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2.5 py-2 text-[10px] UI_SURFACES.textMuted3`}>
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
                <div className={`mt-2 rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2.5 py-2 text-[10px] UI_SURFACES.textMuted3`}>
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
