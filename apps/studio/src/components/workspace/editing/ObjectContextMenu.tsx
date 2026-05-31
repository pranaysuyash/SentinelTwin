"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Copy,
  Crosshair,
  FlipHorizontal,
  Move3D,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  Waypoints,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { ContextAction, ContextActionGroup, ContextMenuModel, ContextActionId } from "./object-context-actions";

const ACTION_ICON_MAP: Partial<Record<ContextActionId, ReactNode>> = {
  focus: <Crosshair className="h-3.5 w-3.5" />,
  duplicate: <Copy className="h-3.5 w-3.5" />,
  delete: <Trash2 className="h-3.5 w-3.5" />,
  open_camera_view: <Camera className="h-3.5 w-3.5" />,
  aim_at_selected_zone: <Crosshair className="h-3.5 w-3.5" />,
  snap_camera_wall: <Move3D className="h-3.5 w-3.5" />,
  snap_camera_ceiling: <Move3D className="h-3.5 w-3.5" />,
  snap_camera_pole: <Move3D className="h-3.5 w-3.5" />,
  move_forward: <ArrowUp className="h-3.5 w-3.5" />,
  move_back: <ArrowDown className="h-3.5 w-3.5" />,
  move_left: <ArrowLeft className="h-3.5 w-3.5" />,
  move_right: <ArrowRight className="h-3.5 w-3.5" />,
  move_up: <ArrowUp className="h-3.5 w-3.5" />,
  move_down: <ArrowDown className="h-3.5 w-3.5" />,
  rotate_left: <RotateCcw className="h-3.5 w-3.5" />,
  rotate_right: <RotateCw className="h-3.5 w-3.5" />,
  flip: <FlipHorizontal className="h-3.5 w-3.5" />,
  snap_to_wall: <Move3D className="h-3.5 w-3.5" />,
  door_toggle_open_close: <Waypoints className="h-3.5 w-3.5" />,
  door_toggle_lock: <Square className="h-3.5 w-3.5" />,
  window_toggle_open_close: <Waypoints className="h-3.5 w-3.5" />,
  wall_reverse: <FlipHorizontal className="h-3.5 w-3.5" />,
  path_reverse: <FlipHorizontal className="h-3.5 w-3.5" />,
};

function ActionButton({
  action,
  onClick,
}: {
  action: ContextAction;
  onClick: (actionId: ContextActionId) => void;
}) {
  return (
    <button
      type="button"
      disabled={!action.enabled}
      onClick={() => onClick(action.id)}
      className={cn(
        "group flex min-h-[3.1rem] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all",
        action.tone === "danger"
          ? "border-red-500/30 bg-red-500/8 text-red-100 hover:border-red-400/50 hover:bg-red-500/14"
          : "border-white/8 bg-white/[0.03] text-slate-100 hover:border-sky-400/40 hover:bg-sky-400/10",
        !action.enabled && "cursor-not-allowed opacity-45 hover:bg-white/[0.03]",
      )}
      title={action.disabledReason ?? action.label}
    >
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
        action.tone === "danger"
          ? "border-red-500/25 bg-red-500/12 text-red-100"
          : "border-sky-400/20 bg-sky-400/12 text-sky-100",
      )}>
        {ACTION_ICON_MAP[action.id] ?? <Move3D className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[10px] font-semibold tracking-[0.08em] uppercase">{action.label}</div>
        {action.hint ? <div className="mt-0.5 text-[8px] uppercase tracking-[0.15em] text-slate-400">{action.hint}</div> : null}
      </div>
    </button>
  );
}

function MenuGroup({ group, onClick }: { group: ContextActionGroup; onClick: (actionId: ContextActionId) => void }) {
  const compactGrid = group.id === "move" || group.id === "height" || group.id === "rotate";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-400">{group.label}</div>
        <div className="h-px flex-1 bg-white/8" />
      </div>
      <div className={cn(
        "grid gap-2",
        compactGrid ? "grid-cols-2" : "grid-cols-1",
      )}>
        {group.actions.map((action) => (
          <ActionButton key={action.id} action={action} onClick={onClick} />
        ))}
      </div>
    </div>
  );
}

export function ObjectContextMenu({
  model,
  position,
  onAction,
  onClose,
}: {
  model: ContextMenuModel | null;
  position: { x: number; y: number };
  onAction: (actionId: ContextActionId) => void;
  onClose: () => void;
}) {
  if (!model) return null;

  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const left = Math.min(position.x + 12, Math.max(12, viewportWidth - 328));
  const top = Math.min(position.y + 12, Math.max(12, viewportHeight - 420));

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close context menu"
        className="absolute inset-0 z-0 cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        className="absolute z-10 w-[300px] max-w-[90vw] overflow-hidden rounded-[20px] border border-white/10 bg-[#07111dcc] text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        style={{
          left,
          top,
          boxShadow: `0 0 0 1px ${model.accent}22, 0 24px 80px rgba(0, 0, 0, 0.56)`,
        }}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
      >
        <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold tracking-tight text-white">{model.title}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.22em] text-slate-400">{model.subtitle}</div>
            </div>
            <div
              className="mt-0.5 h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: model.accent, boxShadow: `0 0 0 3px ${model.accent}22` }}
            />
          </div>
        </div>

        <div className="space-y-3 px-3 py-3">
          {model.groups.map((group) => (
            <MenuGroup key={group.id} group={group} onClick={onAction} />
          ))}
        </div>

        <div className="border-t border-white/8 px-3 py-2 text-[8px] uppercase tracking-[0.18em] text-slate-500">
          Right-click object actions
        </div>
      </div>
    </div>
  );
}
