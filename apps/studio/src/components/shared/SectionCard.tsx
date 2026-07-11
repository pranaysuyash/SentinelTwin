"use client";

import { cn } from "@/lib/cn";
import { ExplainBadge } from "./ExplainBadge";
import { TruthBadge, type TruthLabel } from "./TruthBadge";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "none";
  title?: string;
  icon?: React.ReactNode;
  helpText?: string;
  helpLabel?: string;
  helpTitle?: string;
  truthLabel?: TruthLabel;
  action?: React.ReactNode;
}

export function SectionCard({ children, className, padding = "md", title, icon, helpText, helpLabel, helpTitle, truthLabel, action }: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
        padding === "md" && "p-2.5",
        padding === "sm" && "p-1.5",
        className,
      )}
    >
      {(title || icon || helpText || truthLabel || action) && (
        <div className="mb-2 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-1.5">
            {icon && <span className={`UI_SURFACES.textDimMid`}>{icon}</span>}
            {title && <div className={`text-[9px] font-semibold uppercase tracking-[0.2em] UI_SURFACES.textMuted`}>{title}</div>}
            {helpText && <ExplainBadge text={helpText} label={helpLabel} title={helpTitle} />}
          </div>
          <div className="flex items-center gap-1.5">
            {action}
            {truthLabel && <TruthBadge label={truthLabel} />}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
