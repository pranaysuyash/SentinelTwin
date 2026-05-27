"use client";

import { cn } from "@/lib/cn";

export function HorizontalDivider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-[#1e2130]", className)} />;
}
