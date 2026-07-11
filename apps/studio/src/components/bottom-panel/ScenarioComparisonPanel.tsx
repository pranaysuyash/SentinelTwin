"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Moon, Sun, Zap } from "lucide-react";
import { useState } from "react";

import { TruthBadge } from "@/components/shared/TruthBadge";
import { cn } from "@/lib/cn";
import { useStudioStore } from "@/store/studio-store";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


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
  none: `UI_SURFACES.textDimMid UI_SURFACES.card UI_SURFACES.borderSubtle`,
};

function DeltaChip({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const good = value > 0;
  const bad = value < 0;
  return (
    <span
      className={cn(
        "font-mono text-[9px] font-medium",
        good ? "text-emerald-400" : bad ? "text-red-400" : "UI_SURFACES.textSoftDim",
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
        <p className={`text-center text-[10px] leading-relaxed UI_SURFACES.textDimMid`}>
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
            <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textMuted`}>
              Scenario Comparison
            </span>
            <TruthBadge label="simulated" />
          </div>
          <button
            type="button"
            onClick={handleRunScenarios}
            disabled={scenarioRunning}
            className={`inline-flex items-center gap-1 rounded-md border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-1 text-[9px] UI_SURFACES.textSoftBright transition-colors hover:UI_SURFACES.textDim hover:text-white disabled:opacity-50`}
          >
            {scenarioRunning ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
            {scenarioBatchResults ? "Re-run" : "Run Scenarios"}
          </button>
        </div>

        {!scenarioBatchResults && !scenarioRunning && (
          <p className={`text-[9px] UI_SURFACES.textDim`}>
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
            <div className={`rounded-xl border UI_SURFACES.borderThin UI_SURFACES.panelDeepAlt px-3 py-2`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="size-3 text-yellow-300" />
                  <span className={`text-[10px] font-medium UI_SURFACES.textBody`}>Baseline (current)</span>
                </div>
                <div className="flex items-center gap-3 text-[9px] UI_SURFACES.textSoftDim">
                  <span className={`font-mono UI_SURFACES.textBody`}>{baseline.totalCoveragePct.toFixed(1)}%</span>
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
                    isWorst ? "border-red-500/30 bg-red-950/10" : `UI_SURFACES.borderSubtle UI_SURFACES.panel`,
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between"
                    onClick={() => setExpandedScenario(isExpanded ? null : sr.scenarioId)}
                  >
                    <div className="flex items-center gap-2">
                      {SCENARIO_ICON[sr.scenarioId] ?? <Moon className={`size-3 UI_SURFACES.textDimMid`} />}
                      <span className={`text-[10px] font-medium UI_SURFACES.textBody`}>{sr.label}</span>
                      {isWorst && (
                        <span className="flex items-center gap-0.5 rounded-md border border-red-500/20 bg-red-500/10 px-1 py-0.5 text-[8px] text-red-400">
                          <AlertTriangle className="size-2" />
                          Worst case
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <DeltaChip value={coverageDelta} />
                      {isExpanded ? <ChevronUp className={`size-3 UI_SURFACES.textDimMid`} /> : <ChevronDown className={`size-3 UI_SURFACES.textDimMid`} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className={`mt-2 grid grid-cols-2 gap-2 rounded-lg border UI_SURFACES.borderFaint UI_SURFACES.page/60 px-2 py-2`}>
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-[8px] uppercase tracking-wider UI_SURFACES.textDimMid`}>Coverage</span>
                        <span className={`font-mono text-[10px] UI_SURFACES.textBody`}>{sr.totalCoveragePct.toFixed(1)}%</span>
                        <DeltaChip value={coverageDelta} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-[8px] uppercase tracking-wider UI_SURFACES.textDimMid`}>Zones passing</span>
                        <span className={`font-mono text-[10px] UI_SURFACES.textBody`}>{sr.zonePassCount}/{sr.zoneTotalCount}</span>
                        <DeltaChip value={zonesDelta} suffix="" />
                      </div>
                      {sr.adversarialExposureScore !== undefined && (
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[8px] uppercase tracking-wider UI_SURFACES.textDimMid`}>Adversarial exposure</span>
                          <span className={`font-mono text-[10px] UI_SURFACES.textBody`}>{sr.adversarialExposureScore.toFixed(2)}</span>
                        </div>
                      )}
                      {sr.delta?.description && (
                        <div className="col-span-2 text-[9px] leading-relaxed UI_SURFACES.textMuted2">
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
            <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] UI_SURFACES.textMuted`}>
              Assumption Sensitivity
            </span>
            <TruthBadge label="simulated" />
          </div>
          <button
            type="button"
            onClick={handleRunSensitivity}
            disabled={sensitivityRunning}
            className={`inline-flex items-center gap-1 rounded-md border UI_SURFACES.borderThin UI_SURFACES.card px-2 py-1 text-[9px] UI_SURFACES.textSoftBright transition-colors hover:UI_SURFACES.textDim hover:text-white disabled:opacity-50`}
          >
            {sensitivityRunning ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
            {assumptionSensitivityResults ? "Re-run" : "Run Analysis"}
          </button>
        </div>

        {!assumptionSensitivityResults && !sensitivityRunning && (
          <p className={`text-[9px] UI_SURFACES.textDim`}>
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
                  className={`flex items-start justify-between gap-2 rounded-lg border UI_SURFACES.borderSubtle UI_SURFACES.panel px-2.5 py-2`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-medium UI_SURFACES.textBody`}>{s.assumptionName}</span>
                      <span
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider",
                          SENSITIVITY_COLOR[s.sensitivity],
                        )}
                      >
                        {s.sensitivity}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[8px] leading-relaxed UI_SURFACES.textMuted7">{s.description}</p>
                    {s.affectedZones.length > 0 && (
                      <p className={`mt-0.5 text-[8px] UI_SURFACES.textDimMid`}>
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
