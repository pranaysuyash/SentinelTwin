"use client";

import { useState } from "react";

import type { SimulationAssumptions } from "@/schema/security-scene";
import type { SecurityOutcomeModel } from "@/lib/security-outcome/security-outcome-model";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function AssumptionDisclosure({
  assumptions,
  model,
}: {
  assumptions: SimulationAssumptions;
  model?: SecurityOutcomeModel;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasLimitations = model && model.limitations.length > 0;
  const hasMissing = model && model.missingPrerequisites.length > 0;
  const hasDetails = (model && model.assumptions.length > 0) || hasLimitations || hasMissing;

  return (
    <section className={`rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel} p-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textMuted3}`}>Evidence and Assumptions</h3>
          <ExplainBadge text="Planning assumptions behind this security outcome and limitations of the simulation." />
        </div>
        {hasDetails ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`text-[9px] ${UI_SURFACES.textSoftMid} ${UI_SURFACES.hoverTextSoft}`}
          >
            {expanded ? "Collapse" : "Details"}
          </button>
        ) : null}
      </div>

      <div className={`mt-2 text-[10px] ${UI_SURFACES.textNear}`}>
        {assumptions.doriStandard === "oodpcvs_2025" ? "OODPCVS 2025" : "DORI 2014"} · Person {assumptions.personHeightM}m · Time {assumptions.timeOfDay}
      </div>
      <div className={`mt-1 text-[10px] ${UI_SURFACES.textSoftDim}`}>
        Simulation outputs are planning indicators under stated assumptions, not forensic guarantees.
      </div>

      {expanded && model ? (
        <div className="mt-3 space-y-3">
          {model.assumptions.length > 0 ? (
            <div className="space-y-1">
              <div className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${UI_SURFACES.textMuted3}`}>Active Assumptions</div>
              {model.assumptions.map((entry, idx) => (
                <div key={idx} className={`text-[10px] ${UI_SURFACES.textSoftMuted}`}>
                  <span className={`${UI_SURFACES.textNear}`}>{entry.label}:</span> {entry.value}
                  <span className={`${UI_SURFACES.textSoftMid}`}> — {entry.impact}</span>
                </div>
              ))}
            </div>
          ) : null}

          {hasLimitations ? (
            <div className="space-y-1">
              <div className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${UI_SURFACES.textMuted3}`}>Limitations</div>
              {model.limitations.map((lim, idx) => (
                <div key={idx} className={`text-[10px] ${UI_SURFACES.textSoftDim}`}>{lim}</div>
              ))}
            </div>
          ) : null}

          {hasMissing ? (
            <div className="space-y-1">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-400">Missing Prerequisites</div>
              {model.missingPrerequisites.map((prereq, idx) => (
                <div key={idx} className="text-[10px] text-amber-300">{prereq}</div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
