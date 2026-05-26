"use client";

import dynamic from "next/dynamic";
import { useSimulation } from "@/hooks/use-simulation";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";
import { LeftPanel } from "@/components/left-panel/LeftPanel";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { BottomPanel } from "@/components/bottom-panel/BottomPanel";
import { ScenarioPathPanel } from "@/components/bottom-panel/ScenarioPathPanel";
import { BottomRow } from "@/components/bottom-row/BottomRow";

// WorkspaceCanvas uses R3F + WebGL — must be dynamically imported with ssr:false
const WorkspaceCanvas = dynamic(
  () => import("@/components/workspace/WorkspaceCanvas").then((m) => m.WorkspaceCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-[#0b0c10]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] text-[#3a4158]">Initializing 3D Canvas...</span>
        </div>
      </div>
    ),
  },
);

export default function StudioShell() {
  useSimulation();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0b0c10] text-[#dde2ef]">
      <TopBar />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <LeftPanel />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <WorkspaceCanvas />
          <BottomPanel />
        </div>

        <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 304 }}>
          <InspectorPanel />
          <ScenarioPathPanel />
        </div>
      </div>

      <BottomRow />
      <StatusBar />
    </div>
  );
}
