"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { DockSide, WorkspacePreset } from "@/store/studio-store";
import { DockRail } from "./DockRail";
import { ResizeHandle } from "./ResizeHandle";

export function DockPanel({
  side,
  title,
  subtitle,
  workspacePreset,
  collapsed,
  focusMode,
  attention,
  sizePx,
  onToggle,
  onResize,
  onFocus,
  children,
  className,
}: {
  side: DockSide;
  title: string;
  subtitle?: string;
  workspacePreset: WorkspacePreset;
  collapsed: boolean;
  focusMode: boolean;
  attention?: boolean;
  sizePx: number;
  onToggle: () => void;
  onResize: (sizePx: number) => void;
  onFocus?: () => void;
  children: ReactNode;
  className?: string;
}) {
  if (focusMode) return null;

  const isBottom = side === "bottom";
  const dimensionStyle = collapsed
    ? isBottom
      ? { height: 36 }
      : { width: 48 }
    : isBottom
      ? { height: sizePx }
      : { width: sizePx };

  return (
    <aside
      className={cn(
        "relative flex flex-shrink-0 overflow-hidden border-[#1e2130] bg-[#0c0f16]",
        isBottom ? "flex-col border-t" : "flex-col",
        className,
      )}
      style={dimensionStyle}
    >
      {collapsed ? (
        <DockRail
          side={side}
          title={title}
          subtitle={subtitle}
          workspacePreset={workspacePreset}
          attention={attention}
          onToggle={onToggle}
          onFocus={onFocus}
        />
      ) : (
        <>
          <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
          <ResizeHandle side={side} sizePx={sizePx} onResize={onResize} />
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "absolute z-30 inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#24283a] bg-[#111521] text-[#7f8aa3] transition-colors hover:border-[#32384d] hover:text-white",
              isBottom ? "right-2 top-2" : side === "left" ? "right-2 top-2" : "left-2 top-2",
            )}
            title={`Collapse ${title}`}
          >
            {side === "left" ? "‹" : side === "right" ? "›" : "⌄"}
          </button>
        </>
      )}
    </aside>
  );
}
