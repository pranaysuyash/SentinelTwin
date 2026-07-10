"use client";

import {
  Box,
  Camera,
  Copy,
  DoorClosed,
  GitCompare,
  Lightbulb,
  MessageSquare,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import {
  createCameraNode,
  createDoorNode,
  createObstructionNode,
  createSecurityLightNode,
} from "@/lib/node-factory";
import type { AnyEditableNode } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
export interface PlanContextMenuProps {
  position: { x: number; y: number };
  scenePoint: [number, number];
  targetNodeId: string | null;
  onClose: () => void;
}

function getNodeLabel(node: AnyEditableNode) {
  if ("name" in node && typeof node.name === "string") return node.name;
  if ("label" in node && typeof node.label === "string") return node.label;
  return "Object";
}

function getNodeKindLabel(node: AnyEditableNode) {
  switch (node.nodeType) {
    case "camera":
      return "Camera";
    case "security_light":
      return "Security Light";
    case "sensor":
      return "Sensor";
    case "obstruction":
      return "Obstruction";
    case "wall":
      return "Wall";
    case "door":
      return "Door";
    case "window":
      return "Window";
    case "critical_zone":
      return "Critical Zone";
    case "privacy_zone":
      return "Privacy Zone";
    default:
      return "Scene Node";
  }
}

export function PlanContextMenu({
  position,
  scenePoint,
  targetNodeId,
  onClose,
}: PlanContextMenuProps) {
  const scene = useStudioStore((s) => s.scene);
  const addNode = useStudioStore((s) => s.addNode);
  const duplicateNode = useStudioStore((s) => s.duplicateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const selectNode = useStudioStore((s) => s.selectNode);
  const addComment = useStudioStore((s) => s.addComment);
  const counterfactualObsId = useStudioStore((s) => s.counterfactualObsId);
  const runCounterfactual = useStudioStore((s) => s.runCounterfactual);
  const clearCounterfactual = useStudioStore((s) => s.clearCounterfactual);

  const targetNode = targetNodeId
    ? ([
        ...scene.cameras,
        ...scene.securityLights,
        ...scene.obstructions,
        ...scene.sensors,
        ...scene.doors,
        ...scene.windows,
        ...scene.walls,
        ...scene.criticalZones,
        ...scene.privacyZones,
      ].find((n) => n.id === targetNodeId) as AnyEditableNode | undefined)
    : undefined;

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const left = Math.min(position.x + 12, Math.max(12, viewportWidth - 310));
  const top = Math.min(position.y + 12, Math.max(12, viewportHeight - 380));

  const handleDuplicate = () => {
    if (!targetNode) return;
    // Canonical duplication: correct id prefixes, offset, and undo/evidence
    // handling live in the store action (same path as the 3D context menu).
    duplicateNode(targetNode.id);
    onClose();
  };

  const handleQuickAdd = (type: "camera" | "light" | "obstruction" | "door" | "comment") => {
    const [x, z] = scenePoint;
    if (type === "camera") {
      const node = createCameraNode([x, 2.8, z]);
      addNode(node);
      selectNode(node.id);
    } else if (type === "light") {
      const node = createSecurityLightNode([x, 2.8, z]);
      addNode(node);
      selectNode(node.id);
    } else if (type === "obstruction") {
      const node = createObstructionNode([x, 1.0, z], "shelf");
      addNode(node);
      selectNode(node.id);
    } else if (type === "door") {
      const node = createDoorNode([x, 0, z]);
      addNode(node);
      selectNode(node.id);
    } else if (type === "comment") {
      addComment([x, 1.5, z], "New annotation", "Operator", null);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close context menu"
        className="absolute inset-0 z-0 cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        className="absolute z-10 w-[290px] max-w-[90vw] overflow-hidden rounded-[20px] border border-white/10 bg-[#07111dcc] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        style={{
          left,
          top,
          boxShadow: "0 0 0 1px rgba(56,189,248,0.15), 0 24px 80px rgba(0, 0, 0, 0.56)",
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold tracking-tight text-white">
                {targetNode ? getNodeLabel(targetNode) : "2D Plan Canvas"}
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.22em] text-slate-400">
                {targetNode
                  ? getNodeKindLabel(targetNode)
                  : `X: ${scenePoint[0].toFixed(1)}m · Z: ${scenePoint[1].toFixed(1)}m`}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 ${UI_SURFACES.hoverText}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">
          {targetNode ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-400">Node Actions</div>
                <div className="h-px flex-1 bg-white/8" />
              </div>
              <div className="grid gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    selectNode(targetNode.id);
                    onClose();
                  }}
                  className="group flex min-h-[2.8rem] items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left transition-all hover:border-sky-400/40 hover:bg-sky-400/10"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/12 text-sky-100">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold tracking-[0.08em] uppercase">Inspect Node</div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-[0.15em] text-slate-400">Open in inspector</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="group flex min-h-[2.8rem] items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left transition-all hover:border-sky-400/40 hover:bg-sky-400/10"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/12 text-sky-100">
                    <Copy className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold tracking-[0.08em] uppercase">Duplicate Node</div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-[0.15em] text-slate-400">Clone at +1m offset</div>
                  </div>
                </button>

                {targetNode.nodeType === "obstruction" ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (counterfactualObsId === targetNode.id) {
                        clearCounterfactual();
                      } else {
                        runCounterfactual(targetNode.id);
                      }
                      onClose();
                    }}
                    className="group flex min-h-[2.8rem] items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left transition-all hover:border-sky-400/40 hover:bg-sky-400/10"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/12 text-sky-100">
                      <GitCompare className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-semibold tracking-[0.08em] uppercase">
                        {counterfactualObsId === targetNode.id ? "Clear Test" : "Test Without This"}
                      </div>
                      <div className="mt-0.5 text-[8px] uppercase tracking-[0.15em] text-slate-400">Counterfactual delta</div>
                    </div>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    removeNode(targetNode.id);
                    onClose();
                  }}
                  className="group flex min-h-[2.8rem] items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/8 px-2.5 py-2 text-left transition-all hover:border-red-400/50 hover:bg-red-500/14 text-red-100"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/12 text-red-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold tracking-[0.08em] uppercase">Delete Node</div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-[0.15em] text-red-300">Remove from scene</div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-400">Quick Add Here</div>
                <div className="h-px flex-1 bg-white/8" />
              </div>
              <div className="grid gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickAdd("camera")}
                  className="group flex min-h-[2.8rem] items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left transition-all hover:border-sky-400/40 hover:bg-sky-400/10"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/12 text-sky-100">
                    <Camera className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold tracking-[0.08em] uppercase">Add Camera</div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-[0.15em] text-slate-400">Mount at 2.8m height</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAdd("light")}
                  className="group flex min-h-[2.8rem] items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left transition-all hover:border-sky-400/40 hover:bg-sky-400/10"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/12 text-sky-100">
                    <Lightbulb className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold tracking-[0.08em] uppercase">Add Light</div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-[0.15em] text-slate-400">Security luminaire</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAdd("obstruction")}
                  className="group flex min-h-[2.8rem] items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left transition-all hover:border-sky-400/40 hover:bg-sky-400/10"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/12 text-sky-100">
                    <Box className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold tracking-[0.08em] uppercase">Add Obstruction</div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-[0.15em] text-slate-400">Fixed/movable obstacle</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAdd("door")}
                  className="group flex min-h-[2.8rem] items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left transition-all hover:border-sky-400/40 hover:bg-sky-400/10"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/12 text-sky-100">
                    <DoorClosed className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold tracking-[0.08em] uppercase">Add Door</div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-[0.15em] text-slate-400">Access portal</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickAdd("comment")}
                  className="group flex min-h-[2.8rem] items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left transition-all hover:border-sky-400/40 hover:bg-sky-400/10"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/12 text-sky-100">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-semibold tracking-[0.08em] uppercase">Add Annotation</div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-[0.15em] text-slate-400">Operator comment</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
