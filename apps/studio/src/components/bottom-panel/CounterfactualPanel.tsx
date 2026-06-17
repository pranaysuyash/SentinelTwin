"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";

import type { CounterfactualCandidate } from "@/agents/CounterfactualAgent";
import { TruthBadge } from "@/components/shared/TruthBadge";
import { useAiCommand } from "@/hooks/use-ai-command";
import { cn } from "@/lib/cn";
import type { CounterfactualConstraint, CounterfactualPlan } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

// ─── Cost colour helpers ──────────────────────────────────────────────────────

const COST_COLORS: Record<string, string> = {
  free: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

function costTier(totalCost: number): "free" | "low" | "medium" | "high" {
  if (totalCost === 0) return "free";
  if (totalCost < 100) return "low";
  if (totalCost < 500) return "medium";
  return "high";
}

function parseConstraints(raw: string): CounterfactualConstraint {
  return {
    noNewWiring: /no.*(new.*(wiring|cable|install)|wiring)/i.test(raw),
    privacyPreserving: /privacy/i.test(raw),
    maxBudget: (() => {
      const m = raw.match(/budget\s*[:=]?\s*\$?\s*(\d+)/i);
      return m ? Number(m[1]) : undefined;
    })(),
  };
}

// ─── Delta badge (shared by both sim and AI cards) ────────────────────────────

function DeltaBadge({
  value,
  label,
  positive,
  suffix = "%",
}: {
  value: number;
  label: string;
  positive?: "up" | "down";
  suffix?: string;
}) {
  const isGood = positive === "up" ? value > 0 : positive === "down" ? value < 0 : false;
  const isBad = positive === "up" ? value < 0 : positive === "down" ? value > 0 : false;

  return (
    <div className="flex items-center gap-1 text-[9px]">
      <span className="text-[#647089]">{label}</span>
      <span
        className={cn(
          "font-mono font-medium",
          isGood ? "text-emerald-400" : isBad ? "text-red-400" : "text-[#9da8c0]",
        )}
      >
        {value > 0 ? "+" : ""}
        {value}
        {suffix}
      </span>
    </div>
  );
}

// ─── Simulation-engine plan card ──────────────────────────────────────────────

interface SimPlanCardProps {
  plan: CounterfactualPlan;
  isActive: boolean;
  onPreview: () => void;
  onApply: () => void;
  onRevert: () => void;
}

function SimPlanCard({ plan, isActive, onPreview, onApply, onRevert }: SimPlanCardProps) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const tier = costTier(plan.totalCost);
  const improvementPct = plan.simulatedImprovementPct ?? 0;

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
        className={cn(
          "rounded-xl border p-3 transition-colors",
          isActive
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-[#1f2536] bg-[#0b0f17]",
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-[9px] font-bold",
                COST_COLORS[tier],
              )}
            >
              <Cpu className="size-2.5" />
            </span>
            <p className="text-[11px] leading-snug text-[#d7deed] min-w-0">{plan.label}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider",
              COST_COLORS[tier],
            )}
          >
            {plan.totalCost === 0 ? "free" : `$${plan.totalCost}`}
          </span>
        </div>

        {/* Coverage delta summary */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-[#1a2030] bg-[#07090f]/60 px-2 py-1.5">
          <DeltaBadge value={Number(improvementPct.toFixed(1))} label="Coverage" positive="up" />
          {plan.simulatedCoveragePct !== undefined && (
            <div className="flex items-center gap-1 text-[9px]">
              <span className="text-[#647089]">→ total</span>
              <span className="font-mono font-medium text-[#9da8c0]">
                {Math.round(plan.simulatedCoveragePct)}%
              </span>
            </div>
          )}
          {(plan.zoneDeltas?.filter((z) => z.improved).length ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400">
              <CheckCircle2 className="size-3" />
              {plan.zoneDeltas!.filter((z) => z.improved).length} zone
              {plan.zoneDeltas!.filter((z) => z.improved).length !== 1 ? "s" : ""} resolved
            </span>
          )}
        </div>

        {/* Expandable zone deltas */}
        {(plan.zoneDeltas?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 flex w-full items-center gap-1 text-[9px] text-[#4d5870] hover:text-[#8094b8] transition-colors"
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? "Hide" : "Show"} zone breakdown
          </button>
        )}
        {expanded && plan.zoneDeltas && plan.zoneDeltas.length > 0 && (
          <div className="mt-1.5 space-y-0.5 rounded-lg border border-[#1a2030] bg-[#07090f]/50 px-2 py-1.5">
            {plan.zoneDeltas.map((z) => (
              <div key={z.zoneId} className="flex items-center justify-between gap-2 text-[9px]">
                <span className="truncate text-[#7b89a5]">{z.zoneId}</span>
                <span
                  className={cn(
                    "shrink-0 font-mono",
                    z.improved ? "text-emerald-400" : "text-[#7b89a5]",
                  )}
                >
                  {z.baselineStatus} <ArrowRight className="inline size-2.5" /> {z.proposedStatus}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-1.5 flex items-center gap-1.5">
          {isActive ? (
            <>
              <button
                type="button"
                onClick={onApply}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                <CheckCircle2 className="size-3" />
                Apply Fix
              </button>
              <button
                type="button"
                onClick={onRevert}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5 text-[10px] text-[#8094b8] transition-colors hover:text-white"
              >
                <RotateCcw className="size-3" />
                Revert
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onPreview}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5 text-[10px] font-medium text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <Zap className="size-3" />
              Preview Fix
            </button>
          )}
        </div>
      </m.div>
    </LazyMotion>
  );
}

// ─── AI candidate card (existing AI path) ────────────────────────────────────

interface AiCandidateCardProps {
  candidate: CounterfactualCandidate;
  onApply: (ops: CounterfactualCandidate["operations"]) => void;
}

function AiCandidateCard({ candidate, onApply }: AiCandidateCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
        className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-[9px] font-bold",
                COST_COLORS[candidate.costCategory] ?? "text-[#647089] border-[#24283a]",
              )}
            >
              {candidate.rank}
            </span>
            <p className="text-[11px] leading-snug text-[#d7deed]">{candidate.description}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wider",
              COST_COLORS[candidate.costCategory] ?? "text-[#647089] border-[#24283a]",
            )}
          >
            {candidate.costCategory}
          </span>
        </div>

        {candidate.verifiedDelta && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-[#1a2030] bg-[#07090f]/60 px-2 py-1.5">
            <DeltaBadge
              value={candidate.verifiedDelta.totalCoveragePctDelta}
              label="Coverage"
              positive="up"
            />
            <DeltaBadge
              value={candidate.verifiedDelta.blindspotPctDelta}
              label="Blindspot"
              positive="down"
            />
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
              <span className="text-[9px] text-blue-400">
                {candidate.verifiedDelta.criticalZoneStatusChanges[0]}
              </span>
            )}
          </div>
        )}

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

