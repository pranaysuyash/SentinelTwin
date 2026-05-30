"use client";

import { cn } from "@/lib/cn";

interface MiniStatProps {
  label: string;
  value: string;
  accent?: string;
  detail?: string;
}

export function MiniStat({ label, value, accent = "text-white", detail }: MiniStatProps) {
  return (
    <div className="rounded-2xl border border-[color:var(--st-border)] bg-white/[0.025] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--st-muted)]">{label}</div>
      <div suppressHydrationWarning className={cn("mt-1 text-2xl font-semibold tracking-tight", accent)}>{value}</div>
      {detail ? <div className="mt-1 text-[11px] text-[color:var(--st-muted)]">{detail}</div> : null}
    </div>
  );
}
