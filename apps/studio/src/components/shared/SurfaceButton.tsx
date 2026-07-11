"use client";

import { cn } from "@/lib/cn";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function SurfaceButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button"
      {...props}
      className={cn(
        "inline-flex h-7 min-w-0 max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border UI_SURFACES.borderThin UI_SURFACES.card px-2.5 text-[11px] font-medium UI_SURFACES.textBody transition-colors UI_SURFACES.hoverBorderSubtle hover:text-white disabled:cursor-not-allowed disabled:border-green-900/40 disabled:bg-green-900/25 disabled:text-green-600 [&>span]:min-w-0 [&>span]:truncate",
        className,
      )}
    >
      {children}
    </button>
  );
}
