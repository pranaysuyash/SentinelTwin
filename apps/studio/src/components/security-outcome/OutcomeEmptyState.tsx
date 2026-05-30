"use client";

import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";
import { selectSecurityOutcomeFromStore } from "@/lib/security-outcome/security-outcome-selectors";
import { useStudioStore } from "@/store/studio-store";

export function OutcomeEmptyState() {
  const scene = useStudioStore((s) => s.scene);
  const result = useStudioStore((s) => s.simulationResult);
  const activePathId = useStudioStore((s) => s.activePathId);
  const model = selectSecurityOutcomeFromStore({ scene, simulationResult: result, activePathId });

  return (
    <div className="space-y-3 p-3">
      <RunSimulationPrompt
        className="rounded-xl border border-dashed border-[#2a3246] bg-[#0b0f17] px-3 py-4"
        message="Simulation not run yet. Run the shared simulation to compute the security outcome."
      />
      {model.missingPrerequisites.length > 0 ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">Setup Needed</div>
          <div className="mt-1 space-y-1">
            {model.missingPrerequisites.map((prereq, idx) => (
              <div key={idx} className="text-[10px] text-amber-200">{prereq}</div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
