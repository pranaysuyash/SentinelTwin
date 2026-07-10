"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { DockSide, WorkspacePreset } from "@/store/studio-store";
// Visual Pass V2 — collapsed docks render an icon rail (per the design-pack
// MiniMap board: collapsed = icon rail, compact = always-visible, expanded =
// drawer), not `return null`. The prior `return null` removed the affordance
// to bring a collapsed dock back except via keyboard shortcuts or contextual
// re-opening — operators would "lose" a dock and not know how to recover it.
// The rail keeps an always-visible expand button + the attention indicator.
import { UI_TONES } from "@/lib/design-tokens";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";
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

  // Visual Pass V2 — collapsed = icon rail, not invisible. A slim rail with
  // an expand affordance + the attention dot so operators can always recover
  // a collapsed dock and see when something behind it wants attention.
  if (collapsed) {
    const railDimensionStyle = isBottom ? { height: "28px" } : { width: "28px" };
    const expandIcon = side === "left" ? "›" : side === "right" ? "‹" : "⌃";
    const attentionTone = UI_TONES.warning;
    return (
      <aside
        className={cn(
          `group relative flex flex-shrink-0 items-center justify-center ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel} transition-colors ${UI_SURFACES.hoverBg}`,
          isBottom ? "flex-row border-t" : "flex-col border-r",
          side === "right" && "border-l border-r-0",
          className,
        )}
        style={railDimensionStyle}
        aria-label={`${title} dock collapsed`}
      >
        <button
          type="button"
          onClick={onToggle}
          onFocus={onFocus}
          className={cn(
            `flex h-full w-full items-center justify-center ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverText}`,
            attention && `${attentionTone.text} font-bold`,
          )}
          title={
            attention
              ? `${title} — expand (needs attention)`
              : `Expand ${title}`
          }
          aria-expanded={false}
        >
          <span className="text-base leading-none">{expandIcon}</span>
        </button>
        {attention ? (
          <span
            className={cn(
              "absolute h-1.5 w-1.5 rounded-full",
              attentionTone.dot,
              isBottom ? "right-1.5 top-1.5" : "right-1.5 top-1.5",
            )}
            aria-hidden="true"
          />
        ) : null}
      </aside>
    );
  }

  const dimensionStyle = isBottom ? { height: sizePx } : { width: sizePx };

  return (
    <aside
      className={cn(
        `relative flex flex-shrink-0 overflow-hidden ${UI_SURFACES.borderPanel} ${UI_SURFACES.panel}`,
        isBottom ? "flex-col border-t" : "flex-col",
        className,
      )}
      style={dimensionStyle}
    >
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      <ResizeHandle side={side} sizePx={sizePx} onResize={onResize} />
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          `absolute z-30 inline-flex h-6 w-6 items-center justify-center rounded-md border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorderSubtle} ${UI_SURFACES.hoverText}`,
          isBottom ? "right-2 top-2" : side === "left" ? "right-2 top-2" : "left-2 top-2",
        )}
        title={`Collapse ${title}`}
        aria-expanded={true}
      >
        {side === "left" ? "‹" : side === "right" ? "›" : "⌄"}
      </button>
    </aside>
  );
}
