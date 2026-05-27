"use client";

import { ChevronDown, ChevronRight, MapPinned, MonitorSmartphone } from "lucide-react";
import { useState } from "react";

import { ScenarioPathPanel } from "@/components/bottom-panel/ScenarioPathPanel";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { AssumptionsPanel } from "@/components/panels/AssumptionsPanel";
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
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-lg border border-[#1f2536] bg-[#0b0f17] px-2 py-1 text-left transition-colors hover:border-[#31405a]"
    >
      <div className="flex h-5 w-5 items-center justify-center rounded-md border border-[#24283a] bg-[#111521] text-[#7f8aa3]">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[9px] font-semibold text-[#d7deed]">{title}</div>
        <div className="truncate text-[7px] uppercase tracking-[0.18em] text-[#556076]">{summary}</div>
      </div>
    </button>
  );
}

export function ContextRightPanel() {
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const viewMode = useStudioStore((s) => s.viewMode);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const scene = useStudioStore((s) => s.scene);
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

  return (
    <div className="flex h-full min-w-0 min-h-0 flex-col overflow-hidden bg-[#0c0f16]">
      <div className="flex items-center gap-2 border-b border-[#1e2130] bg-[#0b0f17] px-2.5 py-1">
        <div className="flex h-5 w-5 items-center justify-center rounded-md border border-blue-500/20 bg-blue-500/12">
          <MonitorSmartphone className="h-3 w-3 text-blue-400" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[10px] font-semibold text-white">Context Inspector</div>
          <div className="truncate text-[8px] uppercase tracking-[0.18em] text-[#556076]">
            {workspacePreset.replace(/_/g, " ")} · {viewMode.replace(/_/g, " ")}
          </div>
        </div>
        <div className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-1.5 py-0.5 text-[8px] text-[#8f9bb1]">
          <MapPinned className="h-2.5 w-2.5" />
          <span className={cn("truncate", selectedNodeId ? "text-[#c7d0e4]" : "text-[#6c768f]")}>
            {selectedNodeId ?? "Scene overview"}
          </span>
        </div>
      </div>

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
            <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2 text-[9px] text-[#72809a]">
              Object properties hidden. Expand when you need detailed editing controls.
            </div>
          )}
        </div>

        <div className="shrink-0">
          <SectionToggle
            title="Simulation Assumptions"
            summary="PPM, light, and time settings"
            open={assumptionsOpen}
            onToggle={() => setAssumptionsOpen((current) => !current)}
          />
          {assumptionsOpen ? (
            <div className="mt-2 overflow-hidden">
              <AssumptionsPanel />
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2 text-[9px] text-[#72809a]">
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
            <div className="mt-2 rounded-xl border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2 text-[9px] text-[#72809a]">
              Path controls are hidden. Expand them for replay and scenario editing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
