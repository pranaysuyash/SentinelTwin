"use client";

import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/cn";
import type { InstallabilityResult } from "@/lib/installability-validator";

// ── Props ────────────────────────────────────────────────────────────────────

interface InstallabilityBadgeProps {
  result: InstallabilityResult;
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function InstallabilityBadge({ result, className }: InstallabilityBadgeProps) {
  const { overallValid, warnings, suggestions } = result;

  // Determine status tier.
  const isMarginal = !overallValid && warnings.length <= 2;
  const isFeasible = overallValid;

  let icon: React.ReactNode;
  let label: string;
  let variantClass: string;

  if (isFeasible) {
    icon = <CircleCheck className="h-3.5 w-3.5" />;
    label = "Installable";
    variantClass = "text-emerald-400 border-emerald-500/25 bg-emerald-500/8";
  } else if (isMarginal) {
    icon = <TriangleAlert className="h-3.5 w-3.5" />;
    label = "Marginal";
    variantClass = "text-amber-400 border-amber-500/25 bg-amber-500/8";
  } else {
    icon = <CircleX className="h-3.5 w-3.5" />;
    label = "Not feasible";
    variantClass = "text-red-400 border-red-500/25 bg-red-500/8";
  }

  return (
    <div className={cn("group relative inline-flex", className)}>
      {/* Badge */}
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
          variantClass,
        )}
      >
        {icon}
        {label}
      </span>

      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-[#1f2536] bg-[#0d111c] px-3 py-2.5 text-[10px] leading-relaxed opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {/* Status line */}
        <div className="mb-1.5 flex items-center gap-1.5">
          {icon}
          <span className="font-semibold text-white">{label}</span>
        </div>

        {/* Individual check statuses */}
        <div className="mb-1.5 space-y-0.5">
          {(
            [
              { key: "mountSurfaceValid" as const, label: "Mount surface" },
              { key: "mountHeightValid" as const, label: "Mount height" },
              { key: "angleValid" as const, label: "Pitch angle" },
              { key: "obstructionClearance" as const, label: "Obstruction clearance" },
              { key: "ladderAccessible" as const, label: "Ladder access" },
              { key: "cableReachable" as const, label: "Cable routing" },
            ] as const
          ).map(({ key, label: checkLabel }) => (
            <div key={key} className="flex items-center gap-1.5">
              {result[key] ? (
                <CircleCheck className="h-2.5 w-2.5 text-emerald-400" />
              ) : (
                <CircleX className="h-2.5 w-2.5 text-red-400" />
              )}
              <span className={cn("text-[9px]", result[key] ? "text-[#8a9bb5]" : "text-[#c7d0e4]")}>
                {checkLabel}
              </span>
            </div>
          ))}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mb-1.5">
            <div className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-amber-400">
              Warnings
            </div>
            <ul className="space-y-0.5">
              {warnings.map((w, index) => (
                <li key={`w-${index}`} className="flex items-start gap-1 text-[8px] text-[#8a9bb5]">
                  <span className="mt-0.5 text-amber-400">•</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <div className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-blue-400">
              Suggestions
            </div>
            <ul className="space-y-0.5">
              {suggestions.map((s, index) => (
                <li key={`s-${index}`} className="flex items-start gap-1 text-[8px] text-[#8a9bb5]">
                  <span className="mt-0.5 text-blue-400">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Arrow */}
        <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#1f2536] bg-[#0d111c]" />
      </div>
    </div>
  );
}
