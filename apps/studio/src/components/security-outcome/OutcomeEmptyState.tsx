"use client";

import { RunSimulationPrompt } from "@/components/shared/RunSimulationPrompt";

export function OutcomeEmptyState() {
  return (
    <RunSimulationPrompt
      className="rounded-xl border border-dashed border-[#2a3246] bg-[#0b0f17] px-3 py-4"
      message="Simulation not run yet. Run the shared simulation to compute the security outcome."
    />
  );
}
