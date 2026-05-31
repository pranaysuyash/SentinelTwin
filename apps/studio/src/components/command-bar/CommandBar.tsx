"use client";

import { motion } from "framer-motion";
import { ArrowUp, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAiCommand } from "@/hooks/use-ai-command";
import type { CounterfactualCandidate } from "@/agents/CounterfactualAgent";
import { summarizeAiActionTelemetry } from "@/lib/ai-action-telemetry";
import { useStudioStore } from "@/store/studio-store";

const COST_COLORS: Record<string, string> = {
  free: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10",
  partial: "text-amber-200 border-amber-500/20 bg-amber-500/10",
  blocked: "text-red-200 border-red-500/20 bg-red-500/10",
};

const TELEMETRY_COLORS: Record<string, string> = {
  ready: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10",
  guarded: "text-amber-200 border-amber-500/20 bg-amber-500/10",
  blocked: "text-red-200 border-red-500/20 bg-red-500/10",
};

export function CommandBar() {
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { status, executeCommand, dismissError, applyCandidate, confirmPreview, cancelPreview, mode, providerHealth, providerTelemetry, latestAiActionTelemetry } = useAiCommand();
  const aiActionTelemetry = useStudioStore((s) => s.aiActionTelemetry);
  const visible = useStudioStore((s) => s.visibleComponents.command_bar);
  const aiActionTelemetrySummary = useMemo(() => summarizeAiActionTelemetry(aiActionTelemetry), [aiActionTelemetry]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    executeCommand(trimmed);
    setInput("");
  }, [input, executeCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Keyboard shortcut: Cmd+K or Ctrl+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsExpanded((prev) => !prev);
        if (!isExpanded) {
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isExpanded]);

  // Auto-focus when expanded
  useEffect(() => {
    if (isExpanded) {
      inputRef.current?.focus();
    }
  }, [isExpanded]);

  useEffect(() => {
    startTransition(() => {
      setHasMounted(true);
    });
  }, []);

  const healthStatus = hasMounted ? providerHealth.overallStatus : "partial";
  const telemetryStatus = hasMounted ? providerTelemetry.overallStatus : "guarded";
  const modeDetail = hasMounted ? mode.detail : "Syncing AI command state...";
  const compactHealthClass = hasMounted
    ? (HEALTH_COLORS[healthStatus] ?? HEALTH_COLORS.partial)
    : "text-slate-300 border-slate-500/20 bg-slate-500/10";
  const compactTelemetryClass = hasMounted
    ? (TELEMETRY_COLORS[telemetryStatus] ?? TELEMETRY_COLORS.guarded)
    : "text-slate-300 border-slate-500/20 bg-slate-500/10";
  const fullHealthClass = hasMounted
    ? (HEALTH_COLORS[healthStatus] ?? HEALTH_COLORS.partial)
    : "text-slate-300 border-slate-500/20 bg-slate-500/10";
  const fullTelemetryClass = hasMounted
    ? (TELEMETRY_COLORS[telemetryStatus] ?? TELEMETRY_COLORS.guarded)
    : "text-slate-300 border-slate-500/20 bg-slate-500/10";

  if (!visible) return null;

  if (!isExpanded) {
    return (
        <button type="button"
          onClick={() => setIsExpanded(true)}
          className="group absolute bottom-3 right-3 z-30 flex h-9 items-center gap-2 rounded-xl border border-[#1f2536] bg-[#0b0f17]/80 px-3 text-[10px] font-medium text-[#5b667c] shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition-[border-color,color,box-shadow] hover:border-[#32384d] hover:text-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
        >
        <Sparkles className="h-3.5 w-3.5 text-emerald-400/70 group-hover:text-emerald-400" />
        AI Command
        <span className="rounded-full border border-emerald-500/15 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] text-emerald-300">
          {mode.label}
        </span>
        <span className="rounded-full border border-[#24283a] bg-[#111521] px-1.5 py-0.5 text-[8px] text-[#8b96ab]">
          {mode.providerLabel}
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[8px] ${compactHealthClass}`}>
          {hasMounted ? (healthStatus === "healthy" ? "Healthy" : healthStatus === "partial" ? "Partial" : "Blocked") : "Syncing"}
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[8px] ${compactTelemetryClass}`}>
          {hasMounted ? (telemetryStatus === "ready" ? "Budget ready" : telemetryStatus === "guarded" ? "Budget guarded" : "Budget blocked") : "Syncing"}
        </span>
        <kbd className="ml-1 rounded border border-[#24283a] bg-[#111521] px-1 py-0.5 text-[8px] text-[#4d566b]">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="absolute bottom-3 left-3 right-3 z-30"
    >
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#1f2536] bg-[#0b0f17]/95 p-2 shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
        <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-[#1a2030] bg-[#07090f]/70 px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                {mode.label}
              </span>
              <span className="rounded-full border border-[#24283a] bg-[#111521] px-2 py-0.5 text-[8px] text-[#8b96ab]">
                {mode.providerLabel}
              </span>
              <span className="rounded-full border border-[#24283a] bg-[#111521] px-2 py-0.5 text-[8px] text-[#8b96ab]">
                {mode.cloudAvailable ? "Cloud-backed available" : "Local-only"}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[8px] ${fullHealthClass}`}>
                {hasMounted ? (healthStatus === "healthy" ? "Provider healthy" : healthStatus === "partial" ? "Provider partial" : "Provider blocked") : "Provider syncing"}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[8px] ${fullTelemetryClass}`}>
                {hasMounted ? (telemetryStatus === "ready" ? "Budget ready" : telemetryStatus === "guarded" ? "Budget guarded" : "Budget blocked") : "Budget syncing"}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-[#8b96ab]">{modeDetail}</p>
            <p className="mt-1 text-[10px] leading-snug text-[#7c8ba8]">Provider health: {providerHealth.healthyProviders} healthy / {providerHealth.partialProviders} partial / {providerHealth.blockedProviders} blocked.</p>
            <p className="mt-1 text-[10px] leading-snug text-[#7c8ba8]">Cost / latency: {providerTelemetry.activeCostLabel} · {providerTelemetry.activeLatencyLabel}.</p>
            <p className="mt-1 text-[10px] leading-snug text-[#7c8ba8]">Stage policy: {providerTelemetry.stagePolicies.map((stage) => `${stage.stage}:${stage.ready ? "ready" : "guarded"}`).join(" · ")}.</p>
            <p className="mt-1 text-[10px] leading-snug text-[#7c8ba8]">
              Latest measured action: {latestAiActionTelemetry ? `${latestAiActionTelemetry.stage} · ${latestAiActionTelemetry.durationMs} ms · ~${latestAiActionTelemetry.estimatedTotalTokens} tokens` : "none yet"}.
            </p>
            <p className="mt-1 text-[10px] leading-snug text-[#7c8ba8]">
              Telemetry trend: {aiActionTelemetrySummary.trendLabel} · {aiActionTelemetrySummary.trendNote}
            </p>
          </div>
          <button type="button"
            onClick={() => {
              setIsExpanded(false);
              dismissError();
            }}
            className="rounded-lg border border-[#24283a] bg-[#111521] p-1 text-[#5d6880] hover:border-[#32384d] hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Status indicators */}
        {status.state !== "idle" && (
          <div className="mb-2 rounded-xl border border-[#1a2030] bg-[#07090f]/60 px-3 py-2">
            {status.state === "parsing" && (
              <div className="flex items-center gap-2 text-[11px] text-amber-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking...
              </div>
            )}
            {status.state === "applying" && (
              <div className="flex items-center gap-2 text-[11px] text-blue-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Applying {status.descriptions.length} operation{status.descriptions.length > 1 ? "s" : ""}...
              </div>
            )}
            {status.state === "preview" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-cyan-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  {status.message}
                </div>
                {status.descriptions.length > 0 ? (
                  <ul className="space-y-1 rounded-md border border-[#1f2d45] bg-[#08101b] px-2.5 py-2 text-[10px] text-[#b8c9e8]">
                    {status.descriptions.map((description, index) => (
                      <li key={`desc-${index}`} /* stable order */ className="flex items-center gap-2">
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-[#14233a] px-1 text-[8px] text-cyan-200">{index + 1}</span>
                        <span>{description}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {status.requiresTargetSelection ? (
                  <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-100">
                    <div className="font-semibold uppercase tracking-[0.12em] text-amber-200">Target selection required</div>
                    <div className="mt-1">Select <span className="font-semibold">{status.unresolvedTarget ?? "the target"}</span> in the scene and run the command again.</div>
                    {status.candidateTargets && status.candidateTargets.length > 0 ? (
                      <div className="mt-1 text-[9px] text-amber-200/90">Matches: {status.candidateTargets.join(" • ")}</div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex justify-end gap-2">
                  <button type="button"
                    onClick={cancelPreview}
                    className="rounded border border-[#2a3347] bg-[#101827] px-2.5 py-1 text-[10px] text-[#aab8d2] hover:border-[#3a4967] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button type="button"
                    onClick={confirmPreview}
                    disabled={status.requiresTargetSelection}
                    className="rounded border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
            {status.state === "success" && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                {status.message}
              </div>
            )}
            {status.state === "error" && (
              <div className="flex items-start gap-2 text-[11px] text-red-300">
                <span className="mt-0.5">⚠</span>
                <span className="flex-1">{status.message}</span>
                <button type="button" onClick={dismissError} className="text-red-400/60 hover:text-red-300">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {status.state === "candidates" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  {status.description}
                </div>
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {status.candidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      onApply={() => {
                        applyCandidate(candidate.operations);
                        dismissError();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-400/60" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to modify the scene..."
            disabled={status.state === "parsing" || status.state === "applying"}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-white placeholder-[#4d566b] outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 disabled:opacity-50"
          />
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-[#3a4158]">Esc</span>
          </div>
          <button type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || status.state === "parsing" || status.state === "applying"}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white transition-colors hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600"
          >
            {status.state === "parsing" || status.state === "applying" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Quick hints */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["Move Camera 1 toward the entry", "Switch to night mode", "Turn off Camera 2", "Add a light near the counter"].map((hint) => (
            <button type="button"
              key={hint}
              onClick={() => {
                setInput(hint);
                inputRef.current?.focus();
              }}
              className="rounded-md border border-[#1e2536] bg-[#0d111a] px-2 py-1 text-[9px] text-[#5b667c] transition-colors hover:border-[#2a3146] hover:text-[#9da8c0]"
            >
              {hint}
            </button>
          ))}
        </div>
        <div className="mt-1.5 rounded-lg border border-[#1a2030] bg-[#07090f]/70 px-2.5 py-1.5 text-[9px] text-[#8090a8]">
          {mode.label}: recognized scene edits run locally. {mode.cloudAvailable ? "Cloud-backed parsing and fix proposals use a configured API key." : "Cloud-backed parsing and fix proposals are disabled by policy."}
        </div>
        {/* Slash commands */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {["/dusk", "/compare", "/replay", "/wall", "/camera-view", "/fail", "/fix", "/simulate", "/snapshot", "/privacy on", "/target license_plate"].map((cmd) => (
            <button type="button"
              key={cmd}
              onClick={() => {
                setInput(cmd);
                inputRef.current?.focus();
              }}
              className="rounded-md border border-[#1a2533] bg-[#0d141a] px-2 py-1 font-mono text-[9px] text-emerald-400/70 transition-colors hover:border-[#1a3540] hover:text-emerald-300"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/** Compact candidate card rendered inline in the command bar results. */
function CandidateCard({ candidate, onApply }: { candidate: CounterfactualCandidate; onApply: () => void }) {
  return (
    <div className="rounded-lg border border-[#1a2030] bg-[#07090f] px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5">
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[7px] font-bold ${
              COST_COLORS[candidate.costCategory] ?? "text-[#647089] border border-[#24283a]"
            }`}
          >
            {candidate.rank}
          </span>
          <p className="text-[10px] leading-snug text-[#c7d0e4]">{candidate.description}</p>
        </div>
        <span
          className={`shrink-0 rounded px-1 py-0.5 text-[7px] font-medium uppercase tracking-wider ${
            COST_COLORS[candidate.costCategory] ?? "text-[#647089]"
          }`}
        >
          {candidate.costCategory}
        </span>
      </div>
      {candidate.verifiedDelta && (
        <div className="mt-1 flex flex-wrap gap-3 rounded bg-[#0a0d15] px-2 py-1 text-[8px]">
          <span className={candidate.verifiedDelta.totalCoveragePctDelta >= 0 ? "text-emerald-400" : "text-red-400"}>
            {candidate.verifiedDelta.totalCoveragePctDelta >= 0 ? "+" : ""}{candidate.verifiedDelta.totalCoveragePctDelta}% cov
          </span>
          <span className={candidate.verifiedDelta.blindspotPctDelta <= 0 ? "text-emerald-400" : "text-red-400"}>
            {candidate.verifiedDelta.blindspotPctDelta >= 0 ? "+" : ""}{candidate.verifiedDelta.blindspotPctDelta}% blind
          </span>
          {candidate.verifiedDelta.worstIssueResolved && (
            <span className="text-emerald-400"><CheckCircle2 className="mr-0.5 inline h-2.5 w-2.5" />issue fixed</span>
          )}
        </div>
      )}
      <button type="button"
        onClick={onApply}
        className="mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded border border-[#24283a] bg-[#111521] py-1 text-[9px] font-medium text-emerald-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10"
      >
        <Sparkles className="h-2.5 w-2.5" />
        Apply This Fix
      </button>
    </div>
  );
}
