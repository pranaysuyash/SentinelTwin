"use client";

import { cn } from "@/lib/cn";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function HorizontalDivider({ className }: { className?: string }) {
  return <div className={cn("h-px ${UI_SURFACES.bgPanel}", className)} />;
}
