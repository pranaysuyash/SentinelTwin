"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface MiniStatProps {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  valueClassName: string;
  className?: string;
  detailClassName?: string;
  "aria-label"?: string;
}

export function MiniStat({
  label,
  value,
  detail,
  valueClassName,
  className,
  detailClassName,
  "aria-label": ariaLabel,
}: MiniStatProps) {
  return (
    <article
      role="group"
      aria-label={ariaLabel}
      className={cn("rounded-2xl border border-[color:var(--st-border)] bg-white/[0.025] p-3", className)}
      aria-live="polite"
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--st-muted)]">{label}</div>
      <div suppressHydrationWarning className={cn("mt-1 text-2xl font-semibold tracking-tight", valueClassName)}>
        {value}
      </div>
      <div className={cn("mt-1 text-[11px] text-[color:var(--st-muted)]", detailClassName)}>{detail}</div>
    </article>
  );
}
