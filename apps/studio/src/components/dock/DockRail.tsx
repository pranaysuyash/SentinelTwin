"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Focus, PanelBottom, PanelLeft, PanelRight } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { DockSide, WorkspacePreset } from "@/store/studio-store";

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
  onToggle,
  onFocus,
}: {
  side: DockSide;
  title: string;
  subtitle?: string;
  workspacePreset: WorkspacePreset;
  onToggle: () => void;
  onFocus?: () => void;
}) {
  const isBottom = side === "bottom";

  return (
    <div
      className={cn(
        "flex h-full w-full items-stretch gap-1 border-[#1e2130] bg-[#0c0f16] text-[#c7d0e4]",
        isBottom ? "flex-row border-t px-1.5 py-1" : "flex-col border-r px-1 py-1.5",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-[#24283a] bg-[#111521] text-[#9aa6bd] transition-colors hover:border-[#32384d] hover:text-white",
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
          <div className="truncate text-[9px] font-semibold uppercase tracking-[0.2em] text-[#78839a]">
            {title}
          </div>
          <div className="truncate text-[9px] text-[#556076]">{subtitle ?? workspacePreset.replace(/_/g, " ")}</div>
        </div>

        <div className={cn("flex items-center gap-1", isBottom ? "ml-auto" : "mt-1")}>
          {onFocus ? (
            <button
              type="button"
              onClick={onFocus}
              className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[#24283a] bg-[#111521] text-[#7f8aa3] transition-colors hover:border-[#32384d] hover:text-white"
              title="Focus mode"
            >
              {FOCUS_ICON}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-[#24283a] bg-[#111521] text-[#7f8aa3] transition-colors hover:border-[#32384d] hover:text-white"
            title={`Collapse ${title}`}
          >
            {COLLAPSE_ICONS[side]}
          </button>
        </div>
      </div>
    </div>
  );
}