// ─── Main panel ───────────────────────────────────────────────────────────────

type Mode = "sim" | "ai";

export function CounterfactualPanel() {
  const [constraints, setConstraints] = useState("");
  const [mode, setMode] = useState<Mode>("sim");
  const [scanning, setScanning] = useState(false);
  const [aiCandidates, setAiCandidates] = useState<CounterfactualCandidate[]>([]);
  const [showBatchCompare, setShowBatchCompare] = useState(false);

  // Deterministic engine path (from store)
  const counterfactualPlans = useStudioStore((s) => s.counterfactualPlans);
  const activeCounterfactualPlanId = useStudioStore((s) => s.activeCounterfactualPlanId);
  const generateCounterfactuals = useStudioStore((s) => s.generateCounterfactuals);
  const previewCounterfactualPlan = useStudioStore((s) => s.previewCounterfactualPlan);
  const applyCounterfactualPlan = useStudioStore((s) => s.applyCounterfactualPlan);
  const revertCounterfactualPreview = useStudioStore((s) => s.revertCounterfactualPreview);
  const hasResult = useStudioStore((s) => s.simulationResult !== null);

  // AI path (existing)
  const { status: aiStatus, runCounterfactuals, applyCandidate, mode: aiProviderMode } = useAiCommand();
  const aiAvailable = aiProviderMode.cloudAvailable;

  const handleSimScan = useCallback(() => {
    setScanning(true);
    // Run synchronously — engine is fast (<50ms typical)
    generateCounterfactuals(parseConstraints(constraints));
    setScanning(false);
  }, [constraints, generateCounterfactuals]);

  const handleAiPropose = useCallback(() => {
    const constraintList = constraints
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    runCounterfactuals(constraintList, setAiCandidates);
  }, [constraints, runCounterfactuals]);

  const handleApplyAi = useCallback(
    (ops: CounterfactualCandidate["operations"]) => {
      applyCandidate(ops);
    },
    [applyCandidate],
  );

  if (!hasResult) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
        <Lightbulb className="h-8 w-8 text-amber-400/40" />
        <p className="text-center text-[10px] leading-relaxed text-[#5b667c]">
          Run a simulation first to enable fix scanning.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-2">
      {/* Mode toggle + truth badge */}
      <div className="mb-2 flex items-center gap-2">
        <TruthBadge label="simulated" />
        <div className="ml-auto flex items-center rounded-lg border border-[#1e2130] bg-[#0a0d15] p-0.5">
          <button
            type="button"
            onClick={() => setMode("sim")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-[9px] font-medium transition-colors",
              mode === "sim"
                ? "bg-[#151c2f] text-emerald-300"
                : "text-[#5d6880] hover:text-[#9da8c0]",
            )}
          >
            <Cpu className="size-3" />
            Sim Scan
          </button>
          {aiAvailable && (
            <button
              type="button"
              onClick={() => setMode("ai")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-[9px] font-medium transition-colors",
                mode === "ai"
                  ? "bg-[#151c2f] text-purple-300"
                  : "text-[#5d6880] hover:text-[#9da8c0]",
              )}
            >
              <Sparkles className="size-3" />
              AI
            </button>
          )}
        </div>
      </div>

      {/* Constraint input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder={
            mode === "sim"
              ? "Constraints: budget $500, no new wiring, privacy…"
              : "Describe constraints (e.g., Camera 1 cannot move)"
          }
          className="min-w-0 flex-1 rounded-lg border border-[#24283a] bg-[#111521] px-2.5 py-1.5 text-[10px] text-white placeholder-[#4d566b] outline-none transition-colors focus:border-[#3a4158]"
        />
        <button
          type="button"
          onClick={mode === "sim" ? handleSimScan : handleAiPropose}
          disabled={scanning || aiStatus.state === "parsing"}
          aria-label={mode === "sim" ? "Scan for fixes" : "Propose AI fixes"}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40",
            mode === "sim"
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : "bg-purple-700 text-white hover:bg-purple-600",
          )}
        >
          {scanning || aiStatus.state === "parsing" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : mode === "sim" ? (
            <Cpu className="size-3.5" />
          ) : (
            <ArrowUpDown className="size-3.5" />
          )}
        </button>
        {(counterfactualPlans.length > 0 || aiCandidates.length > 0) && (
          <button
            type="button"
            aria-label="Clear results"
            onClick={() => {
              if (activeCounterfactualPlanId) revertCounterfactualPreview();
              setAiCandidates([]);
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#24283a] bg-[#111521] text-[#5d6880] hover:text-white"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Constraint hint (sim mode only) */}
      {mode === "sim" && counterfactualPlans.length === 0 && !scanning && (
        <p className="mt-1.5 text-[9px] leading-relaxed text-[#3d4d63]">
          Scans all cameras and obstructions, runs a simulation per candidate, and ranks by coverage gain. No API key required.
        </p>
      )}

      {/* Results */}
      <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
        {/* ── Sim mode results ── */}
        {mode === "sim" && (
          <>
            {scanning && (
              <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-emerald-300">
                <Loader2 className="size-4 animate-spin" />
                Scanning…
              </div>
            )}
            {!scanning && counterfactualPlans.length === 0 && (
              <p className="py-4 text-center text-[10px] text-[#4d566b]">
                Click scan to find simulation-backed fixes.
              </p>
            )}
            {!scanning && counterfactualPlans.length > 0 && (
              <p className="text-[9px] text-[#4d5870]">
                {counterfactualPlans.length} fix candidate
                {counterfactualPlans.length !== 1 ? "s" : ""} — ranked by coverage gain
              </p>
            )}
            {counterfactualPlans.map((plan) => (
              <SimPlanCard
                key={plan.planId}
                plan={plan}
                isActive={plan.planId === activeCounterfactualPlanId}
                onPreview={() => previewCounterfactualPlan(plan.planId)}
                onApply={() => applyCounterfactualPlan(plan.planId)}
                onRevert={revertCounterfactualPreview}
              />
            ))}
          </>
        )}

        {/* ── AI mode results ── */}
        {mode === "ai" && (
          <>
            {aiStatus.state === "parsing" && (
              <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-purple-300">
                <Loader2 className="size-4 animate-spin" />
                Asking AI for fixes…
              </div>
            )}
            {aiStatus.state === "error" && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-2 text-[10px] text-red-400">
                {aiStatus.message}
              </p>
            )}
            {aiCandidates.length > 0 && aiStatus.state !== "parsing" && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowBatchCompare((v) => !v)}
                  className="rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] font-medium text-[#9da8c0] transition-colors hover:border-[#3a4158] hover:text-white"
                >
                  {showBatchCompare ? "Card View" : "Batch Compare"}
                </button>
              </div>
            )}
            {aiCandidates.length === 0 && aiStatus.state !== "parsing" && (
              <p className="py-4 text-center text-[10px] text-[#4d566b]">
                Click the arrow to ask AI for fix suggestions.
              </p>
            )}
            {showBatchCompare && aiCandidates.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-[#1f2536] bg-[#0b0f17]">
                <table className="min-w-full text-[10px]">
                  <thead className="border-b border-[#1f2536] bg-[#111521] text-[#7a859d]">
                    <tr>
                      <th className="px-2 py-1.5 text-left">#</th>
                      <th className="px-2 py-1.5 text-left">Candidate</th>
                      <th className="px-2 py-1.5 text-left">Cost</th>
                      <th className="px-2 py-1.5 text-left">Coverage</th>
                      <th className="px-2 py-1.5 text-left">Blindspot</th>
                      <th className="px-2 py-1.5 text-left">Adversarial</th>
                      <th className="px-2 py-1.5 text-left">Zone Δ</th>
                      <th className="px-2 py-1.5 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiCandidates.map((c) => (
                      <tr key={c.id} className="border-b border-[#131a28] text-[#c7cfdf]">
                        <td className="px-2 py-1.5 font-mono text-[#9da8c0]">#{c.rank ?? "—"}</td>
                        <td className="max-w-[220px] px-2 py-1.5 text-[9px] leading-snug">{c.description}</td>
                        <td className="px-2 py-1.5 uppercase text-[#9da8c0]">{c.costCategory}</td>
                        <td className="px-2 py-1.5 font-mono">
                          {c.verifiedDelta?.totalCoveragePctDelta ?? 0}%
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {c.verifiedDelta?.blindspotPctDelta ?? 0}%
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          {c.verifiedDelta?.adversarialPathExposureDelta ?? "—"}
                        </td>
                        <td className="px-2 py-1.5">{c.verifiedDelta?.criticalZoneStatusChanges.length ?? 0}</td>
                        <td className="px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => handleApplyAi(c.operations)}
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
              aiCandidates.map((c) => (
                <AiCandidateCard key={c.id} candidate={c} onApply={handleApplyAi} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
