"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  type AudienceMode,
  audienceModeDescription,
  audienceModeLabel,
} from "@/lib/report-summary";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

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
      <label className={`text-[9px] font-semibold uppercase tracking-[0.2em] ${UI_SURFACES.textMuted}`}>
        Report Audience
      </label>
      <div className="relative">
        <select
          id="audience-mode-selector"
          value={value}
          onChange={(e) => onChange(e.target.value as AudienceMode)}
          className={cn(
            "w-full appearance-none rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeep}",
            "px-2.5 py-1.5 pr-7 text-[11px] ${UI_SURFACES.textBody}",
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
        <ChevronDown className={`pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 ${UI_SURFACES.textMuted}`} />
      </div>
      {showDescription && (
        <p className={`text-[9px] leading-relaxed ${UI_SURFACES.textMuted}`}>
          {audienceModeDescription(value)}
        </p>
      )}
    </div>
  );
}
