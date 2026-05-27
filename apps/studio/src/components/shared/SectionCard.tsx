"use client";

import { cn } from "@/lib/cn";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "none";
  title?: string;
}

export function SectionCard({ children, className, padding = "md", title }: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[#1f2536] bg-[#0b0f17] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
        padding === "md" && "p-2.5",
        padding === "sm" && "p-1.5",
        className,
      )}
    >
      {title && (
        <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">{title}</div>
      )}
      {children}
    </section>
  );
}
