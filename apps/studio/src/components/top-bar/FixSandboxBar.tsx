"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  Shield,
} from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import { cn } from "@/lib/cn";

export function FixSandboxBar() {
  const fixSandboxActive = useStudioStore((s) => s.fixSandboxActive);
  const fixSandboxDiff = useStudioStore((s) => s.fixSandboxDiff);
  const enterFixSandbox = useStudioStore((s) => s.enterFixSandbox);
  const exitFixSandbox = useStudioStore((s) => s.exitFixSandbox);
  const applyFixSandbox = useStudioStore((s) => s.applyFixSandbox);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const runSimulation = useStudioStore((s) => s.runSimulation);

  if (!fixSandboxActive) {
    return (
      <div className="flex items-center gap-2">
        <button type="button"
          onClick={enterFixSandbox}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
          title="Open a sandbox to test changes without affecting the scene"
        >
          <Shield className="h-3 w-3" />
          Test Changes
        </button>
      </div>
    );
  }

  const needsRecompute = simulationDirty || fixSandboxDiff.needsRecompute;

  return (
    <div className="flex h-10 items-center gap-3 border-b border-amber-500/20 bg-amber-500/5 px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15">
          <Shield className="h-3 w-3 text-amber-400" />
        </div>
        <span className="text-[12px] font-semibold text-amber-300">Fix Sandbox Active</span>
      </div>

      <div className="h-4 w-px bg-amber-500/20" />

      <div className="flex items-center gap-3 text-[11px] text-[#b0b9ce]">
        <span>
          <span className="font-medium text-[#c7d0e4]">{fixSandboxDiff.camerasChanged}</span> camera{fixSandboxDiff.camerasChanged === 1 ? "" : "s"} changed
        </span>
        <span>
          <span className="font-medium text-[#c7d0e4]">{fixSandboxDiff.zonesAffected}</span> zone{fixSandboxDiff.zonesAffected === 1 ? "" : "s"} affected
        </span>
      </div>

      {/* Needs Recompute badge */}
      {needsRecompute && !simulationRunning && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          Needs Recompute
        </span>
      )}
      {simulationRunning && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </span>
      )}
      {!needsRecompute && !simulationRunning && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          Simulated
        </span>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Run simulation on sandbox */}
        <button type="button"
          onClick={runSimulation}
          disabled={simulationRunning}
          className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-semibold transition-colors",
            simulationRunning
              ? "border border-green-900/40 bg-green-900/25 text-green-600"
              : "bg-green-600/80 text-white hover:bg-green-500",
          )}
        >
          {simulationRunning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          {simulationRunning ? "Simulating..." : "Simulate"}
        </button>

        {/* Apply Changes — green */}
        <button type="button"
          onClick={applyFixSandbox}
          className="inline-flex h-6 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-[10px] font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          <CheckCircle2 className="h-3 w-3" />
          Apply Changes
        </button>

        {/* Discard — red */}
        <button type="button"
          onClick={exitFixSandbox}
          className="inline-flex h-6 items-center gap-1.5 rounded-lg bg-red-600/80 px-2.5 text-[10px] font-semibold text-white transition-colors hover:bg-red-500"
        >
          <X className="h-3 w-3" />
          Discard
        </button>
      </div>
    </div>
  );
}
