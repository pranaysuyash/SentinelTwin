"use client";

import { ChevronDown, LayoutGrid, Monitor, PencilRuler, Play, Shield, Sparkles, Columns3, FileText } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useStudioStore, type WorkspacePreset } from "@/store/studio-store";

const PRESETS: Array<{
  id: WorkspacePreset;
  label: string;
  icon: ReactNode;
  hint: string;
}> = [
  { id: "edit", label: "Edit", icon: <PencilRuler className="h-3.5 w-3.5" />, hint: "Balanced layout for scene building" },
  { id: "coverage", label: "Coverage", icon: <LayoutGrid className="h-3.5 w-3.5" />, hint: "Canvas-first review with inspector" },
  { id: "camera_wall", label: "Camera Wall", icon: <Monitor className="h-3.5 w-3.5" />, hint: "Minimal chrome for multi-feed review" },
  { id: "replay", label: "Replay", icon: <Play className="h-3.5 w-3.5" />, hint: "Timeline-forward path replay" },
  { id: "compare", label: "Compare", icon: <Columns3 className="h-3.5 w-3.5" />, hint: "Before/after scenario comparison" },
  { id: "report", label: "Report", icon: <FileText className="h-3.5 w-3.5" />, hint: "Reporting and handoff layout" },
  { id: "debug", label: "Debug", icon: <Sparkles className="h-3.5 w-3.5" />, hint: "Dense diagnostic workspace" },
  { id: "focus", label: "Focus", icon: <Shield className="h-3.5 w-3.5" />, hint: "Client demo mode with all docks hidden" },
];

export function WorkspacePresetSwitcher() {
  const preset = useStudioStore((s) => s.workspacePreset);
  const focusMode = useStudioStore((s) => s.focusMode);
  const setPreset = useStudioStore((s) => s.setWorkspacePreset);
  const restore = useStudioStore((s) => s.restorePreviousLayout);
  const [open, setOpen] = useState(false);

  const active = PRESETS.find((entry) => entry.id === preset) ?? PRESETS[0]!;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-7 min-w-[126px] items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 text-[11px] font-medium text-[#c7d0e4] transition-colors hover:border-[#32384d] hover:text-white"
      >
        {active.icon}
        <span>{active.label}</span>
        <ChevronDown className="h-3 w-3 text-[#546078]" />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-[#202536] bg-[#0f1320] p-1.5 shadow-2xl shadow-black/35"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-2 py-1 text-[9px] uppercase tracking-[0.22em] text-[#4d566b]">
            Workspace presets
          </div>
          <div className="grid gap-1">
            {PRESETS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  if (entry.id === "focus") {
                    if (focusMode) restore();
                    else setPreset("focus");
                  } else {
                    setPreset(entry.id);
                  }
                  setOpen(false);
                }}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[#171c2b]",
                  preset === entry.id ? "bg-[#171c2b] text-emerald-300" : "text-[#c7d0e4]",
                )}
              >
                <span className="mt-0.5 text-[#8da0c5]">{entry.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-medium">{entry.label}</span>
                  <span className="block text-[9px] leading-snug text-[#6c768f]">{entry.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
