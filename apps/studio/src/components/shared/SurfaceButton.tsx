"use client";

import { cn } from "@/lib/cn";

export function SurfaceButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button"
      {...props}
      className={cn(
        "inline-flex h-7 min-w-0 max-w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white disabled:cursor-not-allowed disabled:border-green-900/40 disabled:bg-green-900/25 disabled:text-green-600 [&>span]:min-w-0 [&>span]:truncate",
        className,
      )}
    >
      {children}
    </button>
  );
}
