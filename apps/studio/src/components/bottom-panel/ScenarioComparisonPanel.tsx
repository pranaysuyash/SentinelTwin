"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Moon, Sun, Zap } from "lucide-react";
import { useState } from "react";

import { TruthBadge } from "@/components/shared/TruthBadge";
import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";

const SCENARIO_ICON: Record<string, React.ReactNode> = {
  normal_day: <Sun className="size-3 text-yellow-400" />,
  normal_night: <Moon className="size-3 text-blue-400" />,
  night_no_lights: <Moon className="size-3 text-red-400" />,
};

const SENSITIVITY_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  none: "text-[#4d5870] bg-[#111521] border-[#1f2536]",
};

function DeltaChip({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const good = value > 0;
  const bad = value < 0;
  return (
    <span
      className={cn(
        "font-mono text-[9px] font-medium",
        good ? "text-emerald-400" : bad ? "text-red-400" : "text-[#7a859d]",
      )}
    >
      {value > 0 ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}

export function ScenarioComparisonPanel() {
  const simulationResult = useStudioStore((s) => s.simulationResult);
  const scenarioBatchResults = useStudioStore((s) => s.scenarioBatchResults);
  const assumptionSensitivityResults = useStudioStore((s) => s.assumptionSensitivityResults);
  const runScenarioComparison = useStudioStore((s) => s.runScenarioComparison);
  const runAssumptionSensitivity = useStudioStore((s) => s.runAssumptionSensitivity);

  const [scenarioRunning, setScenarioRunning] = useState(false);
  const [sensitivityRunning, setSensitivityRunning] = useState(false);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  const baseline = simulationResult;

  const handleRunScenarios = () => {
    setScenarioRunning(true);
    setTimeout(() => {
      runScenarioComparison();
      setScenarioRunning(false);
    }, 10);
  };

  const handleRunSensitivity = () => {
    setSensitivityRunning(true);
    setTimeout(() => {
      runAssumptionSensitivity();
      setSensitivityRunning(false);
    }, 10);
  };

  if (!baseline) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
        <Zap className="h-8 w-8 text-amber-400/30" />
        <p className="text-center text-[10px] leading-relaxed text-[#5b667c]">
          Run a simulation first to enable scenario comparison and assumption sensitivity analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {/* ── Scenario Comparison ── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#4a5568]">
              Scenario Comparison
            </span>
            <TruthBadge label="simulated" />
          </div>
          <button
            type="button"
            onClick={handleRunScenarios}
            disabled={scenarioRunning}
            className="inline-flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] text-[#8094b8] transition-colors hover:border-[#3a4158] hover:text-white disabled:opacity-50"
          >
            {scenarioRunning ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
            {scenarioBatchResults ? "Re-run" : "Run Scenarios"}
          </button>
        </div>

        {!scenarioBatchResults && !scenarioRunning && (
          <p className="text-[9px] text-[#3d4d63]">
            Compares Day, Night, and Night-No-Lights against the baseline. Identifies which scenario causes the worst coverage degradation.
          </p>
        )}

        {scenarioRunning && (
          <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-blue-300">
            <Loader2 className="size-4 animate-spin" />
            Running 3 scenarios…
          </div>
        )}

        {scenarioBatchResults && !scenarioRunning && (
          <div className="space-y-1.5">
            {/* Baseline row */}
            <div className="rounded-xl border border-[#24283a] bg-[#0a0d15] px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="size-3 text-yellow-300" />
                  <span className="text-[10px] font-medium text-[#c7cfdf]">Baseline (current)</span>
                </div>
                <div className="flex items-center gap-3 text-[9px] text-[#7a859d]">
                  <span className="font-mono text-[#c7cfdf]">{baseline.totalCoveragePct.toFixed(1)}%</span>
                  <span>{baseline.criticalZoneResults.filter(z => z.status === "pass").length}/{baseline.criticalZoneResults.length} zones</span>
                </div>
              </div>
            </div>

            {scenarioBatchResults.map((sr) => {
              const isExpanded = expandedScenario === sr.scenarioId;
              const coverageDelta = sr.delta?.totalCoverageDeltaPct ?? (sr.totalCoveragePct - baseline.totalCoveragePct);
              const zonesDelta = sr.delta?.zonePassDelta ?? (sr.zonePassCount - baseline.criticalZoneResults.filter(z => z.status === "pass").length);
              const isWorst = coverageDelta < -10;

              return (
                <div
                  key={sr.scenarioId}
                  className={cn(
                    "rounded-xl border px-3 py-2 transition-colors",
                    isWorst ? "border-red-500/30 bg-red-950/10" : "border-[#1f2536] bg-[#0b0f17]",
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between"
                    onClick={() => setExpandedScenario(isExpanded ? null : sr.scenarioId)}
                  >
                    <div className="flex items-center gap-2">
                      {SCENARIO_ICON[sr.scenarioId] ?? <Moon className="size-3 text-[#4d5870]" />}
                      <span className="text-[10px] font-medium text-[#c7cfdf]">{sr.label}</span>
                      {isWorst && (
                        <span className="flex items-center gap-0.5 rounded-md border border-red-500/20 bg-red-500/10 px-1 py-0.5 text-[8px] text-red-400">
                          <AlertTriangle className="size-2" />
                          Worst case
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <DeltaChip value={coverageDelta} />
                      {isExpanded ? <ChevronUp className="size-3 text-[#4d5870]" /> : <ChevronDown className="size-3 text-[#4d5870]" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-[#1a2030] bg-[#07090f]/60 px-2 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] uppercase tracking-wider text-[#4d5870]">Coverage</span>
                        <span className="font-mono text-[10px] text-[#c7cfdf]">{sr.totalCoveragePct.toFixed(1)}%</span>
                        <DeltaChip value={coverageDelta} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] uppercase tracking-wider text-[#4d5870]">Zones passing</span>
                        <span className="font-mono text-[10px] text-[#c7cfdf]">{sr.zonePassCount}/{sr.zoneTotalCount}</span>
                        <DeltaChip value={zonesDelta} suffix="" />
                      </div>
                      {sr.adversarialExposureScore !== undefined && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] uppercase tracking-wider text-[#4d5870]">Adversarial exposure</span>
                          <span className="font-mono text-[10px] text-[#c7cfdf]">{sr.adversarialExposureScore.toFixed(2)}</span>
                        </div>
                      )}
                      {sr.delta?.description && (
                        <div className="col-span-2 text-[9px] leading-relaxed text-[#6b7a95]">
                          {sr.delta.description}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Assumption Sensitivity ── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#4a5568]">
              Assumption Sensitivity
            </span>
            <TruthBadge label="simulated" />
          </div>
          <button
            type="button"
            onClick={handleRunSensitivity}
            disabled={sensitivityRunning}
            className="inline-flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-1 text-[9px] text-[#8094b8] transition-colors hover:border-[#3a4158] hover:text-white disabled:opacity-50"
          >
            {sensitivityRunning ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
            {assumptionSensitivityResults ? "Re-run" : "Run Analysis"}
          </button>
        </div>

        {!assumptionSensitivityResults && !sensitivityRunning && (
          <p className="text-[9px] text-[#3d4d63]">
            Tests which assumptions most affect results — person height, night penalty, lighting, glare. Identifies the single biggest source of simulation uncertainty.
          </p>
        )}

        {sensitivityRunning && (
          <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-purple-300">
            <Loader2 className="size-4 animate-spin" />
            Running sensitivity tests…
          </div>
        )}

        {assumptionSensitivityResults && !sensitivityRunning && (
          <div className="space-y-1">
            {assumptionSensitivityResults
              .slice()
              .sort((a, b) => {
                const ORDER = ["critical", "high", "medium", "low", "none"];
                return ORDER.indexOf(a.sensitivity) - ORDER.indexOf(b.sensitivity);
              })
              .map((s) => (
                <div
                  key={s.assumptionName}
                  className="flex items-start justify-between gap-2 rounded-lg border border-[#1f2536] bg-[#0b0f17] px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-medium text-[#c7cfdf]">{s.assumptionName}</span>
                      <span
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider",
                          SENSITIVITY_COLOR[s.sensitivity],
                        )}
                      >
                        {s.sensitivity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[8px] leading-relaxed text-[#5b6880]">{s.description}</p>
                    {s.affectedZones.length > 0 && (
                      <p className="mt-0.5 text-[8px] text-[#4d5870]">
                        Affects: {s.affectedZones.slice(0, 3).join(", ")}
                        {s.affectedZones.length > 3 && ` +${s.affectedZones.length - 3} more`}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {s.zoneStatusChanges > 0 && (
                      <div className="flex items-center gap-1 justify-end">
                        <AlertTriangle className="size-2.5 text-orange-400" />
                        <span className="text-[8px] text-orange-400">{s.zoneStatusChanges} zone{s.zoneStatusChanges !== 1 ? "s" : ""} flip</span>
                      </div>
                    )}
                    {s.zoneStatusChanges === 0 && (
                      <div className="flex items-center gap-1 justify-end">
                        <CheckCircle2 className="size-2.5 text-emerald-400" />
                        <span className="text-[8px] text-emerald-400">Stable</span>
                      </div>
                    )}
                    <DeltaChip value={s.coverageDeltaPct} />
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
