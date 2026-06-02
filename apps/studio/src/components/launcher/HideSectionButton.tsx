"use client";

import { EyeOff } from "lucide-react";

export function HideSectionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-[color:var(--st-border)] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-[color:var(--st-muted)] transition-colors hover:border-sky-400/35 hover:text-white"
      aria-label={`Hide ${label}`}
      title={`Hide ${label}`}
    >
      <EyeOff className="h-3 w-3" />
      Hide
    </button>
  );
}
