"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { ArrowUpDown, CheckCircle2, Lightbulb, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useState } from "react";

import type { CounterfactualCandidate } from "@/agents/CounterfactualAgent";
import { TruthBadge } from "@/components/shared/TruthBadge";
import { useAiCommand } from "@/hooks/use-ai-command";
import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";

const COST_COLORS: Record<string, string> = {
  free: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

function DeltaBadge({ value, label, positive, suffix = "%" }: { value: number; label: string; positive?: "up" | "down"; suffix?: string }) {
  const isGood = positive === "up" ? value > 0 : positive === "down" ? value < 0 : false;
  const isBad = positive === "up" ? value < 0 : positive === "down" ? value > 0 : false;

  return (
    <div className="flex items-center gap-1 text-[9px]">
      <span className="text-[#647089]">{label}</span>
      <span className={cn("font-mono font-medium", isGood ? "text-emerald-400" : isBad ? "text-red-400" : "text-[#9da8c0]")}>
        {value > 0 ? "+" : ""}{value}{suffix}
      </span>
    </div>
  );
}

interface CandidateCardProps {
  candidate: CounterfactualCandidate;
  onApply: (ops: CounterfactualCandidate["operations"]) => void;
}

function CandidateCard({ candidate, onApply }: CandidateCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
        className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3"
      >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "mt-0.5 flex size-5 flex-shrink-0 items-center justify-center rounded-md border text-[9px] font-bold",
              COST_COLORS[candidate.costCategory] ?? "text-[#647089] border-[#24283a]",
            )}
          >
            {candidate.rank}
          </span>
          <p className="text-[11px] leading-snug text-[#d7deed]">{candidate.description}</p>
        </div>
        <span
          className={cn(
            "flex-shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider",
            COST_COLORS[candidate.costCategory] ?? "text-[#647089] border-[#24283a]",
          )}
        >
          {candidate.costCategory}
        </span>
      </div>

      {/* Verified deltas */}
      {candidate.verifiedDelta && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-[#1a2030] bg-[#07090f]/60 px-2 py-1.5">
          <DeltaBadge value={candidate.verifiedDelta.totalCoveragePctDelta} label="Coverage" positive="up" />
          <DeltaBadge value={candidate.verifiedDelta.blindspotPctDelta} label="Blindspot" positive="down" />
          {typeof candidate.verifiedDelta.adversarialPathExposureDelta === "number" && (
            <DeltaBadge
              value={candidate.verifiedDelta.adversarialPathExposureDelta}
              label="Route exposure"
              positive="down"
              suffix=""
            />
          )}
          {candidate.verifiedDelta.worstIssueResolved && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400">
              <CheckCircle2 className="size-3" />
              Critical issues resolved
            </span>
          )}
          {candidate.verifiedDelta.criticalZoneStatusChanges.length > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-blue-400">
              {candidate.verifiedDelta.criticalZoneStatusChanges[0]}
            </span>
          )}
        </div>
      )}

      {/* Apply button */}
      <button
        type="button"
        onClick={() => onApply(candidate.operations)}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5 text-[10px] font-medium text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10"
      >
        <Sparkles className="size-3" />
        Apply This Fix
      </button>
      </m.div>
    </LazyMotion>
  );
}

