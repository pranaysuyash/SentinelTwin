"use client";

import { MapPinned, MonitorSmartphone } from "lucide-react";

import { ScenarioPathPanel } from "@/components/bottom-panel/ScenarioPathPanel";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";

export function ContextRightPanel() {
  const workspacePreset = useStudioStore((s) => s.workspacePreset);
  const viewMode = useStudioStore((s) => s.viewMode);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0c0f16]">
      <div className="flex items-center gap-2 border-b border-[#1e2130] bg-[#0b0f17] px-3 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/12">
          <MonitorSmartphone className="h-3.5 w-3.5 text-blue-400" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-white">Context Inspector</div>
          <div className="truncate text-[9px] uppercase tracking-[0.18em] text-[#556076]">
            {workspacePreset.replace(/_/g, " ")} · {viewMode.replace(/_/g, " ")}
          </div>
        </div>
        <div className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] text-[#8f9bb1]">
          <MapPinned className="h-3 w-3" />
          <span className={cn("truncate", selectedNodeId ? "text-[#c7d0e4]" : "text-[#6c768f]")}>
            {selectedNodeId ?? "Scene overview"}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
          <InspectorPanel />
        </div>
        <div className="h-[208px] flex-shrink-0 overflow-hidden border-t border-[#1e2130]">
          <ScenarioPathPanel />
        </div>
      </div>
    </div>
  );
}
