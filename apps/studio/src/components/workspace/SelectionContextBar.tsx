"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Copy,
  Crosshair,
  DoorOpen,
  Locate,
  Magnet,
  PanelRight,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/cn";
import {
  applyContextActionPlan,
  buildContextualMenuModel,
  findContextualNode,
  planContextualAction,
  type ContextAction,
  type ContextActionId,
} from "@/components/workspace/editing/object-context-actions";
import { useStudioStore } from "@/store/studio-store";

/**
 * Floating contextual task bar — Adobe-style progressive disclosure.
 *
 * When an object is selected (and no placement tool is active), a small bar
 * appears above the bottom edge of the canvas with the few actions that
 * matter for that object. Deeper actions stay in the right-click menu and
 * the inspector; this surface is the "first step" of exploration.
 *
 * It reuses the canonical context-action model and plan executor, so the
 * bar can never drift from the right-click menu's behavior.
 */

const QUICK_ACTION_ORDER: ContextActionId[] = [
  "aim_at_zone",
  "open_camera_view",
  "door_toggle_open_close",
  "snap_to_wall",
  "duplicate",
  "focus",
  "delete",
];

const MAX_QUICK_ACTIONS = 5;

const ACTION_ICONS: Partial<Record<ContextActionId, React.ReactNode>> = {
  aim_at_zone: <Crosshair className="h-3.5 w-3.5" />,
  open_camera_view: <Camera className="h-3.5 w-3.5" />,
  door_toggle_open_close: <DoorOpen className="h-3.5 w-3.5" />,
  snap_to_wall: <Magnet className="h-3.5 w-3.5" />,
  duplicate: <Copy className="h-3.5 w-3.5" />,
  focus: <Locate className="h-3.5 w-3.5" />,
  delete: <Trash2 className="h-3.5 w-3.5" />,
};

function pickQuickActions(actions: ContextAction[]): ContextAction[] {
  const byId = new Map(actions.map((action) => [action.id, action] as const));
  const picked: ContextAction[] = [];
  for (const id of QUICK_ACTION_ORDER) {
    const action = byId.get(id);
    if (action && action.enabled && ACTION_ICONS[id]) picked.push(action);
    if (picked.length >= MAX_QUICK_ACTIONS) break;
  }
  return picked;
}

export function SelectionContextBar() {
  const scene = useStudioStore((s) => s.scene);
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const selectedNodeIds = useStudioStore((s) => s.selectedNodeIds);
  const activeTool = useStudioStore((s) => s.activeTool);

  const updateNode = useStudioStore((s) => s.updateNode);
  const duplicateNode = useStudioStore((s) => s.duplicateNode);
  const removeNode = useStudioStore((s) => s.removeNode);
  const setFocusScenePointRequest = useStudioStore((s) => s.setFocusScenePointRequest);
  const setSelectedCameraId = useStudioStore((s) => s.setSelectedCameraId);
  const setViewMode = useStudioStore((s) => s.setViewMode);
  const setEditorFeedbackMessage = useStudioStore((s) => s.setEditorFeedbackMessage);
  const setRightPanelMode = useStudioStore((s) => s.setRightPanelMode);
  const setDockCollapsed = useStudioStore((s) => s.setDockCollapsed);

  const node = useMemo(
    () => (selectedNodeId ? findContextualNode(scene, selectedNodeId) : null),
    [scene, selectedNodeId],
  );

  const model = useMemo(
    () => (node ? buildContextualMenuModel(scene, node, selectedNodeIds) : null),
    [scene, node, selectedNodeIds],
  );

  const quickActions = useMemo(
    () => (model ? pickQuickActions(model.groups.flatMap((group) => group.actions)) : []),
    [model],
  );

  const visible = Boolean(node && model && activeTool === "select");

  const runAction = (actionId: ContextActionId) => {
    if (!node) return;
    const plan = planContextualAction(scene, node, actionId, selectedNodeIds);
    applyContextActionPlan(node.id, plan, {
      patchNode: (nodeId, patch) => updateNode(nodeId, patch),
      duplicateNode,
      removeNode,
      focusPoint: (point) => setFocusScenePointRequest({ point, source: "minimap" }),
      openCameraView: (cameraId) => {
        setSelectedCameraId(cameraId);
        setViewMode("camera_view");
      },
      showMessage: setEditorFeedbackMessage,
    });
  };

  return (
    <AnimatePresence>
      {visible && node && model ? (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.96 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="pointer-events-auto absolute bottom-14 left-1/2 z-20 -translate-x-1/2"
        >
          <div className="flex items-center gap-1 rounded-xl border border-[#222a3e] bg-[#0b0f17]/95 px-1.5 py-1 shadow-[0_14px_36px_rgba(0,0,0,0.45)] backdrop-blur">
            <div className="flex items-center gap-1.5 rounded-lg px-2 py-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: model.accent }} aria-hidden="true" />
              <span className="max-w-[120px] truncate text-[10px] font-semibold text-[#dde2ef]">{model.title}</span>
              <span className="text-[8px] uppercase tracking-[0.14em] text-[#5d6a85]">{model.subtitle}</span>
            </div>
            <div className="h-4 w-px bg-[#222a3e]" aria-hidden="true" />
            {quickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => runAction(action.id)}
                title={action.label}
                aria-label={action.label}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                  action.id === "delete"
                    ? "text-[#8b93a8] hover:bg-rose-500/15 hover:text-rose-300"
                    : "text-[#9aa6c0] hover:bg-white/8 hover:text-white",
                )}
              >
                {ACTION_ICONS[action.id]}
              </button>
            ))}
            <div className="h-4 w-px bg-[#222a3e]" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                setRightPanelMode("inspector");
                setDockCollapsed("right", false);
              }}
              title="Open Inspector"
              aria-label="Open Inspector"
              className="flex h-7 items-center gap-1 rounded-lg px-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9aa6c0] transition-colors hover:bg-white/8 hover:text-white"
            >
              <PanelRight className="h-3.5 w-3.5" />
              Inspect
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
