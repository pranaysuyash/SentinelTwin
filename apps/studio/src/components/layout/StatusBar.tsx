"use client";

import { useStudioStore } from "@/store/studio-store";

function formatRunText(timestamp: number | null, durationMs: number | null) {
  if (!timestamp || durationMs === null) {
    return "Last Run: Never";
  }

  const time = new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `Last Run: Today, ${time} (${(durationMs / 1000).toFixed(1)}s)`;
}

export function StatusBar() {
  const running = useStudioStore((s) => s.simulationRunning);
  const result = useStudioStore((s) => s.simulationResult);
  const lastRunMs = useStudioStore((s) => s.lastRunMs);
  const autoRC = useStudioStore((s) => s.autoRecompute);
  const toggleAuto = useStudioStore((s) => s.toggleAutoRecompute);

  return (
    <footer className="flex h-6 flex-shrink-0 select-none items-center gap-4 border-t border-[#1e2130] bg-[#0b0c10] px-3">
      <span className="text-[10px] text-[#3a4158]">Scene Scale: 1 unit = 1 meter</span>
      <span className="text-[10px] text-[#3a4158]">Grid: 0.25 m</span>
      <div className="flex-1" />
      <span className="text-[10px] text-[#3a4158]">
        Simulation Engine:{" "}
        <span className={running ? "text-amber-500" : "text-green-500"}>
          {running ? "Running" : "Ready"}
        </span>
      </span>
      <span className="text-[10px] text-[#3a4158]">{formatRunText(result?.computedAt ?? null, lastRunMs)}</span>
      <button
        onClick={toggleAuto}
        className="flex items-center gap-1.5 text-[10px] text-[#4a5568] transition-colors hover:text-white"
      >
        Auto Recompute:
        <span className={autoRC ? "text-green-400" : "text-[#4a5568]"}>{autoRC ? "On" : "Off"}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${autoRC ? "bg-green-400" : "bg-[#4a5568]"}`} />
      </button>
      <span className="flex items-center gap-1.5 text-[10px] text-[#3a4158]">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        Local Mode
      </span>
    </footer>
  );
}
