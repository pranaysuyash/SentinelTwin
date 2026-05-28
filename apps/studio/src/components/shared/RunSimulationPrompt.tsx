"use client";

import { Loader2, Zap } from "lucide-react";

import { useStudioStore } from "@/store/studio-store";

export function RunSimulationPrompt({
  message,
  buttonLabel = "Run Simulation",
  className = "",
}: {
  message: string;
  buttonLabel?: string;
  className?: string;
}) {
  const runSimulation = useStudioStore((s) => s.runSimulation);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);

  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}>
      <div className="text-[10px] leading-relaxed text-[#4d566b]">{message}</div>
      <button
        type="button"
        onClick={runSimulation}
        disabled={simulationRunning}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-3 py-2 text-[10px] font-medium text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {simulationRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        {simulationRunning ? "Running..." : buttonLabel}
      </button>
    </div>
  );
}
