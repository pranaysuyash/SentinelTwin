"use client";

import { HelpCircle } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/cn";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

type ExplainBadgeProps = {
  text: string;
  label?: string;
  title?: string;
  className?: string;
  panelClassName?: string;
  side?: "left" | "right";
};

export function ExplainBadge({
  text,
  label,
  title = "How to read this",
  className,
  panelClassName,
  side = "right",
}: ExplainBadgeProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded border ${UI_SURFACES.borderDark} ${UI_SURFACES.hoverBgSubtle} ${UI_SURFACES.textMuted3} transition-colors ${UI_SURFACES.hoverBorderBright} hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50",
          label ? "h-6 px-1.5 text-[9px] font-medium" : "h-4 w-4",
        )}
        aria-label={label ? `${label}: ${title}` : title}
        aria-describedby={open ? id : undefined}
      >
        <HelpCircle className={label ? "h-3 w-3" : "h-3 w-3"} />
        {label ? <span>{label}</span> : null}
      </button>
      {open ? (
        <div
          id={id}
          role="tooltip"
          className={cn(
            "absolute top-full z-50 mt-1 w-64 rounded-md border ${UI_SURFACES.borderDark} ${UI_SURFACES.panelDeep} p-2 text-[10px] leading-snug text-[#c9d7f0] shadow-xl shadow-black/35",
            side === "right" ? "left-0" : "right-0",
            panelClassName,
          )}
        >
          {text}
        </div>
      ) : null}
    </div>
  );
}
