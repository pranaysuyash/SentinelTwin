"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Focus, PanelBottom, PanelLeft, PanelRight } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { DockSide, WorkspacePreset } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


const RAIL_ICONS: Record<DockSide, ReactNode> = {
  left: <PanelLeft className="h-3.5 w-3.5" />,
  right: <PanelRight className="h-3.5 w-3.5" />,
  bottom: <PanelBottom className="h-3.5 w-3.5" />,
};

const COLLAPSE_ICONS: Record<DockSide, ReactNode> = {
  left: <ChevronLeft className="h-3.5 w-3.5" />,
  right: <ChevronRight className="h-3.5 w-3.5" />,
  bottom: <ChevronDown className="h-3.5 w-3.5" />,
};

const FOCUS_ICON = <Focus className="h-3.5 w-3.5" />;

export function DockRail({
  side,
  title,
  subtitle,
  workspacePreset,
  attention,
  onToggle,
  onFocus,
}: {
  side: DockSide;
  title: string;
  subtitle?: string;
  workspacePreset: WorkspacePreset;
  attention?: boolean;
  onToggle: () => void;
  onFocus?: () => void;
}) {
  const isBottom = side === "bottom";

  return (
    <div
      className={cn(
        `flex h-full w-full items-stretch gap-1 UI_SURFACES.borderPanel UI_SURFACES.panel UI_SURFACES.textBody`,
        isBottom ? "flex-row border-t px-1.5 py-1" : "flex-col border-r px-1 py-1",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          `inline-flex items-center justify-center rounded-md border UI_SURFACES.borderThin UI_SURFACES.card UI_SURFACES.textMuted4 transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText`,
          attention && "border-amber-400/40 bg-amber-500/15 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]",
          isBottom ? "h-6 w-6 flex-shrink-0" : "h-7 w-7 flex-shrink-0",
        )}
        title={`Expand ${title}`}
      >
        {RAIL_ICONS[side]}
      </button>

      <div
        className={cn(
          "min-w-0 flex-1",
          isBottom ? "flex items-center gap-2 overflow-hidden" : "flex flex-col justify-between overflow-hidden",
        )}
      >
        <div className={cn("min-w-0", isBottom ? "flex items-center gap-2" : "space-y-0.5")}>
          <div className={`truncate text-[8px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textMuted3`}>
            {title}
          </div>
          <div className={`truncate text-[8px] UI_SURFACES.textMuted`}>{subtitle ?? workspacePreset.replace(/_/g, " ")}</div>
          {attention ? <div className="text-[8px] uppercase tracking-[0.14em] text-amber-200">Needs attention</div> : null}
        </div>

        <div className={cn("flex items-center gap-1", isBottom ? "ml-auto" : "mt-1")}>
          {onFocus ? (
            <button
              type="button"
              onClick={onFocus}
              className={`inline-flex h-5 w-5 items-center justify-center rounded-md border UI_SURFACES.borderThin UI_SURFACES.card UI_SURFACES.textMuted3 transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText`}
              title="Focus mode"
            >
              {FOCUS_ICON}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-md border UI_SURFACES.borderThin UI_SURFACES.card UI_SURFACES.textMuted3 transition-colors UI_SURFACES.hoverBorderSubtle UI_SURFACES.hoverText`}
            title={`Collapse ${title}`}
          >
            {COLLAPSE_ICONS[side]}
          </button>
        </div>
      </div>
    </div>
  );
}
