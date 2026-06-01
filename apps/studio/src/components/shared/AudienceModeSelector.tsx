"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  type AudienceMode,
  audienceModeDescription,
  audienceModeLabel,
} from "@/lib/report-summary";

const AUDIENCE_MODES: AudienceMode[] = [
  "operator",
  "consultant",
  "facilities_director",
  "operations_manager",
  "auditor",
  "insurer",
  "installer",
  "privacy_reviewer",
];

interface AudienceModeSelectorProps {
  value: AudienceMode;
  onChange: (mode: AudienceMode) => void;
  className?: string;
  /** If true, shows a brief description of the selected mode below the selector. */
  showDescription?: boolean;
}

export function AudienceModeSelector({
  value,
  onChange,
  className,
  showDescription = true,
}: AudienceModeSelectorProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#4a5568]">
        Report Audience
      </label>
      <div className="relative">
        <select
          id="audience-mode-selector"
          value={value}
          onChange={(e) => onChange(e.target.value as AudienceMode)}
          className={cn(
            "w-full appearance-none rounded-lg border border-[#1e2130] bg-[#0d1017]",
            "px-2.5 py-1.5 pr-7 text-[11px] text-[#c8d3e8]",
            "focus:outline-none focus:ring-1 focus:ring-blue-500/40",
            "cursor-pointer",
          )}
        >
          {AUDIENCE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {audienceModeLabel(mode)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#4a5568]" />
      </div>
      {showDescription && (
        <p className="text-[9px] leading-relaxed text-[#4a5568]">
          {audienceModeDescription(value)}
        </p>
      )}
    </div>
  );
}