export function CounterfactualPanel() {
  const [constraints, setConstraints] = useState("");
  const [candidates, setCandidates] = useState<CounterfactualCandidate[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [showBatchCompare, setShowBatchCompare] = useState(false);
  const { status, runCounterfactuals, applyCandidate } = useAiCommand();
  const store = useStudioStore();

  const handlePropose = useCallback(() => {
    const constraintList = constraints
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    runCounterfactuals(constraintList, setCandidates);
  }, [constraints, runCounterfactuals]);

  const handleApply = useCallback(
    (ops: CounterfactualCandidate["operations"]) => {
      applyCandidate(ops);
    },
    [applyCandidate],
  );

  const hasResult = store.simulationResult !== null;

  if (!showInput) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Lightbulb className="h-8 w-8 text-amber-400/40" />
        <p className="text-center text-[10px] text-[#5b667c] leading-relaxed max-w-[200px]">
          Find AI-suggested fixes for coverage issues in the current scene.
        </p>
        <button
          type="button"
          onClick={() => setShowInput(true)}
          disabled={!hasResult}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-3 py-2 text-[10px] font-medium text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 disabled:opacity-40 disabled:hover:bg-[#111521] disabled:hover:border-[#24283a]"
        >
          <Sparkles className="size-3.5" />
          Find Fixes
        </button>
        {!hasResult && (
          <p className="text-[9px] text-[#4d566b]">Run simulation first to enable counterfactual analysis.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-2">
      <div className="flex items-center gap-2 mb-2">
        <TruthBadge label="simulated" />
      </div>
      {/* Constraints input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder="Constraints (e.g., Camera 1 cannot move, Budget is low)"
          className="min-w-0 flex-1 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5 text-[10px] text-white placeholder-[#4d566b] outline-none transition-colors focus:border-[#3a4158]"
        />
        <button
          type="button"
          onClick={handlePropose}
          disabled={status.state === "parsing"}
          aria-label="Search for counterfactual fixes"
          className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
        >
          {status.state === "parsing" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowUpDown className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          aria-label="Close counterfactual panel"
          onClick={() => {
            setShowInput(false);
            setCandidates([]);
            setShowBatchCompare(false);
          }}
          className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg border border-[#24283a] bg-[#111521] text-[#5d6880] hover:text-white"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* Candidates list */}
      <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
        {candidates.length > 0 && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowBatchCompare((prev) => !prev)}
              className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#9da8c0] transition-colors hover:border-[#3a4158] hover:text-white"
            >
              {showBatchCompare ? "Card View" : "Batch Compare"}
            </button>
          </div>
        )}
        {candidates.length === 0 && status.state !== "parsing" && (
          <p className="py-4 text-center text-[10px] text-[#4d566b]">Click the arrow to search for fixes.</p>
        )}
        {status.state === "parsing" && (
          <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-amber-300">
            <Loader2 className="size-4 animate-spin" />
            Searching for fixes…
          </div>
        )}
        {showBatchCompare && candidates.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-[#1f2536] bg-[#0b0f17]">
            <table className="min-w-full text-[10px]">
              <thead className="border-b border-[#1f2536] bg-[#111521] text-[#7a859d]">
                <tr>
                  <th className="px-2 py-1.5 text-left">Rank</th>
                  <th className="px-2 py-1.5 text-left">Candidate</th>
                  <th className="px-2 py-1.5 text-left">Cost</th>
                  <th className="px-2 py-1.5 text-left">Coverage</th>
                  <th className="px-2 py-1.5 text-left">Blindspot</th>
                  <th className="px-2 py-1.5 text-left">Adversarial</th>
                  <th className="px-2 py-1.5 text-left">Zone changes</th>
                  <th className="px-2 py-1.5 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className="border-b border-[#131a28] text-[#c7cfdf]">
                    <td className="px-2 py-1.5 font-mono text-[#9da8c0]">#{candidate.rank ?? "-"}</td>
                    <td className="max-w-[220px] px-2 py-1.5 text-[9px] leading-snug text-[#d7deed]">{candidate.description}</td>
                    <td className="px-2 py-1.5 uppercase text-[#9da8c0]">{candidate.costCategory}</td>
                    <td className="px-2 py-1.5 font-mono">{candidate.verifiedDelta?.totalCoveragePctDelta ?? 0}%</td>
                    <td className="px-2 py-1.5 font-mono">{candidate.verifiedDelta?.blindspotPctDelta ?? 0}%</td>
                    <td className="px-2 py-1.5 font-mono">{candidate.verifiedDelta?.adversarialPathExposureDelta ?? "—"}</td>
                    <td className="px-2 py-1.5">{candidate.verifiedDelta?.criticalZoneStatusChanges.length ?? 0}</td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => handleApply(candidate.operations)}
                        className="rounded-md border border-[#2a3550] bg-[#131a28] px-1.5 py-1 text-[9px] text-emerald-300 hover:border-emerald-500/30 hover:bg-emerald-500/10"
                      >
                        Apply
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          candidates.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} onApply={handleApply} />
          ))
        )}
      </div>
    </div>
  );
}
