"use client";

import { motion } from "framer-motion";
import { Map, Monitor, Play } from "lucide-react";

import type { ViewMode } from "@/store/studio-store";
import { useStudioStore } from "@/store/studio-store";

const VIEW_OPTIONS: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: "map", label: "Map View", icon: <Map className="h-3.5 w-3.5" /> },
  { mode: "wall", label: "Camera Wall", icon: <Monitor className="h-3.5 w-3.5" /> },
  { mode: "replay", label: "Path Replay", icon: <Play className="h-3.5 w-3.5" /> },
];

export function ViewModeBar() {
  const viewMode = useStudioStore((s) => s.viewMode);
  const setViewMode = useStudioStore((s) => s.setViewMode);

  return (
    <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-[#1f2536] bg-[#0b0f17]/90 px-1 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.32)] backdrop-blur-sm">
      {VIEW_OPTIONS.map(({ mode, label, icon }) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium"
        >
          {viewMode === mode && (
            <motion.div
              layoutId="view-tab-bg"
              className="absolute inset-0 rounded-lg bg-[#1a2333] shadow-sm"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className={`relative z-10 flex items-center gap-1.5 transition-colors ${
            viewMode === mode ? "text-[#93c5fd]" : "text-[#5b667c] hover:text-[#8b96ab]"
          }`}>
            {icon}
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
