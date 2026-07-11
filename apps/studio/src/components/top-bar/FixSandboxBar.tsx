"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
  Shield,
} from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import { cn } from "@/lib/cn";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function FixSandboxBar() {
  const fixSandboxActive = useStudioStore((s) => s.fixSandboxActive);
  const fixSandboxDiff = useStudioStore((s) => s.fixSandboxDiff);
  // Trust Pass T3 — origin distinguishes operator-initiated sandboxes from
  // AI-proposal sandboxes so the chrome reads "AI proposed — verify before
  // committing" rather than ambiguous operator framing.
  const fixSandboxOrigin = useStudioStore((s) => s.fixSandboxOrigin);
  const enterFixSandbox = useStudioStore((s) => s.enterFixSandbox);
  const exitFixSandbox = useStudioStore((s) => s.exitFixSandbox);
  const applyFixSandbox = useStudioStore((s) => s.applyFixSandbox);
  const simulationDirty = useStudioStore((s) => s.simulationDirty);
  const simulationRunning = useStudioStore((s) => s.simulationRunning);
  const runSimulation = useStudioStore((s) => s.runSimulation);

  // Trust Pass T3 — AI-proposal sessions use a violet accent (distinct from
  // the operator sandbox's amber) so the operator can tell at a glance that
  // the pending change is an AI proposal awaiting their verification, not
  // their own edit. Per `AGENTS.md` canonical rule: "AI proposes. Simulation
  // verifies." — the chrome must make that contract visible.
  const isAiProposal = fixSandboxOrigin === "ai_proposal";
  const accentBorder = isAiProposal ? "border-violet-500/30" : "border-amber-500/30";
  const accentBg = isAiProposal ? "bg-violet-500/8" : "bg-amber-500/5";
  const accentText = isAiProposal ? "text-violet-300" : "text-amber-300";
  const accentIconColor = isAiProposal ? "text-violet-400" : "text-amber-400";
  const accentIconBg = isAiProposal ? "bg-violet-500/15 border-violet-500/30" : "bg-amber-500/15 border-amber-500/30";

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
    <div className={cn("flex h-10 items-center gap-3 border-b px-3", accentBorder, accentBg)}>
      <div className="flex items-center gap-2">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-full border", accentIconBg)}>
          {isAiProposal ? <Sparkles className={cn("h-3 w-3", accentIconColor)} /> : <Shield className={cn("h-3 w-3", accentIconColor)} />}
        </div>
        <span className={cn("text-[12px] font-semibold", accentText)}>
          {isAiProposal ? "AI Proposal — verify before committing" : "Fix Sandbox Active"}
        </span>
      </div>

      <div className={cn("h-4 w-px", isAiProposal ? "bg-violet-500/20" : "bg-amber-500/20")} />

      <div className="flex items-center gap-3 text-[11px] text-[#b0b9ce]">
        <span>
          <span className={`font-medium UI_SURFACES.textBody`}>{fixSandboxDiff.camerasChanged}</span> camera{fixSandboxDiff.camerasChanged === 1 ? "" : "s"} changed
        </span>
        <span>
          <span className={`font-medium UI_SURFACES.textBody`}>{fixSandboxDiff.zonesAffected}</span> zone{fixSandboxDiff.zonesAffected === 1 ? "" : "s"} affected
        </span>
      </div>

      {/* Needs Recompute badge */}
      {needsRecompute && !simulationRunning && (
        <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border bg-amber-500/8 px-2 py-0.5 text-[10px] font-semibold text-amber-300", accentBorder)}>
          <AlertTriangle className="h-3 w-3" />
          Review stale
        </span>
      )}
      {simulationRunning && (
        <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border bg-amber-500/8 px-2 py-0.5 text-[10px] font-semibold text-amber-300", accentBorder)}>
          <Loader2 className="h-3 w-3 animate-spin" />
          Verifying
        </span>
      )}
      {!needsRecompute && !simulationRunning && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          {isAiProposal ? "Verified — safe to apply" : "Reviewed"}
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
          {simulationRunning ? "Reviewing..." : "Run Review"}
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
