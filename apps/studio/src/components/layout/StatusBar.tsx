"use client";

import { useStudioStore } from "@/store/studio-store";
import { simulateStudio } from "@/simulation/simulate-studio";

function formatRunText(timestamp: number | null, durationMs: number | null) {
  if (!timestamp || durationMs === null) {
    return null;
  }

  return `Today, ${new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })} (${(durationMs / 1000).toFixed(1)}s)`;
}

export function StatusBar() {
  const running = useStudioStore((s) => s.simulationRunning);
  const result = useStudioStore((s) => s.simulationResult);
  const lastRunMs = useStudioStore((s) => s.lastRunMs);
  const autoRC = useStudioStore((s) => s.autoRecompute);
  const toggleAuto = useStudioStore((s) => s.toggleAutoRecompute);
  const visible = useStudioStore((s) => s.visibleComponents.status_bar);
  const scene = useStudioStore((s) => s.scene);
  const setSimulationRunning = useStudioStore((s) => s.setSimulationRunning);
  const setSimulationResult = useStudioStore((s) => s.setSimulationResult);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);

  if (!visible) return null;

  const runText = formatRunText(result?.computedAt ?? null, lastRunMs);
  const neverRun = !result?.computedAt;

  return (
    <footer className="flex h-6 flex-shrink-0 select-none items-center gap-4 border-t border-[#1e2130] bg-[#0b0c10] px-3">
      {/* Unsaved / stale indicator */}
      {simulationDirty ? (
        <span className="text-[10px] text-amber-400/80 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" />
          Scene changed
        </span>
      ) : null}

      <span className="text-[10px] text-[#3a4158]">Scale: 1 m/unit</span>
      <span className="text-[10px] text-[#3a4158]">Grid: 0.25 m</span>
      <div className="flex-1" />

      {/* Engine status with dot */}
      <span className="flex items-center gap-1.5 text-[10px] text-[#3a4158]">
        Engine:
        <span className={running ? "text-amber-400" : "text-green-500"}>
          {running ? "Running" : "Ready"}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-amber-400" : "bg-green-500"}`} />
      </span>

      {/* Last run — clickable to run when stale or never-run */}
      <button
        onClick={() => {
          if (!running) {
            setSimulationRunning(true);
            const start = performance.now();
            const simResult = simulateStudio(scene);
            setSimulationResult(simResult, performance.now() - start);
          }
        }}
        disabled={running}
        className={`text-[10px] transition-colors ${
          neverRun || simulationDirty
            ? "text-amber-500/70 hover:text-amber-400 cursor-pointer"
            : "text-[#3a4158] cursor-default"
        } ${running ? "opacity-50" : ""}`}
        title={
          running
            ? "Simulation in progress"
            : neverRun
              ? "No simulation yet — click to run"
              : simulationDirty
                ? "Scene changed — click to re-run"
                : undefined
        }
      >
        {running ? "Running…" : runText ? `Last Run: ${runText}` : "Click to simulate"}
      </button>

      {/* Auto recompute toggle */}
      <button
        onClick={toggleAuto}
        className="flex items-center gap-1.5 text-[10px] text-[#4a5568] transition-colors hover:text-white"
      >
        Auto:
        <span className={autoRC ? "text-green-400" : "text-[#4a5568]"}>{autoRC ? "On" : "Off"}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${autoRC ? "bg-green-400" : "bg-[#4a5568]"}`} />
      </button>

      {/* Mode indicator */}
      <span className="flex items-center gap-1.5 text-[10px] text-[#3a4158]">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        Local
      </span>
    </footer>
  );
}
