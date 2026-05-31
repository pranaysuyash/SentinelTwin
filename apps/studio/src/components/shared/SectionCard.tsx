"use client";

import { cn } from "@/lib/cn";
import { ExplainBadge } from "./ExplainBadge";
import { TruthBadge } from "./TruthBadge";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "none";
  title?: string;
  helpText?: string;
  helpLabel?: string;
  helpTitle?: string;
  truthLabel?: "simulated" | "inferred" | "real" | "placeholder";
}

export function SectionCard({ children, className, padding = "md", title, helpText, helpLabel, helpTitle, truthLabel }: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[#1f2536] bg-[#0b0f17] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
        padding === "md" && "p-2.5",
        padding === "sm" && "p-1.5",
        className,
      )}
    >
      {(title || helpText || truthLabel) && (
        <div className="mb-2 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-1.5">
            {title && <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">{title}</div>}
            {helpText && <ExplainBadge text={helpText} label={helpLabel} title={helpTitle} />}
          </div>
          {truthLabel && <TruthBadge label={truthLabel} />}
        </div>
      )}
      {children}
    </section>
  );
}
