"use client";

import { Copy, Shield, Trash2 } from "lucide-react";

import { BollardInspector } from "@/components/inspector/BollardInspector";
import { CameraInspector } from "@/components/inspector/CameraInspector";
import { CommentInspector } from "@/components/inspector/CommentInspector";
import { CriticalZoneInspector } from "@/components/inspector/CriticalZoneInspector";
import { DoorWindowInspector } from "@/components/inspector/DoorWindowInspector";
import { EntryPointInspector } from "@/components/inspector/EntryPointInspector";
import { FenceInspector } from "@/components/inspector/FenceInspector";
import { GateNodeInspector } from "@/components/inspector/GateNodeInspector";
import { LightInspector } from "@/components/inspector/LightInspector";
import { ObstructionInspector } from "@/components/inspector/ObstructionInspector";
import { PathInspector } from "@/components/inspector/PathInspector";
import { PrivacyZoneInspector } from "@/components/inspector/PrivacyZoneInspector";
import { SensorInspector } from "@/components/inspector/SensorInspector";
import { WallInspector } from "@/components/inspector/WallInspector";
import { Badge } from "@/components/shared/Badge";
import { useStudioStore } from "@/store/studio-store";

function NoSelection() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#1f2536] bg-[#0b0f17] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        <Shield className="h-5 w-5 text-[#434d63]" />
      </div>
      <div>
        <div className="text-[11px] font-medium text-[#95a0b7]">No object selected</div>
        <div className="mt-1 text-[9px] leading-relaxed text-[#556076]">
          Click any camera, wall, door, window, sensor, zone, path, light, or obstruction in the canvas to inspect it.
        </div>
      </div>
    </div>
  );
}

export function InspectorPanel({ showHeader = true }: { showHeader?: boolean } = {}) {
  const selectedId = useStudioStore((s) => s.selectedNodeId);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const scene = useStudioStore((s) => s.scene);
  const clearSelection = useStudioStore((s) => s.clearSelection);
  const duplicateNode = useStudioStore((s) => s.duplicateNode);
  const removeSelectedNodes = useStudioStore((s) => s.removeSelectedNodes);

  const camera = scene.cameras.find((entry) => entry.id === selectedId);
  const wall = scene.walls.find((entry) => entry.id === selectedId);
  const fence = (scene.fenceSegments ?? []).find((entry) => entry.id === selectedId);
  const gate = (scene.gateNodes ?? []).find((entry) => entry.id === selectedId);
  const bollard = (scene.bollardLines ?? []).find((entry) => entry.id === selectedId);
  const door = scene.doors.find((entry) => entry.id === selectedId);
  const windowNode = scene.windows.find((entry) => entry.id === selectedId);
  const obstruction = scene.obstructions.find((entry) => entry.id === selectedId);
  const light = scene.securityLights.find((entry) => entry.id === selectedId);
  const sensor = scene.sensors.find((entry) => entry.id === selectedId);
  const zone = scene.criticalZones.find((entry) => entry.id === selectedId);
  const privacyZone = scene.privacyZones.find((entry) => entry.id === selectedId);
  const comment = scene.comments?.find((entry) => entry.id === selectedId) ?? null;
  const path = scene.paths.find((entry) => entry.id === selectedId);
  const entryPoint = scene.entryPoints.find((entry) => entry.id === selectedId);

  const selectedCount = selectedNodeIds.length;
  const groupedSelection = selectedCount > 1;

  return (
    <aside className="flex h-full min-w-0 flex-1 flex-col overflow-hidden border-l border-[#1e2130] bg-[#0d1017]">
      {showHeader ? (
        <div className="flex h-8 items-center border-b border-[#1e2130] px-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#4a5568]">
          Inspector
        </div>
      ) : null}

      {groupedSelection ? (
        <div className="border-b border-[#1e2130] px-3 py-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold text-white">{selectedCount} objects selected</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-[#556076]">
                Primary inspector still follows the first selection
              </div>
            </div>
            <Badge variant="blue">{selectedCount} selected</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => duplicateNode(selectedId ?? selectedNodeIds[0] ?? "")}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#24304a] bg-[#111521] text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#3b4a69] hover:bg-[#172235]"
            >
              <Copy className="h-3 w-3" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => removeSelectedNodes()}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/15 text-[10px] font-medium text-red-300 transition-colors hover:border-red-700 hover:bg-red-950/30"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
            <button
              type="button"
              onClick={() => clearSelection()}
              className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#24304a] bg-[#111521] text-[10px] font-medium text-[#c7d0e4] transition-colors hover:border-[#3b4a69] hover:bg-[#172235]"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {camera ? (
        <CameraInspector />
      ) : wall ? (
        <WallInspector />
      ) : door ? (
        <DoorWindowInspector node={door} />
      ) : windowNode ? (
        <DoorWindowInspector node={windowNode} />
      ) : zone ? (
        <CriticalZoneInspector />
      ) : privacyZone ? (
        <PrivacyZoneInspector />
      ) : comment ? (
        <CommentInspector comment={comment} />
      ) : path ? (
        <PathInspector />
      ) : obstruction ? (
        <ObstructionInspector />
      ) : light ? (
        <LightInspector />
      ) : sensor ? (
        <SensorInspector />
      ) : entryPoint ? (
        <EntryPointInspector />
      ) : fence ? (
        <FenceInspector />
      ) : gate ? (
        <GateNodeInspector />
      ) : bollard ? (
        <BollardInspector />
      ) : (
        <NoSelection />
      )}
    </aside>
  );
}
