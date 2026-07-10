/**
 * Lifecycle Transition Hooks — detects lifecycle stage changes and runs
 * side effects. This is the canonical place for lifecycle-triggered
 * automation (e.g., auto-run simulation when stage reaches approved).
 *
 * Uses refs to track previous state — no render cycles from transitions.
 * Side effects use `useStudioStore.getState()` to avoid stale closures.
 *
 * @see ~/lib/product-lifecycle.ts
 * @see ~/lib/use-product-lifecycle.ts
 */

import { useEffect, useRef } from "react";
import { useStudioStore } from "@/store/studio-store";
import { useProductLifecycle } from "@/lib/use-product-lifecycle";
import type { ProductLifecycleStage } from "@/lib/product-lifecycle";

/**
 * Side-effect map: what to do when the lifecycle transitions from
 * one stage to another. Each key is `"from→to"`.
 *
 * Side effects are intentionally lightweight — UI notices, not heavy
 * computations. The simulation itself is triggered by the user or by
 * `activateWorkspaceFromDraft`, not by this hook.
 */
const TRANSITION_EFFECTS: Record<string, (notice: (msg: string) => void) => void> = {
  // Scene has content but hasn't been submitted for review yet.
  // Surface a subtle prompt.
  "intake→draft": (notice) => {
    notice("Scene created. Add cameras and zones, then submit for review.");
  },

  // Scene was approved — prompt the operator to run the baseline simulation.
  "draft→approved": (notice) => {
    notice("Scene approved. Run the baseline simulation to compute coverage.");
  },

  // Simulation completed — surface the result summary.
  "approved→simulated": (notice) => {
    const { simulationResult } = useStudioStore.getState();
    const pct = simulationResult?.totalCoveragePct;
    if (pct != null) {
      notice(`Baseline simulation complete — ${Math.round(pct)}% overall coverage.`);
    } else {
      notice("Baseline simulation complete. Review coverage results.");
    }
  },

  // Report generated — surface the report link.
  "simulated→reported": (notice) => {
    notice("Report generated. Review the export for compliance evidence.");
  },
};

/**
 * Hook that watches for lifecycle stage transitions and fires side effects.
 *
 * Mount this in a component that's always rendered (e.g., ProductViewRouter
 * or StudioShell). Uses refs for previous-state tracking so transitions
 * don't cause re-render loops.
 */
export function useLifecycleTransitions(): void {
  const lifecycle = useProductLifecycle();
  const prevStageRef = useRef<ProductLifecycleStage | null>(null);

  useEffect(() => {
    const prevStage = prevStageRef.current;
    const currentStage = lifecycle.stage;

    // First render — seed the ref, don't fire.
    if (prevStage === null) {
      prevStageRef.current = currentStage;
      return;
    }

    // No change — nothing to do.
    if (prevStage === currentStage) return;

    // Stage changed — update the ref and fire the side effect.
    prevStageRef.current = currentStage;

    const effectKey = `${prevStage}→${currentStage}`;
    const effect = TRANSITION_EFFECTS[effectKey];
    if (effect) {
      const setLaunchNotice = useStudioStore.getState().setLaunchNotice;
      if (setLaunchNotice) {
        effect(setLaunchNotice);
      }
    }
  }, [lifecycle.stage]);
}
